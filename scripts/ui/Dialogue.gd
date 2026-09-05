extends CanvasLayer

## Renders an encounter and its choices. Picking one applies its flat effects
## dictionary through Game and closes.
##
## Choices gated on a flag the player has not set are hidden: an option that
## refers to something that never happened reads as nonsense. Choices gated on
## a building or a resource are shown but disabled, with what they need --
## those teach the player what the town is missing.

signal finished

var _encounter: Dictionary = {}

@onready var _panel: PanelContainer = $Panel
@onready var _text: Label = $Panel/Margin/Layout/Text
@onready var _choices: VBoxContainer = $Panel/Margin/Layout/Choices


func _ready() -> void:
	close()


func show_encounter(encounter: Dictionary) -> void:
	_encounter = encounter
	_text.text = str(encounter.get("text", ""))
	_panel.show()
	_build_choices()


func close() -> void:
	_encounter = {}
	_panel.hide()


func is_open() -> bool:
	return _panel.visible


func _build_choices() -> void:
	for child in _choices.get_children():
		_choices.remove_child(child)
		child.queue_free()

	for choice in _encounter.get("choices", []):
		var requirements: Dictionary = choice.get("requires", {})
		if Game.hidden_by_flag(requirements):
			continue

		var button := Button.new()
		button.custom_minimum_size = Vector2(0, 38)
		button.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		var reason := Game.requirement_reason(requirements)
		if reason == "":
			button.text = str(choice.get("text", ""))
			button.pressed.connect(_on_choice.bind(choice))
		else:
			button.text = "%s  (%s)" % [str(choice.get("text", "")), reason]
			button.disabled = true
		_choices.add_child(button)

	# A run should never dead-end on an encounter with nothing selectable.
	var selectable := false
	for child in _choices.get_children():
		if child is Button and not (child as Button).disabled:
			selectable = true
			break
	if not selectable:
		var out := Button.new()
		out.text = "Leave it"
		out.pressed.connect(_on_choice.bind({"effects": {}}))
		_choices.add_child(out)


func _on_choice(choice: Dictionary) -> void:
	var id := str(_encounter.get("id", ""))
	Game.apply_effects(choice.get("effects", {}))
	Events.encounter_resolved.emit(id, str(choice.get("text", "")))
	close()
	finished.emit()
