extends CanvasLayer

## One picker, two jobs: choosing which cards to eject when the manifest is over
## capacity (section 3), and choosing a stowaway's trait when a Careful crew
## member vetted them (recipe 41). Both are "pick from this list", so they share
## a screen rather than each getting one.

signal resolved

var _mode := ""
var _remaining := 0
var _card = null

@onready var _panel: PanelContainer = $Panel
@onready var _title: Label = $Panel/Margin/Layout/Title
@onready var _detail: Label = $Panel/Margin/Layout/Detail
@onready var _options: VBoxContainer = $Panel/Margin/Layout/Scroll/Options


func _ready() -> void:
	close()


func close() -> void:
	_mode = ""
	_panel.hide()


func is_open() -> bool:
	return _panel.visible


func ask_eject(excess: int) -> void:
	_mode = "eject"
	_remaining = excess
	_title.text = "Over capacity"
	_refresh_eject()
	_panel.show()


func ask_trait(card, options: Array) -> void:
	_mode = "trait"
	_card = card
	_title.text = "They vouch for them"
	_detail.text = "A careful eye picked this one out of the dark. Choose what you are getting."
	_clear()
	for trait_id in options:
		var definition := Data.trait_def(str(trait_id))
		_button("%s — %s" % [definition.get("name", trait_id), definition.get("blurb", "")],
			_on_trait.bind(str(trait_id)))
	_panel.show()


func _refresh_eject() -> void:
	_detail.text = "The manifest will not hold everything. Put %d card%s out of the airlock." % [
		_remaining, "" if _remaining == 1 else "s"]
	_clear()
	for card in Game.board.all_cards():
		_button("%s   %s" % [card.display_name(), Data.card_type(card.card_id)], _on_eject.bind(card))


func _clear() -> void:
	for child in _options.get_children():
		_options.remove_child(child)
		child.queue_free()


func _button(text: String, action: Callable) -> void:
	var button := Button.new()
	button.text = text
	button.custom_minimum_size = Vector2(0, 32)
	button.pressed.connect(action)
	_options.add_child(button)


func _on_eject(card) -> void:
	Game.board.remove_card(card)
	_remaining -= 1
	if _remaining > 0 and Game.board.all_cards().size() > Game.board.slot_capacity():
		_refresh_eject()
		return
	close()
	resolved.emit()


func _on_trait(trait_id: String) -> void:
	if _card != null:
		_card.state["trait"] = trait_id
		_card.state["morale"] = int(Data.trait_def(trait_id).get("morale_start", Data.number("morale_start", 6)))
		_card.refresh()
	close()
	resolved.emit()
