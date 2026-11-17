#!/usr/bin/env python3
"""Build Balhence's first-party research library from the author's public RSS feed.

The generated pages preserve the technical content and original publication metadata.
Platform tracking pixels and RSS-only publication footer sentences are excluded. A
reviewed, deterministic editorial layer fixes obvious copy errors and platform-native
calls to action while retaining a hash of the imported source text. Images uploaded
with the stories are copied locally; third-party embeds remain lazy-loaded.
"""

from __future__ import annotations

import argparse
import hashlib
import html
import io
import json
import re
import unicodedata
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

try:
    import html5lib  # noqa: F401 - registers Beautiful Soup's standards-compliant parser
    from bs4 import BeautifulSoup
    from PIL import Image
except ImportError as error:  # pragma: no cover - maintainer-only utility
    raise SystemExit("Beautiful Soup 4, html5lib, and Pillow are required for the archive importer") from error


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_FEED = "https://medium.com/feed/@hetroublehacker"
CONTENT_NAMESPACE = "http://purl.org/rss/1.0/modules/content/"
DC_NAMESPACE = "http://purl.org/dc/elements/1.1/"
LOCAL_MODIFIED = "2026-11-17"

ASCII_PHRASE_REPLACEMENTS = (
    ("someorg\u200a\u2014\u200aconcurrency=50\u200a\u2014\u200atoken=", "someorg --concurrency=50 --token="),
    ("\u00af\\_(\u30c4)_/\u00af", "(shrug)"),
    ("Takeaways \u2013", "Takeaways:"),
    ("Takeaways -", "Takeaways:"),
    (" \U0001f319\U0001f98a ", " "),
    ("GitHub - hahwul/dalfox:  Dalfox", "GitHub - hahwul/dalfox: Dalfox"),
    ("\U0001f319\U0001f98a", ""),
)
ASCII_CHARACTER_REPLACEMENTS = str.maketrans({
    "\u00a0": " ",
    "\u00b7": "-",
    "\u00af": "",
    "\u200a": " ",
    "\u2013": "-",
    "\u2014": "-",
    "\u2018": "'",
    "\u2019": "'",
    "\u201c": '"',
    "\u201d": '"',
    "\u2022": "*",
    "\u2026": "...",
    "\u30c4": "",
    "\U0001f319": "",
    "\U0001f44f": "",
    "\U0001f50d": "",
    "\U0001f50e": "",
    "\U0001f511": "",
    "\U0001f95a": "",
    "\U0001f98a": "",
})


def ascii_copy(value: str) -> str:
    """Return reviewed web copy using only printable ASCII-compatible text."""
    result = str(value)
    for source, replacement in ASCII_PHRASE_REPLACEMENTS:
        result = result.replace(source, replacement)
    result = result.translate(ASCII_CHARACTER_REPLACEMENTS)
    result = unicodedata.normalize("NFKD", result).encode("ascii", "ignore").decode("ascii")
    if not result.isascii():
        raise RuntimeError("ASCII normalization left unsupported characters")
    return result


def ascii_soup(soup):
    """Normalize visible imported text and attribute values without changing markup."""
    for node in list(soup.find_all(string=True)):
        if node.parent.name in {"script", "style"}:
            continue
        normalized = ascii_copy(str(node))
        if normalized != str(node):
            node.replace_with(normalized)
    for element in soup.find_all(True):
        for name, value in list(element.attrs.items()):
            if isinstance(value, list):
                element.attrs[name] = [ascii_copy(item) for item in value]
            elif isinstance(value, str):
                element.attrs[name] = ascii_copy(value)
    if not str(soup).isascii():
        raise RuntimeError("Imported article markup is not ASCII-only")
    return soup


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

    @property
    def public_path(self) -> str:
        return f"/research/{self.slug}"


POSTS = (
    Post(
        "272b46f66907",
        "dependency-confusion",
        "https://hetroublehacker.medium.com/how-i-approached-dependency-confusion-272b46f66907",
        "2022-01-31T17:10:25Z",
        "2022-01-31T17:10:25Z",
        "Dependency Confusion Bug Bounty Methodology | Balhence",
        "Learn how Aditya Soni identified unclaimed npm package names and validated dependency confusion findings using GitHub search, Bash, and httpx.",
        "/web-application-penetration-testing",
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
        "/web-application-penetration-testing",
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
        "/blog",
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
        "/web-application-penetration-testing",
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
        "/web-application-penetration-testing",
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
        "/insights/server-owned-validation-rules",
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
        "/web-application-penetration-testing",
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
        "/blog",
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
        "/api-penetration-testing",
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
        "/api-penetration-testing",
        "API penetration testing",
    ),
)

ARCHIVE_COVERS = {
    "272b46f66907": (
        "/assets/research/archive-dependency-confusion-v2.jpg",
        "A translucent supply-chain puzzle with one package connection routed through an unexpected component.",
        "Original translucent 3D editorial illustration created for this archive edition.",
    ),
    "1900aeef79f6": (
        "/assets/research/archive-cve-2020-28726-v2.jpg",
        "A brutalist vulnerability dossier assembled from controlled evidence fragments.",
        "Original brutalist editorial collage created for this archive edition.",
    ),
    "b963bffb36cd": (
        "/assets/research/archive-first-bounty-target-v2.jpg",
        "A clay diorama connecting several security findings to one controlled target.",
        "Original handcrafted clay editorial scene created for this archive edition.",
    ),
    "27f622bc47c0": (
        "/assets/research/archive-first-xss-v2.jpg",
        "A manga-style browser scene revealing a controlled script execution path.",
        "Original anime and manga editorial illustration created for this archive edition.",
    ),
    "7080e48df8b4": (
        "/assets/research/archive-http-request-smuggling-v2.jpg",
        "Two network gateways interpreting one split request stream differently.",
        "Original technical risograph illustration created for this archive edition.",
    ),
    "58d3a9946225": (
        "/assets/research/archive-inspect-element-v2.jpg",
        "A magnifier revealing an active form control beneath a disabled browser field.",
        "Original Swiss-modernist editorial illustration created for this archive edition.",
    ),
    "472c67f1cb46": (
        "/assets/research/archive-crlf-injection-v2.jpg",
        "One luminous response line splitting into separate control paths.",
        "Original abstract neon editorial illustration created for this archive edition.",
    ),
    "438596ff72f5": (
        "/assets/research/archive-bug-bounty-bash-v2.jpg",
        "A retro terminal workflow turning many reconnaissance signals into one pipeline.",
        "Original retro-computing editorial illustration created for this archive edition.",
    ),
    "22cdcc829976": (
        "/assets/research/archive-secret-api-keys-v2.jpg",
        "A brass key revealed between translucent layers of public web assets.",
        "Original cinematic editorial image created for this archive edition.",
    ),
    "2b3dbe9fa0b8": (
        "/assets/research/archive-automating-idor-v2.jpg",
        "A blueprint authorization matrix exposing one incorrect cross-account object path.",
        "Original blueprint editorial illustration created for this archive edition.",
    ),
}

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
        1: "Two people celebrating beside a laptop.",
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

# These hashes describe the visible text after source sanitization but before
# Balhence's editorial corrections. Keeping them separate from the final page
# hashes makes every copy change reviewable without pretending the source feed
# itself changed.
REVIEWED_SOURCE_TEXT_SHA256 = {
    "272b46f66907": "8b1672b05081d56b7bbd832b8a8c98a42ac26b28dc9a92415042534004fa8785",
    "1900aeef79f6": "75d4444f1de04dafd6c2c73da89706e4c917e58456aebc8d88a2c30518370bdb",
    "b963bffb36cd": "c76cbf5268969fe869b706fe37edcc95e65226e0f96ee733b235f5133f10c257",
    "27f622bc47c0": "c920cd6996d3a31091f599799184f6530d13dddad94879e2e5ac5be7852b534f",
    "7080e48df8b4": "5dc4f846a943a58310e7eb2e35f62d325dbbadb7e3e2649b873ab086e02c78d7",
    "58d3a9946225": "83c62b83d7d6342de66d4eb6496b14f8c2e56fb113f282bb771174020ad2bd56",
    "472c67f1cb46": "42719cbd604846fe970f9f0dee162f3b216933c2540000a5d827c255953fa69a",
    "438596ff72f5": "8446fd9dd30f97469ff29a5400e423e4d29ece163631ad13b5223d6352c8c79d",
    "22cdcc829976": "d247a26a9d6260710f1bd2ebd38f590f244da1168ebcfa663811f90eb5a7c93b",
    "2b3dbe9fa0b8": "601959ce056f828ea5ae18b9ce792a82c833470918cf83e3eab915d818dad6cf",
}

# Each entry matches one complete text node after whitespace normalization.
# Replacing text nodes, rather than whole HTML blocks, preserves the original
# links, screenshots, code, emphasis, and document structure byte-for-byte.
EDITORIAL_TEXT_REPLACEMENTS = {
    "272b46f66907": (
        ("Hi People,", "Hi everyone,"),
        (
            "Hope you are doing good, I know I took a little longer to publish this blog, so apologies there.",
            "I hope you\u2019re doing well. This article took me a little longer to publish, so thank you for your patience.",
        ),
        (
            "In this blog, I will be sharing my approach for finding",
            "In this article, I\u2019ll share my approach to finding",
        ),
        ("bugs. This blog is totally inspired by", "bugs. This methodology was inspired by"),
        ("finding on", "research on"),
        ("It was an interesting find when the", "When the"),
        (
            "was published and unknown to the internet which attracted many eyes and I was also one of many who wanted to find a dependency confusion bug.",
            "was published, dependency confusion was still unfamiliar to many researchers and attracted a lot of attention. I was one of the people who wanted to find one of these bugs.",
        ),
        (
            "Dependency confusion bugs can be reported when you found a package that is not listed in the public source directory and is still getting installed. Some languages where this vulnerability can be found are python, npm, ruby, etc...",
            "A dependency confusion bug may exist when a package is not listed in a public registry but is still being installed. I focused on the Python, npm, and Ruby package ecosystems.",
        ),
        (
            "Online explaination: find command is used to find all the package.json file from the current directory and jq is used to grep the packeges under dependencies and devdependenceis from the .json file. I used registry.npmjs.org because when i appended package name in front of https://www.npmjs.com/package/<package> I got hit by rate limit in no time. httpx is used with -status-code and -mc 404 to show urls which giving 404 as status code.",
            "One-line explanation: the find command locates every package.json file in the current directory, and jq extracts the packages under dependencies and devDependencies. I used registry.npmjs.org because appending a package name to https://www.npmjs.com/package/<package> hit the rate limit almost immediately. httpx uses -status-code and -mc 404 to show URLs that return a 404 status.",
        ),
        (
            "Thanks for reading, hope you liked it.",
            "Thanks for reading. I hope the approach is useful in your own testing.",
        ),
        (
            "If you enjoyed this blog, please click the \U0001f44f button and share it to help others find it.",
            "If this article helped, share it with another researcher who might find it useful.",
        ),
    ),
    "1900aeef79f6": (
        (
            "In this blog post, I\u2019ll be sharing about how I was assigned my CVE :)",
            "In this article, I\u2019ll share how I was assigned my first CVE.",
        ),
        (
            "about his findings on an Open Source software which is \u201c",
            "about his findings in the open-source software \u201c",
        ),
        (
            "\u201d and he inspired me to give a look at this software and see if I can find some bugs and get myself a CVE. So, This blog post is regarding the first finding which was initially an HTML Injection but then converted it into an Open Redirect.",
            ".\u201d His work inspired me to examine the software, look for bugs, and try to earn my first CVE. This article covers the first finding, which began as HTML injection and was later escalated into an open redirect.",
        ),
        (
            "has a demo portal which helped me to save time in installing it on my local machine. So I fired up my machine, turned on the proxy, and started using the SeedDMS as a normal user.",
            "has a demo portal, which saved me the time of installing it locally. I started my proxy and used SeedDMS as a normal user.",
        ),
        (
            "I interacted with a couple of functionalities while monitoring all the requests in my Burp suite\u2019s",
            "I tested several features while monitoring requests with Burp Suite\u2019s",
        ),
        (
            "which is really a good extension to monitor the URLs going through your burp proxy. Coming back to the topic",
            ", an extension that makes it easy to follow URLs passing through the proxy.",
        ),
        (
            "as a parameter which was not sanitizing the special characters I put in. I tried XSS but no luck but the HTML injection was working fine, there\u2019s nothing much I was able to do with simple HTML Injection. I started looking if I can escalate it into something impactable and found this helpful blogpost by",
            "as a parameter, and it did not sanitize the special characters I supplied. XSS did not work, but HTML injection did. Because simple HTML injection had limited impact, I looked for a way to escalate it and found this helpful article by",
        ),
        (
            "which helped me to reconstruct my simple HTML injection into an Open redirect with the help of meta tag.",
            "That article helped me turn the HTML injection into an open redirect using a meta tag.",
        ),
        (
            "When finding bugs, you must look into each URL and try to escalate the bug which may impact the User.",
            "When you find a bug, examine each URL and look for a responsible way to demonstrate its impact on the user.",
        ),
        (
            "Thanks to the Vendor for quick enough to patch it on the same day as the report was sent and issued an update for the same.",
            "Thanks to the vendor for patching the issue and issuing an update on the same day I submitted the report.",
        ),
        (
            "If you enjoyed this blog, please click the \U0001f44f button and share it to help others find it.",
            "If this article helped, share it with another researcher who might find it useful.",
        ),
    ),
    "b963bffb36cd": (
        (
            "First of all, sorry for not posting for such a long period of time. I was really busy in this lockdown pushing my HackerOne Reputation & other stuff.",
            "During the lockdown, I spent much of my time building my HackerOne reputation and working on other projects.",
        ),
        (
            "I am writing this blog to talk about my methodology and how without using any tool I found multiple vulnerabilities on one of my First Targets.",
            "In this article, I\u2019ll explain the methodology I used to find multiple vulnerabilities on one of my first targets without relying on automated tools.",
        ),
        (
            "Anyways, let\u2019s come to our topic, I won\u2019t disclose the company name as it was a private program but will refer to it as",
            "I won\u2019t disclose the company because this was a private program, so I\u2019ll refer to it as",
        ),
        ("as it was a shopping website.", "throughout the article because it was a shopping website."),
        (
            "This was my first ever Target from which I received bounty, as the first bounty is always a special one. I continued hacking on the Target to report some more reports and get some more bounties",
            "This was the first target from which I received a bounty, so it remains a special one. I continued testing the target, reported more vulnerabilities, and received additional bounties.",
        ),
        (
            "In this case scenario, I created an account and Logged it in two browsers. I changed the password of the account in one browser and tried to make edits on the Second browser which went successfully, hence the Improper Session Management flaw, which is obviously a minor severity.",
            "For this case, I logged the same account into two browsers. I changed the password in one browser, then successfully made edits from the second browser. This demonstrated an improper session management flaw of minor severity.",
        ),
        (
            "website, there was a \u201cTrack my Order\u201d Option which is after a successful order is placed, a person can track the order with the order id. So with this feature, an attacker can take out the details of any victim if he knows the phone number of the victim and he doesn\u2019t need to know the order number because with the help of the Burp Suite Intruder (for a better understanding referrer to Screenshot below) he can brute force and find a correct order number and get the details of his order which leaks the Address and other personal information of the Victim",
            "website, a \u201cTrack my Order\u201d option became available after an order was placed. A user could track an order with its order ID. If an attacker knew the victim\u2019s phone number, they could use Burp Suite Intruder to brute-force an order number and retrieve order details, including the victim\u2019s address and other personal information.",
        ),
        (
            "On a Special Note: These features were only available to me After made a Purchase on the shopping.com",
            "A special note: these features became available only after I made a purchase on shopping.com.",
        ),
        (
            "I would say my takeaway from this experience was to stay at a target and understand it, make yourself feel comfortable, and don\u2019t Rush. If you are eligible to make a purchase DO it!! It will definitely bring something with it.",
            "My takeaway was to stay with a target long enough to understand it, become comfortable with its workflows, and avoid rushing. If the program rules allow a test purchase, completing the full workflow may reveal additional attack surface.",
        ),
        (
            "If you enjoyed this blog, please click the \U0001f44f button and share it to help others find it.",
            "If this article helped, share it with another researcher who might find it useful.",
        ),
    ),
    "27f622bc47c0": (
        (
            "Hi guys, So I would like to start this blog with a question, What was the first vulnerability you learnt when you began into Cyber Security??",
            "Hi everyone. I\u2019d like to start with a question: what was the first vulnerability you learned about when you began studying cybersecurity?",
        ),
        (
            "Mine was XSS, though it took pretty long for me to find it but yeah! I finally found it \u00af\\_(\u30c4)_/\u00af",
            "Mine was XSS. It took me quite a while to find one, but I finally did. \u00af\\_(\u30c4)_/\u00af",
        ),
        (
            "I got an invitation to a private program on HackerOne. It almost had more than 600+ reports already reported with just 4 assets. Damn will I find anythin\u2019??",
            "I received an invitation to a private HackerOne program that already had more than 600 reports across only four assets. I wondered whether I would find anything.",
        ),
        (
            "I still began with my normal reconnaissance and started playing with the application. No luck here!",
            "I still began with my usual reconnaissance and started testing the application. At first, I had no luck.",
        ),
        ("Now, I then started mining the parameters.", "Next, I started mining parameters."),
        ("HOW?", "Here is the workflow:"),
        ("here you go", "these were the tools and techniques I used."),
        (
            "also you can use \u201cWaybackurls | gau\u201d to find parameters. These are some great tips I have used soo far and the results were amazing \u00af\\_(\u30c4)_/\u00af",
            "You can also use \u201cWaybackurls | gau\u201d to find parameters. These were useful techniques in my workflow, and the results were strong. \u00af\\_(\u30c4)_/\u00af",
        ),
        (
            "With all the list of Parameters, I started fuzzing and fuzzing with a thought, I\u2019ll get something interesting",
            "With the parameter list ready, I began fuzzing in the hope of finding something interesting",
        ),
        (
            "and Voila!! I found one parameter which did not have many filters. First I sent it to some XSS scanner tools because It\u2019s the first time I running for an XSS.",
            "and found a parameter with few filters. Because this was my first time testing for XSS, I sent it to a couple of XSS scanners first.",
        ),
        (
            "And I got positive results, I found csrfToken lying out there for me lol :P",
            "The tools returned positive results, and I found a csrfToken exposed there. :P",
        ),
        ("So I started exploring how to get the POP-UP", "I then explored how to trigger the alert."),
        (
            "And later that day. I reported my First XSS on HackerOne.",
            "Later that day, I reported my first XSS on HackerOne.",
        ),
        (
            "\u201cOld program, many reports, and many such things\u201d don\u2019t let it bother you. Always try to find more and more parameters and Fuzz them ALL :D",
            "Don\u2019t let an old program or a high report count discourage you. Keep discovering parameters and test them methodically. :D",
        ),
        (
            "If you enjoyed this blog, please click the \U0001f44f button and share it to help others find it.",
            "If this article helped, share it with another researcher who might find it useful.",
        ),
    ),
    "7080e48df8b4": (
        (
            "Hello everyone, this is the topic in which I\u2019ve really struggled learning it. So I decided to understand it from the various blog post, videos and many more ways. Today, I\u2019m gonna write is down in Plain English and in the end will attach the references and some tools also ;)",
            "Hello everyone. HTTP request smuggling was a difficult topic for me to learn, so I worked through several articles, videos, and other resources. In this article, I\u2019ll explain it in plain English and finish with references and tools. ;)",
        ),
        ("Let\u2019s Begin and try to finish it in one article.", "Let\u2019s begin and cover the basics in one article."),
        (
            "HTTP request smuggling is also called as HTTP DESYNC ATTACK because the request sent is treated distinctly by Front-end and Back-end server on account of which we get an unexpected outcome or error in the Response and this can be considered as the base explanation of request smuggling.",
            "HTTP request smuggling is also called an HTTP desync attack because the front-end and back-end servers interpret the same request differently, producing an unexpected response or error. That is the basic idea behind request smuggling.",
        ),
        (
            "To understand deeply about request smuggling behaviour we have to know the major key specs of its happening.",
            "To understand request-smuggling behavior, we first need to understand the specifications that shape it. The original article referenced RFC 2616, which is now obsolete; current HTTP/1.1 message framing is specified in RFC 9112. The historical quotation below is retained for context.",
        ),
        (
            "To understand request-smuggling behavior, we first need to understand the specifications that shape it.",
            "To understand request-smuggling behavior, we first need to understand the specifications that shape it. The original article referenced RFC 2616, which is now obsolete; current HTTP/1.1 message framing is specified in RFC 9112. The historical quotation below is retained for context.",
        ),
        ("RFC Specification (2161)", "Historical reference: RFC 2616 (obsolete)"),
        ("When a request is sent then front-end server process the", "When a request arrives, the front-end server processes the"),
        ("and back-end server process the", "while the back-end server processes the"),
        (
            "and hence both the servers are treating the same request distinctly and due to which the request doesn\u2019t synchronise and give us an unexpected outcome or error in the Response which cause the",
            "and the two servers therefore interpret the same request differently. They can fall out of sync and produce an unexpected response, causing",
        ),
        ("Request smuggling.", "request smuggling."),
        (
            "As you can see content-length = 6, and you get confused HOW? that\u2019s what happened with me in starting stage. In real case you won\u2019t see CRLF characters but they are appened after each line are also counted in the content-length of the request and",
            "The Content-Length is 6, which confused me at first. In a real request, the CRLF characters are not visible, but they appear after each line and count toward the request body length. Therefore,",
        ),
        (
            "hence 0 + \\r + \\n + \\r + \\n + G = 6 content-length.",
            "0 + \\r + \\n + \\r + \\n + G = a Content-Length of 6.",
        ),
        (
            "Here you can see that Malicious request, It has",
            "Here, the malicious request contains",
        ),
        (
            "Now analyse the request: content-length is 4 Because it\u2019s the length of 5c (plus CRLF character) which is hex-number of 92 decimal number and After that, there is some data which is going to be our junk data which will get left unprocessed, and the back-end server will treat these as being the start of the next request in the sequence.",
            "Now analyze the request: Content-Length is 4 because it covers 5c plus the CRLF characters; 5c is the hexadecimal representation of decimal 92. The remaining junk data is left unprocessed, and the back-end server treats it as the start of the next request in the sequence.",
        ),
        (
            "Before ending it here, I\u2019m gonna share some amazing blog post and some HackerOne reports about the HTTP request smuggling Vulnerability.",
            "Before finishing, I\u2019ll share several useful articles and HackerOne reports about HTTP request smuggling.",
        ),
        (
            "This is all about the basics of Request smuggling. I hope you have learnt something from this blog.",
            "Those are the basics of request smuggling. I hope this explanation made the topic easier to understand.",
        ),
        ("Feedbacks and edits are welcome", "Feedback and corrections are welcome."),
        (
            "If you enjoyed this blog, please click the \U0001f44f button and share it to help others find it.",
            "If this article helped, share it with another researcher who might find it useful.",
        ),
    ),
    "58d3a9946225": (
        (
            "Hello guys, I recently encountered an amazing bypass to change my Phone Number in an application that doesn\u2019t allow anyone to change its Phone number after registration. An Easy Win!",
            "Hello everyone. I found a simple bypass that let me change my phone number in an application that did not allow users to change it after registration.",
        ),
        (
            "As this was a private program all illustrations of vulnerabilities will be represented with the host as redact.com",
            "Because this was a private program, every example uses redact.com as the placeholder host.",
        ),
        (
            "While doing the registration. In the end, the web application sends an OTP to the phone number to verify it. Till now it was all normal like every other application.",
            "At the end of registration, the web application sent an OTP to verify the phone number. Up to this point, the flow looked normal.",
        ),
        (
            "And looked like every other account info page with not many options available, like as you can see email address and Mobile number options are disabled by default.",
            "It looked like a typical account information page with few options. As shown below, the email address and mobile number fields were disabled by default.",
        ),
        (
            "And I started playing with it, I opened Inspect Element and changed the value of Mobile Phone from ******3203 to ******3213",
            "I opened Inspect Element and changed the mobile phone value from ******3203 to ******3213",
        ),
        (
            "So to confirm that does it really changed my Mobile number? I reloaded the page again and my Mobile Number has been",
            "To confirm whether the change had worked, I reloaded the page. My mobile number had been",
        ),
        (
            "successfully which does not belong to me and I didn\u2019t even verify it.",
            "successfully, even though the new number did not belong to me and I had not verified it.",
        ),
        (
            "Always try to check and change the value which is disabled by default and save the changes, it is possible that it remains changed.",
            "Always check whether a value that is disabled in the interface can still be changed and saved. The server may accept it without enforcing the same restriction.",
        ),
        ("That\u2019s all for this blog. Hope you liked it.", "That\u2019s the full case study. I hope it was useful."),
    ),
    "472c67f1cb46": (
        ("Hello Guys,", "Hello everyone."),
        (
            "Just a Rough analysis of bugs Disclosed Publicly about CRLF injection",
            "This is a practical analysis of publicly disclosed CRLF injection bugs.",
        ),
        (
            "This analysis is done just because of curiosity about learning new things and tho I found this topic interesting. So Thought of sharing about it with you guys.",
            "I began this analysis out of curiosity and found the topic interesting enough to share.",
        ),
        (
            "I started with Reading about disclosed reports about CRLF injection on Hackerone Hacktivity. (Some interesting reports will be discussed below)",
            "I started by reading disclosed CRLF injection reports on HackerOne Hacktivity. I discuss several interesting examples below.",
        ),
        (
            "Basically, Pressing Enter key is the combination of carriage return & line feed",
            "In simple terms, pressing Enter produces a carriage return and line feed combination.",
        ),
        (
            "The Effect of CRLF injection also includes HTTP Request smuggling and HTTP Response Splitting. ( Detailing about them is out of the scope of this Blog, Maybe will discuss it in next blog post)",
            "The effects of CRLF injection can also include HTTP request smuggling and HTTP response splitting. A detailed treatment of those issues is outside the scope of this article.",
        ),
        (
            "I started with Hackerone Hacktivity and Searched for CRLF injection which gave me 59 Results \u201c",
            "I searched HackerOne Hacktivity for CRLF injection and received 59 results: \u201c",
        ),
        (
            "That doesn\u2019t conclude that there are only 59 publicly disclosed reports on CRLF injection",
            "That did not mean only 59 CRLF injection reports had been publicly disclosed.",
        ),
        (
            "Most of the CRLF injection can lead to XSS and Open Redirects if chained properly which increases the Criticality of the report and you can escalate your report to Medium CVS score easily",
            "Many CRLF injection findings can lead to XSS or open redirects when chained correctly, increasing the impact and potentially raising the report to a Medium CVSS score.",
        ),
        (
            "During this process, I definitely learned new things and now I feel like I have much more knowledge than before about CRLF injection and have a good intuition of finding some new vulnerability.",
            "This process deepened my understanding of CRLF injection and gave me better intuition for finding similar vulnerabilities.",
        ),
        ("Feedbacks and edits are welcome", "Feedback and corrections are welcome."),
        (
            "If you enjoyed this blog, please click the \U0001f44f button and share it to help others find it.",
            "If this article helped, share it with another researcher who might find it useful.",
        ),
    ),
    "438596ff72f5": (
        (
            "Adding Bash to my bug bounty was the best thing I ever did during my learning process!",
            "Adding Bash to my bug bounty workflow was one of the most useful steps in my learning process.",
        ),
        ("Let\u2019s Start with Some Basics Introduction. Ummm\u2026", "Let\u2019s start with the basics."),
        (
            "Bash is a standard shell, it\u2019s intuitive and flexible. In Linux and macOS, Bash is a standard shell for common users. The primary purpose of bash is to allow you to interact with the computers\u2019 OS so that you can accomplish whatever you need to do. Bash is just a language that allows you to execute some commands in a programmable way.",
            "Bash is an intuitive, flexible shell commonly used on Linux and macOS. It lets you interact with the operating system and execute commands programmatically.",
        ),
        (
            "To learn more about bash, Here is a Bash Cookbook which can help you to learn each and everything about Bash",
            "To learn more, this Bash cookbook covers the language in greater depth:",
        ),
        (
            "I would say why not? You\u2019ll only find tools made for security-purpose that do nearly what you do but in a much faster way and written in bash and If you can\u2019t find one.",
            "Many security tools automate tasks you already perform, often much faster. When the tool you need does not exist,",
        ),
        ("Then Write One.", "write one."),
        ("Next comes it Subdomain Takeover", "Next Comes Subdomain Takeover"),
        (
            "Now doing it manually for every subdomain is hard work to-do.",
            "Checking every subdomain manually takes time.",
        ),
        (
            "So to shorten the time period and increasing its value is because you are reading this blog. Right?",
            "The following one-liner shortens that process:",
        ),
        ("Next will be making a Script to find CORS Misconfiguration", "Next, We\u2019ll Build a Script to Find CORS Misconfigurations"),
        ("Feedbacks and edits are welcome", "Feedback and corrections are welcome."),
        (
            "If you enjoyed this blog, please click the \U0001f44f button and share it to help others find it.",
            "If this article helped, share it with another researcher who might find it useful.",
        ),
    ),
    "22cdcc829976": (
        (
            "Hello everyone, it may be just another blog on how to find API keys, but here I\u2019ll try to give every Information about finding the secret API keys and how to use them to authenticate.",
            "Hello everyone. This article explains how I look for exposed API keys and validate whether they can be used for authentication.",
        ),
        (
            ") is a unique indentifier that is used to authenticate the incoming request and that program or user has known permissions for accessing the non-private user data.",
            ") is a credential used by an application or service to identify or authorize a caller. The permissions and data it exposes depend on the provider and the credential\u2019s configured scope.",
        ),
        (
            ") is a unique identifier used to authenticate an incoming request and indicate that a program or user has known permissions to access non-private user data.",
            ") is a credential used by an application or service to identify or authorize a caller. The permissions and data it exposes depend on the provider and the credential\u2019s configured scope.",
        ),
        (
            "But it can be a bit of time-consuming, so to save a lot of time. Here is a great tool I would recommend to use:",
            "Manual review can be time-consuming, so this is one tool I recommend for speeding up the process:",
        ),
        (
            "After installing KeyFinder successfully go-to the target website and Click on the keyFinder icon added on the top right corner of chrome and manually add some common keywords used to find API keys so that KeyFinder can crawl in the website and Find the keys. After visiting links, click on the result/s and there you can see the outcomes.",
            "After installing KeyFinder, visit the target website and click the KeyFinder icon in Chrome. Add common keywords associated with API keys so the extension can inspect the site. After visiting the relevant links, open the results to review what it found.",
        ),
        (
            "Now what? that\u2019s the main question. API keys can be used to authenticate without the username and password of an individual.",
            "The next question is how to validate a key. Some API keys can authenticate requests without an individual user\u2019s username and password.",
        ),
        (
            "Below are some ways in which particular API keys found on a Bug Bounty Program can be used to check if they are valid and can also be used to Account takeover or extract personal information from the API.",
            "The examples below are retained for historical context. Provider APIs, token formats, and recommended transports change, and some examples are now deprecated or place secrets in URLs. For current authorized testing, consult the provider\u2019s latest documentation, prefer headers or secure SDK flows, validate only the minimum required impact, and never paste real credentials into third-party tools or logs.",
        ),
        (
            "Below are several authorized checks for determining whether API keys found during a bug bounty program are valid and whether they could enable account takeover or expose personal information through an API.",
            "The examples below are retained for historical context. Provider APIs, token formats, and recommended transports change, and some examples are now deprecated or place secrets in URLs. For current authorized testing, consult the provider\u2019s latest documentation, prefer headers or secure SDK flows, validate only the minimum required impact, and never paste real credentials into third-party tools or logs.",
        ),
        (
            "Secretx is a tool to extract the API keys from each requested URLs.",
            "Secretx extracts API keys from each requested URL.",
        ),
        ("Feedbacks and edits are welcome", "Feedback and corrections are welcome."),
        (
            "If you enjoyed this blog, please click the \U0001f44f button and share it to help others find it.",
            "If this article helped, share it with another researcher who might find it useful.",
        ),
    ),
    "2b3dbe9fa0b8": (
        (
            "Hello hunters, In this blog, I will help you setup-up Autozie and Autorepeater to find IDORs with the help of Burp Suite, but first a little detail about What is IDOR?",
            "Hello hunters. In this article, I\u2019ll show you how to set up Autorize and AutoRepeater for IDOR testing in Burp Suite. First, let\u2019s define IDOR.",
        ),
        (
            "You can Install Autorize and Autorepeater from the Bapp store in Extender tab",
            "You can install Autorize and AutoRepeater from the BApp Store in the Extender tab.",
        ),
        (
            "For more details about the tools, you can check it on Github",
            "For more information about the tools, see their GitHub repositories.",
        ),
        (
            "Autorize \u2014 For Each Request you do, it will send an equal request But with changed cookies of the session or any additional header used for authorization.",
            "Autorize sends a matching request with a different session cookie or another authorization header for comparison.",
        ),
        (
            "Add the scope filter so that we can get good/healthy results as clear as possible and we can avoid getting garbage results on our little screen.",
            "Add a scope filter to keep the results focused and reduce unrelated traffic.",
        ),
        (
            "Turn ON the Autorize and surf the WebApp with User A and requests with start flowing through autorize",
            "Turn on Autorize and browse the web application as User A; requests will begin flowing through the extension.",
        ),
        (
            "As in the above image you can see, I\u2019ve added the cookie of User B and suffering the web app with User A and there are no changes the Original length and Modified length with 200 OK status code so there can be the possibility of IDOR.",
            "As shown above, I added User B\u2019s cookie and browsed the web application as User A. When the original and modified responses have the same length and both return 200 OK, there may be an IDOR.",
        ),
        (
            "If you get 403 Forbidden error on the Modified length then there is No IDOR possibility and that\u2019s a NO GO",
            "If the modified request returns 403 Forbidden, there is no IDOR in that request, so it is a no-go.",
        ),
        (
            "This a just a complicated version of Autorize, which is used for more precise and specific results.",
            "AutoRepeater is a more configurable companion to Autorize for precise, targeted replacements.",
        ),
        (
            "Like changing the uuid of a user everytime manually can be a bit difficult.",
            "Changing a user\u2019s UUID manually for every request can be tedious.",
        ),
        (
            "Combining these two can check the functionality not only inside tenant but also a cross tenant at the same time.",
            "Combining the two can test functionality both within a tenant and across tenants.",
        ),
        ("Feedbacks and edits are welcome", "Feedback and corrections are welcome."),
        (
            "If you enjoyed this blog, please click the \U0001f44f button and share to help others find it.",
            "If this article helped, share it with another researcher who might find it useful.",
        ),
    ),
}


def arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--feed", type=Path, help="Use a previously downloaded Medium RSS file")
    parser.add_argument(
        "--refresh-existing-copy",
        action="store_true",
        help="Apply the reviewed editorial layer to existing generated pages and their source lock",
    )
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


def normalized_string(value: str) -> str:
    """Normalize whitespace in one text node without interpreting angle brackets as HTML."""
    return re.sub(r"\s+", " ", str(value)).strip()


def apply_editorial_refresh(soup, post: Post, source_hash: str | None = None):
    """Apply the reviewed copy edits while preserving every surrounding HTML element."""
    reviewed_source_hash = REVIEWED_SOURCE_TEXT_SHA256[post.post_id]
    if source_hash is not None and source_hash != reviewed_source_hash:
        raise RuntimeError(
            f"Source text changed before editorial review for {post.post_id}: "
            f"expected {reviewed_source_hash}, got {source_hash}"
        )

    for old, new in EDITORIAL_TEXT_REPLACEMENTS[post.post_id]:
        text_nodes = [node for node in soup.find_all(string=True) if node.parent.name not in {"script", "style"}]
        old_matches = [node for node in text_nodes if normalized_string(node) == old]
        new_matches = [node for node in text_nodes if normalized_string(node) == new]
        ascii_new = normalized_string(ascii_copy(new))
        ascii_matches = [node for node in text_nodes if normalized_string(node) == ascii_new]
        if len(old_matches) == 1 and not new_matches:
            node = old_matches[0]
            raw = str(node)
            leading = re.match(r"\s*", raw).group(0)
            trailing = re.search(r"\s*$", raw).group(0)
            if new.startswith((",", ".", ";", ":", "!", "?", ")", "]", "}", "\u201d")):
                leading = ""
            node.replace_with(f"{leading}{new}{trailing}")
            continue
        if not old_matches and len(new_matches) == 1:
            # The transform is intentionally idempotent for maintainer reruns.
            continue
        if not old_matches and not new_matches and len(ascii_matches) == 1:
            # A previous refresh may already have normalized the reviewed copy.
            continue
        raise RuntimeError(
            f"Editorial replacement drifted for {post.post_id}: {old!r} "
            f"({len(old_matches)} source matches, {len(new_matches)} edited matches, "
            f"{len(ascii_matches)} ASCII matches)"
        )
    soup = ascii_soup(soup)
    return soup, text_hash(soup)


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
        clean_canonical(candidate.canonical): candidate.public_path for candidate in POSTS
    }
    for link in soup.find_all("a"):
        href = link.get("href", "")
        if href and urllib.parse.urlsplit(href).scheme not in {"http", "https", "mailto"}:
            raise RuntimeError(f"Unexpected link scheme in {post.post_id}: {href}")
        source_article = clean_canonical(href) if href.startswith(("http://", "https://")) else ""
        local_article = first_party_articles.get(source_article)
        if not local_article and source_article:
            local_article = next(
                (candidate.public_path for candidate in POSTS if candidate.post_id in source_article),
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
    return json.dumps(value, ensure_ascii=True, indent=2).replace("</", "<\\/")


def social_image_metadata(post: Post) -> tuple[str, str, int, int, str, str, str]:
    """Describe the reviewed archive cover used on-page and in social cards."""
    try:
        source, alt, caption = ARCHIVE_COVERS[post.post_id]
    except KeyError as error:
        raise RuntimeError(f"Missing reviewed archive cover: {post.post_id}") from error
    image_path = ROOT / source.lstrip("/")
    if not image_path.is_file():
        raise RuntimeError(f"Missing archive cover asset: {source}")
    with Image.open(image_path) as image:
        width, height = image.size
    if (width, height) != (1200, 630):
        raise RuntimeError(f"Archive cover must be 1200x630: {source} ({width}x{height})")
    return source, f"https://balhence.com{source}", width, height, "image/jpeg", alt, caption


def page_html(post: Post, title: str, creator: str, categories: list[str], body, body_hash: str, minutes: int) -> str:
    local_url = f"https://balhence.com{post.public_path}"
    cover_source, og_image, og_image_width, og_image_height, og_image_type, og_image_alt, cover_caption = social_image_metadata(post)
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
                "author": {"@id": "https://balhence.com/about#researcher"},
                "publisher": {"@id": "https://balhence.com/#organization"},
                "isPartOf": {"@id": "https://balhence.com/blogs#bug-bounty-archive"},
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
                        "item": "https://balhence.com/blogs#bug-bounty-archive",
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
                "@id": "https://balhence.com/about#researcher",
                "name": "Aditya Soni",
                "alternateName": "HeTroubleHacker",
                "url": "https://balhence.com/about#researcher",
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
  <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' https://www.googletagmanager.com https://giscus.app; style-src 'self'; img-src 'self' data: https://*.google-analytics.com; frame-src https://cdn.embedly.com https://giscus.app; connect-src 'self' https://formspree.io https://*.google-analytics.com https://www.googletagmanager.com; object-src 'self'; base-uri 'self'; form-action https://formspree.io">
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
  <meta property="og:image:width" content="{og_image_width}">
  <meta property="og:image:height" content="{og_image_height}">
  <meta property="og:image:type" content="{og_image_type}">
  <meta property="og:image:alt" content="{escaped(og_image_alt)}">
  <meta property="article:published_time" content="{post.published}">
  <meta property="article:modified_time" content="{LOCAL_MODIFIED}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="{escaped(title)}">
  <meta name="twitter:description" content="{escaped(description)}">
  <meta name="twitter:image" content="{escaped(og_image)}">
  <meta name="twitter:image:alt" content="{escaped(og_image_alt)}">
  <link rel="icon" href="/favicon.png" type="image/png" sizes="96x96">
  <link rel="apple-touch-icon" href="/apple-touch-icon.png" sizes="180x180">
  <link rel="manifest" href="/site.webmanifest">
  <link rel="stylesheet" href="/styles.css?v=20261116c">
  <link rel="stylesheet" href="/motion.css?v=20260930b">
  <link rel="stylesheet" href="/flow.css?v=20261001b">
  <link rel="stylesheet" href="/type-field.css?v=20261001f">
  <script async src="/type-field.js?v=20261116a"></script>
  <script type="application/ld+json">
{json_script(structured)}
  </script>
</head>
<body data-page="insights" class="research-archive-post archive-article">
  <a class="skip-link" href="#main-content">Skip to content</a>
  <header class="site-header" data-site-header><nav class="container nav-shell" aria-label="Primary navigation"><a class="brand" href="/" aria-label="Balhence home"><span class="brand-mark" aria-hidden="true">B/</span><span>Balhence</span></a><div class="nav-menu" id="primary-menu" data-menu><ul class="nav-links"><li><a href="/services" data-nav="services">Services</a></li><li><details class="nav-solutions" data-solutions-menu><summary>Solutions</summary><ul class="solutions-links"><li><a href="/attack-path-validation">Recurring attack validation</a></li><li><a href="/compliance-penetration-testing">Compliance testing</a></li><li><a href="/soc-2-penetration-testing">SOC 2 penetration testing</a></li><li><a href="/pci-dss-penetration-testing">PCI DSS testing</a></li><li><a href="/hipaa-penetration-testing">HIPAA testing</a></li><li><a href="/ai-llm-penetration-testing">AI &amp; LLM testing</a></li><li><a href="/cloud-penetration-testing">Cloud penetration testing</a></li><li><a href="/network-penetration-testing">Network penetration testing</a></li><li><a href="/penetration-testing-as-a-service">PTaaS &amp; scheduled testing</a></li><li><a href="/penetration-testing-india">Services for India teams</a></li><li><a href="/penetration-testing-services-usa">Services for US teams</a></li></ul></details></li><li><a href="/about" data-nav="about">About</a></li><li><a href="/pricing" data-nav="pricing">Pricing</a></li><li><a href="/blogs" data-nav="insights">Research</a></li><li><a href="/contact" data-nav="contact">Contact</a></li></ul><a class="btn btn-primary" href="/book-a-call?source=nav-call" data-nav="book-call" data-track="nav_book_call">Book a call</a></div><button class="menu-toggle" type="button" aria-label="Open menu" aria-controls="primary-menu" aria-expanded="false" data-menu-toggle><span></span><span></span></button></nav></header>

  <main id="main-content">
    <article>
      <header class="article-hero archive-article-hero"><div class="container-narrow"><nav class="article-byline" aria-label="Breadcrumb"><a href="/">Home</a><span aria-hidden="true">/</span><a href="/blogs#bug-bounty-archive">Bug Bounty Archive</a><span aria-hidden="true">/</span><span aria-current="page">{escaped(title)}</span></nav><span class="eyebrow">Bug bounty archive / Original research</span><h1>{escaped(title)}</h1><p class="article-deck">Practical security research by Aditya Soni / HeTroubleHacker.</p><div class="article-byline"><span>By <a href="/about#researcher">Aditya Soni / HeTroubleHacker</a></span><span>Published <time datetime="{post.published}">{date_label(post.published)}</time></span><span>{minutes} min read</span></div></div></header>

      <div class="article-body"><div class="container article-layout">
        <nav class="article-toc" aria-label="Article details"><strong>In this article</strong><a href="#research-article">Read the research</a><a href="/blogs#bug-bounty-archive">Bug bounty archive</a><a href="/about#researcher">About Aditya</a></nav>
        <div class="article-content archive-article-content research-article-content">
          <figure class="research-cover-figure" data-archive-cover><img src="{escaped(cover_source)}" width="{og_image_width}" height="{og_image_height}" loading="lazy" decoding="async" alt="{escaped(og_image_alt)}"><figcaption>{escaped(cover_caption)}</figcaption></figure>
          <div class="research-article-body" id="research-article" data-research-post-id="{post.post_id}" data-research-text-sha256="{body_hash}">
{str(body)}
          </div>
          <aside class="research-author-note" aria-labelledby="archive-author-title"><span class="eyebrow">About the author</span><h2 id="archive-author-title">Aditya Soni / HeTroubleHacker</h2><p>Aditya is a product security professional and independent security researcher focused on web and API security, penetration testing, vulnerability validation, and responsible disclosure.</p><div class="button-row"><a class="btn btn-secondary" href="/about#researcher">View the researcher profile</a><a class="btn btn-secondary" href="/blogs#bug-bounty-archive">Bug bounty archive</a></div></aside>
          <div class="article-cta"><span class="eyebrow">Continue reading</span><h2>From research to a scoped assessment.</h2><p>Explore {escaped(post.related_label)} or browse the full Bug Bounty Archive for more evidence-focused research.</p><div class="button-row"><a class="btn btn-primary" href="{escaped(post.related_url)}">{escaped(post.related_label)}</a><a class="btn btn-quiet" href="/blogs#bug-bounty-archive">Bug bounty archive</a></div></div>
          <p class="research-topic-line"><strong>Research topics:</strong> {escaped(tags)}</p>
        </div>
      </div></div>
    </article>
  </main>

  <footer class="site-footer"><div class="container"><div class="footer-grid"><div class="footer-brand"><a class="brand" href="/"><span class="brand-mark" aria-hidden="true">B/</span><span>Balhence</span></a><p>Researcher-led testing. Human-validated evidence.</p></div><div class="footer-column"><h2>Explore</h2><ul class="footer-links"><li><a href="/services">Services</a></li><li><a href="/pricing">Pricing</a></li><li><a href="/attack-path-validation">Attack-path validation</a></li><li><a href="/soc-2-penetration-testing">SOC 2 testing</a></li><li><a href="/ai-llm-penetration-testing">AI &amp; LLM testing</a></li><li><a href="/cloud-penetration-testing">Cloud penetration testing</a></li><li><a href="/network-penetration-testing">Network penetration testing</a></li><li><a href="/penetration-testing-as-a-service">PTaaS</a></li><li><a href="/penetration-testing-india">India services</a></li><li><a href="/penetration-testing-services-usa">US services</a></li><li><a href="/about">About</a></li><li><a href="/contact">Contact</a></li></ul></div><div class="footer-column"><h2>Proof &amp; trust</h2><ul class="footer-links"><li><a href="/scope-builder">Scope planner</a></li><li><a href="/report-viewer">Sample report</a></li><li><a href="/trust">Trust &amp; data handling</a></li><li><a href="/blog">Practical guides</a></li><li><a href="/blogs#bug-bounty-archive">Bug bounty archive</a></li><li><a href="/privacy">Privacy</a></li></ul></div><div class="footer-column"><h2>Contact</h2><ul class="footer-links"><li><a href="/book-a-call">Book a security scoping call</a></li><li><a href="mailto:contact@balhence.com">contact@balhence.com</a></li><li>Remote engagements for India and US teams</li></ul></div></div><div class="footer-bottom"><span>(c) <span data-current-year>2026</span> Balhence. All rights reserved.</span><span>Test only with written authorization.</span></div></div></footer>
  <script src="/config.js?v=20261116d"></script><script src="/app.js?v=20261116d"></script><script src="/motion.js?v=20261001b"></script><script src="/flow.js?v=20261001b"></script>
  <script src="/article-engagement.js?v=20261116a"></script>
</body>
</html>
'''


def refresh_existing_copy() -> None:
    """Apply reviewed copy edits without refetching source pages or image assets."""
    fixture = ROOT / "tests/fixtures/medium-import-manifest.json"
    if not fixture.is_file():
        raise SystemExit("Reviewed source lock is missing")
    manifest = json.loads(fixture.read_text(encoding="utf-8"))
    records = {item["path"]: item for item in manifest}
    expected_paths = {post.output for post in POSTS}
    if set(records) != expected_paths:
        raise RuntimeError("Medium source-lock paths do not match the configured post inventory")

    refreshed = []
    for post in POSTS:
        record = records[post.output]
        output = ROOT / post.output
        source = output.read_text(encoding="utf-8")
        # html5lib preserves void elements such as <img/> beside figcaptions.
        # Python's basic HTML parser can incorrectly nest the caption inside
        # the image, which makes byte-isolated copy refreshes impossible.
        document = BeautifulSoup(source, "html5lib")
        body = document.select_one(
            f'.research-article-body[data-research-post-id="{post.post_id}"]'
        )
        if body is None:
            raise RuntimeError(f"Research body is missing for {post.output}")

        declared_hash = body.get("data-research-text-sha256", "")
        current_hash = text_hash(body)
        if declared_hash != current_hash:
            raise RuntimeError(
                f"Declared body hash does not match rendered copy in {post.output}: "
                f"{declared_hash} != {current_hash}"
            )
        allowed_hashes = {
            REVIEWED_SOURCE_TEXT_SHA256[post.post_id],
            record["text_sha256"],
            record.get("source_text_sha256", REVIEWED_SOURCE_TEXT_SHA256[post.post_id]),
        }
        if current_hash not in allowed_hashes:
            raise RuntimeError(f"Unreviewed copy drift in {post.output}: {current_hash}")

        original_contents = body.decode_contents()
        body, edited_hash = apply_editorial_refresh(body, post)
        edited_contents = body.decode_contents()
        if source.count(original_contents) != 1:
            raise RuntimeError(f"Could not isolate the generated article body in {post.output}")
        source = source.replace(original_contents, edited_contents, 1)

        hash_attribute = f'data-research-text-sha256="{declared_hash}"'
        if source.count(hash_attribute) != 1:
            raise RuntimeError(f"Could not isolate the body hash in {post.output}")
        source = source.replace(
            hash_attribute,
            f'data-research-text-sha256="{edited_hash}"',
            1,
        )
        source, meta_updates = re.subn(
            r'(<meta property="article:modified_time" content=")[^"]+("\s*/?>)',
            rf'\g<1>{LOCAL_MODIFIED}\g<2>',
            source,
        )
        source, schema_updates = re.subn(
            r'("dateModified": ")[^"]+("[,}])',
            rf'\g<1>{LOCAL_MODIFIED}\g<2>',
            source,
        )
        if meta_updates != 1 or schema_updates != 2:
            raise RuntimeError(
                f"Unexpected modified-date inventory in {post.output}: "
                f"meta={meta_updates}, schema={schema_updates}"
            )
        source = ascii_copy(source)
        if not source.isascii():
            raise RuntimeError(f"Generated page is not ASCII-only: {post.output}")
        output.write_text(source, encoding="utf-8")

        words, _ = words_and_minutes(body)
        updated_record = {}
        for key, value in record.items():
            if key == "source_text_sha256":
                continue
            if key == "local_modified":
                value = LOCAL_MODIFIED
            if key == "title":
                value = ascii_copy(value)
            if key == "text_sha256":
                updated_record["source_text_sha256"] = REVIEWED_SOURCE_TEXT_SHA256[post.post_id]
                value = edited_hash
            if key == "words":
                value = words
            updated_record[key] = value
        refreshed.append(updated_record)
        print(f"{post.output}: refreshed copy, {words} words, {edited_hash}")

    fixture.write_text(json.dumps(refreshed, ensure_ascii=True, indent=2) + "\n", encoding="utf-8")
    print(f"Updated reviewed editorial lock: {fixture.relative_to(ROOT)}")


def main() -> None:
    args = arguments()
    if args.refresh_existing_copy:
        if args.feed or args.update_manifest:
            raise SystemExit("--refresh-existing-copy cannot be combined with feed import options")
        refresh_existing_copy()
        return
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
        title = ascii_copy(item.findtext("title", "").strip())
        creator = ascii_copy(item.findtext(f"{{{DC_NAMESPACE}}}creator", "").strip())
        if creator != "Aditya Soni":
            raise SystemExit(f"Unexpected creator for {post.post_id}: {creator}")
        canonical = clean_canonical(item.findtext("link", ""))
        if canonical != post.canonical:
            raise SystemExit(f"Canonical changed for {post.post_id}: {canonical}")
        raw = item.findtext(f"{{{CONTENT_NAMESPACE}}}encoded", "")
        body, source_hash, image_count = sanitize_body(raw, post)
        body, body_hash = apply_editorial_refresh(body, post, source_hash)
        words, minutes = words_and_minutes(body)
        output = ROOT / post.output
        output.parent.mkdir(parents=True, exist_ok=True)
        categories = [ascii_copy(node.text or "") for node in item.findall("category")]
        page_source = ascii_copy(page_html(post, title, creator, categories, body, body_hash, minutes))
        if not page_source.isascii():
            raise RuntimeError(f"Generated page is not ASCII-only: {post.output}")
        output.write_text(page_source, encoding="utf-8")
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
                "source_text_sha256": source_hash,
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
        fixture.write_text(json.dumps(manifest, ensure_ascii=True, indent=2) + "\n", encoding="utf-8")
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
