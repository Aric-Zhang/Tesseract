# Window Step 7 Docking UX Smoke Report

Date: 2026-06-06

URL: http://127.0.0.1:5201/

## Result

Pass with browser automation limitation noted.

## Browser Checks

- App loaded with 3 floating frames: Scene, Debug Log, Hierarchy.
- Scene canvas and overlay both had non-zero matching rects.
- `.window-dock-preview` existed, was `position: fixed`, `pointer-events: none`, and z-index `9998`.
- Updated preview CSS rules for merge, split, direction accents, and floating dashed preview were loaded.
- Screenshot saved: `temp/window-step7-docking-ux-smoke.png`.
- Data saved: `temp/window-step7-docking-ux-smoke-data.json`.

## Interaction Coverage

The in-app browser evaluate context in this run allowed DOM reads but rejected native DOM event constructors and property mutation, so synthetic drag preview sampling was not reliable from browser automation.

The interaction path is covered by unit tests run in this step:

- `window-dock-targets.test.ts`
  - merge tab target;
  - split left/right/top/bottom;
  - content center floating;
  - source-frame self-drop floating;
  - highest stack priority and concrete split-pane target selection.
- `window-tab-drag-session.test.ts`
  - drag threshold;
  - preview clearing on end/cancel.
- `window-dock-preview-component.test.ts`
  - preview classes, data attributes, rect application, clear behavior.
- `floating-window-component.test.ts`
  - titlebar empty drag moves frame;
  - tab drag does not move frame;
  - titlebar empty drag does not start dock preview;
  - merge/split/floating dock intent submission.

## Console

No console error sampling hook was available through this read-only browser path. The page loaded successfully and all targeted unit/type checks passed.
