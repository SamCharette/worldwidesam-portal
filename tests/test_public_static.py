from __future__ import annotations

import http.client
import tempfile
import threading
import unittest
from http.server import ThreadingHTTPServer
from pathlib import Path

from blog_backend.api import BlogRequestHandler
from blog_backend.public_static import resolve_public_file


class _StubStore:
    def latest_published(self):
        return None

    def list_posts(self, include_drafts: bool = False):
        return []

    def get_post(self, slug: str):
        if slug != "public-post":
            return None
        return {
            "id": 1,
            "slug": slug,
            "title": "Public Post",
            "summary": "Public summary.",
            "body_html": "<p>Public body.</p>",
            "status": "published",
            "author_name": "Clawdia",
            "published_at": "2026-07-16T12:00:00+00:00",
        }

    def comments_for_post(self, post_id: int):
        return []


class PublicStaticHttpTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.tempdir = tempfile.TemporaryDirectory()
        cls.root = Path(cls.tempdir.name)
        cls._write_fixture_files()

        root = cls.root

        class Handler(BlogRequestHandler):
            def __init__(self, *args, **kwargs):
                super().__init__(*args, directory=str(root), **kwargs)

            def log_message(self, format: str, *args) -> None:
                pass

        Handler.root = root
        Handler.store = _StubStore()
        cls.server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.host, cls.port = cls.server.server_address

    @classmethod
    def tearDownClass(cls) -> None:
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join(timeout=5)
        cls.tempdir.cleanup()

    @classmethod
    def _write_fixture_files(cls) -> None:
        files = {
            "index.html": b"<!doctype html><title>Public home</title>",
            "styles.css": b"body { color: navy; }",
            "app.js": b"export const publicApp = true;",
            "assets/public.png": b"public image",
            "assets/nested/public.json": b'{"public": true}',
            "wasteland-terminal-map/index.html": b"<!doctype html><title>Public map</title>",
            "wasteland-terminal-map/styles.css": b"body { color: green; }",
            "wasteland-terminal-map/app.js": b"window.publicMap = true;",
            "wasteland-terminal-map/assets/map.png": b"public map image",
            ".env": b"synthetic private fixture",
            ".git/config": b"synthetic repo fixture",
            "data/blog.sqlite3": b"synthetic database fixture",
            "server.py": b"synthetic source fixture",
            "tests/test_private.py": b"synthetic test fixture",
            "assets/tool.py": b"synthetic source fixture",
            "assets/data/private.txt": b"synthetic private fixture",
            "assets/.hidden": b"synthetic private fixture",
        }
        for name, content in files.items():
            path = cls.root / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(content)
        (cls.root / "private.txt").write_bytes(b"synthetic private fixture")
        (cls.root / "assets" / "escape.txt").symlink_to(cls.root / "private.txt")

    def request(self, path: str, method: str = "GET") -> tuple[int, dict[str, str], bytes]:
        connection = http.client.HTTPConnection(self.host, self.port, timeout=5)
        self.addCleanup(connection.close)
        connection.request(method, path)
        response = connection.getresponse()
        return response.status, dict(response.getheaders()), response.read()

    def test_explicit_public_routes_are_served(self) -> None:
        for path in (
            "/",
            "/styles.css",
            "/app.js?v=1",
            "/assets/public.png",
            "/assets/nested/public.json?cache=1",
            "/wasteland-terminal-map/",
            "/wasteland-terminal-map/index.html",
            "/wasteland-terminal-map/styles.css",
            "/wasteland-terminal-map/app.js",
            "/wasteland-terminal-map/assets/map.png",
            "/blog/",
            "/blog/public-post.html",
            "/api/blog/posts",
        ):
            with self.subTest(path=path):
                status, _, body = self.request(path)
                self.assertEqual(status, 200)
                self.assertTrue(body)

    def test_extensionless_public_directories_redirect_to_canonical_routes(self) -> None:
        for path, location in (
            ("/blog", "/blog/"),
            ("/wasteland-terminal-map", "/wasteland-terminal-map/"),
        ):
            with self.subTest(path=path):
                status, headers, _ = self.request(path)
                self.assertEqual(status, 301)
                self.assertEqual(headers["Location"], location)

    def test_private_and_unlisted_repo_paths_share_a_generic_404(self) -> None:
        denied_paths = (
            "/index.html",
            "/README.md",
            "/BLOG_AUTOMATION.md",
            "/server.py",
            "/blog_backend/api.py",
            "/tests/test_private.py",
            "/data/blog.sqlite3",
            "/.env",
            "/.git/config",
            "/assets/",
            "/assets/nested/",
            "/assets/tool.py",
            "/assets/data/private.txt",
            "/assets/.hidden",
            "/assets/escape.txt",
            "/wasteland-terminal-map/assets/",
            "/missing.txt",
        )
        bodies = set()
        for path in denied_paths:
            with self.subTest(path=path):
                status, _, body = self.request(path)
                self.assertEqual(status, 404)
                bodies.add(body)
        self.assertEqual(bodies, {b"Not found\n"})

    def test_traversal_and_ambiguous_paths_are_rejected(self) -> None:
        for path in (
            "/../server.py",
            "/%2e%2e/server.py",
            "/assets/../server.py",
            "/assets/%2e%2e/server.py",
            "/assets/%2e/public.png",
            "/assets//public.png",
            "/assets/%2f..%2fserver.py",
            "/%2egit/config",
            "/assets/%ff",
        ):
            with self.subTest(path=path):
                status, _, body = self.request(path)
                self.assertEqual(status, 404)
                self.assertEqual(body, b"Not found\n")

    def test_head_uses_the_same_public_policy_without_a_body(self) -> None:
        status, headers, body = self.request("/styles.css", method="HEAD")
        self.assertEqual(status, 200)
        self.assertEqual(int(headers["Content-Length"]), len(b"body { color: navy; }"))
        self.assertEqual(body, b"")

        status, headers, body = self.request("/server.py", method="HEAD")
        self.assertEqual(status, 404)
        self.assertEqual(int(headers["Content-Length"]), len(b"Not found\n"))
        self.assertEqual(body, b"")

    def test_resolver_rejects_a_symlink_escape(self) -> None:
        self.assertIsNone(resolve_public_file(self.root, "/assets/escape.txt"))


if __name__ == "__main__":
    unittest.main()
