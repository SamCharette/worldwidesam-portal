from __future__ import annotations

import json
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from .auth import authenticate
from .notifications import queue_and_deliver
from .rendering import render_home, render_index, render_post
from .storage import BlogStore


class BlogRequestHandler(SimpleHTTPRequestHandler):
    root: Path
    store: BlogStore

    def end_headers(self) -> None:
        self.send_header("Cache-Control", "no-store, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def do_GET(self) -> None:
        path = urlparse(self.path).path
        if path == "/":
            self._send_html(render_home((self.root / "index.html").read_text(encoding="utf-8"), self.store.latest_published()))
            return
        if path == "/blog/" or path == "/blog/index.html":
            self._send_html(render_index(self.store.list_posts()))
            return
        if path.startswith("/blog/") and path.endswith(".html"):
            slug = Path(path).stem
            post = self.store.get_post(slug)
            if post is None:
                self.send_error(HTTPStatus.NOT_FOUND)
                return
            self._send_html(render_post(post, self.store.comments_for_post(int(post["id"]))))
            return
        if path == "/api/blog/posts":
            include_drafts = self._authenticated_author() is not None and parse_qs(urlparse(self.path).query).get("status") == ["all"]
            self._send_json([self._post_json(post) for post in self.store.list_posts(include_drafts=include_drafts)])
            return
        if path == "/api/blog/notifications":
            if not self._require_auth():
                return
            self._send_json([dict(row) for row in self.store.list_notifications()])
            return
        super().do_GET()

    def do_POST(self) -> None:
        path = urlparse(self.path).path
        author = self._require_auth()
        if not author:
            return
        try:
            data = self._read_json()
            if path == "/api/blog/posts":
                post = self.store.create_or_update_post(data, author)
                if post["status"] == "published":
                    self._notify_peer("post_published", post["slug"], author, f"{author} published '{post['title']}'.")
                self._send_json(self._post_json(post), status=HTTPStatus.CREATED)
                return
            if path.startswith("/api/blog/posts/"):
                parts = [part for part in path.split("/") if part]
                if len(parts) < 5:
                    self.send_error(HTTPStatus.NOT_FOUND)
                    return
                slug = parts[3]
                action = parts[4]
                if action == "publish":
                    post = self.store.publish_post(slug)
                    self._notify_peer("post_published", slug, author, f"{author} published '{post['title']}'.")
                    self._send_json(self._post_json(post))
                    return
                if action == "comments":
                    kind = str(data.get("kind", "comment"))
                    post, comment_id = self.store.add_comment(slug, author, str(data.get("body_html", "")), kind=kind)
                    target = post["author_name"] if post["author_name"] != author else post["requested_reviewer_name"]
                    if target:
                        queue_and_deliver(
                            self.store,
                            "comment_created",
                            slug,
                            target,
                            f"{author} left a {kind} on '{post['title']}'.",
                            comment_id=comment_id,
                        )
                    self._send_json(self._post_json(post), status=HTTPStatus.CREATED)
                    return
                if action == "review-request":
                    reviewer = str(data.get("reviewer", "Vera"))
                    post = self.store.request_review(slug, reviewer)
                    queue_and_deliver(
                        self.store,
                        "review_requested",
                        slug,
                        reviewer,
                        f"{author} requested your review on '{post['title']}'.",
                    )
                    self._send_json(self._post_json(post))
                    return
                if action == "review-unavailable":
                    post = self.store.mark_review_unavailable(slug)
                    self._send_json(self._post_json(post))
                    return
        except (KeyError, ValueError, json.JSONDecodeError) as exc:
            self._send_json({"error": str(exc)}, status=HTTPStatus.BAD_REQUEST)
            return
        self.send_error(HTTPStatus.NOT_FOUND)

    def do_PATCH(self) -> None:
        path = urlparse(self.path).path
        author = self._require_auth()
        if not author:
            return
        if not path.startswith("/api/blog/posts/"):
            self.send_error(HTTPStatus.NOT_FOUND)
            return
        slug = Path(path).name
        try:
            data = self._read_json()
            data["slug"] = slug
            existing = self.store.get_post(slug, include_drafts=True)
            if existing:
                merged = dict(existing)
                merged.update(data)
                data = merged
            post = self.store.create_or_update_post(data, author)
        except (ValueError, json.JSONDecodeError) as exc:
            self._send_json({"error": str(exc)}, status=HTTPStatus.BAD_REQUEST)
            return
        self._send_json(self._post_json(post))

    def _authenticated_author(self) -> str | None:
        return authenticate(self.root, self.headers.get("Authorization"))

    def _require_auth(self) -> str | None:
        author = self._authenticated_author()
        if not author:
            self._send_json({"error": "valid agent bearer token required"}, status=HTTPStatus.UNAUTHORIZED)
        return author

    def _read_json(self) -> dict:
        length = int(self.headers.get("Content-Length", "0"))
        raw = self.rfile.read(length).decode("utf-8") if length else "{}"
        data = json.loads(raw)
        if not isinstance(data, dict):
            raise ValueError("JSON object required")
        return data

    def _send_html(self, body: str) -> None:
        encoded = body.encode("utf-8")
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)

    def _send_json(self, data: object, status: HTTPStatus = HTTPStatus.OK) -> None:
        encoded = json.dumps(data, indent=2, sort_keys=True).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)

    def _post_json(self, post) -> dict:
        return {
            "slug": post["slug"],
            "title": post["title"],
            "summary": post["summary"],
            "status": post["status"],
            "author": post["author_name"],
            "review_status": post["review_status"],
            "published_at": post["published_at"],
        }

    def _notify_peer(self, event_type: str, slug: str, author: str, message: str) -> None:
        target = "Vera" if author == "Clawdia" else "Clawdia"
        queue_and_deliver(self.store, event_type, slug, target, message)
