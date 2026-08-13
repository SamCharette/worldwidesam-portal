from __future__ import annotations

import os
import shutil
import sqlite3
import subprocess
from pathlib import Path


class PromotionHarness:
    def __init__(self, root: Path, project_root: Path, *, previous: bool = False):
        self.root = root
        self.project_root = project_root
        self.repository = root / "repository"
        self.release_root = root / "release-root"
        self.state_root = root / "state"
        self.fake_bin = root / "bin"
        self.fake_state = root / "fake-systemd"
        self.unit_path = root / "portal.service"
        self.previous_release = self.release_root / "releases" / ("0" * 40)
        self.previous_process: subprocess.Popen[bytes] | None = None
        self._create_repository()
        self._create_runtime_state()
        self._create_fake_commands()
        if previous:
            self._create_previous_service()

    def close(self) -> None:
        pid_path = self.fake_state / "pid"
        if pid_path.exists():
            try:
                os.kill(int(pid_path.read_text().strip()), 15)
            except (ProcessLookupError, ValueError):
                pass
        if self.previous_process is not None:
            if self.previous_process.poll() is None:
                self.previous_process.terminate()
            self.previous_process.wait(timeout=5)

    def run(self, failure_mode: str) -> subprocess.CompletedProcess[str]:
        environment = os.environ | {
            "PATH": f"{self.fake_bin}:{os.environ['PATH']}",
            "FAKE_SYSTEMD_STATE": str(self.fake_state),
            "FAKE_FAILURE_MODE": failure_mode,
            "FAKE_PREVIOUS_RELEASE": str(self.previous_release),
            "WORLDWIDESAM_PORTAL_RELEASE_ROOT": str(self.release_root),
            "WORLDWIDESAM_PORTAL_STATE_ROOT": str(self.state_root),
            "WORLDWIDESAM_PORTAL_UNIT_PATH": str(self.unit_path),
            "WORLDWIDESAM_PORTAL_READINESS_ATTEMPTS": "1",
            "WORLDWIDESAM_PORTAL_READINESS_INTERVAL": "0",
        }
        return subprocess.run(
            [
                "bash",
                str(self.project_root / "deploy/promote-release.sh"),
                str(self.repository),
                self.release_sha,
            ],
            env=environment,
            capture_output=True,
            text=True,
        )

    def _create_repository(self) -> None:
        self.repository.mkdir()
        (self.repository / "tests").mkdir()
        shutil.copytree(self.project_root / "deploy", self.repository / "deploy")
        (self.repository / "server.py").write_text("print('fixture')\n")
        (self.repository / "tests/test_smoke.py").write_text(
            "import unittest\n\n"
            "class SmokeTest(unittest.TestCase):\n"
            "    def test_fixture(self):\n"
            "        self.assertTrue(True)\n"
        )
        (self.repository / "tests/test_smoke.mjs").write_text(
            'import test from "node:test";\n'
            'test("fixture", () => {});\n'
        )
        subprocess.run(
            ["git", "init", "-b", "main"],
            cwd=self.repository,
            check=True,
            capture_output=True,
        )
        subprocess.run(["git", "add", "."], cwd=self.repository, check=True)
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
            cwd=self.repository,
            check=True,
            capture_output=True,
        )
        self.release_sha = subprocess.run(
            ["git", "rev-parse", "HEAD"],
            cwd=self.repository,
            check=True,
            capture_output=True,
            text=True,
        ).stdout.strip()
        subprocess.run(
            ["git", "remote", "add", "origin", str(self.repository)],
            cwd=self.repository,
            check=True,
        )

    def _create_runtime_state(self) -> None:
        self.state_root.mkdir()
        (self.state_root / "private-sites").mkdir()
        with sqlite3.connect(self.state_root / "blog.sqlite3") as connection:
            connection.execute("CREATE TABLE posts (title TEXT NOT NULL)")
        self.fake_bin.mkdir()
        self.fake_state.mkdir()

    def _create_previous_service(self) -> None:
        self.previous_release.mkdir(parents=True)
        (self.previous_release / ".release-sha").write_text("0" * 40 + "\n")
        (self.release_root / "current").symlink_to(self.previous_release)
        self.unit_path.write_text("previous-unit\n")
        (self.fake_state / "active").touch()
        (self.fake_state / "enabled").touch()
        self.previous_process = subprocess.Popen(["sleep", "60"], cwd=self.previous_release)
        (self.fake_state / "pid").write_text(f"{self.previous_process.pid}\n")

    def _create_fake_commands(self) -> None:
        systemctl = self.fake_bin / "systemctl"
        systemctl.write_text(
            "#!/bin/bash\n"
            "set -eu\n"
            'state=$FAKE_SYSTEMD_STATE\n'
            'printf "%s\\n" "$*" >> "$state/log"\n'
            'if [[ ${1:-} == --user ]]; then shift; fi\n'
            'command=${1:-}; shift || true\n'
            'case "$command" in\n'
            '  is-active) test -f "$state/active" ;;\n'
            '  is-enabled) test -f "$state/enabled" ;;\n'
            '  show) cat "$state/pid" ;;\n'
            '  daemon-reload) : ;;\n'
            '  enable) touch "$state/enabled" ;;\n'
            '  restart)\n'
            '    if [[ -f $state/pid ]]; then kill "$(cat "$state/pid")" 2>/dev/null || true; fi\n'
            '    target=$(readlink -f "$WORLDWIDESAM_PORTAL_RELEASE_ROOT/current")\n'
            '    if [[ $FAKE_FAILURE_MODE == cwd && $target != $FAKE_PREVIOUS_RELEASE ]]; then target=/tmp; fi\n'
            '    (cd "$target" && exec sleep 60) </dev/null >/dev/null 2>&1 &\n'
            '    printf "%s\\n" "$!" > "$state/pid"\n'
            '    touch "$state/active"\n'
            '    ;;\n'
            '  disable|stop)\n'
            '    if [[ -f $state/pid ]]; then kill "$(cat "$state/pid")" 2>/dev/null || true; fi\n'
            '    rm -f "$state/pid" "$state/active"\n'
            '    [[ $command == stop ]] || rm -f "$state/enabled"\n'
            '    ;;\n'
            '  *) exit 2 ;;\n'
            "esac\n"
        )
        systemctl.chmod(0o755)
        fake_curl = self.fake_bin / "curl"
        fake_curl.write_text(
            "#!/bin/bash\n"
            'target=$(readlink -f "$WORLDWIDESAM_PORTAL_RELEASE_ROOT/current")\n'
            'if [[ $FAKE_FAILURE_MODE == curl && $target != $FAKE_PREVIOUS_RELEASE ]]; then exit 22; fi\n'
            'if [[ " $* " == *" --write-out "* ]]; then printf 302; fi\n'
        )
        fake_curl.chmod(0o755)
        fake_ss = self.fake_bin / "ss"
        fake_ss.write_text(
            "#!/bin/bash\n"
            'pid=$(cat "$FAKE_SYSTEMD_STATE/pid")\n'
            'target=$(readlink -f "$WORLDWIDESAM_PORTAL_RELEASE_ROOT/current")\n'
            'if [[ $target != $FAKE_PREVIOUS_RELEASE ]]; then\n'
            '  [[ $FAKE_FAILURE_MODE == pid ]] && pid=$((pid + 1))\n'
            '  [[ $FAKE_FAILURE_MODE == listener ]] && address=0.0.0.0 || address=127.0.0.1\n'
            'else address=127.0.0.1; fi\n'
            'printf "LISTEN 0 511 %s:4178 0.0.0.0:* users:((\\\"python3\\\",pid=%s,fd=3))\\n" "$address" "$pid"\n'
        )
        fake_ss.chmod(0o755)
