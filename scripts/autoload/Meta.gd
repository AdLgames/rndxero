extends Node

## What survives a run: which endings have been reached, which recipes have been
## discovered, and which logs have been read. Section 11 -- the recipe book
## persisting is the main reason to start again.

const SAVE_PATH := "user://derelict_meta.json"

var endings: Dictionary = {}      ## ending id -> true
var discovered: Dictionary = {}   ## recipe id -> true
var archive: Dictionary = {}      ## log id -> true


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	load_meta()


func load_meta() -> void:
	if not FileAccess.file_exists(SAVE_PATH):
		return
	var file := FileAccess.open(SAVE_PATH, FileAccess.READ)
	if file == null:
		return
	var parsed = JSON.parse_string(file.get_as_text())
	file.close()
	if typeof(parsed) != TYPE_DICTIONARY:
		return
	endings = parsed.get("endings", {})
	discovered = parsed.get("discovered", {})
	archive = parsed.get("archive", {})


func save_meta() -> void:
	var file := FileAccess.open(SAVE_PATH, FileAccess.WRITE)
	if file == null:
		push_warning("Meta: cannot write %s" % SAVE_PATH)
		return
	file.store_string(JSON.stringify({
		"endings": endings, "discovered": discovered, "archive": archive,
	}, "\t"))
	file.close()


func discover(recipe_id: String) -> bool:
	if discovered.has(recipe_id):
		return false
	discovered[recipe_id] = true
	save_meta()
	return true


func remember_log(log_id: String) -> void:
	if archive.has(log_id):
		return
	archive[log_id] = true
	save_meta()


func record_ending(ending_id: String) -> void:
	endings[ending_id] = true
	save_meta()


## Section 11: each ending seeds the next run with something.
func starting_bonus() -> Array:
	var bonus: Array = []
	if endings.has("restore"):
		bonus.append("scrubber")
	if endings.has("escape"):
		bonus.append("fuel")
		bonus.append("fuel")
	return bonus


## Burn guarantees a Careful crew rather than a random trait.
func guaranteed_trait() -> String:
	if endings.has("burn"):
		return "careful"
	return ""


func archive_unlocked() -> bool:
	return endings.has("truth")


func clear() -> void:
	endings.clear()
	discovered.clear()
	archive.clear()
	save_meta()
