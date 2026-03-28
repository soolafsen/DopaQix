---
name: CodexQiX 2026
overview: Build a modern QiX-inspired arcade game for the web with maximum audiovisual payoff, strong arcade readability, and enough systemic depth to feel worth shipping in 2026.
isProject: true
---

# CodexQiX Plan

## Product Direction

Build a loud, high-clarity, high-replay QiX-inspired arcade game that feels like classic `QIX` plus the spectacle of `Volfied`, the shareware excess of `AirXonix`, and the audiovisual sugar rush of `DX-Ball 2`.

This should not be a museum remake.

It should feel contemporary, juicy, immediate, and proudly arcade-first:

- fast starts
- huge capture payoffs
- aggressive visual feedback
- thick, rhythmic sound design
- strong score-chasing and "one more run" energy

## Creative Thesis

The fantasy is simple:

You carve glowing territory out of chaos while an abstract predator tries to cut you off.

Every successful claim should feel like detonating a firework inside a synth cabinet.

The player should feel:

- tension while drawing
- relief when the claim seals
- greed to push one more risky cut
- delight when the whole board erupts with sound, particles, and score

## Pillars

### 1. Maximum Dopamine

Everything important must over-deliver on feedback:

- trail ignition
- near-miss audio
- claim closure shockwave
- chain bonus fanfare
- enemy trap burst
- level-clear climax

If a major action does not sound and look expensive, it is undercooked.

### 2. Readability Under Pressure

The screen can be flashy, but the player must always read:

- safe territory
- live trail
- enemy danger zones
- current goal
- current score multiplier

Effects exist to amplify state, not hide it.

### 3. Arcade Purity First

The core loop must already work without unlocks, meta progression, or narrative.

If the first endless arcade run is not compelling, the rest is garnish.

### 4. Modern, Not Ironic

Avoid fake retro minimalism and avoid random novelty assets as the identity.

The game should look intentional, polished, and authored. Think glossy neon, chrome, reactive backdrops, bold typography, and a soundtrack that actually drives the play rhythm.

## Reference Board

These references are useful for feel, structure, and presentation:

- [QIX (1981) overview](https://en.wikipedia.org/wiki/Qix)
  - Keep: the pure area-claim loop, Sparks on rails, fast/slow risk logic, abstract enemy threat.
- [QIX arcade screenshot](https://www.mobygames.com/game/3476/qix/screenshots/arcade/659190/)
  - Keep: stark board readability and the beauty of the abstract enemy.
- [Super Qix overview](https://qix.wiki.gg/wiki/Super_Qix)
  - Keep: threshold-driven progression and reveal-style stage payoff.
- [Super Qix screenshot](https://www.mobygames.com/game/155789/super-qix/screenshots/arcade/1037094/)
  - Keep: stage completion as a visual event, not just a percentage check.
- [Volfied overview](https://en.wikipedia.org/wiki/Volfied)
  - Keep: sci-fi framing, enemy variety, more theatrical stage identity.
- [Volfied screenshot](https://www.mobygames.com/game/432/volfied/screenshots/amiga/210126/)
  - Keep: stronger theming and a less sterile presentation.
- [AirXonix overview](https://www.mobygames.com/game/16455/airxonix/)
  - Keep: shareware-era spectacle, heavy FX, power-up energy, loud presentation.
- [AirXonix page on MegaGames](https://megagames.com/games/airxonix)
  - Use as mood reference for the over-the-top 2000s arcade vibe.
- [QIX++ overview](https://en.wikipedia.org/wiki/Qix%2B%2B)
  - Keep: modernized variants, power-ups, multiple enemy types, techno presentation.
- [QIX Neo screenshot](https://www.mobygames.com/game/46157/qix-neo/screenshots/playstation/433336/)
  - Keep: cleaner modern UI framing and brighter stage finish.
- [JezzBall overview](https://en.wikipedia.org/wiki/JezzBall)
  - Keep: instant readability and simple onboarding for new players.
- [JezzBall screenshot](https://www.mobygames.com/game/25921/jezzball/screenshots/win3x/202757/)
  - Keep: legible risk framing and no ambiguity about what is dangerous.
- [DX-Ball 2 overview](https://en.wikipedia.org/wiki/DX-Ball_2)
  - Keep: every hit matters, layered SFX, huge reactions, board-set identity, euro-techno energy.
- [Cubixx HD overview](https://en.wikipedia.org/wiki/Cubixx_HD)
  - Keep: proof that Qix-style play can still feel modern if presentation and enemy design are pushed hard.

## Direction Chosen

### Platform

Web first.

Reason:

- the current repo is already browser-oriented
- instant launch matters for arcade games
- easy iteration, testing, and deployment
- perfect fit for Ralph-driven incremental work

### Tech Stack

- TypeScript
- Vite
- PixiJS for rendering and post-FX
- WebAudio plus a lightweight audio wrapper for music, SFX buses, and ducking
- Vitest for simulation tests
- Playwright for smoke and input-flow verification

### Architecture

Separate simulation from presentation.

Use a fixed-timestep simulation core with deterministic seeds for:

- replay capture
- debugging
- score verification
- balancing

Recommended structure:

- `src/core`
- `src/game`
- `src/render`
- `src/audio`
- `src/ui`
- `src/content`
- `src/lib`

Key rule:

The renderer should visualize state.
It should not own game truth.

## What To Keep From The Current Prototype

Treat the current implementation as a concept sketch, not a foundation to protect.

Keep these ideas:

- grid-backed area claim logic
- rail-bound Sparks plus free-roaming QiX threats
- capture percentage as a core readout
- level thresholds and run-based scoring
- image reveal as an optional mode or theme payoff
- lightweight procedural or synth-friendly audio attitude
- strong level-clear celebration

## What To Throw Away

- the single-file JavaScript architecture
- any accidental dependence on the current DOM-first structure
- random image category selection as the main identity
- one-off prototype styling decisions
- any mechanic that exists because it was easy to code rather than because it improves tension or payoff

## Visual Direction

Target style:

Glossy neo-arcade with 2000s shareware confidence.

Look:

- luminous vector enemies
- metallic UI framing
- reactive backgrounds
- strong color-state language
- bloom, shockwaves, sparks, scanlines, distortion, and screen-space debris used with restraint
- high contrast between playable state and spectacle layer

The board should feel like a stage, not a spreadsheet.

Recommended theme language:

- cyber carnival
- plasma laboratory
- chrome void
- electric ocean
- mecha cathedral

Avoid:

- random meme art
- adult-reveal baggage
- flat placeholder neon on black with no authored style

If reveal art is used, use curated licensed or original illustrations, abstract motion plates, or biome scenes. The reward should feel premium, not cheap.

## Audio Direction

Audio should do as much work as visuals.

Music:

- breakbeat, techno, electro, synthwave, or industrial-lite
- stage themes with clear pulse and momentum
- adaptive stems that intensify at score thresholds or late-level danger

SFX:

- distinct rail movement ticks
- a charged trail sound while drawing
- alarming near-miss stingers
- explosive claim closure impacts
- enemy fragmentation bursts
- announcer-style callouts for big events only if they genuinely help

Mix goals:

- the player should recognize danger by ear
- claims should feel physically satisfying
- level clears should sound like a reward, not a state change

## Core Game Loop

### MVP Loop

1. Spawn on safe border.
2. Move along claimed territory.
3. Commit to a cut into live space.
4. Survive until the cut reconnects.
5. Claim the section that does not contain the active QiX threats.
6. Build score, multiplier, and meter from risk.
7. Clear the threshold and hit a loud stage-clear payoff.
8. Repeat with escalating speed, density, and enemy behavior.

### Core Enemies

- `QiX`
  - abstract, fast, graceful, unpredictable
  - the star threat
- `Sparks`
  - rail patrol pressure
  - punish safe-edge complacency
- `Fuse`
  - anti-stall pressure on exposed trail
  - should appear early enough that timid play is not dominant

### Tier-2 Enemies For 1.0

- hunter that biases toward the player during cuts
- splitter that creates temporary hazard fragments when trapped
- jammer that corrupts or destabilizes already-claimed territory
- boss-pattern stages every few worlds

## Scoring And Compulsion

The score system must reward nerve, not just completion.

Base scoring should consider:

- area claimed
- fast-cut bonus
- danger proximity bonus
- chain bonus for consecutive claims without death
- trapped-enemy bonus
- time efficiency bonus

Optional meter:

- `Overdrive`
  - fills from risky play
  - briefly boosts score multiplier and effect intensity
  - should amplify the "max dopamine" direction without breaking readability

## Game Modes

### 1. Arcade

Primary mode.

Curated stage flow with themed worlds, escalating enemies, bosses or boss-like gauntlets, score chase, and clear audiovisual progression.

### 2. Remix

Unlocked or available from the start.

Mutators like:

- faster Sparks
- shrinking safe rails
- double QiX
- one-life caravan
- score attack

### 3. Reveal Mode

Optional mode that nods to `Super Qix` and related descendants without inheriting their baggage.

The player reveals:

- abstract animated art
- illustrated scenes
- faction posters
- biome murals

Do not make this the only identity of the game.

## Content Scope For A Real 1.0

Enough content to feel shippable:

- 5 themed worlds
- 6 to 8 stages per world
- at least 3 enemy behavior mixes per world
- 1 standout set-piece or boss-style climax per world
- 2 to 3 music tracks per world family
- meaningful unlockable challenge modifiers
- replayable endless or score-attack mode

Total target:

- 30 to 40 authored stages plus replay modes

## Production Roadmap

### Phase 1: Vertical Slice

Goal:
Prove the game is fun in one stage with final-quality direction.

Deliver:

- fixed-step simulation
- player movement and cutting
- QiX, Sparks, Fuse
- flood-fill territory resolution
- score, lives, threshold
- one polished stage theme
- one strong music track
- one full claim VFX package
- one level-clear reward sequence

Exit criteria:

- it already feels better than the current prototype in the first 30 seconds
- capture events are satisfying enough to make repeated restarts enjoyable

### Phase 2: Systemization

Goal:
Turn the slice into a clean game framework.

Deliver:

- content-driven stage config
- enemy behavior definitions
- reusable FX system
- audio bus and cue system
- save data and local high scores
- replay seed capture
- options menu
- beta tester options: cheat mode, music toggle, speed selection, and volume

Exit criteria:

- new stages and enemy mixes can be added without editing core engine code

### Phase 3: Juice Pass

Goal:
Overdeliver on feel.

Deliver:

- screen shake rules
- bloom and distortion pass
- impact flashes
- claim shockwaves
- combo callouts
- richer death and enemy trap sequences
- adaptive music intensity

Exit criteria:

- every important action has a satisfying audiovisual signature

### Phase 4: Content Buildout

Goal:
Make it feel like a shipped game, not a demo.

Deliver:

- themed worlds
- stage progression
- remix modifiers
- boss or set-piece encounters
- reveal-mode content
- achievement hooks

Exit criteria:

- at least 45 minutes of fresh first-run content

### Phase 5: Polish And Ship

Goal:
Stability, balancing, and presentation finish.

Deliver:

- onboarding and tutorialization
- balance pass
- accessibility options
- beta options pass for cheat mode, music toggle, speed selection, and volume
- performance pass
- credits and legal asset review
- packaging and deployment

Exit criteria:

- stable 60 FPS on ordinary laptops
- no unreadable late-game effect stacking
- no major rules ambiguity

## Controls

Keyboard-first, gamepad-friendly.

Suggested default:

- move: arrows or WASD
- cut mode: hold key or trigger
- fast cut / power cut: second key or shoulder
- confirm / continue: space or south button

Keep input latency low and avoid fancy control ideas that reduce precision.

## Beta Tester Must-Haves

These are hard requirements for the first public test build:

- `Cheat mode`
  - slows all enemy pressure significantly so less-skilled testers can still see the content
- `Music on/off`
  - instant toggle in the options menu
- `Speed selection`
  - global gameplay pace selector with at least slow, normal, and fast presets
- `Volume setting`
  - at minimum a master volume slider
  - preferred: separate master, music, and SFX sliders

## UX And Accessibility

Even with a spectacle-first target, include:

- cheat mode toggle
- music on/off
- speed selection
- volume control
- effect intensity slider
- screenshake toggle
- bloom toggle
- high-contrast mode
- clear danger-color remapping support
- audio sliders by bus
- pause and resume that respect the arcade flow

This is not optional if the goal is to feel contemporary.

## Technical Risks

### Risk: Effects obscure game state

Mitigation:

- separate gameplay-state colors from celebration colors
- add automated screenshots and playtest checks for readability
- keep the live trail visually sacred and never hide it

### Risk: Flood-fill and collision logic become fragile

Mitigation:

- unit test territory resolution heavily
- keep simulation deterministic
- record replay seeds for bug reproduction

### Risk: Content ambition outruns architecture

Mitigation:

- lock the vertical slice before expanding worlds
- build data-driven stages early
- avoid bespoke per-level logic until the system layer is stable

### Risk: The game becomes flashy but shallow

Mitigation:

- tune score greed and enemy pressure first
- add content only after the 3-minute loop is already addictive

## Non-Goals

- pure historical preservation
- direct code continuation from the current prototype
- adult-reveal clone identity
- mobile-first free-to-play design
- full 3D camera gimmickry if it harms precision or readability

## Definition Of Done

The project is worthy of existing in 2026 when all of this is true:

- the first minute is instantly readable and exciting
- every successful capture feels powerful in both audio and visuals
- the game supports serious score-chasing
- the content scope feels deliberate, not stitched together
- the art direction looks authored, not placeholder
- the soundtrack and SFX materially improve play
- the build is stable, replayable, and easy to launch

## Immediate Build Order

Do this next, in order:

1. Create the TypeScript + Vite + PixiJS foundation.
2. Port only the core rules into a clean simulation layer.
3. Rebuild one stage as a true vertical slice with final-quality FX targets.
4. Tune the first 3 minutes until the game is already hard to stop playing.
5. Only then expand content, modes, and progression.

## Bottom Line

The right version of this project is not "a nice little Qix clone."

It is a sharp, addictive, spectacle-heavy arcade game with a clear mechanical spine and enough style, sound, and reward density to stand beside modern indie score-chasers instead of living as a curiosity.
