#!/usr/bin/env python3
"""Check the public static site using only Python's standard library.

Validates first-party ASCII text, files and local URLs, HTML anchors and metadata,
JSON-LD, the sitemap, and manifest. --preview also exercises the actual allowlisted
HTTP handler on an ephemeral loopback port. External links are not fetched.
"""

from __future__ import annotations

import argparse
import functools
import http.client
import json
import mimetypes
import re
import threading
import xml.etree.ElementTree as ET
from collections import Counter
from dataclasses import dataclass, field
from html import unescape
from html.parser import HTMLParser
from http.server import ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urljoin, urlsplit

from build_public import PUBLIC_FILES, PUBLIC_FILE_SET, SOURCE_ROOT, validate_sources
from serve import PreviewHandler


ORIGIN = "https://balhence.com"
CSS_URL = re.compile(r"url\(\s*(?:\"([^\"]*)\"|'([^']*)'|([^\s)]+))\s*\)", re.I)
CSS_IMPORT = re.compile(r"@import\s+['\"]([^'\"]+)['\"]", re.I)
PUBLIC_TEXT_SUFFIXES = {".html", ".js", ".css", ".svg", ".xml", ".txt", ".webmanifest"}
HTML_ENTITY = re.compile(r"&(?:#[xX][0-9a-fA-F]+|#[0-9]+|[a-zA-Z][a-zA-Z0-9]*);?")


def checks_ascii(relative: str) -> bool:
    """Check our published text, without rewriting dependencies or licenses."""
    path = Path(relative)
    return (
        path.suffix.lower() in PUBLIC_TEXT_SUFFIXES
        and "vendor" not in path.parts
        and not path.name.upper().startswith(("LICENSE", "LICENCE", "COPYING", "NOTICE"))
    )


class EncodedCharacters(HTMLParser):
    """Locate non-ASCII entities where a browser decodes markup characters."""

    def __init__(self, source: str):
        super().__init__(convert_charrefs=False)
        self.characters: list[tuple[int, int, str, str]] = []
        self.feed(source)
        self.close()

    def record(self, entity: str, line: int, column: int):
        for character in unescape(entity):
            if ord(character) > 127:
                self.characters.append((line, column + 1, character, "HTML entity renders"))

    def handle_entityref(self, name):
        self.record(f"&{name};", *self.getpos())

    def handle_charref(self, name):
        self.record(f"&#{name};", *self.getpos())

    def handle_starttag(self, tag, attrs):
        # Attribute values are decoded even with convert_charrefs=False. Use the
        # original tag to retain exact source positions, including multiline tags.
        raw = self.get_starttag_text()
        line, column = self.getpos()
        for match in HTML_ENTITY.finditer(raw):
            prefix = raw[:match.start()]
            offset = prefix.count("\n")
            entity_column = len(prefix.rsplit("\n", 1)[-1]) if offset else column + len(prefix)
            self.record(match.group(), line + offset, entity_column)


def ascii_issues(relative: str, source: str) -> list[str]:
    """Report bounded, actionable diagnostics, leaving JS/CSS escapes as code."""
    characters = [
        (line, column, character, "source contains")
        for line, text in enumerate(source.split("\n"), 1)
        for column, character in enumerate(text, 1)
        if ord(character) > 127
    ]
    if Path(relative).suffix.lower() in {".html", ".svg", ".xml"}:
        characters.extend(EncodedCharacters(source).characters)
    issues = []
    seen = set()
    for line, column, character, kind in sorted(characters):
        key = (line, character, kind)
        if key in seen:
            continue
        seen.add(key)
        if len(issues) < 12:
            issues.append(f"{relative}:{line}:{column}: {kind} non-ASCII U+{ord(character):04X}")
    if len(seen) > len(issues):
        issues.append(f"{relative}: {len(seen) - len(issues)} more non-ASCII line/codepoint occurrences")
    return issues


def css_urls(source: str) -> list[str]:
    source = re.sub(r"/\*.*?\*/", "", source, flags=re.S)
    return [next(value for value in match.groups() if value is not None) for match in CSS_URL.finditer(source)] + CSS_IMPORT.findall(source)


def strict_json(source: str):
    def pairs(items):
        result = {}
        for key, value in items:
            if key in result:
                raise ValueError(f"duplicate JSON key: {key}")
            result[key] = value
        return result

    def invalid_constant(value):
        raise ValueError(f"invalid JSON constant: {value}")

    return json.loads(source, object_pairs_hook=pairs, parse_constant=invalid_constant)


class Document(HTMLParser):
    def __init__(self, source: str):
        super().__init__(convert_charrefs=True)
        self.ids: Counter[str] = Counter()
        self.references: list[tuple[str, str, int]] = []
        self.id_references: list[tuple[str, str, int]] = []
        self.meta: dict[str, list[str]] = {}
        self.canonicals: list[str] = []
        self.structured_data: list[str] = []
        self.title: list[str] = []
        self.title_count = 0
        self.h1_count = 0
        self.lang = ""
        self.doctype = False
        self.charset = False
        self.has_base = False
        self._in_title = False
        self._json: list[str] | None = None
        self._css: list[str] | None = None
        self.feed(source)
        self.close()

    def handle_decl(self, decl):
        if decl.lower() == "doctype html":
            self.doctype = True

    def handle_starttag(self, tag, attrs):
        values = dict(attrs)
        line = self.getpos()[0]
        if values.get("id"):
            self.ids[values["id"]] += 1
        if tag == "a" and values.get("name"):
            self.ids[values["name"]] += 1
        if tag == "html":
            self.lang = values.get("lang", "")
        if tag == "h1":
            self.h1_count += 1
        if tag == "title":
            self.title_count += 1
            self._in_title = True
        if tag == "meta":
            key = (values.get("name") or values.get("property") or "").lower()
            if key:
                self.meta.setdefault(key, []).append(values.get("content", ""))
            self.charset |= values.get("charset", "").lower() == "utf-8"
            if key in {"og:image", "twitter:image", "og:url"}:
                self.references.append((key, values.get("content", ""), line))
        if tag == "base":
            self.has_base = True
        if tag == "link" and "canonical" in values.get("rel", "").lower().split():
            self.canonicals.append(values.get("href", ""))
        for attribute in ("href", "src", "poster", "action"):
            if attribute in values and values[attribute] is not None:
                self.references.append((attribute, values[attribute], line))
        if tag == "object" and values.get("data"):
            self.references.append(("data", values["data"], line))
        if values.get("srcset") and not values["srcset"].lstrip().startswith("data:"):
            for candidate in values["srcset"].split(","):
                if candidate.strip():
                    self.references.append(("srcset", candidate.strip().split()[0], line))
        for attribute in ("aria-controls", "aria-labelledby", "aria-describedby", "for"):
            for identifier in values.get(attribute, "").split():
                self.id_references.append((attribute, identifier, line))
        for url in css_urls(values.get("style", "")):
            self.references.append(("style url", url, line))
        if tag == "script" and values.get("type", "").lower() == "application/ld+json":
            self._json = []
        if tag == "style":
            self._css = []

    def handle_endtag(self, tag):
        if tag == "title":
            self._in_title = False
        if tag == "script" and self._json is not None:
            self.structured_data.append("".join(self._json))
            self._json = None
        if tag == "style" and self._css is not None:
            for url in css_urls("".join(self._css)):
                self.references.append(("style url", url, self.getpos()[0]))
            self._css = None

    def handle_data(self, data):
        if self._in_title:
            self.title.append(data)
        if self._json is not None:
            self._json.append(data)
        if self._css is not None:
            self._css.append(data)

    def value(self, key: str) -> str:
        return self.meta.get(key, [""])[0]

    @property
    def indexable(self) -> bool:
        return "noindex" not in self.value("robots").lower()


@dataclass
class Result:
    errors: list[str] = field(default_factory=list)
    pages: int = 0
    references: int = 0


def local_target(source: str, url: str) -> tuple[str, str] | None:
    """Resolve browser-style relative links; return None for external URLs."""
    parsed = urlsplit(url.strip())
    if parsed.scheme.lower() == "javascript":
        raise ValueError("javascript URLs are not permitted")
    absolute = urlsplit(urljoin(f"{ORIGIN}/{source}", url.strip()))
    if (absolute.scheme, absolute.netloc) != ("https", "balhence.com"):
        return None
    path = unquote(absolute.path, errors="strict")
    if "\\" in path or "\x00" in path:
        raise ValueError("invalid local URL path")
    if path == "/":
        path = "/index.html"
    return path.lstrip("/"), unquote(absolute.fragment, errors="strict")


def verify_site(root: Path, *, artifact: bool = False) -> Result:
    result = Result()
    try:
        validate_sources(root)
    except SystemExit as error:
        result.errors.append(str(error))
        return result

    if artifact:
        expected_paths = set(PUBLIC_FILE_SET)
        for relative in PUBLIC_FILES:
            expected_paths.update(str(parent) for parent in Path(relative).parents if str(parent) != ".")
        actual_paths = {path.relative_to(root).as_posix() for path in root.rglob("*")}
        for extra in sorted(actual_paths - expected_paths):
            result.errors.append(f"artifact contains an unapproved path: {extra}")

    for relative in PUBLIC_FILES:
        if checks_ascii(relative):
            try:
                source = (root / relative).read_text(encoding="utf-8")
                result.errors.extend(ascii_issues(relative, source))
            except (OSError, UnicodeError, ValueError) as error:
                result.errors.append(f"{relative}: unable to check ASCII text: {error}")

    documents: dict[str, Document] = {}
    for relative in PUBLIC_FILES:
        if relative.endswith(".html"):
            try:
                documents[relative] = Document((root / relative).read_text(encoding="utf-8"))
            except (OSError, UnicodeError, ValueError) as error:
                result.errors.append(f"{relative}: unable to parse HTML: {error}")
    result.pages = len(documents)

    def reference(source: str, attribute: str, url: str, line: int = 1):
        result.references += 1
        location = f"{source}:{line} {attribute}={url!r}"
        try:
            target = local_target(source, url)
        except (UnicodeError, ValueError) as error:
            result.errors.append(f"{location}: {error}")
            return
        if target is None:
            return
        path, fragment = target
        if path not in PUBLIC_FILE_SET:
            result.errors.append(f"{location}: target is not a published asset ({path})")
        elif fragment and path in documents:
            # Text-fragment directives do not refer to an HTML id.
            identifier = fragment.split(":~:", 1)[0]
            if identifier and identifier not in documents[path].ids:
                result.errors.append(f"{location}: missing anchor #{identifier} in {path}")

    indexable_urls = set()
    titles: dict[str, str] = {}
    for relative, document in documents.items():
        def problem(message):
            result.errors.append(f"{relative}: {message}")

        if not document.doctype or not document.lang or not document.charset:
            problem("HTML needs a doctype, language, and UTF-8 charset")
        if document.title_count != 1 or not "".join(document.title).strip():
            problem("expected one non-empty document title")
        if document.h1_count != 1:
            problem(f"expected one h1; found {document.h1_count}")
        if "width=device-width" not in document.value("viewport"):
            problem("missing responsive viewport")
        if document.has_base:
            problem("base elements are unsupported; use explicit site-relative URLs")
        for identifier, count in document.ids.items():
            if count > 1:
                problem(f"duplicate anchor/id {identifier!r}")
        for attribute, identifier, line in document.id_references:
            if identifier not in document.ids:
                problem(f"line {line}: {attribute} points to missing id {identifier!r}")
        for attribute, url, line in document.references:
            reference(relative, attribute, url, line)
        if document.indexable:
            canonical = f"{ORIGIN}/" + ("" if relative == "index.html" else relative)
            indexable_urls.add(canonical)
            if document.canonicals != [canonical]:
                problem(f"expected exactly one canonical URL: {canonical}")
            for key in ("description", "og:title", "og:description", "og:url", "og:image", "twitter:card"):
                if len(document.meta.get(key, [])) != 1 or not document.value(key).strip():
                    problem(f"expected one non-empty {key} meta tag")
            if document.value("og:url") != canonical:
                problem("og:url must match the canonical URL")
            title = "".join(document.title).strip()
            if title in titles:
                problem(f"duplicate title also used by {titles[title]}")
            titles[title] = relative
            if not document.structured_data:
                problem("missing JSON-LD structured data")
        for block in document.structured_data:
            try:
                data = strict_json(block)
                items = data if isinstance(data, list) else [data]
                if not items or not all(isinstance(item, dict) and "@context" in item and ("@type" in item or "@graph" in item) for item in items):
                    raise ValueError("expected schema objects with @context and @type or @graph")
            except (ValueError, TypeError) as error:
                problem(f"invalid JSON-LD: {error}")

    for relative in PUBLIC_FILES:
        if relative.endswith(".css"):
            for url in css_urls((root / relative).read_text(encoding="utf-8")):
                reference(relative, "CSS url", url)

    try:
        sitemap = ET.parse(root / "sitemap.xml")
        urls = [node.text or "" for node in sitemap.findall("{http://www.sitemaps.org/schemas/sitemap/0.9}url/{http://www.sitemaps.org/schemas/sitemap/0.9}loc")]
        if len(urls) != len(set(urls)):
            result.errors.append("sitemap.xml: duplicate URLs")
        for missing in sorted(indexable_urls - set(urls)):
            result.errors.append(f"sitemap.xml: missing indexable page {missing}")
        for extra in sorted(set(urls) - indexable_urls):
            result.errors.append(f"sitemap.xml: URL is not an indexable public page: {extra}")
    except (OSError, ET.ParseError) as error:
        result.errors.append(f"sitemap.xml: {error}")

    try:
        manifest = strict_json((root / "site.webmanifest").read_text(encoding="utf-8"))
        if not isinstance(manifest, dict) or not manifest.get("name") or not manifest.get("start_url"):
            raise ValueError("expected a manifest name and start_url")
        reference("site.webmanifest", "start_url", manifest["start_url"])
        for icon in manifest.get("icons", []):
            reference("site.webmanifest", "icon", icon["src"])
        for shortcut in manifest.get("shortcuts", []):
            reference("site.webmanifest", "shortcut", shortcut["url"])
    except (OSError, ValueError, TypeError, KeyError, AttributeError) as error:
        result.errors.append(f"site.webmanifest: {error}")
    if (root / "CNAME").read_text(encoding="utf-8").strip() != "balhence.com":
        result.errors.append("CNAME must match canonical origin balhence.com")
    if f"Sitemap: {ORIGIN}/sitemap.xml" not in (root / "robots.txt").read_text(encoding="utf-8"):
        result.errors.append("robots.txt: missing canonical sitemap declaration")
    return result


def verify_preview(root: Path) -> list[str]:
    class QuietHandler(PreviewHandler):
        def log_message(self, format, *args):
            pass

    handler = functools.partial(QuietHandler, directory=str(root))
    server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
    thread = threading.Thread(target=server.serve_forever, kwargs={"poll_interval": 0.05}, daemon=True)
    thread.start()
    errors = []
    connection = http.client.HTTPConnection("127.0.0.1", server.server_port, timeout=5)
    try:
        requests = [("GET", "/", 200)] + [("GET", f"/{relative}", 200) for relative in PUBLIC_FILES]
        requests += [("HEAD", "/index.html", 200), ("HEAD", "/missing-page", 404)]
        requests += [("GET", path, 404) for path in (
            "/.git/config", "/.env", "/build_public.py", "/serve.py", "/verify_site.py",
            "/README.md", "/SEO-GROWTH.md", "/tests/test_site.py", "/website/index.html",
            "/website-tools/", "/website-backups/", "/vendor/", "/insights/",
            "/../index.html", "/%2e%2e/index.html", "/%252e%252e/index.html",
            "/vendor/../index.html", "/%2egit/config", "/index.html%00", "/%5cindex.html",
            "http://example.invalid/index.html", "http://[invalid/index.html",
        )]
        for method, path, expected in requests:
            # Supply Host explicitly so malformed absolute request targets are
            # sent to the loopback handler, rather than rejected by the client.
            connection.putrequest(method, path, skip_host=True)
            connection.putheader("Host", f"127.0.0.1:{server.server_port}")
            connection.endheaders()
            response = connection.getresponse()
            body = response.read()
            if response.status != expected:
                errors.append(f"preview {method} {path}: expected {expected}, got {response.status}")
            if response.getheader("X-Content-Type-Options") != "nosniff" or response.getheader("Cache-Control") != "no-store":
                errors.append(f"preview {path}: missing defensive/cache headers")
            expected_frame = "SAMEORIGIN" if path.endswith(".pdf") else "DENY"
            if response.getheader("X-Frame-Options") != expected_frame:
                errors.append(f"preview {path}: incorrect frame policy")
            if method == "HEAD" and body:
                errors.append(f"preview HEAD {path}: response must not include a body")
            if method == "GET" and expected == 200:
                asset = root / ("index.html" if path == "/" else path.lstrip("/"))
                if body != asset.read_bytes():
                    errors.append(f"preview {path}: response differs from the public asset")
                expected_type = mimetypes.guess_type(str(asset))[0]
                actual_type = response.getheader("Content-Type", "").split(";", 1)[0]
                if expected_type and actual_type != expected_type:
                    errors.append(f"preview {path}: expected MIME type {expected_type}, got {actual_type}")
            if method == "GET" and expected == 404 and body != (root / "404.html").read_bytes():
                errors.append(f"preview {path}: expected the custom 404 document")
    except (OSError, http.client.HTTPException) as error:
        errors.append(f"preview HTTP check failed: {error}")
    finally:
        connection.close()
        server.shutdown()
        thread.join(timeout=2)
        server.server_close()
    return errors


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=SOURCE_ROOT, help="Site source or built artifact directory")
    parser.add_argument("--artifact", action="store_true", help="Require exactly the public allowlist, with no extra files or directories")
    parser.add_argument("--preview", action="store_true", help="Also check public/protected URLs over local HTTP")
    args = parser.parse_args()
    root = args.root.expanduser().resolve()
    result = verify_site(root, artifact=args.artifact)
    if args.preview and not result.errors:
        result.errors.extend(verify_preview(root))
    if result.errors:
        for error in result.errors:
            print(f"FAIL {error}")
        raise SystemExit(f"Site verification failed: {len(result.errors)} issue(s).")
    suffix = " and HTTP preview" if args.preview else ""
    print(f"Verified {result.pages} HTML pages, {result.references} URL references, {len(PUBLIC_FILES)} allowlisted files{suffix}.")


if __name__ == "__main__":
    main()
