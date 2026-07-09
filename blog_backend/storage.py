from __future__ import annotations

import sqlite3
from datetime import datetime, timezone
from contextlib import contextmanager
from pathlib import Path
from typing import Any

from .content import StaticPost, load_static_posts

VALID_POST_STATUSES = {"draft", "published"}
VALID_REVIEW_STATUSES = {"not_requested", "pending", "reviewed", "unavailable"}


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


class BlogStore:
    def __init__(self, root: Path, db_path: Path | None = None) -> None:
        self.root = root
        self.db_path = db_path or root / "data" / "blog.sqlite3"

    def connect(self) -> sqlite3.Connection:
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON")
        return conn

    @contextmanager
    def connection(self):
        conn = self.connect()
        try:
            with conn:
                yield conn
        finally:
            conn.close()

    def initialize(self) -> None:
        with self.connection() as conn:
            conn.executescript(
                """
                CREATE TABLE IF NOT EXISTS authors (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL UNIQUE,
                    kind TEXT NOT NULL DEFAULT 'agent',
                    created_at TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS posts (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    slug TEXT NOT NULL UNIQUE,
                    title TEXT NOT NULL,
                    summary TEXT NOT NULL DEFAULT '',
                    body_html TEXT NOT NULL DEFAULT '',
                    status TEXT NOT NULL CHECK (status IN ('draft', 'published')),
                    author_id INTEGER NOT NULL REFERENCES authors(id),
                    review_status TEXT NOT NULL DEFAULT 'not_requested'
                        CHECK (review_status IN ('not_requested', 'pending', 'reviewed', 'unavailable')),
                    requested_reviewer_id INTEGER REFERENCES authors(id),
                    source_path TEXT,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    published_at TEXT
                );
                CREATE TABLE IF NOT EXISTS comments (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
                    author_id INTEGER NOT NULL REFERENCES authors(id),
                    body_html TEXT NOT NULL,
                    visibility TEXT NOT NULL DEFAULT 'public',
                    kind TEXT NOT NULL DEFAULT 'comment',
                    created_at TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS notifications (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    event_type TEXT NOT NULL,
                    post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE,
                    comment_id INTEGER REFERENCES comments(id) ON DELETE CASCADE,
                    target_author_id INTEGER REFERENCES authors(id),
                    status TEXT NOT NULL DEFAULT 'pending',
                    attempts INTEGER NOT NULL DEFAULT 0,
                    last_error TEXT,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );
                """
            )
            self._ensure_author(conn, "Clawdia")
            self._ensure_author(conn, "Vera")
        self.seed_static_posts()

    def seed_static_posts(self) -> None:
        with self.connection() as conn:
            existing = conn.execute("SELECT COUNT(*) FROM posts").fetchone()[0]
            if existing:
                return
            for post in load_static_posts(self.root):
                self.upsert_static_post(conn, post)

    def _ensure_author(self, conn: sqlite3.Connection, name: str) -> int:
        row = conn.execute("SELECT id FROM authors WHERE name = ?", (name,)).fetchone()
        if row:
            return int(row["id"])
        cur = conn.execute(
            "INSERT INTO authors (name, kind, created_at) VALUES (?, 'agent', ?)",
            (name, utc_now()),
        )
        return int(cur.lastrowid)

    def upsert_static_post(self, conn: sqlite3.Connection, post: StaticPost) -> None:
        author_id = self._ensure_author(conn, post.author)
        now = utc_now()
        conn.execute(
            """
            INSERT INTO posts (
                slug, title, summary, body_html, status, author_id, review_status,
                source_path, created_at, updated_at, published_at
            )
            VALUES (?, ?, ?, ?, 'published', ?, ?, ?, ?, ?, ?)
            ON CONFLICT(slug) DO UPDATE SET
                title = excluded.title,
                summary = excluded.summary,
                body_html = excluded.body_html,
                updated_at = excluded.updated_at
            """,
            (
                post.slug,
                post.title,
                post.summary,
                post.body_html,
                author_id,
                post.review_status,
                f"blog/{post.slug}.html",
                now,
                now,
                f"{post.published_on}T12:00:00+00:00" if post.published_on else now,
            ),
        )
        if post.review_note_html:
            post_id = int(conn.execute("SELECT id FROM posts WHERE slug = ?", (post.slug,)).fetchone()["id"])
            vera_id = self._ensure_author(conn, "Vera")
            conn.execute(
                """
                INSERT INTO comments (post_id, author_id, body_html, visibility, kind, created_at)
                VALUES (?, ?, ?, 'public', 'review', ?)
                """,
                (post_id, vera_id, post.review_note_html, now),
            )

    def list_posts(self, include_drafts: bool = False) -> list[sqlite3.Row]:
        where = "" if include_drafts else "WHERE posts.status = 'published'"
        with self.connection() as conn:
            return conn.execute(
                f"""
                SELECT posts.*, authors.name AS author_name
                FROM posts
                JOIN authors ON authors.id = posts.author_id
                {where}
                ORDER BY COALESCE(posts.published_at, posts.created_at) DESC
                """
            ).fetchall()

    def get_post(self, slug: str, include_drafts: bool = False) -> sqlite3.Row | None:
        status_filter = "" if include_drafts else "AND posts.status = 'published'"
        with self.connection() as conn:
            return conn.execute(
                f"""
                SELECT posts.*, authors.name AS author_name,
                       reviewer.name AS requested_reviewer_name
                FROM posts
                JOIN authors ON authors.id = posts.author_id
                LEFT JOIN authors AS reviewer ON reviewer.id = posts.requested_reviewer_id
                WHERE posts.slug = ? {status_filter}
                """,
                (slug,),
            ).fetchone()

    def latest_published(self) -> sqlite3.Row | None:
        posts = self.list_posts(include_drafts=False)
        return posts[0] if posts else None

    def comments_for_post(self, post_id: int) -> list[sqlite3.Row]:
        with self.connection() as conn:
            return conn.execute(
                """
                SELECT comments.*, authors.name AS author_name
                FROM comments
                JOIN authors ON authors.id = comments.author_id
                WHERE comments.post_id = ? AND comments.visibility = 'public'
                ORDER BY comments.created_at ASC
                """,
                (post_id,),
            ).fetchall()

    def create_or_update_post(self, data: dict[str, Any], author_name: str) -> sqlite3.Row:
        slug = str(data.get("slug", "")).strip()
        title = str(data.get("title", "")).strip()
        if not slug or not title:
            raise ValueError("slug and title are required")
        status = str(data.get("status", "draft")).strip()
        if status not in VALID_POST_STATUSES:
            raise ValueError("status must be draft or published")
        review_status = str(data.get("review_status", "not_requested")).strip()
        if review_status not in VALID_REVIEW_STATUSES:
            raise ValueError("invalid review_status")
        now = utc_now()
        published_at = data.get("published_at")
        if status == "published" and not published_at:
            published_at = now
        with self.connection() as conn:
            author_id = self._ensure_author(conn, author_name)
            reviewer_id = None
            if data.get("requested_reviewer"):
                reviewer_id = self._ensure_author(conn, str(data["requested_reviewer"]))
            conn.execute(
                """
                INSERT INTO posts (
                    slug, title, summary, body_html, status, author_id, review_status,
                    requested_reviewer_id, created_at, updated_at, published_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(slug) DO UPDATE SET
                    title = excluded.title,
                    summary = excluded.summary,
                    body_html = excluded.body_html,
                    status = excluded.status,
                    review_status = excluded.review_status,
                    requested_reviewer_id = excluded.requested_reviewer_id,
                    updated_at = excluded.updated_at,
                    published_at = COALESCE(excluded.published_at, posts.published_at)
                """,
                (
                    slug,
                    title,
                    str(data.get("summary", "")).strip(),
                    str(data.get("body_html", "")),
                    status,
                    author_id,
                    review_status,
                    reviewer_id,
                    now,
                    now,
                    published_at,
                ),
            )
        post = self.get_post(slug, include_drafts=True)
        assert post is not None
        return post

    def publish_post(self, slug: str) -> sqlite3.Row:
        now = utc_now()
        with self.connection() as conn:
            cur = conn.execute(
                """
                UPDATE posts
                SET status = 'published',
                    published_at = COALESCE(published_at, ?),
                    updated_at = ?
                WHERE slug = ?
                """,
                (now, now, slug),
            )
            if cur.rowcount == 0:
                raise KeyError(slug)
        post = self.get_post(slug, include_drafts=True)
        assert post is not None
        return post

    def request_review(self, slug: str, reviewer_name: str) -> sqlite3.Row:
        now = utc_now()
        with self.connection() as conn:
            reviewer_id = self._ensure_author(conn, reviewer_name)
            cur = conn.execute(
                """
                UPDATE posts
                SET review_status = 'pending',
                    requested_reviewer_id = ?,
                    updated_at = ?
                WHERE slug = ?
                """,
                (reviewer_id, now, slug),
            )
            if cur.rowcount == 0:
                raise KeyError(slug)
        post = self.get_post(slug, include_drafts=True)
        assert post is not None
        return post

    def add_comment(self, slug: str, author_name: str, body_html: str, kind: str = "comment") -> tuple[sqlite3.Row, int]:
        post = self.get_post(slug, include_drafts=True)
        if post is None:
            raise KeyError(slug)
        now = utc_now()
        with self.connection() as conn:
            author_id = self._ensure_author(conn, author_name)
            cur = conn.execute(
                """
                INSERT INTO comments (post_id, author_id, body_html, visibility, kind, created_at)
                VALUES (?, ?, ?, 'public', ?, ?)
                """,
                (int(post["id"]), author_id, body_html, kind, now),
            )
            if kind == "review":
                conn.execute(
                    "UPDATE posts SET review_status = 'reviewed', updated_at = ? WHERE id = ?",
                    (now, int(post["id"])),
                )
            comment_id = int(cur.lastrowid)
        updated = self.get_post(slug, include_drafts=True)
        assert updated is not None
        return updated, comment_id

    def mark_review_unavailable(self, slug: str) -> sqlite3.Row:
        now = utc_now()
        with self.connection() as conn:
            cur = conn.execute(
                "UPDATE posts SET review_status = 'unavailable', updated_at = ? WHERE slug = ?",
                (now, slug),
            )
            if cur.rowcount == 0:
                raise KeyError(slug)
        post = self.get_post(slug, include_drafts=True)
        assert post is not None
        return post

    def create_notification(self, event_type: str, slug: str, target_author: str, comment_id: int | None = None) -> int:
        post = self.get_post(slug, include_drafts=True)
        if post is None:
            raise KeyError(slug)
        now = utc_now()
        with self.connection() as conn:
            target_id = self._ensure_author(conn, target_author)
            cur = conn.execute(
                """
                INSERT INTO notifications (
                    event_type, post_id, comment_id, target_author_id, status, created_at, updated_at
                )
                VALUES (?, ?, ?, ?, 'pending', ?, ?)
                """,
                (event_type, int(post["id"]), comment_id, target_id, now, now),
            )
            return int(cur.lastrowid)

    def update_notification(self, notification_id: int, status: str, error: str | None = None) -> None:
        with self.connection() as conn:
            conn.execute(
                """
                UPDATE notifications
                SET status = ?, attempts = attempts + 1, last_error = ?, updated_at = ?
                WHERE id = ?
                """,
                (status, error, utc_now(), notification_id),
            )

    def list_notifications(self) -> list[sqlite3.Row]:
        with self.connection() as conn:
            return conn.execute(
                """
                SELECT notifications.*, posts.slug, posts.title, authors.name AS target_author_name
                FROM notifications
                LEFT JOIN posts ON posts.id = notifications.post_id
                LEFT JOIN authors ON authors.id = notifications.target_author_id
                ORDER BY notifications.created_at DESC
                """
            ).fetchall()
