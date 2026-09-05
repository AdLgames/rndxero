extends Camera2D

## Pan with WASD/arrows or a middle-mouse drag, zoom on the wheel.
## Runs while paused so the player can look around a stopped field.

const PAN_SPEED := 640.0
const ZOOM_STEP := 1.12
const ZOOM_MIN := 0.4
const ZOOM_MAX := 2.5

var _dragging := false


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	make_current()


func _process(delta: float) -> void:
	# `delta` is scaled by Engine.time_scale, which is 0 while paused. Camera
	# speed should not depend on game speed, so undo the scaling -- and fall
	# back to a nominal frame when paused, where delta is exactly 0.
	var scale := Engine.time_scale
	var raw_delta := 1.0 / 60.0
	if scale > 0.001:
		raw_delta = delta / scale
	var move := Input.get_vector("cam_left", "cam_right", "cam_up", "cam_down")
	if move != Vector2.ZERO:
		position += move * PAN_SPEED * raw_delta / zoom.x


func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventMouseButton:
		var mb := event as InputEventMouseButton
		match mb.button_index:
			MOUSE_BUTTON_WHEEL_UP:
				if mb.pressed:
					_apply_zoom(ZOOM_STEP)
			MOUSE_BUTTON_WHEEL_DOWN:
				if mb.pressed:
					_apply_zoom(1.0 / ZOOM_STEP)
			MOUSE_BUTTON_MIDDLE:
				_dragging = mb.pressed
	elif event is InputEventMouseMotion and _dragging:
		position -= (event as InputEventMouseMotion).relative / zoom.x


func _apply_zoom(factor: float) -> void:
	var z := clampf(zoom.x * factor, ZOOM_MIN, ZOOM_MAX)
	zoom = Vector2(z, z)
