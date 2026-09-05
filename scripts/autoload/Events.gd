extends Node

## Signal bus. Everything that wants to know about a game event connects here
## rather than reaching across the scene tree for the node that raised it.
##
## Signals for milestones not yet built are declared here so the contract is
## visible in one place, but nothing emits them yet.

signal phase_changed(phase)
signal day_started(day)
signal resource_changed(name, value)
signal goods_changed(goods)
signal faction_changed(name, value)
signal building_placed(id, plot)
signal building_upgraded(id, plot)
signal night_report(report)
signal toast(text, kind)
signal game_over(reason)

signal caravan_arrived(data)
signal caravan_resolved(data, outcome)
signal encounter_resolved(id, choice)

# --- M5 onward, not yet emitted ---
signal night_event(id)
signal rumor(text)
signal ending(id)
