# Architecture Step 4.5 Smoke Report

Date: 2026-06-06

Scope:
- Verify that removing the Scene Camera3 legacy runtime registration does not break initial Scene rendering.
- Verify that the Scene canvas, Camera3 overlay, fullscreen button, Window menu entry point, and hierarchy text are present.

Target:
- `http://127.0.0.1:5176/`

Result:
- Scene canvas present and nonzero: `593.6 x 640.8`, backing `742 x 801`.
- Camera3 overlay present.
- Scene fullscreen button present with label `Expand Scene to fullscreen`.
- Window menu button present.
- Hierarchy text includes `Scene View`.
- Console errors: `0`.

Caveat:
- The in-app browser screenshot/CDP interaction path timed out during this run, so this is a read-only smoke. Full pointer interaction smoke should be rerun in the next UI/input step.

Artifacts:
- `temp/architecture-step4-5-smoke-data.json`
- `temp/architecture-step4-5-vite.out.log`
- `temp/architecture-step4-5-vite.err.log`
