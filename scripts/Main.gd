extends Node2D

## Assembles a run and drives the phase machine.
##
## MORNING is entered and passed straight through: the caravan queue that fills
## it arrives at M3. Keeping the phase real now means the state machine, the
## HUD label and the End Day gating are all exercised rather than retrofitted.

@onready var _town: Node2D = $Town
@onready var _camera: Camera2D = $Camera
@onready var _hud = $HUD
@onready var _build_menu = $BuildMenu


func _ready() -> void:
	Game.start()
	_town.build(_camera)
	_camera.frame_strip(_town.strip_width())

	_town.plot_clicked.connect(_on_plot_clicked)
	_hud.end_day_pressed.connect(_on_end_day)
	Events.phase_changed.connect(_on_phase_changed)
	Events.building_placed.connect(_on_town_changed)
	Events.building_upgraded.connect(_on_town_changed)

	_on_phase_changed(Game.phase)


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
			# Caravans arrive here from M3. Deferred so the phase change that
			# brought us here finishes propagating before the next one starts.
			Game.advance_phase.call_deferred()
		Game.Phase.BUILD:
			pass
		Game.Phase.NIGHT:
			pass
		Game.Phase.ENDING:
			# The Column and its five outcomes are M6.
			Events.toast.emit("The season is over. The Column arrives at M6.", "info")


func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("ui_cancel") and _build_menu.is_open():
		_build_menu.close()
		get_viewport().set_input_as_handled()
