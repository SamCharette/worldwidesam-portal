from __future__ import annotations

import http.client
import socket
import tempfile
import threading
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

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


def _start_test_server(
    root: Path,
    home_document: str = "index.html",
    neon_upstream: tuple[str, int] | None = None,
) -> tuple[ThreadingHTTPServer, threading.Thread]:
    class Handler(BlogRequestHandler):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, directory=str(root), **kwargs)

        def log_message(self, format: str, *args) -> None:
            pass

    Handler.root = root
    Handler.store = _StubStore()
    Handler.home_document = home_document
    if neon_upstream:
        Handler.neon_upstream_host, Handler.neon_upstream_port = neon_upstream
    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    return server, thread


def _start_neon_stub() -> tuple[ThreadingHTTPServer, threading.Thread]:
    class Handler(BaseHTTPRequestHandler):
        files = {
            "/": ("text/html; charset=utf-8", b"<!doctype html><title>Neon standalone</title>"),
            "/src/game.js": ("text/javascript; charset=utf-8", b"export const neon = true;"),
        }

        def do_GET(self) -> None:
            self._send(head_only=False)

        def do_HEAD(self) -> None:
            self._send(head_only=True)

        def _send(self, head_only: bool) -> None:
            route = self.files.get(urlparse(self.path).path)
            if route is None:
                status, content_type, body = 404, "text/plain; charset=utf-8", b"Not found\n"
            else:
                status, (content_type, body) = 200, route
            self.send_response(status)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Security-Policy", "default-src 'self'")
            self.end_headers()
            if not head_only:
                self.wfile.write(body)

        def log_message(self, format: str, *args) -> None:
            pass

    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    return server, thread


class PublicStaticHttpTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.tempdir = tempfile.TemporaryDirectory()
        cls.root = Path(cls.tempdir.name)
        cls._write_fixture_files()

        cls.server, cls.thread = _start_test_server(cls.root)
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
            "wonderlab/index.html": b"<!doctype html><title>Wonderlab home</title>",
            "wonderlab/layout.css": b"body { color: blue; }",
            "wonderlab/theme.css": b"body { background: cream; }",
            "wonderlab/app.js": b"export const wonderlab = true;",
            "wonderlab/assets/previews/app-640.webp": b"public preview",
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
            "/orbit/",
            "/styles.css",
            "/app.js?v=1",
            "/assets/public.png",
            "/assets/nested/public.json?cache=1",
            "/wasteland-terminal-map/",
            "/wasteland-terminal-map/index.html",
            "/wasteland-terminal-map/styles.css",
            "/wasteland-terminal-map/app.js",
            "/wasteland-terminal-map/assets/map.png",
            "/wonderlab/",
            "/wonderlab/index.html",
            "/wonderlab/layout.css?v=1",
            "/wonderlab/theme.css?v=1",
            "/wonderlab/app.js?v=1",
            "/wonderlab/assets/previews/app-640.webp",
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
            ("/orbit", "/orbit/"),
            ("/wonderlab", "/wonderlab/"),
            ("/neon-cycle-grid", "/neon-cycle-grid/"),
            ("/wasteland-terminal-map", "/wasteland-terminal-map/"),
        ):
            with self.subTest(path=path):
                status, headers, _ = self.request(path)
                self.assertEqual(status, 301)
                self.assertEqual(headers["Location"], location)

    def test_neon_route_proxies_only_to_the_standalone_service(self) -> None:
        upstream, upstream_thread = _start_neon_stub()
        server, thread = _start_test_server(self.root, neon_upstream=upstream.server_address)
        host, port = server.server_address
        connection = http.client.HTTPConnection(host, port, timeout=5)
        try:
            connection.request("GET", "/neon-cycle-grid/")
            response = connection.getresponse()
            self.assertEqual(response.status, 200)
            self.assertEqual(response.getheader("Cache-Control"), "no-store")
            self.assertEqual(response.getheader("Content-Security-Policy"), "default-src 'self'")
            self.assertIn(b"Neon standalone", response.read())

            connection.request("GET", "/neon-cycle-grid/src/game.js?cache=1")
            response = connection.getresponse()
            self.assertEqual(response.status, 200)
            self.assertEqual(response.getheader("Content-Type"), "text/javascript; charset=utf-8")
            self.assertEqual(response.read(), b"export const neon = true;")

            connection.request("GET", "/neon-cycle-grid/.git/config")
            response = connection.getresponse()
            self.assertEqual(response.status, 404)
            self.assertEqual(response.read(), b"Not found\n")

            connection.request("HEAD", "/neon-cycle-grid/src/game.js")
            response = connection.getresponse()
            self.assertEqual(response.status, 200)
            self.assertEqual(response.read(), b"")

            connection.request("POST", "/neon-cycle-grid/")
            response = connection.getresponse()
            self.assertEqual(response.status, 405)
            self.assertEqual(response.getheader("Allow"), "GET, HEAD")
            self.assertEqual(response.read(), b"Method not allowed\n")
        finally:
            connection.close()
            server.shutdown()
            server.server_close()
            thread.join(timeout=5)
            upstream.shutdown()
            upstream.server_close()
            upstream_thread.join(timeout=5)

    def test_neon_route_returns_a_bounded_error_when_the_service_is_offline(self) -> None:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as unavailable:
            unavailable.bind(("127.0.0.1", 0))
            server, thread = _start_test_server(
                self.root,
                neon_upstream=("127.0.0.1", unavailable.getsockname()[1]),
            )
            host, port = server.server_address
            connection = http.client.HTTPConnection(host, port, timeout=5)
            try:
                connection.request("GET", "/neon-cycle-grid/")
                response = connection.getresponse()
                self.assertEqual(response.status, 503)
                self.assertEqual(response.getheader("Retry-After"), "5")
                self.assertEqual(response.read(), b"Neon Cycle Grid is temporarily unavailable.\n")
            finally:
                connection.close()
                server.shutdown()
                server.server_close()
                thread.join(timeout=5)

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
            "/wonderlab/../server.py",
            "/wonderlab/%2e%2e/server.py",
            "/wonderlab/assets/",
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

    def test_configured_home_document_is_explicitly_allowlisted(self) -> None:
        self.assertEqual(
            resolve_public_file(self.root, "/", home_document="wonderlab/index.html"),
            self.root / "wonderlab" / "index.html",
        )
        self.assertIsNone(resolve_public_file(self.root, "/", home_document="README.md"))

        server, thread = _start_test_server(self.root, home_document="wonderlab/index.html")
        host, port = server.server_address
        connection = http.client.HTTPConnection(host, port, timeout=5)
        try:
            connection.request("GET", "/")
            response = connection.getresponse()
            self.assertEqual(response.status, 200)
            self.assertIn(b"Wonderlab home", response.read())
        finally:
            connection.close()
            server.shutdown()
            server.server_close()
            thread.join(timeout=5)

    def test_dynamic_and_static_cache_policies_are_distinct(self) -> None:
        status, headers, _ = self.request("/")
        self.assertEqual(status, 200)
        self.assertEqual(headers["Cache-Control"], "no-store, max-age=0")
        self.assertEqual(headers["Pragma"], "no-cache")

        status, headers, _ = self.request("/wonderlab/layout.css?v=1")
        self.assertEqual(status, 200)
        self.assertEqual(headers["Cache-Control"], "public, max-age=31536000, immutable")
        self.assertNotIn("Pragma", headers)

        status, headers, _ = self.request("/wonderlab/assets/previews/app-640.webp")
        self.assertEqual(status, 200)
        self.assertEqual(headers["Cache-Control"], "public, max-age=3600")

        status, headers, _ = self.request("/missing.txt")
        self.assertEqual(status, 404)
        self.assertEqual(headers["Cache-Control"], "no-store, max-age=0")

    def test_top_level_public_directory_cannot_be_a_symlink(self) -> None:
        with tempfile.TemporaryDirectory() as tempdir:
            root = Path(tempdir)
            (root / "README.md").write_bytes(b"synthetic private fixture")
            (root / "assets").symlink_to(root, target_is_directory=True)
            server, thread = _start_test_server(root)
            host, port = server.server_address
            connection = http.client.HTTPConnection(host, port, timeout=5)
            try:
                connection.request("GET", "/assets/README.md")
                response = connection.getresponse()
                self.assertEqual(response.status, 404)
                self.assertEqual(
                    int(response.getheader("Content-Length", "0")),
                    len(b"Not found\n"),
                )
                self.assertEqual(response.read(), b"Not found\n")
            finally:
                connection.close()
                server.shutdown()
                server.server_close()
                thread.join(timeout=5)


if __name__ == "__main__":
    unittest.main()
