class_name HazardLogic
extends RefCounted

## Section 7. One hazard drifts in each cycle (two later), weighted by the
## deepest sector reached. A hazard left alone does its damage every cycle.


## Section 6's schedule: one a cycle, a coin-flip second from cycle 20, two from
## cycle 40.
static func hazards_this_cycle() -> int:
	var count := 1
	for step in Data.balance.get("hazards_per_cycle", []):
		if Game.cycle < int(step.get("from_cycle", 1)):
			continue
		count = int(step.get("count", 1))
		if step.has("extra_chance") and randf() < float(step["extra_chance"]):
			count += 1
	return count


static func drift(report: Dictionary) -> void:
	for i in hazards_this_cycle():
		var id := _roll()
		if id == "":
			continue
		Game.board.spawn(id, Game.board.free_position())
		report["events"].append("%s drifts in." % Data.card_name(id))
		Events.hazard_drifted.emit(id)


## Weights are per sector; anything whose requirement is unmet drops out and the
## rest are normalised over what is left.
static func _roll() -> String:
	var column := 0
	for s in Game.sectors_unlocked:
		column = maxi(column, int(s) - 1)
	column = clampi(column, 0, 4)

	var pool: Array = []
	var total := 0.0
	for id in Data.hazard_weights:
		var required := str(Data.hazard_requires.get(id, ""))
		if required != "" and not Game.board.has_card(required):
			continue
		var weights: Array = Data.hazard_weights[id]
		var weight := float(weights[column])
		if weight <= 0.0:
			continue
		pool.append({"id": id, "weight": weight})
		total += weight
	if total <= 0.0:
		return ""

	var roll := randf() * total
	for entry in pool:
		roll -= float(entry["weight"])
		if roll <= 0.0:
			return str(entry["id"])
	return str(pool[pool.size() - 1]["id"])


## What a hazard does when nobody is dealing with it. A crew card on the same
## stack counts as dealing with it.
static func apply_standing(report: Dictionary) -> void:
	for card in Game.board.cards_of_type("hazard"):
		var definition := Data.card(card.card_id)
		var ignored: Dictionary = definition.get("ignored", {})
		if ignored.is_empty():
			continue
		if Game.board.crew_on_stack_of(card).size() > 0:
			continue

		if ignored.has("o2"):
			if Game.board.has_breach_immunity():
				continue
			Game.add_o2(float(ignored["o2"]))
			report["events"].append("A breach is venting.")
		if ignored.get("destroys_module", false):
			var module = Game.board.module_on_stack_of(card)
			if module != null:
				report["events"].append("Fire took the %s." % module.display_name())
				Game.board.replace_card(module, "ruin")
		if ignored.get("injures_crew", false):
			var victim = Game.board.random_crew()
			if victim != null:
				CrewLogic.injure(victim)
				report["events"].append("%s was hurt by a drone." % victim.display_name())
		if ignored.get("infects_crew", false):
			for crew in Game.board.crew_on_stack_of(card):
				CrewLogic.infect(crew)
		if ignored.get("destroys_adjacent", false):
			for module in Game.board.modules_near(card, 2):
				report["events"].append("The meltdown took the %s." % module.display_name())
				Game.board.replace_card(module, "ruin")
			Game.board.remove_card(card)


## Signals fade and stowaways move on if the player leaves them.
static func age_transients(report: Dictionary) -> void:
	for card in Game.board.all_cards():
		var lifetime := int(Data.card(card.card_id).get("lifetime", 0))
		if lifetime <= 0:
			continue
		var age := int(card.state.get("age", 0)) + 1
		card.state["age"] = age
		if age < lifetime:
			continue
		report["events"].append("%s is gone." % card.display_name())
		Game.board.remove_card(card)
