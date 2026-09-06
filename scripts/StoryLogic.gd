class_name StoryLogic
extends RefCounted

## Section 9. Signals decode into Logs, Logs are read, and enough of them bring
## ARIA out. Which log a card carries is decided when the card is created, so a
## run never hands you the same one twice while others are unseen.


## Pick the next unseen log, in the order section 9 paces them.
static func assign_log(card) -> void:
	var unseen: Array = []
	for entry in Data.logs:
		if Game.logs_read.has(entry["id"]):
			continue
		if Game.board.has_log(str(entry["id"])):
			continue
		unseen.append(entry)
	if unseen.is_empty():
		unseen = Data.logs
	# Weight toward the earliest unread so the mystery unfolds in order rather
	# than arriving as twelve unordered fragments.
	unseen.sort_custom(func(a, b): return int(a["n"]) < int(b["n"]))
	var window := mini(3, unseen.size())
	card.state["log_id"] = str(unseen[randi() % window]["id"])


static func read_log_on(stack: Stack, crew: Array) -> void:
	for card in stack.cards:
		if card.card_id != "log":
			continue
		if card.state.get("read", false):
			continue
		read(card, crew)
		return


static func read(card, crew: Array) -> void:
	var id := str(card.state.get("log_id", ""))
	if id == "":
		return
	card.state["read"] = true
	Game.logs_read[id] = true
	Meta.remember_log(id)

	# A Curious reader surfaces the extra line.
	var bonus := false
	for member in crew:
		if bool(Data.trait_def(str(member.state.get("trait", ""))).get("log_bonus_clue", false)):
			bonus = true
			break
	Events.log_read.emit(id)
	Events.toast.emit("Log read: %s" % Data.log_entry(id).get("title", ""), "info")
	if bonus:
		Events.toast.emit(str(Data.log_entry(id).get("clue", "")), "info")


static func logs_read_count() -> int:
	return Game.logs_read.size()


static func aria_ready() -> bool:
	return logs_read_count() >= int(Data.number("logs_for_aria", 3))


## Which root ARIA opens on: she gives less away until you have read enough to
## catch her at it.
static func aria_root() -> String:
	var read := logs_read_count()
	if read >= int(Data.number("logs_for_truth", 7)):
		return "root_late"
	if read >= 4:
		return "root_mid"
	return "root_early"
