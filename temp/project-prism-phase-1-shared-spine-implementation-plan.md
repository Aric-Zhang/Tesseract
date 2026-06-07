# Project Prism Phase 1: Shared Spine Decoupling Implementation Plan

## Status

Ready to execute after Phase 0 acceptance.

Phase 1 is not a package extraction phase. Its purpose is to remove the mixed
contracts that currently prevent later extraction of `actor-core`,
`actor-input`, `ui-framework`, and `runtime-core`.

## Goal

Turn the current app-local shared spine into explicit ports:

- update/frame scheduling ports;
- command and state domain ports;
- component runtime capability ports;
- actor/component contracts that no longer import scene-specific facts;
- boundary tests that block reintroducing legacy mixed contracts.

Phase 1 should finish with cleaner app-local code, not new published packages.

Phase 1 succeeds only when it deletes mixed facts. Renaming `SceneFrame` to
`UpdateFrame`, wrapping `SceneCommandSink` in a generic-looking type, or hiding
legacy component capabilities behind prettier adapters is not enough. Each
subphase must reduce a real blocker in the generated boundary report.

## Non-Goals

- Do not move files into `packages/actor-core`, `packages/ui-framework`, or
  `packages/runtime-core`.
- Do not change docking/menu/Scene behavior unless a Phase 1 contract change
  exposes a real regression.
- Do not add compatibility adapters that keep both old and new facts alive
  indefinitely.
- Do not hide blockers with broad allowlists. New debt must be named, tested,
  and given a deletion condition.

## Global Gates For Every Step

Run after each subphase:

```text
npm run test -w wallpaper-tesseract -- architecture-boundaries
npm run typecheck -w wallpaper-tesseract
```

Run after any step that touches UI/input/render host behavior:

```text
npm run test -w wallpaper-tesseract -- project-prism-smoke-contract gizmo-event-binding-component window-frame-tab-chrome floating-window-component workspace-root-dock-frame-component
```

Run before handoff:

```text
npm run prism:phase0:report
npm run test -w wallpaper-tesseract
npm run typecheck -w wallpaper-tesseract
npm run build -w wallpaper-tesseract
npm run test
npm run typecheck
npm run build
```

Browser smoke is required if a step changes pointer routing, frame surface,
Scene renderability, fullscreen, tab close, menu commands, or layout hydration.
Use the Phase 0B smoke data shape: viewport, point, DOM top stack, actor input
hit, action result, screenshot path, and console errors.

Hard final Phase 1 rules:

- `actor-runtime` must not import `scene-runtime` or `gizmo-core`.
- `window-runtime` and generic App Menu code must not use scene parameter paths
  as their UI state API.
- legacy capability adapters must be deleted; no dual-track compatibility path
  remains for `"gizmo"` or `"state-observer"`.
- generated Phase 0 boundary facts must show the relevant blocker counts
  shrinking. If a subphase changes code but blocker facts do not improve, that
  subphase is not accepted.

## Step 1.0: Baseline Regeneration

Objective:

Refresh generated Phase 0 reports and capture the exact dirty scope before
touching Phase 1 contracts.

Implementation:

- Run `npm run prism:phase0:report`.
- Confirm `temp/project-prism-phase-0-boundary-report.md` still reports
  dependency matrix violations as zero.
- Record changed files with `git status --short`.

Tests:

```text
npm run test -w wallpaper-tesseract -- project-prism-boundary-report architecture-boundaries
npm run typecheck -w wallpaper-tesseract
```

Acceptance:

- Generated boundary report remains reproducible.
- No new Phase 0B blocker appears.

Stop if:

- boundary report generation fails;
- dependency matrix gains a violation;
- a planned Phase 1 edit would require changing the Phase 0 package target
  model first.

## Step 1A: Scheduler And Frame Update Ports

Objective:

Separate generic frame/update scheduling from `scene-runtime`.

Current blocker:

`Component.updateFrame(frame: SceneFrame)`, `RuntimeObject`, `FrameUpdatable`,
and `SceneFrameClock` are all scene-named even when used by UI, workspace, or
component bridge code.

Target shape:

```text
runtime/ports/update-frame.ts
  UpdateFrame
  UpdateFrameClock
  FrameUpdatable
  RuntimeDisposable
  RuntimeRegistration
  RuntimeObject
```

or an equivalent app-local shared port path. The names must not include
`Scene` unless the fact is truly scene-specific.

`UpdateFrame` is the single source of truth. `scene-runtime` may import and
adapt the shared update-frame port, but the shared port must not be a thin
re-export from `scene-runtime`. After this step, `SceneFrame` is either deleted
or becomes a scene-local alias that depends on `UpdateFrame`, never the other
way around.

Implementation Steps:

1. Create the new update/frame port module as the owner of `UpdateFrame`,
   `UpdateFrameClock`, `FrameUpdatable`, `RuntimeObject`, and
   `RuntimeRegistration`.
2. Change `scene-runtime` to consume or re-export from the new port only as a
   compatibility surface for scene-specific callers.
3. Change component contracts to depend on `UpdateFrame`, not `SceneFrame`.
4. Change `RuntimeObject` and `FrameUpdatable` imports to the new port.
5. Remove any direct `scene-runtime` frame imports from actor-runtime and
   runtime-like consumers.
6. Add an architecture rule: actor/component core candidates must not import
   `scene-runtime/scene-frame` directly.

Expected file areas:

- `apps/wallpaper-tesseract/src/runtime/ports/`
- `apps/wallpaper-tesseract/src/scene-runtime/`
- `apps/wallpaper-tesseract/src/actor-runtime/component.ts`
- `apps/wallpaper-tesseract/src/actor-runtime/actor-system.ts`
- `apps/wallpaper-tesseract/src/actor-runtime/component-runtime-bridge.ts`
- components with `updateFrame(...)`
- real consumers such as workspace controller, Camera3 motion, and Tesseract4
  runtime object/component code

Tests:

- Unit test `UpdateFrameClock` behavior under the new name.
- Boundary test proving `actor-runtime/component.ts` does not import
  `SceneFrame` from `scene-runtime`.
- Boundary test proving `actor-runtime` does not import `scene-runtime` for
  update/frame facts.
- Existing frame update tests remain green:

```text
npm run test -w wallpaper-tesseract -- actor-system frame-state-controller scene-runtime window-workspace-controller camera3-motion-controller tesseract4 architecture-boundaries
npm run typecheck -w wallpaper-tesseract
```

Acceptance:

- Generic component/update contracts no longer mention scene-specific frame
  types.
- No UI/window feature imports `scene-runtime/scene-frame` for generic timing.
- `UpdateFrame` is not implemented by importing `SceneFrame` from
  `scene-runtime`.
- Generated boundary facts show the actor/frame blocker reduced or narrowed.

Stop if:

- changing the frame type forces product-specific render logic into a shared
  port;
- a component needs two different frame facts and the distinction is not yet
  modeled.

## Step 1B: Command And State Domain Ports

Objective:

Split command/state facts by domain so UI framework and actor core do not
depend on scene parameter paths.

Current blockers:

- `BusinessComponentContext.services.commandSink` is `SceneCommandSink`.
- UI window/menu/workspace code still uses scene-runtime `ParameterPath`,
  `SceneCommandSink`, and scene parameter paths.
- App Menu observes `sceneParameterPaths.workspace.mode` directly.

Step 1B must be executed as four small gates. Do not attempt to migrate all UI
state in one edit.

Target shape:

```text
runtime/ports/command.ts
  CommandSink<TCommand>

runtime/ports/state.ts
  StateObserver<TEvent>
  StateSubscription

ui-state/
  UiLayoutPath
  UiLayoutCommand
  UiLayoutCommandSink
  UiLayoutStateObserver

editor-state/
  WorkspaceModePath
  EditorCommandSink
```

Names can be adjusted, but the rule is strict: generic UI state must not be a
scene state path.

### Step 1B.1: UI Geometry And Value Types

Objective:

Stop generic UI/window code from depending on scene-runtime `Vec2` helpers.

Implementation:

1. Introduce UI-owned geometry/value types, for example `UiPoint`, `UiSize`,
   `UiVec2`, and validation/clone/equality helpers.
2. Migrate `floating-window-state.ts`, root/floating frame bounds, dock-region
   math, and layout persistence helpers to UI-owned geometry.
3. Keep adapter functions only at the app/editor bridge where scene state still
   stores old values.

Tests:

```text
npm run test -w wallpaper-tesseract -- floating-window-component workspace-root-dock-frame-component window-workspace-layout window-workspace-layout-persistence architecture-boundaries
npm run typecheck -w wallpaper-tesseract
```

Acceptance:

- `window-runtime` generic modules no longer import scene-runtime `Vec2` as
  their public geometry type.
- Browser smoke covers floating window drag and resize if geometry code changes
  DOM positioning.

### Step 1B.2: UI Layout Paths And Commands

Objective:

Replace generic UI use of `ParameterPath` and `SceneCommandSink` with UI-owned
layout path/command contracts.

Implementation:

1. Introduce `UiLayoutPath`, `UiLayoutCommand`, and `UiLayoutCommandSink` or an
   equivalent small port.
2. Migrate floating/root frame visible/bounds/presentation writes to the UI
   command port.
3. Keep the scene parameter store as an app/editor adapter only while the
   persistent backing store is still scene-runtime.
4. Add a boundary rule forbidding `SceneCommandSink` in generic
   `window-runtime` and App Menu code.

Tests:

```text
npm run test -w wallpaper-tesseract -- floating-window-component workspace-root-dock-frame-component window-workspace-layout-persistence-controller architecture-boundaries
npm run typecheck -w wallpaper-tesseract
```

Browser smoke:

- floating window drag changes position;
- floating window resize changes size;
- reload restores layout;
- root/floating tab close leaves state consistent.

### Step 1B.3: State Observer Adapter

Objective:

Move generic state observation behind domain-specific observer ports instead of
having UI components implement scene-runtime observer facts directly.

Implementation:

1. Introduce a UI/editor state observer port.
2. Migrate UI components that only need UI/editor state to that port.
3. Restrict `SceneStateObserver` usage to scene-runtime or named adapter debt.
4. Add tests proving state changes still update App Menu and window state.

Tests:

```text
npm run test -w wallpaper-tesseract -- app-menu-bar-component floating-window-component architecture-boundaries
npm run typecheck -w wallpaper-tesseract
```

### Step 1B.4: Workspace Mode View Model

Objective:

Stop App Menu from observing `sceneParameterPaths.workspace.mode` as a generic
menu fact.

Implementation:

1. Introduce a `WorkspaceModeViewModel` or equivalent editor/UI port.
2. Make App Menu consume the view model, not scene parameter paths.
3. Keep workspace mode controller as the owner of run/develop semantics.
4. Add boundary tests forbidding `sceneParameterPaths.workspace.mode` in
   `features/app-menu`.

Tests:

```text
npm run test -w wallpaper-tesseract -- app-menu-bar-component workspace-mode architecture-boundaries
npm run typecheck -w wallpaper-tesseract
```

Browser smoke:

- Window menu opens and focuses Scene/Hierarchy.
- Scene fullscreen/restore still works.
- run/develop mode still hides/restores expected frames.

Shared Step 1B setup:

1. Introduce narrow command/state port types without moving feature logic.
2. Change `BusinessComponentContext` from hard-coded `SceneCommandSink` to a
   small context service interface that can carry UI/editor/runtime command
   sinks explicitly.
3. Add boundary tests:
   - `ui-framework-candidate` files cannot import `sceneParameterPaths`.
   - generic window/tab/menu files cannot import `SceneCommandSink`.
   - app/editor-specific installers may bridge UI state to current scene state
     only in named debt zones.

Expected file areas:

- `apps/wallpaper-tesseract/src/actor-runtime/component.ts`
- `apps/wallpaper-tesseract/src/window-runtime/`
- `apps/wallpaper-tesseract/src/features/app-menu/`
- `apps/wallpaper-tesseract/src/features/window-workspace/`
- `apps/wallpaper-tesseract/src/scene-runtime/parameter-paths.ts`

Tests:

```text
npm run test -w wallpaper-tesseract -- app-menu-bar-component floating-window-component workspace-root-dock-frame-component architecture-boundaries
npm run typecheck -w wallpaper-tesseract
```

Acceptance:

- UI candidate code can express layout/menu/workspace commands without owning
  scene parameter paths.
- Any remaining scene-state bridge is named debt, not hidden in generic UI.
- `window-runtime` and generic App Menu code no longer use scene parameter paths
  as their UI state API.

Stop if:

- the command port becomes a new universal app context;
- generic UI needs editor/runtime product keys to compile.

## Step 1C: Component Contract Decapability

Objective:

Remove transitional capability names from the core component contract and make
binding responsibilities explicit.

Current blockers:

`ComponentCapability` still contains:

```text
frame
gizmo-controller-binding
state-observer-binding
gizmo
state-observer
```

The transitional `gizmo` and `state-observer` capabilities preserve old adapter
paths and keep actor-core impure.

Current evidence suggests production definitions already use the binding
capabilities. Therefore Step 1C should be deletion-first: do not add new
compatibility adapters, and do not preserve tests that exercise the legacy
capability path as expected behavior.

Implementation Steps:

1. Inventory all `capabilities: [...]` usages.
2. Assert production has no remaining `gizmo` or `state-observer` users. If a
   production user exists, migrate that component before proceeding.
3. Remove `gizmo` and `state-observer` from `ComponentCapability`.
4. Delete adapter code in `ComponentRuntimeBridge` that only served those
   transitional capabilities.
5. Replace legacy adapter tests with tests proving the old capability strings
   are rejected or absent.
6. Add architecture tests forbidding the deleted capability strings in
   production code.
7. Prepare for Step 1D by documenting that even
   `gizmo-controller-binding`/`state-observer-binding` are not acceptable
   long-term actor-core facts. They may remain only until binding runtimes own
   registration outside actor-runtime.

Expected file areas:

- `apps/wallpaper-tesseract/src/actor-runtime/component.ts`
- `apps/wallpaper-tesseract/src/actor-runtime/component-runtime-bridge.ts`
- `apps/wallpaper-tesseract/src/component-definitions.ts`
- all component definition files

Tests:

```text
npm run test -w wallpaper-tesseract -- component-runtime-bridge gizmo-event-binding-component architecture-boundaries
npm run typecheck -w wallpaper-tesseract
```

Acceptance:

- No production component definition uses `capabilities: ["gizmo"]`.
- No production component definition uses `capabilities: ["state-observer"]`.
- Bridge no longer adapts legacy gizmo/state observer components.
- Tests no longer describe legacy `"gizmo"` or `"state-observer"` capability
  behavior as supported.
- Existing click, double-click, menu, tab close, Camera3 gizmo tests remain
  green.

Stop if:

- a component still needs legacy capability behavior and cannot be expressed as
  a binding component; document that component as a blocker before continuing.

## Step 1D: ComponentRuntimeBridge Responsibility Split

Objective:

Split `ComponentRuntimeBridge` into narrow binding registries so actor/component
core can later extract without knowing gizmo, state observer, frame update, or
active input cancellation details.

This step must first invert the `ComponentRegistry -> ComponentRuntimeBridge`
dependency. `ComponentRegistry` should know only an attachment runtime port,
not the concrete bridge class.

Target shape:

```text
actor-runtime/component-attachment-runtime.ts
  ComponentAttachmentRuntime
  attach(actor, component, definition): RuntimeRegistration

ComponentBindingRuntime
  register(component, definition)

GizmoBindingRuntime
StateObserverBindingRuntime
FrameUpdateBindingRuntime
ActorInputCancellationRegistry
```

Names may differ, but responsibilities must be separate and testable.

Implementation Steps:

1. Introduce `ComponentAttachmentRuntime` as a narrow interface owned by
   actor-runtime.
2. Change `ComponentRegistryOptions.bridge` to a generic attachment runtime
   option. `ComponentRegistry` must not import the concrete
   `ComponentRuntimeBridge` class.
3. Extract active input cancellation registry from `ComponentRuntimeBridge`.
4. Extract gizmo binding registration into its own small runtime service.
5. Extract state observer binding registration into its own small runtime
   service.
6. If frame update registration exists in bridge or registry flow, extract it
   to update-frame runtime service.
7. Move domain capability strings out of actor-runtime. Actor-runtime should
   expose lifecycle/attachment contracts only; gizmo/state/update binding
   runtime owns any domain-specific registration metadata.
8. Compose the services in app composition or a package-like installer, not in
   actor core.
9. Add boundary tests:
   - actor core candidate files do not import `gizmo-core`;
   - actor core candidate files do not import scene-runtime observer types;
   - `actor-runtime` does not define gizmo/state observer domain capability
     strings;
   - bridge services are the only production code allowed to import external
     registries for gizmo/state observer binding.

Expected file areas:

- `apps/wallpaper-tesseract/src/actor-runtime/component-runtime-bridge.ts`
- `apps/wallpaper-tesseract/src/gizmo-runtime/`
- `apps/wallpaper-tesseract/src/runtime/ports/`
- `apps/wallpaper-tesseract/src/test-support/project-prism-boundary-facts.ts`

Tests:

```text
npm run test -w wallpaper-tesseract -- component-runtime-bridge gizmo-event-binding-component architecture-boundaries
npm run typecheck -w wallpaper-tesseract
```

Acceptance:

- `ComponentRuntimeBridge` is either deleted or reduced to composition of
  narrow binding runtimes.
- `ComponentRegistry` depends only on `ComponentAttachmentRuntime`, not on a
  concrete bridge class.
- `actor-runtime` no longer defines domain capability strings such as
  `gizmo-controller-binding` or `state-observer-binding`.
- Each binding runtime has its own tests.
- Actor-core candidate expands or its blocker list shrinks in the generated
  Phase 0 report.

Stop if:

- splitting the bridge requires app composition to know per-component internals;
- any binding runtime starts mutating business component state directly.
- removing domain capability strings requires a new component metadata model
  that has not been designed; stop and write that model before proceeding.

## Step 1E: Boundary Lock And Debt Report Refresh

Objective:

Turn Phase 1 cleanup into executable boundary rules and update Prism reports.

Implementation Steps:

1. Regenerate `temp/project-prism-phase-0-boundary-report.md`.
2. Update `project-prism-boundary-facts.ts`:
   - shrink debt zone file counts where cleanup succeeded;
   - move files into clean candidate zones only when imports prove it;
   - update blocker deletion conditions if a blocker is resolved.
3. Add or update boundary tests for:
   - no deleted capability strings;
   - no direct `SceneFrame` in actor/component core contracts;
   - no direct `SceneCommandSink` in generic UI candidate code;
   - no scene parameter paths as generic UI state API;
   - no `scene-runtime` or `gizmo-core` imports in `actor-runtime`;
   - no domain capability strings in `actor-runtime`;
   - no bridge service importing product feature modules.
4. Write `temp/project-prism-phase-1-acceptance-report.md`.

Tests:

```text
npm run prism:phase0:report
npm run test -w wallpaper-tesseract -- project-prism-boundary-report architecture-boundaries
npm run test -w wallpaper-tesseract
npm run typecheck -w wallpaper-tesseract
npm run build -w wallpaper-tesseract
```

Root handoff:

```text
npm run test
npm run typecheck
npm run build
```

Acceptance:

- Phase 1 report names which blockers were deleted and which remain.
- Later Phase 2 actor extraction can begin only if actor-core and actor-input
  blockers are resolved.
- Later Phase 3 UI extraction can begin only if UI state/scheduler blockers are
  resolved.
- If blocker counts did not decrease in generated boundary facts, Phase 1 is
  not accepted even if tests pass.

Stop if:

- generated reports and source facts diverge;
- any boundary rule requires a broad allowlist to pass;
- root smoke reveals an input/render regression.

## Phase 1 Browser Smoke Minimum

Run at least one browser smoke before Phase 1 handoff if any UI/input/render
path changed. Required scenarios:

- desktop root Scene tab hit;
- floating-over-root tab hit;
- Scene fullscreen and restore;
- App Menu open and Window > Scene focus;
- mobile tab close geometry and restore;
- Camera3 drag or double-click remains responsive when Scene is root-docked and
  when Scene is floating.

Use the existing actor input smoke capture hook. The hook is observation-only:
failures in the hook must not change hit selection, routing, action result, or
component state.

## Expected End State

After Phase 1:

- shared timing/update names are no longer scene-specific;
- generic UI no longer owns scene parameter paths as public API;
- transitional component capabilities are gone;
- bridge responsibilities are split into small binding runtimes;
- generated boundary facts show fewer blockers for Phase 2 and Phase 3;
- no package has been extracted prematurely.
