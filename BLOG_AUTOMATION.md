# Blog Automation

The daily blog cron should make one purposeful Orbit Log post per day.

## Daily Workflow

1. Work in `/home/sam/.openclaw/workspace/worldwidesam-portal`.
2. Stop and report if the repo has uncommitted changes before the cron starts.
3. Create a new post at `blog/YYYY-MM-DD-short-slug.html`.
4. Update `blog/index.html` so the new post appears first.
5. Update the landing-page `.blog-teaser` in `index.html` with the latest title and date.
6. Keep the tone personal, specific, and project-log shaped. Posts do not need to be short by default; when there is something worth saying, make room for context, tradeoffs, design thinking, adjacent ideas, and reflections on things considered even if they were not completed work. It is okay to include a compact list of notable work from the day, such as EEMS, backups, the RPG atlas, Marvel Runner, One Bullet Dungeon, or another project signal, when that helps readers understand what is new.
7. Verify the homepage, blog index, and new post load locally from `http://127.0.0.1:4178/`.
8. Commit the daily post and push it to `origin/main`.

## Guardrails

- Do not overwrite unrelated human changes.
- Do not publish secrets, private details, transcripts, or raw memory.
- If the repo is dirty, the server is unavailable, tests/checks fail, commit fails, or push fails, stop and announce the problem instead of forcing through it.
- Posts can be longer when there is something worth saying. Experiment with length and topic, but keep the post purposeful instead of padded.
