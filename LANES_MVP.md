# LANES — MVP Spec

Space traffic management game. Isometric pixel art, Godot 4.3+, GDScript.
Goal of MVP: a playable loop that is fun for 15 minutes with three stations, one lane class, three traffic types, and 10 tech nodes.

---

## 1. Pitch

You run the transit authority for a small asteroid field. Stations generate ships. You build lanes between stations so ships can travel. Delivered ships pay credits. Congestion and collisions cost you. Spend credits on tech to handle more traffic.

**Feel:** watching tiny ships stream along lanes you built, then panicking as a hauler convoy jams your commuter route.

---

## 2. MVP Scope

### In
- One map: asteroid field, ~24×24 iso tiles
- 3 stations: **Habitat** (consumer origin), **Depot** (commercial origin), **Refinery** (heavy origin). Every station is also a destination.
- Player builds **mixed lanes** between stations (straight line, must have clear line of sight over void tiles)
- 3 ship classes with different size, speed, pay
- Lane capacity and queuing
- Collisions when a heavy ship and a consumer ship occupy the same lane segment while over capacity
- Credits, reputation, day timer (1 day = 90s real time)
- Tech tree: 10 nodes
- Pause / 1x / 2x speed
- Game over: reputation hits 0. Win state: none yet (survive and grow)

### Out (post-MVP)
- Multiple lane classes, dedicated corridors
- Hazards (flares, debris, pirates)
- Contracts, rival carriers
- Save/load
- Sound
- Prestige / jump gate

---

## 3. Core Entities

### Ship
| Class | Size | Speed | Pay | Patience |
|---|---|---|---|---|
| Consumer | 1 | 3.0 | 5 | 20s |
| Commercial | 2 | 2.0 | 15 | 45s |
| Heavy | 4 | 1.0 | 50 | 120s |

- `size` = capacity units it consumes on a lane
- `patience` = seconds it will wait in a station queue before leaving and costing 1 reputation
- Each ship has `origin`, `destination`, `class`, `path` (list of lane ids)

### Station
- `id`, `tile_pos`, `name`, `spawn_table` (weights per class), `spawn_interval` (seconds)
- `queue: Array[Ship]` — ships waiting for a free lane
- `dock_capacity` = 3 (ships arriving when full wait in lane, blocking it)

### Lane
- `id`, `station_a`, `station_b`, `capacity` (default 6 units), `speed_mult` (default 1.0)
- `occupants: Array[Ship]` — ships currently in transit
- `load()` = sum of occupant sizes
- A ship may enter if `load() + ship.size <= capacity`
- Bidirectional in MVP

### Collision rule (MVP)
If a Heavy ship enters a lane where a Consumer ship is present AND the lane is at >= 80% load: 30% chance per second of collision. Collision destroys both ships, -3 reputation, -20 credits. Show a small explosion sprite and a toast.

---

## 4. Economy

- Start: 100 credits, 10 reputation (max 20)
- Ship delivered: +pay credits, +0 rep
- Ship abandons queue: -1 rep
- Collision: -3 rep, -20 credits
- Rep ticks +1 every day if no collisions that day
- Lane cost: 30 credits + 5 per tile of length
- Demand scaling: every day, each station's `spawn_interval` decreases by 5% (floor 1.5s)

---

## 5. Tech Tree (MVP: 10 nodes)

Stored as `res://data/tech.json`. Each node: `id, name, cost, prereqs[], effect`.

| # | ID | Name | Cost | Prereqs | Effect |
|---|---|---|---|---|---|
| 1 | `wide_lanes` | Wide Lanes | 60 | — | All lane capacity +2 |
| 2 | `thrust_1` | Ion Thrusters | 80 | — | All ship speed +20% |
| 3 | `docks_1` | Extra Docking Bay | 80 | — | Station dock_capacity +2 |
| 4 | `signals` | Lane Signals | 120 | wide_lanes | Ships wait at lane entry instead of entering over capacity (removes forced jams) |
| 5 | `separation` | Separation Protocol | 150 | signals | Collision chance halved |
| 6 | `patience_1` | Comfort Standards | 100 | docks_1 | Consumer patience +15s |
| 7 | `hauler_tugs` | Tug Escorts | 200 | separation | Heavy ships no longer trigger collisions |
| 8 | `express` | Express Priority | 180 | signals | Consumer ships jump lane queues |
| 9 | `routing_1` | Smart Dispatch | 220 | signals, thrust_1 | Ships route by least-loaded path instead of shortest |
| 10 | `wide_lanes_2` | Superhighways | 300 | wide_lanes, routing_1 | All lane capacity +4 |

Effects are applied by `TechManager.apply(id)` which calls a matching function; keep effects as simple modifiers on autoload singletons so adding nodes is data-only.

---

## 6. Godot Project Structure

```
res://
  project.godot
  data/
    tech.json
    stations.json
  scenes/
    Main.tscn            # world, camera, HUD, input
    Station.tscn         # Sprite2D + queue label + Area2D
    Lane.tscn            # Line2D + Path2D + PathFollow2D spawner
    Ship.tscn            # Sprite2D following PathFollow2D
    ui/
      HUD.tscn           # credits, rep, day, speed buttons
      TechPanel.tscn     # scrollable tree, buy buttons
      Toast.tscn
  scripts/
    autoload/
      Game.gd            # credits, rep, day timer, speed, game over
      Dispatcher.gd      # graph of stations+lanes, pathfinding, ship routing
      TechManager.gd     # loads tech.json, tracks unlocked, applies effects
      Events.gd          # signal bus
    Station.gd
    Lane.gd
    Ship.gd
    BuildTool.gd         # click station A, click station B, validate, create lane
  assets/
    tiles/               # 5 iso tiles: void, rock, ice, crater, asteroid
    stations/            # habitat.png, depot.png, refinery.png (64x64-ish)
    ships/               # consumer.png, commercial.png, heavy.png (16–32px)
    fx/                  # explosion.png (4-frame strip)
    ui/                  # 9-patch panel, icons
```

### Key systems

**Map:** `TileMapLayer` in isometric mode, tile size 64×32. Void tiles are traversable for lanes; rock/asteroid block line of sight. Stations placed on asteroid tiles.

**Dispatcher:**
- Maintains adjacency list `stations -> lanes`
- `find_path(origin, dest, ship)` — BFS shortest path by lane count (MVP). `routing_1` switches to Dijkstra weighted by `lane.load()`.
- `try_dispatch(station)` — for each ship in queue, if first lane on path has capacity, move ship onto lane.
- Runs on a 0.25s timer.

**Ship movement:** each Lane has a `Path2D`. Ship gets a `PathFollow2D`, advances `progress += speed * speed_mult * delta`. At end, ship exits lane, enters next station: if destination, pay and free; else enqueue for next lane.

**BuildTool:** click station → highlight valid targets (line of sight clear, no existing lane) → click target → deduct credits → instantiate Lane.

**Signals (Events.gd):**
`ship_delivered(ship)`, `ship_abandoned(ship)`, `collision(a, b, lane)`, `day_passed(n)`, `tech_unlocked(id)`, `credits_changed`, `rep_changed`

---

## 7. HUD

Top bar: Credits | Reputation (bar, 0–20) | Day N | timer | speed buttons ⏸ 1x 2x
Bottom-right: Tech button (opens panel)
Stations show queue count above them; lanes tint from green → yellow → red by load.

---

## 8. Build Order (milestones)

1. **M1 — Map & stations:** iso tilemap renders, 3 stations placed, camera pan/zoom.
2. **M2 — Lanes:** build tool works, lanes draw with Line2D, cost deducted.
3. **M3 — Ships:** stations spawn ships, ships path along lanes, deliver, pay. HUD updates.
4. **M4 — Pressure:** capacity, queues, patience, abandonment, demand scaling, collisions, rep, game over.
5. **M5 — Tech:** load tech.json, panel UI, all 10 effects working.
6. **M6 — Polish:** lane load tinting, toasts, explosion fx, speed control, title screen.

Each milestone should be a runnable build. Commit after each.

---

## 9. Asset Checklist

Free CC0 sources: kenney.nl (Space Kit, Isometric packs), itch.io CC0 tag.

- [ ] 5 iso terrain tiles 64×32
- [ ] 3 station sprites
- [ ] 3 ship sprites (top-down, will be rotated to lane angle)
- [ ] 1 explosion strip
- [ ] UI panel 9-patch + 4 icons (credits, rep, tech, speed)
- [ ] 1 pixel font (e.g. m5x7 or Press Start 2P)

---

## 10. "Fun check" for MVP

Playtest question: **does the player ever feel forced to choose between building a second lane and buying a tech?** If yes, the loop works. If credits pile up or nothing ever jams, tune `spawn_interval` decay and lane capacity first.

---

## 11. Post-MVP Backlog (do not build yet)

- Lane classes: light / heavy / express corridors
- Hazards: solar flare (lanes offline 10s), debris (line of sight lost), pirates (rob unescorted commercial)
- Contracts with SLAs and bonuses
- Rival carrier that builds competing lanes
- Hub stations, sorting yards, fuel depots
- Save/load, multiple maps, jump gate prestige
- Full tech tree (target 100+ nodes across Lanes / Control / Safety / Stations / Economy)
