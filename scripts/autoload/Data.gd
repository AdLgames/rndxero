extends Node

## Loads the JSON content at startup. Everything the game shows or balances
## lives in data/, so content scales without touching code.
##
## Every content file now exists. A missing one is reported and left as an
## empty collection rather than crashing, so a half-built content set still
## runs and the game degrades to whatever data it does have.

const FILES := {
	"buildings": "res://data/buildings.json",
	"prices": "res://data/prices.json",
	"caravans": "res://data/caravans.json",
	"encounters": "res://data/encounters.json",
	"night_events": "res://data/night_events.json",
	"rumors": "res://data/rumors.json",
	"ending": "res://data/ending.json",
}

## Files whose absence is expected at this milestone, so it is not worth a warning.
const NOT_YET_WRITTEN := []

var buildings: Array = []
var buildings_by_id: Dictionary = {}
var caravans: Array = []
var encounters_by_id: Dictionary = {}
var goods_order: Array = []
var prices: Dictionary = {}
var night_events: Array = []
var rumors: Array = []
var plot_count: int = 12
var base_lodging: int = 2

var _documents: Dictionary = {}


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	for key in FILES:
		var doc := _read(FILES[key], key)
		if not doc.is_empty():
			_documents[key] = doc
	_index_buildings()
	caravans = document("caravans").get("caravans", [])
	for entry in document("encounters").get("encounters", []):
		encounters_by_id[entry["id"]] = entry
	var price_doc := document("prices")
	goods_order = price_doc.get("order", [])
	prices = price_doc.get("goods", {})
	night_events = document("night_events").get("events", [])
	rumors = document("rumors").get("rumors", [])


func document(key: String) -> Dictionary:
	return _documents.get(key, {})


func _read(path: String, key: String) -> Dictionary:
	if not FileAccess.file_exists(path):
		if not NOT_YET_WRITTEN.has(key):
			push_warning("Data: %s is missing" % path)
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


func _index_buildings() -> void:
	var doc := document("buildings")
	if doc.is_empty():
		push_error("Data: no buildings loaded; the build menu will be empty")
		return
	buildings = doc.get("buildings", [])
	plot_count = int(doc.get("plot_count", 12))
	base_lodging = int(doc.get("base_lodging", 2))
	buildings_by_id.clear()
	for entry in buildings:
		buildings_by_id[entry["id"]] = entry
		# Upgrades are addressable by id too, so a placed plot can name either
		# state without the caller knowing which tier it is.
		if entry.has("upgrade"):
			buildings_by_id[entry["upgrade"]["id"]] = entry["upgrade"]


## The definition for whatever is standing on a plot, base or upgraded.
func definition(id: String) -> Dictionary:
	return buildings_by_id.get(id, {})


func encounter(id: String) -> Dictionary:
	return encounters_by_id.get(id, {})


func ending() -> Dictionary:
	return document("ending")


func night_event(id: String) -> Dictionary:
	for entry in night_events:
		if entry["id"] == id:
			return entry
	return {}


func price(good: String, column: String) -> int:
	return int(prices.get(good, {}).get(column, 0))
