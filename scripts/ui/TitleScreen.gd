extends Control


func _ready() -> void:
	Engine.time_scale = 1.0
	$Layout/Start.pressed.connect(_start)
	$Layout/Start.grab_focus()


func _start() -> void:
	get_tree().change_scene_to_file("res://scenes/Main.tscn")
