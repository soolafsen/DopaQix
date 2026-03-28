import { Container, Graphics, Text, TextStyle } from "pixi.js";
import type { GameState } from "../game/state";
import { BOARD_HEIGHT, BOARD_WIDTH } from "../game/state";

const frameTextStyle = new TextStyle({
  fill: 0xe6f0ff,
  fontFamily: "Arial",
  fontSize: 20,
  fontWeight: "700",
  letterSpacing: 2
});

const titleTextStyle = new TextStyle({
  fill: 0xf4f7ff,
  fontFamily: "Arial",
  fontSize: 44,
  fontWeight: "700",
  align: "center"
});

const bodyTextStyle = new TextStyle({
  fill: 0x9fb9e5,
  fontFamily: "Arial",
  fontSize: 18,
  align: "center"
});

export interface BoardRenderer {
  readonly stage: Container;
  render: (state: GameState) => void;
}

export function createBoardRenderer(): BoardRenderer {
  const stage = new Container();
  const background = new Graphics();
  const board = new Graphics();
  const cursor = new Graphics();
  const phaseText = new Text({ text: "", style: frameTextStyle });
  const titleText = new Text({ text: "", style: titleTextStyle });
  const bodyText = new Text({ text: "", style: bodyTextStyle });

  stage.addChild(background, board, cursor, phaseText, titleText, bodyText);

  phaseText.position.set(38, 28);
  titleText.anchor.set(0.5);
  titleText.position.set(BOARD_WIDTH / 2, 230);
  bodyText.anchor.set(0.5);
  bodyText.position.set(BOARD_WIDTH / 2, 300);

  return {
    stage,
    render: (state) => {
      renderBackground(background, state);
      renderBoard(board, state);
      renderCursor(cursor, state);
      renderText(state, phaseText, titleText, bodyText);
    }
  };
}

function renderBackground(graphics: Graphics, state: GameState): void {
  const glow = 0.18 + state.boardPulse * 0.16;

  graphics
    .clear()
    .rect(0, 0, BOARD_WIDTH, BOARD_HEIGHT)
    .fill({ color: 0x050914 })
    .roundRect(18, 18, BOARD_WIDTH - 36, BOARD_HEIGHT - 36, 24)
    .fill({ color: 0x091423 })
    .roundRect(18, 18, BOARD_WIDTH - 36, BOARD_HEIGHT - 36, 24)
    .stroke({ color: 0x6ab7ff, width: 2, alpha: 0.55 + glow })
    .roundRect(70, 90, BOARD_WIDTH - 140, BOARD_HEIGHT - 180, 18)
    .stroke({ color: 0x49f2c2, width: 4, alpha: 0.7 + glow });
}

function renderBoard(graphics: Graphics, state: GameState): void {
  const pulseInset = 2 + state.boardPulse * 6;

  graphics
    .clear()
    .roundRect(88, 108, BOARD_WIDTH - 176, BOARD_HEIGHT - 216, 10)
    .fill({ color: 0x07111d })
    .roundRect(88 + pulseInset, 108 + pulseInset, BOARD_WIDTH - 176 - pulseInset * 2, BOARD_HEIGHT - 216 - pulseInset * 2, 8)
    .stroke({ color: 0x1e446b, width: 2, alpha: 0.9 });

  for (let x = 120; x <= BOARD_WIDTH - 120; x += 64) {
    graphics.moveTo(x, 120).lineTo(x, BOARD_HEIGHT - 120);
  }

  for (let y = 120; y <= BOARD_HEIGHT - 120; y += 64) {
    graphics.moveTo(120, y).lineTo(BOARD_WIDTH - 120, y);
  }

  graphics.stroke({ color: 0x103152, width: 1, alpha: 0.55 });

  graphics
    .roundRect(48, 32, BOARD_WIDTH - 96, 38, 10)
    .stroke({ color: 0x78c8ff, width: 2, alpha: 0.45 })
    .roundRect(48, BOARD_HEIGHT - 70, BOARD_WIDTH - 96, 28, 10)
    .stroke({ color: 0x78c8ff, width: 2, alpha: 0.3 });
}

function renderCursor(graphics: Graphics, state: GameState): void {
  graphics
    .clear()
    .circle(state.cursorX, state.cursorY, 8)
    .fill({ color: 0xffdf72 })
    .circle(state.cursorX, state.cursorY, 18)
    .stroke({ color: 0xffdf72, width: 2, alpha: 0.7 });
}

function renderText(state: GameState, phaseText: Text, titleText: Text, bodyText: Text): void {
  phaseText.text = `Phase ${state.phase.toUpperCase()}  |  Input ${state.lastKey}`;

  if (state.phase === "boot") {
    titleText.text = "CODEXQIX";
    bodyText.text = "Boot sequence online. Press Enter or Space to deploy the placeholder stage.";
    titleText.visible = true;
    bodyText.visible = true;
    return;
  }

  titleText.text = "Placeholder Stage";
  bodyText.text = "Fixed-step simulation shell active. Move with WASD or Arrow keys.";
  titleText.visible = true;
  bodyText.visible = true;
}
