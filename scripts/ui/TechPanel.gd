extends PanelContainer

## Scrollable list of every node in data/tech.json. Rows are built from the data
## rather than laid out in the scene, so adding a tech node needs no UI work.

var _rows: Dictionary = {}   ## tech id -> Dictionary of row controls

@onready var _list: VBoxContainer = $Margin/Layout/Scroll/List


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	$Margin/Layout/Header/Close.pressed.connect(func(): hide())
	Events.credits_changed.connect(func(_c): _refresh())
	Events.tech_unlocked.connect(func(_id): _refresh())
	_build_rows()
	_refresh()


func _build_rows() -> void:
	for child in _list.get_children():
		child.queue_free()
	_rows.clear()

	for node in TechManager.nodes:
		var id: String = node["id"]
		var row := HBoxContainer.new()
		row.add_theme_constant_override("separation", 10)

		var text := VBoxContainer.new()
		text.size_flags_horizontal = Control.SIZE_EXPAND_FILL

		var title := Label.new()
		title.text = "%s  -  %d cr" % [node["name"], int(node["cost"])]
		text.add_child(title)

		var desc := Label.new()
		desc.text = str(node.get("desc", ""))
		desc.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		desc.modulate = Color(0.78, 0.82, 0.92)
		text.add_child(desc)

		var prereq := Label.new()
		prereq.modulate = Color(0.68, 0.72, 0.86)
		var names: Array = []
		for p in node["prereqs"]:
			names.append(str(TechManager.by_id[p]["name"]) if TechManager.by_id.has(p) else str(p))
		prereq.text = "Requires: " + ", ".join(names) if not names.is_empty() else ""
		prereq.visible = not names.is_empty()
		text.add_child(prereq)

		row.add_child(text)

		var buy := Button.new()
		buy.custom_minimum_size = Vector2(90, 0)
		buy.pressed.connect(_on_buy.bind(id))
		row.add_child(buy)

		_list.add_child(row)
		_list.add_child(HSeparator.new())
		_rows[id] = {"title": title, "button": buy, "prereq": prereq}


func _on_buy(id: String) -> void:
	if not TechManager.buy(id):
		Events.toast.emit("Cannot buy %s yet" % TechManager.by_id[id]["name"], "bad")


func _refresh() -> void:
	for id in _rows:
		var button: Button = _rows[id]["button"]
		var title: Label = _rows[id]["title"]
		if TechManager.has(id):
			button.text = "Owned"
			button.disabled = true
			title.modulate = Color(0.55, 0.9, 0.62)
		elif not TechManager.prereqs_met(id):
			button.text = "Locked"
			button.disabled = true
			title.modulate = Color(0.6, 0.62, 0.7)
		elif TechManager.can_buy(id):
			button.text = "Buy"
			button.disabled = false
			title.modulate = Color(1, 1, 1)
		else:
			button.text = "Too dear"
			button.disabled = true
			title.modulate = Color(0.8, 0.78, 0.7)
