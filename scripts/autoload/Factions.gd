extends Node

## The three faction meters, each -5..+5 from a start of 0.
## Thresholds at +/-3 turn rewards and punishments on; those consequences land
## in the milestones that own them (caravan counts at M3, prices at M4, raids
## and thefts at M5), but the standing itself is tracked from the start.

const MIN := -5
const MAX := 5
const REWARD_AT := 3
const PUNISH_AT := -3

const IDS := ["guild", "crown", "freeroad"]
const NAMES := {
	"guild": "Guild",
	"crown": "Crown",
	"freeroad": "Free Road",
}
const CRESTS := {
	"guild": "res://assets/ui/crest_guild.png",
	"crown": "res://assets/ui/crest_crown.png",
	"freeroad": "res://assets/ui/crest_freeroad.png",
}

var meters: Dictionary = {}


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	reset()


func reset() -> void:
	for id in IDS:
		meters[id] = 0
	for id in IDS:
		Events.faction_changed.emit(id, 0)


func get_standing(id: String) -> int:
	return meters.get(id, 0)


func adjust(id: String, amount: int) -> void:
	if not meters.has(id):
		push_warning("Factions: unknown faction %s" % id)
		return
	var before: int = meters[id]
	meters[id] = clampi(before + amount, MIN, MAX)
	if meters[id] == before:
		return
	Events.faction_changed.emit(id, meters[id])


func is_pleased(id: String) -> bool:
	return get_standing(id) >= REWARD_AT


func is_angered(id: String) -> bool:
	return get_standing(id) <= PUNISH_AT


func display_name(id: String) -> String:
	return NAMES.get(id, id)
