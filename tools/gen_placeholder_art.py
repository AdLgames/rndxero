#!/usr/bin/env python3
"""Generate DERELICT placeholder card art.

Section 15 lists roughly sixty unique card faces as art to produce later. These
are stand-ins at the right ratio and palette so the board reads correctly and
the pipeline is exercised: section 12's near-monochrome cold blue-grey, with
the one warm amber accent reserved for anything living or powered.

Each face is a type silhouette plus a small identicon block derived from the
card id, so fifty-nine cards are told apart at a glance without fifty-nine
hand-drawn icons. Card name and effect text are Labels in Card.tscn, not baked
into the image.

    python3 tools/gen_placeholder_art.py

Plain stdlib: no Pillow, no downloads.
"""
import hashlib
import json
import os
import struct
import zlib

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), os.pardir)
ASSETS = os.path.join(ROOT, "assets")

W, H = 120, 160  # 3:4, section 12

# Section 12: cold blue-grey, one warm accent.
INK        = (14, 18, 26, 255)
STEEL_DARK = (28, 36, 48, 255)
STEEL      = (44, 56, 72, 255)
STEEL_LIT  = (68, 84, 104, 255)
FROST      = (150, 170, 190, 255)
PALE       = (198, 214, 228, 255)
AMBER      = (232, 162, 62, 255)
AMBER_LOW  = (150, 100, 40, 255)
RUST       = (176, 78, 54, 255)
GREEN      = (108, 168, 118, 255)

# Frame colour per card type; the accent marks living or powered things.
TYPE_STYLE = {
    "resource":   (STEEL, FROST),
    "consumable": (STEEL, PALE),
    "module":     (STEEL_LIT, AMBER),
    "location":   (STEEL_DARK, FROST),
    "hazard":     (STEEL_DARK, RUST),
    "pack":       (STEEL, PALE),
    "story":      (STEEL_DARK, PALE),
    "crew":       (STEEL_LIT, AMBER),
}


def write_png(path, px):
    h, w = len(px), len(px[0])
    raw = b"".join(b"\x00" + bytes(c for p in row for c in p) for row in px)

    def chunk(tag, data):
        body = tag + data
        return struct.pack(">I", len(data)) + body + struct.pack(">I", zlib.crc32(body) & 0xFFFFFFFF)

    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as fh:
        fh.write(b"\x89PNG\r\n\x1a\n"
                 + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0))
                 + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b""))


def blank(w, h, fill=(0, 0, 0, 0)):
    return [[fill for _ in range(w)] for _ in range(h)]


def put(img, x, y, c):
    if 0 <= y < len(img) and 0 <= x < len(img[0]) and c[3]:
        img[y][x] = c


def rect(img, x0, y0, x1, y1, c):
    for y in range(int(y0), int(y1)):
        for x in range(int(x0), int(x1)):
            put(img, x, y, c)


def frame(img, x0, y0, x1, y1, c, t=1):
    for i in range(t):
        for x in range(int(x0), int(x1)):
            put(img, x, int(y0) + i, c)
            put(img, x, int(y1) - 1 - i, c)
        for y in range(int(y0), int(y1)):
            put(img, int(x0) + i, y, c)
            put(img, int(x1) - 1 - i, y, c)


def disc(img, cx, cy, r, c):
    for y in range(int(cy - r), int(cy + r) + 1):
        for x in range(int(cx - r), int(cx + r) + 1):
            if (x - cx) ** 2 + (y - cy) ** 2 <= r * r:
                put(img, x, y, c)


def tri(img, cx, cy, size, c):
    for i in range(size):
        half = i
        for x in range(cx - half, cx + half + 1):
            put(img, x, cy - size // 2 + i, c)


def glyph(img, kind, accent):
    """A type silhouette in the middle of the face."""
    cx, cy = W // 2, 62
    if kind == "resource":
        rect(img, cx - 22, cy - 12, cx + 22, cy + 4, accent)
        rect(img, cx - 14, cy + 4, cx + 28, cy + 18, accent)
    elif kind == "consumable":
        disc(img, cx, cy, 18, accent)
        rect(img, cx - 6, cy - 26, cx + 6, cy - 14, accent)
    elif kind == "module":
        rect(img, cx - 26, cy - 18, cx + 26, cy + 18, accent)
        rect(img, cx - 18, cy - 10, cx + 18, cy + 10, STEEL_DARK)
        for x in range(cx - 26, cx + 27, 12):
            rect(img, x, cy + 18, x + 5, cy + 24, accent)
    elif kind == "location":
        rect(img, cx - 26, cy + 14, cx + 26, cy + 20, accent)
        for i in range(20):
            half = int(24 * (1 - i / 20.0) ** 0.6)
            rect(img, cx - half, cy - 6 + i, cx + half, cy - 5 + i, accent)
    elif kind == "hazard":
        tri(img, cx, cy, 40, accent)
        rect(img, cx - 3, cy - 12, cx + 3, cy + 4, STEEL_DARK)
        rect(img, cx - 3, cy + 8, cx + 3, cy + 14, STEEL_DARK)
    elif kind == "pack":
        rect(img, cx - 24, cy - 20, cx + 24, cy + 20, accent)
        rect(img, cx - 24, cy - 4, cx + 24, cy + 4, STEEL_DARK)
        rect(img, cx - 4, cy - 20, cx + 4, cy + 20, STEEL_DARK)
    elif kind == "story":
        rect(img, cx - 26, cy - 16, cx + 26, cy + 16, accent)
        for i in range(14):
            put(img, cx - 26 + i * 2, cy - 16 + i, STEEL_DARK)
            put(img, cx + 26 - i * 2, cy - 16 + i, STEEL_DARK)
    elif kind == "crew":
        disc(img, cx, cy - 12, 11, accent)
        for i in range(22):
            half = 6 + i
            rect(img, cx - half // 1, cy + 2 + i, cx + half // 1, cy + 3 + i, accent)


def identicon(img, card_id, accent):
    """Five-by-five mirrored block from the id hash, so no two faces match."""
    digest = hashlib.sha1(card_id.encode()).digest()
    ox, oy, cell = W // 2 - 25, 104, 10
    for gy in range(5):
        for gx in range(3):
            if digest[gy * 3 + gx] & 1:
                for dx, sx in ((gx, 1), (4 - gx, 1)):
                    rect(img, ox + dx * cell, oy + gy * cell,
                         ox + dx * cell + cell - 2, oy + gy * cell + cell - 2, accent)


def face(card):
    base, accent = TYPE_STYLE.get(card["type"], (STEEL, FROST))
    img = blank(W, H, base)
    rect(img, 0, 0, W, 26, STEEL_DARK)          # name plate
    rect(img, 0, H - 30, W, H, STEEL_DARK)      # effect strip
    glyph(img, card["type"], accent)
    identicon(img, card["id"], accent)
    frame(img, 0, 0, W, H, INK, 2)
    frame(img, 2, 2, W - 2, H - 2, accent if card["type"] in ("module", "crew") else STEEL_LIT, 1)
    return img


def gen_cards():
    cards = json.load(open(os.path.join(ROOT, "data", "cards.json")))["cards"]
    for card in cards:
        write_png(os.path.join(ASSETS, "cards", card["id"] + ".png"), face(card))
    print("wrote %d card faces" % len(cards))


def gen_ui():
    # Board backdrop: dark, with a faint grid so dragging reads against it.
    img = blank(256, 256, (18, 22, 30, 255))
    for y in range(0, 256, 32):
        for x in range(256):
            put(img, x, y, (24, 30, 40, 255))
    for x in range(0, 256, 32):
        for y in range(256):
            put(img, x, y, (24, 30, 40, 255))
    write_png(os.path.join(ASSETS, "ui", "board.png"), img)

    # 9-patch panel, 3px border.
    s = 16
    img = blank(s, s, (22, 28, 38, 242))
    for i in range(3):
        frame(img, i, i, s - i, s - i, STEEL_LIT if i < 2 else INK, 1)
    write_png(os.path.join(ASSETS, "ui", "panel.png"), img)

    def icon(name, draw):
        img = blank(16, 16)
        draw(img)
        write_png(os.path.join(ASSETS, "ui", name), img)

    icon("icon_o2.png", lambda i: (disc(i, 8, 8, 7, FROST), disc(i, 8, 8, 4, STEEL_DARK)))
    icon("icon_cycle.png", lambda i: (disc(i, 8, 8, 7, AMBER), disc(i, 8, 8, 5, STEEL_DARK),
                                      rect(i, 7, 4, 9, 9, AMBER), rect(i, 7, 7, 12, 9, AMBER)))
    icon("icon_slots.png", lambda i: (rect(i, 1, 3, 7, 13, FROST), rect(i, 9, 3, 15, 13, FROST),
                                      rect(i, 2, 4, 6, 12, STEEL_DARK), rect(i, 10, 4, 14, 12, STEEL_DARK)))
    icon("icon_rations.png", lambda i: (disc(i, 8, 9, 6, GREEN), rect(i, 4, 5, 12, 7, AMBER_LOW)))
    print("wrote ui")


if __name__ == "__main__":
    gen_cards()
    gen_ui()
    print("placeholder art complete")
