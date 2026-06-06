# Architecture Step 4.2 Browser Smoke

Date: 2026-06-06

Target: `http://127.0.0.1:5175/`

Scope:
- Verify Scene still renders after Camera3 rig/motion/viewport binding moved into components.
- Verify Camera3 overlay controls are present.
- Verify Scene fullscreen expands the canvas to the app viewport and restore returns it to the root dock area.
- Verify console error log is empty.

Result:
- Pass.
- Canvas was present with non-zero CSS and backing size.
- Camera3 overlay text/control evidence was present (`< Persp`, fullscreen control, `Camera3` hierarchy row).
- Scene fullscreen/restore changed canvas rect as expected.
- Browser console errors: `0`.

Artifacts:
- `temp/architecture-step4-2-smoke-data.json`
- `temp/architecture-step4-2-vite.out.log`
- `temp/architecture-step4-2-vite.err.log`

Note:
- Screenshot capture timed out in the in-app browser runtime after data collection. The JSON smoke data was saved before the screenshot attempt and contains the measured DOM/console evidence.
