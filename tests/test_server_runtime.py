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

    def test_defaults_preserve_the_existing_orbit_runtime(self) -> None:
        configuration = parse_server_configuration([], root=self.root)
        self.assertEqual(configuration.host, "0.0.0.0")
        self.assertEqual(configuration.port, 4178)
        self.assertEqual(configuration.home_document, "index.html")
        self.assertEqual(configuration.database, self.root / "data" / "blog.sqlite3")

    def test_wonderlab_can_use_an_independent_port_and_shared_database(self) -> None:
        shared_database = self.root / "shared" / "blog.sqlite3"
        configuration = parse_server_configuration(
            [
                "--host",
                "127.0.0.1",
                "--port",
                "4179",
                "--home",
                "wonderlab/index.html",
                "--database",
                str(shared_database),
            ],
            root=self.root,
        )
        self.assertEqual(configuration.host, "127.0.0.1")
        self.assertEqual(configuration.port, 4179)
        self.assertEqual(configuration.home_document, "wonderlab/index.html")
        self.assertEqual(configuration.database, shared_database)

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


if __name__ == "__main__":
    unittest.main()
