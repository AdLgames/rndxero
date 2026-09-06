class_name Stack
extends RefCounted

## An ordered pile of cards at a position on the board. The bottom card is
## index 0; picking a card up takes it and everything above it.

const OFFSET_Y := 26.0

var cards: Array = []
var position: Vector2 = Vector2.ZERO
var progress: float = 0.0
var recipe_id: String = ""


func size() -> int:
	return cards.size()


func is_empty() -> bool:
	return cards.is_empty()


func top():
	return cards[cards.size() - 1] if not cards.is_empty() else null


func card_ids() -> Array:
	var ids: Array = []
	for card in cards:
		ids.append(card.card_id)
	return ids


## What the recipe table matches against: everything except the crew doing the
## work and any bench they are working on. A Workshop is a surface you stack
## onto, so counting it as an ingredient would stop every recipe matching.
func input_ids() -> Array:
	var ids: Array = []
	for card in cards:
		if Data.card_type(card.card_id) == "crew":
			continue
		if Data.card(card.card_id).has("craft_speed"):
			continue
		ids.append(card.card_id)
	ids.sort()
	return ids


func crew() -> Array:
	var out: Array = []
	for card in cards:
		if Data.card_type(card.card_id) == "crew":
			out.append(card)
	return out


func has_type(type: String) -> bool:
	for card in cards:
		if Data.card_type(card.card_id) == type:
			return true
	return false


func add(card) -> void:
	cards.append(card)
	card.stack = self


func remove(card) -> void:
	cards.erase(card)
	if card.stack == self:
		card.stack = null


## Split off `card` and everything above it into a new stack, for dragging.
func split_from(card) -> Stack:
	var index := cards.find(card)
	if index < 0:
		return null
	var taken := cards.slice(index)
	for c in taken:
		cards.erase(c)
	var other := Stack.new()
	other.position = position + Vector2(0, index * OFFSET_Y)
	for c in taken:
		other.add(c)
	reset_progress()
	return other


func absorb(other: Stack) -> void:
	for card in other.cards.duplicate():
		other.remove(card)
		add(card)
	reset_progress()


func reset_progress() -> void:
	progress = 0.0
	recipe_id = ""


## Where each card sits, so the pile fans downward and stays readable.
func layout() -> void:
	for i in cards.size():
		cards[i].position = position + Vector2(0, i * OFFSET_Y)


func rect(card_size: Vector2) -> Rect2:
	var height := card_size.y + maxf(0.0, cards.size() - 1) * OFFSET_Y
	return Rect2(position, Vector2(card_size.x, height))
