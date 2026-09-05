extends CanvasLayer

## The Column, and the epilogue it earns. Sits low on the screen so the town
## you built stays visible above it -- section 9 asks for the epilogue over a
## scene of the town, and the town is already there.

@onready var _panel: PanelContainer = $Panel
@onready var _title: Label = $Panel/Margin/Layout/Title
@onready var _text: Label = $Panel/Margin/Layout/Text
@onready var _choices: VBoxContainer = $Panel/Margin/Layout/Choices
@onready var _restart: Button = $Panel/Margin/Layout/Restart


func _ready() -> void:
	_restart.pressed.connect(_on_restart)
	close()


func close() -> void:
	_panel.hide()


func is_open() -> bool:
	return _panel.visible


## Stage one: the column at the gate, and what can be done about it.
func show_column() -> void:
	_title.text = "The Column"
	_text.text = EndingLogic.prompt()
	_restart.hide()
	_clear_choices()

	for choice in EndingLogic.available_choices():
		var button := Button.new()
		button.custom_minimum_size = Vector2(0, 40)
		button.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		button.text = str(choice.get("text", ""))
		button.pressed.connect(_on_choice.bind(str(choice.get("id", ""))))
		_choices.add_child(button)

	# Shelter is the one choice whose outcome turns on the stores, so say what
	# they are rather than making the player go and count.
	var size := EndingLogic.column_size()
	var note := Label.new()
	note.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	note.modulate = Color(0.78, 0.80, 0.90)
	note.text = "Twelve need feeding and watering. You have %d food and %d water." % [Game.food, Game.water]
	if not EndingLogic.can_support_column():
		note.text += "  That is not enough for %d." % size
	_choices.add_child(note)

	_choices.show()
	_panel.show()


## Stage two: what became of Ashford Crossing.
func show_epilogue(outcome: Dictionary) -> void:
	_title.text = str(outcome.get("title", ""))
	_text.text = str(outcome.get("text", ""))
	_clear_choices()
	_choices.hide()
	_restart.show()
	_restart.grab_focus()
	_panel.show()


func _clear_choices() -> void:
	for child in _choices.get_children():
		_choices.remove_child(child)
		child.queue_free()


func _on_choice(choice_id: String) -> void:
	show_epilogue(EndingLogic.resolve(choice_id))


func _on_restart() -> void:
	get_tree().reload_current_scene()
