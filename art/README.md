# Art pipeline

Two generators, both plain-stdlib Python — no Pillow, no downloads, nothing to
install. Re-run either at any time; both write straight into `assets/`.

## Ship sprites (from voxel models)

`art/vox/` holds the MagicaVoxel sources. The `.obj`/`.mtl` exports that came
alongside them are **not** kept: MagicaVoxel's OBJ puts all colour in a separate
palette texture that was not part of the export, so the OBJ alone renders
untextured. The `.vox` carries both the voxel grid and its 256-entry palette,
which is what `tools/vox_to_sprite.py` reads.

The world is isometric, so ships are rendered **in the same 2:1 projection as
the terrain**, once per heading, into a horizontal strip. They are never
rotated at runtime — rotating an isometric sprite shears the projection and
flattens the model. `Ship.face()` inverts the projection to recover the world
heading and picks the matching frame.

```
python3 tools/vox_to_sprite.py art/vox/MeteorSlicer.vox        assets/ships/consumer.png   --frames 8 --scale 3 --base-turns 1 --max-size 24
python3 tools/vox_to_sprite.py art/vox/UltravioletIntruder.vox assets/ships/commercial.png --frames 8 --scale 3 --base-turns 1 --max-size 32
python3 tools/vox_to_sprite.py art/vox/Warship.vox             assets/ships/heavy.png      --frames 8 --scale 3 --base-turns 1 --max-size 40
```

- `--frames` must match `ShipTypes.SPRITE_FRAMES`. Raise both together for
  smoother turning at the cost of sheet width.
- `--base-turns` is 90° turns applied before the frame angles, to put a model's
  nose on +X so that frame 0 faces the heading the game calls zero. One turn is
  right for these three: rendered at `--base-turns 1`, the Warship's thrusters
  sit at the rear of frame 0. `--base-turns 3` flies it backwards. The
  Intruder is close to symmetric front-to-back, so its orientation is a
  judgement call rather than something the model makes obvious.
- `--max-size` sets the long edge of a single frame, in pixels.

Each voxel is drawn as its top face plus the two side faces that turn toward
the camera, far-to-near, with the top lit brightest — that shading is what
gives the sprites their volume. Voxels enclosed on all six sides are skipped.

Models are mapped to classes by size: MeteorSlicer is the smallest so it flies
as Consumer, Warship the largest so it hauls as Heavy. Swapping any of them is a
one-line change to the `sprite` entry in `scripts/ShipTypes.gd`.

## Everything else (placeholders)

```
python3 tools/gen_placeholder_art.py
```

Writes the five 64×32 isometric terrain tiles (as one atlas strip, in the order
`MapGen.Terrain` expects), three station sprites, the four-frame explosion strip,
and the UI panel and icons. Stations are drawn as isometric volumes — top face
plus two shaded sides, same projection as the tiles — so they read as objects
standing on the field rather than stickers laid over it. Ship sprites are *not*
written here; see above. These stand in for the CC0 art in LANES_MVP.md
section 9; replacing one means overwriting the file at the same size.

Not yet sourced: the pixel font on the checklist. The game uses Godot's default
font until one is dropped in.

## Planets

`assets/planets/` is backdrop art, placed by `scripts/Backdrop.gd` in a ring well
outside the playfield at low opacity. Decorative only — the build tool, the
dispatcher and the map generator never see these nodes. Change `COUNT`,
`MIN_SCALE`/`MAX_SCALE` or `ALPHA` there to dial it back or up.
