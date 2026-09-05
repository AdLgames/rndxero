extends CanvasLayer

## Section 2's second pillar: no recipe book until you have made it. This lists
## what has been discovered across all runs (Meta), and counts what has not.

@onready var _panel: PanelContainer = $Panel
@onready var _summary: Label = $Panel/Margin/Layout/Summary
@onready var _list: VBoxContainer = $Panel/Margin/Layout/Scroll/List


func _ready() -> void:
	$Panel/Margin/Layout/Close.pressed.connect(close)
	close()


func close() -> void:
	_panel.hide()


func is_open() -> bool:
	return _panel.visible


func open() -> void:
	for child in _list.get_children():
		_list.remove_child(child)
		child.queue_free()

	var known := 0
	var total := 0
	for recipe in Data.recipes:
		if recipe.get("passive", false):
			continue
		total += 1
		if not Meta.discovered.has(recipe["id"]):
			continue
		known += 1
		var line := Label.new()
		line.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		line.text = "%s  →  %s" % [_names(recipe.get("inputs", [])), _names(recipe.get("output", []))]
		if recipe.get("output", []).is_empty():
			line.text = "%s  →  %s" % [_names(recipe.get("inputs", [])), _describe(recipe)]
		_list.add_child(line)

	_summary.text = "%d of %d recipes discovered." % [known, total]
	if known == 0:
		var hint := Label.new()
		hint.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		hint.text = "Nothing yet. Put two cards together and find out."
		_list.add_child(hint)
	_panel.show()


func _names(ids: Array) -> String:
	if ids.is_empty():
		return "—"
	var parts: Array = []
	for id in ids:
		var text := str(id)
		if text.begins_with("__"):
			parts.append("a new hand")
		else:
			parts.append(Data.card_name(text))
	return " + ".join(parts)


func _describe(recipe: Dictionary) -> String:
	var effects: Dictionary = recipe.get("effects", {})
	if effects.has("ending"):
		return "an ending"
	if effects.has("o2"):
		return "+%d oxygen" % int(effects["o2"])
	if effects.get("read_log", false):
		return "the log is read"
	if effects.has("open_pack"):
		return "the pack opens"
	if effects.has("use_location"):
		return "one draw"
	return "it is dealt with"
