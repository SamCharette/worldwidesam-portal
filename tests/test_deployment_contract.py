from __future__ import annotations

import os
import sqlite3
import stat
import subprocess
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


class DeploymentContractTests(unittest.TestCase):
    def test_service_uses_immutable_code_and_external_runtime_state(self) -> None:
        unit = (ROOT / "deploy/worldwidesam-portal.service").read_text()
        self.assertIn(
            "WorkingDirectory=%h/.local/lib/worldwidesam-portal/current", unit
        )
        self.assertIn("--host 127.0.0.1 --port 4178", unit)
        self.assertIn(
            "--database %h/.local/share/worldwidesam-portal/blog.sqlite3", unit
        )
        self.assertIn(
            "--private-sites %h/.local/share/worldwidesam-portal/private-sites",
            unit,
        )
        self.assertIn("ProtectSystem=strict", unit)
        self.assertIn(
            "ReadOnlyPaths=%h/.local/lib/worldwidesam-portal", unit
        )
        self.assertIn(
            "ReadWritePaths=%h/.local/share/worldwidesam-portal", unit
        )

    def test_promotion_preserves_release_and_rollback_gates(self) -> None:
        script = (ROOT / "deploy/promote-release.sh").read_text()
        for required in (
            'merge-base --is-ancestor "$release_sha" origin/main',
            'chmod -R a-w "$staging_path"',
            'mv -Tf "$current_link.next" "$current_link"',
            "for _attempt in $(seq 1 30)",
            "rollback()",
            "deploy/backup_database.py",
            "/blog/ /orbit/ /wonderlab/app.js /procon/",
        ):
            self.assertIn(required, script)

    def test_backup_is_integrity_checked_and_private(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            database = root / "blog.sqlite3"
            backups = root / "backups"
            with sqlite3.connect(database) as connection:
                connection.execute("CREATE TABLE posts (title TEXT NOT NULL)")
                connection.execute("INSERT INTO posts VALUES ('Orbit Log')")
            release_sha = "a" * 40
            result = subprocess.run(
                [
                    "python3",
                    str(ROOT / "deploy/backup_database.py"),
                    str(database),
                    str(backups),
                    release_sha,
                ],
                check=True,
                capture_output=True,
                text=True,
            )
            backup = Path(result.stdout.strip())
            self.assertTrue(backup.is_file())
            self.assertEqual(stat.S_IMODE(os.stat(backup).st_mode), 0o600)
            with sqlite3.connect(backup) as connection:
                self.assertEqual(
                    connection.execute("SELECT title FROM posts").fetchone(),
                    ("Orbit Log",),
                )


if __name__ == "__main__":
    unittest.main()
