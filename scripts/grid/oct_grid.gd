class_name OctGrid
extends RefCounted

## Truncated square tiling: regular octagons on a unit lattice, with square
## gaps at the octagon corners (GAME_DESIGN.md section 8).
##
## Octagons are flat-to-flat 1.0, so neighbouring octagons share their flat
## edges directly and the pitch between centres is 1.0. The leftover corner
## gaps are squares of side 0.4142 standing on a diagonal.
##
## Octagon (x, y) has its centre at world (x, 0, y).
## Gap (gx, gy) sits at world (gx - 0.5, 0, gy - 0.5) and touches the four
## octagons (gx-1, gy-1), (gx, gy-1), (gx-1, gy), (gx, gy) -- so the gap grid
## is one wider and one taller than the octagon grid, and interior gaps are
## shared by four neighbours exactly as the design document describes.

const APOTHEM := 0.5
const PITCH := 1.0
const RCORNER := 0.541196100146197   ## APOTHEM / cos(PI/8)
const SIDE := 0.414213562373095      ## 2 * APOTHEM * tan(PI/8)

## A point is inside the octagon when |dx| + |dy| <= this; beyond it, the point
## lies in one of the four corner gaps. Equals APOTHEM * sqrt(2).
const OCT_DIAG_LIMIT := 0.707106781186548

## Orthogonal neighbours share an octagon edge; diagonal neighbours are only
## connected through the gap square between them.
const ORTHO_DIRS: Array[Vector2i] = [
	Vector2i(1, 0), Vector2i(-1, 0), Vector2i(0, 1), Vector2i(0, -1),
]
const DIAG_DIRS: Array[Vector2i] = [
	Vector2i(1, 1), Vector2i(-1, -1), Vector2i(1, -1), Vector2i(-1, 1),
]

var width: int
var height: int


func _init(w: int, h: int) -> void:
	width = w
	height = h


# --- octagon layer ----------------------------------------------------------

func tile_count() -> int:
	return width * height


func in_bounds(t: Vector2i) -> bool:
	return t.x >= 0 and t.y >= 0 and t.x < width and t.y < height


func index(t: Vector2i) -> int:
	return t.y * width + t.x


func from_index(i: int) -> Vector2i:
	return Vector2i(i % width, i / width)


func tile_to_world(t: Vector2i) -> Vector3:
	return Vector3(t.x * PITCH, 0.0, t.y * PITCH)


# --- gap layer --------------------------------------------------------------

func gap_width() -> int:
	return width + 1


func gap_count() -> int:
	return (width + 1) * (height + 1)


func gap_in_bounds(g: Vector2i) -> bool:
	return g.x >= 0 and g.y >= 0 and g.x <= width and g.y <= height


func gap_index(g: Vector2i) -> int:
	return g.y * (width + 1) + g.x


func gap_to_world(g: Vector2i) -> Vector3:
	return Vector3((g.x - 0.5) * PITCH, 0.0, (g.y - 0.5) * PITCH)


## The four octagons touching a gap. Entries may be out of bounds at the map
## border; callers should filter with in_bounds().
func gap_neighbours(g: Vector2i) -> Array[Vector2i]:
	return [
		Vector2i(g.x - 1, g.y - 1), Vector2i(g.x, g.y - 1),
		Vector2i(g.x - 1, g.y), Vector2i(g.x, g.y),
	]


## The gap a diagonal step passes through. `dir` must be one of DIAG_DIRS.
func gap_for_diagonal(t: Vector2i, dir: Vector2i) -> Vector2i:
	return Vector2i(t.x + maxi(dir.x, 0), t.y + maxi(dir.y, 0))


## Eight-connected neighbours. A diagonal step is dropped when `blocked_gaps`
## marks the gap it crosses -- that is how a wall built in a gap square cuts the
## diagonal edge between the octagons it separates.
func neighbours(t: Vector2i, blocked_gaps: PackedByteArray = PackedByteArray()) -> Array[Vector2i]:
	var out: Array[Vector2i] = []
	for d in ORTHO_DIRS:
		var n := t + d
		if in_bounds(n):
			out.append(n)
	for d in DIAG_DIRS:
		var n := t + d
		if not in_bounds(n):
			continue
		if not blocked_gaps.is_empty():
			var gi := gap_index(gap_for_diagonal(t, d))
			if gi < blocked_gaps.size() and blocked_gaps[gi] != 0:
				continue
		out.append(n)
	return out


# --- picking ----------------------------------------------------------------

## Which octagon (if any) a world point falls in. Returns false in `hit` when
## the point landed in a gap square rather than on buildable land.
func world_to_tile(p: Vector3) -> Dictionary:
	var fx := p.x / PITCH
	var fy := p.z / PITCH
	var t := Vector2i(roundi(fx), roundi(fy))
	var dx: float = absf(fx - t.x) * PITCH
	var dy: float = absf(fy - t.y) * PITCH
	var on_octagon := (dx + dy) <= OCT_DIAG_LIMIT
	return {
		"tile": t,
		"hit": on_octagon and in_bounds(t),
		"on_gap": not on_octagon,
	}
