extends Control


@onready var _archive: Button = $Layout/Archive
@onready var _reader = $LogReader


func _ready() -> void:
	$Layout/Start.pressed.connect(_start)
	$Layout/Quit.pressed.connect(func(): get_tree().quit())
	_archive.pressed.connect(func(): _reader.show_archive())
	_archive.visible = Meta.archive_unlocked()
	$Layout/Progress.text = _progress_line()
	$Layout/Start.grab_focus()


func _progress_line() -> String:
	var parts: Array = []
	parts.append("%d recipes known" % Meta.discovered.size())
	parts.append("%d of %d logs recovered" % [Meta.archive.size(), Data.logs.size()])
	if not Meta.endings.is_empty():
		parts.append("%d of 4 endings seen" % Meta.endings.size())
	return "  ·  ".join(parts)


func _start() -> void:
	get_tree().change_scene_to_file("res://scenes/Main.tscn")
