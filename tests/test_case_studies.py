"""Publication invariants for the anonymized editorial collection."""

from html import unescape
from html.parser import HTMLParser
import json
import re
import unittest
from urllib.parse import urlsplit

from build_public import PUBLIC_FILE_SET, SOURCE_ROOT


STORIES = (
    "insights/draft-write-authorization.html",
    "insights/session-authority-boundary.html",
    "insights/private-response-cache-boundary.html",
    "insights/server-owned-validation-rules.html",
    "insights/evidence-gated-workflows.html",
)


class EditorialDocument(HTMLParser):
    def __init__(self, source):
        super().__init__()
        self.links = []
        self.rows = 0
        self.in_body = False
        self.code_blocks = 0
        self.cards = 0
        self.http_blocks = []
        self._http = None
        self.feed(source)

    def handle_starttag(self, tag, attributes):
        attrs = dict(attributes)
        if tag == "a" and attrs.get("href"):
            self.links.append(attrs["href"])
        if tag == "tbody":
            self.in_body = True
        if tag == "tr" and self.in_body:
            self.rows += 1
        if tag == "pre" and "case-code" in attrs.get("class", "").split():
            self.code_blocks += 1
        if tag == "pre" and "http-code" in attrs.get("class", "").split():
            self._http = []
        if tag == "article" and "data-case-card" in attrs:
            self.cards += 1

    def handle_endtag(self, tag):
        if tag == "tbody":
            self.in_body = False
        if tag == "pre" and self._http is not None:
            self.http_blocks.append("".join(self._http))
            self._http = None

    def handle_data(self, data):
        if self._http is not None:
            self._http.append(data)


class CaseStudyPublicationTests(unittest.TestCase):
    def test_collection_has_five_distinct_published_destinations(self):
        page = EditorialDocument((SOURCE_ROOT / "blogs.html").read_text(encoding="utf-8"))
        self.assertEqual(page.cards, 5)
        for story in STORIES:
            with self.subTest(story=story):
                self.assertIn(story, PUBLIC_FILE_SET)
                self.assertEqual(page.links.count("/" + story), 1)
        self.assertIn("/blog.html", page.links)

    def test_each_story_contains_five_local_regression_cases(self):
        for story in STORIES:
            with self.subTest(story=story):
                source = (SOURCE_ROOT / story).read_text(encoding="utf-8")
                page = EditorialDocument(source)
                self.assertEqual(page.rows, 5)
                self.assertGreaterEqual(page.code_blocks, 1)
                self.assertRegex(source.lower(), r"synthetic")
                self.assertIsNotNone(re.search(r"illustrat(?:ive|es)", source.lower()), "Code must be described as illustrative")
                self.assertRegex(source.lower(), r"local")
                self.assertIn("/blogs.html", page.links)

    def test_editorial_disclosure_keeps_evidence_and_fix_status_separate(self):
        for story in STORIES:
            with self.subTest(story=story):
                source = (SOURCE_ROOT / story).read_text(encoding="utf-8").lower()
                self.assertIn("private research notes", source)
                self.assertRegex(source, r"removed or replaced")
                self.assertIsNotNone(re.search(r"not.{0,45}independently revalidated", source), "State that source observations were not independently revalidated")
                self.assertRegex(source, r"proposed")
                self.assertIsNotNone(re.search(r"not.{0,45}deployed", source), "Do not imply a confirmed deployment")

    def test_no_private_source_locations_or_raw_credentials_in_stories(self):
        forbidden = re.compile(
            r"(?:/home/|/users/|bbscope/|recon/reports/|finding-\d+|"
            r"-----BEGIN [A-Z ]*PRIVATE KEY-----)", re.I,
        )
        for relative in (*STORIES, "blogs.html", "case-studies.js", "case-studies.css"):
            with self.subTest(file=relative):
                source = (SOURCE_ROOT / relative).read_text(encoding="utf-8")
                self.assertIsNone(forbidden.search(source))
                self.assertTrue(source.isascii())
                for header in re.findall(r"\b(?:authorization|cookie|set-cookie)\s*:[^\r\n<]*", unescape(source), re.I):
                    self.assertRegex(header.strip(), r"^(?:Cookie: session=\[REDACTED\]|Authorization: Bearer \[REDACTED\])$", "Credential headers must be explicit placeholders")

    def test_http_notebooks_use_only_read_only_synthetic_requests(self):
        for story in STORIES:
            with self.subTest(story=story):
                source = (SOURCE_ROOT / story).read_text(encoding="utf-8")
                page = EditorialDocument(source)
                self.assertEqual(len(page.http_blocks), 2)
                request, response = page.http_blocks
                self.assertRegex(request, r"\AGET /redacted/[a-z-]+ HTTP/1\.1\n")
                self.assertIn("\nHost: research.example\n", request)
                self.assertTrue(request.endswith("\n\n"), "GET headers end with a blank line and no body")
                self.assertNotIn("?", request, "No reproduction parameters in the display examples")
                self.assertIn("SYNTHETIC + REDACTED", source)
                self.assertIn("not an original wire capture", source)
                self.assertIn("Display only: no requests are sent", source)
                self.assertTrue(response.startswith("HTTP/1.1 "))

    def test_http_response_framing_and_json_are_consistent(self):
        for story in STORIES:
            with self.subTest(story=story):
                page = EditorialDocument((SOURCE_ROOT / story).read_text(encoding="utf-8"))
                self.assertEqual(len(page.http_blocks), 2)
                headers, body = page.http_blocks[1].split("\n\n", 1)
                length = re.search(r"^Content-Length: (\d+)$", headers, re.M)
                self.assertIsNotNone(length)
                self.assertEqual(int(length.group(1)), len(body.encode("ascii")))
                self.assertIsInstance(json.loads(body), dict)

    def test_new_article_links_do_not_disclose_external_targets(self):
        for story in STORIES:
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
