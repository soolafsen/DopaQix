const canvas = document.getElementById("game-board");
const ctx = canvas.getContext("2d");
const safeGridCanvas = document.createElement("canvas");
safeGridCanvas.width = canvas.width;
safeGridCanvas.height = canvas.height;
const safeGridCtx = safeGridCanvas.getContext("2d");
let safeGridDirty = true;

const claimedEl = document.getElementById("claimed");
const requiredReadoutEl = document.getElementById("required-readout");
const levelReadoutEl = document.getElementById("level-readout");
const livesEl = document.getElementById("lives");
const scoreReadoutEl = document.getElementById("score-readout");
const highscoreReadoutEl = document.getElementById("highscore-readout");
const overlay = document.getElementById("overlay");
const messageEl =
  document.getElementById("message") ||
  document.getElementById("message-body");
const startButton = document.getElementById("start-button");
const stagePanelEl = document.querySelector(".stage-panel");
const sidebarEl = document.querySelector(".sidebar");
const boardWrapEl = document.querySelector(".board-wrap");
const themeReadoutEl = document.getElementById("theme-readout");
const imageLayerEl = document.getElementById("image-layer");
const revealImageEl = document.getElementById("reveal-image");
const powerFillEl = document.querySelector(".power-fill");
const speedSettingEl = document.getElementById("speed-setting");
const speedValueEl = document.getElementById("speed-value");
const magicSettingEl = document.getElementById("magic-setting");
const typeSettingEl = document.getElementById("type-setting");
const cheatSettingEl = document.getElementById("cheat-setting");
const musicSettingEl = document.getElementById("music-setting");
const volumeSettingEl = document.getElementById("volume-setting");
const volumeReadoutEl = document.getElementById("volume-readout");

const CELL = 10;
const COLS = Math.floor(canvas.width / CELL);
const ROWS = Math.floor(canvas.height / CELL);
const PUZZLE_GRID = 3;

const TILE_EMPTY = 0;
const TILE_SAFE = 1;
const TILE_TRAIL = 2;

const config = {
  moveInterval: 0.07,
  qixSpeedMin: 90,
  qixSpeedMax: 150,
  qixArmMin: 22,
  qixArmMax: 52,
  sparkSpeed: 9,
  levelTimeLimit: 180,
  respawnPauseMs: 2000,
  lives: 3,
  maxLives: 5,
  baseCaptureGoal: 50,
  captureGoalStep: 3,
  maxCaptureGoal: 80,
  bombSlowMs: 10000,
  cookieBoostMs: 10000,
  shieldMs: 10000,
  pickupLifetimeMs: 15000,
  fieldCookieLifetimeMs: 19000,
  pickupSpawnMinMs: 1750,
  pickupSpawnMaxMs: 3250,
  fieldCookieSpawnMinMs: 2800,
  fieldCookieSpawnMaxMs: 6000,
  maxFieldCookies: 2,
  maxFieldShields: 1,
  residueLifetimeMs: 2400,
  residueDropSeconds: 0.055,
  maxResidueCells: 180,
};

/**
 * Board images: place files under backgrounds/ and list each filename in
 * backgrounds/manifest.json (JSON array, or { "files": [...] }), and/or in
 * index.html <script type="application/json" id="qix-background-manifest">.
 * Embedded JSON works with file://; fetch(manifest.json) needs http(s).
 * Prefixes (case-insensitive): pup* → Aww, funny* → Funny, pinup* → Pinup.
 * TYPE "Random" uses every listed image file in one shuffled pool.
 */
const BACKGROUNDS_DIR = "backgrounds";
const BACKGROUNDS_MANIFEST_URL = `${BACKGROUNDS_DIR}/manifest.json`;

const IMAGE_FILENAME_RE = /\.(jpe?g|png|gif|webp|avif|bmp)$/i;
const HIGH_SCORE_KEY = "codexqix.highscore";
const OPTIONS_KEY = "codexqix.options";

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function dedupeUrls(urls) {
  return [...new Set(urls)];
}

function backgroundEntryToBasename(entry) {
  if (typeof entry === "string") {
    return entry.replace(/^.*[/\\]/, "");
  }
  if (entry && typeof entry.name === "string") {
    return entry.name.replace(/^.*[/\\]/, "");
  }
  return "";
}

function parseManifestJsonText(text) {
  if (!text || !String(text).trim()) {
    return [];
  }
  try {
    const data = JSON.parse(text);
    return Array.isArray(data) ? data : data.files || [];
  } catch {
    return [];
  }
}

function readEmbeddedBackgroundManifest() {
  const el = document.getElementById("qix-background-manifest");
  if (!el) {
    return [];
  }
  return parseManifestJsonText(el.textContent);
}

/** Resolve against document URL (file:// and http). */
function backgroundFileToUrl(basename) {
  const base = String(basename).replace(/^.*[/\\]/, "");
  const path = `${BACKGROUNDS_DIR}/${encodeURIComponent(base)}`;
  try {
    return new URL(path, document.baseURI).href;
  } catch {
    return path;
  }
}

/** Fisher–Yates with crypto randomInt (uniform order). */
function shuffleArrayWithImageRng(items) {
  const queue = [...items];
  for (let index = queue.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(index + 1);
    [queue[index], queue[swapIndex]] = [queue[swapIndex], queue[index]];
  }
  return queue;
}

let imageSources = {
  aww: [],
  funny: [],
  pinup: [],
  random: [],
};

async function loadBackgroundImagePools() {
  let rawList = [];
  if (location.protocol !== "file:") {
    try {
      const res = await fetch(BACKGROUNDS_MANIFEST_URL);
      if (res.ok) {
        rawList = parseManifestJsonText(await res.text());
      }
    } catch {
      // network / CORS
    }
  }
  if (rawList.length === 0) {
    rawList = readEmbeddedBackgroundManifest();
  }

  const basenames = dedupeUrls(
    rawList
      .map(backgroundEntryToBasename)
      .filter((n) => n && IMAGE_FILENAME_RE.test(n)),
  );

  const urlsAll = basenames.map(backgroundFileToUrl);

  const lowerBase = (b) => b.toLowerCase();
  const poolFor = (predicate) =>
    shuffleArrayWithImageRng(
      dedupeUrls(
        basenames
          .filter((b) => predicate(lowerBase(b)))
          .map(backgroundFileToUrl),
      ),
    );

  imageSources.aww = poolFor((b) => b.startsWith("pup"));
  imageSources.funny = poolFor((b) => b.startsWith("funny"));
  imageSources.pinup = poolFor((b) => b.startsWith("pinup"));
  imageSources.random = shuffleArrayWithImageRng([...urlsAll]);

  if (basenames.length === 0) {
    console.warn(
      "QiX: No background images listed. Add filenames to backgrounds/manifest.json and/or #qix-background-manifest in index.html.",
    );
  }
}

const audioState = {
  context: null,
  masterGain: null,
  /** `setTimeout` id for the next music chunk (not `setInterval`). */
  musicTimer: 0,
  musicStep: 0,
  musicStarted: false,
};

/** Theme tempo: 1/0.7 ≈ 1.43× note spacing → 30% slower (70% speed). */
const THEME_MUSIC_TEMPO_MULT = 1 / 0.7;

const melody = [
  { notes: [659.25], length: 0.5 },
  { notes: [659.25], length: 0.5 },
  { notes: [698.46], length: 0.5 },
  { notes: [783.99], length: 0.5 },
  { notes: [783.99], length: 0.5 },
  { notes: [698.46], length: 0.5 },
  { notes: [659.25], length: 0.5 },
  { notes: [587.33], length: 0.5 },
  { notes: [523.25], length: 0.5 },
  { notes: [523.25], length: 0.5 },
  { notes: [587.33], length: 0.5 },
  { notes: [659.25], length: 0.5 },
  { notes: [659.25, 987.77], length: 0.75 },
  { notes: [587.33], length: 0.25 },
  { notes: [587.33, 880], length: 1.0 },
  { notes: [659.25], length: 0.5 },
  { notes: [659.25], length: 0.5 },
  { notes: [698.46], length: 0.5 },
  { notes: [783.99], length: 0.5 },
  { notes: [783.99], length: 0.5 },
  { notes: [698.46], length: 0.5 },
  { notes: [659.25], length: 0.5 },
  { notes: [587.33], length: 0.5 },
  { notes: [523.25], length: 0.5 },
  { notes: [523.25], length: 0.5 },
  { notes: [587.33], length: 0.5 },
  { notes: [659.25], length: 0.5 },
  { notes: [587.33, 880], length: 0.75 },
  { notes: [523.25], length: 0.25 },
  { notes: [523.25, 783.99], length: 1.0 },
  { notes: [587.33], length: 0.5 },
  { notes: [587.33], length: 0.5 },
  { notes: [659.25], length: 0.5 },
  { notes: [523.25], length: 0.5 },
  { notes: [587.33], length: 0.5 },
  { notes: [659.25], length: 0.25 },
  { notes: [698.46], length: 0.25 },
  { notes: [659.25], length: 0.5 },
  { notes: [523.25], length: 0.5 },
  { notes: [587.33], length: 0.5 },
  { notes: [659.25], length: 0.25 },
  { notes: [698.46], length: 0.25 },
  { notes: [659.25], length: 0.5 },
  { notes: [587.33], length: 0.5 },
  { notes: [523.25], length: 0.5 },
  { notes: [587.33], length: 0.5 },
  { notes: [392, 783.99], length: 1.0 },
];

const bassline = [
  130.81, 130.81, 146.83, 146.83, 164.81, 164.81, 146.83, 146.83, 130.81,
  130.81, 146.83, 146.83, 164.81, 146.83, 130.81, 130.81, 130.81, 130.81,
  146.83, 146.83, 164.81, 164.81, 146.83, 146.83, 130.81, 130.81, 146.83,
  146.83, 130.81, 130.81, 98, 98, 146.83, 146.83, 164.81, 164.81, 130.81,
  130.81, 146.83, 146.83, 164.81, 164.81, 146.83, 146.83, 130.81, 130.81, 98,
  98,
];

const MUSIC_THEMES = {
  aww: {
    tempo: 0.165,
    bass: [87.31, 87.31, 98, 116.54, 130.81, 116.54, 98, 87.31],
    lead: [523.25, 659.25, 783.99, 659.25, 587.33, 659.25, 880, 659.25],
    accent: 987.77,
  },
  funny: {
    tempo: 0.15,
    bass: [98, 98, 110, 123.47, 146.83, 123.47, 110, 98],
    lead: [659.25, 587.33, 783.99, 698.46, 880, 783.99, 987.77, 880],
    accent: 1174.66,
  },
  pinup: {
    tempo: 0.172,
    bass: [82.41, 82.41, 98, 110, 123.47, 110, 98, 92.5],
    lead: [493.88, 587.33, 659.25, 739.99, 659.25, 783.99, 880, 739.99],
    accent: 1046.5,
  },
  random: {
    tempo: 0.158,
    bass: [87.31, 98, 110, 130.81, 146.83, 130.81, 110, 98],
    lead: [523.25, 783.99, 659.25, 880, 698.46, 987.77, 783.99, 1174.66],
    accent: 1318.51,
  },
};

const state = {
  running: false,
  animationFrame: 0,
  lastTime: 0,
  renderTime: 0,
  moveClock: 0,
  grid: [],
  capturePercent: 0,
  /** Points from finished levels this run (see `recomputeScore`, `startNextLevel`). */
  carryScore: 0,
  score: 0,
  highScore: 0,
  elapsedSeconds: 0,
  level: 1,
  lives: config.lives,
  currentImage: "",
  currentImageType: "aww",
  currentImageRoll: 1,
  imageRequestId: 0,
  imageQueues: {},
  puzzleOrder: [],
  spawnPauseUntil: 0,
  awaitingLevelAdvance: false,
  paused: false,
  savingHighScore: false,
  nextBurstThreshold: 10,
  musicDanger: 0,
  pickups: [],
  enemyResidue: new Map(),
  nextPickupSpawnAt: 0,
  nextArenaCookieSpawnAt: 0,
  railPickupCounter: 0,
  speedEffectKind: "",
  speedEffectUntil: 0,
  shieldUntil: 0,
  screenShakeUntil: 0,
  screenShakeStrength: 0,
  settings: {
    speed: 2,
    magic: "more",
    type: "aww",
    cheat: false,
    music: true,
    volume: 0.7,
  },
  keys: {
    w: false,
    a: false,
    s: false,
    d: false,
    shift: false,
  },
  player: {
    col: 0,
    row: 0,
    dir: { x: 1, y: 0 },
    drawing: false,
    trail: [],
    trailSet: new Set(),
  },
  enemies: [],
  sparks: [],
  explosions: [],
  pendingLoseLifeReason: null,
  crashEffectUntil: 0,
  hidePlayerDuringCrash: false,
  playerCrashParticles: [],
};

const PICKUP_KIND_BOMB = "bomb";
const PICKUP_KIND_COOKIE = "cookie";
const PICKUP_KIND_HEART = "heart";
const PICKUP_KIND_SHIELD = "shield";

function ensureAudio() {
  if (!audioState.context) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      return null;
    }
    audioState.context = new AudioContextClass();
    audioState.masterGain = audioState.context.createGain();
    audioState.masterGain.gain.value = state.settings.volume;
    audioState.masterGain.connect(audioState.context.destination);
    audioState.context.addEventListener("statechange", handleAudioContextStateChange);
  }

  if (audioState.context.state === "suspended") {
    audioState.context.resume();
  }

  return audioState.context;
}

function handleAudioContextStateChange() {
  const ctx = audioState.context;
  if (!ctx || !audioState.musicStarted || !state.settings.music) {
    return;
  }

  if (ctx.state === "suspended") {
    clearTimeout(audioState.musicTimer);
    audioState.musicTimer = 0;
    return;
  }

  if (ctx.state === "running") {
    scheduleMusicWindow();
  }
}

function createGain(value, destination, when) {
  const gain = audioState.context.createGain();
  gain.gain.setValueAtTime(value, when);
  gain.connect(destination);
  return gain;
}

function scheduleTone({
  frequency,
  type = "triangle",
  when,
  duration,
  gain = 0.05,
  attack = 0.01,
  release = 0.08,
  destination = audioState.masterGain || audioState.context.destination,
}) {
  const osc = audioState.context.createOscillator();
  const amp = audioState.context.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, when);
  amp.gain.setValueAtTime(0.0001, when);
  amp.gain.linearRampToValueAtTime(gain, when + attack);
  amp.gain.exponentialRampToValueAtTime(0.0001, when + duration + release);
  osc.connect(amp);
  amp.connect(destination);
  osc.start(when);
  osc.stop(when + duration + release + 0.01);
}

function scheduleNoteStack({ frequency, when, duration, gain = 0.03 }) {
  scheduleTone({
    frequency,
    type: "triangle",
    when,
    duration,
    gain,
    attack: 0.012,
    release: 0.09,
  });

  scheduleTone({
    frequency: frequency * 2,
    type: "sine",
    when,
    duration: duration * 0.92,
    gain: gain * 0.34,
    attack: 0.008,
    release: 0.07,
  });
}

function scheduleNoiseBurst(when, duration, startGain, endGain, filterFreq) {
  const bufferSize = Math.max(
    1,
    Math.floor(audioState.context.sampleRate * duration),
  );
  const buffer = audioState.context.createBuffer(
    1,
    bufferSize,
    audioState.context.sampleRate,
  );
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i += 1) {
    data[i] = Math.random() * 2 - 1;
  }

  const source = audioState.context.createBufferSource();
  source.buffer = buffer;

  const filter = audioState.context.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.setValueAtTime(filterFreq, when);

  const amp = audioState.context.createGain();
  amp.gain.setValueAtTime(startGain, when);
  amp.gain.exponentialRampToValueAtTime(endGain, when + duration);

  source.connect(filter);
  filter.connect(amp);
  amp.connect(audioState.masterGain || audioState.context.destination);
  source.start(when);
  source.stop(when + duration);
}

function startMusicLoop() {
  const audio = ensureAudio();
  if (!audio || !state.settings.music) {
    return;
  }

  if (audioState.musicStarted) {
    return;
  }

  audioState.musicStarted = true;
  audioState.musicStep = 0;
  scheduleMusicWindow();
}

function stopMusicLoop() {
  clearTimeout(audioState.musicTimer);
  audioState.musicTimer = 0;
  audioState.musicStarted = false;
}

function applyVolumeSetting() {
  if (audioState.masterGain) {
    audioState.masterGain.gain.value = state.settings.volume;
  }
  if (volumeReadoutEl) {
    volumeReadoutEl.textContent = `${Math.round(state.settings.volume * 100)}%`;
  }
}

function currentMusicTheme() {
  return MUSIC_THEMES[state.settings.type] || MUSIC_THEMES.random;
}

function semitoneOffset(frequency, semitones) {
  return frequency * 2 ** (semitones / 12);
}

function scheduleKick(when, gain = 0.07) {
  scheduleTone({
    frequency: 58,
    type: "sine",
    when,
    duration: 0.12,
    gain,
    attack: 0.001,
    release: 0.08,
  });
  scheduleTone({
    frequency: 116,
    type: "triangle",
    when,
    duration: 0.05,
    gain: gain * 0.55,
    attack: 0.001,
    release: 0.05,
  });
}

function scheduleSnare(when, gain = 0.045) {
  scheduleNoiseBurst(when, 0.11, gain, 0.0001, 1800);
  scheduleTone({
    frequency: 210,
    type: "triangle",
    when,
    duration: 0.07,
    gain: gain * 0.45,
    attack: 0.002,
    release: 0.06,
  });
}

function scheduleHat(when, gain = 0.016) {
  scheduleNoiseBurst(when, 0.035, gain, 0.0001, 5400);
}

/**
 * Schedules a block of theme notes and re-queues itself after ~that much
 * **audio** time so playback stays continuous. A fixed `setInterval` was
 * longer than each block, which caused regular silent gaps (“cutting out”).
 */
function scheduleMusicWindow() {
  clearTimeout(audioState.musicTimer);
  audioState.musicTimer = 0;

  const audio = ensureAudio();
  if (!audio || !state.settings.music) {
    return;
  }

    if (audio.state !== "running") {
    audioState.musicTimer = window.setTimeout(scheduleMusicWindow, 150);
    return;
  }

  const theme = currentMusicTheme();
  const danger = clamp(state.musicDanger, 0, 1);
  const windowSteps = 8;
  const beat =
    theme.tempo * (state.settings.cheat ? 1.12 : 1) * (1 - danger * 0.24);
  const barLength = beat * (windowSteps * 0.5);
  const startWhen = audio.currentTime + 0.08;
  let when = startWhen;
  const percussionGain = 1 + danger * 0.7;
  const menaceGain = danger * danger;

  for (let i = 0; i < windowSteps; i += 1) {
    const stepIndex = audioState.musicStep + i;
    const lane = stepIndex % 8;
    const bassFrequency = theme.bass[lane % theme.bass.length];
    const leadFrequency = theme.lead[lane % theme.lead.length];
    const menaceFrequency = semitoneOffset(leadFrequency, -3);
    const stepWhen = startWhen + i * beat * 0.5;

    if (i % 2 === 0) {
      scheduleKick(stepWhen, 0.075 * percussionGain);
      scheduleTone({
        frequency: bassFrequency,
        type: "sawtooth",
        when: stepWhen,
        duration: beat * 0.42,
        gain: 0.03 + danger * 0.012,
        attack: 0.004,
        release: 0.08,
      });
      scheduleTone({
        frequency: bassFrequency / 2,
        type: "triangle",
        when: stepWhen,
        duration: beat * 0.5,
        gain: 0.018 + danger * 0.009,
        attack: 0.004,
        release: 0.09,
      });
      if (danger > 0.45) {
        scheduleTone({
          frequency: bassFrequency * 0.5,
          type: "square",
          when: stepWhen + beat * 0.02,
          duration: beat * 0.26,
          gain: 0.005 + menaceGain * 0.02,
          attack: 0.002,
          release: 0.06,
        });
      }
    } else {
      scheduleHat(
        stepWhen,
        0.012 + (i % 4 === 1 ? 0.008 : 0) + danger * 0.01,
      );
    }

    if (i % 4 === 2) {
      scheduleSnare(stepWhen, 0.05 + danger * 0.025);
    }

    if (i % 8 === 7) {
      scheduleTone({
        frequency: danger > 0.55 ? semitoneOffset(theme.accent, -5) : theme.accent,
        type: "square",
        when: stepWhen,
        duration: beat * 0.18,
        gain: 0.012 + danger * 0.01,
        attack: 0.003,
        release: 0.05,
      });
    }

    if (i % 2 === 0) {
      scheduleNoteStack({
        frequency: leadFrequency,
        when: stepWhen + beat * 0.06,
        duration: beat * 0.36,
        gain: (i % 8 === 0 ? 0.03 : 0.022) + danger * 0.006,
      });
      scheduleTone({
        frequency: leadFrequency * 2,
        type: "sine",
        when: stepWhen + beat * 0.08,
        duration: beat * 0.22,
        gain: 0.008 + danger * 0.003,
        attack: 0.004,
        release: 0.05,
      });
    }

    if (danger > 0.25 && i % 4 === 1) {
      scheduleTone({
        frequency: menaceFrequency,
        type: "square",
        when: stepWhen + beat * 0.04,
        duration: beat * 0.28,
        gain: 0.004 + menaceGain * 0.024,
        attack: 0.002,
        release: 0.07,
      });
    }

    when = stepWhen + beat * 0.5;
  }

  audioState.musicStep += windowSteps;

  const windowSpanAudioSec = Math.max(barLength, when - startWhen);
  const leadMs = 120;
  const delayMs = Math.max(
    40,
    Math.round(windowSpanAudioSec * 1000) - leadMs,
  );
  audioState.musicTimer = window.setTimeout(scheduleMusicWindow, delayMs);
}

/** Freeze + visuals/audio before `completePendingLoseLife` runs (ms). */
const CRASH_EFFECT_MS = 1000;

function playCrashSound() {
  const audio = ensureAudio();
  if (!audio) {
    return;
  }

  const when = audio.currentTime + 0.01;
  scheduleNoiseBurst(when, 0.24, 0.11, 0.0001, 720);
  scheduleNoiseBurst(when + 0.035, 0.14, 0.05, 0.0001, 1900);
  scheduleTone({
    frequency: 180,
    type: "sawtooth",
    when,
    duration: 0.22,
    gain: 0.06,
    attack: 0.004,
    release: 0.12,
  });
  scheduleTone({
    frequency: 92,
    type: "sine",
    when: when + 0.03,
    duration: 0.28,
    gain: 0.04,
    attack: 0.006,
    release: 0.14,
  });
  scheduleTone({
    frequency: 63,
    type: "triangle",
    when: when + 0.09,
    duration: 0.24,
    gain: 0.038,
    attack: 0.003,
    release: 0.16,
  });
}

function playPlayerExplosionSound() {
  const audio = ensureAudio();
  if (!audio) {
    return;
  }

  const when = audio.currentTime + 0.01;
  scheduleNoiseBurst(when, 0.44, 0.16, 0.0001, 1500);
  scheduleNoiseBurst(when + 0.03, 0.24, 0.08, 0.0001, 720);
  scheduleNoiseBurst(when + 0.09, 0.18, 0.035, 0.0001, 3200);
  scheduleTone({
    frequency: 420,
    type: "sawtooth",
    when,
    duration: 0.12,
    gain: 0.065,
    attack: 0.002,
    release: 0.1,
  });
  scheduleTone({
    frequency: 165,
    type: "triangle",
    when: when + 0.04,
    duration: 0.28,
    gain: 0.045,
    attack: 0.004,
    release: 0.16,
  });
  scheduleTone({
    frequency: 70,
    type: "sine",
    when: when + 0.08,
    duration: 0.32,
    gain: 0.038,
    attack: 0.01,
    release: 0.2,
  });
  scheduleTone({
    frequency: 48,
    type: "sine",
    when: when + 0.12,
    duration: 0.36,
    gain: 0.04,
    attack: 0.008,
    release: 0.24,
  });
}

function spawnPlayerCrashParticles(centerX, centerY) {
  state.playerCrashParticles = [];
  const count = 30;
  const baseSpeed = 320;
  const colors = [
    "#ff6b35",
    "#ffd93d",
    "#ffffff",
    "#ff3b3b",
    "#ffaa00",
    "#ffffaa",
    "#ff8844",
    "#7efbff",
    "#ff5fd8",
  ];
  for (let i = 0; i < count; i += 1) {
    const angle = (Math.PI * 2 * i) / count + (randomInt(256) / 256) * 0.45;
    const speed = baseSpeed * (0.55 + (randomInt(256) / 256) * 0.85);
    state.playerCrashParticles.push({
      x: centerX,
      y: centerY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      color: colors[i % colors.length],
    });
  }
}

function updatePlayerCrashParticles(deltaTime) {
  const scale = 0.45 + state.settings.speed * 0.15;
  const next = [];
  for (const p of state.playerCrashParticles) {
    const x = p.x + p.vx * scale * deltaTime;
    const y = p.y + p.vy * scale * deltaTime;
    if (
      x > -24 &&
      x < canvas.width + 24 &&
      y > -24 &&
      y < canvas.height + 24
    ) {
      next.push({ ...p, x, y });
    }
  }
  state.playerCrashParticles = next;
}

function drawPlayerCrashParticles() {
  for (const p of state.playerCrashParticles) {
    const ang = Math.atan2(p.vy, p.vx);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(ang);
    ctx.strokeStyle = p.color;
    ctx.lineWidth = 2.5;
    ctx.shadowColor = "rgba(255, 200, 120, 0.5)";
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.moveTo(-11, 0);
    ctx.lineTo(9, 0);
    ctx.stroke();
    ctx.restore();
  }
}

function playCaptureRiser(capturedCells) {
  const audio = ensureAudio();
  if (!audio) {
    return;
  }

  const steps = Math.max(4, Math.min(10, Math.floor(capturedCells / 8)));
  const scale = [
    392, 440, 493.88, 523.25, 587.33, 659.25, 783.99, 880, 987.77, 1046.5,
  ];
  const start = audio.currentTime + 0.01;

  for (let i = 0; i < steps; i += 1) {
    const when = start + i * 0.045;
    const frequency = scale[Math.min(scale.length - 1, i)];
    scheduleTone({
      frequency,
      type: "triangle",
      when,
      duration: 0.09,
      gain: 0.032,
      attack: 0.006,
      release: 0.06,
    });
    scheduleTone({
      frequency: frequency * 2,
      type: "sine",
      when,
      duration: 0.07,
      gain: 0.018,
      attack: 0.005,
      release: 0.05,
    });
  }
}

function playLevelFanfare() {
  const audio = ensureAudio();
  if (!audio) {
    return;
  }

  const start = audio.currentTime + 0.03;
  const notes = [
    { freq: 392, offset: 0.0, len: 0.16 },
    { freq: 523.25, offset: 0.14, len: 0.16 },
    { freq: 659.25, offset: 0.28, len: 0.18 },
    { freq: 783.99, offset: 0.48, len: 0.2 },
    { freq: 1046.5, offset: 0.7, len: 0.24 },
    { freq: 1174.66, offset: 0.96, len: 0.2 },
    { freq: 1318.51, offset: 1.16, len: 0.22 },
    { freq: 1567.98, offset: 1.42, len: 0.56 },
  ];

  for (const note of notes) {
    scheduleTone({
      frequency: note.freq,
      type: "sawtooth",
      when: start + note.offset,
      duration: note.len,
      gain: 0.04,
      attack: 0.009,
      release: 0.14,
    });
    scheduleTone({
      frequency: note.freq * 1.5,
      type: "triangle",
      when: start + note.offset,
      duration: note.len * 0.9,
      gain: 0.022,
      attack: 0.01,
      release: 0.12,
    });
    scheduleTone({
      frequency: note.freq * 2,
      type: "sine",
      when: start + note.offset + 0.02,
      duration: note.len * 0.8,
      gain: 0.014,
      attack: 0.008,
      release: 0.1,
    });
    scheduleTone({
      frequency: note.freq * 0.5,
      type: "triangle",
      when: start + note.offset,
      duration: note.len * 1.15,
      gain: 0.012,
      attack: 0.01,
      release: 0.15,
    });
  }

  const pedal = [
    { freq: 196, offset: 0.0, len: 0.55 },
    { freq: 220, offset: 0.6, len: 0.55 },
    { freq: 261.63, offset: 1.22, len: 0.92 },
  ];

  for (const note of pedal) {
    scheduleTone({
      frequency: note.freq,
      type: "triangle",
      when: start + note.offset,
      duration: note.len,
      gain: 0.026,
      attack: 0.02,
      release: 0.18,
    });
  }

  for (let i = 0; i < 8; i += 1) {
    scheduleHat(start + 0.18 + i * 0.12, 0.012 + i * 0.002);
  }
}

function playPickupSound(kind) {
  const audio = ensureAudio();
  if (!audio) {
    return;
  }

  const when = audio.currentTime + 0.01;

  if (kind === PICKUP_KIND_HEART) {
    [659.25, 880, 1174.66].forEach((freq, index) => {
      scheduleTone({
        frequency: freq,
        type: "triangle",
        when: when + index * 0.055,
        duration: 0.11,
        gain: 0.028,
        attack: 0.004,
        release: 0.08,
      });
    });
    scheduleTone({
      frequency: 1318.51,
      type: "sine",
      when: when + 0.19,
      duration: 0.18,
      gain: 0.022,
      attack: 0.006,
      release: 0.09,
    });
    return;
  }

  if (kind === PICKUP_KIND_SHIELD) {
    [523.25, 659.25, 783.99].forEach((freq, index) => {
      scheduleTone({
        frequency: freq,
        type: "sine",
        when: when + index * 0.05,
        duration: 0.12,
        gain: 0.024,
        attack: 0.004,
        release: 0.08,
      });
    });
    scheduleTone({
      frequency: 1046.5,
      type: "triangle",
      when: when + 0.17,
      duration: 0.2,
      gain: 0.026,
      attack: 0.006,
      release: 0.1,
    });
    return;
  }

  if (kind === PICKUP_KIND_COOKIE) {
    [659.25, 783.99, 987.77].forEach((freq, index) => {
      scheduleTone({
        frequency: freq,
        type: "triangle",
        when: when + index * 0.045,
        duration: 0.1,
        gain: 0.03,
        attack: 0.005,
        release: 0.08,
      });
    });
    scheduleHat(when + 0.02, 0.02);
    return;
  }

  scheduleNoiseBurst(when, 0.11, 0.05, 0.0001, 960);
  scheduleTone({
    frequency: 196,
    type: "square",
    when,
    duration: 0.09,
    gain: 0.03,
    attack: 0.003,
    release: 0.07,
  });
  scheduleTone({
    frequency: 110,
    type: "triangle",
    when: when + 0.04,
    duration: 0.16,
    gain: 0.034,
    attack: 0.003,
    release: 0.1,
  });
}

function showOverlay(text) {
  messageEl.textContent = text;
  overlay.classList.remove("level-clear");
  overlay.classList.remove("hidden");
}

function hideOverlay() {
  overlay.classList.add("hidden");
}

function triggerUiBoom(kind = "capture") {
  const className = `${kind}-boom`;
  const durations = {
    capture: 520,
    clear: 1100,
    death: 900,
    boost: 580,
    slow: 680,
  };
  [boardWrapEl, stagePanelEl, sidebarEl].forEach((el) => {
    if (!el) {
      return;
    }
    el.classList.remove(className);
    void el.offsetWidth;
    el.classList.add(className);
  });

  window.setTimeout(() => {
    [boardWrapEl, stagePanelEl, sidebarEl].forEach((el) => {
      el?.classList.remove(className);
    });
  }, durations[kind] || 520);
}

function createGrid() {
  state.grid = Array.from({ length: ROWS }, (_, row) =>
    Array.from({ length: COLS }, (_, col) =>
      row === 0 || col === 0 || row === ROWS - 1 || col === COLS - 1
        ? TILE_SAFE
        : TILE_EMPTY,
    ),
  );
  safeGridDirty = true;
}

function setHud() {
  const claimed = Math.floor(state.capturePercent);
  claimedEl.textContent = `${claimed}%`;
  requiredReadoutEl.textContent = `${getCaptureGoal()}%`;
  levelReadoutEl.textContent = String(state.level).padStart(2, "0");
  livesEl.textContent = String(state.lives);
  scoreReadoutEl.textContent = String(
    Math.max(0, Math.floor(state.score)),
  ).padStart(6, "0");
  highscoreReadoutEl.textContent = String(
    Math.max(0, Math.floor(state.highScore)),
  ).padStart(6, "0");
  speedValueEl.textContent = String(state.settings.speed);
  applyVolumeSetting();
}

function setPowerRail() {
  const remaining = Math.max(
    0,
    1 - state.elapsedSeconds / config.levelTimeLimit,
  );
  const hue = 8 + remaining * 112;
  powerFillEl.style.transform = `scaleX(${remaining})`;
  powerFillEl.style.background = `hsl(${hue}, 95%, 60%)`;
}

function setDangerPresentation() {
  boardWrapEl?.style.setProperty("--danger-level", state.musicDanger.toFixed(3));
}

function currentLevelScoreSlice() {
  return Math.max(
    0,
    state.level * 100 +
      Math.floor(state.capturePercent * 100) -
      Math.floor(state.elapsedSeconds),
  );
}

function recomputeScore() {
  state.score = state.carryScore + currentLevelScoreSlice();
  setHud();
  setPowerRail();
  maybeUpdateHighScore();
}

async function fetchHighScore() {
  state.highScore = Math.max(
    0,
    Number(window.localStorage.getItem(HIGH_SCORE_KEY)) || 0,
  );
  setHud();
}

async function saveHighScore(score) {
  const safeScore = Math.max(0, Math.floor(score));
  window.localStorage.setItem(HIGH_SCORE_KEY, String(safeScore));
}

function loadSettings() {
  try {
    const raw = window.localStorage.getItem(OPTIONS_KEY);
    if (!raw) {
      return;
    }
    const parsed = JSON.parse(raw);
    state.settings.speed = clamp(Number(parsed.speed) || state.settings.speed, 1, 10);
    if (parsed.magic === "normal" || parsed.magic === "more") {
      state.settings.magic = parsed.magic;
    }
    if (typeof parsed.type === "string") {
      state.settings.type = parsed.type;
    }
    state.settings.cheat = Boolean(parsed.cheat);
    state.settings.music =
      parsed.music === undefined ? state.settings.music : Boolean(parsed.music);
    state.settings.volume = clamp(Number(parsed.volume) || state.settings.volume, 0, 1);
  } catch {
    // ignore bad local storage
  }
}

function persistSettings() {
  window.localStorage.setItem(
    OPTIONS_KEY,
    JSON.stringify({
      speed: state.settings.speed,
      magic: state.settings.magic,
      type: state.settings.type,
      cheat: state.settings.cheat,
      music: state.settings.music,
      volume: state.settings.volume,
    }),
  );
}

function maybeUpdateHighScore() {
  if (state.score <= state.highScore || state.savingHighScore) {
    return;
  }

  state.highScore = Math.floor(state.score);
  setHud();
  state.savingHighScore = true;
  saveHighScore(state.highScore).finally(() => {
    state.savingHighScore = false;
  });
}

function getCaptureGoal() {
  return Math.min(
    config.maxCaptureGoal,
    config.baseCaptureGoal + (state.level - 1) * config.captureGoalStep,
  );
}

function currentSpeedEffect(now = performance.now()) {
  if (state.speedEffectUntil <= now) {
    return "";
  }
  return state.speedEffectKind;
}

function shieldActive(now = performance.now()) {
  if (state.shieldUntil <= now) {
    state.shieldUntil = 0;
    return false;
  }
  return true;
}

function magicIntervalMultiplier() {
  return state.settings.magic === "normal" ? 2 : 1;
}

function baseMoveScale() {
  return 0.45 + state.settings.speed * 0.15;
}

function effectDurationMs(kind) {
  return kind === PICKUP_KIND_BOMB
    ? config.bombSlowMs
    : kind === PICKUP_KIND_COOKIE
      ? config.cookieBoostMs
      : kind === PICKUP_KIND_SHIELD
        ? config.shieldMs
        : 0;
}

function pickupLifetimeMs(pickup) {
  return pickup.kind === PICKUP_KIND_COOKIE && pickup.zone === "field"
    ? config.fieldCookieLifetimeMs
    : config.pickupLifetimeMs;
}

function effectSpeedMultiplier(kind) {
  if (kind === PICKUP_KIND_BOMB) {
    return 0.5;
  }
  if (kind === PICKUP_KIND_COOKIE) {
    return 1.75;
  }
  return 1;
}

function currentMoveScale(now = performance.now()) {
  let scale = baseMoveScale();
  scale *= effectSpeedMultiplier(currentSpeedEffect(now));
  if (state.player.drawing && state.keys.shift) {
    scale *= 1.85;
  }
  return scale;
}

function currentSparkEffect(spark, now = performance.now()) {
  if (!spark || spark.effectUntil <= now) {
    if (spark) {
      spark.effectKind = "";
      spark.effectUntil = 0;
    }
    return "";
  }
  return spark.effectKind;
}

function scheduleNextPickupSpawn(now = performance.now()) {
  const spread = config.pickupSpawnMaxMs - config.pickupSpawnMinMs;
  const intervalMult = magicIntervalMultiplier();
  state.nextPickupSpawnAt =
    now +
    (config.pickupSpawnMinMs +
      (spread > 0 ? randomInt(spread + 1) : 0)) *
      intervalMult;
}

function scheduleNextArenaCookieSpawn(now = performance.now()) {
  const spread = config.fieldCookieSpawnMaxMs - config.fieldCookieSpawnMinMs;
  const intervalMult = magicIntervalMultiplier();
  state.nextArenaCookieSpawnAt =
    now +
    (config.fieldCookieSpawnMinMs +
      (spread > 0 ? randomInt(spread + 1) : 0)) *
      intervalMult;
}

function resetPickupState(now = performance.now()) {
  state.pickups = [];
  state.speedEffectKind = "";
  state.speedEffectUntil = 0;
  state.shieldUntil = 0;
  state.railPickupCounter = 0;
  scheduleNextPickupSpawn(now + 1800);
  scheduleNextArenaCookieSpawn(now + 900);
}

function railPickupCandidates() {
  const occupied = new Set(state.pickups.map((pickup) => tileKey(pickup.col, pickup.row)));
  const playerKey = tileKey(state.player.col, state.player.row);
  const sparkKeys = new Set(state.sparks.map((spark) => tileKey(spark.col, spark.row)));
  const candidates = [];

  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      const key = tileKey(col, row);
      if (!isRailTile(col, row) || key === playerKey || occupied.has(key) || sparkKeys.has(key)) {
        continue;
      }

      const distance = Math.abs(col - state.player.col) + Math.abs(row - state.player.row);
      if (distance < 7) {
        continue;
      }

      candidates.push({ col, row });
    }
  }

  return candidates;
}

function spawnRailPickup(now = performance.now()) {
  if (state.pickups.filter((pickup) => pickup.zone === "rail").length >= 2) {
    scheduleNextPickupSpawn(now + 1500);
    return;
  }

  const candidates = railPickupCandidates();
  if (candidates.length === 0) {
    scheduleNextPickupSpawn(now + 1000);
    return;
  }

  const choice = candidates[randomInt(candidates.length)];
  state.railPickupCounter += 1;
  const kind =
    state.railPickupCounter % 3 === 0 || randomInt(100) < 20
      ? PICKUP_KIND_HEART
      : PICKUP_KIND_BOMB;
  state.pickups.push({
    kind,
    zone: "rail",
    col: choice.col,
    row: choice.row,
    bornAt: now,
    expiresAt: now + pickupLifetimeMs({ kind, zone: "rail" }),
    wobble: randomInt(4096) / 4096,
  });
  scheduleNextPickupSpawn(now);
}

function randomArenaCookieCell() {
  const occupied = new Set(state.pickups.map((pickup) => tileKey(pickup.col, pickup.row)));
  const tries = 28;
  for (let attempt = 0; attempt < tries; attempt += 1) {
    const col = 1 + randomInt(Math.max(1, COLS - 2));
    const row = 1 + randomInt(Math.max(1, ROWS - 2));
    const key = tileKey(col, row);
    if (occupied.has(key)) {
      continue;
    }
    if (state.grid[row][col] !== TILE_EMPTY) {
      continue;
    }
    const distance = Math.abs(col - state.player.col) + Math.abs(row - state.player.row);
    if (distance < 4) {
      continue;
    }
    return { col, row };
  }
  return null;
}

function spawnArenaCookie(now = performance.now()) {
  const fieldCookies = state.pickups.filter(
    (pickup) => pickup.kind === PICKUP_KIND_COOKIE && pickup.zone === "field",
  ).length;
  if (fieldCookies >= config.maxFieldCookies) {
    scheduleNextArenaCookieSpawn(now + 300);
    return;
  }

  const choice = randomArenaCookieCell();
  if (!choice) {
    scheduleNextArenaCookieSpawn(now + 400);
    return;
  }

  state.pickups.push({
    kind: PICKUP_KIND_COOKIE,
    zone: "field",
    col: choice.col,
    row: choice.row,
    bornAt: now,
    expiresAt: now + pickupLifetimeMs({ kind: PICKUP_KIND_COOKIE, zone: "field" }),
    wobble: randomInt(4096) / 4096,
  });
  scheduleNextArenaCookieSpawn(now);
}

function spawnArenaShield(now = performance.now()) {
  const fieldShields = state.pickups.filter(
    (pickup) => pickup.kind === PICKUP_KIND_SHIELD && pickup.zone === "field",
  ).length;
  if (fieldShields >= config.maxFieldShields) {
    return false;
  }

  const choice = randomArenaCookieCell();
  if (!choice) {
    return false;
  }

  state.pickups.push({
    kind: PICKUP_KIND_SHIELD,
    zone: "field",
    col: choice.col,
    row: choice.row,
    bornAt: now,
    expiresAt: now + config.pickupLifetimeMs,
    wobble: randomInt(4096) / 4096,
  });
  return true;
}

function collectPickup(pickup, now = performance.now()) {
  if (pickup.kind === PICKUP_KIND_HEART) {
    state.lives = Math.min(config.maxLives, state.lives + 1);
    setHud();
    playPickupSound(pickup.kind);
    triggerUiBoom("boost");
    return;
  }

  if (pickup.kind === PICKUP_KIND_SHIELD) {
    state.shieldUntil = now + config.shieldMs;
    playPickupSound(pickup.kind);
    triggerUiBoom("boost");
    return;
  }

  state.speedEffectKind = pickup.kind;
  state.speedEffectUntil = now + effectDurationMs(pickup.kind);
  state.screenShakeUntil = Math.max(
    state.screenShakeUntil,
    now + (pickup.kind === PICKUP_KIND_BOMB ? 220 : 140),
  );
  state.screenShakeStrength = Math.max(
    state.screenShakeStrength,
    pickup.kind === PICKUP_KIND_BOMB ? 4 : 2,
  );
  playPickupSound(pickup.kind);
  triggerUiBoom(pickup.kind === PICKUP_KIND_BOMB ? "slow" : "boost");
}

function giveSparkPickupEffect(spark, kind, now = performance.now()) {
  spark.effectKind = kind;
  spark.effectUntil = now + effectDurationMs(kind);
}

function playerPickupHit(pickup) {
  const dx = Math.abs(pickup.col - state.player.col);
  const dy = Math.abs(pickup.row - state.player.row);

  if (pickup.kind === PICKUP_KIND_COOKIE || pickup.kind === PICKUP_KIND_SHIELD) {
    return dx <= 1 && dy <= 1;
  }

  return dx === 0 && dy === 0;
}

function updatePickups(now = performance.now()) {
  state.pickups = state.pickups.filter(
    (pickup) =>
      pickup.expiresAt > now &&
      (pickup.zone === "rail"
        ? isRailTile(pickup.col, pickup.row)
        : [TILE_EMPTY, TILE_TRAIL].includes(state.grid[pickup.row]?.[pickup.col])),
  );

  if (state.speedEffectUntil <= now) {
    state.speedEffectKind = "";
    state.speedEffectUntil = 0;
  }

  if (
    state.running &&
    now >= state.nextPickupSpawnAt &&
    now >= state.spawnPauseUntil + 600
  ) {
    spawnRailPickup(now);
  }
  if (
    state.running &&
    now >= state.nextArenaCookieSpawnAt &&
    now >= state.spawnPauseUntil + 350
  ) {
    if (randomInt(100) < 33) {
      const spawnedShield = spawnArenaShield(now);
      if (!spawnedShield) {
        spawnArenaCookie(now);
      } else {
        scheduleNextArenaCookieSpawn(now);
      }
    } else {
      spawnArenaCookie(now);
    }
  }

  const hitIndex = state.pickups.findIndex(
    (pickup) => playerPickupHit(pickup),
  );
  if (hitIndex >= 0) {
    const [pickup] = state.pickups.splice(hitIndex, 1);
    collectPickup(pickup, now);
    return;
  }

  const sparkPickupIndex = state.pickups.findIndex((pickup) =>
    pickup.zone === "rail" &&
    pickup.kind !== PICKUP_KIND_HEART &&
    state.sparks.some(
      (spark) => spark.col === pickup.col && spark.row === pickup.row,
    ),
  );
  if (sparkPickupIndex >= 0) {
    const [pickup] = state.pickups.splice(sparkPickupIndex, 1);
    for (const spark of state.sparks) {
      if (spark.col === pickup.col && spark.row === pickup.row) {
        giveSparkPickupEffect(spark, pickup.kind, now);
      }
    }
  }
}

/** When cheat is on, QiX and sparks move at half speed. */
function enemyCheatSpeedMult() {
  return state.settings.cheat ? 0.28 : 1;
}

function randomInt(maxExclusive) {
  if (maxExclusive <= 1) {
    return 0;
  }

  const randomValues = new Uint32Array(1);
  window.crypto.getRandomValues(randomValues);
  return randomValues[0] % maxExclusive;
}

function currentImageType() {
  return state.settings.type;
}

function currentImagePool(type) {
  return imageSources[type] || [];
}

function shuffledImageQueue(pool, currentImage = "") {
  const queue = [...pool];

  for (let index = queue.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(index + 1);
    [queue[index], queue[swapIndex]] = [queue[swapIndex], queue[index]];
  }

  if (queue.length > 1 && queue[0] === currentImage) {
    [queue[0], queue[1]] = [queue[1], queue[0]];
  }

  return queue;
}

function buildPuzzlePieces() {
  if (imageLayerEl.children.length > 0) {
    return;
  }

  for (let index = 0; index < PUZZLE_GRID * PUZZLE_GRID; index += 1) {
    const piece = document.createElement("div");
    const col = index % PUZZLE_GRID;
    const row = Math.floor(index / PUZZLE_GRID);
    piece.className = "puzzle-piece";
    piece.dataset.homeIndex = String(index);
    piece.style.backgroundPosition = `${col * 50}% ${row * 50}%`;
    imageLayerEl.appendChild(piece);
  }
}

function shuffledPuzzleOrder() {
  const order = Array.from(
    { length: PUZZLE_GRID * PUZZLE_GRID },
    (_, index) => index,
  );

  for (let index = order.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(index + 1);
    [order[index], order[swapIndex]] = [order[swapIndex], order[index]];
  }

  if (order.every((value, index) => value === index) && order.length > 1) {
    [order[0], order[1]] = [order[1], order[0]];
  }

  return order;
}

function setPuzzleLayout(
  imageWidth = canvas.width,
  imageHeight = canvas.height,
) {
  const scale = Math.min(
    canvas.width / imageWidth,
    canvas.height / imageHeight,
  );
  const drawWidth = imageWidth * scale;
  const drawHeight = imageHeight * scale;
  const offsetX = (canvas.width - drawWidth) / 2;
  const offsetY = (canvas.height - drawHeight) / 2;
  const pieceWidth = drawWidth / PUZZLE_GRID;
  const pieceHeight = drawHeight / PUZZLE_GRID;

  const pieces = Array.from(imageLayerEl.children);
  pieces.forEach((piece, homeIndex) => {
    const slotIndex = state.puzzleOrder[homeIndex] ?? homeIndex;
    const slotCol = slotIndex % PUZZLE_GRID;
    const slotRow = Math.floor(slotIndex / PUZZLE_GRID);
    piece.style.width = `${(pieceWidth / canvas.width) * 100}%`;
    piece.style.height = `${(pieceHeight / canvas.height) * 100}%`;
    piece.style.left = `${((offsetX + slotCol * pieceWidth) / canvas.width) * 100}%`;
    piece.style.top = `${((offsetY + slotRow * pieceHeight) / canvas.height) * 100}%`;
  });
}

function resolvePuzzleLayout() {
  const pieces = Array.from(imageLayerEl.children);
  pieces.forEach((piece, homeIndex) => {
    const col = homeIndex % PUZZLE_GRID;
    const row = Math.floor(homeIndex / PUZZLE_GRID);
    const currentWidth = parseFloat(piece.style.width) || 100 / PUZZLE_GRID;
    const currentHeight = parseFloat(piece.style.height) || 100 / PUZZLE_GRID;
    const baseLeft =
      parseFloat(piece.style.left) -
      ((state.puzzleOrder[homeIndex] ?? homeIndex) % PUZZLE_GRID) *
        currentWidth;
    const baseTop =
      parseFloat(piece.style.top) -
      Math.floor((state.puzzleOrder[homeIndex] ?? homeIndex) / PUZZLE_GRID) *
        currentHeight;
    piece.style.left = `${baseLeft + col * currentWidth}%`;
    piece.style.top = `${baseTop + row * currentHeight}%`;
  });
}

function applyBoardImage(
  url,
  pool = [],
  startIndex = 0,
  attempts = pool.length || 1,
) {
  const requestId = state.imageRequestId + 1;
  state.imageRequestId = requestId;

  if (!url) {
    imageLayerEl.replaceChildren();
    imageLayerEl.style.backgroundImage = "";
    if (revealImageEl) {
      revealImageEl.removeAttribute("src");
    }
    return;
  }

  const probe = new Image();
  probe.referrerPolicy = "no-referrer";
  probe.onload = () => {
    if (state.imageRequestId === requestId) {
      buildPuzzlePieces();
      imageLayerEl.style.backgroundImage = `url("${url}")`;
      if (revealImageEl) {
        revealImageEl.src = url;
      }
      const pieces = Array.from(imageLayerEl.children);
      pieces.forEach((piece) => {
        piece.style.backgroundImage = `url("${url}")`;
      });
      state.puzzleOrder = shuffledPuzzleOrder();
      setPuzzleLayout(
        probe.naturalWidth || canvas.width,
        probe.naturalHeight || canvas.height,
      );
    }
  };
  probe.onerror = () => {
    if (state.imageRequestId !== requestId) {
      return;
    }

    if (attempts > 1 && pool.length > 1) {
      const nextIndex = (startIndex + 1) % pool.length;
      const nextImage = pool[nextIndex];
      state.currentImage = nextImage;
      applyBoardImage(nextImage, pool, nextIndex, attempts - 1);
    } else {
      imageLayerEl.replaceChildren();
      imageLayerEl.style.backgroundImage = "";
      if (revealImageEl) {
        revealImageEl.removeAttribute("src");
      }
    }
  };
  probe.src = url;
}

function chooseNextRevealImage() {
  const type = currentImageType();
  const pool = currentImagePool(type);
  if (pool.length === 0) {
    state.currentImage = "";
    state.currentImageType = type;
    state.imageQueues[type] = [];
    imageLayerEl.replaceChildren();
    imageLayerEl.style.backgroundImage = "";
    if (revealImageEl) {
      revealImageEl.removeAttribute("src");
    }
    return;
  }

  const queue = state.imageQueues[type] || [];
  if (queue.length === 0) {
    state.imageQueues[type] = shuffledImageQueue(
      pool,
      type === state.currentImageType ? state.currentImage : "",
    );
  }

  const nextQueue = state.imageQueues[type];
  const nextImage = nextQueue.shift();
  const index = Math.max(0, pool.indexOf(nextImage));
  const roll = index + 1;

  state.currentImage = nextImage;
  state.currentImageType = type;
  state.currentImageRoll = roll;
  applyBoardImage(nextImage, pool, index);
}

function tileKey(col, row) {
  return `${col},${row}`;
}

function resetEnemyResidue() {
  state.enemyResidue = new Map();
}

function enemyResidueAt(col, row, now = performance.now()) {
  const key = tileKey(col, row);
  const residue = state.enemyResidue.get(key);
  if (!residue) {
    return null;
  }
  if (residue.expiresAt <= now) {
    state.enemyResidue.delete(key);
    return null;
  }
  return residue;
}

function addEnemyResidueCell(col, row, hue, now, intensity = 0.64) {
  if (!insideBoard(col, row) || state.grid[row][col] !== TILE_EMPTY) {
    return;
  }

  const key = tileKey(col, row);
  const existing = state.enemyResidue.get(key);
  state.enemyResidue.set(key, {
    col,
    row,
    hue,
    intensity: clamp(
      Math.max(intensity, existing?.intensity || 0) + 0.08,
      0.4,
      1,
    ),
    expiresAt: now + config.residueLifetimeMs,
  });

  while (state.enemyResidue.size > config.maxResidueCells) {
    const oldestKey = state.enemyResidue.keys().next().value;
    if (oldestKey === undefined) {
      break;
    }
    state.enemyResidue.delete(oldestKey);
  }
}

function dropEnemyResidue(enemy, now) {
  const segments = qixSegments(enemy);
  const samples = [
    { x: enemy.x, y: enemy.y, intensity: 0.74 },
    { x: segments[0].ax, y: segments[0].ay, intensity: 0.52 },
    { x: segments[0].bx, y: segments[0].by, intensity: 0.52 },
    { x: segments[1].ax, y: segments[1].ay, intensity: 0.52 },
    { x: segments[1].bx, y: segments[1].by, intensity: 0.52 },
  ];
  const seen = new Set();

  for (const sample of samples) {
    const col = Math.max(0, Math.min(COLS - 1, Math.floor(sample.x / CELL)));
    const row = Math.max(0, Math.min(ROWS - 1, Math.floor(sample.y / CELL)));
    const key = tileKey(col, row);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    addEnemyResidueCell(col, row, enemy.hue, now, sample.intensity);
  }
}

function updateEnemyResidue(now) {
  for (const [key, residue] of state.enemyResidue) {
    if (residue.expiresAt <= now) {
      state.enemyResidue.delete(key);
    }
  }
}

function residueHitsTrail(now) {
  for (const point of state.player.trail) {
    if (enemyResidueAt(point.col, point.row, now)) {
      return true;
    }
  }
  return false;
}

function getDirection() {
  if (state.keys.w) {
    return { x: 0, y: -1 };
  }
  if (state.keys.s) {
    return { x: 0, y: 1 };
  }
  if (state.keys.a) {
    return { x: -1, y: 0 };
  }
  if (state.keys.d) {
    return { x: 1, y: 0 };
  }
  return state.player.dir;
}

function resetPlayer() {
  state.player.col = 0;
  state.player.row = Math.floor(ROWS / 2);
  state.player.dir = { x: 1, y: 0 };
  state.player.drawing = false;
  state.player.trail = [];
  state.player.trailSet.clear();
}

function beginSpawnPause(now = performance.now()) {
  state.moveClock = 0;
  state.spawnPauseUntil = now + config.respawnPauseMs;
}

function randomEnemyVelocity() {
  const angle = (randomInt(4096) / 4096) * Math.PI * 2;
  const speed =
    config.qixSpeedMin +
    (randomInt(4096) / 4095) * (config.qixSpeedMax - config.qixSpeedMin);
  return { vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed };
}

function randomEmptySpawnPosition() {
  const emptyCells = [];

  for (let row = 1; row < ROWS - 1; row += 1) {
    for (let col = 1; col < COLS - 1; col += 1) {
      if (state.grid[row][col] === TILE_EMPTY) {
        emptyCells.push({ col, row });
      }
    }
  }

  if (emptyCells.length === 0) {
    return {
      x: canvas.width / 2,
      y: canvas.height / 2,
    };
  }

  const choice = emptyCells[randomInt(emptyCells.length)];
  return {
    x: choice.col * CELL + CELL / 2,
    y: choice.row * CELL + CELL / 2,
  };
}

function upperRightEnemySpawnPosition() {
  const col = COLS - 2;
  const row = 1;
  if (state.grid[row]?.[col] === TILE_EMPTY) {
    return {
      x: col * CELL + CELL / 2,
      y: row * CELL + CELL / 2,
    };
  }

  return randomEmptySpawnPosition();
}

function lowerLeftEnemySpawnPosition() {
  const col = 1;
  const row = ROWS - 2;
  if (state.grid[row]?.[col] === TILE_EMPTY) {
    return {
      x: col * CELL + CELL / 2,
      y: row * CELL + CELL / 2,
    };
  }

  return randomEmptySpawnPosition();
}

/** From this level, two QiX spinners spawn instead of one. */
const QIX_TWIN_LEVEL = 10;

function qixCountForCurrentLevel() {
  return state.level >= QIX_TWIN_LEVEL ? 2 : 1;
}

function enemySpawnPositionForIndex(index, total) {
  if (total <= 1) {
    return upperRightEnemySpawnPosition();
  }

  if (index === 0) {
    return upperRightEnemySpawnPosition();
  }

  return lowerLeftEnemySpawnPosition();
}

function createOneEnemyAt(spawn) {
  const velocity = randomEnemyVelocity();
  const armA =
    config.qixArmMin +
    (randomInt(4096) / 4095) * (config.qixArmMax - config.qixArmMin);
  const armB =
    config.qixArmMin +
    (randomInt(4096) / 4095) * (config.qixArmMax - config.qixArmMin);

  return {
    x: spawn.x,
    y: spawn.y,
    vx: velocity.vx,
    vy: velocity.vy,
    angle: (randomInt(4096) / 4096) * Math.PI * 2,
    spin:
      (randomInt(2) === 0 ? 1 : -1) * (1.8 + (randomInt(4096) / 4095) * 1.2),
    armA,
    armB,
    hue: randomInt(3600) / 10,
    history: [
      {
        x: spawn.x,
        y: spawn.y,
        angle: (randomInt(4096) / 4096) * Math.PI * 2,
      },
    ],
    residueClock: 0,
  };
}

function createEnemies() {
  const total = qixCountForCurrentLevel();
  state.enemies = [];
  for (let index = 0; index < total; index += 1) {
    const spawn = enemySpawnPositionForIndex(index, total);
    state.enemies.push(createOneEnemyAt(spawn));
  }
}

function createSparks() {
  state.sparks = [
    {
      col: 0,
      row: 0,
      dirCol: 1,
      dirRow: 0,
      progress: 0,
      turnBias: 1,
      effectKind: "",
      effectUntil: 0,
      history: [{ col: 0, row: 0 }],
    },
    {
      col: COLS - 1,
      row: 0,
      dirCol: -1,
      dirRow: 0,
      progress: 0,
      turnBias: -1,
      effectKind: "",
      effectUntil: 0,
      history: [{ col: COLS - 1, row: 0 }],
    },
  ];
}

function resetSparksToCorners() {
  state.sparks = [
    {
      col: 0,
      row: 0,
      dirCol: 1,
      dirRow: 0,
      progress: 0,
      turnBias: 1,
      effectKind: "",
      effectUntil: 0,
      history: [{ col: 0, row: 0 }],
    },
    {
      col: COLS - 1,
      row: 0,
      dirCol: -1,
      dirRow: 0,
      progress: 0,
      turnBias: -1,
      effectKind: "",
      effectUntil: 0,
      history: [{ col: COLS - 1, row: 0 }],
    },
  ];
}

function railNeighbors(col, row) {
  const candidates = [
    { col: col + 1, row },
    { col: col - 1, row },
    { col, row: row + 1 },
    { col, row: row - 1 },
  ];

  return candidates.filter((neighbor) =>
    isRailTile(neighbor.col, neighbor.row),
  );
}

function sparkNeighbors(col, row) {
  const candidates = [
    { col: col + 1, row },
    { col: col - 1, row },
    { col, row: row + 1 },
    { col, row: row - 1 },
  ];

  return candidates.filter((neighbor) =>
    isSparkTile(neighbor.col, neighbor.row),
  );
}

function rotateDirection(dirCol, dirRow, turnBias) {
  if (turnBias > 0) {
    return { col: -dirRow, row: dirCol };
  }
  return { col: dirRow, row: -dirCol };
}

function getSparkTarget() {
  const nearbyRail = [
    { col: state.player.col, row: state.player.row },
    { col: state.player.col + 1, row: state.player.row },
    { col: state.player.col - 1, row: state.player.row },
    { col: state.player.col, row: state.player.row + 1 },
    { col: state.player.col, row: state.player.row - 1 },
  ].filter((cell) => isSparkTile(cell.col, cell.row));

  if (nearbyRail.length > 0) {
    return nearbyRail;
  }

  if (state.player.trail.length > 0) {
    const trailHead = state.player.trail[0];
    const trailTargets = [
      { col: trailHead.col + 1, row: trailHead.row },
      { col: trailHead.col - 1, row: trailHead.row },
      { col: trailHead.col, row: trailHead.row + 1 },
      { col: trailHead.col, row: trailHead.row - 1 },
    ].filter((cell) => isSparkTile(cell.col, cell.row));

    if (trailTargets.length > 0) {
      return trailTargets;
    }
  }

  return state.sparks.map((spark) => ({ col: spark.col, row: spark.row }));
}

function buildRailDistanceMap(targets) {
  const distances = Array.from({ length: ROWS }, () =>
    Array(COLS).fill(Infinity),
  );
  const queue = [];
  let head = 0;

  for (const target of targets) {
    if (!isSparkTile(target.col, target.row)) {
      continue;
    }

    if (distances[target.row][target.col] !== Infinity) {
      continue;
    }

    distances[target.row][target.col] = 0;
    queue.push(target);
  }

  if (queue.length === 0) {
    return distances;
  }

  while (head < queue.length) {
    const current = queue[head];
    head += 1;
    const currentDistance = distances[current.row][current.col];

    for (const neighbor of sparkNeighbors(current.col, current.row)) {
      if (distances[neighbor.row][neighbor.col] !== Infinity) {
        continue;
      }

      distances[neighbor.row][neighbor.col] = currentDistance + 1;
      queue.push(neighbor);
    }
  }

  return distances;
}

function buildCornerRailReachable() {
  const reachable = Array.from({ length: ROWS }, () => Array(COLS).fill(false));
  const seeds = [
    { col: 0, row: 0 },
    { col: COLS - 1, row: 0 },
  ].filter((cell) => isRailTile(cell.col, cell.row));
  const queue = [...seeds];
  let head = 0;

  for (const seed of seeds) {
    reachable[seed.row][seed.col] = true;
  }

  while (head < queue.length) {
    const current = queue[head];
    head += 1;
    for (const neighbor of railNeighbors(current.col, current.row)) {
      if (reachable[neighbor.row][neighbor.col]) {
        continue;
      }
      reachable[neighbor.row][neighbor.col] = true;
      queue.push(neighbor);
    }
  }

  return reachable;
}

function chooseSparkStep(spark, distances) {
  const neighbors = sparkNeighbors(spark.col, spark.row);

  if (neighbors.length > 0) {
    const bestDistance = Math.min(
      ...neighbors.map((neighbor) => distances[neighbor.row][neighbor.col]),
    );
    if (bestDistance !== Infinity) {
      const bestNeighbors = neighbors.filter(
        (neighbor) => distances[neighbor.row][neighbor.col] === bestDistance,
      );
      const continuing = bestNeighbors.find(
        (neighbor) =>
          neighbor.col - spark.col === spark.dirCol &&
          neighbor.row - spark.row === spark.dirRow,
      );
      return continuing || bestNeighbors[0];
    }
  }

  const forward = {
    col: spark.col + spark.dirCol,
    row: spark.row + spark.dirRow,
  };
  const turnPrimary = rotateDirection(
    spark.dirCol,
    spark.dirRow,
    spark.turnBias,
  );
  const primary = {
    col: spark.col + turnPrimary.col,
    row: spark.row + turnPrimary.row,
  };
  const turnSecondary = rotateDirection(
    spark.dirCol,
    spark.dirRow,
    -spark.turnBias,
  );
  const secondary = {
    col: spark.col + turnSecondary.col,
    row: spark.row + turnSecondary.row,
  };
  const back = { col: spark.col - spark.dirCol, row: spark.row - spark.dirRow };
  const options = [forward, primary, secondary, back];

  for (const option of options) {
    if (isSparkTile(option.col, option.row)) {
      return option;
    }
  }

  const escape = neighbors
    .map((neighbor) => ({
      neighbor,
      degree: sparkNeighbors(neighbor.col, neighbor.row).length,
    }))
    .sort((a, b) => b.degree - a.degree)[0];

  return escape ? escape.neighbor : { col: spark.col, row: spark.row };
}

function calculateCapturedPercent() {
  let safeCount = 0;
  for (const row of state.grid) {
    for (const tile of row) {
      if (tile === TILE_SAFE) {
        safeCount += 1;
      }
    }
  }

  state.capturePercent = (safeCount / (COLS * ROWS)) * 100;
  recomputeScore();
}

function resetBurstThreshold() {
  state.nextBurstThreshold = Math.max(
    10,
    Math.ceil(state.capturePercent / 10) * 10,
  );
}

function startGame() {
  const now = performance.now();
  ensureAudio();
  startMusicLoop();
  createGrid();
  state.carryScore = 0;
  state.score = 0;
  state.elapsedSeconds = 0;
  state.level = 1;
  state.lives = config.lives;
  state.awaitingLevelAdvance = false;
  state.paused = false;
  state.explosions = [];
  state.pendingLoseLifeReason = null;
  state.crashEffectUntil = 0;
  state.hidePlayerDuringCrash = false;
  state.playerCrashParticles = [];
  state.musicDanger = 0;
  resetEnemyResidue();
  chooseNextRevealImage();
  resetPlayer();
  createEnemies();
  createSparks();
  resetPickupState(now);
  calculateCapturedPercent();
  resetBurstThreshold();
  beginSpawnPause(now);
  state.lastTime = now;
  state.running = true;
  boardWrapEl.classList.remove("level-reveal");
  startButton.hidden = false;
  hideOverlay();
  setDangerPresentation();
  cancelAnimationFrame(state.animationFrame);
  state.animationFrame = requestAnimationFrame(loop);
}

function forEachTrailTile(callback) {
  for (const point of state.player.trail) {
    callback(point.col, point.row);
  }
}

function clearTrail() {
  const sparksOnTrail = state.sparks.filter(
    (spark) => state.grid[spark.row]?.[spark.col] === TILE_TRAIL,
  );
  if (sparksOnTrail.length > 0) {
    resetSparksToCorners();
  }

  forEachTrailTile((col, row) => {
    if (state.grid[row]?.[col] === TILE_TRAIL) {
      state.grid[row][col] = TILE_EMPTY;
    }
  });

  state.player.trail = [];
  state.player.trailSet.clear();
  state.player.drawing = false;
}

function completePendingLoseLife() {
  const reason = state.pendingLoseLifeReason;
  state.pendingLoseLifeReason = null;
  state.crashEffectUntil = 0;
  state.hidePlayerDuringCrash = false;
  state.playerCrashParticles = [];
  state.screenShakeUntil = 0;
  state.screenShakeStrength = 0;
  state.speedEffectKind = "";
  state.speedEffectUntil = 0;
  state.musicDanger = 0;
  setDangerPresentation();

  clearTrail();
  state.explosions = [];
  resetEnemyResidue();
  resetPlayer();
  resetSparksToCorners();
  state.lives -= 1;
  setHud();

  if (state.lives <= 0) {
    state.awaitingLevelAdvance = false;
    state.running = false;
    state.paused = false;
    cancelAnimationFrame(state.animationFrame);
    startButton.hidden = false;
    showOverlay(`Game Over: ${reason}. Press Start`);
    state.spawnPauseUntil = 0;
    return;
  }

  beginSpawnPause();
}

function loseLife(reason) {
  if (shieldActive()) {
    state.screenShakeUntil = performance.now() + 180;
    state.screenShakeStrength = Math.max(state.screenShakeStrength, 5);
    playPickupSound(PICKUP_KIND_SHIELD);
    triggerUiBoom("boost");
    return;
  }

  if (state.pendingLoseLifeReason) {
    return;
  }

  state.pendingLoseLifeReason = reason;
  state.crashEffectUntil = performance.now() + CRASH_EFFECT_MS;
  state.hidePlayerDuringCrash = true;
  state.screenShakeUntil = performance.now() + 420;
  state.screenShakeStrength = 13;
  spawnPlayerCrashParticles(
    state.player.col * CELL + CELL / 2,
    state.player.row * CELL + CELL / 2,
  );
  playCrashSound();
  playPlayerExplosionSound();
  triggerUiBoom("death");
}

function insideBoard(col, row) {
  return col >= 0 && row >= 0 && col < COLS && row < ROWS;
}

function isRailTile(col, row) {
  if (!insideBoard(col, row) || state.grid[row][col] !== TILE_SAFE) {
    return false;
  }

  const neighbors = [
    { col: col + 1, row },
    { col: col - 1, row },
    { col, row: row + 1 },
    { col, row: row - 1 },
    { col: col + 1, row: row + 1 },
    { col: col + 1, row: row - 1 },
    { col: col - 1, row: row + 1 },
    { col: col - 1, row: row - 1 },
  ];

  return neighbors.some(
    (neighbor) =>
      !insideBoard(neighbor.col, neighbor.row) ||
      state.grid[neighbor.row][neighbor.col] !== TILE_SAFE,
  );
}

function isSparkTile(col, row) {
  if (!insideBoard(col, row)) {
    return false;
  }

  return state.grid[row][col] === TILE_TRAIL || isRailTile(col, row);
}

function relocatePlayerIfPaintedIn() {
  if (!isRailTile(state.player.col, state.player.row)) {
    resetPlayer();
    resetSparksToCorners();
    beginSpawnPause();
  }
}

function commitTrailToSafe() {
  forEachTrailTile((col, row) => {
    state.grid[row][col] = TILE_SAFE;
  });
  safeGridDirty = true;
}

function burstSpark(spark) {
  const centerX = spark.col * CELL + CELL / 2;
  const centerY = spark.row * CELL + CELL / 2;
  const fragmentSpeed = config.qixSpeedMax * 1.2;
  const fragments = [
    { dx: 1, dy: 0 },
    { dx: -1, dy: 0 },
    { dx: 0, dy: 1 },
    { dx: 0, dy: -1 },
  ];

  for (const fragment of fragments) {
    state.explosions.push({
      x: centerX,
      y: centerY,
      vx: fragment.dx * fragmentSpeed,
      vy: fragment.dy * fragmentSpeed,
      color: "#ff3b3b",
    });
  }
}

function captureArea() {
  const previousPercent = state.capturePercent;
  let capturedCells = 0;
  const reachable = Array.from({ length: ROWS }, () => Array(COLS).fill(false));
  const queue = [];
  let head = 0;

  for (const enemy of state.enemies) {
    const startCol = Math.max(
      0,
      Math.min(COLS - 1, Math.floor(enemy.x / CELL)),
    );
    const startRow = Math.max(
      0,
      Math.min(ROWS - 1, Math.floor(enemy.y / CELL)),
    );
    if (
      state.grid[startRow][startCol] === TILE_EMPTY &&
      !reachable[startRow][startCol]
    ) {
      reachable[startRow][startCol] = true;
      queue.push({ col: startCol, row: startRow });
    }
  }

  while (head < queue.length) {
    const current = queue[head];
    head += 1;
    const neighbors = [
      { col: current.col + 1, row: current.row },
      { col: current.col - 1, row: current.row },
      { col: current.col, row: current.row + 1 },
      { col: current.col, row: current.row - 1 },
    ];

    for (const next of neighbors) {
      if (!insideBoard(next.col, next.row)) {
        continue;
      }

      if (
        reachable[next.row][next.col] ||
        state.grid[next.row][next.col] !== TILE_EMPTY
      ) {
        continue;
      }

      reachable[next.row][next.col] = true;
      queue.push(next);
    }
  }

  const trappedEnemies = state.enemies.filter((enemy) => {
    const samples = [
      { x: enemy.x, y: enemy.y },
      ...qixSegments(enemy).flatMap((segment) => [
        { x: segment.ax, y: segment.ay },
        { x: segment.bx, y: segment.by },
      ]),
    ];

    return samples.every((sample) => {
      const sampleCol = Math.max(
        0,
        Math.min(COLS - 1, Math.floor(sample.x / CELL)),
      );
      const sampleRow = Math.max(
        0,
        Math.min(ROWS - 1, Math.floor(sample.y / CELL)),
      );
      return !reachable[sampleRow][sampleCol];
    });
  });

  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      if (state.grid[row][col] === TILE_EMPTY && !reachable[row][col]) {
        state.grid[row][col] = TILE_SAFE;
        capturedCells += 1;
      }
    }
  }
  if (capturedCells > 0) {
    safeGridDirty = true;
  }

  calculateCapturedPercent();
  if (trappedEnemies.length > 0) {
    const trappedSet = new Set(trappedEnemies);
    trappedEnemies.forEach(burstQix);
    state.enemies = state.enemies.map((enemy, index) =>
      trappedSet.has(enemy) ? createReplacementEnemy(enemy, index) : enemy,
    );
  }

  const cornerReachable = buildCornerRailReachable();
  const trappedSparks = state.sparks.filter(
    (spark) => !cornerReachable[spark.row]?.[spark.col],
  );
  if (trappedSparks.length > 0) {
    trappedSparks.forEach(burstSpark);
    resetSparksToCorners();
  }

  relocatePlayerIfPaintedIn();

  triggerBurstThresholds(previousPercent, state.capturePercent);
  if (capturedCells > 0) {
    playCaptureRiser(capturedCells);
    triggerUiBoom("capture");
  }
}

function finishTrail() {
  commitTrailToSafe();
  state.player.trail = [];
  state.player.trailSet.clear();
  state.player.drawing = false;
  captureArea();

  if (state.capturePercent >= getCaptureGoal()) {
    completeLevel();
  }
}

function completeLevel() {
  state.awaitingLevelAdvance = true;
  state.running = false;
  state.paused = false;
  cancelAnimationFrame(state.animationFrame);
  state.lives = Math.min(config.maxLives, state.lives + 1);
  setHud();
  startButton.hidden = true;
  playLevelFanfare();
  triggerUiBoom("clear");
  boardWrapEl.classList.add("level-reveal");
  resolvePuzzleLayout();
  showOverlay(
    `LEVEL ${String(state.level).padStart(2, "0")} DETONATED. PRESS SPACE`,
  );
  overlay.classList.add("level-clear");
  draw();
}

function startNextLevel() {
  const now = performance.now();
  state.carryScore += currentLevelScoreSlice();
  state.awaitingLevelAdvance = false;
  state.paused = false;
  state.level += 1;
  state.elapsedSeconds = 0;
  state.explosions = [];
  state.pendingLoseLifeReason = null;
  state.crashEffectUntil = 0;
  state.hidePlayerDuringCrash = false;
  state.playerCrashParticles = [];
  state.musicDanger = 0;
  resetEnemyResidue();
  chooseNextRevealImage();
  createGrid();
  resetPlayer();
  createEnemies();
  createSparks();
  resetPickupState(now);
  calculateCapturedPercent();
  resetBurstThreshold();
  beginSpawnPause(now);
  state.lastTime = now;
  boardWrapEl.classList.remove("level-reveal");
  hideOverlay();
  setDangerPresentation();
  state.running = true;
  cancelAnimationFrame(state.animationFrame);
  state.animationFrame = requestAnimationFrame(loop);
}

function createReplacementEnemy(enemy, spawnIndex = 0) {
  const speed = Math.hypot(enemy.vx, enemy.vy) || config.qixSpeedMin;
  const angle = (randomInt(4096) / 4096) * Math.PI * 2;
  const spawn = enemySpawnPositionForIndex(
    spawnIndex,
    qixCountForCurrentLevel(),
  );

  return {
    x: spawn.x,
    y: spawn.y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    angle: (randomInt(4096) / 4096) * Math.PI * 2,
    spin: enemy.spin,
    armA: enemy.armA,
    armB: enemy.armB,
    hue: (enemy.hue + 45 + randomInt(900) / 10) % 360,
    history: [
      { x: spawn.x, y: spawn.y, angle: (randomInt(4096) / 4096) * Math.PI * 2 },
    ],
    residueClock: 0,
  };
}

function burstQix(enemy) {
  const inheritedSpeed = Math.hypot(enemy.vx, enemy.vy) || config.qixSpeedMin;
  const fragmentSpeed = inheritedSpeed * 1.4;
  const fragments = [
    { dx: 1, dy: 0 },
    { dx: -1, dy: 0 },
    { dx: 0, dy: 1 },
    { dx: 0, dy: -1 },
  ];

  for (const fragment of fragments) {
    state.explosions.push({
      x: enemy.x,
      y: enemy.y,
      vx: fragment.dx * fragmentSpeed,
      vy: fragment.dy * fragmentSpeed,
      color: `hsl(${enemy.hue}, 100%, 62%)`,
    });
  }
}

function triggerBurstThresholds(previousPercent, currentPercent) {
  if (currentPercent < state.nextBurstThreshold) {
    return;
  }

  while (currentPercent >= state.nextBurstThreshold) {
    state.nextBurstThreshold += 10;
  }

  const oldEnemies = state.enemies;
  oldEnemies.forEach(burstQix);
  state.enemies = oldEnemies.map((enemy, index) =>
    createReplacementEnemy(enemy, index),
  );
}

function movePlayerStep() {
  const nextDir = getDirection();
  state.player.dir = nextDir;

  const nextCol = state.player.col + nextDir.x;
  const nextRow = state.player.row + nextDir.y;

  if (!insideBoard(nextCol, nextRow)) {
    return;
  }

  const nextTile = state.grid[nextRow][nextCol];
  const onSafe = state.grid[state.player.row][state.player.col] === TILE_SAFE;

  if (!state.player.drawing && onSafe && nextTile === TILE_EMPTY) {
    return;
  }

  if (!state.player.drawing && nextTile === TILE_SAFE) {
    if (!isRailTile(nextCol, nextRow)) {
      return;
    }
    state.player.col = nextCol;
    state.player.row = nextRow;
    return;
  }

  if (!state.player.drawing && nextTile === TILE_EMPTY) {
    state.player.drawing = true;
  }

  if (state.player.drawing) {
    if (
      nextTile === TILE_TRAIL ||
      state.player.trailSet.has(tileKey(nextCol, nextRow))
    ) {
      loseLife("you crossed your own trail");
      return;
    }

    state.player.col = nextCol;
    state.player.row = nextRow;

    if (nextTile === TILE_SAFE) {
      finishTrail();
      return;
    }

    state.grid[nextRow][nextCol] = TILE_TRAIL;
    state.player.trail.push({ col: nextCol, row: nextRow });
    state.player.trailSet.add(tileKey(nextCol, nextRow));
  }
}

function reflectEnemy(enemy, col, row, axis) {
  if (!insideBoard(col, row) || state.grid[row][col] !== TILE_EMPTY) {
    if (axis === "x") {
      enemy.vx *= -1;
    } else {
      enemy.vy *= -1;
    }
    return true;
  }
  return false;
}

function segmentDistanceSquared(px, py, ax, ay, bx, by) {
  const abx = bx - ax;
  const aby = by - ay;
  const apx = px - ax;
  const apy = py - ay;
  const abLenSq = abx * abx + aby * aby || 1;
  const t = Math.max(0, Math.min(1, (apx * abx + apy * aby) / abLenSq));
  const dx = ax + abx * t - px;
  const dy = ay + aby * t - py;
  return dx * dx + dy * dy;
}

function qixSegments(enemy) {
  const cosA = Math.cos(enemy.angle);
  const sinA = Math.sin(enemy.angle);
  const cosB = Math.cos(enemy.angle + Math.PI / 2);
  const sinB = Math.sin(enemy.angle + Math.PI / 2);

  return [
    {
      ax: enemy.x - cosA * enemy.armA,
      ay: enemy.y - sinA * enemy.armA,
      bx: enemy.x + cosA * enemy.armA,
      by: enemy.y + sinA * enemy.armA,
    },
    {
      ax: enemy.x - cosB * enemy.armB,
      ay: enemy.y - sinB * enemy.armB,
      bx: enemy.x + cosB * enemy.armB,
      by: enemy.y + sinB * enemy.armB,
    },
  ];
}

function qixHitsTrail(enemy) {
  const segments = qixSegments(enemy);
  const thresholdSq = CELL * 0.45 * (CELL * 0.45);

  for (const point of state.player.trail) {
    const px = point.col * CELL + CELL / 2;
    const py = point.row * CELL + CELL / 2;

    for (const segment of segments) {
      if (
        segmentDistanceSquared(
          px,
          py,
          segment.ax,
          segment.ay,
          segment.bx,
          segment.by,
        ) <= thresholdSq
      ) {
        return true;
      }
    }
  }

  return false;
}

function updateEnemies(deltaTime, now) {
  const percentBoost = 1 + state.capturePercent * 0.006;
  const levelBoost = 1 + (state.level - 1) * 0.08;
  const speedBoost =
    percentBoost *
    levelBoost *
    baseMoveScale() *
    enemyCheatSpeedMult();
  let maxDanger = 0;
  const playerX = state.player.col * CELL + CELL / 2;
  const playerY = state.player.row * CELL + CELL / 2;

  for (const enemy of state.enemies) {
    let nextX = enemy.x + enemy.vx * speedBoost * deltaTime;
    let nextY = enemy.y + enemy.vy * speedBoost * deltaTime;
    enemy.angle += enemy.spin * speedBoost * deltaTime;
    enemy.hue = (enemy.hue + 90 * deltaTime) % 360;
    enemy.residueClock = (enemy.residueClock || 0) + deltaTime;

    const colX = Math.floor(nextX / CELL);
    const rowX = Math.floor(enemy.y / CELL);
    const colY = Math.floor(enemy.x / CELL);
    const rowY = Math.floor(nextY / CELL);

    const hitX = reflectEnemy(enemy, colX, rowX, "x");
    const hitY = reflectEnemy(enemy, colY, rowY, "y");

    if (hitX) {
      nextX = enemy.x + enemy.vx * speedBoost * deltaTime;
    }
    if (hitY) {
      nextY = enemy.y + enemy.vy * speedBoost * deltaTime;
    }

    enemy.x = nextX;
    enemy.y = nextY;
    enemy.history ??= [];
    enemy.history.unshift({ x: enemy.x, y: enemy.y, angle: enemy.angle });
    if (enemy.history.length > 7) {
      enemy.history.length = 7;
    }
    while (enemy.residueClock >= config.residueDropSeconds) {
      enemy.residueClock -= config.residueDropSeconds;
      dropEnemyResidue(enemy, now);
    }

    const enemyCol = Math.max(
      0,
      Math.min(COLS - 1, Math.floor(enemy.x / CELL)),
    );
    const enemyRow = Math.max(
      0,
      Math.min(ROWS - 1, Math.floor(enemy.y / CELL)),
    );

    if (state.grid[enemyRow][enemyCol] === TILE_TRAIL || qixHitsTrail(enemy)) {
      loseLife("a QiX hit your trail");
      return 1;
    }
    const distanceToPlayer = Math.hypot(enemy.x - playerX, enemy.y - playerY);
    const enemyDanger = clamp((280 - distanceToPlayer) / 220, 0, 1);
    maxDanger = Math.max(
      maxDanger,
      state.player.drawing ? enemyDanger * 1.14 : enemyDanger,
    );

    if (
      state.player.drawing &&
      Math.abs(enemy.x - (state.player.col * CELL + CELL / 2)) < CELL * 0.7 &&
      Math.abs(enemy.y - (state.player.row * CELL + CELL / 2)) < CELL * 0.7
    ) {
      loseLife("a QiX caught you");
      return 1;
    }
  }

  if (state.player.drawing && enemyResidueAt(state.player.col, state.player.row, now)) {
    loseLife("a QiX acid trail got you");
    return 1;
  }
  if (residueHitsTrail(now)) {
    loseLife("a QiX acid trail burned your cut");
    return 1;
  }

  return maxDanger;
}

function updateSparks(deltaTime) {
  let maxDanger = 0;
  const targets = getSparkTarget();
  const distances = buildRailDistanceMap(targets);
  for (const spark of state.sparks) {
    const sparkEffectKind = currentSparkEffect(spark);
    spark.progress +=
      config.sparkSpeed *
      baseMoveScale() *
      effectSpeedMultiplier(sparkEffectKind) *
      enemyCheatSpeedMult() *
      deltaTime;

    while (spark.progress >= 1) {
      spark.progress -= 1;
      const next = chooseSparkStep(spark, distances);
      const nextDirCol = Math.sign(next.col - spark.col);
      const nextDirRow = Math.sign(next.row - spark.row);
      if (nextDirCol !== 0 || nextDirRow !== 0) {
        spark.dirCol = nextDirCol;
        spark.dirRow = nextDirRow;
      }
      spark.col = next.col;
      spark.row = next.row;
      spark.history ??= [];
      spark.history.unshift({ col: spark.col, row: spark.row });
      if (spark.history.length > 6) {
        spark.history.length = 6;
      }
    }

    const distance =
      Math.abs(spark.col - state.player.col) +
      Math.abs(spark.row - state.player.row);
    const sparkDanger = clamp((15 - distance) / 11, 0, 1);
    maxDanger = Math.max(maxDanger, sparkDanger);
    if (distance <= 0) {
      loseLife("a spark caught you");
      return 1;
    }
  }

  return maxDanger;
}

function updateExplosions(deltaTime) {
  const nextExplosions = [];
  const playerX = state.player.col * CELL + CELL / 2;
  const playerY = state.player.row * CELL + CELL / 2;
  const speedScale = 0.45 + state.settings.speed * 0.15;

  for (const fragment of state.explosions) {
    const nextFragment = {
      ...fragment,
      x: fragment.x + fragment.vx * speedScale * deltaTime,
      y: fragment.y + fragment.vy * speedScale * deltaTime,
    };

    const hitBoundary =
      nextFragment.x <= 4 ||
      nextFragment.x >= canvas.width - 4 ||
      nextFragment.y <= 4 ||
      nextFragment.y >= canvas.height - 4;

    if (
      Math.abs(nextFragment.x - playerX) < CELL * 0.55 &&
      Math.abs(nextFragment.y - playerY) < CELL * 0.55
    ) {
      loseLife("QiX fragments hit you");
      return;
    }

    if (!hitBoundary) {
      nextExplosions.push(nextFragment);
    }
  }

  state.explosions = nextExplosions;
}

function update(deltaTime, now) {
  state.elapsedSeconds += deltaTime;
  if (state.elapsedSeconds >= config.levelTimeLimit) {
    state.elapsedSeconds = config.levelTimeLimit;
    recomputeScore();
    loseLife("time ran out");
    return;
  }
  state.moveClock += deltaTime;
  const moveScale = currentMoveScale(now);
  const moveInterval = config.moveInterval / (moveScale * 1.1);

  while (state.moveClock >= moveInterval && state.running) {
    state.moveClock -= moveInterval;
    movePlayerStep();
  }

  let danger = 0;
  if (state.running) {
    danger = Math.max(danger, updateEnemies(deltaTime, now) || 0);
  }

  if (state.running) {
    danger = Math.max(danger, updateSparks(deltaTime) || 0);
  }

  updatePickups(now);
  updateEnemyResidue(now);
  updateExplosions(deltaTime);
  const musicResponse = danger > state.musicDanger ? 10.5 : 3.1;
  state.musicDanger +=
    (danger - state.musicDanger) * Math.min(1, deltaTime * musicResponse);
  if (state.pendingLoseLifeReason) {
    state.musicDanger = 1;
  }
  state.musicDanger = clamp(state.musicDanger, 0, 1);
  setDangerPresentation();
  recomputeScore();
}

function drawClaimTile(col, row, palette) {
  drawClaimTileOnContext(ctx, col, row, palette);
}

function drawClaimTileOnContext(targetCtx, col, row, palette) {
  const x = col * CELL;
  const y = row * CELL;
  const edge =
    palette === "green"
      ? "rgba(65, 255, 138, 0.45)"
      : "rgba(76, 181, 255, 0.45)";

  targetCtx.clearRect(x, y, CELL, CELL);
  targetCtx.strokeStyle = edge;
  targetCtx.lineWidth = 1;
  targetCtx.strokeRect(x + 0.5, y + 0.5, CELL - 1, CELL - 1);
  targetCtx.fillStyle =
    palette === "green"
      ? "rgba(255, 255, 255, 0.08)"
      : "rgba(255, 255, 255, 0.06)";
  targetCtx.fillRect(x + 2, y + 2, CELL - 4, CELL - 4);
}

function drawTrailTile(col, row) {
  const colors = [
    "#f03c3c",
    "#ff9d00",
    "#f0ea3f",
    "#68ff7d",
    "#3b74ff",
    "#b84dff",
  ];
  const x = col * CELL;
  const y = row * CELL;

  ctx.fillStyle = colors[(col + row) % colors.length];
  ctx.fillRect(x + 2, y + 1, CELL - 4, CELL - 2);
  ctx.fillStyle = "rgba(255,255,255,0.28)";
  ctx.fillRect(x + 3, y + 2, CELL - 6, 2);
}

function redrawSafeGridCache() {
  safeGridCtx.clearRect(0, 0, canvas.width, canvas.height);
  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      if (state.grid[row][col] === TILE_SAFE) {
        drawClaimTileOnContext(
          safeGridCtx,
          col,
          row,
          col < COLS * 0.32 ? "green" : "blue",
        );
      }
    }
  }
  safeGridDirty = false;
}

function drawGrid() {
  if (safeGridDirty) {
    redrawSafeGridCache();
  }
  ctx.drawImage(safeGridCanvas, 0, 0);
  forEachTrailTile((col, row) => {
    drawTrailTile(col, row);
  });
}

function drawArenaTrim() {
  const trim = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  trim.addColorStop(0, "#ff7fb6");
  trim.addColorStop(0.22, "#ffd65e");
  trim.addColorStop(0.5, "#7ef3c0");
  trim.addColorStop(0.78, "#74c0fc");
  trim.addColorStop(1, "#d98dff");
  ctx.shadowColor = "rgba(255, 198, 228, 0.55)";
  ctx.shadowBlur = 22;
  ctx.strokeStyle = trim;
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, canvas.width - 4, canvas.height - 4);
  ctx.shadowBlur = 0;
  ctx.strokeStyle = "rgba(255, 255, 255, 0.42)";
  ctx.lineWidth = 1.2;
  ctx.strokeRect(5, 5, canvas.width - 10, canvas.height - 10);
  ctx.shadowBlur = 0;
}

function drawPlayer() {
  if (state.hidePlayerDuringCrash) {
    return;
  }

  const x = state.player.col * CELL;
  const y = state.player.row * CELL;
  const cx = x + CELL / 2;
  const cy = y + CELL / 2;
  const scale = 1.8;
  const hue = (state.renderTime * 180) % 360;
  const pulse = 0.72 + (Math.sin(state.renderTime * 10) + 1) * 0.14;
  const glow = 0.45 + (Math.sin(state.renderTime * 14) + 1) * 0.18;
  const effectKind = currentSpeedEffect();
  const shielded = shieldActive();
  const effectGlow =
    shielded
      ? "rgba(112, 244, 255, 0.86)"
      : effectKind === PICKUP_KIND_BOMB
      ? "rgba(255, 100, 72, 0.75)"
      : effectKind === PICKUP_KIND_COOKIE
        ? "rgba(255, 214, 94, 0.8)"
        : `hsla(${(hue + 30) % 360}, 100%, 70%, ${glow})`;
  const ring = ctx.createLinearGradient(x, y, x + CELL, y + CELL);
  ring.addColorStop(0, `hsl(${hue}, 100%, 60%)`);
  ring.addColorStop(0.34, `hsl(${(hue + 90) % 360}, 100%, 60%)`);
  ring.addColorStop(0.67, `hsl(${(hue + 180) % 360}, 100%, 60%)`);
  ring.addColorStop(1, `hsl(${(hue + 270) % 360}, 100%, 60%)`);

  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(
    scale * (effectKind === PICKUP_KIND_COOKIE ? 1.08 : 1),
    scale * (effectKind === PICKUP_KIND_BOMB ? 0.94 : 1),
  );
  ctx.translate(-cx, -cy);
  ctx.shadowColor = effectGlow;
  ctx.shadowBlur = shielded ? 22 : effectKind ? 18 : 14;
  ctx.beginPath();
  ctx.arc(cx, cy, CELL * 0.63, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(0, 0, 0, ${pulse})`;
  ctx.fill();

  ctx.beginPath();
  ctx.arc(cx, cy, CELL * 0.56, 0, Math.PI * 2);
  ctx.fillStyle = state.player.drawing
    ? `rgba(255, 243, 106, ${0.9 + glow * 0.08})`
    : `rgba(255, 255, 255, ${0.86 + glow * 0.14})`;
  ctx.fill();

  ctx.strokeStyle = ring;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(cx, cy, CELL * 0.56, 0, Math.PI * 2);
  ctx.stroke();

  if (effectKind) {
    ctx.strokeStyle =
      effectKind === PICKUP_KIND_BOMB ? "#ff6b4f" : "rgba(255, 241, 140, 0.95)";
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(cx, cy, CELL * 0.82, 0, Math.PI * 2);
    ctx.stroke();
  }
  if (shielded) {
    ctx.strokeStyle = "rgba(170, 248, 255, 0.98)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, CELL * 0.96, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = "rgba(118, 230, 255, 0.68)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(cx, cy, CELL * 1.16, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.fillStyle = "#111111";
  ctx.beginPath();
  ctx.arc(cx - CELL * 0.18, cy - CELL * 0.14, 1.25, 0, Math.PI * 2);
  ctx.arc(cx + CELL * 0.18, cy - CELL * 0.14, 1.25, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = ring;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.arc(cx, cy + CELL * 0.04, CELL * 0.2, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.stroke();

  ctx.strokeStyle = "#111111";
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.arc(cx, cy + CELL * 0.04, CELL * 0.2, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.stroke();
  ctx.restore();
}

function drawPickups() {
  for (const pickup of state.pickups) {
    let cx = pickup.col * CELL + CELL / 2;
    let cy = pickup.row * CELL + CELL / 2;
    if (pickup.zone === "rail") {
      if (pickup.col === 0) {
        cx += 9;
      } else if (pickup.col === COLS - 1) {
        cx -= 9;
      }
      if (pickup.row === 0) {
        cy += 9;
      } else if (pickup.row === ROWS - 1) {
        cy -= 9;
      }
    }
    const pulse = 0.84 + Math.sin(state.renderTime * 7 + pickup.wobble * 10) * 0.16;

    ctx.save();
    ctx.translate(cx, cy);

    if (pickup.kind === PICKUP_KIND_BOMB) {
      ctx.shadowColor = "rgba(255, 102, 71, 0.9)";
      ctx.shadowBlur = 18;
      ctx.strokeStyle = "rgba(255, 176, 120, 0.9)";
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(0, 1, 9.6 * pulse, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = "#121212";
      ctx.beginPath();
      ctx.arc(0, 1, 8.4 * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.12)";
      ctx.beginPath();
      ctx.arc(-2.4, -1.4, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#f4d9aa";
      ctx.beginPath();
      ctx.moveTo(1, -5.2);
      ctx.quadraticCurveTo(3.6, -10.2, 7.2, -13.6);
      ctx.stroke();
      ctx.strokeStyle = "#ffb34a";
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(7.2, -13.6);
      ctx.lineTo(11.6, -17.8 + Math.sin(state.renderTime * 14 + pickup.wobble) * 2.1);
      ctx.stroke();
      ctx.fillStyle = "#fff3a2";
      ctx.beginPath();
      ctx.arc(12.2, -18.4, 2.6, 0, Math.PI * 2);
      ctx.fill();
    } else if (pickup.kind === PICKUP_KIND_HEART) {
      ctx.shadowColor = "rgba(255, 96, 148, 0.95)";
      ctx.shadowBlur = 24;
      ctx.fillStyle = "rgba(255, 210, 228, 0.9)";
      ctx.beginPath();
      ctx.arc(-5.6, -4.2, 6.6, 0, Math.PI * 2);
      ctx.arc(5.6, -4.2, 6.6, 0, Math.PI * 2);
      ctx.lineTo(0, 13.4);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#ff4f93";
      ctx.beginPath();
      ctx.arc(-5.1, -3.2, 5.6, 0, Math.PI * 2);
      ctx.arc(5.1, -3.2, 5.6, 0, Math.PI * 2);
      ctx.lineTo(0, 11.2);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "rgba(255, 241, 246, 0.95)";
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(-1.8, -6.8);
      ctx.quadraticCurveTo(1.2, -8.6, 3.6, -5.2);
      ctx.stroke();
    } else if (pickup.kind === PICKUP_KIND_SHIELD) {
      ctx.shadowColor = "rgba(92, 236, 255, 0.95)";
      ctx.shadowBlur = 24;
      ctx.strokeStyle = "rgba(190, 252, 255, 0.96)";
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(0, 0, 10.8 * pulse, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = "rgba(110, 225, 255, 0.88)";
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(0, -8.4);
      ctx.quadraticCurveTo(9.2, -7.2, 8.4, 1.2);
      ctx.quadraticCurveTo(7.2, 9.2, 0, 11.6);
      ctx.quadraticCurveTo(-7.2, 9.2, -8.4, 1.2);
      ctx.quadraticCurveTo(-9.2, -7.2, 0, -8.4);
      ctx.closePath();
      ctx.stroke();
      ctx.fillStyle = "rgba(82, 214, 255, 0.28)";
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.8)";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(0, -5.8);
      ctx.lineTo(0, 6.4);
      ctx.moveTo(-4.2, 0.4);
      ctx.lineTo(4.2, 0.4);
      ctx.stroke();
    } else {
      const isFieldCookie = pickup.zone === "field";
      const glowScale = isFieldCookie ? 1.18 : 1;
      ctx.shadowColor = isFieldCookie
        ? "rgba(255, 234, 120, 0.98)"
        : "rgba(255, 214, 94, 0.95)";
      ctx.shadowBlur = isFieldCookie ? 28 : 18;
      ctx.strokeStyle = isFieldCookie
        ? "rgba(255, 246, 188, 0.98)"
        : "rgba(255, 237, 150, 0.95)";
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(0, 0, 10.4 * pulse * glowScale, 0, Math.PI * 2);
      ctx.stroke();
      if (isFieldCookie) {
        ctx.strokeStyle = "rgba(255, 244, 170, 0.75)";
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.arc(0, 0, 14.4 * pulse, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.fillStyle = "#b9771b";
      ctx.beginPath();
      ctx.arc(0, -0.4, 7.8 * pulse * glowScale, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255, 226, 160, 0.95)";
      ctx.beginPath();
      ctx.arc(-1.6 * glowScale, -2.8 * glowScale, 2.1 * glowScale, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(159, 92, 36, 0.96)";
      ctx.beginPath();
      ctx.moveTo(-6.6 * glowScale, 4.2 * glowScale);
      ctx.lineTo(6.6 * glowScale, 4.2 * glowScale);
      ctx.lineTo(4.8 * glowScale, 9.2 * glowScale);
      ctx.lineTo(-4.8 * glowScale, 9.2 * glowScale);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#432209";
      for (const chip of [
        [-2.8, -1.9],
        [2.1, -2.1],
        [0.2, 1.2],
        [-2.0, 2.7],
        [2.7, 2.3],
      ]) {
        ctx.beginPath();
        ctx.arc(chip[0] * glowScale, chip[1] * glowScale, 1.5 * glowScale, 0, Math.PI * 2);
        ctx.fill();
      }
      if (isFieldCookie) {
        ctx.strokeStyle = "rgba(255, 247, 196, 0.82)";
        ctx.lineWidth = 1.2;
        for (let ray = 0; ray < 4; ray += 1) {
          const angle = pickup.wobble * Math.PI * 2 + state.renderTime * 0.9 + ray * (Math.PI / 2);
          ctx.beginPath();
          ctx.moveTo(
            Math.cos(angle) * 12,
            Math.sin(angle) * 12,
          );
          ctx.lineTo(
            Math.cos(angle) * 17,
            Math.sin(angle) * 17,
          );
          ctx.stroke();
        }
      }
    }

    ctx.restore();
  }
}

function drawSpawnCue() {
  const remaining = state.spawnPauseUntil - performance.now();
  if (remaining <= 0) {
    return;
  }

  const centerX = state.player.col * CELL + CELL / 2;
  const centerY = state.player.row * CELL + CELL / 2;
  const phase = remaining / config.respawnPauseMs;
  const flash = 0.55 + (Math.sin(state.renderTime * 16) + 1) * 0.2;
  const radius = CELL * (1.25 + (1 - phase) * 0.9);

  ctx.save();
  ctx.strokeStyle = `rgba(255, 255, 255, ${flash})`;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = `rgba(255, 236, 92, ${flash * 0.95})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(centerX - radius - 8, centerY);
  ctx.lineTo(centerX + radius + 8, centerY);
  ctx.moveTo(centerX, centerY - radius - 8);
  ctx.lineTo(centerX, centerY + radius + 8);
  ctx.stroke();

  ctx.fillStyle = `rgba(255, 255, 255, ${0.7 + flash * 0.2})`;
  ctx.font = 'bold 18px "Courier New", monospace';
  ctx.textAlign = "center";
  ctx.fillText("READY", centerX, centerY - radius - 14);
  ctx.restore();
}

function drawEnemies() {
  for (const enemy of state.enemies) {
    const history = enemy.history?.length
      ? enemy.history
      : [{ x: enemy.x, y: enemy.y, angle: enemy.angle }];

    for (let i = history.length - 1; i >= 0; i -= 1) {
      const ghost = history[i];
      const ghostEnemy = {
        ...enemy,
        x: ghost.x,
        y: ghost.y,
        angle: ghost.angle,
      };
      const segments = qixSegments(ghostEnemy);
      const alpha = 0.18 + ((history.length - i) / history.length) * 0.72;
      const colors = [
        `hsla(${enemy.hue}, 100%, 62%, ${alpha})`,
        `hsla(${(enemy.hue + 120) % 360}, 100%, 62%, ${alpha})`,
      ];

      segments.forEach((segment, index) => {
        ctx.strokeStyle = colors[index];
        ctx.lineWidth = i === 0 ? 3 : 2;
        ctx.beginPath();
        ctx.moveTo(segment.ax, segment.ay);
        ctx.lineTo(segment.bx, segment.by);
        ctx.stroke();
      });
    }

    const bloom = ctx.createRadialGradient(enemy.x, enemy.y, 0, enemy.x, enemy.y, 22);
    bloom.addColorStop(0, `hsla(${enemy.hue}, 100%, 60%, 0.24)`);
    bloom.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = bloom;
    ctx.beginPath();
    ctx.arc(enemy.x, enemy.y, 22, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(enemy.x - 2, enemy.y - 2, 4, 4);
  }
}

function drawEnemyResidue(now = performance.now()) {
  for (const residue of state.enemyResidue.values()) {
    if (residue.expiresAt <= now) {
      continue;
    }
    const remaining = (residue.expiresAt - now) / config.residueLifetimeMs;
    const alpha = residue.intensity * clamp(remaining, 0, 1);
    const x = residue.col * CELL + CELL / 2;
    const y = residue.row * CELL + CELL / 2;
    const glowRadius = 6 + residue.intensity * 4;
    const fill = ctx.createRadialGradient(x, y, 0, x, y, glowRadius);
    fill.addColorStop(
      0,
      `hsla(${(residue.hue + 80) % 360}, 100%, 62%, ${alpha * 0.55})`,
    );
    fill.addColorStop(
      0.52,
      `hsla(${(residue.hue + 32) % 360}, 100%, 50%, ${alpha * 0.38})`,
    );
    fill.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = fill;
    ctx.fillRect(x - glowRadius, y - glowRadius, glowRadius * 2, glowRadius * 2);

    ctx.strokeStyle = `hsla(${(residue.hue + 92) % 360}, 100%, 70%, ${alpha * 0.7})`;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(x - 3.6, y);
    ctx.lineTo(x + 3.6, y);
    ctx.moveTo(x, y - 3.6);
    ctx.lineTo(x, y + 3.6);
    ctx.stroke();
  }
}

function drawSparks() {
  for (const spark of state.sparks) {
    const x = spark.col * CELL;
    const y = spark.row * CELL;
    const cx = x + CELL / 2;
    const cy = y + CELL / 2;
    const scale = 1.5;
    const phase = state.renderTime * 14 + spark.row * 0.4 + spark.col * 0.25;
    const legSwing = Math.sin(phase) * 1.5;
    const bodyLift = Math.cos(phase * 1.2) * 0.45;
    const bodyX = cx;
    const bodyY = cy + bodyLift;
    const sparkEffectKind = currentSparkEffect(spark);
    const menace = clamp((18 - (Math.abs(spark.col - state.player.col) + Math.abs(spark.row - state.player.row))) / 12, 0, 1);
    const glowColor =
      sparkEffectKind === PICKUP_KIND_BOMB
        ? "rgba(255, 110, 72, 0.72)"
        : sparkEffectKind === PICKUP_KIND_COOKIE
          ? "rgba(255, 220, 112, 0.82)"
          : "rgba(255, 112, 84, 0.45)";

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(scale + menace * 0.22, scale + menace * 0.22);
    ctx.translate(-cx, -cy);
    ctx.lineCap = "round";
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = sparkEffectKind ? 14 : 9 + menace * 5;

    const history = spark.history?.length ? spark.history : [{ col: spark.col, row: spark.row }];
    for (let i = 0; i < history.length - 1; i += 1) {
      const current = history[i];
      const next = history[i + 1];
      const alpha = 0.18 + ((history.length - i) / history.length) * (0.28 + menace * 0.3);
      ctx.strokeStyle = `rgba(255, 184, 132, ${alpha})`;
      ctx.lineWidth = 1.1 + menace * 0.4;
      ctx.beginPath();
      ctx.moveTo(current.col * CELL + CELL / 2, current.row * CELL + CELL / 2);
      ctx.lineTo(next.col * CELL + CELL / 2, next.row * CELL + CELL / 2);
      ctx.stroke();
    }

    ctx.strokeStyle = "#ffd9b8";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(bodyX - 2, bodyY - 1);
    ctx.lineTo(bodyX - 6, bodyY - 5 - legSwing);
    ctx.moveTo(bodyX - 2, bodyY + 1);
    ctx.lineTo(bodyX - 7, bodyY - 1);
    ctx.moveTo(bodyX - 2, bodyY + 2.5);
    ctx.lineTo(bodyX - 6, bodyY + 4 + legSwing);
    ctx.moveTo(bodyX - 1, bodyY + 3.5);
    ctx.lineTo(bodyX - 4.5, bodyY + 7);

    ctx.moveTo(bodyX + 2, bodyY - 1);
    ctx.lineTo(bodyX + 6, bodyY - 5 + legSwing);
    ctx.moveTo(bodyX + 2, bodyY + 1);
    ctx.lineTo(bodyX + 7, bodyY - 1);
    ctx.moveTo(bodyX + 2, bodyY + 2.5);
    ctx.lineTo(bodyX + 6, bodyY + 4 - legSwing);
    ctx.moveTo(bodyX + 1, bodyY + 3.5);
    ctx.lineTo(bodyX + 4.5, bodyY + 7);
    ctx.stroke();

    ctx.fillStyle =
      sparkEffectKind === PICKUP_KIND_COOKIE ? "#7f4808" : "#2b0e0a";
    ctx.beginPath();
    ctx.ellipse(bodyX, bodyY + 1.2, 4.4, 4.8, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle =
      sparkEffectKind === PICKUP_KIND_BOMB ? "#ff5844" : "#b31f1f";
    ctx.beginPath();
    ctx.ellipse(bodyX, bodyY - 2.1, 3.2, 2.8, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#fff3b0";
    ctx.beginPath();
    ctx.arc(bodyX - 1.1, bodyY - 2.3, 0.95, 0, Math.PI * 2);
    ctx.arc(bodyX + 1.1, bodyY - 2.3, 0.95, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(bodyX - 0.8, bodyY - 0.4, 1.6, 1.6);

    ctx.strokeStyle = `rgba(255, 232, 180, ${0.55 + menace * 0.35})`;
    ctx.lineWidth = 1;
    for (let ray = 0; ray < 3; ray += 1) {
      const angle = phase + ray * 2.094;
      ctx.beginPath();
      ctx.moveTo(bodyX, bodyY);
      ctx.lineTo(
        bodyX + Math.cos(angle) * (4.5 + menace * 2.5),
        bodyY + Math.sin(angle) * (4.5 + menace * 2.5),
      );
      ctx.stroke();
    }
    ctx.restore();
  }
}

function drawExplosions() {
  for (const fragment of state.explosions) {
    ctx.strokeStyle = fragment.color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(fragment.x - 5, fragment.y);
    ctx.lineTo(fragment.x + 5, fragment.y);
    ctx.moveTo(fragment.x, fragment.y - 5);
    ctx.lineTo(fragment.x, fragment.y + 5);
    ctx.stroke();
  }
}

function drawDangerVeil() {
  const danger = clamp(state.musicDanger, 0, 1);
  const effectKind = currentSpeedEffect();
  const overlayStrength =
    danger * 0.34 + (effectKind === PICKUP_KIND_BOMB ? 0.12 : 0);
  if (overlayStrength <= 0.01) {
    return;
  }

  const veil = ctx.createRadialGradient(
    canvas.width / 2,
    canvas.height / 2,
    canvas.width * 0.1,
    canvas.width / 2,
    canvas.height / 2,
    canvas.width * 0.62,
  );
  veil.addColorStop(0, `rgba(255, 70, 70, ${overlayStrength * 0.08})`);
  veil.addColorStop(0.65, `rgba(255, 20, 20, ${overlayStrength * 0.18})`);
  veil.addColorStop(1, `rgba(0, 0, 0, ${overlayStrength * 0.5})`);
  ctx.fillStyle = veil;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function drawCrashOverlay(now = performance.now()) {
  if (!state.pendingLoseLifeReason || now >= state.crashEffectUntil) {
    return;
  }

  const progress = 1 - (state.crashEffectUntil - now) / CRASH_EFFECT_MS;
  const flash = Math.max(0, 1 - progress * 1.2);
  ctx.fillStyle = `rgba(255, 245, 245, ${flash * 0.18})`;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = `rgba(255, 48, 48, ${(0.28 + Math.sin(progress * 30) * 0.12) * (1 - progress * 0.5)})`;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (state.awaitingLevelAdvance) {
    return;
  }

  ctx.save();
  const now = performance.now();
  const shakeRemaining = state.screenShakeUntil - now;
  if (shakeRemaining > 0 && state.screenShakeStrength > 0) {
    const strength = state.screenShakeStrength * (shakeRemaining / 420);
    const jitterX = (randomInt(2048) / 1024 - 1) * strength;
    const jitterY = (randomInt(2048) / 1024 - 1) * strength;
    ctx.translate(jitterX, jitterY);
  }

  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  drawGrid();
  drawEnemyResidue();
  drawDangerVeil();
  drawArenaTrim();
  drawPickups();
  drawEnemies();
  drawSparks();
  drawExplosions();
  drawPlayerCrashParticles();
  drawPlayer();
  drawSpawnCue();
  drawCrashOverlay(now);
  ctx.restore();
}

function loop(timestamp) {
  const deltaTime = Math.min((timestamp - state.lastTime) / 1000, 0.03);
  state.lastTime = timestamp;
  state.renderTime = timestamp / 1000;

  if (
    state.pendingLoseLifeReason &&
    timestamp >= state.crashEffectUntil
  ) {
    completePendingLoseLife();
  }

  if (
    state.pendingLoseLifeReason &&
    timestamp < state.crashEffectUntil
  ) {
    updatePlayerCrashParticles(deltaTime);
  } else if (state.paused) {
    state.moveClock = 0;
  } else if (state.running && timestamp < state.spawnPauseUntil) {
    state.moveClock = 0;
  } else if (state.running) {
    update(deltaTime, timestamp);
  }

  draw();

  if (state.running || state.paused) {
    state.animationFrame = requestAnimationFrame(loop);
  }
}

function togglePause() {
  if (state.awaitingLevelAdvance || state.pendingLoseLifeReason) {
    return;
  }
  if (!state.running && !state.paused) {
    return;
  }

  state.paused = !state.paused;
  state.running = !state.paused;

  if (state.paused) {
    startButton.hidden = true;
    showOverlay("Paused. Press P");
    overlay.classList.remove("level-clear");
    return;
  }

  state.lastTime = performance.now();
  hideOverlay();
}

function handleMovementKey(event, isPressed) {
  const key = event.key.toLowerCase();
  if (!(key in state.keys)) {
    return;
  }

  state.keys[key] = isPressed;
  event.preventDefault();
}

window.addEventListener("keydown", (event) => {
  if (event.key.toLowerCase() === "p") {
    togglePause();
    event.preventDefault();
    return;
  }

  if (event.code === "Space") {
    if (state.awaitingLevelAdvance) {
      ensureAudio();
      startNextLevel();
      event.preventDefault();
      return;
    }

    const currentTile = state.grid[state.player.row]?.[state.player.col];
    if (currentTile === TILE_SAFE && !state.player.drawing) {
      const dir = getDirection();
      const nextCol = state.player.col + dir.x;
      const nextRow = state.player.row + dir.y;

      if (
        insideBoard(nextCol, nextRow) &&
        state.grid[nextRow][nextCol] === TILE_EMPTY
      ) {
        state.player.drawing = true;
      }
    }
    event.preventDefault();
    return;
  }

  handleMovementKey(event, true);
});

window.addEventListener("keyup", (event) => {
  handleMovementKey(event, false);
});

startButton.addEventListener("click", startGame);
speedSettingEl.addEventListener("input", () => {
  state.settings.speed = Number(speedSettingEl.value);
  persistSettings();
  setHud();
});
magicSettingEl?.addEventListener("click", () => {
  state.settings.magic =
    state.settings.magic === "more" ? "normal" : "more";
  magicSettingEl.textContent =
    state.settings.magic === "more" ? "More Magic" : "Magic";
  persistSettings();
});
typeSettingEl.addEventListener("change", () => {
  state.settings.type = typeSettingEl.value;
  persistSettings();
  chooseNextRevealImage();
  draw();
});
cheatSettingEl.addEventListener("change", () => {
  state.settings.cheat = cheatSettingEl.checked;
  persistSettings();
});
musicSettingEl?.addEventListener("change", () => {
  state.settings.music = musicSettingEl.checked;
  persistSettings();
  if (!state.settings.music) {
    stopMusicLoop();
  } else {
    ensureAudio();
    startMusicLoop();
  }
});
volumeSettingEl?.addEventListener("input", () => {
  state.settings.volume = clamp(Number(volumeSettingEl.value) / 100, 0, 1);
  persistSettings();
  applyVolumeSetting();
});
startButton.hidden = false;

createGrid();

(async function initAfterImagePools() {
  loadSettings();
  await loadBackgroundImagePools();
  chooseNextRevealImage();
  resetPlayer();
  resetPickupState();
  calculateCapturedPercent();
  speedSettingEl.value = String(state.settings.speed);
  if (magicSettingEl) {
    magicSettingEl.textContent =
      state.settings.magic === "more" ? "More Magic" : "Magic";
  }
  typeSettingEl.value = state.settings.type;
  cheatSettingEl.checked = state.settings.cheat;
  if (musicSettingEl) {
    musicSettingEl.checked = state.settings.music;
  }
  if (volumeSettingEl) {
    volumeSettingEl.value = String(Math.round(state.settings.volume * 100));
  }
  applyVolumeSetting();
  setDangerPresentation();
  draw();
  showOverlay("Press Start");
  fetchHighScore();
})();
