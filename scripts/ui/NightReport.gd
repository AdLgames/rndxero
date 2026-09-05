extends CanvasLayer

## Full-screen night summary, per section 11. Shows what the town produced and
## ate, what it ran short of, anything that happened in the dark, and the line
## that came in off the road.

signal continued

const GOOD := Color(0.62, 0.86, 0.60)
const BAD := Color(0.94, 0.52, 0.48)
const QUIET := Color(0.74, 0.76, 0.84)
const OMEN := Color(0.86, 0.78, 0.52)

@onready var _panel: PanelContainer = $Panel
@onready var _title: Label = $Panel/Margin/Layout/Title
@onready var _lines: VBoxContainer = $Panel/Margin/Layout/Lines
@onready var _rumor: Label = $Panel/Margin/Layout/Rumor
@onready var _continue: Button = $Panel/Margin/Layout/Continue


func _ready() -> void:
	_continue.pressed.connect(_on_continue)
	close()


func show_report(report: Dictionary) -> void:
	_title.text = "Night of day %d" % int(report.get("day", 0))
	_fill(report)
	_rumor.text = str(report.get("rumor", ""))
	# The run may already be lost by the time the report is read; say so on the
	# button rather than dropping the player straight into the end screen.
	_continue.text = "See how it ended" if Game.over else "Morning"
	_panel.show()
	_continue.grab_focus()


func close() -> void:
	_panel.hide()


func is_open() -> bool:
	return _panel.visible


func _fill(report: Dictionary) -> void:
	for child in _lines.get_children():
		_lines.remove_child(child)
		child.queue_free()

	var produced := "%d food, %d water" % [int(report.get("food_produced", 0)), int(report.get("water_produced", 0))]
	if int(report.get("food_produced", 0)) + int(report.get("water_produced", 0)) > 0:
		_line("The town produced " + produced + ".", QUIET)

	var guests := int(report.get("guests", 0))
	var eaten := "Ate %d food and drew %d water" % [
		int(report.get("food_consumed", 0)), int(report.get("water_consumed", 0))]
	if guests > 0:
		eaten += " for the town and %d lodged guest%s" % [guests, "" if guests == 1 else "s"]
	_line(eaten + ".", QUIET)

	for shortfall in report.get("shortfalls", []):
		_line("Ashford ran out of %s. Reputation falls." % shortfall, BAD)
	var angered: Array = report.get("angered", [])
	if not angered.is_empty():
		var names: Array = []
		for id in angered:
			names.append(Factions.display_name(str(id)))
		_line("Guests left angry: " + ", ".join(names) + ".", BAD)

	for event in report.get("events", []):
		_line(str(event.get("text", "")), GOOD if str(event.get("tone", "bad")) == "good" else BAD)

	var omen := str(report.get("omen", ""))
	if omen != "":
		_line("The Free Road sends word: " + omen, OMEN)


func _line(text: String, colour: Color) -> void:
	var label := Label.new()
	label.text = text
	label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	label.modulate = colour
	_lines.add_child(label)


func _on_continue() -> void:
	close()
	continued.emit()
