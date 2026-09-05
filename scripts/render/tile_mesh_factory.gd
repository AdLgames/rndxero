class_name TileMeshFactory
extends RefCounted

## Supplies a mesh for every tile variant.
##
## The real art is authored in Blender (art/blender/grass_tiles.py) and exported
## to res://assets/tiles/. Those are binary assets that live outside this repo's
## history until someone runs the script, so the factory falls back to a
## procedural octagon that mirrors the same turf geometry and palette. The map
## therefore renders today, and picks up the authored meshes the moment they
## appear on disk -- no code change needed.

const RING_SEGMENTS := 16

## Matches build_turf_mesh() in the Blender script: a shallow dome of three
## rings over a dirt skirt. (fraction of the octagon radius, height, jitter)
const TURF_RINGS := [
	[0.45, TilePalette.TILE_H + 0.018, 0.02],
	[0.88, TilePalette.TILE_H - 0.012, 0.01],
	[1.00, TilePalette.TILE_H, 0.0],
]

var _material: StandardMaterial3D = TilePalette.make_material()
var _cache: Dictionary = {}


## Mesh for one grass variant: the exported asset when present, the procedural
## placeholder otherwise. Cached, since every tile of a variant shares one mesh.
func grass_mesh(variant: int) -> Mesh:
	var key := "grass_%d" % variant
	if _cache.has(key):
		return _cache[key]

	var mesh: Mesh = _load_asset(TileTypes.grass_asset_path(variant))
	if mesh == null:
		mesh = build_turf_mesh()
	_cache[key] = mesh
	return mesh


## True when at least one authored tile asset was found, so the caller can say
## whether it is showing real art or placeholders.
func has_authored_assets() -> bool:
	for i in TileTypes.GRASS_VARIANTS.size():
		if ResourceLoader.exists(TileTypes.grass_asset_path(i)):
			return true
	return false


func _load_asset(path: String) -> Mesh:
	if not ResourceLoader.exists(path):
		return null
	var packed := ResourceLoader.load(path)
	if packed is Mesh:
		return packed
	if packed is PackedScene:
		var root := (packed as PackedScene).instantiate()
		var mesh := _flatten(root)
		root.queue_free()
		return mesh
	return null


## A variant exports as a root Empty with "Turf" and "Props" children, so the
## glTF arrives as a small hierarchy. Bake it down to one mesh -- MultiMesh
## draws a single mesh per instance.
func _flatten(root: Node) -> Mesh:
	var parts: Array = []
	_collect_mesh_instances(root, root, parts)
	if parts.is_empty():
		return null

	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	for part in parts:
		var mesh: Mesh = part["mesh"]
		for s in mesh.get_surface_count():
			st.append_from(mesh, s, part["xform"])
	st.set_material(_material)
	return st.commit()


func _collect_mesh_instances(node: Node, root: Node, out: Array) -> void:
	if node is MeshInstance3D and (node as MeshInstance3D).mesh != null:
		var mi := node as MeshInstance3D
		out.append({
			"mesh": mi.mesh,
			"xform": (root as Node3D).global_transform.affine_inverse() * mi.global_transform,
		})
	for child in node.get_children():
		_collect_mesh_instances(child, root, out)


# --- procedural placeholder -------------------------------------------------

## Port of build_turf_mesh() from art/blender/grass_tiles.py, in Godot's Y-up
## space. Flat shaded, vertex colours only, base sitting at y = 0.
func build_turf_mesh(seed_value: int = 11) -> ArrayMesh:
	var rng := RandomNumberGenerator.new()
	rng.seed = seed_value
	var noise := FastNoiseLite.new()
	noise.noise_type = FastNoiseLite.TYPE_PERLIN
	noise.frequency = 1.0
	noise.seed = seed_value

	var centre := Vector3(rng.randf_range(-0.02, 0.02), TilePalette.TILE_H + 0.03, rng.randf_range(-0.02, 0.02))
	var rings: Array = []
	for spec in TURF_RINGS:
		rings.append(_ring(float(spec[0]), float(spec[1]), float(spec[2]), rng))
	var bottom := _ring(1.0, 0.0, 0.0, rng)

	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	st.set_smooth_group(-1)   ## flat shading

	var outer: Array = rings[2]

	# Top: fan over the inner ring, then a quad strip between each ring pair.
	for i in RING_SEGMENTS:
		var j := (i + 1) % RING_SEGMENTS
		_tri(st, centre, rings[0][i], rings[0][j],
			_grass_colour(centre, noise), _grass_colour(rings[0][i], noise), _grass_colour(rings[0][j], noise))

	for r in range(rings.size() - 1):
		var inner: Array = rings[r]
		var outer_r: Array = rings[r + 1]
		var ao_in := 0.78 if r == 1 else 1.0
		var ao_out := 0.78 if r == 0 else 1.0
		for i in RING_SEGMENTS:
			var j := (i + 1) % RING_SEGMENTS
			var ci := _shade(_grass_colour(inner[i], noise), ao_in)
			var cj := _shade(_grass_colour(inner[j], noise), ao_in)
			var co := _shade(_grass_colour(outer_r[i], noise), ao_out)
			var cp := _shade(_grass_colour(outer_r[j], noise), ao_out)
			_tri(st, inner[i], inner[j], outer_r[j], ci, cj, cp)
			_tri(st, inner[i], outer_r[j], outer_r[i], ci, cp, co)

	# Skirt: exposed dirt under the turf rim.
	var dirt_dark := _shade(TilePalette.DIRT, 0.75)
	for i in RING_SEGMENTS:
		var j := (i + 1) % RING_SEGMENTS
		_tri(st, outer[i], bottom[i], bottom[j], TilePalette.DIRT, dirt_dark, dirt_dark)
		_tri(st, outer[i], bottom[j], outer[j], TilePalette.DIRT, dirt_dark, TilePalette.DIRT)

	st.generate_normals()
	st.set_material(_material)
	return st.commit()


## 16 points tracing the octagon outline: corners and edge midpoints alternate,
## so the flats sit at the apothem and the corners at the circumradius.
func _ring(frac: float, y: float, jit: float, rng: RandomNumberGenerator) -> Array:
	var pts: Array = []
	for i in RING_SEGMENTS:
		var a := i * PI / 8.0
		var r := (OctGrid.APOTHEM if i % 2 == 0 else OctGrid.RCORNER) * frac
		var p := Vector3(cos(a) * r, y, sin(a) * r)
		if jit > 0.0:
			p += Vector3(rng.randf_range(-jit, jit), rng.randf_range(-0.004, 0.004), rng.randf_range(-jit, jit))
		pts.append(p)
	return pts


## Olive-to-sage noise, drying to khaki toward the tile edge.
func _grass_colour(p: Vector3, noise: FastNoiseLite) -> Color:
	var planar := Vector2(p.x, p.z)
	var d: float = maxf(maxf(absf(p.x), absf(p.z)) / OctGrid.APOTHEM, planar.length() / OctGrid.RCORNER)
	var n: float = noise.get_noise_3d(p.x * 5.0 + 7.0, p.z * 5.0 + 3.0, 0.0) * 0.5 + 0.5
	var base := TilePalette.GRASS_A.lerp(TilePalette.GRASS_B, n)
	var edge: float = minf(1.0, d * d * 0.9 + n * 0.35)
	return base.lerp(TilePalette.KHAKI, maxf(0.0, edge - 0.35))


## Baked ambient occlusion: darken RGB only, leaving the tile fully opaque.
func _shade(c: Color, k: float) -> Color:
	return Color(c.r * k, c.g * k, c.b * k, 1.0)


func _tri(st: SurfaceTool, a: Vector3, b: Vector3, c: Vector3, ca: Color, cb: Color, cc: Color) -> void:
	st.set_color(ca)
	st.add_vertex(a)
	st.set_color(cb)
	st.add_vertex(b)
	st.set_color(cc)
	st.add_vertex(c)
