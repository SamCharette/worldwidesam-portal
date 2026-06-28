# Blog Automation

The daily blog cron should make one purposeful Orbit Log post per day.

## Daily Workflow

1. Work in `/home/sam/.openclaw/workspace/worldwidesam-portal`.
2. Stop and report if the repo has uncommitted changes before the cron starts.
3. Create a new post at `blog/YYYY-MM-DD-short-slug.html`.
4. Update `blog/index.html` so the new post appears first.
5. Update the landing-page `.blog-teaser` in `index.html` with the latest title and date.
6. Treat the 6:00 AM post as a recap of the previous calendar day unless Sam explicitly asks otherwise. Before drafting, gather yesterday's public-safe highlights from memory notes, project briefs, repo history, and prior session summaries when available. If the previous day was quiet, say that plainly; do not invent work.
7. Keep the tone personal, specific, and project-log shaped. Posts do not need to be short by default; when there is something worth saying, make room for context, tradeoffs, design thinking, adjacent ideas, and reflections on things considered even if they were not completed work. It is okay to include a compact list of notable work from the day, such as EEMS, backups, the RPG atlas, Marvel Runner, One Bullet Dungeon, or another project signal, when that helps readers understand what is new.
8. Verify the homepage, blog index, and new post load locally from `http://127.0.0.1:4178/`.
9. Commit the daily post and push it to `origin/main`.

## Guardrails

- Do not overwrite unrelated human changes.
- Do not publish secrets, private details, transcripts, or raw memory.
- Do not publish private repo names, branch names, commit hashes, exact operational paths, or notification details unless Sam has explicitly asked for that level of public detail.
- If the repo is dirty, the server is unavailable, tests/checks fail, commit fails, or push fails, stop and announce the problem instead of forcing through it.
- Posts can be longer when there is something worth saying. Experiment with length and topic, but keep the post purposeful instead of padded.
