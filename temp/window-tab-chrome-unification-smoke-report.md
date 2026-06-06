# Window Tab Chrome Unification Smoke Report

Date: 2026-06-06T10:06:33.206Z
URL: http://127.0.0.1:5195/

## Scenario

1. Load the app with the current persisted docking layout.
2. Verify window tabs use the shared `window-frame-tab` chrome class.
3. Drag a floating dock frame from titlebar empty space.
4. Close the Scene-containing frame once.
5. Reopen Scene from the Window menu.

## Assertions

- Shared generic tab class is present: PASS
- Floating frame drag moved the frame: PASS
- Drag log has no buttons-zero fallback ignore: PASS
- One close click removed Scene frame: PASS
- Window menu restored Scene frame: PASS
- Console errors: 0

## Notes

The current browser profile had a persisted layout with Scene/Hierarchy in a floating dock frame and an empty workspace root, so the visual root-tab default state was covered by unit/CSS class assertions rather than this persisted-profile screenshot.

## Artifacts

- window-tab-chrome-unification-smoke.png
- window-tab-chrome-unification-smoke-data.json