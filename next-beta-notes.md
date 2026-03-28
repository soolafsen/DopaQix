# Next Beta Notes

Current ship artifact:
- `CodexQiX-beta-static-v12.zip`

Current static handoff:
- root `index.html`, `script.js`, `styles.css`
- mirrored copies in `ship/`

What this beta added or improved:
- stronger death feedback: louder hit/explosion audio, harder flashes, shake, and cabinet pulses
- stronger clear payoff: brighter clear blast, fuller fanfare, cleaner reveal presentation
- danger-reactive music with faster response when enemies get close
- cheat mode, music toggle, volume, speed slider
- shift now actually speeds up active cuts
- rail bombs that slow movement
- cookies that boost movement
- sparks can also pick up bombs and cookies
- larger, more readable bombs and cookies
- field cookies that bait path choices inside the arena
- deadly QiX acid residue in the open field
- more aggressive sparks with hotter visuals and short motion trails
- reveal image fixes for `file://` shipping
- static zip-ready delivery with no extra install step
- several performance cuts:
  - safe-territory canvas cache
  - queue-head BFS instead of repeated `shift()`
  - capped enemy residue system instead of heavy free particles

Good candidate next-pass ideas:
- add track hearts for extra lives
- consider even bolder reward text/callouts on big captures
- tune field-cookie density and visibility based on tester feedback
- tune acid residue lifetime/density if it feels unfair
- look for more update-loop cost to trim before adding new FX-heavy systems

Notes:
- if shipping a new beta zip, mirror root files into `ship/` first, then package from `ship/`
- keep the game double-clickable from `ship/index.html`
