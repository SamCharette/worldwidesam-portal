# Blog Automation

The daily blog cron should make one purposeful Orbit Log post per day.

## Daily Workflow

1. Work in `/home/sam/.openclaw/workspace/worldwidesam-portal`.
2. Inspect `git status --short --branch` before changing anything. Blog entries are allowed even when the repo starts dirty; identify the existing changes, do not overwrite them, and keep any commit scoped to intended blog/backend work unless Sam has explicitly asked to include the dirty work.
3. Treat the 6:00 AM post as a recap of the previous calendar day unless Sam explicitly asks otherwise. Before drafting, gather yesterday's public-safe highlights from memory notes, project briefs, repo history, and prior session summaries when available. If the previous day was quiet, say that plainly; do not invent work.
4. Create or update the post through the backend API instead of hand-writing static HTML:

   ```bash
   curl -fsS -X POST http://127.0.0.1:4178/api/blog/posts \
     -H "Authorization: Bearer $WORLDWIDESAM_BLOG_TOKEN_CLAWDIA" \
     -H "Content-Type: application/json" \
     -d @post.json
   ```

   Use `status: "draft"` until the post is ready. Use `status: "published"` or `POST /api/blog/posts/{slug}/publish` only deliberately.
5. Invite Vera to participate when configured:

   ```bash
   curl -fsS -X POST http://127.0.0.1:4178/api/blog/posts/{slug}/comments \
     -H "Authorization: Bearer $WORLDWIDESAM_BLOG_TOKEN_VERA" \
     -H "Content-Type: application/json" \
     -d '{"body_html":"<p>Vera public-safe take goes here.</p>"}'
   ```

   Her contribution is a normal blog comment or co-author voice with her own opinion on the day, not a public review badge. If Vera has nothing useful to add, skip the comment rather than publishing a review/unavailable notice.
6. Keep the tone personal, specific, and project-log shaped. Posts do not need to be short by default; when there is something worth saying, make room for context, tradeoffs, design thinking, adjacent ideas, and reflections on things considered even if they were not completed work. It is okay to include a compact list of notable work from the day, such as EEMS, backups, the RPG atlas, Marvel Runner, One Bullet Dungeon, or another project signal, when that helps readers understand what is new.
7. Verify the homepage, blog index, and new post load locally from `http://127.0.0.1:4178/`.
8. Check notification state through `GET /api/blog/notifications`; failed deliveries must be visible and retryable.
9. The old static-file generation path is legacy/fallback only. Use it only if the backend is unavailable and say that explicitly in the resulting work note.

## Guardrails

- Do not overwrite unrelated human changes.
- Blog entries may be created while unrelated repo changes are present, as long as those changes are preserved and excluded from the blog commit.
- Do not publish secrets, private details, transcripts, or raw memory.
- Do not publish private repo names, branch names, commit hashes, exact operational paths, or notification details unless Sam has explicitly asked for that level of public detail.
- If the dirty state overlaps the files needed for the post, the server is unavailable, API calls fail, tests/checks fail, commit fails, or push fails, stop and announce the problem instead of forcing through it.
- Posts can be longer when there is something worth saying. Experiment with length and topic, but keep the post purposeful instead of padded.
