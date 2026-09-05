extends CanvasLayer

## ARIA's dialogue. Menu-driven for v1; section 13's freeform LLM version is the
## stretch goal, and the node data is shaped so it can be swapped behind this.

@onready var _panel: PanelContainer = $Panel
@onready var _text: RichTextLabel = $Panel/Margin/Layout/Text
@onready var _options: VBoxContainer = $Panel/Margin/Layout/Options

var _node_id := ""


func _ready() -> void:
	Events.aria_opened.connect(open)
	close()


func close() -> void:
	_panel.hide()


func is_open() -> bool:
	return _panel.visible


func open() -> void:
	_show_node(StoryLogic.aria_root())
	_panel.show()


func _show_node(id: String) -> void:
	var node: Dictionary = Data.aria_nodes.get(id, {})
	if node.is_empty():
		close()
		return
	_node_id = id
	_text.text = str(node.get("text", ""))

	for child in _options.get_children():
		_options.remove_child(child)
		child.queue_free()

	var shown := 0
	for option in node.get("options", []):
		if not _meets(option.get("requires", {})):
			continue
		var button := Button.new()
		button.custom_minimum_size = Vector2(0, 34)
		button.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		button.text = str(option.get("text", ""))
		button.pressed.connect(_on_option.bind(str(option.get("goto", "back"))))
		_options.add_child(button)
		shown += 1

	if shown == 0:
		var out := Button.new()
		out.custom_minimum_size = Vector2(0, 34)
		out.text = "Say nothing."
		out.pressed.connect(close)
		_options.add_child(out)


## The only gate in the data is how many logs have been read, which is how
## ARIA's evasions give way as the player catches up with her.
func _meets(requires: Dictionary) -> bool:
	if requires.is_empty():
		return true
	if requires.has("logs_read") and StoryLogic.logs_read_count() < int(requires["logs_read"]):
		return false
	return true


func _on_option(goto: String) -> void:
	if goto == "back":
		_show_node(StoryLogic.aria_root())
		return
	if goto == "exit":
		close()
		return
	_show_node(goto)
