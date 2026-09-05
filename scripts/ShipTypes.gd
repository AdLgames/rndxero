class_name ShipTypes
extends RefCounted

## The three MVP ship classes (spec section 3). `size` is the capacity a ship
## consumes on a lane; `patience` is how long it will sit in a station queue
## before giving up and costing a point of reputation.

## Design speeds are small abstract numbers; this converts them to pixels per
## second against the 64x32 isometric grid.
const SPEED_SCALE := 32.0

const STATS := {
	"consumer": {
		"size": 1, "speed": 3.0, "pay": 5, "patience": 20.0,
		"sprite": "res://assets/ships/consumer.png",
	},
	"commercial": {
		"size": 2, "speed": 2.0, "pay": 15, "patience": 45.0,
		"sprite": "res://assets/ships/commercial.png",
	},
	"heavy": {
		"size": 4, "speed": 1.0, "pay": 50, "patience": 120.0,
		"sprite": "res://assets/ships/heavy.png",
	},
}

const ORDER := ["consumer", "commercial", "heavy"]


static func stats(ship_class: String) -> Dictionary:
	return STATS.get(ship_class, STATS["consumer"])
