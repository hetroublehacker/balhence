"""Search discovery and enquiry-path invariants for the real public site.

These are publication checks, not promises about rankings. They use the same
HTML and URL parsing as the site verifier and never fetch external resources.
"""

from __future__ import annotations

from collections import deque
from dataclasses import dataclass, field
from datetime import date, datetime, timezone
import unittest
from urllib.parse import parse_qs, urlsplit
import xml.etree.ElementTree as ET

from build_public import PUBLIC_FILES, PUBLIC_FILE_SET, SOURCE_ROOT
from verify_site import Document, ORIGIN, local_target, strict_json


COMMERCIAL_PAGES = (
    "web-application-penetration-testing.html",
    "api-penetration-testing.html",
    "saas-penetration-testing.html",
)
SITEMAP_NAMESPACE = "{http://www.sitemaps.org/schemas/sitemap/0.9}"
ARTICLE_TYPES = {"Article", "BlogPosting", "TechArticle"}


def normalized(value: str) -> str:
    return " ".join(value.split()).casefold()


@dataclass
class Anchor:
    href: str
    in_main: bool
    classes: set[str] = field(default_factory=set)
    text: str = ""


class SearchDocument(Document):
    """Keep ordinary anchors separate from canonical, script and JSON-LD URLs."""

    def __init__(self, source: str):
        self.anchors: list[Anchor] = []
        self._in_main = False
        self._anchor: Anchor | None = None
        super().__init__(source)

    def handle_starttag(self, tag, attrs):
        super().handle_starttag(tag, attrs)
        values = dict(attrs)
        if tag == "main":
            self._in_main = True
        if tag == "a" and values.get("href"):
            self._anchor = Anchor(
                values["href"], self._in_main,
                set(values.get("class", "").split()),
            )
            self.anchors.append(self._anchor)

    def handle_endtag(self, tag):
        super().handle_endtag(tag)
        if tag == "a":
            self._anchor = None
        if tag == "main":
            self._in_main = False

    def handle_data(self, data):
        super().handle_data(data)
        if self._anchor is not None:
            self._anchor.text += data


def schema_objects(value):
    """Visit graph, list and nested JSON-LD objects without assuming layout."""
    if isinstance(value, dict):
        yield value
        for child in value.values():
            yield from schema_objects(child)
    elif isinstance(value, list):
        for child in value:
            yield from schema_objects(child)


def schema_types(node) -> set[str]:
    value = node.get("@type", [])
    return {value} if isinstance(value, str) else set(value)


def schema_nodes(document: Document):
    return [
        node
        for block in document.structured_data
        for node in schema_objects(strict_json(block))
    ]


def linked_path(source: str, anchor: Anchor) -> str | None:
    target = local_target(source, anchor.href)
    return target[0] if target is not None else None


def pentest_enquiry(source: str, anchor: Anchor) -> bool:
    return (
        linked_path(source, anchor) == "contact.html"
        and parse_qs(urlsplit(anchor.href).query).get("service") == ["web-api"]
        and bool(normalized(anchor.text))
    )


class SearchAndConversionTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.documents = {
            relative: SearchDocument((SOURCE_ROOT / relative).read_text(encoding="utf-8"))
            for relative in PUBLIC_FILES if relative.endswith(".html")
        }
        cls.sitemap_entries = ET.parse(SOURCE_ROOT / "sitemap.xml").findall(
            f"{SITEMAP_NAMESPACE}url"
        )
        cls.sitemap = {
            entry.findtext(f"{SITEMAP_NAMESPACE}loc", default=""):
            entry.findtext(f"{SITEMAP_NAMESPACE}lastmod")
            for entry in cls.sitemap_entries
        }

    def test_indexable_titles_and_descriptions_are_nonempty_and_distinct(self):
        seen = {"title": {}, "description": {}}
        for relative, document in self.documents.items():
            if not document.indexable:
                continue
            values = {
                "title": (document.title_count, "".join(document.title)),
                "description": (
                    len(document.meta.get("description", [])),
                    document.value("description"),
                ),
            }
            for label, (count, value) in values.items():
                with self.subTest(page=relative, field=label):
                    self.assertEqual(count, 1, f"Expected one {label}")
                    value = normalized(value)
                    self.assertTrue(value, f"Empty {label}")
                    self.assertNotIn(
                        value, seen[label],
                        f"Duplicate normalized {label}: {relative} and {seen[label].get(value)}",
                    )
                    seen[label][value] = relative

    def test_indexable_pages_are_reachable_through_ordinary_anchor_links(self):
        reached = {"index.html"}
        pending = deque(reached)
        while pending:
            source = pending.popleft()
            for anchor in self.documents[source].anchors:
                target = linked_path(source, anchor)
                if target in self.documents and target not in reached:
                    reached.add(target)
                    pending.append(target)
        # Noindex documents can still connect ordinary links; only indexable
        # public HTML pages are required to have a path from the homepage.
        expected = {
            relative for relative, document in self.documents.items()
            if document.indexable
        }
        self.assertEqual(
            sorted(expected - reached), [],
            "Indexable pages need an ordinary <a href> path from index.html",
        )

    def test_commercial_pages_are_published_indexable_and_in_the_sitemap(self):
        for relative in COMMERCIAL_PAGES:
            with self.subTest(page=relative):
                self.assertIn(relative, PUBLIC_FILE_SET)
                document = self.documents[relative]
                self.assertTrue(document.indexable)
                canonical = f"{ORIGIN}/{relative}"
                self.assertEqual(document.canonicals, [canonical])
                self.assertEqual(document.value("og:url"), canonical)
                self.assertIn(canonical, self.sitemap)

    def test_commercial_schema_matches_the_page_canonical(self):
        for relative in COMMERCIAL_PAGES:
            with self.subTest(page=relative):
                canonical = f"{ORIGIN}/{relative}"
                nodes = schema_nodes(self.documents[relative])
                for kind in ("WebPage", "Service"):
                    matching = [node for node in nodes if kind in schema_types(node)]
                    self.assertEqual(len(matching), 1, f"Expected one {kind} entity")
                    self.assertEqual(matching[0].get("url"), canonical)
                    self.assertTrue(normalized(matching[0].get("name", "")))
                breadcrumbs = [node for node in nodes if "BreadcrumbList" in schema_types(node)]
                self.assertEqual(len(breadcrumbs), 1)
                items = breadcrumbs[0].get("itemListElement", [])
                self.assertTrue(items, "Breadcrumb trail must not be empty")
                self.assertEqual([item.get("position") for item in items], list(range(1, len(items) + 1)))
                destination = items[-1].get("item")
                if isinstance(destination, dict):
                    destination = destination.get("@id") or destination.get("url")
                self.assertEqual(destination, canonical)

    def test_commercial_pages_link_to_pentest_intake_and_report_proof(self):
        for relative in COMMERCIAL_PAGES:
            with self.subTest(page=relative):
                anchors = [anchor for anchor in self.documents[relative].anchors if anchor.in_main]
                self.assertTrue(any(pentest_enquiry(relative, anchor) for anchor in anchors))
                self.assertTrue(any(
                    linked_path(relative, anchor) == "report-viewer.html" and normalized(anchor.text)
                    for anchor in anchors
                ), "Commercial page needs a readable sample-report link in its content")

    def test_homepage_has_direct_pentest_intake_and_broad_service_routes(self):
        anchors = [anchor for anchor in self.documents["index.html"].anchors if anchor.in_main]
        self.assertTrue(any(
            pentest_enquiry("index.html", anchor) and "btn" in anchor.classes
            for anchor in anchors
        ), "The homepage needs a direct pentest CTA, not only a planner link")
        destinations = {
            linked_path("index.html", anchor) for anchor in anchors
            if normalized(anchor.text)
        }
        self.assertTrue(set(COMMERCIAL_PAGES).issubset(destinations))
        self.assertIn("services.html", destinations, "Keep the broader security service route")

    def test_sitemap_lastmod_dates_are_iso_dates_and_not_in_the_future(self):
        today = datetime.now(timezone.utc).date()
        for entry in self.sitemap_entries:
            url = entry.findtext(f"{SITEMAP_NAMESPACE}loc", default="")
            dates = entry.findall(f"{SITEMAP_NAMESPACE}lastmod")
            with self.subTest(url=url):
                self.assertLessEqual(len(dates), 1)
                if not dates:
                    continue
                value = dates[0].text or ""
                self.assertRegex(value, r"\A\d{4}-\d{2}-\d{2}\Z")
                self.assertLessEqual(date.fromisoformat(value), today)

    def test_article_modified_dates_match_the_sitemap(self):
        checked = 0
        for relative, document in self.documents.items():
            if not document.indexable:
                continue
            canonical = f"{ORIGIN}/" + ("" if relative == "index.html" else relative)
            # A collection's hasPart entries describe other pages, not the
            # collection's modification date. Check each article at its URL.
            articles = [
                node for node in schema_nodes(document)
                if schema_types(node) & ARTICLE_TYPES and node.get("url") == canonical
            ]
            if document.value("og:type") == "article":
                self.assertTrue(articles, f"{relative}: expected an Article entity for its canonical URL")
            for article in articles:
                with self.subTest(page=relative, article=article.get("@id", "")):
                    modified = article.get("dateModified", "")
                    self.assertRegex(modified, r"\A\d{4}-\d{2}-\d{2}\Z")
                    self.assertIn(canonical, self.sitemap)
                    self.assertEqual(modified, self.sitemap[canonical])
                    checked += 1
        self.assertGreater(checked, 0, "Expected published article dates to be checked")


if __name__ == "__main__":
    unittest.main()
