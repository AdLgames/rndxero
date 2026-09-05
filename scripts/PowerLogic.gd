class_name PowerLogic
extends RefCounted

## Generators and the Reactor supply power; the tech-tier modules need it.
##
## The GDD says a Generator "powers 3 modules" without ever saying which modules
## require power. Requiring it of everything would strand a new run, since the
## Scrubber is built long before any generator, so `needs_power` is set only on
## the tier-2 and prototype modules in cards.json. Life support never needs it.


static func supply() -> int:
	var total := 0
	for card in Game.board.cards_of_type("module"):
		var definition := Data.card(card.card_id)
		if not definition.has("power"):
			continue
		if card.state.get("offline", false):
			continue
		total += int(definition["power"])
	return total


## Powered in board order up to the supply, so the player can see which module
## drops off when a generator runs dry.
static func powered_modules() -> Dictionary:
	var budget := supply()
	var powered := {}
	for card in Game.board.cards_of_type("module"):
		if not Data.card(card.card_id).get("needs_power", false):
			continue
		if budget <= 0:
			continue
		powered[card] = true
		budget -= 1
	return powered


## Per-cycle upkeep for a power module: a Generator burns fuel, a Reactor that
## goes uncooled long enough melts down (recipe 42).
static func tick_module(card, report: Dictionary) -> void:
	var definition := Data.card(card.card_id)

	if definition.has("fuel_interval"):
		var due := int(card.state.get("fuel_due", 0))
		if due <= 0:
			card.state["fuel_due"] = int(definition["fuel_interval"])
		else:
			card.state["fuel_due"] = due - 1
			if due - 1 <= 0:
				if Game.board.consume_from_stack(card, "fuel"):
					card.state["fuel_due"] = int(definition["fuel_interval"])
					card.state["offline"] = false
				else:
					card.state["offline"] = true
					report["events"].append("The Generator is out of fuel.")

	if definition.get("needs_coolant", false):
		if Game.board.consume_from_stack(card, "coolant"):
			card.state["dry_cycles"] = 0
			return
		var dry := int(card.state.get("dry_cycles", 0)) + 1
		card.state["dry_cycles"] = dry
		var limit := int(Data.number("reactor_meltdown_cycles", 3))
		if dry >= limit:
			card.state["dry_cycles"] = 0
			Game.board.spawn("meltdown", card.stack_position())
			report["events"].append("The Reactor is running dry.")
