extends PanelContainer

## A one-line notice that holds and fades.

const HOLD := 3.0
const FADE := 0.7

const COLOURS := {
	"good": Color(0.55, 0.82, 0.62),
	"bad": Color(0.94, 0.48, 0.42),
	"info": Color(0.80, 0.86, 0.94),
}

var _age := 0.0


func setup(text: String, kind: String) -> void:
	$Label.text = text
	$Label.modulate = COLOURS.get(kind, COLOURS["info"])


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
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
