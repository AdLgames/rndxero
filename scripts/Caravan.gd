extends Node2D

## A caravan on the road: walks in from the left, parks at the gate while the
## player deals with it, then walks off. Holds its data but decides nothing --
## CaravanQueue owns the outcome.

signal arrived

const WALK_SPEED := 190.0
const BOB_HEIGHT := 1.5
const BOB_RATE := 9.0

enum Motion { IDLE, ARRIVING, LEAVING }

const WAGONS := {
	"guild": "res://assets/caravans/wagon_guild.png",
	"crown": "res://assets/caravans/wagon_crown.png",
	"freeroad": "res://assets/caravans/wagon_freeroad.png",
}

var data: Dictionary = {}

var _motion: int = Motion.IDLE
var _target_x: float = 0.0
var _bob: float = 0.0

@onready var _wagon: Sprite2D = $Wagon
@onready var _horse: Sprite2D = $Horse
@onready var _figure: Sprite2D = $Figure


func setup(caravan: Dictionary) -> void:
	data = caravan
	if not is_node_ready():
		await ready
	var faction: String = caravan.get("faction", "guild")
	var texture := load(WAGONS.get(faction, WAGONS["guild"]))
	if texture != null:
		_wagon.texture = texture
	# Animals pull the wagon; a caravan travelling on foot has none to show.
	_horse.visible = int(caravan.get("animals", 0)) > 0


func arrive_at(x: float) -> void:
	_target_x = x
	_motion = Motion.ARRIVING


func depart() -> void:
	_target_x = position.x + 1200.0
	_motion = Motion.LEAVING


func _process(delta: float) -> void:
	if _motion == Motion.IDLE:
		return

	position.x = move_toward(position.x, _target_x, WALK_SPEED * delta)

	# A little vertical bob sells the walk without needing animation frames.
	_bob += delta * BOB_RATE
	var lift := sin(_bob) * BOB_HEIGHT
	_wagon.position.y = -44.0 + lift
	_figure.position.y = -28.0 - lift

	if not is_equal_approx(position.x, _target_x):
		return

	if _motion == Motion.ARRIVING:
		_motion = Motion.IDLE
		arrived.emit()
	else:
		queue_free()
