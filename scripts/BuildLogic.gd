class_name BuildLogic
extends RefCounted

## Placing and upgrading. Plots are stored on Game as run state; this is the
## only thing that writes to them, so the affordability and legality rules live
## in one place rather than in the menu that happens to call them.


## The definition standing on a plot right now, base or upgraded.
static func current_definition(plot) -> Dictionary:
	if plot == null:
		return {}
	var base: Dictionary = Data.definition(plot["base_id"])
	if plot.get("upgraded", false) and base.has("upgrade"):
		return base["upgrade"]
	return base


static func definition_at(index: int) -> Dictionary:
	if index < 0 or index >= Game.plots.size():
		return {}
	return current_definition(Game.plots[index])


static func is_empty(index: int) -> bool:
	return index >= 0 and index < Game.plots.size() and Game.plots[index] == null


## Empty string means the build is legal; otherwise it is the reason it is not,
## so the menu can say why rather than just greying a row out.
static func blocking_reason(index: int, building_id: String) -> String:
	if not is_empty(index):
		return "That plot is taken"
	var definition: Dictionary = Data.definition(building_id)
	if definition.is_empty():
		return "No such building"
	if Game.coin < int(definition["cost"]):
		return "Needs %d coin" % int(definition["cost"])
	return ""


static func place(index: int, building_id: String) -> bool:
	if blocking_reason(index, building_id) != "":
		return false
	var definition: Dictionary = Data.definition(building_id)
	if not Game.try_spend(int(definition["cost"])):
		return false

	Game.plots[index] = {"base_id": building_id, "upgraded": false}
	_apply_on_build(definition)
	Events.building_placed.emit(building_id, index)
	Events.toast.emit("%s raised for %d coin" % [definition["name"], int(definition["cost"])], "good")
	Game.broadcast_resources()
	return true


static func upgrade_definition(index: int) -> Dictionary:
	var plot = Game.plots[index] if index >= 0 and index < Game.plots.size() else null
	if plot == null or plot.get("upgraded", false):
		return {}
	var base: Dictionary = Data.definition(plot["base_id"])
	return base.get("upgrade", {})


static func upgrade_blocking_reason(index: int) -> String:
	var next := upgrade_definition(index)
	if next.is_empty():
		return "Nothing to improve here"
	if Game.coin < int(next["cost"]):
		return "Needs %d coin" % int(next["cost"])
	return ""


static func upgrade(index: int) -> bool:
	if upgrade_blocking_reason(index) != "":
		return false
	var next := upgrade_definition(index)
	if not Game.try_spend(int(next["cost"])):
		return false

	Game.plots[index]["upgraded"] = true
	_apply_on_build(next)
	Events.building_upgraded.emit(next["id"], index)
	Events.toast.emit("%s finished for %d coin" % [next["name"], int(next["cost"])], "good")
	Game.broadcast_resources()
	return true


## One-off faction shifts a building grants when it goes up, e.g. the Palisade
## pleasing the Crown. Distinct from `effects`, which are ongoing.
static func _apply_on_build(definition: Dictionary) -> void:
	var shifts: Dictionary = definition.get("on_build", {})
	for faction in shifts:
		Factions.adjust(faction, int(shifts[faction]))
