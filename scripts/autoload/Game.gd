extends Node

## Run state and the cycle clock. Section 2: every 120 seconds the crew breathe,
## the modules run, a hazard drifts in, and the story advances.
##
## The board itself lives in the scene; Game holds a reference to it and asks it
## for cards rather than owning them, so a card is one node in one place.

var o2: float = 6.0
var cycle: int = 1
var cycle_time: float = 0.0
var paused: bool = false
var running: bool = false
var over: bool = false
var ending: String = ""

var logs_read: Dictionary = {}          ## log id -> true
var sectors_unlocked: Array = [1]
var aria_present: bool = false

var board = null                        ## set by Board when it enters the tree


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS


func reset() -> void:
	o2 = Data.number("starting_o2", 6.0)
	cycle = 1
	cycle_time = 0.0
	paused = false
	over = false
	ending = ""
	logs_read.clear()
	sectors_unlocked = [1]
	aria_present = false
	Events.o2_changed.emit(o2)


func start() -> void:
	running = true
	Events.cycle_started.emit(cycle)


func set_paused(value: bool) -> void:
	paused = value
	Events.paused_changed.emit(paused)


func _process(delta: float) -> void:
	if not running or paused or over:
		return
	cycle_time += delta
	var length := Data.number("cycle_seconds", 120.0)
	if cycle_time >= length:
		cycle_time -= length
		_end_cycle()


func cycle_fraction() -> float:
	return cycle_time / maxf(1.0, Data.number("cycle_seconds", 120.0))


func add_o2(amount: float) -> void:
	o2 = maxf(0.0, o2 + amount)
	Events.o2_changed.emit(o2)


# --- the cycle ---------------------------------------------------------------

## Section 2 lists four beats. The others here are the consequences the hazard
## and crew tables in sections 7 and 10 attach to a cycle boundary.
func _end_cycle() -> void:
	if board == null:
		return
	var report := {"cycle": cycle, "produced": {}, "events": []}

	CrewLogic.breathe(report)
	_run_modules(report)
	HazardLogic.apply_standing(report)
	HazardLogic.drift(report)
	HazardLogic.age_transients(report)
	CrewLogic.upkeep(report)
	_check_suffocation(report)
	board.enforce_slot_limit(report)

	Events.cycle_ended.emit(report)
	if over:
		return
	cycle += 1
	Events.cycle_started.emit(cycle)


func _run_modules(report: Dictionary) -> void:
	var powered := PowerLogic.powered_modules()
	for card in board.cards_of_type("module"):
		var definition := Data.card(card.card_id)
		if definition.get("needs_power", false) and not powered.has(card):
			continue
		var produces: Dictionary = definition.get("produces", {})
		if produces.has("o2"):
			add_o2(float(produces["o2"]))
			report["produced"]["o2"] = float(report["produced"].get("o2", 0.0)) + float(produces["o2"])
		if produces.has("rations"):
			for i in int(produces["rations"]):
				board.spawn("rations", card.stack_position())
			report["produced"]["rations"] = int(report["produced"].get("rations", 0)) + int(produces["rations"])
		PowerLogic.tick_module(card, report)


## Section 2's fail state: at zero oxygen the crew member with the lowest morale
## dies. When the last one goes, the run is over.
func _check_suffocation(report: Dictionary) -> void:
	if o2 > 0.0:
		return
	var crew := board.cards_of_type("crew")
	if crew.is_empty():
		_finish("Nobody left aboard.")
		return
	var worst = crew[0]
	for card in crew:
		if int(card.state.get("morale", 6)) < int(worst.state.get("morale", 6)):
			worst = card
	report["events"].append("%s suffocated." % worst.display_name())
	Events.crew_died.emit(worst)
	CrewLogic.mourn(worst)
	board.remove_card(worst)
	if board.cards_of_type("crew").is_empty():
		_finish("The last of the crew is gone.")


func _finish(reason: String) -> void:
	over = true
	running = false
	Events.run_over.emit(reason)


func reach_ending(id: String) -> void:
	if over:
		return
	over = true
	running = false
	ending = id
	Meta.record_ending(id)
	Events.ending_reached.emit(id)
