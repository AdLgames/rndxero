extends CanvasModulate

## Tints the world between phases: warm at the gate in the morning, plain in
## the afternoon, blue at night. A CanvasModulate touches the world canvas only,
## so the HUD and the panels over it stay readable.

const FADE := 0.7

const TINTS := {
	0: Color(1.00, 0.93, 0.82),
	1: Color(1.00, 1.00, 1.00),
	2: Color(0.46, 0.52, 0.74),
	3: Color(0.64, 0.56, 0.68),
}


func _ready() -> void:
	color = TINTS.get(Game.phase, Color.WHITE)
	Events.phase_changed.connect(_on_phase_changed)


func _on_phase_changed(phase: int) -> void:
	var target: Color = TINTS.get(phase, Color.WHITE)
	create_tween().tween_property(self, "color", target, FADE)
