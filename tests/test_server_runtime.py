from __future__ import annotations

import tempfile
import unittest
from contextlib import redirect_stderr
from io import StringIO
from pathlib import Path

from blog_backend.server_runtime import parse_server_configuration


class ServerConfigurationTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tempdir = tempfile.TemporaryDirectory()
        self.addCleanup(self.tempdir.cleanup)
        self.root = Path(self.tempdir.name)

    def test_defaults_serve_wonderlab_on_the_existing_port(self) -> None:
        configuration = parse_server_configuration([], root=self.root)
        self.assertEqual(configuration.host, "127.0.0.1")
        self.assertEqual(configuration.port, 4178)
        self.assertEqual(configuration.home_document, "wonderlab/index.html")
        self.assertEqual(configuration.database, self.root / "data" / "blog.sqlite3")
        self.assertEqual(
            configuration.private_sites,
            self.root / "data" / "private-sites",
        )

    def test_orbit_can_be_selected_for_an_independent_port_and_shared_database(self) -> None:
        shared_database = self.root / "shared" / "blog.sqlite3"
        configuration = parse_server_configuration(
            [
                "--host",
                "127.0.0.1",
                "--port",
                "4179",
                "--home",
                "index.html",
                "--database",
                str(shared_database),
                "--private-sites",
                "runtime/private-sites",
            ],
            root=self.root,
        )
        self.assertEqual(configuration.host, "127.0.0.1")
        self.assertEqual(configuration.port, 4179)
        self.assertEqual(configuration.home_document, "index.html")
        self.assertEqual(configuration.database, shared_database)
        self.assertEqual(
            configuration.private_sites,
            self.root / "runtime" / "private-sites",
        )

    def test_relative_database_path_resolves_from_portal_root(self) -> None:
        configuration = parse_server_configuration(
            ["--database", "runtime/candidate.sqlite3"],
            root=self.root,
        )
        self.assertEqual(configuration.database, self.root / "runtime" / "candidate.sqlite3")

    def test_invalid_port_and_home_document_are_rejected(self) -> None:
        for arguments in (
            ["--port", "0"],
            ["--port", "65536"],
            ["--home", "README.md"],
            ["--home", "../index.html"],
        ):
            with self.subTest(arguments=arguments), redirect_stderr(StringIO()), self.assertRaises(SystemExit):
                parse_server_configuration(arguments, root=self.root)

    def test_private_sites_cannot_overlap_public_static_directories(self) -> None:
        for private_sites in (
            "assets/private-sites",
            "procon/private-sites",
            "wasteland-terminal-map/private-sites",
            "wonderlab/private-sites",
        ):
            with (
                self.subTest(private_sites=private_sites),
                redirect_stderr(StringIO()),
                self.assertRaises(SystemExit),
            ):
                parse_server_configuration(
                    ["--private-sites", private_sites],
                    root=self.root,
                )


if __name__ == "__main__":
    unittest.main()
