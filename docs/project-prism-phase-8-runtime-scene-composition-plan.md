# Project Prism Phase 8 Runtime Scene Composition And Product Policy Split Plan

Status: completed as of 2026-06-13. Steps 0-7 and the Phase 8.5 remaining-debt
closure are complete; the remaining items below are narrowed follow-up debt for
the next phase, not active Phase 8 blockers.

Phase 8 starts from the smaller debt left after Phase 7 closure. Phase 7
deleted old `app-runtime`, `runtime/ports`, `update-runtime`, old
`features/camera3`, old `tesseract4`, the mixed Scene content installer, and
old app-local bootstrap policy files under `src/app`.

Phase 8 must not turn that win into several smaller facades. The work is not to
rename `install-wallpaper-product-features.ts` into multiple wrappers. The work
is to choose one owner for each remaining fact, delete the central copy, and
make boundary tests prove the old shape cannot return.

## Completed And Narrowed Debt

These blocker ids were the authoritative Phase 8 execution units. Keep their
current follow-up status in sync with:

```text
apps/wallpaper-tesseract/src/test-support/project-prism-boundary-facts.ts
```

- `wallpaper-app-concrete-feature-policy`
  - Current files:
    `apps/wallpaper-tesseract/src/features/install-wallpaper-product-features.ts`
  - Status: narrowed follow-up debt.
  - Result: `create-wallpaper-app.ts` no longer owns concrete feature setup,
    and product-level Scene/Tesseract/Camera3 internal actor ids and
    render/measure hooks have moved to feature/runtime owners. Scene and
    Debug/Hierarchy default state registration plus floating/default view policy
    construction now live in their owner modules.
  - Remaining debt: hierarchy source assembly, owner policy contribution
    composition, app menu wiring, tool/inspector/scene installation, workspace
    mode installation, and product feature ordering are still centralized in
    the product installer.
- `scene-run-mode-product-command`
  - Current files:
    `apps/wallpaper-tesseract/src/features/workspace-mode.ts`
  - Status: narrowed follow-up debt.
  - Result: workspace mode is now limited to product command orchestration for
    editor mode and Scene run fullscreen; its state registration and controller
    subscription are owned by `workspace-mode.ts`. The old direct visible-path
    fallback state machine has been deleted.
- `scene-runtime-composition-feature-installer`
  - Current files:
    `apps/wallpaper-tesseract/src/features/scene/index.ts`
    `apps/wallpaper-tesseract/src/features/scene/install-scene-view-feature.ts`
  - Status: closed by Phase 8.5.
  - Result: runtime Scene frame-source registration and disposal moved to
    `RuntimeSceneViewRuntime`, `features/scene/index.ts` no longer re-exports
    runtime frame-source staging, and the old feature-local renderable Scene
    bridge remains deleted.
- `DCK-006`
  - Current evidence:
    `temp/project-prism-phase-8-smoke-report.md`
    `temp/project-prism-phase-8-smoke-blocker-data.json`
  - Resolution plan:
    `docs/project-prism-phase-8-dck-006-dock-blocker-plan.md`
  - Status: closed.
  - Result: real browser smoke now docks floating Debug into the root Scene
    split and validates `temp/project-prism-phase-8-smoke-data.json`.

## Non-Negotiables

- No compatibility facade wrapping `install-wallpaper-product-features.ts`.
- No duplicate actor id, view descriptor, hierarchy metadata, runtime Scene
  owner, frame source, or window placement truth.
- No editor-owned runtime world, camera, render output, render target, or Scene
  session.
- No broad `as` cast or fake test port to preserve the old installer shape.
- No package extraction that only relocates the same mixed responsibilities.
- Delete the old owner in the same slice that introduces the replacement owner.
- If an owner decision is not yet clear, freeze the blocker and write the
  decision rule instead of adding a temporary adapter.

## Entry Gate

Run before implementation:

```text
git status --short
$env:PROJECT_PRISM_SMOKE_EVIDENCE="temp/project-prism-phase-7-smoke-data.json"; npm run test -w wallpaper-tesseract -- project-prism-smoke-evidence-file
npm run test -w wallpaper-tesseract -- runtime-scene-session runtime-work-attachment-runtime camera3-components tesseract4 install-scene-view-feature component-definitions workspace-mode architecture-boundaries project-prism-boundary-report project-prism-frame-update-lane-map
npm run typecheck -w wallpaper-tesseract
npm run test
npm run typecheck
npm run build
```

If this fails, fix the failing owner or test drift. Do not add compatibility
aliases to make Phase 8 easier to start.

## Step 0: Freeze Baseline And Clean Phase 8 Semantics

Purpose: make the current blocker surface objective before moving code.

Work:

- Capture the current blocker list from `project-prism-boundary-facts.ts`.
- Confirm the production grep baseline below matches current code.
- Update docs so Phase 8 has one meaning: runtime Scene composition and product
  feature policy split.
- Remove or rewrite stale references to "Phase 8: Multi-World /
  Multi-Viewport Validation" as the current phase. Multi-world/multi-viewport
  remains a later validation goal, not this phase's active scope.

Production grep baseline:

```text
rg -n "SCENE_WINDOW_ACTOR_ID|TESSERACT4_ACTOR_ID|CAMERA3_GIZMO_ACTOR_ID|DEBUG_LOG_WINDOW_ACTOR_ID|HIERARCHY_PANEL_ACTOR_ID|createActorHierarchyObjectSource|createDefault.*WindowState|create.*FloatingFramePolic|installSceneViewFeature|installToolWindowFeatures|installInspectorFeature|installAppMenuFeature|WorkspaceModeController" apps/wallpaper-tesseract/src/features/install-wallpaper-product-features.ts
rg -n "installWallpaperComponentDefinitions|installGizmoRuntimeComponentDefinitions|central-component-definition-installer|gizmo-runtime-definition-installer" apps/wallpaper-tesseract/src packages docs/current-project-progress.md docs/known-defects-and-todos.md -g "*.ts" -g "*.md"
rg -n "createSceneViewActor|createCamera3GizmoActor|createRuntimeSceneViewRuntime|createRenderableSceneView|RenderableSceneView|SceneViewFrameSourceRegistry" apps/wallpaper-tesseract/src/features/scene apps/wallpaper-tesseract/src/runtime -g "*.ts" -g "!**/*.test.ts"
```

Boundary facts baseline:

- `wallpaper-app` remains blocked by `app-composition-debt`.
- Runtime package targets remain allowed, but `runtime-ownership-debt` names the
  Scene feature composition files.
- No active blocker references deleted old paths:
  `app-runtime`, `runtime/ports`, `update-runtime`, old `features/camera3`, or
  old `tesseract4`.

Validation:

```text
npm run test -w wallpaper-tesseract -- architecture-boundaries project-prism-boundary-report
```

Exit:

- `docs/current-project-progress.md` and
  `docs/project-prism-engine-modularization-outline.md` describe Phase 8 with
  the same scope as this file.
- The old multi-world/multi-viewport Phase 8 section is removed or retitled as
  a later post-Phase-8 validation goal.

## Step 1: Define Feature Descriptor Ownership Before Moving Product Policy

Blocks:

- `wallpaper-app-concrete-feature-policy`

Purpose: prevent actor ids, view descriptors, and hierarchy metadata from being
copied into several feature files and then re-aggregated by a new facade.

Target:

```text
apps/wallpaper-tesseract/src/features/install-wallpaper-product-features.ts
packages/editor/src/tool-windows/install-tool-window-features.ts
packages/editor/src/inspector/install-inspector-feature.ts
apps/wallpaper-tesseract/src/features/scene/install-scene-view-feature.ts
apps/wallpaper-tesseract/src/features/app-menu/install-app-menu-feature.ts
```

Target ownership shape:

- Each feature owns a public descriptor only for facts it can authoritatively
  define:
  - logical view type/instance/default descriptor;
  - default window/floating policy for that feature;
  - feature actor ids only if they are private to that feature installer;
  - hierarchy labels only if the hierarchy source consumes feature descriptors
    rather than central maps.
- The product installer may order owner-owned installers and connect ports. It
  must not duplicate ids, default descriptors, or metadata that a feature
  already owns.

Work order:

1. Add or expose narrow descriptor values from existing feature owners only when
   doing so deletes central product policy.
2. Move Debug/Hierarchy default view and floating policies to editor
   tool-window ownership if the editor package can own them without importing
   app runtime.
3. Keep Inspector descriptor ownership in `packages/editor/src/inspector`.
4. Move App Menu command descriptors only when the app-menu feature can own
   them without reintroducing product window policy.
5. Keep Scene/Tesseract/Camera actor ids, view descriptors, and hierarchy
   metadata in the current product policy file until Step 3 establishes the
   runtime Scene contract. Do not create a Scene descriptor API that freezes
   today's cross-domain coupling.
6. After Step 3, move Scene/Tesseract/Camera descriptors only if the target
   owner no longer creates editor actor, runtime content, Camera3 gizmo, and
   renderable bridge from one installer.
7. Move hierarchy metadata consumption toward feature descriptors; do not
   create a second central metadata registry.
8. Delete the corresponding constants and maps from
   `install-wallpaper-product-features.ts`.

Production grep that must shrink:

```text
rg -n "SCENE_WINDOW_ACTOR_ID|TESSERACT4_ACTOR_ID|CAMERA3_GIZMO_ACTOR_ID|DEBUG_LOG_WINDOW_ACTOR_ID|HIERARCHY_PANEL_ACTOR_ID|SCENE_WINDOW_ACTOR_NAME|TESSERACT4_ACTOR_NAME|CAMERA3_GIZMO_ACTOR_NAME|DEBUG_LOG_WINDOW_ACTOR_NAME|HIERARCHY_PANEL_ACTOR_NAME|createActorHierarchyObjectSource|create.*DefaultOpenView|create.*FloatingFramePolic" apps/wallpaper-tesseract/src/features/install-wallpaper-product-features.ts
```

Allowed temporary matches:

- `install-wallpaper-product-features.ts` may keep a feature ordering list and
  port wiring until replacement owners exist.
- No allowed match may duplicate an owner-owned descriptor.

Test/support audit:

```text
rg -n "wallpaper-app-concrete-feature-policy|install-wallpaper-product-features|SCENE_WINDOW_ACTOR_ID|DEBUG_LOG_WINDOW_ACTOR_ID|HIERARCHY_PANEL_ACTOR_ID" apps/wallpaper-tesseract/src apps/wallpaper-tesseract/src/test-support packages/editor -g "*.ts"
```

Boundary fact delta:

- Remove `wallpaper-app-concrete-feature-policy` only when the production grep
  above is zero or the remaining file list is a smaller, current owner.
- If a small product ordering file remains, rename the blocker to describe the
  exact remaining fact instead of keeping the broad current blocker.

Validation:

```text
npm run test -w editor
npm run test -w wallpaper-tesseract -- component-definitions workspace-mode architecture-boundaries project-prism-boundary-report
npm run typecheck -w wallpaper-tesseract
```

Stop if:

- A descriptor move requires editor to import app-local runtime.
- Product policy is merely split into several files and re-collected by another
  central installer.

## Step 2A: Split Component Definitions With Clear Package Owners Only

Status: complete. `installGizmoRuntimeComponentDefinitions`,
`gizmo-runtime/install-component-definitions.ts`, and the central app-local
component-definition installer have been deleted. App bootstrap now composes
package/owner installers directly.

Blocks:

- completed: `central-component-definition-installer`
- completed: `gizmo-runtime-definition-installer`

Purpose: remove obvious central installer responsibilities without destabilizing
Scene/Camera/Tesseract ownership before the runtime Scene contract is clearer.

Target:

```text
apps/wallpaper-tesseract/src/features/install-wallpaper-component-definitions.ts
apps/wallpaper-tesseract/src/gizmo-runtime/install-component-definitions.ts
```

Move first:

- Definitions already owned by packages:
  - `installWindowComponentDefinitions`
  - `installEditorComponentDefinitions`
  - package-owned actor/input/gizmo binding definitions if the owner can
    install them without app-local runtime knowledge.
- Definitions owned by self-contained feature packages or feature folders:
  - app-menu definitions may remain under `features/app-menu` until UI
    framework ownership is clear, but they should not be routed through a
    central all-feature app installer if direct feature installation is simpler.

Do not move yet in Step 2A:

- Scene/Camera/Tesseract definitions that depend on Step 3's runtime Scene
  contract.
- A mixed "product definitions" installer that still knows every feature.

Production grep:

```text
rg -n "installGizmoRuntimeComponentDefinitions|installWallpaperComponentDefinitions|gizmo-runtime-definition-installer|central-component-definition-installer" apps/wallpaper-tesseract/src packages docs/current-project-progress.md docs/known-defects-and-todos.md -g "*.ts" -g "*.md"
rg -n "installActorInputComponentDefinitions|installWindowComponentDefinitions|installAppMenuComponentDefinitions|installEditorComponentDefinitions|installSceneCamera3ComponentDefinitions|installTesseract4ComponentDefinitions" apps/wallpaper-tesseract/src/app/create-wallpaper-app.ts
```

Boundary fact delta:

- Narrow `central-component-definition-installer` after package-owned
  definitions leave the central file.
- Narrow or remove `gizmo-runtime-definition-installer` only when the
  app-local gizmo definition file no longer owns package-level actor/gizmo
  binding facts.

Validation:

```text
npm run test -w actor-input
npm run test -w ui-framework
npm run test -w editor
npm run test -w wallpaper-tesseract -- component-definitions architecture-boundaries project-prism-boundary-report
npm run typecheck -w wallpaper-tesseract
```

## Step 3: Establish Runtime Scene Session Contract Before Deleting Feature Assembly

Status: complete for the Phase 8 slice. Runtime renderable frame-source
ownership moved to `runtime/runtime-scene-frame-source.ts`; runtime session and
content composition is now behind `runtime/runtime-scene-view-runtime.ts`.
Remaining Scene feature debt is narrower: it still binds editor Scene actor
creation, runtime Scene view runtime attachment, and Camera3 gizmo creation.

Blocks:

- `scene-runtime-composition-feature-installer`

Purpose: define the target shape so Scene feature code binds presentation ports
instead of owning runtime construction.

Target:

```text
apps/wallpaper-tesseract/src/runtime/runtime-scene-session.ts
apps/wallpaper-tesseract/src/runtime/runtime-scene-content.ts
apps/wallpaper-tesseract/src/features/scene/install-scene-view-feature.ts
apps/wallpaper-tesseract/src/features/scene/renderable-scene-view.ts
```

Target contract:

- Runtime owner exposes:
  - structural `renderTarget`;
  - camera command port;
  - camera view-state/query port;
  - frame-source/render port;
  - measurement input needed by runtime rendering;
  - `dispose`.
- Runtime owner may receive pure data/port inputs only, such as render target
  descriptors, camera command/query ports, visibility snapshots, measurement
  snapshots, and frame scheduling ports.
- Runtime owner must not receive editor or presentation owner types such as
  `EditorSceneViewHost`, `HTMLElement`, DOM nodes, window location sources,
  dock/window presentation controllers, or UI component instances.
- Scene feature owns:
  - editor Scene actor presentation creation;
  - DOM/presentation binding to the runtime `renderTarget`;
  - wiring editor commands to runtime ports;
  - no direct runtime object construction once the runtime owner exists.

Actor-tree coupling decision:

- `runtime-scene-content.ts` currently accepts `ActorCreationContext` and
  `sceneActor`. Treat this as Phase 8 debt, not a settled long-term design.
- Either:
  - move actor creation for runtime-only content behind a runtime-owned actor
    content installer that receives a narrow actor creation scope; or
  - prove that these are editor-visible actors and document why the Scene actor
    is the single owner.
- Do not let runtime code import editor presentation to resolve this coupling.

Production grep that must shrink:

```text
rg -n "createRuntimeSceneSession|createRuntimeSceneContent|createCamera3GizmoActor|createSceneViewActor|createRuntimeSceneViewRuntime|createRenderableSceneView|new SceneViewFrameSourceRegistry|new RenderableSceneView" apps/wallpaper-tesseract/src/features/scene apps/wallpaper-tesseract/src/runtime -g "*.ts" -g "!**/*.test.ts"
rg -n "ActorCreationContext|sceneActor" apps/wallpaper-tesseract/src/runtime/runtime-scene-content.ts apps/wallpaper-tesseract/src/runtime/runtime-scene-session.ts
rg -n "EditorSceneViewHost|HTMLElement|Document|WindowLocation|WindowWorkspacePresentation|WindowFrame|Dock" apps/wallpaper-tesseract/src/runtime/runtime-scene-session.ts apps/wallpaper-tesseract/src/runtime/runtime-scene-content.ts apps/wallpaper-tesseract/src/runtime/runtime-scene-view-runtime.ts apps/wallpaper-tesseract/src/runtime/runtime-scene-frame-source.ts
```

Allowed temporary matches:

- Runtime owner files may keep `createRuntimeSceneSession` and
  `createRuntimeSceneContent`.
- Scene feature may keep presentation actor creation while runtime construction
  is being removed.
- `ActorCreationContext` / `sceneActor` matches must be explicitly resolved or
  carried as a narrower boundary blocker at step exit.
- Presentation type matches in runtime Scene owner files have no allowed
  temporary form; remove the dependency or stop and amend the owner contract.

Boundary fact delta:

- Remove `scene-runtime-composition-feature-installer` only when
  `install-scene-view-feature.ts` no longer assembles editor actor, runtime
  session/content, Camera3 gizmo, and renderable bridge together.
- If runtime actor-tree coupling remains, add a narrower blocker naming
  `runtime-scene-content.ts` and its deletion condition.

Validation:

```text
npm run test -w wallpaper-tesseract -- runtime-scene-session camera3-components tesseract4 install-scene-view-feature architecture-boundaries project-prism-boundary-report project-prism-frame-update-lane-map
npm run typecheck -w wallpaper-tesseract
```

Stop if:

- Runtime Scene owner needs editor package imports.
- The replacement simply moves the mixed Scene installer into `runtime/`.

## Step 4: Finish Scene/Camera/Tesseract Definition Installation

Status: complete. `install-wallpaper-component-definitions.ts` was deleted.
App bootstrap now calls Scene/Camera and Tesseract owner installers directly.

Blocks:

- completed: `central-component-definition-installer`
- narrowed: `scene-runtime-composition-feature-installer`

Purpose: finish component definition cleanup after Step 3 stabilizes the
runtime Scene contract.

Work:

- Move Scene/Camera/Tesseract definition installation to the owner established
  by Step 3.
- Delete `install-wallpaper-component-definitions.ts` if it no longer removes
  real duplication.
- If a tiny product installer remains, it must compose owner-owned install
  functions without knowing concrete components.

Production grep:

```text
rg -n "installWallpaperComponentDefinitions|install-wallpaper-component-definitions" apps/wallpaper-tesseract/src packages -g "*.ts"
rg -n "installSceneCamera3ComponentDefinitions|installTesseract4ComponentDefinitions" apps/wallpaper-tesseract/src/app/create-wallpaper-app.ts apps/wallpaper-tesseract/src/features apps/wallpaper-tesseract/src/runtime -g "*.ts" -g "!**/*.test.ts"
```

Boundary fact delta:

- Remove or narrow `central-component-definition-installer`.
- Ensure `projectPrismAppCompositionBlockers` no longer lists a deleted
  installer file.

Validation:

```text
npm run test -w wallpaper-tesseract -- component-definitions runtime-scene-session camera3-components tesseract4 architecture-boundaries project-prism-boundary-report
npm run typecheck -w wallpaper-tesseract
```

## Step 5: Keep Workspace Mode As Product Command Module, Then Narrow It

Blocks:

- `scene-run-mode-product-command`

Purpose: avoid prematurely moving Scene/run-fullscreen semantics into
`ui-framework`.

Target:

```text
apps/wallpaper-tesseract/src/features/workspace-mode.ts
```

Owner decision:

- Short term, treat workspace mode as a product command module because it knows
  Scene/run fullscreen semantics.
- Do not move it into `ui-framework` unless run/fullscreen becomes a
  product-agnostic presentation policy.
- Do not move it into `packages/editor` if it would make editor own window
  lifecycle or runtime Scene facts.

Work:

- Remove any duplicated state that can be queried from editor state or window
  lifecycle owners.
- Keep only command orchestration that genuinely belongs to product behavior.
- Delete direct Scene-specific branches when Step 3 gives a narrower runtime or
  Scene command port.

Production grep:

```text
rg -n "enterRunFullscreenForView|exitRunFullscreen|restoreVisiblePath|workspaceMode|scene" apps/wallpaper-tesseract/src/features/workspace-mode.ts
rg -n "WorkspaceModeController" apps/wallpaper-tesseract/src -g "*.ts" -g "!**/*.test.ts"
```

Boundary fact delta:

- Keep `scene-run-mode-product-command` if product command semantics remain.
- Narrow its blocker text to the exact remaining product command facts.
- Remove it only when ownership is clear and the file is deleted or moved.

Validation:

```text
npm run test -w wallpaper-tesseract -- workspace-mode app-menu-bar-component architecture-boundaries project-prism-boundary-report
npm run typecheck -w wallpaper-tesseract
```

## Step 6: Strengthen Smoke Contract Before Collecting Phase 8 Evidence

Purpose: prevent another structurally valid smoke file that only records notes.

Target:

```text
apps/wallpaper-tesseract/src/test-support/project-prism-smoke-contract.ts
apps/wallpaper-tesseract/src/test-support/project-prism-smoke-contract.test.ts
apps/wallpaper-tesseract/src/test-support/project-prism-smoke-evidence-file.test.ts
```

Contract additions:

- Menu hover evidence:
  - hovered menu row label;
  - highlighted menu row label;
  - pointer position;
  - screenshot path.
- Debug/Scene dock evidence:
  - before and after graph revision;
  - source/target view identities;
  - after DOM parent frame/tabset/content mapping;
  - visual screenshot path.
- Mobile viewport evidence:
  - viewport size;
  - Scene rect;
  - Tesseract/canvas measurable rect;
  - Window menu measurable rect;
  - Camera3 gizmo measurable rect.
- Camera3 action evidence:
  - action name;
  - before/after camera state or view-state hash;
  - action result fields proving the event was routed.

Production/test grep:

```text
rg -n "menuHover|dockMutation|mobileViewport|camera3Action|actionResultContains" apps/wallpaper-tesseract/src/test-support/project-prism-smoke-contract.ts apps/wallpaper-tesseract/src/test-support/project-prism-smoke-contract.test.ts apps/wallpaper-tesseract/src/test-support/project-prism-smoke-evidence-file.test.ts
```

Validation:

```text
npm run test -w wallpaper-tesseract -- project-prism-smoke-contract project-prism-smoke-evidence-file
```

Exit:

- `project-prism-smoke-contract.test.ts` has negative fixture tests proving
  validation fails when `menuHover`, `dockMutation`, `mobileViewport`, or
  `camera3Action` evidence is missing.
- The validator fails when the Phase 8 evidence file omits fresh menu hover,
  dock mutation, mobile viewport, or Camera3 action evidence.
- `project-prism-smoke-evidence-file.test.ts` is used only with
  `PROJECT_PRISM_SMOKE_EVIDENCE` set when validating real files; do not treat
  its no-env skip path as smoke contract coverage.
- Phase 7 evidence remains historical; do not mutate it to satisfy Phase 8.

## Step 7: Collect Fresh Phase 8 Browser Evidence

Status: complete after the `DCK-006` fix.

Completed before the blocker:

- App booted at `http://127.0.0.1:5173/?resetWorkspaceLayout=1`.
- Window menu opened; coordinate hit evidence and screenshot were captured for
  the `Debug Log Window` menu row.
- `ui-framework` was rebuilt before retrying dock smoke to avoid stale package
  output from `DEV-001`.

Original blocking result:

- Dragging the floating `Debug` tab into the root `Scene` area, Scene tab strip,
  and Scene right-edge area did not dock.
- DOM after each attempt still had `Debug` under
  `.floating-gizmo-window__titlebar`; root text remained Scene-only.
- Screenshot evidence:
  - `temp/project-prism-phase-8-dock-debug-into-scene.png`
  - `temp/project-prism-phase-8-dock-debug-into-scene-attempt-2.png`
  - `temp/project-prism-phase-8-dock-debug-into-scene-after-ui-framework-build.png`

Completed resolution:

- `docs/project-prism-phase-8-dck-006-dock-blocker-plan.md` was executed.
- The production fix is in `FloatingWindowComponent` and
  `handleWindowFrameTabInputEnd`; no smoke contract relaxation or compatibility
  dock path was added.
- `floating-window-component.test.ts` proves a tab drag stays active after the
  pointer leaves the tab hit and still submits a split dock intent.
- Fresh Phase 8 browser evidence was created and validated.

Required fresh browser actions:

- App boots with zero console errors.
- Window menu opens and hover highlight follows the actual hovered row.
- Debug/Scene repeated dock path succeeds visually and records graph/DOM change.
- Scene fullscreen enter/exit restores graph/DOM/input parity.
- Narrow/mobile viewport keeps Window menu, Scene view, Tesseract/canvas, and
  Camera3 gizmo measurable.
- Camera3 gizmo interaction changes camera behavior or view-state hash.

Store evidence under:

```text
temp/project-prism-phase-8-smoke-data.json
temp/project-prism-phase-8-smoke-report.md
```

Validate:

```text
$env:PROJECT_PRISM_SMOKE_EVIDENCE="temp/project-prism-phase-8-smoke-data.json"; npm run test -w wallpaper-tesseract -- project-prism-smoke-evidence-file
```

Executed validation:

```text
$env:PROJECT_PRISM_SMOKE_EVIDENCE="temp/project-prism-phase-8-smoke-data.json"; npm run test -w wallpaper-tesseract -- project-prism-smoke-evidence-file
npm run test -w wallpaper-tesseract -- floating-window-component window-frame-tab-input architecture-boundaries
npm run test -w ui-framework -- window-tab-drag-session window-dock-targets dock-target-region-source window-dock-preview-component
npm run test
npm run typecheck
npm run build
```

## Final Gate

Phase 8 can close when:

- All blocker ids above are removed or narrowed to smaller current files.
- No blocker references deleted old Phase 7 paths.
- Product policy, component definition installation, Scene runtime
  composition, and workspace-mode ownership no longer sit in one broad
  app-local layer.
- Smoke contract enforces fresh Phase 8 behavioral evidence.
- Boundary tests that currently assert transitional Phase 7 shape are flipped
  after the corresponding step succeeds. Current locks already require
  `install-scene-view-feature.ts` not to call `createRuntimeSceneSession` or
  `createRuntimeSceneContent`; remaining Scene feature assembly debt is tracked
  by the narrowed `scene-runtime-composition-feature-installer` blocker.
- Root validation passes:

```text
npm run test
npm run typecheck
npm run build
```

- Fresh Phase 8 smoke evidence validates:

```text
$env:PROJECT_PRISM_SMOKE_EVIDENCE="temp/project-prism-phase-8-smoke-data.json"; npm run test -w wallpaper-tesseract -- project-prism-smoke-evidence-file
```

## Stop Conditions

Stop and amend this plan if:

- A move requires editor to import app-local runtime ownership.
- A move requires runtime code to import editor/UI presentation details.
- Product policy is replaced by another central facade.
- Component definition cleanup creates several small central installers with
  the same mixed ownership.
- Smoke evidence can pass with notes only for any required fresh action.
