# DopaQiX Native

Native Godot 4 Windows build of DopaQix, rebuilt for louder combat feedback, animated pickups, brighter player and enemy presentation, and a no-nonsense download, unzip, and play flow.

## Play Now

1. Go to [Releases](https://github.com/soolafsen/DopaQix/releases).
2. Download `DopaQiXNative-win64.zip`.
3. Unzip it.
4. Double-click `DopaQiXNative.exe`.

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
