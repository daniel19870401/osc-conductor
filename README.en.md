# OSConductor

[中文](README.md) | [English](README.en.md)

<p align="left">
  <img src="docs/assets/osconductor-ui.png" alt="OSConductor UI" width="900" />
</p>

This program is fully produced with AI vibe coding.

OSC/Audio/MIDI/DMX timeline control software.

## Features

- Timeline playback / pause / locate / loop range control (with precise time input)
- Sync modes: Internal, MTC, LTC
- Multiple compositions (rename, switch, reorder; each remembers its own playhead position)
- Track types: OSC, OSC Array, OSC Flag, OSC Color, 3D OSC, Audio, MIDI CC, MIDI Note, DMX, DMX Color, Group
- Multiple OSC output ports (named), selectable per OSC-type track
- Audio clip import, waveform display, drag move, cue snap, Audio Channel Map patching
- MIDI CC / MIDI Note output (selectable port / channel)
- DMX / DMX Color (Art-Net) output
- 3D OSC node editing (XY/YZ + 3D camera), with one independent 3D monitor window per track
- Node / Cue / Track copy, cut, paste, with Undo / Redo

## New in v1.2.3

- Audio track non-destructive trim added: `A` (trim head to playhead), `S` (trim tail to playhead)
- After trim, clip head/tail can be dragged back to restore removed content
- New audio shortcuts: `D` creates Fade In from clip head to playhead, `G` creates Fade Out from playhead to clip tail
- Fade In / Fade Out support drag-to-edit duration, drag curve dot, and double-click edit dialog (curve/shape/duration)
- Fade curve UI and actual playback are now synchronized (Renderer / Native Audio Engine)
- Loop playback behavior update:
  - If loop is enabled, pressing Play from stop always starts at loop start
  - Enabling loop during playback no longer jumps immediately; it wraps only after reaching loop end

## Current packaged builds (v1.2.3)

Inside `release/`:

- `OSConductor-1.2.3-win-x64.exe` (Windows Intel x64)
- `OSConductor-1.2.3-win-arm64.exe` (Windows ARM64)
- `OSConductor-1.2.3-arm64.dmg` (macOS Apple Silicon installer)
- `OSConductor-1.2.3-arm64-mac.zip` (macOS Apple Silicon zip)
- `release/mac-arm64/OSConductor.app` (macOS Apple Silicon app bundle)

## Development

```bash
npm install
npm run dev
```

- Vite dev server runs on `5170`
- Do not set OSC send/listen/control ports to `5170`

## Repackage

```bash
npm run build
npx electron-builder --win portable --x64 --config.win.signAndEditExecutable=false --publish never
npx electron-builder --win portable --arm64 --config.win.signAndEditExecutable=false --publish never
npx electron-builder --mac zip --arm64 --config.mac.identity=null --publish never
```

## Help (Shortcuts / Control)

### Keyboard

- `Space`: Play / Pause
- `C`: Add cue at playhead (while playing)
- `,`: Jump to previous cue
- `.`: Jump to next cue
- `=`: Add cue at playhead
- `-`: Delete nearest cue around playhead
- `D`: Audio track only (when playhead intersects clip): set Fade In from clip head to playhead
- `G`: Audio track only (when playhead intersects clip): set Fade Out from playhead to clip tail
- `A`: Audio track only (when playhead intersects clip): trim head to playhead (non-destructive)
- `S`: Audio track only (when playhead intersects clip): trim tail to playhead (non-destructive)
- `Backspace/Delete`: Delete selected node(s) or selected track(s)
- `Cmd/Ctrl + O`: Add OSC track
- `Cmd/Ctrl + A`: Add Audio track
- `Cmd/Ctrl + M`: Add MIDI CC track
- `Cmd/Ctrl + Shift + M`: Add MIDI Note track
- `Cmd/Ctrl + D`: Add DMX track
- `Cmd/Ctrl + Shift + D`: Add DMX Color track
- `Cmd/Ctrl + C`: Copy selected track(s) or node(s)
- `Cmd/Ctrl + V`: Paste track(s), or paste node(s) at playhead
- `Cmd/Ctrl + Z`: Undo
- `Cmd/Ctrl + Shift + Z`: Redo
- `Cmd/Ctrl + Y`: Redo (alternative)
- `Cmd/Ctrl + =`: Timeline Zoom In
- `Cmd/Ctrl + -`: Timeline Zoom Out
- `Enter (Audio Channel Map)`: Save current mapping and jump to next audio track
- `↓ (Audio Channel Map)`: Save current mapping and jump to next audio track
- `Top Bar: Comps`: Show / hide Compositions panel
- `Top Bar: Inspector`: Show / hide Inspector panel
- `Esc`: Close Help

### Mouse

- Double click Timeline: Add cue
- Drag cue: Move cue time
- Right click cue: Edit / delete
- Double click composition: Rename
- Drag composition: Reorder
- `Alt/Option + click Track +`: Open Multi Add menu (add multiple tracks at once)
- Double click node: Edit value / color (OSC Flag edits `Time + OSC Address + OSC Value`)
- Drag node: Move in time / value
- `Alt/Option + drag node`: Snap node to nearest cue
- Right click node: Change node curve mode
- Click color swatch: Apply track color (supports multi-selected tracks)
- Drag audio clip head/tail edge: Trim clip head/tail (drag back to restore)
- `Alt/Option + drag audio edge`: Snap trim edge to nearest cue
- Drag fade line: Change Fade In / Fade Out duration
- Drag fade yellow dot: Change fade curvature
- Double click fade area: Open fade edit dialog
- `Shift + click track`: Range select tracks
- `Ctrl/Cmd + click track`: Toggle individual track selection
- `Shift + Alt/Option + wheel`: Zoom W
- `Shift + Ctrl + wheel`: Zoom H

### Project / Audio Notes

- Default new project length: `00:10:00.00`
- When imported audio is longer than current project length, project auto-extends to `audio end + 30 seconds`
- Audio clip head stays visually aligned to timeline even at extreme zoom-out
- Added track type: `OSC Flag` (triggers OSC Address/Value when playhead crosses node)

### 3D OSC Controls

- `Inspector > Open 3D Monitor`: open one independent monitor window per 3D OSC track
- `Edit 3D OSC Node`: drag to orbit, wheel to zoom, double click to reset camera
- `3D OSC Monitor`: drag to orbit, wheel to zoom, double click to reset camera
- Both `Edit 3D OSC Node` and `3D OSC Monitor` show RGB XYZ axes, rotating with camera view
- Both 3D views keep proportional scaling and avoid stretch distortion

### OSC Remote Control

Set listening port first in `Settings > OSC > OSC Control Port`.

Composition index is 1-based (order in left composition list).

- `/OSConductor/Composition/5/select`: switch to composition #5
- `/OSConductor/Composition/1/rec 1`: switch to #1 and REC on
- `/OSConductor/Composition/1/rec 0`: switch to #1 and REC off
- `/OSConductor/Composition/1/play 1`: switch to #1 and play
- `/OSConductor/Composition/1/play 0`: switch to #1 and stop play
- `/OSConductor/Composition/1/stop 1`: switch to #1 and stop + locate to `00:00:00.00`
- `/OSConductor/Composition/1/loop 1`: switch to #1 and loop on
- `/OSConductor/Composition/1/loop 0`: switch to #1 and loop off
- `/OSConductor/Composition/1/cue 10`: switch to #1 and jump to cue #10
- `/OSConductor/Composition/1/cue/10`: alternative cue jump path format

## Brand

<p align="left">
  <img src="docs/assets/nl-interactive-logo.png" alt="NL interactive logo" width="140" />
</p>

- NL Interactive
- Copyright © NL Interactive

## Donate

If this project helps you, donations are welcome:

<p align="left">
  <img src="docs/assets/osconductor-donate-qrcode.png" alt="OSConductor Donate QRCode" width="280" />
</p>
