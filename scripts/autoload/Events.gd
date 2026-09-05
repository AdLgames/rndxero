extends Node

## Signal bus. Everything that wants to know about a game event connects here
## rather than reaching across the scene tree for the node that raised it.

signal ship_spawned(ship)
signal ship_delivered(ship)
signal ship_abandoned(ship)
signal collision(a, b, lane)

signal day_passed(day)
signal tech_unlocked(id)

signal credits_changed(credits)
signal rep_changed(rep)
signal speed_changed(speed)

signal lane_built(lane)
signal game_over(day)
signal toast(text, kind)
