# Project Prism Phase 2: Actor Core Extraction Implementation Plan

Date: 2026-06-08

## Status

Ready to execute after Phase 1 acceptance.

Authoritative entry reports:

```text
temp/project-prism-phase-1-acceptance-report.md
temp/project-prism-phase-1-actor-core-readiness-report.md
```

Phase 2 must not begin by moving files into `packages/actor-core`. The first
work is contract removal: delete the remaining app-local update, focus, and
installer facts from the actor-core candidate. Package extraction happens only
after those facts are gone and boundary tests prove they cannot return.

## Goal

Make `actor-core` extractable as a reusable package, and prepare
`actor-input` extraction without freezing app-local UI/runtime concepts into
public APIs.

Long-term actor-core boundary:

```text
actor-core =
  Actor identity
  Actor tree / parent-child lifecycle
  enabled / effective active state
  component primitives
  component registry / dependency resolver
  generic attachment descriptor/runtime contract

actor-core !=
  frame update scheduling
  RuntimeObject
  window focus / stack priority
  state observer binding
  gizmo/input binding
  DOM / Three / scene-runtime / app-runtime
  app-owned component definition installer
```

## Non-Goals

- Do not extract `ui-framework`, `runtime-core`, `runtime-three`, or `editor`.
- Do not preserve compatibility adapters for old update/focus paths.
- Do not keep `BusinessComponentContext.services` as a general hidden app
  context.
- Do not move files before boundary tests prove the contracts are clean.
- Do not make `UpdateFrame` an actor-core primitive unless implementation
  proves no cleaner update runtime split is possible.

## Global Gates

Run after every implementation step:

```text
npm run test -w wallpaper-tesseract -- architecture-boundaries
npm run typecheck -w wallpaper-tesseract
```

Run after any step touching update scheduling:

```text
npm run test -w wallpaper-tesseract -- actor-system component-registry frame-state-controller window-workspace-controller camera3-motion-controller tesseract4 camera3-components
```

Run after any step touching focus/input:

```text
npm run test -w wallpaper-tesseract -- gizmo-event-binding-component window-workspace-controller window-frame-lifecycle-controller floating-window-component workspace-root-dock-frame-component project-prism-smoke-contract
```

Run before Phase 2 handoff:

```text
npm run prism:phase0:report
npm run test -w wallpaper-tesseract -- project-prism-boundary-report architecture-boundaries
npm run test -w wallpaper-tesseract
npm run typecheck -w wallpaper-tesseract
npm run build -w wallpaper-tesseract
npm run test
npm run typecheck
npm run build
```

Browser smoke is required if a step changes pointer routing, tab close,
fullscreen/restore, menu commands, Scene renderability, dock/drag behavior, or
layout hydration. Use the Phase 0B/1D structured shape: viewport, point, DOM
top stack, actor input hit, action result, screenshot path, and console errors.

## Current Blockers

Phase 1 left these blocker facts intentionally unresolved:

1. `actor-runtime/component.ts` imports `UpdateFrame` from `runtime/ports`.
2. `ActorSystem` imports and implements `RuntimeObject`.
3. `ComponentRegistry` injects `ActorWindowFocusService` through component
   context.
4. `BusinessComponentContext.services.actorWindowFocus` exposes window/input
   focus facts to any component.
5. `component-definitions.ts` is still the central definition installation
   surface.

## Step 2.0: Baseline Checkpoint

Objective:

Freeze the Phase 1 handoff state before touching contracts.

Implementation:

- Run `npm run prism:phase0:report`.
- Confirm generated boundary report status is `complete`.
- Confirm `actor-core` remains blocked by the expected three debt zones:
  `actor-core-debt`, `actor-binding-debt`,
  `component-definition-installer-debt`.
- Record dirty scope with `git status --short`.

Tests:

```text
npm run test -w wallpaper-tesseract -- project-prism-boundary-report architecture-boundaries
npm run typecheck -w wallpaper-tesseract
```

Acceptance:

- No dependency matrix violations.
- Phase 2 starts from the documented Phase 1 blocker list.

Stop if:

- generated boundary facts do not match Phase 1 reports;
- a package target is accidentally marked allowed before code changes.

## Step 2A: Actor Lifecycle / Update Ownership Split

Objective:

Remove frame update scheduling from actor-core primitives.

Architectural decision:

`Component.updateFrame` is not actor-core API. Frame update participation is a
runtime/update attachment outside actor-core. Actor-core should not import
`runtime/ports`, and `ActorSystem` should not implement `RuntimeObject`.

Target shape:

```text
actor-runtime:
  Component
  ComponentDefinition
  ComponentAttachmentDescriptor
  ComponentRegistry
  ActorSystem

runtime/update:
  frameUpdateAttachment
  FrameUpdateAttachmentRuntime
  FrameUpdateParticipant
  ActorSystemUpdateAdapter or ComponentUpdateRuntime
```

The exact folder can remain app-local during Phase 2, but it must be outside
the actor-core candidate and must not make actor-runtime depend on it.

Scope guard:

This new update runtime is an app-local component update adapter. It is not the
future `runtime-core` scheduler, does not unify UI/editor/runtime-world
scheduling, and does not mean scheduler domains have been fully split. Its only
job in Step 2A is to preserve the old actor/component update behavior while
removing update scheduling from actor-core.

Required update semantics to preserve:

- update participants run in actor tree order;
- inactive actors are skipped through `ActorSystemView.isActorActive()`;
- disabled components are skipped;
- detach/destroy during update does not corrupt the update path;
- components created during an update either do not run until the next frame or
  follow an explicitly tested rule;
- the runtime does not reach into `ActorImpl` internal component arrays as its
  fact source. It should use attachment registration plus actor-system/component
  registry views.

Implementation Steps:

1. Introduce an explicit frame/update attachment descriptor outside
   `actor-runtime`, for example `frameUpdateAttachment`.
2. Introduce a frame/update attachment runtime that registers attached
   components implementing an update participant contract.
3. Move `updateFrame(frame)` out of the core `Component` interface.
4. Add `frameUpdateAttachment` to component definitions that need scheduling.
5. Remove `ActorSystem implements RuntimeObject`.
6. Remove `ActorSystem.id`, `priority`, `enabled`, and `updateFrame(...)` if
   they only exist to satisfy app runtime scheduling.
7. Stop registering `ActorSystem` directly into the scene/app runtime.
8. Register the new update runtime or update adapter with app scheduling
   instead.
9. Move old `actor-system.updateFrame(...)` tests to the new update runtime
   tests, while keeping actor lifecycle tests in `actor-system`.
10. Add parity tests for tree order, disabled actor/component skipping,
    detach/destroy during update, and newly created component update timing.
11. Add a boundary test: `actor-runtime` must not import `runtime/ports`.

Expected touched areas:

```text
apps/wallpaper-tesseract/src/actor-runtime/component.ts
apps/wallpaper-tesseract/src/actor-runtime/actor-system.ts
apps/wallpaper-tesseract/src/actor-runtime/component-registry.ts
apps/wallpaper-tesseract/src/app-runtime/app-runtime-context.ts
apps/wallpaper-tesseract/src/runtime/ports/update-frame.ts
apps/wallpaper-tesseract/src/features/camera3/components/
apps/wallpaper-tesseract/src/tesseract4/
apps/wallpaper-tesseract/src/window-runtime/
apps/wallpaper-tesseract/src/features/app-menu/
apps/wallpaper-tesseract/src/state-runtime/
```

Tests:

```text
npm run test -w wallpaper-tesseract -- actor-system component-registry frame-state-controller window-workspace-controller camera3-motion-controller tesseract4 camera3-components state-observer-binding-component app-menu-bar-component architecture-boundaries
npm run typecheck -w wallpaper-tesseract
```

Acceptance:

- `actor-runtime` has zero imports from `runtime/ports`.
- `Component` no longer has `updateFrame?`.
- `ActorSystem` no longer implements app-local `RuntimeObject`.
- All previously scheduled component behavior still runs through the new update
  attachment/runtime.
- New update runtime preserves previous `ActorSystem.updateFrame`
  tree-order/effective-active/disabled-component/detach-during-update semantics
  through unit tests.
- New update runtime is explicitly documented and tested as an app-local
  component update adapter, not as the runtime-core scheduler.
- Active/effective actor state semantics are unchanged.

Stop if:

- update scheduling cannot be split without changing runtime scheduler
  semantics;
- `Component` needs two incompatible update shapes and the plan must model
  multiple update domains first.

## Step 2B: Actor Window Focus Service Ownership Split

Objective:

Remove window/input focus facts from actor-runtime component context.

Architectural decision:

`ActorWindowFocusService` is not actor-core. It is actor input/UI coordination.
The old service mixes two facts that must be split:

- input routing stack priority query;
- UI/window focus command.

Both ports must live outside actor-runtime. The input stack priority source can
belong to actor-input/gizmo-runtime. The focus command port belongs to
ui-framework/window-runtime or another UI-owned focus intent owner.

Target shape:

```text
actor-input / gizmo-runtime:
  ActorInputStackPrioritySource

ui-framework / window-runtime:
  WindowFocusCommandPort
  WindowFocusReason

window-runtime:
  WindowWorkspaceController implements both ports

actor-runtime:
  BusinessComponentContext has no actorWindowFocus service
```

Implementation Steps:

1. Create a non-actor-core input priority query port outside `actor-runtime`.
   Suggested name: `ActorInputStackPrioritySource`.
2. Create a UI-owned focus command port outside `actor-runtime`.
   Suggested name: `WindowFocusCommandPort`.
3. Move `ActorWindowFocusReason` / `ActorWindowFocusService` out of
   `actor-runtime/component.ts`.
4. Remove `actorWindowFocus` from `BusinessComponentContext.services`.
5. Remove `ComponentRegistryOptions.actorWindowFocus`.
6. Inject the priority source and focus command port explicitly into the
   components or runtimes that need them:
   - `GizmoEventBindingComponent`;
   - `WindowFrameLifecycleController`;
   - workspace/menu restore flows.
7. Update feature installers so focus service is passed through explicit
   options, not hidden component context.
8. Add boundary tests blocking `actor-runtime` from defining or importing
   window focus/stack service facts.
9. Flip any old positive boundary assertions that describe actor-runtime focus
   service as a narrow port into negative assertions: actor-runtime must not
   define or export it.

Tests:

```text
npm run test -w wallpaper-tesseract -- component-registry gizmo-event-binding-component window-workspace-controller window-frame-lifecycle-controller floating-window-component workspace-root-dock-frame-component features/window-workspace architecture-boundaries
npm run typecheck -w wallpaper-tesseract
```

Browser smoke:

Required if implementation changes any input/focus route:

- click floating window content brings that frame to front;
- App Menu focusing an existing window raises it;
- Camera3 drag/double-click still hit the gizmo;
- tab close still hits the tab action;
- root/floating overlap still routes to the visually top frame.
- inactive tab and hidden split-pane content cannot receive input;
- active drag followed by close/hide view cancels active input.

Acceptance:

- `BusinessComponentContext.services` no longer exposes `actorWindowFocus`.
- `ComponentRegistry` does not accept actor-window focus options.
- actor-runtime has no window focus or stack-priority facts.
- input stack priority and window focus commands are separate ports.
- actor-input does not import window-runtime or UI focus semantics.
- Existing focus-to-front behavior remains unchanged.

Stop if:

- input stack priority cannot be expressed without importing window-runtime
  into actor-input;
- window focus commands cannot be kept outside actor-input;
- moving focus service reveals a missing generic actor input stack model.

## Step 2C: Component Definition Installer Ownership Split

Objective:

Delete the central app-owned component definition installation fact that blocks
actor-core and ui-framework extraction.

Current problem:

`component-definitions.ts` owns `installCoreComponentDefinitions`, but that
function installs gizmo and state bindings. That is not actor core.

The problem is not the idempotent `installComponentDefinition` helper itself.
The problem is the pseudo-core bundle. Do not replace it with another broad
`installCommonDefinitions` bundle under a new name.

Target shape:

```text
actor-runtime:
  optional generic register/install helper only

gizmo-runtime:
  installGizmoRuntimeComponentDefinitions

state-runtime:
  installStateRuntimeComponentDefinitions

window-runtime:
  installWindowComponentDefinitions

features/*:
  own their feature definitions

app composition:
  imports package/feature installers, not individual definitions
```

Implementation Steps:

1. Rename or delete `installCoreComponentDefinitions`.
2. Move gizmo binding installation into `gizmo-runtime`.
3. Move state observer binding installation into `state-runtime`.
4. Keep any idempotent generic definition helper either in actor-runtime or in
   an app-local installer utility, but do not let actor-core own gizmo/state
   definition lists.
5. Update tests that currently call `installCoreComponentDefinitions` to call
   the explicit package/feature installers they actually need.
6. Add installer tests that preserve current helper behavior:
   - idempotent same-definition registration;
   - duplicate/conflicting definition rejection;
   - attachment descriptor comparison does not silently merge incompatible
     definitions.
7. Add boundary tests:
   - no `installCoreComponentDefinitions` symbol in production;
   - no replacement broad `installCommonDefinitions` or pseudo-core bundle;
   - central installer cannot import gizmo/state/window feature definitions
     as a pseudo-core bundle.
8. Update generated Project Prism facts so
   `component-definition-installer-debt` either shrinks or is renamed to the
   precise remaining installer blocker.

Tests:

```text
npm run test -w wallpaper-tesseract -- component-registry gizmo-event-binding-component state-observer-binding-component floating-window-component app-menu-bar-actor-factory scene-view-content-installer architecture-boundaries
npm run typecheck -w wallpaper-tesseract
```

Acceptance:

- The app no longer has a misleading "core" installer that installs domain
  bindings.
- Package/feature installers own their definitions.
- Actor-core extraction is no longer blocked by a central installer that knows
  gizmo/state/window definitions.

Stop if:

- feature installers require shared app policy to create definitions;
- definition installation order depends on app composition in a way that must
  be modeled as a package installer contract first.
- replacing `installCoreComponentDefinitions` creates another broad common
  installer that hides concrete package dependencies.

## Step 2D: Actor-Core Boundary Reclassification

Objective:

Update the generated boundary model after 2A-2C.

Implementation Steps:

1. Expand `actor-core-candidate` only to files that are now genuinely clean.
2. Remove files from `actor-core-debt` only when they no longer depend on:
   - `runtime/ports`;
   - window focus/stack service;
   - state/gizmo/UI/app facts;
   - central definition installers.
3. Update `actor-binding-debt` so it names only real remaining actor-input or
   state binding blockers.
4. Run `npm run prism:phase0:report`.
5. Inspect generated `temp/project-prism-phase-0-boundary-report.md` and
   `temp/project-prism-phase-0b-boundary-summary.json`.

Tests:

```text
npm run prism:phase0:report
npm run test -w wallpaper-tesseract -- project-prism-boundary-report architecture-boundaries
npm run typecheck -w wallpaper-tesseract
```

Acceptance:

- Boundary facts reflect code, not aspiration.
- Package blockers reflect actual imports/dependencies, not unresolved debt in
  unrelated zones.
- `actor-core` package target is either:
  - marked `allowed`; or
  - still `blocked` by a narrower blocker report.
- No broad allowlist is added to make the report green.

Stop if:

- dependency matrix violations appear;
- actor-core still needs app/runtime/update facts after 2A-2C.

## Step 2E: Actor-Core Package Extraction

Objective:

Move clean actor-core files into a workspace package only after 2D says
actor-core extraction is allowed.

Precondition:

Do not start this step unless `projectPrismPackageTargets.actor-core` is
`allowed`, or unless a written amendment explains the single remaining blocker
and why extraction is still safe.

Implementation Steps:

1. Create `packages/actor-core`.
2. Add package engineering files:
   - `package.json`;
   - `tsconfig.json`;
   - workspace script entries;
   - public `exports`;
   - package test/typecheck/build scripts.
3. Add root workspace wiring so root `test`, `typecheck`, and `build` include
   `actor-core` in the correct order.
4. Move clean actor-core files from app-local `actor-runtime` into the package.
5. Keep app-local compatibility barrels only if they are short-lived import
   forwarding surfaces; do not keep duplicated implementations.
6. Document the forwarding barrel lifecycle: what imports it preserves, when it
   should be deleted, and which tests prove there is no dual implementation.
7. Update imports in app code to consume the package or the intentional app
   barrel.
8. Add package-level tests for:
   - actor create/destroy;
   - parent/child lifecycle;
   - effective active;
   - component registry dependency resolution;
   - component attachment registration cleanup;
   - transaction rollback.
9. Add package boundary tests:
   - no DOM;
   - no Three;
   - no scene-runtime;
   - no gizmo-core;
   - no runtime/ports;
   - no window-runtime;
   - no app-runtime.

Tests:

```text
npm run test -w actor-core
npm run typecheck -w actor-core
npm run test -w wallpaper-tesseract -- actor-system component-registry architecture-boundaries
npm run test
npm run typecheck
```

Acceptance:

- `actor-core` package builds and tests independently.
- root `test`, `typecheck`, and `build` include `actor-core`.
- Wallpaper app behavior is unchanged.
- app-local actor-runtime implementation files are either removed or reduced to
  explicit forwarding barrels.
- no app-local dual implementation remains.

Stop if:

- import movement requires product-specific policy in actor-core;
- actor-core package tests need UI/runtime fixtures.

## Step 2F: Actor-Input Extraction Readiness

Objective:

Prepare actor-input extraction after actor-core exists.

This step may extract `actor-input` only if the stack-priority source, UI-owned
focus command, and active input cancellation contracts are clean after Step 2B.

Target shape:

```text
actor-input:
  actor input participant
  actor input router
  active interaction path/cancellation
  stack priority / local route score rules
  gizmo-core adapter
  actor input stack priority source

ui-framework/window-runtime:
  implements/supplies stack priority facts
  owns window focus command facts

actor-core:
  does not import actor-input
```

Implementation Steps:

1. Reclassify `gizmo-runtime` files into:
   - actor-input package candidates;
   - app/editor-specific leftovers.
2. Confirm active input cancellation is explicit attachment-based.
3. Confirm actor-input stack-priority source does not import `window-runtime`.
4. Confirm window focus command facts stay outside actor-input.
5. Confirm `ui-framework` may depend on actor-input, never the reverse.
6. If clean, create `packages/actor-input`; otherwise write a blocker report.
7. Add package tests for router target routing, active path cancellation,
   click/double-click, stack priority, and legacy-free behavior.

Tests:

```text
npm run test -w gizmo-core
npm run test -w actor-input
npm run test -w wallpaper-tesseract -- gizmo-event-binding-component active-input-cancellation-runtime project-prism-smoke-contract architecture-boundaries
npm run typecheck
```

Browser smoke:

Required before accepting extraction:

- Camera3 drag;
- Camera3 double-click;
- tab close;
- menu click;
- active drag then close/hide view cancellation;
- inactive tab / hidden split-pane input rejection;
- root/floating overlap hit consistency.

Acceptance:

- actor-input package depends on actor-core and gizmo-core only.
- actor-core does not import actor-input.
- UI/window code remains the supplier of window presentation facts.

Stop if:

- actor-input cannot express stack priority without window-runtime imports;
- router or cancellation still depends on app-local component context.

## Step 2G: Phase 2 Acceptance Report

Objective:

Close Phase 2 with generated facts, verification, and a precise Phase 3 entry
point.

Implementation Steps:

1. Regenerate Project Prism boundary reports.
2. Write:

```text
temp/project-prism-phase-2-acceptance-report.md
```

3. Record whether:
   - actor-core was extracted;
   - actor-input was extracted;
   - either target remains blocked and why.
4. Update the Project Prism outline/current phase assessment.

Final validation:

```text
npm run prism:phase0:report
npm run test -w wallpaper-tesseract -- project-prism-boundary-report architecture-boundaries
npm run test
npm run typecheck
npm run build
```

Acceptance:

- Phase 2 report matches generated facts.
- No target package is marked allowed unless it is actually extractable.
- No app-local legacy adapter or dual-track fact remains for update/focus.
- Phase 3 can start from a clear UI framework extraction blocker list.

## Required Browser Smoke Matrix

Run once after Step 2B or Step 2F if pointer/focus/input changes occurred:

Desktop viewport:

- App loads with root Scene.
- Floating Debug and Hierarchy can be opened/focused from menu.
- Floating window drag/resize works.
- Tab close closes only the target view.
- Scene fullscreen hides unrelated frames and restores correctly.
- Camera3 drag and double-click work.
- Tesseract still animates or otherwise proves update liveness.
- Camera3 motion still responds after the update split.
- update-driven UI such as layout persistence or workspace controllers has not
  silently stopped.
- Root/floating overlap routes to visual top frame.

Mobile-sized viewport:

- App Menu is reachable.
- Root tab close stays inside tab rect.
- Scene fullscreen/restore controls remain reachable.
- No text/control overlap blocks input.

Record artifacts under `temp/` with:

- JSON data;
- screenshots;
- console error list;
- actor input hit capture for each pointer action.

## Phase 2 Stop Rules

Stop and request plan amendment if any of these occur:

- update participation cannot be modeled as an external attachment/runtime;
- focus-to-front needs a service that would make actor-input depend on
  ui-framework/window-runtime;
- component installers require app-owned central policy;
- actor-core package tests need DOM, Three, scene-runtime, gizmo-core, or
  app-runtime;
- generated boundary facts disagree with observed code after a step.
