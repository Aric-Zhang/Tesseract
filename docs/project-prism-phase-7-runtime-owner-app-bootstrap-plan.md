# Project Prism Phase 7 Runtime Owner And Thin App Composition Plan

Status: completed execution record, drafted 2026-06-13; Steps 1-12 ran
successfully in the working tree on 2026-06-13. The closure record moved to
`temp/project-prism-phase-7-closure-plan.md`, and the next active plan is
`docs/project-prism-phase-8-runtime-scene-composition-plan.md`.

Phase 7 remains the "Thin Wallpaper App Composition" phase. Phase 6 already
moved editor presentation into `packages/editor`, closed the post-Phase-6 dock
gate, and made window workspace placement graph-owned. Phase 7 therefore did
not redo editor extraction or window graph cleanup; it performed a
deletion-first runtime-owner and app-bootstrap cleanup.

The goal is to make `apps/wallpaper-tesseract/src/app/create-wallpaper-app.ts`
wire package-owned installers and environment services only. App composition
must stop owning Scene runtime wiring, Camera3 runtime staging, Tesseract
runtime renderable placement, workspace-mode presentation policy, concrete
actor ids, hierarchy metadata, and app-local registration ports.

## Current Implementation Verdict

Phase 7 started from these concrete adjustments:

- Treat Scene presentation as complete. `packages/editor/src/scene` owns the
  Scene View presentation, DOM viewport host, mode toggle, state, CSS, and actor
  factory. Do not move this work again.
- Treat Camera3 gizmo presentation as complete. `packages/editor/src/camera3`
  owns gizmo display, hit testing, and actor-input presentation. Do not move
  runtime camera ownership into editor.
- Treat window workspace graph truth as complete. `WindowWorkspaceGraph` owns
  placement. Do not introduce any app-local placement cache, old dock tree,
  compatibility host, or fake test surface.
- Move remaining app-local runtime ownership before thinning app composition.
  This slice has now deleted app-local `runtime/ports`, `app-runtime`, old
  `features/camera3`, old `tesseract4`, the mixed Scene content installer, and
  app-local app policy files under `src/app`. Runtime Scene session/content,
  Camera3 motion, Tesseract actor/renderable, and runtime-work attachment now
  live under app-local runtime staging while package ownership continues
  converging.
- Prefer deleting transitional files over creating a new "bootstrap facade".
  A new installer is acceptable only when it is owned by the package/domain that
  owns the facts and when the old app-local owner is deleted in the same slice.

## Non-Negotiables

- No compatibility barrels for old app-local feature paths.
- No fake facade to preserve test setup.
- No broad `as` cast to keep old fixture shapes alive.
- No resurrection of `SceneRuntime`, `RuntimeObject`, dock trees, placement
  hosts, or app-local runtime object buses.
- No editor-owned runtime resources. Editor may present runtime state and send
  commands, but runtime world/camera/render output ownership must live in
  runtime owners.
- No runtime package imports from editor/app composition/UI internals.
- No app-local owner left idle after a package or runtime owner replaces it.
- Keep the app thin by reducing facts, not by moving the same facts behind a
  differently named wrapper.

## Current Facts To Preserve

- `packages/editor` is part of root scripts and must remain package-boundary
  clean.
- `packages/runtime-core` owns runtime frame, scheduler, world/camera/projection
  and frame-source contracts.
- `packages/runtime-three` owns Three camera, scene, renderer, render output,
  frame source, line renderable, orbit camera, and camera motion controller.
- `apps/wallpaper-tesseract/src/runtime` is app-local production runtime
  staging. It may remain a short-lived product runtime owner only if it does not
  depend on editor, UI framework, app composition, actor-input, or app-runtime
  debt.
- `apps/wallpaper-tesseract/src/app` is app composition and should shrink.
- `apps/wallpaper-tesseract/src/app-runtime` and
  `apps/wallpaper-tesseract/src/runtime/ports` were transitional glue and have
  been deleted, not renamed.
- `apps/wallpaper-tesseract/src/features/install-wallpaper-product-features.ts`,
  `apps/wallpaper-tesseract/src/features/install-wallpaper-component-definitions.ts`,
  `apps/wallpaper-tesseract/src/features/workspace-mode.ts`, and
  `apps/wallpaper-tesseract/src/gizmo-runtime/install-component-definitions.ts`
  are the remaining explicit app-composition debt. Do not hide them behind a
  bootstrap facade; keep deleting or moving facts to their real owners.

## Expected Deletion Targets

This execution slice deleted or moved these transitional paths:

```text
apps/wallpaper-tesseract/src/runtime/ports
apps/wallpaper-tesseract/src/app/adapters/runtime-frame-adapter.ts
apps/wallpaper-tesseract/src/app-runtime
apps/wallpaper-tesseract/src/features/camera3
apps/wallpaper-tesseract/src/features/scene/scene-view-content-installer.ts
apps/wallpaper-tesseract/src/tesseract4/tesseract4-runtime-renderable.ts
apps/wallpaper-tesseract/src/app/workspace-mode.ts
apps/wallpaper-tesseract/src/app/app-actor-ids.ts
apps/wallpaper-tesseract/src/app/install-component-definitions.ts
```

`features/scene/renderable-scene-view.ts` intentionally remains because it is
now a Scene feature presentation/runtime-frame-source bridge over a runtime
Scene session, not the old mixed Scene content owner. Any surrounding file may
survive only when it is reduced to Wallpaper-specific shell/environment
bootstrap. Do not keep a file merely as a barrel for old imports.

## Entry Gate

Before editing production code:

```text
git status --short
npm run test -w wallpaper-tesseract -- architecture-boundaries
npm run test -w wallpaper-tesseract -- project-prism-smoke-contract
$env:PROJECT_PRISM_SMOKE_EVIDENCE="temp/project-prism-phase-6-smoke-data.json"; npm run test -w wallpaper-tesseract -- project-prism-smoke-evidence-file
npm run typecheck -w wallpaper-tesseract
```

The entry smoke evidence command must include `PROJECT_PRISM_SMOKE_EVIDENCE`.
Without that environment variable, `project-prism-smoke-evidence-file.test.ts`
skips the evidence file check and only proves the test file can load. Use the
latest accepted Phase 6 smoke file as the immutable baseline. Phase 7 exit uses
a new Phase 7 evidence file.

If these fail from unrelated dirty work, record the exact failure and do not use
it as an excuse to add compatibility paths.

## Exit Gate Grep Convention

Every step that uses grep must separate production reachability from
test/support history:

- Production grep must exclude tests, test-support files, smoke artifacts, and
  boundary-test historical assertions. It must be zero unless the step names an
  intentionally surviving production owner.
- Test/support grep may still find old names only when they are boundary locks,
  deletion assertions, or migrated owner tests. Old fixtures that preserve an
  obsolete shape must be deleted or rewritten.
- A grep match inside `architecture-boundaries.test.ts` is not production
  reachability. It is acceptable only if it asserts the old path cannot return.

Use this production grep shape unless a step gives a narrower file list:

```text
rg -n "<pattern>" apps/wallpaper-tesseract/src packages -g "*.ts" -g "!**/*.test.ts" -g "!**/test-support/**" -g "!**/architecture-boundaries.test.ts"
```

Use this test/support audit shape:

```text
rg -n "<pattern>" apps/wallpaper-tesseract/src packages -g "*.ts"
```

## Step 0: Freeze Current Phase 7 Facts

Purpose: make the starting point explicit before deleting cross-domain glue.

Work:

- Record the current `projectPrismSourceZones`, debt blockers, and package
  target status.
- Confirm `wallpaper-app` is the only package target still blocked by
  `app-composition-debt` and `app-runtime-debt`.
- Confirm `runtime-ownership-debt` currently includes app-local Scene,
  Camera3, and Tesseract staging.
- Confirm no Phase 6 window workspace blocker has returned.

Exit:

- `docs/current-project-progress.md` points to this Phase 7 plan as the active
  execution plan.
- The architecture boundary test still passes before code movement.

## Step 1: Delete App-Local Runtime Port Aliases

Purpose: remove the remaining generic contracts from
`apps/wallpaper-tesseract/src/runtime/ports` when a real package owner already
exists.

Work:

- Replace `UpdateFrameClock` with `RuntimeFrameClock` from `runtime-core`.
- Replace app-local `UpdateFrame` with the owning frame type at each lane:
  runtime work uses `RuntimeFrame` from `runtime-core`; UI components and UI
  services use `UiFrame` from `ui-framework`; editor state receives the frame
  through `AppStateChangedEvent` / `AppFrameStateController` ownership.
- Replace app-local `RuntimeRegistration` with `runtime-core`'s
  `RuntimeRegistration`.
- Replace app-local `StateChangedEvent` imports with the owning package event:
  `AppStateChangedEvent` from `editor` for editor state, or
  `UiLayoutStateChangedEvent` from `ui-framework` for UI layout.
- Delete `app/adapters/runtime-frame-adapter.ts` if `UpdateFrame` and
  `RuntimeFrame` are unified.
- Delete `runtime/ports` and all tests/fixtures that exist only to preserve it.
- Update `AppFrameOrchestrator` so it remains an explicit lane orchestrator,
  not a source of a new global frame alias. If a lane needs conversion, put the
  conversion at the owner boundary and delete the old adapter once unused.

Do not:

- Create a new app-local `ports` barrel.
- Keep aliases named `UpdateFrame`, `RuntimeRegistration`, or
  `StateChangedEvent` for convenience.
- Introduce a new all-system `Frame` type to make runtime, UI, and editor state
  look interchangeable.

Exit grep:

Production:

```text
rg -n "runtime/ports|UpdateFrameClock|toRuntimeFrame" apps/wallpaper-tesseract/src packages -g "*.ts" -g "!**/*.test.ts" -g "!**/test-support/**" -g "!**/architecture-boundaries.test.ts"
```

Test/support audit:

```text
rg -n "runtime/ports|UpdateFrameClock|toRuntimeFrame" apps/wallpaper-tesseract/src packages -g "*.ts"
```

Expected result: no production dependency on app-local runtime ports or the
runtime frame adapter. Test/support matches must be migrated owner tests or
boundary assertions that forbid the old aliases.

Validation:

```text
npm run test -w runtime-core
npm run test -w wallpaper-tesseract -- app-frame-orchestrator ui-frame-scheduler workspace-mode app-menu-bar-component architecture-boundaries
npm run typecheck -w wallpaper-tesseract
```

## Step 2: Remove `app-runtime` As A Mixed Mega-Context

Purpose: delete `AppRuntimeContext` instead of replacing it with another hidden
owner of actor, input, editor state, UI frame, and runtime scheduler facts.

Work:

- Define the narrow replacement shape before deleting `AppRuntimeContext`.
  The replacement must satisfy `ActorCreationContext` and disposal only:
  `actorSystem`, `componentRegistry`, `trackRegisteredActor(actor)`, and
  `dispose()`. It must not expose frame state, gizmo event system, scheduler,
  window focus, or feature registries.
- Prefer putting this actor creation/disposal scope in `actor-core` if it is
  generic. If it stays app-owned temporarily, keep it private to bootstrap and
  do not let feature packages import it by module path.
- If runtime objects still need tracking, use `runtime-core` registration /
  disposable helpers at the runtime owner boundary instead of adding
  `trackRegisteredObject` to the actor creation scope.
- Move or eliminate `CompositeComponentAttachmentRuntime`.
  - Preferred: if multiple attachment runtimes remain necessary, make the
    generic composition primitive live with `actor-core` or simplify
    `ComponentRegistry` to accept a small ordered list.
  - Do not keep it under app-local `app-runtime`.
- Keep each attachment runtime with its real owner:
  - runtime work attachment with runtime ownership;
  - frame update attachment with `ui-framework`;
  - state observer attachment with `editor`;
  - gizmo controller and active input cancellation with `actor-input`;
  - actor system and component registry with `actor-core`.
- Compose these owners explicitly at the bootstrap boundary without creating a
  new `AppRuntimeContext` facade.
- Delete `trackRegisteredObject`; keep `trackRegisteredActor` only as part of
  the narrow `ActorCreationContext` implementation required by actor factories.

Do not:

- Rename `AppRuntimeContext` to a new `WallpaperRuntimeContext`.
- Add a service locator or broad context object that features can import.
- Let runtime owners import editor state or window UI to participate in the
  component attachment path.
- Add a disposal bag that also exposes app services. Disposal and service
  discovery must stay separate.

Exit grep:

Production:

```text
rg -n "AppRuntimeContext|app-runtime|CompositeComponentAttachmentRuntime|trackRegisteredObject" apps/wallpaper-tesseract/src packages -g "*.ts" -g "!**/*.test.ts" -g "!**/test-support/**" -g "!**/architecture-boundaries.test.ts"
```

Narrow actor creation scope audit:

```text
rg -n "trackRegisteredActor" apps/wallpaper-tesseract/src packages -g "*.ts" -g "!**/*.test.ts" -g "!**/test-support/**" -g "!**/architecture-boundaries.test.ts"
```

Test/support audit:

```text
rg -n "AppRuntimeContext|app-runtime|CompositeComponentAttachmentRuntime|trackRegisteredObject|trackRegisteredActor" apps/wallpaper-tesseract/src packages -g "*.ts"
```

Expected result: `apps/wallpaper-tesseract/src/app-runtime` is deleted, and
production code has no app-runtime import. Any surviving production
`trackRegisteredActor` appears only in the narrow `ActorCreationContext`
implementation or direct actor-core contract, not in feature/runtime service
lookup.

Validation:

```text
npm run test -w actor-core
npm run test -w actor-input
npm run test -w editor -- state-observer
npm run test -w ui-framework -- ui-frame-update
npm run test -w wallpaper-tesseract -- app-runtime architecture-boundaries
npm run typecheck
```

The `app-runtime` test selector should disappear when its files are deleted;
replace it with the package tests that prove the moved ownership.

## Step 3: Establish The Minimal Runtime Scene Session Owner

Purpose: create the real production runtime Scene owner before moving Tesseract
or Camera3. This prevents a temporary structure where new Tesseract/Camera
owners are still invoked by the old mixed `installSceneViewContent` sequence.

Target shape:

- A `RuntimeSceneSession` or equivalent owner lives in the runtime domain.
- It owns the Three render output.
- It owns runtime camera/motion state or receives it from a runtime camera
  owner.
- It owns runtime renderable attachments such as Tesseract.
- It exposes only:
  - a structural render target for editor Scene View presentation;
  - narrow camera command/view-state ports for editor Camera3 gizmo;
  - a render/update port for app frame orchestration;
  - runtime frame-source evidence if still needed.

Work:

- Build only the minimal runtime Scene owner skeleton needed to replace the
  mixed owner in `scene-view-content-installer.ts`.
- Keep editor Scene View actor creation in `packages/editor`.
- Keep `WindowContentRegistrationPort` usage at the editor/UI boundary, not in
  runtime resource owners.
- Make the skeleton independent from editor actor factories, window lifecycle,
  app composition, and app-local `runtime/ports`.
- Write owner tests around render output creation/disposal and render target
  exposure before migrating Tesseract/Camera3.

Do not:

- Let the runtime Scene owner import `editor`, `ui-framework`, `window-runtime`,
  or `features/scene`.
- Keep `installSceneViewContent` as the owner and call the new session from it
  long-term.
- Add a facade whose only job is to preserve the old Scene installer call
  sequence.

Exit grep:

Production:

```text
rg -n "RuntimeSceneSession|installSceneViewContent|createRuntimeThreeSceneRenderOutput" apps/wallpaper-tesseract/src packages -g "*.ts" -g "!**/*.test.ts" -g "!**/test-support/**" -g "!**/architecture-boundaries.test.ts"
```

Test/support audit:

```text
rg -n "RuntimeSceneSession|installSceneViewContent|createRuntimeThreeSceneRenderOutput" apps/wallpaper-tesseract/src packages -g "*.ts"
```

Expected result: production has one named runtime Scene owner and the old mixed
installer is not the long-lived owner. Any remaining `installSceneViewContent`
production match must be a short-lived call site being deleted by Step 6, not a
new compatibility layer.

Validation:

```text
npm run test -w runtime-three
npm run test -w wallpaper-tesseract -- runtime scene architecture-boundaries
npm run typecheck -w wallpaper-tesseract
```

## Step 4: Move Tesseract Into The Runtime Scene Owner

Purpose: make Tesseract a runtime-owned product renderable attached through the
runtime Scene owner, not an app-local actor feature that happens to own a
runtime renderable.

Work:

- Move `Tesseract4RuntimeRenderable` beside `Tesseract4RuntimeWorld` or to the
  runtime owner that owns product runtime renderables.
- Attach Tesseract through the runtime Scene session owner established in
  Step 3.
- Use `runtime-core` registration/disposable contracts directly.
- Keep `four-camera`, `four-camera-three`, `four-rotation`, `runtime-core`, and
  `runtime-three` dependencies in the runtime owner, not in editor or app
  composition.
- Split or delete the actor component so it no longer owns runtime renderable
  placement. If a Tesseract actor remains, it is only an actor/component
  lifecycle binding to the runtime owner.
- Move component definition installation out of
  `app/install-component-definitions.ts` into the runtime/Tesseract owner or
  delete it if the actor binding disappears.
- Delete `apps/wallpaper-tesseract/src/tesseract4/tesseract4-runtime-renderable.ts`.

Do not:

- Move Tesseract runtime ownership into `packages/editor`.
- Keep `createTesseract4Actor` reachable from app composition.
- Preserve `Tesseract4RuntimeObject` or any runtime-object-style interface.
- Let old `scene-view-content-installer.ts` remain the place that decides which
  Tesseract renderable attaches to which render output.

Exit grep:

Production:

```text
rg -n "Tesseract4RuntimeObject|tesseract4-runtime-renderable|createTesseract4Actor|installTesseract4ComponentDefinitions" apps/wallpaper-tesseract/src/app apps/wallpaper-tesseract/src/features packages/editor -g "*.ts" -g "!**/*.test.ts" -g "!**/test-support/**" -g "!**/architecture-boundaries.test.ts"
```

Test/support audit:

```text
rg -n "Tesseract4RuntimeObject|tesseract4-runtime-renderable|createTesseract4Actor|installTesseract4ComponentDefinitions" apps/wallpaper-tesseract/src packages -g "*.ts"
```

Expected result: app composition and editor do not import concrete Tesseract
runtime/component internals. Tesseract runtime renderable code lives with the
runtime owner or is deleted, and old tests move to the owner.

Validation:

```text
npm run test -w runtime-core
npm run test -w runtime-three
npm run test -w wallpaper-tesseract -- tesseract4 runtime architecture-boundaries
npm run typecheck -w wallpaper-tesseract
```

## Step 5: Move Camera3 Runtime Motion Into The Runtime Scene Owner

Purpose: remove the app-local Camera3 staging folder by separating runtime
camera ownership from editor gizmo/viewport presentation after the runtime
Scene owner exists.

Work:

- Split `Camera3MotionComponent` into:
  - runtime camera/motion owner using `RuntimeThreeCameraMotionController`;
  - editor-facing command/view-state port consumed by the Camera3 gizmo.
- Move the runtime camera/motion owner into the runtime Scene session or a
  runtime camera owner that the session owns.
- Reduce `SceneCamera3ViewportBindingComponent` to presentation binding only:
  resize viewport -> runtime camera projection; runtime camera state -> editor
  gizmo view state.
- Place that presentation binding with the owner that owns the presentation
  contract. If it remains in editor, it must not own the runtime camera object.
- Delete `apps/wallpaper-tesseract/src/features/camera3` after the split.

Do not:

- Let `packages/editor` own `RuntimeThreeCameraMotionController`.
- Keep both old `Camera3MotionComponent` and a new runtime camera owner.
- Add a compatibility command sink that forwards to both old and new camera
  paths.
- Let old `scene-view-content-installer.ts` continue to create camera motion.

Exit grep:

Production:

```text
rg -n "features/camera3|Camera3MotionComponent|sceneCamera3ViewportBindingComponentType|RuntimeThreeCameraMotionController" apps/wallpaper-tesseract/src packages/editor packages/runtime-three -g "*.ts" -g "!**/*.test.ts" -g "!**/test-support/**" -g "!**/architecture-boundaries.test.ts"
```

Test/support audit:

```text
rg -n "features/camera3|Camera3MotionComponent|sceneCamera3ViewportBindingComponentType|RuntimeThreeCameraMotionController" apps/wallpaper-tesseract/src packages -g "*.ts"
```

Expected result: no app-local `features/camera3` production source remains;
`RuntimeThreeCameraMotionController` is owned by the runtime path only; editor
gizmo talks to a narrow command/view-state contract.

Validation:

```text
npm run test -w runtime-three -- runtime-three-camera-motion-controller
npm run test -w editor -- camera3
npm run test -w wallpaper-tesseract -- architecture-boundaries
npm run typecheck
```

## Step 6: Delete The Mixed Scene Content Installer

Purpose: delete `scene-view-content-installer.ts` as the place where editor
Scene actor creation, runtime render output creation, Camera3 motion, Camera3
gizmo, and Tesseract actor creation are mixed.

Work:

- Replace the view factory flow so editor Scene View creation receives the
  runtime Scene session's render target and ports, instead of creating runtime
  resources itself.
- Replace `SceneViewFrameSourceRegistry` with a package/runtime-owned frame
  source or delete it if visibility-aware rendering can be expressed by the
  accepted runtime-frame-source contract plus editor host visibility.
- Make app render orchestration call a runtime-owned render/update port instead
  of `sceneFeature.renderableSceneViews.current?.render()`.
- Delete `scene-view-content-installer.ts` and `renderable-scene-view.ts`.
- Delete or move `scene-view-content-installer.test.ts`; do not keep it with
  fake ports just to preserve the old installer shape.

Do not:

- Keep `installSceneViewContent` as a facade over the old sequence.
- Let runtime session code import editor actor factories.
- Let editor Scene View create `RuntimeThreeSceneRenderOutput`,
  `Tesseract4RuntimeRenderable`, or runtime camera objects.

Exit grep:

Production:

```text
rg -n "installSceneViewContent|SceneViewFrameSourceRegistry|createRuntimeThreeSceneRenderOutput|createTesseract4Actor|createCamera3GizmoActor|renderableSceneViews" apps/wallpaper-tesseract/src packages/editor -g "*.ts" -g "!**/*.test.ts" -g "!**/test-support/**" -g "!**/architecture-boundaries.test.ts"
```

Test/support audit:

```text
rg -n "installSceneViewContent|SceneViewFrameSourceRegistry|createRuntimeThreeSceneRenderOutput|createTesseract4Actor|createCamera3GizmoActor|renderableSceneViews" apps/wallpaper-tesseract/src packages -g "*.ts"
```

Expected result: the old mixed Scene content installer and renderable registry
are gone. App composition no longer reaches into Scene runtime internals. Any
test/support match is a deletion assertion or a migrated runtime Scene owner
test.

Validation:

```text
npm run test -w editor -- scene
npm run test -w runtime-three
npm run test -w wallpaper-tesseract -- scene architecture-boundaries
npm run typecheck
```

## Step 7: Move Workspace Mode And App Menu Out Of App Composition

Purpose: remove app-local editor/window presentation policy from `app`.

Work:

- Move `WorkspaceModeController` into the owner of editor workspace
  presentation, or delete it if current `WindowWorkspacePresentationController`
  can express the behavior directly.
- Use `AppStateChangedEvent` from `editor` and UI/window presentation ports from
  `ui-framework`; do not depend on app-local runtime ports.
- Move app menu feature code to the package owner that matches its semantics:
  - prefer `packages/editor` if it remains an editor window/workspace command
    menu;
  - prefer `packages/ui-framework` only if the code is made product-agnostic and
    does not know editor workspace paths.
- Delete `apps/wallpaper-tesseract/src/features/app-menu` when moved.
- Delete `apps/wallpaper-tesseract/src/app/workspace-mode.ts`.

Do not:

- Keep app menu under app merely as a historical location.
- Add duplicate workspace-mode state outside `editor` state.
- Reintroduce checkbox-style window visibility toggles.

Exit grep:

Production:

```text
rg -n "WorkspaceModeController|features/app-menu|installAppMenuFeature|workspaceModePath|StateChangedEvent" apps/wallpaper-tesseract/src/app apps/wallpaper-tesseract/src/features packages -g "*.ts" -g "!**/*.test.ts" -g "!**/test-support/**" -g "!**/architecture-boundaries.test.ts"
```

Test/support audit:

```text
rg -n "WorkspaceModeController|features/app-menu|installAppMenuFeature|workspaceModePath|StateChangedEvent" apps/wallpaper-tesseract/src packages -g "*.ts"
```

Expected result: app composition installs menu/workspace mode through a package
installer or no longer owns those policies. Test/support matches are migrated
owner tests or boundary assertions only.

Validation:

```text
npm run test -w editor -- workspace app-menu
npm run test -w ui-framework -- app-menu
npm run test -w wallpaper-tesseract -- app-menu-bar-component workspace-mode architecture-boundaries
npm run typecheck
```

Delete obsolete app-local tests after their owner tests exist.

## Step 8: Promote Window Workspace Assembly To Package-Owned Installers

Purpose: stop app composition from knowing window controller/factory internals,
default open view details, and concrete floating policies.

Work:

- Split workspace assembly by owner:
  - `ui-framework` may own only generic workspace surface, frame lifecycle,
    graph-backed placement, persistence controller, dock preview, frame ports,
    view factory registry, and storage-port wiring;
  - editor installers contribute Debug, Hierarchy, Inspector, Scene
    presentation descriptors, default open views, menu commands, and floating
    policies;
  - runtime installers contribute Scene/Tesseract/Camera runtime view/session
    descriptors through narrow runtime ports;
  - app composition only calls these installers and passes environment ports.
- Keep browser storage/localStorage as an injected app environment port, not as
  a reusable UI framework fact.
- Move default view/floating policy collection to editor/runtime feature
  installers. App composition should not assemble Debug, Hierarchy, Inspector,
  Scene, or tool-window policy maps directly.
- Delete app-local `window-runtime` compatibility barrels as package exports
  become direct.
- Delete app-level actor id constants that only preserve the old source layout.

Do not:

- Move product-specific Debug/Scene/Tesseract knowledge into `ui-framework`.
- Move editor workspace mode paths or product actor ids into `ui-framework`.
- Add app-local policy registries that duplicate `WindowWorkspaceViewCatalog`.
- Preserve `window-runtime` as an alias layer over `ui-framework`.

Exit grep:

Production:

```text
rg -n "createSceneWindowWorkspaceFloatingFramePolicy|createToolWindowWorkspaceFloatingFramePolicies|createInspectorWindowWorkspaceFloatingFramePolicies|defaultOpenViews|floatingFramePolicies|app-actor-ids|from \"\\.\\./window-runtime\"|from \"\\.\\./\\.\\./window-runtime\"" apps/wallpaper-tesseract/src/app apps/wallpaper-tesseract/src/features packages -g "*.ts" -g "!**/*.test.ts" -g "!**/test-support/**" -g "!**/architecture-boundaries.test.ts"
```

Test/support audit:

```text
rg -n "createSceneWindowWorkspaceFloatingFramePolicy|createToolWindowWorkspaceFloatingFramePolicies|createInspectorWindowWorkspaceFloatingFramePolicies|defaultOpenViews|floatingFramePolicies|app-actor-ids|from \"\\.\\./window-runtime\"|from \"\\.\\./\\.\\./window-runtime\"" apps/wallpaper-tesseract/src packages -g "*.ts"
```

Expected result: app composition imports package installer APIs and app
environment ports only; it does not assemble concrete feature policy maps.
`ui-framework` remains product-agnostic, with no Scene/Debug/Hierarchy/
Inspector/Tesseract/Camera policy facts.

Validation:

```text
npm run test -w ui-framework
npm run test -w editor
npm run test -w wallpaper-tesseract -- window-workspace architecture-boundaries
npm run typecheck
```

## Step 9: Collapse `create-wallpaper-app.ts` To Thin Bootstrap

Purpose: finish the Phase 7 app boundary after all old owners have moved or
been deleted.

Target responsibilities allowed in `create-wallpaper-app.ts`:

- Create the app shell/mount slots.
- Create environment services such as `window`, `document`, storage, render
  loop, and Wallpaper Engine lifecycle hooks.
- Instantiate actor/component runtime primitives if they are truly the top-level
  program runtime, not feature policy.
- Call package-owned installers.
- Connect narrow ports between package owners.
- Start/stop the render loop and dispose top-level registrations.

Responsibilities not allowed:

- Concrete Scene, Debug, Hierarchy, Inspector, Camera3, or Tesseract actor ids.
- Hierarchy metadata maps for concrete features.
- Debug log sink policy that reaches into concrete Debug component instances.
- Direct feature actor factory calls.
- Direct runtime render output, Tesseract renderable, or Camera3 motion
  creation.
- Floating policy maps or default open view arrays assembled from concrete
  feature imports.
- Workspace mode presentation logic.

Exit grep:

Production:

```text
rg -n "SCENE_WINDOW_ACTOR_ID|TESSERACT4_ACTOR_ID|CAMERA3_GIZMO_ACTOR_ID|DEBUG_LOG_WINDOW_ACTOR_ID|HIERARCHY_PANEL_ACTOR_ID|createActorHierarchyObjectSource|debugLogWindow|createDefault.*WindowState|register.*Parameters|renderableSceneViews|installSceneViewFeature|installToolWindowFeatures|installInspectorFeature" apps/wallpaper-tesseract/src/app/create-wallpaper-app.ts -g "*.ts" -g "!**/*.test.ts"
```

Test/support audit:

```text
rg -n "SCENE_WINDOW_ACTOR_ID|TESSERACT4_ACTOR_ID|CAMERA3_GIZMO_ACTOR_ID|DEBUG_LOG_WINDOW_ACTOR_ID|HIERARCHY_PANEL_ACTOR_ID|createActorHierarchyObjectSource|debugLogWindow|createDefault.*WindowState|register.*Parameters|renderableSceneViews|installSceneViewFeature|installToolWindowFeatures|installInspectorFeature" apps/wallpaper-tesseract/src packages -g "*.ts"
```

Expected result: no match unless a reviewed line is an app-shell/environment
constant with an explicit owner comment. Test/support matches must be locks or
migrated package-owner tests, not old app bootstrap fixtures.

Validation:

```text
npm run test -w wallpaper-tesseract -- create-wallpaper-app app-shell app-frame-orchestrator architecture-boundaries
npm run typecheck -w wallpaper-tesseract
```

## Step 10: Tighten Boundary Facts And Delete Obsolete Tests

Purpose: make the Phase 7 deletion executable so future agents cannot recreate
the old staging.

Work:

- Update `project-prism-boundary-facts.ts`:
  - remove or shrink `app-runtime-debt` only after the directory is gone;
  - remove `runtime-ownership-debt` entries only after code reality changes;
  - move `wallpaper-app` package target to allowed only when app composition is
    actually thin.
- Strengthen `architecture-boundaries.test.ts`:
  - forbid app-local `runtime/ports`;
  - forbid `AppRuntimeContext`;
  - forbid `features/camera3` app-local production source;
  - forbid mixed Scene content installer names;
  - forbid app composition concrete feature ids/policies.
- Delete tests that only assert old staging modules.
- Move behavior tests to package owners when files move.

Do not:

- Loosen boundary tests to make a move pass.
- Keep old tests with cast-heavy fake facades.

Validation:

```text
npm run test -w wallpaper-tesseract -- architecture-boundaries
npm run test
npm run typecheck
```

## Step 11: Browser Smoke And Phase 7 Evidence

Purpose: prove the app still works visually and interactively after the app
bootstrap is thinned.

Before starting the dev server:

```text
npm run build -w actor-core
npm run build -w actor-input
npm run build -w ui-framework
npm run build -w runtime-core
npm run build -w runtime-three
npm run build -w editor
npm run dev -w wallpaper-tesseract
```

Required browser smoke:

- App boots with zero console errors.
- Scene canvas is visible and measurable.
- Tesseract remains visible.
- Camera3 gizmo renders, drag changes camera behavior, and double-click snap
  still works.
- App menu opens, hover follows the pointed row, and open/focus commands work.
- Debug, Hierarchy, Inspector, and Scene windows can be opened/focused.
- Debug/Scene repeated dock path remains visually successful.
- Fullscreen run mode enter/exit preserves graph/DOM/input/persistence parity.
- Narrow/mobile viewport keeps Window menu, Scene view, and Camera3 gizmo
  measurable.
- Smoke evidence uses a new Phase 7 file, not the Phase 6 baseline:

```text
temp/project-prism-phase-7-smoke-data.json
```

Validator:

```text
$env:PROJECT_PRISM_SMOKE_EVIDENCE="temp/project-prism-phase-7-smoke-data.json"; npm run test -w wallpaper-tesseract -- project-prism-smoke-evidence-file
```

## Step 12: Final Phase 7 Acceptance

Phase 7 is complete only when:

- `apps/wallpaper-tesseract/src/app/create-wallpaper-app.ts` is thin bootstrap.
- `apps/wallpaper-tesseract/src/app-runtime` is deleted.
- `apps/wallpaper-tesseract/src/runtime/ports` is deleted.
- app-local Scene/Camera3/Tesseract runtime ownership staging is deleted or
  moved to a real runtime owner with old paths removed. For this slice, the old
  app-local Scene content installer, `features/camera3`, and `tesseract4`
  directories are deleted; remaining runtime staging lives under
  `apps/wallpaper-tesseract/src/runtime` and is tracked as future package
  placement work rather than editor/app-composition debt.
- app-local workspace mode and app menu policy are deleted or moved to their
  package owners, or remain as a smaller explicitly named follow-up in
  `app-composition-debt`.
- `projectPrismPackageTargets` no longer marks `wallpaper-app` blocked by
  app-runtime debt. It may remain blocked by the smaller explicit
  `app-composition-debt` follow-up files until those product policy facts are
  deleted or moved to clearer owners.
- Root validation passes:

```text
npm run test
npm run typecheck
npm run build
```

- Phase 7 browser evidence exists and validates:

```text
$env:PROJECT_PRISM_SMOKE_EVIDENCE="temp/project-prism-phase-7-smoke-data.json"; npm run test -w wallpaper-tesseract -- project-prism-smoke-evidence-file
```

## Stop Conditions

Stop and amend this plan if:

- A proposed move requires runtime packages to import editor, UI, app
  composition, or actor-input presentation details.
- Editor must instantiate runtime world/camera/render output resources to keep
  Scene View working.
- App thinning is only possible by introducing a new compatibility facade with
  the same old responsibilities.
- Tests require broad casts or fake ports that preserve the old staging shape.
- Boundary tests must be weakened to move files.
- The browser smoke failure exposes a real ownership ambiguity rather than a
  simple import or placement update.

Normal implementation risk is not a stop condition. If the owner is clear and
the next step deletes old logic, continue executing.
