class_name Board
extends Control

## The board: every card lives here as a child, grouped into stacks. Owns
## dragging, stack merging, and the per-frame craft tick.
##
## Section 1's pillar is one verb. Everything below exists so that dragging a
## card onto a card is the only thing the player ever does.

const CARD_SCENE := preload("res://scenes/Card.tscn")
const SPAWN_MARGIN := 24.0

var stacks: Array = []

var _dragging: Stack = null
var _drag_offset: Vector2 = Vector2.ZERO


func _ready() -> void:
	Game.board = self
	mouse_filter = Control.MOUSE_FILTER_STOP


func _process(delta: float) -> void:
	if Game.paused or Game.over:
		return
	for stack in stacks.duplicate():
		if stack.is_empty():
			continue
		CraftLogic.tick(stack, delta)
	_prune()


# --- queries ----------------------------------------------------------------

func all_cards() -> Array:
	var out: Array = []
	for stack in stacks:
		for card in stack.cards:
			out.append(card)
	return out


func cards_of_type(type: String) -> Array:
	var out: Array = []
	for card in all_cards():
		if Data.card_type(card.card_id) == type:
			out.append(card)
	return out


func has_card(id: String) -> bool:
	for card in all_cards():
		if card.card_id == id:
			return true
	return false


func has_log(log_id: String) -> bool:
	for card in all_cards():
		if card.card_id == "log" and str(card.state.get("log_id", "")) == log_id:
			return true
	return false


## Recipe 10: an Atmosphere Core holds pressure whatever else is open.
func has_breach_immunity() -> bool:
	for card in cards_of_type("module"):
		if Data.card(card.card_id).get("immune_breach", false):
			return true
	return false


func crew_on_stack_of(card) -> Array:
	if card.stack == null:
		return []
	return card.stack.crew()


func module_on_stack_of(card):
	if card.stack == null:
		return null
	for other in card.stack.cards:
		if Data.card_type(other.card_id) == "module":
			return other
	return null


## Modules within `radius` card widths, for the meltdown's blast.
func modules_near(card, radius: int) -> Array:
	var out: Array = []
	var origin := card.stack_position()
	var reach := Card.SIZE.x * radius
	for module in cards_of_type("module"):
		if module.stack_position().distance_to(origin) <= reach:
			out.append(module)
	return out


func random_crew():
	var crew := cards_of_type("crew")
	if crew.is_empty():
		return null
	return crew[randi() % crew.size()]


# --- mutation ---------------------------------------------------------------

func spawn(card_id: String, at: Vector2):
	var card = CARD_SCENE.instantiate()
	add_child(card)
	card.setup(card_id)
	_initialise(card)

	var stack := Stack.new()
	stack.position = at
	stack.add(card)
	stacks.append(stack)
	stack.layout()
	Events.card_spawned.emit(card)
	_announce_slots()
	return card


## Per-instance state a card needs the moment it exists.
func _initialise(card) -> void:
	var definition := Data.card(card.card_id)
	match Data.card_type(card.card_id):
		"crew":
			var trait_id := Meta.guaranteed_trait()
			if trait_id == "" or has_card("salvager"):
				trait_id = Data.trait_ids[randi() % Data.trait_ids.size()]
			card.state["trait"] = trait_id
			var start := int(Data.trait_def(trait_id).get("morale_start", Data.number("morale_start", 6)))
			card.state["morale"] = start
			card.state["fed_until"] = Game.cycle + int(Data.number("rations_interval", 3))
		"module":
			# Section 8: the shuttles are what put the deeper sectors in reach.
			for sector in definition.get("unlocks_sectors", []):
				if not Game.sectors_unlocked.has(int(sector)):
					Game.sectors_unlocked.append(int(sector))
					Events.toast.emit("Sector %d is in range." % int(sector), "good")
		"location":
			card.state["uses"] = int(definition.get("uses", 3))
		"story":
			if card.card_id == "log":
				StoryLogic.assign_log(card)
	card.refresh()


func remove_card(card) -> void:
	if card.stack != null:
		card.stack.remove(card)
	Events.card_removed.emit(card)
	card.queue_free()
	_announce_slots()


func replace_card(card, new_id: String) -> void:
	var at := card.stack_position()
	var was := card.card_id
	remove_card(card)
	var replacement = spawn(new_id, free_position_near(at))
	# A ruin remembers what it used to be, so an Engineer can put it back.
	if new_id == "ruin":
		replacement.state["was"] = was
		replacement.refresh()


## Recipe repair_ruin: rebuild whatever the ruin was, or fall back to scrap if
## the wreckage has no memory of it.
func repair_ruin(stack: Stack, at: Vector2) -> void:
	for card in stack.cards:
		if card.card_id != "ruin":
			continue
		var was := str(card.state.get("was", ""))
		remove_card(card)
		spawn(was if was != "" else "scrap", free_position_near(at))
		return


## Take one card of `id` off the same stack as `card`, if there is one. This is
## how a Generator finds its fuel and a crew member finds their rations.
func consume_from_stack(card, id: String) -> bool:
	if card.stack == null:
		return false
	for other in card.stack.cards:
		if other.card_id == id:
			remove_card(other)
			return true
	return false


## A location yields one card and spends a use; at zero uses it breaks up.
func use_location(location_id: String, at: Vector2) -> void:
	for card in cards_of_type("location"):
		if card.card_id != location_id:
			continue
		var definition := Data.card(location_id)
		var yields: Array = definition.get("yields", [])
		if not yields.is_empty():
			spawn(str(yields[randi() % yields.size()]), free_position_near(at))
		var left := int(card.state.get("uses", 3)) - 1
		card.state["uses"] = left
		card.refresh()
		if left <= 0:
			Events.toast.emit("The %s is stripped." % card.display_name(), "info")
			remove_card(card)
		return


func offer_trait_choice(card) -> void:
	var options: Array = []
	while options.size() < 2:
		var pick := str(Data.trait_ids[randi() % Data.trait_ids.size()])
		if not options.has(pick):
			options.append(pick)
	Events.trait_choice_offered.emit(card, options)


# --- board space ------------------------------------------------------------

func slot_capacity() -> int:
	var total := int(Data.number("board_slots_base", 12))
	for card in all_cards():
		total += int(Data.card(card.card_id).get("slots", 0))
	return mini(total, int(Data.number("board_slots_max", 48)))


func _announce_slots() -> void:
	Events.slots_changed.emit(all_cards().size(), slot_capacity())


## Section 3: cards over the limit are ejected at cycle end, and the player
## picks which. Board only reports the excess; the prompt does the choosing.
func enforce_slot_limit(report: Dictionary) -> void:
	var excess := all_cards().size() - slot_capacity()
	if excess <= 0:
		return
	report["events"].append("The manifest is over capacity by %d." % excess)
	Events.slots_exceeded.emit(excess)


# --- placement --------------------------------------------------------------

func free_position() -> Vector2:
	return free_position_near(Vector2(size.x * 0.5, size.y * 0.5))


## Spiral outward from a point until the space is clear, so spawned cards never
## land exactly on top of something.
func free_position_near(at: Vector2) -> Vector2:
	var step := Card.SIZE + Vector2(SPAWN_MARGIN, SPAWN_MARGIN)
	for ring in 12:
		for i in maxi(1, ring * 8):
			var angle := TAU * float(i) / float(maxi(1, ring * 8))
			var candidate := at + Vector2(cos(angle), sin(angle)) * ring * step.x * 0.6
			candidate = _clamp_to_board(candidate)
			if _is_clear(candidate):
				return candidate
	return _clamp_to_board(at)


func _clamp_to_board(at: Vector2) -> Vector2:
	return Vector2(
		clampf(at.x, 8.0, maxf(8.0, size.x - Card.SIZE.x - 8.0)),
		clampf(at.y, 8.0, maxf(8.0, size.y - Card.SIZE.y - 8.0)))


func _is_clear(at: Vector2) -> bool:
	var probe := Rect2(at, Card.SIZE)
	for stack in stacks:
		if stack.rect(Card.SIZE).intersects(probe):
			return false
	return true


func _prune() -> void:
	for stack in stacks.duplicate():
		if stack.is_empty():
			stacks.erase(stack)


# --- dragging ---------------------------------------------------------------

func _gui_input(event: InputEvent) -> void:
	if event is InputEventMouseButton:
		var mb := event as InputEventMouseButton
		if mb.button_index != MOUSE_BUTTON_LEFT:
			return
		if mb.pressed:
			_begin_drag(mb.position)
		else:
			_end_drag(mb.position)
	elif event is InputEventMouseMotion and _dragging != null:
		_dragging.position = _clamp_to_board((event as InputEventMouseMotion).position - _drag_offset)
		_dragging.layout()


func _begin_drag(at: Vector2) -> void:
	var hit = _card_at(at)
	if hit == null:
		return
	# A Hoarder will not let go of the pile they are standing on.
	if _hoarder_blocks(hit):
		Events.toast.emit("They will not let go of it.", "bad")
		return

	var source: Stack = hit.stack
	var taken := source.split_from(hit)
	if taken == null:
		return
	stacks.append(taken)
	_dragging = taken
	_drag_offset = at - taken.position
	_bring_to_front(taken)


func _hoarder_blocks(card) -> bool:
	if card.stack == null:
		return false
	if Data.card_type(card.card_id) == "crew":
		return false
	for crew in card.stack.crew():
		if bool(Data.trait_def(str(crew.state.get("trait", ""))).get("holds_resources", false)):
			return true
	return false


func _end_drag(at: Vector2) -> void:
	if _dragging == null:
		return
	var target := _stack_under(at, _dragging)
	if target != null:
		target.absorb(_dragging)
		stacks.erase(_dragging)
		target.layout()
		_bring_to_front(target)
	else:
		_dragging.layout()
	_dragging = null
	_prune()


## Topmost card at a point, searching front to back.
func _card_at(at: Vector2):
	for i in range(get_child_count() - 1, -1, -1):
		var child = get_child(i)
		if not (child is Card):
			continue
		if child.stack == null:
			continue
		if child.card_rect().has_point(at):
			return child
	return null


func _stack_under(at: Vector2, ignore: Stack) -> Stack:
	for i in range(get_child_count() - 1, -1, -1):
		var child = get_child(i)
		if not (child is Card):
			continue
		if child.stack == null or child.stack == ignore:
			continue
		if child.card_rect().has_point(at):
			return child.stack
	return null


func _bring_to_front(stack: Stack) -> void:
	for card in stack.cards:
		move_child(card, get_child_count() - 1)
