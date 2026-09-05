# Art

Tile models are authored as Blender scripts rather than saved `.blend` files, so
the geometry is reviewable in a diff and rebuilds identically for everyone.

## Building the grass tiles

1. Open Blender 3.x / 4.x / 5.x.
2. Scripting tab → Open → `art/blender/grass_tiles.py` → Run Script (Alt+P).
3. Five variants appear in a `Tiles_Grass` collection, laid out along +X:

   | Object | Contents |
   |---|---|
   | `Tile_Grass_00_Plain` | bare turf |
   | `Tile_Grass_01_Tyre` | half-buried tyre, grass through it |
   | `Tile_Grass_02_Bricks` | scattered bricks + bent road-sign post |
   | `Tile_Grass_03_Tarmac` | cracked tarmac patch with faded road line |
   | `Tile_Grass_04_Thistle` | thistle clump + rusted paint can |

All five share one `Turf` mesh datablock; only `Props` differs per variant.
The octagon is flat-to-flat 1.0 unit with its base at z = 0, matching
`OctGrid.APOTHEM` on the engine side.

## Exporting for the engine

Export one glTF per variant into `assets/tiles/grass/`, named after the object:
`Tile_Grass_00_Plain.glb` and so on. `TileTypes.grass_asset_path()` builds those
paths and `TileMeshFactory` picks them up automatically.

For each variant:

1. **Move the root empty to the world origin first.** The script spreads the
   variants along +X for viewing, and glTF export bakes world transforms — an
   un-zeroed root exports a tile whose origin is metres away from its geometry.
2. Select the root empty and its children.
3. File → Export → glTF 2.0 (`.glb`).
4. Tick **Include → Selected Objects**, leave **Transform → +Y Up** on (the
   default), and keep vertex colours enabled under **Data → Mesh**.

Until those files exist the game renders a procedural stand-in built by
`TileMeshFactory.build_turf_mesh()`, which mirrors the same turf geometry and
palette but has no props. The HUD says which of the two you are looking at.

If you change the palette in `grass_tiles.py`, mirror it in
`scripts/render/tile_palette.gd` so placeholders and authored art stay in step.
