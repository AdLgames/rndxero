#!/usr/bin/env python3
"""Generate LANES placeholder art.

The asset checklist in LANES_MVP.md section 9 points at CC0 packs (kenney.nl and
friends). Until those are dropped in, this script writes stand-ins at the right
dimensions so the game renders and the sprite pipeline is exercised end to end.
Ship sprites are NOT written here -- they are isometric directional sheets
rendered from the voxel models by tools/vox_to_sprite.py.

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


# ------------------------------------------------------- isometric primitives
# The world is a 2:1 isometric grid, so station art has to be drawn as volumes
# in that same projection -- a flat front-on shape reads as a sticker on the
# ground and breaks the illusion the tiles are working to create.


def iso_point(x, y, z, ox, oy, unit, rise):
    return (ox + (x - y) * unit, oy + (x + y) * unit * 0.5 - z * rise)


def fill_convex(img, points, colour):
    height = len(img)
    width = len(img[0])
    ys = [p[1] for p in points]
    y0 = max(0, int(math.floor(min(ys))))
    y1 = min(height - 1, int(math.ceil(max(ys))))
    count = len(points)
    for py in range(y0, y1 + 1):
        centre = py + 0.5
        crossings = []
        for i in range(count):
            ax, ay = points[i]
            bx, by = points[(i + 1) % count]
            if (ay <= centre < by) or (by <= centre < ay):
                crossings.append(ax + (centre - ay) / (by - ay) * (bx - ax))
        if len(crossings) < 2:
            continue
        left = max(0, int(math.floor(min(crossings) + 0.5)))
        right = min(width - 1, int(math.ceil(max(crossings) - 0.5)))
        for px in range(left, right + 1):
            img[py][px] = colour


def iso_box(img, ox, oy, x0, y0, z0, w, d, h, colour, unit=8.0, rise=8.0):
    """A box in grid units, drawn as its top face plus the two lit side faces."""
    def p(x, y, z):
        return iso_point(x, y, z, ox, oy, unit, rise)

    x1, y1, z1 = x0 + w, y0 + d, z0 + h
    fill_convex(img, [p(x1, y0, z0), p(x1, y1, z0), p(x1, y1, z1), p(x1, y0, z1)], shade(colour, 0.78))
    fill_convex(img, [p(x0, y1, z0), p(x1, y1, z0), p(x1, y1, z1), p(x0, y1, z1)], shade(colour, 0.58))
    fill_convex(img, [p(x0, y0, z1), p(x1, y0, z1), p(x1, y1, z1), p(x0, y1, z1)], colour)


def iso_cylinder(img, cx, cy, radius, height, colour):
    """Upright cylinder: elliptical cap over a straight body, 2:1 like the tiles."""
    ry = max(1.0, radius * 0.5)
    side = shade(colour, 0.66)
    for x in range(-radius, radius + 1):
        t = 1.0 - (x / float(radius)) ** 2
        if t < 0.0:
            continue
        dy = ry * math.sqrt(t)
        for y in range(int(cy - dy), int(cy + dy + height) + 1):
            put(img, cx + x, y, side)
    for x in range(-radius, radius + 1):
        t = 1.0 - (x / float(radius)) ** 2
        if t < 0.0:
            continue
        dy = ry * math.sqrt(t)
        for y in range(int(cy - dy), int(cy + dy) + 1):
            put(img, cx + x, y, colour)


def iso_dome(img, cx, cy, radius, colour):
    """Squashed hemisphere, lit from the upper left."""
    ry = max(1.0, radius * 0.62)
    for y in range(-radius, radius + 1):
        for x in range(-radius, radius + 1):
            u = x / float(radius)
            v = y / float(ry)
            if u * u + v * v > 1.0:
                continue
            lit = 1.12 - 0.5 * (u * 0.6 + v * 0.8)
            put(img, cx + x, cy + y, shade(colour, max(0.45, min(1.25, lit))))


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
    """64x64 sprites drawn in the same 2:1 projection as the terrain, with the
    structure's footprint sitting near the bottom of the frame so Station.tscn
    can anchor it on the tile."""
    # Habitat: ring platform with a domed hub.
    img = blank(64, 64)
    iso_cylinder(img, 32, 30, 22, 8, (74, 132, 116, 255))
    iso_dome(img, 32, 26, 13, (150, 210, 180, 255))
    iso_dome(img, 32, 23, 6, (214, 245, 224, 255))
    write_png(os.path.join(ASSETS, "stations", "habitat.png"), img)

    # Depot: stacked cargo containers on a pad.
    img = blank(64, 64)
    iso_box(img, 32, 46, 0, 0, 0, 3.2, 3.2, 0.3, (96, 76, 44, 255), unit=7.0, rise=7.0)
    iso_box(img, 32, 46, 0.2, 0.2, 0.3, 1.4, 2.6, 1.2, (196, 140, 60, 255), unit=7.0, rise=7.0)
    iso_box(img, 32, 46, 1.7, 0.3, 0.3, 1.3, 1.3, 1.0, (168, 118, 48, 255), unit=7.0, rise=7.0)
    iso_box(img, 32, 46, 1.7, 1.7, 0.3, 1.3, 1.2, 1.6, (214, 158, 70, 255), unit=7.0, rise=7.0)
    write_png(os.path.join(ASSETS, "stations", "depot.png"), img)

    # Refinery: cracking tower between two holding tanks.
    img = blank(64, 64)
    iso_box(img, 32, 48, 0, 0, 0, 3.0, 3.0, 0.3, (78, 46, 42, 255), unit=7.0, rise=7.0)
    iso_cylinder(img, 20, 36, 9, 10, (122, 54, 48, 255))
    iso_cylinder(img, 45, 38, 8, 9, (122, 54, 48, 255))
    iso_box(img, 32, 44, 1.0, 1.0, 0.3, 1.1, 1.1, 4.2, (150, 66, 58, 255), unit=7.0, rise=7.0)
    iso_dome(img, 32, 12, 7, (238, 176, 96, 255))
    write_png(os.path.join(ASSETS, "stations", "refinery.png"), img)


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
    gen_explosion()
    gen_ui()
    print("placeholder art complete")
