# Architecture Step 5.2 Smoke Report

Date: 2026-06-06

Scope:
- Verify that moving Scene view factory registration into `features/scene` still boots the default workspace.
- Verify initial Scene render, Camera3 overlay, App Menu, Debug, Hierarchy, and hierarchy tree text are present.

Target:
- `http://127.0.0.1:5178/`

Result:
- Scene canvas present and nonzero: `593.6 x 640.8`, backing `741 x 800`.
- Camera3 overlay present.
- Window menu button present.
- Debug Log present.
- Hierarchy present.
- Hierarchy tree includes `Scene View`.
- Console errors: `0`.

Artifacts:
- `temp/architecture-step5-2-smoke-data.json`
- `temp/architecture-step5-2-vite.out.log`
- `temp/architecture-step5-2-vite.err.log`
