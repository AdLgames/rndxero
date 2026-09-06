class_name Card
extends Control

## One card on the board. Holds its definition id and whatever per-instance
## state its type needs -- a crew member's trait and morale, a location's
## remaining uses, a Log's identity, a hazard's age.

const SIZE := Vector2(84, 112)

var card_id: String = ""
var state: Dictionary = {}
var stack: Stack = null

@onready var _art: TextureRect = $Art
@onready var _name: Label = $NameLabel
@onready var _effect: Label = $EffectLabel
@onready var _badge: Label = $Badge
@onready var _progress: ProgressBar = $Progress


func setup(id: String) -> void:
	card_id = id
	custom_minimum_size = SIZE
	size = SIZE
	if not is_node_ready():
		await ready
	_refresh()


func _ready() -> void:
	custom_minimum_size = SIZE
	size = SIZE
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	if card_id != "":
		_refresh()


func _process(_delta: float) -> void:
	if stack == null or stack.top() != self:
		_progress.visible = false
		return
	var fraction := CraftLogic.fraction(stack)
	_progress.visible = fraction > 0.0
	_progress.value = fraction * 100.0


func _refresh() -> void:
	var definition := Data.card(card_id)
	var texture := load("res://assets/cards/%s.png" % card_id)
	if texture != null:
		_art.texture = texture
	_name.text = display_name()
	_effect.text = _effect_line(definition)
	_badge.text = _badge_line()
	_badge.visible = _badge.text != ""


func display_name() -> String:
	var base := Data.card_name(card_id)
	if Data.card_type(card_id) == "crew" and state.has("trait"):
		return "%s (%s)" % [base, Data.trait_def(str(state["trait"])).get("name", state["trait"])]
	return base


## Section 12: one line, never a text wall.
func _effect_line(definition: Dictionary) -> String:
	if card_id == "log":
		var entry := Data.log_entry(str(state.get("log_id", "")))
		return str(entry.get("title", "Unread fragment"))
	var produces: Dictionary = definition.get("produces", {})
	if not produces.is_empty():
		var parts: Array = []
		for key in produces:
			parts.append("+%d %s" % [int(produces[key]), key])
		return ", ".join(parts)
	if card_id == "ruin" and state.has("was"):
		return "was a %s" % Data.card_name(str(state["was"]))
	if definition.has("uses"):
		return "%d uses left" % int(state.get("uses", definition["uses"]))
	if definition.has("power"):
		return "powers %d" % int(definition["power"])
	return ""


## Short status flags, so the board is readable without inspecting anything.
func _badge_line() -> String:
	var flags: Array = []
	if Data.card_type(card_id) == "crew":
		flags.append("M%d" % int(state.get("morale", 6)))
		if state.get("injured", false):
			flags.append("hurt")
		if state.get("infected", false):
			flags.append("sick")
	if card_id == "log" and state.get("read", false):
		flags.append("read")
	return " ".join(flags)


func refresh() -> void:
	if is_node_ready():
		_refresh()


func stack_position() -> Vector2:
	return stack.position if stack != null else position


func card_rect() -> Rect2:
	return Rect2(position, SIZE)
