#!/usr/bin/env python3
"""Generate Ashford Crossing placeholder art.

Section 13 of the spec sets the rule: every sprite starts as a flat coloured
shape, real art waits until after M6. These are side-view silhouettes at the
sizes the checklist calls for, drawn from one fixed palette so the strip reads
as a single scene rather than a colour test.

Building names are NOT baked into the sprites -- Building.tscn carries a Label
instead, which stays legible at any zoom and needs no font baked into a PNG.

    python3 tools/gen_placeholder_art.py

Plain stdlib: no Pillow, no downloads.
"""
import math
import os
import struct
import zlib

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), os.pardir)
ASSETS = os.path.join(ROOT, "assets")

# A trimmed Endesga-32-flavoured palette (spec section 13: pick one and stick
# to it). Every sprite in the game draws from these entries only.
PAL = {
    "sky_high": (60, 92, 138, 255),
    "sky_low": (140, 168, 190, 255),
    "hill_far": (86, 102, 120, 255),
    "hill_near": (62, 80, 92, 255),
    "dirt": (124, 96, 66, 255),
    "dirt_dark": (94, 71, 48, 255),
    "dirt_light": (154, 124, 88, 255),
    "grass": (86, 122, 74, 255),
    "stone": (128, 128, 134, 255),
    "stone_dark": (92, 92, 100, 255),
    "wood": (140, 96, 58, 255),
    "wood_dark": (98, 66, 40, 255),
    "roof": (156, 68, 60, 255),
    "roof_dark": (112, 46, 44, 255),
    "cloth": (196, 160, 92, 255),
    "gold": (222, 184, 78, 255),
    "water": (86, 152, 188, 255),
    "bread": (200, 152, 84, 255),
    "bed": (176, 180, 200, 255),
    "heart": (188, 88, 96, 255),
    "guild": (206, 158, 66, 255),
    "crown": (168, 84, 90, 255),
    "freeroad": (104, 148, 108, 255),
    "ink": (34, 34, 42, 255),
    "panel": (44, 42, 56, 240),
    "panel_edge": (96, 92, 120, 255),
    "clear": (0, 0, 0, 0),
}


# ---------------------------------------------------------------- png writer
def write_png(path, pixels):
    height = len(pixels)
    width = len(pixels[0])
    raw = b"".join(b"\x00" + bytes(c for px in row for c in px) for row in pixels)

    def chunk(tag, data):
        body = tag + data
        return struct.pack(">I", len(data)) + body + struct.pack(">I", zlib.crc32(body) & 0xFFFFFFFF)

    header = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as fh:
        fh.write(b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", header)
                 + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b""))
    print("wrote", os.path.relpath(path, ROOT))


def blank(w, h, fill=PAL["clear"]):
    return [[fill for _ in range(w)] for _ in range(h)]


def put(img, x, y, colour):
    if 0 <= y < len(img) and 0 <= x < len(img[0]) and colour[3] != 0:
        img[y][x] = colour


def rect(img, x0, y0, x1, y1, colour):
    for y in range(int(y0), int(y1)):
        for x in range(int(x0), int(x1)):
            put(img, x, y, colour)


def disc(img, cx, cy, r, colour):
    for y in range(int(cy - r), int(cy + r) + 1):
        for x in range(int(cx - r), int(cx + r) + 1):
            if (x - cx) ** 2 + (y - cy) ** 2 <= r * r:
                put(img, x, y, colour)


def gable(img, x0, x1, y_base, height, colour):
    """A pitched roof spanning x0..x1, apex `height` above y_base."""
    span = (x1 - x0) / 2.0
    for i in range(int(height)):
        t = i / float(height)
        inset = int(span * t)
        for x in range(int(x0 + inset), int(x1 - inset)):
            put(img, x, int(y_base - i), colour)


def outline(img, x0, y0, x1, y1, colour):
    for x in range(int(x0), int(x1)):
        put(img, x, int(y0), colour)
        put(img, x, int(y1) - 1, colour)
    for y in range(int(y0), int(y1)):
        put(img, int(x0), y, colour)
        put(img, int(x1) - 1, y, colour)


# -------------------------------------------------------------------- road
def gen_road():
    # Sky: a vertical gradient wide enough to fill the viewport at any scroll.
    w, h = 512, 288
    img = blank(w, h)
    for y in range(h):
        t = y / float(h - 1)
        colour = tuple(
            int(PAL["sky_high"][i] * (1 - t) + PAL["sky_low"][i] * t) for i in range(3)
        ) + (255,)
        for x in range(w):
            img[y][x] = colour
    write_png(os.path.join(ASSETS, "road", "sky.png"), img)

    # Two hill bands. Tileable horizontally: the profile is built from a sum of
    # sines whose periods divide the width exactly, so the seam matches.
    for name, colour, amp, base in (
        ("hills_far.png", PAL["hill_far"], 26, 96),
        ("hills_near.png", PAL["hill_near"], 38, 120),
    ):
        w, h = 512, 160
        img = blank(w, h)
        for x in range(w):
            t = x / float(w)
            crest = (math.sin(t * math.tau) * 0.6
                     + math.sin(t * math.tau * 2 + 1.1) * 0.3
                     + math.sin(t * math.tau * 3 + 2.4) * 0.1)
            top = int(h - base - crest * amp)
            for y in range(max(0, top), h):
                img[y][x] = colour
        write_png(os.path.join(ASSETS, "road", name), img)

    # Ground: three tileable 64x32 strips, varying only in scatter.
    for i in range(3):
        w, h = 64, 32
        img = blank(w, h)
        rect(img, 0, 0, w, 3, PAL["grass"])
        rect(img, 0, 3, w, h, PAL["dirt"])
        seed = i * 7919 + 17
        for y in range(4, h):
            for x in range(w):
                seed = (seed * 1103515245 + 12345) & 0x7FFFFFFF
                n = (seed >> 16) % 100
                if n < 6:
                    put(img, x, y, PAL["dirt_dark"])
                elif n < 11:
                    put(img, x, y, PAL["dirt_light"])
        write_png(os.path.join(ASSETS, "road", "ground_%d.png" % i), img)

    # Solid subsoil, tiled below the road so the bottom of the screen is not
    # empty. Kept separate from the road strip so it can repeat vertically
    # without dragging the grass band down with it.
    w, h = 64, 64
    img = blank(w, h)
    rect(img, 0, 0, w, h, PAL["dirt_dark"])
    seed = 991
    for y in range(h):
        for x in range(w):
            seed = (seed * 1103515245 + 12345) & 0x7FFFFFFF
            if (seed >> 16) % 100 < 7:
                put(img, x, y, PAL["dirt"])
    write_png(os.path.join(ASSETS, "road", "dirt_fill.png"), img)

    # Empty plot marker: a dashed footprint on the dirt.
    w, h = 64, 64
    img = blank(w, h)
    for x in range(2, w - 2, 6):
        rect(img, x, h - 6, min(x + 3, w - 2), h - 4, PAL["dirt_dark"])
    for y in range(h - 22, h - 6, 6):
        rect(img, 2, y, 5, min(y + 3, h - 6), PAL["dirt_dark"])
        rect(img, w - 5, y, w - 2, min(y + 3, h - 6), PAL["dirt_dark"])
    write_png(os.path.join(ASSETS, "road", "plot_empty.png"), img)


# ---------------------------------------------------------------- buildings
def building_base(img, w, h, colour, height, width_frac=0.78):
    x0 = int(w * (1 - width_frac) / 2)
    x1 = w - x0
    rect(img, x0, h - height, x1, h, colour)
    return x0, x1


def gen_buildings():
    w = h = 64

    def save(name, img):
        write_png(os.path.join(ASSETS, "buildings", name + ".png"), img)

    # Well / Deep Well
    for name, r, roof_h in (("well", 11, 12), ("well_2", 14, 16)):
        img = blank(w, h)
        rect(img, w // 2 - r, h - 16, w // 2 + r, h, PAL["stone"])
        outline(img, w // 2 - r, h - 16, w // 2 + r, h, PAL["stone_dark"])
        disc(img, w // 2, h - 16, r, PAL["water"])
        rect(img, w // 2 - r + 1, h - 18 - roof_h, w // 2 - r + 3, h - 16, PAL["wood_dark"])
        rect(img, w // 2 + r - 3, h - 18 - roof_h, w // 2 + r - 1, h - 16, PAL["wood_dark"])
        gable(img, w // 2 - r - 3, w // 2 + r + 3, h - 16 - roof_h, 10, PAL["roof"])
        save(name, img)

    # Inn / Great Inn
    for name, height, floors in (("inn", 34, 1), ("inn_2", 46, 2)):
        img = blank(w, h)
        x0, x1 = building_base(img, w, h, PAL["wood"], height)
        gable(img, x0 - 4, x1 + 4, h - height, 14, PAL["roof"])
        for f in range(floors):
            y = h - 12 - f * 16
            rect(img, x0 + 5, y - 8, x0 + 12, y, PAL["gold"])
            rect(img, x1 - 12, y - 8, x1 - 5, y, PAL["gold"])
        rect(img, w // 2 - 4, h - 12, w // 2 + 4, h, PAL["wood_dark"])
        save(name, img)

    # Market / Bazaar
    for name, stalls, awning in (("market", 1, PAL["cloth"]), ("market_2", 2, PAL["gold"])):
        img = blank(w, h)
        for s in range(stalls):
            ox = 4 + s * 26
            rect(img, ox, h - 18, ox + 24, h - 14, PAL["wood_dark"])
            rect(img, ox + 2, h - 14, ox + 6, h, PAL["wood_dark"])
            rect(img, ox + 18, h - 14, ox + 22, h, PAL["wood_dark"])
            for i in range(6):
                stripe = awning if i % 2 == 0 else PAL["roof"]
                rect(img, ox + i * 4, h - 26, ox + i * 4 + 4, h - 18, stripe)
        save(name, img)

    # Farm / Mill
    for name, sails in (("farm", False), ("mill", True)):
        img = blank(w, h)
        rect(img, 2, h - 10, w - 2, h, PAL["grass"])
        for x in range(4, w - 4, 7):
            rect(img, x, h - 14, x + 3, h - 8, PAL["bread"])
        x0, x1 = building_base(img, w, h, PAL["wood"], 26, 0.5)
        gable(img, x0 - 3, x1 + 3, h - 26, 12, PAL["roof_dark"])
        if sails:
            cx, cy = w // 2, h - 34
            for dx, dy in ((1, 1), (1, -1), (-1, 1), (-1, -1)):
                for i in range(1, 14):
                    put(img, cx + dx * i, cy + dy * i, PAL["cloth"])
                    put(img, cx + dx * i, cy + dy * i + 1, PAL["cloth"])
        save(name, img)

    # Stable / Wagonworks
    for name, extra in (("stable", False), ("stable_2", True)):
        img = blank(w, h)
        x0, x1 = building_base(img, w, h, PAL["wood_dark"], 28, 0.86)
        gable(img, x0 - 2, x1 + 2, h - 28, 11, PAL["roof_dark"])
        rect(img, w // 2 - 9, h - 20, w // 2 + 9, h, PAL["wood"])
        rect(img, w // 2 - 1, h - 20, w // 2 + 1, h, PAL["wood_dark"])
        if extra:
            disc(img, x1 - 6, h - 7, 6, PAL["wood"])
            disc(img, x1 - 6, h - 7, 3, PAL["wood_dark"])
        save(name, img)

    # Palisade / Gatehouse
    for name, tower in (("palisade", False), ("palisade_2", True)):
        img = blank(w, h)
        for x in range(2, w - 2, 7):
            rect(img, x, h - 32, x + 6, h, PAL["wood"])
            rect(img, x + 5, h - 32, x + 7, h, PAL["wood_dark"])
            gable(img, x, x + 6, h - 32, 4, PAL["wood_dark"])
        rect(img, 2, h - 22, w - 2, h - 19, PAL["wood_dark"])
        if tower:
            rect(img, w // 2 - 11, h - 48, w // 2 + 11, h, PAL["stone"])
            outline(img, w // 2 - 11, h - 48, w // 2 + 11, h, PAL["stone_dark"])
            for x in range(w // 2 - 11, w // 2 + 11, 6):
                rect(img, x, h - 52, x + 4, h - 48, PAL["stone"])
            rect(img, w // 2 - 5, h - 18, w // 2 + 5, h, PAL["wood_dark"])
        save(name, img)


# ----------------------------------------------------------------------- ui
def gen_ui():
    # 9-patch panel, 3px border.
    size = 16
    img = blank(size, size)
    rect(img, 0, 0, size, size, PAL["panel"])
    for i in range(3):
        edge = PAL["panel_edge"] if i < 2 else PAL["ink"]
        for x in range(i, size - i):
            put(img, x, i, edge)
            put(img, x, size - 1 - i, edge)
        for y in range(i, size - i):
            put(img, i, y, edge)
            put(img, size - 1 - i, y, edge)
    write_png(os.path.join(ASSETS, "ui", "panel.png"), img)

    def icon(name, draw):
        img = blank(16, 16)
        draw(img)
        write_png(os.path.join(ASSETS, "ui", name), img)

    def coin(img):
        disc(img, 8, 8, 6, PAL["gold"])
        disc(img, 8, 8, 3, PAL["cloth"])

    def food(img):
        disc(img, 8, 9, 6, PAL["bread"])
        rect(img, 4, 6, 12, 8, PAL["dirt_light"])

    def water(img):
        for y in range(2, 15):
            half = int((y - 2) * 0.5) if y < 9 else int((14 - y) * 0.9) + 3
            rect(img, 8 - half, y, 8 + half + 1, y + 1, PAL["water"])

    def lodging(img):
        rect(img, 2, 7, 14, 12, PAL["bed"])
        rect(img, 2, 5, 6, 8, PAL["cloth"])
        rect(img, 2, 12, 4, 14, PAL["wood_dark"])
        rect(img, 12, 12, 14, 14, PAL["wood_dark"])

    def reputation(img):
        disc(img, 5, 6, 4, PAL["heart"])
        disc(img, 11, 6, 4, PAL["heart"])
        for y in range(6, 15):
            half = 8 - (y - 5)
            rect(img, 8 - half, y, 8 + half, y + 1, PAL["heart"])

    icon("icon_coin.png", coin)
    icon("icon_food.png", food)
    icon("icon_water.png", water)
    icon("icon_lodging.png", lodging)
    icon("icon_reputation.png", reputation)

    # Faction crests: a shield per faction, distinct by colour and mark.
    def crest(colour, mark):
        img = blank(16, 16)
        for y in range(1, 15):
            t = (y - 1) / 13.0
            half = int(7 * (1.0 - t * t * 0.85))
            rect(img, 8 - half, y, 8 + half, y + 1, colour)
        mark(img)
        return img

    def guild_mark(img):
        rect(img, 6, 5, 10, 7, PAL["ink"])
        rect(img, 7, 7, 9, 11, PAL["ink"])

    def crown_mark(img):
        rect(img, 4, 8, 12, 10, PAL["ink"])
        for x in (4, 7, 10):
            rect(img, x, 5, x + 2, 8, PAL["ink"])

    def road_mark(img):
        for y in range(4, 12, 3):
            rect(img, 6, y, 10, y + 2, PAL["ink"])

    write_png(os.path.join(ASSETS, "ui", "crest_guild.png"), crest(PAL["guild"], guild_mark))
    write_png(os.path.join(ASSETS, "ui", "crest_crown.png"), crest(PAL["crown"], crown_mark))
    write_png(os.path.join(ASSETS, "ui", "crest_freeroad.png"), crest(PAL["freeroad"], road_mark))


if __name__ == "__main__":
    gen_road()
    gen_buildings()
    gen_ui()
    print("placeholder art complete")
