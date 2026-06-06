# Architecture Step 4.1 Browser Smoke

Date: 2026-06-06

Target: `http://127.0.0.1:5175/`

Scope:
- Verify the app still loads through the narrowed `RenderableSceneView` render entry.
- Verify Scene canvas is present and sized.
- Verify Window menu can open and list Scene / Debug Log Window / Hierarchy Panel.
- Verify Scene fullscreen expands the canvas to the app viewport and restore returns it to the root dock area.
- Verify console error log is empty.

Result:
- Pass.
- Canvas was present with non-zero CSS and backing size.
- Scene fullscreen/restore worked after the menu was not blocking the control.
- Browser console errors: `0`.

Artifacts:
- `temp/architecture-step4-smoke-data.json`
- `temp/architecture-step4-smoke.png`
- `temp/architecture-step4-vite.out.log`
- `temp/architecture-step4-vite.err.log`
