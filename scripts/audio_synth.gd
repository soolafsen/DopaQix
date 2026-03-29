extends RefCounted
class_name AudioSynth

const SAMPLE_RATE = 44100


static func create_sfx_library() -> Dictionary:
	return {
		"start": make_sweep_stream(180.0, 620.0, 0.18, "square", 0.44, 0.05),
		"slice": make_sweep_stream(820.0, 340.0, 0.08, "square", 0.28, 0.03),
		"capture": make_jingle_stream([72, 76, 79, 84, 88], 0.08, "triangle", 0.34),
		"pickup_good": make_sweep_stream(540.0, 1320.0, 0.22, "triangle", 0.44, 0.02),
		"pickup_bad": make_sweep_stream(320.0, 90.0, 0.21, "saw", 0.42, 0.05),
		"shield": make_sweep_stream(460.0, 980.0, 0.24, "triangle", 0.38, 0.01),
		"spark": make_sweep_stream(1180.0, 540.0, 0.06, "square", 0.22, 0.08),
		"hit": make_sweep_stream(260.0, 60.0, 0.28, "noise", 0.74, 0.44),
		"level_clear": make_jingle_stream([74, 79, 83, 86, 91], 0.11, "triangle", 0.33),
		"game_over": make_jingle_stream([74, 71, 67, 62], 0.18, "saw", 0.28)
	}


static func create_music_stream(theme: String = "calm") -> AudioStreamWAV:
	var danger := theme == "danger"
	var bpm := 152.0 if danger else 128.0
	var step_duration := 60.0 / bpm / 2.0
	var total_steps := 64
	var total_seconds := step_duration * total_steps
	var sample_count := int(total_seconds * SAMPLE_RATE)
	var data := PackedByteArray()
	data.resize(sample_count * 2)

	var lead := [72, 74, 79, 81, 79, 74, 72, 67, 72, 74, 79, 84, 81, 79, 74, 72]
	var counter := [84, 83, 81, 79, 77, 79, 81, 83]
	var bass := [36, 36, 43, 43, 48, 48, 43, 43]
	var chords := [
		[60, 64, 67],
		[62, 65, 69],
		[67, 71, 74],
		[57, 60, 64]
	]
	if danger:
		lead = [67, 70, 72, 75, 72, 70, 67, 63, 67, 70, 74, 79, 75, 74, 70, 67]
		counter = [79, 77, 75, 74, 72, 74, 75, 77]
		bass = [31, 31, 34, 34, 38, 38, 34, 34]
		chords = [
			[43, 46, 50],
			[45, 48, 52],
			[48, 52, 55],
			[41, 45, 48]
		]

	for i in range(sample_count):
		var t := float(i) / SAMPLE_RATE
		var step := int(floor(t / step_duration))
		var half_time := fmod(t, step_duration)
		var beat := int(floor(t / (step_duration * 2.0)))
		var beat_time := fmod(t, step_duration * 2.0)
		var bar := int(floor(t / (step_duration * 8.0)))
		var bar_time := fmod(t, step_duration * 8.0)

		var sample := 0.0
		var lead_note: int = int(lead[step % lead.size()])
		var counter_note: int = int(counter[(step + 2) % counter.size()])
		var bass_note: int = int(bass[beat % bass.size()])
		var chord: Array = chords[bar % chords.size()]
		var arp_note: int = int(chord[step % chord.size()])

		sample += voice_note(half_time, step_duration * 0.9, midi_to_hz(lead_note), 0.22 if danger else 0.17, "saw" if danger else "square", 0.014)
		sample += voice_note(half_time, step_duration * 0.78, midi_to_hz(counter_note), 0.09 if danger else 0.06, "triangle", 0.006)
		sample += voice_note(half_time, step_duration * 0.68, midi_to_hz(arp_note + 12), 0.06 if danger else 0.045, "square", 0.0)
		sample += voice_note(beat_time, step_duration * 1.9, midi_to_hz(bass_note), 0.24 if danger else 0.18, "saw", 0.0)
		for note in chord:
			sample += voice_note(bar_time, step_duration * 6.8, midi_to_hz(note), 0.025 if danger else 0.02, "sine", 0.0)

		if half_time < 0.1:
			sample += drum_kick(half_time, 0.12, 0.48 if danger else 0.34)
		if step % 4 == 2 and half_time < 0.085:
			sample += drum_noise(half_time, 0.12, 0.22 if danger else 0.12)
		if danger and step % 2 == 1 and half_time < 0.05:
			sample += drum_tick(half_time, 0.04, 0.09)

		data.encode_s16(i * 2, int(clamp(sample, -1.0, 1.0) * 32767.0))

	var stream := AudioStreamWAV.new()
	stream.mix_rate = SAMPLE_RATE
	stream.stereo = false
	stream.format = AudioStreamWAV.FORMAT_16_BITS
	stream.data = data
	stream.loop_mode = AudioStreamWAV.LOOP_FORWARD
	stream.loop_begin = 0
	stream.loop_end = sample_count
	return stream


static func make_sweep_stream(freq_start: float, freq_end: float, duration: float, wave: String, volume: float, noise: float) -> AudioStreamWAV:
	var sample_count := int(duration * SAMPLE_RATE)
	var data := PackedByteArray()
	data.resize(sample_count * 2)
	var rng := RandomNumberGenerator.new()
	rng.seed = int(freq_start * 13.0 + freq_end * 17.0 + duration * 997.0)
	var phase := 0.0

	for i in range(sample_count):
		var t := float(i) / SAMPLE_RATE
		var mix: float = t / max(duration, 0.001)
		var freq: float = lerpf(freq_start, freq_end, mix)
		phase += TAU * freq / SAMPLE_RATE
		var env: float = min(t / 0.01, 1.0) * pow(max(0.0, 1.0 - mix), 1.8)
		var sample: float = wave_value(phase, wave) * env * volume
		sample += rng.randf_range(-1.0, 1.0) * noise * env
		data.encode_s16(i * 2, int(clamp(sample, -1.0, 1.0) * 32767.0))

	var stream := AudioStreamWAV.new()
	stream.mix_rate = SAMPLE_RATE
	stream.stereo = false
	stream.format = AudioStreamWAV.FORMAT_16_BITS
	stream.data = data
	return stream


static func make_jingle_stream(notes: Array, note_length: float, wave: String, volume: float) -> AudioStreamWAV:
	var total_seconds := notes.size() * note_length
	var sample_count := int(total_seconds * SAMPLE_RATE)
	var data := PackedByteArray()
	data.resize(sample_count * 2)

	for i in range(sample_count):
		var t := float(i) / SAMPLE_RATE
		var note_index: int = clamp(int(floor(t / note_length)), 0, notes.size() - 1)
		var local_time := fmod(t, note_length)
		var sample := voice_note(local_time, note_length * 0.94, midi_to_hz(notes[note_index]), volume, wave, 0.0)
		data.encode_s16(i * 2, int(clamp(sample, -1.0, 1.0) * 32767.0))

	var stream := AudioStreamWAV.new()
	stream.mix_rate = SAMPLE_RATE
	stream.stereo = false
	stream.format = AudioStreamWAV.FORMAT_16_BITS
	stream.data = data
	return stream


static func voice_note(local_time: float, duration: float, frequency: float, volume: float, wave: String, vibrato_depth: float) -> float:
	if local_time >= duration:
		return 0.0
	var attack: float = min(local_time / 0.01, 1.0)
	var release := pow(max(0.0, 1.0 - local_time / max(duration, 0.001)), 1.7)
	var env: float = attack * release
	var vibrato := sin(local_time * TAU * 5.0) * vibrato_depth
	var phase := TAU * (frequency + frequency * vibrato) * local_time
	return wave_value(phase, wave) * env * volume


static func drum_kick(local_time: float, duration: float, volume: float) -> float:
	if local_time >= duration:
		return 0.0
	var env := pow(max(0.0, 1.0 - local_time / duration), 3.2)
	var phase := TAU * (120.0 - local_time * 540.0) * local_time
	return sin(phase) * env * volume


static func drum_noise(local_time: float, duration: float, volume: float) -> float:
	if local_time >= duration:
		return 0.0
	var env := pow(max(0.0, 1.0 - local_time / duration), 2.2)
	var noise := sin(local_time * 8940.0) * sin(local_time * 7310.0)
	return noise * env * volume


static func drum_tick(local_time: float, duration: float, volume: float) -> float:
	if local_time >= duration:
		return 0.0
	var env := pow(max(0.0, 1.0 - local_time / duration), 4.0)
	return wave_value(local_time * 8800.0, "square") * env * volume


static func wave_value(phase: float, wave: String) -> float:
	var unit := fmod(phase / TAU, 1.0)
	match wave:
		"sine":
			return sin(phase)
		"triangle":
			return 1.0 - 4.0 * abs(unit - 0.5)
		"saw":
			return unit * 2.0 - 1.0
		"noise":
			return sin(phase * 1.37) * sin(phase * 0.73)
		_:
			return 1.0 if unit < 0.5 else -1.0


static func midi_to_hz(note: int) -> float:
	return 440.0 * pow(2.0, (float(note) - 69.0) / 12.0)
