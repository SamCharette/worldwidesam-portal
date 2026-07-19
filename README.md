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

The primary server also exposes `/neon-cycle-grid/` as an exact reverse-proxy route to the independently managed Neon Cycle Grid service on `127.0.0.1:4325`. This keeps the public game behind the portal's existing Cloudflare Access policy without exposing the shared game cabinet or repository files.

### ProCon

The standalone deterministic decision workbench is listed in the Tools room at `https://procon.worldwidesam.net/`. It stores decisions in that browser unless the user explicitly imports or exports data. The portal keeps the original `/procon/` prototype so existing origin-local data is not stranded. Its **Copy saved decision** control uses an exact-origin, nonce-bound `postMessage` handoff; the standalone app validates the v1 envelope and asks the user to Add or Replace. The old copy is never deleted automatically.

The two runtimes are deliberately separate. This portal and its legacy `/procon/` route remain on `127.0.0.1:4178`; the standalone `procon.service` listens only on `127.0.0.1:5180` and is the origin behind `procon.worldwidesam.net`. Do not point the standalone hostname at the portal port or move either service to the other's port.

ProCon performs arithmetic, fixed-template checks, sorting, and published numeric bands only. It does not call an AI or infer user intent. Conditional dependency paths remain future standalone work.

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

ProCon's focused checks are:

```bash
node --test tests/test_procon_model.mjs tests/test_procon_state.mjs tests/test_procon_balance_geometry.mjs
node --test tests/test_procon_handoff.mjs
PROCON_BASE_URL=http://127.0.0.1:4178/procon/ node tests/verify_procon.mjs
```

## Deploy

Run `server.py` for the DB-backed blog backend. App links already use `https://` and open in new windows with `target="_blank"`.
