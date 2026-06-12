# Project Prism Phase 6 Entry Smoke Report

Date: 2026-06-12
URL: http://127.0.0.1:5173/?resetWorkspaceLayout=1
Console errors: 0

This evidence combines browser-observed DOM/canvas/mobile state with the current implementation's stable graph/content identity conventions. No product debug API was added.
The browser observations were collected with real Playwright mouse/pointer input against the Vite app; menu commands and tab actions were not triggered through DOM `.click()` shortcuts.

## Browser Observations

- Desktop title: Four Camera Tesseract
- Desktop canvas count: 2
- Root frame count: 1
- Tab count: 3
- Mobile canvas count: 2
- Mobile root frame rect: {"height":816,"width":390.3999938964844,"x":0,"y":28}
- Playwright scenario observations: all recorded scenarios passed with zero console errors.
- Window menu evidence: Debug, Hierarchy, Inspector, and a second Inspector were opened/focused through actor-input menu clicks.
- Root tab close/reopen evidence: Hierarchy was first closed because it overlaps the root Scene tab close in the reset layout; Scene close then routed through `window-tab-action` and reopening through the Window menu restored the Scene canvas.
- Fullscreen evidence: Scene canvas expanded to 1280x720, then restored to 1280x663.
- Splitter evidence: root side-dock probes for left, right, and top produced split previews and measurable splitter DOM; console errors stayed at 0.
- Mobile evidence: 390x844 viewport kept the Window button, Scene tab close, fullscreen button, Scene canvas, and Camera3 gizmo measurable.

## Evidence Files

- temp/project-prism-phase-6-entry-smoke-data.json
- temp/project-prism-phase-6-entry-browser-observations.json
- temp/project-prism-phase-6-entry-splitter-probe.json
- temp/project-prism-phase-6-entry-boot-baseline.png
- temp/project-prism-phase-6-entry-window-menu-open-focus.png
- temp/project-prism-phase-6-entry-root-tab-close-reopen.png
- temp/project-prism-phase-6-entry-dock-mutation-5b-5c.png
- temp/project-prism-phase-6-entry-splitter-resize.png
- temp/project-prism-phase-6-entry-scene-fullscreen-restore.png
- temp/project-prism-phase-6-entry-persistence-reload.png
- temp/project-prism-phase-6-entry-mobile-viewport.png
- temp/project-prism-phase-6-entry-render-input-sanity.png
