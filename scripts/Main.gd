extends Control

## Sets a run going and routes between the board and the overlays.

const START_CARDS := [
	"salvager", "hull_plate", "hull_plate", "scrap", "scrap", "scrap",
	"battery", "o2_canister", "o2_canister", "pack_s1", "wreck",
]

@onready var _board: Board = $Board
@onready var _hud = $HUD
@onready var _prompt = $ChoicePrompt
@onready var _reader = $LogReader
@onready var _aria = $AriaPanel
@onready var _book = $RecipeBook
@onready var _ending = $EndingScreen


func _ready() -> void:
	Game.reset()
	_deal()

	_hud.book_pressed.connect(func(): _book.open())
	_hud.archive_pressed.connect(func(): _reader.show_archive())
	Events.slots_exceeded.connect(_on_slots_exceeded)
	Events.trait_choice_offered.connect(_on_trait_choice)
	_prompt.resolved.connect(func(): Game.set_paused(false))
	Events.log_read.connect(func(_id): Game.set_paused(true))
	Events.aria_opened.connect(func(): Game.set_paused(true))
	Events.cycle_ended.connect(_on_cycle_ended)

	Game.start()


## Section 4's opening board, plus whatever a previous ending earned (§11).
func _deal() -> void:
	var centre := Vector2(_board.size.x * 0.5, _board.size.y * 0.5)
	for id in START_CARDS:
		_board.spawn(id, _board.free_position_near(centre))
	for id in Meta.starting_bonus():
		_board.spawn(id, _board.free_position_near(centre))


func _on_cycle_ended(report: Dictionary) -> void:
	for line in report.get("events", []):
		Events.toast.emit(str(line), "info")
	# Section 9: ARIA becomes reachable once three logs are read and the relay
	# is up. The card itself still has to be built with recipe 45.
	if not Game.aria_present and StoryLogic.aria_ready() and _board.has_card("comms_relay"):
		Game.aria_present = true
		Events.aria_available.emit()
		Events.toast.emit("Something on the relay is answering.", "info")


func _on_slots_exceeded(excess: int) -> void:
	Game.set_paused(true)
	_prompt.ask_eject(excess)


func _on_trait_choice(card, options: Array) -> void:
	Game.set_paused(true)
	_prompt.ask_trait(card, options)


func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("pause"):
		Game.set_paused(not Game.paused)
		get_viewport().set_input_as_handled()
		return
	if not event.is_action_pressed("ui_cancel"):
		return
	# Escape backs out one layer. The ejection prompt is not dismissable: the
	# manifest has to come back under the limit.
	for overlay in [_book, _reader, _aria]:
		if overlay.is_open():
			overlay.close()
			Game.set_paused(false)
			get_viewport().set_input_as_handled()
			return
