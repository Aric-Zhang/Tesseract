# Project Prism Phase 0 Smoke Report

Date: 2026-06-07

Target:

```text
http://127.0.0.1:5173/
```

Dev server:

```text
port: 5173
listening process: 50948
```

Data artifact:

```text
temp/project-prism-phase-0-smoke-data.json
```

Screenshots:

```text
temp/project-prism-phase-0-initial.png
temp/project-prism-phase-0-final.png
temp/project-prism-phase-0-dock.png
```

## Environment

Viewport captured by the in-app browser:

```text
width: 594
height: 698
devicePixelRatio: 1.25
```

This is a narrow/mobile-sized viewport, so this smoke covers narrow UI constraints.
A separate wide desktop viewport was not forced in this pass.

## Results

Passed:

- App loaded at `http://127.0.0.1:5173/`.
- Initial Scene root frame rendered with canvas and Camera3 overlay.
- Window menu opened through actor input.
- Clicking outside the menu closed the menu.
- Scene fullscreen expanded the canvas to the viewport.
- Scene restore returned canvas and Camera3 overlay to the root frame layout.
- Camera3 drag hit `camera-3:gizmo-event-binding part=orbit`.
- Camera3 double-click hit `camera-3:gizmo-event-binding part=orbit`.
- Reload kept root Scene, floating tabs, canvas, and Camera3 stable.
- Debug tab drag/merge into an existing floating frame completed without console errors.
- Console error count stayed at `0` for the captured operations.

Storage:

```text
localStorage before reload: {}
localStorage after reload: {}
```

Reload tab baseline:

```text
before reload: Scene, Debug Log, Hierarchy
after reload:  Scene, Debug Log, Hierarchy
```

## Known Limitations

- The browser viewport was narrow/mobile-sized. A wide desktop viewport was not separately forced.
- Dock smoke covered a Debug tab drag/merge into an existing floating frame.
- Split-region docking and repeated dock/undock loops remain later QA scope.

## Verdict

This smoke is sufficient as a Phase 0 baseline artifact. It should not be treated
as a full docking QA suite. Later Project Prism phases should compare against
this data when changing actor input, UI framework boundaries, window lifecycle,
Scene View rendering, or Camera3 ownership.
