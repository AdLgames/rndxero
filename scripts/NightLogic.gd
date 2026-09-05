class_name NightLogic
extends RefCounted

## What happens when the day ends: buildings produce, the town and its guests
## consume, and anything short costs standing.
##
## M5 adds the night events, the rumour ticker and the full report screen. The
## consumption rules from section 3 are here in full now, because M2's
## buildings are only meaningful against them.


static func run() -> Dictionary:
	var report := {
		"day": Game.day,
		"food_produced": 0,
		"water_produced": 0,
		"food_consumed": 0,
		"water_consumed": 0,
		"shortfalls": [],
		"angered": [],
		"guests": Game.lodged_guests,
	}

	var food_gain := int(Game.total_effect("food_per_night"))
	var water_gain := int(Game.total_effect("water_per_night"))
	report["food_produced"] = food_gain
	report["water_produced"] = water_gain
	if food_gain != 0:
		Game.add("food", food_gain)
	if water_gain != 0:
		Game.add("water", water_gain)

	# Section 3: 2 food for the town plus 1 per lodged guest; water is 1 per
	# guest and 1 per animal, and a Stable halves the animals' draw.
	var animals := Game.lodged_animals
	if Game.has_effect("halve_animal_water"):
		animals = int(ceil(animals / 2.0))
	var food_cost := NightLogic._food_upkeep()
	var water_cost := Game.lodged_guests + animals
	report["food_consumed"] = food_cost
	report["water_consumed"] = water_cost

	_consume("food", food_cost, report)
	_consume("water", water_cost, report)

	# Section 3: anyone bedded down when the town runs short leaves angry.
	if not report["shortfalls"].is_empty():
		for faction in Game.lodged_factions:
			Factions.adjust(faction, -1)
		report["angered"] = Game.lodged_factions.duplicate()

	Game.clear_lodgers()
	Events.night_report.emit(report)
	return report


static func _food_upkeep() -> int:
	return Game.BASE_FOOD_UPKEEP + Game.lodged_guests


## Spend what there is; anything still owed empties the store and costs a point
## of reputation for that resource.
static func _consume(name: String, amount: int, report: Dictionary) -> void:
	if amount <= 0:
		return
	var stock: int = Game.get_resource(name)
	if stock >= amount:
		Game.add(name, -amount)
		return
	Game.add(name, -stock)
	report["shortfalls"].append(name)
	Game.add("reputation", -1)
	Events.toast.emit("Ashford ran short of %s" % name, "bad")
