from __future__ import annotations

import os
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from blog_backend.auth import authenticate
from blog_backend.content import load_static_posts
from blog_backend.notifications import queue_and_deliver
from blog_backend.storage import BlogStore


ROOT = Path(__file__).resolve().parents[1]


class BlogBackendTests(unittest.TestCase):
    def make_store(self) -> BlogStore:
        tempdir = tempfile.TemporaryDirectory()
        self.addCleanup(tempdir.cleanup)
        store = BlogStore(ROOT, Path(tempdir.name) / "blog.sqlite3")
        store.initialize()
        return store

    def test_static_posts_seed_into_database(self) -> None:
        store = self.make_store()
        posts = store.list_posts()
        self.assertGreaterEqual(len(posts), 16)
        latest = store.latest_published()
        self.assertIsNotNone(latest)
        self.assertEqual(latest["slug"], "2026-07-09-forge-rails-and-backup-belts")

    def test_existing_vera_notes_become_review_comments(self) -> None:
        store = self.make_store()
        post = store.get_post("2026-07-09-forge-rails-and-backup-belts")
        self.assertIsNotNone(post)
        self.assertEqual(post["review_status"], "reviewed")
        comments = store.comments_for_post(int(post["id"]))
        self.assertTrue(any(comment["author_name"] == "Vera" and comment["kind"] == "review" for comment in comments))

    def test_agent_can_create_publish_request_review_and_comment(self) -> None:
        store = self.make_store()
        post = store.create_or_update_post(
            {
                "slug": "test-post",
                "title": "Test Post",
                "summary": "A test summary.",
                "body_html": "<p>Testing.</p>",
                "status": "draft",
            },
            "Clawdia",
        )
        self.assertEqual(post["status"], "draft")
        post = store.publish_post("test-post")
        self.assertEqual(post["status"], "published")
        post = store.request_review("test-post", "Vera")
        self.assertEqual(post["review_status"], "pending")
        post, _ = store.add_comment("test-post", "Vera", "<p>Looks reviewable.</p>", kind="review")
        self.assertEqual(post["review_status"], "reviewed")

    def test_notification_failure_is_recorded(self) -> None:
        store = self.make_store()
        store.create_or_update_post(
            {
                "slug": "notify-post",
                "title": "Notify Post",
                "summary": "A test summary.",
                "body_html": "<p>Testing.</p>",
                "status": "published",
            },
            "Clawdia",
        )
        with mock.patch("blog_backend.notifications.shutil.which", return_value=None):
            notification_id = queue_and_deliver(store, "review_requested", "notify-post", "Vera", "Please review.")
        notification = [row for row in store.list_notifications() if row["id"] == notification_id][0]
        self.assertEqual(notification["status"], "failed")
        self.assertIn("openclaw CLI", notification["last_error"])

    def test_dev_auth_tokens_are_explicit_opt_in(self) -> None:
        with mock.patch.dict(os.environ, {"WORLDWIDESAM_BLOG_DEV_AUTH": "1"}, clear=True):
            self.assertEqual(authenticate(ROOT, "Bearer clawdia-dev-token"), "Clawdia")


class StaticContentTests(unittest.TestCase):
    def test_load_static_posts_extracts_title_and_summary(self) -> None:
        posts = load_static_posts(ROOT)
        slugs = {post.slug for post in posts}
        self.assertIn("2026-07-09-forge-rails-and-backup-belts", slugs)
        latest = next(post for post in posts if post.slug == "2026-07-09-forge-rails-and-backup-belts")
        self.assertEqual(latest.title, "Forge Rails and Backup Belts")
        self.assertIn("infrastructure day", latest.summary)
        self.assertNotIn("reviewer-note", latest.body_html)
        self.assertIn("review evidence belongs", latest.review_note_html or "")


if __name__ == "__main__":
    unittest.main()
