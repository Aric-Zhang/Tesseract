# Current Project Progress

Last updated: 2026-06-12

This document is the mutable project-status companion to `AGENTS.md`. Keep
phase status, package lists, source topology, active plans, and verification
commands here instead of in `AGENTS.md`.

## Repository Shape

This is a TypeScript npm workspace for a Wallpaper Engine tesseract demo and
supporting actor, UI, runtime, 4D, and gizmo libraries.

Current workspace packages:

- `packages/actor-core`: extracted actor/component core package.
- `packages/actor-input`: extracted actor-input package built on actor-core and
  gizmo-core.
- `packages/ui-framework`: extracted product-agnostic app shell, window, tab,
  dock, menu, layout, chrome, port, and service contracts.
- `packages/runtime-core`: extracted renderer-agnostic runtime contracts for
  ids, frames, scheduler, commands, queries, worlds, cameras, projection graph,
  and frame sources.
- `packages/runtime-three`: extracted Three/WebGL runtime backend package for
  runtime-core contracts.
- `packages/editor`: Phase 6 editor package. It currently owns editor state,
  editor window-layout defaults, and editor state adapters, and must not import
  app-local runtime glue.
- `packages/four-rotation`: 4D rotation math.
- `packages/four-camera`: 4D camera/projection model.
- `packages/four-camera-three`: Three.js bridge for the 4D camera stack.
- `packages/gizmo-core`: framework-agnostic pointer/gizmo event system.
- `apps/wallpaper-tesseract`: Vite + Three.js Wallpaper Engine app and the
  remaining staging area for app/editor/runtime integration work.

## Project Prism Status

Accepted or completed phases:

- Phase 0 / 0B established boundary reports, interaction host evidence, and
  baseline acceptance.
- Phase 1 extracted shared spine concepts, attachment metadata/runtime paths,
  explicit update frame/state/UI ports, and removed old capability adapter
  paths from accepted ownership.
- Phase 2 extracted `actor-core` and `actor-input` package targets.
- Phase 3 extracted `ui-framework` and accepted root/floating dock surface
  semantics.
- Phase 4 extracted `runtime-core` contracts and removed the earlier runtime
  adapter prototype from accepted production ownership.
- Phase 5 current scope is accepted: `runtime-three` exists, runtime work has a
  scheduler lane, editor/app state is split out of scene-wide state, Phase 4
  runtime-adapter debt is gone, and the Camera3 gizmo view-state bug is closed.
- Phase 5.5 is complete for the pre-Phase 6 window-workspace gate. The generic `SceneRuntime` / `RuntimeObject` bus has
  been deleted from production, explicit app frame orchestration is in place,
  and the old `Tesseract4RuntimeObject` has been replaced by runtime renderable
  staging. The pre-Phase 6 window-workspace truth work has moved the main
  placement mutation path to `WindowWorkspaceGraph` transactions/projections,
  and the surface/content-host/dock-tree cleanup slice has deleted the old
  exposed placement implementation.

Current gate:

- Phase 6 editor package extraction is in progress.
- The pre-Phase 6 window-workspace truth closure is complete.
- `ui-framework` and `editor` are no longer blocked by
  `window-workspace-multi-truth-debt`.
- `packages/editor` exists and owns the former app-local editor state/adapters.
  The app-local `src/editor` directory has been deleted rather than preserved
  as a compatibility barrel.
- The former app-local `FeatureActorContext` has been deleted from
  `runtime/ports`. Actor factories now depend on `actor-core`'s
  `ActorCreationContext`, so feature actor creation no longer pulls editor
  extraction back through app runtime glue.
- The old app-local `state-runtime` directory has been deleted. Editor state
  observer binding now lives in `packages/editor`, and UI component frame
  update attachment now lives in `packages/ui-framework`; `update-runtime`
  only retains runtime-work attachment debt.
- Current graph progress is real: `WindowFramePort` is now shell-only,
  production placement mutation goes through graph transaction/reconcile paths,
  graph transaction DOM atomicity was hardened, and `persistable` replaced the
  old `visiblePath === null` runtime-frame inference. The first final-closure
  execution slice also made `npm run typecheck:test -w ui-framework` pass,
  deleted legacy Debug/Hierarchy full-window factories, removed root/floating
  shell placement forwarding, closed content host/attachment placement APIs
  from ui-framework and app public barrels, and deleted the production graph
  diagnostic adapter/source contract. The surface simplification slice then
  made `WindowFrameSurfaceComponent` a graph snapshot DOM realization layer,
  added explicit reconciler stale-content cleanup and active/interactable
  operations, moved surviving content registration concepts to
  `window-content-registry.ts`, deleted `window-content-host.ts`,
  `WindowDockSurfaceModel`, and `window-frame-dock-tree`, removed runtime
  dock-root source types from `window-frame-tab.ts`, and tightened boundary
  tests so those old facts cannot return.
- The final gate added structured smoke evidence for graph snapshots, DOM
  content parentage, active/interactable parity, actor-input target evidence,
  persistence descriptors, and required scenario coverage. The reproducible
  validator is `$env:PROJECT_PRISM_SMOKE_EVIDENCE="temp/project-prism-phase-6-entry-smoke-data.json"; npm run test -w wallpaper-tesseract -- project-prism-smoke-evidence-file`.
- Continue deletion-first. Do not add compatibility wrappers or idle legacy
  paths during Phase 6; simplify ownership or delete obsolete paths in the
  subsystem where new issues are found.

Current pre-Phase 6 blocker from boundary facts:

- None.

## Current Source Topology

Important app source areas:

- `apps/wallpaper-tesseract/src/app`: app bootstrap and composition. This area
  still contains composition debt and should move toward thin package/feature
  installer wiring.
- `apps/wallpaper-tesseract/src/actor-runtime`: app-local actor runtime
  staging/candidate code that should stay aligned with the extracted
  `actor-core` package.
- `apps/wallpaper-tesseract/src/app-runtime`: transitional app runtime context
  and registration ports. Do not add new long-lived registration ownership
  here.
- `apps/wallpaper-tesseract/src/window-runtime`: app-local integration and
  staging code for frames, tabs, dock, split, lifecycle, layout, and view
  identity. Generic contracts have moved or should continue moving toward
  `packages/ui-framework`. Shell placement forwarding has been removed from
  public/production reachability; keep this layer focused on presentation,
  input intent, and app composition.
- `apps/wallpaper-tesseract/src/features/window-workspace`: feature-level
  assembly for workspace policy, persistence, and app integration. It wires the
  graph-derived dock target read path and must not revive frame-local placement
  reads.
- `apps/wallpaper-tesseract/src/features/app-menu`: app menu actor/component
  and type/instance based window command model.
- `apps/wallpaper-tesseract/src/features/scene`: Scene feature installation,
  renderable Scene view staging, content installer runtime wiring, and current
  Camera3/Tesseract render-output ownership debt.
- `packages/editor/src/scene`: Scene View presentation state, viewport/mode
  toggle components, actor factory, DOM host, and CSS. It must not import
  app-local runtime wiring, Camera3, Tesseract, or runtime render output.
- `packages/editor/src/inspector`: multi-instance Inspector pilot and view
  identity reference implementation.
- `packages/editor/src/debug`, `packages/editor/src/hierarchy`, and
  `packages/editor/src/tool-windows`: Debug and Hierarchy presentation,
  component definitions, default window state, and tool-window installer.
- `apps/wallpaper-tesseract/src/features/camera3`: Camera3 feature components.
- `apps/wallpaper-tesseract/src/camera3-control`: Camera3 motion controller and
  editor/gizmo command facade over app-local runtime camera ownership staging.
  Camera3 still has model/facade cleanup remaining before Phase 6.
- `apps/wallpaper-tesseract/src/gizmo-runtime`: component-side binding between
  actors and `gizmo-core`.
- `apps/wallpaper-tesseract/src/runtime`: app-local production runtime staging,
  including runtime scheduler service.
- `apps/wallpaper-tesseract/src/runtime/ports`: transitional app-local runtime
  ports and compatibility contracts.
- `apps/wallpaper-tesseract/src/update-runtime`: update/runtime attachment
  bridges. Split runtime work from UI/editor component ticks instead of moving
  all update work into runtime.
- `apps/wallpaper-tesseract/src/tesseract4`: Tesseract actor/component and
  runtime renderable staging. The old `Tesseract4RuntimeObject` is deleted, but
  product runtime ownership still needs package placement and Scene render-host
  inversion before Phase 6.
- `packages/editor`: extracted editor state, window-layout default paths,
  editor state adapters, Debug, Hierarchy, Inspector, and tool-window
  installer ownership. Keep it on package contracts (`actor-core`,
  `actor-input`, `runtime-core`, and `ui-framework`) and do not let it import
  app-local `runtime/ports`, `window-runtime`, `app-runtime`, or feature
  runtime owners.
- `apps/wallpaper-tesseract/src/gizmos`: editor feature candidate for later
  package extraction after Camera3/runtime ownership is clean enough.
- `apps/wallpaper-tesseract/src/test-support`: boundary facts, Prism maps, and
  generated-report support. Keep these honest; do not remove blockers without
  code reality changing.

## Window And Docking Baseline

The current docking baseline is actor-backed, frame/view based, and uses
type/instance view identity:

- `FrameActor` owns the outer frame or root workspace frame.
- `ViewActor` owns the content/runtime view inside a frame.
- `WindowViewIdentity` is the logical view identity. It contains a `typeKey`
  plus an opaque `instanceId`.
- `WindowViewKey` remains a runtime/compatibility key. Do not treat it as actor
  identity or long-term persistence identity.
- Actor ids are runtime ownership details. Do not persist actor ids or use them
  as view instance ids.
- The Inspector feature is the current multi-instance pilot.
- Windows support root workspace docking, floating frames, tabs, tab close, tab
  float, split dock, splitter resize, layout persistence/hydration, and Scene
  fullscreen isolation.
- `WindowWorkspaceGraph` is now the intended production placement truth for
  ordinary open, close, dock, split, float, fullscreen restore, and persistence
  snapshots.
- `WindowFramePort` is shell/presentation only. Do not add tab, tabset, content,
  active-view, or dock-root placement reads back to it.
- `WindowFrameTargetabilitySource` provides narrow shell facts for dock target
  discovery. Dock target geometry comes from graph projection plus graph-keyed
  surface geometry.
- Persistence version 2 stores logical view descriptors by `typeKey` and
  `instanceId`. Version 1 migration support is compatibility debt and must not
  shape new APIs.
- Remaining window-workspace debt: none blocking Phase 6. Future changes must
  preserve graph/DOM/input/persistence parity through the smoke contract and
  boundary tests.

## Runtime Ownership Baseline

Runtime package extraction has started, but production runtime ownership is not
complete.

Accepted runtime pieces:

- `runtime-core` contains runtime ids, frame/update contracts, scheduler,
  commands, queries, worlds, cameras, projection graph, and frame source
  contracts.
- `runtime-three` contains Three camera, scene, renderer, frame source, WebGL
  renderer, and line renderable backends.
- App-local runtime scheduling uses `ProductionRuntimeSchedulerService` over
  `runtime-core` scheduler concepts.
- Camera3 gizmo rendering now reads runtime-derived view state instead of the
  older projection controller camera state.

Remaining runtime ownership debt:

- `SceneRuntime` / `RuntimeObject` no longer act as the generic app-local mixed
  bus. App frame orchestration now explicitly runs runtime work, UI component
  ticks, UI scheduled services, editor state flush, and render frame sources.
- `Tesseract4RuntimeObject` has been deleted. Tesseract now uses a runtime
  renderable staging object, while actor/editor binding remains app-local debt.
- `SceneViewportComponent` now hosts a structural render target and owns DOM
  placement/measurement only; it no longer renders with `THREE.Camera` or
  imports the full runtime render output.
- `SceneViewFrameSourceRegistry` renders through the runtime render output
  after current graph/view visibility checks. The remaining Scene debt is
  package placement: content installer/renderable runtime wiring is still
  app-local and must stay out of `packages/editor` during presentation
  extraction.
- Camera3 has a runtime camera staging object that owns the runtime-three camera
  backend, but the editor-facing `Camera3Rig` facade and model cleanup still
  block declaring camera ownership fully clean.

## Active Plans And Reports

Project Prism architecture outline:

```text
docs/project-prism-engine-modularization-outline.md
```

This is the restored north-star plan. It was previously kept under `temp/`, but
now lives in `docs/` so temporary artifact cleanup cannot remove it.

Executed pre-Phase 6 surface cleanup record:

```text
temp/project-prism-pre-phase-6-surface-simplification-plan.md
```

Treat it as the executed hard preflight implementation record before Phase 6.
It replaces the older
temporary final-closure, window-workspace truth, smoke, and handoff documents
that previously lived under `temp/`; those stale working traces were removed
from the working tree on 2026-06-12.

The implementation followed the deletion-first plan: `WindowFrameSurfaceComponent`
now renders graph snapshots directly, old content host/attachment mechanics and
old dock-tree/dock-surface models are deleted, runtime dock-root source types
are gone, app-local barrels no longer re-export them, and tests now assert graph
snapshot/reconciler surface behavior instead of legacy placement methods.

Completed Phase 6 entry gate plan:

```text
temp/project-prism-pre-phase-6-final-gate-plan.md
```

Treat this as the completed final gate record. It strengthened smoke evidence
validation, added a reproducible evidence-file validator command, collected
deterministic browser evidence for graph/DOM/input/persistence parity, and
removed `window-workspace-multi-truth-debt` from boundary facts.

Final gate evidence:

```text
temp/project-prism-phase-6-entry-smoke-data.json
temp/project-prism-phase-6-entry-smoke-report.md
temp/project-prism-phase-6-entry-browser-observations.json
temp/project-prism-phase-6-entry-splitter-probe.json
```

Phase 6 may begin because `window-workspace-multi-truth-debt` is removed from
boundary facts, `typecheck:test` for `ui-framework` passes, legacy placement
APIs and old placement models are deleted from public/production reachability,
and browser smoke evidence validates graph placement, DOM placement, splitter
hit targets, actor input hits, persistence, and Scene render measurement.

Active Phase 6 editor extraction plan:

```text
temp/project-prism-phase-6-editor-extraction-plan.md
```

Treat this as the current execution plan for Phase 6. The pre-entry checkpoint
is committed, the first editor-owned state/adapters have moved into
`packages/editor`, and the feature actor creation contract has moved out of
app-local runtime ports. The Step 3 preflight binding cleanup is also complete:
state observer binding is editor-owned and UI frame update attachment is
ui-framework-owned. Debug, Hierarchy, Inspector, and the tool-window installer
have moved into `packages/editor`; their old app-local directories are
deleted. Scene presentation now lives in `packages/editor` and consumes a
structural render target instead of owning runtime render output or
`THREE.Camera` rendering. App-local `features/scene` is now runtime wiring
only. The next hard cleanup resolves Camera3 motion/rig ownership before Camera3
gizmo extraction, then moves component definition installers and app
composition wiring into a new `packages/editor` package. The plan keeps
deletion-first rules explicit: no app-local compatibility barrels, no duplicate
state or runtime ownership, no fake facades, and no package extraction step is
complete until the old app-local owner is deleted or assigned to a later
non-editor owner with a deletion condition. Final Phase 6 browser evidence must
be regenerated as `temp/project-prism-phase-6-smoke-data.json`; the existing
entry smoke data is only a baseline.

Older window/docking/view-identity plans are now Git history, not active files
in `temp/`. Recover historical context from Git when needed, then compare it
against current implementation and boundary facts before acting on it.

## Verification Commands

Root-level checks:

```text
npm run test
npm run typecheck
npm run build
```

Main app checks:

```text
npm run test -w wallpaper-tesseract
npm run typecheck -w wallpaper-tesseract
npm run build -w wallpaper-tesseract
```

Shared package checks:

```text
npm run test -w actor-core
npm run test -w actor-input
npm run test -w ui-framework
npm run typecheck:test -w ui-framework
npm run test -w editor
npm run typecheck -w editor
npm run build -w editor
npm run test -w runtime-core
npm run test -w runtime-three
npm run test -w gizmo-core
npm run test -w four-rotation
npm run test -w four-camera
npm run test -w four-camera-three
```

Useful Project Prism targeted checks:

```text
npm run test -w wallpaper-tesseract -- architecture-boundaries project-prism-boundary-report project-prism-state-domain-map project-prism-frame-update-lane-map
npm run test -w runtime-core
npm run test -w runtime-three
npm run typecheck -w wallpaper-tesseract
```

Useful window/docking/view-identity checks:

```text
npm run test -w wallpaper-tesseract -- architecture-boundaries window-view-identity window-view-factory-registry window-frame-lifecycle-controller window-frame-lifecycle window-frame-tab-chrome floating-window-component workspace-root-dock-frame-component window-dock-targets window-dock-preview-component window-workspace-layout window-workspace-layout-persistence window-workspace-layout-persistence-controller app-menu
npm run test -w ui-framework -- window-workspace-graph window-workspace-graph-reconciler window-frame-lifecycle-controller dock-target-region-source window-frame-targetability-source window-frame-surface-component
npm run typecheck:test -w ui-framework
npm run typecheck -w wallpaper-tesseract
npm run build -w wallpaper-tesseract
```

Useful runtime ownership checks during Phase 5.5:

```text
npm run test -w wallpaper-tesseract -- runtime-frame-adapter runtime-scheduler-service update-runtime tesseract4 camera3-components camera3-gizmo-actor-factory scene-view scene-viewport architecture-boundaries project-prism-boundary-report project-prism-state-domain-map project-prism-frame-update-lane-map
npm run test -w runtime-core
npm run test -w runtime-three
npm run typecheck -w wallpaper-tesseract
```

## Browser Verification Matrix

For UI/input/window/runtime-render changes, run the Vite dev server:

```text
npm run dev -w wallpaper-tesseract
```

Then verify at least:

- Root workspace Scene is visible and keeps usable height when toolbar or
  status areas are hidden.
- Debug, Hierarchy, Inspector, and Scene can be opened or focused through the
  app menu.
- Multi-instance commands create/focus distinct Inspector instances without
  confusing type identity and instance identity.
- Debug window titlebar drag moves the window.
- Debug window resize changes size.
- Window focus-to-front works for overlapping windows.
- Root/floating tab close closes only the selected view and leaves other views
  and frame ownership consistent.
- Mixed frame close can be recovered through the Window menu.
- Hierarchy row click selects the row/object.
- Content blank clicks do not drag windows or select rows.
- Overlapping windows route input to the higher z-index window.
- Scene docked in a mixed tab frame can fullscreen into a Scene-only
  runtime-only frame, hide the source mixed frame, and restore.
- Scene docked in a split frame can fullscreen/restore without persisting the
  runtime-only fullscreen frame.
- A third tab can dock into every visible tabset/pane region, including root
  workspace regions and floating frame regions.
- Root/floating drag and dock cycles work in both directions.
- Merge/split layout survives reload using version 2 type/instance
  persistence.
- Legacy version 1 layout migration still hydrates until the active plan
  removes it.
- Camera3 drag updates camera behavior and gizmo display.
- Camera3 double-click snap still works.
- Projection toggle updates the gizmo label/view state.
- Tesseract remains visible.
- Scene close/reopen leaves no stale canvas, observer, or renderer.
- For render ownership changes, loop Scene close/reopen 10 times and root/
  floating dock/undock 10 times.
- Mobile-sized viewport still has usable controls without text overlap.
- Console errors are 0.

For Phase 5.5 render ownership work, smoke data should record frame source id,
Scene View actor id, renderer/backend id or equivalent runtime output id,
canvas/overlay rects, actor-input hit for Camera3 interactions, projection mode
before/after, and camera state before/after.

For the completed pre-Phase 6 window-workspace gate, final browser smoke records
graph frame/tabset/content ids, each `contentId`'s single DOM parent, splitter
hit regions mapped to graph split ids, active tab/content parity with graph
projection, persisted layout without actor ids, and console errors. The
evidence-file validator command above is the reproducible gate for that data.

## Progress Document Maintenance

Update this file when:

- a workspace package is added, removed, extracted, or accepted;
- Project Prism phase status changes;
- an active plan changes;
- boundary facts add or remove blockers;
- the source topology or ownership map changes;
- verification commands or browser smoke requirements change.

Keep `AGENTS.md` focused on stable rules.
