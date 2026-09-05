class_name TileHighlight
extends MeshInstance3D

## Octagon outline that follows the tile under the cursor. Drawn as unshaded
## line segments just above the turf so it reads over any tile colour.

## Height above the tile rim; added to TilePalette.TILE_H at build time.
const LIFT := 0.045
const COLOUR := Color(1.0, 0.95, 0.65)


func _ready() -> void:
	mesh = _build_outline()
	var mat := StandardMaterial3D.new()
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mat.vertex_color_use_as_albedo = true
	mat.no_depth_test = true
	material_override = mat
	visible = false


func move_to(grid: OctGrid, tile: Vector2i) -> void:
	position = grid.tile_to_world(tile)
	visible = true


func _build_outline() -> ArrayMesh:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_LINES)
	st.set_color(COLOUR)
	for i in 16:
		var j := (i + 1) % 16
		st.add_vertex(_corner(i))
		st.add_vertex(_corner(j))
	return st.commit()


func _corner(i: int) -> Vector3:
	var a := i * PI / 8.0
	var r := OctGrid.APOTHEM if i % 2 == 0 else OctGrid.RCORNER
	return Vector3(cos(a) * r, TilePalette.TILE_H + LIFT, sin(a) * r)
