# Window Step 8.6 Playwright Pointer Smoke Report

Date: 2026-06-06

## Scope

This smoke test verifies the real pointer path for the Step 7/8 docking UX after
Computer Use could not continue the browser session. It uses Playwright
`page.mouse` events against the local Vite app.

## Environment

- URL: `http://127.0.0.1:5203/`
- Tool: Playwright Chromium
- Script: `temp/playwright-window-step8-6-pointer-smoke.mjs`
- Data: `temp/window-step8-6-playwright-pointer-smoke-data.json`
- Screenshot: `temp/window-step8-6-playwright-pointer-smoke.png`

## Result

Passed.

## Assertions

- Dragging the Debug tab onto the Scene tab bar produced a `merge-tabs` preview
  targeting `scene-window`, then committed Debug into the Scene frame.
- Dragging the Hierarchy tab into the left Scene content region produced a
  `split` preview with `dockPlacement: "left"`, then committed a split layout.
- Dragging the Debug tab into the Scene content center produced a `floating`
  preview, then floated Debug into an independent frame.
- Dragging the Debug frame empty titlebar area moved the frame by `60 x 35`
  pixels and did not show a dock preview.
- Final Scene canvas rect remained non-zero after split/float:
  `604.5625 x 413`.
- No app console/page errors were recorded. Browser favicon/resource 404 noise
  is ignored by the script because it is not emitted by application code.

## Notes

This smoke now gives a repeatable browser-level substitute for the manual native
drag coverage that was blocked by the Windows Computer Use URL policy check.
