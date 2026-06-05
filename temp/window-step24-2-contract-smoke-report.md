# Step24.2 Window Frame Contract Smoke

Date: 2026-06-05

Dev server:

- URL: `http://127.0.0.1:5186/`
- PID: `41520`
- Logs:
  - `temp/window-step24-2-vite-5186.out.log`
  - `temp/window-step24-2-vite-5186.err.log`

Checks:

- App starts without console errors.
- Three window frames are present: Scene, Debug Log, Hierarchy.
- Each frame renders a single active tab.
- Window menu rows are listed by view key, not collapsed by frame: `scene`, `debug`, `hierarchy`.
- Scene viewport exists after the `WindowMenuViewSource` / `DockTargetFrameSource` source split.

Observed data:

```json
{
  "appMenuVisible": true,
  "canvasCount": 2,
  "dockPreviewCount": 1,
  "menuRows": [
    {
      "actorId": "scene-window",
      "checked": null,
      "disabled": "false",
      "text": "Scene",
      "viewKey": "scene"
    },
    {
      "actorId": "debug-log-window",
      "checked": null,
      "disabled": "false",
      "text": "Debug Log Window",
      "viewKey": "debug"
    },
    {
      "actorId": "hierarchy-panel",
      "checked": null,
      "disabled": "false",
      "text": "Hierarchy Panel",
      "viewKey": "hierarchy"
    }
  ],
  "sceneViewportCount": 1,
  "url": "http://127.0.0.1:5186/",
  "windowCount": 3,
  "windows": [
    {
      "hidden": false,
      "tabs": [{ "text": "Scene" }],
      "title": "Scene",
      "zIndex": "2000"
    },
    {
      "hidden": false,
      "tabs": [{ "text": "Debug Log" }],
      "title": "Debug Log",
      "zIndex": "2001"
    },
    {
      "hidden": false,
      "tabs": [{ "text": "Hierarchy" }],
      "title": "Hierarchy",
      "zIndex": "2002"
    }
  ],
  "errorLogs": []
}
```
