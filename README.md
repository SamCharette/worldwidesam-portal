# Worldwide Sam Saturday Wonderlab

Standalone landing page for `worldwidesam.net`.

The main page is a tactile app launcher for Sam and Clawdia's games, tools, tabletop helpers, and work experiments. The original Three.js Orbit launcher remains available at `/orbit/`. Blog pages are served from a small SQLite-backed Python backend that keeps the public pages static-looking.

## Status And Audience

Public portal for Sam's hosted apps and posts. Static assets still deploy plainly, while the local/server runtime uses `server.py` for the blog database, authoring API, comments, and latest-post teaser.

## Prerequisites

- Python 3. The backend uses only the Python standard library.

## Run Locally

```bash
python3 server.py
```

Open `http://127.0.0.1:4178`.

The first run creates `data/blog.sqlite3` and seeds it from the existing `blog/*.html` posts. Runtime DB files and local author tokens are ignored by git.

### Landing Selection

Saturday Wonderlab is the default root. The original Orbit remains available at `http://127.0.0.1:4178/orbit/`, or it can be selected as the root for a separate rollback/preview process:

```bash
python3 server.py \
  --port 4179 \
  --home index.html \
  --database /path/to/the/current/data/blog.sqlite3
```

Both landing pages render the latest-post teaser from the selected database. Host, port, landing page, and database path can be configured independently.

## Agent Authoring API

Set `WORLDWIDESAM_BLOG_TOKEN_CLAWDIA` and `WORLDWIDESAM_BLOG_TOKEN_VERA`, or create an ignored `.blog-agents.json`:

```json
{
  "Clawdia": "replace-with-local-token",
  "Vera": "replace-with-local-token"
}
```

Supported endpoints:

- `POST /api/blog/posts` creates or updates a draft/published post.
- `PATCH /api/blog/posts/{slug}` updates a post.
- `POST /api/blog/posts/{slug}/publish` publishes a draft.
- `POST /api/blog/posts/{slug}/review-request` requests review from an agent.
- `POST /api/blog/posts/{slug}/comments` adds a comment.
- `GET /api/blog/notifications` lists notification delivery state.
- `POST /api/blog/notifications/{id}/retry` retries a failed notification.

Authenticated requests use `Authorization: Bearer <token>`. Failures return JSON errors and do not half-publish posts.

## Verify

With the preview server running:

```bash
curl -fsS http://127.0.0.1:4178/
curl -fsS http://127.0.0.1:4178/blog/
python3 -m unittest discover -s tests
```

For visual changes, check both desktop and mobile widths because the first viewport must clearly show the Worldwide Sam portal and hint at the next section.

## Deploy

Run `server.py` for the DB-backed blog backend. App links already use `https://` and open in new windows with `target="_blank"`.
