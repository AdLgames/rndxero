extends Node2D

## A placed building: its sprite plus a name label.
##
## Section 13's placeholder rule is "a coloured shape with a label". The label
## is a real Label node rather than text baked into the PNG, so it stays sharp
## at any zoom and survives the art being replaced after M6.

@onready var _sprite: Sprite2D = $Sprite
@onready var _label: Label = $Name


func show_definition(definition: Dictionary) -> void:
	if not is_node_ready():
		await ready
	var texture := load(definition.get("sprite", ""))
	if texture != null:
		_sprite.texture = texture
	_label.text = str(definition.get("name", ""))
