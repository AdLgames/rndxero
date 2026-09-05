class_name MapGen
extends RefCounted

## Builds the 24x24 asteroid field and answers line-of-sight questions for the
## build tool. Terrain values index straight into the tile atlas strip written
## by tools/gen_placeholder_art.py.

enum Terrain { VOID, ROCK, ICE, CRATER, ASTEROID }

## Rock and asteroid break line of sight; void, ice and crater do not.
const BLOCKING := [Terrain.ROCK, Terrain.ASTEROID]

const TILE_SIZE := Vector2i(64, 32)
const ATLAS_PATH := "res://assets/tiles/terrain_atlas.png"

var width: int
var height: int
var terrain: PackedByteArray


func _init(w: int, h: int) -> void:
	width = w
	height = h
	terrain = PackedByteArray()
	terrain.resize(w * h)


func at(cell: Vector2i) -> int:
	return terrain[cell.y * width + cell.x]


func set_at(cell: Vector2i, value: int) -> void:
	if in_bounds(cell):
		terrain[cell.y * width + cell.x] = value


func in_bounds(cell: Vector2i) -> bool:
	return cell.x >= 0 and cell.y >= 0 and cell.x < width and cell.y < height


## Scatter debris, then guarantee the field is actually playable: two corridors
## are carved clear and the third station pair is deliberately walled off, so
## line of sight is a real constraint without being a dead end.
func generate(seed_value: int, station_cells: Array, clear_pairs: Array, block_pairs: Array) -> void:
	var rng := RandomNumberGenerator.new()
	rng.seed = seed_value

	for i in terrain.size():
		var roll := rng.randf()
		if roll < 0.10:
			terrain[i] = Terrain.ROCK
		elif roll < 0.18:
			terrain[i] = Terrain.ICE
		elif roll < 0.24:
			terrain[i] = Terrain.CRATER
		elif roll < 0.32:
			terrain[i] = Terrain.ASTEROID
		else:
			terrain[i] = Terrain.VOID

	for pair in clear_pairs:
		_carve(pair[0], pair[1])
	for pair in block_pairs:
		_wall(pair[0], pair[1], rng)
	for cell in station_cells:
		set_at(cell, Terrain.ASTEROID)


func _carve(a: Vector2i, b: Vector2i) -> void:
	for cell in cells_between(a, b):
		set_at(cell, Terrain.VOID)
		# Widen by one so a slightly off-axis lane still has sight.
		set_at(cell + Vector2i(1, 0), Terrain.VOID)
		set_at(cell + Vector2i(0, 1), Terrain.VOID)


func _wall(a: Vector2i, b: Vector2i, rng: RandomNumberGenerator) -> void:
	var mid := Vector2i(int(round((a.x + b.x) / 2.0)), int(round((a.y + b.y) / 2.0)))
	for dy in range(-2, 3):
		for dx in range(-2, 3):
			if abs(dx) + abs(dy) > 3:
				continue
			var kind := Terrain.ROCK if rng.randf() < 0.6 else Terrain.ASTEROID
			set_at(mid + Vector2i(dx, dy), kind)


## Every cell a straight line from `a` to `b` passes through, endpoints included.
func cells_between(a: Vector2i, b: Vector2i) -> Array:
	var out: Array = []
	var delta := Vector2(b - a)
	var steps := int(ceil(maxf(absf(delta.x), absf(delta.y)) * 2.0))
	if steps <= 0:
		return [a]
	var last := Vector2i(-9999, -9999)
	for i in range(steps + 1):
		var t := float(i) / float(steps)
		var p := Vector2(a) + delta * t
		var cell := Vector2i(int(round(p.x)), int(round(p.y)))
		if cell != last:
			out.append(cell)
			last = cell
	return out


## True when a lane could run between these two cells. Endpoints are skipped --
## stations themselves sit on asteroid tiles.
func line_of_sight(a: Vector2i, b: Vector2i) -> bool:
	for cell in cells_between(a, b):
		if cell == a or cell == b:
			continue
		if not in_bounds(cell):
			return false
		if BLOCKING.has(at(cell)):
			return false
	return true


func tile_distance(a: Vector2i, b: Vector2i) -> float:
	return Vector2(a).distance_to(Vector2(b))


## The TileSet is assembled here rather than saved as a .tres so the atlas
## layout stays described in one place alongside the generator that writes it.
static func build_tileset() -> TileSet:
	var ts := TileSet.new()
	ts.tile_shape = TileSet.TILE_SHAPE_ISOMETRIC
	ts.tile_layout = TileSet.TILE_LAYOUT_DIAMOND_DOWN
	ts.tile_offset_axis = TileSet.TILE_OFFSET_AXIS_HORIZONTAL
	ts.tile_size = TILE_SIZE

	var source := TileSetAtlasSource.new()
	source.texture = load(ATLAS_PATH)
	source.texture_region_size = TILE_SIZE
	for i in Terrain.size():
		source.create_tile(Vector2i(i, 0))
	ts.add_source(source, 0)
	return ts


func paint(layer: TileMapLayer) -> void:
	layer.tile_set = build_tileset()
	layer.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	for y in height:
		for x in width:
			layer.set_cell(Vector2i(x, y), 0, Vector2i(at(Vector2i(x, y)), 0))
