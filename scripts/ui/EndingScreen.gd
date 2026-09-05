extends CanvasLayer

## Both ways a run stops: an ending from section 9, or everyone dead.

@onready var _panel: PanelContainer = $Panel
@onready var _title: Label = $Panel/Margin/Layout/Title
@onready var _body: RichTextLabel = $Panel/Margin/Layout/Body
@onready var _unlock: Label = $Panel/Margin/Layout/Unlock
@onready var _again: Button = $Panel/Margin/Layout/Again


func _ready() -> void:
	_again.pressed.connect(_restart)
	Events.ending_reached.connect(show_ending)
	Events.run_over.connect(show_death)
	close()


func close() -> void:
	_panel.hide()


func show_ending(id: String) -> void:
	_title.text = EndingLogic.title(id)
	_body.text = EndingLogic.text(id)
	_unlock.text = EndingLogic.unlock_line(id)
	_unlock.visible = _unlock.text != ""
	_panel.show()
	_again.grab_focus()


func show_death(reason: String) -> void:
	_title.text = "Halvard-7 keeps its silence"
	_body.text = "%s\n\nThe station is quiet again. It has had practice." % reason
	_unlock.visible = false
	_panel.show()
	_again.grab_focus()


func _restart() -> void:
	get_tree().reload_current_scene()
