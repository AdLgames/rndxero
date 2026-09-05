#!/usr/bin/env python3
"""Render a MagicaVoxel .vox model to an isometric directional sprite sheet.

The world is isometric (64x32 tiles, 2:1), so ships have to be drawn in the same
projection as the ground -- a top-down sprite spun in 2D reads flat and breaks
the illusion. Instead each model is rendered once per heading into a horizontal
strip, and the game picks the frame that matches the direction of travel.

The companion .obj from MagicaVoxel references a palette texture that is not
part of the export, so colour comes from the .vox itself: it carries both the
voxel grid and the 256-entry palette.

    python3 tools/vox_to_sprite.py in.vox out.png --frames 8 --scale 3 --max-size 40

Projection, per voxel corner, after yawing the model by the frame angle:
    sx = (x - y) * HALF_WIDTH
    sy = (x + y) * HALF_WIDTH / 2 - z * EDGE
which is the standard 2:1 isometric cube. Voxels are drawn far-to-near
(painter's algorithm over x + y + z), each contributing its top face and the two
side faces that turn toward the camera.
"""
import argparse
import math
import os
import struct
import zlib

DEFAULT_GREY = [(i, i, i, 255) for i in range(256)]

# Relative brightness of the three visible faces. The top catches the most
# light; the two sides fall away, which is what gives the voxels their volume.
SHADE_TOP = 1.0
SHADE_X = 0.80
SHADE_Y = 0.60


# ------------------------------------------------------------------ vox input
def read_chunks(data, offset, end):
    """Yield (chunk_id, content_bytes) over a .vox chunk range, recursing."""
    while offset < end:
        chunk_id = data[offset:offset + 4]
        content_size, children_size = struct.unpack("<ii", data[offset + 4:offset + 12])
        content_start = offset + 12
        content_end = content_start + content_size
        yield chunk_id, data[content_start:content_end]
        if children_size > 0:
            for sub in read_chunks(data, content_end, content_end + children_size):
                yield sub
        offset = content_end + children_size


def parse_vox(path):
    data = open(path, "rb").read()
    if data[:4] != b"VOX ":
        raise SystemExit("%s is not a .vox file" % path)

    voxels = []
    palette = None
    for chunk_id, content in read_chunks(data, 8, len(data)):
        if chunk_id == b"XYZI":
            count = struct.unpack("<i", content[:4])[0]
            for i in range(count):
                x, y, z, c = content[4 + i * 4:8 + i * 4]
                voxels.append((x, y, z, c))
        elif chunk_id == b"RGBA":
            palette = [tuple(content[i * 4:i * 4 + 4]) for i in range(256)]
    if not voxels:
        raise SystemExit("%s contained no voxels" % path)
    return voxels, palette or DEFAULT_GREY


def colour_of(palette, index):
    # Palette indices are 1-based; entry i lives at palette[i - 1].
    return palette[(index - 1) % 256]


def surface_voxels(voxels):
    """Drop voxels enclosed on all six sides -- they can never be seen, and
    they are the bulk of a solid model."""
    occupied = {(x, y, z) for x, y, z, _ in voxels}
    kept = []
    for x, y, z, c in voxels:
        if all((x + dx, y + dy, z + dz) in occupied for dx, dy, dz in
               ((1, 0, 0), (-1, 0, 0), (0, 1, 0), (0, -1, 0), (0, 0, 1), (0, 0, -1))):
            continue
        kept.append((x, y, z, c))
    return kept


# ----------------------------------------------------------------- rendering
def face_corners(x, y, z, axis, positive):
    """The four corners of one face of the unit cube at (x, y, z)."""
    if axis == 2:
        zz = z + 1 if positive else z
        return [(x, y, zz), (x + 1, y, zz), (x + 1, y + 1, zz), (x, y + 1, zz)]
    if axis == 0:
        xx = x + 1 if positive else x
        return [(xx, y, z), (xx, y + 1, z), (xx, y + 1, z + 1), (xx, y, z + 1)]
    yy = y + 1 if positive else y
    return [(x, yy, z), (x + 1, yy, z), (x + 1, yy, z + 1), (x, yy, z + 1)]


def shade(colour, k):
    r, g, b, _ = colour
    return (
        max(0, min(255, int(r * k))),
        max(0, min(255, int(g * k))),
        max(0, min(255, int(b * k))),
        255,
    )


def fill_convex(buf, width, height, points, colour):
    """Scanline-fill a convex polygon given in screen coordinates."""
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
        row = buf[py]
        for px in range(left, right + 1):
            row[px] = colour


def frame_geometry(voxels, palette, angle, scale):
    """Project one heading. Returns (polygons, min_x, min_y, max_x, max_y) with
    coordinates relative to the model's own centre, so every frame in a sheet
    can share one origin and the sprite does not wobble as it turns."""
    cos_a = math.cos(angle)
    sin_a = math.sin(angle)

    cx = sum(v[0] for v in voxels) / float(len(voxels)) + 0.5
    cy = sum(v[1] for v in voxels) / float(len(voxels)) + 0.5
    cz = sum(v[2] for v in voxels) / float(len(voxels)) + 0.5

    def project(x, y, z):
        px = (x - cx) * cos_a - (y - cy) * sin_a
        py = (x - cx) * sin_a + (y - cy) * cos_a
        pz = z - cz
        return ((px - py) * scale, (px + py) * scale * 0.5 - pz * scale)

    # Which side faces turn toward the camera depends only on the heading:
    # the view direction is (1, 1, 1) in rotated space, so in model space it is
    # (cos + sin, cos - sin, 1).
    x_positive = (cos_a + sin_a) > 0.0
    y_positive = (cos_a - sin_a) > 0.0

    polygons = []
    min_x = min_y = 1e9
    max_x = max_y = -1e9
    # Painter's algorithm: farthest first, so nearer voxels overwrite them.
    for x, y, z, c in sorted(voxels, key=lambda v:
                             (v[0] - cx) * cos_a - (v[1] - cy) * sin_a
                             + (v[0] - cx) * sin_a + (v[1] - cy) * cos_a + v[2]):
        base = colour_of(palette, c)
        if base[3] == 0:
            continue
        for axis, positive, k in ((0, x_positive, SHADE_X),
                                  (1, y_positive, SHADE_Y),
                                  (2, True, SHADE_TOP)):
            pts = [project(*corner) for corner in face_corners(x, y, z, axis, positive)]
            polygons.append((pts, shade(base, k)))
            for sx, sy in pts:
                min_x = min(min_x, sx)
                max_x = max(max_x, sx)
                min_y = min(min_y, sy)
                max_y = max(max_y, sy)
    return polygons, min_x, min_y, max_x, max_y


def render_sheet(voxels, palette, frames, scale, base_turns):
    """Render every heading, then rasterise them into one common-sized strip."""
    base = base_turns * math.pi / 2.0
    geometry = []
    min_x = min_y = 1e9
    max_x = max_y = -1e9
    for i in range(frames):
        angle = base + i * (2.0 * math.pi / frames)
        polys, a, b, c, d = frame_geometry(voxels, palette, angle, scale)
        geometry.append(polys)
        min_x, min_y = min(min_x, a), min(min_y, b)
        max_x, max_y = max(max_x, c), max(max_y, d)

    width = int(math.ceil(max_x - min_x)) + 1
    height = int(math.ceil(max_y - min_y)) + 1

    sheet = []
    for polys in geometry:
        buf = [[(0, 0, 0, 0) for _ in range(width)] for _ in range(height)]
        for pts, colour in polys:
            fill_convex(buf, width, height,
                        [(px - min_x, py - min_y) for px, py in pts], colour)
        sheet.append(buf)
    return sheet


def downscale(pixels, factor):
    """Alpha-weighted box filter, re-thresholded so the silhouette stays crisp
    rather than fringed."""
    if factor <= 1.0:
        return pixels
    height = len(pixels)
    width = len(pixels[0])
    out_w = max(1, int(round(width / factor)))
    out_h = max(1, int(round(height / factor)))
    out = [[(0, 0, 0, 0) for _ in range(out_w)] for _ in range(out_h)]

    for oy in range(out_h):
        y0 = int(oy * height / out_h)
        y1 = max(y0 + 1, int((oy + 1) * height / out_h))
        for ox in range(out_w):
            x0 = int(ox * width / out_w)
            x1 = max(x0 + 1, int((ox + 1) * width / out_w))
            r = g = b = a_sum = 0.0
            count = 0
            for y in range(y0, y1):
                row = pixels[y]
                for x in range(x0, x1):
                    pr, pg, pb, pa = row[x]
                    w = pa / 255.0
                    r += pr * w
                    g += pg * w
                    b += pb * w
                    a_sum += pa
                    count += 1
            if count == 0 or a_sum == 0.0:
                continue
            if a_sum / count < 96.0:
                continue
            weight = a_sum / 255.0
            out[oy][ox] = (
                max(0, min(255, int(r / weight))),
                max(0, min(255, int(g / weight))),
                max(0, min(255, int(b / weight))),
                255,
            )
    return out


def compose_strip(sheet):
    height = len(sheet[0])
    width = len(sheet[0][0])
    strip = [[(0, 0, 0, 0) for _ in range(width * len(sheet))] for _ in range(height)]
    for i, frame in enumerate(sheet):
        for y in range(height):
            for x in range(width):
                strip[y][i * width + x] = frame[y][x]
    return strip


def write_png(path, pixels):
    height = len(pixels)
    width = len(pixels[0])
    raw = b"".join(b"\x00" + bytes(v for px in row for v in px) for row in pixels)

    def chunk(tag, payload):
        body = tag + payload
        return struct.pack(">I", len(payload)) + body + struct.pack(">I", zlib.crc32(body) & 0xFFFFFFFF)

    header = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    with open(path, "wb") as fh:
        fh.write(b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", header)
                 + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b""))
    print("wrote %s (%dx%d, %d frames)" % (path, width, height, WRITTEN_FRAMES[0]))


WRITTEN_FRAMES = [1]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("source")
    ap.add_argument("dest")
    ap.add_argument("--frames", type=int, default=8, help="headings around the compass")
    ap.add_argument("--scale", type=int, default=3, help="pixels per voxel before downscaling")
    ap.add_argument("--base-turns", type=int, default=0,
                    help="90-degree turns applied first, to put the model's nose on +X")
    ap.add_argument("--max-size", type=int, default=0, help="long edge of one frame, in pixels")
    args = ap.parse_args()

    voxels, palette = parse_vox(args.source)
    kept = surface_voxels(voxels)
    print("%s: %d voxels, %d on the surface" % (os.path.basename(args.source), len(voxels), len(kept)))

    sheet = render_sheet(kept, palette, args.frames, args.scale, args.base_turns)
    if args.max_size > 0:
        longest = max(len(sheet[0]), len(sheet[0][0]))
        factor = float(longest) / args.max_size
        sheet = [downscale(frame, factor) for frame in sheet]

    WRITTEN_FRAMES[0] = args.frames
    write_png(args.dest, compose_strip(sheet))


if __name__ == "__main__":
    main()
