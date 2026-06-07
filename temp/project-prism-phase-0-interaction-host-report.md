# Project Prism Phase 0D Interaction And Render Host Report

Date: 2026-06-07

## Scope

This report records the new Phase 0D evidence gate added after the root/floating
input and Scene render-host spot checks.

Phase 0D is not a feature implementation phase. Its purpose is to turn the
observed interaction/render risks into hard Project Prism gates before package
extraction starts.

## Static Boundary Work

Added architecture boundary coverage for:

- root and floating tab chrome using the same `WindowFrameSurfaceComponent` and
  `window-frame-tab-chrome` hit/action model;
- floating frame tab parts using shared `WINDOW_FRAME_TAB_PART_ID` and
  `WINDOW_FRAME_TAB_ACTION_PART_ID` constants instead of local string facts;
- visual z-index and actor input priority staying tied to frame stack priority
  projection;
- UI framework candidates staying independent from concrete Scene, Camera3, and
  Tesseract runtime facts.

Small production cleanup:

- `floating-window-component.ts` now imports and uses the shared tab part
  constants already used by the root frame component.

## Browser Evidence

Dev server:

```text
http://127.0.0.1:5173/?resetWorkspaceLayout=1
```

Artifacts:

```text
temp/project-prism-phase-0-interaction-host-data.json
temp/project-prism-phase-0-interaction-host-final.png
temp/project-prism-phase-0d-root-overlap-data.json
temp/project-prism-phase-0d-root-overlap-covered.png
temp/project-prism-phase-0d-root-overlap-uncovered.png
temp/project-prism-phase-0d-root-overlap-final.png
temp/project-prism-phase-0-interaction-host-vite.out.log
temp/project-prism-phase-0-interaction-host-vite.err.log
temp/project-prism-phase-0d-root-overlap-vite.out.log
temp/project-prism-phase-0d-root-overlap-vite.err.log
```

The follow-up smoke uses a deterministic bootstrap query,
`resetWorkspaceLayout=1`, which clears the persisted workspace layout key before
the normal restore/default-open flow. This lets the app start with Scene in the
workspace root and tool windows floating without adding root/floating input
exceptions.

Current browser layout started with Scene as a floating frame and an empty
workspace root. A real drag attempt did not dock Scene back into root, so the
specific `floating-over-root-tab` smoke could not be completed in this persisted
layout.

The gate remains required because the previous spot check reproduced the exact
risk: a visible root Scene tab close point was topped by the floating Hierarchy
titlebar in `document.elementsFromPoint()`, and actor input hit
`hierarchy-panel:gizmo-event-binding part=titlebar-empty` instead of the Scene
tab close action.

The follow-up deterministic root smoke closed this blocker:

- Initial layout had Scene in root and Debug/Hierarchy as floating frames.
- `floating-over-root-tab`: the Hierarchy floating titlebar visually covered the
  root Scene close point. `document.elementsFromPoint()` reported the Hierarchy
  titlebar as top, and clicking that point hit
  `hierarchy-panel:gizmo-event-binding part=titlebar-empty`; Scene stayed open.
- `root-tab-uncovered`: after dragging the Hierarchy frame away by titlebar
  empty space, the root Scene close button became DOM top and closed Scene on the
  first click.
- Root Scene fullscreen/restore controls were reachable on the first click in
  the uncovered state. The current fullscreen exit aria label is
  `Shrink Scene to window`.
- Window menu restored Scene after the close test with non-zero canvas/control
  rects. In current runtime semantics, menu restore recreates Scene as a
  floating frame rather than restoring it into root; this is recorded behavior,
  not part of the Phase 0D blocker.
- App console errors: 0.

Data quality note:

The root overlap JSON includes `actorInputLine` fields sampled from the debug log
tail. Some of those samples are not command-scoped to the exact click being
described. The Phase 0D verdict is therefore based on the combined DOM stack,
state transition result, final debug log evidence, screenshots, and console
error count. Future reusable smoke should capture actor input hit actor/part as
structured per-command fields rather than scraping the latest log line.

Reusable smoke contract:

```text
apps/wallpaper-tesseract/src/test-support/project-prism-smoke-contract.ts
```

Future Project Prism browser smoke artifacts must include command-scoped
`actorInputHit.actorId` and `actorInputHit.partId` for each interaction point.
The old log-tail `actorInputLine` shape is acceptable only as historical
evidence for this report.

## Scene Render Host Loop

Completed in the current browser layout:

- Scene fullscreen/restore: 10 iterations, 0 failures.
- Scene close/reopen through Window menu: 10 iterations, 0 failures.
- App console errors via `tab.dev.logs({ levels: ["error"] })`: 0.
- Final state had non-zero Scene canvas rect and non-zero Camera3 overlay rect.

The browser automation client emitted one Statsig network timeout while the
loop was running. This was not an application page console error.

## Required Follow-Up Before Phase 0 Complete

Phase 0D interaction/render host closure is complete.

Keep the deterministic root bootstrap and structured root/floating overlap
smoke as a Project Prism regression gate before extracting the UI framework
package. Do not replace it with root-only or floating-only input exceptions.

## Validation

```text
npm run test -w wallpaper-tesseract -- architecture-boundaries
```

Result: passed, 69 tests.

```text
npm run test -w wallpaper-tesseract -- floating-window-component workspace-root-dock-frame-component window-frame-tab-chrome
```

Result: passed, 3 files / 63 tests.

```text
npm run typecheck -w wallpaper-tesseract
```

Result: passed.

```text
npm run test -w wallpaper-tesseract -- browser-window-workspace-layout-storage architecture-boundaries
```

Result: passed, 2 files / 75 tests.

```text
npm run test -w wallpaper-tesseract -- floating-window-component workspace-root-dock-frame-component window-frame-tab-chrome
```

Result: passed, 3 files / 63 tests.

```text
npm run typecheck -w wallpaper-tesseract
```

Result: passed after adding the deterministic layout reset bootstrap.

```text
npm run test -w wallpaper-tesseract
```

Result: passed, 64 files / 595 tests.

```text
npm run build -w wallpaper-tesseract
```

Result: passed, with the existing Vite chunk size warning.
