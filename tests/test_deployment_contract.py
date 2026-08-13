from __future__ import annotations

import os
import shutil
import sqlite3
import stat
import subprocess
import tempfile
import unittest
from pathlib import Path

from tests.promotion_harness import PromotionHarness

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

    def test_promotion_preserves_release_and_runtime_gates(self) -> None:
        script = (ROOT / "deploy/promote-release.sh").read_text()
        for required in (
            'fetch origin main',
            'merge-base --is-ancestor "$release_sha" origin/main',
            "release already exists; refusing to trust or overwrite it",
            'chmod -R a-w "$staging_path"',
            'mv -T "$staging_path" "$release_path"',
            'mv -Tf "$current_link.next" "$current_link"',
            'systemctl --user show --property MainPID --value',
            "ss -H -ltnp 'sport = :4178'",
            "rollback()",
            "deploy/backup_database.py",
            "/blog/ /orbit/ /wonderlab/app.js /procon/",
        ):
            self.assertIn(required, script)

    def test_existing_release_is_rejected_before_service_mutation(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            repository = root / "repository"
            release_root = root / "releases-root"
            state_root = root / "state"
            fake_bin = root / "bin"
            repository.mkdir()
            state_root.mkdir()
            (state_root / "private-sites").mkdir()
            fake_bin.mkdir()
            shutil.copytree(ROOT / "deploy", repository / "deploy")
            with sqlite3.connect(state_root / "blog.sqlite3") as connection:
                connection.execute("CREATE TABLE posts (title TEXT NOT NULL)")
            subprocess.run(["git", "init", "-b", "main"], cwd=repository, check=True, capture_output=True)
            subprocess.run(["git", "add", "."], cwd=repository, check=True)
            subprocess.run(
                [
                    "git",
                    "-c",
                    "user.name=Test",
                    "-c",
                    "user.email=test@example.invalid",
                    "commit",
                    "-m",
                    "fixture",
                ],
                cwd=repository,
                check=True,
                capture_output=True,
            )
            release_sha = subprocess.run(
                ["git", "rev-parse", "HEAD"],
                cwd=repository,
                check=True,
                capture_output=True,
                text=True,
            ).stdout.strip()
            subprocess.run(
                ["git", "remote", "add", "origin", str(repository)],
                cwd=repository,
                check=True,
            )
            existing = release_root / "releases" / release_sha
            existing.mkdir(parents=True)
            marker = root / "systemctl-was-called"
            systemctl = fake_bin / "systemctl"
            systemctl.write_text(f"#!/bin/sh\ntouch '{marker}'\nexit 99\n")
            systemctl.chmod(0o755)
            environment = os.environ | {
                "PATH": f"{fake_bin}:{os.environ['PATH']}",
                "WORLDWIDESAM_PORTAL_RELEASE_ROOT": str(release_root),
                "WORLDWIDESAM_PORTAL_STATE_ROOT": str(state_root),
                "WORLDWIDESAM_PORTAL_UNIT_PATH": str(root / "portal.service"),
            }
            result = subprocess.run(
                [
                    "bash",
                    str(ROOT / "deploy/promote-release.sh"),
                    str(repository),
                    release_sha,
                ],
                env=environment,
                capture_output=True,
                text=True,
            )
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("release already exists", result.stderr)
            self.assertFalse(marker.exists())

    def test_atomic_publication_cannot_nest_into_a_racing_release(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            staging = root / "staging"
            release = root / "release"
            staging.mkdir()
            release.mkdir()
            (staging / "verified").write_text("verified\n")
            (release / "tampered").write_text("tampered\n")
            result = subprocess.run(
                ["mv", "-T", str(staging), str(release)],
                capture_output=True,
                text=True,
            )
            self.assertNotEqual(result.returncode, 0)
            self.assertEqual((release / "tampered").read_text(), "tampered\n")
            self.assertFalse((release / "staging").exists())

    def test_failed_first_activation_restores_absent_service_state(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            harness = PromotionHarness(Path(directory), ROOT)
            try:
                result = harness.run("curl")
                self.assertNotEqual(result.returncode, 0)
                self.assertFalse((harness.release_root / "current").exists())
                self.assertFalse(harness.unit_path.exists())
                self.assertFalse((harness.fake_state / "active").exists())
                self.assertFalse((harness.fake_state / "enabled").exists())
            finally:
                harness.close()

    def test_failed_upgrade_restores_prior_release_unit_and_state(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            harness = PromotionHarness(Path(directory), ROOT, previous=True)
            try:
                result = harness.run("curl")
                self.assertNotEqual(result.returncode, 0)
                self.assertEqual(
                    (harness.release_root / "current").resolve(),
                    harness.previous_release,
                )
                self.assertEqual(harness.unit_path.read_text(), "previous-unit\n")
                self.assertTrue((harness.fake_state / "active").exists())
                self.assertTrue((harness.fake_state / "enabled").exists())
                service_log = (harness.fake_state / "log").read_text()
                self.assertGreaterEqual(
                    service_log.count("restart worldwidesam-portal.service"), 2
                )
            finally:
                harness.close()

    def test_wrong_pid_cwd_or_listener_cannot_pass_readiness(self) -> None:
        for failure_mode in ("pid", "cwd", "listener"):
            with self.subTest(failure_mode=failure_mode):
                with tempfile.TemporaryDirectory() as directory:
                    harness = PromotionHarness(Path(directory), ROOT)
                    try:
                        result = harness.run(failure_mode)
                        self.assertNotEqual(result.returncode, 0)
                        self.assertFalse((harness.release_root / "current").exists())
                    finally:
                        harness.close()

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
