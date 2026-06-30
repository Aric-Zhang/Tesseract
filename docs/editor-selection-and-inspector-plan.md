# Foundation Facade, Diagnostics, Selection, And Inspector Plan

Status: `completed`

Last updated: 2026-06-30

## Purpose

This plan covers the next foundational editor/runtime convenience APIs:

- a shared facade-provider mechanism for Unity-style convenient calls;
- cross-domain diagnostics and `Debug.log(...)`;
- profiling design constraints that can later reuse the same facade mechanism
  once a real first consumer exists;
- editor actor selection and Inspector follow/lock behavior.

The goal is to set the long-term architecture once, while keeping each domain's
facts in the correct owner:

- `foundation` owns generic facade slots, diagnostics events, debug provider
  installation, and the rules future profiler primitives must follow.
- `actor-system/core` may own a small framework-agnostic actor selection model.
- `editor` owns editor selection policy, editor state integration, Hierarchy
  activation mapping, Inspector follow/lock behavior, and the `Selection`
  facade.
- Debug Log UI is a viewer of diagnostics, not the diagnostics owner.

This lets runtime, editor, custom editor, actor/input/gizmo code, UI framework,
and app code all use `Debug.log(...)` without depending on Editor. It also lets
Editor expose `Selection.activeActor` without making Selection a global actor
system singleton.

## Reference Behavior

External editor patterns support this split:

- Unity exposes convenient static-style entry points such as
  `Selection.activeObject` and `Debug.Log(...)`.
- Unity distinguishes selected objects from active object; the Inspector follows
  the active object while the full selection can contain multiple objects.
- Blender similarly distinguishes selected objects from active object and has
  pinned-properties behavior where a properties panel may keep showing an
  object even when active selection changes.
- WAI-ARIA tree guidance keeps keyboard focus separate from item selection.
  Tree focus/navigation should not become editor selection truth by itself.

TypeScript should keep the same convenience but use ES module semantics:

```ts
import { Debug } from "foundation/diagnostics";
import { Selection } from "editor";

Debug.log("Selected actor", Selection.activeActor);
```

## Non-Negotiables

- Do not create a broad service locator.
- Do not create hidden global fallbacks. If a facade provider is not installed,
  fail loudly in development/tests.
- Do not make selection a special actor in the actor tree.
- Do not make `ActorSystem` always own a global selection singleton.
- Do not put Editor, Inspector, Hierarchy, Scene, DOM, window, persistence, or
  editor command policy into `actor-system`.
- Do not let `ui-framework` own editor selection. TreeView stays generic and
  only emits activation.
- Do not put Debug in `editor` as the only source of truth. Runtime and other
  packages must be able to use diagnostics without importing Editor.
- Do not let Debug Window write or own diagnostic events. It subscribes to a
  `DiagnosticSource`.
- Keep editor selection as one authoritative snapshot, not separate paths that
  can temporarily disagree.
- Do not keep `selection.activeObject` as a compatibility path after the new
  snapshot path is installed.
- Multi-selection support must exist in the model from the first implementation,
  even if the first Hierarchy interaction only performs single replace
  selection.

## Architecture Decision

### Foundation Package

Add:

```text
packages/foundation
```

Package contract:

- zero dependencies;
- no actor, editor, runtime, ui-framework, DOM, or Three concepts;
- explicit submodule exports only;
- no root broad barrel unless a later reviewed plan allows one.

Initial exports:

```text
foundation/facade
foundation/diagnostics
```

`foundation` exists because `Debug` and future convenience APIs need one shared
provider lifecycle pattern. Putting that pattern in Editor or Runtime would
pull unrelated domains into the wrong layer. `foundation/profiling` is reserved
as a future submodule name, but this plan must not add profiler code unless the
conditional profiling gate below is reached.

### Dependency Direction

Package direction must remain:

```text
foundation -> []
actor-system/core -> []
actor-system/input -> [actor-system/core]
actor-system/gizmo -> [actor-system/core, actor-system/input]
```

Rules:

- `actor-system/core/selection` must not import `foundation`. It is a pure
  actor-id snapshot/model utility.
- If `actor-system/input` or `actor-system/gizmo` later needs diagnostics, that
  work must be reviewed separately and may only depend on
  `foundation/diagnostics`; it must not pull in Editor or product logging.
- `four-*` math packages must not import `foundation`, `Debug`, or profiler
  convenience APIs.
- Runtime/editor/app composition may install diagnostic providers. They should
  not become required by foundation itself.

### Facade Slot Primitive

Add `foundation/facade`.

Candidate API:

```ts
interface FacadeProviderRegistration {
  dispose(): void;
}

interface FacadeSlot<TProvider> {
  install(provider: TProvider): FacadeProviderRegistration;
  current(): TProvider;
  isInstalled(): boolean;
}

function createFacadeSlot<TProvider>(name: string): FacadeSlot<TProvider>;
```

Rules:

- Only one provider may be installed at a time.
- `current()` throws if no provider is installed.
- `dispose()` removes the provider only if it still owns the slot.
- No stack of fallback providers.
- No silent no-op provider.
- Tests can install a fake provider and dispose it.

This primitive is deliberately tiny. It is not an application container.

### Diagnostics And Debug

Add `foundation/diagnostics`.

Candidate types:

```ts
type DiagnosticLevel = "log" | "info" | "warn" | "error";

interface DiagnosticEventInput {
  readonly level: DiagnosticLevel;
  readonly message: unknown;
  readonly data?: unknown;
  readonly source?: string;
  readonly tags?: readonly string[];
}

interface DiagnosticEvent {
  readonly id: number;
  readonly timestampMs: number;
  readonly level: DiagnosticLevel;
  readonly message: string;
  readonly rawMessage?: unknown;
  readonly data?: unknown;
  readonly source?: string;
  readonly tags?: readonly string[];
}

interface DiagnosticSink {
  emit(input: DiagnosticEventInput): void;
}

interface DiagnosticSource {
  snapshot(): readonly DiagnosticEvent[];
  subscribe(listener: (event: DiagnosticEvent) => void): FacadeProviderRegistration;
}
```

Add `DiagnosticHub`:

- implements `DiagnosticSink` and `DiagnosticSource`;
- owns monotonically increasing ids;
- owns timestamp assignment;
- owns ring buffer capacity;
- notifies subscribers synchronously and deterministically;
- does not know about Debug Window, VirtualListView, DOM, Editor, or Runtime.

Add `Debug` facade:

```ts
Debug.log(message: unknown, data?: unknown): void;
Debug.info(message: unknown, data?: unknown): void;
Debug.warn(message: unknown, data?: unknown): void;
Debug.error(message: unknown, data?: unknown): void;
```

`Debug` delegates to the installed diagnostic provider. App composition installs
a `DiagnosticHub`. Debug Window subscribes to the same hub.

Provider installation must go through a narrow named API such as
`installDiagnosticProvider(provider)`. Do not export the internal diagnostics
facade slot object.

Single-truth exit rule:

- `DiagnosticHub` is the only owner of diagnostic event ids, timestamps,
  capacity, and retained event history.
- `DiagnosticHub.snapshot()` must protect event envelopes and `tags` from
  external mutation. `data` and `rawMessage` are opaque payload references, not
  deep-cloned arbitrary objects.
- Debug Window must subscribe to `DiagnosticSource`.
- `DebugLogDataSource` must either be deleted or become a thin
  `DiagnosticEvent -> VirtualListDataSource` view adapter.
- `DebugLogDataSource` must not keep its own independent ring buffer, event id
  sequence, source type, or retained log truth.
- The app-local direct path from `create-wallpaper-app.ts` through
  `debugLogTarget` / `onDebugLogContentChanged` must be deleted in the same
  migration; it must not remain as a compatibility or fallback log path.

Recommended package usage:

- Libraries may accept an explicit `DiagnosticSink` option for testability.
- Convenience paths may call `Debug.log(...)` where a global-style diagnostic
  entry is appropriate.
- Explicit sinks should be preferred in constructors where dependency injection
  already exists.

### Deferred Profiling Constraint

Do not add `foundation/profiling` code by default in this plan.

Profiling is a reserved design direction, not an unconditional implementation
step. Add the submodule only if, during this execution, diagnostics has already
validated the facade slot pattern and there is a concrete first profiling
consumer with tests. Otherwise, leave this section as an architecture
constraint and do not create new profiler files or package exports.

Candidate API:

```ts
interface ProfilerSink {
  mark(name: string, data?: unknown): void;
  measure(name: string, durationMs: number, data?: unknown): void;
}

Profiler.mark(name: string, data?: unknown): void;
Profiler.measure(name: string, durationMs: number, data?: unknown): void;
```

The first implementation can be a small event hub or a no-UI sink/source pair.
The important part is that Profiler uses the same facade-provider mechanism as
Debug, so future expansion does not invent a parallel global API pattern.

If the conditional gate is not met, the exit condition is documentation only:
future profiler work must reuse `foundation/facade`, must not invent a second
global-provider mechanism, and must not depend on Editor UI or runtime-specific
frame semantics in the foundation layer.

### Actor Selection Primitive

Add an optional primitive under `actor-system/core/selection`.

It should provide:

```ts
interface ActorSelectionSnapshot {
  readonly selectedActorIds: readonly string[];
  readonly activeActorId: string | null;
}
```

Candidate API:

```ts
class ActorSelectionModel {
  constructor(snapshot?: ActorSelectionSnapshot);
  get snapshot(): ActorSelectionSnapshot;
  replace(actorIds: readonly string[], activeActorId?: string | null): ActorSelectionSnapshot;
  toggle(actorId: string): ActorSelectionSnapshot;
  add(actorIds: readonly string[], activeActorId?: string | null): ActorSelectionSnapshot;
  remove(actorIds: readonly string[]): ActorSelectionSnapshot;
  clear(): ActorSelectionSnapshot;
  prune(validActorIds: ReadonlySet<string>): ActorSelectionSnapshot;
}
```

Rules:

- Preserve order.
- Deduplicate actor ids.
- `activeActorId` must be included in `selectedActorIds`.
- If selection is non-empty and no valid active id is supplied, choose the last
  selected actor id as active.
- If active actor is removed, choose the last remaining selected id.
- `prune(...)` removes destroyed/missing actor ids and fixes active id.
- No DOM, Editor state, command sink, Inspector, Hierarchy, Scene, or
  ui-framework imports.
- This model is optional: Editor creates and uses it, but `ActorSystem` itself
  does not automatically expose a selection singleton.

### Editor Selection Policy

Add `packages/editor/src/selection`.

It should own:

- `EditorSelectionSnapshot` alias or extension over `ActorSelectionSnapshot`;
- `editorStatePaths.selection.snapshot`;
- `createDefaultEditorSelectionState(...)`;
- `registerEditorSelectionParameters(...)`;
- `createEditorSelectionCommand(...)` helpers for replace/toggle/add/remove;
- validation and cloning around `ActorSelectionModel`;
- `Selection` facade and `installEditorSelectionProvider(...)`, implemented via
  `foundation/facade`.

The editor state value should be one snapshot:

```ts
selection.snapshot: EditorSelectionSnapshot
```

Do not keep:

```ts
selection.activeObject
```

as an active path after migration. Existing uses should move to
`selection.snapshot.activeActorId`.

### Selection Convenience Facade

The programming surface should be close to Unity's convenient static access,
but implemented with TypeScript module semantics rather than a stateful static
class.

Preferred usage:

```ts
import { Selection } from "editor";

const active = Selection.activeActor;
const selected = Selection.selectedActors;

Selection.replace(actor);
Selection.clear();
```

Implementation shape:

```ts
export const Selection = createEditorSelectionFacade();
```

`Selection` is a module-level named object facade. It delegates every read and
write to an installed `EditorSelectionProvider`. It does not hold selection
state itself.

Candidate provider:

```ts
interface EditorSelectionProvider {
  readonly snapshot: EditorSelectionSnapshot;
  readonly activeActor: Actor | null;
  readonly selectedActors: readonly Actor[];
  replace(actor: Actor | string | null): void;
  add(actors: readonly (Actor | string)[]): void;
  toggle(actor: Actor | string): void;
  remove(actors: readonly (Actor | string)[]): void;
  clear(): void;
}
```

Rules:

- `Selection.activeActor` resolves through `ActorSystemView` plus
  `selection.snapshot.activeActorId`.
- `Selection.selectedActors` resolves through the ordered selected actor ids.
- `Selection.replace(...)` submits Editor selection commands through the
  provider/controller, not by mutating `ActorSelectionModel` directly.
- Tests may install a fake provider and dispose it after the test.
- Production app/editor composition installs exactly one provider and disposes
  it with the editor runtime.
- No root package mutable singleton should be added to `actor-system`.
- This `Selection` facade is an app/editor-runtime scoped singleton
  convenience for the current product, not a multi-editor service locator.
- Double production install must fail loudly.
- If future work needs multiple editor/custom-editor runtimes in one process,
  it must introduce a reviewed scoped-selection facade or explicit provider
  object. Do not add fallback stacks or keyed providers to this slot.

## Execution Plan

### Gate 0: Preflight And Foundation Diagnostics Base

Status: `complete`

Purpose: finish the current UI work boundary, add the minimal foundation
package, and prove facade slots plus diagnostics are real shared infrastructure
without connecting product Debug UI yet.

Detailed execution plan:

```text
docs/editor-selection-and-inspector-gate-0-foundation-diagnostics-plan.md
```

Entry checks:

```text
git status --short
npm run test -w ui-framework -- tree scroll collection
npm run test -w editor -- hierarchy
```

Before implementation, finish or checkpoint the current TreeView
expand/collapse work. Do not mix TreeView row behavior changes with foundation,
diagnostics, or editor selection ownership changes in one commit unless
explicitly requested.

Create:

```text
packages/foundation/package.json
packages/foundation/tsconfig.json
packages/foundation/src/facade/facade-slot.ts
packages/foundation/src/facade/index.ts
packages/foundation/src/diagnostics/diagnostic-event.ts
packages/foundation/src/diagnostics/diagnostic-hub.ts
packages/foundation/src/diagnostics/debug-facade.ts
packages/foundation/src/diagnostics/index.ts
```

Update:

```text
package.json
package-lock.json
scripts/workspace-sequence-config.mjs
apps/wallpaper-tesseract/src/test-support/package-graph-boundaries.ts
apps/wallpaper-tesseract/src/architecture-boundaries.test.ts
```

Implement:

- `createFacadeSlot<TProvider>(name)` with single-provider install/current/
  dispose semantics.
- `DiagnosticHub` as the single event id/timestamp/capacity/history owner.
- `Debug.log/info/warn/error` as a facade over the installed diagnostic
  provider.
- Conditional profiling decision only. Do not add `foundation/profiling` code
  unless a concrete first profiling consumer is identified during this gate and
  reviewed as necessary.

Tests:

- install/current/dispose lifecycle;
- double install fails;
- current before install fails;
- stale registration dispose does not remove a newer provider;
- `DiagnosticHub` assigns monotonic ids;
- ring buffer enforces capacity;
- subscribers receive emitted events and unsubscribe stops delivery;
- snapshot returns cloned/immutable event data;
- `Debug.log/warn/error` fail before provider install;
- `Debug` forwards to installed provider;
- provider dispose restores uninstalled state;
- no dependencies beyond TypeScript tooling.

Boundary:

- `foundation` imports no workspace package;
- package graph descriptors record `foundation -> []`;
- `actor-system/core/selection` must not depend on `foundation`;
- `four-*` packages remain free of `foundation`, `Debug`, and profiling
  convenience imports;
- `foundation/profiling` has no files/exports unless the conditional profiling
  gate was explicitly reached.

Exit validation:

```text
npm run test -w foundation
npm run typecheck -w foundation
npm run build -w foundation
npm run test -w wallpaper-tesseract -- architecture-boundaries
```

### Gate 1: Diagnostics Product Migration

Status: `complete`

Purpose: make diagnostics the only Debug event truth and delete the old app-to-
Debug-window log path in the same gate. This gate must not leave a compatibility
or fallback logger behind.

Detailed execution plan:

```text
docs/editor-selection-and-inspector-gate-1-diagnostics-product-migration-plan.md
```

Update:

```text
apps/wallpaper-tesseract/src/app/create-wallpaper-app.ts
packages/editor/src/debug/**
packages/editor/src/index.ts
apps/wallpaper-tesseract/src/features/**/*
```

Expected ownership:

- app composition creates one `DiagnosticHub`;
- app installs it as Debug provider;
- app/editor debug feature receives it as `DiagnosticSource`;
- Debug Log data source subscribes to it;
- old Debug-specific log source ownership is deleted, not kept in parallel;
- `DebugLogDataSource` becomes a thin view adapter or is deleted entirely;
- `create-wallpaper-app.ts` no longer wires `debugLogTarget` or
  `onDebugLogContentChanged`.

Tests:

- `Debug.log(...)` produces an event in the Debug Log data source;
- direct source append path is removed;
- Debug Window close/reopen does not duplicate subscriptions;
- `DiagnosticHub` ring buffer capacity limits displayed history;
- no second Debug-owned retained log buffer, id sequence, or source model
  remains.

Grep gates:

```text
rg -n "debugLogTarget|onDebugLogContentChanged" apps/wallpaper-tesseract/src packages/editor/src
```

Allowed hits after migration:

- historical docs only;
- tests explicitly asserting old path removal only if useful.

Exit validation:

```text
npm run test -w foundation
npm run test -w editor -- debug
npm run test -w wallpaper-tesseract -- architecture-boundaries
npm run typecheck -w editor
npm run typecheck -w wallpaper-tesseract
npm run test
npm run typecheck
npm run build
npm run prism:smoke:prepare
node temp/run-editor-gate-1-diagnostics-smoke.mjs
```

Browser smoke evidence:

```text
temp/editor-gate-1-diagnostics-smoke-data.json
temp/editor-gate-1-diagnostics-smoke-report.md
```

Browser smoke covers:

- trigger real non-editor gizmo diagnostics through pointer input;
- verify those diagnostics appear in Debug Window;
- close/reopen Debug Window and confirm no duplicated subscription output;
- console errors are 0.

Gate 1 is complete. Gate 2 is complete. Gate 3 is the next implementation slice.

### Gate 2: Selection Model And Editor Ownership

Status: `completed`

Purpose: introduce the actor-id selection primitive, move Editor selection state
out of Hierarchy, install the scoped `Selection` facade provider, and delete the
legacy `selection.activeObject` path.

Detailed execution plan:

```text
docs/editor-selection-and-inspector-gate-2-selection-model-editor-ownership-plan.md
```

Create:

```text
packages/actor-system/src/core/selection/actor-selection-model.ts
packages/actor-system/src/core/selection/index.ts
packages/actor-system/src/core/selection/actor-selection-model.test.ts
packages/editor/src/selection/editor-selection-state.ts
packages/editor/src/selection/selection-facade.ts
packages/editor/src/selection/index.ts
```

Update:

```text
packages/actor-system/src/core/index.ts
packages/editor/src/editor-state.ts
packages/editor/src/index.ts
packages/editor/src/install-component-definitions.ts
packages/editor/src/tool-windows/install-tool-window-features.ts
packages/editor/src/hierarchy/hierarchy-panel-state.ts
```

Implement:

- `ActorSelectionModel` and immutable/cloned `ActorSelectionSnapshot`;
- editor selection state at `editorStatePaths.selection.snapshot`;
- editor selection commands/helpers for replace/toggle/add/remove;
- `Selection` facade implemented through `foundation/facade`;
- single app/editor-runtime provider install;
- provider reads actors through `ActorSystemView` and submits commands through
  the editor command path;
- migration away from `selection.activeObject`;
- removal of selection registration from
  `packages/editor/src/hierarchy/hierarchy-panel-state.ts`.

Tests:

- Empty snapshot normalizes to `selectedActorIds: []`, `activeActorId: null`.
- Replace with duplicated ids preserves first occurrence and deduplicates.
- Replace without active chooses the last selected id.
- Replace with active not in selected falls back deterministically.
- Toggle adds/removes an id and repairs active id.
- Add preserves existing order and appends new ids.
- Remove prunes ids and repairs active id.
- Prune removes missing ids and repairs active id.
- Returned snapshots are immutable or cloned so callers cannot mutate internal
  state.
- Editor selection path registers once per store.
- Registering twice for the same store is idempotent.
- External registration conflict fails clearly.
- Invalid snapshots fail validation.
- Store clones snapshots so caller mutations do not mutate state.
- `Selection` facade throws before provider install.
- `Selection` facade forwards reads/writes to the installed provider.
- Disposing provider registration restores the uninstalled state.
- No production reference to `selection.activeObject` remains.
- Provider exposes `activeActor` and `selectedActors` in snapshot order.
- Provider `replace(actor)` submits a snapshot command.
- Provider accepts actor object or actor id.
- Provider does not mutate app state directly.
- Disposing the registration prevents later `Selection` reads from using stale
  owner state.
- Double provider install fails.
- No fallback provider stack exists.

Scope rule:

- This provider is the single app/editor-runtime provider for the current
  product. Multi-editor-runtime support is out of scope and must not be faked
  with keyed global slots.

Boundary:

- `actor-system/src/core/selection` must not import `input`, `gizmo`,
  `ui-framework`, `editor`, runtime packages, DOM, `foundation`, or app-local
  code;
- `ui-framework` has no editor selection imports;
- Hierarchy no longer registers editor selection state;
- `Selection` is not exported by `actor-system`.

Grep gates:

```text
rg -n "selection\\.activeObject|activeObject" packages/editor/src apps/wallpaper-tesseract/src
```

Allowed hits after migration:

- historical docs only;
- tests explicitly asserting old path removal only if useful.

Exit validation:

```text
npm run test -w actor-system -- selection
npm run test -w editor -- selection hierarchy
npm run test -w wallpaper-tesseract -- architecture-boundaries
npm run typecheck -w actor-system
npm run typecheck -w editor
npm run typecheck -w wallpaper-tesseract
```

Gate 2 smoke evidence:

```text
temp/editor-gate-2-selection-smoke-data.json
temp/editor-gate-2-selection-smoke-report.md
```

### Gate 3: Hierarchy Selection, Inspector Follow, And Final Validation

Purpose: make Inspectors follow or lock to the active selected actor, keep
Hierarchy as the selection command producer and selected-row viewer, and run the
final cross-package validation. Gate 2 already connected real Hierarchy
activation to `selection.snapshot`; Gate 3 must not reintroduce Hierarchy-owned
selection state.

Detailed execution plan:

```text
docs/editor-selection-and-inspector-gate-3-inspector-follow-lock-plan.md
```

The detailed Gate 3 plan supersedes the rough checklist below where the two
conflict. In particular, real Hierarchy activation has already been completed
in Gate 2; Gate 3 focuses on Inspector follow/lock and the final validation.

Update:

```text
packages/editor/src/hierarchy/hierarchy-panel-component.ts
packages/editor/src/hierarchy/hierarchy-tree-item-actor-reconciler.ts
packages/editor/src/hierarchy/hierarchy-panel-state.test.ts
packages/editor/src/hierarchy/hierarchy-panel-actor-factory.test.ts
packages/editor/src/inspector/inspector-content-component.ts
packages/editor/src/inspector/inspector-content-definition.ts
packages/editor/src/inspector/inspector-view-actor-factory.ts
packages/editor/src/inspector/install-inspector-feature.ts
```

Hierarchy behavior:

- Clicking a Hierarchy tree row performs replace selection:

```ts
selectedActorIds: [activation.itemId]
activeActorId: activation.itemId
```

- Multi-selection policies such as Ctrl-toggle and Shift-range are not required
  in this step, but the state model must already support them.
- TreeView disclosure expand/collapse must not change selection.

Rendering:

- `HierarchyTreeItemActorReconciler` marks row `selected` when item id is in
  `selectedActorIds`.
- Do not add active-row visual state in this step unless a separate generic
  TreeView descriptor is justified. The active actor can be inferred by
  Inspector for now.

Add a narrow display source:

```ts
interface InspectorActorDisplaySource {
  getActorDisplayName(actorId: string): string | null;
}
```

The implementation can wrap `ActorSystemView` in the editor layer. The
Inspector component should not reach into app-local code.

Inspector state:

- `inspectedActorId: string | null`;
- `locked: boolean`.

Behavior:

- On construction, an unlocked Inspector inspects current
  `selection.snapshot.activeActorId`.
- On selection snapshot change, unlocked Inspectors follow the new active id.
- Locked Inspectors keep their current `inspectedActorId`.
- If locked id no longer resolves, show a missing-state message.
- First content view only needs to show the inspected actor name/id.

Display text:

- No selection: `No actor selected`
- Actor found: `Inspecting: <actor name>`
- Actor missing: `Missing actor: <actor id>`

Lock UI:

- Preferred first pass: no visible lock control. Implement locked/unlocked
  state and tests, then leave the visible control to a later Arbor-style generic
  UI control pass.
- If a visible lock control is added in this step, the Inspector content must
  first move to `UiElementComponent` / generic control wiring and route through
  actor-input.
- Do not add new interactive behavior to the current self-created Inspector DOM
  root.
- Do not add DOM click shortcuts.

Tests:

- Row activation submits a selection snapshot command.
- Selection snapshot event updates selected row state.
- Disclosure toggle does not submit selection.
- Selected set can contain multiple ids in tests and rows reflect all selected
  ids.
- Hierarchy still filters its own presentation/item actors out of the source.
- Unlocked Inspector follows active selection.
- Locked Inspector ignores selection changes.
- Unlocking immediately catches up to current active selection.
- Two Inspector instances can diverge when one is locked.
- Multi-selection inspects the active actor, not an arbitrary selected id.
- Missing actor id displays deterministic missing state.

Boundary tests:

- `foundation` imports no workspace packages.
- `foundation/diagnostics` does not import editor, runtime, UI, or app code.
- `foundation/profiling` has no files/exports unless the conditional profiling
  gate was reached; if it exists, it does not import editor, runtime, UI, or app
  code.
- Gate 0 production `foundation/facade` usage is limited to diagnostics until a
  later gate explicitly widens the allowlist for `Selection`.
- `actor-system/core/selection` has no editor/ui/runtime/app imports.
- `actor-system/core/selection` does not import `foundation`.
- `four-*` packages do not import `foundation`, `Debug`, or profiler
  convenience APIs.
- `ui-framework` has no editor selection imports.
- Hierarchy remains the producer of selection commands, not the owner of
  selection state registration.
- Inspector follows editor selection state and does not read Hierarchy internals.
- Debug Window subscribes to diagnostics instead of owning the diagnostics fact.
- Debug Window has no independent ring buffer/id/source truth after migration.
- App composition no longer wires `debugLogTarget` /
  `onDebugLogContentChanged`.

Final targeted validation:

```text
npm run test -w foundation
npm run test -w actor-system -- selection
npm run test -w editor -- selection hierarchy inspector debug
npm run test -w wallpaper-tesseract -- architecture-boundaries
npm run typecheck -w foundation
npm run typecheck -w actor-system
npm run typecheck -w editor
npm run typecheck -w wallpaper-tesseract
npm run build -w foundation
npm run build -w actor-system
npm run build -w editor
npm run build -w wallpaper-tesseract
```

Browser smoke is recommended after the first Inspector UI is visible:

- `Debug.log(...)` from a non-editor path appears in Debug Window.
- Select actor in Hierarchy.
- Unlocked Inspector updates to actor name.
- Open two Inspectors.
- Lock one Inspector.
- Select another actor.
- Locked Inspector keeps old actor; unlocked Inspector follows new actor.
- No console errors.

## Stop Conditions

Stop and revise this plan if:

- `foundation` needs to know about Actor, Editor, Runtime, UI, DOM, or app code.
- Diagnostics requires Editor or Debug Window to own log events.
- Conditional profiler code needs UI or runtime-specific frame semantics.
- Selection primitive needs Editor command/state knowledge inside
  `actor-system`.
- Selection requires a special actor in the actor tree to function.
- Inspector needs to read Hierarchy internals instead of editor selection state.
- Multi-selection cannot be represented as one snapshot without changing
  AppState transaction semantics.
- Implementing lock UI requires direct DOM click mutation instead of actor-input
  or an existing generic UI control path.

## Out Of Scope

- Ctrl/Shift multi-selection interaction.
- Scene picking.
- Search box selection.
- Inspector property editing/details.
- Undo/redo integration for selection.
- Persistent selection across reload.
- Profiler UI.
- Advanced profiler frame aggregation.

These should build on the foundation facade slot, diagnostics hub, profiling
skeleton, actor selection model, and editor selection policy introduced here,
not replace them.
