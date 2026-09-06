class_name CraftLogic
extends RefCounted

## Matching a pile against the recipe table, running the timer, and applying the
## result. Section 5 is the whole game; this is the part that reads it.

const CREW_RANDOM := "__crew_random__"
const CREW_CHOICE := "__crew_choice__"


## The recipe a stack currently satisfies, or an empty dictionary. Inputs match
## as an unordered multiset and must be exact -- an extra card means no recipe,
## which is what makes clearing a stack a deliberate act.
static func find(stack: Stack) -> Dictionary:
	var ids := stack.input_ids()
	if ids.is_empty():
		return {}
	var crew := stack.crew()

	var best := {}
	var best_score := -1
	for recipe in Data.recipes:
		if recipe.get("passive", false):
			continue
		var wanted: Array = recipe["inputs"].duplicate()
		wanted.sort()
		if wanted != ids:
			continue
		if bool(recipe.get("crew", true)):
			if crew.size() < int(recipe.get("crew_count", 1)):
				continue
		if not _gates_pass(recipe, stack):
			continue
		var score := 0
		if recipe.has("trait"):
			if not _has_trait(crew, str(recipe["trait"])):
				continue
			score = 1
		if recipe.has("role"):
			if not _has_role(crew, str(recipe["role"])):
				continue
			score = 2
		if score > best_score:
			best = recipe
			best_score = score
	return best


## Conditions beyond the ingredients: a sector you have not reached, a log that
## is already read, or a recipe that keeps its inputs and so would otherwise
## fire again the instant it finished.
static func _gates_pass(recipe: Dictionary, stack: Stack) -> bool:
	if recipe.has("requires_sector"):
		if not Game.sectors_unlocked.has(int(recipe["requires_sector"])):
			return false

	if recipe.get("effects", {}).get("read_log", false):
		var unread := false
		for card in stack.cards:
			if card.card_id == "log" and not card.state.get("read", false):
				unread = true
				break
		if not unread:
			return false

	if recipe.get("once_per_cycle", false):
		for card in stack.cards:
			if str(card.state.get("cooldown_recipe", "")) != str(recipe["id"]):
				continue
			if int(card.state.get("cooldown_cycle", -1)) == Game.cycle:
				return false
	return true


static func _has_trait(crew: Array, trait_id: String) -> bool:
	for card in crew:
		if str(card.state.get("trait", "")) == trait_id:
			return true
	return false


static func _has_role(crew: Array, role: String) -> bool:
	for card in crew:
		if str(Data.card(card.card_id).get("role", "")) == role:
			return true
	return false


## How fast this stack works: the best crew member on it, their role bonus for
## what is being built, and a Workshop underneath.
static func speed(stack: Stack, recipe: Dictionary) -> float:
	var best := 0.0
	for card in stack.crew():
		var rate := CrewLogic.work_speed(card)
		var definition := Data.card(card.card_id)
		for output in recipe.get("output", []):
			var bonus: Dictionary = definition.get("speed_bonus", {})
			if bonus.has(output):
				rate *= float(bonus[output])
		if recipe.get("effects", {}).has("read_log"):
			rate *= float(Data.trait_def(str(card.state.get("trait", ""))).get("log_speed", 1.0))
		best = maxf(best, rate)
	if best <= 0.0:
		return 0.0
	for card in stack.cards:
		best *= float(Data.card(card.card_id).get("craft_speed", 1.0))
	return best


## Advance a stack's work. Returns true when the recipe finished this frame.
static func tick(stack: Stack, delta: float) -> bool:
	var recipe := find(stack)
	if recipe.is_empty():
		stack.reset_progress()
		return false
	if str(recipe["id"]) != stack.recipe_id:
		stack.recipe_id = str(recipe["id"])
		stack.progress = 0.0

	var time := float(recipe.get("time", 0))
	if time <= 0.0:
		complete(stack, recipe)
		return true

	var rate := speed(stack, recipe)
	if rate <= 0.0:
		return false
	stack.progress += delta * rate
	if stack.progress < time:
		return false
	complete(stack, recipe)
	return true


static func fraction(stack: Stack) -> float:
	if stack.recipe_id == "":
		return 0.0
	var recipe: Dictionary = Data.recipes_by_id.get(stack.recipe_id, {})
	var time := float(recipe.get("time", 0))
	if time <= 0.0:
		return 0.0
	return clampf(stack.progress / time, 0.0, 1.0)


static func complete(stack: Stack, recipe: Dictionary) -> void:
	var at := stack.position
	var crew := stack.crew()

	# Consume the inputs the recipe does not keep.
	var kept: Array = recipe.get("keeps", []).duplicate()
	for card in stack.cards.duplicate():
		if Data.card_type(card.card_id) == "crew":
			continue
		var index := kept.find(card.card_id)
		if index >= 0:
			kept.remove_at(index)
			continue
		Game.board.remove_card(card)

	for output in recipe.get("output", []):
		_spawn_output(str(output), at)

	_apply_effects(recipe.get("effects", {}), crew, at, stack)

	if recipe.get("once_per_cycle", false):
		for card in stack.cards:
			card.state["cooldown_recipe"] = str(recipe["id"])
			card.state["cooldown_cycle"] = Game.cycle

	stack.reset_progress()
	if Meta.discover(str(recipe["id"])):
		Events.recipe_discovered.emit(str(recipe["id"]))
	Events.craft_completed.emit(str(recipe["id"]), stack)


static func _spawn_output(id: String, at: Vector2) -> void:
	if id == CREW_RANDOM or id == CREW_CHOICE:
		# Section 5 recipes 40 and 41: a Careful crew member vets the stowaway,
		# so the player picks from two traits instead of taking pot luck.
		var card = Game.board.spawn("salvager", Game.board.free_position_near(at))
		if id == CREW_CHOICE:
			Game.board.offer_trait_choice(card)
		return
	Game.board.spawn(id, Game.board.free_position_near(at))


static func _apply_effects(effects: Dictionary, crew: Array, at: Vector2, stack: Stack) -> void:
	if effects.is_empty():
		return

	if effects.has("o2"):
		Game.add_o2(float(effects["o2"]))
	if effects.has("feed_crew"):
		for card in crew:
			card.state["fed_until"] = Game.cycle + int(effects["feed_crew"])
	if effects.get("injure_crew", false) and not crew.is_empty():
		CrewLogic.injure(crew[0])
	if effects.has("injure_chance") and not crew.is_empty():
		if randf() < float(effects["injure_chance"]) and not _immune(crew[0]):
			CrewLogic.injure(crew[0])
			Events.toast.emit("%s was hurt." % crew[0].display_name(), "bad")
	if effects.get("infect_crew", false) and not crew.is_empty():
		CrewLogic.infect(crew[0])
	if effects.get("read_log", false):
		StoryLogic.read_log_on(stack, crew)
	if effects.get("open_aria", false):
		Events.aria_opened.emit()
	if effects.has("open_pack"):
		PackLogic.open(str(effects["open_pack"]), at)
	if effects.has("use_location"):
		Game.board.use_location(str(effects["use_location"]), at)
	if effects.get("repair_ruin", false):
		Game.board.repair_ruin(stack, at)
	if effects.has("ending"):
		EndingLogic.reach(str(effects["ending"]))


static func _immune(card) -> bool:
	return bool(Data.trait_def(str(card.state.get("trait", ""))).get("never_accident", false))
