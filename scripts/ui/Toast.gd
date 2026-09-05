extends PanelContainer

## A one-line notice that holds for a moment and fades. Freed automatically, so
## callers can fire and forget.

const HOLD := 2.6
const FADE := 0.6

const COLOURS := {
	"good": Color(0.55, 0.9, 0.62),
	"bad": Color(0.96, 0.5, 0.45),
	"info": Color(0.86, 0.9, 1.0),
}

var _age := 0.0


func setup(text: String, kind: String) -> void:
	$Label.text = text
	$Label.modulate = COLOURS.get(kind, COLOURS["info"])


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	mouse_filter = Control.MOUSE_FILTER_IGNORE


func _process(delta: float) -> void:
	# Real seconds: a notice should not linger four times as long at 0.25x.
	var scale_factor := Engine.time_scale
	if scale_factor > 0.001:
		_age += delta / scale_factor
	else:
		_age += 1.0 / 60.0

	if _age < HOLD:
		return
	var t := (_age - HOLD) / FADE
	if t >= 1.0:
		queue_free()
		return
	modulate.a = 1.0 - t
