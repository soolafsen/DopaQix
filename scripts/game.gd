extends Control

const AudioSynth = preload("res://scripts/audio_synth.gd")

const PROJECT_TITLE := "DopaQiX Native"
const SAVE_PATH := "user://progress.cfg"

const TILE_EMPTY := 0
const TILE_SAFE := 1
const TILE_TRAIL := 2

const CELL := 16
const COLS := 52
const ROWS := 34
const BOARD_RECT := Rect2(Vector2(240.0, 146.0), Vector2(COLS * CELL, ROWS * CELL))
const CARDINALS := [Vector2i.LEFT, Vector2i.RIGHT, Vector2i.UP, Vector2i.DOWN]

const MOVE_INTERVAL := 0.088
const SPARK_SPEED := 5.3
const ENEMY_SPEED_MIN := 122.0
const ENEMY_SPEED_MAX := 182.0
const START_LIVES := 3
const MAX_LIVES := 5
const START_GOAL := 62
const GOAL_STEP := 4
const GOAL_MAX := 80
const FINAL_LEVEL := 6

const PICKUP_META := {
	"rush": {"title": "RUSH DRIVE", "color": "ffd75e", "zone": "field", "duration": 8.0, "good": true},
	"shield": {"title": "NOVA SHIELD", "color": "66f5ff", "zone": "field", "duration": 9.0, "good": true},
	"hex": {"title": "HEX BOMB", "color": "ff537e", "zone": "rail", "duration": 7.0, "good": false},
	"heart": {"title": "EXTRA LIFE", "color": "ffffff", "zone": "rail", "duration": 0.0, "good": true}
}

const THEME_DATA := [
	{
		"name": "Velvet Voltage",
		"bg_a": "060b17",
		"bg_b": "251154",
		"bg_c": "ff49be",
		"rail": "67ecff",
		"claim_fill": "53b9ff22",
		"trail_a": "ffef74",
		"trail_b": "ff51c5",
		"enemy_core": "f7f3ff"
	},
	{
		"name": "Candy Reactor",
		"bg_a": "07101b",
		"bg_b": "103f6d",
		"bg_c": "78ff85",
		"rail": "89fff6",
		"claim_fill": "7fe1b822",
		"trail_a": "ffe368",
		"trail_b": "5efeff",
		"enemy_core": "fff6db"
	},
	{
		"name": "Noir Sugarstorm",
		"bg_a": "09070d",
		"bg_b": "32122e",
		"bg_c": "ff7f47",
		"rail": "f993ff",
		"claim_fill": "ff7aa11f",
		"trail_a": "fff69d",
		"trail_b": "ff6f91",
		"enemy_core": "ffffff"
	},
	{
		"name": "Blue Overkill",
		"bg_a": "040917",
		"bg_b": "162c78",
		"bg_c": "4ef4ff",
		"rail": "ffe061",
		"claim_fill": "6dd7ff20",
		"trail_a": "ff6df1",
		"trail_b": "5effff",
		"enemy_core": "effbff"
	}
]

var rng := RandomNumberGenerator.new()

var grid := []
var player := {}
var enemies := []
var sparks := []
var pickups := []
var particles := []
var floaters := []

var background_paths := []
var current_background: Texture2D
var current_theme := {}

var active_effects := {"rush": 0.0, "shield": 0.0, "hex": 0.0}
var score := 0
var high_score := 0
var lives := START_LIVES
var level := 1
var capture_percent := 0.0
var capture_goal := START_GOAL
var run_won := false

var state_name := "title"
var state_timer := 0.0
var banner_text := ""
var banner_timer := 0.0
var status_message := ""
var title_phase := 0.0
var danger_level := 0.0
var flash_strength := 0.0
var flash_color := Color.WHITE
var shake_strength := 0.0
var camera_offset := Vector2.ZERO
var rail_pickup_timer := 5.0
var field_pickup_timer := 6.0
var slice_sound_cooldown := 0.0

var music_enabled := true
var music_player: AudioStreamPlayer
var danger_player: AudioStreamPlayer
var sfx_players := []
var sfx_index := 0
var audio_streams := {}
var pause_button: Button
var resume_button: Button
var exit_button: Button


func _ready() -> void:
	rng.randomize()
	DisplayServer.window_set_title(PROJECT_TITLE)
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	_load_backgrounds()
	_ensure_input_actions()
	_build_audio()
	_build_ui()
	_load_progress()
	_reset_run_state()
	queue_redraw()


func _process(delta: float) -> void:
	title_phase += delta
	state_timer += delta
	banner_timer = max(0.0, banner_timer - delta)
	flash_strength = move_toward(flash_strength, 0.0, delta * 1.9)
	shake_strength = move_toward(shake_strength, 0.0, delta * 18.0)
	slice_sound_cooldown = max(0.0, slice_sound_cooldown - delta)
	camera_offset = Vector2.ZERO
	if shake_strength > 0.01:
		camera_offset = Vector2(rng.randf_range(-1.0, 1.0), rng.randf_range(-1.0, 1.0)) * shake_strength

	_update_effects(delta)
	_update_audio_mix()
	_layout_ui()
	_refresh_ui()

	match state_name:
		"title":
			if Input.is_action_just_pressed("accept"):
				_start_game()
		"paused":
			pass
		"death":
			if state_timer >= 1.0:
				if lives > 0:
					_respawn_after_death()
				else:
					_enter_game_over(false)
		"level_clear":
			if state_timer >= 2.3 or Input.is_action_just_pressed("accept"):
				if level >= FINAL_LEVEL:
					_enter_game_over(true)
				else:
					_start_level(level + 1)
		"game_over":
			if Input.is_action_just_pressed("accept"):
				_start_game()
		_:
			var danger := 0.0
			_update_player(delta)
			if state_name == "playing":
				danger = max(danger, _update_enemies(delta))
			if state_name == "playing":
				danger = max(danger, _update_sparks(delta))
			if state_name == "playing":
				_update_pickups(delta)
			_update_particles(delta)
			_update_floaters(delta)
			var blend_speed := 8.0 if danger > danger_level else 4.0
			danger_level = lerpf(danger_level, danger, min(1.0, delta * blend_speed))

	queue_redraw()


func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("pause"):
		if state_name in ["playing", "paused"]:
			_toggle_pause()
	elif event.is_action_pressed("toggle_music"):
		music_enabled = not music_enabled
		_save_progress()
		_update_audio_mix()


func _toggle_pause() -> void:
	if state_name == "playing":
		state_name = "paused"
		status_message = "Paused"
		_play_sfx("spark")
	elif state_name == "paused":
		state_name = "playing"
		status_message = ""
		_play_sfx("start")
	state_timer = 0.0


func _notification(what: int) -> void:
	if what == NOTIFICATION_RESIZED:
		_layout_ui()


func _start_game() -> void:
	score = 0
	lives = START_LIVES
	run_won = false
	level = 0
	_start_level(1)
	_play_sfx("start")


func _reset_run_state() -> void:
	score = 0
	lives = START_LIVES
	level = 1
	run_won = false
	status_message = ""
	state_name = "title"
	state_timer = 0.0
	banner_text = "Cut the field. Dodge the glow."
	banner_timer = 999.0
	_start_level_data(1)


func _start_level(level_number: int) -> void:
	level = level_number
	_start_level_data(level)
	state_name = "playing"
	state_timer = 0.0
	banner_text = "LEVEL %d  |  %d%% TO CLEAR" % [level, capture_goal]
	banner_timer = 2.3
	status_message = ""
	_flash(Color("8fefff"), 0.18)
	_shake(3.0)


func _start_level_data(level_number: int) -> void:
	capture_goal = min(START_GOAL + (level_number - 1) * GOAL_STEP, GOAL_MAX)
	current_theme = _theme_for_level(level_number)
	current_background = _pick_background_texture()
	active_effects = {"rush": 0.0, "shield": 0.0, "hex": 0.0}
	rail_pickup_timer = rng.randf_range(4.2, 6.4)
	field_pickup_timer = rng.randf_range(5.2, 7.6)
	_init_grid()
	_spawn_player()
	_spawn_enemies()
	_spawn_sparks()
	pickups.clear()
	particles.clear()
	floaters.clear()
	capture_percent = _compute_capture_percent()
	danger_level = 0.0


func _respawn_after_death() -> void:
	_spawn_player()
	_spawn_enemies()
	_spawn_sparks()
	pickups.clear()
	state_name = "playing"
	state_timer = 0.0
	status_message = "Back in."
	banner_text = "Keep cutting."
	banner_timer = 1.2


func _enter_game_over(won: bool) -> void:
	run_won = won
	state_name = "game_over"
	state_timer = 0.0
	if won:
		score += level * 2000
		banner_text = "BOARD DOMINATED"
		banner_timer = 2.6
		_play_sfx("level_clear")
	else:
		_play_sfx("game_over")
	if score > high_score:
		high_score = score
	_save_progress()


func _init_grid() -> void:
	grid.clear()
	for row in range(ROWS):
		var line := []
		for col in range(COLS):
			if row == 0 or row == ROWS - 1 or col == 0 or col == COLS - 1:
				line.append(TILE_SAFE)
			else:
				line.append(TILE_EMPTY)
		grid.append(line)


func _spawn_player() -> void:
	var start_row := ROWS / 2
	player = {
		"col": 0,
		"row": start_row,
		"dir": Vector2i.DOWN,
		"desired_dir": Vector2i.DOWN,
		"drawing": false,
		"trail": [],
		"trail_keys": {},
		"move_clock": 0.0
	}


func _spawn_enemies() -> void:
	enemies.clear()
	var count := 1 + int(level >= 3) + int(level >= 5)
	count = min(count, 3)
	for index in range(count):
		var spawn := _enemy_spawn_position(index, count)
		var angle := rng.randf_range(0.0, TAU)
		var speed := rng.randf_range(ENEMY_SPEED_MIN, ENEMY_SPEED_MAX) + level * 8.0
		enemies.append(
			{
				"x": spawn.x,
				"y": spawn.y,
				"vx": cos(angle) * speed,
				"vy": sin(angle) * speed,
				"angle": rng.randf_range(0.0, TAU),
				"spin": rng.randf_range(1.6, 2.8) * (-1.0 if rng.randf() < 0.5 else 1.0),
				"arm_a": rng.randf_range(26.0, 52.0),
				"arm_b": rng.randf_range(18.0, 46.0),
				"hue": rng.randf(),
				"history": []
			}
		)


func _spawn_sparks() -> void:
	sparks.clear()
	var count := 2 + int(level >= 4)
	var positions := [
		{"col": 0, "row": 0, "dir": Vector2i.RIGHT},
		{"col": COLS - 1, "row": 0, "dir": Vector2i.LEFT},
		{"col": COLS - 1, "row": ROWS - 1, "dir": Vector2i.UP}
	]
	for index in range(count):
		var seed = positions[index]
		sparks.append(
			{
				"col": seed["col"],
				"row": seed["row"],
				"dir": seed["dir"],
				"progress": 0.0,
				"history": [{"col": seed["col"], "row": seed["row"]}]
			}
		)


func _enemy_spawn_position(index: int, total: int) -> Vector2:
	var interior := BOARD_RECT.grow(-CELL * 4.0)
	if total == 1:
		return interior.get_center()
	if index == 0:
		return interior.position + Vector2(interior.size.x * 0.7, interior.size.y * 0.25)
	if index == 1:
		return interior.position + Vector2(interior.size.x * 0.25, interior.size.y * 0.7)
	return interior.position + Vector2(interior.size.x * 0.75, interior.size.y * 0.76)


func _update_player(delta: float) -> void:
	if state_name != "playing":
		return

	player["desired_dir"] = _read_input_direction(player["desired_dir"])
	player["move_clock"] += delta
	var interval := MOVE_INTERVAL
	if _effect_active("rush"):
		interval *= 0.62
	if _effect_active("hex"):
		interval *= 1.35

	while player["move_clock"] >= interval and state_name == "playing":
		player["move_clock"] -= interval
		if not _step_player():
			break


func _read_input_direction(fallback: Vector2i) -> Vector2i:
	if Input.is_action_pressed("move_left"):
		return Vector2i.LEFT
	if Input.is_action_pressed("move_right"):
		return Vector2i.RIGHT
	if Input.is_action_pressed("move_up"):
		return Vector2i.UP
	if Input.is_action_pressed("move_down"):
		return Vector2i.DOWN
	return fallback


func _step_player() -> bool:
	var desired: Vector2i = player["desired_dir"]
	var current: Vector2i = player["dir"]
	if desired != Vector2i.ZERO and _can_move(desired):
		current = desired
	elif not _can_move(current):
		return false

	var next_col: int = int(player["col"]) + current.x
	var next_row: int = int(player["row"]) + current.y
	var next_tile: int = int(grid[next_row][next_col])
	var next_key := _tile_key(next_col, next_row)
	player["dir"] = current

	if player["drawing"]:
		if next_key in player["trail_keys"]:
			_lose_life("You crossed your own cut.")
			return false
		if next_tile == TILE_SAFE:
			player["col"] = next_col
			player["row"] = next_row
			_finish_trail()
			return true
		if next_tile == TILE_EMPTY:
			player["col"] = next_col
			player["row"] = next_row
			grid[next_row][next_col] = TILE_TRAIL
			player["trail"].append({"col": next_col, "row": next_row})
			player["trail_keys"][next_key] = true
			_on_player_slice()
			return true
		return false

	if next_tile == TILE_SAFE:
		player["col"] = next_col
		player["row"] = next_row
		return true
	if next_tile == TILE_EMPTY:
		player["drawing"] = true
		player["col"] = next_col
		player["row"] = next_row
		grid[next_row][next_col] = TILE_TRAIL
		player["trail"] = [{"col": next_col, "row": next_row}]
		player["trail_keys"] = {next_key: true}
		_on_player_slice()
		return true
	return false


func _can_move(direction: Vector2i) -> bool:
	var next_col: int = int(player["col"]) + direction.x
	var next_row: int = int(player["row"]) + direction.y
	if not _inside(next_col, next_row):
		return false
	var next_tile: int = int(grid[next_row][next_col])
	if player["drawing"]:
		return next_tile == TILE_EMPTY or next_tile == TILE_SAFE
	return next_tile == TILE_SAFE or next_tile == TILE_EMPTY


func _on_player_slice() -> void:
	if slice_sound_cooldown <= 0.0:
		_play_sfx("slice")
		slice_sound_cooldown = 0.06
	var pos := _player_position()
	_spawn_particles(pos, _trail_color(), 4, 90.0, 0.24, 2.4)


func _finish_trail() -> void:
	for point in player["trail"]:
		grid[point["row"]][point["col"]] = TILE_SAFE
	var claimed := _claim_enclosed_area()
	player["drawing"] = false
	player["trail"].clear()
	player["trail_keys"].clear()
	capture_percent = _compute_capture_percent()
	if claimed > 0:
		var bonus := claimed * (12 + level * 2)
		score += bonus
		_flash(_theme_color("trail_b"), 0.24)
		_shake(min(12.0, 4.0 + claimed / 18.0))
		_spawn_capture_fx(claimed)
		_float_text(_player_position(), "+%d CLAIM" % bonus, _theme_color("trail_a"))
		_play_sfx("capture")

	if capture_percent >= capture_goal:
		score += int(capture_percent) * 25 * level
		state_name = "level_clear"
		state_timer = 0.0
		banner_text = "LEVEL %d CLEARED" % level
		banner_timer = 2.5
		_play_sfx("level_clear")


func _claim_enclosed_area() -> int:
	var reachable := []
	for row in range(ROWS):
		var line := []
		for _col in range(COLS):
			line.append(false)
		reachable.append(line)

	var queue := []
	for enemy in enemies:
		for sample in _enemy_sample_cells(enemy):
			if _inside(sample["col"], sample["row"]) and grid[sample["row"]][sample["col"]] == TILE_EMPTY and not reachable[sample["row"]][sample["col"]]:
				reachable[sample["row"]][sample["col"]] = true
				queue.append(sample)

	var cursor := 0
	while cursor < queue.size():
		var current = queue[cursor]
		cursor += 1
		for dir in CARDINALS:
			var nc: int = int(current["col"]) + dir.x
			var nr: int = int(current["row"]) + dir.y
			if _inside(nc, nr) and not reachable[nr][nc] and grid[nr][nc] == TILE_EMPTY:
				reachable[nr][nc] = true
				queue.append({"col": nc, "row": nr})

	var claimed := 0
	for row in range(1, ROWS - 1):
		for col in range(1, COLS - 1):
			if grid[row][col] == TILE_EMPTY and not reachable[row][col]:
				grid[row][col] = TILE_SAFE
				claimed += 1
	return claimed


func _enemy_sample_cells(enemy: Dictionary) -> Array:
	var samples := []
	var segments := _qix_segments(enemy)
	var points := [
		Vector2(enemy["x"], enemy["y"]),
		segments[0]["a"],
		segments[0]["b"],
		segments[1]["a"],
		segments[1]["b"],
		(segments[0]["a"] + segments[0]["b"]) * 0.5,
		(segments[1]["a"] + segments[1]["b"]) * 0.5
	]
	for point in points:
		var cell := _nearest_empty_cell(point)
		if cell:
			samples.append(cell)
	return samples


func _nearest_empty_cell(point: Vector2) -> Dictionary:
	var col: int = clamp(int((point.x - BOARD_RECT.position.x) / CELL), 1, COLS - 2)
	var row: int = clamp(int((point.y - BOARD_RECT.position.y) / CELL), 1, ROWS - 2)
	if grid[row][col] == TILE_EMPTY:
		return {"col": col, "row": row}
	for radius in range(1, 4):
		for y in range(row - radius, row + radius + 1):
			for x in range(col - radius, col + radius + 1):
				if _inside(x, y) and grid[y][x] == TILE_EMPTY:
					return {"col": x, "row": y}
	return {}


func _update_enemies(delta: float) -> float:
	var max_danger := 0.0
	for enemy in enemies:
		var speed_mult := 1.0 + level * 0.04
		if _effect_active("rush"):
			speed_mult *= 1.08
		if _effect_active("hex"):
			speed_mult *= 1.12

		var next_x: float = float(enemy["x"]) + float(enemy["vx"]) * speed_mult * delta
		var next_y: float = float(enemy["y"]) + float(enemy["vy"]) * speed_mult * delta
		enemy["angle"] += enemy["spin"] * delta
		enemy["hue"] = fmod(enemy["hue"] + delta * 0.1, 1.0)

		if _position_hits_barrier(Vector2(next_x, enemy["y"])):
			enemy["vx"] *= -1.0
			next_x = enemy["x"] + enemy["vx"] * speed_mult * delta
		if _position_hits_barrier(Vector2(enemy["x"], next_y)):
			enemy["vy"] *= -1.0
			next_y = enemy["y"] + enemy["vy"] * speed_mult * delta

		enemy["x"] = next_x
		enemy["y"] = next_y
		enemy["history"].push_front({"x": next_x, "y": next_y, "angle": enemy["angle"]})
		while enemy["history"].size() > 6:
			enemy["history"].pop_back()

		if player["drawing"] and _enemy_hits_trail(enemy):
			_lose_life("A QiX tore through your cut.")
			return 1.0

		var distance := _player_position().distance_to(Vector2(enemy["x"], enemy["y"]))
		max_danger = max(max_danger, clamp((270.0 - distance) / 210.0, 0.0, 1.0))
		if distance < CELL * 0.78 and player["drawing"]:
			_lose_life("The QiX core caught you.")
			return 1.0
	return max_danger


func _position_hits_barrier(point: Vector2) -> bool:
	if not BOARD_RECT.has_point(point):
		return true
	var col: int = clamp(int((point.x - BOARD_RECT.position.x) / CELL), 0, COLS - 1)
	var row: int = clamp(int((point.y - BOARD_RECT.position.y) / CELL), 0, ROWS - 1)
	return grid[row][col] != TILE_EMPTY


func _enemy_hits_trail(enemy: Dictionary) -> bool:
	if player["trail"].is_empty():
		return false
	var segments := _qix_segments(enemy)
	for point in player["trail"]:
		var pos := _cell_center(point["col"], point["row"])
		for segment in segments:
			if _distance_to_segment(pos, segment["a"], segment["b"]) <= CELL * 0.46:
				return true
	return false


func _qix_segments(enemy: Dictionary) -> Array:
	var angle: float = float(enemy["angle"])
	var a_dir := Vector2(cos(angle), sin(angle))
	var b_dir := Vector2(cos(angle + PI * 0.5), sin(angle + PI * 0.5))
	var center := Vector2(enemy["x"], enemy["y"])
	return [
		{"a": center - a_dir * enemy["arm_a"], "b": center + a_dir * enemy["arm_a"]},
		{"a": center - b_dir * enemy["arm_b"], "b": center + b_dir * enemy["arm_b"]}
	]


func _distance_to_segment(point: Vector2, a: Vector2, b: Vector2) -> float:
	var ab := b - a
	var t := 0.0
	var denom := ab.length_squared()
	if denom > 0.001:
		t = clamp((point - a).dot(ab) / denom, 0.0, 1.0)
	return point.distance_to(a + ab * t)


func _update_sparks(delta: float) -> float:
	var max_danger := 0.0
	var distances := _build_safe_distance_map(_spark_targets())
	for spark in sparks:
		var speed := SPARK_SPEED + level * 0.22
		if _effect_active("hex"):
			speed *= 1.28
		spark["progress"] += delta * speed
		while spark["progress"] >= 1.0:
			spark["progress"] -= 1.0
			var next = _choose_spark_step(spark, distances)
			spark["dir"] = Vector2i(next["col"] - spark["col"], next["row"] - spark["row"])
			spark["col"] = next["col"]
			spark["row"] = next["row"]
			spark["history"].push_front({"col": spark["col"], "row": spark["row"]})
			while spark["history"].size() > 6:
				spark["history"].pop_back()

			if player["drawing"] and grid[spark["row"]][spark["col"]] == TILE_TRAIL:
				_lose_life("A spark burned your line.")
				return 1.0
			if spark["col"] == player["col"] and spark["row"] == player["row"]:
				_lose_life("A spark tagged you.")
				return 1.0

		var distance: int = abs(int(spark["col"]) - int(player["col"])) + abs(int(spark["row"]) - int(player["row"]))
		max_danger = max(max_danger, clamp((14.0 - distance) / 9.0, 0.0, 1.0))
	return max_danger


func _spark_targets() -> Array:
	var targets := []
	if player["drawing"] and not player["trail"].is_empty():
		var head = player["trail"][0]
		for dir in CARDINALS:
			var nc: int = int(head["col"]) + dir.x
			var nr: int = int(head["row"]) + dir.y
			if _inside(nc, nr) and grid[nr][nc] == TILE_SAFE:
				targets.append({"col": nc, "row": nr})
	if targets.is_empty():
		targets.append({"col": player["col"], "row": player["row"]})
	return targets


func _build_safe_distance_map(targets: Array) -> Array:
	var distances := []
	for row in range(ROWS):
		var line := []
		for _col in range(COLS):
			line.append(999999)
		distances.append(line)

	var queue := []
	for target in targets:
		if _inside(target["col"], target["row"]) and grid[target["row"]][target["col"]] == TILE_SAFE:
			distances[target["row"]][target["col"]] = 0
			queue.append(target)

	var cursor := 0
	while cursor < queue.size():
		var current = queue[cursor]
		cursor += 1
		var base: int = int(distances[current["row"]][current["col"]]) + 1
		for neighbor in _safe_neighbors(current["col"], current["row"]):
			if base < distances[neighbor["row"]][neighbor["col"]]:
				distances[neighbor["row"]][neighbor["col"]] = base
				queue.append(neighbor)
	return distances


func _safe_neighbors(col: int, row: int) -> Array:
	var neighbors := []
	for dir in CARDINALS:
		var nc: int = col + dir.x
		var nr: int = row + dir.y
		if _inside(nc, nr) and grid[nr][nc] == TILE_SAFE:
			neighbors.append({"col": nc, "row": nr})
	return neighbors


func _choose_spark_step(spark: Dictionary, distances: Array) -> Dictionary:
	var best := {"col": spark["col"], "row": spark["row"], "score": 999999.0}
	var options := _safe_neighbors(spark["col"], spark["row"])
	for option in options:
		var score := float(distances[option["row"]][option["col"]])
		if score >= 999999.0:
			continue
		var dir := Vector2i(option["col"] - spark["col"], option["row"] - spark["row"])
		if dir == spark["dir"]:
			score -= 0.15
		elif dir == -spark["dir"]:
			score += 0.25
		if score < best["score"]:
			best = {"col": option["col"], "row": option["row"], "score": score}
	if best["score"] < 999999.0:
		return {"col": best["col"], "row": best["row"]}
	if not options.is_empty():
		return options[rng.randi_range(0, options.size() - 1)]
	return {"col": spark["col"], "row": spark["row"]}


func _update_pickups(delta: float) -> void:
	rail_pickup_timer -= delta
	field_pickup_timer -= delta
	if rail_pickup_timer <= 0.0:
		_spawn_rail_pickup()
	if field_pickup_timer <= 0.0:
		_spawn_field_pickup()

	var survivors := []
	for pickup in pickups:
		pickup["life"] -= delta
		pickup["wobble"] += delta * 4.0
		if pickup["life"] <= 0.0:
			continue
		if pickup["col"] == player["col"] and pickup["row"] == player["row"]:
			_collect_pickup(pickup)
			continue
		survivors.append(pickup)
	pickups = survivors


func _spawn_rail_pickup() -> void:
	rail_pickup_timer = rng.randf_range(5.0, 8.0)
	if _count_pickups_for_zone("rail") >= 1:
		return
	var cell = _random_safe_pickup_cell()
	if cell.is_empty():
		return
	var kind := "hex"
	if lives < MAX_LIVES and (level % 3 == 0 or rng.randf() < 0.35):
		kind = "heart"
	var meta = PICKUP_META[kind]
	pickups.append(
		{
			"kind": kind,
			"col": cell["col"],
			"row": cell["row"],
			"life": 10.0,
			"wobble": rng.randf_range(0.0, TAU),
			"zone": meta["zone"]
		}
	)


func _spawn_field_pickup() -> void:
	field_pickup_timer = rng.randf_range(5.8, 8.6)
	if _count_pickups_for_zone("field") >= 1:
		return
	var cell = _random_empty_field_cell()
	if cell.is_empty():
		return
	var kind := "rush" if rng.randf() < 0.68 or _effect_active("shield") else "shield"
	var meta = PICKUP_META[kind]
	pickups.append(
		{
			"kind": kind,
			"col": cell["col"],
			"row": cell["row"],
			"life": 11.0,
			"wobble": rng.randf_range(0.0, TAU),
			"zone": meta["zone"]
		}
	)


func _count_pickups_for_zone(zone: String) -> int:
	var count := 0
	for pickup in pickups:
		if pickup["zone"] == zone:
			count += 1
	return count


func _random_safe_pickup_cell() -> Dictionary:
	for _attempt in range(48):
		var col := rng.randi_range(0, COLS - 1)
		var row := rng.randi_range(0, ROWS - 1)
		if grid[row][col] != TILE_SAFE:
			continue
		if abs(col - player["col"]) + abs(row - player["row"]) < 8:
			continue
		var occupied := false
		for spark in sparks:
			if spark["col"] == col and spark["row"] == row:
				occupied = true
				break
		if occupied:
			continue
		return {"col": col, "row": row}
	return {}


func _random_empty_field_cell() -> Dictionary:
	for _attempt in range(64):
		var col := rng.randi_range(1, COLS - 2)
		var row := rng.randi_range(1, ROWS - 2)
		if grid[row][col] != TILE_EMPTY:
			continue
		if abs(col - player["col"]) + abs(row - player["row"]) < 6:
			continue
		return {"col": col, "row": row}
	return {}


func _collect_pickup(pickup: Dictionary) -> void:
	var kind: String = pickup["kind"]
	var meta = PICKUP_META[kind]
	var color := Color(meta["color"])
	_spawn_particles(_cell_center(pickup["col"], pickup["row"]), color, 20, 190.0, 0.55, 4.0)
	_float_text(_cell_center(pickup["col"], pickup["row"]), meta["title"], color)
	_flash(color, 0.18)
	_shake(5.0 if meta["good"] else 7.0)
	if kind == "heart":
		if lives < MAX_LIVES:
			lives += 1
		else:
			score += 900
		_play_sfx("pickup_good")
		return
	if kind == "shield":
		active_effects["shield"] = meta["duration"]
		_play_sfx("shield")
		return
	active_effects[kind] = meta["duration"]
	_play_sfx("pickup_good" if meta["good"] else "pickup_bad")


func _update_effects(delta: float) -> void:
	for key in active_effects.keys():
		active_effects[key] = max(0.0, active_effects[key] - delta)


func _effect_active(kind: String) -> bool:
	return active_effects.get(kind, 0.0) > 0.0


func _lose_life(reason: String) -> void:
	if state_name != "playing":
		return
	if _effect_active("shield"):
		active_effects["shield"] = 0.0
		_float_text(_player_position(), "SHIELD POP", Color("8fefff"))
		_spawn_particles(_player_position(), Color("8fefff"), 24, 220.0, 0.5, 3.6)
		_flash(Color("8fefff"), 0.16)
		_shake(6.0)
		_play_sfx("shield")
		return

	_clear_trail()
	lives -= 1
	state_name = "death"
	state_timer = 0.0
	status_message = reason
	_flash(Color("ff5252"), 0.32)
	_shake(10.0)
	_spawn_particles(_player_position(), Color("ff8b8b"), 28, 240.0, 0.62, 3.8)
	_float_text(_player_position(), "CRASH", Color("fff4c3"))
	_play_sfx("hit")


func _clear_trail() -> void:
	for point in player["trail"]:
		if grid[point["row"]][point["col"]] == TILE_TRAIL:
			grid[point["row"]][point["col"]] = TILE_EMPTY
	player["drawing"] = false
	player["trail"].clear()
	player["trail_keys"].clear()


func _spawn_capture_fx(claimed: int) -> void:
	var bursts: int = min(42, 10 + claimed / 9)
	for _index in range(bursts):
		var col := rng.randi_range(1, COLS - 2)
		var row := rng.randi_range(1, ROWS - 2)
		if grid[row][col] != TILE_SAFE:
			continue
		var point := _cell_center(col, row)
		_spawn_particles(point, _theme_color("trail_b"), 4, 130.0, 0.42, 3.0)
		_spawn_particles(point, Color.WHITE, 2, 90.0, 0.3, 2.0)


func _spawn_particles(position: Vector2, color: Color, amount: int, speed: float, life: float, size: float) -> void:
	for _index in range(amount):
		var direction := Vector2.RIGHT.rotated(rng.randf_range(0.0, TAU))
		var burst := speed * rng.randf_range(0.2, 1.0)
		particles.append(
			{
				"pos": position,
				"vel": direction * burst,
				"life": life * rng.randf_range(0.7, 1.2),
				"max_life": life,
				"color": color,
				"size": size * rng.randf_range(0.7, 1.3)
			}
		)


func _float_text(position: Vector2, text: String, color: Color) -> void:
	floaters.append(
		{
			"pos": position,
			"text": text,
			"color": color,
			"life": 1.0,
			"max_life": 1.0
		}
	)


func _update_particles(delta: float) -> void:
	var survivors := []
	for particle in particles:
		particle["life"] -= delta
		if particle["life"] <= 0.0:
			continue
		particle["pos"] += particle["vel"] * delta
		particle["vel"] *= max(0.0, 1.0 - delta * 2.8)
		survivors.append(particle)
	particles = survivors


func _update_floaters(delta: float) -> void:
	var survivors := []
	for floater in floaters:
		floater["life"] -= delta
		if floater["life"] <= 0.0:
			continue
		floater["pos"] += Vector2(0.0, -34.0) * delta
		survivors.append(floater)
	floaters = survivors


func _compute_capture_percent() -> float:
	var total := float((COLS - 2) * (ROWS - 2))
	var claimed := 0.0
	for row in range(1, ROWS - 1):
		for col in range(1, COLS - 1):
			if grid[row][col] == TILE_SAFE:
				claimed += 1.0
	return claimed / max(1.0, total) * 100.0


func _player_position() -> Vector2:
	return _cell_center(player["col"], player["row"])


func _cell_center(col: int, row: int) -> Vector2:
	return BOARD_RECT.position + Vector2(col * CELL + CELL * 0.5, row * CELL + CELL * 0.5)


func _cell_rect(col: int, row: int) -> Rect2:
	return Rect2(BOARD_RECT.position + Vector2(col * CELL, row * CELL), Vector2(CELL, CELL))


func _inside(col: int, row: int) -> bool:
	return col >= 0 and row >= 0 and col < COLS and row < ROWS


func _tile_key(col: int, row: int) -> String:
	return "%d:%d" % [col, row]


func _flash(color: Color, strength: float) -> void:
	flash_color = color
	flash_strength = max(flash_strength, strength)


func _shake(strength: float) -> void:
	shake_strength = max(shake_strength, strength)


func _with_alpha(color: Color, alpha: float) -> Color:
	var tinted := color
	tinted.a = alpha
	return tinted


func _shift_rect(rect: Rect2, offset: Vector2) -> Rect2:
	return Rect2(rect.position + offset, rect.size)


func _theme_for_level(level_number: int) -> Dictionary:
	var raw = THEME_DATA[(level_number - 1) % THEME_DATA.size()]
	return {
		"name": raw["name"],
		"bg_a": Color(raw["bg_a"]),
		"bg_b": Color(raw["bg_b"]),
		"bg_c": Color(raw["bg_c"]),
		"rail": Color(raw["rail"]),
		"claim_fill": Color(raw["claim_fill"]),
		"trail_a": Color(raw["trail_a"]),
		"trail_b": Color(raw["trail_b"]),
		"enemy_core": Color(raw["enemy_core"])
	}


func _theme_color(key: String) -> Color:
	return current_theme.get(key, Color.WHITE)


func _trail_color() -> Color:
	return _theme_color("trail_a").lerp(_theme_color("trail_b"), 0.5 + sin(title_phase * 10.0) * 0.5)


func _load_backgrounds() -> void:
	background_paths.clear()
	var dir := DirAccess.open("res://backgrounds")
	if dir == null:
		return
	dir.list_dir_begin()
	while true:
		var file := dir.get_next()
		if file == "":
			break
		if dir.current_is_dir():
			continue
		var extension := file.get_extension().to_lower()
		if extension in ["jpg", "jpeg", "png", "webp"]:
			background_paths.append("res://backgrounds/%s" % file)
	dir.list_dir_end()


func _pick_background_texture() -> Texture2D:
	if background_paths.is_empty():
		return null
	var path: String = background_paths[rng.randi_range(0, background_paths.size() - 1)]
	var image := Image.new()
	if image.load(ProjectSettings.globalize_path(path)) != OK:
		return null
	return ImageTexture.create_from_image(image)


func _build_audio() -> void:
	audio_streams = AudioSynth.create_sfx_library()
	audio_streams["music_calm"] = AudioSynth.create_music_stream("calm")
	audio_streams["music_danger"] = AudioSynth.create_music_stream("danger")

	music_player = AudioStreamPlayer.new()
	music_player.stream = audio_streams["music_calm"]
	add_child(music_player)

	danger_player = AudioStreamPlayer.new()
	danger_player.stream = audio_streams["music_danger"]
	add_child(danger_player)

	for _index in range(8):
		var player_node := AudioStreamPlayer.new()
		add_child(player_node)
		sfx_players.append(player_node)

	music_player.play()
	danger_player.play()
	_update_audio_mix()


func _update_audio_mix() -> void:
	if music_player == null or danger_player == null:
		return
	if not music_enabled:
		music_player.volume_db = -50.0
		danger_player.volume_db = -50.0
		return
	music_player.volume_db = lerpf(-15.0, -4.0, clamp(1.0 - danger_level * 0.75, 0.0, 1.0))
	danger_player.volume_db = lerpf(-36.0, -7.5, danger_level)


func _play_sfx(name: String) -> void:
	if not audio_streams.has(name) or sfx_players.is_empty():
		return
	var player_node: AudioStreamPlayer = sfx_players[sfx_index % sfx_players.size()]
	sfx_index += 1
	player_node.stream = audio_streams[name]
	player_node.play()


func _ensure_input_actions() -> void:
	_bind_key_action("move_left", KEY_A)
	_bind_key_action("move_left", KEY_LEFT)
	_bind_key_action("move_right", KEY_D)
	_bind_key_action("move_right", KEY_RIGHT)
	_bind_key_action("move_up", KEY_W)
	_bind_key_action("move_up", KEY_UP)
	_bind_key_action("move_down", KEY_S)
	_bind_key_action("move_down", KEY_DOWN)
	_bind_key_action("accept", KEY_SPACE)
	_bind_key_action("accept", KEY_ENTER)
	_bind_key_action("pause", KEY_ESCAPE)
	_bind_key_action("pause", KEY_P)
	_bind_key_action("toggle_music", KEY_M)


func _bind_key_action(action: String, keycode: Key) -> void:
	if not InputMap.has_action(action):
		InputMap.add_action(action)
	for event in InputMap.action_get_events(action):
		if event is InputEventKey and event.physical_keycode == keycode:
			return
	var key_event := InputEventKey.new()
	key_event.physical_keycode = keycode
	InputMap.action_add_event(action, key_event)


func _load_progress() -> void:
	var config := ConfigFile.new()
	if config.load(SAVE_PATH) != OK:
		high_score = 0
		music_enabled = true
		return
	high_score = int(config.get_value("scores", "high_score", 0))
	music_enabled = bool(config.get_value("settings", "music", true))


func _save_progress() -> void:
	high_score = max(high_score, score)
	var config := ConfigFile.new()
	config.set_value("scores", "high_score", high_score)
	config.set_value("settings", "music", music_enabled)
	config.save(SAVE_PATH)


func _build_ui() -> void:
	pause_button = _make_ui_button("Pause", Color("ffd86b"), Color("5c1b3a"))
	pause_button.pressed.connect(_on_pause_button_pressed)
	add_child(pause_button)

	resume_button = _make_ui_button("Resume", Color("83fff1"), Color("11344d"))
	resume_button.pressed.connect(_on_resume_button_pressed)
	add_child(resume_button)

	exit_button = _make_ui_button("Exit Game", Color("ff7ca8"), Color("4d102c"))
	exit_button.pressed.connect(_on_exit_button_pressed)
	add_child(exit_button)


func _make_ui_button(label: String, fill: Color, font_color: Color) -> Button:
	var button := Button.new()
	button.text = label
	button.custom_minimum_size = Vector2(150.0, 42.0)
	button.add_theme_font_size_override("font_size", 18)
	button.add_theme_color_override("font_color", font_color)
	button.add_theme_color_override("font_hover_color", font_color)
	button.add_theme_color_override("font_pressed_color", font_color)
	button.add_theme_color_override("font_disabled_color", _with_alpha(font_color, 0.5))

	var normal := StyleBoxFlat.new()
	normal.bg_color = fill
	normal.border_color = _with_alpha(Color.WHITE, 0.32)
	normal.border_width_left = 2
	normal.border_width_top = 2
	normal.border_width_right = 2
	normal.border_width_bottom = 2
	normal.corner_radius_top_left = 18
	normal.corner_radius_top_right = 18
	normal.corner_radius_bottom_left = 18
	normal.corner_radius_bottom_right = 18
	normal.shadow_color = _with_alpha(Color("2b0d1b"), 0.32)
	normal.shadow_size = 5

	var hover := normal.duplicate()
	hover.bg_color = fill.lightened(0.08)

	var pressed := normal.duplicate()
	pressed.bg_color = fill.darkened(0.08)

	button.add_theme_stylebox_override("normal", normal)
	button.add_theme_stylebox_override("hover", hover)
	button.add_theme_stylebox_override("pressed", pressed)
	button.add_theme_stylebox_override("focus", hover)
	return button


func _layout_ui() -> void:
	if pause_button != null:
		pause_button.position = Vector2(size.x - 174.0, 36.0)

	if state_name == "title":
		if exit_button != null:
			exit_button.position = Vector2(396.0, 306.0)
	elif state_name == "paused":
		if resume_button != null:
			resume_button.position = Vector2(size.x * 0.5 - 160.0, size.y * 0.5 + 22.0)
		if exit_button != null:
			exit_button.position = Vector2(size.x * 0.5 + 10.0, size.y * 0.5 + 22.0)
	elif state_name == "game_over":
		if exit_button != null:
			exit_button.position = Vector2(size.x * 0.5 - 75.0, size.y * 0.5 + 82.0)


func _refresh_ui() -> void:
	if pause_button != null:
		pause_button.visible = state_name == "playing"
	if resume_button != null:
		resume_button.visible = state_name == "paused"
	if exit_button != null:
		exit_button.visible = state_name in ["title", "paused", "game_over"]


func _on_pause_button_pressed() -> void:
	if state_name == "playing":
		_toggle_pause()


func _on_resume_button_pressed() -> void:
	if state_name == "paused":
		_toggle_pause()


func _on_exit_button_pressed() -> void:
	_save_progress()
	get_tree().quit()


func _draw() -> void:
	_draw_backdrop()
	_draw_board()
	_draw_particles()
	_draw_enemies()
	_draw_sparks()
	_draw_pickups()
	_draw_player()
	_draw_floaters()
	if state_name != "title":
		_draw_hud()
	_draw_overlay()
	if flash_strength > 0.0:
		var overlay := flash_color
		overlay.a = min(0.42, flash_strength)
		draw_rect(Rect2(Vector2.ZERO, size), overlay, true)


func _draw_backdrop() -> void:
	draw_rect(Rect2(Vector2.ZERO, size), _theme_color("bg_a"), true)
	var title_mode := state_name == "title"
	for band in range(10):
		var t := float(band) / 9.0
		var y := lerpf(0.0, size.y, t)
		var color := _theme_color("bg_a").lerp(_theme_color("bg_b"), t).lerp(_theme_color("bg_c"), 0.24 if title_mode else 0.16)
		color.a = 0.96
		draw_rect(Rect2(Vector2(0.0, y), Vector2(size.x, size.y / 9.0 + 4.0)), color, true)

	for blob in range(5):
		var wobble := title_phase * (0.12 + blob * 0.028)
		var center := Vector2(
			220.0 + blob * 285.0 + sin(wobble * 1.4 + blob) * 64.0,
			90.0 + fmod(blob * 112.0 + title_phase * 22.0, size.y + 180.0)
		)
		var glow := _theme_color("bg_c")
		glow.a = 0.07
		draw_circle(center, 84.0 + sin(wobble) * 22.0, glow)

	for stripe in range(14):
		var offset := fmod(title_phase * 88.0 + stripe * 138.0, size.x + 260.0) - 130.0
		var stripe_color := _theme_color("rail")
		stripe_color.a = 0.06 + danger_level * 0.04
		draw_line(
			Vector2(offset, BOARD_RECT.position.y - 110.0),
			Vector2(offset + 210.0, BOARD_RECT.end.y + 100.0),
			stripe_color,
			1.5
		)
	if title_mode:
		for candy in range(9):
			var x := 90.0 + candy * 210.0 + sin(title_phase * 0.8 + candy) * 24.0
			var y := 88.0 + fmod(110.0 * candy + title_phase * 18.0, size.y - 120.0)
			var candy_palette: Array = [
				Color("ff75c8"),
				Color("6ff7ff"),
				Color("ffe066"),
				Color("ff9f68")
			]
			var candy_color: Color = candy_palette[candy % 4]
			draw_circle(Vector2(x, y), 18.0 + (candy % 3) * 4.0, _with_alpha(candy_color, 0.14))
			draw_circle(Vector2(x, y), 9.0 + (candy % 2) * 2.0, _with_alpha(Color.WHITE, 0.18))


func _draw_board() -> void:
	var board := BOARD_RECT
	var outer := board.grow(18.0)
	draw_rect(_shift_rect(outer, camera_offset * 0.35), _with_alpha(_theme_color("rail"), 0.06), true)
	draw_rect(_shift_rect(board, camera_offset * 0.2), _with_alpha(Color("04060d"), 0.82), true)
	if current_background != null:
		draw_texture_rect(current_background, _shift_rect(board, camera_offset * 0.12), false, Color(1, 1, 1, 0.78))

	for row in range(ROWS):
		for col in range(COLS):
			var rect: Rect2 = _shift_rect(_cell_rect(col, row), camera_offset * 0.24)
			match grid[row][col]:
				TILE_EMPTY:
					draw_rect(rect, Color(0, 0, 0, 0.86), true)
					if (col + row) % 2 == 0:
						draw_rect(rect.grow(-3.0), Color(1, 1, 1, 0.015), true)
				TILE_SAFE:
					draw_rect(rect, _theme_color("claim_fill"), true)
					draw_rect(rect.grow(-1.0), _with_alpha(_theme_color("rail"), 0.18), false, 1.0)
				TILE_TRAIL:
					var pulse := _trail_color()
					pulse.a = 0.94
					draw_rect(rect.grow(-2.0), pulse, true)
					draw_rect(rect.grow(-0.75), Color.WHITE, false, 1.0)

	draw_rect(_shift_rect(board, camera_offset * 0.18), _with_alpha(_theme_color("rail"), 0.46), false, 3.0)
	draw_rect(_shift_rect(board.grow(-12.0), camera_offset * 0.08), _with_alpha(_theme_color("rail"), 0.07), false, 2.0)
	if state_name == "title":
		_draw_candy_frame(board)
		draw_rect(board, Color(0, 0, 0, 0.22), true)


func _draw_player() -> void:
	if state_name == "game_over" and not run_won:
		return
	var pos := _player_position() + camera_offset
	var dir: Vector2 = Vector2(player["dir"].x, player["dir"].y)
	if dir == Vector2.ZERO:
		dir = Vector2.RIGHT
	var perp := Vector2(-dir.y, dir.x)
	var core := Color("fff8db")
	var shell := _theme_color("trail_b") if player["drawing"] else _theme_color("rail")
	if _effect_active("rush"):
		shell = Color("ffe561")
	if _effect_active("hex"):
		shell = Color("ff6185")
	draw_circle(pos, 17.0, _with_alpha(shell, 0.14))
	draw_circle(pos, 9.0, core)
	var nose := pos + dir * 13.0
	var left := pos - dir * 8.0 + perp * 8.0
	var right := pos - dir * 8.0 - perp * 8.0
	draw_colored_polygon(PackedVector2Array([nose, left, right]), shell)
	draw_circle(pos - dir * 1.8, 2.5, Color("1c1329"))
	if _effect_active("shield"):
		var shield := _with_alpha(Color("85f6ff"), 0.3 + sin(title_phase * 9.0) * 0.08)
		draw_arc(pos, 19.0, 0.0, TAU, 40, shield, 2.5, true)


func _draw_enemies() -> void:
	for enemy in enemies:
		var history: Array = enemy["history"]
		if history.is_empty():
			history = [{"x": enemy["x"], "y": enemy["y"], "angle": enemy["angle"]}]
		for index in range(history.size() - 1, -1, -1):
			var ghost = history[index]
			var alpha: float = float(index + 1) / float(history.size() + 1)
			var glow := Color.from_hsv(enemy["hue"], 0.72, 1.0, alpha * 0.28)
			var a_dir := Vector2(cos(ghost["angle"]), sin(ghost["angle"]))
			var b_dir := Vector2(cos(ghost["angle"] + PI * 0.5), sin(ghost["angle"] + PI * 0.5))
			var center := Vector2(ghost["x"], ghost["y"]) + camera_offset * 0.7
			draw_line(center - a_dir * enemy["arm_a"], center + a_dir * enemy["arm_a"], glow, 3.0)
			draw_line(center - b_dir * enemy["arm_b"], center + b_dir * enemy["arm_b"], glow, 2.0)

		var center_now := Vector2(enemy["x"], enemy["y"]) + camera_offset
		var bloom := Color.from_hsv(enemy["hue"], 0.75, 1.0, 0.13 + danger_level * 0.08)
		draw_circle(center_now, 22.0, bloom)
		var segments := _qix_segments(enemy)
		var line_a := Color.from_hsv(enemy["hue"], 0.58, 1.0, 0.95)
		var line_b := Color.from_hsv(fmod(enemy["hue"] + 0.18, 1.0), 0.55, 1.0, 0.9)
		draw_line(segments[0]["a"] + camera_offset, segments[0]["b"] + camera_offset, line_a, 3.3)
		draw_line(segments[1]["a"] + camera_offset, segments[1]["b"] + camera_offset, line_b, 2.6)
		draw_circle(center_now, 6.5, _theme_color("enemy_core"))
		draw_circle(center_now, 2.1, Color.BLACK)


func _draw_sparks() -> void:
	for spark in sparks:
		var history: Array = spark["history"]
		for index in range(history.size() - 1, -1, -1):
			var ghost = history[index]
			var alpha: float = float(index + 1) / float(history.size() + 1)
			var pos := _cell_center(ghost["col"], ghost["row"]) + camera_offset * 0.8
			var tail := _with_alpha(Color("ff9d75"), alpha * 0.16)
			draw_circle(pos, 8.0 * alpha, tail)
		var pos_now := _cell_center(spark["col"], spark["row"]) + camera_offset
		var body := Color("ffbc6f") if _effect_active("hex") else Color("ffd56d")
		draw_circle(pos_now, 9.5, _with_alpha(body, 0.16))
		draw_circle(pos_now, 5.8, body)
		draw_line(pos_now + Vector2(-5, -3), pos_now + Vector2(5, 3), Color("7e1c18"), 2.0)
		draw_line(pos_now + Vector2(-5, 3), pos_now + Vector2(5, -3), Color("7e1c18"), 2.0)


func _draw_pickups() -> void:
	for pickup in pickups:
		var meta = PICKUP_META[pickup["kind"]]
		var pos := _cell_center(pickup["col"], pickup["row"]) + camera_offset * 0.6
		var pulse := 0.84 + sin(title_phase * 7.0 + pickup["wobble"] * 3.0) * 0.18
		var color := Color(meta["color"])
		draw_circle(pos, 16.0 * pulse, _with_alpha(color, 0.12))
		draw_circle(pos, 10.0 * pulse, color)
		draw_circle(pos + Vector2(-2.0, -2.0), 3.0, Color.WHITE)
		var label := "!"
		if pickup["kind"] == "heart":
			label = "+"
		elif pickup["kind"] == "shield":
			label = "S"
		elif pickup["kind"] == "rush":
			label = "R"
		draw_string(ThemeDB.fallback_font, pos + Vector2(-5.0, 6.0), label, HORIZONTAL_ALIGNMENT_LEFT, -1.0, 18, Color("1a1026"))


func _draw_particles() -> void:
	for particle in particles:
		var alpha: float = float(particle["life"]) / float(particle["max_life"])
		var color: Color = particle["color"]
		color.a *= alpha
		draw_circle(particle["pos"] + camera_offset * 0.42, particle["size"] * alpha, color)


func _draw_floaters() -> void:
	for floater in floaters:
		var alpha: float = float(floater["life"]) / float(floater["max_life"])
		var color: Color = floater["color"]
		color.a = alpha
		draw_string(ThemeDB.fallback_font, floater["pos"] + camera_offset * 0.18, floater["text"], HORIZONTAL_ALIGNMENT_LEFT, -1.0, 22, color)


func _draw_hud() -> void:
	var left_panel := Rect2(Vector2(34.0, 34.0), Vector2(208.0, 208.0))
	_draw_panel(left_panel, Color("0b1220", 0.64), _with_alpha(_theme_color("rail"), 0.22))
	_draw_label(left_panel.position + Vector2(18.0, 34.0), current_theme.get("name", "Arcade"), 18, Color("b9fbff"))
	_draw_label(left_panel.position + Vector2(18.0, 74.0), "Score", 16, Color("ffe0a6"))
	_draw_label(left_panel.position + Vector2(18.0, 106.0), "%08d" % score, 28, Color("fff3d1"))
	_draw_label(left_panel.position + Vector2(18.0, 136.0), "Hi %08d" % high_score, 16, Color("d8eaff"))
	_draw_label(left_panel.position + Vector2(18.0, 172.0), "Lives %d   Level %d/%d" % [lives, level, FINAL_LEVEL], 16, Color("ffe9d1"))
	_draw_label(left_panel.position + Vector2(18.0, 198.0), "Claim %d%% / %d%%" % [int(capture_percent), capture_goal], 16, Color("c8ffda"))

	var effects := []
	for key in ["rush", "shield", "hex"]:
		if _effect_active(key):
			effects.append("%s %.0fs" % [PICKUP_META[key]["title"], ceil(active_effects[key])])
	var effect_panel := Rect2(Vector2(34.0, 258.0), Vector2(208.0, 86.0))
	_draw_panel(effect_panel, Color("0b1220", 0.52), _with_alpha(_theme_color("trail_b"), 0.18))
	_draw_label(effect_panel.position + Vector2(18.0, 30.0), "Effects", 16, Color("fff3bf"))
	_draw_label(effect_panel.position + Vector2(18.0, 60.0), "None" if effects.is_empty() else " | ".join(effects), 14, Color("c8f7ff"))

	var utility_panel := Rect2(Vector2(size.x - 270.0, 34.0), Vector2(236.0, 58.0))
	_draw_panel(utility_panel, Color("0b1220", 0.5), _with_alpha(_theme_color("rail"), 0.18))
	_draw_label(utility_panel.position + Vector2(18.0, 36.0), "Move WASD   Pause P   Music M", 15, Color("dff7ff"))

	if status_message != "":
		var status_panel := Rect2(Vector2(size.x - 350.0, 110.0), Vector2(316.0, 54.0))
		_draw_panel(status_panel, Color("220d13", 0.52), _with_alpha(Color("ff9d7a"), 0.18))
		_draw_label(status_panel.position + Vector2(18.0, 34.0), status_message, 16, Color("ffcfaa"))
	if banner_timer > 0.0:
		var banner_rect := Rect2(Vector2(BOARD_RECT.position.x + 110.0, 34.0), Vector2(BOARD_RECT.size.x - 220.0, 56.0))
		_draw_panel(banner_rect, Color("0b1220", 0.42), _with_alpha(_theme_color("trail_a"), 0.15))
		_draw_centered_label(Vector2(banner_rect.get_center().x, banner_rect.position.y + 37.0), banner_text, 24, Color("fff6bf"))


func _draw_overlay() -> void:
	if state_name == "title":
		var marquee := Rect2(Vector2(54.0, 52.0), Vector2(560.0, 310.0))
		_draw_panel(marquee, Color("5b184f", 0.72), _with_alpha(Color("ffd86b"), 0.52))
		draw_rect(Rect2(marquee.position + Vector2(16.0, 16.0), Vector2(marquee.size.x - 32.0, 10.0)), _with_alpha(Color("fff8cb"), 0.25), true)
		_draw_shadowed_label(marquee.position + Vector2(28.0, 104.0), "DopaQiX", 76, Color("4a103a", 0.95), Color("fff6d8"))
		_draw_shadowed_label(marquee.position + Vector2(34.0, 154.0), "Native", 38, Color("2a5f7a", 0.92), Color("84f8ff"))
		_draw_label(marquee.position + Vector2(30.0, 200.0), "A neon candy-cabinet invitation to make risky cuts", 22, Color("fff4da"))
		_draw_label(marquee.position + Vector2(30.0, 230.0), "and steal the whole board before the sparks corner you.", 22, Color("fff4da"))
		var cta := Rect2(marquee.position + Vector2(28.0, 252.0), Vector2(324.0, 40.0))
		_draw_panel(cta, Color("ffcf5b", 0.92), _with_alpha(Color("ff5fa2"), 0.68))
		_draw_centered_label(Vector2(cta.get_center().x, cta.position.y + 28.0), "PRESS SPACE OR ENTER TO START", 20, Color("6f1b39"))
		var info := Rect2(Vector2(size.x - 348.0, 74.0), Vector2(294.0, 172.0))
		_draw_panel(info, Color("143860", 0.64), _with_alpha(Color("88fff7"), 0.36))
		_draw_label(info.position + Vector2(20.0, 34.0), "Catch The Eye", 22, Color("fff6c4"))
		_draw_label(info.position + Vector2(20.0, 68.0), "WASD or Arrows to move", 18, Color("effcff"))
		_draw_label(info.position + Vector2(20.0, 96.0), "Reconnect to claim the field", 18, Color("effcff"))
		_draw_label(info.position + Vector2(20.0, 124.0), "Rush helps. Hex bombs punish greed.", 18, Color("effcff"))
		_draw_label(info.position + Vector2(20.0, 152.0), "P pauses   |   M music", 18, Color("ffe58f"))
	elif state_name == "paused":
		var modal := Rect2(Vector2(size.x * 0.5 - 210.0, size.y * 0.5 - 78.0), Vector2(420.0, 156.0))
		_draw_panel(modal, Color("09101b", 0.78), _with_alpha(_theme_color("rail"), 0.22))
		_draw_centered_label(Vector2(modal.get_center().x, modal.position.y + 58.0), "PAUSED", 42, Color("fff7dd"))
		_draw_centered_label(Vector2(modal.get_center().x, modal.position.y + 102.0), "Press Esc or P to resume", 20, Color("dff7ff"))
	elif state_name == "death":
		var modal := Rect2(Vector2(size.x * 0.5 - 220.0, size.y * 0.5 - 74.0), Vector2(440.0, 148.0))
		_draw_panel(modal, Color("220d13", 0.8), _with_alpha(Color("ff8c73"), 0.22))
		_draw_centered_label(Vector2(modal.get_center().x, modal.position.y + 54.0), "CRASH", 40, Color("fff0dc"))
		_draw_centered_label(Vector2(modal.get_center().x, modal.position.y + 96.0), status_message, 18, Color("ffd0c0"))
	elif state_name == "game_over":
		var modal := Rect2(Vector2(size.x * 0.5 - 250.0, size.y * 0.5 - 100.0), Vector2(500.0, 200.0))
		_draw_panel(modal, Color("09101b", 0.84), _with_alpha(_theme_color("rail"), 0.2))
		if run_won:
			_draw_centered_label(Vector2(modal.get_center().x, modal.position.y + 64.0), "SYSTEM OVERLOADED", 42, Color("fff7d8"))
			_draw_centered_label(Vector2(modal.get_center().x, modal.position.y + 106.0), "You own the board.", 20, Color("dffcff"))
		else:
			_draw_centered_label(Vector2(modal.get_center().x, modal.position.y + 64.0), "GAME OVER", 42, Color("fff7d8"))
			_draw_centered_label(Vector2(modal.get_center().x, modal.position.y + 106.0), status_message if status_message != "" else "The board bit back.", 20, Color("ffd4c4"))
		_draw_centered_label(Vector2(modal.get_center().x, modal.position.y + 152.0), "Press Space or Enter to run it again", 20, Color("ffe46a"))


func _draw_label(position: Vector2, text: String, font_size: int, color: Color) -> void:
	draw_string(ThemeDB.fallback_font, position, text, HORIZONTAL_ALIGNMENT_LEFT, -1.0, font_size, color)


func _draw_centered_label(position: Vector2, text: String, font_size: int, color: Color) -> void:
	var width := ThemeDB.fallback_font.get_string_size(text, HORIZONTAL_ALIGNMENT_LEFT, -1.0, font_size).x
	draw_string(ThemeDB.fallback_font, position - Vector2(width * 0.5, 0.0), text, HORIZONTAL_ALIGNMENT_LEFT, -1.0, font_size, color)


func _draw_shadowed_label(position: Vector2, text: String, font_size: int, shadow: Color, fill: Color) -> void:
	_draw_label(position + Vector2(5.0, 5.0), text, font_size, shadow)
	_draw_label(position, text, font_size, fill)


func _draw_panel(rect: Rect2, fill: Color, stroke: Color) -> void:
	draw_rect(rect, fill, true)
	draw_rect(rect, stroke, false, 2.0)
	draw_rect(rect.grow(-8.0), _with_alpha(stroke, stroke.a * 0.28), false, 1.0)


func _draw_candy_frame(board: Rect2) -> void:
	var frame := board.grow(24.0)
	draw_rect(frame, _with_alpha(Color("ff5fa2"), 0.32), true)
	draw_rect(frame.grow(-8.0), _with_alpha(Color("6df8ff"), 0.24), true)
	draw_rect(frame, _with_alpha(Color("ffe476"), 0.46), false, 4.0)
	draw_rect(frame.grow(-10.0), _with_alpha(Color("ff7cb8"), 0.44), false, 3.0)
	for index in range(18):
		var px := frame.position.x + 22.0 + index * ((frame.size.x - 44.0) / 17.0)
		var top_color := Color("ffe66d") if index % 2 == 0 else Color("76faff")
		var bottom_color := Color("ff8ec6") if index % 2 == 0 else Color("fff4cf")
		draw_circle(Vector2(px, frame.position.y + 12.0), 4.5, top_color)
		draw_circle(Vector2(px, frame.end.y - 12.0), 4.5, bottom_color)
