extends CanvasLayer

## Shown when reputation runs out. The season's ending proper is M6; this is the
## run failing before it gets there.

@onready var _panel: PanelContainer = $Panel
@onready var _reason: Label = $Panel/Margin/Layout/Reason
@onready var _summary: Label = $Panel/Margin/Layout/Summary


func _ready() -> void:
	$Panel/Margin/Layout/Restart.pressed.connect(_restart)
	close()


func show_over(reason: String) -> void:
	_reason.text = reason
	_summary.text = "Ashford Crossing stood for %d day%s. %d coin in the box, %d building%s on the road." % [
		Game.day, "" if Game.day == 1 else "s",
		Game.coin, _built(), "" if _built() == 1 else "s"]
	_panel.show()


func close() -> void:
	_panel.hide()


func is_open() -> bool:
	return _panel.visible


func _built() -> int:
	var count := 0
	for plot in Game.plots:
		if plot != null:
			count += 1
	return count


func _restart() -> void:
	get_tree().reload_current_scene()
