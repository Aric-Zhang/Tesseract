# Project Prism Phase 6 Editor Extraction Execution Plan

Status: completed Phase 6 editor extraction execution record with the
post-Phase-6 dock regression and diagnostics gate closed. The pre-entry
checkpoint is committed, editor state/presentation ownership has moved into
`packages/editor`, app-local editor compatibility owners were deleted rather
than wrapped, the final Phase 6 browser evidence gate validates, and the
2026-06-13 Debug/Scene repeated dock investigation has been resolved through
Step 10. The next large runtime-owner/app-bootstrap slice may start from this
record, with DCK-003 and DEV-001 retained only as watch items in
`docs/known-defects-and-todos.md`.

Current verified entry facts:

- `projectPrismPrePhase6UiFrameworkBlockers` is empty.
- `window-workspace-multi-truth-debt` is removed from boundary facts.
- `WindowWorkspaceGraph` is the production window placement truth.
- `WindowFramePort` is shell/presentation-only.
- `WindowContentHost`, `WindowContentAttachment`, `WindowDockSurfaceModel`, and
  `window-frame-dock-tree` are deleted from production/public reachability.
- Final entry smoke evidence exists under `temp/` and validates
  graph/DOM/input/persistence parity.
- Final Phase 6 smoke evidence exists under
  `temp/project-prism-phase-6-smoke-data.json` and validates with the same
  evidence-file test.
- The `editor` package target is marked `allowed` in boundary facts.
- Baseline checkpoint commit: `04f41ac` (`Complete Project Prism phase 6 entry
  gate`).

Current interruption facts from 2026-06-13:

- Visual browser reproduction: with only `Scene` and `Debug` side by side in
  the root frame, repeated docking from one sibling into the other could end
  with pointer capture and drag logs present but no visible dock mutation.
- Root cause found so far: `split-content` checked `newTabsetId` and
  `newSplitId` for duplicate dock node ids before removing the source branch
  and collapsing the old empty sibling. The working tree now removes the source
  first, then validates id conflicts against the remaining target frame.
- Verification already run for the local fix:
  `npm run test -w ui-framework -- window-workspace-graph`,
  `npm run build -w ui-framework`, and
  `npm run typecheck -w ui-framework`.
- Remaining verification blocker: root checks and renewed browser smoke
  evidence have not yet been run after the local fix.
- Maintenance blockers exposed by the same session are tracked in
  `docs/known-defects-and-todos.md`: silent dock commit failures, missing dock
  semantic trace in Debug Log, misleading gizmo ignore wording, lifecycle-side
  dock id derivation, and stale package dist during app dev verification.

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

Status: complete. The app-local `runtime/ports/feature-actor-context.ts` file
and barrel export were deleted. Actor factories now use
`ActorCreationContext` from `actor-core`, which keeps actor/component creation
off app-runtime glue without introducing an editor-owned facade.

## Step 2.6: Move Editor State And UI Frame Bindings To Package Owners

Purpose: remove the last app-local binding owners that would otherwise force
Debug/Hierarchy/Inspector extraction to import `state-runtime` or
`update-runtime` glue.

Status: complete. The app-local `state-runtime` directory was deleted and its
state observer binding contract/runtime moved to `packages/editor`. The UI
component frame update attachment/runtime moved from app-local `update-runtime`
to `packages/ui-framework`. The remaining app-local `update-runtime` barrel now
contains runtime-work attachment debt only.

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

Status: complete. Debug, Hierarchy, Inspector, and the shared tool-window
installer now live under `packages/editor/src`; the old app-local directories
were deleted instead of kept as compatibility barrels. App composition imports
the public editor package, and the moved editor package sources do not import
app-local `runtime/ports`, `window-runtime`, `app-runtime`, `test-support`, or
deleted `FeatureActorContext`.

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
- Debug, Hierarchy, Inspector tests run from the editor package. Stale
  app-runtime/test-support-heavy fixture tests were deleted instead of
  recreated with fake facades.
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
- `scene-window-actor-factory.ts` used to create `RuntimeSceneRenderOutput`.
- `scene-viewport-component.ts` used to render directly with `THREE.Camera`.
- Do not move those responsibilities into `packages/editor`.

### Step 4A: Runtime Render Output Owner Cleanup

Status: complete. `scene-window-actor-factory.ts` now receives a structural
Scene viewport render target instead of creating runtime render output;
`scene-viewport-component.ts` only hosts and sizes that target.
`RuntimeThreeSceneRenderOutput` lives in `packages/runtime-three`, the old
app-local `runtime/scene-render-output.ts` owner is deleted,
`renderable-scene-view.ts` performs graph-visible rendering through the
runtime-three render output, and `editor-scene-view-host.ts` no longer exposes
`renderWithCamera`.

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
- Move or replace Scene render output creation with a runtime-owned
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

Status: complete for presentation extraction. Scene View state, CSS,
viewport/mode-toggle components, actor factory, and editor Scene host moved to
`packages/editor/src/scene`. App-local `features/scene` now keeps only
runtime-facing wiring (`install-scene-view-feature`,
`scene-view-content-installer`, and `renderable-scene-view`) because those files
still compose Camera3, Tesseract, and runtime render output ownership. Do not
move that runtime wiring into `packages/editor`; delete or relocate it only
after Camera3/Tesseract runtime owners are clarified.

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
- App imports Scene presentation state, components, actor factory, host, and
  CSS from `editor`, not app `features/scene`.
- App-local Scene runtime wiring remains only for Camera3/Tesseract/render
  output composition and has a deletion condition; no idle duplicate remains.

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
- `packages/runtime-three/src/runtime-three-camera-motion-controller.ts`
- `packages/runtime-three/src/runtime-three-orbit-camera.ts`

Known caution:

- Camera motion/orbit ownership is runtime-three-owned. Do not place runtime
  camera ownership in editor or recreate app-local `camera3-control`.
- The old `features/camera3/model` shadow camera state was deleted during
  Step 5A. Do not recreate it as an editor facade.

### Step 5A: Camera3 Motion And Rig Ownership Decision - Complete

Purpose: decide and clean ownership before any Camera3 presentation move.

Completed work:

- Audited the former `Camera3MotionController`, `Camera3Rig`, and
  `Camera3ProjectionModeController`.
- Chose runtime camera state as the single truth. `Camera3Rig`,
  `Camera3ProjectionModeController`, `Camera3RigComponent`, and their tests were
  deleted instead of migrated.
- Camera motion command execution now initializes and mutates runtime camera
  state directly from plain options.
- Motion, component, gizmo, and boundary tests now assert runtime camera state
  directly.
- No `Camera3MotionController` facade was added in `packages/editor` or app
  composition.

Exit gate:

- `packages/editor` does not export or own camera motion control.
- `Camera3Rig` has no production owner; the type and component were deleted.
- Runtime camera truth is not duplicated between editor and runtime-three.
- App-local `camera3-control` is deleted.

Validation:

```text
npm run test -w runtime-core
npm run test -w runtime-three
npm run test -w wallpaper-tesseract -- architecture-boundaries camera3-components
npm run typecheck -w wallpaper-tesseract
```

### Step 5B: Camera3 Gizmo Presentation Extraction - Complete

Purpose: move Camera3 presentation only after Step 5A removes mixed runtime
camera ownership.

Completed work:

- Moved pure Camera3 gizmo UI, hit testing, state projection, renderer, actor
  factory, component definition, and tests to `packages/editor`.
- Moved Camera3 motion command execution and orbit camera state into
  `packages/runtime-three` as `RuntimeThreeCameraMotionController` and
  `RuntimeThreeOrbitCamera`; deleted the old app-local `camera3-control`
  directory and `runtime/camera3-runtime-camera.ts`.
- Moved camera command/view-state contracts to `runtime-core` so editor no
  longer imports app-local Camera3 runtime ownership.
- Deleted old app-local `gizmos/camera3` paths and replaced app imports with
  editor public API/CSS exports.

Exit gate:

- Editor owns Camera3 presentation only.
- Runtime camera state/commands are owned by `runtime-core` contracts and
  `runtime-three` implementation, not duplicated in editor or app-local staging.
- The app-local `camera3-control` owner is deleted.
- App composition does not instantiate Camera3 gizmo internals.

Validation:

```text
npm run test -w editor
npm run test -w runtime-three
npm run test -w wallpaper-tesseract -- architecture-boundaries camera3-gizmo camera3-components
npm run typecheck -w wallpaper-tesseract
```

Browser smoke:

- Camera3 gizmo renders.
- Click and double-click behavior still route through actor input.
- Gizmo active camera state follows runtime-derived view state.

## Step 6: Move Editor Component Definition Installation - Complete

Purpose: app composition should install editor components through the editor
package, not by collecting concrete feature definitions.

Completed work:

- Created `packages/editor/src/install-component-definitions.ts` as the unified
  editor package installer for state-observer, Inspector, Scene, Camera3 gizmo,
  Debug, and Hierarchy definitions.
- Replaced app composition's direct imports of concrete editor feature
  installers with `installEditorComponentDefinitions`.
- Collapsed app component-definition tests so they verify the editor package
  installer instead of preserving app knowledge of each editor feature
  installer.
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

## Step 7: Replace App Composition Wiring With Editor Public Installers - Complete For Editor Paths

Purpose: make the app compose editor defaults without knowing concrete editor
feature internals.

Completed work:

- Replaced direct app imports of Debug, Hierarchy, Inspector, Scene presentation,
  Camera3 gizmo presentation, and tool-window component installers with editor
  package public APIs.
- App component definition composition now calls the unified
  `installEditorComponentDefinitions` package installer.
- App-local Debug, Hierarchy, Inspector, Tool Window, and Camera3 gizmo source
  directories are gone.

Remaining Phase 7 / runtime-owner work:

- `create-wallpaper-app.ts` still wires product bootstrap policy: app state
  store, window workspace, hierarchy metadata, Debug log sink, Scene runtime
  staging, and Wallpaper lifecycle.
- `features/scene` and `features/camera3` remain app-local runtime staging, not
  editor presentation. Do not delete them under the old app-local editor-source
  cleanup rule.

Deferred work:

- Replace direct app imports of Tesseract runtime/editor internals only after
  Tesseract runtime ownership moves behind a package/public runtime installer.
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

## Step 8: Delete App-Local Editor Source And Tighten Boundaries - Mostly Complete

Purpose: make extraction irreversible by removing the old source layout.

Completed deletion:

- `apps/wallpaper-tesseract/src/debug`
- `apps/wallpaper-tesseract/src/hierarchy`
- `apps/wallpaper-tesseract/src/features/inspector`
- `apps/wallpaper-tesseract/src/features/tool-windows`
- `apps/wallpaper-tesseract/src/gizmos`

Current boundary:

- `features/scene` and `features/camera3` survive only as app-local runtime
  staging and should move under runtime ownership cleanup, not editor
  presentation cleanup.
- Tests that asserted old app-local editor import paths were either moved to
  `packages/editor` or collapsed into package/app boundary invariants.

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

Status: complete. Root test/typecheck/build passed, browser smoke ran against
the Vite dev server, and
`$env:PROJECT_PRISM_SMOKE_EVIDENCE="temp/project-prism-phase-6-smoke-data.json"; npm run test -w wallpaper-tesseract -- project-prism-smoke-evidence-file`
passed.

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

## Step 10: Post-Phase-6 Dock Regression And Diagnostics Gate - Complete

Status: complete on 2026-06-13. The repeated Debug/Scene dock regression is
covered at reducer, lifecycle/controller, and browser-smoke levels. Split dock
node ids are now allocated by `WindowWorkspaceGraph`, not lifecycle callers.
`WindowFrameIntentSink.requestCommitDock` returns `WindowDockCommitResult`, and
`handleWindowFrameTabInputEnd` exposes a narrow `dockCommit` evidence object
containing the drag preview, generated intent, and commit result. This keeps the
diagnostic path assertable without making Debug Log or app composition a
placement owner.

Purpose: close the real Debug/Scene repeated dock regression found after Phase
6 extraction, and remove the diagnostic blind spots that made the failure look
like an input-capture issue instead of a rejected graph transaction.

This is not a compatibility or logging expansion project. The work must keep
`WindowWorkspaceGraph` as the single placement truth. Any diagnostics added
here may report lifecycle/graph results, but they must not store placement
state, derive alternate dock targets, or become a second decision path.

Completed items before the next large Phase 6+ slice:

1. DCK-005 fixed-pending-verification became fully verified.
   - Keep the reducer fix that removes the source content and collapses empty
     branches before duplicate dock node validation.
   - Add a lifecycle/controller-level regression test for the actual repeated
     two-tab split dock path, not only the reducer helper. The test must cover
     `commitDock` returning a committed result after one sibling releases ids
     that the other sibling would otherwise reuse.
   - Run root validation after the local package build:

```text
npm run test
npm run typecheck
npm run build
```

   - Run browser smoke against rebuilt workspace package output and include the
     repeated two-tab Debug/Scene dock path. The smoke evidence must prove
     visual graph/DOM parity, not only pointer capture.
   - Update either `temp/project-prism-phase-6-smoke-data.json` plus its report,
     or add a narrow follow-up evidence file if regenerating the full Phase 6
     smoke would hide the regression detail.

2. DCK-001 and DCK-002 received one narrow semantic dock trace.
   - `requestCommitDock(intent)` must no longer discard useful commit failure
     information silently.
   - Use exactly one explicit contract exit:
     - change `WindowFrameIntentSink.requestCommitDock` to return
       `WindowDockCommitResult`; or
     - give the lifecycle owner a narrow diagnostic sink that receives the
       existing `WindowDockCommitResult` and graph/lifecycle reasons.
   - Prefer the return-value path if it keeps call sites simpler. Use the sink
     path only if returning the result would make input plumbing own diagnostic
     policy.
   - Do not add a new placement owner, event bus, facade, or internal-only log
     that QA cannot assert.
   - The trace should cover:

```text
preview -> dock intent -> lifecycle validation -> graph transaction -> commit result
```

   - Debug Log may display this trace only as diagnostic output. It must not
     become a dock target source, graph cache, or lifecycle authority.

3. DCK-004 was completed as a hard Step 10 cleanup item.
   - Move dock split id allocation into the graph reducer. The existence of
     public `newTabsetId` / `newSplitId` inputs and lifecycle-side derived id
     construction is already enough evidence of unnecessary complexity.
   - Delete `newTabsetId` and `newSplitId` from the public
     `WindowWorkspaceGraphTransaction` split surface.
   - Delete lifecycle-side `createDerivedGraphTabsetId` /
     `createDerivedGraphSplitId` callers rather than wrapping them.
   - Let graph tests assert uniqueness and repeated split/dock cycles without
     caller-provided dock node ids.
   - Delete or rewrite tests and fixtures that only exist to preserve the old
     caller-provided id transaction API.

4. DCK-003 and DEV-001 remain follow-up cleanup/watch items, not blockers by
   themselves.
   - If Step 10 touches gizmo debug logging, fix the
     `buttons-zero-without-capture` wording or behavior in the same pass.
   - Before browser smoke, always rebuild package output consumed by the app:

```text
npm run build -w ui-framework
npm run build -w editor
npm run dev -w wallpaper-tesseract
```

     If only `ui-framework` changed, the `editor` build may be skipped, but the
     smoke report must state which package outputs were rebuilt.
   - If the stale-dist path remains confusing, replace it with a simpler dev
     workflow in a later tooling cleanup rather than hiding it in ad hoc notes.

Exit gate:

- DCK-005 is no longer `fixed-pending-verification`.
- A lifecycle/controller-level `commitDock` regression test covers the repeated
  two-tab split dock path that reproduced the visual failure.
- DCK-004 is closed: split dock graph node ids are allocated by the graph model,
  not lifecycle callers, and the transaction API no longer exposes
  `newTabsetId` / `newSplitId`.
- Root validation passed after rebuilding package output consumed by the app
  dev server.
- Browser evidence includes the repeated two-tab `Debug`/`Scene` dock scenario
  and proves the final visual layout, graph snapshot, and DOM parent parity.
- A failed dock commit produces a concise semantic reason through a return value
  that tests can assert.
- No new package API, app-local facade, fake test port, or alternate placement
  model was added to carry the diagnostics.
- `docs/known-defects-and-todos.md` and `docs/current-project-progress.md` are
  updated with the verified status.

Verification completed:

```text
npm run test -w ui-framework -- window-workspace-graph window-frame-lifecycle-controller
npm run test -w wallpaper-tesseract -- window-frame-tab-input app-menu-bar-component architecture-boundaries
npm run typecheck -w ui-framework
npm run typecheck -w wallpaper-tesseract
npm run build -w ui-framework
npm run build -w editor
npm run test
npm run typecheck
npm run build
```

Browser evidence:

```text
temp/project-prism-phase-6-step10-dock-regression-evidence.json
temp/project-prism-phase-6-step10-debug-scene-repeat-dock.png
```

Stop and amend this Step 10 plan if:

- The trace needs Debug Log to own or reconstruct placement state.
- Fixing id allocation requires preserving both caller-provided ids and
  reducer-generated ids.
- The chosen dock diagnostic exit cannot be asserted by tests or smoke
  evidence.
- Browser evidence passes only by checking pointer capture logs while the
  visual layout or DOM parent parity is unverified.
- The app dev server keeps serving stale package output in a way that makes
  smoke evidence unreproducible.

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
