extends Node2D

## The road strip: parallax sky and hills, a tiled ground run, and the twelve
## plots laid left to right.
##
## Parallax is done here in world space rather than with ParallaxBackground.
## That node is a CanvasLayer, so its contents live in screen coordinates and
## have to be positioned against the camera's zoom and the viewport height; a
## resize or a zoom change pulls the horizon off the ground line. Three plain
## sprites offset against the camera each frame stay welded to the world.

signal plot_clicked(index)

const PLOT_SCENE := preload("res://scenes/Plot.tscn")

const PLOT_WIDTH := 64
const PLOT_SPACING := 92
const FIRST_PLOT_X := 140.0
const GROUND_TILE_WIDTH := 64
const GROUND_TILE_HEIGHT := 32
const SUBSOIL_DEPTH := 640

## How much of the camera's movement each backdrop layer keeps. 0 would pin a
## layer to the camera; 1 would weld it to the ground.
const LAYERS := [
	{"texture": "res://assets/road/sky.png", "height": 288, "scroll": 0.06, "z": -40},
	{"texture": "res://assets/road/hills_far.png", "height": 160, "scroll": 0.25, "z": -30},
	{"texture": "res://assets/road/hills_near.png", "height": 160, "scroll": 0.5, "z": -20},
]

var plots: Array = []

var _layers: Array = []
var _camera: Camera2D = null

@onready var _backdrop: Node2D = $Backdrop
@onready var _ground: Node2D = $Ground
@onready var _plots_root: Node2D = $Plots


## Total world width of the strip, used to clamp the camera.
func strip_width() -> float:
	return FIRST_PLOT_X * 2.0 + Data.plot_count * PLOT_SPACING


func build(camera: Camera2D) -> void:
	_camera = camera
	_build_backdrop()
	_build_ground()
	_build_plots()


func refresh_plots() -> void:
	for plot in plots:
		plot.refresh()


func _process(_delta: float) -> void:
	if _camera == null:
		return
	# Each layer slides back against the camera by the fraction of the motion
	# it does not keep, which is what makes the far hills lag the near ones.
	for entry in _layers:
		var sprite: Sprite2D = entry["sprite"]
		sprite.position.x = _camera.position.x * (1.0 - float(entry["scroll"]))


func _build_backdrop() -> void:
	# Wide enough that the layers still cover the view at either end of the
	# strip once they have slid against the camera.
	var span := strip_width() + 4096.0
	for definition in LAYERS:
		var texture := load(definition["texture"])
		if texture == null:
			continue
		var sprite := Sprite2D.new()
		sprite.texture = texture
		sprite.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
		sprite.texture_repeat = CanvasItem.TEXTURE_REPEAT_ENABLED
		sprite.centered = false
		sprite.region_enabled = true
		sprite.region_rect = Rect2(0, 0, span, definition["height"])
		sprite.position = Vector2(-2048, -float(definition["height"]))
		sprite.z_index = int(definition["z"])
		_backdrop.add_child(sprite)
		_layers.append({"sprite": sprite, "scroll": definition["scroll"]})


func _build_ground() -> void:
	var span := strip_width() + 4096.0

	var subsoil := Sprite2D.new()
	subsoil.texture = load("res://assets/road/dirt_fill.png")
	subsoil.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	subsoil.texture_repeat = CanvasItem.TEXTURE_REPEAT_ENABLED
	subsoil.centered = false
	subsoil.region_enabled = true
	subsoil.region_rect = Rect2(0, 0, span, SUBSOIL_DEPTH)
	subsoil.position = Vector2(-2048, GROUND_TILE_HEIGHT)
	subsoil.z_index = -10
	_ground.add_child(subsoil)

	# Three ground variants, alternated deterministically so the run has some
	# texture without looking random from one launch to the next.
	var textures: Array = []
	for i in 3:
		textures.append(load("res://assets/road/ground_%d.png" % i))
	var tiles := int(ceil(span / GROUND_TILE_WIDTH))
	for i in tiles:
		var texture = textures[(i * 7 + (i / 3)) % 3]
		if texture == null:
			continue
		var tile := Sprite2D.new()
		tile.texture = texture
		tile.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
		tile.centered = false
		tile.position = Vector2(-2048 + i * GROUND_TILE_WIDTH, 0)
		tile.z_index = -5
		_ground.add_child(tile)


func _build_plots() -> void:
	for i in Data.plot_count:
		var plot := PLOT_SCENE.instantiate()
		plot.index = i
		plot.position = Vector2(FIRST_PLOT_X + i * PLOT_SPACING, 0)
		plot.z_index = 10
		_plots_root.add_child(plot)
		plot.clicked.connect(_on_plot_clicked)
		plots.append(plot)


func _on_plot_clicked(index: int) -> void:
	plot_clicked.emit(index)
