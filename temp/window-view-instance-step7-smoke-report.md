# Window View Instance Step 7 Smoke Report

Date: 2026-06-07

Dev server:

- URL: `http://127.0.0.1:5183/`
- Started from this worktree during Step 7 verification.
- Playwright Chromium was installed with `npx playwright install chromium` because the package existed but the browser binary was missing.

Scope:

- Verify the lightweight Inspector multi-instance pilot.
- Verify Window menu type action / new-instance action.
- Verify v2 layout persistence stores logical instance identity, not runtime actor ids.
- Verify reload restores both Inspector instances.

Result: PASS

Actions:

1. Cleared `wallpaper-tesseract.windowWorkspaceFrameLayout.v1` from browser `localStorage`.
2. Reloaded the app.
3. Opened `Window > Inspector` through real pointer input.
4. Opened `Window > New Inspector` through real pointer input.
5. Waited for persistence.
6. Reloaded the page.
7. Reopened the Window menu and sampled DOM/state.

Observed before reload:

- Inspector contents: `Inspector 1`, `Inspector 2`.
- Persisted layout version: `2`.
- Persisted view identities:
  - `{ typeKey: "scene", instanceId: "scene:default", singleton: true }`
  - `{ typeKey: "debug", instanceId: "debug:default", singleton: true }`
  - `{ typeKey: "hierarchy", instanceId: "hierarchy:default", singleton: true }`
  - `{ typeKey: "inspector", instanceId: "inspector:a" }`
  - `{ typeKey: "inspector", instanceId: "inspector:b" }`
- Persisted tab ids used instance ids: `scene:default`, `debug:default`, `hierarchy:default`, `inspector:a`, `inspector:b`.
- Persisted payload did not contain `viewActorId` or `frameActorId`.

Observed after reload:

- Inspector contents restored: `Inspector 1`, `Inspector 2`.
- Scene canvas rect: `1280 x 743`.
- Window menu Inspector representative:
  - `typeKey`: `inspector`
  - `viewKey`: `inspector:b`
  - `actorId`: `inspector-b-view`
  - `action`: `open-or-focus-type`
  - `live`: `true`
- `New Inspector` row remained available with `action: new-instance`.
- Browser `console.error` / `pageerror`: `0`.

Notes:

- The Codex in-app browser environment does not expose Web Storage, `window.name`, writable cookie, or writable hash APIs. The app now resolves storage through `createBrowserWindowWorkspaceFrameLayoutStorage()`, which keeps the storage choice behind the existing `WindowWorkspaceFrameLayoutStorage` port. The actual reload persistence smoke was therefore run with Playwright Chromium, where Web Storage is available.
