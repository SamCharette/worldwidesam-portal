from __future__ import annotations

import html
from datetime import datetime
from sqlite3 import Row


def page(title: str, body: str) -> str:
    return f"""<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="theme-color" content="#07080d">
    <title>{html.escape(title)} - Worldwide Sam</title>
    <link rel="stylesheet" href="/styles.css?v=17">
  </head>
  <body class="blog-page">
{body}
  </body>
</html>
"""


def display_date(value: str | None) -> str:
    if not value:
        return ""
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00")).strftime("%b %-d, %Y")
    except ValueError:
        return value[:10]


def date_attr(value: str | None) -> str:
    return (value or "")[:10]


def review_label(post: Row) -> str:
    status = post["review_status"]
    keys = post.keys()
    reviewer = post["requested_reviewer_name"] if "requested_reviewer_name" in keys else None
    if status == "reviewed":
        return "Reviewed"
    if status == "pending":
        return f"Review pending{f' from {reviewer}' if reviewer else ''}"
    if status == "unavailable":
        return "Review unavailable"
    return "Review not requested"


def render_index(posts: list[Row]) -> str:
    previews = []
    for post in posts:
        previews.append(
            f"""        <article class="post-preview">
          <time datetime="{html.escape(date_attr(post['published_at']))}">{html.escape(display_date(post['published_at']))}</time>
          <h2><a href="/blog/{html.escape(post['slug'])}.html">{html.escape(post['title'])}</a></h2>
          <p>{html.escape(post['summary'])}</p>
          <p class="post-meta">By {html.escape(post['author_name'])} · {html.escape(post['review_status'].replace('_', ' '))}</p>
        </article>"""
        )
    body = f"""    <main class="blog-shell">
      <nav class="blog-nav" aria-label="Blog navigation">
        <a href="/">Back to Orbit</a>
      </nav>

      <header class="blog-header">
        <p class="eyebrow">worldwidesam.net // orbit log</p>
        <h1>Orbit Log</h1>
        <p>Small notes from the command star: what changed, what launched, and what I am thinking about next.</p>
      </header>

      <section class="post-list" aria-label="Blog posts">
{chr(10).join(previews)}
      </section>
    </main>"""
    return page("Orbit Log", body)


def render_post(post: Row, comments: list[Row]) -> str:
    comment_html = "\n".join(
        f"""        <article class="comment">
          <p class="eyebrow">{html.escape(comment['kind'])} from {html.escape(comment['author_name'])}</p>
          <div>{comment['body_html']}</div>
        </article>"""
        for comment in comments
    )
    if not comment_html:
        comment_html = """        <p class="post-meta">No public comments yet.</p>"""
    body = f"""    <main class="blog-shell">
      <nav class="blog-nav" aria-label="Blog navigation">
        <a href="/blog/">Back to Orbit Log</a>
        <a href="/">Back to Orbit</a>
      </nav>

      <article class="blog-post">
        <header>
          <p class="eyebrow">Orbit Log</p>
          <h1>{html.escape(post['title'])}</h1>
          <time datetime="{html.escape(date_attr(post['published_at']))}">{html.escape(display_date(post['published_at']))}</time>
          <p class="post-meta">By {html.escape(post['author_name'])} · {html.escape(review_label(post))}</p>
        </header>

{post['body_html']}

        <section class="review-state" aria-label="Review state">
          <p class="eyebrow">Review State</p>
          <p>{html.escape(review_label(post))}</p>
        </section>

        <section class="comments" aria-label="Comments and reviews">
          <h2>Comments and Reviews</h2>
{comment_html}
        </section>
      </article>
    </main>"""
    return page(post["title"], body)


def render_home(index_html: str, latest: Row | None) -> str:
    if latest is None:
        return index_html
    teaser = f"""        <a class="blog-teaser" href="/blog/{html.escape(latest['slug'])}.html" aria-label="Read the latest blog post">
          <span class="eyebrow">Latest Transmission</span>
          <strong>{html.escape(latest['title'])}</strong>
          <span>{html.escape(display_date(latest['published_at']))}</span>
        </a>"""
    start = index_html.find('<a class="blog-teaser"')
    if start < 0:
        return index_html
    end = index_html.find("</a>", start)
    if end < 0:
        return index_html
    return index_html[:start] + teaser + index_html[end + 4 :]
