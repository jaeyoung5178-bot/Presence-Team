#!/usr/bin/env python3
"""Build texture-preserving chick colour and feather-style assets.

The source chick stays untouched.  Colour variants only recolour warm, bright
feather pixels, leaving eyes, beak and comb intact.  Feather styles are cut
from the generated chroma-key sheet and placed on the same 418px stage as the
wardrobe layers.
"""

from __future__ import annotations

from pathlib import Path
from PIL import Image, ImageEnhance


ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets" / "pets"
BASE = ASSETS / "presence-pet-base.png"
FEATHER_SHEET = ASSETS / "source-feather-styles-alpha.png"

COLOURS = {
    "honey": (255, 214, 92),
    "vanilla": (255, 237, 184),
    "cream": (241, 221, 174),
    "peach": (255, 185, 137),
    "coral": (244, 153, 126),
    "rose": (235, 159, 178),
    "lilac": (196, 168, 224),
    "sky": (158, 202, 231),
    "mint": (157, 216, 186),
    "sage": (176, 201, 158),
    "silver": (201, 207, 214),
    "cocoa": (191, 154, 111),
}

# width, height, top offset — tuned for the shared 418x418 avatar stage.
FEATHERS = {
    "classic": (138, 104, 19),
    "cloud": (184, 94, 38),
    "sweep": (176, 92, 43),
    "mohawk": (128, 126, 12),
    "bob": (211, 106, 42),
    "twins": (158, 82, 35),
    "wave": (172, 120, 27),
    "plume": (112, 176, 2),
}


def recolour_feathers(source: Image.Image, target: tuple[int, int, int]) -> Image.Image:
    image = source.convert("RGBA")
    px = image.load()
    tr, tg, tb = target
    for y in range(image.height):
        for x in range(image.width):
            r, g, b, a = px[x, y]
            if a < 32:
                continue
            # Recolour the complete feather silhouette, including warm edge
            # shadows.  Restore only the actual facial/foot features by their
            # geometry and colour so no rectangular patch can remain.
            comb = y < 118 and 104 < x < 314 and r > g * 1.25 and b < 115
            beak = 148 < x < 274 and 140 < y < 236 and r > g * 1.34 and b < 105
            feet = y > 346 and 92 < x < 326 and r > g * 1.34 and b < 105
            dark_detail = (r + g + b) / 3 < 74
            white_detail = min(r, g, b) > 215 and max(r, g, b) - min(r, g, b) < 30
            eye_zone = ((88 < x < 194) or (214 < x < 326)) and 94 < y < 224
            eye_detail = eye_zone and (dark_detail or b > r * 1.10 or white_detail)
            feather = (
                not (comb or beak or feet or dark_detail or white_detail or eye_detail)
            )
            if not feather:
                continue
            luminance = (0.25 * r + 0.63 * g + 0.12 * b) / 255.0
            shade = 0.48 + luminance * 0.62
            nr = min(255, int(tr * shade))
            ng = min(255, int(tg * shade))
            nb = min(255, int(tb * shade))
            # Keep fine feather texture from the original instead of a flat tint.
            detail = (r - g) * 0.18
            px[x, y] = (
                max(0, min(255, int(nr + detail))),
                max(0, min(255, int(ng + detail * 0.2))),
                max(0, min(255, int(nb - detail * 0.12))),
                a,
            )
    return ImageEnhance.Contrast(image).enhance(1.02)


def build_colours() -> None:
    source = Image.open(BASE)
    for name, target in COLOURS.items():
        out = recolour_feathers(source, target)
        # PNG avoids horizontal alpha smearing seen on a few WebKit builds
        # with lossless WebP avatar layers.
        out.save(ASSETS / f"presence-base-{name}.png", "PNG")


def alpha_bbox(image: Image.Image) -> tuple[int, int, int, int]:
    alpha = image.getchannel("A")
    bbox = alpha.point(lambda v: 255 if v > 12 else 0).getbbox()
    if not bbox:
        raise RuntimeError("Generated feather cell has no visible pixels")
    return bbox


def build_feathers() -> None:
    sheet = Image.open(FEATHER_SHEET).convert("RGBA")
    cell_w, cell_h = sheet.width // 4, sheet.height // 2
    for index, (name, (target_w, target_h, top)) in enumerate(FEATHERS.items()):
        col, row = index % 4, index // 4
        cell = sheet.crop((col * cell_w, row * cell_h, (col + 1) * cell_w, (row + 1) * cell_h))
        cell = cell.crop(alpha_bbox(cell))
        cell.thumbnail((target_w, target_h), Image.Resampling.LANCZOS)
        stage = Image.new("RGBA", (418, 418), (0, 0, 0, 0))
        left = (stage.width - cell.width) // 2
        stage.alpha_composite(cell, (left, top))
        stage.save(ASSETS / f"presence-feather-{name}.png", "PNG")


if __name__ == "__main__":
    build_colours()
    build_feathers()
    print(f"Built {len(COLOURS)} colour and {len(FEATHERS)} feather assets in {ASSETS}")
