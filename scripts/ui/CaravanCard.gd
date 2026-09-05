extends CanvasLayer

## Docked left during the morning, per section 11. Presents one caravan and the
## four actions from section 5; the rules behind them live in CaravanQueue.

signal resolved(action, toll)

const TOLL_LABEL := "%d coin"

var _data: Dictionary = {}
var _toll: int = 0
var _queue = null

@onready var _panel: PanelContainer = $Panel
@onready var _portrait: TextureRect = $Panel/Margin/Layout/Header/Portrait
@onready var _name: Label = $Panel/Margin/Layout/Header/Titles/CaravanName
@onready var _leader: Label = $Panel/Margin/Layout/Header/Titles/Leader
@onready var _faction: Label = $Panel/Margin/Layout/Header/Titles/Faction
@onready var _party: Label = $Panel/Margin/Layout/Party
@onready var _goods: Label = $Panel/Margin/Layout/Goods
@onready var _tolls: HBoxContainer = $Panel/Margin/Layout/Tolls
@onready var _lodge: Button = $Panel/Margin/Layout/Actions/Lodge
@onready var _pass: Button = $Panel/Margin/Layout/Actions/Pass
@onready var _turn_away: Button = $Panel/Margin/Layout/Actions/TurnAway
@onready var _warning: Label = $Panel/Margin/Layout/Warning


func setup(queue) -> void:
	_queue = queue


func _ready() -> void:
	_build_toll_buttons()
	_lodge.pressed.connect(_on_action.bind("lodge"))
	_pass.pressed.connect(_on_action.bind("pass"))
	_turn_away.pressed.connect(_on_action.bind("turn_away"))
	Events.resource_changed.connect(func(_n, _v): _refresh_actions())
	close()


func show_caravan(data: Dictionary) -> void:
	_data = data
	_toll = 0
	_panel.show()

	var portrait := load(str(data.get("portrait", "")))
	if portrait != null:
		_portrait.texture = portrait
	_name.text = str(data.get("name", ""))
	_leader.text = str(data.get("leader", ""))
	_faction.text = Factions.display_name(str(data.get("faction", "")))
	_party.text = "%d travellers, %d animals — %d beds free" % [
		int(data.get("size", 1)), int(data.get("animals", 0)), Game.beds_free()]
	_goods.text = _describe_goods(data)
	_select_toll(0)


func close() -> void:
	_data = {}
	_panel.hide()


## Trading opens at M4; until then the manifest is shown but not actionable,
## which is also how the player learns what a caravan is carrying.
func _describe_goods(data: Dictionary) -> String:
	var lines: Array = []
	var cargo: Dictionary = data.get("cargo", {})
	var wants: Dictionary = data.get("wants", {})
	lines.append("Carrying: " + _list(cargo))
	lines.append("Looking for: " + _list(wants))
	lines.append("Trading opens at M4.")
	return "\n".join(lines)


func _list(goods: Dictionary) -> String:
	if goods.is_empty():
		return "nothing"
	var parts: Array = []
	for good in goods:
		parts.append("%d %s" % [int(goods[good]), good])
	return ", ".join(parts)


func _build_toll_buttons() -> void:
	var group := ButtonGroup.new()
	for amount in CaravanQueue.TOLLS:
		var button := Button.new()
		button.toggle_mode = true
		button.button_group = group
		button.text = TOLL_LABEL % amount
		button.pressed.connect(_select_toll.bind(amount))
		_tolls.add_child(button)


func _select_toll(amount: int) -> void:
	_toll = amount
	var index := CaravanQueue.TOLLS.find(amount)
	if index >= 0 and index < _tolls.get_child_count():
		_tolls.get_child(index).button_pressed = true
	_refresh_actions()


func _refresh_actions() -> void:
	if _data.is_empty() or _queue == null:
		return
	var can_lodge: bool = _queue.can_lodge(_data)
	_lodge.disabled = not can_lodge
	_lodge.text = "Lodge for the night" if can_lodge else "No beds free"

	if _queue.refuses(_data, _toll):
		_warning.text = "At %d coin they will refuse and leave." % _toll
	elif _toll >= CaravanQueue.HIGH_TOLL:
		_warning.text = "A %d coin toll will cost you standing." % _toll
	else:
		_warning.text = ""


func _on_action(action: String) -> void:
	var toll := _toll
	var data := _data
	close()
	if data.is_empty():
		return
	resolved.emit(action, toll)
