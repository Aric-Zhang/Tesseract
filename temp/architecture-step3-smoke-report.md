# Architecture Simplification Step 3 Smoke

Date: 2026-06-06
URL: http://127.0.0.1:5204/

Scope:
- Verify shared `WindowFrameSurfaceComponent` after root/floating surface extraction.
- Check root and floating tab chrome share `window-frame-tab`.
- Check floating titlebar drag still moves a frame.
- Check App Menu pointer path still opens/focuses a window entry.
- Check Camera3 gizmo drag completes without console errors.

Results:
- Root tab classes: `window-frame-tab workspace-root-dock-frame__tab is-active`.
- Floating tab classes: `window-frame-tab floating-gizmo-window__title floating-gizmo-window__tab is-active`.
- Hierarchy frame moved from `{ left: 14, top: 14 }` to `{ left: 134, top: 74 }`.
- Window menu rows visible after pointer click: Scene, Debug Log Window, Hierarchy Panel.
- Camera3 gizmo drag completed.
- Console error logs: none.

Artifacts:
- `temp/architecture-step3-smoke-data.json`
- `temp/architecture-step3-smoke.png`
- `temp/architecture-step3-vite.out.log`
- `temp/architecture-step3-vite.err.log`

