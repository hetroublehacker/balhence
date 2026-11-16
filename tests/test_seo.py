"""Search discovery and enquiry-path invariants for the real public site.

These are publication checks, not promises about rankings. They use the same
HTML and URL parsing as the site verifier and never fetch external resources.
"""

from __future__ import annotations

from collections import deque
from dataclasses import dataclass, field
from datetime import date, datetime, timezone
from html.parser import HTMLParser
import unittest
import re
from urllib.parse import parse_qs, urlsplit
import xml.etree.ElementTree as ET

from build_public import PUBLIC_FILES, PUBLIC_FILE_SET, SOURCE_ROOT
from verify_site import Document, ORIGIN, local_target, strict_json


COMMERCIAL_PAGES = (
    "penetration-testing-india.html",
    "web-application-penetration-testing.html",
    "api-penetration-testing.html",
    "saas-penetration-testing.html",
    "soc-2-penetration-testing.html",
    "ai-llm-penetration-testing.html",
    "penetration-testing-services-usa.html",
    "compliance-penetration-testing.html",
    "pci-dss-penetration-testing.html",
    "hipaa-penetration-testing.html",
    "penetration-testing-as-a-service.html",
    "cloud-penetration-testing.html",
    "network-penetration-testing.html",
    "services.html",
    "attack-path-validation.html",
    "pricing.html",
)
ENQUIRY_SERVICES = {
    "soc-2-penetration-testing.html": "soc2",
    "ai-llm-penetration-testing.html": "ai",
    "compliance-penetration-testing.html": "compliance",
    "pci-dss-penetration-testing.html": "pci",
    "hipaa-penetration-testing.html": "hipaa",
    "penetration-testing-as-a-service.html": "ptaas",
    "cloud-penetration-testing.html": "cloud",
    "network-penetration-testing.html": "infrastructure",
    "attack-path-validation.html": "attack-path",
}
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


class LaunchMarkup(HTMLParser):
    """Inspect rendered FAQ text and alternate-language links independently of JSON-LD."""

    def __init__(self, source):
        super().__init__(convert_charrefs=True)
        self.alternates = {}
        self.faqs = []
        self.current = None
        self.part = None
        self.feed(source)

    def handle_starttag(self, tag, attrs):
        values = dict(attrs)
        if tag == "link" and values.get("rel") == "alternate" and values.get("hreflang"):
            language = values["hreflang"]
            if language in self.alternates:
                raise AssertionError(f"Duplicate hreflang: {language}")
            self.alternates[language] = values.get("href")
        if tag == "details" and "faq-item" in values.get("class", "").split():
            self.current = {"summary": [], "p": []}
        if self.current is not None and tag in ("summary", "p"):
            self.part = tag

    def handle_endtag(self, tag):
        if self.current is None:
            return
        if tag == "details":
            self.faqs.append(tuple(normalized(" ".join(self.current[key])) for key in ("summary", "p")))
            self.current = None
        if tag in ("summary", "p", "details"):
            self.part = None

    def handle_data(self, data):
        if self.current is not None and self.part and data.strip():
            self.current[self.part].append(data.strip())


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
        and parse_qs(urlsplit(anchor.href).query).get("service") == [ENQUIRY_SERVICES.get(source, "web-api")]
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

    def test_launch_pages_have_contextual_incoming_links_and_scope_routes(self):
        for relative in COMMERCIAL_PAGES[4:]:
            with self.subTest(page=relative):
                incoming = {
                    source for source, document in self.documents.items()
                    if source != relative and any(
                        anchor.in_main and linked_path(source, anchor) == relative
                        for anchor in document.anchors
                    )
                }
                self.assertGreaterEqual(len(incoming), 3, "Needs contextual links beyond shared navigation")
                self.assertTrue(any(
                    anchor.in_main and linked_path(relative, anchor) == "scope-builder.html"
                    for anchor in self.documents[relative].anchors
                ))

    def test_shared_solutions_menu_surfaces_cloud_and_network_testing(self):
        expected = {
            "/cloud-penetration-testing.html": "Cloud penetration testing",
            "/network-penetration-testing.html": "Network penetration testing",
        }
        checked = 0
        for relative in self.documents:
            source = (SOURCE_ROOT / relative).read_text(encoding="utf-8")
            if "data-solutions-menu" not in source:
                continue
            checked += 1
            for href, label in expected.items():
                with self.subTest(page=relative, href=href):
                    self.assertIn(f'<a href="{href}">{label}</a>', source)
        self.assertGreaterEqual(checked, 45)

    def test_pci_page_links_directly_to_network_segmentation_scope(self):
        anchors = [
            anchor for anchor in self.documents["pci-dss-penetration-testing.html"].anchors
            if anchor.in_main and linked_path("pci-dss-penetration-testing.html", anchor) == "network-penetration-testing.html"
        ]
        self.assertGreaterEqual(len(anchors), 2)
        self.assertTrue(any("segmentation" in normalized(anchor.text) for anchor in anchors))

    def test_pci_segmentation_guide_is_published_and_contextually_linked(self):
        relative = "insights/pci-dss-network-segmentation-testing.html"
        canonical = f"{ORIGIN}/{relative}"
        self.assertIn(relative, PUBLIC_FILE_SET)
        self.assertTrue(self.documents[relative].indexable)
        self.assertEqual(self.documents[relative].canonicals, [canonical])
        self.assertEqual(self.documents[relative].value("og:url"), canonical)
        self.assertEqual(self.sitemap.get(canonical), "2026-11-15")

        articles = [
            node for node in schema_nodes(self.documents[relative])
            if schema_types(node) & ARTICLE_TYPES and node.get("url") == canonical
        ]
        self.assertEqual(len(articles), 1)
        self.assertEqual(
            normalized(articles[0].get("headline", "")),
            normalized("PCI DSS network segmentation testing: 11.4.5 and 11.4.6"),
        )

        incoming = {
            source for source in (
                "blog.html",
                "compliance-penetration-testing.html",
                "network-penetration-testing.html",
                "pci-dss-penetration-testing.html",
            )
            if any(
                anchor.in_main and linked_path(source, anchor) == relative
                for anchor in self.documents[source].anchors
            )
        }
        self.assertEqual(len(incoming), 4)

        destinations = {
            linked_path(relative, anchor)
            for anchor in self.documents[relative].anchors
            if anchor.in_main and normalized(anchor.text)
        }
        self.assertTrue({
            "pci-dss-penetration-testing.html",
            "network-penetration-testing.html",
            "compliance-penetration-testing.html",
            "insights/what-good-pentest-report-includes.html",
            "report-viewer.html",
            "contact.html",
        }.issubset(destinations))

    def test_faq_schema_matches_visible_questions_and_answers(self):
        for relative, document in self.documents.items():
            rendered = LaunchMarkup((SOURCE_ROOT / relative).read_text(encoding="utf-8")).faqs
            if not rendered:
                continue
            with self.subTest(page=relative):
                faqs = [node for node in schema_nodes(document) if "FAQPage" in schema_types(node)]
                self.assertEqual(len(faqs), 1)
                described = [
                    (normalized(item["name"]), normalized(item["acceptedAnswer"]["text"]))
                    for item in faqs[0]["mainEntity"]
                ]
                self.assertEqual(described, rendered)

    def test_country_alternates_are_reciprocal_and_self_canonical(self):
        expected = {
            "en-US": f"{ORIGIN}/penetration-testing-services-usa.html",
            "en-IN": f"{ORIGIN}/penetration-testing-india.html",
        }
        for relative, document in self.documents.items():
            alternates = LaunchMarkup((SOURCE_ROOT / relative).read_text(encoding="utf-8")).alternates
            if relative not in ("penetration-testing-services-usa.html", "penetration-testing-india.html"):
                self.assertEqual(alternates, {}, relative)
                continue
            with self.subTest(page=relative):
                self.assertEqual(alternates, expected)
                self.assertEqual(document.canonicals, [f"{ORIGIN}/{relative}"])

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

    def test_homepage_navigation_schema_matches_visible_primary_routes(self):
        nodes = schema_nodes(self.documents["index.html"])
        navigation = [node for node in nodes if "SiteNavigationElement" in schema_types(node)]
        self.assertEqual(len(navigation), 1)
        names = navigation[0].get("name", [])
        urls = navigation[0].get("url", [])
        self.assertEqual(len(names), len(urls))
        expected = {
            "services.html",
            "attack-path-validation.html",
            "compliance-penetration-testing.html",
            "soc-2-penetration-testing.html",
            "pci-dss-penetration-testing.html",
            "hipaa-penetration-testing.html",
            "ai-llm-penetration-testing.html",
            "cloud-penetration-testing.html",
            "network-penetration-testing.html",
            "penetration-testing-as-a-service.html",
            "penetration-testing-india.html",
            "penetration-testing-services-usa.html",
            "about.html",
            "pricing.html",
            "blogs.html",
            "contact.html",
        }
        self.assertEqual({urlsplit(url).path.lstrip("/") for url in urls}, expected)

    def test_contact_service_query_values_exist_in_the_form(self):
        contact = (SOURCE_ROOT / "contact.html").read_text(encoding="utf-8")
        service_select = re.search(r'<select id="service"[^>]*>(.*?)</select>', contact, re.DOTALL)
        self.assertIsNotNone(service_select)
        valid = set(re.findall(r'<option value="([^"]*)"', service_select.group(1)))
        valid.discard("")
        for relative, document in self.documents.items():
            for anchor in document.anchors:
                target = linked_path(relative, anchor)
                values = parse_qs(urlsplit(anchor.href).query).get("service", [])
                if target != "contact.html" or not values:
                    continue
                with self.subTest(page=relative, href=anchor.href):
                    self.assertIn(values[0], valid)

    def test_published_pricing_is_consistent_across_buyer_paths(self):
        pricing = normalized((SOURCE_ROOT / "pricing.html").read_text(encoding="utf-8"))
        for amount in ("$1,500", "$3,500", "$5,500", "$6,500", "$4,500", "$2,500"):
            with self.subTest(amount=amount):
                self.assertIn(amount, pricing)
        for statement in (
            "starting price, then fixed fee",
            "you approve the final scope and fixed price before testing",
            "exclude applicable taxes and agreed third-party costs",
            "one bounded re-test",
        ):
            with self.subTest(statement=statement):
                self.assertIn(statement, pricing)

        expected = {
            "index.html": ("$1,500", "$3,500"),
            "services.html": ("$1,500", "$3,500", "$2,000 / cycle"),
            "insights/web-api-pentest-cost-scope-guide.html": ("$1,500", "$3,500", "$5,500"),
            "contact.html": ("published starting prices",),
        }
        for relative, values in expected.items():
            source = normalized((SOURCE_ROOT / relative).read_text(encoding="utf-8"))
            with self.subTest(page=relative):
                self.assertIn('href="/pricing.html"', source)
                for value in values:
                    self.assertIn(value, source)

    def test_attack_path_page_separates_available_and_planned_capabilities(self):
        relative = "attack-path-validation.html"
        source = normalized((SOURCE_ROOT / relative).read_text(encoding="utf-8"))
        for statement in (
            "available by scope",
            "by written scope",
            "design partner",
            "planned",
            "not autonomous production testing",
            "in development",
        ):
            with self.subTest(statement=statement):
                self.assertIn(statement, source)
        self.assertFalse(any(
            "SoftwareApplication" in schema_types(node)
            for node in schema_nodes(self.documents[relative])
        ))

    def test_private_report_proof_is_conservative_and_qualified(self):
        home = normalized((SOURCE_ROOT / "index.html").read_text(encoding="utf-8"))
        about = normalized((SOURCE_ROOT / "about.html").read_text(encoding="utf-8"))
        for statement in (
            "1,100+",
            "690+",
            "three private submission archives",
            "do not claim that every report was accepted, paid, resolved",
            "program and target identities",
        ):
            with self.subTest(statement=statement):
                self.assertIn(statement, about)
        self.assertIn("120+", about)
        self.assertIn("templates, reserved records and low-structure artifacts are excluded", home)
        self.assertIn("not acceptance, payout or final-severity totals", home)
        for unsafe_exact_total in ("1,141", "1,178", "741"):
            with self.subTest(unsafe_exact_total=unsafe_exact_total):
                self.assertNotIn(unsafe_exact_total, home)
                self.assertNotIn(unsafe_exact_total, about)

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

    def test_collection_articles_match_their_linked_published_pages(self):
        checked = 0
        for relative, document in self.documents.items():
            for collection in schema_nodes(document):
                if "CollectionPage" not in schema_types(collection):
                    continue
                for item in collection.get("hasPart", []):
                    if not schema_types(item) & ARTICLE_TYPES:
                        continue
                    with self.subTest(collection=relative, article=item.get("url")):
                        target = local_target(relative, item["url"])
                        self.assertIsNotNone(target)
                        path = target[0]
                        self.assertIn(path, self.documents)
                        self.assertTrue(self.documents[path].indexable)
                        self.assertTrue(any(
                            anchor.in_main and linked_path(relative, anchor) == path
                            and normalized(anchor.text)
                            for anchor in document.anchors
                        ), "Collection metadata needs a visible link to the article")
                        articles = [
                            node for node in schema_nodes(self.documents[path])
                            if schema_types(node) & ARTICLE_TYPES
                            and node.get("url") == item["url"]
                        ]
                        self.assertEqual(len(articles), 1)
                        self.assertEqual(normalized(item["headline"]), normalized(articles[0]["headline"]))
                        if "@id" in item:
                            self.assertEqual(item["@id"], articles[0]["@id"])
                        checked += 1
        self.assertGreater(checked, 0, "Expected a linked article collection")


if __name__ == "__main__":
    unittest.main()
