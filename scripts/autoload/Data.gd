extends Node

## Loads every content file at startup and indexes it. Section 13: cards,
## recipes, packs, hazards and text are all data, so content grows without code.

const FILES := {
	"cards": "res://data/cards.json",
	"recipes": "res://data/recipes.json",
	"packs": "res://data/packs.json",
	"hazards": "res://data/hazards.json",
	"traits": "res://data/traits.json",
	"balance": "res://data/balance.json",
	"logs": "res://data/logs.json",
	"aria": "res://data/aria.json",
}

var cards: Dictionary = {}        ## id -> card definition
var recipes: Array = []
var recipes_by_id: Dictionary = {}
var sectors: Array = []
var hazard_weights: Dictionary = {}
var hazard_requires: Dictionary = {}
var traits: Dictionary = {}
var trait_ids: Array = []
var balance: Dictionary = {}
var logs: Array = []
var logs_by_id: Dictionary = {}
var aria_nodes: Dictionary = {}
var aria_roots: Array = []

var _documents: Dictionary = {}


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	for key in FILES:
		_documents[key] = _read(FILES[key])
	_index()


func _read(path: String) -> Dictionary:
	if not FileAccess.file_exists(path):
		push_error("Data: %s is missing" % path)
		return {}
	var file := FileAccess.open(path, FileAccess.READ)
	if file == null:
		push_error("Data: cannot open %s" % path)
		return {}
	var parsed = JSON.parse_string(file.get_as_text())
	file.close()
	if typeof(parsed) != TYPE_DICTIONARY:
		push_error("Data: %s is not a JSON object" % path)
		return {}
	return parsed


func _index() -> void:
	for entry in _documents.get("cards", {}).get("cards", []):
		cards[entry["id"]] = entry

	recipes = _documents.get("recipes", {}).get("recipes", [])
	for entry in recipes:
		recipes_by_id[entry["id"]] = entry

	sectors = _documents.get("packs", {}).get("sectors", [])

	var hazards := _documents.get("hazards", {})
	hazard_weights = hazards.get("weights", {})
	hazard_requires = hazards.get("requires", {})

	for entry in _documents.get("traits", {}).get("traits", []):
		traits[entry["id"]] = entry
		trait_ids.append(entry["id"])

	balance = _documents.get("balance", {})

	logs = _documents.get("logs", {}).get("logs", [])
	for entry in logs:
		logs_by_id[entry["id"]] = entry

	var aria := _documents.get("aria", {})
	aria_roots = aria.get("roots", [])
	for entry in aria.get("nodes", []):
		aria_nodes[entry["id"]] = entry


func card(id: String) -> Dictionary:
	return cards.get(id, {})


func card_name(id: String) -> String:
	return str(card(id).get("name", id))


func card_type(id: String) -> String:
	return str(card(id).get("type", ""))


func number(key: String, fallback: float = 0.0) -> float:
	return float(balance.get(key, fallback))


func sector(index: int) -> Dictionary:
	for entry in sectors:
		if int(entry.get("sector", 0)) == index:
			return entry
	return {}


func log_entry(id: String) -> Dictionary:
	return logs_by_id.get(id, {})


func trait_def(id: String) -> Dictionary:
	return traits.get(id, {})
