---
name: DopaQiX emotion pass
overview: Push DopaQiX further toward fight-or-flight and joy by making deaths harsher, clears more triumphant, music more reactive to danger, and adding small positive or negative pickups on the rail path, while preserving the static zip delivery model.
isProject: true
---

# Emotion Pass

## Delivery

- Stay static.
- Keep `ship/index.html` double-clickable.
- Do not add any runtime dependency that requires install or a local server.

## Target Feel

- Getting hit should feel loud, colorful, and bad.
- Clearing a level should feel celebratory and victorious.
- Nearby enemies should make the music and mood feel more dangerous.
- The game should push the player between panic and relief, not sit flat.

## Mechanics To Add

- Rail bombs
  - cartoon bomb with burning fuse
  - spawns occasionally on player-safe rail routes
  - touching it slows the player to half speed for about 10 seconds
  - it should not kill the player
- Rail cookies
  - spawns occasionally on player-safe rail routes
  - touching it boosts player speed by about 30 percent for about 10 seconds

## Ralph Bias

- Prefer enhancing the current static prototype over architecture churn.
- Favor payoff, readability, and runtime smoothness.
- Any music reaction should be lightweight enough to avoid making performance worse.
