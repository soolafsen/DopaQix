import { Application } from "pixi.js";
import { FixedStepLoop } from "../core/fixedStepLoop";
import { InputController } from "../core/input";
import { createInitialState, stepGame } from "../game/state";
import { createBoardRenderer } from "../ui/renderBoard";

export async function createGameShell(root: HTMLDivElement): Promise<void> {
  root.replaceChildren();

  const shell = document.createElement("main");
  shell.className = "app-shell";

  const frame = document.createElement("section");
  frame.className = "app-frame";

  const statusBar = document.createElement("header");
  statusBar.className = "status-bar";
  statusBar.innerHTML = [
    '<span class="status-copy">US-001 foundation</span>',
    '<span class="status-value" data-testid="phase-readout">Boot</span>',
    '<span class="status-value" data-testid="input-readout">Idle</span>'
  ].join("");

  const boardHost = document.createElement("section");
  boardHost.className = "board-host";
  boardHost.setAttribute("data-testid", "board-host");

  frame.append(statusBar, boardHost);
  shell.append(frame);
  root.append(shell);

  const app = new Application();
  await app.init({
    width: 800,
    height: 600,
    backgroundAlpha: 0,
    antialias: true,
    autoDensity: true,
    resolution: Math.min(window.devicePixelRatio || 1, 2)
  });

  boardHost.append(app.canvas);

  const input = new InputController(window);
  const state = createInitialState();
  const renderer = createBoardRenderer();
  app.stage.addChild(renderer.stage);

  const phaseReadout = statusBar.querySelector<HTMLElement>('[data-testid="phase-readout"]')!;
  const inputReadout = statusBar.querySelector<HTMLElement>('[data-testid="input-readout"]')!;

  const loop = new FixedStepLoop({
    stepMs: 1000 / 60,
    update: (stepMs) => {
      stepGame(state, input.snapshot(), stepMs);
    },
    render: () => {
      renderer.render(state);
      phaseReadout.textContent = state.phase === "boot" ? "Boot" : "Stage";
      inputReadout.textContent = state.lastKey;
    }
  });

  loop.start();

  window.addEventListener(
    "beforeunload",
    () => {
      loop.stop();
      input.dispose(window);
      void app.destroy(true);
    },
    { once: true }
  );
}
