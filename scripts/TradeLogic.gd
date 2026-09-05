class_name TradeLogic
extends RefCounted

## The price table from section 8, plus the two bonuses that lift what the town
## can charge. Buying is always at the flat `buy` column: the bonuses reward
## selling, not haggling.

## Section 4: the Guild pays better once it is pleased with you.
const GUILD_SELL_BONUS := 0.20


static func buy_price(good: String) -> int:
	return Data.price(good, "buy")


## Base sell price lifted by the Guild's goodwill and whatever market you built.
static func sell_price(good: String) -> int:
	return int(round(Data.price(good, "sell") * sell_multiplier()))


static func sell_multiplier() -> float:
	var multiplier := 1.0
	if Factions.is_pleased("guild"):
		multiplier += GUILD_SELL_BONUS
	multiplier += Game.total_effect("sell_bonus")
	return multiplier


## A readable summary of where the multiplier comes from, for the trade panel.
static func bonus_summary() -> String:
	var parts: Array = []
	if Factions.is_pleased("guild"):
		parts.append("Guild +%d%%" % int(GUILD_SELL_BONUS * 100))
	var market := Game.total_effect("sell_bonus")
	if market > 0.0:
		parts.append("Market +%d%%" % int(round(market * 100)))
	if parts.is_empty():
		return "Base prices"
	return "Selling at " + ", ".join(parts)
