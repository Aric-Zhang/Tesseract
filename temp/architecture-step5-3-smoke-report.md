# Architecture Step 5.3 Smoke Report

Date: 2026-06-06

Scope:
- Verify that moving Debug/Hierarchy view factory registration into `features/tool-windows` still boots the default workspace.
- Verify Scene, Camera3, Debug, Hierarchy, App Menu, and hierarchy tree text are present.

Target:
- `http://127.0.0.1:5179/`

Result:
- Scene canvas present and nonzero: `593.6 x 640.8`, backing `741 x 800`.
- Camera3 overlay present.
- Window menu button present.
- Debug Log present.
- Hierarchy present.
- Hierarchy tree includes `Scene View`.
- Console errors: `0`.

Note:
- `Debug Log Window View` and `Hierarchy Panel View` remain visible in the Hierarchy actor tree. That is expected actor-tree text, not Window menu labeling.

Artifacts:
- `temp/architecture-step5-3-smoke-data.json`
- `temp/architecture-step5-3-vite.out.log`
- `temp/architecture-step5-3-vite.err.log`
