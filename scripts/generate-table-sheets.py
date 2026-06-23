#!/usr/bin/env python3
"""Generate table-resolution card sprite sheets.

The full sheetNN.png files are 1024x1536 (512x768 per tile, 2x2 grid). On the
table, cards render at ~100-130px, so the browser was downscaling each painted
tile ~4x at draw time -- harsh under the hand's rotate transforms. This bakes a
high-quality Lanczos downscale offline to sheetNN.small.webp (300x450 per tile),
which the in-hand / spread / market / multiplayer cards use. WebP keeps the
table sheets tiny (~150KB each vs ~3MB PNG). The full PNG sheets are kept for
the card-detail modal, which renders large enough to want them.

Re-run after replacing any sheet art:

    python3 scripts/generate-table-sheets.py
"""

import pathlib
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parent.parent
# 600x900 sheet = 300x450 per tile (2:3), ~2.3x the largest on-table card so it
# stays crisp on high-DPR phones while shedding most of the source weight.
TARGET = (600, 900)

def main():
    for n in range(1, 11):
        src = ROOT / f"sheet{n:02d}.png"
        if not src.exists():
            print(f"skip {src.name}: missing")
            continue
        out = ROOT / f"sheet{n:02d}.small.webp"
        img = Image.open(src).convert("RGB")
        small = img.resize(TARGET, Image.LANCZOS)
        small.save(out, "WEBP", quality=86, method=6)
        print(f"{src.name} {img.size} -> {out.name} {small.size} "
              f"({out.stat().st_size // 1024} KB)")

if __name__ == "__main__":
    main()
