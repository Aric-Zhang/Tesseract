# Project Prism Phase 6 Editor Extraction Execution Plan

Status: active Phase 6 execution plan. The pre-entry checkpoint is committed,
and Step 1/Step 2 have started by extracting editor state into
`packages/editor`. This plan should be updated as steps complete. It starts
from the completed pre-Phase 6 window-workspace final gate and keeps the
deletion-first Project Prism rules as hard constraints.

Current verified entry facts:

- `projectPrismPrePhase6UiFrameworkBlockers` is empty.
- `window-workspace-multi-truth-debt` is removed from boundary facts.
- `WindowWorkspaceGraph` is the production window placement truth.
- `WindowFramePort` is shell/presentation-only.
- `WindowContentHost`, `WindowContentAttachment`, `WindowDockSurfaceModel`, and
  `window-frame-dock-tree` are deleted from production/public reachability.
- Final entry smoke evidence exists under `temp/` and validates
  graph/DOM/input/persistence parity.
- The `editor` package target is marked `allowed` in boundary facts.
- Baseline checkpoint commit: `04f41ac` (`Complete Project Prism phase 6 entry
  gate`).

This plan is intentionally not a compatibility migration. Each slice either
moves ownership to the new package or deletes the app-local owner. Do not keep
app-local barrels, aliases, facade layers, cast-heavy shims, or test-only fake
ports to preserve old import paths.

## Non-Negotiable Refactor Rules

- One fact, one owner. Do not create a second editor state store, view identity
  model, feature registry, component definition registry, runtime ownership
  surface, or window placement truth.
- Do not add package APIs that mirror old app-local modules. If callers still
  need the old app-local shape, change the callers and delete the old shape.
- `packages/editor` may depend on `actor-core`, `actor-input`, `ui-framework`,
  `runtime-core`, `runtime-three` only where needed, `gizmo-core`, and the
  accepted `four-*` packages. It must not import `apps/wallpaper-tesseract`.
- Runtime packages must not import editor.
- `ui-framework` must not import editor feature content.
- App composition should import editor package installers and narrow bootstrap
  ports only, not concrete Debug, Hierarchy, Inspector, Scene, Camera3, or
  Tesseract internals.
- Tests must assert package contracts and behavior. Do not preserve old tests by
  adding casts, fake facades, or duplicate fixture ports that do not exist in
  production.
- Prefer deleting old app-local feature barrels and redundant tests in the same
  slice that moves the owner.

## Pre-Entry Closure

Purpose: start Phase 6 from a clean, reproducible checkpoint rather than from a
partially staged preflight tree.

1. Freeze the completed pre-Phase 6 baseline.
   - Review `git status --short`.
   - Commit the final gate, surface cleanup, smoke evidence, and test cleanup
     before large package moves.
   - Do not mix Phase 6 package moves into this checkpoint.

2. Validate the Phase 6 entry gate again.

```text
npm run test
npm run typecheck
npm run build
$env:PROJECT_PRISM_SMOKE_EVIDENCE="temp/project-prism-phase-6-entry-smoke-data.json"; npm run test -w wallpaper-tesseract -- project-prism-smoke-evidence-file
```

3. Confirm deleted window-workspace paths did not reappear.

```text
rg "window-content-host|WindowContentHost|WindowContentAttachment|createWindowContentAttachment|getWindowContentAttachment|WindowDockSurfaceModel|window-dock-surface-model|window-frame-dock-tree|getRuntimeDockRoot|restoreRuntimeDockRoot|listDockTargetTabsets|getFocusedViewActorId|getActiveViewActorIds|isViewActiveInFrame|isViewVisibleInFrame|getContentHost|mountContent" packages/ui-framework/src apps/wallpaper-tesseract/src --glob "!**/*.test.ts" --glob "!apps/wallpaper-tesseract/src/architecture-boundaries.test.ts"
```

Exit gate:

- Working tree has a named pre-Phase 6 checkpoint.
- Entry validation passes.
- Smoke evidence validator passes against
  `temp/project-prism-phase-6-entry-smoke-data.json`.
- The grep command returns no production old-placement path.

Stop if:

- Any old placement path returns. Fix by deleting the path or routing through
  `WindowWorkspaceGraph`; do not add compatibility wrappers.
- Smoke fails. Fix the real owner before package extraction begins.

## Step 1: Define The Editor Package Boundary

Purpose: create the smallest package shell and executable boundary tests before
moving code.

Status: in progress. `packages/editor` exists with real source; boundary facts
now classify `packages/editor/src/**` as `editor-candidate`, and architecture
tests forbid editor package imports from app-local runtime glue.

Work:

- Add `packages/editor` with `package.json`, `tsconfig.json`, and `src/index.ts`.
- Add only minimal scripts: `test`, `typecheck`, `build`.
- Do not add placeholder production exports except the first real moved contract.
- Add the package to root scripts only when at least one real contract has moved.
- Extend boundary facts so `editor-candidate` can include
  `packages/editor/src/**`.
- Add architecture tests that forbid:
  - editor package imports from `apps/wallpaper-tesseract`;
  - `ui-framework` imports from `packages/editor`;
  - runtime package imports from `packages/editor`;
  - app-local editor feature imports after each moved slice.

Exit gate:

```text
npm run test -w wallpaper-tesseract -- architecture-boundaries project-prism-boundary-report
npm run typecheck -w wallpaper-tesseract
```

After the package has real source:

```text
npm run test -w editor
npm run typecheck -w editor
npm run build -w editor
```

Deletion requirement:

- No app-local `editor` package facade or app-local barrel that exists only to
  preserve old import paths.

## Step 2: Move Pure Editor State First

Purpose: give feature extraction one editor-owned state contract without
dragging app composition or runtime ownership into the package.

Status: in progress. Former app-local editor state, window-layout defaults, and
state adapters have moved into `packages/editor`; app callers import them from
`editor`, and the old `apps/wallpaper-tesseract/src/editor` directory is
deleted.

Candidate source:

- `apps/wallpaper-tesseract/src/editor/app-state.ts`
- `apps/wallpaper-tesseract/src/editor/app-state-store.ts`
- `apps/wallpaper-tesseract/src/editor/app-state-controller.ts`
- `apps/wallpaper-tesseract/src/editor/editor-state.ts`
- `apps/wallpaper-tesseract/src/editor/window-layout-state.ts`
- `apps/wallpaper-tesseract/src/editor/adapters/*`

Work:

- Move only state models and adapters that depend on package-level contracts.
- Replace app-local `window-runtime` imports with `ui-framework` imports.
- Move `window-layout-state.ts` only as editor default window-parameter path
  data. It must import `uiLayoutPath`, `FloatingWindowParameterPaths`, and
  related UI layout types from `ui-framework`; it must not become a second
  window placement truth or a graph/layout cache.
- Replace app-local `runtime/ports` imports only with accepted runtime package
  contracts. If a needed type still lives only in app-local runtime ports, stop
  and move/delete that contract owner first.
- Rename overly app-specific public names only when it reduces ownership
  confusion; do not add aliases.
- Move tests with the source and delete app-local copies.

Exit gate:

- `packages/editor` owns editor state paths and adapters.
- App code imports the moved contracts from `editor`.
- `apps/wallpaper-tesseract/src/editor` is deleted or contains only code not yet
  moved with a documented next owner.
- No `packages/editor` source imports from:

```text
apps/wallpaper-tesseract
../window-runtime
../runtime/ports
../app-runtime
```

Validation:

```text
npm run test -w editor
npm run typecheck -w editor
npm run test -w wallpaper-tesseract -- architecture-boundaries app-state workspace-mode floating-window-editor-state-adapter workspace-mode-editor-state-adapter
```

## Step 2.5: Move Feature Actor Creation Context Out Of App Runtime

Purpose: remove the app-local `FeatureActorContext` dependency before moving
Debug, Hierarchy, Inspector, Scene, or Camera3 actor factories. This is a hard
precondition for Step 3; do not defer it to a stop condition.

Current fact:

- Debug, Hierarchy, Inspector, Scene, and Camera3 actor factories/importers use
  `FeatureActorContext` from `apps/wallpaper-tesseract/src/runtime/ports`.
- `runtime/ports` is classified as `app-runtime-debt`, so editor package code
  must not import it.

Work:

- Read every `FeatureActorContext` field and classify it by owner.
- If the context is only actor/component creation data, move it into
  `packages/editor` as a smaller editor-owned creation contract such as
  `ActorFeatureCreationPort`.
- If any field is actually runtime-owned, move that field to an accepted
  runtime package contract before editor extraction.
- If any field is UI/window-owned, use the `ui-framework` contract directly.
- Update actor factories to accept the smaller contract.
- Delete app-local `FeatureActorContext` from `runtime/ports` once all callers
  are moved.
- Do not keep a `FeatureActorContext` alias in app runtime, and do not add a
  facade that reshapes the old app-local context into the new package contract.

Exit gate:

- `FeatureActorContext` is no longer exported from app-local `runtime/ports`.
- No editor candidate source imports from `apps/wallpaper-tesseract/src/runtime/ports`
  for feature actor creation.
- Actor factories depend on one smaller creation contract owned by `editor` or
  package-level contracts owned by `actor-core`, `ui-framework`, or runtime
  packages.
- App composition passes concrete services into editor installers, not a broad
  app runtime context object.

Validation:

```text
rg "FeatureActorContext" apps/wallpaper-tesseract/src packages/editor/src
npm run test -w editor
npm run test -w wallpaper-tesseract -- architecture-boundaries project-prism-boundary-report
npm run typecheck -w wallpaper-tesseract
```

Expected grep result:

- no matches, except in this plan or a boundary test that explicitly forbids
  the deleted name.

## Step 3: Extract Debug, Hierarchy, Inspector, And Tool Window Installers

Purpose: move editor tool windows as a single ownership cluster so app
composition stops importing concrete feature internals.

Candidate source:

- `apps/wallpaper-tesseract/src/debug/**`
- `apps/wallpaper-tesseract/src/hierarchy/**`
- `apps/wallpaper-tesseract/src/features/inspector/**`
- `apps/wallpaper-tesseract/src/features/tool-windows/**`

Work:

- Move feature actors, content components, CSS, component definitions, and tests
  into `packages/editor/src`.
- Use `actor-core`, `actor-input`, `ui-framework`, and `gizmo-core` package
  imports directly.
- Use `WindowContentRegistrationPort` from `ui-framework`, not app
  `window-runtime`.
- Delete app-local barrels and old feature directories after imports are
  updated.
- Replace app composition imports with one editor-owned installer such as
  `installEditorToolWindowFeatures`, only if that installer removes direct app
  wiring rather than becoming a second feature registry.

Exit gate:

- App composition no longer imports `debug`, `hierarchy`,
  `features/inspector`, or `features/tool-windows` concrete modules.
- Debug, Hierarchy, Inspector tests run from the editor package.
- `features/tool-windows` app directory is deleted unless it still contains
  Wallpaper-specific bootstrap. If it remains, write its deletion condition.
- No editor package import from app-local `runtime/ports` or deleted
  `FeatureActorContext`.

Validation:

```text
npm run test -w editor
npm run typecheck -w editor
npm run test -w wallpaper-tesseract -- architecture-boundaries project-prism-boundary-report app-menu
npm run typecheck -w wallpaper-tesseract
```

Browser smoke:

- Window menu opens/focuses Debug, Hierarchy, Inspector, and Scene.
- Hierarchy row selection still routes through actor input.
- Debug and Hierarchy content have exactly one DOM parent after focus/dock.

## Step 4: Split Scene View Runtime Ownership Before Editor Presentation

Purpose: move Scene View editor presentation without making editor own runtime
worlds, cameras, renderers, renderables, or frame sources.

Candidate source:

- `apps/wallpaper-tesseract/src/features/scene/**`

Known caution:

- Some Scene files are currently marked `runtime-ownership-debt`.
- `scene-window-actor-factory.ts` still creates `RuntimeSceneRenderOutput`.
- `scene-viewport-component.ts` still renders directly with `THREE.Camera`.
- Do not move those responsibilities into `packages/editor`.

### Step 4A: Runtime Render Output Owner Cleanup

Purpose: make Scene View a consumer of runtime frame-source/render-output
contracts before moving editor presentation.

Work:

- Classify each Scene file before moving:
  - editor presentation: view actor factory, registered content, window/menu
    registration, CSS;
  - runtime ownership: render host, renderable scene view, frame source
    creation, world/camera/renderer ownership.
- Move runtime ownership files only to their runtime owner, or delete them if
  an accepted runtime package contract already replaces them.
- Move or replace `RuntimeSceneRenderOutput` creation with a runtime-owned
  frame-source/render-output contract.
- Remove direct `THREE.Camera` rendering from Scene View editor presentation.
  If a Three camera is still required, it must be supplied by a runtime-owned
  frame-source/render contract, not constructed or selected by editor code.
- Scene View must consume runtime frame sources through `runtime-core` /
  `runtime-three` contracts. If the required contract is missing, add the
  smallest runtime-owned contract and delete the app-local duplicate.

Exit gate:

- Scene runtime output/frame source owner is outside editor presentation.
- `scene-window-actor-factory.ts` no longer creates runtime render outputs.
- `scene-viewport-component.ts` no longer directly renders with `THREE.Camera`
  as an editor-owned fact.
- There is no app-local Scene facade that exists only to bridge old runtime
  ownership into editor.
- Runtime frame-source/render-output tests live with the runtime owner.

Validation:

```text
npm run test -w runtime-core
npm run test -w runtime-three
npm run test -w wallpaper-tesseract -- architecture-boundaries scene-view scene-viewport scene-view-content-installer
npm run typecheck -w wallpaper-tesseract
```

### Step 4B: Editor Scene Presentation Extraction

Purpose: move the remaining Scene View presentation after Step 4A proves
runtime ownership is no longer mixed into the editor-facing files.

Work:

- Move Scene editor presentation files to `packages/editor`.
- Do not introduce a Scene View facade in app composition.
- Delete app-local Scene presentation files after app imports are updated.

Exit gate:

- `packages/editor` has no direct world/camera/renderer/render-output
  construction for Scene.
- Scene View content registration remains graph/window-framework based.
- App imports Scene View installer from `editor`, not app `features/scene`.
- Any remaining app-local Scene runtime file has a runtime owner and deletion
  condition; no idle duplicate remains.

Validation:

```text
npm run test -w editor
npm run test -w runtime-core
npm run test -w runtime-three
npm run test -w wallpaper-tesseract -- architecture-boundaries scene-view scene-viewport scene-view-content-installer
npm run typecheck -w wallpaper-tesseract
```

Browser smoke:

- Scene renders after boot.
- Scene fullscreen/restore preserves graph/DOM/input/persistence parity.
- Reload after persistence keeps logical Scene descriptor, not actor ids.

## Step 5: Resolve Camera3 Ownership Before Gizmo Extraction

Purpose: separate Camera3 editor presentation from runtime camera ownership.

Candidate source:

- `apps/wallpaper-tesseract/src/gizmos/camera3/**`
- `apps/wallpaper-tesseract/src/features/camera3/components/**`
- `apps/wallpaper-tesseract/src/features/camera3/model/**`
- `apps/wallpaper-tesseract/src/camera3-control/**`

Known caution:

- `camera3-control` and `features/camera3/model` are currently runtime
  ownership-shaped. Do not place runtime camera ownership in editor.
- `Camera3MotionController` currently mixes editor-facing rig/model concepts
  with runtime camera mutation. `packages/editor` must not temporarily own it.

### Step 5A: Camera3 Motion And Rig Ownership Decision

Purpose: decide and clean ownership before any Camera3 presentation move.

Work:

- Audit `Camera3MotionController`, `Camera3Rig`, and
  `Camera3ProjectionModeController`.
- If `Camera3Rig` is only editor projection/view state, move it into
  `packages/editor` with the gizmo presentation and delete app-local exports.
- If `Camera3Rig` participates in runtime camera truth, move it to the runtime
  owner or replace it with runtime camera command/query contracts.
- Move or delete `Camera3MotionController` so runtime camera mutation is owned
  by runtime packages or accepted runtime staging, not by editor.
- Do not add a `Camera3MotionController` facade in `packages/editor` or app
  composition.
- Update tests so they assert the chosen owner directly.

Exit gate:

- `packages/editor` does not export or own `Camera3MotionController`.
- `Camera3Rig` has exactly one owner, documented by import paths and boundary
  tests.
- Runtime camera truth is not duplicated between editor and runtime staging.
- `camera3-control` no longer imports editor gizmo presentation.

Validation:

```text
npm run test -w runtime-core
npm run test -w wallpaper-tesseract -- architecture-boundaries camera3-motion-controller camera3-components
npm run typecheck -w wallpaper-tesseract
```

### Step 5B: Camera3 Gizmo Presentation Extraction

Purpose: move Camera3 presentation only after Step 5A removes mixed runtime
camera ownership.

Work:

- Move pure Camera3 gizmo UI, hit testing, state projection, renderer, actor
  factory, component definition, and tests to `packages/editor`.
- Keep model/control code with the runtime owner if it creates or mutates
  runtime camera state. Move it to runtime package only when doing so removes
  the app-local owner; do not add a forwarding facade.
- Convert package imports to `runtime-core` camera state and command/query
  ports. If the editor still needs an app-local `Camera3MotionController`, stop
  and clean runtime ownership first.
- Delete old `gizmos/camera3` and app feature component barrels after imports
  move.

Exit gate:

- Editor owns Camera3 presentation only.
- Runtime camera state/commands are owned by runtime packages or accepted
  runtime staging, not duplicated in editor.
- `camera3-control` is deleted, moved to the runtime owner, or narrowed to a
  non-editor runtime staging file with an explicit deletion condition.
- App composition does not instantiate Camera3 gizmo internals.

Validation:

```text
npm run test -w editor
npm run test -w wallpaper-tesseract -- architecture-boundaries camera3-gizmo camera3-components camera3-motion-controller
npm run typecheck -w wallpaper-tesseract
```

Browser smoke:

- Camera3 gizmo renders.
- Click and double-click behavior still route through actor input.
- Gizmo active camera state follows runtime-derived view state.

## Step 6: Move Editor Component Definition Installation

Purpose: app composition should install editor components through the editor
package, not by collecting concrete feature definitions.

Work:

- Create editor-owned installers for:
  - tool window components;
  - Scene View editor components;
  - Camera3 editor/gizmo components.
- Delete app-local feature definition installer barrels after each component set
  moves.
- Keep component dependencies in `ComponentDefinition.requires`; do not add
  hidden registration in app composition.
- If a definition requires app-local update/runtime/state binding, either move
  the binding owner to a package or stop and record the blocker. Do not fake the
  dependency with a test-only component registry.

Exit gate:

- `apps/wallpaper-tesseract/src/app/install-component-definitions.ts` imports
  package installers, not concrete editor definitions.
- App-local feature installer directories deleted or narrowed to
  Wallpaper-specific bootstrap.
- Architecture boundary tests forbid app composition importing concrete editor
  definition files.

Validation:

```text
npm run test -w editor
npm run test -w wallpaper-tesseract -- architecture-boundaries
npm run typecheck -w wallpaper-tesseract
```

## Step 7: Replace App Composition Wiring With Editor Public Installers

Purpose: make the app compose editor defaults without knowing concrete editor
feature internals.

Work:

- Replace direct app imports of Debug, Hierarchy, Inspector, Scene, Camera3,
  and Tesseract editor presentation internals with editor package installer
  calls.
- Keep Wallpaper-specific bootstrap in app only:
  - root DOM shell;
  - actor system and component registry construction;
  - runtime service construction;
  - top-level package installer wiring;
  - Wallpaper Engine lifecycle.
- Delete app-local re-export barrels after callers move.
- Update `projectPrismSourceZones` so editor moved files are no longer tracked
  as app-local candidates.

Exit gate:

- `apps/wallpaper-tesseract/src/app/create-wallpaper-app.ts` does not import
  concrete editor feature modules.
- `apps/wallpaper-tesseract/src/app/install-component-definitions.ts` imports
  editor package installers only.
- `app-composition-debt` shrinks to genuine Phase 7 bootstrap thinning, not
  editor feature ownership.
- Boundary report marks editor extraction complete or lists only real remaining
  blockers with deletion conditions.

Validation:

```text
npm run test -w editor
npm run test -w wallpaper-tesseract -- architecture-boundaries project-prism-boundary-report
npm run test
npm run typecheck
npm run build
```

## Step 8: Delete App-Local Editor Source And Tighten Boundaries

Purpose: make extraction irreversible by removing the old source layout.

Work:

- Delete moved app-local directories:
  - `apps/wallpaper-tesseract/src/debug`
  - `apps/wallpaper-tesseract/src/hierarchy`
  - `apps/wallpaper-tesseract/src/features/inspector`
  - `apps/wallpaper-tesseract/src/features/tool-windows`
  - moved parts of `features/scene`, `features/camera3`, and `gizmos`
- Delete tests that only assert old app-local import paths.
- Move surviving tests to `packages/editor` and collapse redundant boundary
  assertions into package-level invariants.
- Add forbidden import checks so app-local concrete editor paths cannot return.
- Update docs/current progress and this plan with the final moved/deleted
  source list.

Exit gate:

- No app-local concrete editor source remains except files explicitly assigned
  to later runtime or Phase 7 app-bootstrap owners.
- No app-local barrel re-exports editor package internals.
- `rg` for old app-local import paths returns only boundary tests or migration
  notes in this plan.

Suggested grep:

```text
rg "from [\"'](?:\\.\\./)+(?:debug|hierarchy|features/inspector|features/tool-windows|gizmos/camera3|features/scene|features/camera3)" apps/wallpaper-tesseract/src packages/editor/src --glob "!**/*.test.ts" --glob "!apps/wallpaper-tesseract/src/architecture-boundaries.test.ts"
```

## Step 9: Final Phase 6 Browser And Evidence Gate

Purpose: prove package extraction preserved editor behavior and did not regress
the Phase 5.5 graph gate.

Run:

```text
npm run test
npm run typecheck
npm run build
$env:PROJECT_PRISM_SMOKE_EVIDENCE="temp/project-prism-phase-6-smoke-data.json"; npm run test -w wallpaper-tesseract -- project-prism-smoke-evidence-file
```

Then run browser smoke from a fresh dev server:

```text
npm run dev -w wallpaper-tesseract
```

Smoke scenarios:

- boot to visible Scene;
- window menu opens/focuses Debug, Hierarchy, Inspector, Scene;
- dock/undock/merge/split/float loop still proves graph placement and single
  DOM parent per content id;
- splitter resize still maps hit target to graph split id;
- Scene fullscreen/restore;
- Camera3 gizmo render and click/double-click;
- persistence reload with v2 logical descriptors and no actor ids;
- mobile/narrow viewport.

Artifacts:

- Store new Phase 6 smoke data under:

```text
temp/project-prism-phase-6-smoke-data.json
temp/project-prism-phase-6-smoke-report.md
```

- Validate `temp/project-prism-phase-6-smoke-data.json` with the existing
  evidence-file validator.
- Keep `temp/project-prism-phase-6-entry-smoke-data.json` as the immutable
  pre-extraction baseline. It is not sufficient for Phase 6 completion.

Final exit gate:

- `packages/editor` is in workspace scripts.
- Editor package tests/typecheck/build pass.
- App imports editor public installers only.
- Runtime packages and `ui-framework` do not import editor.
- App-local concrete editor source is deleted or explicitly assigned to later
  non-editor owners.
- Root test/typecheck/build pass.
- `temp/project-prism-phase-6-smoke-data.json` exists and validates.
- Browser smoke passes with graph/DOM/input/persistence parity preserved.

## Stop Conditions

Stop and amend the plan before continuing if any of these happen:

- Moving a feature requires editor to own runtime world, camera, renderer,
  renderable, frame source, or scheduler state.
- Moving a feature requires a second app/editor state store.
- App composition needs a facade that forwards old feature installers into the
  new package.
- Tests require broad casts or test-only fake facades to keep passing.
- Package extraction would preserve old app-local barrels as compatibility
  aliases.
- `WindowWorkspaceGraph` parity smoke fails.
- Boundary facts would have to mark `editor` allowed while blockers still exist.

The correct response to any stop condition is to delete or move the conflicting
owner, or write a narrower amended plan. Do not add a compatibility layer.
