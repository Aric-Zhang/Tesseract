# Project Prism Phase 0B Extraction Blockers Implementation Plan

Date: 2026-06-07

## Purpose

This document analyzes the concrete blockers that prevent formal extraction of
`actor-core`, `ui-framework`, and `runtime-core` packages, then turns those
blockers into an execution plan.

This is stricter than the Phase 0B matrix checklist. The matrix proves that the
current boundary facts are known and executable. This document explains what
must be split, deleted, or converted to ports before extraction is actually
safe.

## Current Verdict

Phase 0B is still partially complete.

Implementation checkpoint from this pass:

- `project-prism-boundary-facts.ts` now owns the executable zone map,
  dependency rules, debt blockers, runtime extraction blockers, UI framework
  blockers, and app composition blockers.
- `architecture-boundaries.ts` now supports dependency matrix evaluation and
  dynamic import reporting.
- `architecture-boundaries.test.ts` consumes the shared facts and locks the
  first extraction blocker set.
- `project-prism-smoke-contract.ts` defines the reusable structured browser
  smoke evidence shape and validator.
- The boundary report has been updated to reflect these implemented facts.

Still incomplete:

- The boundary report is not generated from the fact module yet.
- Current browser smoke artifacts have not been regenerated with the new
  structured `actorInputHit` contract.
- Formal package extraction remains blocked by the debt zones listed below.

Allowed:

- Continue app-local architecture preparation that reduces documented debt.
- Add boundary tests and reports.
- Refactor app-local code toward the target package seams.

Not allowed yet:

- Create formal `actor-core`, `ui-framework`, or `runtime-core` packages and
  move production ownership into them.
- Mark Phase 0 fully complete.
- Treat current debt zones as acceptable package APIs.

## Blocking Area 1: Boundary Facts Are Not Yet A Single Source

### Concrete Blocker

The zone map lives in `architecture-boundaries.test.ts`, while
`project-prism-phase-0-boundary-report.md` is manually maintained.

Files:

```text
apps/wallpaper-tesseract/src/architecture-boundaries.test.ts
apps/wallpaper-tesseract/src/test-support/architecture-boundaries.ts
temp/project-prism-phase-0-boundary-report.md
```

### Why It Blocks Extraction

If package extraction starts while test facts and report facts can drift, a
future agent can move files based on a stale report while tests enforce a
different dependency graph. That creates a false sense of architectural safety.

### Required Fix

Move Project Prism zone definitions and blocker metadata into one reusable
test-support fact module, then generate both boundary tests and report data from
that module.

Current implementation state:

- Zone definitions and blocker metadata have moved to
  `apps/wallpaper-tesseract/src/test-support/project-prism-boundary-facts.ts`.
- Boundary tests import those facts.
- Report generation from those facts remains to be implemented.

### Acceptance Tests

- A production file missing from the zone map fails `architecture-boundaries`.
- A debt zone present in the zone map but missing from report facts fails.
- The generated summary lists all candidate zones, debt zones, blockers, and
  deletion conditions.

## Blocking Area 2: Dependency Matrix Is Still First-Batch Only

### Concrete Blocker

Current matrix checks only selected forbidden directions:

- actor-core candidate purity;
- candidate dependencies not pointing at some higher zones;
- UI candidate not importing concrete Scene/Camera/Tesseract facts;
- existing `packages/four-*` independence.

It does not yet fully encode the intended package graph:

```text
actor-core <- actor-input <- ui-framework <- editor <- wallpaper-app
actor-core <- runtime-core <- runtime-three <- editor <- wallpaper-app
```

### Why It Blocks Extraction

Without the full matrix, moving files into packages can accidentally preserve or
hide reverse dependencies through barrels, debt files, or partial candidate
zones.

### Required Fix

Add one dependency matrix rule helper that checks parsed `import` and
`export-from` edges by zone.

Current implementation state:

- `evaluateZoneDependencyMatrix()` is implemented in
  `apps/wallpaper-tesseract/src/test-support/architecture-boundaries.ts`.
- First expanded matrix rules live in `project-prism-boundary-facts.ts`.
- Full generated matrix report remains pending.

### Acceptance Tests

- Barrel exports cannot bypass the matrix.
- Candidate zones cannot import future higher-level candidates.
- Debt zones are explicit and cannot silently expand.
- Dynamic imports are reported as debt/unknown instead of ignored.

## Blocking Area 3: `actor-core` Is Blocked By Component Binding Debt

### Concrete Blocker

`actor-runtime/component.ts` is still not actor-core-pure:

```text
Component.updateFrame(frame: SceneFrame)
BusinessComponentContext.services.commandSink: SceneCommandSink
GizmoCapableComponent = Component & GizmoController
StateObserverCapableComponent = Component & SceneStateObserver
ComponentCapability includes binding/legacy concepts
```

`ComponentRuntimeBridge` also owns several domains at once:

```text
gizmo registration
state observer registration
legacy gizmo adapter
legacy state observer adapter
active actor input cancellation
```

Files:

```text
apps/wallpaper-tesseract/src/actor-runtime/component.ts
apps/wallpaper-tesseract/src/actor-runtime/component-runtime-bridge.ts
apps/wallpaper-tesseract/src/actor-runtime/actor-system.ts
apps/wallpaper-tesseract/src/actor-runtime/component-registry.ts
apps/wallpaper-tesseract/src/actor-runtime/component-transaction.ts
apps/wallpaper-tesseract/src/actor-runtime/registered-actor.ts
```

### Why It Blocks Extraction

If `actor-runtime` is extracted now, `actor-core` would drag in
`scene-runtime`, `gizmo-core`, state observer concepts, editor command sinks, and
binding lifecycle rules. That would make the new package a renamed app runtime,
not a reusable actor package.

### Required Fix

Phase 0B does not need to complete the full actor split, but it must lock the
blocker precisely:

- Mark only `actor-runtime/actor.ts` as current `actor-core-candidate`.
- Keep component, registry, transaction, and bridge files in debt zones until
  Phase 1.
- Add a Phase 1 deletion path:
  - actor core owns only actor identity, tree, enabled state, lifecycle, and
    component attachment primitives;
  - frame updates move to a scheduler/update port;
  - command sink moves to state/editor ports;
  - gizmo and state observer capabilities move to binding packages;
  - legacy capability names are deleted, not wrapped.

Current implementation state:

- `actor-core-candidate`, `actor-core-debt`, and `actor-binding-debt` are now
  distinct executable facts.
- Debt blockers and deletion conditions are locked in
  `project-prism-boundary-facts.ts`.

### Acceptance Tests

- `actor-core-candidate` cannot import `scene-runtime`, `gizmo-core`,
  `window-runtime`, app features, DOM, or Three.
- `actor-binding-debt` cannot be imported by new UI/runtime/editor candidate
  files except through explicitly listed bridge seams.
- Boundary report lists `actor-binding-debt` as extraction-blocking.

## Blocking Area 4: `ui-framework` Is Blocked By Scene Runtime State Coupling

### Concrete Blocker

Generic UI candidates still depend on `scene-runtime` facts:

```text
window-runtime imports ParameterPath, Vec2, RuntimeObject, frame/update types
features/window-workspace/install-window-workspace-feature.ts wires SceneParameterStore and RuntimeObject registration
features/app-menu/app-menu-bar-component.ts observes workspace mode through scene state
```

Files:

```text
apps/wallpaper-tesseract/src/window-runtime/
apps/wallpaper-tesseract/src/features/window-workspace/install-window-workspace-feature.ts
apps/wallpaper-tesseract/src/features/app-menu/app-menu-bar-component.ts
apps/wallpaper-tesseract/src/scene-runtime/
```

### Why It Blocks Extraction

An extracted `ui-framework` package cannot depend on a tesseract-specific
`scene-runtime`. Window bounds, dock layout, menu state, workspace mode, and
runtime render clocks are different domains. Keeping them together would make
the UI package app-specific.

### Required Fix

Introduce explicit future seams before extraction:

- `ui-layout-state`: generic state path/value/update contracts for window
  layout and workspace presentation.
- `ui-scheduler-port`: generic runtime service registration/update interface,
  not `SceneRuntime`.
- `ui-vector` or plain UI geometry types owned by UI framework, not
  `scene-runtime/vec2`.
- app/editor adapters that translate scene/editor state into UI ports.

Phase 0B should not necessarily implement all ports, but it must classify every
remaining import as `ui-state-binding-debt` with deletion conditions.

Current implementation state:

- UI framework extraction blockers are explicit facts.
- Generic UI state/scheduler/geometry ports remain future work.

### Acceptance Tests

- Any UI candidate importing `scene-runtime` must also be classified as
  `ui-state-binding-debt`.
- UI candidate files cannot import concrete Scene/Camera/Tesseract/Debug/
  Hierarchy/Inspector facts.
- `window-runtime` cannot import feature implementations.
- `features/app-menu` stays an adapter over window catalog facts; window runtime
  cannot import app-menu.

## Blocking Area 5: `runtime-core` Is Blocked By Runtime Ownership Debt

### Concrete Blocker

Runtime-like objects are still owned by editor/app feature folders:

```text
tesseract4 runtime object ownership still lives under app feature code
Camera3 model/control is partly colocated with editor-facing feature code
Scene View consumes and hosts render output but runtime/display ownership still needs sharper ports
Three/WebGL renderer ownership is app-local and not represented as runtime-three backend
```

Files:

```text
apps/wallpaper-tesseract/src/tesseract4/
apps/wallpaper-tesseract/src/camera3-control/
apps/wallpaper-tesseract/src/features/camera3/
apps/wallpaper-tesseract/src/features/scene/
packages/four-rotation/
packages/four-camera/
packages/four-camera-three/
```

### Why It Blocks Extraction

`runtime-core` should represent worlds, cameras, projections, runtime commands,
queries, and frame sources. It should not know editor windows, gizmos, menu,
dock layout, DOM, or render host chrome.

The existing math packages are clean enough, but app-local runtime ownership has
not been classified deeply enough.

### Required Fix

Phase 0B must expand runtime candidate gates beyond `packages/*`:

- classify runtime-like app files as candidate or debt;
- define future ports:
  - `RuntimeWorldActor`;
  - `RuntimeCameraActor`;
  - `ProjectionLink`;
  - `FrameSource`;
  - `RuntimeCommandSink`;
  - `RuntimeQueryPort`;
  - `RuntimeThreeRendererBackend`;
- identify which current files block each port.

Current implementation state:

- App-local Camera3, Scene render host, and Tesseract ownership debt is recorded
  in runtime extraction blocker facts.
- These files remain debt, not clean runtime package candidates.

### Acceptance Tests

- `packages/four-*` remain independent from app/editor/UI/gizmo.
- runtime-core candidates cannot import DOM, `window-runtime`, app menu,
  editor feature windows, or gizmo UI.
- runtime-three candidates may import Three but cannot import editor or
  ui-framework candidates.
- runtime ownership debt is listed with package blocker and deletion condition.

## Blocking Area 6: App Composition Still Owns Too Much Concrete Policy

### Concrete Blocker

`create-wallpaper-app.ts` still wires concrete feature policies:

```text
Scene/debug/hierarchy state registration
Window workspace floating policies
Default open views
Feature actor ids and names
Hierarchy metadata order
Debug log sink wiring
Workspace mode controller wiring
```

Files:

```text
apps/wallpaper-tesseract/src/app/create-wallpaper-app.ts
apps/wallpaper-tesseract/src/app/install-component-definitions.ts
apps/wallpaper-tesseract/src/app/workspace-mode.ts
```

### Why It Blocks Extraction

If packages are extracted while app composition still owns concrete feature
policy, the app package remains the only place that knows how the editor,
runtime, and UI packages fit together. That makes package APIs unclear and
encourages future features to keep adding policy to the app root.

### Required Fix

Phase 0B should freeze the desired direction:

- app composition may import public installers only;
- editor package owns editor window registration/defaults;
- runtime package owns runtime object/world/camera registration/defaults;
- UI framework package owns workspace/menu/window bootstrap;
- app only connects shell, stores, installers, and render loop.

Current implementation state:

- App composition blockers are explicit facts.
- App composition remains debt until editor/runtime/UI installers exist.

### Acceptance Tests

- app composition cannot import concrete actor factories.
- app composition cannot instantiate lifecycle/controller/factory internals.
- app composition cannot read browser storage directly.
- app composition debt remains explicit until editor/runtime/UI installers are
  available.

## Blocking Area 7: Browser Smoke Evidence Is Not Yet Reusable Enough

### Concrete Blocker

Phase 0D root overlap data is enough for the current verdict, but several
`actorInputLine` fields are sampled from debug log tail and are not guaranteed
to belong to the exact click.

Files:

```text
temp/project-prism-phase-0d-root-overlap-data.json
temp/project-prism-phase-0-interaction-host-report.md
```

### Why It Blocks Extraction

After UI framework extraction, regressions will often occur at the boundary
between visual z-index, DOM hit target, and actor input target. A log-tail
sample is not precise enough to diagnose those regressions.

### Required Fix

Add a reusable smoke capture contract:

- command id per interaction;
- point coordinates;
- DOM top stack;
- actor input hit actor;
- actor input hit part;
- action result;
- screenshot path;
- console errors.

Current implementation state:

- `project-prism-smoke-contract.ts` and validator tests are implemented.
- Existing browser smoke artifacts still need to be regenerated under this
  contract.

First implementation artifact:

```text
apps/wallpaper-tesseract/src/test-support/project-prism-smoke-contract.ts
```

### Acceptance Tests

- root/floating overlap smoke validates structured hit data.
- wide desktop viewport smoke is recorded.
- narrow/mobile viewport smoke is recorded.
- split-region docking and repeated dock/undock loop smoke are recorded.

## Execution Order

### Step 1: Turn Phase 0B Facts Into A Single Source

Target files:

```text
apps/wallpaper-tesseract/src/test-support/architecture-boundaries.ts
apps/wallpaper-tesseract/src/test-support/project-prism-boundary-facts.ts
apps/wallpaper-tesseract/src/architecture-boundaries.test.ts
```

Actions:

- Create `project-prism-boundary-facts.ts`.
- Move zone definitions, debt metadata, blocker text, and deletion conditions
  out of the test file.
- Keep tests importing generated facts.

Tests:

```text
npm run test -w wallpaper-tesseract -- architecture-boundaries
npm run typecheck -w wallpaper-tesseract
```

Stop if this requires allowlists instead of explicit debt zones.

### Step 2: Add Matrix Rule Helper And Enforce Full Candidate Directions

Target files:

```text
apps/wallpaper-tesseract/src/test-support/architecture-boundaries.ts
apps/wallpaper-tesseract/src/architecture-boundaries.test.ts
```

Actions:

- Add `evaluateZoneDependencyMatrix()` helper.
- Encode full matrix for actor/input/ui/runtime/editor/app zones.
- Treat unresolved dynamic imports as debt facts.

Tests:

```text
npm run test -w wallpaper-tesseract -- architecture-boundaries
```

Stop if a real dependency violation appears that cannot be classified as debt
with a deletion condition.

### Step 3: Expand Runtime Candidate Classification

Target files:

```text
apps/wallpaper-tesseract/src/test-support/project-prism-boundary-facts.ts
apps/wallpaper-tesseract/src/architecture-boundaries.test.ts
temp/project-prism-phase-0-boundary-report.md
```

Actions:

- Split app-local runtime-like files into `runtime-core-candidate`,
  `runtime-three-candidate`, or `runtime-ownership-debt`.
- Add concrete blocker entries for Tesseract, Camera3, Scene render host, and
  Three renderer backend ownership.

Tests:

```text
npm run test -w wallpaper-tesseract -- architecture-boundaries
npm run test -w four-rotation
npm run test -w four-camera
npm run test -w four-camera-three
npm run typecheck
```

### Step 4: Harden UI Framework Candidate Gates

Target files:

```text
apps/wallpaper-tesseract/src/architecture-boundaries.test.ts
apps/wallpaper-tesseract/src/test-support/project-prism-boundary-facts.ts
```

Actions:

- Make `ui-state-binding-debt` explicit for every UI -> scene-runtime edge.
- Add future deletion conditions for `ui-layout-state`, `ui-scheduler-port`,
  and UI-owned geometry.
- Confirm root/floating chrome and priority facts remain shared.

Tests:

```text
npm run test -w wallpaper-tesseract -- architecture-boundaries floating-window-component workspace-root-dock-frame-component window-frame-tab-chrome
npm run typecheck -w wallpaper-tesseract
```

### Step 5: Harden App Composition Thinness

Target files:

```text
apps/wallpaper-tesseract/src/architecture-boundaries.test.ts
temp/project-prism-phase-0-boundary-report.md
```

Actions:

- Add explicit app-composition debt entries for concrete state/policy wiring.
- Add future gate text: app imports public installers only once editor/runtime/UI
  installers exist.
- Do not fake this by creating temporary pass-through installers with the same
  concrete coupling hidden inside.

Tests:

```text
npm run test -w wallpaper-tesseract -- architecture-boundaries
npm run typecheck -w wallpaper-tesseract
```

### Step 6: Create Structured Smoke Capture Contract

Target files:

```text
temp/project-prism-phase-0-interaction-host-report.md
temp/project-prism-phase-0-smoke-report.md
temp/project-prism-phase-0-smoke-data.json
temp/project-prism-phase-0d-root-overlap-data.json
```

Actions:

- Define smoke JSON schema in the report.
- Replace log-tail actor hit expectations with command-scoped capture in future
  smoke.
- Record wide desktop, narrow/mobile, root/floating overlap, split-region
  docking, and repeated dock/undock loop baselines.

Tests:

```text
npm run dev -w wallpaper-tesseract
npm run test -w wallpaper-tesseract
npm run typecheck -w wallpaper-tesseract
npm run build -w wallpaper-tesseract
```

Browser evidence must include screenshots and structured JSON.

### Step 7: Generate Phase 0 Exit Report

Target files:

```text
temp/project-prism-phase-0-boundary-report.md
temp/project-prism-phase-0-exit-report.md
```

Actions:

- Generate or update report from the same facts used by tests.
- Mark Phase 0B complete only if matrix gaps are closed.
- Keep package-specific debt as Phase 1+ extraction blockers, not Phase 0B
  incompleteness.

Tests:

```text
npm run test -w wallpaper-tesseract
npm run typecheck -w wallpaper-tesseract
npm run build -w wallpaper-tesseract
npm run test
npm run typecheck
npm run build
```

## Final Exit Criteria

Phase 0B is complete when:

- zone map, dependency matrix, blocker list, and report are one fact source;
- no production file is unclassified;
- no candidate zone has forbidden reverse dependency;
- all remaining mixed files are explicit debt with deletion conditions;
- Phase 0D smoke data contract is reusable and structured;
- extraction-specific blockers are assigned to Phase 1+ extraction phases, not
  hidden inside Phase 0.

Formal package extraction may start only after these criteria pass.
