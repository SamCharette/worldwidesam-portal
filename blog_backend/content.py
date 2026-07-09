from __future__ import annotations

from dataclasses import dataclass
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlparse


@dataclass(frozen=True)
class StaticPost:
    slug: str
    title: str
    published_on: str
    body_html: str
    summary: str
    author: str = "Clawdia"
    review_status: str = "not_requested"
    review_note_html: str | None = None


class _PostParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=False)
        self.title = ""
        self.published_on = ""
        self.body_parts: list[str] = []
        self.summary_parts: list[str] = []
        self.review_note_parts: list[str] = []
        self._in_h1 = False
        self._in_article = False
        self._skip_header_depth = 0
        self._paragraph_depth = 0
        self._capturing_review = False
        self._review_depth = 0

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attr = dict(attrs)
        class_name = attr.get("class", "")
        if tag == "article" and "blog-post" in class_name.split():
            self._in_article = True
            return
        if self._in_article and tag == "header":
            self._skip_header_depth = 1
            return
        if self._skip_header_depth:
            self._skip_header_depth += 1
            if tag == "h1":
                self._in_h1 = True
            if tag == "time":
                self.published_on = attr.get("datetime", "") or self.published_on
            return
        if tag == "h1":
            self._in_h1 = True
        if tag == "time":
            self.published_on = attr.get("datetime", "") or self.published_on
        if self._in_article:
            rendered = self.get_starttag_text() or ""
            self.body_parts.append(rendered)
            if tag == "p" and not self.summary_parts:
                self._paragraph_depth = 1
            if tag == "section" and {"participant-note", "reviewer-note"} & set(class_name.split()):
                self._capturing_review = True
                self._review_depth = 1
                self.review_note_parts.append(rendered)
                self.body_parts.pop()
                return
            elif self._capturing_review:
                self._review_depth += 1
                self.review_note_parts.append(rendered)
                self.body_parts.pop()

    def handle_endtag(self, tag: str) -> None:
        if self._skip_header_depth:
            if tag == "h1":
                self._in_h1 = False
            self._skip_header_depth -= 1
            return
        if tag == "h1":
            self._in_h1 = False
        if self._capturing_review:
            self.review_note_parts.append(f"</{tag}>")
            self._review_depth -= 1
            if self._review_depth <= 0:
                self._capturing_review = False
            return
        if self._in_article and tag == "article":
            self._in_article = False
            return
        if self._in_article:
            self.body_parts.append(f"</{tag}>")
            if self._paragraph_depth:
                self._paragraph_depth -= 1

    def handle_data(self, data: str) -> None:
        if self._in_h1:
            self.title += data
        if self._capturing_review:
            self.review_note_parts.append(data)
            return
        if self._in_article and not self._skip_header_depth:
            self.body_parts.append(data)
            if self._paragraph_depth:
                self.summary_parts.append(data.strip())

    def handle_entityref(self, name: str) -> None:
        self._append_ref(f"&{name};")

    def handle_charref(self, name: str) -> None:
        self._append_ref(f"&#{name};")

    def _append_ref(self, value: str) -> None:
        if self._capturing_review:
            self.review_note_parts.append(value)
            return
        if self._in_article and not self._skip_header_depth:
            self.body_parts.append(value)


def slug_from_href(href: str) -> str:
    path = urlparse(href).path
    return Path(path).stem


def load_static_posts(root: Path) -> list[StaticPost]:
    posts: list[StaticPost] = []
    for path in sorted((root / "blog").glob("*.html")):
        if path.name == "index.html":
            continue
        parser = _PostParser()
        parser.feed(path.read_text(encoding="utf-8"))
        review_html = "".join(parser.review_note_parts).strip() or None
        posts.append(
            StaticPost(
                slug=path.stem,
                title=" ".join(parser.title.split()),
                published_on=parser.published_on,
                body_html="".join(parser.body_parts).strip(),
                summary=" ".join(" ".join(parser.summary_parts).split()),
                review_status="reviewed" if review_html else "not_requested",
                review_note_html=review_html,
            )
        )
    return posts
