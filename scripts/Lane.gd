class_name Lane
extends Node2D

## A straight transit link between two stations. Holds a Path2D that ships are
## sampled along, tracks how much capacity is in use, and rolls the collision
## check. Bidirectional in the MVP: traffic both ways shares one capacity pool.
##
## Ships are parented to the world's y-sorted layer rather than to this node, so
## that a ship crossing in front of a station draws over it and one crossing
## behind draws under it. Parenting them under the lane would lock every ship to
## the lane's own depth and break that.
##
## Station and Ship references are untyped on purpose; see the note in Ship.gd.

const BASE_CAPACITY := 6
const COLLISION_TICK := 1.0
const COLLISION_CHANCE := 0.30
const COLLISION_LOAD_RATIO := 0.80
const COLLISION_REP := -3
const COLLISION_CREDITS := -20

const COLOUR_CLEAR := Color(0.42, 0.82, 0.52, 0.85)
const COLOUR_BUSY := Color(0.92, 0.82, 0.36, 0.9)
const COLOUR_JAMMED := Color(0.90, 0.34, 0.30, 0.95)

var lane_id: String = ""
var station_a = null
var station_b = null
var speed_mult: float = 1.0
var tile_length: float = 0.0

var occupants: Array = []
var _ship_layer: Node = null
var _collision_timer: float = 0.0
var _length: float = 0.0
var _heading: Vector2 = Vector2.RIGHT

@onready var _line: Line2D = $Line
@onready var _path: Path2D = $Path


func setup(id: String, a, b, tiles: float, ship_layer: Node) -> void:
	lane_id = id
	station_a = a
	station_b = b
	tile_length = tiles
	_ship_layer = ship_layer


func _ready() -> void:
	var a: Vector2 = station_a.global_position
	var b: Vector2 = station_b.global_position
	global_position = a
	var span := b - a
	_length = span.length()
	_heading = span.normalized()

	_line.clear_points()
	_line.add_point(Vector2.ZERO)
	_line.add_point(span)

	var curve := Curve2D.new()
	curve.add_point(Vector2.ZERO)
	curve.add_point(span)
	_path.curve = curve
	_refresh_tint()


func capacity() -> int:
	return BASE_CAPACITY + TechManager.lane_capacity_bonus


func load_units() -> int:
	var total := 0
	for ship in occupants:
		total += ship.size
	return total


func load_ratio() -> float:
	return float(load_units()) / float(maxi(1, capacity()))


func other_end(station):
	if station == station_a:
		return station_b
	return station_a


## Baseline traffic will squeeze into a lane that still has any room at all,
## which is what produces the forced jams the spec describes. Lane Signals hold
## a ship at the entry until its whole size fits.
func can_accept(ship) -> bool:
	if TechManager.flag("signals"):
		return load_units() + ship.size <= capacity()
	return load_units() < capacity()


func add_ship(ship, from_station) -> void:
	if ship.get_parent() != null:
		ship.get_parent().remove_child(ship)
	_ship_layer.add_child(ship)

	ship.current_lane = self
	ship.current_station = null
	ship.state = Ship.State.TRANSIT
	ship.travelled = 0.0
	ship.reversed = from_station == station_b
	ship.visible = true
	ship.rotation = 0.0

	var direction := _heading
	if ship.reversed:
		direction = -direction
	ship.face(direction)

	occupants.append(ship)
	_sync(ship)
	_refresh_tint()


func _process(delta: float) -> void:
	if occupants.is_empty():
		_collision_timer = 0.0
		return

	# Copy: arrivals mutate `occupants` while we walk it.
	for ship in occupants.duplicate():
		if not is_instance_valid(ship):
			occupants.erase(ship)
			continue
		ship.travelled = minf(ship.travelled + ship.speed_on(self) * delta, _length)
		_sync(ship)
		if ship.travelled >= _length:
			_try_arrive(ship)

	_collision_timer += delta
	while _collision_timer >= COLLISION_TICK:
		_collision_timer -= COLLISION_TICK
		_roll_collision()

	_refresh_tint()


func _sync(ship) -> void:
	if _path.curve == null:
		return
	var distance: float = ship.travelled
	if ship.reversed:
		distance = _length - ship.travelled
	ship.global_position = global_position + _path.curve.sample_baked(distance)


## A ship that reaches the far end but finds every dock busy stays on the lane,
## still consuming capacity. That backpressure is the point of dock_capacity.
func _try_arrive(ship) -> void:
	var target = station_a if ship.reversed else station_b
	if not target.has_dock_space():
		return
	detach(ship)
	target.accept_arrival(ship)


func detach(ship) -> void:
	occupants.erase(ship)
	ship.current_lane = null


func _roll_collision() -> void:
	if TechManager.flag("hauler_tugs"):
		return
	if load_ratio() < COLLISION_LOAD_RATIO:
		return

	var heavy = null
	var consumer = null
	for ship in occupants:
		if heavy == null and ship.ship_class == "heavy":
			heavy = ship
		elif consumer == null and ship.ship_class == "consumer":
			consumer = ship
	if heavy == null or consumer == null:
		return

	if randf() >= COLLISION_CHANCE * TechManager.collision_mult:
		return

	Game.collisions_today += 1
	Game.add_credits(COLLISION_CREDITS)
	Events.collision.emit(heavy, consumer, self)
	Events.toast.emit("Collision on %s: -3 rep, -20 cr" % lane_id, "bad")
	for ship in [heavy, consumer]:
		detach(ship)
		ship.state = Ship.State.DONE
		ship.queue_free()
	# Reputation last: it can end the run, and the wreck should be resolved first.
	Game.add_rep(COLLISION_REP)
	_refresh_tint()


func _refresh_tint() -> void:
	var t := clampf(load_ratio(), 0.0, 1.0)
	if t < 0.6:
		_line.default_color = COLOUR_CLEAR.lerp(COLOUR_BUSY, t / 0.6)
	else:
		_line.default_color = COLOUR_BUSY.lerp(COLOUR_JAMMED, (t - 0.6) / 0.4)
