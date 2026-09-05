extends Node2D

## Assembles a run and drives the phase machine.

@onready var _town: Node2D = $Town
@onready var _camera: Camera2D = $Camera
@onready var _hud = $HUD
@onready var _build_menu = $BuildMenu
@onready var _caravans: CaravanQueue = $CaravanQueue
@onready var _card = $CaravanCard
@onready var _trade = $TradePanel
@onready var _dialogue = $Dialogue
@onready var _report = $NightReport
@onready var _game_over = $GameOver
@onready var _ending = $Ending

## The epilogue panel occupies the lower half of the screen, so the camera
## rises to keep the town in the gap above it.
const ENDING_CAMERA_Y := 60.0

var _over_reason: String = ""


func _ready() -> void:
	Game.start()
	_town.build(_camera)
	_camera.frame_strip(_town.strip_width())

	_caravans.setup(_town.caravan_layer())
	_caravans.reset()
	_card.setup(_caravans)
	_trade.setup(_caravans)

	_town.plot_clicked.connect(_on_plot_clicked)
	_caravans.caravan_ready.connect(_on_caravan_ready)
	_caravans.morning_finished.connect(_on_morning_finished)
	_card.resolved.connect(_on_card_resolved)
	_card.trade_requested.connect(_on_trade_requested)
	_trade.closed.connect(_on_trade_closed)
	_caravans.encounter_ready.connect(_on_encounter_ready)
	_dialogue.finished.connect(_on_encounter_finished)
	_report.continued.connect(_on_report_continued)
	Events.night_report.connect(_on_night_report)
	Events.game_over.connect(_on_game_over)
	_hud.end_day_pressed.connect(_on_end_day)
	Events.phase_changed.connect(_on_phase_changed)
	Events.building_placed.connect(_on_town_changed)
	Events.building_upgraded.connect(_on_town_changed)

	_on_phase_changed(Game.phase)


func _on_caravan_ready(data: Dictionary) -> void:
	_card.show_caravan(data)


func _on_card_resolved(action: String, toll: int) -> void:
	_trade.close()
	_caravans.resolve(action, toll)


func _on_trade_requested(data: Dictionary) -> void:
	_trade.open_for(data)


func _on_trade_closed() -> void:
	_card.refresh()


func _on_encounter_ready(encounter: Dictionary) -> void:
	_dialogue.show_encounter(encounter)


func _on_encounter_finished() -> void:
	_caravans.finish_encounter()


func _on_night_report(report: Dictionary) -> void:
	_report.show_report(report)


## The day does not roll over until the report is read, so the player always
## sees what the night cost before the next one starts.
func _on_report_continued() -> void:
	if Game.over:
		_game_over.show_over(_over_reason)
		return
	Game.advance_phase()


## Reputation can run out mid-morning as easily as overnight. During the night
## the report has not been shown yet -- it is emitted after consumption -- so
## hold the end screen back and let the report's button lead into it. Any other
## phase has nothing to explain, so it comes straight in.
func _on_game_over(reason: String) -> void:
	_over_reason = reason
	if Game.phase == Game.Phase.NIGHT:
		return
	_close_all()
	_game_over.show_over(reason)


func _close_all() -> void:
	_card.close()
	_trade.close()
	_dialogue.close()
	_build_menu.close()


func _on_morning_finished() -> void:
	Game.advance_phase()


func _on_plot_clicked(index: int) -> void:
	if Game.phase != Game.Phase.BUILD:
		Events.toast.emit("Building happens in the afternoon", "info")
		return
	_build_menu.open_for(index)


func _on_end_day() -> void:
	_build_menu.close()
	Game.advance_phase()


func _on_town_changed(_id: String, _plot: int) -> void:
	_town.refresh_plots()


func _on_phase_changed(phase: int) -> void:
	match phase:
		Game.Phase.MORNING:
			# Watch the gate while the caravans walk in; the player can still
			# scroll away, and any input drops the focus.
			_camera.focus_on(CaravanQueue.GATE_X)
			_caravans.begin_day.call_deferred()
		Game.Phase.BUILD:
			_card.close()
			_trade.close()
			_dialogue.close()
			_camera.release_focus()
			_camera.reset_camera_y()
		Game.Phase.NIGHT:
			pass
		Game.Phase.ENDING:
			_close_all()
			# Lift the view so the strip stays visible above the epilogue panel,
			# which is what section 9 means by a scene of the town.
			_camera.release_focus()
			_camera.set_camera_y(ENDING_CAMERA_Y)
			_ending.show_column()


func _unhandled_input(event: InputEvent) -> void:
	if not event.is_action_pressed("ui_cancel"):
		return
	# Escape backs out one layer at a time. The dialogue is deliberately not
	# dismissable: an encounter has to be answered.
	if _trade.is_open():
		_trade.close()
	elif _build_menu.is_open():
		_build_menu.close()
	else:
		return
	get_viewport().set_input_as_handled()
