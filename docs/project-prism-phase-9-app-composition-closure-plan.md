# Project Prism Phase 9 App Composition Closure Plan

Status: complete. Code cleanup Steps 0-6 are implemented, and Step 7A closed
`DCK-007` with fresh Phase 9 browser smoke evidence.

DCK-007 blocker resolution record:

```text
docs/project-prism-phase-9-dck-007-blocker-resolution-plan.md
```

Fresh smoke evidence:

```text
temp/project-prism-phase-9-smoke-data.json
temp/project-prism-phase-9-smoke-report.md
```

Purpose: close the two narrowed post-Phase-8 debts by deleting the remaining
product installer shell and collapsing redundant app-composition facts into
their real owners. This plan starts from the accepted Phase 8 / Phase 8.5
baseline. It must not extend Phase 8 with more patch gates.

Target blockers:

- `wallpaper-app-concrete-feature-policy`
- `scene-run-mode-product-command`

The expected end state is not a new product facade. The expected end state is a
thin app bootstrap that imports package/owner installers, wires top-level ports,
and does not own hierarchy metadata, product actor ids, default window state,
menu internals, runtime Scene resources, or workspace placement truth.

## Reviewer Baseline

Phase 8 and Phase 8.5 are accepted:

- Runtime Scene composition blocker is closed.
- `DCK-006` is closed with fresh browser smoke evidence.
- Product-owned Scene/Tesseract/Camera3 internal actor ids are gone.
- Scene/Debug/Hierarchy default state and floating/default view policy
  construction moved to owner modules.
- Runtime Scene render/measure hooks moved out of
  `install-wallpaper-product-features.ts`.
- Remaining debt is only app-composition/product command policy.

This phase must start with a checkpoint commit because the working tree
contains the accepted Phase 8 / 8.5 implementation batch. Step 0 is not
optional: no code deletion for Phase 9 should begin until the accepted
Phase 8 / 8.5 batch is committed.

## Current Implementation Audit

Production residuals targeted by this plan:

- `apps/wallpaper-tesseract/src/features/install-wallpaper-product-features.ts`
  originally exported and owned:
  - `WallpaperProductWindowPolicy`
  - `WallpaperDebugLogSink`
  - `createWallpaperDebugLogSink`
  - `installWallpaperProductStateDefaults`
  - `installWallpaperProductFeatures`
  - `InstalledWallpaperProductFeatures`
- The same file originally centralized:
  - owner policy contribution composition;
  - hierarchy source creation through `createActorHierarchyObjectSource`;
  - Scene/Tool/AppMenu hierarchy metadata merge;
  - Scene, Inspector, Tool Window, App Menu, and workspace-mode install order.
- `features/app-menu/app-menu-model.ts` was only a local re-export of
  `ui-framework`; app-menu code should import the package model directly and
  this compatibility barrel should be deleted.
- Product-level hierarchy metadata helpers existed as public production
  exports even though the actor tree and actor names already carried most of the
  same truth:
  - `createSceneActorHierarchyMetadata`
  - `createToolWindowActorHierarchyMetadata`
  - `createAppMenuActorHierarchyMetadata`
- Tool-window installation exposed customization knobs that preserved a
  product-level identity override shape:
  - `ToolWindowActorIds`
  - `InstallToolWindowFeaturesOptions.actorIds`
  - `debugLogLabel`
  - `hierarchyLabel`
- `installWorkspaceModeController` returned the concrete
  `WorkspaceModeController` object even though the app only needed disposal.
  Phase 9 collapses it into a narrow Scene run-mode command installer.

Already-deleted old implementations that must stay deleted:

- `app-runtime`
- `runtime/ports`
- `update-runtime`
- old app-local `features/camera3`
- old app-local `tesseract4`
- `features/install-wallpaper-component-definitions.ts`
- `gizmo-runtime/install-component-definitions.ts`
- `features/scene/renderable-scene-view.ts`
- `features/scene/scene-view-content-installer.ts`
- `window-content-host`, `window-frame-dock-tree`,
  `window-dock-surface-model`, and old frame placement read APIs

These should remain as boundary-test invariants, not as active plan work.

## Structural Redundancy To Remove

1. Product hierarchy metadata duplicates actor-tree truth.

   The hierarchy source already reads `ActorSystem.listActorsInTreeOrder()`,
   runtime parent ids, actor names, and active state. The next cleanup should
   first try to delete product metadata maps entirely. If a stable display
   ordering is truly required, place the minimal ordering fact with the owner
   that creates the actor. Do not restore a product-level metadata table, and
   do not move that table into Tool Windows under a different name.

2. The product installer has become a sequential feature script.

   It no longer owns deep runtime resources. Keeping it now mainly hides the
   actual owner order behind one more file. Delete it instead of renaming it.
   `create-wallpaper-app.ts` may directly call public owner installers because
   app composition is allowed to install features and pass top-level ports.

3. App menu has a local model compatibility barrel.

   `features/app-menu/app-menu-model.ts` should be deleted and callers should
   use `ui-framework` directly. This removes a misleading local API surface.

4. Workspace mode is a Scene run-mode command, not a generic workspace owner.

   The code can remain app-local only if it stays narrow: editor mode state in,
   Scene fullscreen/window presentation command out. It must not expose a
   concrete controller to app bootstrap, own placement state, or become a
   runtime resource owner.

## Non-Negotiables

- Do not introduce a replacement `install-wallpaper-product-features` facade.
- Do not move constants into a new product id table.
- Do not keep old modules as compatibility barrels.
- Do not preserve old helper exports because tests import them.
- Do not add broad casts or fake ports to keep old tests alive.
- Do not move runtime resources into `packages/editor`.
- Do not make `ui-framework` know Scene, Debug, Hierarchy, Inspector,
  Tesseract, Camera3, or workspace-mode product semantics.
- Do not remove boundary blockers until production grep proves the old owner
  is gone and tests assert it cannot return.
- Do not let Tool Windows become a new cross-feature hierarchy metadata owner.
  It may create the Hierarchy source, but it may not own static Scene,
  Tesseract, Camera3, App Menu, Inspector, or Workspace Root product facts.
- Do not close `wallpaper-app-concrete-feature-policy` or
  `scene-run-mode-product-command` until the product installer file, app-menu
  model barrel, product hierarchy metadata merge, and public workspace
  controller surface are all gone or explicitly reclassified by boundary tests.

## Entry Gate

Run before implementation:

```text
git status --short
$env:PROJECT_PRISM_SMOKE_EVIDENCE="temp/project-prism-post-remaining-debt-smoke-data.json"; npm run test -w wallpaper-tesseract -- project-prism-smoke-evidence-file
npm run test -w wallpaper-tesseract -- runtime-scene-view-runtime runtime-scene-session runtime-work-attachment-runtime camera3-components tesseract4 component-definitions scene-run-mode-command render-loop architecture-boundaries project-prism-boundary-report project-prism-frame-update-lane-map
npm run typecheck -w wallpaper-tesseract
npm run test
npm run typecheck
npm run build
```

If this gate fails, fix the real failing owner first. Do not add aliases,
facades, or test-only compatibility to start Phase 9.

Baseline production grep:

```text
rg -n "installWallpaperProductStateDefaults|installWallpaperProductFeatures|createWallpaperDebugLogSink|WallpaperProductWindowPolicy|WallpaperDebugLogSink|InstalledWallpaperProductFeatures" apps/wallpaper-tesseract/src packages -g "*.ts" -g "!**/*.test.ts"
rg -n "createActorHierarchyObjectSource|createSceneActorHierarchyMetadata|createToolWindowActorHierarchyMetadata|createAppMenuActorHierarchyMetadata" apps/wallpaper-tesseract/src/features packages/editor/src -g "*.ts" -g "!**/*.test.ts"
rg -n "ToolWindowActorIds|actorIds\\?:|debugLogLabel|hierarchyLabel" packages/editor/src/tool-windows apps/wallpaper-tesseract/src -g "*.ts" -g "!**/*.test.ts"
rg -n "from [\"']\\./app-menu-model[\"']|app-menu-model" apps/wallpaper-tesseract/src/features/app-menu apps/wallpaper-tesseract/src/architecture-boundaries.test.ts -g "*.ts"
rg -n "scene-run-mode-product-command|wallpaper-app-concrete-feature-policy|app-composition-debt" apps/wallpaper-tesseract/src/test-support/project-prism-boundary-facts.ts apps/wallpaper-tesseract/src/architecture-boundaries.test.ts docs/current-project-progress.md
```

## Step 0: Checkpoint And Freeze Accepted Phase 8 State

Purpose: separate accepted Phase 8 / 8.5 work from the app-composition cleanup.

Work:

1. Review `git status --short` and confirm all dirty changes belong to the
   accepted Phase 8 / 8.5 batch or later documented cleanup.
2. Create a checkpoint commit before changing code for this plan.
3. Keep final Phase 8 and post-remaining-debt smoke evidence files in `temp/`.
   Do not rewrite them to satisfy Phase 9.

Exit:

- Git history has a clean checkpoint for the accepted Phase 8 / 8.5 state.
- `docs/current-project-progress.md` still names Phase 8 and Phase 8.5 as
  complete.
- Any agent resuming this plan can identify the checkpoint commit before
  inspecting Phase 9 changes.

Hard stop:

- If the checkpoint cannot be created because the working tree has ambiguous
  unrelated user changes, stop and ask for direction. Do not begin Phase 9 code
  deletion on top of an ambiguous uncommitted Phase 8 / 8.5 batch.

## Step 1: Delete App Menu Compatibility Barrel

Purpose: remove the misleading local model API before moving product wiring.

Work:

1. Change app-menu component/index imports to read app-menu model exports
   directly from `ui-framework`.
2. Delete `apps/wallpaper-tesseract/src/features/app-menu/app-menu-model.ts`.
3. Update tests and architecture boundaries so the old relative import is
   forbidden rather than expected.

Exit grep:

```text
rg -n "from [\"']\\./app-menu-model[\"']|app-menu-model" apps/wallpaper-tesseract/src/features/app-menu apps/wallpaper-tesseract/src/architecture-boundaries.test.ts -g "*.ts"
```

Expected result: no production import from `./app-menu-model`, no local
`app-menu-model.ts` file, and architecture tests assert the deletion.

Validation:

```text
npm run test -w wallpaper-tesseract -- app-menu-bar-component app-menu-bar-actor-factory architecture-boundaries
npm run typecheck -w wallpaper-tesseract
```

## Step 2: Move Hierarchy Source Ownership Into Tool Windows

Purpose: delete product-level hierarchy metadata assembly.

Work:

1. Change `installToolWindowFeatures` so it creates its own actor-backed
   hierarchy source from `options.context.actorSystem`.
2. Remove the required `hierarchyObjectSource` option from
   `InstallToolWindowFeaturesOptions`.
3. Remove product-level hierarchy metadata merge from
   `install-wallpaper-product-features.ts`.
4. Delete public metadata helper exports unless another production owner still
   needs them:
   - `createSceneActorHierarchyMetadata`
   - `createToolWindowActorHierarchyMetadata`
   - `createAppMenuActorHierarchyMetadata`
5. Prefer relying on actor names, runtime parent ids, and actor creation order.
   Do not add a metadata registry unless browser hierarchy evidence proves
   name/order is insufficient and no owner-local deletion-first solution exists.
6. If an owner-local declaration is proven necessary, it must be provided by
   the owner that creates the actor and consumed through a narrow owner API.
   Tool Windows must not import Scene, Tesseract, Camera3, App Menu, Inspector,
   Workspace Root, or product metadata helpers.
7. Update hierarchy tests to prove Scene/Tesseract/Camera3/Debug/Hierarchy/
   App Menu still appear exactly once after boot and after Scene close/reopen.
8. Add a fast unit or integration regression, not only browser smoke, covering
   repeated Scene close/reopen and asserting Scene/Tesseract4/Camera3 hierarchy
   rows are not duplicated or lost.

Exit grep:

```text
rg -n "createActorHierarchyObjectSource|createSceneActorHierarchyMetadata|createToolWindowActorHierarchyMetadata|createAppMenuActorHierarchyMetadata|metadataByActorId" apps/wallpaper-tesseract/src/features/install-wallpaper-product-features.ts apps/wallpaper-tesseract/src/features packages/editor/src/tool-windows -g "*.ts" -g "!**/*.test.ts"
rg -n "hierarchyObjectSource" apps/wallpaper-tesseract/src/features packages/editor/src/tool-windows -g "*.ts" -g "!**/*.test.ts"
rg -n "scene|tesseract|camera3|app-menu|workspace-root|inspector" packages/editor/src/tool-windows -g "*.ts" -g "!**/*.test.ts"
```

Allowed production result: `createActorHierarchyObjectSource` may remain in
`packages/editor/src/hierarchy`; the Tool Window/Hierarchy owner may call it.
Product composition must not call it, and Tool Windows must not contain a
cross-feature static metadata table. The third grep may still match view keys
that are intrinsic to Tool Windows, but it must not reveal Scene/Tesseract/
Camera3/App Menu/Workspace Root/Inspector facts.

Validation:

```text
npm run test -w editor -- hierarchy tool-windows
npm run test -w wallpaper-tesseract -- hierarchy install-scene-view-feature architecture-boundaries project-prism-boundary-report
```

Browser evidence requirement:

- Fresh boot hierarchy contains Scene, Tesseract4, Camera3, Debug Log Window,
  Hierarchy Panel, App Menu, and Workspace Root exactly once.
- Scene close/reopen does not create duplicate hierarchy rows.

## Step 3: Remove Product Installer Shell

Purpose: delete the remaining broad product feature installer instead of
renaming it.

Work:

1. Move product window policy composition into explicit top-level app
   composition using owner installers:
   - `installSceneWorkspacePolicy`
   - `installInspectorWorkspacePolicy`
   - `installToolWindowWorkspacePolicy`
   - `installWorkspaceModeState`
2. Move feature installation into explicit top-level app composition using
   owner installers:
   - `installSceneViewFeature`
   - `installInspectorFeature`
   - `installToolWindowFeatures`
   - `installAppMenuFeature`
   - `installWorkspaceModeController` or its renamed Step 5 replacement
   App composition may own install order and dependency passing here. It must
   not own feature actor ids, hierarchy metadata, default state construction,
   runtime Scene resources, or reusable product policy objects.
3. Inline or move the debug-log sink so
   `createWallpaperDebugLogSink` disappears. Prefer a local app-level closure
   that bridges `GizmoEventSystem.onDebugLog` to the Debug Log content binding;
   it should expose no reusable product service.
4. Delete
   `apps/wallpaper-tesseract/src/features/install-wallpaper-product-features.ts`.
5. Update `create-wallpaper-app.ts` to dispose the workspace-mode command
   registration directly. Do not keep a product feature object solely for
   disposal.
6. Update architecture tests that currently expect
   `installWallpaperProductFeatures`, `installAppMenuFeature`, or
   `installToolWindowFeatures` to live behind the product installer.
7. Do not replace this file with another broad installer such as
   `installWallpaperFeatures`, `installProductFeatures`,
   `composeWallpaperProduct`, or a new `product-policy` module.

Exit grep:

```text
rg -n "installWallpaperProductStateDefaults|installWallpaperProductFeatures|createWallpaperDebugLogSink|WallpaperProductWindowPolicy|WallpaperDebugLogSink|InstalledWallpaperProductFeatures" apps/wallpaper-tesseract/src packages -g "*.ts" -g "!**/*.test.ts"
rg -n "installWallpaperFeatures|installProductFeatures|composeWallpaperProduct|product-policy|ProductFeatures|ProductWindowPolicy" apps/wallpaper-tesseract/src packages -g "*.ts" -g "!**/*.test.ts"
Test-Path apps/wallpaper-tesseract/src/features/install-wallpaper-product-features.ts
```

Expected result: grep has no production matches and the deleted file test is
`False`. Any proposed new broad product composition module fails this step.

Allowed app composition imports after this step:

- public owner installers;
- public bootstrap ports;
- package component-definition installers;
- no concrete actor factory imports;
- no product actor id constants;
- no default state helper imports outside owner policy installation.

Validation:

```text
npm run test -w wallpaper-tesseract -- component-definitions scene-run-mode-command architecture-boundaries project-prism-boundary-report
npm run typecheck -w wallpaper-tesseract
```

## Step 4: Remove Tool Window Product Override Hooks

Purpose: stop keeping product-level actor id and label overrides that no
production caller uses.

Work:

1. Remove `ToolWindowActorIds` from the public tool-window API if production
   has no non-default caller.
2. Remove `actorIds`, `debugLogLabel`, and `hierarchyLabel` from
   `InstallToolWindowFeaturesOptions`.
3. Keep Debug and Hierarchy actor ids private to the tool-window owner.
4. Update tests to assert default actor ids and labels through created actors,
   not through override APIs.
5. Add or update a Tool Window API test that fails if
   `installToolWindowFeatures` accepts `hierarchyObjectSource`, `actorIds`,
   `debugLogLabel`, or `hierarchyLabel`.
6. Keep window policy helper functions private. They should not be re-exported
   through `packages/editor/src/tool-windows/index.ts`.

Exit grep:

```text
rg -n "ToolWindowActorIds|actorIds\\?:|debugLogLabel|hierarchyLabel|DEBUG_LOG_WINDOW_ACTOR_ID|HIERARCHY_PANEL_ACTOR_ID" packages/editor/src/tool-windows apps/wallpaper-tesseract/src -g "*.ts" -g "!**/*.test.ts"
```

Allowed result: private constants may remain in the tool-window implementation.
No exported type or option may preserve product override shape.

Validation:

```text
npm run test -w editor -- tool-windows debug hierarchy
npm run typecheck -w editor
```

## Step 5: Collapse Workspace Mode Into A Narrow Scene Run Command

Purpose: finish the `scene-run-mode-product-command` decision without moving
product semantics into `ui-framework` or `editor`.

Work:

1. Rename the module only if it reduces ambiguity:
   - preferred target: `features/scene-run-mode-command.ts`;
   - delete `features/workspace-mode.ts` in the same patch if renamed;
   - do not leave a compatibility barrel.
2. Rename installer exports to describe command ownership:
   - `installSceneRunModeState`
   - `installSceneRunModeCommand`
3. Stop returning the concrete controller object to app bootstrap. The
   installed command should return only `{ dispose(): void }`.
4. Make the controller class private unless another production owner truly
   needs it. Tests should exercise behavior through the installer or a local
   test-only construction in the same file if necessary.
5. Keep the command contract narrow:
   - read editor workspace mode state;
   - ensure/open Scene through the lifecycle port;
   - call `enterRunFullscreenForView` / `exitRunFullscreen`;
   - request Scene measurement after presentation changes.
6. Forbid direct visible-path fallback, runtime resource ownership, graph
   mutation, or placement state in this module.

Exit grep:

```text
rg -n "WorkspaceModeController|workspaceModeController|restoreVisiblePath|visiblePath|RuntimeScene|SceneViewFrameSourceRegistry|createRuntimeScene" apps/wallpaper-tesseract/src/features -g "*.ts" -g "!**/*.test.ts"
rg -n "scene-run-mode-product-command|workspace-mode\\.ts" apps/wallpaper-tesseract/src/test-support/project-prism-boundary-facts.ts apps/wallpaper-tesseract/src/architecture-boundaries.test.ts docs/current-project-progress.md
```

Expected result:

- no product-facing `WorkspaceModeController` API remains;
- if the file is renamed, no production import references
  `features/workspace-mode.ts`;
- boundary facts either remove `scene-run-mode-product-command` or reclassify
  it as accepted narrow app composition, not blocker debt.
- package/app barrels do not re-export a compatibility alias for the old
  workspace-mode file or controller name.

Validation:

```text
npm run test -w wallpaper-tesseract -- scene-run-mode-command app-menu-bar-component architecture-boundaries project-prism-boundary-report
npm run typecheck -w wallpaper-tesseract
```

If tests keep the old filename for Vitest selection, update the command and
progress document to the new test file name.

## Step 6: Flip Boundary Facts From Debt To Invariants

Purpose: make the completed cleanup impossible to regress.

Work:

1. Remove `app-composition-debt` if no production path remains that owns
   product internals.
2. Remove or close `wallpaper-app-concrete-feature-policy`.
3. Remove or reclassify `scene-run-mode-product-command` after Step 5.
4. Mark `wallpaper-app` package target as `allowed` only when all of these are
   true:
   - `install-wallpaper-product-features.ts` is deleted;
   - `features/app-menu/app-menu-model.ts` is deleted;
   - app composition imports owner installers only;
   - product actor ids and hierarchy metadata tables are not centralized;
   - `installToolWindowFeatures` has no hierarchy source, actor id, or label
     override options;
   - workspace mode is accepted as narrow command wiring or removed;
   - no public product-facing `WorkspaceModeController` object remains.
5. Strengthen `architecture-boundaries.test.ts`:
   - product installer file must be undefined;
   - app menu local model barrel must be undefined;
   - product composition must not import concrete actor factories;
   - product composition must not import product actor id constants;
   - app/product code must not import `createActorHierarchyObjectSource`,
     `createSceneActorHierarchyMetadata`,
     `createToolWindowActorHierarchyMetadata`, or
     `createAppMenuActorHierarchyMetadata`;
   - hierarchy metadata helper exports cannot be imported by app/product code;
   - tool-window public API must not expose `ToolWindowActorIds`,
     `hierarchyObjectSource`, `actorIds`, `debugLogLabel`, or
     `hierarchyLabel`;
   - deleted old Phase 7/8 modules remain undefined.
6. Keep blockers open if any of the old surfaces above remain in production,
   even if targeted tests pass.

Exit grep:

```text
rg -n "app-composition-debt|wallpaper-app-concrete-feature-policy|scene-run-mode-product-command" apps/wallpaper-tesseract/src/test-support/project-prism-boundary-facts.ts docs/current-project-progress.md docs/project-prism-engine-modularization-outline.md
rg -n "install-wallpaper-product-features|app-menu-model|createWallpaperDebugLogSink|create.*ActorHierarchyMetadata|ToolWindowActorIds" apps/wallpaper-tesseract/src packages/editor/src -g "*.ts" -g "!**/*.test.ts"
```

Validation:

```text
npm run test -w wallpaper-tesseract -- architecture-boundaries project-prism-boundary-report project-prism-frame-update-lane-map
```

## Step 7A: DCK-007 Dock Blocker Gate

Purpose: resolve the fresh-browser dock blocker before generating pass-state
Phase 9 smoke evidence.

Execute:

```text
docs/project-prism-phase-9-dck-007-blocker-resolution-plan.md
```

Decision:

- Do not roll back completed Phase 9 cleanup.
- Keep `wallpaper-app` allowed in boundary facts because the app-composition
  blocker is closed.
- Keep Phase 9 itself blocked until DCK-007 is fixed and the fresh browser
  smoke evidence file validates.

Expected owner-level fix path:

- first prove the semantic chain for failing `Scene -> Debug`:
  `beginTabDrag`, drag source, source tabset, move hits after leaving the tab,
  continued `moveTabDrag`, `endTabDrag` preview, intent, lifecycle commit
  result, graph mutation, and DOM realization;
- align `WorkspaceRootDockFrameComponent` root tab-drag session continuity with
  `FloatingWindowComponent` if, as current evidence suggests, root moves stop
  calling `moveTabDrag` after the pointer leaves the tab hit;
- inspect `resolveWindowDockPreview`, lifecycle/controller, graph, or surface
  realization only if evidence shows preview/commit/DOM fails after root drag
  continuity is fixed.

Required tests before returning to Step 7B:

```text
npm run test -w wallpaper-tesseract -- workspace-root-dock-frame-component floating-window-component window-frame-tab-input architecture-boundaries
npm run test -w ui-framework -- window-dock-targets window-tab-drag-session
```

`window-dock-targets` and `window-tab-drag-session` are always required because
the root-frame fix relies on those product-agnostic contracts. Add
`npm run test -w ui-framework -- window-frame-lifecycle-controller` if DCK-007
evidence reaches lifecycle/graph or the fix changes commit semantics.

Exit:

- owner-level tests prove `Scene -> Debug` root tab drag continues after the
  pointer leaves the tab hit and submits the expected dock intent. The test
  must simulate a tab start hit followed by non-tab move/end hits;
- no compatibility dock path, app-level DOM rehosting, product facade, or
  diagnostic-as-owner path is introduced;
- DCK-007 status in `docs/known-defects-and-todos.md` is updated to
  `fixed-pending-verification` only after code plus owner tests pass, and to
  `closed` only after fresh browser smoke, evidence validation, and final gate
  pass.

## Step 7B: Fresh Browser Evidence

Purpose: prove that deleting the product shell did not change real UI behavior.

Current pre-fix result:

- blocked by `DCK-007`.
- Partial fresh evidence is recorded in
  `temp/project-prism-phase-9-smoke-blocker-report.md` and
  `temp/project-prism-phase-9-smoke-blocker-data.json`.
- Passing subpaths before the blocker: boot baseline, menu hover target,
  3x Scene close/reopen with Hierarchy exact-once, and floating
  `Debug -> Scene` dock.
- Failing subpath: `Scene -> Debug` reverse dock did not visually or
  structurally mutate the root layout when targeting the Debug pane left area,
  Debug pane bottom area, or Debug tab strip.

Create only after Step 7A succeeds:

```text
temp/project-prism-phase-9-smoke-data.json
temp/project-prism-phase-9-smoke-report.md
```

Required scenarios:

- boot baseline with console errors equal 0;
- hierarchy exact-once after boot;
- Scene close/reopen, repeated at least 3 times;
- hierarchy exact-once after Scene close/reopen;
- Debug -> Scene dock and Scene -> Debug dock visual success;
- preview element evidence for each dock mutation:
  `data-dock-kind`, `data-target-frame-id`, and `data-target-tabset-id`;
- graph revision before/after and DOM pane/tabset delta for each dock
  mutation;
- splitter resize;
- Scene fullscreen/restore through workspace mode;
- hierarchy exact-once after fullscreen/restore;
- persistence reload after dock/split/fullscreen restore;
- app menu hover/click still routes through actor input;
- Camera3 action still updates view/gizmo evidence;
- mobile viewport remains usable, including tab close and Window menu reachability.

Validator command:

```text
$env:PROJECT_PRISM_SMOKE_EVIDENCE="temp/project-prism-phase-9-smoke-data.json"; npm run test -w wallpaper-tesseract -- project-prism-smoke-evidence-file
```

Do not reuse Phase 8, post-remaining-debt evidence, or the DCK-007 blocker data
as Phase 9 pass evidence.

## Final Gate

Run after code and docs are updated:

```text
$env:PROJECT_PRISM_SMOKE_EVIDENCE="temp/project-prism-phase-9-smoke-data.json"; npm run test -w wallpaper-tesseract -- project-prism-smoke-evidence-file
npm run test -w editor
npm run typecheck -w editor
npm run build -w editor
npm run test -w wallpaper-tesseract -- component-definitions scene-run-mode-command render-loop architecture-boundaries project-prism-boundary-report project-prism-frame-update-lane-map
npm run typecheck -w wallpaper-tesseract
npm run test
npm run typecheck
npm run build
```

Build may keep the existing Vite chunk-size warning. Any new runtime console
error, browser smoke failure, type error, or boundary blocker means the phase
does not close.

Record grep evidence in the Phase 9 smoke or closure report:

```text
rg -n "install-wallpaper-product-features|installWallpaperProduct|createWallpaperDebugLogSink|create.*ActorHierarchyMetadata|ToolWindowActorIds|hierarchyObjectSource|actorIds\\?:|debugLogLabel|hierarchyLabel|app-menu-model" apps/wallpaper-tesseract/src packages/editor/src -g "*.ts" -g "!**/*.test.ts"
```

Expected result: no production reference to the old product installer, old
metadata helpers from app/product code, old override hooks, or the old app-menu
model barrel. Private owner constants may remain only when they are intrinsic
to that owner.

## Stop Conditions

Stop and amend this plan if:

- hierarchy cannot remain correct without reintroducing a product metadata
  table;
- deleting `install-wallpaper-product-features.ts` forces app bootstrap to
  import concrete actor factories instead of owner installers;
- workspace mode needs direct graph/visible-path mutation to work;
- app menu cannot stay actor-input routed without the local model barrel;
- cleanup adds a new service locator, generic product facade, or compatibility
  wrapper;
- root smoke evidence shows regressions in dock, fullscreen, persistence,
  menu hover, Camera3 action, or hierarchy exact-once behavior.

## Closure Definition

Phase 9 closes when:

- a checkpoint commit exists for accepted Phase 8 / 8.5 work before Phase 9
  code deletion;
- `install-wallpaper-product-features.ts` is deleted;
- app-menu local model barrel is deleted;
- product hierarchy metadata aggregation is deleted;
- unused tool-window override hooks are deleted;
- workspace mode is either renamed/narrowed as Scene run command or removed,
  and no concrete controller object is exposed as a product service;
- `project-prism-boundary-facts.ts` no longer blocks `wallpaper-app` on
  app-composition debt;
- DCK-007 is fixed through the blocker plan;
- fresh Phase 9 browser evidence validates;
- root `test`, `typecheck`, and `build` pass.
