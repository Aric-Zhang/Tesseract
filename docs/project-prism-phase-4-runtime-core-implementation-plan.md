# Project Prism Phase 4 Runtime Core Implementation Plan

Status: draft, ready for review before execution.

Date: 2026-06-10

## Purpose

Phase 4 defines the renderer-agnostic runtime core contract for Project Prism.
It comes after:

- Phase 2 extracted `actor-core` and `actor-input`;
- Phase 3 extracted product-agnostic `ui-framework`;
- Phase 3 closure removed remaining product semantics from the UI framework
  public model.

Phase 4 must not be a cosmetic package move. Its job is to make runtime worlds,
cameras, projections, frame sources, commands, and scheduling expressible
without the editor, UI framework, DOM, Three.js, or app composition owning those
facts.

## Architecture Principles

- Runtime ownership must become explicit. Scene View may display runtime output,
  but must not own worlds, cameras, render resources, or projection graph state.
- Runtime contracts must be renderer-agnostic. `runtime-core` cannot import
  Three.js, DOM, `ui-framework`, editor features, `gizmo-core`, or wallpaper app
  composition.
- `runtime-core` may depend on `actor-core` and math/projection packages such as
  `four-*` where those dependencies are truly renderer-agnostic. It must not
  depend on `actor-input`; pointer and gizmo input are editor/UI concerns.
- Phase 4 contracts should prefer `RuntimeWorldDescriptor`,
  `RuntimeCameraDescriptor`, and graph descriptors over `RuntimeWorldActor` or
  `RuntimeCameraActor` naming. Do not bind the runtime graph to the actor tree
  before the ownership model proves that it needs actor-backed runtime nodes.
- Projection is a graph, not a singleton Scene. The model must support multiple
  4D worlds, multiple 3D worlds, multiple 4D cameras, multiple 3D cameras, and
  multiple 2D frame sources.
- 4D -> 3D projection and 3D -> 2D projection are analogous runtime operations.
  A Scene View is an editor consumer of a 2D frame source, not the owner of the
  world.
- Do not preserve transitional compatibility if it conflicts with the target
  model. If an old model cannot fit the runtime graph cleanly, expose the
  blocker and stop for plan revision.
- Do not add adapters that hide the real ownership problem. Adapters are allowed
  only when they express a clear boundary between runtime, runtime-three, editor,
  and app composition.
- Tests should harden architecture boundaries, not merely implementation shape.

## Current Blockers Phase 4 Must Address

From `project-prism-boundary-facts.ts`:

- `state-domain-debt`: `scene-runtime` still mixes runtime state, editor state,
  UI layout state, scheduler, and observer facts.
- `runtime-ownership-debt`: Tesseract, Camera3, Scene render host, and
  Three/WebGL ownership are still partly app/editor-feature owned.
- `camera3-three-model`: Camera3 model owns Three camera/vector objects instead
  of renderer-agnostic camera state plus backend realization.
- `camera3-motion-scene-scheduler`: Camera3 motion still uses app-local runtime
  update contracts.
- `scene-view-render-host`: Scene View binds runtime render output, editor
  lifecycle, DOM host, and current renderable projection.
- `tesseract4-runtime-object`: Tesseract4 update/projection/Three line adapter
  and actor component path are mixed.

Phase 4 does not have to delete every blocker by moving all production runtime
objects immediately. It must create the runtime contracts and proof fixtures
that make those blockers removable in Phase 5.

## Phase 4 Boundary Model

Before any `runtime-core` package work starts, Project Prism boundary facts must
separate contract readiness from production ownership. A single `runtime-core`
target is too coarse for this phase.

Required target split:

- `runtime-core-contracts`: the renderer-agnostic package contract target. This
  may become `allowed` during Phase 4 when the package, public API, and headless
  fixtures are clean.
- `runtime-production-ownership`: the production migration target. This remains
  `blocked` until Camera3, Tesseract4, Scene View render ownership, and
  scene-runtime state/scheduler debt are actually migrated or deleted.
- `runtime-three`: remains `blocked` in Phase 4. Three/WebGL realization belongs
  to Phase 5.

The boundary report must never imply that production runtime ownership is
complete merely because `runtime-core-contracts` is allowed.

## Non-Goals

- Do not extract `runtime-three` in Phase 4. Three/WebGL backend extraction is
  Phase 5.
- Do not move real production Tesseract/Camera3 ownership before the contracts
  can express it headlessly.
- Do not move editor windows, menu commands, hierarchy, debug, or inspector
  features into runtime.
- Do not let `runtime-core` know Scene View, Camera3 Gizmo, Wallpaper Engine,
  DOM canvas, root/floating frames, or UI layout paths.
- Do not persist runtime actor ids as world/camera/frame source identities.

## Global Verification Gates

Before Step 4A.1 creates `packages/runtime-core`, use the app-only baseline
gate:

```text
npm run test -w wallpaper-tesseract -- architecture-boundaries project-prism-boundary-report
npm run typecheck -w wallpaper-tesseract
```

After Step 4A.1 creates `packages/runtime-core`, run after every substantial
step unless the step explicitly says otherwise:

```text
npm run test -w runtime-core
npm run typecheck -w runtime-core
npm run build -w runtime-core
npm run test -w wallpaper-tesseract -- architecture-boundaries project-prism-boundary-report
npm run typecheck -w wallpaper-tesseract
```

Run at Phase 4 handoff:

```text
npm run test
npm run typecheck
npm run build
```

Run browser smoke only after steps that touch Scene View display, app render
loop, Camera3 behavior, or production rendering adapters.

## Stop Conditions

Stop and revise this plan if any of these become true:

- `runtime-core` needs to import `three`, DOM, `ui-framework`, editor feature
  code, `gizmo-core`, or wallpaper app composition to express core concepts.
- Projection graph cannot represent more than one world or more than one camera
  without global singleton state.
- Scene View must create or own runtime worlds/cameras to display anything.
- Camera3 Gizmo must directly mutate Three camera objects instead of runtime
  camera command/state.
- Tesseract4 cannot be represented as runtime-world content without exposing
  Three line geometry from runtime-core.
- Frame source identity has to use actor id or window tab id.
- App composition must gain new runtime feature logic instead of becoming
  thinner.

---

# Phase 4.0: Baseline And Runtime Ownership Audit

## Step 4.0.1: Freeze Current Runtime Boundary Baseline

Goal:

- Record the current runtime/editor ownership map before touching contracts.
- Identify every production file that imports or implements `RuntimeObject`,
  `UpdateFrame`, Three camera/scene facts, renderable Scene View facts, or
  Tesseract4 runtime ownership.

Boundary:

- No production behavior changes.
- No package creation yet.
- No source moves.

Effect:

- Establishes a reproducible baseline for Phase 4 work and prevents accidental
  “we moved files, therefore runtime is clean” conclusions.

Deliverables:

- `docs/project-prism-phase-4-runtime-baseline-report.md`
- Optional generated JSON:
  `docs/project-prism-phase-4-runtime-baseline-summary.json`

Tests:

```text
npm run test -w wallpaper-tesseract -- architecture-boundaries project-prism-boundary-report
npm run typecheck -w wallpaper-tesseract
```

Acceptance:

- Report lists each runtime ownership blocker from boundary facts.
- Report maps each blocker to current files and intended Phase 4/5 deletion
  condition.
- No source changes other than report files.

## Step 4.0.2: Add Runtime Boundary Tests For The Desired End State

Goal:

- Add failing-or-pending-safe architecture tests that express the Phase 4 target.
- Split the Project Prism target model into `runtime-core-contracts` and
  `runtime-production-ownership` before a package scaffold can be considered
  valid.
- Add `runtime-core-candidate` source-zone coverage for
  `packages/runtime-core/src/**`, not only app-local runtime candidates.

Boundary:

- Tests may initially describe current blockers, but must not silently allow
  future regressions.
- Do not use broad allowlists that hide the issue.

Effect:

- New code cannot make runtime package extraction harder while Phase 4 is in
  progress.

Rules to add:

- Boundary facts include:
  - `runtime-core-contracts` target;
  - `runtime-production-ownership` target;
  - `runtime-core-candidate` package source zone;
  - explicit package source scanning for `packages/runtime-core/src/**`.
- `runtime-core` package, once created, must not import:
  - `three`;
  - DOM types except type-only platform-neutral frame descriptors;
  - `ui-framework`;
  - editor features;
  - `gizmo-core`;
  - `actor-input`;
  - wallpaper app files.
- Runtime frame source identities must not contain `viewActorId`,
  `frameActorId`, `window`, or `tab` in their public types.
- Runtime graph contracts must expose world/camera/projection/frame-source
  relationships without singleton `currentScene`.
- Existing app-local runtime debt must remain explicit in boundary facts until
  deleted.

Tests:

```text
npm run test -w wallpaper-tesseract -- architecture-boundaries project-prism-boundary-report
```

Acceptance:

- Boundary tests pass against current code by checking newly created contracts
  only where applicable and keeping current debt explicit.
- No new compatibility aliases are introduced.
- `runtime-core-contracts` can later become allowed independently from
  `runtime-production-ownership`.
- `runtime-core` package source cannot escape the dependency matrix once it is
  created.

---

# Phase 4A: Create Renderer-Agnostic `runtime-core` Contracts

## Step 4A.1: Scaffold `packages/runtime-core`

Goal:

- Add a new package that owns renderer-agnostic runtime contracts.

Boundary:

- Package contains contracts, small pure model helpers, and tests only.
- No Three.js, DOM, editor, UI, gizmo, or wallpaper app imports.
- No `actor-input` imports.
- No production adapter code.
- Do not move production Camera3/Tesseract4 ownership yet.

Effect:

- Establishes the package boundary where runtime graph contracts will live.

Expected files:

```text
packages/runtime-core/package.json
packages/runtime-core/tsconfig.json
packages/runtime-core/src/index.ts
packages/runtime-core/src/runtime-id.ts
packages/runtime-core/src/runtime-frame.ts
packages/runtime-core/src/runtime-disposable.ts
```

Tests:

```text
npm run test -w runtime-core
npm run typecheck -w runtime-core
npm run build -w runtime-core
npm run test -w wallpaper-tesseract -- architecture-boundaries
```

Acceptance:

- Root `package.json` scripts include runtime-core in test/typecheck/build order.
- `runtime-core` test/typecheck/build passes.
- Boundary tests prove `runtime-core` has no forbidden imports.
- Boundary tests scan `packages/runtime-core/src/**` through
  `runtime-core-candidate` zone rules.
- Boundary report still marks `runtime-production-ownership` blocked.

## Step 4A.2: Define Stable Runtime Identities

Goal:

- Define logical ids for runtime worlds, cameras, projections, frame sources,
  and runtime graph nodes.

Boundary:

- These ids are not actor ids, window view ids, tab ids, DOM ids, or Three
  object ids.
- Ids must be opaque branded strings with constructors.

Effect:

- Runtime resources can be referenced across command/query/frame-source ports
  without leaking editor or actor ownership.

Expected contracts:

```text
RuntimeWorldId
RuntimeCameraId
RuntimeProjectionId
RuntimeFrameSourceId
RuntimeNodeId
runtimeWorldId(value)
runtimeCameraId(value)
runtimeProjectionId(value)
runtimeFrameSourceId(value)
```

Tests:

```text
npm run test -w runtime-core -- runtime-id
npm run typecheck -w runtime-core
```

Acceptance:

- Tests show ids are stable string values but not derived from actor/window ids.
- Persistence examples use logical runtime ids only.

## Step 4A.3: Define Runtime Frame And Scheduler Ports

Goal:

- Move the runtime update contract concept out of app-local `runtime/ports` into
  `runtime-core`.

Boundary:

- Do not immediately replace all app code.
- Do not import app-local `UpdateFrame`.
- Runtime scheduler contract must not know UI/editor services.
- Runtime scheduler must not be a generic replacement for current
  `SceneRuntime`. It may schedule only runtime world/projection/frame-source
  work that belongs to the runtime graph.
- Runtime scheduler must not accept arbitrary app services, UI services, state
  observers, menu/window services, or editor commands as runtime updatables.

Effect:

- Creates a clean target for later replacing app-local `RuntimeObject`,
  `RuntimeObjectRegistry`, and update attachment debt.

Expected contracts:

```text
RuntimeFrame
RuntimeFrameClock
RuntimeUpdatable
RuntimeScheduler
RuntimeRegistration
```

Scheduler contract constraints:

- `RuntimeUpdatable` must be documented as runtime-domain work only.
- If a future UI/editor object wants scheduling, it must use an editor/UI
  scheduler, not `RuntimeScheduler`.
- Scheduling priority, enabled state, and disposal are allowed only as runtime
  execution metadata, not as a universal object bus.

Tests:

```text
npm run test -w runtime-core -- runtime-frame
npm run typecheck -w runtime-core
```

Acceptance:

- `RuntimeFrameClock` supports monotonic frame data in headless tests.
- `RuntimeScheduler` can register/unregister updatables without app runtime.
- Dispose semantics are defined and tested, including multiple dispose calls.
- Tests reject or avoid examples that register UI/editor-like objects as runtime
  work.
- Public scheduler API has no names such as `SceneRuntime`, `RuntimeObjectBus`,
  `service`, `window`, `menu`, or `observer`.

## Step 4A.4: Define Runtime Command And Query Ports

Goal:

- Define generic runtime command/query contracts without editor state paths or
  scene parameter paths.

Boundary:

- Runtime commands are runtime facts only.
- Editor commands such as selection, menu, hierarchy, inspector focus, and
  workspace mode do not belong here.

Effect:

- Creates a place for camera/world/projection commands that editor/gizmo can
  use later without mutating runtime internals.

Expected contracts:

```text
RuntimeCommand
RuntimeCommandSink
RuntimeQuery
RuntimeQuerySource
RuntimeCommandResult
RuntimeCommandError
```

Tests:

```text
npm run test -w runtime-core -- runtime-command
npm run typecheck -w runtime-core
```

Acceptance:

- Tests show commands can target runtime ids.
- No command type references editor/window/menu/hierarchy concepts.
- Invalid target handling is explicit.

---

# Phase 4B: Projection Graph Core

## Step 4B.1: Define Runtime World Kinds And World Registry Model

Goal:

- Represent 4D, 3D, and 2D world nodes as runtime graph facts.

Boundary:

- No renderer/backend-specific world implementation.
- No Three scene objects.
- No editor Scene View.

Effect:

- Multiple worlds of the same dimension can coexist and be connected by
  projections.

Expected contracts:

```text
RuntimeWorldKind = "world-4d" | "world-3d" | "world-2d"
RuntimeWorldDescriptor
RuntimeWorldRegistry
RuntimeWorldGraph
```

Tests:

```text
npm run test -w runtime-core -- runtime-world
```

Acceptance:

- Can create two 4D worlds and two 3D worlds without global state.
- Registry rejects duplicate logical ids.
- Removing a world invalidates dependent projections in a defined way.

## Step 4B.2: Define Runtime Camera Model Contracts

Goal:

- Define renderer-agnostic camera state for projection relationships.

Boundary:

- Do not reuse Three camera objects in `runtime-core`.
- Do not move current `Camera3Rig` yet.
- Do not couple Camera3 Gizmo to runtime-core directly; editor adapter comes
  later.

Effect:

- Camera state can become the runtime target for future gizmo commands.

Expected contracts:

```text
RuntimeCameraKind = "camera-4d" | "camera-3d"
RuntimeCameraDescriptor
RuntimeCameraState
RuntimeCameraCommand
RuntimeCameraQuery
```

Tests:

```text
npm run test -w runtime-core -- runtime-camera
```

Acceptance:

- A camera belongs to one source world and targets a projection.
- Tests cover multiple cameras per world.
- Tests cover invalid world/camera combinations.

## Step 4B.3: Define Projection Edges

Goal:

- Model 4D -> 3D and 3D -> 2D projection as first-class graph edges.

Boundary:

- No renderer-specific projection implementation.
- No app singleton current Scene.
- No DOM/canvas output.

Effect:

- Runtime can describe:
  - 4D world projected by 4D camera into 3D world;
  - 3D world projected by 3D camera into 2D frame source;
  - multiple independent projection chains.

Expected contracts:

```text
RuntimeProjectionKind = "4d-to-3d" | "3d-to-2d"
RuntimeProjectionDescriptor
RuntimeProjectionGraph
RuntimeProjectionValidationError
```

Tests:

```text
npm run test -w runtime-core -- runtime-projection-graph
```

Acceptance:

- Headless tests build a chain:
  `world4d-A -> camera4d-A -> world3d-A -> camera3d-A -> frameSource-A`.
- Another independent chain can coexist.
- Invalid cycles and dimension mismatches fail explicitly.

## Step 4B.4: Define Runtime Frame Source Contracts

Goal:

- Define the data source that editor Scene View consumes after projection to
  2D.

Boundary:

- A frame source is not a DOM canvas.
- A frame source is not a `RenderableSceneView`.
- A frame source is not a window tab.
- Do not require pixel buffers yet if the current implementation cannot provide
  them.
- A frame source contract may expose a renderer-neutral snapshot, revision, and
  failure state. It must not expose a render hook that lets editor Scene View own
  the renderer through a prettier name.
- If a backend-specific render operation is needed, it must be represented as a
  backend-owned adapter contract outside `runtime-core`.

Effect:

- Scene View can eventually display runtime output without owning runtime
  resources.

Expected contracts:

```text
RuntimeFrameSource
RuntimeFrameSourceDescriptor
RuntimeFrameSourceRegistry
RuntimeFrameSourceSnapshot
RuntimeFrameSourceSubscription
RuntimeFrameSourceStatus
RuntimeFrameSourceError
```

Frame source contract constraints:

- Lifecycle owner is the runtime graph or backend adapter, not editor Scene
  View.
- Snapshots have explicit revision semantics and can be cached by consumers
  until revision changes.
- Subscriptions are disposable and must not prevent source removal.
- Multiple frame sources can update concurrently and independently.
- Render/update failure is represented as data (`RuntimeFrameSourceError` or
  status), not by throwing through editor render loops.
- Public contracts must not include DOM canvas, WebGL renderer, Three scene,
  `RenderableSceneView`, window frame, tab, or actor ids.

Tests:

```text
npm run test -w runtime-core -- runtime-frame-source
```

Acceptance:

- Registry supports multiple frame sources.
- Frame source identity is logical and stable.
- Subscriptions are disposable and do not leak.
- No actor/window/view ids appear in public frame source contracts.
- Snapshot caching by revision is covered.
- Concurrent frame sources are covered.
- Source removal while subscribed is covered.
- Failure state is covered without editor-owned renderer mutation.

---

# Phase 4C: Headless Runtime Fixture

## Step 4C.1: Build A Product-Free Runtime Graph Fixture

Goal:

- Prove the runtime graph contracts can be used without the wallpaper app,
  editor, UI framework, DOM, or Three.

Boundary:

- Fixture must live in `packages/runtime-core`.
- Fixture uses fake worlds/cameras/frame sources only.
- No production app imports.

Effect:

- Prevents runtime-core from becoming merely a type dump.

Tests:

```text
npm run test -w runtime-core -- runtime-graph-fixture
```

Acceptance:

- Fixture creates at least:
  - two 4D worlds;
  - two 3D worlds;
  - two 4D cameras;
  - two 3D cameras;
  - two frame sources.
- Fixture updates through a runtime scheduler.
- Fixture can query frame source snapshots after update.

## Step 4C.2: Add Command/Query Fixture For Cameras

Goal:

- Prove camera changes can happen through runtime command ports, not direct
  object mutation.

Boundary:

- Commands target runtime camera ids.
- No Camera3 Gizmo.
- No Three camera.

Effect:

- Establishes the long-term path for editor gizmos to command runtime cameras.

Tests:

```text
npm run test -w runtime-core -- runtime-camera-command-fixture
```

Acceptance:

- Command can orbit/snap/toggle a fake 3D camera state.
- Query returns updated camera state.
- Invalid camera id returns explicit error.
- Multiple cameras remain independent.

## Step 4C.3: Add Projection Graph Mutation Tests

Goal:

- Prove runtime graph can handle create/remove/reconnect operations safely.

Boundary:

- Do not hide invalid graph states with fallback singletons.
- Do not auto-create missing worlds or cameras.

Effect:

- Future editor can create/delete worlds/cameras through commands without
  corrupting the graph.

Tests:

```text
npm run test -w runtime-core -- runtime-projection-graph-mutation
```

Acceptance:

- Removing a camera invalidates dependent projection edges.
- Reconnecting projection edges validates dimensions.
- Removing a world cannot leave dangling frame source claims.

---

# Phase 4D: App-Local Adapter Prototype

Phase 4D is deliberately risky because adapters can become permanent
compatibility layers. Treat every adapter as a temporary proof of contract.

Every adapter step must document:

- legacy/app-local input facts;
- runtime-core output contracts;
- deletion condition;
- why it is not the production owner;
- which Phase 5 migration will remove it or reduce it to a thin backend/editor
  bridge.

Adapter stop condition:

- If an adapter needs to create worlds, cameras, renderer resources, or frame
  sources as the long-term owner, stop and revise the plan. That means the
  runtime ownership model is not ready.
- If an adapter starts hiding runtime graph invalid states with fallback
  singletons, stop and revise the plan.
- If an adapter must be imported by `runtime-core`, stop and revise the plan.

## Step 4D.1: Introduce App-Local Runtime Core Adapter Boundary

Goal:

- Create wallpaper app adapter files that convert existing app-local runtime
  concepts toward `runtime-core` contracts without moving production ownership.

Boundary:

- Adapter belongs in app/editor integration, not in `runtime-core`.
- Adapter may import app-local Scene/Tesseract/Camera facts.
- `runtime-core` must not import the adapter.

Effect:

- Creates a bridge for verifying real app needs against the new contracts.

Expected area:

```text
apps/wallpaper-tesseract/src/runtime-adapter/
```

Tests:

```text
npm run test -w wallpaper-tesseract -- architecture-boundaries project-prism-boundary-report
npm run typecheck -w wallpaper-tesseract
```

Acceptance:

- Boundary facts classify adapter as app/editor debt or integration, not
  runtime-core.
- Adapter dependencies flow from app -> runtime-core, never reverse.
- Adapter files include a short deletion-condition comment or nearby report
  entry. This comment must name the owning Phase 5 migration.
- Adapter public API is not exported by `runtime-core`.
- Adapter tests prove no production behavior changes.

## Step 4D.2: Map Current `UpdateFrame` To `RuntimeFrame`

Goal:

- Prove app-local update loop can feed runtime-core scheduler contracts.

Boundary:

- Do not delete app-local `runtime/ports` yet.
- Do not rewrite Scene runtime scheduler wholesale.
- No behavior change to render loop.

Effect:

- Clarifies the future deletion path for app-local `RuntimeObject` and
  `UpdateFrame`.

Tests:

```text
npm run test -w wallpaper-tesseract -- runtime-frame-adapter scene-runtime camera3-motion-controller tesseract4-runtime-object
npm run typecheck -w wallpaper-tesseract
```

Acceptance:

- Adapter converts current frame data into runtime-core frame data.
- Tests cover monotonic time, delta time, and first-frame behavior.
- No runtime-core imports from app-local `runtime/ports`.
- Adapter does not register runtime work itself; it only maps frame data.
- Deletion condition for app-local `UpdateFrame` is recorded.

## Step 4D.3: Prototype Camera3 Runtime Command Adapter

Goal:

- Map existing Camera3 motion command concepts to runtime-core camera commands.

Boundary:

- Do not move Camera3 model ownership yet.
- Do not alter Camera3 Gizmo behavior.
- Adapter is app/editor integration, not runtime-core.

Effect:

- Exposes what is still renderer/Three-specific in Camera3.
- Gives Phase 5 a concrete migration path.

Tests:

```text
npm run test -w wallpaper-tesseract -- camera3-motion-controller camera3-components runtime-camera-adapter
npm run typecheck -w wallpaper-tesseract
```

Acceptance:

- Existing Camera3 drag/double-click unit behavior remains unchanged.
- Adapter can produce runtime-core camera commands from existing Camera3 command
  inputs.
- Adapter does not import `ui-framework` or editor window code.
- Adapter does not create or own Camera3 state.
- Adapter records the remaining blocker: current Camera3 model still owns
  Three-backed rig state until Phase 5.

## Step 4D.4: Prototype Tesseract4 Runtime Content Adapter

Goal:

- Map existing Tesseract4 runtime object concepts to runtime-core world/content
  descriptors.

Boundary:

- Do not move Three line rendering into runtime-core.
- Do not move real Tesseract4 production ownership yet.
- Adapter may identify what belongs to Phase 5 runtime-three.

Effect:

- Separates 4D world/object update facts from renderer backend facts.

Tests:

```text
npm run test -w wallpaper-tesseract -- tesseract4-runtime-object tesseract4-actor-factory runtime-tesseract4-adapter
npm run typecheck -w wallpaper-tesseract
```

Acceptance:

- Adapter can describe a Tesseract4 object as runtime-world content without
  exposing Three line objects in runtime-core.
- Existing Tesseract4 update tests remain green.
- Any missing contract is recorded as a blocker, not patched around.
- Adapter does not create a renderer or Three line object as a runtime-core
  resource.
- Adapter records the split between runtime-world content and runtime-three
  renderable backend.

## Step 4D.5: Prototype Scene View Frame Source Adapter

Goal:

- Show how current editor Scene View can consume a runtime frame source without
  owning the runtime resource.

Boundary:

- Do not rewrite Scene View production rendering unless required by the
  contract.
- Do not create a new singleton current scene.
- Adapter may be read-only if production render loop is not moved yet.

Effect:

- Clarifies how Phase 5 will move real render ownership out of Scene View.

Tests:

```text
npm run test -w wallpaper-tesseract -- scene-view-content-installer renderable-scene-view runtime-frame-source-adapter
npm run typecheck -w wallpaper-tesseract
```

Browser smoke if production display path changes:

```text
npm run dev -w wallpaper-tesseract
```

Verify:

- Scene view displays Tesseract.
- Camera3 drag works.
- Camera3 double-click snap works.
- fullscreen/restore works.
- console errors are 0.

Acceptance:

- Scene View adapter consumes runtime frame source contracts.
- Scene View still does not dispose runtime resources.
- Runtime frame source contract does not mention DOM/window/tab.
- Adapter does not become a new `RenderableSceneView` owner.
- Adapter records whether production display path changed. If it changed,
  browser smoke is mandatory before continuing.

---

# Phase 4E: State Domain Split Prototype

## Step 4E.1: Classify Existing `scene-runtime` State Facts

Goal:

- Split current scene-runtime facts into runtime-state, editor-state, and
  ui-layout-state categories.

Boundary:

- Classification first; do not move code before the map is explicit.
- No behavior changes.

Effect:

- Prevents Phase 5 from blindly moving mixed state into runtime-core.

Deliverables:

- `docs/project-prism-phase-4-state-domain-map.md`

Tests:

```text
npm run test -w wallpaper-tesseract -- architecture-boundaries project-prism-boundary-report
```

Acceptance:

- Every `scene-runtime` export is classified.
- Each export has a target owner or a stop-condition note.

## Step 4E.2: Define Runtime-State Port Surface

Goal:

- Identify only the state facts that belong to runtime-core.

Boundary:

- Editor selection, hierarchy selection, workspace mode, UI layout bounds,
  menu state, and window state are not runtime-state.

Effect:

- Shrinks `state-domain-debt` toward explicit deletion conditions.

Tests:

```text
npm run test -w runtime-core -- runtime-state
npm run test -w wallpaper-tesseract -- architecture-boundaries project-prism-boundary-report
```

Acceptance:

- Runtime-state contracts do not import scene-runtime.
- Boundary report shows fewer or more precise `state-domain-debt` blockers.

## Step 4E.3: Define Editor-State Adapter Boundary

Goal:

- Mark which state facts should move to future editor package rather than
  runtime.

Boundary:

- Do not extract editor package in Phase 4.
- Do not move UI framework state back into editor.

Effect:

- Prevents runtime-core from absorbing editor-only state just because it lives
  in `scene-runtime` today.

Tests:

```text
npm run test -w wallpaper-tesseract -- architecture-boundaries project-prism-boundary-report
```

Acceptance:

- Boundary facts list editor-state debt separately from runtime-state debt.
- No new runtime-core import of editor state.

---

# Phase 4F: Boundary Report And Package Extraction Gate

## Step 4F.1: Update Project Prism Boundary Facts

Goal:

- Reflect the new runtime-core package and the remaining precise blockers.

Boundary:

- Do not mark `runtime-core` as fully allowed if production ownership has not
  moved.
- Mark `runtime-core-contracts` separately from `runtime-production-ownership`.
- It is acceptable to mark `runtime-core-contracts` as allowed while
  `runtime-production-ownership` remains blocked for Phase 5.

Effect:

- Makes the report honest: Phase 4 creates contracts and fixtures, not the full
  production runtime migration.

Tests:

```text
npm run test -w wallpaper-tesseract -- project-prism-boundary-report architecture-boundaries
```

Acceptance:

- Boundary summary distinguishes:
  - `runtime-core-contracts` readiness;
  - runtime-three extraction blockers;
  - `runtime-production-ownership` blockers.
- No stale Phase 3 blocker remains.
- `runtime-core` package source is scanned through the same source-zone and
  dependency matrix machinery as actor-core, actor-input, and ui-framework.
- Boundary facts do not claim production Camera3/Tesseract/Scene ownership has
  moved unless production code actually moved.

## Step 4F.2: Add Runtime-Core Public API Audit

Goal:

- Lock the runtime-core public barrel before Phase 5 depends on it.

Boundary:

- Public API must not export test fixtures or app adapters.
- Public API must not expose Three, DOM, editor, UI, or app-specific types.
- Public API must not expose `actor-input`.
- Public API must not export names that imply actor-backed runtime graph
  ownership unless the implementation actually owns runtime graph actors.

Effect:

- Prevents runtime-core from being polluted by convenience exports.

Tests:

```text
npm run test -w runtime-core
npm run test -w wallpaper-tesseract -- architecture-boundaries
```

Acceptance:

- Boundary test scans `packages/runtime-core/src/index.ts`.
- Public barrel exports only runtime ids, frame, scheduler, command/query,
  world, camera, projection, frame source contracts, and pure helpers.
- Public barrel does not export fixture, adapter, test-support, app-local,
  editor, Scene View, Camera3 Gizmo, Tesseract4 app adapter, DOM, Three, or
  actor-input symbols.

## Step 4F.3: Phase 4 Browser Smoke Baseline

Goal:

- Prove app behavior still works after runtime contract work.

Boundary:

- Browser smoke is required if any app adapter touched Scene View, Camera3, or
  Tesseract display paths.

Effect:

- Ensures contract work did not quietly break the editor experience.

Browser checks:

- Scene visible.
- Tesseract visible.
- Camera3 drag works.
- Camera3 double-click works.
- Scene fullscreen/restore works.
- Root/floating dock basics still work.
- Window menu opens/focuses Scene/Debug/Hierarchy/Inspector.
- Console errors are 0.

Deliverables:

- `docs/project-prism-phase-4-browser-smoke-report.md`
- Optional JSON/screenshots.

Tests:

```text
npm run test -w runtime-core
npm run test -w wallpaper-tesseract
npm run typecheck
npm run build
```

Acceptance:

- Smoke report records viewport, operations, console errors, and pass/fail.
- If browser automation cannot complete, manual verification gap is explicit.

## Step 4F.4: Phase 4 Acceptance Report

Goal:

- Record exactly what Phase 4 completed and what remains for Phase 5.

Boundary:

- Do not overclaim production runtime migration.

Effect:

- Gives Phase 5 a clear start line.

Deliverable:

- `docs/project-prism-phase-4-acceptance-report.md`

Acceptance:

- Report states:
  - runtime-core package/contracts status;
  - headless graph fixture status;
  - app adapter prototype status;
  - remaining production ownership blockers;
  - Phase 5 entry criteria.
- All Phase 4 verification gates pass.

---

# Suggested Commit Breakdown

1. Phase 4.0 baseline and boundary tests.
2. Runtime-core package scaffold and frame/id contracts.
3. Runtime world/camera/projection/frame-source contracts.
4. Headless runtime graph fixture.
5. App-local adapter prototypes.
6. State domain map and boundary report updates.
7. Browser smoke and Phase 4 acceptance report.

# Phase 5 Handoff Criteria

Phase 5 may begin only when:

- `runtime-core` can model multi-world/multi-camera projection graph headlessly.
- Editor/app can reference runtime-core contracts through adapters without
  runtime-core importing editor/app code.
- Boundary report clearly distinguishes remaining runtime-three and production
  ownership blockers.
- Current app behavior remains green through unit/type/build and required
  browser smoke.
