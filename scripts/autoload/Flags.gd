extends Node

## String flags set by encounter choices, read by later encounters to chain.
## Nothing writes to this before M4; it exists now so Game.reset() has one
## place to clear run state from.

var _set: Dictionary = {}


func has(flag: String) -> bool:
	return _set.has(flag)


func set_flag(flag: String) -> void:
	_set[flag] = true


func clear() -> void:
	_set.clear()


func all() -> Array:
	return _set.keys()
