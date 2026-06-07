# Project Prism Phase 0D Root Overlap Closure Plan

Date: 2026-06-07

## Goal

Close the remaining Phase 0D blocker from
`project-prism-phase-0-interaction-host-report.md`: prove that root and floating
frames use one coherent visual/input layering model in a real browser overlap
scenario.

This is a Project Prism boundary gate, not a feature shortcut. The fix must not
add root-only or floating-only input exceptions. It should make the risky layout
deterministic, then verify the shared chrome/priority model with structured
browser evidence.

## Current Blocker

The last Phase 0D smoke started from persisted state where Scene was floating and
the workspace root was empty. A manual drag attempt did not reliably redock Scene
into root, so these cases were not proven:

- `floating-over-root-tab`: a floating frame covers a root tab/control; visual
  top, DOM top, and actor input hit target must agree.
- `root-tab-uncovered`: after moving the floating frame away, root Scene tab
  close/fullscreen controls must respond to a single click.

## Step 0D.1: Deterministic Root Layout Bootstrap

### Target

Add a smoke-only bootstrap path that resets persisted workspace layout before the
normal app restore/open flow runs.

### Design

- Extend the browser layout storage adapter with `resetKeys`.
- App composition may pass
  `WINDOW_WORKSPACE_FRAME_LAYOUT_STORAGE_KEY` when URL query
  `resetWorkspaceLayout=1` is present.
- The normal production path keeps using persisted layout.
- `installWindowWorkspaceFeature.restorePersistedLayout()` and
  `openDefaultViews()` stay untouched; the reset only changes the storage facts
  they read.

### Boundary

- No root/floating input special cases.
- No direct `localStorage`/`sessionStorage` access in app composition.
- No UI component reads query params.

### Tests

- Storage adapter removes specified keys before returning the chosen storage.
- Window-name fallback storage also honors `resetKeys`.
- Existing architecture boundary continues to reject direct browser storage
  access from app composition.

## Step 0D.2: Root/Floating Overlap Browser Smoke

### Target

Run a deterministic browser smoke from
`http://127.0.0.1:<port>/?resetWorkspaceLayout=1`.

### Required Evidence

Record structured JSON for each interaction point:

- point coordinates;
- visual expected target;
- `document.elementsFromPoint()[0]`;
- actor input/debug hit line;
- action result;
- screenshot path.

### Smoke Cases

1. Initial default layout contains Scene in root and at least one floating tool
   frame.
2. Drag a floating frame over the root Scene tab/control point.
3. Click the covered root point; the floating frame must receive the event and
   root Scene must remain unchanged.
4. Move the floating frame away.
5. Click the uncovered root Scene tab/control; it must respond on the first
   click.
6. Reopen Scene from Window menu if the test closes it.
7. Verify app console errors are zero.

### Artifacts

- `temp/project-prism-phase-0d-root-overlap-data.json`
- `temp/project-prism-phase-0d-root-overlap-covered.png`
- `temp/project-prism-phase-0d-root-overlap-uncovered.png`
- updated `temp/project-prism-phase-0-interaction-host-report.md`

## Step 0D.3: Validation Gate

Run:

```text
npm run test -w wallpaper-tesseract -- browser-window-workspace-layout-storage architecture-boundaries
npm run test -w wallpaper-tesseract -- floating-window-component workspace-root-dock-frame-component window-frame-tab-chrome
npm run typecheck -w wallpaper-tesseract
npm run build -w wallpaper-tesseract
```

Phase 0D can be marked complete only if both static boundary tests and browser
overlap smoke pass.
