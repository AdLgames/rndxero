class_name TilePalette
extends RefCounted

## Mirrors the palette at the top of art/blender/grass_tiles.py. Keep the two in
## step: the procedural placeholder turf must read as the same material as the
## exported art, or the map changes colour the day the assets land.

const GRASS_A := Color(0.40, 0.46, 0.27)   ## olive
const GRASS_B := Color(0.52, 0.56, 0.36)   ## sage
const KHAKI := Color(0.62, 0.55, 0.34)     ## dead grass
const DIRT := Color(0.44, 0.35, 0.22)

## Geometry constants shared with the Blender script.
const TILE_H := 0.06                       ## rim height


## Flat-shaded, vertex-colour-only material (no PBR maps anywhere in the art).
static func make_material() -> StandardMaterial3D:
	var mat := StandardMaterial3D.new()
	mat.vertex_color_use_as_albedo = true
	mat.roughness = 0.95
	mat.metallic = 0.0
	mat.metallic_specular = 0.05
	return mat
