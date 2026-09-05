"""Regression checks for publication boundaries and static-site regressions."""

from __future__ import annotations

import contextlib
import json
import shutil
import tempfile
import unittest
from pathlib import Path
from unittest import mock

import build_public
import serve
import verify_site


def page(title: str, path: str, content: str = "", *, noindex: bool = False) -> str:
    canonical = f"https://balhence.com/{path}"
    return f"""<!doctype html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title}</title><meta name="robots" content="{'noindex,follow' if noindex else 'index,follow'}">
<meta name="description" content="An example description.">
<meta property="og:title" content="{title}"><meta property="og:description" content="A description.">
<meta property="og:url" content="{canonical}"><meta property="og:image" content="https://balhence.com/logo.svg">
<meta name="twitter:card" content="summary_large_image"><link rel="canonical" href="{canonical}">
<link rel="stylesheet" href="/styles.css?v=1"><script src="/app.js" defer></script>
<script type="application/ld+json">{{"@context":"https://schema.org","@type":"WebPage"}}</script>
</head><body><h1>{title}</h1><main id="main">{content}</main></body></html>"""


class SiteFixture(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="balhence-test-")
        self.addCleanup(self.temp.cleanup)
        self.workspace = Path(self.temp.name)
        self.root = self.workspace / "source"
        self.root.mkdir()
        self.assets = {
            "index.html": page("Home", "", '<a href="docs.html#details">Docs</a>'),
            "docs.html": page("Documentation", "docs.html", '<section id="details"><a href="/#main">Home</a></section>'),
            "404.html": page("Not found", "404.html", noindex=True),
            "styles.css": 'body { background-image: url("/logo.svg?v=1"); }',
            "app.js": '"use strict";',
            "logo.svg": '<svg xmlns="http://www.w3.org/2000/svg"></svg>',
            "CNAME": "balhence.com\n",
            "robots.txt": "User-agent: *\nAllow: /\nSitemap: https://balhence.com/sitemap.xml\n",
            "sitemap.xml": '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://balhence.com/</loc></url><url><loc>https://balhence.com/docs.html</loc></url></urlset>',
            "site.webmanifest": json.dumps({"name": "Example", "start_url": "/", "icons": [{"src": "/logo.svg"}], "shortcuts": [{"url": "/docs.html"}]}),
            ".well-known/security.txt": "Contact: mailto:contact@balhence.com\n",
        }
        for relative, content in self.assets.items():
            path = self.root / relative
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(content, encoding="utf-8")
        stack = self.enterContext(contextlib.ExitStack())
        files = tuple(self.assets)
        for module in (build_public, verify_site):
            stack.enter_context(mock.patch.object(module, "PUBLIC_FILES", files))
            stack.enter_context(mock.patch.object(module, "PUBLIC_FILE_SET", frozenset(files)))
        stack.enter_context(mock.patch.object(build_public, "SOURCE_ROOT", self.root))
        stack.enter_context(mock.patch.object(serve, "PUBLIC_FILE_SET", frozenset(files)))

    def rewrite(self, relative, old, new):
        path = self.root / relative
        path.write_text(path.read_text(encoding="utf-8").replace(old, new), encoding="utf-8")

    def assert_issue(self, expected, *, artifact=False):
        result = verify_site.verify_site(self.root, artifact=artifact)
        self.assertTrue(any(expected in error for error in result.errors), result.errors)


class BuildTests(SiteFixture):
    def test_build_contains_only_runtime_allowlist_and_preserves_sources(self):
        private = self.root / "website-tools" / "private.md"
        private.parent.mkdir()
        private.write_text("Private planning notes", encoding="utf-8")
        before = {path.relative_to(self.root): path.read_bytes() for path in self.root.rglob("*") if path.is_file()}
        output = self.workspace / "release"
        build_public.build(output)
        self.assertEqual({path.relative_to(output).as_posix() for path in output.rglob("*") if path.is_file()}, set(self.assets))
        self.assertEqual(before, {path.relative_to(self.root): path.read_bytes() for path in self.root.rglob("*") if path.is_file()})
        self.assertEqual(verify_site.verify_site(output, artifact=True).errors, [])

    def test_build_refuses_existing_output_directory_and_file(self):
        for name, directory in (("existing-dir", True), ("existing-file", False)):
            with self.subTest(name=name):
                output = self.workspace / name
                output.mkdir() if directory else output.write_text("Keep me", encoding="utf-8")
                with self.assertRaises(SystemExit):
                    build_public.build(output)
                self.assertTrue(output.exists())
                if not directory:
                    self.assertEqual(output.read_text(), "Keep me")

    def test_build_refuses_source_root_and_protected_directories(self):
        for output in (self.root, self.root.parent, self.root / ".git" / "release", self.root / "website-tools" / "release"):
            with self.subTest(output=output), self.assertRaises(SystemExit):
                build_public.resolve_output(output)

    def test_build_refuses_dangling_output_link_and_linked_parent(self):
        dangling = self.workspace / "dangling"
        dangling.symlink_to(self.workspace / "absent", target_is_directory=True)
        parent = self.workspace / "parent-link"
        parent.symlink_to(self.root, target_is_directory=True)
        for output in (dangling, parent / "release"):
            with self.subTest(output=output), self.assertRaises(SystemExit):
                build_public.resolve_output(output)

    def test_public_sources_reject_leaf_and_parent_symlinks(self):
        file = self.root / "app.js"
        original = self.root / "original.js"
        file.rename(original)
        file.symlink_to(original)
        with self.assertRaisesRegex(SystemExit, "linked public asset"):
            build_public.validate_sources()
        file.unlink()
        original.rename(file)
        directory = self.root / ".well-known"
        replacement = self.root / "other-assets"
        directory.rename(replacement)
        directory.symlink_to(replacement, target_is_directory=True)
        with self.assertRaisesRegex(SystemExit, "linked public asset"):
            build_public.validate_sources()

    def test_invalid_allowlist_paths_cannot_escape_source(self):
        for path in ("../secret.txt", "/etc/passwd", "a/../../app.js", "a\\app.js", "a//app.js"):
            with self.subTest(path=path), self.assertRaises(ValueError):
                build_public.public_source(self.root, path)

    def test_output_created_during_build_is_never_overwritten(self):
        output = self.workspace / "release"
        real_copy = shutil.copy2

        def create_competing_output(*args, **kwargs):
            if not output.exists():
                output.mkdir()
                (output / "owner.txt").write_text("Another process owns this", encoding="utf-8")
            return real_copy(*args, **kwargs)

        with mock.patch.object(build_public.shutil, "copy2", side_effect=create_competing_output):
            with self.assertRaises(FileExistsError):
                build_public.build(output)
        self.assertEqual((output / "owner.txt").read_text(), "Another process owns this")
        self.assertEqual(sorted(path.name for path in output.iterdir()), ["owner.txt"])
        self.assertEqual(list(self.workspace.glob(".release.tmp-*")), [])

    def test_failed_build_cleans_its_staging_and_output(self):
        output = self.workspace / "release"
        with mock.patch.object(build_public.os, "rename", side_effect=OSError("simulated disk failure")):
            with self.assertRaises(OSError):
                build_public.build(output)
        self.assertFalse(output.exists())
        self.assertEqual(list(self.workspace.glob(".release.tmp-*")), [])

    def test_link_introduced_during_copy_is_not_published(self):
        output = self.workspace / "release"
        real_copy = shutil.copy2

        def copy_with_changed_source(source, destination, **kwargs):
            if source.name == "app.js":
                destination.symlink_to(source)
                return destination
            return real_copy(source, destination, **kwargs)

        with mock.patch.object(build_public.shutil, "copy2", side_effect=copy_with_changed_source):
            with self.assertRaisesRegex(ValueError, "linked public asset"):
                build_public.build(output)
        self.assertFalse(output.exists())
        self.assertEqual(list(self.workspace.glob(".release.tmp-*")), [])


class ValidatorTests(SiteFixture):
    def test_valid_site_and_anchors_pass_without_network_access(self):
        with mock.patch("socket.create_connection", side_effect=AssertionError("no external fetches")):
            result = verify_site.verify_site(self.root)
        self.assertEqual(result.errors, [])
        self.assertEqual(result.pages, 3)
        self.assertGreater(result.references, 10)

    def test_literal_non_ascii_is_rejected_in_first_party_text(self):
        for relative, original in self.assets.items():
            if not verify_site.checks_ascii(relative):
                continue
            with self.subTest(relative=relative):
                path = self.root / relative
                path.write_text(original + "\n\u2019", encoding="utf-8")
                try:
                    self.assert_issue(f"{relative}:{original.count(chr(10)) + 2}:1: source contains non-ASCII U+2019")
                finally:
                    path.write_text(original, encoding="utf-8")
        self.assertEqual(
            verify_site.ascii_issues("app.js", "// comment\u2028"),
            ["app.js:1:11: source contains non-ASCII U+2028"],
        )

    def test_encoded_punctuation_is_rejected_in_html_text_and_attributes(self):
        for entity in ("&rsquo;", "&#8217;", "&#x2019;"):
            for content in (f"<p>We{entity}ll help.</p>", f'<p title="We{entity}ll help.">Help</p>'):
                with self.subTest(content=content):
                    (self.root / "index.html").write_text(page("Home", "", content), encoding="utf-8")
                    self.assert_issue("HTML entity renders non-ASCII U+2019")
        self.assertEqual(
            verify_site.ascii_issues("index.html", '<p title="Ready\nnow &rsquo;">OK</p>'),
            ["index.html:2:5: HTML entity renders non-ASCII U+2019"],
        )

    def test_vendor_licenses_and_code_escapes_are_not_ascii_copy(self):
        extras = {
            "vendor/library.js": "// Copyright \u00a9 Example",
            "LICENSE.txt": "Copyright \u00a9 Example",
            "image.png": b"\x89PNG\r\n\x1a\n",
        }
        for relative, content in extras.items():
            path = self.root / relative
            path.parent.mkdir(exist_ok=True)
            path.write_bytes(content if isinstance(content, bytes) else content.encode("utf-8"))
        (self.root / "app.js").write_text(r'const ascii = /^[\u0000-\u007f]*$/;', encoding="utf-8")
        self.rewrite("index.html", "</main>", '<p>A &amp; B</p><script>const example = "&rsquo;";</script></main>')
        files = tuple(self.assets) + tuple(extras)
        with contextlib.ExitStack() as stack:
            for module in (build_public, verify_site):
                stack.enter_context(mock.patch.object(module, "PUBLIC_FILES", files))
                stack.enter_context(mock.patch.object(module, "PUBLIC_FILE_SET", frozenset(files)))
            self.assertEqual(verify_site.verify_site(self.root).errors, [])

    def test_link_to_existing_private_file_is_rejected(self):
        (self.root / "private.md").write_text("Not for deployment", encoding="utf-8")
        self.rewrite("index.html", "docs.html#details", "private.md")
        self.assert_issue("target is not a published asset")

    def test_missing_cross_page_anchor_is_rejected(self):
        self.rewrite("index.html", "docs.html#details", "docs.html#missing")
        self.assert_issue("missing anchor #missing")

    def test_encoded_anchor_and_query_string_are_supported(self):
        self.rewrite("index.html", "docs.html#details", "docs.html?v=3#%64etails")
        self.assertEqual(verify_site.verify_site(self.root).errors, [])

    def test_local_css_urls_and_imports_are_checked(self):
        self.rewrite("styles.css", "/logo.svg?v=1", "/missing.svg")
        self.assert_issue("CSS url='/missing.svg'")
        self.assertEqual(verify_site.css_urls('/* url(missing) */ @import "other.css"; a {mask: url(icon.svg)}'), ["icon.svg", "other.css"])

    def test_duplicate_ids_and_missing_accessibility_targets_are_rejected(self):
        self.rewrite("index.html", '<main id="main">', '<button aria-controls="missing">Open</button><div id="main"></div><main id="main">')
        self.assert_issue("duplicate anchor/id 'main'")
        self.assert_issue("aria-controls points to missing id 'missing'")

    def test_broken_jsonld_is_rejected(self):
        self.rewrite("index.html", '"@type":"WebPage"', '"@type":NaN')
        self.assert_issue("invalid JSON-LD")

    def test_missing_metadata_and_incorrect_canonical_are_rejected(self):
        self.rewrite("index.html", 'name="description"', 'name="unused"')
        self.rewrite("index.html", 'rel="canonical" href="https://balhence.com/"', 'rel="canonical" href="https://example.com/"')
        self.assert_issue("expected one non-empty description")
        self.assert_issue("expected exactly one canonical URL")

    def test_noindex_pages_are_excluded_from_sitemap(self):
        self.rewrite("sitemap.xml", "</urlset>", '<url><loc>https://balhence.com/404.html</loc></url></urlset>')
        self.assert_issue("URL is not an indexable public page")

    def test_manifest_icon_must_be_published(self):
        self.rewrite("site.webmanifest", "/logo.svg", "/missing-icon.png")
        self.assert_issue("icon='/missing-icon.png'")

    def test_artifact_mode_rejects_extra_files_and_empty_directories(self):
        (self.root / "private.txt").write_text("private", encoding="utf-8")
        (self.root / "backups").mkdir()
        self.assert_issue("unapproved path: private.txt", artifact=True)
        self.assert_issue("unapproved path: backups", artifact=True)

    def test_javascript_links_are_rejected(self):
        self.rewrite("index.html", "docs.html#details", "javascript:alert(1)")
        self.assert_issue("javascript URLs are not permitted")


class PreviewTests(SiteFixture):
    def test_public_assets_and_protected_paths_have_expected_http_behavior(self):
        self.assertEqual(verify_site.verify_preview(self.root), [])

    def test_preview_denies_linked_files_and_linked_custom_error_document(self):
        import functools
        import http.client
        import threading
        from http.server import ThreadingHTTPServer

        outside = self.workspace / "secret.txt"
        outside.write_text("sensitive-file-content", encoding="utf-8")
        for name in ("app.js", "404.html"):
            (self.root / name).unlink()
            (self.root / name).symlink_to(outside)
        directory = self.root / ".well-known"
        directory.rename(self.root / "other-assets")
        directory.symlink_to(self.root / "other-assets", target_is_directory=True)

        class QuietHandler(serve.PreviewHandler):
            def log_message(self, format, *args):
                pass

        server = ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(QuietHandler, directory=str(self.root)))
        thread = threading.Thread(target=server.serve_forever, kwargs={"poll_interval": 0.05}, daemon=True)
        thread.start()
        connection = http.client.HTTPConnection("127.0.0.1", server.server_port, timeout=5)
        try:
            for path in ("/app.js", "/missing", "/.well-known/security.txt"):
                connection.request("GET", path)
                response = connection.getresponse()
                body = response.read()
                self.assertEqual(response.status, 404)
                self.assertNotIn(b"sensitive-file-content", body)
        finally:
            connection.close()
            server.shutdown()
            thread.join(timeout=2)
            server.server_close()


if __name__ == "__main__":
    unittest.main()
