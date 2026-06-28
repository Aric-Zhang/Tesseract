# Project Arbor Gate 6: Final Boundary And Browser Gate

Status: completed
Parent plan: `docs/project-arbor-ui-framework-actor-layout-plan.md`
Created: 2026-06-28
Completed: 2026-06-28
Scope: final Project Arbor closure across `packages/ui-framework`,
`packages/editor`, and `apps/wallpaper-tesseract` verification/support code.

## Goal

Gate 6 closes Project Arbor after the completed Gate 4 menu migration and
Gate 5 Scene migration. It should not add another UI subsystem or keep polishing
old implementation paths. Its job is to prove that the new actor tree ->
component composition model is now the only accepted path for ordinary UI
controls, and to delete or lock out any remaining old facts that would let the
previous App Menu or Scene shell designs return.

Gate 6 is complete when:

- generic UI controls in `ui-framework` stay product-agnostic;
- the real App Menu uses Arbor actors/layout/menu components, with no direct row
  DOM rendering path;
- the real Scene tab uses an Arbor actor subtree, with World Render View and
  Camera3 as sibling layout children;
- fullscreen comes from the generic view intent path and is executed by the
  window presentation owner;
- old App Menu, Scene viewport shell, raw Camera3 DOM parent, and UI DOM click
  activation shortcuts are absent from production;
- fresh final browser smoke evidence proves the combined menu, docking, Scene,
  fullscreen, resize, mobile, and lifecycle behavior.

## Non-Negotiables

- Do not add compatibility aliases, fallback App Menu renderers, or a legacy
  Scene viewport wrapper to make final tests pass.
- Do not create a second UI tree, a product UI registry, or a global control
  manager.
- Do not move menu, Scene, Camera3, Debug, Hierarchy, Inspector, Tesseract, or
  wallpaper-runtime facts into generic `ui-framework/src/ui/**` controls.
- Do not let `WindowFrameSurfaceComponent` become a special-case menu, toolbar,
  viewport, or Scene owner.
- Do not use DOM `click` activation shortcuts for generic UI controls; pointer
  activation must stay on actor-input or a narrow intent port.
- Do not widen `wallpaper-runtime`, `editor`, or app-local barrels to satisfy
  tests. If a test needs a fact, route it through the owning component or smoke
  evidence.
- If a remaining old path is discovered, delete it in the same closure path
  unless it is explicitly recorded as a non-blocking defect in
  `docs/known-defects-and-todos.md` with an owner and deletion condition.

## Entry Gate

Before editing code, confirm Gate 4 and Gate 5 evidence still validates from
the current workspace. If either validator fails, fix the current implementation
or update the specific gate evidence before continuing; do not paper over a
failed earlier gate in the final smoke contract.

```powershell
$env:PROJECT_ARBOR_GATE_4_SMOKE_EVIDENCE="temp/project-arbor-gate-4-smoke-data.json"; `
  npm run test -w wallpaper-tesseract -- project-arbor-gate-4-smoke-contract; `
  Remove-Item Env:PROJECT_ARBOR_GATE_4_SMOKE_EVIDENCE

$env:PROJECT_ARBOR_GATE_5_SMOKE_EVIDENCE="temp/project-arbor-gate-5-smoke-data.json"; `
  npm run test -w wallpaper-tesseract -- project-arbor-gate-5-smoke-contract; `
  Remove-Item Env:PROJECT_ARBOR_GATE_5_SMOKE_EVIDENCE
```

Also run a quick source audit so the final plan starts from real facts:

```powershell
git status --short
rg -n "Project Arbor|Gate 6|known-defects" docs
rg -n "project-arbor-gate-[45]|Arbor" apps/wallpaper-tesseract/src/test-support temp docs
```

If the worktree contains unrelated user changes, leave them alone. If those
changes touch files that Gate 6 must edit, read them first and preserve the
user's intent.

## Redundancy Findings To Fold Into Gate 6

The Gate 4 and Gate 5 migrations intentionally moved quickly through real
vertical slices. Before the final browser gate, Gate 6 must also collapse the
small pieces of duplicate ownership introduced by that incremental work. Treat
these as planned cleanup, not optional polish:

1. Generic UI input priority currently has two facts in some controls:
   components accept `inputStackPriority`, while hits may also import and set
   `actorInputScopeRoutePriority` directly. Gate 6 should delete explicit
   generic-control imports of `actorInputScopeRoutePriority` where the hit
   `region` already expresses the local route class, and keep cross-window
   priority on `inputStackPriority` / owning app-window integration.
2. Generic UI styles are split across product/editor CSS:
   `.ui-menu-*` lives in app-local App Menu CSS, while `.ui-render-viewport`
   and `.ui-fullscreenable-view__control` live in editor Scene CSS. Gate 6
   should move reusable generic control base styles into `ui-framework` and
   leave product/editor CSS only for product-specific surface styling. Because
   `packages/ui-framework` currently builds with plain `tsc` and its package
   manifest only ships `dist/**/*.js` / `.d.ts`, the CSS move is not complete
   until the package has an explicit CSS distribution contract. Prefer a small
   copy script plus `package.json` `files`/`exports` update over app imports from
   internal source paths. Delete old app/editor generic selector copies in the
   same change.
3. Scene measurement still has overlapping owners: `RenderViewportComponent`
   owns ResizeObserver-driven measurement, but app bootstrap still has a global
   `window.resize -> runtimeSceneViews.measureCurrentView()` hook. Gate 6 must
   verify whether the global resize hook is still necessary; delete it if the
   viewport owner and presentation-change hooks cover the behavior, or narrow it
   to a clearly named presentation recovery hook with tests/smoke evidence.
4. Scene component-definition ownership is ambiguous by name: both editor Scene
   components and app-local Scene integration expose `installSceneComponentDefinitions`.
   Gate 6 should rename or inline the app-local integration installer so
   `SceneCamera3ViewportBindingComponent` is clearly a wallpaper scene
   integration bridge, not another generic/editor Scene component surface.
5. Arbor smoke validators and runners can easily duplicate rect/intersection/
   console validation. Gate 6 should introduce one final Arbor contract as the
   current acceptance surface and either extract tiny test-support helpers or
   delete superseded temporary runner duplication. Keep Gate 4/5 evidence files
   as historical proof if progress docs reference them, but do not keep multiple
   active pass-state smoke paths.
6. New Arbor barrels should be audited. Generic `ui-framework` may export stable
   reusable component APIs, but app-local adapter internals and app-local Scene
   integration components should not become broad convenience surfaces.

## Step 1: Redundancy And Old Path Audit

Create a short audit note under `temp/`, for example:

```text
temp/project-arbor-gate-6-boundary-audit.md
```

The audit is not a new architecture document; it is execution evidence. It must
list each old path check, whether it is already clean, and whether a production
deletion is needed.

Run these checks and fix production hits immediately when they represent old
logic rather than tests or historical docs.

### Generic UI priority and activation checks

```powershell
rg 'addEventListener(?:\?\.)?\(\s*["'']click|\.onclick\s*=|onClick\b' packages/ui-framework/src/ui --glob "!*.test.ts"
rg "\\bactorInputScopeRoutePriority\\b" packages/ui-framework/src/ui --glob "!*.test.ts"
rg "APP_MENU_PRIORITY|APP_MENU_STACK_PRIORITY" apps/wallpaper-tesseract/src/features/app-menu packages/ui-framework/src/ui --glob "!*.test.ts"
```

Expected results after cleanup:

- No generic production UI control has DOM click activation.
- Generic UI controls do not import `actorInputScopeRoutePriority` just to
  restate their route class. Use `hit.region` plus optional local route score
  and owner-supplied `inputStackPriority` instead.
- App Menu visual/input layer comes from `WINDOW_TOP_DOCKED_CHROME_LAYER`, not
  a menu-specific global constant.

Allowed exceptions must be extremely narrow. For example, if a future generic
control truly needs configurable route class, expose an explicit product-free
option and test it; do not hard-code app/window stack semantics in the control.

### Generic UI CSS ownership checks

```powershell
rg "\\.ui-menu-|\\.ui-render-viewport|\\.ui-fullscreenable-view" apps/wallpaper-tesseract/src packages/editor/src -g "*.css"
rg "\\.ui-menu-|\\.ui-render-viewport|\\.ui-fullscreenable-view" packages/ui-framework/src -g "*.css"
```

Required cleanup:

- Add a `ui-framework` CSS entry, for example
  `packages/ui-framework/src/ui/ui-framework-controls.css`, for reusable
  `.ui-menu-*`, `.ui-render-viewport`, and `.ui-fullscreenable-view__control`
  base styles.
- Update `packages/ui-framework/package.json` deliberately. Current build is
  plain `tsc`, so choose one clean distribution path:
  - preferred: add a tiny package-local script that copies the CSS file into
    `dist/ui/ui-framework-controls.css` after `tsc`, update the `build` script,
    include `dist/**/*.css` in `files`, add an explicit export such as
    `"./ui/ui-framework-controls.css"`, and mark that CSS path as side-effectful
    instead of leaving package-wide `"sideEffects": false`;
  - acceptable only if reviewed: keep source CSS import from the app style
    manifest, but add a boundary test proving app code imports only the
    documented package export/source entry and no other `ui-framework/src/**`
    internals. This should be treated as weaker than the copy-script package
    contract.
- Import the generic CSS from the app/fixture style manifests through the
  package export, not an internal source path.
- Remove the generic `.ui-*` selector blocks from app-local App Menu CSS and
  editor Scene CSS unless they are intentionally product-specific overrides.
  Product overrides must be visibly scoped to product containers.

### App Menu old path checks

```powershell
Test-Path packages/ui-framework/src/model/app-menu-model.ts
rg "#rows|#activeRowIndex|renderMenu|createMenuItemElement|app-menu-bar__" apps/wallpaper-tesseract/src/features/app-menu --glob "!*.test.ts"
rg "parent\\s*:\\s*HTMLElement|menuSlot\\.append|appendChild\\(.*menu" apps/wallpaper-tesseract/src/features/app-menu apps/wallpaper-tesseract/src/app --glob "!*.test.ts"
rg "WindowViewIdentity|WindowWorkspaceViewEntry|WindowWorkspace|WindowFrame|createWindowMenuItems" packages/ui-framework/src/ui/menu --glob "!*.test.ts"
```

Expected results:

- `Test-Path` prints `False`.
- No production row/highlight/direct parent append hits remain.
- Window-specific menu mapping remains app-local, not generic menu code.

If old App Menu code remains, delete the old renderer/helper/CSS path instead
of adding a new adapter. The only accepted real menu path is:

```text
borrowed App Menu Host Actor
  UiElementComponent
  UiLayoutHostComponent

  Menu Bar Actor
    UiElementComponent
    UiLayoutItemComponent(slot: top or fill, as owned by the host)
    MenuBarComponent
```

### Scene old path checks

```powershell
rg "SceneViewportComponent|SceneModeToggle|createEditorSceneViewHost|editor-scene-view-host" packages apps/wallpaper-tesseract/src --glob "!*.test.ts"
rg "overlayElement|canvasHostElement|sceneView\\.viewport" packages apps/wallpaper-tesseract/src --glob "!*.test.ts"
rg "Camera3GizmoOptions|parent\\s*\\?|parent\\s*:\\s*.*HTMLElement|parent\\s*:\\s*sceneView|parent\\s*:\\s*.*overlay" packages/editor/src apps/wallpaper-tesseract/src --glob "!*.test.ts"
rg "scene-window__canvas-host|scene-window__overlay|scene-window__fullscreen|scene-mode-toggle" packages apps/wallpaper-tesseract/src --glob "!*.test.ts"
```

Expected results:

- No production old Scene viewport shell, overlay/canvas handoff, raw Camera3
  DOM parent channel, or old CSS selector remains.
- If a test still mentions an old symbol, it must be a negative boundary test
  or be rewritten to the current Arbor owner invariant.

### Generic viewport/window ownership checks

```powershell
rg "WindowRegisteredContent|WindowContentRegistrationPort|WindowContentRegistry" packages/ui-framework/src/ui/viewport --glob "!*.test.ts"
rg "WindowFrameSurfaceComponent" packages/ui-framework/src/ui apps/wallpaper-tesseract/src/features --glob "!*.test.ts"
rg "menu|toolbar|viewport|Scene|Camera3|Tesseract" packages/ui-framework/src/chrome/window-frame-surface-component.ts --glob "!*.test.ts"
```

Expected results:

- Generic viewport code does not implement window content registration.
- Generic UI controls and app features do not reach into
  `WindowFrameSurfaceComponent`.
- The frame surface has no menu/toolbar/viewport/Scene special branches.

### Scene measurement and integration naming checks

```powershell
rg "measureSceneViewport|window\\.addEventListener\\(\\\"resize\\\"|runtimeSceneViews\\.measureCurrentView\\(\\)" apps/wallpaper-tesseract/src/app apps/wallpaper-tesseract/src/features/scene packages/editor/src packages/wallpaper-runtime/src --glob "!*.test.ts"
rg "installSceneComponentDefinitions|SceneCamera3ViewportBindingComponent|sceneCamera3ViewportBindingComponentType" apps/wallpaper-tesseract/src/features/scene packages/editor/src/scene --glob "!*.test.ts"
```

Required cleanup:

- Prefer `RenderViewportComponent`'s ResizeObserver and the existing
  presentation-change hooks over a global app bootstrap resize measurement
  hook. Gate 6 should try deleting `window.resize -> measureSceneViewport`
  first. Do not start by renaming it.
- If a visibility/presentation recovery measurement remains needed, make the
  function name and tests describe that narrower owner, for example
  `measureScenePresentationAfterVisibilityChange`. It must not look like app
  bootstrap owns ordinary Scene viewport sizing.
- Rename the app-local Scene integration installer to something like
  `installSceneIntegrationComponentDefinitions`, or inline it if there is only
  one app-local integration definition. Do not keep two public
  `installSceneComponentDefinitions` owners with different meanings.
- Keep `SceneCamera3ViewportBindingComponent` app-local/integration-scoped. Do
  not export it as a broad editor or generic UI component unless a production
  caller outside the app-local Scene integration genuinely needs it.

### Arbor public surface checks

```powershell
Get-Content packages/ui-framework/src/ui/menu/index.ts
Get-Content packages/ui-framework/src/ui/viewport/index.ts
Get-Content apps/wallpaper-tesseract/src/features/app-menu/index.ts
Get-Content apps/wallpaper-tesseract/src/features/scene/components/index.ts
```

Required cleanup:

- Keep `menu-dom-hit` and other helper-only files package-private.
- Keep app-local App Menu adapter classes private unless production imports
  require them. Export installer/options and narrow public types only.
- Keep app-local Scene integration component internals private unless tests or
  production imports require the component type. Prefer testing through the
  installer and actor/component registry where possible.
- In particular, stop exporting `SceneCamera3ViewportBindingComponent` and its
  options from `features/scene/components/index.ts` unless a real production
  caller outside the integration installer needs the class. The stable surface
  should be the integration definition installer or an inlined registration.
- Avoid compatibility barrels that exist only because files moved during Gate 4
  or Gate 5.

## Step 2: Harden Architecture Boundary Tests

Update `apps/wallpaper-tesseract/src/architecture-boundaries.test.ts` so the
Step 1 audit becomes executable protection. Prefer small source scans with clear
failure messages over broad regexes that catch unrelated historical docs.

Required boundary rules:

1. `packages/ui-framework/src/ui/**` must not import:
   - `apps/wallpaper-tesseract/src/features/**`;
   - `packages/editor/**`;
   - `packages/wallpaper-runtime/**`;
   - Scene, Camera3, Tesseract, Debug, Hierarchy, Inspector product modules.
2. `packages/ui-framework/src/ui/menu/**` must not import window workspace
   identity, view-entry, dock, lifecycle, or app-local menu descriptor helpers.
3. `packages/ui-framework/src/ui/viewport/**` must not import or implement
   window content registration contracts.
4. Generic UI production code must not contain DOM click activation shortcuts
   and must not import `actorInputScopeRoutePriority` for hard-coded route
   facts.
5. App Menu production code must not contain the old row/highlight/direct parent
   append path.
6. Scene production code must not expose `overlayElement`, `canvasHostElement`,
   or raw Camera3 DOM parent handoff.
7. `WindowFrameSurfaceComponent` must not contain menu, toolbar, viewport,
   Scene, Camera3, or Tesseract special cases.
8. Presentation-stack constants must come from the shared
   `window-presentation-stack` fact source, not duplicated numeric z-indexes in
   app CSS/TS.
9. Generic `.ui-*` control base styles must live under `ui-framework`; app/editor
   CSS may contain only scoped product overrides. The `ui-framework` package
   manifest must ship the CSS through a documented export/build path.
10. App bootstrap must not own ordinary Scene viewport resize measurement if
    the `RenderViewportComponent` owner can perform it.
11. App-local Scene integration component definition installation must have a
    distinct integration name or be inlined; it must not be confused with the
    editor Scene component installer.
12. App-local Scene integration internals must not be exported as broad
    component APIs.

Do not add an allowlist for old production paths. If a rule finds a legitimate
new owner, rename the rule to describe that owner; do not hide the old
architecture behind a vague exception.

Targeted validation:

```powershell
npm run test -w wallpaper-tesseract -- architecture-boundaries
```

Also add or update `ui-framework` actor-input routing tests so removing
explicit `scopeRoutePriority` remains safe. At minimum:

- a menu bar hit without explicit `scopeRoutePriority` still routes as an
  actor-overlay hit through `hit.region`;
- a popup menu item hit without explicit `scopeRoutePriority` still activates
  once and does not lose to unrelated content in the same stack;
- fullscreen control hit behavior remains actor-overlay based without explicit
  scope priority.

Targeted validation:

```powershell
npm run test -w ui-framework -- menu fullscreenable-view
```

## Step 3: Add Final Arbor Smoke Contract

Add a final evidence validator under `apps/wallpaper-tesseract/src/test-support`.
Use a new test name rather than overloading Gate 4 or Gate 5:

```text
apps/wallpaper-tesseract/src/test-support/project-arbor-final-smoke-contract.test.ts
```

Use a dedicated environment variable:

```text
PROJECT_ARBOR_FINAL_SMOKE_EVIDENCE
```

The final contract should validate one combined evidence file:

```text
temp/project-arbor-final-smoke-data.json
```

Minimum evidence shape:

```ts
interface ProjectArborFinalSmokeEvidence {
  kind: "project-arbor-final-smoke";
  url: string;
  viewport: { width: number; height: number };
  consoleErrors: string[];
  appMenu: {
    hostActorId: string;
    menuBarActorId: string;
    usesLayoutHost: boolean;
    hoverLabels: string[];
    highlightedLabels: string[];
    activationCreatedInspector: boolean;
    popupClosedAfterActivation: boolean;
    tabDragStillWorks: boolean;
    tabCloseStillWorks: boolean;
    dockPreviewStillWorks: boolean;
  };
  scene: {
    sceneActorId: string;
    worldRenderViewActorId: string;
    camera3ActorId: string;
    camera3SiblingOfWorldRenderView: boolean;
    renderViewportRect: RectLike;
    canvasRect: RectLike;
    overlayRect: RectLike;
    camera3Hit: boolean;
    tesseractVisible: boolean;
    centeredOrMeasuredAfterResize: boolean;
  };
  fullscreen: {
    entered: boolean;
    restored: boolean;
    sourceIntentActorId: string;
    workspaceMutatedByPresentationOwner: boolean;
    persistenceHasRuntimeOnlyFrame: boolean;
    coversTopDockedMenu: boolean;
    blocksTopDockedMenuInput: boolean;
    restoreControlReachable: boolean;
    floatingOverlay: { position: string; zIndex: string };
  };
  lifecycle: {
    closeReopenIterations: number;
    sceneExactOnceAfterReopen: boolean;
    tesseractExactOnceAfterReopen: boolean;
    camera3ExactOnceAfterReopen: boolean;
    staleCanvasCount: number;
    staleFrameSourceCount: number;
  };
  mobile: {
    viewport: { width: number; height: number };
    menuIntersectsViewport: boolean;
    renderViewportIntersectsViewport: boolean;
    camera3IntersectsViewport: boolean;
    restoreControlIntersectsViewport: boolean;
  };
}
```

Validator rules:

- `kind` must be exact.
- `consoleErrors` must be empty.
- App Menu must prove hover follows the hovered item, not the first item.
- App Menu activation must create/focus an Inspector and close the popup.
- App Menu must not break tab drag, dock preview, or tab close hit targets.
- Scene actors must prove World Render View and Camera3 are siblings under the
  Scene view actor.
- Render viewport, canvas, and overlay rects must have positive area.
- Camera3 actor-input hit must be true.
- Fullscreen must enter and restore through the generic intent path, must not
  persist a runtime-only frame, must cover and block the top-docked menu, and
  must leave restore reachable.
- Close/reopen must run at least three iterations and leave Scene/Tesseract4/
  Camera3 exact-once, with no stale canvas or frame-source count.
- Mobile evidence must use a mobile-sized viewport and prove key controls
  intersect the viewport, not just have positive desktop rects.

Negative tests must reject:

- missing menu hover/highlight evidence;
- menu highlight always equal to the first item;
- missing camera3 sibling proof;
- fullscreen evidence that covers the menu visually but leaves menu input
  active;
- mobile evidence where key rects are outside the mobile viewport.

Targeted validation:

```powershell
npm run test -w wallpaper-tesseract -- project-arbor-final-smoke-contract
```

The test may skip the external evidence-file validation when the environment
variable is absent, but the negative fixture tests must always run.

While implementing this contract, avoid copying large helpers from the Gate 4
and Gate 5 validators. If rect, viewport-intersection, console-error, or record
coercion helpers are repeated three times, extract a tiny
`project-arbor-smoke-contract-helpers.ts` under `test-support`. Keep it
test-only; do not add production diagnostics or model APIs for smoke.

## Step 4: Add Or Update Final Browser Smoke Runner

Create or update a single final smoke script in a stable script location, for
example:

```text
apps/wallpaper-tesseract/scripts/run-project-arbor-final-smoke.mjs
```

This script may reuse safe helper ideas from the Gate 4 and Gate 5 smoke
scripts, but it should write a fresh final data file and report rather than
mutating old gate evidence.

Do not put the long-term final runner only under `temp/`. `temp/` is for data,
reports, screenshots, and throwaway process traces. The final runner becomes the
reproducible Project Arbor acceptance entry and must be protected from routine
temp cleanup by living under source control in a script directory. If a temporary
wrapper is useful during development, delete it before Gate 6 closes.

Required sequence:

1. Start from a rebuilt dev server:

   ```powershell
   npm run prism:smoke:prepare
   npm run dev -w wallpaper-tesseract
   ```

2. Load the app at the dev-server URL.
3. Capture console errors throughout the run.
4. App Menu path:
   - open Window menu;
   - hover at least five items and record the visible highlighted label after
     each hover;
   - activate New Inspector and record the Inspector count/title change;
   - verify tab drag, tab close, and dock preview still route to their owners.
5. Scene path:
   - record Scene view actor id, World Render View actor id, Camera3 actor id,
     and hierarchy/sibling relationship;
   - record render viewport, canvas, overlay, and Camera3 rects;
   - perform Camera3 drag or double-click snap and record actor-input hit.
6. Fullscreen path:
   - enter fullscreen through the render-view/fullscreen control path;
   - record source actor intent evidence when available;
   - verify fullscreen covers and blocks the top-docked Window menu at the same
     screen point;
   - record `.app-shell__floating-overlay` computed position and z-index;
   - resize the browser while fullscreen is active and verify fullscreen still
     covers the viewport and restore remains reachable;
   - restore and verify persistence does not contain runtime-only frame ids.
7. Lifecycle path:
   - close/reopen Scene at least three times;
   - record exact-once hierarchy entries for Scene View, World Render View,
     Tesseract4, and Camera3;
   - record stale canvas and stale frame-source counts.
8. Mobile path:
   - resize to `390x844` or another documented mobile viewport;
   - record menu, render viewport, Camera3, and restore-control viewport
     intersections;
   - verify no menu/viewport/gizmo control is only measurable at desktop
     coordinates.
9. Write:

   ```text
   temp/project-arbor-final-smoke-data.json
   temp/project-arbor-final-smoke-report.md
   ```

10. Validate:

    ```powershell
    $env:PROJECT_ARBOR_FINAL_SMOKE_EVIDENCE="temp/project-arbor-final-smoke-data.json"; `
      npm run test -w wallpaper-tesseract -- project-arbor-final-smoke-contract; `
      Remove-Item Env:PROJECT_ARBOR_FINAL_SMOKE_EVIDENCE
    ```

Do not reuse Gate 4 or Gate 5 smoke data as final evidence. Final evidence may
compare against prior files for diagnostics, but it must be freshly generated
from the current implementation.

After the final runner covers the Gate 4 and Gate 5 smoke paths, delete
superseded temporary runner scripts if they are only process traces:

```text
temp/run-project-arbor-gate-4-smoke.mjs
temp/run-project-arbor-gate-5-smoke.mjs
```

Keep the Gate 4/Gate 5 smoke data and reports if `docs/current-project-progress.md`
still references them as historical acceptance evidence.

## Step 5: Consolidate Or Delete Stale Tests

After the final smoke contract exists, audit Arbor-related tests and keep them
as current owner invariants rather than historical duplication.

Keep:

- `ui-element`, `ui-layout-item`, `ui-layout-host` tests that protect generic
  ownership/layout primitives;
- menu component tests that protect actor-input-only activation, hover/open
  state convergence, stale actor deletion, and product-free descriptors;
- viewport/fullscreen tests that protect owned/borrowed target disposal,
  resize, DPR behavior, and intent-only fullscreen mutation;
- app integration tests that prove App Menu host actor and Scene actor subtree
  wiring.

Delete or rewrite:

- tests that only assert old App Menu row DOM implementation details;
- tests that only assert old Scene viewport shell internals;
- tests that duplicate the same final smoke condition without owner-specific
  value;
- temporary tests that were useful only before Gate 4/5 deletion completed.
- duplicate Gate 4/Gate 5 smoke contract helper code once the final contract
  has a shared helper or supersedes that assertion.

Do not delete DCK/Arbor regression tests merely because they came from an old
bug if they protect a current invariant.

Targeted validation after cleanup:

```powershell
npm run test -w ui-framework -- ui-element ui-layout-item ui-layout-host menu render-viewport fullscreenable-view
npm run test -w editor
npm run test -w wallpaper-tesseract -- app-menu install-scene-view-feature architecture-boundaries project-arbor-final-smoke-contract
```

If a test name differs from the command fragment, use the nearest existing test
filter; do not add broad compatibility aliases just for command names.

## Step 6: Update Documentation And Defect Ledger

Update mutable project documentation only after code and evidence are true.

Required updates:

- `docs/project-arbor-ui-framework-actor-layout-plan.md`
  - mark Gate 6 complete only after validation passes;
  - point to `temp/project-arbor-final-smoke-data.json` and report;
  - state that Project Arbor is complete.
- `docs/current-project-progress.md`
  - replace "remaining gate" wording with completed Arbor status;
  - add the final smoke validator command;
  - summarize current UI source topology.
- `docs/known-defects-and-todos.md`
  - close any Arbor-specific defects fixed by Gate 6;
  - keep unrelated watch items as non-blocking maintenance, not Arbor blockers.

Do not copy temporary smoke logs into stable docs. Link the final evidence
files and keep detailed run logs in `temp/`.

## Step 7: Final Validation Matrix

Run validation in this order so failures isolate cleanly:

```powershell
npm run prism:smoke:prepare

npm run test -w ui-framework
npm run typecheck:test -w ui-framework
npm run build -w ui-framework

npm run test -w editor
npm run typecheck -w editor
npm run build -w editor

npm run test -w wallpaper-tesseract -- architecture-boundaries app-menu install-scene-view-feature project-prism-smoke-contract project-arbor-gate-4-smoke-contract project-arbor-gate-5-smoke-contract project-arbor-final-smoke-contract
npm run typecheck -w wallpaper-tesseract
npm run build -w wallpaper-tesseract

node apps/wallpaper-tesseract/scripts/run-project-arbor-final-smoke.mjs
$env:PROJECT_ARBOR_FINAL_SMOKE_EVIDENCE="temp/project-arbor-final-smoke-data.json"; `
  npm run test -w wallpaper-tesseract -- project-arbor-final-smoke-contract; `
  Remove-Item Env:PROJECT_ARBOR_FINAL_SMOKE_EVIDENCE

npm run test
npm run typecheck
npm run build
```

The root build may retain the existing Vite chunk-size warning. Any new
TypeScript, test, browser-console, or evidence-validator failure blocks Gate 6.

## Final Exit Criteria

Gate 6 and Project Arbor are complete only when all of these are true:

- The old App Menu model path, row renderer, direct DOM parent append contract,
  and old App Menu selectors are gone from production.
- Generic menu activation is actor-input/intent driven; no production DOM click
  activation shortcuts remain in `ui-framework/src/ui/**`.
- Generic UI controls do not duplicate actor-input route facts by importing
  `actorInputScopeRoutePriority`; cross-window priority is owner-supplied and
  local route class is derived from hit region or a tested product-free option.
- Reusable `.ui-menu-*`, `.ui-render-viewport`, and
  `.ui-fullscreenable-view__control` base styles live in `ui-framework`, with
  app/editor CSS limited to scoped product styling.
- The real App Menu is an Arbor actor/layout/menu subtree.
- The old Scene viewport shell, canvas/overlay handoff, raw Camera3 parent
  channel, and old Scene selectors are gone from production.
- The real Scene tab is an Arbor actor subtree with World Render View and
  Camera3 as siblings.
- Generic render viewport does not own window content registration.
- App bootstrap no longer owns ordinary Scene viewport resize measurement; any
  remaining measurement hook is explicitly presentation/visibility recovery and
  proven by tests/smoke.
- App-local Scene integration component definitions are named or inlined as
  integration-specific wiring, not a second generic/editor Scene installer.
- Fullscreen intent originates from a generic control and workspace mutation is
  still presentation/lifecycle-owned.
- Fullscreen Scene visually covers and actor-input-blocks the top-docked Window
  menu.
- Browser resize during fullscreen keeps fullscreen coverage and restore
  control reachability.
- Repeated Scene close/reopen leaves no stale canvas, frame source, or duplicate
  Scene/Tesseract4/Camera3 actors.
- Mobile viewport evidence proves menu, viewport, Camera3, and restore controls
  are reachable within the mobile viewport.
- Architecture boundary tests lock the new invariants.
- Fresh final smoke evidence exists and passes the final validator.
- Superseded Arbor temporary smoke runner duplication has been deleted or
  clearly demoted to historical evidence; the final contract is the active
  Project Arbor pass-state gate.
- `docs/current-project-progress.md` names Project Arbor complete and no active
  Arbor blocker remains in `docs/known-defects-and-todos.md`.

## Stop Conditions

Stop and amend this plan if:

- final browser smoke requires reintroducing an old App Menu or Scene shell path;
- `ui-framework` generic UI needs product/editor/runtime imports to pass tests;
- actor-input cannot express a generic UI activation without DOM click fallback;
- fullscreen cannot remain an intent to the existing presentation owner;
- `WindowFrameSurfaceComponent` needs menu, toolbar, Scene, Camera3, viewport,
  or fullscreen special cases;
- evidence collection requires adding production-only diagnostic state that is
  not owned by the relevant component or lifecycle owner.

Normal failing tests, missing smoke fields, stale docs, or old production hits
are implementation work, not stop conditions. Fix them directly while preserving
the single actor tree -> component composition model.
