# Window Tab Close Persistence Smoke Report

Date: 2026-06-06

URL: `http://127.0.0.1:5211/`

Dev server PID: `1644`

Artifacts:

- Data: `temp/window-tab-close-persistence-smoke-data.json`
- Screenshot: `temp/window-tab-close-persistence-smoke.png`
- Script: `temp/playwright-window-tab-close-persistence-smoke.mjs`

Result: PASS

Validated:

- Closing `Debug Log` from a mixed Scene frame removes `debug` from persisted `views`.
- Reload after closing `Debug Log` does not recreate it automatically.
- Window menu restores `Debug Log` as a fresh view.
- Scene fullscreen isolation does not persist the runtime-only `floating-scene-view` frame.
- Closing `Scene` from a mixed frame removes `scene` from persisted `views`.
- Reload after closing `Scene` does not recreate it automatically.
- Window menu restores `Scene`, including a visible canvas.
- `hiddenViewKeys` stayed empty for tab-close persistence.
- Console/page error count: `0`.

Observed persisted view keys:

| Step | Persisted views | hiddenViewKeys |
| --- | --- | --- |
| initial | `scene`, `debug`, `hierarchy` | empty |
| close-debug-tab | `scene`, `hierarchy` | empty |
| reload-after-debug-close | `scene`, `hierarchy` | empty |
| restore-debug | `scene`, `hierarchy`, `debug` | empty |
| scene-fullscreen-persisted | `scene`, `hierarchy`, `debug` | empty |
| close-scene-tab | `hierarchy`, `debug` | empty |
| reload-after-scene-close | `hierarchy`, `debug` | empty |
| restore-scene | `hierarchy`, `debug`, `scene` | empty |
