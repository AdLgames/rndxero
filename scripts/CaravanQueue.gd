class_name CaravanQueue
extends Node

## Picks the day's caravans, walks them in one at a time, and applies the
## outcome the player chooses. Owns the toll, lodging and turn-away rules from
## sections 4 and 5, so the card that presents them stays a view.

signal caravan_ready(data)
signal encounter_ready(encounter)
signal morning_finished

const CARAVAN_SCENE := preload("res://scenes/Caravan.tscn")

const GATE_X := 70.0
const SPAWN_X := -340.0
const MIN_PER_DAY := 1
const MAX_PER_DAY := 4

## Section 5: only the top toll costs standing, and only that one can be refused.
const TOLLS := [0, 5, 10, 20]
const HIGH_TOLL := 20

## Section 5: "requires a Market to trade more than 2 items" -- read as two
## units in total with one caravan, bought or sold, which is what makes the
## Market's unlimited trading worth its cost.
const TRADE_LIMIT := 2

var _seen: Dictionary = {}
var _seen_encounters: Dictionary = {}
var _pending: Array = []
var _current: Node2D = null
var _current_data: Dictionary = {}
var _road: Node = null
var _trade: Dictionary = {}


func setup(road: Node) -> void:
	_road = road


func reset() -> void:
	_seen.clear()
	_seen_encounters.clear()
	_pending.clear()
	if is_instance_valid(_current):
		_current.queue_free()
	_current = null
	_current_data = {}
	_trade = {}


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
	_begin_trade(data)

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


# --- trade ------------------------------------------------------------------

## A working copy of the caravan's manifest, so buying from it actually depletes
## what is on offer for the rest of the visit.
func _begin_trade(data: Dictionary) -> void:
	_trade = {
		"cargo": data.get("cargo", {}).duplicate(),
		"wants": data.get("wants", {}).duplicate(),
		"units": 0,
		"traded": false,
	}


func trade_state() -> Dictionary:
	return _trade


## -1 means no limit, which is what a Market buys you.
func trade_limit() -> int:
	if Game.has_effect("trade_unlimited"):
		return -1
	return TRADE_LIMIT


func trade_units_left() -> int:
	var limit := trade_limit()
	if limit < 0:
		return -1
	return maxi(0, limit - int(_trade.get("units", 0)))


func _has_trade_room() -> bool:
	return trade_units_left() != 0


func can_buy(good: String) -> bool:
	if _trade.is_empty() or not _has_trade_room():
		return false
	if int(_trade["cargo"].get(good, 0)) <= 0:
		return false
	return Game.coin >= TradeLogic.buy_price(good)


func buy(good: String) -> bool:
	if not can_buy(good):
		return false
	Game.add("coin", -TradeLogic.buy_price(good))
	Game.add_goods(good, 1)
	_trade["cargo"][good] = int(_trade["cargo"][good]) - 1
	_record_trade()
	return true


func can_sell(good: String) -> bool:
	if _trade.is_empty() or not _has_trade_room():
		return false
	if int(_trade["wants"].get(good, 0)) <= 0:
		return false
	return Game.goods_count(good) > 0


func sell(good: String) -> bool:
	if not can_sell(good):
		return false
	Game.add("coin", TradeLogic.sell_price(good))
	Game.add_goods(good, -1)
	_trade["wants"][good] = int(_trade["wants"][good]) - 1
	_record_trade()
	return true


func _record_trade() -> void:
	_trade["units"] = int(_trade["units"]) + 1
	_trade["traded"] = true


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
		# Section 4 credits letting a caravan do business, once per visit
		# however many units changed hands.
		if _trade.get("traded", false):
			Factions.adjust(faction, 1)

	Events.caravan_resolved.emit(data, outcome)

	# Section 7 runs the encounter after the decision -- but not for a caravan
	# that never came in, whose encounter would be about a visit that did not
	# happen.
	var encounter := _encounter_for(data, outcome)
	if encounter.is_empty():
		_next()
	else:
		encounter_ready.emit(encounter)


## Draw one encounter for this visit. A caravan's own written-for-it entries
## take precedence over the faction's general pool, so its story gets told
## rather than being lost among thirty alternatives.
func _encounter_for(data: Dictionary, outcome: String) -> Dictionary:
	if outcome == "turn_away" or outcome == "refused":
		return {}

	var pool := Data.encounters_for(
		str(data.get("faction", "")), str(data.get("id", "")), Game.day, _seen_encounters)
	if pool.is_empty():
		return {}

	var own: Array = []
	for entry in pool:
		if entry.has("caravan"):
			own.append(entry)
	if not own.is_empty():
		pool = own

	var chosen := _pick_weighted(pool)
	if chosen.is_empty():
		return {}
	_seen_encounters[chosen["id"]] = true
	return chosen


## Weighted draw that leaves the pool alone, unlike the caravan roll which has
## to remove what it picks.
func _pick_weighted(pool: Array) -> Dictionary:
	var total := 0.0
	for entry in pool:
		total += float(entry.get("weight", 1.0))
	if total <= 0.0:
		return {}
	var roll := randf() * total
	for entry in pool:
		roll -= float(entry.get("weight", 1.0))
		if roll <= 0.0:
			return entry
	return pool[pool.size() - 1]


## Called once the dialogue closes, to release the queue.
func finish_encounter() -> void:
	_next()
