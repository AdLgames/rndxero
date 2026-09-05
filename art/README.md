# Art pipeline

Two generators, both plain-stdlib Python — no Pillow, no downloads, nothing to
install. Re-run either at any time; both write straight into `assets/`.

## Ship sprites (from voxel models)

`art/vox/` holds the MagicaVoxel sources. The `.obj`/`.mtl` exports that came
alongside them are **not** kept: MagicaVoxel's OBJ puts all colour in a separate
palette texture that was not part of the export, so the OBJ alone renders
untextured. The `.vox` carries both the voxel grid and its 256-entry palette,
which is what `tools/vox_to_sprite.py` reads.

Ships are top-down and rotated to the lane angle at runtime, so the renderer
projects straight down the vertical axis, keeps the topmost voxel per column,
shades it by height, and box-filters down to the spec's 16–32px band.

```
python3 tools/vox_to_sprite.py art/vox/MeteorSlicer.vox        assets/ships/consumer.png   --scale 2 --yaw 1 --max-size 22
python3 tools/vox_to_sprite.py art/vox/UltravioletIntruder.vox assets/ships/commercial.png --scale 2 --yaw 1 --max-size 30
python3 tools/vox_to_sprite.py art/vox/Warship.vox             assets/ships/heavy.png      --scale 2 --yaw 1 --max-size 38
```

`--yaw 1` is a single 90° grid turn, which puts each model's nose on +X — the
heading `Ship.gd` rotates from. `--max-size` sets the long edge in pixels.

Models are mapped to classes by size: MeteorSlicer is the smallest so it flies
as Consumer, Warship the largest so it hauls as Heavy. Swapping any of them is a
one-line change to the `sprite` entry in `scripts/ShipTypes.gd`.

## Everything else (placeholders)

```
python3 tools/gen_placeholder_art.py
```

Writes the five 64×32 isometric terrain tiles (as one atlas strip, in the order
`MapGen.Terrain` expects), three station sprites, the four-frame explosion strip,
and the UI panel and icons. These stand in for the CC0 art in LANES_MVP.md
section 9; replacing one means overwriting the file at the same size.

Not yet sourced: the pixel font on the checklist. The game uses Godot's default
font until one is dropped in.

## Planets

`assets/planets/` is backdrop art, placed by `scripts/Backdrop.gd` in a ring well
outside the playfield at low opacity. Decorative only — the build tool, the
dispatcher and the map generator never see these nodes. Change `COUNT`,
`MIN_SCALE`/`MAX_SCALE` or `ALPHA` there to dial it back or up.
