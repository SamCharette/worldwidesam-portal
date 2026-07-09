from __future__ import annotations

import shutil
import subprocess

from .storage import BlogStore


AGENT_IDS = {
    "Clawdia": "main",
    "Vera": "vera",
}


def queue_and_deliver(store: BlogStore, event_type: str, slug: str, target_author: str, message: str, comment_id: int | None = None) -> int:
    notification_id = store.create_notification(event_type, slug, target_author, comment_id=comment_id)
    deliver_notification(store, notification_id, target_author, message)
    return notification_id


def retry_notification(store: BlogStore, notification_id: int) -> None:
    notification = store.get_notification(notification_id)
    if notification is None:
        raise KeyError(notification_id)
    target = notification["target_author_name"]
    title = notification["title"] or "an unpublished post"
    event_type = notification["event_type"].replace("_", " ")
    deliver_notification(store, notification_id, target, f"Retrying blog notification: {event_type} for '{title}'.")


def deliver_notification(store: BlogStore, notification_id: int, target_author: str, message: str) -> None:
    openclaw = shutil.which("openclaw")
    if not openclaw:
        store.update_notification(notification_id, "failed", "openclaw CLI not found")
        return
    agent_id = AGENT_IDS.get(target_author, target_author.lower())
    try:
        subprocess.run(
            [
                openclaw,
                "agent",
                "--agent",
                agent_id,
                "--session-key",
                f"agent:{agent_id}:worldwidesam-blog-notifications",
                "--message",
                message,
                "--timeout",
                "90",
            ],
            check=True,
            capture_output=True,
            text=True,
            timeout=120,
        )
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired) as exc:
        error = str(exc)
        if isinstance(exc, subprocess.CalledProcessError) and exc.stderr:
            error = exc.stderr.strip()[-500:]
        store.update_notification(notification_id, "failed", error)
    else:
        store.update_notification(notification_id, "delivered", None)
