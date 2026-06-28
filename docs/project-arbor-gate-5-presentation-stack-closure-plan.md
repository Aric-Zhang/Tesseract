# Project Arbor Gate 5A: Presentation Stack Closure

Status: completed
Created: 2026-06-28
Parent gate: `docs/project-arbor-gate-5-render-viewport-scene-migration-plan.md`

Completion: Gate 5A completed on 2026-06-28. Fresh Gate 5 smoke evidence at
`temp/project-arbor-gate-5-smoke-data.json` now records
`fullscreen.coversTopDockedMenu: true` and
`fullscreen.blocksTopDockedMenuInput: true`; the smoke contract validates that
fullscreen z-index is above top-docked chrome z-index and that the former Window
menu point is inside the fullscreen Scene visual stack.

This plan closes the Gate 5 presentation-stack defect discovered after the
Scene migration: a fullscreen Scene view visually covers the viewport, but the
global Window menu remains above it. The fix must be structural. Do not hide
the menu during fullscreen, do not add a Scene-specific z-index patch, and do
not preserve the current app-menu hardcoded overlay path as a compatibility
layer.

## Gate 5 Current Progress

Gate 5 implementation work is otherwise complete:

- Generic `RenderViewportComponent` and `FullscreenableViewComponent` exist in
  `packages/ui-framework/src/ui/viewport/**`.
- The real Scene tab has been migrated to an Arbor actor subtree:

```text
Scene View Actor
  UiElementComponent
  UiLayoutHostComponent
  Scene View Content registration component

  World Render View Actor
    UiElementComponent
    UiLayoutItemComponent(slot: fill)
    RenderViewportComponent
    FullscreenableViewComponent

  Camera3 Gizmo Actor
    UiElementComponent
    UiLayoutItemComponent(slot: overlay)
    Camera3GizmoComponent
```

- The old `SceneViewportComponent`, `SceneModeToggle`, `editor-scene-view-host`,
  raw Camera3 DOM parent channel, and old Scene overlay/canvas/fullscreen
  selectors have been deleted rather than retained as compatibility paths.
- The Scene render target is explicitly borrowed from `wallpaper-runtime`.
  Generic viewport code does not import or implement window content
  registration.
- The earlier fullscreen browser-resize defect has been fixed by deleting
  parent-rect pixel freezing from `FloatingWindowComponent`; fullscreen sizing
  is now CSS-owned. Fresh Gate 5 smoke evidence at
  `temp/project-arbor-gate-5-smoke-data.json` records:
  - `fullscreen.resizeFollowsViewport: true`
  - `fullscreen.restoreControlVisibleAfterResize: true`
  - Scene root, World Render View, render viewport, and canvas all resize to
    `390x844` in the fullscreen resize smoke.

Current Gate 5 blocker:

- Fullscreen Scene does not cover the top Window menu.
- Browser probe evidence:
  - `.floating-gizmo-window--fullscreen` rect is the full viewport.
  - `.floating-gizmo-window--fullscreen` computed z-index is currently the
    Scene base/effective priority, observed as `900`.
  - `.app-shell__menu` has `z-index: 10000`.
  - `document.elementsFromPoint(Window menu center)` returns
    `.ui-menu-bar-item` above the fullscreen Scene.
- App Menu actor/DOM hierarchy is not the root problem:
  - `.ui-menu-bar > .ui-menu-bar-item` exists.
  - `.ui-menu-bar-item > .ui-popup-menu` exists.
  - `install-app-menu-feature.ts` creates
    `App Menu Host -> MenuBar -> Window item -> Popup`.

Root cause:

- The App Menu is currently an app-shell chrome layer with its own hardcoded DOM
  z-index and actor-input priority.
- Fullscreen floating frames are excluded from dense window stack management and
  fall back to base priority.
- Therefore both visual stacking and actor-input routing can keep the top menu
  above fullscreen Scene.

## Target Rule

The menu bar is a top-docked chrome participant with window-like presentation
status:

```text
fullscreen presentation layer
  > top-docked chrome layer, including the global menu bar
  > floating/window layer
  > root dock workspace
```

The menu bar remains always docked at the top in ordinary windowed mode, but it
must be lower than fullscreen presentation. Visual z-index and actor-input
stack priority must come from the same presentation stack constants.

## Non-Negotiables

- No Scene-specific z-index or pointer-events patch.
- No "hide app menu while fullscreen" behavior.
- No separate visual-only fix that leaves actor-input hitting the menu.
- No generic menu hardcoded stack priority. The existing generic menu
  `scopeRoutePriority: actorInputScopeRoutePriority.appOverlay` is a generic
  actor-overlay route hint, not the cross-frame stack owner. It may remain only
  if fullscreen's higher stack priority prevents menu hits. If smoke proves the
  menu still wins input while visually covered, do not patch app-menu; make the
  generic menu route priority an explicit component option or fix actor-input
  ordering semantics at the owning layer.
- No `app-shell__menu { z-index: 10000; }` hardcoded layer.
- No app-local `APP_MENU_STACK_PRIORITY = actorInputScopeRoutePriority...`
  special case.
- Do not move product menu facts into `ui-framework/src/ui/menu/**`.
- Do not add a compatibility alias for old menu priority or old shell z-index.
- If a new constant is required, it must represent presentation ownership and
  be used by both the window stack owner and the top-docked menu integration.

## Step 0: Entry Audit

Before editing, verify the current facts:

```powershell
rg -n "z-index:\s*10000|APP_MENU_STACK_PRIORITY|actorInputScopeRoutePriority" `
  apps/wallpaper-tesseract/src/app `
  apps/wallpaper-tesseract/src/features/app-menu `
  apps/wallpaper-tesseract/src/window-runtime `
  packages/ui-framework/src/services

rg -n "presentation === \"fullscreen\"|WINDOW_FLOATING_FOCUS_LAYER|setStackPriority" `
  packages/ui-framework/src/services `
  apps/wallpaper-tesseract/src/window-runtime
```

Expected entry findings:

- `app-shell.css` still owns a `z-index: 10000` menu/toolbar/status layer.
- `install-app-menu-feature.ts` still derives menu stack priority from
  `actorInputScopeRoutePriority.appOverlay * 3`.
- `WindowWorkspaceController` still excludes fullscreen frames from dense
  window stack and sends non-eligible frames back to base stack priority.

Stop only if the current implementation has already removed these facts and
the blocker is caused by a different owner.

## Step 1: Define One Presentation Stack Contract

Create a tiny independent presentation-stack fact source:

```text
packages/ui-framework/src/services/window-presentation-stack.ts
```

Do not keep these constants as implementation details in
`window-workspace-controller.ts`. They are now shared by
`WindowWorkspaceController`, app shell visual stacking, and app-menu actor-input
stack injection; a small standalone file keeps `WindowWorkspaceController` from
becoming a convenience barrel.

Required ordering:

```text
WINDOW_FLOATING_FOCUS_LAYER_START
WINDOW_FLOATING_FOCUS_LAYER_END
WINDOW_TOP_DOCKED_CHROME_LAYER
WINDOW_FULLSCREEN_PRESENTATION_LAYER
```

Rules:

- `WINDOW_TOP_DOCKED_CHROME_LAYER` must be greater than the highest ordinary
  floating/window focus layer.
- `WINDOW_FULLSCREEN_PRESENTATION_LAYER` must be greater than
  `WINDOW_TOP_DOCKED_CHROME_LAYER`.
- Do not expose product-specific names such as `APP_MENU_LAYER`.
- Do not put these constants in generic menu components.
- Export the constants through the existing `ui-framework` public surface only
  if production app code needs the package import. Do not create an app-local
  duplicate or re-export alias.

Required shape:

```ts
export const WINDOW_FLOATING_FOCUS_LAYER_START = 2_000;
export const WINDOW_FLOATING_FOCUS_LAYER_END = 9_999;
export const WINDOW_TOP_DOCKED_CHROME_LAYER = 10_000;
export const WINDOW_FULLSCREEN_PRESENTATION_LAYER = 11_000;
```

The exact numeric values may change during implementation only if tests still
prove the ordering invariant.

## Step 2: Make Fullscreen Frames Own Fullscreen Stack Priority

Modify `WindowWorkspaceController` so active visible fullscreen stack-managed
frames receive `WINDOW_FULLSCREEN_PRESENTATION_LAYER` instead of falling back
to base priority.

Expected behavior:

- Hidden or inactive frames still do not receive managed stack priority.
- Windowed frames still use dense floating focus priorities.
- Fullscreen frames use the fullscreen presentation layer.
- Children of fullscreen frames inherit the fullscreen stack priority through
  the existing `getEffectiveStackPriorityForActor` path.
- `FloatingWindowComponent` continues to apply `#effectivePriority` to root
  z-index; do not add a second fullscreen z-index path inside the component.
- `listStackEntries()` should keep its current public shape. Fullscreen entries
  may keep `rank: null`; do not add a presentation-rank field unless a real
  production caller needs it.

Tests to update/add:

- Replace the old expectation that fullscreen windows are excluded from
  effective priority with an expectation that fullscreen priority is greater
  than top-docked chrome.
- Keep hidden/inactive exclusion tests.
- Keep or update the child inheritance test so a child of a fullscreen frame
  gets `WINDOW_FULLSCREEN_PRESENTATION_LAYER`.
- Add a regression that a windowed frame remains below
  `WINDOW_TOP_DOCKED_CHROME_LAYER`.

Exit grep:

```powershell
rg -n "presentation === \"fullscreen\"|WINDOW_FULLSCREEN_PRESENTATION_LAYER" `
  packages/ui-framework/src/services/window-presentation-stack.ts `
  packages/ui-framework/src/services/window-workspace-controller.ts `
  apps/wallpaper-tesseract/src/window-runtime/floating-window-component.ts
```

Expected result:

- The fullscreen priority decision lives in the workspace controller/presentation
  owner, not in `FloatingWindowComponent`.

## Step 3: Move App Menu Visual And Input Priority To Top-Docked Chrome Layer

Modify `apps/wallpaper-tesseract/src/features/app-menu/install-app-menu-feature.ts`:

- Delete the `actorInputScopeRoutePriority` import.
- Delete `APP_MENU_STACK_PRIORITY = actorInputScopeRoutePriority.appOverlay * 3`.
- Use `WINDOW_TOP_DOCKED_CHROME_LAYER` for `MenuBarComponent` and
  `PopupMenuComponent` `inputStackPriority`.
- Keep generic menu components product-agnostic.

Modify `apps/wallpaper-tesseract/src/app/app-shell.css` and
`apps/wallpaper-tesseract/src/app/app-shell.ts`:

- Delete the hardcoded CSS `z-index: 10000` from
  `.app-shell__menu, .app-shell__toolbar, .app-shell__status`.
- Set the top-docked chrome z-index from the same presentation-stack constant.
  Use a CSS variable or a direct style assignment, but keep one source of truth.

Preferred simple path:

```ts
root.style.setProperty(
  "--window-top-docked-chrome-layer",
  String(WINDOW_TOP_DOCKED_CHROME_LAYER)
);
```

```css
.app-shell__menu,
.app-shell__toolbar,
.app-shell__status {
  position: relative;
  z-index: var(--window-top-docked-chrome-layer);
}
```

Do not introduce a separate app-shell z-index constant.
Keep toolbar and status grouped with menu on the same top-docked chrome layer
for this gate because the current shell CSS already groups those chrome slots.
Do not split them into separate presentation facts unless a later feature needs
distinct layers.

Exit grep:

```powershell
rg -n "z-index:\s*10000|APP_MENU_STACK_PRIORITY|actorInputScopeRoutePriority" `
  apps/wallpaper-tesseract/src/app `
  apps/wallpaper-tesseract/src/features/app-menu
```

Expected result:

- No production match for `z-index: 10000`.
- No production match for `APP_MENU_STACK_PRIORITY`.
- No app-menu production import of `actorInputScopeRoutePriority`.

## Step 4: Strengthen Boundary And Unit Tests

Update `apps/wallpaper-tesseract/src/architecture-boundaries.test.ts`:

- Assert app shell CSS no longer hardcodes `z-index: 10000`.
- Assert app menu installer no longer imports `actorInputScopeRoutePriority`.
- Assert app menu installer uses the top-docked chrome presentation constant.
- Assert generic menu production code does not own cross-frame stack priority.
  If it still uses `actorInputScopeRoutePriority.appOverlay`, tests should
  describe that as a local route/scope hint, not as the app-menu stack fact.
- Assert fullscreen presentation layer is greater than top-docked chrome layer.
- Assert `FloatingWindowComponent` still uses `#effectivePriority` and does not
  contain a fullscreen-specific z-index branch.

Targeted tests:

```powershell
npm run test -w ui-framework -- window-workspace-controller
npm run test -w wallpaper-tesseract -- architecture-boundaries install-app-menu-feature floating-window-component
```

If `install-app-menu-feature` does not currently expose enough test evidence,
add a narrow test that verifies the installed menu bar and popup components
receive `WINDOW_TOP_DOCKED_CHROME_LAYER`.

## Step 5: Extend Gate 5 Browser Smoke Evidence

Update `temp/run-project-arbor-gate-5-smoke.mjs` to capture a fullscreen
top-docked-menu check:

1. Enter Scene fullscreen.
2. Locate the Window menu bar item center.
3. Record:
   - fullscreen Scene rect;
   - fullscreen frame z-index;
   - app menu slot z-index;
   - `.app-shell__floating-overlay` computed `position` and `zIndex`;
   - `document.elementsFromPoint()` at the Window menu center;
   - whether the top element is inside the fullscreen Scene/frame rather than
     `.ui-menu-bar-item`.
4. Click the former Window menu location while fullscreen.
5. Record that no popup opens and no menu item becomes the actor-input target.
6. Restore fullscreen and continue the rest of Gate 5 smoke.

Add evidence fields:

```json
{
  "fullscreen": {
    "coversTopDockedMenu": true,
    "blocksTopDockedMenuInput": true,
    "topDockedMenuProbe": {
      "point": { "x": 0, "y": 0 },
      "topElement": "...",
      "elementsFromPoint": [],
      "fullscreenZIndex": 11000,
      "menuZIndex": 10000,
      "floatingOverlay": {
        "position": "fixed",
        "zIndex": "auto"
      }
    }
  }
}
```

Update
`apps/wallpaper-tesseract/src/test-support/project-arbor-gate-5-smoke-contract.test.ts`
so the validator rejects:

- missing `coversTopDockedMenu`;
- missing `blocksTopDockedMenuInput`;
- evidence where the top element at the menu center is `.ui-menu-bar-item`;
- evidence where fullscreen z-index is not greater than menu z-index.
- evidence missing the floating overlay computed `position/zIndex`, so future
  stacking-context regressions cannot slip through with only frame/menu
  z-index values.

Do not reuse old smoke evidence. Regenerate:

```powershell
npm run build -w wallpaper-tesseract
npm run dev -w wallpaper-tesseract
node temp/run-project-arbor-gate-5-smoke.mjs
$env:PROJECT_ARBOR_GATE_5_SMOKE_EVIDENCE="temp/project-arbor-gate-5-smoke-data.json"; `
  npm run test -w wallpaper-tesseract -- project-arbor-gate-5-smoke-contract; `
  Remove-Item Env:PROJECT_ARBOR_GATE_5_SMOKE_EVIDENCE
```

Stop the dev server after smoke.

## Step 6: Final Validation

Run targeted checks:

```powershell
npm run test -w ui-framework -- window-workspace-controller
npm run test -w wallpaper-tesseract -- architecture-boundaries install-app-menu-feature floating-window-component project-arbor-gate-5-smoke-contract
npm run typecheck -w wallpaper-tesseract
npm run build -w wallpaper-tesseract
```

Because this changes shared window presentation constants, broaden before
handoff:

```powershell
npm run test
npm run typecheck
npm run build
```

The build may keep the known Vite chunk size warning; no new warnings should be
introduced.

## Exit Criteria

Gate 5A is complete only when all of these are true:

- Fullscreen Scene visually covers the Window menu.
- Clicking the Window menu position while fullscreen does not open the menu.
- The restore fullscreen control remains reachable.
- `WindowWorkspaceController` assigns fullscreen frames a priority above
  top-docked chrome.
- App Menu visual z-index and input stack priority both use the same
  top-docked chrome presentation constant.
- `.app-shell__floating-overlay` is included in fullscreen menu-cover smoke
  evidence with computed `position/zIndex`.
- `app-shell.css` no longer hardcodes `z-index: 10000`.
- App Menu production code no longer imports `actorInputScopeRoutePriority` or
  defines `APP_MENU_STACK_PRIORITY`.
- No Scene-specific fullscreen z-index branch exists in `FloatingWindowComponent`.
- Gate 5 smoke data is fresh and the smoke contract validates.

## Stop Conditions

Stop and amend this plan if any of these are discovered:

- More than one independent fullscreen presentation owner exists.
- App Menu cannot consume the presentation constant without introducing a
  circular dependency.
- Actor-input stack priority and DOM z-index cannot be made to share one
  source without a larger presentation-layer extraction.
- Browser smoke proves fullscreen covers the menu visually but actor-input
  still activates the menu. First verify whether stack priority is shared
  correctly; if yes, fix generic menu route priority as an explicit component
  input or actor-input ordering at the owning layer. Do not accept a CSS-only
  solution.

## Resolved Reviewer Decisions

- `WINDOW_TOP_DOCKED_CHROME_LAYER` and
  `WINDOW_FULLSCREEN_PRESENTATION_LAYER` will live in
  `packages/ui-framework/src/services/window-presentation-stack.ts`.
- Toolbar and status remain grouped with menu on the top-docked chrome layer in
  this gate.
- `WindowWorkspaceController.listStackEntries()` keeps its current public shape.
  No presentation-layer rank is added unless implementation discovers a real
  production caller.
