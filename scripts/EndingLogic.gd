class_name EndingLogic
extends RefCounted

## Section 9: the Column, and which of its endings the run has earned.
##
## One branch the spec leaves open: handing the column over with the Crown
## below +2. Section 9 names an outcome only for Crown >= +2, but the choice is
## offered unconditionally, so a colder version of it resolves here rather than
## the run dead-ending on an outcome that does not exist.

## Section 9: shelter needs both stores to cover the column.
const SHELTER_FACTION_MIN := 2
const CROWN_REWARD_MIN := 2


static func column_size() -> int:
	return int(Data.ending().get("column_size", 12))


static func prompt() -> String:
	return str(Data.ending().get("prompt", ""))


## The three standing options, plus the fourth that a Gatehouse opens once the
## Crown has been alienated.
static func available_choices() -> Array:
	var out: Array = []
	for choice in Data.ending().get("choices", []):
		if choice.get("requires_gatehouse", false) and not Game.has_effect("gatehouse"):
			continue
		if choice.has("crown_below") and Factions.get_standing("crown") >= int(choice["crown_below"]):
			continue
		out.append(choice)
	return out


## Can the town actually feed and water twelve more people tonight?
static func can_support_column() -> bool:
	var size := column_size()
	return Game.food >= size and Game.water >= size


static func outcome_for(choice_id: String) -> String:
	match choice_id:
		"shelter":
			if Factions.get_standing("freeroad") >= SHELTER_FACTION_MIN and can_support_column():
				return "crossing_holds"
			return "long_night"
		"turn_away":
			return "road_moves_on"
		"hand_over":
			if Factions.get_standing("crown") >= CROWN_REWARD_MIN:
				return "loyal_subjects"
			return "loyal_subjects_cold"
		"close_gate":
			return "free_town"
	return "road_moves_on"


## Resolve the choice, apply what it costs, and hand back the epilogue.
static func resolve(choice_id: String) -> Dictionary:
	var id := outcome_for(choice_id)
	var outcome: Dictionary = Data.ending().get("outcomes", {}).get(id, {})
	Game.apply_effects(outcome.get("effects", {}))
	Events.ending.emit(id)
	return {
		"id": id,
		"title": str(outcome.get("title", "")),
		"text": str(outcome.get("text", "")),
	}
