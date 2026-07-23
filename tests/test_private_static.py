from __future__ import annotations

import http.client
import json
import os
import tempfile
import threading
import unittest
from http.server import ThreadingHTTPServer
from pathlib import Path

from blog_backend.api import BlogRequestHandler
from blog_backend.private_static import (
    PrivateStaticConfigurationError,
    PrivateStaticRegistry,
    PrivateStaticSite,
    RangeNotSatisfiable,
    parse_single_range,
)


class _StubStore:
    def latest_published(self):
        return None

    def list_posts(self, include_drafts: bool = False):
        return []

    def get_post(self, slug: str):
        return None

    def comments_for_post(self, post_id: int):
        return []


def _write_private_site(
    portal_root: Path,
    *,
    directory: str = "family",
    route: str = "/family-memory",
) -> Path:
    site_root = portal_root / "data" / "private-sites" / directory
    files = {
        "index.html": b"<!doctype html><title>Family memory</title>",
        "styles.css": b"body { color: navy; }",
        "audio/listen.flac": b"0123456789",
        "downloads/archive.wav": b"archive master",
    }
    for name, contents in files.items():
        path = site_root / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(contents)
    manifest = {
        "route": route,
        "index": "index.html",
        "assets": {
            "index.html": {"file": "index.html"},
            "styles.css": {"file": "styles.css"},
            "audio/listen.flac": {"file": "audio/listen.flac"},
            "downloads/Family-Memory.flac": {
                "file": "audio/listen.flac",
                "download_name": "Family-Memory.flac",
            },
            "downloads/Family-Memory-Archive.wav": {
                "file": "downloads/archive.wav",
                "download_name": "Family-Memory-Archive.wav",
            },
        },
    }
    (site_root / "site.json").write_text(
        json.dumps(manifest),
        encoding="utf-8",
    )
    return site_root


def _start_test_server(
    portal_root: Path,
    private_sites_root: Path,
) -> tuple[ThreadingHTTPServer, threading.Thread]:
    class Handler(BlogRequestHandler):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, directory=str(portal_root), **kwargs)

        def log_message(self, format: str, *args) -> None:
            pass

    Handler.root = portal_root
    Handler.store = _StubStore()
    Handler.private_sites = PrivateStaticRegistry.load(private_sites_root)
    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    return server, thread


class PrivateStaticHttpTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.tempdir = tempfile.TemporaryDirectory()
        cls.portal_root = Path(cls.tempdir.name)
        (cls.portal_root / "index.html").write_text(
            "<!doctype html><title>Portal</title>",
            encoding="utf-8",
        )
        cls.site_root = _write_private_site(cls.portal_root)
        cls.private_sites_root = cls.portal_root / "data" / "private-sites"
        cls.server, cls.thread = _start_test_server(
            cls.portal_root,
            cls.private_sites_root,
        )
        cls.host, cls.port = cls.server.server_address

    @classmethod
    def tearDownClass(cls) -> None:
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join(timeout=5)
        cls.tempdir.cleanup()

    def request(
        self,
        path: str,
        *,
        method: str = "GET",
        headers: dict[str, str] | None = None,
    ) -> tuple[int, dict[str, str], bytes]:
        connection = http.client.HTTPConnection(self.host, self.port, timeout=5)
        self.addCleanup(connection.close)
        connection.request(method, path, headers=headers or {})
        response = connection.getresponse()
        return response.status, dict(response.getheaders()), response.read()

    def test_route_canonicalizes_and_serves_only_the_manifest_index(self) -> None:
        status, headers, _ = self.request("/family-memory?from=share")
        self.assertEqual(status, 301)
        self.assertEqual(headers["Location"], "/family-memory/")

        status, headers, body = self.request("/family-memory/")
        self.assertEqual(status, 200)
        self.assertIn(b"Family memory", body)
        self.assertEqual(headers["Content-Type"], "text/html; charset=utf-8")
        self.assertEqual(headers["Cache-Control"], "no-store, max-age=0")
        self.assertEqual(headers["X-Robots-Tag"], "noindex, nofollow, noarchive")
        self.assertEqual(headers["Referrer-Policy"], "no-referrer")
        self.assertEqual(headers["X-Content-Type-Options"], "nosniff")
        self.assertIn("frame-ancestors 'none'", headers["Content-Security-Policy"])
        self.assertEqual(headers["Accept-Ranges"], "bytes")

    def test_query_assets_and_declared_download_aliases_are_served(self) -> None:
        status, headers, body = self.request(
            "/family-memory/audio/listen.flac?v=published"
        )
        self.assertEqual(status, 200)
        self.assertEqual(headers["Content-Type"], "audio/flac")
        self.assertEqual(body, b"0123456789")
        self.assertNotIn("Content-Disposition", headers)

        status, headers, body = self.request(
            "/family-memory/downloads/Family-Memory.flac"
        )
        self.assertEqual(status, 200)
        self.assertEqual(body, b"0123456789")
        self.assertEqual(
            headers["Content-Disposition"],
            'attachment; filename="Family-Memory.flac"',
        )

    def test_single_bounded_ranges_support_audio_seeking(self) -> None:
        cases = (
            ("bytes=2-5", b"2345", "bytes 2-5/10"),
            ("bytes=7-", b"789", "bytes 7-9/10"),
            ("bytes=-4", b"6789", "bytes 6-9/10"),
            ("bytes=8-99", b"89", "bytes 8-9/10"),
        )
        for range_header, expected_body, expected_content_range in cases:
            with self.subTest(range_header=range_header):
                status, headers, body = self.request(
                    "/family-memory/audio/listen.flac",
                    headers={"Range": range_header},
                )
                self.assertEqual(status, 206)
                self.assertEqual(body, expected_body)
                self.assertEqual(
                    int(headers["Content-Length"]),
                    len(expected_body),
                )
                self.assertEqual(headers["Content-Range"], expected_content_range)
                self.assertEqual(headers["Accept-Ranges"], "bytes")

    def test_invalid_or_multiple_ranges_return_a_bounded_416(self) -> None:
        for range_header in (
            "items=0-1",
            "bytes=",
            "bytes=0-1,4-5",
            "bytes=10-",
            "bytes=5-2",
            "bytes=-0",
            "bytes=abc-def",
            f"bytes={'9' * 5000}-",
        ):
            with self.subTest(range_header=range_header):
                status, headers, body = self.request(
                    "/family-memory/audio/listen.flac",
                    headers={"Range": range_header},
                )
                self.assertEqual(status, 416)
                self.assertEqual(headers["Content-Range"], "bytes */10")
                self.assertEqual(headers["Content-Length"], "0")
                self.assertEqual(headers["Accept-Ranges"], "bytes")
                self.assertEqual(body, b"")

    def test_head_ignores_range_and_never_sends_a_body(self) -> None:
        status, headers, body = self.request(
            "/family-memory/audio/listen.flac",
            method="HEAD",
            headers={"Range": "bytes=2-5"},
        )
        self.assertEqual(status, 200)
        self.assertEqual(headers["Content-Length"], "10")
        self.assertNotIn("Content-Range", headers)
        self.assertEqual(body, b"")

    def test_unlisted_ambiguous_and_lookalike_paths_are_generic_404s(self) -> None:
        for path in (
            "/family-memory/site.json",
            "/family-memory/missing.txt",
            "/family-memory/audio/",
            "/family-memory/.hidden",
            "/family-memory/../index.html",
            "/family-memory/%2e%2e/index.html",
            "/family-memory/audio%2flisten.flac",
            "/family-memory/audio//listen.flac",
            "/family-memory/audio/%ff.flac",
            "/family-memory-copy/",
            "/data/private-sites/family/index.html",
        ):
            with self.subTest(path=path):
                status, _, body = self.request(path)
                self.assertEqual(status, 404)
                self.assertEqual(body, b"Not found\n")

    def test_private_route_rejects_mutating_methods_before_blog_auth(self) -> None:
        for method in ("POST", "PATCH", "PUT", "DELETE", "OPTIONS"):
            with self.subTest(method=method):
                status, headers, body = self.request(
                    "/family-memory/downloads/Family-Memory.flac",
                    method=method,
                )
                self.assertEqual(status, 405)
                self.assertEqual(headers["Allow"], "GET, HEAD")
                self.assertEqual(headers["X-Robots-Tag"], "noindex, nofollow, noarchive")
                self.assertEqual(body, b"Method not allowed\n")

    def test_file_replaced_by_a_symlink_after_startup_is_not_served(self) -> None:
        with tempfile.TemporaryDirectory() as tempdir:
            portal_root = Path(tempdir)
            (portal_root / "index.html").write_text("Portal", encoding="utf-8")
            site_root = _write_private_site(portal_root)
            private_sites_root = portal_root / "data" / "private-sites"
            server, thread = _start_test_server(portal_root, private_sites_root)
            host, port = server.server_address
            audio = site_root / "audio" / "listen.flac"
            outside = portal_root / "outside.flac"
            outside.write_bytes(b"private outside file")
            audio.unlink()
            audio.symlink_to(outside)
            connection = http.client.HTTPConnection(host, port, timeout=5)
            try:
                connection.request("GET", "/family-memory/audio/listen.flac")
                response = connection.getresponse()
                self.assertEqual(response.status, 404)
                self.assertEqual(response.read(), b"Not found\n")
            finally:
                connection.close()
                server.shutdown()
                server.server_close()
                thread.join(timeout=5)

    def test_file_swapped_after_resolution_cannot_escape_the_site_root(self) -> None:
        with tempfile.TemporaryDirectory() as tempdir:
            portal_root = Path(tempdir)
            site_root = _write_private_site(portal_root)
            site = PrivateStaticSite.load(site_root)
            asset = site.resolve("/family-memory/audio/listen.flac")
            self.assertIsNotNone(asset)

            outside = portal_root / "outside.flac"
            outside.write_bytes(b"private outside file")
            audio = site_root / "audio" / "listen.flac"
            audio.unlink()
            audio.symlink_to(outside)

            with self.assertRaises(OSError):
                site.open_asset(asset)

    def test_directory_swapped_after_resolution_cannot_escape_the_site_root(self) -> None:
        with tempfile.TemporaryDirectory() as tempdir:
            portal_root = Path(tempdir)
            site_root = _write_private_site(portal_root)
            site = PrivateStaticSite.load(site_root)
            asset = site.resolve("/family-memory/audio/listen.flac")
            self.assertIsNotNone(asset)

            outside = portal_root / "outside"
            outside.mkdir()
            (outside / "listen.flac").write_bytes(b"private outside file")
            audio_directory = site_root / "audio"
            audio_directory.rename(site_root / "original-audio")
            audio_directory.symlink_to(outside, target_is_directory=True)

            with self.assertRaises(OSError):
                site.open_asset(asset)

    @unittest.skipUnless(hasattr(os, "mkfifo"), "FIFOs are not available")
    def test_fifo_swapped_after_resolution_is_rejected_without_blocking(self) -> None:
        with tempfile.TemporaryDirectory() as tempdir:
            portal_root = Path(tempdir)
            site_root = _write_private_site(portal_root)
            site = PrivateStaticSite.load(site_root)
            asset = site.resolve("/family-memory/audio/listen.flac")
            self.assertIsNotNone(asset)

            audio = site_root / "audio" / "listen.flac"
            audio.unlink()
            os.mkfifo(audio)

            with self.assertRaises(OSError):
                site.open_asset(asset)


class PrivateStaticConfigurationTests(unittest.TestCase):
    def test_range_parser_returns_none_without_a_header(self) -> None:
        self.assertIsNone(parse_single_range(None, 10))

    def test_range_parser_rejects_pathologically_large_bounds(self) -> None:
        with self.assertRaises(RangeNotSatisfiable):
            parse_single_range(f"bytes={'9' * 5000}-", 10)

    def test_missing_runtime_directory_disables_private_sites(self) -> None:
        with tempfile.TemporaryDirectory() as tempdir:
            missing = Path(tempdir) / "missing"
            self.assertEqual(PrivateStaticRegistry.load(missing).sites, ())

    def test_manifest_rejects_reserved_routes_and_unsafe_files(self) -> None:
        with tempfile.TemporaryDirectory() as tempdir:
            portal_root = Path(tempdir)
            reserved = _write_private_site(portal_root, route="/api")
            with self.assertRaises(PrivateStaticConfigurationError):
                PrivateStaticSite.load(reserved)

        with tempfile.TemporaryDirectory() as tempdir:
            portal_root = Path(tempdir)
            site_root = _write_private_site(portal_root)
            outside = portal_root / "outside.flac"
            outside.write_bytes(b"outside")
            linked = site_root / "audio" / "listen.flac"
            linked.unlink()
            linked.symlink_to(outside)
            with self.assertRaises(PrivateStaticConfigurationError):
                PrivateStaticSite.load(site_root)

    def test_manifest_rejects_normalized_or_trailing_public_paths(self) -> None:
        for public_path in (
            "audio//listen.flac",
            "audio/./listen.flac",
            "audio/listen.flac/",
        ):
            with self.subTest(public_path=public_path), tempfile.TemporaryDirectory() as tempdir:
                portal_root = Path(tempdir)
                site_root = _write_private_site(portal_root)
                manifest_path = site_root / "site.json"
                manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
                manifest["assets"][public_path] = {"file": "audio/listen.flac"}
                manifest_path.write_text(json.dumps(manifest), encoding="utf-8")
                with self.assertRaises(PrivateStaticConfigurationError):
                    PrivateStaticSite.load(site_root)

    def test_registry_rejects_duplicate_routes(self) -> None:
        with tempfile.TemporaryDirectory() as tempdir:
            portal_root = Path(tempdir)
            _write_private_site(portal_root, directory="one")
            _write_private_site(portal_root, directory="two")
            with self.assertRaises(PrivateStaticConfigurationError):
                PrivateStaticRegistry.load(
                    portal_root / "data" / "private-sites"
                )


if __name__ == "__main__":
    unittest.main()
