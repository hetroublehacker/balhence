"""Publication invariants for the anonymized Bug Bounty Archive."""

from __future__ import annotations

from html import unescape
from html.parser import HTMLParser
import json
import re
import unittest
from urllib.parse import urlsplit

from build_public import PUBLIC_FILE_SET, SOURCE_ROOT


ANONYMIZED_STORIES = (
    "insights/password-reset-token-replay.html",
    "insights/async-export-authorization.html",
    "insights/server-side-url-import.html",
    "insights/draft-write-authorization.html",
    "insights/session-authority-boundary.html",
    "insights/private-response-cache-boundary.html",
    "insights/server-owned-validation-rules.html",
    "insights/evidence-gated-workflows.html",
)
RESEARCH = tuple(
    item["path"]
    for item in json.loads(
        (SOURCE_ROOT / "tests/fixtures/medium-import-manifest.json").read_text(encoding="utf-8")
    )
)
ARCHIVE = ANONYMIZED_STORIES + RESEARCH
VOID_ELEMENTS = {
    "area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta",
    "param", "source", "track", "wbr",
}


class EditorialDocument(HTMLParser):
    def __init__(self, source: str):
        super().__init__(convert_charrefs=True)
        self.links: list[str] = []
        self.body_classes: set[str] = set()
        self.archive_cards = 0
        self.field_note_cards = 0
        self.story_depth = 0
        self.story_parts: list[str] = []
        self.story_headings = 0
        self.story_figures = 0
        self.story_captions = 0
        self.story_pre = 0
        self.feed(source)
        self.close()

    def handle_starttag(self, tag, attributes):
        attrs = dict(attributes)
        classes = set(attrs.get("class", "").split())
        if tag == "body":
            self.body_classes = classes
        if tag == "a" and attrs.get("href"):
            self.links.append(attrs["href"])
        if tag == "article" and "data-archive-card" in attrs:
            self.archive_cards += 1
            if "data-field-note-card" in attrs:
                self.field_note_cards += 1
        if tag == "div" and "research-article-body" in classes:
            self.story_depth = 1
            return
        if not self.story_depth:
            return
        if tag not in VOID_ELEMENTS:
            self.story_depth += 1
        if tag in {"h3", "h4"}:
            self.story_headings += 1
        if tag == "figure" and "research-story-figure" in classes:
            self.story_figures += 1
        if tag == "figcaption":
            self.story_captions += 1
        if tag == "pre":
            self.story_pre += 1

    def handle_endtag(self, tag):
        if self.story_depth and tag not in VOID_ELEMENTS:
            self.story_depth -= 1

    def handle_data(self, data):
        if self.story_depth:
            self.story_parts.append(data)


def structured_nodes(source: str) -> list[dict]:
    payloads = [
        json.loads(payload)
        for payload in re.findall(
            r'<script type="application/ld\+json">\s*(.*?)\s*</script>',
            source,
            flags=re.DOTALL,
        )
    ]
    return [node for payload in payloads for node in payload.get("@graph", [payload])]


class CaseStudyPublicationTests(unittest.TestCase):
    def test_collection_has_eight_field_notes_and_eighteen_distinct_articles(self):
        page = EditorialDocument((SOURCE_ROOT / "blogs.html").read_text(encoding="utf-8"))
        self.assertEqual(page.archive_cards, len(ARCHIVE))
        self.assertEqual(page.field_note_cards, len(ANONYMIZED_STORIES))
        self.assertEqual(len(ARCHIVE), 18)
        self.assertEqual(len(set(ARCHIVE)), 18)
        for article in ARCHIVE:
            with self.subTest(article=article):
                self.assertIn(article, PUBLIC_FILE_SET)
                self.assertEqual(page.links.count("/" + article), 1)
        self.assertIn("/blog.html", page.links)

    def test_anonymized_stories_use_the_personal_research_shell(self):
        for story in ANONYMIZED_STORIES:
            with self.subTest(story=story):
                source = (SOURCE_ROOT / story).read_text(encoding="utf-8")
                page = EditorialDocument(source)
                self.assertEqual(
                    page.body_classes,
                    {"research-archive-post", "archive-article"},
                )
                words = re.findall(r"\b[\w'-]+\b", " ".join(page.story_parts))
                self.assertGreaterEqual(len(words), 650)
                self.assertGreaterEqual(page.story_headings, 4)
                self.assertGreaterEqual(page.story_figures, 1)
                self.assertGreaterEqual(page.story_captions, 1)
                self.assertGreaterEqual(page.story_pre, 1)
                self.assertIn("/about.html#researcher", page.links)
                self.assertIn("/blogs.html#bug-bounty-archive", page.links)
                self.assertNotIn("case-study", page.body_classes)
                self.assertNotIn("scope-table", source)
                self.assertNotIn("http-notebook", source)
                self.assertNotIn("case-facts", source)
                self.assertNotIn("case-remediation", source)

    def test_disclosure_keeps_observation_and_publication_status_separate(self):
        for story in ANONYMIZED_STORIES:
            with self.subTest(story=story):
                source = (SOURCE_ROOT / story).read_text(encoding="utf-8").lower()
                self.assertIn("reconstructed from private research", source)
                self.assertIn("removed or replaced", source)
                self.assertIn("synthetic", source)
                self.assertRegex(source, r"not claiming.{0,80}(?:deployed fix|fix was deployed)")
                self.assertRegex(source, r"completed retest")
                self.assertNotRegex(source, r"(?:program|vendor).{0,30}(?:accepted|resolved|paid)")

    def test_story_schema_uses_the_researcher_and_archive(self):
        for story in ANONYMIZED_STORIES:
            with self.subTest(story=story):
                source = (SOURCE_ROOT / story).read_text(encoding="utf-8")
                article = next(
                    node for node in structured_nodes(source) if node.get("@type") == "BlogPosting"
                )
                self.assertEqual(article["author"]["@id"], "https://balhence.com/about.html#researcher")
                self.assertEqual(article["publisher"]["@id"], "https://balhence.com/#organization")
                self.assertEqual(
                    article["isPartOf"]["@id"],
                    "https://balhence.com/blogs.html#bug-bounty-archive",
                )
                self.assertEqual(article["dateModified"], "2026-11-07")

    def test_private_sources_targets_and_credentials_are_not_published(self):
        forbidden = re.compile(
            r"(?:/home/|/users/|bbscope/|recon/reports/|finding-\d+|bugcrowd|"
            r"cultbeauty|myvitamins|mankind|plannthat|linktree|rippling|"
            r"-----BEGIN [A-Z ]*PRIVATE KEY-----|oast\.online|bulk_media_download|"
            r"bank_statements|operationName=Reset)",
            re.I,
        )
        for relative in (*ANONYMIZED_STORIES, "blogs.html", "case-studies.js", "case-studies.css"):
            with self.subTest(file=relative):
                source = (SOURCE_ROOT / relative).read_text(encoding="utf-8")
                self.assertIsNone(forbidden.search(source))
                self.assertTrue(source.isascii())
                for header in re.findall(
                    r"\b(?:authorization|cookie|set-cookie)\s*:[^\r\n<]*",
                    unescape(source),
                    re.I,
                ):
                    self.assertRegex(
                        header.strip(),
                        r"^(?:Cookie: session=\[REDACTED\]|Authorization: Bearer \[REDACTED\])$",
                    )

    def test_story_links_do_not_disclose_external_targets(self):
        for story in ANONYMIZED_STORIES:
            with self.subTest(story=story):
                page = EditorialDocument((SOURCE_ROOT / story).read_text(encoding="utf-8"))
                for link in page.links:
                    parsed = urlsplit(link)
                    if parsed.netloc:
                        self.assertEqual(parsed.netloc, "balhence.com")
                    if parsed.scheme == "mailto":
                        self.assertEqual(parsed.path, "contact@balhence.com")


if __name__ == "__main__":
    unittest.main()
