# Window Persistence Gap Smoke Report

Date: 2026-06-07

Dev server:

- URL: `http://127.0.0.1:5184/`
- PID: `41340`

Scope:

- Step 2 of `temp/window-docking-remaining-work-plan.md`.
- Corrupted storage boot behavior.
- Valid v2 split layout restore behavior.

Result: PASS

Storage Strategy Observed

| Case | Observed behavior |
| --- | --- |
| Bad JSON in storage | Boot ignores bad JSON, opens default layout, then the persistence controller overwrites the key with a valid v2 snapshot. |
| Valid v2 split layout | Hydrates Scene and Debug into the persisted root split layout. |
| Runtime actor ids | Persisted payload uses `typeKey` / `instanceId`; no `viewActorId` or `frameActorId` is required. |

Bad JSON Boot

- Injected raw storage value: `{ nope`.
- App booted without page errors.
- Menu button present.
- Scene canvas present.
- After the first persistence tick, storage was replaced with a valid v2 layout containing:
  - `scene:default`
  - `debug:default`
  - `hierarchy:default`
- `hiddenViewKeys`: `[]`.

Valid V2 Split Restore

Injected layout:

- `workspace-root-frame`
- Split id: `persisted-root-split`
- Direction: `horizontal`
- Ratio: `0.42`
- Left tabset: `scene:default`
- Right tabset: `debug:default`

Observed after reload:

- Root frame rect: `1180 x 732`.
- Root text included `Scene` and `Debug Log`.
- Scene canvas rect: `493.5 x 675`.
- Debug content present.
- `hiddenViewKeys`: `[]`.
- Browser `console.error` / `pageerror`: `0`.

Verification commands already run for this area:

```text
npm run test -w wallpaper-tesseract -- browser-window-workspace-layout-storage window-workspace-layout-persistence window-workspace-layout-persistence-controller window-frame-lifecycle-controller install-window-workspace-feature architecture-boundaries
npm run test -w wallpaper-tesseract
npm run typecheck -w wallpaper-tesseract
npm run build -w wallpaper-tesseract
```
