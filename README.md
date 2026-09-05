# Giantfall

Post-apocalyptic village builder / wave defense. Godot 4, octagon-grid map,
neighbor settlements with specialties, periodic Giant bosses.

See [GAME_DESIGN.md](GAME_DESIGN.md) for the full design document.

## Running

Open the project folder in Godot 4 and press play. `scenes/main.tscn` is the
main scene.

- **WASD** pan, **Q/E** rotate the view in 90° steps, **mouse wheel** zoom
- Hovering highlights the octagon under the cursor; clicking prints its
  coordinates and grass variant

## Where things are

```
scenes/main.tscn        entry scene
scripts/grid/           octagon + gap-square coordinate math, tile catalog
scripts/render/         MultiMesh tile rendering, palette, mesh factory
scripts/camera/         orthographic camera rig
art/blender/            tile-authoring scripts (see art/README.md)
assets/tiles/           exported glTF tiles, generated from art/ (untracked art output)
```

## Status

Roadmap step 1 of [GAME_DESIGN.md §11](GAME_DESIGN.md) — grid, MultiMesh render
and click-to-tile picking. Every tile is grass; world generation, fog, buildings
and waves are still to come.

Tile art is authored in Blender and exported to `assets/tiles/`. Until that
export exists the game draws a procedural stand-in with the same geometry and
palette, and the HUD tells you which you are looking at. See
[art/README.md](art/README.md).

> This repository previously held an unrelated project (ClaimTrail); that
> history is preserved in git.
