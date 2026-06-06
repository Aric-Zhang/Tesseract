# Architecture Simplification Step 0 Baseline

Date: 2026-06-06

This baseline freezes the current state before starting `architecture-simplification-refactor-plan.md`.
It is not a promise to preserve transitional compatibility; it is a reference point for detecting what later cleanup steps break.

## Dirty Scope

The worktree is already broadly dirty before Step 1. Major modified areas:

- `apps/wallpaper-tesseract/src/app`
- `apps/wallpaper-tesseract/src/features/app-menu`
- `apps/wallpaper-tesseract/src/features/scene`
- `apps/wallpaper-tesseract/src/debug`
- `apps/wallpaper-tesseract/src/hierarchy`
- `apps/wallpaper-tesseract/src/window-runtime`
- `packages/gizmo-core`
- `temp/`

There are also untracked architecture/window/root dock files and many temp smoke artifacts.
Do not revert unrelated dirty files during the refactor.

## Required Checks

- `npm run test -w wallpaper-tesseract`
  - Passed: 67 files / 601 tests.
- `npm run typecheck -w wallpaper-tesseract`
  - Passed.
- `npm run build -w wallpaper-tesseract`
  - Passed.
  - Existing Vite warning: `assets/index.js` exceeds 500 kB.

## Browser Smoke

Dev server:

- URL: `http://127.0.0.1:5201/`
- Logs:
  - `temp/architecture-baseline-vite.out.log`
  - `temp/architecture-baseline-vite.err.log`

Artifacts:

- `temp/architecture-baseline-smoke-data.json`
- `temp/architecture-baseline-smoke.png`

Observed:

- Page loaded at `http://127.0.0.1:5201/`.
- Title: `Four Camera Tesseract`.
- Scene canvas exists and has non-zero rect: `402 x 401`.
- Window menu button is visible.
- Window menu opens.
- Menu shows live entries for Scene, Debug Log Window, and Hierarchy Panel.
- Debug/Hierarchy/Scene text appears in the body.
- Console error count: 0.

Known baseline limitation:

- This Step 0 smoke records app availability and menu/live view state.
- It does not yet provide a precise automated mid-drag dock preview sample.
  That should become a required browser smoke once Step 3 extracts the shared `WindowFrameSurfaceComponent`.
