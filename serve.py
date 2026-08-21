#!/usr/bin/env python3
"""Serve the Balhence static site safely for local preview.

This is a development server. It deliberately blocks repository metadata,
dotfiles, symlinks, directory listings, and paths outside this site root.
It speaks plain HTTP and is not a production TLS server.
"""

from __future__ import annotations

import argparse
import functools
import ipaddress
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path, PurePosixPath
from urllib.parse import unquote, urlsplit

from build_public import PUBLIC_FILE_SET


SITE_ROOT = Path(__file__).resolve().parent
ALLOWED_DOT_DIRECTORY = ".well-known"


class PreviewHandler(SimpleHTTPRequestHandler):
    server_version = "BalhencePreview/1.0"

    def version_string(self) -> str:
        return self.server_version

    def end_headers(self) -> None:
        requested_path = urlsplit(self.path).path.lower()
        permits_same_origin_embed = requested_path.endswith(".pdf")
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("X-Frame-Options", "SAMEORIGIN" if permits_same_origin_embed else "DENY")
        self.send_header(
            "Content-Security-Policy",
            "frame-ancestors 'self'" if permits_same_origin_embed else "frame-ancestors 'none'",
        )
        self.send_header("Referrer-Policy", "strict-origin-when-cross-origin")
        self.send_header("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=()")
        self.send_header("Cross-Origin-Opener-Policy", "same-origin")
        self.send_header("Cross-Origin-Resource-Policy", "same-origin")
        super().end_headers()

    def _decoded_path(self) -> str:
        value = urlsplit(self.path).path
        for _ in range(3):
            decoded = unquote(value)
            if decoded == value:
                break
            value = decoded
        return value

    def _allowed_request(self) -> bool:
        decoded = self._decoded_path()
        if "\x00" in decoded or "\\" in decoded:
            return False

        parts = PurePosixPath(decoded).parts
        for index, part in enumerate(parts):
            if part in {"", "/", "."}:
                continue
            if part == "..":
                return False
            if part.startswith(".") and not (index == 1 and part == ALLOWED_DOT_DIRECTORY):
                return False

        if decoded.endswith("/") and decoded != "/":
            return False
        relative = PurePosixPath(decoded).as_posix().lstrip("/") or "index.html"
        if relative not in PUBLIC_FILE_SET:
            return False

        try:
            candidate = Path(self.translate_path(self.path))
            resolved = candidate.resolve(strict=False)
            resolved.relative_to(SITE_ROOT)
        except (OSError, RuntimeError, ValueError):
            return False

        current = SITE_ROOT
        try:
            relative_parts = candidate.relative_to(SITE_ROOT).parts
        except ValueError:
            return False
        for part in relative_parts:
            current = current / part
            if current.is_symlink():
                return False
        return True

    def _serve(self, head_only: bool) -> None:
        if not self._allowed_request():
            self.send_error(HTTPStatus.NOT_FOUND)
            return
        if head_only:
            super().do_HEAD()
        else:
            super().do_GET()

    def do_GET(self) -> None:
        self._serve(head_only=False)

    def do_HEAD(self) -> None:
        self._serve(head_only=True)

    def list_directory(self, path: str):
        self.send_error(HTTPStatus.NOT_FOUND)
        return None

    def send_error(self, code, message=None, explain=None) -> None:
        if code != HTTPStatus.NOT_FOUND:
            super().send_error(code, message, explain)
            return

        error_page = SITE_ROOT / "404.html"
        try:
            body = error_page.read_bytes()
        except OSError:
            super().send_error(code, message, explain)
            return

        self.send_response(HTTPStatus.NOT_FOUND)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Serve the Balhence site over safe preview HTTP.")
    parser.add_argument("--port", type=int, default=8000, help="TCP port, default: 8000")
    parser.add_argument("--bind", default="127.0.0.1", help="Bind address, default: 127.0.0.1")
    return parser.parse_args()


def is_loopback(value: str) -> bool:
    if value.lower() == "localhost":
        return True
    try:
        return ipaddress.ip_address(value).is_loopback
    except ValueError:
        return False


def main() -> None:
    args = parse_args()
    if not 1 <= args.port <= 65535:
        raise SystemExit("error: --port must be between 1 and 65535")

    handler = functools.partial(PreviewHandler, directory=str(SITE_ROOT))
    server = ThreadingHTTPServer((args.bind, args.port), handler)
    origin_host = "127.0.0.1" if args.bind in {"0.0.0.0", "::"} else args.bind
    print(f"Serving {SITE_ROOT} at http://{origin_host}:{args.port}/")
    print(f"Serving the same {len(PUBLIC_FILE_SET)}-file allowlist used by the Pages build.")
    print("Plain HTTP only. Do not open this URL with https://")
    if not is_loopback(args.bind):
        print("Warning: this preview is reachable from other hosts. Use a production HTTPS host for public traffic.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
