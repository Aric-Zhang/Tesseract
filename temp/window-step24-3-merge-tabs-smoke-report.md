# Step24.3 Merge Tabs Smoke

Date: 2026-06-05

Dev server:

- URL: `http://127.0.0.1:5187/`
- PID: `35060`
- Logs:
  - `temp/window-step24-3-vite-5187.out.log`
  - `temp/window-step24-3-vite-5187.err.log`

Action:

- Dragged the `Debug Log` tab from its source frame to the `Hierarchy` frame tab area.

Result:

- Before drag: 3 frames: `Scene`, `Debug Log`, `Hierarchy`.
- After drag: 2 frames: `Scene`, and a merged frame containing tabs `Hierarchy` and `Debug Log`.
- The merged `Debug Log` tab became active.
- The source `Debug Log` frame disappeared.
- Window menu still listed separate view entries for `scene`, `debug`, and `hierarchy`.
- Console errors: `0`.

Observed coordinates:

```json
{
  "start": { "x": 99.80000114440918, "y": 459.3999938964844 },
  "end": { "x": 99.80000114440918, "y": 29.399999618530273 }
}
```

Observed after state:

```json
{
  "windowCount": 2,
  "windows": [
    {
      "title": "Scene",
      "tabs": ["Scene"],
      "zIndex": "2000"
    },
    {
      "title": "Debug Log",
      "tabs": ["Hierarchy", "Debug Log"],
      "activeTab": "Debug Log",
      "zIndex": "2001"
    }
  ],
  "menuRows": [
    { "viewKey": "scene", "text": "Scene", "actorId": "scene-window" },
    { "viewKey": "debug", "text": "Debug Log Window", "actorId": "debug-log-window" },
    { "viewKey": "hierarchy", "text": "Hierarchy Panel", "actorId": "hierarchy-panel" }
  ],
  "sceneViewportCount": 1,
  "canvasCount": 2,
  "errorLogs": []
}
```
