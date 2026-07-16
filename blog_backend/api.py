from __future__ import annotations

import json
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from .auth import authenticate
from .notifications import queue_and_deliver, retry_notification
from .public_static import resolve_public_file
from .rendering import render_home, render_index, render_post
from .storage import BlogStore


class BlogRequestHandler(SimpleHTTPRequestHandler):
    root: Path
    store: BlogStore
    home_document = "index.html"

    _DYNAMIC_CACHE_CONTROL = "no-store, max-age=0"
    _SHORT_STATIC_CACHE_CONTROL = "public, max-age=3600"
    _VERSIONED_STATIC_CACHE_CONTROL = "public, max-age=31536000, immutable"

    def end_headers(self) -> None:
        cache_control = getattr(self, "_cache_control", self._DYNAMIC_CACHE_CONTROL)
        self.send_header("Cache-Control", cache_control)
        if cache_control == self._DYNAMIC_CACHE_CONTROL:
            self.send_header("Pragma", "no-cache")
            self.send_header("Expires", "0")
        super().end_headers()

    def do_GET(self) -> None:
        self._handle_get(head_only=False)

    def do_HEAD(self) -> None:
        self._handle_get(head_only=True)

    def _handle_get(self, head_only: bool) -> None:
        self._cache_control = self._DYNAMIC_CACHE_CONTROL
        path = urlparse(self.path).path
        if path == "/":
            index_path = resolve_public_file(
                self.root,
                self.path,
                home_document=self.home_document,
            )
            if index_path is None:
                self._send_not_found(head_only=head_only)
                return
            self._send_html(
                render_home(index_path.read_text(encoding="utf-8"), self.store.latest_published()),
                head_only=head_only,
            )
            return
        if path == "/blog":
            self._send_redirect("/blog/", head_only=head_only)
            return
        if path == "/orbit":
            self._send_redirect("/orbit/", head_only=head_only)
            return
        if path == "/orbit/":
            index_path = resolve_public_file(self.root, path)
            if index_path is None:
                self._send_not_found(head_only=head_only)
                return
            self._send_html(
                render_home(index_path.read_text(encoding="utf-8"), self.store.latest_published()),
                head_only=head_only,
            )
            return
        if path == "/wonderlab":
            self._send_redirect("/wonderlab/", head_only=head_only)
            return
        if path in {"/wonderlab/", "/wonderlab/index.html"}:
            index_path = resolve_public_file(self.root, path)
            if index_path is None:
                self._send_not_found(head_only=head_only)
                return
            self._send_html(
                render_home(index_path.read_text(encoding="utf-8"), self.store.latest_published()),
                head_only=head_only,
            )
            return
        if path == "/blog/" or path == "/blog/index.html":
            self._send_html(render_index(self.store.list_posts()), head_only=head_only)
            return
        if path.startswith("/blog/") and path.endswith(".html"):
            slug = Path(path).stem
            post = self.store.get_post(slug)
            if post is None:
                self._send_not_found(head_only=head_only)
                return
            self._send_html(
                render_post(post, self.store.comments_for_post(int(post["id"]))),
                head_only=head_only,
            )
            return
        if path == "/api/blog/posts":
            include_drafts = self._authenticated_author() is not None and parse_qs(urlparse(self.path).query).get("status") == ["all"]
            self._send_json(
                [
                    self._post_json(post, include_review_status=include_drafts)
                    for post in self.store.list_posts(include_drafts=include_drafts)
                ],
                head_only=head_only,
            )
            return
        if path == "/api/blog/notifications":
            if not self._require_auth(head_only=head_only):
                return
            self._send_json([dict(row) for row in self.store.list_notifications()], head_only=head_only)
            return
        if path == "/wasteland-terminal-map":
            self._send_redirect("/wasteland-terminal-map/", head_only=head_only)
            return
        self._send_public_file(head_only=head_only)

    def do_POST(self) -> None:
        self._cache_control = self._DYNAMIC_CACHE_CONTROL
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
                self._send_json(self._post_json(post, include_review_status=True), status=HTTPStatus.CREATED)
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
                    self._send_json(self._post_json(post, include_review_status=True))
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
                    self._send_json(self._post_json(post, include_review_status=True), status=HTTPStatus.CREATED)
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
                    self._send_json(self._post_json(post, include_review_status=True))
                    return
                if action == "review-unavailable":
                    post = self.store.mark_review_unavailable(slug)
                    self._send_json(self._post_json(post, include_review_status=True))
                    return
            if path.startswith("/api/blog/notifications/"):
                parts = [part for part in path.split("/") if part]
                if len(parts) == 5 and parts[4] == "retry":
                    retry_notification(self.store, int(parts[3]))
                    self._send_json({"status": "retry attempted"})
                    return
        except (KeyError, ValueError, json.JSONDecodeError) as exc:
            self._send_json({"error": str(exc)}, status=HTTPStatus.BAD_REQUEST)
            return
        self.send_error(HTTPStatus.NOT_FOUND)

    def do_PATCH(self) -> None:
        self._cache_control = self._DYNAMIC_CACHE_CONTROL
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
        self._send_json(self._post_json(post, include_review_status=True))

    def _authenticated_author(self) -> str | None:
        return authenticate(self.root, self.headers.get("Authorization"))

    def _require_auth(self, head_only: bool = False) -> str | None:
        author = self._authenticated_author()
        if not author:
            self._send_json(
                {"error": "valid agent bearer token required"},
                status=HTTPStatus.UNAUTHORIZED,
                head_only=head_only,
            )
        return author

    def _read_json(self) -> dict:
        length = int(self.headers.get("Content-Length", "0"))
        raw = self.rfile.read(length).decode("utf-8") if length else "{}"
        data = json.loads(raw)
        if not isinstance(data, dict):
            raise ValueError("JSON object required")
        return data

    def _send_html(self, body: str, head_only: bool = False) -> None:
        encoded = body.encode("utf-8")
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(encoded)))
        self.end_headers()
        if not head_only:
            self.wfile.write(encoded)

    def _send_json(
        self,
        data: object,
        status: HTTPStatus = HTTPStatus.OK,
        head_only: bool = False,
    ) -> None:
        encoded = json.dumps(data, indent=2, sort_keys=True).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(encoded)))
        self.end_headers()
        if not head_only:
            self.wfile.write(encoded)

    def _send_public_file(self, head_only: bool = False) -> None:
        path = resolve_public_file(self.root, self.path)
        if path is None:
            self._send_not_found(head_only=head_only)
            return
        try:
            source = path.open("rb")
        except OSError:
            self._send_not_found(head_only=head_only)
            return
        with source:
            stat = path.stat()
            query = parse_qs(urlparse(self.path).query)
            self._cache_control = (
                self._VERSIONED_STATIC_CACHE_CONTROL
                if query.get("v")
                else self._SHORT_STATIC_CACHE_CONTROL
            )
            self.send_response(HTTPStatus.OK)
            self.send_header("Content-Type", self.guess_type(str(path)))
            self.send_header("Content-Length", str(stat.st_size))
            self.send_header("Last-Modified", self.date_time_string(stat.st_mtime))
            self.end_headers()
            if not head_only:
                self.copyfile(source, self.wfile)

    def _send_redirect(self, location: str, head_only: bool = False) -> None:
        encoded = b"Redirecting\n"
        self.send_response(HTTPStatus.MOVED_PERMANENTLY)
        self.send_header("Location", location)
        self.send_header("Content-Type", "text/plain; charset=utf-8")
        self.send_header("Content-Length", str(len(encoded)))
        self.end_headers()
        if not head_only:
            self.wfile.write(encoded)

    def _send_not_found(self, head_only: bool = False) -> None:
        encoded = b"Not found\n"
        self.send_response(HTTPStatus.NOT_FOUND)
        self.send_header("Content-Type", "text/plain; charset=utf-8")
        self.send_header("Content-Length", str(len(encoded)))
        self.end_headers()
        if not head_only:
            self.wfile.write(encoded)

    def _post_json(self, post, include_review_status: bool = False) -> dict:
        data = {
            "slug": post["slug"],
            "title": post["title"],
            "summary": post["summary"],
            "status": post["status"],
            "author": post["author_name"],
            "published_at": post["published_at"],
        }
        if include_review_status:
            data["review_status"] = post["review_status"]
        return data

    def _notify_peer(self, event_type: str, slug: str, author: str, message: str) -> None:
        target = "Vera" if author == "Clawdia" else "Clawdia"
        queue_and_deliver(self.store, event_type, slug, target, message)
