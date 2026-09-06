extends Node

## Signal bus. Systems announce here rather than reaching across the board.

signal cycle_started(cycle)
signal cycle_ended(report)
signal o2_changed(value)
signal slots_changed(used, total)
signal slots_exceeded(excess)
signal trait_choice_offered(card, options)
signal paused_changed(is_paused)

signal card_spawned(card)
signal card_removed(card)
signal recipe_discovered(recipe_id)
signal craft_completed(recipe_id, stack)

signal hazard_drifted(card_id)
signal pack_opened(pack_id, card_ids)

signal log_read(log_id)
signal aria_available()
signal aria_opened()

signal crew_died(card)
signal run_over(reason)
signal ending_reached(ending_id)

signal toast(text, kind)
