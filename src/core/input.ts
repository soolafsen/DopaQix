export interface InputState {
  readonly x: number;
  readonly y: number;
  readonly pressedStart: boolean;
  readonly lastKey: string;
}

const AXIS_BY_KEY: Record<string, { x: number; y: number }> = {
  ArrowUp: { x: 0, y: -1 },
  KeyW: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
  KeyS: { x: 0, y: 1 },
  ArrowLeft: { x: -1, y: 0 },
  KeyA: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
  KeyD: { x: 1, y: 0 }
};

export class InputController {
  private readonly heldKeys = new Set<string>();
  private lastKey = "Idle";
  private pressedStart = false;

  public constructor(target: Window) {
    target.addEventListener("keydown", this.onKeyDown);
    target.addEventListener("keyup", this.onKeyUp);
    target.addEventListener("blur", this.onBlur);
  }

  public snapshot(): InputState {
    let x = 0;
    let y = 0;

    for (const key of this.heldKeys) {
      const axis = AXIS_BY_KEY[key];

      if (!axis) {
        continue;
      }

      x += axis.x;
      y += axis.y;
    }

    const state = {
      x: Math.max(-1, Math.min(1, x)),
      y: Math.max(-1, Math.min(1, y)),
      pressedStart: this.pressedStart,
      lastKey: this.lastKey
    };

    this.pressedStart = false;
    return state;
  }

  public dispose(target: Window): void {
    target.removeEventListener("keydown", this.onKeyDown);
    target.removeEventListener("keyup", this.onKeyUp);
    target.removeEventListener("blur", this.onBlur);
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (event.repeat) {
      return;
    }

    this.heldKeys.add(event.code);
    this.lastKey = event.code;

    if (event.code === "Enter" || event.code === "Space") {
      this.pressedStart = true;
    }
  };

  private readonly onKeyUp = (event: KeyboardEvent): void => {
    this.heldKeys.delete(event.code);
  };

  private readonly onBlur = (): void => {
    this.heldKeys.clear();
  };
}
