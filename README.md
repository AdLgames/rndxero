# Ashford Crossing

A ford town on the only road between the highlands and the plains. Caravans
arrive each morning with goods and problems; you set tolls, trade, build, and
decide who gets to stay. After ten days something comes down the road.

Godot 4.3+, GDScript. Full design in [ASHFORD_MVP.md](ASHFORD_MVP.md).

## Running

Open the project folder in Godot 4.3 or newer and press play.
`scenes/Main.tscn` is the main scene.

- **Click a plot** to open the build menu; build, or upgrade what's there.
- **A/D or arrows** scroll along the road; **right- or middle-drag** also pans.
- **End Day** runs the night: buildings produce, the town eats, shortfalls cost
  reputation. **Esc** closes the build menu.

## Status

**M1 and M2 of the seven milestones in §12 are built.** That is: the road strip
with parallax and twelve plots, camera scrolling, the HUD skeleton, and all six
buildings with their upgrades, costs, and nightly effects on resources.

Not built yet, in the order the spec sequences them:

| Milestone | What is missing |
|---|---|
| M3 | Caravans: JSON loading, the morning queue, walk-in animation, CaravanCard, toll and lodging |
| M4 | Trade and encounters: price table, TradePanel, Dialogue, effects, flags |
| M5 | Nights: night events, rumours, the full report screen, game over handling |
| M6 | The Column: the day 10 event, its five outcomes, epilogue, restart |
| M7 | Content: 30 encounters, 10 night events, 10 rumours, phase transitions |

Because caravans do not arrive yet, MORNING is entered and passed straight
through, and the nightly formula runs with an empty inn — 2 food for the town,
no guests, no animals. The rules from §3 are implemented in full; they simply
have nothing to feed yet. Reputation reaching zero emits `Events.game_over`,
which nothing listens to until M5.

## Layout

```
data/            buildings.json -- tuning and content live here, not in code
scenes/          Main, Town, Plot, Building, ui/
scripts/
  autoload/      Events (signal bus), Data (JSON), Flags, Factions, Game
  ui/            HUD, BuildMenu, Toast
  *.gd           Town, Plot, Building, BuildLogic, NightLogic, CameraRig, Main
tools/           placeholder art generator
assets/          generated art
```

`Game.plots` is the single source of truth for what stands where; `Town.tscn`
renders whatever it finds there, and `BuildLogic` is the only thing that writes
to it.

## Art

Everything is a placeholder, per §13: flat coloured side-view shapes from one
fixed palette, written by `tools/gen_placeholder_art.py`. Building names are
drawn by a `Label` node rather than baked into the PNGs, so they stay legible at
any zoom. Re-run the script any time; it writes straight into `assets/`.

Not yet sourced: the pixel font on the checklist. The game uses Godot's default.

## Two deviations from the spec, and why

- **Parallax is done in world space** in `Town.gd`, not with
  `ParallaxBackground`. That node is a `CanvasLayer`, so its contents sit in
  screen coordinates and have to be positioned against the viewport height and
  camera zoom; a window resize pulls the horizon off the ground line. Three
  sprites offset against the camera each frame stay welded to the world.
- **`NightLogic.gd` exists at M2**, though §12 places it at M5. The buildings
  M2 adds are only meaningful against the consumption rules, so those are here
  in full; night events and rumours are still M5's.

> This repository previously held three unrelated projects (ClaimTrail,
> Giantfall and LANES); all remain in git history.
