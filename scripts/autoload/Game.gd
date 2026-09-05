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

## Guests and animals bedded down for the night. Caravans set these from M3;
## until then the nightly formula runs with an empty inn, which is correct
## rather than stubbed.
var lodged_guests: int = 0
var lodged_animals: int = 0


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS


func reset() -> void:
	coin = START["coin"]
	food = START["food"]
	water = START["water"]
	reputation = START["reputation"]
	day = 1
	lodged_guests = 0
	lodged_animals = 0
	plots = []
	plots.resize(Data.plot_count)
	Flags.clear()
	Factions.reset()
	broadcast_resources()


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
	match name:
		"coin": coin += amount
		"food": food += amount
		"water": water += amount
		"reputation": reputation = clampi(reputation + amount, 0, MAX_REPUTATION)
		_:
			push_warning("Game: unknown resource %s" % name)
			return
	Events.resource_changed.emit(name, get_resource(name))
	if name == "reputation" and reputation <= 0:
		# Handled from M5; the signal is emitted now so the rule lives in one place.
		Events.game_over.emit("Ashford's name is worth nothing on the road.")


## Returns false and changes nothing when the town cannot afford it, so callers
## can use this as the purchase gate.
func try_spend(amount: int) -> bool:
	if amount > coin:
		return false
	add("coin", -amount)
	return true


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


func broadcast_resources() -> void:
	for name in ["coin", "food", "water", "reputation", "lodging"]:
		Events.resource_changed.emit(name, get_resource(name))


# --- phases -----------------------------------------------------------------

func set_phase(next: int) -> void:
	phase = next
	Events.phase_changed.emit(phase)


## MORNING -> BUILD -> NIGHT -> next day, or the ending once the season is out.
func advance_phase() -> void:
	match phase:
		Phase.MORNING:
			set_phase(Phase.BUILD)
		Phase.BUILD:
			set_phase(Phase.NIGHT)
			NightLogic.run()
			_finish_night()
		Phase.NIGHT:
			_finish_night()
		Phase.ENDING:
			pass


func _finish_night() -> void:
	if day >= SEASON_LENGTH:
		# The Column and its outcomes are M6; for now the season simply stops.
		set_phase(Phase.ENDING)
		return
	day += 1
	Events.day_started.emit(day)
	set_phase(Phase.MORNING)
