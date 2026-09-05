extends Node2D

## Distant planets behind the asteroid field. Pure set dressing -- nothing here
## is clickable, pathable or simulated; the build tool and dispatcher never see
## these nodes.

const PLANETS := [
	"res://assets/planets/verdant.png",
	"res://assets/planets/terran.png",
	"res://assets/planets/orchid.png",
	"res://assets/planets/ember.png",
	"res://assets/planets/dust.png",
	"res://assets/planets/glacier.png",
	"res://assets/planets/amethyst.png",
	"res://assets/planets/cinder.png",
	"res://assets/planets/rust.png",
	"res://assets/planets/slate.png",
]

const COUNT := 4
const MIN_SCALE := 0.10
const MAX_SCALE := 0.26
const ALPHA := 0.5


## Ring the playfield with a few bodies, far enough out that they never sit
## under a station. Seeded from the map so a given field always looks the same.
func build(seed_value: int, centre: Vector2, radius: float) -> void:
	for child in get_children():
		child.queue_free()

	var rng := RandomNumberGenerator.new()
	rng.seed = seed_value

	var pool := PLANETS.duplicate()
	for i in mini(COUNT, pool.size()):
		var pick: int = rng.randi_range(0, pool.size() - 1)
		var path: String = pool[pick]
		pool.remove_at(pick)

		var tex := load(path)
		if tex == null:
			continue

		var sprite := Sprite2D.new()
		sprite.texture = tex
		sprite.z_index = -100
		sprite.z_as_relative = false

		var angle := TAU * (float(i) / COUNT) + rng.randf_range(-0.4, 0.4)
		var distance := radius * rng.randf_range(1.3, 2.1)
		sprite.position = centre + Vector2(cos(angle), sin(angle) * 0.6) * distance

		var s := rng.randf_range(MIN_SCALE, MAX_SCALE)
		sprite.scale = Vector2(s, s)
		sprite.modulate = Color(1, 1, 1, ALPHA)
		add_child(sprite)
