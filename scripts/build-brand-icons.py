#!/usr/bin/env python3
"""Rasterize the vector favicon. Requires Pillow and CairoSVG for regeneration."""

from io import BytesIO
from pathlib import Path

import cairosvg
from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "favicon.svg"


def render(size: int) -> Image.Image:
    # The favicon source fills its complete square. RGB makes every exported
    # pixel opaque, including corners, before a search surface crops it.
    png = cairosvg.svg2png(url=str(SOURCE), output_width=size, output_height=size)
    return Image.open(BytesIO(png)).convert("RGB")


def main() -> None:
    for filename, size in (
        ("favicon.png", 96),
        ("apple-touch-icon.png", 180),
        ("icon-192.png", 192),
        ("logo.png", 512),
    ):
        render(size).save(ROOT / filename, optimize=True)
    render(512).save(
        ROOT / "favicon.ico",
        format="ICO",
        sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)],
    )
    print("Built opaque PNG and ICO icons from favicon.svg")


if __name__ == "__main__":
    main()
