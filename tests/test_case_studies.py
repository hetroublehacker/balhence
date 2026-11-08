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
    "insights/ai-agent-mcp-root-rce.html",
    "insights/async-export-authorization.html",
    "insights/server-side-url-import.html",
    "insights/draft-write-authorization.html",
    "insights/session-authority-boundary.html",
    "insights/private-response-cache-boundary.html",
    "insights/server-owned-validation-rules.html",
    "insights/evidence-gated-workflows.html",
)
STORY_IMAGES = {
    "insights/ai-agent-mcp-root-rce.html": {
        "asset": "assets/research/field-note-ai-agent-mcp-root-rce.jpg",
        "alt": "A draft AI agent launching a local MCP tool inside a privileged server runtime.",
    },
    "insights/async-export-authorization.html": {
        "asset": "assets/research/field-note-async-export-authorization.jpg",
        "alt": "A background conveyor carrying a document across an otherwise blocked tenant boundary.",
    },
    "insights/server-side-url-import.html": {
        "asset": "assets/research/field-note-server-side-url-import.jpg",
        "alt": "A backend importer fetching a remote marker and storing its returned contents.",
    },
    "insights/draft-write-authorization.html": {
        "asset": "assets/research/field-note-draft-write-authorization.jpg",
        "alt": "A protected document that cannot be viewed but can still be changed through another path.",
    },
    "insights/session-authority-boundary.html": {
        "asset": "assets/research/field-note-session-authority-boundary.jpg",
        "alt": "Two isolated browser sessions converging on the same shopping cart.",
    },
    "insights/private-response-cache-boundary.html": {
        "asset": "assets/research/field-note-private-response-cache-boundary.jpg",
        "alt": "A private response being copied through a shared cache to another client.",
    },
    "insights/server-owned-validation-rules.html": {
        "asset": "assets/research/field-note-server-owned-validation-rules.jpg",
        "alt": "A public validation control illuminating information inside a hidden data archive.",
    },
    "insights/evidence-gated-workflows.html": {
        "asset": "assets/research/field-note-evidence-gated-workflows.jpg",
        "alt": "A submission passing its workflow gate while a required evidence piece remains missing.",
    },
}
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
        self.cover_depth = 0
        self.cover_images: list[dict[str, str]] = []
        self.cover_captions = 0
        self.meta: dict[str, str] = {}
        self.feed(source)
        self.close()

    def handle_starttag(self, tag, attributes):
        attrs = dict(attributes)
        classes = set(attrs.get("class", "").split())
        if tag == "meta" and attrs.get("content"):
            key = attrs.get("property") or attrs.get("name")
            if key:
                self.meta[key] = attrs["content"]
        if tag == "figure" and "research-cover-figure" in classes:
            self.cover_depth = 1
        elif self.cover_depth and tag not in VOID_ELEMENTS:
            self.cover_depth += 1
        if tag == "img" and self.cover_depth:
            self.cover_images.append(attrs)
        if tag == "figcaption" and self.cover_depth:
            self.cover_captions += 1
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
        if self.cover_depth and tag not in VOID_ELEMENTS:
            self.cover_depth -= 1
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
                self.assertEqual(article["dateModified"], "2026-11-08")

    def test_story_images_match_body_social_metadata_and_schema(self):
        for story, expected in STORY_IMAGES.items():
            with self.subTest(story=story):
                source = (SOURCE_ROOT / story).read_text(encoding="utf-8")
                page = EditorialDocument(source)
                asset = expected["asset"]
                relative_url = "/" + asset
                absolute_url = "https://balhence.com/" + asset
                self.assertEqual(len(page.cover_images), 1)
                self.assertEqual(page.cover_captions, 1)
                image = page.cover_images[0]
                self.assertEqual(image["src"], relative_url)
                self.assertEqual(image["alt"], expected["alt"])
                self.assertEqual(image["width"], "1200")
                self.assertEqual(image["height"], "630")
                self.assertEqual(image["loading"], "lazy")
                self.assertEqual(image["decoding"], "async")
                self.assertEqual(page.meta["og:image"], absolute_url)
                self.assertEqual(page.meta["og:image:width"], "1200")
                self.assertEqual(page.meta["og:image:height"], "630")
                self.assertEqual(page.meta["og:image:type"], "image/jpeg")
                self.assertEqual(page.meta["og:image:alt"], expected["alt"])
                self.assertEqual(page.meta["twitter:image"], absolute_url)
                self.assertEqual(page.meta["twitter:image:alt"], expected["alt"])
                article = next(
                    node for node in structured_nodes(source) if node.get("@type") == "BlogPosting"
                )
                webpage = next(
                    node for node in structured_nodes(source) if node.get("@type") == "WebPage"
                )
                self.assertEqual(article["image"], absolute_url)
                self.assertEqual(article["dateModified"], "2026-11-08")
                self.assertEqual(webpage["dateModified"], "2026-11-08")
                self.assertIn(
                    'Updated <time datetime="2026-11-08">8 November 2026</time>',
                    source,
                )
                self.assertIn(asset, PUBLIC_FILE_SET)
                image_path = SOURCE_ROOT / asset
                self.assertTrue(image_path.is_file())
                self.assertTrue(image_path.read_bytes().startswith(b"\xff\xd8\xff"))
                self.assertLessEqual(image_path.stat().st_size, 250_000)

    def test_private_sources_targets_and_credentials_are_not_published(self):
        forbidden = re.compile(
            r"(?:/home/|/users/|bbscope/|recon/reports/|finding-\d+|bugcrowd|"
            r"cultbeauty|myvitamins|mankind|plannthat|linktree|rippling|"
            r"amplitude|createcustomagent|updatecustomagent|agentcreatethread|"
            r"agentgetthread|agentgetsession|archivecustomagent|"
            r"mcpimportconnectionconfig|mcplistconnections|flowconfigoverride|"
            r"agenttooldescriptor|customagentinput|customagentupdateinput|"
            r"stdioconfig|cursor_mcp_json|forbiddenerror|notfounderror|"
            r"process\.getuid|process\.getgid|process\.stdin|/usr/bin/node|"
            r"bbqa|callhtm|mail\.tm|red-wildflower|web-library\.net|"
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
