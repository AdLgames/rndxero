extends CanvasLayer

## Opened by clicking a plot. Shows the six buildings for an empty plot, or the
## single upgrade for an occupied one. Rows come from data/buildings.json, so a
## new building needs no UI work.

var _plot_index: int = -1

@onready var _panel: PanelContainer = $Panel
@onready var _title: Label = $Panel/Margin/Layout/Header/Title
@onready var _list: VBoxContainer = $Panel/Margin/Layout/Scroll/List


func _ready() -> void:
	$Panel/Margin/Layout/Header/Close.pressed.connect(close)
	Events.resource_changed.connect(func(_n, _v): _refresh_if_open())
	close()


func open_for(index: int) -> void:
	_plot_index = index
	_panel.show()
	_rebuild()


func close() -> void:
	_plot_index = -1
	_panel.hide()


func is_open() -> bool:
	return _plot_index >= 0


func _refresh_if_open() -> void:
	if is_open():
		_rebuild()


func _rebuild() -> void:
	for child in _list.get_children():
		_list.remove_child(child)
		child.queue_free()

	if BuildLogic.is_empty(_plot_index):
		_title.text = "Plot %d — empty" % (_plot_index + 1)
		for definition in Data.buildings:
			_add_row(definition, BuildLogic.blocking_reason(_plot_index, definition["id"]),
				func(): BuildLogic.place(_plot_index, definition["id"]))
		return

	var standing := BuildLogic.definition_at(_plot_index)
	_title.text = "Plot %d — %s" % [_plot_index + 1, standing.get("name", "built")]
	var next := BuildLogic.upgrade_definition(_plot_index)
	if next.is_empty():
		var done := Label.new()
		done.text = "%s is fully built." % standing.get("name", "This building")
		_list.add_child(done)
		return
	_add_row(next, BuildLogic.upgrade_blocking_reason(_plot_index),
		func(): BuildLogic.upgrade(_plot_index))


func _on_row_pressed(action: Callable) -> void:
	action.call()
	_rebuild()


func _add_row(definition: Dictionary, blocked: String, action: Callable) -> void:
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 12)

	var text := VBoxContainer.new()
	text.size_flags_horizontal = Control.SIZE_EXPAND_FILL

	var icon_and_name := HBoxContainer.new()
	icon_and_name.add_theme_constant_override("separation", 8)
	var icon := TextureRect.new()
	icon.texture = load(definition.get("sprite", ""))
	icon.custom_minimum_size = Vector2(32, 32)
	icon.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	icon.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	icon_and_name.add_child(icon)
	var title := Label.new()
	title.text = "%s — %d coin" % [definition["name"], int(definition["cost"])]
	icon_and_name.add_child(title)
	text.add_child(icon_and_name)

	var desc := Label.new()
	desc.text = str(definition.get("desc", ""))
	desc.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	desc.modulate = Color(0.78, 0.80, 0.88)
	text.add_child(desc)
	row.add_child(text)

	var button := Button.new()
	button.custom_minimum_size = Vector2(120, 0)
	if blocked == "":
		button.text = "Build"
		button.pressed.connect(_on_row_pressed.bind(action))
	else:
		button.text = blocked
		button.disabled = true
	row.add_child(button)

	_list.add_child(row)
	_list.add_child(HSeparator.new())
