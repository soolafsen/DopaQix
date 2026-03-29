# Development

This repo now ships a native Godot build instead of a browser-first package.

## Prerequisites

- Windows
- Godot 4.6 or newer
- PowerShell

## Run From Source

1. Open the repo in Godot.
2. Run `main.tscn`.

Command-line smoke check:

```powershell
godot --headless --path . --quit-after 1
```

## Create A Player Build

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\export-windows.ps1
```

That script:

- ensures the correct Godot Windows export templates are installed
- exports `dist/DopaQiXNative.exe`
- creates `dist/DopaQiXNative-win64.zip`

## Key Files

- `project.godot`: project configuration
- `main.tscn`: root scene
- `scripts/game.gd`: main gameplay, rendering, pickups, scoring, level flow, and UI
- `scripts/audio_synth.gd`: procedural music and sound generation
- `scripts/export-windows.ps1`: Windows export and zip packaging
- `.agents/tasks/prd-dopaqix-native.json`: Ralph-style task tracking
