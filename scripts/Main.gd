extends Node2D

## Assembles a run and drives the phase machine.

@onready var _town: Node2D = $Town
@onready var _camera: Camera2D = $Camera
@onready var _hud = $HUD
@onready var _build_menu = $BuildMenu
@onready var _caravans: CaravanQueue = $CaravanQueue
@onready var _card = $CaravanCard


func _ready() -> void:
	Game.start()
	_town.build(_camera)
	_camera.frame_strip(_town.strip_width())

	_caravans.setup(_town.caravan_layer())
	_caravans.reset()
	_card.setup(_caravans)

	_town.plot_clicked.connect(_on_plot_clicked)
	_caravans.caravan_ready.connect(_on_caravan_ready)
	_caravans.morning_finished.connect(_on_morning_finished)
	_card.resolved.connect(_on_card_resolved)
	_hud.end_day_pressed.connect(_on_end_day)
	Events.phase_changed.connect(_on_phase_changed)
	Events.building_placed.connect(_on_town_changed)
	Events.building_upgraded.connect(_on_town_changed)

	_on_phase_changed(Game.phase)


func _on_caravan_ready(data: Dictionary) -> void:
	_card.show_caravan(data)


func _on_card_resolved(action: String, toll: int) -> void:
	_caravans.resolve(action, toll)


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
			_camera.release_focus()
		Game.Phase.NIGHT:
			pass
		Game.Phase.ENDING:
			# The Column and its five outcomes are M6.
			Events.toast.emit("The season is over. The Column arrives at M6.", "info")


func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("ui_cancel") and _build_menu.is_open():
		_build_menu.close()
		get_viewport().set_input_as_handled()
