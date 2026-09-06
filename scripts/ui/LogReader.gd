extends CanvasLayer

## Reads one Log, and doubles as the Archive once the Truth ending has unlocked
## it (section 11).

@onready var _panel: PanelContainer = $Panel
@onready var _title: Label = $Panel/Margin/Layout/Title
@onready var _byline: Label = $Panel/Margin/Layout/Byline
@onready var _body: RichTextLabel = $Panel/Margin/Layout/Body
@onready var _clue: Label = $Panel/Margin/Layout/Clue
@onready var _index: VBoxContainer = $Panel/Margin/Layout/Index
@onready var _close: Button = $Panel/Margin/Layout/Close


func _ready() -> void:
	_close.pressed.connect(close)
	Events.log_read.connect(show_log)
	close()


func close() -> void:
	_panel.hide()


func is_open() -> bool:
	return _panel.visible


func show_log(log_id: String) -> void:
	var entry := Data.log_entry(log_id)
	if entry.is_empty():
		return
	_index.hide()
	_title.text = str(entry.get("title", ""))
	_byline.text = "%s — station day %d" % [entry.get("speaker", ""), int(entry.get("station_day", 0))]
	_body.text = str(entry.get("text", ""))
	_clue.text = str(entry.get("clue", ""))
	_clue.visible = _has_curious_reader()
	_panel.show()


## Section 10: only a Curious crew member surfaces the extra line.
func _has_curious_reader() -> bool:
	if Game.board == null:
		return false
	for card in Game.board.cards_of_type("crew"):
		if bool(Data.trait_def(str(card.state.get("trait", ""))).get("log_bonus_clue", false)):
			return true
	return false


func show_archive() -> void:
	_title.text = "Halvard-7 Archive"
	_byline.text = "%d of %d recovered" % [Meta.archive.size(), Data.logs.size()]
	_body.text = ""
	_clue.visible = false
	for child in _index.get_children():
		_index.remove_child(child)
		child.queue_free()
	for entry in Data.logs:
		var button := Button.new()
		var known: bool = Meta.archive.has(entry["id"])
		button.text = "%d. %s" % [int(entry["n"]), entry["title"] if known else "— sealed —"]
		button.disabled = not known
		if known:
			button.pressed.connect(show_log.bind(str(entry["id"])))
		_index.add_child(button)
	_index.show()
	_panel.show()
