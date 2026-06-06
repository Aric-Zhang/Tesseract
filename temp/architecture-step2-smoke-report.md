# Architecture Simplification Step 2 Smoke

Date: 2026-06-06

Target: `http://127.0.0.1:5202/`

Artifacts:

- `temp/architecture-step2-smoke-data.json`
- `temp/architecture-step2-smoke.png`
- `temp/architecture-step2-vite.out.log`
- `temp/architecture-step2-vite.err.log`

Checks:

- App starts with Scene live in the root dock frame.
- Scene canvas is non-zero size: `1280 x 743`.
- Window menu opens through pointer/actor input.
- Window menu rows are catalog-backed and live: `Scene`, `Debug Log Window`, `Hierarchy Panel`.
- Clicking `Window > Debug` through pointer input keeps Debug available and focused without recreating root Scene.
- Floating window count after the check is `2` (`Debug Log`, `Hierarchy`); root Scene remains in the root dock frame.
- Vite dev server started on port `5202` and was stopped after smoke.

Console:

- Ignored resource noise: `Failed to load resource: the server responded with a status of 404 (Not Found)`, from browser favicon lookup.
- No app runtime exception or page error was observed.
