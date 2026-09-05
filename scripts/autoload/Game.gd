extends Node

## Run state: the five resources, the day counter, the plots along the road,
## and the phase machine. Reset() puts everything back so a run can restart
## without reloading the project.
##
## Plots live here rather than in the Town scene because they are run state,
## not presentation -- nightly yields and the build menu both read them, and
## Town.tscn renders whatever it finds.

enum Phase { MORNING, BUILD, NIGHT, ENDING }

const SEASON_LENGTH := 10

const START := {
	"coin": 50,
	"food": 20,
	"water": 20,
	"reputation": 5,
}
const MAX_REPUTATION := 10

## Section 3: 2 food a night keeps the town itself fed, before any guests.
const BASE_FOOD_UPKEEP := 2

var coin: int = START["coin"]
var food: int = START["food"]
var water: int = START["water"]
var reputation: int = START["reputation"]

var day: int = 1
var phase: int = Phase.BUILD

## One entry per plot: either null, or {"base_id": String, "upgraded": bool}.
## The base id is kept even after upgrading so the next tier is still findable.
var plots: Array = []

## Who is bedded down tonight. Cleared once the night resolves, because
## caravans move on in the morning.
var lodged_guests: int = 0
var lodged_animals: int = 0
var lodged_factions: Array = []

## Tradeable goods, separate from the five resources: bought from caravan cargo
## and sold on to caravans that want them. Their only use in the MVP is that
## margin, which is the merchant half of the loop.
var goods: Dictionary = {}

## Animals the town itself keeps, from encounters. They drink every night.
var town_animals: int = 0

## Night events queued by an encounter's `event` effect, drained at the next
## night before any random roll.
var queued_events: Array = []

## Tomorrow's rolled event, chosen a night early so that a pleased Free Road
## can warn you about it. Empty when tomorrow is quiet.
var next_night_event: String = ""

## Set when reputation runs out. Stops the phase machine dead.
var over: bool = false


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS


func reset() -> void:
	coin = START["coin"]
	food = START["food"]
	water = START["water"]
	reputation = START["reputation"]
	day = 1
	town_animals = 0
	queued_events = []
	next_night_event = ""
	over = false
	goods = {}
	for good in Data.goods_order:
		goods[good] = 0
	clear_lodgers()
	plots = []
	plots.resize(Data.plot_count)
	Flags.clear()
	Factions.reset()
	broadcast_resources()
	Events.goods_changed.emit(goods)


func start() -> void:
	reset()
	Events.day_started.emit(day)
	set_phase(Phase.MORNING)


# --- resources --------------------------------------------------------------

func get_resource(name: String) -> int:
	match name:
		"coin": return coin
		"food": return food
		"water": return water
		"reputation": return reputation
		"lodging": return lodging_capacity()
	return 0


func add(name: String, amount: int) -> void:
	# Stores floor at zero. Encounter and ending effects are written as flat
	# costs without knowing what the town has, so a levy larger than the purse
	# empties it rather than going negative.
	match name:
		"coin": coin = maxi(0, coin + amount)
		"food": food = maxi(0, food + amount)
		"water": water = maxi(0, water + amount)
		"reputation": reputation = clampi(reputation + amount, 0, MAX_REPUTATION)
		_:
			push_warning("Game: unknown resource %s" % name)
			return
	Events.resource_changed.emit(name, get_resource(name))
	if name == "reputation" and reputation <= 0 and not over:
		over = true
		Events.game_over.emit("Ashford's name is worth nothing on the road. The caravans stop coming, and a crossing nobody stops at is not a town.")


## Returns false and changes nothing when the town cannot afford it, so callers
## can use this as the purchase gate.
func try_spend(amount: int) -> bool:
	if amount > coin:
		return false
	add("coin", -amount)
	return true


## Beds still free tonight.
func beds_free() -> int:
	return lodging_capacity() - lodged_guests


func lodge(faction: String, guests: int, animals: int) -> void:
	lodged_guests += guests
	lodged_animals += animals
	if not lodged_factions.has(faction):
		lodged_factions.append(faction)
	Events.resource_changed.emit("lodging", lodging_capacity())


func clear_lodgers() -> void:
	lodged_guests = 0
	lodged_animals = 0
	lodged_factions = []


## Lodging is a capacity, not a stock: the beds the town currently has.
func lodging_capacity() -> int:
	var total := Data.base_lodging
	for effects in placed_effects():
		total += int(effects.get("lodging", 0))
	return total


## Effect dictionaries for everything currently standing, in plot order.
func placed_effects() -> Array:
	var out: Array = []
	for plot in plots:
		if plot == null:
			continue
		var definition := BuildLogic.current_definition(plot)
		if definition.has("effects"):
			out.append(definition["effects"])
	return out


## True when any standing building carries this effect flag.
func has_effect(key: String) -> bool:
	for effects in placed_effects():
		if effects.get(key, false):
			return true
	return false


## Summed numeric effect across everything standing.
func total_effect(key: String) -> float:
	var total := 0.0
	for effects in placed_effects():
		total += float(effects.get(key, 0))
	return total


# --- goods -------------------------------------------------------------------

func goods_count(good: String) -> int:
	return int(goods.get(good, 0))


func add_goods(good: String, amount: int) -> void:
	goods[good] = maxi(0, goods_count(good) + amount)
	Events.goods_changed.emit(goods)


## Does any plot hold this building, at either tier?
func has_building(building_id: String) -> bool:
	for plot in plots:
		if plot == null:
			continue
		if plot["base_id"] == building_id:
			return true
		if BuildLogic.current_definition(plot).get("id", "") == building_id:
			return true
	return false


# --- encounter effects -------------------------------------------------------

## Section 5: a flat dictionary, so a new key costs one branch here and nothing
## in the data. Unknown keys warn rather than fail, so a typo in an encounter
## does not take the run down.
func apply_effects(effects: Dictionary) -> void:
	for key in effects:
		var value = effects[key]
		if key in ["coin", "food", "water", "reputation"]:
			add(key, int(value))
		elif Factions.IDS.has(key):
			Factions.adjust(key, int(value))
		elif Data.goods_order.has(key):
			add_goods(key, int(value))
		elif key == "flag":
			Flags.set_flag(str(value))
		elif key == "building":
			BuildLogic.grant(str(value))
		elif key == "event":
			queued_events.append(str(value))
		elif key == "coin_percent":
			add("coin", _percent_of_coin(int(value)))
		elif key == "animals_owned":
			town_animals = maxi(0, town_animals + int(value))
		else:
			push_warning("Game: unknown effect key %s" % key)


## A proportional levy or windfall, for the Crown's raid. Rounded away from
## zero so a nearly empty purse is not immune.
func _percent_of_coin(percent: int) -> int:
	var amount := int(ceil(absf(coin * percent / 100.0)))
	if percent < 0:
		return -amount
	return amount


## Section 5: `requires` gates a choice on a building, a flag, or a minimum of
## some resource or good.
func meets_requirements(requirements: Dictionary) -> bool:
	for key in requirements:
		var value = requirements[key]
		if key == "building":
			if not has_building(str(value)):
				return false
		elif key == "flag":
			if not Flags.has(str(value)):
				return false
		elif Data.goods_order.has(key):
			if goods_count(key) < int(value):
				return false
		else:
			if get_resource(key) < int(value):
				return false
	return true


## Why a requirement fails, for the dialogue to show. Empty when it is met.
func requirement_reason(requirements: Dictionary) -> String:
	for key in requirements:
		var value = requirements[key]
		if key == "building":
			if not has_building(str(value)):
				return "Needs a %s" % str(value).capitalize()
		elif key == "flag":
			continue
		elif Data.goods_order.has(key):
			if goods_count(key) < int(value):
				return "Needs %d %s" % [int(value), key]
		elif get_resource(key) < int(value):
			return "Needs %d %s" % [int(value), key]
	return ""


## True when a choice is gated on a flag the player has not set. Those are
## hidden rather than shown locked: a choice that refers to something that
## never happened reads as nonsense.
func hidden_by_flag(requirements: Dictionary) -> bool:
	return requirements.has("flag") and not Flags.has(str(requirements["flag"]))


func broadcast_resources() -> void:
	for key in ["coin", "food", "water", "reputation", "lodging"]:
		Events.resource_changed.emit(key, get_resource(key))


# --- phases -----------------------------------------------------------------

func set_phase(next: int) -> void:
	phase = next
	Events.phase_changed.emit(phase)


## MORNING -> BUILD -> NIGHT -> next day, or the ending once the season is out.
func advance_phase() -> void:
	if over:
		return
	match phase:
		Phase.MORNING:
			set_phase(Phase.BUILD)
		Phase.BUILD:
			# The night resolves immediately, but the day does not roll over
			# until the player has read the report.
			set_phase(Phase.NIGHT)
			NightLogic.run()
		Phase.NIGHT:
			_finish_night()
		Phase.ENDING:
			pass


func _finish_night() -> void:
	if over:
		return
	if day >= SEASON_LENGTH:
		# The Column and its outcomes are M6; for now the season simply stops.
		set_phase(Phase.ENDING)
		return
	day += 1
	Events.day_started.emit(day)
	set_phase(Phase.MORNING)
