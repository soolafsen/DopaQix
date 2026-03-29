# DopaQiX Native

Native Godot 4 Windows build of DopaQix, rebuilt for louder combat feedback, animated pickups, brighter player and enemy presentation, and a no-nonsense download, unzip, and play flow.

## Get The Game

[Download DopaQiX Native ZIP](https://github.com/soolafsen/DopaQix/raw/refs/heads/codex/DopaQiXnative/dist/DopaQiXNative-win64.zip)

That link should start the ZIP download directly.

## How To Play

1. Click **Download DopaQiX Native ZIP** above.
2. Open your `Downloads` folder.
3. Find `DopaQiXNative-win64.zip`.
4. Extract or unzip it with Windows or a tool like 7-Zip.
5. Open the extracted folder.
6. Double-click `DopaQiXNative.exe`.

No Godot install is required for players.

## Controls

- `WASD` or arrow keys: move on the rail and cut into the field
- `Space` or `Enter`: start, continue, or restart after game over
- `Esc` or `P`: pause or resume
- `M`: toggle music

## Development

- Source run: open the repo in Godot 4.6+ and run `main.tscn`
- Quick verification: `godot --headless --path . --quit-after 1`
- Windows export: `powershell -ExecutionPolicy Bypass -File .\scripts\export-windows.ps1`

More detail lives in [docs/development.md](./docs/development.md).

## Notes

- The native Godot project at the repo root is now the shipping source of truth.
- Ralph tracking for this migration lives in `.agents/tasks/prd-dopaqix-native.json`.
