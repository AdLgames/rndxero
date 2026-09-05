extends Node2D

## One of the twelve building plots along the road. Shows either the empty
## marker or whatever has been built, and reports clicks upward; it holds no
## state of its own -- Game.plots is the truth.

signal clicked(index)

const BUILDING_SCENE := preload("res://scenes/Building.tscn")

var index: int = 0

@onready var _marker: Sprite2D = $Marker
@onready var _slot: Node2D = $Slot


func _ready() -> void:
	$Click.input_event.connect(_on_click_area_input)
	refresh()


## Rebuild the visuals from Game.plots. Cheap enough to call on any change.
func refresh() -> void:
	for child in _slot.get_children():
		_slot.remove_child(child)
		child.queue_free()

	var plot = Game.plots[index] if index < Game.plots.size() else null
	_marker.visible = plot == null
	if plot == null:
		return

	var definition := BuildLogic.current_definition(plot)
	if definition.is_empty():
		return
	var building := BUILDING_SCENE.instantiate()
	_slot.add_child(building)
	building.show_definition(definition)


func _on_click_area_input(_viewport: Node, event: InputEvent, _shape_idx: int) -> void:
	if event is InputEventMouseButton:
		var mb := event as InputEventMouseButton
		if mb.pressed and mb.button_index == MOUSE_BUTTON_LEFT:
			clicked.emit(index)
			get_viewport().set_input_as_handled()
