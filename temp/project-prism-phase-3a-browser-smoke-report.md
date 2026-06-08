# Project Prism Phase 3A Browser Smoke

Status: passed.

URL:

```text
http://127.0.0.1:5183/?resetWorkspaceLayout=1&phase3aSmoke=1
```

The requested dev-server port was `5177`; ports `5177` through `5182` were
occupied, so Vite selected `5183`.

## Covered Paths

- Initial app load with root Scene, Debug, and Hierarchy visible.
- Window menu open and `Debug Log Window` focus-to-front.
- Floating Debug window titlebar drag.
- Floating Debug resize through the visible bottom-right edge.
- Debug tab close and Window menu restore.
- Scene fullscreen and restore.
- Reload without `resetWorkspaceLayout=1`, verifying persisted window state
  still hydrates.

## Results

- Console errors: `0`.
- Scene canvas rect stayed non-zero before fullscreen, during fullscreen, after
  restore, and after reload.
- Tool windows hid while Scene was fullscreen and restored after exiting
  fullscreen.
- Window menu still listed Scene, Debug, Hierarchy, Inspector, and New
  Inspector after reload.

## Artifacts

- Data: `temp/project-prism-phase-3a-browser-smoke-data.json`
- Screenshot: `temp/project-prism-phase-3a-browser-smoke.png`

## Notes

This smoke specifically exercises the Phase 3A changes:

- scene-backed floating-window state adapter moved out of `window-runtime`;
- UI scheduler services registered through the app adapter;
- generic app menu and workspace feature code no longer depend on
  `scene-runtime` state paths directly;
- component definition installation is no longer centralized in app root.
