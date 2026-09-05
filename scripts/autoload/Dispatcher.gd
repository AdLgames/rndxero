extends Node

## The traffic graph: which stations exist, which lanes join them, and which
## queued ship gets to move next. Runs on a fixed tick rather than every frame
## so dispatch order stays stable regardless of framerate or game speed.

const TICK := 0.25

var stations: Dictionary = {}    ## id -> Station
var lanes: Array = []
var adjacency: Dictionary = {}   ## station id -> Array of lanes

var _tick_accum: float = 0.0


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS


func clear() -> void:
	stations.clear()
	lanes.clear()
	adjacency.clear()
	_tick_accum = 0.0


func register_station(station) -> void:
	stations[station.station_id] = station
	if not adjacency.has(station.station_id):
		adjacency[station.station_id] = []


func register_lane(lane) -> void:
	lanes.append(lane)
	adjacency[lane.station_a.station_id].append(lane)
	adjacency[lane.station_b.station_id].append(lane)


func has_lane_between(a_id: String, b_id: String) -> bool:
	for lane in adjacency.get(a_id, []):
		if lane.other_end(stations[a_id]).station_id == b_id:
			return true
	return false


# --- routing ----------------------------------------------------------------

## Shortest path by lane count, or by accumulated lane load once Smart Dispatch
## is unlocked. Returns the lanes to traverse, or an empty array if unreachable.
func find_path(from_id: String, to_id: String) -> Array:
	if from_id == to_id or not stations.has(from_id) or not stations.has(to_id):
		return []

	var weighted := TechManager.flag("load_routing")
	var dist: Dictionary = {from_id: 0.0}
	var prev_lane: Dictionary = {}
	var prev_node: Dictionary = {}
	var settled: Dictionary = {}

	while true:
		# Tiny graph (three stations in the MVP), so a linear scan for the next
		# node is cheaper than maintaining a heap.
		var current := ""
		var best := INF
		for id in dist:
			if not settled.has(id) and dist[id] < best:
				best = dist[id]
				current = id
		if current == "":
			break
		if current == to_id:
			break
		settled[current] = true

		for lane in adjacency.get(current, []):
			var neighbour = lane.other_end(stations[current])
			var n_id: String = neighbour.station_id
			if settled.has(n_id):
				continue
			var step := 1.0
			if weighted:
				# +1 keeps an empty lane from being free, so hop count still
				# matters when nothing is congested.
				step = 1.0 + float(lane.load_units())
			var candidate: float = dist[current] + step
			if not dist.has(n_id) or candidate < dist[n_id]:
				dist[n_id] = candidate
				prev_lane[n_id] = lane
				prev_node[n_id] = current

	if not prev_lane.has(to_id):
		return []

	var path: Array = []
	var cursor := to_id
	while cursor != from_id:
		path.push_front(prev_lane[cursor])
		cursor = prev_node[cursor]
	return path


## Station ids this one can currently ship to. Used to avoid spawning cargo for
## a destination the network cannot serve yet.
func reachable_from(from_id: String) -> Array:
	var out: Array = []
	if not stations.has(from_id):
		return out
	var seen := {from_id: true}
	var frontier: Array = [from_id]
	while not frontier.is_empty():
		var current: String = frontier.pop_front()
		for lane in adjacency.get(current, []):
			var n_id: String = lane.other_end(stations[current]).station_id
			if seen.has(n_id):
				continue
			seen[n_id] = true
			out.append(n_id)
			frontier.append(n_id)
	return out


# --- dispatch ---------------------------------------------------------------

func _process(delta: float) -> void:
	if not Game.running:
		return
	_tick_accum += delta
	while _tick_accum >= TICK:
		_tick_accum -= TICK
		for id in stations:
			try_dispatch(stations[id])


func try_dispatch(station) -> void:
	if station.queue.is_empty():
		return
	for ship in _dispatch_order(station):
		if not is_instance_valid(ship):
			continue
		if ship.path.is_empty():
			ship.path = find_path(station.station_id, ship.dest_id)
			if ship.path.is_empty():
				continue
		var lane = ship.path[0]
		if not is_instance_valid(lane) or not lane.can_accept(ship):
			continue
		station.queue.erase(ship)
		ship.path.pop_front()
		ship.visible = true
		lane.add_ship(ship, station)


## FIFO, unless Express Priority is unlocked -- then consumer traffic is pulled
## to the front while everything else keeps its relative order.
func _dispatch_order(station) -> Array:
	if not TechManager.flag("express"):
		return station.queue.duplicate()
	var express: Array = []
	var rest: Array = []
	for ship in station.queue:
		if is_instance_valid(ship) and ship.ship_class == "consumer":
			express.append(ship)
		else:
			rest.append(ship)
	return express + rest
