# Giantfall — Game Design Document

*Working title. Post-apocalyptic village builder / wave defense.*

---

## 1. Concept

You rebuild a settlement from scavenged junk in a world where the old cities have fallen. Neighboring settlements each have a specialty. Waves of creatures and rival raiders come at night; every few nights a Giant walks in. Trade, ally, or absorb your neighbors to unlock the tech you need before the next Giant arrives.

**Pillars**
1. Nobody is self-sufficient — every specialty has a hole only a neighbor can fill.
2. Losing a little is normal — ruins are a resource, not a reset.
3. Giants change the map — they wreck terrain and reshape who is strong.

---

## 2. Core loop

| Phase | What happens |
|---|---|
| Day | Gather, build, upgrade, scout, trade / aid / raid neighbors |
| Night | Wave arrives. Small creatures early, raiders mid-game |
| Every 5–7th night | Giant boss |
| Between waves | Diplomacy choices, salvage ruins, spend Giant Bone |

---

## 3. Resources

| Resource | Source | Notes |
|---|---|---|
| Scrap (was Wood) | Ruins, wrecks | Basic build material |
| Concrete (was Stone) | Rubble, old roads | Walls, foundations |
| Steel (was Iron) | Wrecked vehicles, rebar | Weapons, towers |
| Food | Farms, hunting | Paid nightly as upkeep |
| Favor | Only from helping neighbors | Buys their tech |
| Giant Bone | Killing blow on a Giant | Tier-3 upgrades only |

- Every building has a **build cost** and **Food upkeep**. Short on Food at night → militia desert before the wave.
- Ruins: salvage for 50% cost back, or leave standing for +defense.
- Giants target the **richest** settlement. Hoard and you draw the boss.

---

## 4. Settlements and specialties

Pick one at start. Gain others via alliance or absorption. Max three.

| Settlement | Specialty | Produces well | Produces badly |
|---|---|---|---|
| Ironhold | Smiths / welders | Steel | Food |
| Thornwood | Hunters | Food | Steel |
| Mirefen | Chemists | Fuel, meds | Concrete |
| Stonebrook | Builders | Concrete | Fuel |
| Ashfall | Cultists / tamers | Bound creatures | Everything else |

---

## 5. Enemy tiers

1. **Small creatures** — mutated dogs, scrap-crabs, marsh-things. Swarm filler.
2. **Rival settlements** — raiders with the same specialties you could have picked. Hostile Ironhold sends rams; hostile Mirefen throws fire.
3. **Giants** — one per terrain type. Each has a hard counter tied to a specialty (Iron Giant only dies to Mirefen acid). They crush tiles as they walk; crushed tiles become ruins.

---

## 6. Diplomacy

Stance per neighbor: **Allied → Trading → Neutral → Wary → Hostile**. Shifts from actions, not menus.

| Action | Effect |
|---|---|
| Trade | Swap resources; rates improve with stance |
| Aid | Send units/supplies during their wave. Costs you defense, earns Favor |
| Raid | Steal resources, drop stance two steps, they get stronger vs you |
| Absorb | At max Allied, merge. Their specialty is yours; you defend two fronts |

AI settlements do this to each other. A "who trusts whom" web on the map is the whole diplomacy UI.

Allied at Trading or better → **shared vision** (see Fog of War).

---

## 7. Tech tree

Three tiers per specialty. T1 free for your own, T2–3 cost Favor if learned from a neighbor, T3 always needs Giant Bone.

| Settlement | T1 | T2 | T3 |
|---|---|---|---|
| Ironhold | Reinforced walls | Ballista towers, plate militia | Giant-Chain: pins a Giant one turn |
| Thornwood | Snare pits, archers | Dog kennels, poison bolts | Beast Call: wild pack for one night |
| Mirefen | Fire oil, med tent | Acid flasks, plague fog | Giant's Bane: only thing that hurts the Iron Giant |
| Stonebrook | Fast foundations | Watchtowers (see 2 nights early), rams | Bastion: one indestructible building |
| Ashfall | Binding circle | Bound swarm, fear totem | Giant Thrall: dead Giant fights for you once |

**Combos** (two specialties at T2+): Acid Ballista, Bound Dogs (no upkeep), Iron Bastion (blocks a Giant), Plague Thrall.

Absorbing a fourth settlement forces you to drop one; its T3 building is destroyed.

---

## 8. Grid and rendering

- **Tiling:** regular octagons + square gaps (truncated square tiling). Octagons = buildable land. Squares = roads, walls, streams.
- **View:** 3D low-poly models, orthographic camera, yaw 45°, pitch ~30°, rotate in 90° steps.
- **Engine:** Godot 4. Node3D scene, `Camera3D` with `projection = ORTHOGONAL`.
- **Data:** flat arrays per layer — `terrain`, `feature`, `owner`, `visibility`. One entry per octagon; gap squares stored in a parallel array (one per octagon corner, shared by four neighbors).
- **Performance:** `MultiMeshInstance3D` per tile type. 120×120 map = 14,400 octagons + 14,400 gaps.
- **Pathfinding:** octagon graph, 8 neighbors. A wall in a gap square cuts the diagonal edge between the two octagons it touches.
- **Giants:** multi-tile. Stomping a tile ruins it and the four gaps around it.

---

## 9. World generation

Generate the whole map up front; reveal through fog.

- Map ~120×120. Player starts center on a guaranteed clear 9×9.
- **Ring 1** (25–35 tiles out): 4–6 neighbor settlements, evenly spaced with jitter, each biome-biased (Thornwood in forest, Mirefen in marsh).
- **Ring 2** (45–55 tiles out): one Giant lair per Giant type, on matching terrain.
- **Terrain:** noise layer A = elevation (water → grass → hills → mountain). Noise layer B = moisture (dry → forest → marsh).
- **Roads:** carve a path from each neighbor toward the player through gap squares. Raiders and Giants approach along them.

---

## 10. Fog of war

Per-tile state: **unseen / explored / visible**.

- Unseen: not rendered (MultiMesh instance scaled to 0).
- Explored: terrain only, dark tint, last-seen buildings frozen.
- Visible: full live render.

Vision sources: buildings (r3), watchtowers (r6, Stonebrook T2 → r9), scouts, allied settlements at Trading+.

Recompute nightly with a radius flood. Push the visibility array to an `ImageTexture` for the fog shader. Enemies are simulated in fog — Giant footprints on a road are the early warning.

---

## 11. Build roadmap

1. **Grid + camera** — octagon array, MultiMesh render, click-to-tile raycast.
2. **World gen** — noise terrain, ring placement, roads.
3. **Fog** — visibility array, shader, MultiMesh hide.
4. **Build/upgrade** — place buildings on grass, tiers, upkeep.
5. **Waves** — small creatures, pathfinding along roads, walls in gaps.
6. **One settlement + one Giant** — vertical slice.
7. **Diplomacy + Favor + tech tree** — remaining settlements.
8. **Remaining Giants, combos, polish.**

---

## 12. Open questions

- Multiplayer? (Shared-map co-op would fit the aid/raid loop well.)
- Campaign length target: 30 nights? 60?
- Does the player see the diplomacy web from the start, or discover it through scouting?
