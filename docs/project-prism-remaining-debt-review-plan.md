# Project Prism Remaining Debt Review Plan

Status: draft for reviewer evaluation, created 2026-06-13.

This document explains why the remaining Project Prism debt still requires
additional architecture work after Phase 8 Step 7 and DCK-006 closure, and
proposes an initial deletion-first plan for review.

It is not a new compatibility migration plan. The goal is to decide whether the
remaining debt should be handled as a larger owner cleanup before later phases
continue.

## Current Baseline

Already completed:

- Phase 6 editor package extraction is accepted.
- Phase 7 runtime-owner/app-bootstrap cleanup is accepted.
- Phase 8 Steps 0-7 are complete:
  - app-local component-definition aggregators were deleted;
  - actor-input owns its component definition installer;
  - renderable Scene frame-source ownership moved into runtime staging;
  - `workspace-mode.ts` was narrowed to product command orchestration;
  - DCK-006 was fixed with real browser smoke evidence.
- Fresh Phase 8 smoke validates:

```text
$env:PROJECT_PRISM_SMOKE_EVIDENCE="temp/project-prism-phase-8-smoke-data.json"; npm run test -w wallpaper-tesseract -- project-prism-smoke-evidence-file
```

The current active debt is now structural, not a dock/UI regression.

Boundary facts still name:

- `wallpaper-app-concrete-feature-policy`
- `workspace-mode-app-controller`
- `scene-runtime-composition-feature-installer`

Relevant files:

```text
apps/wallpaper-tesseract/src/features/install-wallpaper-product-features.ts
apps/wallpaper-tesseract/src/features/workspace-mode.ts
apps/wallpaper-tesseract/src/features/scene/install-scene-view-feature.ts
apps/wallpaper-tesseract/src/runtime/runtime-scene-view-runtime.ts
apps/wallpaper-tesseract/src/runtime/runtime-scene-content.ts
```

## Why Extra Work Is Still Needed

### 1. Product Policy Is Still Too Centralized

`install-wallpaper-product-features.ts` still owns or coordinates several
unrelated facts:

- Scene/Tesseract/Camera3 actor ids and names.
- hierarchy metadata for Scene, Tesseract, Camera3, tool windows, app menu, and
  workspace root.
- product default open views.
- floating frame policies.
- app menu installation.
- Debug Log sink binding.
- Scene feature installation.
- Inspector/tool-window installation.
- workspace mode controller installation.
- runtime frame render hooks exposed through `measureSceneViewport()` and
  `renderFrameSources()`.

This file is now much smaller than the old app bootstrap, but it can become the
new product mega-facade if left in place. That would preserve the exact kind of
multi-owner composition Project Prism has been deleting: one app-local module
knowing feature identity, runtime presentation, editor hierarchy metadata, menu
commands, and window placement policy.

Extra work is needed because small local fixes would only move constants around
while keeping the central owner. The useful change is to delete central product
copies as real owners become clear.

### 2. Scene Feature Installation Still Crosses Runtime And Editor Ownership

`install-scene-view-feature.ts` still creates or wires all of these in one
`createViewRuntime` callback:

- `createRuntimeSceneViewRuntime`
- editor `createSceneViewActor`
- `runtimeScene.attachContent`
- `createCamera3GizmoActor`
- `sceneCamera3ViewportBindingComponent`
- `createEditorSceneViewHost`
- `createRenderableSceneView`
- `SceneViewFrameSourceRegistry` registration

This is the biggest remaining ownership knot. It is cleaner than the pre-Phase
7 mixed Scene installer, but it still means Scene feature presentation code is
the place where runtime Scene content, editor Scene actor creation, Camera3
presentation, and render-frame registration meet.

Extra work is needed because future multi-scene or runtime package extraction
would otherwise have to preserve this installer as a de facto owner. That would
make runtime resources hard to reason about and difficult to move without
temporary facades.

### 3. Runtime Scene View Runtime Still Has An Actor Ownership Decision

`runtime-scene-view-runtime.ts` and `runtime-scene-content.ts` improved runtime
ownership, but the attach contract still receives:

```text
ActorCreationContext
RuntimeSceneContentActorIds
sceneActor: Actor
```

This is not automatically wrong: actor-core is allowed as a generic dependency.
But the current shape means runtime content actor creation is still coordinated
from the Scene feature installer, and product-owned actor ids still flow into
runtime content.

Extra work is needed to decide and enforce one of these models:

- Runtime Scene content is a runtime-owned actor subtree attached under a
  generic parent actor.
- Or Scene/Tesseract/Camera actors are editor-visible presentation actors and
  runtime only owns non-actor resources.

The current code sits between those options. Leaving it ambiguous will keep
actor identity, hierarchy metadata, runtime content, and Scene presentation
coupled.

### 4. Workspace Mode Is Narrowed But Not Settled

`workspace-mode.ts` now mostly coordinates editor mode -> Scene run fullscreen.
The old visible-path fallback state machine is gone, which is good.

However, it still lives in app composition and knows:

- the Scene view key;
- window view locations;
- window owner commands;
- workspace presentation commands;
- editor workspace mode state.

This is acceptable as a temporary product command module. It should not be moved
blindly into `ui-framework` or `editor`, because either move could create a
wrong owner. Extra work is needed only after the Scene/runtime command boundary
is clearer.

## Recommended Refactor Scale

This should be treated as a medium-to-large owner cleanup, not a whole-project
rewrite.

The work is larger than a bug fix because it changes where facts live. It should
still be bounded to:

- product feature policy;
- Scene runtime composition;
- workspace mode ownership;
- boundary facts and smoke evidence.

It should not reopen completed window-workspace graph cleanup, editor package
extraction, or runtime-core/runtime-three extraction unless the current files
force that decision.

## Non-Negotiables

- Do not wrap `install-wallpaper-product-features.ts` in a new facade.
- Do not split product policy into several files and re-aggregate it through
  another central product installer.
- Do not preserve old app-local owners as idle compatibility shells.
- Do not add broad casts or fake test ports to keep the old installer shape.
- Do not move runtime resources into `packages/editor`.
- Do not move Scene-specific run/fullscreen product behavior into
  `ui-framework` unless it becomes truly product-agnostic.
- Do not create duplicate actor id, hierarchy metadata, view descriptor,
  runtime Scene owner, frame source, or window placement truth.
- Prefer deleting code and narrowing existing owners over adding new services.

## Initial Plan

### Step 0: Reconfirm Baseline

Purpose: make sure reviewers and implementers evaluate the real current code,
not historical debt.

Commands:

```text
git status --short
npm run test -w wallpaper-tesseract -- architecture-boundaries project-prism-boundary-report project-prism-frame-update-lane-map
$env:PROJECT_PRISM_SMOKE_EVIDENCE="temp/project-prism-phase-8-smoke-data.json"; npm run test -w wallpaper-tesseract -- project-prism-smoke-evidence-file
npm run test
npm run typecheck
npm run build
```

Exit:

- Boundary facts still name only current files.
- No DCK-006 wording remains as an active blocker.
- Any new failure is fixed in its real owner before architecture movement
  starts.

### Step 1: Decide Runtime Scene Actor Ownership

Purpose: remove the ambiguity around `ActorCreationContext`, `sceneActor`, and
runtime content actor ids before moving Scene descriptors.

Questions for review:

- Are Tesseract and Camera3 runtime content actors part of the editor-visible
  Scene actor subtree?
- Or should runtime Scene own a runtime actor subtree that receives only a
  generic parent actor and runtime-owned ids?
- Should product actor ids for Tesseract/Camera3 be deleted and derived from a
  runtime Scene identity?

Preferred direction:

- Keep actor-core as the only allowed actor dependency.
- Move runtime content actor id decisions out of
  `install-wallpaper-product-features.ts`.
- If runtime actors remain children of the Scene view actor, make that contract
  explicit as a generic actor-core parent relationship, not an editor
  presentation dependency.
- Delete the product-level Tesseract/Camera3 actor id constants once runtime or
  editor owner can derive or own them.

Forbidden direction:

- A new app-local `SceneRuntimeFacade`.
- A runtime owner importing editor Scene host or DOM types.
- Editor package owning runtime world/camera/render output.

Validation:

```text
rg -n "ActorCreationContext|sceneActor|RuntimeSceneContentActorIds|TESSERACT4_ACTOR_ID|CAMERA3_GIZMO_ACTOR_ID" apps/wallpaper-tesseract/src/features apps/wallpaper-tesseract/src/runtime -g "*.ts"
npm run test -w wallpaper-tesseract -- runtime-scene-session install-scene-view-feature architecture-boundaries project-prism-boundary-report
```

### Step 2: Move Runtime Scene Composition Behind Runtime Owner

Purpose: stop `install-scene-view-feature.ts` from being the mixed editor /
runtime / Camera3 / render-frame assembly point.

Work:

- Move `createRuntimeSceneViewRuntime`, runtime content attachment, Camera3
  motion ownership, render output, and renderable frame-source registration
  behind a runtime-owned Scene view runtime contract.
- Keep editor Scene actor creation in editor/presentation ownership.
- Let Scene feature connect editor presentation to runtime ports:
  render target, measurement, visibility, camera command/query, and dispose.
- Delete any now-unused renderable registry exposure from product feature
  installation.

Expected shrink:

- `install-scene-view-feature.ts` should no longer directly call the full set:
  `createRuntimeSceneViewRuntime`, `runtimeScene.attachContent`,
  `createCamera3GizmoActor`, `createRenderableSceneView`, and
  `SceneViewFrameSourceRegistry.register`.
- `install-wallpaper-product-features.ts` should no longer expose
  `measureSceneViewport()` / `renderFrameSources()` as product feature methods
  if runtime frame source ownership can be driven by the runtime/frame owner.

Validation:

```text
rg -n "createRuntimeSceneViewRuntime|attachContent|createCamera3GizmoActor|createRenderableSceneView|SceneViewFrameSourceRegistry" apps/wallpaper-tesseract/src/features/scene apps/wallpaper-tesseract/src/runtime -g "*.ts" -g "!**/*.test.ts"
npm run test -w wallpaper-tesseract -- runtime-scene-session camera3-components tesseract4 install-scene-view-feature project-prism-frame-update-lane-map
npm run typecheck -w wallpaper-tesseract
```

Exit:

- Runtime Scene resource ownership is in runtime staging.
- Scene feature is a connector between editor presentation and runtime ports.
- No editor or DOM type is imported by runtime owner files.

### Step 3: Delete Product-Level Scene/Tesseract/Camera Policy Copies

Purpose: prevent the product installer from being the identity and hierarchy
source for Scene runtime internals.

Work:

- Move or delete Scene/Tesseract/Camera actor id constants from
  `install-wallpaper-product-features.ts`.
- Move hierarchy metadata to the nearest owner:
  - Scene view descriptor owns Scene label/order.
  - Runtime Scene content owner owns runtime child labels if they remain actor
    tree entries.
  - Camera3 owner owns Camera3 label/order if it remains visible in hierarchy.
- Keep product feature ordering only if it is truly product ordering.
- Delete central metadata maps when owner descriptors can provide the same
  facts.

Validation:

```text
rg -n "SCENE_WINDOW_ACTOR_ID|TESSERACT4_ACTOR_ID|CAMERA3_GIZMO_ACTOR_ID|metadataByActorId|createActorHierarchyObjectSource" apps/wallpaper-tesseract/src/features/install-wallpaper-product-features.ts
npm run test -w wallpaper-tesseract -- component-definitions architecture-boundaries project-prism-boundary-report
```

Exit:

- `install-wallpaper-product-features.ts` no longer owns runtime/internal actor
  identity.
- Hierarchy metadata is not duplicated between product and feature/runtime
  owners.

### Step 4: Split Tool/Product Defaults From Product Installer

Purpose: delete the remaining central default view and floating policy copies
that already have clearer owners.

Work:

- Keep Debug/Hierarchy defaults in `packages/editor/src/tool-windows`.
- Keep Inspector defaults in the editor Inspector owner.
- Keep App Menu command definitions in app-menu owner.
- Move product state default registration to owner-owned installers where
  possible.
- Delete `installWallpaperProductStateDefaults` if it becomes only an
  aggregator of owner-owned defaults.

Validation:

```text
rg -n "createDefault.*WindowState|create.*DefaultOpenViews|create.*FloatingFramePolic|register.*WindowParameters" apps/wallpaper-tesseract/src/features/install-wallpaper-product-features.ts packages/editor/src apps/wallpaper-tesseract/src/features -g "*.ts"
npm run test -w editor
npm run test -w wallpaper-tesseract -- component-definitions workspace-mode architecture-boundaries
```

Exit:

- Product installer does not duplicate editor/tool-window/inspector defaults.
- Any remaining product default is explicitly a product policy, not a legacy
  leftover.

### Step 5: Re-evaluate Workspace Mode Ownership

Purpose: decide whether `workspace-mode.ts` remains a product command module or
can be deleted/moved after Scene runtime composition is clearer.

Possible outcomes:

- Keep it app-local but narrow the boundary fact to "Scene run-mode product
  command".
- Move a product-agnostic presentation part to `ui-framework` only if it no
  longer knows Scene.
- Move editor mode state coordination to `packages/editor` only if it does not
  own window lifecycle or runtime resources.
- Delete the controller if mode changes can be expressed through existing
  explicit command ports without a separate stateful owner.

Validation:

```text
rg -n "WorkspaceModeController|enterRunFullscreenForView|exitRunFullscreen|sceneView" apps/wallpaper-tesseract/src/features/workspace-mode.ts apps/wallpaper-tesseract/src/features/install-wallpaper-product-features.ts
npm run test -w wallpaper-tesseract -- workspace-mode app-menu-bar-component architecture-boundaries project-prism-boundary-report
```

Exit:

- `workspace-mode-app-controller` is either removed or narrowed to a precise,
  current blocker with a deletion condition.
- No second window placement or presentation truth is introduced.

### Step 6: Flip Boundary Facts And Documentation

Purpose: prevent the old shape from returning.

Work:

- Update `project-prism-boundary-facts.ts` as each blocker is removed or
  narrowed.
- Update `architecture-boundaries.test.ts` from "current debt exists" checks to
  "old mixed owner cannot return" checks where applicable.
- Update `docs/current-project-progress.md`.
- Add any confirmed defects or watch items to `docs/known-defects-and-todos.md`
  instead of hiding them in temporary plans.

Validation:

```text
npm run test -w wallpaper-tesseract -- architecture-boundaries project-prism-boundary-report project-prism-state-domain-map project-prism-frame-update-lane-map
npm run test
npm run typecheck
npm run build
```

### Step 7: Fresh Browser Smoke

Purpose: prove the cleanup did not only satisfy unit boundaries.

Required actions:

- Boot with zero console errors.
- Window menu opens and hover highlight follows the hovered row.
- Debug/Scene dock still succeeds visually and validates graph/DOM mutation.
- Scene fullscreen enter/exit still restores graph/DOM/input parity.
- Mobile viewport keeps Window menu, Scene, Tesseract/canvas, and Camera3 gizmo
  measurable.
- Camera3 action changes camera/view state.
- Scene close/reopen leaves no stale canvas or runtime frame source.

Evidence:

```text
temp/project-prism-post-remaining-debt-smoke-data.json
temp/project-prism-post-remaining-debt-smoke-report.md
```

Validation:

```text
$env:PROJECT_PRISM_SMOKE_EVIDENCE="temp/project-prism-post-remaining-debt-smoke-data.json"; npm run test -w wallpaper-tesseract -- project-prism-smoke-evidence-file
```

## Expected Result

After this work, one of the following should be true:

- Phase 8 can close with only small, explicitly named follow-up blockers.
- Or the remaining blocker is narrow enough to become the next phase's primary
  owner cleanup.

The preferred end state:

- app composition installs public owner installers and passes top-level ports;
- product feature policy no longer owns concrete runtime/editor internals;
- Scene feature binds editor presentation to runtime ports but does not own
  runtime resource construction;
- runtime Scene staging owns runtime resources and frame-source participation;
- workspace mode is either deleted, moved to a clear owner, or documented as a
  narrow product command module.

## Reviewer Decision Points

Please review these before implementation:

1. Should runtime Scene content actors remain under the editor Scene actor as a
   generic actor-core parent relationship, or should runtime own a separate
   actor subtree?
2. Is `workspace-mode.ts` acceptable as a temporary narrow product command
   module, or should it be pulled into the next cleanup immediately?
3. Should Phase 8 close after narrowing the product policy and Scene installer,
   or should closure require deletion of `install-wallpaper-product-features.ts`
   entirely?
4. Is the proposed smoke evidence file name acceptable, or should the existing
   Phase 8 smoke data be regenerated in place after the cleanup?

