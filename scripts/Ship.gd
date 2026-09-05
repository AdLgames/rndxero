class_name Ship
extends Node2D

## One vessel. Ships are spawned by a Station, wait in its queue, are pushed
## onto a Lane by the Dispatcher, and either reach their destination (payday)
## or run out of patience (reputation hit).
##
## References to Lane and Station are deliberately untyped: Ship, Lane and
## Station all point at each other, and mutually-referencing `class_name`
## scripts hit GDScript's cyclic type resolution.

enum State { QUEUED, TRANSIT, DOCKING, DONE }

var ship_class: String = "consumer"
var size: int = 1
var base_speed: float = 3.0
var pay: int = 5
var patience_left: float = 20.0

var origin_id: String = ""
var dest_id: String = ""

var path: Array = []             ## remaining lanes to traverse
var state: int = State.QUEUED
var current_station = null       ## Station, while queued or docking
var current_lane = null          ## Lane, while in transit
var travelled: float = 0.0       ## pixels along the current lane
var reversed: bool = false       ## travelling from station_b toward station_a

@onready var _sprite: Sprite2D = $Sprite


func setup(cls: String, origin: String, dest: String) -> void:
	ship_class = cls
	var s := ShipTypes.stats(cls)
	size = int(s["size"])
	base_speed = float(s["speed"])
	pay = int(s["pay"])
	patience_left = float(s["patience"]) + TechManager.patience_for(cls)
	origin_id = origin
	dest_id = dest
	if is_node_ready():
		_apply_sprite()


func _ready() -> void:
	_apply_sprite()


func _apply_sprite() -> void:
	var s := ShipTypes.stats(ship_class)
	var tex := load(s["sprite"])
	if tex != null:
		_sprite.texture = tex


## Pixels per second on the given lane, after tech and lane modifiers.
func speed_on(lane) -> float:
	return base_speed * ShipTypes.SPEED_SCALE * TechManager.ship_speed_mult * lane.speed_mult
