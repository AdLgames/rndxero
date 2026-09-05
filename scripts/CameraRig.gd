extends Camera2D

## Scrolls along the road and nothing else: the strip is one horizontal scene,
## so vertical position and zoom are fixed. That also keeps the parallax layers
## in Town.gd welded to the ground line.

const CAMERA_Y := -140.0
const FIXED_ZOOM := 1.5
const PAN_SPEED := 700.0

var _min_x: float = 0.0
var _max_x: float = 0.0
var _dragging := false


func _ready() -> void:
	zoom = Vector2(FIXED_ZOOM, FIXED_ZOOM)
	position.y = CAMERA_Y
	make_current()


## Clamp so the view never runs off either end of the strip.
func frame_strip(strip_width: float) -> void:
	var half := (get_viewport_rect().size.x * 0.5) / FIXED_ZOOM
	if strip_width <= half * 2.0:
		_min_x = strip_width * 0.5
		_max_x = _min_x
	else:
		_min_x = half
		_max_x = strip_width - half
	position.x = clampf(position.x, _min_x, _max_x)


func _process(delta: float) -> void:
	var move := Input.get_axis("pan_left", "pan_right")
	if move != 0.0:
		position.x = clampf(position.x + move * PAN_SPEED * delta, _min_x, _max_x)
	position.y = CAMERA_Y


func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventMouseButton:
		var mb := event as InputEventMouseButton
		if mb.button_index == MOUSE_BUTTON_MIDDLE or mb.button_index == MOUSE_BUTTON_RIGHT:
			_dragging = mb.pressed
	elif event is InputEventMouseMotion and _dragging:
		var motion := (event as InputEventMouseMotion).relative.x / FIXED_ZOOM
		position.x = clampf(position.x - motion, _min_x, _max_x)
