# LANES

Space traffic management. You run the transit authority for a small asteroid
field: build lanes between stations, keep the traffic moving, and spend what you
earn before the queues eat your reputation.

Godot 4.3+, GDScript. Full design in [LANES_MVP.md](LANES_MVP.md).

## Running

Open the project folder in Godot 4.3 or newer and press play.
`scenes/TitleScreen.tscn` is the main scene.

- **Click a station, then another** to lay a lane. Right click cancels.
- **WASD / arrows** pan, **middle-drag** pans, **wheel** zooms.
- **II / 1x / 2x** in the top bar control speed; **Technology** opens the tech tree.

You start with 100 credits and 10 reputation. A lane costs 30 credits plus 5 per
tile, so you can afford exactly one to begin with. Reputation falls when ships
give up waiting or wreck, and the run ends at zero.

## Layout

```
data/            tech.json and stations.json -- tuning lives here, not in code
scenes/          Main, Station, Lane, Ship, Explosion, TitleScreen, ui/
scripts/
  autoload/      Events (signal bus), Game (run state), TechManager, Dispatcher
  ui/            HUD, TechPanel, Toast, TitleScreen
  *.gd           Station, Lane, Ship, BuildTool, MapGen, Backdrop, CameraRig
art/vox/         MagicaVoxel sources for the ship sprites
tools/           asset generators (see art notes below)
assets/          generated and imported art
```

State lives in the four autoloads, so reloading `Main.tscn` restarts a run.

Everything that stands on the field — stations and ships alike — is parented to
a single y-sorted `World` node, so a ship crossing in front of a station draws
over it and one crossing behind draws under it. Lane lines and the tilemap sit
below on fixed z-indices, since they are painted on the ground.

## Milestones

All six from LANES_MVP.md section 8 are implemented: map and stations, the build
tool and lanes, ship spawning and delivery, capacity/queues/patience/collisions
and game over, the ten-node tech tree, and the polish pass (lane tinting, toasts,
explosions, speed control, title screen).

## Art

Ship sprites are isometric directional sheets rendered from the MagicaVoxel
models in `art/vox/` by `tools/vox_to_sprite.py` — eight headings each, drawn in
the same 2:1 projection as the terrain and picked by direction of travel rather
than rotated. Everything else -- terrain tiles, station sprites, the
explosion strip, UI panel and icons -- is a placeholder written by
`tools/gen_placeholder_art.py`, sized to the spec's checklist and meant to be
replaced with the CC0 art in section 9. The planets in `assets/planets/` are
backdrop only; nothing in the simulation touches them.

See [art/README.md](art/README.md) for how to regenerate any of it.

> This repository previously held two unrelated projects (ClaimTrail, then
> Giantfall); both remain in git history.
