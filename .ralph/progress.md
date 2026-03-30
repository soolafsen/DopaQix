# Progress Log
Started: Wed Mar 25 20:08:01 WEST 2026

## Codebase Patterns
- (add reusable patterns here)

## 2026-03-29
- Story set: `prd-dopaqix-native.json` US-001..US-003
- Work: replaced the shipping path with a Godot 4 native build, implemented a playable QiX-style loop with capture, sparks, enemies, pickups, particles, procedural audio, and Windows export packaging
- Checks: `godot --headless --path . --quit-after 1`; `powershell -ExecutionPolicy Bypass -File .\scripts\export-windows.ps1`
- Outcome: `dist/DopaQiXNative.exe` and `dist/DopaQiXNative-win64.zip` export successfully from this repo

---

## [2026-03-30 16:24:26 +02:00] - US-001: Restore claimed-area grayscale reveal during play
Run: 20260330-162237-32228 (iteration 1)
No-commit: true
Verification:
- `godot --headless --path . --quit-after 1` -> PASS
Files changed:
- `scripts/game.gd`
Outcome:
- Restored live claimed-area reveal by sampling the selected grayscale board image per captured safe cell and layering grain/claim trim on top during active play.
Notes:
- Keep the grayscale sampling scoped to `TILE_SAFE` draw calls so empty field cells and active trail tiles stay unrevealed.
---

## [2026-03-30 16:29:17 +02:00] - US-002: Fix level-clear reveal and advance gating
Run: 20260330-162534-34496 (iteration 1)
No-commit: true
Verification:
- `godot --headless --path . --script ".ralph/.tmp/verify-US-002.gd"` -> PASS
- `godot --headless --path . --quit-after 1` -> PASS
Files changed:
- `scripts/game.gd`
Outcome:
- Locked `level_clear` into a stable paused reveal state, cleared lingering gameplay effects on board completion, and advanced only on Space or left click to match `origin/main`.
Notes:
- Keep `level_clear` input explicit instead of reusing broad `accept` bindings so Enter and other aliases do not skip the reveal.
---

## [2026-03-30 16:33:46 +02:00] - US-003: Restore rail-only player movement rules
Run: 20260330-163033-9508 (iteration 1)
No-commit: true
Verification:
- `godot --headless --path . --script .ralph/.tmp/verify-US-003.gd` -> PASS
- `godot --headless --path . --quit-after 1` -> PASS
Files changed:
- `scripts/game.gd`
- `.ralph/.tmp/verify-US-003.gd`
Outcome:
- Restored rail-only non-drawing movement by allowing travel only onto rail-safe tiles and allowing cuts to start only when stepping from a rail tile into adjacent empty field space.
Notes:
- Treat captured safe interiors as non-rail by checking the 8-neighbor ring around each `TILE_SAFE` cell; that preserves perimeter and captured-boundary travel without reopening free movement across filled safe regions.
---
## [2026-03-30 16:45:00 +02:00] - US-004: Restore spark rail and trail routing parity
Run: 20260330-163033-9508 (iteration 2)
No-commit: true
Verification:
- godot --headless --path . --script '.ralph/.tmp/verify-us004.gd' -> PASS
- godot --headless --path . --quit-after 1 -> PASS
Files changed:
- scripts/game.gd
- .ralph/.tmp/verify-us004.gd
Outcome:
- Restored spark routing to rail-or-trail tiles only, matched target selection to reachable rail-side or trail-side spark paths, and reset sparks when trail clearing or capture would leave them stranded off-network.
Notes:
- Spark parity depends on using rail topology rather than generic safe-cell flood fill; cleared trails and captured interiors both need explicit spark recovery to avoid invalid empty or interior-safe positions.
---
## [2026-03-30 16:42:00 +02:00] - US-005: Restore QiX field behavior and trail interaction parity
Run: 20260330-163033-9508 (iteration 3)
No-commit: true
Verification:
- godot --headless --path . --script .ralph/.tmp/verify-US-005.gd -> PASS
- godot --headless --path . --quit-after 1 -> PASS
Files changed:
- scripts/game.gd
Outcome:
- Restored QiX parity for field-only spawning and replacement, direct trail-cell and residue lethality, and barrier bounce behavior so QiX stay in empty space and punish active cuts like origin/main.
Notes:
- QiX capture parity needed both post-capture replacement into empty cells and direct center-cell trail checks; segment-only trail detection was not enough.
---
## [2026-03-30 16:54:00 +02:00] - US-006: Upgrade enemy motion readability with history and residue
Run: 20260330-164242-11000 (iteration 1)
No-commit: true
Verification:
- godot --headless --path . --script .ralph/.tmp/verify-US-006.gd -> PASS
- godot --headless --path . --quit-after 1 -> PASS
Files changed:
- scripts/game.gd
- .ralph/.tmp/verify-US-006.gd
Outcome:
- Tightened QiX history to a readable meteor-tail length, intensified and refreshed residue per cell, and added clearer layered recent-path rendering for both QiX and sparks without changing HUD or menu layout.
Notes:
- For readable motion, fewer history samples with stronger segment layering worked better than the previous long haze trail; residue cells also need dedupe-plus-refresh to avoid noisy duplicate buildup.
---
