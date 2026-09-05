# ASHFORD CROSSING — MVP Spec

Small-scale town management game. Low fantasy, cozy with dark edges. Isometric-free: side-view pixel art on a single horizontal road strip. Godot 4.3+, GDScript.

Goal of MVP: a 10-day season that is fun for 30–45 minutes, with the full daily loop, 6 buildings, 3 caravan types, 3 factions, and one ending event. Everything data-driven so content scales without new code.

---

## 1. Pitch

You run Ashford Crossing, a ford town on the only road between the highlands and the plains. Caravans arrive each morning with goods and problems. You set tolls, trade, build, and decide who gets to stay. The town grows along the road as a single side-scrolling scene. After 10 days, something comes down the road, and the town you built either holds or doesn't.

**Feel:** Stardew warmth, Kingdom dread. Regulars you recognize, rumors that turn into refugees.

---

## 2. MVP Scope

### In
- One side-view road strip, 12 building plots, scrolls horizontally
- 5 resources: **Coin, Food, Water, Lodging, Reputation**
- 3 factions with an opinion meter each: **Guild, Crown, Free Road**
- 3 caravan types (one per faction), ~30 hand-written encounters in JSON
- Toll setting (per caravan), trade (buy/sell with simple price table), turn away
- 6 buildings, each with one upgrade
- Day structure: Morning (caravans) → Build → Night (report + event)
- 10-day season with escalating rumors and one ending event (Free Road refugee column) with 3 outcomes
- Save nothing; a run is one sitting

### Out (post-MVP)
- Settlers / townsfolk with skills
- Magic items and magical residents
- Festivals, marriages, the dog
- Multiple seasons, branching endings
- Save/load, sound, music

---

## 3. Resources

| Resource | Start | Notes |
|---|---|---|
| Coin | 50 | Currency. Tolls, trade, building. |
| Food | 20 | Consumed nightly: 1 per lodged guest + 2 base. Buy from caravans or Farm. |
| Water | 20 | Consumed nightly: 1 per lodged guest + 1 per animal. Well replenishes. |
| Lodging | 2 | Capacity, not a stock. Caravans need beds to stay overnight and trade fully. |
| Reputation | 5 (max 10) | Global. Drives caravan count per day. 0 = game over. |

Nightly consumption exceeding stock: -1 Reputation per shortfall type, and caravans that were lodged leave angry (faction -1).

---

## 4. Factions

Each has a meter from -5 to +5, starting at 0.

| Faction | Who | Wants | Rewards at +3 | Punishes at -3 |
|---|---|---|---|---|
| **Guild** | Merchant caravans | Low tolls, stalls to trade at | Better prices (+20% sell) | Boycott: 1 fewer caravan/day |
| **Crown** | Tax collectors, soldiers | Tolls paid to the crown, no outlaws sheltered | Weekly stipend +15 coin | Tax raid: -30% coin |
| **Free Road** | Outlaws, refugees, drifters | Shelter, no questions | Warnings before bad events | Theft: lose 5 food, 5 water |

Every caravan belongs to one faction. Toll high → that faction -1. Let them trade and lodge → +1. Turn away → -1. Encounter choices modify further.

The ending event outcome is decided by faction standing and buildings (see §9).

---

## 5. Caravans

Each day, `1 + floor(reputation / 3)` caravans arrive (min 1, max 4). Type is weighted by faction standing (factions you've pleased send more).

### Caravan data (JSON)
```json
{
  "id": "guild_salt_01",
  "faction": "guild",
  "name": "Merrit's Salt Wagons",
  "leader": "Merrit Vane",
  "portrait": "merrit",
  "size": 3,
  "animals": 2,
  "cargo": {"salt": 10, "cloth": 4},
  "wants": {"grain": 6},
  "encounter": "guild_salt_01_sick_horse",
  "min_day": 1,
  "max_day": 10,
  "weight": 1.0
}
```

- `size` = beds needed to lodge
- `animals` = extra water draw
- `cargo` / `wants` drive trade
- `encounter` optional; references an encounter id

### Player actions per caravan
1. **Set toll**: 0 / 5 / 10 / 20 coin. Higher toll = more coin, faction -1 at 20, caravan may refuse and leave at 20 if faction < 0.
2. **Trade**: buy from cargo, sell from your stock at price table. Requires a Market to trade more than 2 items.
3. **Lodge**: if beds available, caravan stays the night. Consumes food/water, +1 faction, unlocks second trade round next morning.
4. **Turn away**: -1 faction, no cost.

### Encounter data (JSON)
```json
{
  "id": "guild_salt_01_sick_horse",
  "text": "One of Merrit's horses is lame. She asks to leave it in your stable for a week.",
  "choices": [
    {"text": "Take the horse in", "effects": {"water": -3, "guild": 1, "flag": "merrit_horse"}},
    {"text": "Refuse", "effects": {"guild": -1}},
    {"text": "Buy the horse for 10 coin", "effects": {"coin": -10, "animals_owned": 1}, "requires": {"building": "stable"}}
  ]
}
```

`effects` keys: any resource, any faction, `flag` (sets a string flag for later encounters), `building` (grants), `event` (queues a night event). `requires` gates choices on buildings, flags, or resource minimums.

Target 30 encounters for MVP: ~10 per faction, with 3–4 that chain via flags.

---

## 6. Buildings

12 plots along the road. Click empty plot → pick building. Each building has one upgrade.

| Building | Cost | Effect | Upgrade (cost) | Upgrade effect |
|---|---|---|---|---|
| **Well** | 20 | +5 water/night | Deep Well (40) | +10 water/night |
| **Inn** | 40 | +3 lodging | Great Inn (60) | +6 lodging, lodged caravans +1 extra faction |
| **Market** | 30 | Unlimited trade items, +10% sell prices | Bazaar (50) | +25% sell prices, attracts +1 Guild caravan/day |
| **Farm** | 35 | +3 food/night | Mill (50) | +6 food/night |
| **Stable** | 25 | Halves animal water draw, unlocks horse encounters | Wagonworks (45) | Caravans with broken wagons pay 10 coin to repair |
| **Palisade** | 50 | Blocks theft events, +1 Crown | Gatehouse (80) | Required for "hold" ending; toll refusals impossible |

Buildings are drawn as sprites on plots; upgraded versions swap sprite.

---

## 7. Day Structure

### Morning — Caravan phase
Caravans queue at the left gate. Player handles them one at a time (toll → trade → lodge/turn away → encounter if any). UI: caravan card on left, town on right, dialogue box on bottom.

### Afternoon — Build phase
Free-form. Build, upgrade, review stock. Button "End Day."

### Night — Report
1. Consumption applied
2. Random night event (weighted by day and faction standing): 1 in 3 days. Examples: theft, a traveler dies at the inn, crown inspector, tea merchant leaves a gift.
3. Rumor ticker: one line from the road. Days 1–3 cozy ("Prices are good in the plains"). Days 4–7 unease ("Smoke over the eastern passes"). Days 8–9 dread ("They're coming down the road. All of them.").
4. Day summary panel → next morning.

---

## 8. Economy

### Price table (base buy / sell)
| Good | Buy | Sell |
|---|---|---|
| Grain | 2 | 3 |
| Salt | 3 | 5 |
| Cloth | 4 | 6 |
| Iron | 5 | 8 |
| Wine | 6 | 9 |

Each caravan's `cargo` sells to you at buy price; `wants` buy from you at sell price × (1 + Guild bonus + Market bonus). Simple, no fluctuation in MVP.

### Tuning targets
- A careful player ends day 10 with ~150 coin, 4–5 buildings, one faction at +3.
- A greedy player (all tolls at 20) has more coin, all factions negative, and no way to survive the ending.

---

## 9. Ending Event — Day 10 Night: "The Column"

A refugee column (Free Road) fleeing whatever is happening east arrives with a Crown patrol close behind.

**Choice:** Shelter them / Turn them away / Hand them to the Crown.

Outcome resolved from:
- **Shelter + Free Road ≥ +2 + food/water sufficient for column size (12)** → "The Crossing Holds." Best ending. Town grows; Crown -3 but next season teased.
- **Shelter without resources** → "The Long Night." Half the column dies, reputation crashes, mixed ending.
- **Turn away** → "The Road Moves On." Neutral. Guild neutral, Free Road -3.
- **Hand to Crown + Crown ≥ +2** → "Loyal Subjects." Coin reward, Free Road hostile, town safe but hollow.
- **Palisade + Gatehouse and Crown < 0** → unlocks fourth option: "Close the gate to both." Ending: "The Free Town."

Show a short text epilogue with a pixel scene of the town. Then "Play Again."

---

## 10. Godot Project Structure

```
res://
  project.godot
  data/
    caravans.json
    encounters.json
    buildings.json
    night_events.json
    rumors.json
    prices.json
  scenes/
    Main.tscn            # camera, road strip, phase manager
    Town.tscn            # ParallaxBackground + plots container
    Plot.tscn            # Area2D, sprite, click to build
    Building.tscn        # sprite + upgrade state
    Caravan.tscn         # sprite that walks in from left, parks at gate
    ui/
      HUD.tscn           # resources bar, factions bar, day counter
      CaravanCard.tscn   # portrait, cargo, toll buttons, trade, lodge, turn away
      TradePanel.tscn
      BuildMenu.tscn
      Dialogue.tscn      # encounter text + choices
      NightReport.tscn
      Ending.tscn
  scripts/
    autoload/
      Game.gd            # resources, day, phase state machine
      Factions.gd        # 3 meters, thresholds, bonuses
      Data.gd            # loads all JSON at start
      Events.gd          # signal bus
      Flags.gd           # string flag set for encounter chaining
    CaravanQueue.gd      # picks today's caravans, spawns in order
    TradeLogic.gd
    BuildLogic.gd
    NightLogic.gd        # consumption, events, rumors
    EndingLogic.gd
  assets/
    road/                # ground strip tiles, sky, distant hills (parallax)
    buildings/           # 6 × 2 states
    caravans/            # 3 wagon sprites + variants by tint
    portraits/           # ~12 leaders (32×32 or 48×48)
    ui/                  # 9-patch, icons for 5 resources, 3 faction crests
```

### Key systems

**Phase state machine (Game.gd):** `MORNING → BUILD → NIGHT → (day+1 or ENDING)`. Each phase emits a signal; UI scenes show/hide on those.

**CaravanQueue:** at MORNING, roll caravan count, filter `caravans.json` by `min_day/max_day` and not-yet-seen (unless `repeatable`), weight by faction standing, pick. Spawn sprite walking in. Handle one at a time; next spawns when current resolves.

**Encounter resolution:** Dialogue.tscn renders `text` and filtered `choices`. On pick, `Game.apply_effects(dict)`. Effects are a flat dict so new keys are cheap to add.

**Town growth visual:** plots fill left-to-right. Camera can scroll to see the strip. Use `ParallaxBackground` for hills/sky so scrolling feels alive.

**Signals (Events.gd):** `phase_changed(phase)`, `caravan_arrived(data)`, `caravan_resolved(data, outcome)`, `resource_changed(name, value)`, `faction_changed(name, value)`, `building_placed(id, plot)`, `night_event(id)`, `rumor(text)`, `game_over(reason)`, `ending(id)`

---

## 11. HUD

Top: five resource icons with numbers | Day N / 10
Second row: three faction crests with -5..+5 bars
Morning: CaravanCard docked left, town visible right
Build: BuildMenu on plot click
Night: full-screen NightReport, then fade to morning

---

## 12. Build Order (milestones)

1. **M1 — Road & plots:** parallax scene, 12 clickable plots, camera scroll, HUD skeleton.
2. **M2 — Buildings:** BuildMenu, 6 buildings + upgrades, costs, nightly effects on resources.
3. **M3 — Caravans:** JSON loading, morning queue, walk-in animation, CaravanCard with toll/lodge/turn away, faction changes.
4. **M4 — Trade & encounters:** TradePanel, price table, Dialogue with choices, effects, flags.
5. **M5 — Nights:** consumption, night events, rumors, reputation, game over.
6. **M6 — Ending:** day 10 column event, 5 outcomes, epilogue screen, restart.
7. **M7 — Content & polish:** fill to 30 encounters, 10 night events, 10 rumors; tint transitions between phases; toasts.

Each milestone runnable. Commit after each.

---

## 13. Asset Checklist

- [ ] Road strip: ground (3 variants), sky, 2 parallax hill layers
- [ ] 6 buildings × 2 states = 12 sprites (~64×64)
- [ ] Empty plot marker
- [ ] 3 caravan wagon sprites, 1 horse, 1 walking figure
- [ ] 12 portraits (48×48)
- [ ] UI: 9-patch panel, 5 resource icons, 3 faction crests, 4 toll buttons
- [ ] Pixel font (m5x7 or similar)
- [ ] Palette: pick one 32-color palette (e.g. Endesga 32) and stick to it

Placeholder rule: every sprite starts as a colored rectangle with a label. Replace art only after M6.

---

## 14. Fun Check

After M5, ask: **does the player feel a pull between building the Palisade and building the Inn?** If every decision feels obvious, tighten starting coin and building costs first, encounter effects second.

---

## 15. Post-MVP Backlog

- Settlers: caravan members ask to stay; each has a skill (blacksmith, healer, scribe) that unlocks a building or encounter line
- Magic: 5 rare items with benefit + cost; hedge-witch resident; the well that gives back something else
- Regulars: recurring leaders with memory of past treatment
- Festivals, weddings, the dog
- 40-day season with three crisis types; multiple endings per faction
- Price fluctuation driven by rumors
- Save/load, sound, music
