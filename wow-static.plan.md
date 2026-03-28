---
name: CodexQiX static wow pass
overview: Reframe CodexQiX as a zero-install, double-clickable browser game that ships as a simple zip while still delivering a loud, polished wow-factor vertical slice.
isProject: true
---

# Static Wow Plan

## Hard Constraints

- Ship as static files only.
- Double-clicking `index.html` must work.
- No npm, build step, or terminal required for the beta tester.
- The beta tester must have:
  - cheat mode
  - music on/off
  - speed selection
  - volume setting

## Wow Priorities

- Bigger capture feedback: flash, shockwave feel, brighter claim colors, more particles.
- Stronger cabinet presentation around the board.
- Better music and sound control, not just sound existence.
- Cleaner first-run readability despite the extra juice.
- A "one more run" first minute.

## Implementation Bias

- Prefer evolving the current static prototype over introducing tooling.
- Reuse working mechanics where they are already playable.
- Spend effort on feel, clarity, and zero-friction delivery over architecture purity.

## Ralph Target

Use Ralph to bias toward a static vertical slice PRD, not a Vite/Pixi toolchain project.
