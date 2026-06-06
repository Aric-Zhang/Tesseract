# Workspace Presentation Session Smoke Report

Date: 2026-06-06T09:08:40.546Z
URL: http://127.0.0.1:5194/

## Scenario

1. Load the app with Scene in the workspace root and Debug/Hierarchy as independent floating frames.
2. Click the Scene fullscreen/run button.
3. Verify the Scene is presented through one runtime-only fullscreen frame while the root, Debug, and Hierarchy frames are suppressed.
4. Click the Scene restore button.
5. Verify root Scene, Debug, and Hierarchy return without console errors.

## Assertions

- Fullscreen has one visible Scene runtime frame: PASS
- Fullscreen hides Debug and Hierarchy: PASS
- Fullscreen suppresses workspace root frame: PASS
- Fullscreen canvas fills viewport: PASS
- Restore shows root and tool frames: PASS
- Restore removes fullscreen runtime frame: PASS
- Console errors: 0

## Artifacts

- workspace-presentation-session-fullscreen.png
- workspace-presentation-session-restored.png
- workspace-presentation-session-smoke-data.json