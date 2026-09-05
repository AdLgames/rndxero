class_name NightLogic
extends RefCounted

## What happens when the day ends: buildings produce, the town and its guests
## consume, anything short costs standing, an event may land, and a line comes
## in off the road.
##
## Tomorrow's event is rolled tonight rather than tomorrow. That is what lets a
## pleased Free Road warn you about it (section 4) -- the warning has to be
## about something already decided, or it is not a warning.

## Section 7: an event lands roughly one night in three.
const EVENT_CHANCE := 0.34


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
		"events": [],
		"omen": "",
		"rumor": "",
	}

	_produce(report)
	_consume_all(report)
	_resolve_events(report)
	_look_ahead(report)
	report["rumor"] = _pick_rumor()

	Events.night_report.emit(report)
	return report


# --- production and upkeep ---------------------------------------------------

static func _produce(report: Dictionary) -> void:
	var food_gain := int(Game.total_effect("food_per_night"))
	var water_gain := int(Game.total_effect("water_per_night"))
	report["food_produced"] = food_gain
	report["water_produced"] = water_gain
	if food_gain != 0:
		Game.add("food", food_gain)
	if water_gain != 0:
		Game.add("water", water_gain)


static func _consume_all(report: Dictionary) -> void:
	# Section 3: 2 food for the town plus 1 per lodged guest; water is 1 per
	# guest and 1 per animal, and a Stable halves the animals' draw.
	var animals := Game.lodged_animals + Game.town_animals
	if Game.has_effect("halve_animal_water"):
		animals = int(ceil(animals / 2.0))
	var food_cost := Game.BASE_FOOD_UPKEEP + Game.lodged_guests
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


# --- events ------------------------------------------------------------------

## Anything an encounter queued fires first and unconditionally; then whatever
## was rolled for tonight a night ago.
static func _resolve_events(report: Dictionary) -> void:
	for id in Game.queued_events:
		_fire(str(id), report)
	Game.queued_events = []

	if Game.next_night_event != "":
		_fire(Game.next_night_event, report)
		Game.next_night_event = ""


static func _fire(id: String, report: Dictionary) -> void:
	var event := Data.night_event(id)
	if event.is_empty():
		push_warning("NightLogic: unknown night event %s" % id)
		return
	Game.apply_effects(event.get("effects", {}))
	report["events"].append({
		"text": str(event.get("text", "")),
		"tone": str(event.get("tone", "bad")),
	})
	Events.night_event.emit(id)


## Roll for tomorrow, and tell the player about it if the Free Road likes them
## enough to pass word along.
static func _look_ahead(report: Dictionary) -> void:
	Game.next_night_event = ""
	if randf() >= EVENT_CHANCE:
		return

	var pool := _eligible(Game.day + 1)
	if pool.is_empty():
		return
	var chosen := _weighted_pick(pool)
	if chosen.is_empty():
		return
	Game.next_night_event = str(chosen["id"])

	# Section 4: warnings before bad events, for a Free Road at +3 or better.
	var omen := str(chosen.get("omen", ""))
	if omen != "" and Factions.is_pleased("freeroad"):
		report["omen"] = omen


## Events legal on a given day: in range, matching the faction gates, and not
## prevented by something the town has built.
static func _eligible(day: int) -> Array:
	var pool: Array = []
	for event in Data.night_events:
		if day < int(event.get("min_day", 1)) or day > int(event.get("max_day", 99)):
			continue
		if not _faction_gates_pass(event):
			continue
		var blocker := str(event.get("blocked_by", ""))
		if blocker != "" and Game.has_effect(blocker):
			continue
		pool.append(event)
	return pool


static func _faction_gates_pass(event: Dictionary) -> bool:
	for id in event.get("faction_at_most", {}):
		if Factions.get_standing(str(id)) > int(event["faction_at_most"][id]):
			return false
	for id in event.get("faction_at_least", {}):
		if Factions.get_standing(str(id)) < int(event["faction_at_least"][id]):
			return false
	return true


static func _weighted_pick(pool: Array) -> Dictionary:
	var total := 0.0
	for event in pool:
		total += float(event.get("weight", 1.0))
	if total <= 0.0:
		return {}
	var roll := randf() * total
	for event in pool:
		roll -= float(event.get("weight", 1.0))
		if roll <= 0.0:
			return event
	return pool[pool.size() - 1]


# --- rumours -----------------------------------------------------------------

static func _pick_rumor() -> String:
	var band: Array = []
	for rumor in Data.rumors:
		if Game.day < int(rumor.get("min_day", 1)) or Game.day > int(rumor.get("max_day", 99)):
			continue
		band.append(str(rumor.get("text", "")))
	if band.is_empty():
		return ""
	return band[randi() % band.size()]
