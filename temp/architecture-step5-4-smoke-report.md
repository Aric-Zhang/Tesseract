# Architecture Step 5.4 Smoke Report

Date: 2026-06-06

Scope:
- Verify that moving App Menu actor creation into `features/app-menu` still boots the default workspace.
- Verify the Window menu button, Scene render, Camera3, Debug, Hierarchy, and hierarchy tree text are present.

Target:
- `http://127.0.0.1:5180/`

Result:
- Scene canvas present and nonzero: `593.6 x 640.8`, backing `741 x 800`.
- Camera3 overlay present.
- Window menu button present at `513.6, 10`, size `68 x 26`.
- Debug Log present.
- Hierarchy present.
- Hierarchy tree includes `Scene View`.
- Console errors: `0`.

Artifacts:
- `temp/architecture-step5-4-smoke-data.json`
- `temp/architecture-step5-4-vite.out.log`
- `temp/architecture-step5-4-vite.err.log`
