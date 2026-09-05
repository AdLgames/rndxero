extends Node2D

## Click a station, then click a second one to lay a lane between them.
## Draws the candidate highlights and the preview line itself, so there are no
## extra nodes to keep in sync with the selection.

const HIGHLIGHT_RADIUS := 34.0
const COLOUR_SELECTED := Color(0.55, 0.85, 1.0, 0.95)
const COLOUR_VALID := Color(0.45, 0.9, 0.55, 0.8)
const COLOUR_INVALID := Color(0.9, 0.4, 0.35, 0.5)
const COLOUR_PREVIEW := Color(0.7, 0.9, 1.0, 0.5)

signal status_changed(text)

var map: MapGen
var stations: Array = []

var _selected = null
var _valid_targets: Array = []
var _mouse_world: Vector2 = Vector2.ZERO
var _lane_scene: PackedScene = preload("res://scenes/Lane.tscn")
var _lane_serial: int = 0
var _lane_parent: Node = null
var _ship_layer: Node = null


func setup(map_gen: MapGen, station_list: Array, lane_parent: Node, ship_layer: Node) -> void:
	map = map_gen
	stations = station_list
	_lane_parent = lane_parent
	_ship_layer = ship_layer
	for station in stations:
		station.clicked.connect(_on_station_clicked)


func _process(_delta: float) -> void:
	if _selected != null:
		_mouse_world = get_global_mouse_position()
		queue_redraw()


func _unhandled_input(event: InputEvent) -> void:
	# A click that missed every station area cancels the selection.
	if event is InputEventMouseButton:
		var mb := event as InputEventMouseButton
		if mb.pressed and mb.button_index == MOUSE_BUTTON_RIGHT:
			_clear_selection()


func _on_station_clicked(station) -> void:
	if _selected == null:
		_select(station)
		return
	if station == _selected:
		_clear_selection()
		return
	_try_build(_selected, station)


func _select(station) -> void:
	_selected = station
	_valid_targets = []
	for other in stations:
		if other == station:
			continue
		if _blocking_reason(station, other) == "":
			_valid_targets.append(other)
	status_changed.emit("%s selected - pick a destination (right click to cancel)" % station.display_name)
	queue_redraw()


func _clear_selection() -> void:
	if _selected == null:
		return
	_selected = null
	_valid_targets = []
	status_changed.emit("")
	queue_redraw()


## Empty string means the lane is legal. Affordability is checked separately so
## an unaffordable-but-legal target still highlights.
func _blocking_reason(a, b) -> String:
	if Dispatcher.has_lane_between(a.station_id, b.station_id):
		return "A lane already links %s and %s" % [a.display_name, b.display_name]
	if not map.line_of_sight(a.tile_pos, b.tile_pos):
		return "No line of sight: debris between %s and %s" % [a.display_name, b.display_name]
	return ""


func _try_build(a, b) -> void:
	var reason := _blocking_reason(a, b)
	if reason != "":
		Events.toast.emit(reason, "bad")
		return

	var tiles := map.tile_distance(a.tile_pos, b.tile_pos)
	var cost := Game.lane_cost(tiles)
	if not Game.try_spend(cost):
		Events.toast.emit("Need %d credits for that lane" % cost, "bad")
		return

	_lane_serial += 1
	var lane = _lane_scene.instantiate()
	lane.setup("L%d" % _lane_serial, a, b, tiles, _ship_layer)
	_lane_parent.add_child(lane)
	Dispatcher.register_lane(lane)
	Events.lane_built.emit(lane)
	Events.toast.emit("Lane %s built for %d credits" % [lane.lane_id, cost], "good")
	_clear_selection()


func _draw() -> void:
	if _selected == null:
		return
	draw_arc(_selected.global_position, HIGHLIGHT_RADIUS, 0.0, TAU, 32, COLOUR_SELECTED, 2.0)
	for other in stations:
		if other == _selected:
			continue
		var ok := _valid_targets.has(other)
		draw_arc(other.global_position, HIGHLIGHT_RADIUS, 0.0, TAU, 32,
			COLOUR_VALID if ok else COLOUR_INVALID, 2.0)
		if ok:
			var tiles := map.tile_distance(_selected.tile_pos, other.tile_pos)
			var cost := Game.lane_cost(tiles)
			draw_string(ThemeDB.fallback_font, other.global_position + Vector2(-20, 46),
				"%d cr" % cost, HORIZONTAL_ALIGNMENT_LEFT, -1, 14,
				COLOUR_VALID if Game.credits >= cost else COLOUR_INVALID)
	draw_line(_selected.global_position, _mouse_world, COLOUR_PREVIEW, 2.0)
