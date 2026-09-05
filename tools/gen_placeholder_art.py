#!/usr/bin/env python3
"""Generate LANES placeholder art.

The asset checklist in LANES_MVP.md section 9 points at CC0 packs (kenney.nl and
friends). Until those are dropped in, this script writes stand-ins at the right
dimensions so the game renders and the sprite pipeline is exercised end to end.
Everything here is plain stdlib -- no Pillow, no downloads.

    python3 tools/gen_placeholder_art.py

Replacing a placeholder is just overwriting the file with real art of the same
size; nothing in the game references this script at runtime.
"""
import math
import os
import struct
import zlib

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), os.pardir)
ASSETS = os.path.join(ROOT, "assets")

TILE_W, TILE_H = 64, 32


# ---------------------------------------------------------------- png writer
def write_png(path, pixels):
    """pixels: list of rows, each a list of (r, g, b, a) tuples."""
    height = len(pixels)
    width = len(pixels[0])
    raw = b"".join(
        b"\x00" + bytes(c for px in row for c in px) for row in pixels
    )

    def chunk(tag, data):
        body = tag + data
        return struct.pack(">I", len(data)) + body + struct.pack(">I", zlib.crc32(body) & 0xFFFFFFFF)

    header = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)
    blob = (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", header)
        + chunk(b"IDAT", zlib.compress(raw, 9))
        + chunk(b"IEND", b"")
    )
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as fh:
        fh.write(blob)
    print("wrote", os.path.relpath(path, ROOT))


def blank(w, h):
    return [[(0, 0, 0, 0) for _ in range(w)] for _ in range(h)]


def put(img, x, y, colour):
    if 0 <= y < len(img) and 0 <= x < len(img[0]):
        img[y][x] = colour


def shade(colour, k):
    return (
        max(0, min(255, int(colour[0] * k))),
        max(0, min(255, int(colour[1] * k))),
        max(0, min(255, int(colour[2] * k))),
        colour[3],
    )


def fill_rect(img, x0, y0, x1, y1, colour):
    for y in range(y0, y1):
        for x in range(x0, x1):
            put(img, x, y, colour)


def fill_disc(img, cx, cy, r, colour):
    for y in range(int(cy - r) - 1, int(cy + r) + 2):
        for x in range(int(cx - r) - 1, int(cx + r) + 2):
            if (x - cx) ** 2 + (y - cy) ** 2 <= r * r:
                put(img, x, y, colour)


def ring(img, cx, cy, r_out, r_in, colour):
    for y in range(int(cy - r_out) - 1, int(cy + r_out) + 2):
        for x in range(int(cx - r_out) - 1, int(cx + r_out) + 2):
            d2 = (x - cx) ** 2 + (y - cy) ** 2
            if r_in * r_in <= d2 <= r_out * r_out:
                put(img, x, y, colour)


# ------------------------------------------------------------------- terrain
def iso_rows(width=TILE_W, height=TILE_H):
    """Yield (y, x_start, x_end) spans covering an isometric diamond."""
    half = height / 2.0
    for y in range(height):
        t = 1.0 - abs((y + 0.5) - half) / half
        run = max(1, int(round(t * width / 2.0)))
        yield y, width // 2 - run, width // 2 + run


def make_tile(base, speckle=None, crater=False, seed=0):
    img = blank(TILE_W, TILE_H)
    top = shade(base, 1.18)
    edge = shade(base, 0.55)
    rnd = seed * 7919 + 13
    for y, x0, x1 in iso_rows():
        for x in range(x0, x1):
            rnd = (rnd * 1103515245 + 12345) & 0x7FFFFFFF
            n = (rnd >> 16) % 100
            if x <= x0 + 1 or x >= x1 - 2 or y == 0 or y == TILE_H - 1:
                put(img, x, y, edge)
            elif speckle and n < 7:
                put(img, x, y, speckle)
            elif n < 18:
                put(img, x, y, top)
            else:
                put(img, x, y, base)
    if crater:
        for y, x0, x1 in iso_rows(TILE_W // 2, TILE_H // 2):
            for x in range(x0, x1):
                put(img, x + TILE_W // 4, y + TILE_H // 4, shade(base, 0.6))
    return img


def gen_tiles():
    """One atlas strip of five 64x32 tiles, in the order Main.gd expects."""
    tiles = [
        ("void", make_tile((22, 26, 44, 255), speckle=(48, 54, 84, 255), seed=1)),
        ("rock", make_tile((92, 88, 96, 255), speckle=(130, 126, 134, 255), seed=2)),
        ("ice", make_tile((132, 176, 196, 255), speckle=(198, 226, 238, 255), seed=3)),
        ("crater", make_tile((78, 74, 84, 255), speckle=(110, 104, 116, 255), crater=True, seed=4)),
        ("asteroid", make_tile((114, 84, 58, 255), speckle=(156, 118, 82, 255), seed=5)),
    ]
    atlas = blank(TILE_W * len(tiles), TILE_H)
    for i, (_, img) in enumerate(tiles):
        for y in range(TILE_H):
            for x in range(TILE_W):
                atlas[y][i * TILE_W + x] = img[y][x]
    write_png(os.path.join(ASSETS, "tiles", "terrain_atlas.png"), atlas)


# ------------------------------------------------------------------ stations
def gen_stations():
    # Habitat: ring station with a lit hub.
    img = blank(64, 64)
    ring(img, 32, 34, 22, 15, (86, 150, 132, 255))
    ring(img, 32, 34, 22, 20, (52, 96, 86, 255))
    fill_disc(img, 32, 34, 9, (150, 210, 180, 255))
    fill_disc(img, 32, 32, 6, (214, 245, 224, 255))
    write_png(os.path.join(ASSETS, "stations", "habitat.png"), img)

    # Depot: stacked cargo boxes.
    img = blank(64, 64)
    fill_rect(img, 12, 34, 52, 54, (168, 118, 48, 255))
    fill_rect(img, 12, 34, 52, 38, (214, 158, 70, 255))
    for bx in range(16, 50, 11):
        fill_rect(img, bx, 22, bx + 9, 34, (196, 140, 60, 255))
        fill_rect(img, bx, 22, bx + 9, 25, (232, 178, 88, 255))
    fill_rect(img, 12, 52, 52, 55, (96, 66, 26, 255))
    write_png(os.path.join(ASSETS, "stations", "depot.png"), img)

    # Refinery: tower flanked by tanks.
    img = blank(64, 64)
    fill_rect(img, 26, 12, 38, 52, (150, 66, 58, 255))
    fill_rect(img, 26, 12, 30, 52, (196, 96, 84, 255))
    fill_disc(img, 16, 42, 10, (122, 54, 48, 255))
    fill_disc(img, 48, 42, 10, (122, 54, 48, 255))
    fill_disc(img, 14, 40, 4, (188, 92, 80, 255))
    fill_disc(img, 46, 40, 4, (188, 92, 80, 255))
    fill_rect(img, 28, 6, 36, 12, (238, 176, 96, 255))
    write_png(os.path.join(ASSETS, "stations", "refinery.png"), img)


# --------------------------------------------------------------------- ships
def gen_ship(path, w, h, hull, trim):
    """Top-down hull pointing along +X; the game rotates it to the lane angle."""
    img = blank(w, h)
    nose = w - 1
    for x in range(w):
        t = x / float(w - 1)
        half = max(1, int(round((h / 2.0) * (0.35 + 0.65 * math.sin(math.pi * min(1.0, t * 1.15))))))
        if x > nose - 2:
            half = 1
        for y in range(h // 2 - half, h // 2 + half):
            put(img, x, y, hull if x < w * 0.72 else trim)
    fill_rect(img, max(0, w // 4), h // 2 - 1, max(1, w // 2), h // 2 + 1, trim)
    for y in (0, h - 1):
        for x in range(int(w * 0.15), int(w * 0.45)):
            put(img, x, y, shade(hull, 0.7))
    write_png(path, img)


def gen_ships():
    gen_ship(os.path.join(ASSETS, "ships", "consumer.png"), 14, 10, (96, 190, 214, 255), (206, 240, 250, 255))
    gen_ship(os.path.join(ASSETS, "ships", "commercial.png"), 22, 14, (214, 180, 76, 255), (250, 232, 158, 255))
    gen_ship(os.path.join(ASSETS, "ships", "heavy.png"), 30, 20, (198, 96, 72, 255), (244, 176, 128, 255))


# ----------------------------------------------------------------------- fx
def gen_explosion():
    """Four 16x16 frames in a horizontal strip."""
    size = 16
    img = blank(size * 4, size)
    palette = [
        (255, 244, 196, 255),
        (255, 196, 96, 255),
        (232, 128, 64, 255),
        (128, 64, 48, 255),
    ]
    for frame in range(4):
        cx = frame * size + size / 2.0 - 0.5
        cy = size / 2.0 - 0.5
        r_out = 2.5 + frame * 3.2
        r_in = 0.0 if frame < 2 else r_out - 3.0
        colour = palette[frame]
        for y in range(size):
            for x in range(frame * size, (frame + 1) * size):
                d2 = (x - cx) ** 2 + (y - cy) ** 2
                if r_in * r_in <= d2 <= r_out * r_out:
                    put(img, x, y, colour)
    write_png(os.path.join(ASSETS, "fx", "explosion.png"), img)


# ----------------------------------------------------------------------- ui
def gen_ui():
    # 9-patch panel: 3px border, flat centre. Margins of 3 in the .tscn.
    size = 16
    img = blank(size, size)
    fill_rect(img, 0, 0, size, size, (26, 30, 48, 235))
    for i in range(3):
        k = 1.0 + (2 - i) * 0.25
        col = shade((58, 68, 104, 255), k)
        for x in range(i, size - i):
            put(img, x, i, col)
            put(img, x, size - 1 - i, col)
        for y in range(i, size - i):
            put(img, i, y, col)
            put(img, size - 1 - i, y, col)
    write_png(os.path.join(ASSETS, "ui", "panel.png"), img)

    def icon(name, draw):
        img = blank(16, 16)
        draw(img)
        write_png(os.path.join(ASSETS, "ui", name), img)

    def credits(img):
        fill_disc(img, 8, 8, 6, (232, 194, 84, 255))
        fill_disc(img, 8, 8, 4, (250, 226, 140, 255))
        fill_rect(img, 7, 3, 9, 13, (168, 128, 40, 255))

    def rep(img):
        for y in range(16):
            for x in range(16):
                dx, dy = x - 8, y - 8
                if abs(dx) + abs(dy) <= 6 and dy <= 2:
                    put(img, x, y, (120, 200, 160, 255))
        fill_rect(img, 4, 8, 12, 13, (86, 160, 124, 255))

    def tech(img):
        ring(img, 8, 8, 7, 4, (150, 170, 230, 255))
        fill_disc(img, 8, 8, 2, (210, 224, 255, 255))
        for a in range(0, 360, 45):
            r = math.radians(a)
            put(img, int(8 + math.cos(r) * 7), int(8 + math.sin(r) * 7), (210, 224, 255, 255))

    def speed(img):
        for i, x0 in enumerate((2, 8)):
            for x in range(x0, x0 + 5):
                span = 6 - (x - x0)
                for y in range(8 - span, 8 + span):
                    put(img, x, y, (198, 214, 255, 255))

    icon("icon_credits.png", credits)
    icon("icon_rep.png", rep)
    icon("icon_tech.png", tech)
    icon("icon_speed.png", speed)


if __name__ == "__main__":
    gen_tiles()
    gen_stations()
    gen_ships()
    gen_explosion()
    gen_ui()
    print("placeholder art complete")
