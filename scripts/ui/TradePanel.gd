extends CanvasLayer

## Buy from a caravan's cargo, sell from the town's stock to what it wants.
## Rows are built from the live trade session, so depleting a manifest or
## running out of coin is visible immediately. The rules are CaravanQueue's.

signal closed

var _queue = null
var _data: Dictionary = {}

@onready var _panel: PanelContainer = $Panel
@onready var _title: Label = $Panel/Margin/Layout/Header/Title
@onready var _limit: Label = $Panel/Margin/Layout/Limit
@onready var _bonus: Label = $Panel/Margin/Layout/Bonus
@onready var _buy_list: VBoxContainer = $Panel/Margin/Layout/Columns/Buy/List
@onready var _sell_list: VBoxContainer = $Panel/Margin/Layout/Columns/Sell/List


func setup(queue) -> void:
	_queue = queue


func _ready() -> void:
	$Panel/Margin/Layout/Header/Close.pressed.connect(close)
	close()


func open_for(data: Dictionary) -> void:
	_data = data
	_panel.show()
	_refresh()


func close() -> void:
	if not _panel.visible:
		return
	_data = {}
	_panel.hide()
	closed.emit()


func is_open() -> bool:
	return _panel.visible


func _refresh() -> void:
	if _queue == null or _data.is_empty():
		return
	var state: Dictionary = _queue.trade_state()
	_title.text = "Trading with %s" % str(_data.get("name", ""))
	_bonus.text = TradeLogic.bonus_summary()

	var left: int = _queue.trade_units_left()
	if left < 0:
		_limit.text = "Market open: trade as much as you like."
	else:
		_limit.text = "Without a Market you may trade %d more item%s." % [left, "" if left == 1 else "s"]

	_fill(_buy_list, state.get("cargo", {}), true)
	_fill(_sell_list, state.get("wants", {}), false)


func _fill(list: VBoxContainer, goods: Dictionary, buying: bool) -> void:
	for child in list.get_children():
		list.remove_child(child)
		child.queue_free()

	var any := false
	# Walk the price table's order so the two columns line up.
	for good in Data.goods_order:
		var quantity := int(goods.get(good, 0))
		if quantity <= 0:
			continue
		any = true
		list.add_child(_row(str(good), quantity, buying))

	if not any:
		var empty := Label.new()
		empty.text = "Nothing on offer." if buying else "They want nothing you can sell."
		empty.modulate = Color(0.72, 0.74, 0.82)
		list.add_child(empty)


func _row(good: String, quantity: int, buying: bool) -> HBoxContainer:
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 8)

	var label := Label.new()
	label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	if buying:
		label.text = "%s ×%d  —  %d coin each" % [good.capitalize(), quantity, TradeLogic.buy_price(good)]
	else:
		label.text = "%s ×%d  —  %d coin each  (you hold %d)" % [
			good.capitalize(), quantity, TradeLogic.sell_price(good), Game.goods_count(good)]
	row.add_child(label)

	var button := Button.new()
	button.custom_minimum_size = Vector2(72, 0)
	button.text = "Buy" if buying else "Sell"
	button.disabled = not (_queue.can_buy(good) if buying else _queue.can_sell(good))
	button.pressed.connect(_on_trade.bind(good, buying))
	row.add_child(button)
	return row


func _on_trade(good: String, buying: bool) -> void:
	if buying:
		_queue.buy(good)
	else:
		_queue.sell(good)
	_refresh()
