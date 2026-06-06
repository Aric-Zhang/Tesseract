# Workspace Root Dock Smoke Report

Date: 2026-06-06
URL: http://127.0.0.1:5176/
Dev server PID candidates: 34944, 40892

## Result

PASS with automated checks.

## Verified

- App shell menu row is stable and root dock fills the central area.
- Scene opens as a root workspace tab and canvas has non-zero size.
- Camera3 overlay remains visible in the Scene viewport.
- Scene fullscreen expands into a runtime-only floating fullscreen frame.
- Scene restore returns content to the root workspace tab.
- Window menu opens above root/floating layers and lists Scene, Debug, Hierarchy.
- Console error count: 0.

## Artifacts

- Screenshot: temp/workspace-root-dock-smoke.png
- Data: temp/workspace-root-dock-smoke-data.json
