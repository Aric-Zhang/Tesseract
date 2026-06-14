# Project Prism Phase 10 Runtime Production Ownership Plan

Status: completed 2026-06-14. Drafted 2026-06-13 after Phase 9 commit
`77f34ef9`; executed after checkpoint commit `ced355b1`.

Purpose: close the remaining runtime ownership/package-placement debt without
adding a compatibility layer. Phase 10 should move the app-local production
runtime staging into a real runtime owner boundary, delete the old app-local
staging files, and prove that Scene/Tesseract/Camera3 runtime behavior remains
owned by runtime code rather than editor presentation or app composition.

## Execution Result

Phase 10 created `packages/wallpaper-runtime` as a real production runtime
owner, not a re-export facade. Runtime scheduler/work attachment, Camera3
motion, Tesseract4 runtime actor/renderable ownership, runtime Scene content,
runtime Scene frame-source ownership, and runtime Scene view registry moved
into the package. The old `apps/wallpaper-tesseract/src/runtime` directory was
deleted.

`RuntimeSceneSession` was deleted instead of moved; `RuntimeSceneViewRuntime`
now owns `RuntimeThreeSceneRenderOutput` directly. Scene feature component
definition installation now owns only Scene presentation binding; runtime
Camera3/Tesseract definitions are installed through
`installWallpaperRuntimeComponentDefinitions`.

Fresh Phase 10 browser evidence was generated at:

```text
temp/project-prism-phase-10-smoke-data.json
temp/project-prism-phase-10-smoke-report.md
```

The validator passed:

```powershell
$env:PROJECT_PRISM_SMOKE_EVIDENCE="temp/project-prism-phase-10-smoke-data.json"; npm run test -w wallpaper-tesseract -- project-prism-smoke-evidence-file
```

Closure hardening after review:

- mobile smoke validation now requires key UI rects to intersect the reported
  mobile viewport, preventing desktop-sized measurements from passing as mobile
  evidence;
- fresh Phase 10 mobile evidence was regenerated at 390x844 and passes the
  stricter validator;
- `wallpaper-runtime` public exports were narrowed so app code cannot bypass
  the runtime owner by importing internal Scene/Tesseract/Camera3 constructors
  or individual component definitions;
- app-local Scene integration is classified as `wallpaper-scene-integration`,
  not as an editor package candidate.

## Current Facts

Phase 9 is complete:

- `features/install-wallpaper-product-features.ts` was deleted.
- `features/app-menu/app-menu-model.ts` was deleted.
- the old workspace mode module was replaced by the narrow
  `features/scene-run-mode-command.ts`;
- DCK-007 is closed with fresh Phase 9 smoke evidence;
- root `npm run test`, `npm run typecheck`, and `npm run build` pass.

Current runtime staging lives under:

```text
apps/wallpaper-tesseract/src/runtime/
```

Important staging files:

```text
runtime-scheduler-service.ts
runtime-work-attachment-runtime.ts
runtime-scene-session.ts
runtime-scene-frame-source.ts
runtime-scene-content.ts
runtime-scene-view-runtime.ts
tesseract4-runtime-world.ts
tesseract4-runtime-renderable.ts
camera3/camera3-motion-component.ts
camera3/camera3-motion-definition.ts
tesseract4/*
```

The app-local runtime staging is already much cleaner than the old
`SceneRuntime` / `RuntimeObject` bus. It does not import editor UI or window
placement. The remaining debt is package placement and ownership clarity:

- `create-wallpaper-app.ts` still imports runtime scheduler, runtime-work
  attachment, runtime Scene view registry, Camera3 component definitions, and
  Tesseract component definitions from app-local runtime staging.
- `features/scene/install-scene-view-feature.ts` still wires editor Scene
  presentation, runtime Scene view runtime, Camera3 gizmo actor, and runtime
  content in one view factory callback.
- `runtime-scene-session.ts` is mostly a small wrapper over
  `RuntimeThreeSceneRenderOutput`; Phase 10 should delete it if direct
  `runtime-three` ownership is simpler.
- `runtime-scene-frame-source.ts` still combines presentation visibility
  checks, Camera3 motion, and render output invocation. It is not wrong, but it
  is the seam where runtime and editor presentation must stay explicit.
- `tesseract4` and Camera3 runtime motion are product/runtime implementation,
  not editor presentation and not reusable `runtime-core` contracts.
- `features/scene/components/install-component-definitions.ts` still installs
  both Scene viewport binding and runtime Camera3 motion definitions. This is a
  hidden ownership leak: Scene presentation should install only Scene binding;
  runtime definitions should come from the runtime owner.
- `features/scene/components/index.ts` still re-exports runtime Camera3 motion
  symbols and definitions. Phase 10 must delete that convenience surface rather
  than moving it to a new barrel.

Current `project-prism-boundary-facts.ts` blockers are empty. Phase 10 should
add temporary runtime package-placement facts and a formal
`wallpaper-runtime` boundary zone before moving code, then remove blockers only
when app-local staging is deleted and the final smoke gate passes.

## Target Shape

The expected end state is:

- a runtime owner package contains the production runtime implementation that
  is currently app-local staging;
- `runtime-core` remains renderer-agnostic contracts only;
- `runtime-three` remains generic Three/WebGL backend only;
- `packages/wallpaper-runtime` is a real source zone for production Wallpaper
  runtime implementation, not a nicer name for app-local staging;
- editor packages keep presentation, gizmo UI, and commands, but do not own
  runtime resources;
- Scene feature component installation owns only Scene presentation binding.
  Runtime Camera3/Tesseract component definitions are installed by
  `wallpaper-runtime`;
- `apps/wallpaper-tesseract/src/runtime` is deleted, or contains no production
  implementation and no compatibility barrel;
- `create-wallpaper-app.ts` imports runtime owner package APIs and wires only
  top-level dependencies;
- Scene feature installation is a connector between editor presentation,
  window view registration, and the runtime owner; it does not create renderer
  internals or product runtime actors by hand.

Default package name for execution:

```text
packages/wallpaper-runtime
```

Reason: the remaining implementation is production runtime for this Wallpaper
Tesseract app, including Tesseract4 and Camera3 motion. It is not generic enough
for `runtime-core`, and pushing actor/component ownership into `runtime-three`
would pollute the reusable Three backend. `wallpaper-runtime` is acceptable only
if it owns real implementation and tests. It must not be a facade over
`apps/wallpaper-tesseract/src/runtime`.

If implementation proves that a smaller deletion-only cleanup removes a wrapper
without needing the package, take the smaller path. But do not leave app-local
runtime staging merely because a package migration is inconvenient.

## Non-Negotiables

- Do not create a compatibility barrel from app-local `src/runtime`.
- Do not keep duplicate app-local and package runtime implementations.
- Do not move editor presentation or DOM/window placement into the runtime
  owner package.
- `packages/wallpaper-runtime` must not import `packages/editor`,
  `packages/ui-framework`, app-local `window-runtime`, app-local `features`,
  app composition, DOM host ownership, or browser `window` code.
- Do not move Tesseract4 or Camera3 runtime truth into `packages/editor`.
- Do not let Scene feature components re-export runtime Camera3 motion APIs or
  runtime component definitions.
- Do not add fake facades, test-only ports, or cast-heavy migration shims to
  preserve old imports.
- Do not put product runtime code into `runtime-core`.
- Do not put actor/component ownership into `runtime-three` unless it is a
  genuinely generic backend primitive.
- Add package dependencies only when moved code imports them directly. Do not
  pre-load `wallpaper-runtime` with broad `four-*` or editor/UI dependencies.
- Delete wrappers such as `RuntimeSceneSession` if they only forward to an
  existing runtime-three owner.
- Add a package only when it lets app-local staging disappear. Package creation
  is not an acceptable substitute for deletion.

## Step 0: Entry Gate And Baseline

Purpose: prove Phase 10 starts from the accepted Phase 9 state.

Actions:

1. Confirm the worktree is clean:

```powershell
git status --short
```

2. Confirm Phase 9 evidence still validates:

```powershell
$env:PROJECT_PRISM_SMOKE_EVIDENCE="temp/project-prism-phase-9-smoke-data.json"; npm run test -w wallpaper-tesseract -- project-prism-smoke-evidence-file
```

3. Run targeted runtime/editor/app tests before moving files:

```powershell
npm run test -w wallpaper-tesseract -- runtime-scene-view-runtime runtime-scene-session runtime-work-attachment-runtime runtime-scheduler-service camera3-components tesseract4 install-scene-view-feature scene-run-mode-command render-loop architecture-boundaries project-prism-boundary-report
npm run typecheck -w wallpaper-tesseract
npm run test -w editor
npm run typecheck -w editor
npm run test -w runtime-core
npm run typecheck -w runtime-core
npm run test -w runtime-three
npm run typecheck -w runtime-three
```

4. Record current app-local runtime imports:

```powershell
rg -n 'from "../runtime|from "../../runtime|from "\\.\\./runtime|from "\\.\\./\\.\\./runtime' apps/wallpaper-tesseract/src -g "*.ts"
rg -n "RuntimeSceneViewRuntimeRegistry|ProductionRuntimeSchedulerService|RuntimeWorkAttachmentRuntime|installTesseract4ComponentDefinitions|installSceneCamera3ComponentDefinitions|camera3MotionComponentDefinition|createRuntimeSceneViewRuntime|createRenderableSceneView|createSceneViewActor" apps/wallpaper-tesseract/src packages -g "*.ts"
```

Exit:

- no uncommitted changes before edits;
- all baseline targeted checks pass;
- the import map is saved in the execution report or commit notes.

Stop if:

- Phase 9 smoke evidence no longer validates;
- root app tests fail before Phase 10 edits;
- current implementation differs from the file list in this plan enough that
  package placement should be redesigned first.

## Step 1: Add Temporary Runtime Placement Facts

Purpose: make the remaining runtime staging explicit before moving code, so the
project does not silently claim the runtime owner is complete while app-local
staging still exists.

Actions:

1. Update `apps/wallpaper-tesseract/src/test-support/project-prism-boundary-facts.ts`
   with Phase 10 blockers such as:

```text
runtime-production-package-placement
runtime-scene-view-runtime-app-local
tesseract4-runtime-app-local
camera3-motion-runtime-app-local
runtime-work-attachment-app-local
scene-component-definition-runtime-leak
```

2. Add a formal `wallpaper-runtime` source zone and package target before
   moving implementation:

```text
source zone: ^packages/wallpaper-runtime/src/
package target: wallpaper-runtime
```

3. Lock the dependency direction immediately:
   - `wallpaper-runtime` may import only packages it actually depends on, such
     as `actor-core`, `runtime-core`, `runtime-three`, and `three`;
   - `wallpaper-runtime` must not import `packages/editor`,
     `packages/ui-framework`, app-local `window-runtime`, app-local `features`,
     `apps/wallpaper-tesseract/src/app`, app menu, Debug, Inspector,
     Hierarchy, DOM host code, or browser `window` code;
   - `packages/editor` must not import `wallpaper-runtime`.
4. Keep blockers specific. Do not add one broad "runtime is messy" blocker.
5. Update `architecture-boundaries.test.ts` so these facts are asserted and
   visible in the generated boundary report.
6. Update this plan only if the facts reveal a cleaner deletion path than
   creating `packages/wallpaper-runtime`.

Exit:

- boundary tests pass with the new temporary blockers;
- every blocker has a deletion condition tied to a concrete file/API removal;
- `wallpaper-runtime` appears in boundary facts as a real target/source zone;
- package targets do not claim final runtime ownership until blockers are
  removed.

Validation:

```powershell
npm run test -w wallpaper-tesseract -- architecture-boundaries project-prism-boundary-report
```

## Per-Step Import Grep Set

Run this import grep set after every migration step. Record the delta in the
execution report or commit notes rather than waiting for the final gate.

```powershell
rg -n 'from "../runtime|from "../../runtime|from "\\.\\./runtime|from "\\.\\./\\.\\./runtime' apps/wallpaper-tesseract/src -g "*.ts"
rg -n "Camera3MotionComponent|camera3MotionComponentDefinition|installSceneCamera3ComponentDefinitions" apps/wallpaper-tesseract/src/features/scene/components apps/wallpaper-tesseract/src/app/create-wallpaper-app.ts -g "*.ts"
rg -n "from .*wallpaper-runtime" packages/editor packages/ui-framework packages/runtime-core packages/runtime-three -g "*.ts"
rg -n "from .*packages/editor|from .*packages/ui-framework|from .*window-runtime|from .*features|from .*src/app|HTMLElement|Document|Window\\b" packages/wallpaper-runtime/src -g "*.ts"
```

Allowed matches must be explicit and temporary:

- app imports may move from app-local `src/runtime` to `wallpaper-runtime`;
- Scene component runtime Camera3 exports must trend to zero before Step 4
  exits;
- reusable packages must not import `wallpaper-runtime`;
- `wallpaper-runtime` must not learn editor, UI, app composition, or DOM/window
  ownership.

## Step 2: Create The Runtime Owner Package Without A Facade

Purpose: establish the destination package only if it immediately receives real
implementation.

Actions:

1. Create:

```text
packages/wallpaper-runtime/package.json
packages/wallpaper-runtime/tsconfig.json
packages/wallpaper-runtime/src/index.ts
```

2. Add package scripts:

```json
"test": "vitest run --passWithNoTests src",
"typecheck": "tsc --noEmit -p tsconfig.json",
"build": "tsc -p tsconfig.json"
```

3. Add dependencies only for moved code that imports them directly. Initial
   expected dependencies are:

```text
actor-core
runtime-core
runtime-three
three
```

   Do not add `four-rotation`, `four-camera`, or `four-camera-three` unless a
   moved implementation file directly imports them. If one becomes necessary,
   document the reason in the execution report.
4. Update root `package.json` scripts to include `wallpaper-runtime` in
   `test`, `typecheck`, and `build`. Root scripts are hand-written; place it
   after the packages it actually depends on and before `wallpaper-tesseract`.
5. Do not export app-local aliases. `src/index.ts` should export only package
   implementation moved in the following steps.

Exit:

- the package exists but does not contain compatibility wrappers;
- root scripts include it;
- no app imports it until at least one real runtime owner file has moved.

Validation:

```powershell
npm run test -w wallpaper-runtime
npm run typecheck -w wallpaper-runtime
npm run build -w wallpaper-runtime
```

Stop if:

- the package would only re-export app-local runtime files. In that case, do
  not create it; redesign Step 2 around deleting wrappers in place.

## Step 3: Move Runtime Scheduling And Runtime-Work Attachment

Purpose: move the generic actor/runtime bridge first because other runtime
components depend on it.

Move:

```text
apps/wallpaper-tesseract/src/runtime/runtime-scheduler-service.ts
apps/wallpaper-tesseract/src/runtime/runtime-work-attachment-runtime.ts
apps/wallpaper-tesseract/src/runtime/runtime-scheduler-service.test.ts
apps/wallpaper-tesseract/src/runtime/runtime-work-attachment-runtime.test.ts
```

To:

```text
packages/wallpaper-runtime/src/runtime-scheduler-service.ts
packages/wallpaper-runtime/src/runtime-work-attachment-runtime.ts
```

Actions:

1. Rewrite imports to use `actor-core` and `runtime-core` public APIs directly.
   Do not import `apps/wallpaper-tesseract/src/actor-runtime`.
2. Export the scheduler and runtime-work attachment from
   `packages/wallpaper-runtime/src/index.ts`.
3. Update `create-wallpaper-app.ts` imports to use `wallpaper-runtime`.
4. Delete the app-local files after imports are updated.

Exit:

- `rg -n "runtime-scheduler-service|runtime-work-attachment-runtime" apps/wallpaper-tesseract/src/runtime apps/wallpaper-tesseract/src -g "*.ts"` shows no app-local implementation import except updated package imports;
- package tests own the moved tests;
- app still creates the scheduler and attachment runtime once.
- the per-step import grep set has been run and the only changed matches are
  expected imports from `wallpaper-runtime`.

Validation:

```powershell
npm run test -w wallpaper-runtime -- runtime-scheduler-service runtime-work-attachment-runtime
npm run test -w wallpaper-tesseract -- render-loop component-definitions
npm run typecheck -w wallpaper-tesseract
```

## Step 4: Split Component Definition Ownership

Purpose: delete the current hidden runtime export surface from Scene
components before moving Camera3 runtime implementation. Scene presentation
must not remain a convenient barrel for runtime truth.

Current problem:

```text
apps/wallpaper-tesseract/src/features/scene/components/install-component-definitions.ts
apps/wallpaper-tesseract/src/features/scene/components/index.ts
```

These files currently install and export both Scene viewport binding and
runtime Camera3 motion definitions.

Actions:

1. Change the Scene component installer so it installs only
   `sceneCamera3ViewportBindingComponentDefinition`.
2. Rename the installer if that makes ownership clearer, for example
   `installSceneComponentDefinitions`. Do not keep a compatibility alias with
   the old mixed name.
3. Remove these exports from `features/scene/components/index.ts`:

```text
Camera3MotionComponent
Camera3MotionComponentOptions
camera3MotionComponentType
camera3MotionComponentDefinition
```

4. Add or plan the runtime-side definition installer in
   `wallpaper-runtime`, for example:

```text
installWallpaperRuntimeComponentDefinitions
```

   It should install runtime Camera3 and Tesseract definitions after those
   definitions move. It must not install Scene presentation binding.
5. Update `create-wallpaper-app.ts` and component-definition tests so Scene
   binding and runtime definitions are installed by separate owners.

Exit:

- Scene feature components export no runtime Camera3 component or definition;
- no production caller imports runtime Camera3 symbols from
  `features/scene/components`;
- runtime component definitions have one owner path, either already moved into
  `wallpaper-runtime` or explicitly represented by the next migration step;
- the per-step import grep set has been run and the Scene component Camera3
  runtime matches trend to zero.

Validation:

```powershell
npm run test -w wallpaper-tesseract -- component-definitions install-scene-view-feature architecture-boundaries
npm run typecheck -w wallpaper-tesseract
```

## Step 5: Move Camera3 Runtime Motion Ownership

Purpose: keep camera runtime truth in runtime code while editor remains a
presentation/command consumer.

Move:

```text
apps/wallpaper-tesseract/src/runtime/camera3/camera3-motion-component.ts
apps/wallpaper-tesseract/src/runtime/camera3/camera3-motion-definition.ts
apps/wallpaper-tesseract/src/runtime/camera3/camera3-components.test.ts
```

To:

```text
packages/wallpaper-runtime/src/camera3/
```

Actions:

1. Rewrite component imports to use `actor-core`, `runtime-core`, and
   `runtime-three` public APIs.
2. Keep editor Camera3 gizmo APIs typed through `runtime-core` command/view
   state contracts. Do not make `packages/editor` import `wallpaper-runtime`.
3. Export:

```text
Camera3MotionComponent
camera3MotionComponentType
camera3MotionComponentDefinition
```

4. Update runtime component-definition installation imports to use the
   `wallpaper-runtime` definition owner. Do not re-export Camera3 runtime
   symbols from Scene components.
5. Delete the app-local `runtime/camera3` directory when empty.

Exit:

- `packages/editor` has no dependency on `wallpaper-runtime`;
- Camera3 motion runtime owner has one definition source;
- no app-local camera3 runtime component remains.
- Scene feature components do not export or install Camera3 runtime motion;
- the per-step import grep set has been run and has no unexpected
  `camera3MotionComponentDefinition` matches outside `wallpaper-runtime` and
  package tests.

Validation:

```powershell
npm run test -w wallpaper-runtime -- camera3
npm run test -w editor -- camera3
npm run test -w wallpaper-tesseract -- component-definitions install-scene-view-feature
npm run typecheck -w wallpaper-tesseract
```

## Step 6: Move Or Delete The Runtime Scene Session Wrapper

Purpose: remove the ambiguous app-local scene session wrapper before moving
higher-level Scene view runtime.

Decision rule:

- If `RuntimeSceneSession` adds no real ownership beyond
  `RuntimeThreeSceneRenderOutput`, delete it and let the Scene view runtime own
  `RuntimeThreeSceneRenderOutput` directly.
- If tests show it captures useful ownership semantics, move it to
  `packages/wallpaper-runtime/src/scene/` and rename it to describe that
  ownership precisely.

Actions:

1. Inspect `runtime-scene-session.ts` and usages.
2. Prefer deleting `RuntimeSceneSession` and replacing call sites with direct
   `createRuntimeThreeSceneRenderOutput`.
3. Preserve one clear object-host/render-output ownership path. Tesseract must
   not scatter direct operations across arbitrary `THREE.Scene` instances.
   Either the Scene view runtime owns `RuntimeThreeSceneRenderOutput` directly,
   or `wallpaper-runtime` owns one precisely named host.
4. Keep a narrow object host type only if Tesseract attachment needs it:

```ts
interface RuntimeSceneObjectHost {
  attachObject(object: THREE.Object3D): RuntimeRegistration;
}
```

5. Do not keep both `RuntimeSceneSession` and direct render output ownership.

Exit:

- one scene render output owner remains;
- `RuntimeSceneSession` is either deleted or moved with a precise name and real
  tests;
- no duplicate render-output disposal path exists.
- Tesseract attachment goes through the package-owned object host/render output
  owner, not through scattered direct scene mutation;
- the per-step import grep set has been run.

Validation:

```powershell
npm run test -w wallpaper-runtime -- runtime-scene
npm run test -w wallpaper-tesseract -- runtime-scene-view-runtime install-scene-view-feature
```

## Step 7: Move Tesseract4 Runtime Ownership

Purpose: package product runtime world/renderable/actor ownership and delete the
app-local Tesseract runtime staging.

Move:

```text
apps/wallpaper-tesseract/src/runtime/tesseract4-runtime-world.ts
apps/wallpaper-tesseract/src/runtime/tesseract4-runtime-renderable.ts
apps/wallpaper-tesseract/src/runtime/tesseract4-runtime-world.test.ts
apps/wallpaper-tesseract/src/runtime/tesseract4-runtime-renderable.test.ts
apps/wallpaper-tesseract/src/runtime/tesseract4/*
```

To:

```text
packages/wallpaper-runtime/src/tesseract4/
```

Actions:

1. Keep Tesseract4 world/renderable runtime-only. It must not import editor,
   window runtime, app composition, or DOM UI.
2. Rewrite actor/component imports to `actor-core` public APIs.
3. Keep `runtime-work` attachment dependency inside `wallpaper-runtime`.
4. Export only the actor factory, component definition, component type, and
   renderable/world APIs that production or tests actually use.
5. Delete app-local Tesseract runtime files and directories after imports move.

Exit:

- one Tesseract4 runtime implementation exists;
- app-local `runtime/tesseract4` and app-local
  `tesseract4-runtime-*` files are gone;
- component-definition installation comes from `wallpaper-runtime`;
- no compatibility re-export remains in app-local runtime.
- the per-step import grep set has been run and no Scene feature component
  barrel exports Tesseract or Camera3 runtime definitions.

Validation:

```powershell
npm run test -w wallpaper-runtime -- tesseract4
npm run test -w wallpaper-tesseract -- component-definitions install-scene-view-feature
npm run typecheck -w wallpaper-tesseract
```

## Step 8: Move Runtime Scene View Runtime And Frame Source Registry

Purpose: package the runtime owner that currently connects runtime content,
render output, Camera3 motion, and frame-source rendering.

Move or rewrite:

```text
apps/wallpaper-tesseract/src/runtime/runtime-scene-content.ts
apps/wallpaper-tesseract/src/runtime/runtime-scene-frame-source.ts
apps/wallpaper-tesseract/src/runtime/runtime-scene-view-runtime.ts
apps/wallpaper-tesseract/src/runtime/runtime-scene-session.test.ts
apps/wallpaper-tesseract/src/runtime/runtime-scene-view-runtime.test.ts
```

To:

```text
packages/wallpaper-runtime/src/scene/
```

Actions:

1. Keep the presentation boundary explicit:

```ts
interface RuntimeSceneViewVisibilityPort {
  readonly sceneViewActorId: string;
  measureNow(): void;
  isVisibleInCurrentLocation(): boolean;
}
```

2. The package may accept this narrow data/query port, but it must not receive
   `EditorSceneViewHost`, DOM elements, window location sources, dock/frame/tab
   concepts, or app composition objects. It may ask for visibility and
   measurement snapshots; it may not own presentation.
3. Make runtime child actor ids derive from the Scene View actor id in one
   owner. Do not reintroduce product-level constants.
4. Ensure frame-source registry ownership is either package-owned or deleted in
   favor of a simpler package-owned current-renderable model. Do not keep both.
5. Update `features/scene/install-scene-view-feature.ts` imports to use the
   package runtime owner.
6. Delete app-local runtime scene files after imports move.

Exit:

- `features/scene/install-scene-view-feature.ts` still creates editor
  presentation and Camera3 gizmo actor, but does not create render outputs,
  Tesseract actors, or frame-source registry objects directly;
- `RuntimeSceneViewRuntimeRegistry` comes from `wallpaper-runtime`;
- no app-local `runtime-scene-*` files remain;
- tests cover close/reopen and disposal so stale frame sources/content cannot
  survive.
- the package port names do not imply editor, DOM, window frame, tab, or dock
  ownership;
- the per-step import grep set has been run.

Validation:

```powershell
npm run test -w wallpaper-runtime -- runtime-scene-view-runtime runtime-scene-session
npm run test -w wallpaper-tesseract -- install-scene-view-feature runtime-scene-view-runtime
npm run typecheck -w wallpaper-tesseract
```

## Step 9: Delete App-Local Runtime Staging And Flip Boundaries

Purpose: remove the old runtime staging surface completely.

Actions:

1. Delete `apps/wallpaper-tesseract/src/runtime` if empty.
2. If any file remains, document why it is app composition rather than runtime
   implementation. Prefer moving or deleting it instead.
3. Run hard greps:

```powershell
rg -n 'from "../runtime|from "../../runtime|from "\\.\\./runtime|from "\\.\\./\\.\\./runtime' apps/wallpaper-tesseract/src -g "*.ts"
rg -n "RuntimeSceneViewRuntimeRegistry|ProductionRuntimeSchedulerService|RuntimeWorkAttachmentRuntime|camera3MotionComponent|tesseract4Component|RuntimeSceneSession|SceneViewFrameSourceRegistry" apps/wallpaper-tesseract/src -g "*.ts"
rg -n "Camera3MotionComponent|camera3MotionComponentDefinition|installSceneCamera3ComponentDefinitions" apps/wallpaper-tesseract/src/features/scene/components apps/wallpaper-tesseract/src/app/create-wallpaper-app.ts -g "*.ts"
rg -n "from .*packages/editor|from .*packages/ui-framework|from .*window-runtime|from .*features|from .*src/app|HTMLElement|Document|Window\\b" packages/wallpaper-runtime/src -g "*.ts"
```

Allowed matches:

- imports from `wallpaper-runtime`;
- test names that assert package imports;
- no app-local implementation paths.

4. Update `project-prism-boundary-facts.ts`:
   - remove Phase 10 temporary blockers only after deletion;
   - add rules preventing `packages/wallpaper-runtime` from importing editor,
     UI/window, or app composition;
   - keep app composition thin and explicit.
5. Update `architecture-boundaries.test.ts` to assert:
   - app-local `src/runtime` production implementation is gone;
   - `packages/editor` does not import `wallpaper-runtime`;
   - `wallpaper-runtime` does not import editor/UI/app composition;
   - Scene components do not re-export runtime Camera3 component definitions;
   - runtime component definitions are installed by `wallpaper-runtime`;
   - app does not re-export a runtime compatibility barrel.

Exit:

- old app-local runtime staging has been deleted;
- boundary facts have no remaining Phase 10 runtime placement blockers;
- boundary tests fail if app-local runtime staging returns.

Validation:

```powershell
npm run test -w wallpaper-tesseract -- architecture-boundaries project-prism-boundary-report
npm run test -w wallpaper-runtime
npm run typecheck -w wallpaper-runtime
npm run build -w wallpaper-runtime
```

## Step 10: Runtime Behavior Regression Gate

Purpose: prove the migration preserved real runtime behavior, not just imports.

Required tests:

```powershell
npm run test -w wallpaper-runtime
npm run typecheck -w wallpaper-runtime
npm run build -w wallpaper-runtime
npm run test -w editor
npm run typecheck -w editor
npm run build -w editor
npm run test -w wallpaper-tesseract -- component-definitions install-scene-view-feature scene-run-mode-command render-loop architecture-boundaries project-prism-boundary-report project-prism-frame-update-lane-map
npm run typecheck -w wallpaper-tesseract
```

Add or preserve package tests for:

- scheduler work ordering and deterministic disposal order;
- runtime work attach/detach registration;
- two `RuntimeSceneViewRuntime` instances do not share render output,
  frame-source registration, Tesseract actor ids, or Camera3 motion state;
- disposing one runtime Scene view unregisters its frame source and disposes
  render output without touching another runtime Scene view;
- closing a Scene view prevents stale frame source rendering, and reopening
  renders only the new runtime Scene view;
- Camera3 command sink changes runtime view state and remains
  command/query-driven;
- Tesseract runtime renderable attaches once and detaches on dispose;
- Tesseract actor/content attach and dispose are owned by runtime package
  lifecycle, not Scene feature installation;
- runtime work attachment updates only active actors/components.

Do not add a browser-only test for an invariant that can be covered by the
runtime package owner. Browser smoke is still required, but package tests should
own the lifecycle invariants.

## Step 11: Fresh Browser Smoke

Purpose: prove the packaged runtime owner works in the app.

Generate:

```text
temp/project-prism-phase-10-smoke-data.json
temp/project-prism-phase-10-smoke-report.md
```

Fresh browser matrix:

- boot baseline with no console errors;
- Scene viewport visible and canvas nonblank/measurable;
- Camera3 projection-mode action changes visible mode or runtime view-state
  hash;
- Scene fullscreen/restore;
- Scene close/reopen three times with Hierarchy exact-once counts for
  `Scene View`, `Tesseract4`, and `Camera3`;
- Debug -> Scene dock and Scene -> Debug dock both still visually mutate layout;
- persistence reload contains logical descriptors only, not actor ids, DOM ids,
  runtime frame ids, or content DOM ids;
- mobile viewport 390x844 fresh evidence with Scene, Tesseract canvas host,
  Window menu, and Camera3 gizmo rects.

Validator:

```powershell
$env:PROJECT_PRISM_SMOKE_EVIDENCE="temp/project-prism-phase-10-smoke-data.json"; npm run test -w wallpaper-tesseract -- project-prism-smoke-evidence-file
```

Do not reuse Phase 9 smoke data as Phase 10 pass evidence. Phase 9 evidence is
only a baseline.

## Step 12: Documentation And Final Validation

Actions:

1. Update:

```text
docs/current-project-progress.md
docs/project-prism-engine-modularization-outline.md
docs/known-defects-and-todos.md
```

2. Move any superseded execution notes to `temp/` only if they are no longer
   active plans.
3. Record the final grep evidence:

```powershell
rg -n 'from "../runtime|from "../../runtime|from "\\.\\./runtime|from "\\.\\./\\.\\./runtime' apps/wallpaper-tesseract/src -g "*.ts"
rg -n "apps/wallpaper-tesseract/src/runtime|features/install-wallpaper-product-features|workspace-mode|RuntimeObject|SceneRuntime|Tesseract4RuntimeObject|Camera3Rig|Camera3ProjectionModeController" apps packages docs -g "*.ts" -g "*.md"
rg -n "Camera3MotionComponent|camera3MotionComponentDefinition|installSceneCamera3ComponentDefinitions" apps/wallpaper-tesseract/src/features/scene/components apps/wallpaper-tesseract/src/app/create-wallpaper-app.ts -g "*.ts"
rg -n "from .*wallpaper-runtime" packages/editor packages/ui-framework packages/runtime-core packages/runtime-three -g "*.ts"
rg -n "from .*packages/editor|from .*packages/ui-framework|from .*window-runtime|from .*features|from .*src/app|HTMLElement|Document|Window\\b" packages/wallpaper-runtime/src -g "*.ts"
```

4. Run final root validation:

```powershell
$env:PROJECT_PRISM_SMOKE_EVIDENCE="temp/project-prism-phase-10-smoke-data.json"; npm run test -w wallpaper-tesseract -- project-prism-smoke-evidence-file
npm run test
npm run typecheck
npm run build
```

Exit:

- Phase 10 documentation says complete only after root validation passes;
- Vite chunk warning may remain if it is the existing warning;
- no active Phase 10 blocker remains in boundary facts or known defects.

## Stop Conditions

Stop and amend this plan if:

- `wallpaper-runtime` would become only a re-export facade;
- `wallpaper-runtime` cannot be represented as a formal boundary zone without
  importing editor/UI/app composition;
- moving runtime code requires `packages/editor` to import `wallpaper-runtime`;
- runtime code needs window placement, DOM host ownership, app menu, Debug Log,
  Inspector, or app composition imports;
- Scene feature components still need to export runtime Camera3 motion or
  runtime component definitions after Step 4;
- Tesseract or Camera3 runtime truth would be duplicated between app-local and
  package code;
- root package scripts cannot include `wallpaper-runtime` in dependency order
  before `wallpaper-tesseract`;
- deleting app-local `src/runtime` would require compatibility aliases;
- Scene fullscreen or close/reopen requires a global singleton Scene runtime;
- two runtime Scene view instances cannot be represented without global state;
- browser smoke can pass only by weakening the smoke contract or reusing Phase
  9 evidence.

## Completion Definition

Phase 10 is complete when:

- the production runtime owner implementation is package-owned or deleted into
  simpler existing owners;
- app-local `apps/wallpaper-tesseract/src/runtime` production staging is gone;
- app composition wires runtime package APIs but does not own runtime internals;
- editor remains presentation/command-only;
- Scene feature components own only Scene presentation binding, while runtime
  component definitions are owned by `wallpaper-runtime`;
- runtime package tests cover multi-instance/disposal invariants;
- fresh Phase 10 smoke evidence validates;
- root `test`, `typecheck`, and `build` pass.
