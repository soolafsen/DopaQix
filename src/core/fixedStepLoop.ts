export interface FixedStepLoopOptions {
  readonly stepMs: number;
  readonly maxFrameMs?: number;
  readonly update: (stepMs: number) => void;
  readonly render: (alpha: number) => void;
}

export class FixedStepLoop {
  private readonly stepMs: number;
  private readonly maxFrameMs: number;
  private readonly updateFn: (stepMs: number) => void;
  private readonly renderFn: (alpha: number) => void;
  private accumulator = 0;
  private running = false;
  private lastTime = 0;
  private frameHandle = 0;

  public constructor(options: FixedStepLoopOptions) {
    this.stepMs = options.stepMs;
    this.maxFrameMs = options.maxFrameMs ?? options.stepMs * 5;
    this.updateFn = options.update;
    this.renderFn = options.render;
  }

  public start(timeSource = performance.now()): void {
    if (this.running) {
      return;
    }

    this.running = true;
    this.lastTime = timeSource;
    this.frameHandle = requestAnimationFrame(this.tick);
  }

  public stop(): void {
    this.running = false;
    cancelAnimationFrame(this.frameHandle);
  }

  public advance(frameMs: number): void {
    const delta = Math.min(frameMs, this.maxFrameMs);
    this.accumulator += delta;

    while (this.accumulator >= this.stepMs) {
      this.updateFn(this.stepMs);
      this.accumulator -= this.stepMs;
    }

    this.renderFn(this.accumulator / this.stepMs);
  }

  private readonly tick = (time: number): void => {
    if (!this.running) {
      return;
    }

    this.advance(time - this.lastTime);
    this.lastTime = time;
    this.frameHandle = requestAnimationFrame(this.tick);
  };
}
