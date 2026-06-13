# Project Prism Phase 8.5 Remaining Debt Closure Gate

Status: completed on 2026-06-13.

Purpose: close the remaining product-installer, Scene runtime composition, and
workspace-mode ownership debt before starting the next larger Project Prism
phase.

This is a temporary direction adjustment, not a compatibility migration. The
target is to delete or narrow the remaining mixed owners, not to wrap them in a
new layer.

## Accepted Reviewer Decisions

These decisions are part of the execution contract:

- Scene View actor is the visible actor-tree parent anchor for Scene runtime
  content.
- Runtime owns the runtime content subtree and runtime ids. Runtime content may
  attach under the Scene View actor through a generic actor-core parent
  relationship, but product installer does not own those runtime ids.
- Camera3 gizmo remains an editor presentation actor. It operates Camera3
  motion through runtime command/query ports.
- `workspace-mode.ts` can temporarily remain a narrow product command module.
  It must be evaluated last and must not regain window placement or runtime
  resource ownership.
- Phase 8 closure does not require deleting
  `install-wallpaper-product-features.ts` entirely, but it does require
  deleting runtime/editor internal fact ownership from that file. A remaining
  file may only be a thin product composition surface.
- Post-cleanup browser evidence should use a new file:

```text
temp/project-prism-post-remaining-debt-smoke-data.json
temp/project-prism-post-remaining-debt-smoke-report.md
```

Keep `temp/project-prism-phase-8-smoke-data.json` as the DCK-006 closure
baseline.

## Closure Result

Phase 8.5 closed the runtime Scene composition blocker and narrowed the
remaining app-composition debt.

Closed or narrowed facts:

- `scene-runtime-composition-feature-installer` was removed from boundary
  facts. Runtime Scene content ids and frame-source registration are now owned
  by runtime Scene view ownership.
- `wallpaper-app-concrete-feature-policy` remains as narrowed
  app-composition debt. It no longer owns Scene/Tesseract/Camera3 internal ids
  and no longer exposes Scene render/measure hooks. Continued Phase 8 cleanup
  also moved Scene and Debug/Hierarchy default state registration plus
  floating/default view policy construction to their owner modules; product
  installation now composes those owner policy contributions.
- `scene-run-mode-product-command` remains as a narrowed product command
  module. It owns workspace-mode state registration/subscription and must not
  regain placement or runtime resource truth.

Implementation evidence:

```text
apps/wallpaper-tesseract/src/features/install-wallpaper-product-features.ts
apps/wallpaper-tesseract/src/features/scene/install-scene-view-feature.ts
apps/wallpaper-tesseract/src/features/scene/index.ts
apps/wallpaper-tesseract/src/runtime/runtime-scene-view-runtime.ts
apps/wallpaper-tesseract/src/runtime/runtime-scene-content.ts
apps/wallpaper-tesseract/src/runtime/runtime-scene-view-runtime.test.ts
apps/wallpaper-tesseract/src/features/workspace-mode.ts
apps/wallpaper-tesseract/src/test-support/project-prism-boundary-facts.ts
apps/wallpaper-tesseract/src/architecture-boundaries.test.ts
```

Fresh smoke evidence:

```text
temp/project-prism-post-remaining-debt-smoke-data.json
temp/project-prism-post-remaining-debt-smoke-report.md
```

Completed verification:

```text
$env:PROJECT_PRISM_SMOKE_EVIDENCE="temp/project-prism-post-remaining-debt-smoke-data.json"; npm run test -w wallpaper-tesseract -- project-prism-smoke-evidence-file
npm run test -w wallpaper-tesseract -- runtime-scene-view-runtime runtime-scene-session runtime-work-attachment-runtime camera3-components tesseract4 component-definitions workspace-mode architecture-boundaries project-prism-boundary-report project-prism-frame-update-lane-map
npm run typecheck -w wallpaper-tesseract
npm run test
npm run typecheck
npm run build
```

## Non-Negotiables

- Do not create a new product facade around
  `install-wallpaper-product-features.ts`.
- Do not move constants into a new `product-ids.ts` or equivalent parking lot.
- Do not keep old app-local owners as idle compatibility shells.
- Do not preserve old code paths as fallback behavior.
- Do not add broad casts or fake ports to keep the old installer shape alive.
- Do not move runtime resources into `packages/editor`.
- Do not make runtime files import editor presentation, DOM, window, dock, or
  app-composition types.
- Do not make `ui-framework` know Scene, Tesseract, Camera3, Debug, Hierarchy,
  or product workspace mode.
- Do not create duplicate actor id, hierarchy metadata, view descriptor, frame
  source, window placement, or runtime Scene ownership truth.
- Prefer deleting old facts and shrinking owners over adding new services.

## Entry Gate

Run before implementation:

```text
git status --short
$env:PROJECT_PRISM_SMOKE_EVIDENCE="temp/project-prism-phase-8-smoke-data.json"; npm run test -w wallpaper-tesseract -- architecture-boundaries project-prism-boundary-report project-prism-smoke-evidence-file
npm run test -w wallpaper-tesseract -- runtime-scene-session runtime-work-attachment-runtime camera3-components tesseract4 install-scene-view-feature component-definitions workspace-mode project-prism-frame-update-lane-map
npm run typecheck -w wallpaper-tesseract
npm run test
npm run typecheck
npm run build
```

If the gate fails, fix the failing real owner first. Do not add aliases,
facades, or test-only compatibility to start this plan.

Baseline production grep:

```text
rg -n "SCENE_WINDOW_ACTOR_ID|TESSERACT4_ACTOR_ID|CAMERA3_GIZMO_ACTOR_ID|measureSceneViewport|renderFrameSources|createActorHierarchyObjectSource" apps/wallpaper-tesseract/src/features/install-wallpaper-product-features.ts
rg -n "createRuntimeSceneViewRuntime|attachContent|createCamera3GizmoActor|createRenderableSceneView|SceneViewFrameSourceRegistry|createSceneViewActor" apps/wallpaper-tesseract/src/features/scene apps/wallpaper-tesseract/src/runtime -g "*.ts" -g "!**/*.test.ts"
rg -n "createRenderableSceneView|SceneViewFrameSourceRegistry" apps/wallpaper-tesseract/src/features/scene/index.ts
rg -n "scene-runtime-composition-feature-installer|wallpaper-app-concrete-feature-policy|scene-run-mode-product-command|createRuntimeSceneContent|SceneViewFrameSourceRegistry" apps/wallpaper-tesseract/src/architecture-boundaries.test.ts apps/wallpaper-tesseract/src/test-support/project-prism-boundary-facts.ts
```

## Step 1: Lock Runtime Scene Actor Ownership

Purpose: turn the reviewer decision into code and tests before moving Scene
descriptors or product ids.

Target files:

```text
apps/wallpaper-tesseract/src/runtime/runtime-scene-view-runtime.ts
apps/wallpaper-tesseract/src/runtime/runtime-scene-content.ts
apps/wallpaper-tesseract/src/features/scene/install-scene-view-feature.ts
apps/wallpaper-tesseract/src/features/install-wallpaper-product-features.ts
```

Required architecture shape:

- Scene View actor remains the parent anchor passed to runtime content.
- Runtime content owner derives or owns runtime child actor ids for Tesseract
  and runtime-side Camera3 motion/content.
- Product installer does not pass Tesseract/Camera3 runtime actor ids.
- Camera3 gizmo actor id belongs to editor Camera3 presentation ownership or a
  Scene presentation descriptor, not product installer.
- Runtime content attachment receives a generic parent actor, not editor host,
  DOM, window location, or presentation owner types.

Allowed implementation options:

- Rename `sceneActor` to a generic `parentActor` / `sceneViewActor` only if the
  contract becomes clearer.
- Add a small runtime-owned id/metadata helper only if it deletes the
  product-level id constants and does not become a broad registry.
- Keep `ActorCreationContext` only as actor-core infrastructure. Do not use it
  to pull app composition into runtime.

Forbidden implementation options:

- New `SceneRuntimeFacade`, `ProductSceneIds`, or `SceneRuntimeAdapter`.
- Runtime owner importing editor package Scene host types.
- Product installer continuing to pass `TESSERACT4_ACTOR_ID` or
  `CAMERA3_GIZMO_ACTOR_ID`.

Production grep exit:

```text
rg -n "TESSERACT4_ACTOR_ID|CAMERA3_GIZMO_ACTOR_ID|RuntimeSceneContentActorIds" apps/wallpaper-tesseract/src/features/install-wallpaper-product-features.ts apps/wallpaper-tesseract/src/features/scene apps/wallpaper-tesseract/src/runtime -g "*.ts" -g "!**/*.test.ts"
rg -n "EditorSceneViewHost|HTMLElement|Document|WindowViewLocation|WindowFrame|Dock|WorkspacePresentation" apps/wallpaper-tesseract/src/runtime/runtime-scene-view-runtime.ts apps/wallpaper-tesseract/src/runtime/runtime-scene-content.ts apps/wallpaper-tesseract/src/runtime/runtime-scene-session.ts
```

Expected exit:

- Product installer no longer owns Tesseract/Camera3 runtime actor ids.
- Runtime Scene content actor ownership is named in runtime code, not implied by
  Scene feature wiring.
- Camera3 gizmo is still editor presentation and still uses runtime command /
  query ports.

Validation:

```text
npm run test -w wallpaper-tesseract -- runtime-scene-session camera3-components tesseract4 install-scene-view-feature architecture-boundaries project-prism-boundary-report
npm run typecheck -w wallpaper-tesseract
```

Stop and amend if:

- Removing product ids requires duplicating ids in multiple owners.
- Runtime content cannot derive stable ids without introducing a new broad id
  service.

## Step 2: Move Mixed Scene Runtime Composition Behind Runtime Owner

Purpose: stop `install-scene-view-feature.ts` from being the single place that
creates editor Scene actor, runtime Scene runtime, runtime content, Camera3
gizmo, editor host, and renderable frame source.

Target files:

```text
apps/wallpaper-tesseract/src/features/scene/install-scene-view-feature.ts
apps/wallpaper-tesseract/src/features/scene/index.ts
apps/wallpaper-tesseract/src/runtime/runtime-scene-view-runtime.ts
apps/wallpaper-tesseract/src/runtime/runtime-scene-frame-source.ts
apps/wallpaper-tesseract/src/features/install-wallpaper-product-features.ts
apps/wallpaper-tesseract/src/app/create-wallpaper-app.ts
```

Work:

1. Move renderable frame-source registration out of Scene feature presentation
   wiring and into the runtime Scene view runtime or a runtime-owned frame
   source owner.
2. Keep editor Scene actor creation in the Scene feature/editor presentation
   layer.
3. Let Scene feature connect editor presentation to runtime ports:
   render target, measurement, visibility, camera command/query, and dispose.
4. Remove `measureSceneViewport()` and `renderFrameSources()` from
   `InstalledWallpaperProductFeatures` if runtime/frame orchestration can call
   the runtime owner directly.
5. Remove `features/scene/index.ts` re-exports of
   `createRenderableSceneView` and `SceneViewFrameSourceRegistry`; feature API
   must not re-export runtime staging internals.
6. Delete any code made idle by this move in the same step.

Hard exit condition:

`install-scene-view-feature.ts` must not directly contain this whole mixed set
at the same time:

```text
createRuntimeSceneViewRuntime
attachContent
createCamera3GizmoActor
createRenderableSceneView
SceneViewFrameSourceRegistry
```

It may remain a connector, but not the mixed owner.

Production grep exit:

```text
rg -n "createRuntimeSceneViewRuntime|attachContent|createCamera3GizmoActor|createRenderableSceneView|SceneViewFrameSourceRegistry" apps/wallpaper-tesseract/src/features/scene/install-scene-view-feature.ts
rg -n "createRenderableSceneView|SceneViewFrameSourceRegistry" apps/wallpaper-tesseract/src/features/scene/index.ts
rg -n "measureSceneViewport|renderFrameSources" apps/wallpaper-tesseract/src/features/install-wallpaper-product-features.ts apps/wallpaper-tesseract/src/app/create-wallpaper-app.ts
```

Expected exit:

- Scene feature owns presentation connection only.
- Runtime Scene owner owns runtime content and frame-source participation.
- App frame loop does not depend on product feature installer methods for
  runtime rendering.
- No runtime owner imports editor or DOM presentation types.

Validation:

```text
npm run test -w wallpaper-tesseract -- runtime-scene-session runtime-work-attachment-runtime camera3-components tesseract4 install-scene-view-feature project-prism-frame-update-lane-map architecture-boundaries project-prism-boundary-report
npm run typecheck -w wallpaper-tesseract
```

Stop and amend if:

- The replacement simply moves the current mixed Scene installer into
  `runtime/`.
- App frame loop needs a new broad runtime facade to call render hooks.

## Step 3: Delete Product-Level Scene/Tesseract/Camera Internal Facts

Purpose: remove runtime/editor internal identity and hierarchy facts from the
product installer.

Target files:

```text
apps/wallpaper-tesseract/src/features/install-wallpaper-product-features.ts
apps/wallpaper-tesseract/src/features/scene/install-scene-view-feature.ts
apps/wallpaper-tesseract/src/runtime/runtime-scene-content.ts
packages/editor/src/camera3
packages/editor/src/scene
```

Work:

1. Delete product-level `SCENE_WINDOW_ACTOR_ID`,
   `TESSERACT4_ACTOR_ID`, and `CAMERA3_GIZMO_ACTOR_ID` when their owners can
   derive or expose them.
2. Do not move them to another product-owned id file.
3. Move Scene label/order to the Scene view descriptor owner.
4. Move Tesseract runtime child label/order to runtime Scene content ownership
   if it remains visible in Hierarchy.
5. Move Camera3 gizmo label/order to editor Camera3 presentation ownership if
   it remains visible in Hierarchy.
6. Replace product-owned `metadataByActorId` literals with owner-owned metadata
   contributions, then delete the central copies.
7. Keep only product ordering facts that are genuinely product composition.

Production grep exit:

```text
rg -n "SCENE_WINDOW_ACTOR_ID|TESSERACT4_ACTOR_ID|CAMERA3_GIZMO_ACTOR_ID|SCENE_WINDOW_ACTOR_NAME|TESSERACT4_ACTOR_NAME|CAMERA3_GIZMO_ACTOR_NAME|metadataByActorId" apps/wallpaper-tesseract/src/features/install-wallpaper-product-features.ts
rg -n "tesseract-4|camera-3|scene-window" apps/wallpaper-tesseract/src/features/install-wallpaper-product-features.ts
```

Test/support grep:

```text
rg -n "TESSERACT4_ACTOR_ID|CAMERA3_GIZMO_ACTOR_ID|SCENE_WINDOW_ACTOR_ID|metadataByActorId" apps/wallpaper-tesseract/src packages -g "*.test.ts" -g "*.ts"
```

Expected exit:

- Product installer no longer owns runtime/editor internal actor identity.
- Hierarchy still displays Scene, Tesseract, and Camera3 once each.
- No duplicate metadata registry is created.

Validation:

```text
npm run test -w wallpaper-tesseract -- component-definitions install-scene-view-feature architecture-boundaries project-prism-boundary-report
npm run test -w editor
npm run typecheck -w wallpaper-tesseract
```

## Step 4: Narrow Product Defaults And Floating Policy

Purpose: delete central default view/window policy copies that already have
clearer feature owners.

Status: complete for Scene, Debug/Hierarchy, and Inspector policy construction.
Product installation now composes owner policy contributions via
`installSceneWorkspacePolicy`, `installToolWindowWorkspacePolicy`, and
`installInspectorWorkspacePolicy`.

Priority: lower than Steps 1-3. Execute only after Scene runtime ownership is
stable.

Target files:

```text
apps/wallpaper-tesseract/src/features/install-wallpaper-product-features.ts
packages/editor/src/tool-windows/install-tool-window-features.ts
packages/editor/src/inspector
apps/wallpaper-tesseract/src/features/scene/install-scene-view-feature.ts
apps/wallpaper-tesseract/src/features/app-menu/install-app-menu-feature.ts
```

Work:

1. Keep Debug/Hierarchy defaults and floating policy in editor tool-window
   ownership.
2. Keep Inspector descriptors and policies in Inspector/editor ownership.
3. Keep Scene defaults in Scene owner only after Steps 1-3 remove runtime
   coupling from Scene descriptors.
4. Move state default registration to owner-owned installers where it deletes
   product copies.
5. Delete `installWallpaperProductStateDefaults` if it becomes only an
   aggregator. If it remains, narrow its name and boundary blocker to the exact
   product policy it still owns.

Production grep exit:

```text
rg -n "createDefault.*WindowState|create.*DefaultOpenView|create.*FloatingFramePolic|register.*WindowParameters|installWallpaperProductStateDefaults" apps/wallpaper-tesseract/src/features/install-wallpaper-product-features.ts packages/editor/src apps/wallpaper-tesseract/src/features -g "*.ts" -g "!**/*.test.ts"
```

Completed exit:

- Product installer does not duplicate owner-owned default windows, views, or
  floating policies.
- Concrete policy helpers are no longer exported from feature/package barrels;
  owner installers are the public surface.

Validation:

```text
npm run test -w editor
npm run test -w wallpaper-tesseract -- component-definitions workspace-mode architecture-boundaries project-prism-boundary-report
npm run typecheck -w wallpaper-tesseract
```

## Step 5: Re-evaluate Workspace Mode Last

Purpose: decide whether `workspace-mode.ts` remains a narrow product command
module, moves, or disappears after Scene runtime command ownership is clearer.

Target files:

```text
apps/wallpaper-tesseract/src/features/workspace-mode.ts
apps/wallpaper-tesseract/src/features/install-wallpaper-product-features.ts
packages/editor/src
packages/ui-framework/src
```

Allowed outcomes:

- Keep `workspace-mode.ts` app-local and narrow the blocker to
  `scene-run-mode-product-command`.
- Move product-agnostic presentation commands to `ui-framework` only if the
  code no longer knows Scene.
- Move editor mode state coordination to `packages/editor` only if it does not
  own window lifecycle or runtime resources.
- Delete `WorkspaceModeController` if existing command ports can express the
  behavior without a separate stateful owner.

Forbidden outcomes:

- `workspace-mode.ts` regains visible-path fallback logic.
- `ui-framework` imports or names Scene/run product behavior.
- `packages/editor` owns window lifecycle or runtime Scene resources.

Production grep exit:

```text
rg -n "WorkspaceModeController|enterRunFullscreenForView|exitRunFullscreen|sceneView|workspacePresentation" apps/wallpaper-tesseract/src/features/workspace-mode.ts apps/wallpaper-tesseract/src/features/install-wallpaper-product-features.ts packages/editor/src packages/ui-framework/src -g "*.ts" -g "!**/*.test.ts"
```

Completed exit:

- Workspace-mode debt is renamed to the precise current
  owner debt.
- No second window placement/presentation truth is introduced.

Validation:

```text
npm run test -w wallpaper-tesseract -- workspace-mode app-menu-bar-component architecture-boundaries project-prism-boundary-report
npm run typecheck -w wallpaper-tesseract
```

## Step 6: Flip Boundary Facts From Debt Assertion To Regression Guard

Purpose: make the new ownership irreversible.

Target files:

```text
apps/wallpaper-tesseract/src/test-support/project-prism-boundary-facts.ts
apps/wallpaper-tesseract/src/architecture-boundaries.test.ts
docs/current-project-progress.md
docs/known-defects-and-todos.md
```

Work:

1. Remove or narrow `wallpaper-app-concrete-feature-policy` once product
   internal facts are gone.
2. Remove or narrow `scene-runtime-composition-feature-installer` once Scene
   feature no longer owns the mixed runtime/editor/Camera3/frame-source set.
3. Remove or narrow `scene-run-mode-product-command` only after Step 5.
4. Replace tests that currently expect transitional debt with tests forbidding:
   - product-owned Scene/Tesseract/Camera actor ids;
   - feature-level re-export of runtime frame-source staging;
   - Scene feature directly containing the full mixed assembly set;
   - product installer exposing runtime render hooks.
5. Update progress docs and defect ledger only after code reality changes.

Required grep:

```text
rg -n "scene-runtime-composition-feature-installer|wallpaper-app-concrete-feature-policy|scene-run-mode-product-command|SceneViewFrameSourceRegistry|createRuntimeSceneViewRuntime|measureSceneViewport|renderFrameSources" apps/wallpaper-tesseract/src/architecture-boundaries.test.ts apps/wallpaper-tesseract/src/test-support/project-prism-boundary-facts.ts docs/current-project-progress.md docs/known-defects-and-todos.md
```

Validation:

```text
npm run test -w wallpaper-tesseract -- architecture-boundaries project-prism-boundary-report project-prism-state-domain-map project-prism-frame-update-lane-map
npm run typecheck -w wallpaper-tesseract
```

## Step 7: Stress Runtime/Scene Lifecycle

Purpose: catch stale canvas, stale frame source, stale runtime content, and
Hierarchy metadata drift after owner cleanup.

Required coverage:

- Unit/integration test for repeated Scene close/reopen with no stale frame
  source registration.
- Test or smoke evidence that runtime Scene content is disposed exactly once
  per Scene view runtime.
- Hierarchy test or browser evidence proving Scene, Tesseract, and Camera3
  still appear once and do not duplicate after close/reopen.
- Existing DCK-006 dock path remains green.

Targeted commands:

```text
npm run test -w wallpaper-tesseract -- runtime-scene-session install-scene-view-feature tesseract4 camera3-components workspace-mode architecture-boundaries
npm run test -w ui-framework -- window-workspace-graph window-workspace-graph-reconciler window-frame-surface-component
```

## Step 8: Fresh Browser Smoke

Purpose: prove the cleanup did not only satisfy grep and unit boundaries.

Run the app:

```text
npm run dev -w wallpaper-tesseract
```

Fresh browser actions:

- Boot with zero console errors.
- Window menu opens and hover highlight follows the hovered row.
- Debug -> Scene dock succeeds visually and records graph/DOM mutation.
- Scene fullscreen enter/exit restores graph/DOM/input parity.
- Mobile viewport keeps Window menu, Scene, Tesseract/canvas, and Camera3 gizmo
  measurable.
- Camera3 action changes camera/view state.
- Scene close/reopen loop leaves no stale canvas, runtime content, or frame
  source.
- Hierarchy shows Scene/Tesseract/Camera3 exactly once after close/reopen.

Write:

```text
temp/project-prism-post-remaining-debt-smoke-data.json
temp/project-prism-post-remaining-debt-smoke-report.md
```

Validate:

```text
$env:PROJECT_PRISM_SMOKE_EVIDENCE="temp/project-prism-post-remaining-debt-smoke-data.json"; npm run test -w wallpaper-tesseract -- project-prism-smoke-evidence-file
```

## Final Gate Result

The Phase 8.5 gate is complete:

- Product installer no longer owns Scene/Tesseract/Camera3 runtime/editor
  internal actor ids.
- Scene feature no longer directly owns the full mixed runtime/editor/Camera3
  frame-source assembly set.
- `features/scene/index.ts` no longer re-exports runtime frame-source staging.
- Product installer no longer exposes runtime render hooks unless the reviewer
  explicitly accepts a narrower, named product-level command.
- Workspace mode is removed, moved to a clear owner, or explicitly narrowed as
  a product command module.
- Boundary facts are removed or narrowed to current files and current deletion
  conditions.
- Fresh post-remaining-debt smoke evidence validates.
- Root validation passes:

```text
npm run test
npm run typecheck
npm run build
```

## Stop Conditions

Stop and amend this plan if:

- A step needs runtime files to import editor, DOM, window, dock, or app
  composition types.
- A step needs editor to own runtime world/camera/render output.
- Product ids are moved rather than deleted from product ownership.
- Product policy is replaced by another central facade.
- The app frame loop can only be repaired by adding a broad runtime facade.
- Boundary tests must be weakened to pass.
- Browser smoke cannot prove real Scene close/reopen cleanup.
