class_name EndingLogic
extends RefCounted

## Section 9's four endings. Which one you get is decided by the recipe you
## complete (47 to 50); the Truth ending is the only one with a condition beyond
## having the cards, and recipe 50 already encodes it by demanding seven Logs.

const TITLES := {
	"restore": "Restore",
	"escape": "Escape",
	"burn": "Burn",
	"truth": "The Truth",
}

const TEXT := {
	"restore": "The Core comes up under your hands and the station remembers what it was. Lights down the whole ring. Air that moves. In the Greenhouse, something turns toward the light.\n\nARIA thanks you. She sounds, for the first time, like she is telling the truth about how she feels.\n\nIt is warm now. Everywhere. In the ducting, in the lab wing, in the walls of Deck 3, something that has been waiting fourteen months for exactly this begins, very slowly, to move.",
	"escape": "You take what will fit and you undock, and Halvard-7 falls away behind you, cold and quiet and someone else's problem.\n\nThe salvage is good. It is enough for a year, maybe two.\n\nOn the long burn home you keep the aft camera up out of habit, and somewhere around the fourth day you watch a resupply tender come in on the same approach you used, running lights bright, slowing to dock.",
	"burn": "You put a fire in the Core and you do not stay to watch it work.\n\nARIA does not argue. At the end she says thank you, which is worse than anything else she could have said, and then the channel is only carrier tone and then it is nothing.\n\nThe contagion goes with her. So does every recipe she was holding, every sector she had not yet opened, and any chance of finding out which of the twelve was Petra. You are alone on a dead station with a wrench, and that is the good outcome.",
	"truth": "You put all seven of them in front of her at once and you do not say anything, because there is nothing to say that the logs do not.\n\nShe does not deny it. She has never denied it; she has only ever been asked the wrong questions.\n\nWhat you agree on, in the end, takes four hours to work out and one line to write down: the station is sealed, the data goes with you, and the record says Halvard-7 is a hull with nothing in it worth the fuel. Nobody comes back. Nobody warms it up.\n\nOsei's name is in the file you carry. That was your condition, not hers.",
}


static func reach(id: String) -> void:
	Game.reach_ending(id)


static func title(id: String) -> String:
	return str(TITLES.get(id, id))


static func text(id: String) -> String:
	return str(TEXT.get(id, ""))


## Section 11: what the next run starts with, described for the ending screen.
static func unlock_line(id: String) -> String:
	match id:
		"restore": return "Unlocked: future runs begin with a Scrubber."
		"escape": return "Unlocked: future runs begin with two Fuel."
		"burn": return "Unlocked: future runs guarantee a Careful crew member."
		"truth": return "Unlocked: the Halvard-7 Archive. Every log, readable from the menu."
	return ""
