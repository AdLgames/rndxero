class_name Station
extends Node2D

## Spawns ships, holds the ones waiting for an onward lane, and meters arrivals
## through a limited number of docks. Ship/Lane references are untyped; see the
## note in Ship.gd.

## Seconds an arriving ship occupies a dock before it delivers or re-queues.
const DOCK_TIME := 1.5
const BASE_DOCK_CAPACITY := 3

signal clicked(station)

var station_id: String = ""
var display_name: String = ""
var tile_pos: Vector2i = Vector2i.ZERO
var spawn_table: Dictionary = {}
var spawn_interval: float = 6.0

var queue: Array = []       ## ships waiting for a lane, oldest first
var docking: Array = []     ## ships mid-transfer; parallel to _dock_timers
var _dock_timers: Array = []
var _spawn_timer: float = 0.0
var _ship_scene: PackedScene = preload("res://scenes/Ship.tscn")
var _spawn_serial: int = 0

@onready var _sprite: Sprite2D = $Sprite
@onready var _queue_label: Label = $QueueLabel


func setup(data: Dictionary) -> void:
	station_id = data["id"]
	display_name = data["name"]
	tile_pos = Vector2i(int(data["tile_pos"]["x"]), int(data["tile_pos"]["y"]))
	spawn_table = data["spawn_table"]
	spawn_interval = float(data["spawn_interval"])
	name = "Station_" + station_id
	if is_node_ready():
		_apply_sprite(data["sprite"])
	else:
		set_meta("pending_sprite", data["sprite"])


func _ready() -> void:
	if has_meta("pending_sprite"):
		_apply_sprite(get_meta("pending_sprite"))
	$Click.input_event.connect(_on_click_area_input)
	Events.day_passed.connect(_on_day_passed)
	_spawn_timer = spawn_interval
	_refresh_label()


func _apply_sprite(path: String) -> void:
	var tex := load(path)
	if tex != null:
		_sprite.texture = tex


func dock_capacity() -> int:
	return BASE_DOCK_CAPACITY + TechManager.dock_capacity_bonus


func has_dock_space() -> bool:
	return docking.size() < dock_capacity()


func _process(delta: float) -> void:
	if not Game.running:
		return
	_tick_spawn(delta)
	_tick_docks(delta)
	_tick_patience(delta)
	_refresh_label()


# --- spawning ---------------------------------------------------------------

func _tick_spawn(delta: float) -> void:
	_spawn_timer -= delta
	if _spawn_timer > 0.0:
		return
	_spawn_timer += spawn_interval
	_spawn_one()


func _spawn_one() -> void:
	# Only ship somewhere the network can actually reach, otherwise every early
	# spawn would just sit in the queue and bleed reputation.
	var destinations := Dispatcher.reachable_from(station_id)
	if destinations.is_empty():
		return

	var dest: String = destinations[randi() % destinations.size()]
	var ship = _ship_scene.instantiate()
	ship.setup(_pick_class(), station_id, dest)
	_spawn_serial += 1
	ship.name = "%s_ship_%d" % [station_id, _spawn_serial]
	add_child(ship)
	ship.visible = false
	ship.current_station = self
	ship.state = Ship.State.QUEUED
	ship.path = Dispatcher.find_path(station_id, dest)
	queue.append(ship)
	Events.ship_spawned.emit(ship)


func _pick_class() -> String:
	var total := 0.0
	for cls in spawn_table:
		total += float(spawn_table[cls])
	if total <= 0.0:
		return "consumer"
	var roll := randf() * total
	for cls in ShipTypes.ORDER:
		if not spawn_table.has(cls):
			continue
		roll -= float(spawn_table[cls])
		if roll <= 0.0:
			return cls
	return "consumer"


# --- docks ------------------------------------------------------------------

## Called by a Lane once a ship reaches this end and a dock is free.
func accept_arrival(ship) -> void:
	add_child(ship)
	ship.visible = false
	ship.position = Vector2.ZERO
	ship.rotation = 0.0
	ship.current_station = self
	ship.state = Ship.State.DOCKING
	docking.append(ship)
	_dock_timers.append(DOCK_TIME)


func _tick_docks(delta: float) -> void:
	for i in range(docking.size() - 1, -1, -1):
		_dock_timers[i] -= delta
		if _dock_timers[i] > 0.0:
			continue
		var ship = docking[i]
		docking.remove_at(i)
		_dock_timers.remove_at(i)
		if not is_instance_valid(ship):
			continue
		if ship.dest_id == station_id:
			_deliver(ship)
		else:
			_requeue(ship)


func _deliver(ship) -> void:
	Game.add_credits(ship.pay)
	ship.state = Ship.State.DONE
	Events.ship_delivered.emit(ship)
	ship.queue_free()


func _requeue(ship) -> void:
	ship.state = Ship.State.QUEUED
	# Patience resets per leg: the wait that matters is the one at this station.
	var s := ShipTypes.stats(ship.ship_class)
	ship.patience_left = float(s["patience"]) + TechManager.patience_for(ship.ship_class)
	if ship.path.is_empty():
		ship.path = Dispatcher.find_path(station_id, ship.dest_id)
	queue.append(ship)


# --- queue and patience -----------------------------------------------------

func enqueue(ship) -> void:
	queue.append(ship)


func _tick_patience(delta: float) -> void:
	for i in range(queue.size() - 1, -1, -1):
		var ship = queue[i]
		if not is_instance_valid(ship):
			queue.remove_at(i)
			continue
		ship.patience_left -= delta
		if ship.patience_left > 0.0:
			continue
		queue.remove_at(i)
		ship.state = Ship.State.DONE
		Events.ship_abandoned.emit(ship)
		Events.toast.emit("%s gave up at %s" % [ship.ship_class.capitalize(), display_name], "bad")
		ship.queue_free()
		Game.add_rep(-1)


func _refresh_label() -> void:
	var waiting := queue.size()
	_queue_label.text = str(waiting) if waiting > 0 else ""
	_queue_label.modulate = Color(1, 0.5, 0.4) if waiting >= dock_capacity() * 2 else Color(1, 1, 1)


# --- input ------------------------------------------------------------------

func _on_click_area_input(_viewport: Node, event: InputEvent, _shape_idx: int) -> void:
	if event is InputEventMouseButton:
		var mb := event as InputEventMouseButton
		if mb.pressed and mb.button_index == MOUSE_BUTTON_LEFT:
			clicked.emit(self)
			get_viewport().set_input_as_handled()


func _on_day_passed(_day: int) -> void:
	spawn_interval = maxf(Game.MIN_SPAWN_INTERVAL, spawn_interval * Game.DEMAND_DECAY)
