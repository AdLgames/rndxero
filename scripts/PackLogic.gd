class_name PackLogic
extends RefCounted

## Section 8. A pack spawns four to six cards, each rolled against the rarity
## split in balance.json.


static func open(pack_id: String, at: Vector2) -> Array:
	var definition := Data.card(pack_id)
	var sector := Data.sector(int(definition.get("sector", 1)))
	if sector.is_empty():
		return []

	var spawned: Array = []
	for i in randi_range(4, 6):
		var id := _draw(sector)
		if id == "":
			continue
		Game.board.spawn(id, Game.board.free_position_near(at))
		spawned.append(id)

	# A Hoarder aboard turns up an extra ration in every pack.
	for crew in Game.board.cards_of_type("crew"):
		if str(crew.state.get("trait", "")) == "hoarder":
			var extra := int(Data.trait_def("hoarder").get("pack_bonus_rations", 0))
			for i in extra:
				Game.board.spawn("rations", Game.board.free_position_near(at))
				spawned.append("rations")
			break

	Events.pack_opened.emit(pack_id, spawned)
	return spawned


static func _draw(sector: Dictionary) -> String:
	var rarity: Dictionary = Data.balance.get("pack_rarity", {})
	var roll := randf()
	var band := "common"
	if roll > float(rarity.get("common", 0.6)) + float(rarity.get("uncommon", 0.3)):
		band = "rare"
	elif roll > float(rarity.get("common", 0.6)):
		band = "uncommon"

	var pool: Array = sector.get(band, [])
	if pool.is_empty():
		pool = sector.get("common", [])
	if pool.is_empty():
		return ""
	return str(pool[randi() % pool.size()])
