#!/usr/bin/env python3
"""Split and chroma-key the generated 4x4 accessory atlas.

Every result keeps the same 418x418 avatar coordinate system.  The tiny
feather/wing contact area generated with hand-held items is intentionally kept:
it makes the object read as gripped or worn instead of floating in front.
"""

from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets" / "pets"
SOURCE = ASSETS / "source-accessory-atlas-green.png"
NAMES = [
    "watergun", "sword", "wand", "shield",
    "backpack", "cape", "medal", "pearls",
    "friendship", "watch", "sportband", "flowers",
    "rainboots", "winged-sneakers", "hero-boots", "utility-belt",
]

# left, top, max width, max height on the common 418px avatar stage.
PLACEMENTS = {
    "watergun": (172, 185, 224, 138),
    "sword": (244, 84, 132, 225),
    "wand": (246, 105, 118, 198),
    "shield": (18, 165, 172, 170),
    "backpack": (90, 126, 236, 224),
    "cape": (91, 130, 235, 218),
    "medal": (142, 142, 134, 126),
    "pearls": (135, 137, 148, 123),
    "friendship": (279, 220, 100, 83),
    "watch": (280, 219, 96, 84),
    "sportband": (279, 221, 98, 82),
    "flowers": (278, 218, 102, 87),
    "rainboots": (133, 301, 152, 96),
    "winged-sneakers": (126, 302, 167, 94),
    "hero-boots": (132, 300, 154, 98),
    "utility-belt": (118, 268, 182, 82),
}


def remove_green(image: Image.Image) -> Image.Image:
    image = image.convert("RGBA")
    px = image.load()
    for y in range(image.height):
        for x in range(image.width):
            r, g, b, _ = px[x, y]
            dominance = g - max(r, b)
            if g > 138 and dominance > 34:
                # Feathered transition avoids a fluorescent halo.
                alpha = max(0, min(255, int(255 - (dominance - 34) * 4.1)))
                px[x, y] = (r, min(g, max(r, b)), b, alpha)
    return image


def main() -> None:
    sheet = Image.open(SOURCE).convert("RGBA")
    for i, name in enumerate(NAMES):
        col, row = i % 4, i // 4
        left = round(col * sheet.width / 4)
        right = round((col + 1) * sheet.width / 4)
        top = round(row * sheet.height / 4)
        bottom = round((row + 1) * sheet.height / 4)
        cell = remove_green(sheet.crop((left, top, right, bottom)))
        alpha = cell.getchannel("A").point(lambda v: 255 if v > 18 else 0)
        bbox = alpha.getbbox()
        if not bbox:
            raise RuntimeError(f"No accessory pixels found for {name}")
        item = cell.crop(bbox)
        px, py, mw, mh = PLACEMENTS[name]
        item.thumbnail((mw, mh), Image.Resampling.LANCZOS)
        stage = Image.new("RGBA", (418, 418), (0, 0, 0, 0))
        x = px + (mw - item.width) // 2
        y = py + (mh - item.height) // 2
        stage.alpha_composite(item, (x, y))
        stage.save(ASSETS / f"presence-accessory-{name}.png", "PNG")
    print(f"Built {len(NAMES)} fitted accessory layers")


if __name__ == "__main__":
    main()
