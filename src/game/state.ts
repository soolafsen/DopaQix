import type { InputState } from "../core/input";

export type GamePhase = "boot" | "stage";

export interface GameState {
  phase: GamePhase;
  elapsedMs: number;
  bootCountdownMs: number;
  cursorX: number;
  cursorY: number;
  boardPulse: number;
  lastKey: string;
}

export const BOARD_WIDTH = 800;
export const BOARD_HEIGHT = 600;
const CURSOR_SPEED = 220;

export function createInitialState(): GameState {
  return {
    phase: "boot",
    elapsedMs: 0,
    bootCountdownMs: 1400,
    cursorX: BOARD_WIDTH / 2,
    cursorY: BOARD_HEIGHT / 2,
    boardPulse: 0,
    lastKey: "Idle"
  };
}

export function stepGame(state: GameState, input: InputState, stepMs: number): void {
  state.elapsedMs += stepMs;
  state.boardPulse = (Math.sin(state.elapsedMs / 350) + 1) * 0.5;
  state.lastKey = input.lastKey;

  if (state.phase === "boot") {
    state.bootCountdownMs = Math.max(0, state.bootCountdownMs - stepMs);

    if (state.bootCountdownMs === 0 || input.pressedStart) {
      state.phase = "stage";
    }

    return;
  }

  const move = (CURSOR_SPEED * stepMs) / 1000;
  state.cursorX = clamp(state.cursorX + input.x * move, 140, BOARD_WIDTH - 140);
  state.cursorY = clamp(state.cursorY + input.y * move, 140, BOARD_HEIGHT - 120);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
