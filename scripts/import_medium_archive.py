#!/usr/bin/env python3
"""Build Balhence's first-party research library from the author's public RSS feed.

The generated pages preserve the authored text and original publication metadata.
Platform tracking pixels and RSS-only publication footer sentences are excluded. Images
uploaded with the stories are copied locally; third-party embeds remain lazy-loaded.
"""

from __future__ import annotations

import argparse
import hashlib
import html
import io
import json
import re
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

try:
    from bs4 import BeautifulSoup
    from PIL import Image
except ImportError as error:  # pragma: no cover - maintainer-only utility
    raise SystemExit("Beautiful Soup 4 and Pillow are required for the archive importer") from error


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_FEED = "https://medium.com/feed/@hetroublehacker"
CONTENT_NAMESPACE = "http://purl.org/rss/1.0/modules/content/"
DC_NAMESPACE = "http://purl.org/dc/elements/1.1/"
LOCAL_MODIFIED = "2026-11-06"


@dataclass(frozen=True)
class Post:
    post_id: str
    slug: str
    canonical: str
    published: str
    modified: str
    seo_title: str
    description: str
    related_url: str
    related_label: str

    @property
    def output(self) -> str:
        return f"research/{self.slug}.html"


POSTS = (
    Post(
        "272b46f66907",
        "dependency-confusion",
        "https://hetroublehacker.medium.com/how-i-approached-dependency-confusion-272b46f66907",
        "2022-01-31T17:10:25Z",
        "2022-01-31T17:10:25Z",
        "Dependency Confusion Bug Bounty Methodology | Balhence",
        "Learn how Aditya Soni identified unclaimed npm package names and validated dependency confusion findings using GitHub search, Bash, and httpx.",
        "/web-application-penetration-testing.html",
        "Web application penetration testing",
    ),
    Post(
        "1900aeef79f6",
        "cve-2020-28726",
        "https://hetroublehacker.medium.com/assigned-my-first-cve-2020-28726-1900aeef79f6",
        "2020-12-09T12:39:26Z",
        "2020-12-09T12:39:26Z",
        "CVE-2020-28726 Vulnerability Research | Balhence",
        "A first-hand account of discovering and disclosing CVE-2020-28726 in SeedDMS, from HTML injection to an open redirect proof of impact.",
        "/web-application-penetration-testing.html",
        "Web application penetration testing",
    ),
    Post(
        "b963bffb36cd",
        "first-bounty-target",
        "https://infosecwriteups.com/the-first-bounty-target-disclosing-multiple-reports-b963bffb36cd",
        "2020-11-21T22:22:40Z",
        "2020-11-21T22:22:40Z",
        "Bug Bounty Case Studies: Seven Findings | Balhence",
        "Seven practical bug bounty case studies covering authorization, session management, CSRF, open redirects, IDOR, and password reset behavior.",
        "/blog.html",
        "Current penetration testing guides",
    ),
    Post(
        "27f622bc47c0",
        "tale-of-my-first-xss",
        "https://infosecwriteups.com/tale-of-my-first-xss-27f622bc47c0",
        "2020-05-26T20:09:06Z",
        "2020-05-26T20:09:06Z",
        "My First XSS Bug Bounty Finding | Balhence",
        "A first-hand XSS bug bounty story covering parameter discovery, fuzzing, validation, and lessons learned from an established program.",
        "/web-application-penetration-testing.html",
        "Web application penetration testing",
    ),
    Post(
        "7080e48df8b4",
        "http-request-smuggling-plain-english",
        "https://medium.com/cyberverse/http-request-smuggling-in-plain-english-7080e48df8b4",
        "2020-04-13T20:06:28Z",
        "2020-04-13T20:06:28Z",
        "HTTP Request Smuggling Explained: CL.TE vs TE.CL | Balhence",
        "A plain-English guide to HTTP request smuggling, including Content-Length, Transfer-Encoding, CL.TE, TE.CL, and practical testing references.",
        "/web-application-penetration-testing.html",
        "Web application penetration testing",
    ),
    Post(
        "58d3a9946225",
        "inspect-element-bounty",
        "https://infosecwriteups.com/how-inspect-element-got-me-a-bounty-58d3a9946225",
        "2020-02-06T19:47:28Z",
        "2020-04-20T20:44:44Z",
        "Inspect Element and Server-Side Validation | Balhence",
        "How bypassing a disabled form field exposed missing server-side validation and led to a valid bug bounty report.",
        "/insights/server-owned-validation-rules.html",
        "When validation rules belong on the server",
    ),
    Post(
        "472c67f1cb46",
        "crlf-injection-playbook",
        "https://medium.com/cyberverse/crlf-injection-playbook-472c67f1cb46",
        "2020-01-12T10:58:20Z",
        "2020-01-12T11:07:45Z",
        "CRLF Injection Testing Playbook | Balhence",
        "A CRLF injection testing playbook based on public reports, including response splitting, XSS chains, open redirects, payloads, and mitigations.",
        "/web-application-penetration-testing.html",
        "Web application penetration testing",
    ),
    Post(
        "438596ff72f5",
        "bug-bounty-with-bash",
        "https://medium.com/cyberverse/bug-bounty-with-bash-438596ff72f5",
        "2020-01-05T22:16:21Z",
        "2020-01-05T22:16:21Z",
        "Bug Bounty Automation with Bash | Balhence",
        "Practical Bash workflows for bug bounty reconnaissance, subdomain enumeration, takeover checks, CORS testing, and repeatable automation.",
        "/blog.html",
        "Current penetration testing guides",
    ),
    Post(
        "22cdcc829976",
        "find-secret-api-keys",
        "https://medium.com/cyberverse/find-secret-api-keys-22cdcc829976",
        "2019-12-22T11:36:26Z",
        "2019-12-22T15:48:34Z",
        "How to Find Exposed API Keys | Balhence",
        "A practical guide to finding exposed API keys in JavaScript and public assets using search patterns, reconnaissance tools, and manual validation.",
        "/api-penetration-testing.html",
        "API penetration testing",
    ),
    Post(
        "2b3dbe9fa0b8",
        "automating-burp-idor",
        "https://medium.com/cyberverse/automating-burp-to-find-idors-2b3dbe9fa0b8",
        "2019-12-12T07:53:36Z",
        "2019-12-12T07:53:36Z",
        "Automating IDOR Testing in Burp Suite | Balhence",
        "A practical Burp Suite workflow for IDOR testing with Autorize and AutoRepeater, including session comparison and identifier replacement.",
        "/api-penetration-testing.html",
        "API penetration testing",
    ),
)

ALLOWED_SOURCE_ATTRIBUTES = {
    "a": {"href"},
    "blockquote": set(),
    "br": set(),
    "em": set(),
    "figcaption": set(),
    "figure": set(),
    "h3": set(),
    "h4": set(),
    "hr": set(),
    "iframe": {"frameborder", "height", "scrolling", "src", "width"},
    "img": {"alt", "height", "src", "width"},
    "li": set(),
    "ol": set(),
    "p": set(),
    "pre": set(),
    "strong": set(),
    "ul": set(),
}

ALT_TEXT = {
    "272b46f66907": {
        1: "Handwritten Dependency Confusion title illustration.",
        2: "Python, npm, and Ruby package ecosystem logos.",
        3: "package.json screenshot highlighting the azuretestpackage dependency.",
        4: "npm package page showing a 404 not found response for azuretestpackage.",
        5: "Nuclei terminal output listing discovered package.json URLs, with targets redacted.",
        6: "GitHub organization code search for package.json files, filtered to JSON results.",
        7: "WebPaste Chrome extension snippet named GitHub Org Results, with JavaScript for collecting repository links.",
        8: "Terminal cloning repositories from a GitHub organization, with identifying details redacted.",
        9: "Terminal output showing registry.npmjs.org dependency checks and 404 status codes.",
        10: "Redacted bug bounty award notifications for validated dependency confusion reports.",
        11: "GitHub sponsorship confirmation thanking TomNomNom for open-source tools.",
    },
    "1900aeef79f6": {
        1: "NVD entry for CVE-2020-28726 showing a CVSS 3.x base score of 6.1 Medium.",
        2: "HTTP request and response showing a meta refresh payload reflected through the SeedDMS dropfolderfileform1 parameter.",
    },
    "b963bffb36cd": {
        1: "Multiple Bug Bounty Reports - The First Bounty Target title card.",
        2: "Table summarizing seven bug reports, severities, bounty amounts, and closure dates.",
        3: "Redacted HTTP request to delete a cart product, highlighting the redirect parameter in the body.",
        4: "Redacted HTTP request to a track-order endpoint, highlighting mobile number and order ID parameters.",
        5: "Redacted HTTP request to an order-history endpoint, highlighting the intOrderId parameter.",
    },
    "27f622bc47c0": {
        1: "Browser alert dialog showing the text YourFriendlyNeighbourhoodHacker on the tested page.",
    },
    "7080e48df8b4": {
        1: "HTTP Request Smuggling title illustration.",
        2: "Annotated chunked Transfer-Encoding request showing hexadecimal chunk sizes and the terminating zero.",
        3: "Decimal-to-hex converter showing 30 decimal as 1E hexadecimal.",
        4: "Annotated Content-Length request showing how CRLF characters and a final G total six bytes.",
        5: "CL.TE request-smuggling diagram showing unprocessed data beginning a second request.",
        6: "TE.CL request-smuggling diagram showing conflicting headers and leftover junk data.",
    },
    "58d3a9946225": {
        1: "",
        2: "Account details form showing the mobile number and email fields disabled.",
        3: "Browser developer tools showing the disabled attribute removed from the mobile number field.",
        4: "Confirmation banner reading Updated Successfully.",
    },
    "472c67f1cb46": {
        1: "CRLF title graphic expanding the acronym as Carriage Return and Line Feed HTTP Response Splitting.",
        2: "HackerOne Hacktivity search showing 59 results for CRLF injection.",
        3: "Google site search showing about 80 HackerOne report results for CRLF.",
        4: "Browser tab strip filled with open CRLF injection reports.",
        5: "Pie chart of 80 CRLF reports: 17 normal CRLF, 35 chained with XSS, and 28 open redirects.",
    },
    "438596ff72f5": {
        1: "Bash and Bug Bounty title card over a terminal background.",
        2: "Bash script by TomNomNom that checks CORS response headers for supplied origins.",
    },
    "22cdcc829976": {
        1: "Find Secret API Key title illustration over a map with a key icon.",
    },
    "2b3dbe9fa0b8": {
        1: "IDOR Insecure Direct Object Reference title graphic.",
        2: "Burp Suite BApp Store showing the Autorize and AutoRepeater extensions.",
        3: "Autorize configuration panel with a secondary user's cookie and interception filters.",
        4: "Autorize results table comparing original and modified request responses.",
        5: "Burp AutoRepeater Add Replacement dialog configured to replace a UUID.",
        6: "AutoRepeater Add Replacement dialog configured to replace a Referer header with a blind XSS payload.",
    },
}

# Two legacy Medium embed records currently render no content on the canonical
# page and their redirect records return 404. Keep the decision explicit so a
# new empty embed cannot disappear silently.
EMPTY_EMBEDS_WITH_NO_RENDERED_CONTENT = {
    "f1fa664ca2c1721279b4f31ff6ffcf28",
    "f56db29d7f0a0e4949368016637a938f",
}

DEPENDENCY_ONE_LINER_MEDIA_ID = "2ef920021c6845811eb3d2a3298ef24d"
DEPENDENCY_ONE_LINER_URL = "https://gist.github.com/hetroublehacker/c4a0d4e994e63092d8c9efbc03bcf5e2"
DEPENDENCY_ONE_LINER = '''find . -type f -name package.json | xargs -n1 -I{} cat {} | jq -r '.dependencies + .devDependencies' | cut -d : -f 1 | tr -d '"|}|{' | sort -u | tr -s "     " | sort -u | xargs -n1 -I{} echo "https://registry.npmjs.org/{}" | grep -v "@" | httpx -status-code -silent -content-length -mc 404'''


def arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--feed", type=Path, help="Use a previously downloaded Medium RSS file")
    parser.add_argument(
        "--update-manifest",
        action="store_true",
        help="Replace the reviewed source lock after intentionally reviewing upstream changes",
    )
    return parser.parse_args()


def get_feed(path: Path | None) -> bytes:
    if path:
        return path.read_bytes()
    request = urllib.request.Request(DEFAULT_FEED, headers={"User-Agent": "BalhenceArchive/1.0"})
    with urllib.request.urlopen(request, timeout=30) as response:
        return response.read()


def normalized_text(node) -> str:
    # Encoded iframe fallback markup is transport data, not rendered article
    # prose. Excluding it makes the fidelity hash describe what readers see.
    copy = BeautifulSoup(str(node), "html.parser")
    for iframe in copy.find_all("iframe"):
        iframe.decompose()
    return re.sub(r"\s+", " ", copy.get_text(" ", strip=True)).strip()


def text_hash(node) -> str:
    return hashlib.sha256(normalized_text(node).encode("utf-8")).hexdigest()


def clean_canonical(url: str) -> str:
    parts = urllib.parse.urlsplit(url)
    return urllib.parse.urlunsplit((parts.scheme, parts.netloc, parts.path, "", ""))


def assert_safe_source(soup, post: Post) -> None:
    """Fail closed when Medium adds markup the importer has not reviewed."""
    for node in soup.find_all(True):
        if node.name not in ALLOWED_SOURCE_ATTRIBUTES:
            raise RuntimeError(f"Unexpected tag in {post.post_id}: <{node.name}>")
        unexpected = set(node.attrs) - ALLOWED_SOURCE_ATTRIBUTES[node.name]
        if unexpected:
            raise RuntimeError(f"Unexpected attributes in {post.post_id} <{node.name}>: {sorted(unexpected)}")


def medium_media_id(iframe) -> str:
    match = re.search(r"medium\.com/media/([a-f0-9]+)/href", iframe.get_text(" ", strip=True))
    return match.group(1) if match else ""


def resolve_empty_embed(iframe, post: Post) -> None:
    media_id = medium_media_id(iframe)
    if post.post_id == "272b46f66907" and media_id == DEPENDENCY_ONE_LINER_MEDIA_ID:
        wrapper = BeautifulSoup("<figure></figure>", "html.parser").figure
        code = BeautifulSoup("<pre></pre>", "html.parser").pre
        code.string = DEPENDENCY_ONE_LINER
        source = BeautifulSoup("<figcaption></figcaption>", "html.parser").figcaption
        link = BeautifulSoup("<a></a>", "html.parser").a
        link["href"] = DEPENDENCY_ONE_LINER_URL
        link["rel"] = "noopener noreferrer"
        link.string = "View the original GitHub Gist"
        source.append(link)
        wrapper.extend((code, source))
        iframe.replace_with(wrapper)
        return
    if media_id in EMPTY_EMBEDS_WITH_NO_RENDERED_CONTENT:
        iframe.decompose()
        return
    raise RuntimeError(f"Unresolved empty Medium embed in {post.post_id}: {media_id or 'missing media id'}")


def image_extension(url: str, content_type: str) -> str:
    suffix = Path(urllib.parse.urlsplit(url).path).suffix.lower()
    if suffix in {".png", ".jpg", ".jpeg", ".gif", ".webp"}:
        return suffix
    return {
        "image/png": ".png",
        "image/jpeg": ".jpg",
        "image/gif": ".gif",
        "image/webp": ".webp",
    }.get(content_type.split(";", 1)[0].lower(), ".img")


def copy_image(url: str, post: Post, number: int) -> tuple[str, int, int]:
    # RSS uses resized /max/N/ variants. Medium's stable CDN also exposes the
    # uploaded original at the same path without that transform.
    original_url = re.sub(r"/max/\d+/", "/", url)
    request = urllib.request.Request(original_url, headers={"User-Agent": "BalhenceArchive/1.0"})
    try:
        with urllib.request.urlopen(request, timeout=45) as response:
            payload = response.read()
            content_type = response.headers.get("Content-Type", "application/octet-stream")
    except Exception:
        request = urllib.request.Request(url, headers={"User-Agent": "BalhenceArchive/1.0"})
        with urllib.request.urlopen(request, timeout=45) as response:
            payload = response.read()
            content_type = response.headers.get("Content-Type", "application/octet-stream")
    if not content_type.lower().startswith("image/"):
        raise RuntimeError(f"Medium asset is not an image: {url} ({content_type})")
    extension = image_extension(url, content_type)
    relative = f"assets/research/{post.post_id}-{number:02d}{extension}"
    destination = ROOT / relative
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_bytes(payload)
    with Image.open(io.BytesIO(payload)) as image:
        width, height = image.size
    return f"/{relative}", width, height


def sanitize_body(raw: str, post: Post):
    soup = BeautifulSoup(raw, "html.parser")
    assert_safe_source(soup, post)

    # Medium injects this sentence into publication RSS, but it is not part of
    # the rendered authored story. Remove it and its adjacent divider.
    for paragraph in list(soup.find_all("p")):
        text = normalized_text(paragraph)
        if text.endswith("on Medium, where people are continuing the conversation by highlighting and responding to this story."):
            previous = paragraph.find_previous_sibling()
            paragraph.decompose()
            if previous and previous.name == "hr":
                previous.decompose()

    # Remove the RSS analytics pixel; it is not editorial media.
    for image in list(soup.find_all("img")):
        source = image.get("src", "")
        if source.startswith("https://medium.com/_/stat"):
            parent = image.parent
            image.decompose()
            if parent and getattr(parent, "name", None) == "figure" and not normalized_text(parent) and not parent.find(True):
                parent.decompose()

    editorial_images = 0
    for image in soup.find_all("img"):
        source = image.get("src", "")
        if not source.startswith(("https://cdn-images-1.medium.com/", "https://miro.medium.com/")):
            raise RuntimeError(f"Unexpected editorial image host in {post.post_id}: {source}")
        editorial_images += 1
        local_source, width, height = copy_image(source, post, editorial_images)
        image["src"] = local_source
        image["width"] = str(width)
        image["height"] = str(height)
        image["loading"] = "lazy"
        image["decoding"] = "async"
        try:
            image["alt"] = ALT_TEXT[post.post_id][editorial_images]
        except KeyError as error:
            raise RuntimeError(f"Missing reviewed alt text for {post.post_id} image {editorial_images}") from error

    for iframe in list(soup.find_all("iframe")):
        source = iframe.get("src", "")
        if not source:
            resolve_empty_embed(iframe, post)
            continue
        if urllib.parse.urlsplit(source).netloc != "cdn.embedly.com":
            raise RuntimeError(f"Unexpected embed host in {post.post_id}: {source}")
        query = urllib.parse.parse_qs(urllib.parse.urlsplit(source).query)
        provider = query.get("display_name", [query.get("schema", ["Embedded"])[0].title()])[0]
        iframe["loading"] = "lazy"
        iframe["title"] = f"{provider} media embedded in the original article"
        iframe["referrerpolicy"] = "strict-origin-when-cross-origin"
        # The RSS fallback is an encoded platform redirect, not visible story
        # content. Keep the working embed while avoiding a stale source-domain
        # URL in Balhence's first-party page markup.
        iframe.clear()

    source_hash = text_hash(soup)
    first_party_articles = {
        clean_canonical(candidate.canonical): f"/{candidate.output}" for candidate in POSTS
    }
    for link in soup.find_all("a"):
        href = link.get("href", "")
        if href and urllib.parse.urlsplit(href).scheme not in {"http", "https", "mailto"}:
            raise RuntimeError(f"Unexpected link scheme in {post.post_id}: {href}")
        source_article = clean_canonical(href) if href.startswith(("http://", "https://")) else ""
        local_article = first_party_articles.get(source_article)
        if not local_article and source_article:
            local_article = next(
                (f"/{candidate.output}" for candidate in POSTS if candidate.post_id in source_article),
                None,
            )
        if local_article:
            link["href"] = local_article
        link["rel"] = "noopener noreferrer"

    expected_images = ALT_TEXT.get(post.post_id, {})
    if set(expected_images) != set(range(1, editorial_images + 1)):
        raise RuntimeError(f"Alt-text inventory does not match images for {post.post_id}")
    if text_hash(soup) != source_hash:
        raise RuntimeError(f"Text changed while sanitizing {post.post_id}")
    return soup, source_hash, editorial_images


def words_and_minutes(node) -> tuple[int, int]:
    words = len(re.findall(r"\b[\w'-]+\b", normalized_text(node), flags=re.UNICODE))
    return words, max(1, round(words / 200))


def date_label(value: str) -> str:
    return datetime.fromisoformat(value.replace("Z", "+00:00")).strftime("%d %B %Y")


def escaped(value: str) -> str:
    return html.escape(value, quote=True)


def json_script(value) -> str:
    return json.dumps(value, ensure_ascii=False, indent=2).replace("</", "<\\/")


def page_html(post: Post, title: str, creator: str, categories: list[str], body, body_hash: str, minutes: int) -> str:
    local_url = f"https://balhence.com/{post.output}"
    lead_image = body.find("img")
    og_image = f"https://balhence.com{lead_image['src']}" if lead_image else "https://balhence.com/og-image.png"
    description = post.description
    tags = " / ".join(categories)
    structured = {
        "@context": "https://schema.org",
        "@graph": [
            {
                "@type": "WebPage",
                "@id": f"{local_url}#webpage",
                "url": local_url,
                "name": title,
                "description": description,
                "datePublished": post.published,
                "dateModified": LOCAL_MODIFIED,
                "inLanguage": "en",
                "mainEntity": {"@id": f"{local_url}#article"},
                "breadcrumb": {"@id": f"{local_url}#breadcrumb"},
            },
            {
                "@type": "BlogPosting",
                "@id": f"{local_url}#article",
                "url": local_url,
                "mainEntityOfPage": {"@id": f"{local_url}#webpage"},
                "headline": title,
                "description": description,
                "datePublished": post.published,
                "dateModified": LOCAL_MODIFIED,
                "inLanguage": "en",
                "image": og_image,
                "keywords": categories,
                "author": {"@id": "https://balhence.com/about.html#researcher"},
                "publisher": {"@id": "https://balhence.com/#organization"},
                "isPartOf": {"@id": "https://balhence.com/blogs.html#bug-bounty-archive"},
            },
            {
                "@type": "BreadcrumbList",
                "@id": f"{local_url}#breadcrumb",
                "itemListElement": [
                    {
                        "@type": "ListItem",
                        "position": 1,
                        "name": "Home",
                        "item": "https://balhence.com/",
                    },
                    {
                        "@type": "ListItem",
                        "position": 2,
                        "name": "Bug Bounty Archive",
                        "item": "https://balhence.com/blogs.html#bug-bounty-archive",
                    },
                    {
                        "@type": "ListItem",
                        "position": 3,
                        "name": title,
                        "item": local_url,
                    },
                ],
            },
            {
                "@type": "Person",
                "@id": "https://balhence.com/about.html#researcher",
                "name": "Aditya Soni",
                "alternateName": "HeTroubleHacker",
                "url": "https://balhence.com/about.html#researcher",
                "sameAs": [
                    "https://www.linkedin.com/in/adtyasoni/",
                    "https://hackerone.com/hetroublehacker",
                    "https://app.intigriti.com/profile/hetroublemak3r",
                    "https://x.com/hetroublehacker",
                ],
            },
            {
                "@type": "Organization",
                "@id": "https://balhence.com/#organization",
                "name": "Balhence",
                "url": "https://balhence.com/",
                "logo": {"@type": "ImageObject", "url": "https://balhence.com/logo.png"},
            },
        ],
    }
    return f'''<!doctype html>
<html lang="en" class="has-article-flow">
<head>
  <meta charset="utf-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' https://www.googletagmanager.com; style-src 'self'; img-src 'self' data: https://*.google-analytics.com; frame-src https://cdn.embedly.com; connect-src 'self' https://formspree.io https://*.google-analytics.com https://www.googletagmanager.com; object-src 'self'; base-uri 'self'; form-action https://formspree.io">
  <meta name="referrer" content="strict-origin-when-cross-origin">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{escaped(post.seo_title)}</title>
  <meta name="description" content="{escaped(description)}">
  <meta name="author" content="{escaped(creator)}">
  <meta name="robots" content="index,follow,max-image-preview:large">
  <link rel="canonical" href="{local_url}">
  <meta name="theme-color" content="#080d1f">
  <meta property="og:type" content="article">
  <meta property="og:site_name" content="Balhence">
  <meta property="og:title" content="{escaped(title)}">
  <meta property="og:description" content="{escaped(description)}">
  <meta property="og:url" content="{local_url}">
  <meta property="og:image" content="{escaped(og_image)}">
  <meta property="article:published_time" content="{post.published}">
  <meta property="article:modified_time" content="{LOCAL_MODIFIED}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="{escaped(title)}">
  <meta name="twitter:description" content="{escaped(description)}">
  <meta name="twitter:image" content="{escaped(og_image)}">
  <link rel="icon" href="/favicon.png" type="image/png" sizes="96x96">
  <link rel="apple-touch-icon" href="/apple-touch-icon.png" sizes="180x180">
  <link rel="manifest" href="/site.webmanifest">
  <link rel="stylesheet" href="/styles.css?v=20261106a">
  <link rel="stylesheet" href="/motion.css?v=20260930b">
  <link rel="stylesheet" href="/flow.css?v=20261001b">
  <link rel="stylesheet" href="/type-field.css?v=20261001f">
  <script async src="/type-field.js?v=20261001f"></script>
  <script type="application/ld+json">
{json_script(structured)}
  </script>
</head>
<body data-page="insights" class="research-archive-post archive-article">
  <a class="skip-link" href="#main-content">Skip to content</a>
  <header class="site-header" data-site-header><nav class="container nav-shell" aria-label="Primary navigation"><a class="brand" href="/" aria-label="Balhence home"><span class="brand-mark" aria-hidden="true">B/</span><span>Balhence</span></a><div class="nav-menu" id="primary-menu" data-menu><ul class="nav-links"><li><a href="/services.html" data-nav="services">Services</a></li><li><details class="nav-solutions" data-solutions-menu><summary>Solutions</summary><ul class="solutions-links"><li><a href="/compliance-penetration-testing.html">Compliance testing</a></li><li><a href="/soc-2-penetration-testing.html">SOC 2 penetration testing</a></li><li><a href="/pci-dss-penetration-testing.html">PCI DSS testing</a></li><li><a href="/hipaa-penetration-testing.html">HIPAA testing</a></li><li><a href="/ai-llm-penetration-testing.html">AI &amp; LLM testing</a></li><li><a href="/penetration-testing-as-a-service.html">PTaaS &amp; ongoing testing</a></li><li><a href="/penetration-testing-india.html">Services for India teams</a></li><li><a href="/penetration-testing-services-usa.html">Services for US teams</a></li></ul></details></li><li><a href="/about.html" data-nav="about">Approach</a></li><li><a href="/blogs.html" data-nav="insights">Blog</a></li><li><a href="/contact.html" data-nav="contact">Contact</a></li></ul><a class="btn btn-primary" href="/contact.html?service=web-api&amp;source=research-archive" data-track="nav_pentest">Request a pentest</a></div><button class="menu-toggle" type="button" aria-label="Open menu" aria-controls="primary-menu" aria-expanded="false" data-menu-toggle><span></span><span></span></button></nav></header>

  <main id="main-content">
    <article>
      <header class="article-hero archive-article-hero"><div class="container-narrow"><nav class="article-byline" aria-label="Breadcrumb"><a href="/">Home</a><span aria-hidden="true">/</span><a href="/blogs.html#bug-bounty-archive">Bug Bounty Archive</a><span aria-hidden="true">/</span><span aria-current="page">{escaped(title)}</span></nav><span class="eyebrow">Bug bounty archive / Original research</span><h1>{escaped(title)}</h1><p class="article-deck">Practical security research by Aditya Soni / HeTroubleHacker.</p><div class="article-byline"><span>By <a href="/about.html#researcher">Aditya Soni / HeTroubleHacker</a></span><span>Published <time datetime="{post.published}">{date_label(post.published)}</time></span><span>{minutes} min read</span></div></div></header>

      <div class="article-body"><div class="container article-layout">
        <nav class="article-toc" aria-label="Article details"><strong>In this article</strong><a href="#research-article">Read the research</a><a href="/blogs.html#bug-bounty-archive">Bug bounty archive</a><a href="/about.html#researcher">About Aditya</a></nav>
        <div class="article-content archive-article-content research-article-content">
          <div class="research-article-body" id="research-article" data-research-post-id="{post.post_id}" data-research-text-sha256="{body_hash}">
{str(body)}
          </div>
          <aside class="research-author-note" aria-labelledby="archive-author-title"><span class="eyebrow">About the author</span><h2 id="archive-author-title">Aditya Soni / HeTroubleHacker</h2><p>Aditya is a product security professional and independent security researcher focused on web and API security, penetration testing, vulnerability validation, and responsible disclosure.</p><div class="button-row"><a class="btn btn-secondary" href="/about.html#researcher">View the researcher profile</a><a class="btn btn-secondary" href="/blogs.html#bug-bounty-archive">Bug bounty archive</a></div></aside>
          <div class="article-cta"><span class="eyebrow">Continue reading</span><h2>From research to a scoped assessment.</h2><p>Explore {escaped(post.related_label)} or browse the full Bug Bounty Archive for more evidence-focused research.</p><div class="button-row"><a class="btn btn-primary" href="{escaped(post.related_url)}">{escaped(post.related_label)}</a><a class="btn btn-quiet" href="/blogs.html#bug-bounty-archive">Bug bounty archive</a></div></div>
          <p class="research-topic-line"><strong>Research topics:</strong> {escaped(tags)}</p>
        </div>
      </div></div>
    </article>
  </main>

  <footer class="site-footer"><div class="container"><div class="footer-grid"><div class="footer-brand"><a class="brand" href="/"><span class="brand-mark" aria-hidden="true">B/</span><span>Balhence</span></a><p>Security testing, research, and engineering.</p></div><div class="footer-column"><h2>Explore</h2><ul class="footer-links"><li><a href="/services.html">Services</a></li><li><a href="/soc-2-penetration-testing.html">SOC 2 testing</a></li><li><a href="/ai-llm-penetration-testing.html">AI &amp; LLM testing</a></li><li><a href="/penetration-testing-as-a-service.html">PTaaS</a></li><li><a href="/penetration-testing-india.html">India services</a></li><li><a href="/penetration-testing-services-usa.html">US services</a></li><li><a href="/about.html">Approach</a></li><li><a href="/contact.html">Contact</a></li></ul></div><div class="footer-column"><h2>Resources</h2><ul class="footer-links"><li><a href="/scope-builder.html">Scope planner</a></li><li><a href="/report-viewer.html">Sample report</a></li><li><a href="/blog.html">Penetration testing guides</a></li><li><a href="/blogs.html#bug-bounty-archive">Bug bounty archive</a></li><li><a href="/privacy.html">Privacy</a></li></ul></div><div class="footer-column"><h2>Contact</h2><ul class="footer-links"><li><a href="mailto:contact@balhence.com">contact@balhence.com</a></li><li>Remote engagements for India and US teams</li></ul></div></div><div class="footer-bottom"><span>(c) <span data-current-year>2026</span> Balhence. All rights reserved.</span><span>Test only with written authorization.</span></div></div></footer>
  <script src="/config.js?v=20260905c"></script><script src="/app.js?v=20261006a"></script><script src="/motion.js?v=20261001b"></script><script src="/flow.js?v=20261001b"></script>
</body>
</html>
'''


def main() -> None:
    args = arguments()
    feed = ET.fromstring(get_feed(args.feed))
    items = feed.findall("./channel/item")
    by_id = {
        next((post.post_id for post in POSTS if post.post_id in clean_canonical(item.findtext("link", ""))), ""): item
        for item in items
    }
    manifest = []
    for post in POSTS:
        item = by_id.get(post.post_id)
        if item is None:
            raise SystemExit(f"RSS feed is missing expected post {post.post_id}")
        title = item.findtext("title", "").strip()
        creator = item.findtext(f"{{{DC_NAMESPACE}}}creator", "").strip()
        if creator != "Aditya Soni":
            raise SystemExit(f"Unexpected creator for {post.post_id}: {creator}")
        canonical = clean_canonical(item.findtext("link", ""))
        if canonical != post.canonical:
            raise SystemExit(f"Canonical changed for {post.post_id}: {canonical}")
        raw = item.findtext(f"{{{CONTENT_NAMESPACE}}}encoded", "")
        body, body_hash, image_count = sanitize_body(raw, post)
        words, minutes = words_and_minutes(body)
        output = ROOT / post.output
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(
            page_html(post, title, creator, [node.text or "" for node in item.findall("category")], body, body_hash, minutes),
            encoding="utf-8",
        )
        image_assets = []
        for image in body.find_all("img"):
            relative_image = image["src"].lstrip("/")
            image_bytes = (ROOT / relative_image).read_bytes()
            image_assets.append(
                {
                    "path": relative_image,
                    "sha256": hashlib.sha256(image_bytes).hexdigest(),
                    "bytes": len(image_bytes),
                }
            )
        manifest.append(
            {
                "path": post.output,
                "post_id": post.post_id,
                "title": title,
                "source_url": post.canonical,
                "published": post.published,
                "source_modified": post.modified,
                "local_modified": LOCAL_MODIFIED,
                "text_sha256": body_hash,
                "images": image_count,
                "image_assets": image_assets,
                "words": words,
            }
        )
        print(f"{post.output}: {words} words, {image_count} images")

    fixture = ROOT / "tests/fixtures/medium-import-manifest.json"
    if args.update_manifest:
        fixture.parent.mkdir(parents=True, exist_ok=True)
        fixture.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"Updated reviewed source lock: {fixture.relative_to(ROOT)}")
    else:
        if not fixture.is_file():
            raise SystemExit("Reviewed source lock is missing; inspect the import before using --update-manifest")
        expected = json.loads(fixture.read_text(encoding="utf-8"))
        if manifest != expected:
            raise SystemExit(
                "Medium import differs from the reviewed source lock. Inspect the text, embeds, and images; "
                "then rerun with --update-manifest only when the change is intentional."
            )
        print(f"Verified {len(manifest)} pages against {fixture.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
