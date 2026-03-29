# TODO

## Current State

- Repo now ships a native Godot 4 build instead of the old browser build.
- Branch in use: `codex/DopaQiXnative`
- Windows package is tracked at `dist/DopaQiXNative-win64.zip`
- Front page README links directly to the zip download.

## What Is Done

- Godot project root is in place: `project.godot`, `main.tscn`, `scripts/`
- Core loop exists:
  - rail movement
  - trail cutting
  - territory capture
  - QiX enemy movement
  - sparks on the rail
  - pickups and debuffs
  - score, lives, level progression
- Procedural audio and SFX are working.
- Windows export script works:
  - `powershell -ExecutionPolicy Bypass -File .\scripts\export-windows.ps1`
- Visible pause button exists.
- Pause flow now has:
  - `Pause`
  - `Resume`
  - `Exit Game`

## What Is Not Good Enough

- The title or attract screen is still visually weak.
- The current presentation still reads too much like a debug dashboard and not enough like a candy-store arcade invitation.
- The user specifically called the visuals a mess and said it should feel:
  - glitzy
  - shiny
  - colorful
  - inviting
  - like stepping into a candy store
- The latest visual pass improved structure a bit, but it is not yet good enough.

## Highest-Priority Next Session

1. Redesign the attract screen first.
2. Do not spend time on back-end or packaging unless the visual pass breaks something.
3. Target:
   - one strong title composition
   - one strong start CTA
   - less HUD noise before play starts
   - more candy color, gloss, sparkle, and "play me now" energy

## Practical Direction

- Keep the game board preview, but stop letting text fight the board.
- Reduce dashboard feel on the title screen.
- Prefer:
  - marquee energy
  - candy-shop palette
  - glows
  - glossy panels
  - stronger hierarchy
  - fewer simultaneous text blocks
- The first screen should sell the fantasy before it explains controls.

## Likely Files To Touch

- `scripts/game.gd`
  - `_draw_backdrop()`
  - `_draw_board()`
  - `_draw_hud()`
  - `_draw_overlay()`
  - helper draw functions near the bottom
- Possibly `README.md` only if the player-facing messaging changes

## Verification

Run after visual edits:

```powershell
godot --headless --path . --quit-after 1
powershell -ExecutionPolicy Bypass -File .\scripts\export-windows.ps1
```

## Notes

- Old browser leftovers have been removed from the tracked branch.
- `backgrounds/` is still used by the Godot build and should stay.
- There is a local ignored `_vendor` warning during export on this machine; it is not branch content.
