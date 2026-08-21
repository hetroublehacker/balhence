#!/usr/bin/env python3
"""Build an allowlisted public artifact for Balhence Pages deployment."""

from __future__ import annotations

import argparse
import os
import shutil
import tempfile
from pathlib import Path


SOURCE_ROOT = Path(__file__).resolve().parent
PUBLIC_FILES = (
    ".nojekyll",
    ".well-known/security.txt",
    "404.html",
    "CNAME",
    "about.html",
    "api-penetration-testing.html",
    "app.js",
    "blog.html",
    "config.js",
    "contact-brief.css",
    "contact-brief.js",
    "contact.html",
    "ctf.html",
    "experience.css",
    "experience.js",
    "favicon.svg",
    "index.html",
    "insights/ai-native-penetration-testing-human-validated.html",
    "insights/how-to-scope-web-api-pentest.html",
    "insights/saas-vapt-readiness-checklist.html",
    "insights/web-api-pentest-cost-scope-guide.html",
    "insights/what-good-pentest-report-includes.html",
    "logo.svg",
    "motion.css",
    "motion.js",
    "og-ai-native-pentesting.png",
    "og-image.png",
    "og-pentest-cost-scope.png",
    "og-pentest-report.png",
    "og-saas-pentest-readiness.png",
    "og-scope-pentest.png",
    "privacy.html",
    "report-explorer.css",
    "report-explorer.js",
    "report-viewer.html",
    "robots.txt",
    "sample-vapt-report.pdf",
    "scope-builder.css",
    "scope-builder.html",
    "scope-builder.js",
    "scope-lab.css",
    "scope-lab.js",
    "scope-pdf.js",
    "services.html",
    "site.webmanifest",
    "sitemap.xml",
    "styles.css",
    "vendor/ScrollTrigger-3.15.0.min.js",
    "vendor/gsap-3.15.0.min.js",
    "vendor/jspdf-4.2.1.umd.min.js",
    "vendor/three-experience-0.185.1.module.min.js",
    "web-application-penetration-testing.html",
)
PUBLIC_FILE_SET = frozenset(PUBLIC_FILES)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build the allowlisted Balhence public site artifact.")
    parser.add_argument("--output", type=Path, default=Path("_site"), help="New output directory, default: _site")
    return parser.parse_args()


def resolve_output(value: Path) -> Path:
    output = value.expanduser()
    if not output.is_absolute():
        output = SOURCE_ROOT / output
    output = output.resolve(strict=False)

    forbidden = {Path("/"), Path.home().resolve(), SOURCE_ROOT}
    if output in forbidden or output in SOURCE_ROOT.parents:
        raise SystemExit("error: output cannot be the site root, home directory, filesystem root, or their parent")
    if output.exists() or output.is_symlink():
        raise SystemExit(f"error: output already exists; choose a new empty path: {output}")
    if SOURCE_ROOT in output.parents:
        relative = output.relative_to(SOURCE_ROOT)
        if relative.parts and relative.parts[0] in {".git", ".github", "vendor", "insights", ".well-known"}:
            raise SystemExit("error: output cannot replace a source or repository directory")
    return output


def validate_sources() -> None:
    if len(PUBLIC_FILES) != len(PUBLIC_FILE_SET):
        raise SystemExit("error: duplicate path in PUBLIC_FILES")
    for relative in PUBLIC_FILES:
        path = SOURCE_ROOT / relative
        if path.is_symlink() or not path.is_file():
            raise SystemExit(f"error: missing, linked, or non-file public asset: {relative}")
        try:
            path.resolve().relative_to(SOURCE_ROOT)
        except ValueError as error:
            raise SystemExit(f"error: public asset resolves outside the site root: {relative}") from error


def build(output: Path) -> None:
    validate_sources()
    output.parent.mkdir(parents=True, exist_ok=True)
    staging = Path(tempfile.mkdtemp(prefix=f".{output.name}.tmp-", dir=output.parent))
    try:
        for relative in PUBLIC_FILES:
            source = SOURCE_ROOT / relative
            destination = staging / relative
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(source, destination, follow_symlinks=False)

        actual = frozenset(
            str(path.relative_to(staging))
            for path in staging.rglob("*")
            if path.is_file()
        )
        if actual != PUBLIC_FILE_SET:
            missing = sorted(PUBLIC_FILE_SET - actual)
            extra = sorted(actual - PUBLIC_FILE_SET)
            raise RuntimeError(f"artifact manifest mismatch; missing={missing}, extra={extra}")
        os.replace(staging, output)
    except Exception:
        if staging.exists():
            shutil.rmtree(staging)
        raise


def main() -> None:
    args = parse_args()
    output = resolve_output(args.output)
    build(output)
    print(f"Built {len(PUBLIC_FILES)} public files in {output}")


if __name__ == "__main__":
    main()
