extends CanvasLayer

## Top bar, tech panel toggle, toasts and the game-over card.

const TOAST_SCENE := preload("res://scenes/ui/Toast.tscn")
const MAX_TOASTS := 5

@onready var _credits: Label = $TopBar/Bar/Credits
@onready var _rep_bar: ProgressBar = $TopBar/Bar/RepBar
@onready var _day: Label = $TopBar/Bar/DayLabel
@onready var _day_bar: ProgressBar = $TopBar/Bar/DayBar
@onready var _status: Label = $TopBar/Bar/Status
@onready var _toasts: VBoxContainer = $Toasts
@onready var _tech_panel := $TechPanel
@onready var _game_over: PanelContainer = $GameOver


func _ready() -> void:
	_rep_bar.max_value = Game.MAX_REP
	_tech_panel.hide()
	_game_over.hide()

	$TopBar/Bar/PauseBtn.pressed.connect(func(): Game.set_speed(0.0))
	$TopBar/Bar/Speed1Btn.pressed.connect(func(): Game.set_speed(1.0))
	$TopBar/Bar/Speed2Btn.pressed.connect(func(): Game.set_speed(2.0))
	$TechButton.pressed.connect(_toggle_tech)
	$GameOver/Layout/Restart.pressed.connect(_restart)

	Events.credits_changed.connect(_on_credits)
	Events.rep_changed.connect(_on_rep)
	Events.day_passed.connect(_on_day)
	Events.toast.connect(_on_toast)
	Events.game_over.connect(_on_game_over)

	_on_credits(Game.credits)
	_on_rep(Game.reputation)
	_on_day(Game.day)


func _process(_delta: float) -> void:
	_day_bar.value = Game.day_fraction() * 100.0


func set_status(text: String) -> void:
	_status.text = text


func _on_credits(credits: int) -> void:
	_credits.text = "%d cr" % credits


func _on_rep(rep: int) -> void:
	_rep_bar.value = rep
	_rep_bar.tooltip_text = "Reputation %d / %d" % [rep, Game.MAX_REP]


func _on_day(day: int) -> void:
	_day.text = "Day %d" % day


func _toggle_tech() -> void:
	_tech_panel.visible = not _tech_panel.visible


func _on_toast(text: String, kind: String) -> void:
	var toast := TOAST_SCENE.instantiate()
	_toasts.add_child(toast)
	toast.setup(text, kind)
	# Oldest first in the container, so trim from the top.
	while _toasts.get_child_count() > MAX_TOASTS:
		var oldest := _toasts.get_child(0)
		_toasts.remove_child(oldest)
		oldest.queue_free()


func _on_game_over(day: int) -> void:
	$GameOver/Layout/Detail.text = "Reputation hit zero on day %d.\nYou moved cargo for %d days." % [day, day]
	_game_over.show()


func _restart() -> void:
	Engine.time_scale = 1.0
	get_tree().reload_current_scene()
