# Workspace Root Dock Follow-up Smoke

Date: 2026-06-06
URL: http://127.0.0.1:5187/
Viewport: 594 x 698

## Checks

- Root Scene tab close button used absolute positioning and stayed inside its tab rect.
- Dragged Debug Log tab from a floating frame into the exposed root tabbar; root showed Scene + Debug Log tabs.
- Both root tab close buttons stayed inside their tab rects after merge.
- Clicked Debug Log close button in root; Debug Log tab was removed and Hierarchy remained floating.
- Console errors: 0.

## Artifacts

- Data: temp/workspace-root-dock-follow-up-smoke-data.json
- Screenshot: temp/workspace-root-dock-follow-up-smoke.png
