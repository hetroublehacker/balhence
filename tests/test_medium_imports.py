"""Regression checks for the first-party author research archive."""

from __future__ import annotations

import hashlib
import json
import re
import unittest
from html.parser import HTMLParser
from pathlib import Path

from build_public import PUBLIC_FILE_SET, SOURCE_ROOT


MANIFEST = SOURCE_ROOT / "tests" / "fixtures" / "medium-import-manifest.json"
VOID_ELEMENTS = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"}


def normalized(parts: list[str]) -> str:
    return re.sub(r"\s+", " ", " ".join(parts)).strip()


class ArchivePage(HTMLParser):
    def __init__(self, source: str):
        super().__init__(convert_charrefs=True)
        self.canonical = ""
        self.robots = ""
        self.h1_parts: list[str] = []
        self.body_parts: list[str] = []
        self.import_hash = ""
        self.images: list[str] = []
        self.image_alts: list[str] = []
        self.author_profile_link = False
        self.in_h1 = False
        self.capture_depth = 0
        self.iframe_depth = 0
        self.feed(source)
        self.close()

    def handle_starttag(self, tag, attrs):
        values = dict(attrs)
        classes = values.get("class", "").split()
        if tag == "link" and "canonical" in values.get("rel", "").split():
            self.canonical = values.get("href", "")
        if tag == "meta" and values.get("name", "").lower() == "robots":
            self.robots = values.get("content", "")
        if tag == "a" and values.get("href") == "/about.html#researcher":
            self.author_profile_link = True
        if tag == "h1":
            self.in_h1 = True
        if tag == "div" and "research-article-body" in classes:
            self.capture_depth = 1
            self.import_hash = values.get("data-research-text-sha256", "")
            return
        if self.capture_depth:
            if tag not in VOID_ELEMENTS:
                self.capture_depth += 1
            if tag == "iframe":
                self.iframe_depth += 1
            if tag == "img":
                self.images.append(values.get("src", ""))
                self.image_alts.append(values.get("alt", ""))

    def handle_startendtag(self, tag, attrs):
        if self.capture_depth and tag == "img":
            values = dict(attrs)
            self.images.append(values.get("src", ""))
            self.image_alts.append(values.get("alt", ""))

    def handle_endtag(self, tag):
        if tag == "h1":
            self.in_h1 = False
        if not self.capture_depth:
            return
        if tag == "iframe" and self.iframe_depth:
            self.iframe_depth -= 1
        if tag not in VOID_ELEMENTS:
            self.capture_depth -= 1

    def handle_data(self, data):
        if self.in_h1:
            self.h1_parts.append(data)
        if self.capture_depth and not self.iframe_depth:
            self.body_parts.append(data)


class ResearchArchiveTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))

    def test_all_ten_source_posts_are_present_once(self):
        self.assertEqual(len(self.manifest), 10)
        self.assertEqual(len({item["path"] for item in self.manifest}), 10)
        self.assertEqual(len({item["post_id"] for item in self.manifest}), 10)
        self.assertEqual(len({item["source_url"] for item in self.manifest}), 10)

    def test_archive_pages_preserve_text_images_and_publication_record(self):
        for item in self.manifest:
            with self.subTest(path=item["path"]):
                self.assertIn(item["path"], PUBLIC_FILE_SET)
                source = (SOURCE_ROOT / item["path"]).read_text(encoding="utf-8")
                page = ArchivePage(source)
                self.assertNotIn("noindex", page.robots.lower())
                self.assertIn("index", page.robots.lower())
                self.assertEqual(page.canonical, f'https://balhence.com/{item["path"]}')
                self.assertEqual(normalized(page.h1_parts), item["title"])
                self.assertTrue(page.author_profile_link)
                self.assertEqual(page.import_hash, item["text_sha256"])
                body_hash = hashlib.sha256(normalized(page.body_parts).encode("utf-8")).hexdigest()
                self.assertEqual(body_hash, item["text_sha256"])
                self.assertEqual(len(page.images), item["images"])
                self.assertEqual(len(page.image_alts), item["images"])
                if item["post_id"] == "58d3a9946225":
                    self.assertEqual(page.image_alts[0], "")
                    self.assertTrue(all(page.image_alts[1:]))
                else:
                    self.assertTrue(all(page.image_alts))
                self.assertNotIn("medium.com/_/stat", source)
                self.assertNotIn("where people are continuing the conversation by highlighting", source)
                self.assertNotIn("Medium remains the canonical publication", source)
                self.assertNotIn("Read on Medium", source)
                self.assertNotIn("Follow on Medium", source)
                structured_data = [
                    json.loads(payload)
                    for payload in re.findall(
                        r'<script type="application/ld\+json">\s*(.*?)\s*</script>',
                        source,
                        flags=re.DOTALL,
                    )
                ]
                article = next(
                    node
                    for payload in structured_data
                    for node in payload.get("@graph", [])
                    if node.get("@type") == "BlogPosting"
                )
                self.assertEqual(
                    article["isPartOf"]["@id"],
                    "https://balhence.com/blogs.html#bug-bounty-archive",
                )
                for image in page.images:
                    self.assertRegex(image, r"\A/assets/research/[a-zA-Z0-9.-]+\Z")
                    relative = image.lstrip("/")
                    self.assertIn(relative, PUBLIC_FILE_SET)
                    self.assertTrue((SOURCE_ROOT / relative).is_file())

    def test_dependency_confusion_gist_is_restored_as_visible_code(self):
        source = (SOURCE_ROOT / "research/dependency-confusion.html").read_text(encoding="utf-8")
        self.assertIn("find . -type f -name package.json", source)
        self.assertIn("https://gist.github.com/hetroublehacker/c4a0d4e994e63092d8c9efbc03bcf5e2", source)
        self.assertNotIn("medium.com/media/2ef920021c6845811eb3d2a3298ef24d/href", source)

    def test_original_image_bytes_match_the_import_manifest(self):
        for item in self.manifest:
            with self.subTest(path=item["path"]):
                self.assertEqual(len(item["image_assets"]), item["images"])
                for asset in item["image_assets"]:
                    payload = (SOURCE_ROOT / asset["path"]).read_bytes()
                    self.assertEqual(len(payload), asset["bytes"])
                    self.assertEqual(hashlib.sha256(payload).hexdigest(), asset["sha256"])

    def test_hub_and_profile_link_the_complete_archive(self):
        hub = (SOURCE_ROOT / "blogs.html").read_text(encoding="utf-8")
        about = (SOURCE_ROOT / "about.html").read_text(encoding="utf-8")
        self.assertIn('id="bug-bounty-archive"', hub)
        self.assertIn('"@id": "https://balhence.com/about.html#researcher"', about)
        self.assertIn('id="researcher"', about)
        for item in self.manifest:
            self.assertEqual(hub.count(f'href="/{item["path"]}"'), 1)


if __name__ == "__main__":
    unittest.main()
