class_name CrewLogic
extends RefCounted

## Breathing, eating, morale and the relationships in section 10.


static func breathe(report: Dictionary) -> void:
	var crew := Game.board.cards_of_type("crew")
	var draw := crew.size() * Data.number("o2_per_crew", 1.0)
	if draw > 0.0:
		Game.add_o2(-draw)
		report["o2_drawn"] = draw


static func upkeep(report: Dictionary) -> void:
	var crew := Game.board.cards_of_type("crew")
	_feed(crew, report)
	_morale(crew, report)
	_relationships(crew, report)


## Section 6: a ration lasts three cycles. Recipe 15 tops a crew member up; this
## only notices when they have gone past it.
static func _feed(crew: Array, report: Dictionary) -> void:
	for card in crew:
		if int(card.state.get("fed_until", 0)) >= Game.cycle:
			continue
		if Game.board.consume_from_stack(card, "rations"):
			card.state["fed_until"] = Game.cycle + int(Data.number("rations_interval", 3))
			continue
		adjust_morale(card, -1)
		report["events"].append("%s is hungry." % card.display_name())


static func _morale(crew: Array, report: Dictionary) -> void:
	var beds := 0
	for module in Game.board.cards_of_type("module"):
		beds += int(Data.card(module.card_id).get("houses", 0))
	var housed := 0

	for card in crew:
		housed += 1
		if housed > beds:
			adjust_morale(card, -1)
		if card.state.get("infected", false):
			adjust_morale(card, -1)
			report["events"].append("%s is worsening." % card.display_name())
		if card.state.get("grief_until", 0) > Game.cycle:
			card.state["morale"] = 0

		# Steady lifts whoever shares their stack.
		if _trait_of(card) == "steady":
			for mate in Game.board.crew_on_stack_of(card):
				if mate != card:
					adjust_morale(mate, int(Data.trait_def("steady").get("adjacent_morale", 1)))

		# Haunted takes it badly near ARIA.
		if _trait_of(card) == "haunted" and Game.aria_present:
			adjust_morale(card, int(Data.trait_def("haunted").get("aria_morale", -1)))


## Section 10: two crew sharing a stack for a whole cycle form a Bond or a
## Friction, depending on their traits. Recorded on both cards so the board can
## draw the line between them.
static func _relationships(crew: Array, report: Dictionary) -> void:
	for card in crew:
		var mates := Game.board.crew_on_stack_of(card)
		var partner = null
		for mate in mates:
			if mate != card:
				partner = mate
				break
		if partner == null:
			card.state["together_with"] = null
			continue
		if card.state.get("together_with") != partner:
			card.state["together_with"] = partner
			continue
		if card.state.get("bonded_to") == partner:
			continue

		var a := _trait_of(card)
		var b := _trait_of(partner)
		if a == b:
			card.state["bonded_to"] = partner
			partner.state["bonded_to"] = card
			adjust_morale(card, 1)
			adjust_morale(partner, 1)
			report["events"].append("%s and %s have found something in common." % [
				card.display_name(), partner.display_name()])
		elif (a == "careful" and b == "reckless") or (a == "reckless" and b == "careful"):
			card.state["friction_with"] = partner
			partner.state["friction_with"] = card
			adjust_morale(card, -1)
			adjust_morale(partner, -1)
			report["events"].append("%s and %s are not getting on." % [
				card.display_name(), partner.display_name()])
		elif a == "haunted":
			adjust_morale(card, 1)
		elif b == "haunted":
			adjust_morale(partner, 1)


## A bonded partner takes a death hard; Steady does not.
static func mourn(dead) -> void:
	for card in Game.board.cards_of_type("crew"):
		if card == dead:
			continue
		if _trait_of(card) == "steady":
			continue
		if card.state.get("bonded_to") == dead:
			card.state["grief_until"] = Game.cycle + 3
			card.state["morale"] = 0


static func adjust_morale(card, amount: int) -> void:
	var low := int(Data.number("morale_min", 0))
	var high := int(Data.number("morale_max", 10))
	card.state["morale"] = clampi(int(card.state.get("morale", 6)) + amount, low, high)


static func injure(card) -> void:
	card.state["injured"] = true


static func infect(card) -> void:
	card.state["infected"] = true


## Section 6: an injured crew member works at half speed, and morale zero means
## they down tools for a cycle.
static func work_speed(card) -> float:
	if int(card.state.get("morale", 6)) <= 0:
		return 0.0
	var speed := float(Data.trait_def(_trait_of(card)).get("work_speed", 1.0))
	if card.state.get("injured", false):
		speed *= Data.number("injured_speed", 0.5)
	return speed


static func _trait_of(card) -> String:
	return str(card.state.get("trait", ""))
