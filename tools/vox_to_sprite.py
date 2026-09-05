#!/usr/bin/env python3
"""Render a MagicaVoxel .vox model to a top-down sprite.

The companion .obj from MagicaVoxel references a palette texture that is not
part of the export, so colour has to come from the .vox itself -- it carries
both the voxel grid and the 256-entry palette.

Ship sprites in LANES are top-down and rotated to the lane angle at runtime
(spec section 9), so this projects straight down the Z axis, shades each column
by its height, and writes a PNG.

    python3 tools/vox_to_sprite.py in.vox out.png [--scale 2] [--yaw 0]
"""
import argparse
import os
import struct
import sys
import zlib

# MagicaVoxel's default palette, used when a model carries no RGBA chunk.
DEFAULT_GREY = [(i, i, i, 255) for i in range(256)]


def read_chunks(data, offset, end):
    """Yield (chunk_id, content_bytes) over a .vox chunk range, recursing."""
    while offset < end:
        chunk_id = data[offset:offset + 4]
        content_size, children_size = struct.unpack("<ii", data[offset + 4:offset + 12])
        content_start = offset + 12
        content_end = content_start + content_size
        yield chunk_id, data[content_start:content_end]
        # Children live directly after the content; recurse into them.
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
            palette = []
            for i in range(256):
                r, g, b, a = content[i * 4:i * 4 + 4]
                palette.append((r, g, b, a))
    if not voxels:
        raise SystemExit("%s contained no voxels" % path)
    return voxels, palette or DEFAULT_GREY


def colour_of(palette, index):
    # Palette indices are 1-based; entry i is stored at palette[i - 1].
    return palette[(index - 1) % 256]


def rotate_yaw(x, y, steps):
    """Rotate about the vertical axis in exact 90-degree steps, so the voxel
    grid stays aligned and the sprite has no resampling artefacts."""
    for _ in range(steps % 4):
        x, y = y, -x
    return x, y


def render(voxels, palette, scale, yaw_steps):
    placed = {}
    for x, y, z, c in voxels:
        rx, ry = rotate_yaw(x, y, yaw_steps)
        # Keep the topmost voxel of each column: that is what a top-down camera
        # sees. Track the height too, for shading.
        key = (rx, ry)
        if key not in placed or z > placed[key][0]:
            placed[key] = (z, c)

    xs = [k[0] for k in placed]
    ys = [k[1] for k in placed]
    min_x, max_x = min(xs), max(xs)
    min_y, max_y = min(ys), max(ys)
    zs = [v[0] for v in placed.values()]
    min_z, max_z = min(zs), max(zs)
    z_span = max(1, max_z - min_z)

    cols = (max_x - min_x + 1) * scale
    rows = (max_y - min_y + 1) * scale
    img = [[(0, 0, 0, 0) for _ in range(cols)] for _ in range(rows)]

    for (rx, ry), (z, c) in placed.items():
        r, g, b, a = colour_of(palette, c)
        if a == 0:
            continue
        # Higher surfaces catch more light; lower ones fall into shadow.
        k = 0.72 + 0.38 * ((z - min_z) / float(z_span))
        shaded = (
            max(0, min(255, int(r * k))),
            max(0, min(255, int(g * k))),
            max(0, min(255, int(b * k))),
            255,
        )
        px = (rx - min_x) * scale
        # Flip Y so the model's +Y reads as "up" in the sprite.
        py = (max_y - ry) * scale
        for dy in range(scale):
            for dx in range(scale):
                img[py + dy][px + dx] = shaded
    return img


def downscale(pixels, max_size):
    """Box-filter down to a target long edge. Ships are 16-32px in the spec but
    the voxel models are several times that, so they have to come down; the
    average is alpha-weighted and then re-thresholded to keep the silhouette
    crisp rather than fringed."""
    height = len(pixels)
    width = len(pixels[0])
    longest = max(width, height)
    if longest <= max_size:
        return pixels

    scale = float(longest) / max_size
    out_w = max(1, int(round(width / scale)))
    out_h = max(1, int(round(height / scale)))
    out = [[(0, 0, 0, 0) for _ in range(out_w)] for _ in range(out_h)]

    for oy in range(out_h):
        y0 = int(oy * height / out_h)
        y1 = max(y0 + 1, int((oy + 1) * height / out_h))
        for ox in range(out_w):
            x0 = int(ox * width / out_w)
            x1 = max(x0 + 1, int((ox + 1) * width / out_w))
            r_sum = g_sum = b_sum = 0.0
            a_sum = 0.0
            count = 0
            for y in range(y0, y1):
                for x in range(x0, x1):
                    r, g, b, a = pixels[y][x]
                    w = a / 255.0
                    r_sum += r * w
                    g_sum += g * w
                    b_sum += b * w
                    a_sum += a
                    count += 1
            if count == 0 or a_sum == 0.0:
                continue
            mean_a = a_sum / count
            if mean_a < 96.0:
                continue
            weight = a_sum / 255.0
            out[oy][ox] = (
                max(0, min(255, int(r_sum / weight))),
                max(0, min(255, int(g_sum / weight))),
                max(0, min(255, int(b_sum / weight))),
                255,
            )
    return out


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
    print("wrote %s (%dx%d)" % (path, width, height))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("source")
    ap.add_argument("dest")
    ap.add_argument("--scale", type=int, default=1, help="pixels per voxel")
    ap.add_argument("--yaw", type=int, default=0, help="90-degree turns before rendering")
    ap.add_argument("--max-size", type=int, default=0, help="box-filter down to this long edge")
    args = ap.parse_args()

    voxels, palette = parse_vox(args.source)
    print("%d voxels, palette %s" % (len(voxels), "embedded" if palette is not DEFAULT_GREY else "default"))
    image = render(voxels, palette, args.scale, args.yaw)
    if args.max_size > 0:
        image = downscale(image, args.max_size)
    write_png(args.dest, image)


if __name__ == "__main__":
    main()
