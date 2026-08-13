#!/usr/bin/env python3
from __future__ import annotations

import argparse
import os
import sqlite3
from datetime import UTC, datetime
from pathlib import Path


def verify_database(path: Path) -> None:
    with sqlite3.connect(f"file:{path}?mode=ro", uri=True) as connection:
        result = connection.execute("PRAGMA integrity_check").fetchone()
    if result != ("ok",):
        raise RuntimeError(f"SQLite integrity check failed for {path}: {result!r}")


def create_backup(source: Path, backup_directory: Path, release_sha: str) -> Path:
    source = source.resolve(strict=True)
    verify_database(source)
    backup_directory.mkdir(mode=0o700, parents=True, exist_ok=True)
    os.chmod(backup_directory, 0o700)
    timestamp = datetime.now(UTC).strftime("%Y%m%dT%H%M%S.%fZ")
    destination = backup_directory / f"pre-change-{timestamp}-{release_sha}.sqlite3"
    temporary = destination.with_suffix(".sqlite3.tmp")
    if temporary.exists():
        temporary.unlink()
    try:
        with sqlite3.connect(source) as source_connection:
            with sqlite3.connect(temporary) as backup_connection:
                source_connection.backup(backup_connection)
        os.chmod(temporary, 0o600)
        verify_database(temporary)
        temporary.replace(destination)
    finally:
        if temporary.exists():
            temporary.unlink()
    return destination


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Integrity-check and back up the portal SQLite database."
    )
    parser.add_argument("source", type=Path)
    parser.add_argument("backup_directory", type=Path)
    parser.add_argument("release_sha")
    args = parser.parse_args()
    if len(args.release_sha) != 40 or any(
        character not in "0123456789abcdef" for character in args.release_sha
    ):
        parser.error("release_sha must be a lowercase 40-character commit SHA")
    print(create_backup(args.source, args.backup_directory, args.release_sha))


if __name__ == "__main__":
    main()
