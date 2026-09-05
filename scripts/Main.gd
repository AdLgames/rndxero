extends Node2D

## Assembles a run: build the field, place the stations, wire the build tool,
## and turn wrecks into explosions. Everything stateful lives in the autoloads,
## so reloading this scene is enough to restart.

const STATIONS_PATH := "res://data/stations.json"

var map: MapGen
var stations: Array = []

@onready var _backdrop: Node2D = $Backdrop
@onready var _terrain: TileMapLayer = $Terrain
@onready var _lanes: Node2D = $Lanes
@onready var _world: Node2D = $World
@onready var _build_tool: Node2D = $BuildTool
@onready var _camera: Camera2D = $Camera
@onready var _hud = $HUD

var _station_scene: PackedScene = preload("res://scenes/Station.tscn")
var _explosion_scene: PackedScene = preload("res://scenes/Explosion.tscn")


func _ready() -> void:
	Game.reset()
	TechManager.reset()
	Dispatcher.clear()

	var config := _load_config()
	if config.is_empty():
		return

	_build_map(config)
	_place_stations(config)
	_build_tool.setup(map, stations, _lanes, _world)
	_build_tool.status_changed.connect(_hud.set_status)
	Events.collision.connect(_on_collision)

	_centre_camera()
	_scatter_planets(int(config["map_seed"]))
	Game.start()


func _load_config() -> Dictionary:
	var file := FileAccess.open(STATIONS_PATH, FileAccess.READ)
	if file == null:
		push_error("Main: cannot open %s" % STATIONS_PATH)
		return {}
	var parsed = JSON.parse_string(file.get_as_text())
	file.close()
	if typeof(parsed) != TYPE_DICTIONARY:
		push_error("Main: %s is not a station document" % STATIONS_PATH)
		return {}
	return parsed


func _build_map(config: Dictionary) -> void:
	var size: Dictionary = config["map_size"]
	map = MapGen.new(int(size["w"]), int(size["h"]))

	var cells: Array = []
	for entry in config["stations"]:
		cells.append(Vector2i(int(entry["tile_pos"]["x"]), int(entry["tile_pos"]["y"])))

	# Two corridors stay open so the network is buildable from turn one; the
	# third pair is walled off, which is what makes Depot a real hub.
	var clear_pairs := [[cells[0], cells[1]], [cells[1], cells[2]]]
	var block_pairs := [[cells[0], cells[2]]]
	map.generate(int(config["map_seed"]), cells, clear_pairs, block_pairs)
	map.paint(_terrain)


func _place_stations(config: Dictionary) -> void:
	for entry in config["stations"]:
		var station = _station_scene.instantiate()
		station.setup(entry)
		_world.add_child(station)
		station.position = _terrain.map_to_local(station.tile_pos)
		stations.append(station)
		Dispatcher.register_station(station)


func _centre_camera() -> void:
	var centre := Vector2.ZERO
	for station in stations:
		centre += station.position
	if not stations.is_empty():
		centre /= stations.size()
	_camera.position = centre


## Decorative only -- planets sit far behind the field and never interact.
func _scatter_planets(seed_value: int) -> void:
	var centre := _camera.position
	var radius := 200.0
	for station in stations:
		radius = maxf(radius, station.position.distance_to(centre))
	_backdrop.build(seed_value, centre, radius)


func _on_collision(a, b, _lane) -> void:
	var where: Vector2 = a.global_position
	if is_instance_valid(b):
		where = (a.global_position + b.global_position) * 0.5
	var fx := _explosion_scene.instantiate()
	add_child(fx)
	fx.global_position = where
