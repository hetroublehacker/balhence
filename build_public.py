#!/usr/bin/env python3
"""Build an allowlisted public artifact for Balhence Pages deployment."""

from __future__ import annotations

import argparse
import os
import shutil
import stat
import tempfile
from pathlib import Path, PurePosixPath


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
    "blogs.html",
    "case-studies.css",
    "case-studies.js",
    "config.js",
    "contact-brief.css",
    "contact-brief.js",
    "contact.html",
    "ctf.html",
    "experience.css",
    "experience.js",
    "favicon.svg",
    "home.css",
    "home.js",
    "index.html",
    "insights/ai-native-penetration-testing-human-validated.html",
    "insights/draft-write-authorization.html",
    "insights/evidence-gated-workflows.html",
    "insights/how-to-scope-web-api-pentest.html",
    "insights/private-response-cache-boundary.html",
    "insights/saas-vapt-readiness-checklist.html",
    "insights/server-owned-validation-rules.html",
    "insights/session-authority-boundary.html",
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
    # Check the lexical path before resolve() can hide a dangling link.
    if any(part.is_symlink() for part in (output, *output.parents)):
        raise SystemExit("error: output cannot contain a symbolic link")
    output = output.resolve(strict=False)

    forbidden = {Path("/"), Path.home().resolve(), SOURCE_ROOT}
    if output in forbidden or output in SOURCE_ROOT.parents:
        raise SystemExit("error: output cannot be the site root, home directory, filesystem root, or their parent")
    if output.exists() or output.is_symlink():
        raise SystemExit(f"error: output already exists; choose a new empty path: {output}")
    if SOURCE_ROOT in output.parents:
        relative = output.relative_to(SOURCE_ROOT)
        if relative.parts and relative.parts[0] in {
            ".git", ".github", "vendor", "insights", ".well-known", "tests",
            "website", "website-tools", "website-backups",
        }:
            raise SystemExit("error: output cannot replace a source or repository directory")
    return output


def public_source(root: Path, relative: str) -> Path:
    """Resolve one allowlisted regular file without following any symlink."""
    public_path = PurePosixPath(relative)
    if (
        not relative or public_path.is_absolute() or ".." in public_path.parts
        or public_path.as_posix() != relative or "\\" in relative
    ):
        raise ValueError(f"invalid public asset path: {relative}")
    current = root
    for part in public_path.parts:
        current = current / part
        if current.is_symlink():
            raise ValueError(f"linked public asset or parent directory: {relative}")
    if not stat.S_ISREG(current.stat().st_mode):
        raise ValueError(f"public asset is not a regular file: {relative}")
    current.resolve().relative_to(root.resolve())
    return current


def validate_sources(root: Path | None = None) -> None:
    root = SOURCE_ROOT if root is None else root
    if len(PUBLIC_FILES) != len(PUBLIC_FILE_SET):
        raise SystemExit("error: duplicate path in PUBLIC_FILES")
    for relative in PUBLIC_FILES:
        try:
            public_source(root, relative)
        except (OSError, RuntimeError, ValueError) as error:
            raise SystemExit(f"error: unsafe or missing public asset {relative}: {error}") from error


def build(output: Path) -> None:
    output = resolve_output(output)
    validate_sources()
    output.parent.mkdir(parents=True, exist_ok=True)
    staging = Path(tempfile.mkdtemp(prefix=f".{output.name}.tmp-", dir=output.parent))
    reserved_output = False
    try:
        for relative in PUBLIC_FILES:
            source = public_source(SOURCE_ROOT, relative)
            destination = staging / relative
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(source, destination, follow_symlinks=False)

        # Check the copied bytes' paths too: a source changed to a symlink
        # during copy must never turn into a linked release asset.
        for relative in PUBLIC_FILES:
            public_source(staging, relative)
        actual = frozenset(
            str(path.relative_to(staging))
            for path in staging.rglob("*")
            if path.is_file()
        )
        if actual != PUBLIC_FILE_SET:
            missing = sorted(PUBLIC_FILE_SET - actual)
            extra = sorted(actual - PUBLIC_FILE_SET)
            raise RuntimeError(f"artifact manifest mismatch; missing={missing}, extra={extra}")
        # mkdir is an exclusive claim: rename/replace alone may overwrite an
        # empty directory created after the initial output-path check.
        output.mkdir()
        reserved_output = True
        for child in staging.iterdir():
            os.rename(child, output / child.name)
        staging.rmdir()
    except Exception:
        if staging.exists():
            shutil.rmtree(staging)
        if reserved_output:
            shutil.rmtree(output)
        raise


def main() -> None:
    args = parse_args()
    output = resolve_output(args.output)
    build(output)
    print(f"Built {len(PUBLIC_FILES)} public files in {output}")


if __name__ == "__main__":
    main()
