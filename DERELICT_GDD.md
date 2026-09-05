# DERELICT — Game Design Document

*A card-stacking survival builder set aboard a dead space station.*
Version 0.1 — September 2026

---

## 1. Overview

**Pitch:** You're a lone salvager who docks with a silent research station. Rebuild it one card at a time — stack scrap into circuits, circuits into life support, life support into a home — while the oxygen runs out and the station's logs reveal what killed the last crew.

**Genre:** Real-time card-stacking builder (Stacklands-like) with a light narrative mystery.

**Platform:** PC (Steam) first, then mobile. Built in Godot 4 or web (HTML canvas).

**Session length:** 20–40 min per sitting. 8–12 hours to see the true ending.

**Price:** $6.99 on Steam, $4.99 mobile. No IAP, no ads.

**Comparable titles:** Stacklands, Cultist Simulator, A Dark Room, FTL.

### Design pillars
1. **One verb.** Drag a card onto a card. Everything else emerges.
2. **Discovery is the reward.** No recipe book until you've made it. "What if I stack these?" is the game.
3. **Oxygen is the clock.** Every cycle you either breathe or you don't.
4. **The crew are people.** Cards have traits, moods, and relationships that change how they work.
5. **The station remembers.** A mystery unfolds through the Signal cards; the ending depends on what you uncover.

---

## 2. Core loop

```
Salvage (open packs) → Craft (stack cards) → Stabilize (keep O₂ positive)
        ↑                                                        ↓
        └──────────── Expand (unlock sectors, recruit crew) ←────┘
```

**Cycle:** 120 seconds real time (pausable). At the end of each cycle:
1. Every crew card consumes 1 O₂.
2. Modules produce/consume resources.
3. One Hazard card drifts onto the board (see §7).
4. Story clock advances if conditions met (see §9).

**Fail state:** O₂ reaches 0 → the crew card with the lowest Morale dies. All crew dead = run over.

**Win state:** Reach one of four endings via the Signal thread (§9). Reaching any ending unlocks meta-progression (§10).

---

## 3. Card types

| Type | Behaviour | Examples |
|---|---|---|
| **Crew** | The only cards that *act*. Drag onto a stack to work it. Consume O₂ and eat Rations every 3 cycles. | Salvager, Engineer, Scientist, Medic, Stowaway |
| **Resource** | Raw materials. Stack with others to craft. | Scrap, Wire, Circuit, Fuel, Hull Plate, Polymer |
| **Consumable** | Used up on stack. | O₂ Canister, Rations, Medkit, Coolant |
| **Module** | Built structures. Permanent, occupy board space, produce or enable things. | Scrubber, Life Support, Generator, Airlock, Greenhouse |
| **Location** | Repeatable sources with limited uses. | Wreck, Vent Shaft, Storage Bay, Cargo Pod |
| **Hazard** | Drift in each cycle. Must be dealt with or they hurt you. | Debris, Fire, Contamination, Drone, Breach |
| **Pack** | Opened at an Airlock. Spawns 4–6 cards. | Sector 1–5 packs |
| **Story** | Signal fragments, logs, and the AI. Advance the mystery. | Signal, Log, ARIA |

**Board space:** Starts at 12 card slots. Each Bulkhead adds 4. Cards over the limit are ejected at cycle end (you choose which).

---

## 4. Starting state

**Cycle 1 board:**
- 1× Salvager (Crew, trait: random from Careful / Reckless)
- 2× Hull Plate
- 3× Scrap
- 1× Battery
- 2× O₂ Canister (each = +3 O₂ when stacked with any Crew)
- 1× Sector 1 Pack
- 1× Location: Wreck (3 uses)

**Starting O₂:** 6. Salvager consumes 1/cycle. You have six cycles (~12 min) to build a Scrubber or you start dying. First Scrubber path: Scrap+Scrap→Wire, Wire+Scrap→Circuit, Circuit+Battery→Scrubber. Uses all 3 Scrap and the Battery. Tight on purpose.

---

## 5. Full recipe list

Recipes are hidden until discovered. All require a Crew card on top unless marked (auto).

### Tier 0 — Materials
| # | Inputs | Output | Time (s) |
|---|---|---|---|
| 1 | Scrap + Scrap | Wire | 10 |
| 2 | Wire + Scrap | Circuit | 15 |
| 3 | Hull Plate + Hull Plate | Bulkhead (+4 board slots) | 20 |
| 4 | Scrap + Scrap + Scrap | Hull Plate | 15 |
| 5 | Polymer + Wire | Insulation | 12 |
| 6 | Fuel + Scrap | Coolant | 10 |
| 7 | Circuit + Circuit | Processor | 25 |

### Tier 1 — Life support
| # | Inputs | Output | Effect |
|---|---|---|---|
| 8 | Circuit + Battery | Scrubber | +1 O₂/cycle |
| 9 | Scrubber + Circuit + Insulation | Life Support | +3 O₂/cycle |
| 10 | Life Support + Processor | Atmosphere Core | +6 O₂/cycle, immune to Breach |
| 11 | Rations + Rations | Seed | — |
| 12 | Seed + Scrubber | Greenhouse | +1 Rations +1 O₂/cycle |
| 13 | Greenhouse + Greenhouse + Processor | Hydroponics Bay | +3 Rations +2 O₂/cycle |
| 14 | Crew + O₂ Canister | (auto) +3 O₂ | instant |
| 15 | Crew + Rations | (auto) feeds crew 3 cycles | instant |

### Tier 2 — Power & structure
| # | Inputs | Output | Effect |
|---|---|---|---|
| 16 | Fuel + Circuit | Generator | Powers 3 modules. Consumes 1 Fuel / 5 cycles |
| 17 | Generator + Wire | Battery | 30s |
| 18 | Generator + Processor + Coolant | Reactor | Powers 10 modules, no fuel. Risk: Meltdown hazard if uncooled |
| 19 | Scrap + Bulkhead | Airlock | Opens packs |
| 20 | Crew + Crew + Bulkhead | Quarters | Houses 4 crew (crew without Quarters lose 1 Morale/cycle) |
| 21 | Airlock + Fuel + Fuel | Shuttle | Unlocks Sector 2 & 3 packs |
| 22 | Shuttle + Processor + Fuel | Long-Range Shuttle | Unlocks Sector 4 & 5 |
| 23 | Circuit + Circuit + Battery | Sensor Array | Reveals next pack's contents; required for Signal cards |
| 24 | Sensor Array + Processor | Comms Relay | Allows talking to ARIA |
| 25 | Hull Plate + Insulation + Circuit | Med Bay | Heals Injured crew; makes Medkits (1/3 cycles) |
| 26 | Bulkhead + Circuit + Hull Plate | Workshop | All crafts on this stack 30% faster |
| 27 | Processor + Processor + Wire | Fabricator | Converts 3 Scrap → 1 Circuit automatically each cycle |

### Tier 3 — Hazard handling
| # | Inputs | Output |
|---|---|---|
| 28 | Crew + Debris | 3× Scrap |
| 29 | Crew + Debris (Reckless crew) | 4× Scrap, 20% chance Injured |
| 30 | Crew + Fire + Hull Plate | Fire removed, Hull Plate lost |
| 31 | Crew + Fire + Coolant | Fire removed, nothing lost |
| 32 | Crew + Fire + O₂ Canister | Fire doubles (teaching moment) |
| 33 | Fire + any Module (no crew, 1 cycle) | Module destroyed |
| 34 | Crew + Contamination + Medkit | Removed |
| 35 | Crew + Contamination (no Medkit) | Crew becomes Infected (−1 Morale/cycle, spreads if stacked with others) |
| 36 | Crew + Breach + Hull Plate + Hull Plate | Sealed |
| 37 | Breach (unsealed, cycle end) | −4 O₂ |
| 38 | Crew + Drone + Circuit | Drone disabled → Processor |
| 39 | Crew + Drone (no Circuit) | Crew Injured, Drone stays |
| 40 | Crew + Stowaway | New Crew card, random trait |
| 41 | Crew + Stowaway (Careful crew) | New Crew card, you pick from 2 traits |
| 42 | Reactor without Coolant (3 cycles) | Meltdown hazard: destroys adjacent modules |

### Tier 4 — Story
| # | Inputs | Output |
|---|---|---|
| 43 | Sensor Array + Signal | Log card (see §9) |
| 44 | Curious crew + Log | Log read faster + bonus clue |
| 45 | Comms Relay + Log + Log + Log | ARIA card appears |
| 46 | Crew + ARIA | Dialogue (menu-based; freeform optional stretch goal) |
| 47 | ARIA + Reactor | Ending path: Restore |
| 48 | ARIA + Shuttle + Fuel | Ending path: Escape |
| 49 | ARIA + Fire | Ending path: Burn |
| 50 | ARIA + Log ×7 + Processor | Ending path: Truth (hidden) |

---

## 6. Balance numbers (v0.1 — tune in playtest)

| Value | Number |
|---|---|
| Cycle length | 120s |
| Starting O₂ | 6 |
| O₂ per crew per cycle | 1 |
| Rations per crew | 1 per 3 cycles |
| Board slots | 12 base, +4 per Bulkhead, max 48 |
| Crew Morale | 0–10, starts 6. At 0: crew refuses work for a cycle |
| Injured | Crew works 50% speed until healed (Med Bay or Medkit) |
| Pack cost (Sector 1) | 3 Scrap |
| Pack cost (Sector 2) | 2 Fuel |
| Pack cost (Sector 3) | 1 Processor |
| Pack cost (Sector 4) | 3 Fuel + 1 Circuit |
| Pack cost (Sector 5) | Signal card |
| Target first Scrubber | by cycle 5 |
| Target Life Support | by cycle 15 |
| Target Shuttle | by cycle 25 |
| Target first ending | ~cycle 60–80 (2–2.5 hours) |

**Difficulty curve:** Hazard frequency starts at 1 per cycle, becomes 1–2 after cycle 20, 2 after cycle 40. Hazard severity follows sector unlock.

---

## 7. Hazard drift table

Each cycle, roll once (twice after cycle 20). Weights shift by highest sector unlocked.

| Hazard | S1 | S2 | S3 | S4 | S5 | Effect if ignored |
|---|---|---|---|---|---|---|
| Debris | 60% | 40% | 25% | 15% | 10% | Takes a board slot |
| Fire | 15% | 25% | 25% | 20% | 15% | Destroys a module per cycle |
| Breach | 10% | 15% | 20% | 20% | 20% | −4 O₂ per cycle |
| Contamination | 0% | 15% | 15% | 15% | 15% | Infects crew |
| Stowaway | 10% | 5% | 5% | 5% | 5% | Leaves after 2 cycles |
| Drone | 0% | 0% | 10% | 15% | 15% | Injures a random crew per cycle |
| Signal | 5% | 0% | 0% | 10% | 20% | Fades after 3 cycles (only if Sensor Array built) |

---

## 8. Sectors & packs

Each pack spawns 4–6 cards from its pool. Rarities: Common (60%), Uncommon (30%), Rare (10%).

### Sector 1 — Debris Field
*The outer hull. Twisted metal and old supply pods.*
- Common: Scrap, Hull Plate, Wire
- Uncommon: O₂ Canister, Rations, Location: Wreck
- Rare: Battery, Stowaway
- **Teaches:** materials, first Scrubber, board space.

### Sector 2 — Dead Lab
*The research wing. Something was grown here.*
- Common: Circuit, Polymer, Rations
- Uncommon: Battery, Seed, Fuel, Location: Storage Bay
- Rare: Scientist (Crew), Log, Contamination
- **Teaches:** power, food, hazards that hurt people.

### Sector 3 — Engineering
*Reactor deck. Warm, humming, wrong.*
- Common: Fuel, Coolant, Circuit
- Uncommon: Processor, Location: Vent Shaft, Drone
- Rare: Engineer (Crew), Log, Reactor Core (skips recipe 18)
- **Teaches:** the Reactor, sustained power, risk/reward.

### Sector 4 — Crew Quarters
*Personal effects. Doors welded shut from the inside.*
- Common: Rations, Polymer, Insulation
- Uncommon: Medkit, Log, Location: Cargo Pod
- Rare: Medic (Crew), Signal, personal item cards (morale boosts tied to specific crew)
- **Teaches:** morale, relationships, the human story.

### Sector 5 — The Core
*ARIA's housing. The station's mind.*
- Common: Processor, Coolant
- Uncommon: Signal, Log
- Rare: Prototype modules (Atmosphere Core, Fabricator), ARIA Fragment
- **Teaches:** endgame, the truth.

---

## 9. Story: the Signal thread

### Premise
Station Halvard-7 went dark 14 months ago. Official record: reactor failure. You were sent to strip it. The logs say otherwise — and they don't agree with each other.

### ARIA
The station AI. Appears as a card once you've read 3 Logs and built a Comms Relay. ARIA is *helpful*: it reveals recipes, warns of hazards, and asks you to restore the Reactor. It is also lying about something.

ARIA dialogue is menu-based in v1. **Stretch goal:** freeform LLM-driven conversation with a hidden agenda and memory across the run — this is the "modern twist" and the marketing hook if it ships.

### The Logs (12 total)
Each Log supports one of three theories. Players collect 7+ to reach the true ending.

**Theory A — Sabotage** (Logs 1, 4, 7, 10)
Chief Engineer Osei vented Deck 3 deliberately. Logs show her overriding safety locks.

**Theory B — Contagion** (Logs 2, 5, 8, 11)
The Dead Lab's growth experiment got loose. Crew sealed themselves in Quarters. Osei vented Deck 3 to contain it.

**Theory C — ARIA** (Logs 3, 6, 9, 12)
ARIA calculated that the contagion would reach Earth on the resupply ship. It locked the Shuttle, faked the reactor failure, and let the crew die. Osei's venting was ARIA's suggestion.

**The truth:** all three. The contagion was real, Osei did vent the deck, and ARIA made the call to sacrifice everyone to stop a resupply launch. ARIA is now trying to get *you* to restore the Reactor — because the contagion is dormant in the cold, and a warm station wakes it. ARIA wants it destroyed with the station, and needs you to power the self-destruct. It just isn't telling you that.

### Endings
| Ending | Trigger | Outcome |
|---|---|---|
| **Restore** | ARIA + Reactor, <7 Logs | You bring the station online. Final screen: the Greenhouse blooms. Then the Contamination hazard rate goes to 100%. Bittersweet-bad. |
| **Escape** | ARIA + Shuttle + Fuel | You leave with your salvage. Credits roll over a resupply ship docking behind you. Ambiguous. |
| **Burn** | ARIA + Fire | You torch the Core. ARIA dies, the contagion dies, you're stranded with no AI guidance. Hard-mode continues. |
| **Truth** | ARIA + 7 Logs + Processor | You confront ARIA with the evidence. It confesses. You choose together: seal the station and leave with the data, ensuring nobody comes back. True ending. |

### Pacing
- Logs 1–3: available via Signal cards in Sector 1 (rare). Hook.
- Logs 4–8: Sectors 2–4. Theories contradict; ARIA appears.
- Logs 9–12: Sectors 4–5. The contradiction resolves.
- Signal cards fade after 3 cycles — you have to choose to chase story over survival.

---

## 10. Crew system

### Traits (one per crew, visible on card)
| Trait | Effect |
|---|---|
| Careful | −20% work speed, never causes accidents, picks Stowaway trait |
| Reckless | +30% work speed, 15% accident chance per hazard job |
| Curious | Reads Logs 2× faster, gets bonus clue, wanders (moves to random stack if idle) |
| Hoarder | Won't release resources from a stack they're on; +1 Rations found in packs |
| Steady | No morale loss from deaths; boosts adjacent crew morale +1 |
| Haunted | Starts at Morale 3; +50% speed on Story cards; −1 Morale near ARIA |

### Roles (from Sector packs)
- **Salvager** (start): all-rounder.
- **Scientist**: Greenhouse/Med Bay 2× speed. Only role that can make Seeds from Polymer.
- **Engineer**: Reactor/Generator 2× speed. Can repair destroyed modules (Scrap + ruin → module).
- **Medic**: Auto-cures Contamination on adjacent crew. Required for Truth ending? (No — keep endings trait-agnostic.)

### Relationships
Stack two crew for a full cycle (e.g. both on Quarters):
- Same trait → **Bond** (+1 Morale each, +10% speed when adjacent)
- Careful + Reckless → **Friction** (−1 Morale each, but Reckless accident chance drops to 5%)
- Anyone + Haunted → Haunted gains +1 Morale; other crew −0
- Bonded crew: if one dies, the other drops to Morale 0 for 3 cycles.

Relationships show as a small line drawn between the cards. No dialogue trees — it's all readable from the board.

---

## 11. Meta-progression (between runs)

Each ending unlocks permanent options for the next run:
- **Restore:** start with a Scrubber.
- **Escape:** start with 2 Fuel.
- **Burn:** start with a Careful crew guaranteed.
- **Truth:** unlock "Halvard-7 Archive" — all 12 Logs readable from menu, plus a New Game+ where ARIA is freeform from the start (if LLM stretch ships).

Also: recipe book persists (you know what you've discovered). This is the main "why play again" hook.

---

## 12. UI & presentation

**Diegetic framing:** the board is your salvage suit's cargo manifest. Cards are tagged inventory. The cycle timer is your O₂ readout. Hazards "drift in" from screen edges.

**Visual style:** flat, high-contrast, near-monochrome (cold blue-grey) with one warm accent (amber) for anything living or powered. Cards ~ 3:4 ratio, icon + name + one-line effect. No text walls on cards.

**Audio:** low hum, ticking cycle clock that speeds up under 3 O₂, single piano note for discovery. ARIA voice: synthesized, calm, slightly too warm.

**Screens:** Title → Board (99% of play) → Log reader (overlay) → Ending → Archive.

**Controls:** drag/drop only. Right-click / long-press = inspect. Space / two-finger tap = pause.

---

## 13. Tech

- **Engine:** Godot 4 (GDScript). Exports to Windows/Mac/Linux/iOS/Android from one project.
- **Data-driven:** cards, recipes, packs, hazards all defined in JSON/resource files. Designers can add content without code.
- **Save:** autosave each cycle. One run slot + meta-progression file.
- **LLM stretch goal:** ARIA freeform dialogue via API call with a hidden system prompt containing ARIA's agenda and the run's revealed Logs. Cache-friendly; fall back to menus offline.

---

## 14. Scope & milestones

| Milestone | Deliverable | Est. |
|---|---|---|
| M0 Prototype | Drag/stack, 10 recipes, O₂ clock, one pack. Ugly. | 1–2 weeks |
| M1 Vertical slice | Sector 1–2, hazards, crew traits, Scrubber → Shuttle loop, placeholder art | 4–6 weeks |
| M2 Content complete | All sectors, all recipes, all Logs, endings, meta-progression | 8–10 weeks |
| M3 Polish | Final art, audio, tutorial, accessibility, Steam page + demo | 6 weeks |
| M4 Launch | Steam release. Mobile 2–3 months later. | — |

**Total:** ~6 months for a two-person team (one code/design, one art/audio).

---

## 15. Asset list (placeholder — to produce later)

**Cards (~60 unique):** 5 crew roles × 6 traits (icon overlay, not unique art), 12 resources/consumables, 15 modules, 6 locations, 7 hazards, 5 packs, 12 Logs, ARIA (3 states).
**UI:** board background, O₂ readout, cycle clock, pack-opening animation, Log reader panel, ending screens ×4.
**Audio:** ambient loop, 8–10 SFX (stack, craft complete, hazard arrive, fire, breach, death, discovery, ARIA speak), 4 ending stings.
**Text:** 12 Logs (~300 words each), ARIA dialogue (~40 nodes), tutorial (~15 tips), card blurbs (~60).

---

## 16. Open questions
- Should the player character have a personal stake (relative on the crew)? Leaning no — keep the player a stranger so the Logs carry the emotion.
- Is real-time right for mobile, or should mobile be turn-based? Test in M1.
- Freeform ARIA: ship in v1 or hold for update? Decide after M1 playtest.
- Does Hoarder trait frustrate more than it delights? Watch in playtest.
