# Window Docking Fullscreen Bugfix Smoke Report

Date: 2026-06-06
URL: http://127.0.0.1:5196/

## Results

- Scene + Debug mixed in the Scene frame, then Scene fullscreen: source mixed frame became hidden while the runtime-only fullscreen Scene frame stayed visible.
- Scene restore returned the original mixed tabs to the Scene frame.
- Split frame with Scene and Hierarchy panes accepted Debug dragged into the second/Hierarchy pane tabbar.
- Console errors: 0.

## Artifacts

- temp/window-docking-fullscreen-bugfix-smoke-data.json
- temp/window-docking-fullscreen-bugfix-smoke.png
- temp/window-docking-fullscreen-bugfix-smoke-server.json
