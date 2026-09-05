extends PanelContainer

## A one-line notice that holds for a moment and fades, then frees itself.

const HOLD := 2.8
const FADE := 0.6

const COLOURS := {
	"good": Color(0.62, 0.86, 0.60),
	"bad": Color(0.94, 0.52, 0.48),
	"info": Color(0.88, 0.88, 0.94),
}

var _age := 0.0


func setup(text: String, kind: String) -> void:
	$Label.text = text
	$Label.modulate = COLOURS.get(kind, COLOURS["info"])


func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_IGNORE


func _process(delta: float) -> void:
	_age += delta
	if _age < HOLD:
		return
	var t := (_age - HOLD) / FADE
	if t >= 1.0:
		queue_free()
		return
	modulate.a = 1.0 - t
