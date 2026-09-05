extends Sprite2D

## Steps through the four-frame explosion strip once, then removes itself.
## Uses real time rather than scaled delta so a wreck still reads at 2x speed.

const FRAME_TIME := 0.08

var _elapsed := 0.0


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	hframes = 4
	frame = 0


func _process(delta: float) -> void:
	var scale_factor := Engine.time_scale
	if scale_factor > 0.001:
		_elapsed += delta / scale_factor
	else:
		_elapsed += 1.0 / 60.0
	var index := int(_elapsed / FRAME_TIME)
	if index >= hframes:
		queue_free()
		return
	frame = index
