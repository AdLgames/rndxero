extends CanvasLayer

## Resource bar, faction crests, the day counter and the End Day button.
## Rows are built from Factions.IDS and the resource list rather than laid out
## in the scene, so nothing here needs touching when content changes.

const TOAST_SCENE := preload("res://scenes/ui/Toast.tscn")
const MAX_TOASTS := 4

const RESOURCES := [
	{"key": "coin", "label": "Coin", "icon": "res://assets/ui/icon_coin.png"},
	{"key": "food", "label": "Food", "icon": "res://assets/ui/icon_food.png"},
	{"key": "water", "label": "Water", "icon": "res://assets/ui/icon_water.png"},
	{"key": "lodging", "label": "Lodging", "icon": "res://assets/ui/icon_lodging.png"},
	{"key": "reputation", "label": "Reputation", "icon": "res://assets/ui/icon_reputation.png"},
]

const PHASE_NAMES := {
	0: "Morning",
	1: "Afternoon",
	2: "Night",
	3: "Season's end",
}

signal end_day_pressed

var _resource_labels: Dictionary = {}
var _faction_bars: Dictionary = {}

@onready var _resources_row: HBoxContainer = $TopBar/Margin/Layout/Line1/Resources
@onready var _factions_row: HBoxContainer = $TopBar/Margin/Layout/Factions
@onready var _day_label: Label = $TopBar/Margin/Layout/Line1/Day
@onready var _phase_label: Label = $TopBar/Margin/Layout/Line1/Phase
@onready var _end_day: Button = $TopBar/Margin/Layout/Line1/EndDay
@onready var _stock: Label = $TopBar/Margin/Layout/Stock
@onready var _last_night: Label = $TopBar/Margin/Layout/LastNight
@onready var _toasts: VBoxContainer = $Toasts


func _ready() -> void:
	_build_resource_row()
	_build_faction_row()
	_end_day.pressed.connect(func(): end_day_pressed.emit())

	Events.resource_changed.connect(_on_resource_changed)
	Events.faction_changed.connect(_on_faction_changed)
	Events.day_started.connect(_on_day_started)
	Events.phase_changed.connect(_on_phase_changed)
	Events.night_report.connect(_on_night_report)
	Events.toast.connect(_on_toast)
	Events.goods_changed.connect(_on_goods_changed)

	_last_night.text = ""
	_on_goods_changed(Game.goods)


func _build_resource_row() -> void:
	for entry in RESOURCES:
		var group := HBoxContainer.new()
		group.add_theme_constant_override("separation", 4)
		group.tooltip_text = entry["label"]

		var icon := TextureRect.new()
		icon.texture = load(entry["icon"])
		icon.custom_minimum_size = Vector2(24, 24)
		icon.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
		icon.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
		group.add_child(icon)

		var value := Label.new()
		value.custom_minimum_size = Vector2(42, 0)
		value.text = "0"
		group.add_child(value)

		_resources_row.add_child(group)
		_resource_labels[entry["key"]] = value


func _build_faction_row() -> void:
	for id in Factions.IDS:
		var group := HBoxContainer.new()
		group.add_theme_constant_override("separation", 5)

		var crest := TextureRect.new()
		crest.texture = load(Factions.CRESTS[id])
		crest.custom_minimum_size = Vector2(22, 22)
		crest.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
		crest.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
		group.add_child(crest)

		var name_label := Label.new()
		name_label.text = Factions.display_name(id)
		name_label.custom_minimum_size = Vector2(78, 0)
		group.add_child(name_label)

		# The meter runs -5..+5, so it is shown shifted into 0..10.
		var bar := ProgressBar.new()
		bar.min_value = 0
		bar.max_value = Factions.MAX - Factions.MIN
		bar.value = -Factions.MIN
		bar.custom_minimum_size = Vector2(110, 16)
		bar.show_percentage = false
		group.add_child(bar)

		var value := Label.new()
		value.custom_minimum_size = Vector2(28, 0)
		value.text = "0"
		group.add_child(value)

		_factions_row.add_child(group)
		_faction_bars[id] = {"bar": bar, "value": value}


func _on_resource_changed(name: String, value: int) -> void:
	if _resource_labels.has(name):
		_resource_labels[name].text = str(value)


func _on_faction_changed(id: String, value: int) -> void:
	if not _faction_bars.has(id):
		return
	_faction_bars[id]["bar"].value = value - Factions.MIN
	_faction_bars[id]["value"].text = "%+d" % value


func _on_day_started(day: int) -> void:
	_day_label.text = "Day %d / %d" % [day, Game.SEASON_LENGTH]


func _on_phase_changed(phase: int) -> void:
	_phase_label.text = PHASE_NAMES.get(phase, "")
	_end_day.disabled = phase != Game.Phase.BUILD


func _on_night_report(report: Dictionary) -> void:
	var parts: Array = []
	if int(report["food_produced"]) > 0 or int(report["water_produced"]) > 0:
		parts.append("produced %d food, %d water" % [int(report["food_produced"]), int(report["water_produced"])])
	parts.append("ate %d food, drank %d water" % [int(report["food_consumed"]), int(report["water_consumed"])])
	var shortfalls: Array = report["shortfalls"]
	if not shortfalls.is_empty():
		parts.append("short of " + ", ".join(shortfalls))
	_last_night.text = "Night %d: %s" % [int(report["day"]), "; ".join(parts)]


## Goods are not one of the five resources, so they get their own line rather
## than an icon slot the spec does not have.
func _on_goods_changed(goods: Dictionary) -> void:
	var parts: Array = []
	for good in Data.goods_order:
		var quantity := int(goods.get(good, 0))
		if quantity > 0:
			parts.append("%d %s" % [quantity, good])
	_stock.text = "Stock: " + (", ".join(parts) if not parts.is_empty() else "empty")


func _on_toast(text: String, kind: String) -> void:
	var toast := TOAST_SCENE.instantiate()
	_toasts.add_child(toast)
	toast.setup(text, kind)
	while _toasts.get_child_count() > MAX_TOASTS:
		var oldest := _toasts.get_child(0)
		_toasts.remove_child(oldest)
		oldest.queue_free()
