class_name TileTypes
extends RefCounted

## Terrain layers from GAME_DESIGN.md section 9. Only GRASS has art so far.
enum Terrain { WATER, GRASS, HILL, MOUNTAIN, FOREST, MARSH }

## Grass ground variants built by art/blender/grass_tiles.py (art spec 2.1).
## Order and names match the VARIANTS list in that script.
const GRASS_VARIANTS: Array[String] = [
	"Tile_Grass_00_Plain",
	"Tile_Grass_01_Tyre",
	"Tile_Grass_02_Bricks",
	"Tile_Grass_03_Tarmac",
	"Tile_Grass_04_Thistle",
]

## Plain dominates; the dressed variants are scenery accents, not a checkerboard.
const GRASS_WEIGHTS: PackedFloat32Array = PackedFloat32Array([0.62, 0.09, 0.10, 0.09, 0.10])

const GRASS_ASSET_DIR := "res://assets/tiles/grass/"


static func grass_asset_path(variant: int) -> String:
	return GRASS_ASSET_DIR + GRASS_VARIANTS[variant] + ".glb"


## Deterministic variant choice, so a tile looks the same every time the map is
## generated from the same seed and nothing needs to be stored per tile.
static func pick_grass_variant(tile: Vector2i, seed_value: int) -> int:
	var h := hash(Vector3i(tile.x, tile.y, seed_value))
	var r := float(h % 100000) / 100000.0
	var acc := 0.0
	for i in GRASS_WEIGHTS.size():
		acc += GRASS_WEIGHTS[i]
		if r < acc:
			return i
	return 0
