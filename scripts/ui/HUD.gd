extends CanvasLayer

## Section 12: the readout is diegetic -- oxygen, the cycle clock, and how full
## the manifest is. Nothing else is on screen during play.

const TOAST_SCENE := preload("res://scenes/ui/Toast.tscn")
const MAX_TOASTS := 5

signal book_pressed
signal archive_pressed

@onready var _o2: Label = $Bar/Margin/Row/O2
@onready var _cycle: Label = $Bar/Margin/Row/Cycle
@onready var _clock: ProgressBar = $Bar/Margin/Row/Clock
@onready var _slots: Label = $Bar/Margin/Row/Slots
@onready var _pause: Button = $Bar/Margin/Row/Pause
@onready var _book: Button = $Bar/Margin/Row/Book
@onready var _archive: Button = $Bar/Margin/Row/Archive
@onready var _toasts: VBoxContainer = $Toasts


func _ready() -> void:
	_pause.pressed.connect(func(): Game.set_paused(not Game.paused))
	_book.pressed.connect(func(): book_pressed.emit())
	_archive.pressed.connect(func(): archive_pressed.emit())
	_archive.visible = Meta.archive_unlocked()

	Events.o2_changed.connect(_on_o2)
	Events.cycle_started.connect(_on_cycle)
	Events.slots_changed.connect(_on_slots)
	Events.paused_changed.connect(_on_paused)
	Events.toast.connect(_on_toast)

	_on_o2(Game.o2)
	_on_cycle(Game.cycle)


func _process(_delta: float) -> void:
	_clock.value = Game.cycle_fraction() * 100.0


func _on_o2(value: float) -> void:
	_o2.text = "O2  %d" % int(value)
	# Section 12: the readout turns as the air runs out.
	_o2.modulate = Color(0.94, 0.42, 0.36) if value <= 3.0 else Color(0.78, 0.86, 0.94)


func _on_cycle(cycle: int) -> void:
	_cycle.text = "Cycle %d" % cycle


func _on_slots(used: int, total: int) -> void:
	_slots.text = "Manifest %d / %d" % [used, total]
	_slots.modulate = Color(0.94, 0.42, 0.36) if used > total else Color(0.78, 0.86, 0.94)


func _on_paused(is_paused: bool) -> void:
	_pause.text = "Resume" if is_paused else "Pause"


func _on_toast(text: String, kind: String) -> void:
	var toast := TOAST_SCENE.instantiate()
	_toasts.add_child(toast)
	toast.setup(text, kind)
	while _toasts.get_child_count() > MAX_TOASTS:
		var oldest := _toasts.get_child(0)
		_toasts.remove_child(oldest)
		oldest.queue_free()
