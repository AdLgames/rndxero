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

**M1 to M4 of the seven milestones in §12 are built.** That is: the road strip
with parallax and twelve plots, camera scrolling and the HUD; all six buildings
with their upgrades, costs and nightly effects; the morning caravan queue with
tolls, lodging and turning away; and trading plus the encounter system with
effects, requirements and flags.

Not built yet, in the order the spec sequences them:

| Milestone | What is missing |
|---|---|
| M5 | Nights: night events, rumours, the full report screen, game over handling |
| M6 | The Column: the day 10 event, its five outcomes, epilogue, restart |
| M7 | Content: fill to 30 encounters, 10 night events, 10 rumours, phase transitions |

**Both income streams are in.** Tolls of 0/5/10/20 per caravan, and the trade
margin: you buy a caravan's cargo at the `buy` column of `data/prices.json` and
sell it on to a later caravan that wants it at `sell`, lifted by the Guild's
goodwill (+20% at +3) and whatever market you have built. Goods are a stock of
their own, separate from the five resources, shown on the HUD's Stock line.

Without a Market you may trade only two items per caravan — that is this
project's reading of §5's "requires a Market to trade more than 2 items", and
it is what makes the Market worth its 30 coin.

Nine encounters are written, one per caravan, including a two-step chain: take
Merrit's lame horse in and a later Guild caravan offers you a choice that only
appears because of it. Encounter effects are the flat dictionary §5 describes,
so adding keys is one branch in `Game.apply_effects` and nothing in the data.
Reputation reaching zero emits `Events.game_over`, which nothing listens to
until M5, and an encounter's `event` effect queues a night event that M5 will
drain.

### What the meters already do

Several faction and building rules are live now because M3's caravan count and
outcomes are what they act on:

- Reputation sets how many caravans arrive; a Guild boycott at -3 removes one,
  a Bazaar adds one.
- A 20-coin toll costs the caravan's faction a point, and a faction already
  below zero will refuse it and leave with nothing paid — unless you have built
  the Gatehouse, which makes refusals impossible.
- Lodging a caravan gains a faction point; a Great Inn makes it two.
- Running short of food or water overnight costs a point of reputation per
  shortfall and a point with every faction bedded down at the time.
- Doing business with a caravan gains a faction point, once per visit however
  many units change hands.
- The Guild at +3 pays 20% more for what you sell; a Market adds 10% and a
  Bazaar 25%.
- A Stable lets you take horses in from encounters; animals the town keeps then
  drink every night alongside the guests'.

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
