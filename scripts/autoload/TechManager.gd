extends Node

## Loads data/tech.json and folds every purchased node into a small set of
## modifier fields. Systems read those fields instead of asking "do I have tech
## X?", so a new node is data-only as long as it reuses an effect type below.
##
## Supported effect types:
##   {"type": "lane_capacity",   "value": int}          capacity added to every lane
##   {"type": "ship_speed_mult", "value": float}        multiplied into ship speed
##   {"type": "dock_capacity",   "value": int}          docks added to every station
##   {"type": "collision_mult",  "value": float}        multiplied into collision chance
##   {"type": "patience",        "ship_class": String, "value": float}
##   {"type": "flag",            "flag": String}        sets a named boolean

const TECH_PATH := "res://data/tech.json"

var nodes: Array = []           ## raw node dictionaries, in file order
var by_id: Dictionary = {}
var unlocked: Dictionary = {}   ## id -> true

# Modifiers. Reset() restores these defaults.
var lane_capacity_bonus: int = 0
var ship_speed_mult: float = 1.0
var dock_capacity_bonus: int = 0
var collision_mult: float = 1.0
var patience_bonus: Dictionary = {}
var flags: Dictionary = {}


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	_load()


func _load() -> void:
	var file := FileAccess.open(TECH_PATH, FileAccess.READ)
	if file == null:
		push_error("TechManager: cannot open %s" % TECH_PATH)
		return
	var parsed = JSON.parse_string(file.get_as_text())
	file.close()
	if typeof(parsed) != TYPE_DICTIONARY or not parsed.has("nodes"):
		push_error("TechManager: %s is not a tech document" % TECH_PATH)
		return
	nodes = parsed["nodes"]
	by_id.clear()
	for n in nodes:
		by_id[n["id"]] = n


func reset() -> void:
	unlocked.clear()
	lane_capacity_bonus = 0
	ship_speed_mult = 1.0
	dock_capacity_bonus = 0
	collision_mult = 1.0
	patience_bonus.clear()
	flags.clear()


func has(id: String) -> bool:
	return unlocked.has(id)


func flag(name: String) -> bool:
	return flags.get(name, false)


func patience_for(ship_class: String) -> float:
	return patience_bonus.get(ship_class, 0.0)


## Prereqs met and not already owned. Affordability is checked separately so the
## UI can show "you need 40 more credits" rather than just greying the row out.
func prereqs_met(id: String) -> bool:
	if not by_id.has(id) or unlocked.has(id):
		return false
	for p in by_id[id]["prereqs"]:
		if not unlocked.has(p):
			return false
	return true


func can_buy(id: String) -> bool:
	return prereqs_met(id) and Game.credits >= int(by_id[id]["cost"])


func buy(id: String) -> bool:
	if not can_buy(id):
		return false
	if not Game.try_spend(int(by_id[id]["cost"])):
		return false
	apply(id)
	return true


## Marks a node owned and folds its effect in. Split from buy() so a future
## save/load can replay a run's tech without re-charging for it.
func apply(id: String) -> void:
	if unlocked.has(id) or not by_id.has(id):
		return
	unlocked[id] = true
	apply_effect(by_id[id].get("effect", {}))
	Events.tech_unlocked.emit(id)
	Events.toast.emit("%s online" % by_id[id]["name"], "good")


func apply_effect(effect: Dictionary) -> void:
	match effect.get("type", ""):
		"lane_capacity":
			lane_capacity_bonus += int(effect["value"])
		"ship_speed_mult":
			ship_speed_mult *= float(effect["value"])
		"dock_capacity":
			dock_capacity_bonus += int(effect["value"])
		"collision_mult":
			collision_mult *= float(effect["value"])
		"patience":
			var c: String = effect["ship_class"]
			patience_bonus[c] = patience_bonus.get(c, 0.0) + float(effect["value"])
		"flag":
			flags[effect["flag"]] = true
		_:
			push_warning("TechManager: unknown effect type %s" % effect)
