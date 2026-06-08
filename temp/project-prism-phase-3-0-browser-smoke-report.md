# Project Prism Phase 3.0 Browser Smoke Report

Status: passed

URL: http://127.0.0.1:5175/?resetWorkspaceLayout=1
Dev server PID: 45244
Console errors: 0

## Covered Scenarios

- Moved the floating Hierarchy frame away from the root tabbar to avoid visual overlap during pointer sampling.
- Dragged Debug Log from its floating frame into the root dock frame left edge.
- Dragged Debug Log inside the root frame to the opposite edge as a same-frame split/reorder operation.
- Dragged Debug Log from the root frame into the floating Hierarchy tabbar.
- Dragged Debug Log inside that floating frame to the bottom edge as a same-frame split operation.

## Evidence

- Root and floating tabs stayed visible after the operations.
- The final floating frame contained two pane tab regions after the same-frame bottom split.
- Scene remained visible in the root dock frame.
- Browser console errors were 0.
- Screenshot: `temp/project-prism-phase-3-0-browser-smoke.png`
- Data: `temp/project-prism-phase-3-0-browser-smoke-data.json`

## Caveats

- The in-app browser evaluate scope is read-only/non-extensible in this run, so the Project Prism actor-input global capture hook could not be installed.
- The same evaluate scope did not expose `localStorage`; persisted layout actor-id leak protection is covered by `window-workspace-layout-persistence` unit tests in this run.
