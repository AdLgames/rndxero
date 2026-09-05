extends CanvasLayer

## Docked left during the morning, per section 11. Presents one caravan and the
## four actions from section 5; the rules behind them live in CaravanQueue.

signal resolved(action, toll)
signal trade_requested(data)

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
@onready var _trade: Button = $Panel/Margin/Layout/Trade


func setup(queue) -> void:
	_queue = queue


func _ready() -> void:
	_build_toll_buttons()
	_trade.pressed.connect(_on_trade_pressed)
	_lodge.pressed.connect(_on_action.bind("lodge"))
	_pass.pressed.connect(_on_action.bind("pass"))
	_turn_away.pressed.connect(_on_action.bind("turn_away"))
	Events.resource_changed.connect(func(_n, _v): _refresh_actions())
	Events.goods_changed.connect(func(_g): refresh())
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
	_goods.text = _describe_goods()
	_select_toll(0)


func close() -> void:
	_data = {}
	_panel.hide()


## Read from the live trade session rather than the caravan definition, so a
## manifest visibly empties as the player buys from it.
func _describe_goods() -> String:
	if _data.is_empty():
		return ""
	var cargo: Dictionary = _data.get("cargo", {})
	var wants: Dictionary = _data.get("wants", {})
	if _queue != null:
		var state: Dictionary = _queue.trade_state()
		cargo = state.get("cargo", cargo)
		wants = state.get("wants", wants)
	var lines: Array = []
	lines.append("Carrying: " + _list(cargo))
	lines.append("Looking for: " + _list(wants))
	return "\n".join(lines)


## Re-read everything that the trade panel can have changed.
func refresh() -> void:
	if _data.is_empty():
		return
	_party.text = "%d travellers, %d animals — %d beds free" % [
		int(_data.get("size", 1)), int(_data.get("animals", 0)), Game.beds_free()]
	_goods.text = _describe_goods()
	_refresh_actions()


func _list(goods: Dictionary) -> String:
	var parts: Array = []
	for good in goods:
		var quantity := int(goods[good])
		if quantity > 0:
			parts.append("%d %s" % [quantity, good])
	if parts.is_empty():
		return "nothing"
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

	_trade.disabled = _queue.trade_units_left() == 0
	if _queue.refuses(_data, _toll):
		_warning.text = "At %d coin they will refuse and leave." % _toll
	elif _toll >= CaravanQueue.HIGH_TOLL:
		_warning.text = "A %d coin toll will cost you standing." % _toll
	else:
		_warning.text = ""


func _on_trade_pressed() -> void:
	if not _data.is_empty():
		trade_requested.emit(_data)


func _on_action(action: String) -> void:
	var toll := _toll
	var data := _data
	close()
	if data.is_empty():
		return
	resolved.emit(action, toll)
