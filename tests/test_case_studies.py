"""Publication invariants for the anonymized Bug Bounty Archive."""

from __future__ import annotations

from html import unescape
from html.parser import HTMLParser
import json
import re
import unittest
from urllib.parse import urlsplit

from build_public import PUBLIC_FILE_SET, SOURCE_ROOT, public_path
from verify_site import local_target


ANONYMIZED_STORIES = (
    "insights/mixed-batch-authorization.html",
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
    "insights/mixed-batch-authorization.html": {
        "asset": "assets/research/field-note-mixed-batch-authorization.jpg",
        "alt": "One permitted paper page opening a checkpoint for an entire mixed batch, including a foreign page.",
        "caption": "Original tactile editorial studio photograph for this anonymized field note.",
    },
    "insights/ai-agent-mcp-root-rce.html": {
        "asset": "assets/research/field-note-ai-agent-mcp-root-rce.jpg",
        "alt": "A draft AI agent launching a local MCP tool inside a privileged server runtime.",
        "caption": "Original 3D glass-and-chrome editorial illustration for this anonymized Critical/P1 field note.",
    },
    "insights/async-export-authorization.html": {
        "asset": "assets/research/field-note-async-export-authorization.jpg",
        "alt": "A background conveyor carrying a document across an otherwise blocked tenant boundary.",
        "caption": "Original manga-style editorial illustration for this anonymized field note.",
    },
    "insights/server-side-url-import.html": {
        "asset": "assets/research/field-note-server-side-url-import.jpg",
        "alt": "A backend importer fetching a remote marker and storing its returned contents.",
        "caption": "Original risograph editorial illustration for this anonymized field note.",
    },
    "insights/draft-write-authorization.html": {
        "asset": "assets/research/field-note-draft-write-authorization.jpg",
        "alt": "A protected document that cannot be viewed but can still be changed through another path.",
        "caption": "Original Swiss-modernist typographic illustration for this anonymized field note.",
    },
    "insights/session-authority-boundary.html": {
        "asset": "assets/research/field-note-session-authority-boundary.jpg",
        "alt": "Two isolated browser sessions converging on the same shopping cart.",
        "caption": "Original gouache and colored-pencil editorial illustration for this anonymized field note.",
    },
    "insights/private-response-cache-boundary.html": {
        "asset": "assets/research/field-note-private-response-cache-boundary.jpg",
        "alt": "A private response being copied through a shared cache to another client.",
        "caption": "Original retro-futurist airbrush illustration for this anonymized field note.",
    },
    "insights/server-owned-validation-rules.html": {
        "asset": "assets/research/field-note-server-owned-validation-rules.jpg",
        "alt": "A public validation control illuminating information inside a hidden data archive.",
        "caption": "Original cyanotype blueprint illustration for this anonymized field note.",
    },
    "insights/evidence-gated-workflows.html": {
        "asset": "assets/research/field-note-evidence-gated-workflows.jpg",
        "alt": "A submission passing its workflow gate while a required evidence piece remains missing.",
        "caption": "Original handcrafted paper-and-clay diorama for this anonymized field note.",
    },
}
STORY_TOOLS = {
    "insights/mixed-batch-authorization.html": (
        "AutoRepeater",
        "https://github.com/nccgroup/AutoRepeater",
    ),
    "insights/ai-agent-mcp-root-rce.html": (
        "Agent Scan",
        "https://github.com/snyk/agent-scan",
    ),
    "insights/async-export-authorization.html": (
        "AuthMatrix",
        "https://github.com/caido-community/authmatrix",
    ),
    "insights/server-side-url-import.html": (
        "Interactsh",
        "https://github.com/projectdiscovery/interactsh",
    ),
    "insights/draft-write-authorization.html": (
        "Autorize",
        "https://github.com/caido-community/autorize",
    ),
    "insights/session-authority-boundary.html": (
        "Turbo Intruder",
        "https://github.com/PortSwigger/turbo-intruder",
    ),
    "insights/private-response-cache-boundary.html": (
        "Param Miner",
        "https://github.com/PortSwigger/param-miner",
    ),
    "insights/server-owned-validation-rules.html": (
        "ffuf",
        "https://github.com/ffuf/ffuf",
    ),
    "insights/evidence-gated-workflows.html": (
        "Nuclei",
        "https://github.com/projectdiscovery/nuclei",
    ),
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
        self.story_heading_levels: list[int] = []
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
        if tag in {"h2", "h3", "h4"}:
            self.story_headings += 1
            self.story_heading_levels.append(int(tag[1]))
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


class ArchiveCardDocument(HTMLParser):
    def __init__(self, source: str):
        super().__init__(convert_charrefs=True)
        self.cards: list[dict] = []
        self.current: dict | None = None
        self.feed(source)
        self.close()

    def handle_starttag(self, tag, attributes):
        attrs = dict(attributes)
        if tag == "article" and "data-archive-card" in attrs:
            self.current = {"href": "", "images": []}
        elif self.current is not None and tag == "a" and attrs.get("href"):
            self.current["href"] = attrs["href"]
        elif self.current is not None and tag == "img":
            self.current["images"].append(attrs)

    def handle_endtag(self, tag):
        if tag == "article" and self.current is not None:
            self.cards.append(self.current)
            self.current = None


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
    def test_collection_has_nine_field_notes_and_nineteen_distinct_articles(self):
        page = EditorialDocument((SOURCE_ROOT / "blogs.html").read_text(encoding="utf-8"))
        self.assertEqual(page.archive_cards, len(ARCHIVE))
        self.assertEqual(page.field_note_cards, len(ANONYMIZED_STORIES))
        self.assertEqual(len(ARCHIVE), 19)
        self.assertEqual(len(set(ARCHIVE)), 19)
        for article in ARCHIVE:
            with self.subTest(article=article):
                self.assertIn(article, PUBLIC_FILE_SET)
                self.assertEqual(page.links.count(public_path(article)), 1)
        self.assertIn("/blog", page.links)

    def test_every_archive_card_uses_its_articles_social_thumbnail(self):
        hub = ArchiveCardDocument((SOURCE_ROOT / "blogs.html").read_text(encoding="utf-8"))
        self.assertEqual(len(hub.cards), len(ARCHIVE))
        seen = set()
        for card in hub.cards:
            target = local_target("blogs.html", card["href"])
            self.assertIsNotNone(target)
            article = target[0]
            with self.subTest(article=article):
                self.assertIn(article, ARCHIVE)
                self.assertNotIn(article, seen)
                seen.add(article)
                self.assertEqual(len(card["images"]), 1)
                image = card["images"][0]
                page = EditorialDocument((SOURCE_ROOT / article).read_text(encoding="utf-8"))
                social_url = urlsplit(page.meta["og:image"])
                self.assertEqual(image.get("src"), social_url.path)
                self.assertEqual(image.get("width"), page.meta["og:image:width"])
                self.assertEqual(image.get("height"), page.meta["og:image:height"])
                self.assertEqual(image.get("alt"), page.meta["og:image:alt"])
                self.assertEqual(image.get("loading"), "lazy")
                self.assertEqual(image.get("decoding"), "async")
                self.assertEqual(image.get("fetchpriority"), "low")
                image_path = social_url.path.lstrip("/")
                self.assertIn(image_path, PUBLIC_FILE_SET)
                self.assertTrue((SOURCE_ROOT / image_path).is_file())
        self.assertEqual(seen, set(ARCHIVE))

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
                self.assertEqual(page.story_heading_levels[0], 2)
                self.assertTrue(all(
                    current <= previous + 1
                    for previous, current in zip(
                        page.story_heading_levels,
                        page.story_heading_levels[1:],
                    )
                ))
                self.assertGreaterEqual(page.story_figures, 1)
                self.assertGreaterEqual(page.story_captions, 1)
                self.assertGreaterEqual(page.story_pre, 1)
                self.assertNotIn("/about#researcher", page.links)
                self.assertIn("/blogs#bug-bounty-archive", page.links)
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
                self.assertEqual(article["author"]["@id"], "https://balhence.com/blogs#author")
                self.assertEqual(article["publisher"]["@id"], "https://balhence.com/#organization")
                self.assertEqual(
                    article["isPartOf"]["@id"],
                    "https://balhence.com/blogs#bug-bounty-archive",
                )
                self.assertEqual(article["dateModified"], "2026-11-17")

    def test_story_images_match_body_social_metadata_and_schema(self):
        self.assertEqual(
            len({expected["caption"] for expected in STORY_IMAGES.values()}),
            len(ANONYMIZED_STORIES),
        )
        self.assertEqual(
            len(
                {
                    (SOURCE_ROOT / expected["asset"]).read_bytes()
                    for expected in STORY_IMAGES.values()
                }
            ),
            len(ANONYMIZED_STORIES),
        )
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
                self.assertEqual(article["dateModified"], "2026-11-17")
                self.assertEqual(webpage["dateModified"], "2026-11-17")
                self.assertIn(
                    'Updated <time datetime="2026-11-17">17 November 2026</time>',
                    source,
                )
                self.assertIn(asset, PUBLIC_FILE_SET)
                image_path = SOURCE_ROOT / asset
                self.assertTrue(image_path.is_file())
                self.assertTrue(image_path.read_bytes().startswith(b"\xff\xd8\xff"))
                self.assertLessEqual(image_path.stat().st_size, 250_000)
                self.assertIn(f"<figcaption>{expected['caption']}</figcaption>", source)

    def test_each_field_note_recommends_one_distinct_open_source_tool(self):
        self.assertEqual(set(STORY_TOOLS), set(ANONYMIZED_STORIES))
        self.assertEqual(
            len({link for _, link in STORY_TOOLS.values()}),
            len(ANONYMIZED_STORIES),
        )
        for story, (tool_name, tool_link) in STORY_TOOLS.items():
            with self.subTest(story=story):
                source = (SOURCE_ROOT / story).read_text(encoding="utf-8")
                page = EditorialDocument(source)
                self.assertIn('<h2 id="open-source-tool">', source)
                self.assertIn('<a href="#open-source-tool">Open-source tool</a>', source)
                self.assertEqual(page.links.count(tool_link), 1)
                self.assertIn(
                    f"not a claim that {tool_name} was used in the original private submission",
                    source,
                )

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

    def test_story_links_only_include_the_verified_tool_repository(self):
        for story in ANONYMIZED_STORIES:
            with self.subTest(story=story):
                page = EditorialDocument((SOURCE_ROOT / story).read_text(encoding="utf-8"))
                expected_tool_link = STORY_TOOLS[story][1]
                for link in page.links:
                    parsed = urlsplit(link)
                    if parsed.netloc:
                        self.assertEqual(link, expected_tool_link)
                    if parsed.scheme == "mailto":
                        self.assertEqual(parsed.path, "contact@balhence.com")


if __name__ == "__main__":
    unittest.main()
