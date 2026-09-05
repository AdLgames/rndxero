class_name CaravanQueue
extends Node

## Picks the day's caravans, walks them in one at a time, and applies the
## outcome the player chooses. Owns the toll, lodging and turn-away rules from
## sections 4 and 5, so the card that presents them stays a view.

signal caravan_ready(data)
signal morning_finished

const CARAVAN_SCENE := preload("res://scenes/Caravan.tscn")

const GATE_X := 70.0
const SPAWN_X := -340.0
const MIN_PER_DAY := 1
const MAX_PER_DAY := 4

## Section 5: only the top toll costs standing, and only that one can be refused.
const TOLLS := [0, 5, 10, 20]
const HIGH_TOLL := 20

var _seen: Dictionary = {}
var _pending: Array = []
var _current: Node2D = null
var _current_data: Dictionary = {}
var _road: Node = null


func setup(road: Node) -> void:
	_road = road


func reset() -> void:
	_seen.clear()
	_pending.clear()
	if is_instance_valid(_current):
		_current.queue_free()
	_current = null
	_current_data = {}


func begin_day() -> void:
	_pending = roll_for_day()
	_next()


## Section 5: reputation sets the traffic. The Guild's boycott and the Bazaar's
## pull (sections 4 and 6) move it by one either way.
func caravans_today() -> int:
	var count := 1 + int(floor(Game.reputation / 3.0))
	if Factions.is_angered("guild"):
		count -= 1
	count += int(Game.total_effect("guild_caravans"))
	return clampi(count, MIN_PER_DAY, MAX_PER_DAY)


func roll_for_day() -> Array:
	var pool: Array = []
	for entry in Data.caravans:
		if Game.day < int(entry.get("min_day", 1)) or Game.day > int(entry.get("max_day", 99)):
			continue
		if _seen.has(entry["id"]) and not entry.get("repeatable", false):
			continue
		pool.append(entry)

	var picked: Array = []
	var wanted := caravans_today()
	while picked.size() < wanted and not pool.is_empty():
		var choice := _weighted_take(pool)
		if choice.is_empty():
			break
		picked.append(choice)
	return picked


## Draw one caravan from the pool, removing it so a day never doubles up.
## Factions you have pleased send more of their own.
func _weighted_take(pool: Array) -> Dictionary:
	var total := 0.0
	var weights: Array = []
	for entry in pool:
		var standing := Factions.get_standing(entry.get("faction", ""))
		var weight: float = maxf(0.15, float(entry.get("weight", 1.0)) * (1.0 + standing * 0.15))
		weights.append(weight)
		total += weight
	if total <= 0.0:
		return {}

	var roll := randf() * total
	for i in pool.size():
		roll -= float(weights[i])
		if roll <= 0.0:
			var chosen: Dictionary = pool[i]
			pool.remove_at(i)
			return chosen
	var last: Dictionary = pool[pool.size() - 1]
	pool.remove_at(pool.size() - 1)
	return last


func _next() -> void:
	if is_instance_valid(_current):
		_current.depart()
	_current = null
	_current_data = {}

	if _pending.is_empty():
		morning_finished.emit()
		return

	var data: Dictionary = _pending.pop_front()
	_seen[data["id"]] = true
	_current_data = data

	var caravan := CARAVAN_SCENE.instantiate()
	_road.add_child(caravan)
	caravan.position = Vector2(SPAWN_X, 0)
	caravan.setup(data)
	caravan.arrived.connect(_on_caravan_arrived)
	caravan.arrive_at(GATE_X)
	_current = caravan
	Events.caravan_arrived.emit(data)


func _on_caravan_arrived() -> void:
	caravan_ready.emit(_current_data)


# --- outcomes ---------------------------------------------------------------

func can_lodge(data: Dictionary) -> bool:
	return Game.beds_free() >= int(data.get("size", 1))


## True when a caravan walks rather than pay. Only the top toll provokes it,
## only from a faction already sour, and a Gatehouse settles the argument.
func refuses(data: Dictionary, toll: int) -> bool:
	if toll < HIGH_TOLL:
		return false
	if Game.has_effect("gatehouse"):
		return false
	return Factions.get_standing(data.get("faction", "")) < 0


## `action` is one of "lodge", "pass" or "turn_away".
func resolve(action: String, toll: int) -> void:
	if _current_data.is_empty():
		return
	var data := _current_data
	var faction: String = data.get("faction", "")
	var outcome := action

	if action == "turn_away":
		Factions.adjust(faction, -1)
		Events.toast.emit("%s turned away" % data["name"], "bad")
	elif refuses(data, toll):
		Factions.adjust(faction, -1)
		outcome = "refused"
		Events.toast.emit("%s refused the %d coin toll and moved on" % [data["name"], toll], "bad")
	else:
		if toll > 0:
			Game.add("coin", toll)
		if toll >= HIGH_TOLL:
			Factions.adjust(faction, -1)
		if action == "lodge" and can_lodge(data):
			Game.lodge(faction, int(data.get("size", 1)), int(data.get("animals", 0)))
			# A Great Inn sends them away better disposed than an ordinary one.
			Factions.adjust(faction, 1 + int(Game.total_effect("lodging_faction_bonus")))
			Events.toast.emit("%s lodged for the night (+%d coin)" % [data["name"], toll], "good")
		else:
			outcome = "pass"
			Events.toast.emit("%s passed through (+%d coin)" % [data["name"], toll], "good")

	Events.caravan_resolved.emit(data, outcome)
	_next()
