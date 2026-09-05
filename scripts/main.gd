extends Node3D

## Roadmap step 1 (GAME_DESIGN.md section 11): the octagon array, its MultiMesh
## rendering and click-to-tile picking. World generation, fog and buildings come
## later; every tile here is grass.

## 120 x 120 is the map size quoted in section 8 -- 14,400 octagons and as many
## corner gaps. Drop it while iterating if the editor feels sluggish.
@export var map_width: int = 120
@export var map_height: int = 120
@export var world_seed: int = 1

var grid: OctGrid
var renderer: TileRenderer
var highlight: TileHighlight

var _hovered := Vector2i(-1, -1)

@onready var _camera: IsoCamera = $IsoCamera
@onready var _status: Label = $HUD/Status


func _ready() -> void:
	grid = OctGrid.new(map_width, map_height)

	renderer = TileRenderer.new()
	renderer.name = "TileRenderer"
	add_child(renderer)
	renderer.build(grid, world_seed)

	highlight = TileHighlight.new()
	highlight.name = "TileHighlight"
	add_child(highlight)

	# Start looking at the middle of the map, where the player settles.
	_camera.focus = grid.tile_to_world(Vector2i(map_width / 2, map_height / 2))
	_refresh_status()


func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventMouseMotion:
		_update_hover((event as InputEventMouseMotion).position)
	elif event is InputEventMouseButton:
		var mb := event as InputEventMouseButton
		if mb.pressed and mb.button_index == MOUSE_BUTTON_LEFT:
			_update_hover(mb.position)
			if grid.in_bounds(_hovered):
				_on_tile_clicked(_hovered)


## Picking is analytic rather than physics-based: the ground is a plane, so one
## ray-plane intersection plus the octagon test in OctGrid beats giving 14,400
## tiles collision shapes.
func _update_hover(screen_pos: Vector2) -> void:
	var origin := _camera.project_ray_origin(screen_pos)
	var dir := _camera.project_ray_normal(screen_pos)
	var plane := Plane(Vector3.UP, TilePalette.TILE_H)
	var point = plane.intersects_ray(origin, dir)
	if point == null:
		_clear_hover()
		return

	var pick := grid.world_to_tile(point)
	if not pick["hit"]:
		_clear_hover()
		return

	var tile: Vector2i = pick["tile"]
	if tile != _hovered:
		_hovered = tile
		highlight.move_to(grid, tile)
		_refresh_status()


func _clear_hover() -> void:
	if _hovered == Vector2i(-1, -1):
		return
	_hovered = Vector2i(-1, -1)
	highlight.visible = false
	_refresh_status()


func _on_tile_clicked(tile: Vector2i) -> void:
	print("tile %d,%d  variant %s" % [tile.x, tile.y, TileTypes.GRASS_VARIANTS[renderer.variant_at(tile)]])


func _refresh_status() -> void:
	var art := "authored art" if renderer.using_authored_art() else "placeholder turf (run art/blender/grass_tiles.py)"
	if grid.in_bounds(_hovered):
		_status.text = "%d x %d  |  %s\ntile %d,%d  %s\nWASD pan  Q/E rotate  wheel zoom" % [
			map_width, map_height, art, _hovered.x, _hovered.y,
			TileTypes.GRASS_VARIANTS[renderer.variant_at(_hovered)]]
	else:
		_status.text = "%d x %d  |  %s\nno tile under cursor\nWASD pan  Q/E rotate  wheel zoom" % [
			map_width, map_height, art]
