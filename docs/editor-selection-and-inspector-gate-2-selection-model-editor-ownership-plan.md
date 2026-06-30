# Gate 2: Selection Model And Editor Ownership Plan

Status: `completed`

Last updated: 2026-06-30

Parent plan:

```text
docs/editor-selection-and-inspector-plan.md
```

Prerequisites:

```text
docs/editor-selection-and-inspector-gate-0-foundation-diagnostics-plan.md
docs/editor-selection-and-inspector-gate-1-diagnostics-product-migration-plan.md
```

## Goal

Move editor actor selection from the old Hierarchy-owned `selection.activeObject`
path to a single editor-owned selection snapshot built on a pure actor-system
selection model.

After this gate:

- `actor-system/core` provides a framework-agnostic actor-id selection model;
- `packages/editor/src/selection` owns editor selection state registration,
  command helpers, and the `Selection` convenience facade;
- app composition installs exactly one scoped editor selection provider;
- Hierarchy activation writes the editor selection snapshot instead of
  `selection.activeObject`;
- Hierarchy reads the selection snapshot for row selected state;
- `packages/editor/src/hierarchy/hierarchy-panel-state.ts` no longer registers
  selection;
- no production `selection.activeObject` / `activeObject` state path remains;
- Inspector follow/lock behavior is still deferred to Gate 3.

This gate is allowed to change existing Hierarchy single-click selection so the
old active-object fact can be deleted. It must not add multi-select UI gestures,
Inspector details, or a second selection state path.

## Current Facts

Current production selection path:

```text
HierarchyPanelComponent.activateTreeItem(...)
  -> EditorCommandSink target editorStatePaths.selection.activeObject
  -> AppStateParameterStore value string | null
  -> HierarchyPanelComponent.onStateChanged(...)
  -> HierarchyTreeItemActorReconciler selected: item.id === activeObject
```

Current debt:

- `selection.activeObject` is a single-id path, so the model cannot represent a
  selected set.
- Hierarchy owns selection parameter registration in
  `hierarchy-panel-state.ts`, even though selection is an editor-wide fact.
- Future Inspector, Scene selection, search, and custom editor flows would all
  need to touch Hierarchy state or introduce parallel selection facts.

Gate 2 deletes this old path instead of adding a second selection model beside
it.

## Non-Negotiables

- Do not keep `selection.activeObject` as a compatibility path.
- Do not add `selection.snapshot` while still writing/reading
  `selection.activeObject`.
- Do not make Selection a special actor in the actor tree.
- Do not make `ActorSystem` own an always-on global selection singleton.
- Do not let `actor-system/core/selection` import `foundation`, `editor`,
  `ui-framework`, runtime packages, DOM, app-local code, `input`, or `gizmo`.
- Do not let `ui-framework` know about editor selection.
- Do not add keyed/global provider stacks for multiple editor runtimes. This
  product installs one editor selection provider; double install must fail.
- Do not let Hierarchy keep registering editor selection state after the editor
  selection owner exists.
- Do not implement Inspector follow/lock in this gate.
- Do not implement Ctrl/Shift multi-selection gestures in this gate. The model
  must support a set, but the first Hierarchy interaction may remain replace
  selection.

## Architecture Decision

### Actor-System Scope

Add a pure selection model under:

```text
packages/actor-system/src/core/selection/
```

It handles only actor ids and immutable snapshots. It must not receive
`ActorSystem`, `Actor`, editor state stores, input events, DOM events, or command
ports.

The intended public path is still `actor-system/core`; do not add a new package
export such as `actor-system/selection`.

### Editor Scope

Add editor selection ownership under:

```text
packages/editor/src/selection/
```

This layer owns:

- editor selection state path registration;
- editor selection command helpers;
- the `Selection` convenience facade;
- provider install/dispose lifecycle for the current app/editor runtime.

The provider may read committed state from `AppStateParameterStore`, submit
commands through `EditorCommandSink`, and resolve actor ids through
`ActorSystemView`. It must not mutate the store directly.

### Hierarchy Scope

Hierarchy remains a view/controller over actor tree data:

- it reads the editor selection snapshot;
- it submits replace-selection commands when a tree item is activated;
- it highlights selected rows through generic `TreeViewItemComponent`
  descriptors;
- it no longer registers or owns selection parameters.

### Facade Scope

`Selection` is a convenience facade for the one current editor runtime. It is
not a universal actor-system singleton. If a future product needs multiple
editor runtimes, create a reviewed scoped-selection plan rather than layering
fallbacks or keyed slots onto this one.

## Target API Shape

The implementation may choose exact naming during execution, but it should keep
the surface close to this shape and avoid broader abstractions.

### Actor Selection Model

```ts
export interface ActorSelectionSnapshot {
  readonly selectedActorIds: readonly string[];
  readonly activeActorId: string | null;
}

export class ActorSelectionModel {
  constructor(initial?: ActorSelectionSnapshot);
  get snapshot(): ActorSelectionSnapshot;
  replace(ids: readonly string[], activeActorId?: string | null): ActorSelectionSnapshot;
  toggle(id: string): ActorSelectionSnapshot;
  add(ids: readonly string[]): ActorSelectionSnapshot;
  remove(ids: readonly string[]): ActorSelectionSnapshot;
  prune(existingIds: ReadonlySet<string>): ActorSelectionSnapshot;
}
```

Required semantics:

- selected ids are deduplicated in first-seen order;
- empty selection normalizes to `selectedActorIds: []`,
  `activeActorId: null`;
- if no active id is provided, replace chooses the last selected id;
- if active id is not selected, normalize deterministically to the last
  selected id, or `null` for empty selection;
- returned snapshots are cloned/frozen enough that callers cannot mutate model
  internals;
- equality and clone helpers should exist if they are needed by editor state
  registration. Do not duplicate normalization logic in editor.

### Editor Selection State

```ts
editorStatePaths.selection.snapshot
```

The value type is `ActorSelectionSnapshot`. The old
`editorStatePaths.selection.activeObject` is removed.

Editor selection state registration should live outside Hierarchy, for example:

```ts
createDefaultEditorSelectionState(...)
registerEditorSelectionParameters(store, initialState)
```

Required registration semantics:

- idempotent for the same store when this editor selection owner registered the
  path;
- fails clearly if another owner registered the snapshot path first;
- clones values on store read/write using the actor selection clone helper;
- validates snapshots through the actor selection model/helper;
- `set` and `reset` are the only required editor state operations in this gate.
  Do not add AppState `add`/delta complexity for future Ctrl/Shift multi-select
  unless this gate adds real command helpers and tests that consume it. The
  model may support `add/toggle/remove`; the app state path should stay
  `set/reset` unless a current caller proves otherwise.

### Selection Facade

```ts
import { Selection } from "editor";

Selection.snapshot;
Selection.activeActorId;
Selection.activeActor;
Selection.selectedActorIds;
Selection.selectedActors;
Selection.replace(actorOrId);
Selection.clear();
```

Required facade semantics:

- throws before provider install;
- single install only; double install fails;
- dispose restores uninstalled state;
- provider reads committed selection from the editor selection state path;
- provider resolves actors through `ActorSystemView`;
- provider accepts actor object or actor id for replace/clear helpers;
- provider submits commands through `EditorCommandSink`;
- provider does not mutate `AppStateParameterStore` directly;
- missing actor ids return `null` for `activeActor` and are omitted from
  `selectedActors`, without silently rewriting the selection snapshot.

## Step 0: Entry Gate

Before editing implementation:

1. Check current dirty work:

   ```text
   git status --short
   ```

2. Confirm Gate 0/Gate 1 and TreeView work are either committed or explicitly
   kept as separate dirty baselines. Do not mix this gate's selection migration
   with TreeView expand/collapse behavior, diagnostics migration, or foundation
   package creation in one review slice.

3. Run the current selection-adjacent baseline:

   ```text
   npm run test -w actor-system -- selection
   npm run test -w editor -- hierarchy
   npm run test -w wallpaper-tesseract -- architecture-boundaries
   ```

   `actor-system -- selection` may currently be no-op before this gate. That is
   acceptable only as the pre-implementation baseline.

Stop if the worktree contains unrelated changes in files this gate must edit and
their intent is unclear.

Checkpoint recommendation:

- Commit or explicitly stage-separate Gate 0 foundation, Gate 1 diagnostics, and
  TreeView expand/collapse baseline before starting implementation.
- This gate edits `actor-system`, `editor`, app composition, package/boundary
  tests, and browser smoke evidence; mixing it with prior dirty baselines will
  make review and rollback needlessly hard.

## Step 1: Add Pure Actor Selection Model

Create:

```text
packages/actor-system/src/core/selection/actor-selection-model.ts
packages/actor-system/src/core/selection/actor-selection-model.test.ts
packages/actor-system/src/core/selection/index.ts
```

Update:

```text
packages/actor-system/src/core/index.ts
```

Implementation requirements:

- model and helpers are pure TypeScript, no actor tree reads;
- no dependency on `foundation`, `editor`, `ui-framework`, runtime, DOM,
  `actor-system/input`, or `actor-system/gizmo`;
- all snapshot creation goes through one normalization helper;
- avoid a broad event emitter or observer API. This gate uses editor app state
  for change notification.

Tests:

- empty snapshot normalizes to empty set and null active id;
- duplicate ids are deduplicated while preserving first occurrence;
- replace without active chooses the last selected id;
- replace with missing active repairs to deterministic active id;
- toggle removes selected id and repairs active id;
- toggle adds missing id and makes it active;
- add appends only new ids;
- remove prunes ids and repairs active id;
- prune removes ids not in the existing-id set and repairs active id;
- caller mutation of input arrays does not mutate snapshots;
- caller mutation of returned snapshots does not mutate internal model state;
- invalid ids such as empty strings throw clearly.

Exit checks:

```text
npm run test -w actor-system -- selection
npm run typecheck -w actor-system
```

## Step 2: Move Selection State Ownership Into Editor

Create:

```text
packages/editor/src/selection/editor-selection-state.ts
packages/editor/src/selection/editor-selection-state.test.ts
packages/editor/src/selection/index.ts
```

Update:

```text
packages/editor/src/editor-state.ts
packages/editor/src/index.ts
```

Implementation requirements:

- add `editorStatePaths.selection.snapshot`;
- delete `editorStatePaths.selection.activeObject`;
- register selection snapshot state in `packages/editor/src/selection`, not
  Hierarchy;
- use actor-system selection helpers for validation, clone, equality, and
  default snapshot creation;
- keep the registration owner explicit with a WeakSet or equivalent so
  idempotent same-owner registration is possible but conflicting owners fail.

Tests:

- default editor selection state is an empty snapshot;
- initial snapshot is normalized;
- store returns cloned snapshots;
- store commit clones and normalizes snapshots;
- invalid snapshots fail validation;
- same-owner double registration is idempotent;
- external pre-registration of the snapshot path fails clearly;
- `selection.activeObject` no longer exists in `editorStatePaths`.

Exit checks:

```text
npm run test -w editor -- selection
npm run typecheck -w editor
```

## Step 3: Add Scoped Editor Selection Facade

Create:

```text
packages/editor/src/selection/selection-facade.ts
packages/editor/src/selection/selection-facade.test.ts
```

Update:

```text
packages/editor/src/selection/index.ts
packages/editor/src/index.ts
```

Implementation requirements:

- implement `Selection` through `foundation/facade`;
- expose a narrow install function, for example
  `installEditorSelectionProvider(...)`;
- do not export the raw facade slot;
- do not add fallback providers, provider stacks, or keyed provider registries;
- provider install takes explicit dependencies:
  `ActorSystemView`, `AppStateParameterStore`, and `EditorCommandSink` or an
  equivalent narrow object;
- provider reads committed snapshot from the selection state path;
- provider submits snapshot commands through `EditorCommandSink`;
- provider resolves `activeActor` / `selectedActors` through `ActorSystemView`;
- provider accepts `Actor`, actor id string, or null only where explicitly
  supported.

Tests:

- `Selection.snapshot`, `Selection.activeActorId`, `Selection.activeActor`,
  `Selection.selectedActorIds`, and `Selection.selectedActors` throw before
  provider install;
- install exposes committed snapshot;
- `replace(actor)` submits a normalized snapshot command;
- `replace(id)` submits a normalized snapshot command;
- `clear()` submits empty snapshot;
- selected actor resolution preserves snapshot order and skips missing actors;
- active actor resolution returns null for missing actor id;
- provider dispose restores uninstalled state;
- double install fails;
- stale dispose does not remove a newer provider if the facade slot ever
  supports reinstall after dispose.

Boundary update:

- Gate 0 currently restricts production `foundation/facade` use to diagnostics.
  Expand that rule to allow only:

  ```text
  packages/foundation/src/diagnostics/**
  packages/editor/src/selection/selection-facade.ts
  ```

Do not allow arbitrary editor modules to create facade slots.

Exit checks:

```text
npm run test -w editor -- selection
npm run test -w wallpaper-tesseract -- architecture-boundaries
```

## Step 4: Install Selection Provider In App Composition

Update:

```text
apps/wallpaper-tesseract/src/app/create-wallpaper-app.ts
```

Implementation requirements:

- call `registerEditorSelectionParameters(...)` once during app state setup;
- install the editor selection provider once after `ActorSystem`,
  `AppStateParameterStore`, and `frameStateBridge` exist;
- dispose the provider registration in app `dispose()`;
- if app creation fails after provider install, dispose the selection provider
  registration before the diagnostic provider registration and app shell cleanup;
- use local registration variables and explicit cleanup in `catch`. Do not
  introduce a generic app service container, provider registry, or lifecycle
  facade to manage two provider registrations;
- do not let app composition read or write selection internals directly beyond
  installing the owner/provider.

Tests:

- app initialization failure disposes the selection provider registration, just
  as Gate 1 did for diagnostics;
- app dispose unregisters the provider;
- double app creation while one app is live fails at provider install rather
  than silently sharing state, unless the first app is disposed.

Required cleanup ordering:

```text
try install diagnostics provider
try create app shell/runtime primitives
try install selection provider
try continue app initialization
catch:
  dispose selection provider if installed
  dispose diagnostic provider if installed
  dispose app shell if created
  rethrow
```

The exact code shape can differ if it stays explicit and local. The important
contract is that a failed app creation leaves neither facade provider installed.

Exit checks:

```text
npm run test -w wallpaper-tesseract -- create-wallpaper-app
npm run typecheck -w wallpaper-tesseract
```

## Step 5: Migrate Hierarchy To Selection Snapshot

Update:

```text
packages/editor/src/hierarchy/hierarchy-panel-state.ts
packages/editor/src/hierarchy/hierarchy-panel-state.test.ts
packages/editor/src/hierarchy/hierarchy-panel-component.ts
packages/editor/src/hierarchy/hierarchy-tree-item-actor-reconciler.ts
packages/editor/src/hierarchy/hierarchy-panel-actor-factory.test.ts
```

Implementation requirements:

- remove `activeObject` from `HierarchyPanelStateOptions` and
  `HierarchyPanelInitialState`;
- remove `registerSelectionParameter(...)` from Hierarchy state;
- `registerHierarchyPanelParameters(...)` registers only hierarchy window
  parameters;
- `HierarchyPanelComponent` listens to
  `editorStatePaths.selection.snapshot`;
- `HierarchyPanelComponent` submits replace-selection snapshot commands on
  `TreeViewActivation`;
- `HierarchyTreeItemActorReconciler` receives the selected id set or selection
  snapshot and sets `TreeViewItemDescriptor.selected` from
  `selectedActorIds.includes(item.id)`;
- do not add multi-select UI gestures in this step;
- TreeView disclosure expand/collapse must not submit selection commands.

Tests:

- hierarchy state no longer registers selection;
- hierarchy activation submits a snapshot with
  `selectedActorIds: [itemId]` and `activeActorId: itemId`;
- hierarchy renders selected row from selection snapshot;
- selection changes from state observer rerender rows;
- expand/collapse disclosure does not change selection;
- hierarchy item actors do not become selection model facts;
- old active-object tests are replaced, not kept as compatibility tests.

Exit checks:

```text
npm run test -w editor -- hierarchy selection
npm run typecheck -w editor
```

## Step 6: Boundary And Old-Fact Cleanup

Update:

```text
apps/wallpaper-tesseract/src/architecture-boundaries.test.ts
apps/wallpaper-tesseract/src/test-support/package-graph-boundaries.ts
docs/current-project-progress.md
docs/editor-selection-and-inspector-plan.md
```

Boundary requirements:

- `actor-system/core/selection` has no forbidden imports;
- `actor-system/input` and `actor-system/gizmo` do not import selection unless a
  later reviewed plan proves a need;
- `ui-framework` has no selection imports;
- `Selection` facade is exported from `editor`, not from `actor-system`;
- production `foundation/facade` creation is allowed only in foundation
  diagnostics and editor selection facade;
- production calls to `installEditorSelectionProvider(...)` are allowed only in
  app composition or a reviewed editor-runtime bootstrap file. Feature modules,
  Hierarchy, Inspector, and tests may not become provider installers;
- `selection.activeObject` and old selection-path `activeObject` do not appear
  in production source. Use the existing production source filter instead of a
  raw repository-wide text check for boundary tests;
- Hierarchy state does not register selection;
- app composition installs selection provider exactly once.

Grep gates:

```text
rg -n "selection\\.activeObject" packages/editor/src apps/wallpaper-tesseract/src
rg -n "\\bactiveObject\\b" packages/editor/src apps/wallpaper-tesseract/src
rg -n "createFacadeSlot" packages/editor/src packages/actor-system/src packages/ui-framework/src apps/wallpaper-tesseract/src
rg -n "foundation/facade" packages/editor/src packages/actor-system/src packages/ui-framework/src apps/wallpaper-tesseract/src
rg -n "installEditorSelectionProvider" packages/editor/src apps/wallpaper-tesseract/src
```

Allowed hits after migration:

- `packages/editor/src/selection/selection-facade.ts`;
- app composition call site for `installEditorSelectionProvider(...)`;
- tests asserting old active-object removal;
- historical docs, if clearly marked as historical.

Boundary tests should enforce production-source 0 hits for
`selection.activeObject` and old active-object state ownership. Raw `rg` is only
an execution aid because `activeObject` is a common phrase in comments and
historical docs.

## Step 7: Validation

Targeted validation:

```text
npm run test -w actor-system -- selection
npm run test -w editor -- selection hierarchy
npm run test -w wallpaper-tesseract -- create-wallpaper-app architecture-boundaries
npm run typecheck -w actor-system
npm run typecheck -w editor
npm run typecheck -w wallpaper-tesseract
```

Root validation before handoff:

```text
npm run test
npm run typecheck
npm run build
git diff --check
```

Browser smoke is required because this gate changes real Hierarchy selection
behavior:

```text
npm run prism:smoke:prepare
npm run dev -w wallpaper-tesseract
```

Smoke coverage:

- page loads with console errors 0;
- Hierarchy opens and shows actor rows;
- clicking a normal row such as `Scene View` or `Camera3` selects that row;
- selected row remains selected after one frame/update;
- clicking a different row replaces the selected set;
- disclosure expand/collapse does not change selection;
- Debug diagnostics still appear after pointer input, proving Gate 1 path still
  works after app composition changed provider setup.

Store smoke data/report under `temp/` if a script is used. Do not add product UI
or compatibility hooks only for this smoke.

## Exit Criteria

Gate 2 is complete only when:

- `selection.activeObject` is deleted from production state paths;
- selection snapshot is the only editor selection state fact;
- actor selection model tests pass;
- editor selection facade tests pass;
- Hierarchy registration no longer owns selection;
- Hierarchy activation writes snapshot selection;
- app composition installs and disposes one selection provider;
- boundary tests lock the new dependency/facade rules;
- browser smoke proves real Hierarchy selection still works;
- root `test/typecheck/build` pass.

## Stop Conditions

Stop and amend the plan before continuing if:

- `actor-system/core/selection` needs `foundation`, `editor`, DOM, UI,
  runtime, input, or gizmo imports;
- supporting multiple simultaneous editor runtimes becomes necessary;
- `Selection` facade needs fallback providers, keyed registries, or service
  locator behavior;
- Hierarchy cannot be migrated without keeping `selection.activeObject`;
- AppStateParameterStore cannot safely clone/validate selection snapshots;
- Inspector work becomes necessary to make the selection migration compile.
