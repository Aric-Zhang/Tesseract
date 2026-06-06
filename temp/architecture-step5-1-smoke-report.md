# Architecture Step 5.1 Smoke Report

Date: 2026-06-06

Scope:
- Verify that extracting the window workspace installer from `create-wallpaper-app.ts` still boots the default workspace.
- Verify initial root Scene, Debug, Hierarchy, App Menu, Camera3 overlay, and hierarchy tree text are present.

Target:
- `http://127.0.0.1:5177/`

Result:
- Scene canvas present and nonzero: `593.6 x 640.8`, backing `741 x 800`.
- Camera3 overlay present.
- Window menu button present.
- Debug Log present.
- Hierarchy present.
- Hierarchy tree includes `Scene View`.
- Console errors: `0`.

Artifacts:
- `temp/architecture-step5-1-smoke-data.json`
- `temp/architecture-step5-1-vite.out.log`
- `temp/architecture-step5-1-vite.err.log`
