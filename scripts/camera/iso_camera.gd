class_name IsoCamera
extends Camera3D

## Orthographic camera per GAME_DESIGN.md section 8: yaw 45 degrees, pitch
## about 30 degrees, and rotation locked to 90-degree steps so the octagon grid
## always presents the same four readings.

const PITCH_DEG := 30.0
const YAW_STEP_DEG := 90.0
const DISTANCE := 60.0
const TURN_SPEED := 8.0
const PAN_SPEED := 14.0
const ZOOM_STEP := 1.15
const ZOOM_MIN := 4.0
const ZOOM_MAX := 60.0

@export var focus: Vector3 = Vector3.ZERO

var _yaw := 45.0
var _target_yaw := 45.0


func _ready() -> void:
	projection = PROJECTION_ORTHOGONAL
	size = 20.0
	near = 0.1
	far = 400.0
	_update_transform()


func _process(delta: float) -> void:
	_yaw = lerpf(_yaw, _target_yaw, minf(1.0, TURN_SPEED * delta))
	var move := Vector2(
		Input.get_action_strength("cam_pan_right") - Input.get_action_strength("cam_pan_left"),
		Input.get_action_strength("cam_pan_down") - Input.get_action_strength("cam_pan_up"))
	if move != Vector2.ZERO:
		# Pan along the screen axes, not the world ones, so the keys keep
		# meaning the same thing after the view is rotated.
		var yaw_rad := deg_to_rad(_yaw)
		var right := Vector3(cos(yaw_rad), 0.0, sin(yaw_rad))
		var forward := Vector3(-sin(yaw_rad), 0.0, cos(yaw_rad))
		var speed := PAN_SPEED * (size / 20.0) * delta
		focus += (right * move.x + forward * move.y) * speed
	_update_transform()


func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("cam_rotate_cw"):
		_target_yaw += YAW_STEP_DEG
	elif event.is_action_pressed("cam_rotate_ccw"):
		_target_yaw -= YAW_STEP_DEG
	elif event is InputEventMouseButton and event.pressed:
		var button := (event as InputEventMouseButton).button_index
		if button == MOUSE_BUTTON_WHEEL_UP:
			size = clampf(size / ZOOM_STEP, ZOOM_MIN, ZOOM_MAX)
		elif button == MOUSE_BUTTON_WHEEL_DOWN:
			size = clampf(size * ZOOM_STEP, ZOOM_MIN, ZOOM_MAX)


func _update_transform() -> void:
	var yaw_rad := deg_to_rad(_yaw)
	var pitch_rad := deg_to_rad(PITCH_DEG)
	var horizontal := cos(pitch_rad) * DISTANCE
	var offset := Vector3(
		-sin(yaw_rad) * horizontal,
		sin(pitch_rad) * DISTANCE,
		-cos(yaw_rad) * horizontal)
	global_position = focus + offset
	look_at(focus, Vector3.UP)
