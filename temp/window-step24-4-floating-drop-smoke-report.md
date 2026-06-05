# Step24.4 Floating Drop Smoke

Date: 2026-06-05

Dev server:

- URL: `http://127.0.0.1:5188/`
- PID: `12304`
- Logs:
  - `temp/window-step24-4-vite-5188.out.log`
  - `temp/window-step24-4-vite-5188.err.log`

Actions:

1. Dragged `Debug Log` tab to the `Hierarchy` tab area.
2. Dragged merged `Debug Log` tab out to empty space.

Result:

- Initial state: 3 frames: `Scene`, `Debug Log`, `Hierarchy`.
- After merge: 2 frames; `Hierarchy` frame contained tabs `Hierarchy` and `Debug Log`.
- After floating drop: 3 frames again; `Hierarchy` frame contains only `Hierarchy`, and a new independent `Debug Log` frame exists at the floating preview location.
- Window menu still lists separate view entries for `scene`, `debug`, and `hierarchy`.
- Scene viewport remains present.
- Console errors: `0`.

Observed coordinates:

```json
{
  "merge": {
    "start": { "x": 99.80000114440918, "y": 459.3999938964844 },
    "end": { "x": 99.80000114440918, "y": 29.399999618530273 }
  },
  "floating": {
    "start": { "x": 205.6437530517578, "y": 29.399999618530273 },
    "end": { "x": 574, "y": 184 }
  }
}
```

Observed after state:

```json
{
  "windowCount": 3,
  "windows": [
    {
      "title": "Scene",
      "tabs": ["Scene"],
      "zIndex": "2000"
    },
    {
      "title": "Hierarchy",
      "tabs": ["Hierarchy"],
      "zIndex": "2001"
    },
    {
      "title": "Debug Log",
      "tabs": ["Debug Log"],
      "rect": { "left": 444, "top": 166, "width": 300, "height": 180 },
      "zIndex": "2002"
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
