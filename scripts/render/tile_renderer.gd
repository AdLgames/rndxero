class_name TileRenderer
extends Node3D

## Draws the ground layer with one MultiMeshInstance3D per tile variant
## (GAME_DESIGN.md section 8). A 120x120 map is 14,400 octagons, which is far
## too many nodes to place individually but only a handful of draw calls this
## way.
##
## Fog of war hides a tile by scaling its instance to zero, as section 10
## specifies, rather than by rebuilding the multimesh.

const HIDDEN_SCALE := 0.0001

var _grid: OctGrid
var _factory := TileMeshFactory.new()

## Per tile, which multimesh it lives in and at which instance slot.
var _variant_of: PackedByteArray = PackedByteArray()
var _slot_of: PackedInt32Array = PackedInt32Array()
var _visible_flags: PackedByteArray = PackedByteArray()
var _multimeshes: Array[MultiMesh] = []


func build(grid: OctGrid, seed_value: int) -> void:
	_grid = grid
	var count := grid.tile_count()
	_variant_of.resize(count)
	_slot_of.resize(count)
	_visible_flags.resize(count)
	_multimeshes.clear()
	for child in get_children():
		child.queue_free()

	var variant_count := TileTypes.GRASS_VARIANTS.size()
	var buckets: Array[Array] = []
	for v in variant_count:
		buckets.append([])

	for i in count:
		var tile := grid.from_index(i)
		var variant := TileTypes.pick_grass_variant(tile, seed_value)
		_variant_of[i] = variant
		_slot_of[i] = buckets[variant].size()
		_visible_flags[i] = 1
		buckets[variant].append(i)

	for v in variant_count:
		var mm := MultiMesh.new()
		mm.transform_format = MultiMesh.TRANSFORM_3D
		mm.mesh = _factory.grass_mesh(v)
		mm.instance_count = buckets[v].size()
		for slot in buckets[v].size():
			var tile := grid.from_index(buckets[v][slot])
			mm.set_instance_transform(slot, Transform3D(Basis.IDENTITY, grid.tile_to_world(tile)))
		_multimeshes.append(mm)

		var node := MultiMeshInstance3D.new()
		node.name = TileTypes.GRASS_VARIANTS[v]
		node.multimesh = mm
		add_child(node)


func using_authored_art() -> bool:
	return _factory.has_authored_assets()


func variant_at(tile: Vector2i) -> int:
	return _variant_of[_grid.index(tile)]


## Fog of war: unseen tiles are not drawn at all.
func set_tile_visible(tile: Vector2i, is_shown: bool) -> void:
	if not _grid.in_bounds(tile):
		return
	var i := _grid.index(tile)
	var flag := 1 if is_shown else 0
	if _visible_flags[i] == flag:
		return
	_visible_flags[i] = flag
	var factor := Vector3.ONE if is_shown else Vector3.ONE * HIDDEN_SCALE
	var xform := Transform3D(Basis.IDENTITY.scaled(factor), _grid.tile_to_world(tile))
	_multimeshes[_variant_of[i]].set_instance_transform(_slot_of[i], xform)
