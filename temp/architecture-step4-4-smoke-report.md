# Architecture Step 4.4 Browser Smoke

Date: 2026-06-06

Target: `http://127.0.0.1:5175/`

Scope:
- Verify Scene still loads after removing production `SceneViewRuntime`.
- Verify Scene canvas and Camera3 overlay evidence are present.
- Verify hierarchy still includes Workspace Root, Scene View, Tesseract4, and Camera3.
- Verify Scene fullscreen expands the canvas to the app viewport and restore returns it to the root dock area.
- Verify console error log is empty.

Result:
- Pass.
- Canvas was present with non-zero CSS and backing size.
- Camera3 overlay evidence was present (`< Persp`).
- Actor tree text included Workspace Root, Scene View, Tesseract4, and Camera3.
- Scene fullscreen/restore changed canvas rect as expected.
- Browser console errors: `0`.

Artifacts:
- `temp/architecture-step4-4-smoke-data.json`
- `temp/architecture-step4-4-vite.out.log`
- `temp/architecture-step4-4-vite.err.log`
