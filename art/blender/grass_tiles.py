"""
Grass Ground Tile Set  (art spec section 2.1)
Blender 3.x / 4.x / 5.x  -  Scripting tab > open > Run Script (Alt+P)

Builds:
  Tile_Grass_00  Plain
  Tile_Grass_01  Half-buried tyre, grass through it
  Tile_Grass_02  Scattered bricks + bent road-sign post
  Tile_Grass_03  Cracked tarmac patch with faded road line
  Tile_Grass_04  Thistle clump + rusted paint can

Each variant is an Empty root (origin = octagon centre, base at z=0) with two
children: "Turf" (ALL variants share ONE mesh datablock) and "Props".
Octagon is flat-to-flat 1.0 unit. Flat shaded, vertex colours only, no PBR.
Export with +Y up (glTF/FBX default) to get base at y=0 in-engine.
"""
import bpy, bmesh, math, random
from mathutils import Vector, Matrix, noise

# ------------------------------------------------------------------ palette
GRASS_A   = (0.40, 0.46, 0.27, 1)   # olive
GRASS_B   = (0.52, 0.56, 0.36, 1)   # sage
KHAKI     = (0.62, 0.55, 0.34, 1)   # dead grass
DIRT      = (0.44, 0.35, 0.22, 1)
RUBBER    = (0.11, 0.11, 0.10, 1)
BRICK     = (0.56, 0.30, 0.22, 1)
BRICK_D   = (0.44, 0.22, 0.16, 1)
RUST      = (0.55, 0.31, 0.15, 1)
RUST_D    = (0.36, 0.19, 0.10, 1)
TARMAC    = (0.24, 0.24, 0.23, 1)
TARMAC_L  = (0.32, 0.32, 0.30, 1)
LINE      = (0.72, 0.70, 0.60, 1)
STEM      = (0.38, 0.46, 0.28, 1)
THISTLE   = (0.46, 0.33, 0.46, 1)
LABEL     = (0.64, 0.60, 0.48, 1)

APOTHEM = 0.5
RCORNER = APOTHEM / math.cos(math.pi / 8)     # 0.5412
TILE_H  = 0.06                                # rim height
SPACING = 1.4

# ------------------------------------------------------------------ setup
if bpy.context.object and bpy.context.object.mode != 'OBJECT':
    bpy.ops.object.mode_set(mode='OBJECT')

col = bpy.data.collections.get("Tiles_Grass") or bpy.data.collections.new("Tiles_Grass")
if col.name not in bpy.context.scene.collection.children:
    bpy.context.scene.collection.children.link(col)


def flat_material():
    mat = bpy.data.materials.get("TileFlat")
    if mat:
        return mat
    mat = bpy.data.materials.new("TileFlat")
    mat.use_nodes = True
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    bsdf = nodes.get("Principled BSDF")
    bsdf.inputs["Roughness"].default_value = 0.95
    for n in ("Specular IOR Level", "Specular"):
        if n in bsdf.inputs:
            bsdf.inputs[n].default_value = 0.05
    vc = nodes.new("ShaderNodeVertexColor")
    vc.layer_name = "Col"
    links.new(vc.outputs["Color"], bsdf.inputs["Base Color"])
    return mat


MAT = flat_material()


def mul(c, k):
    return (c[0] * k, c[1] * k, c[2] * k, 1)


def lerp(a, b, t):
    return tuple(a[i] * (1 - t) + b[i] * t for i in range(3)) + (1,)


def paint(layer, verts, color):
    faces = {f for v in verts for f in v.link_faces}
    for f in faces:
        for l in f.loops:
            l[layer] = color


def octagon_ring(frac, z):
    """16 points tracing the octagon outline (corners + edge midpoints)."""
    pts = []
    for i in range(16):
        a = i * math.pi / 8
        r = (APOTHEM if i % 2 == 0 else RCORNER) * frac
        pts.append(Vector((math.cos(a) * r, math.sin(a) * r, z)))
    return pts


def to_object(bm, name, parent, location=(0, 0, 0), mesh=None):
    if mesh is None:
        mesh = bpy.data.meshes.new(name + "Mesh")
        bm.to_mesh(mesh)
        bm.free()
    ob = bpy.data.objects.new(name, mesh)
    ob.data.materials.append(MAT) if MAT.name not in ob.data.materials else None
    col.objects.link(ob)
    ob.parent = parent
    ob.location = location
    return ob


# ------------------------------------------------------------------ shared turf base
def build_turf_mesh(seed=11):
    rnd = random.Random(seed)
    bm = bmesh.new()
    layer = bm.loops.layers.color.new("Col")

    def grass_color(p):
        d = max(abs(p.x) / APOTHEM, abs(p.y) / APOTHEM, p.length / RCORNER)
        n = noise.noise(p * 5.0 + Vector((7, 3, 0))) * 0.5 + 0.5
        base = lerp(GRASS_A, GRASS_B, n)
        edge = min(1.0, d * d * 0.9 + n * 0.35)       # khaki patches toward edges
        return lerp(base, KHAKI, max(0.0, edge - 0.35))

    centre = bm.verts.new((rnd.uniform(-0.02, 0.02), rnd.uniform(-0.02, 0.02), TILE_H + 0.03))
    rings = []
    for frac, z, jit in ((0.45, TILE_H + 0.018, 0.02), (0.88, TILE_H - 0.012, 0.01), (1.0, TILE_H, 0.0)):
        ring = []
        for p in octagon_ring(frac, z):
            p += Vector((rnd.uniform(-jit, jit), rnd.uniform(-jit, jit), rnd.uniform(-0.004, 0.004) if jit else 0))
            ring.append(bm.verts.new(p))
        rings.append(ring)
    bottom = [bm.verts.new(p) for p in octagon_ring(1.0, 0.0)]

    # top surface
    for i in range(16):
        bm.faces.new((centre, rings[0][i], rings[0][(i + 1) % 16]))
    for a, b in zip(rings, rings[1:]):
        for i in range(16):
            bm.faces.new((a[i], a[(i + 1) % 16], b[(i + 1) % 16], b[i]))
    # skirt
    for i in range(16):
        bm.faces.new((rings[2][i], bottom[i], bottom[(i + 1) % 16], rings[2][(i + 1) % 16]))

    # vertex colours + baked AO (groove ring darker, skirt is dirt)
    for f in bm.faces:
        for l in f.loops:
            v = l.vert
            if v.co.z < TILE_H - 0.02 and v in bottom:
                l[layer] = mul(DIRT, 0.75)
            elif v in rings[2] and f.normal.z < 0.5:
                l[layer] = DIRT
            else:
                c = grass_color(v.co)
                ao = 0.78 if v in rings[1] else 1.0
                l[layer] = mul(c, ao)

    mesh = bpy.data.meshes.new("Tile_Grass_Base")
    bm.to_mesh(mesh)
    bm.free()
    return mesh


TURF_MESH = build_turf_mesh()


def surface_z(x, y):
    """Approximate turf height at a point (for sitting props on the dome)."""
    d = max(abs(x) / APOTHEM, abs(y) / APOTHEM)
    if d < 0.45:
        return TILE_H + 0.03 - 0.012 * (d / 0.45)
    if d < 0.88:
        return TILE_H + 0.018 - 0.03 * ((d - 0.45) / 0.43)
    return TILE_H - 0.012


# ------------------------------------------------------------------ prop helpers
def add_box(bm, layer, center, size, color, rot=(0, 0, 0)):
    r = bmesh.ops.create_cube(bm, size=1.0)["verts"]
    bmesh.ops.scale(bm, vec=size, verts=r)
    bmesh.ops.rotate(bm, cent=(0, 0, 0), matrix=Matrix.Rotation(rot[0], 3, 'X') @
                     Matrix.Rotation(rot[1], 3, 'Y') @ Matrix.Rotation(rot[2], 3, 'Z'), verts=r)
    bmesh.ops.translate(bm, vec=center, verts=r)
    paint(layer, r, color)
    return r


def add_cyl(bm, layer, center, radius, depth, color, segs=8, rot=(0, 0, 0), r2=None):
    r = bmesh.ops.create_cone(bm, cap_ends=True, segments=segs, radius1=radius,
                              radius2=radius if r2 is None else r2, depth=depth)["verts"]
    bmesh.ops.rotate(bm, cent=(0, 0, 0), matrix=Matrix.Rotation(rot[0], 3, 'X') @
                     Matrix.Rotation(rot[1], 3, 'Y') @ Matrix.Rotation(rot[2], 3, 'Z'), verts=r)
    bmesh.ops.translate(bm, vec=center, verts=r)
    paint(layer, r, color)
    return r


def add_blade(bm, layer, base, height, lean, color, w=0.012):
    b = Vector(base)
    a = bm.verts.new(b + Vector((-w, 0, 0)))
    c = bm.verts.new(b + Vector((w, 0, 0)))
    t = bm.verts.new(b + Vector((lean[0], lean[1], height)))
    f = bm.faces.new((a, c, t))
    for l in f.loops:
        l[layer] = color


def add_torus(bm, layer, center, R, r, color, segs=8, rings=4, rot=(0, 0, 0)):
    grid = []
    for i in range(segs):
        th = i * math.tau / segs
        row = []
        for j in range(rings):
            ph = j * math.tau / rings
            p = Vector(((R + r * math.cos(ph)) * math.cos(th), (R + r * math.cos(ph)) * math.sin(th), r * math.sin(ph)))
            row.append(bm.verts.new(p))
        grid.append(row)
    verts = [v for row in grid for v in row]
    for i in range(segs):
        for j in range(rings):
            bm.faces.new((grid[i][j], grid[(i + 1) % segs][j], grid[(i + 1) % segs][(j + 1) % rings], grid[i][(j + 1) % rings]))
    bmesh.ops.rotate(bm, cent=(0, 0, 0), matrix=Matrix.Rotation(rot[0], 3, 'X') @
                     Matrix.Rotation(rot[1], 3, 'Y') @ Matrix.Rotation(rot[2], 3, 'Z'), verts=verts)
    bmesh.ops.translate(bm, vec=center, verts=verts)
    paint(layer, verts, color)
    return verts


# ------------------------------------------------------------------ variants
def props_plain(bm, layer, rnd):
    pass


def props_tyre(bm, layer, rnd):
    x, y = 0.08, -0.05
    z = surface_z(x, y)
    # upright, tilted, bottom half sunk into turf
    add_torus(bm, layer, (x, y, z + 0.02), 0.13, 0.045, RUBBER, segs=10, rings=4, rot=(math.radians(80), 0, math.radians(30)))
    # grass through the hole and around the base
    for _ in range(7):
        bx, by = x + rnd.uniform(-0.12, 0.12), y + rnd.uniform(-0.06, 0.06)
        add_blade(bm, layer, (bx, by, surface_z(bx, by) - 0.005), rnd.uniform(0.06, 0.12),
                  (rnd.uniform(-0.03, 0.03), rnd.uniform(-0.03, 0.03)), lerp(GRASS_B, KHAKI, rnd.random() * 0.5))


def props_bricks(bm, layer, rnd):
    for i in range(5):
        x, y = rnd.uniform(-0.3, 0.3), rnd.uniform(-0.3, 0.3)
        sink = rnd.uniform(0.0, 0.02)
        add_box(bm, layer, (x, y, surface_z(x, y) + 0.018 - sink), (0.09, 0.045, 0.04),
                BRICK if i % 2 else BRICK_D, rot=(rnd.uniform(-0.15, 0.15), rnd.uniform(-0.15, 0.15), rnd.uniform(0, math.pi)))
    # bent sign post: straight lower section, kinked upper section, no sign
    px, py = -0.25, 0.2
    z0 = surface_z(px, py)
    add_box(bm, layer, (px, py, z0 + 0.13), (0.028, 0.028, 0.3), RUST_D, rot=(0, 0, 0.4))
    kink = Vector((px, py, z0 + 0.28))
    tilt = math.radians(55)
    up = Vector((math.sin(tilt) * 0.22, 0, math.cos(tilt) * 0.22))
    add_box(bm, layer, kink + up * 0.5, (0.026, 0.026, 0.22), RUST, rot=(0, tilt, 0))
    # rusty bolt plate at the base
    add_box(bm, layer, (px, py, z0 + 0.012), (0.09, 0.09, 0.024), RUST_D, rot=(0, 0, 0.4))


def props_tarmac(bm, layer, rnd):
    cx, cy = 0.05, 0.02
    # irregular slab of tarmac poking through the turf
    pts = []
    for i in range(9):
        a = i * math.tau / 9 + rnd.uniform(-0.15, 0.15)
        r = rnd.uniform(0.22, 0.32)
        pts.append(Vector((cx + math.cos(a) * r, cy + math.sin(a) * r * 0.75, 0)))
    top = []
    for p in pts:
        p.z = surface_z(p.x, p.y) + 0.006
        top.append(bm.verts.new(p))
    f = bm.faces.new(top)
    for l in f.loops:
        l[layer] = TARMAC
    # crack: a darker sliver quad across the slab
    ca = bm.verts.new((cx - 0.2, cy - 0.04, surface_z(cx - 0.2, cy - 0.04) + 0.0075))
    cb = bm.verts.new((cx - 0.19, cy - 0.055, surface_z(cx - 0.19, cy - 0.055) + 0.0075))
    cc = bm.verts.new((cx + 0.15, cy + 0.09, surface_z(cx + 0.15, cy + 0.09) + 0.0075))
    cd = bm.verts.new((cx + 0.16, cy + 0.075, surface_z(cx + 0.16, cy + 0.075) + 0.0075))
    for l in bm.faces.new((ca, cb, cd, cc)).loops:
        l[layer] = mul(TARMAC, 0.5)
    # faded white road line, broken into two dashes
    for x0, x1 in ((-0.24, -0.08), (0.02, 0.2)):
        q = []
        for (x, y) in ((x0, -0.03), (x1, -0.03), (x1, 0.0), (x0, 0.0)):
            q.append(bm.verts.new((cx + x, cy + y, surface_z(cx + x, cy + y) + 0.008)))
        for l in bm.faces.new(q).loops:
            l[layer] = LINE


def props_thistle(bm, layer, rnd):
    cx, cy = -0.15, 0.1
    for i in range(5):
        x, y = cx + rnd.uniform(-0.07, 0.07), cy + rnd.uniform(-0.07, 0.07)
        h = rnd.uniform(0.14, 0.24)
        z = surface_z(x, y)
        add_box(bm, layer, (x, y, z + h / 2), (0.014, 0.014, h), STEM, rot=(rnd.uniform(-0.15, 0.15), rnd.uniform(-0.15, 0.15), 0))
        add_cyl(bm, layer, (x, y, z + h + 0.025), 0.03, 0.05, THISTLE, segs=5, r2=0.012)
        # a couple of spiky leaves
        for _ in range(2):
            add_blade(bm, layer, (x, y, z + h * 0.4), 0.06, (rnd.uniform(-0.05, 0.05), rnd.uniform(-0.05, 0.05)), STEM, w=0.01)
    # rusted paint can lying on its side
    px, py = 0.22, -0.12
    z = surface_z(px, py) + 0.045
    add_cyl(bm, layer, (px, py, z), 0.045, 0.11, RUST, segs=8, rot=(math.radians(88), 0, math.radians(-25)))
    # faded label band
    add_cyl(bm, layer, (px, py, z), 0.047, 0.045, LABEL, segs=8, rot=(math.radians(88), 0, math.radians(-25)))


VARIANTS = [
    ("Plain", props_plain),
    ("Tyre", props_tyre),
    ("Bricks", props_bricks),
    ("Tarmac", props_tarmac),
    ("Thistle", props_thistle),
]

for i, (label, fn) in enumerate(VARIANTS):
    root = bpy.data.objects.new(f"Tile_Grass_{i:02d}_{label}", None)
    root.empty_display_type = 'PLAIN_AXES'
    root.empty_display_size = 0.3
    root.location = (i * SPACING, 0, 0)
    col.objects.link(root)

    turf = bpy.data.objects.new("Turf", TURF_MESH)   # shared datablock
    col.objects.link(turf)
    turf.parent = root

    bm = bmesh.new()
    layer = bm.loops.layers.color.new("Col")
    fn(bm, layer, random.Random(100 + i))
    if len(bm.verts):
        to_object(bm, "Props", root)
    else:
        bm.free()
    root.asset_mark()

if MAT.name not in TURF_MESH.materials:
    TURF_MESH.materials.append(MAT)

bpy.ops.object.select_all(action='DESELECT')
print("Built 5 grass tile variants sharing one turf mesh.")
