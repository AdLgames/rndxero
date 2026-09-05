extends Node

## Run state: money, standing, the day clock and the speed control.
## Reset() puts everything back so the title screen can start a fresh run
## without reloading the whole project.

const START_CREDITS := 100
const START_REP := 10
const MAX_REP := 20
const DAY_LENGTH := 90.0

## Section 4: lane cost is a flat fee plus a per-tile run.
const LANE_BASE_COST := 30
const LANE_COST_PER_TILE := 5

## Section 4: demand ramps every day until spawn intervals bottom out.
const DEMAND_DECAY := 0.95
const MIN_SPAWN_INTERVAL := 1.5

var credits: int = START_CREDITS
var reputation: int = START_REP
var day: int = 1
var day_time: float = 0.0
var speed: float = 1.0
var running: bool = false
var collisions_today: int = 0


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS


func _process(delta: float) -> void:
	if not running:
		return
	# delta is already scaled by Engine.time_scale, so the day clock follows the
	# speed buttons for free.
	day_time += delta
	if day_time >= DAY_LENGTH:
		day_time -= DAY_LENGTH
		_advance_day()


func reset() -> void:
	credits = START_CREDITS
	reputation = START_REP
	day = 1
	day_time = 0.0
	collisions_today = 0
	running = false
	set_speed(1.0)
	Events.credits_changed.emit(credits)
	Events.rep_changed.emit(reputation)


func start() -> void:
	running = true


func stop() -> void:
	running = false


# --- economy ----------------------------------------------------------------

func add_credits(amount: int) -> void:
	credits += amount
	Events.credits_changed.emit(credits)


## Returns false and changes nothing when the player cannot afford it, so
## callers can use this as the purchase gate.
func try_spend(amount: int) -> bool:
	if amount > credits:
		return false
	credits -= amount
	Events.credits_changed.emit(credits)
	return true


func add_rep(amount: int) -> void:
	reputation = clampi(reputation + amount, 0, MAX_REP)
	Events.rep_changed.emit(reputation)
	if reputation <= 0 and running:
		running = false
		set_speed(0.0)
		Events.game_over.emit(day)


func lane_cost(tile_length: float) -> int:
	return LANE_BASE_COST + int(round(tile_length)) * LANE_COST_PER_TILE


# --- clock ------------------------------------------------------------------

func day_fraction() -> float:
	return day_time / DAY_LENGTH


func _advance_day() -> void:
	# A clean day is what earns standing back; a day with any wreck earns none.
	if collisions_today == 0:
		add_rep(1)
		Events.toast.emit("Day %d clean: +1 reputation" % day, "good")
	collisions_today = 0
	day += 1
	Events.day_passed.emit(day)


# --- speed ------------------------------------------------------------------

func set_speed(value: float) -> void:
	speed = value
	Engine.time_scale = value
	Events.speed_changed.emit(value)
