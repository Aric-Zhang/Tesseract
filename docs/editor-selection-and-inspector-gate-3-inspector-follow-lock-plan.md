# Gate 3: Inspector Follow And Lock Plan

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
docs/editor-selection-and-inspector-gate-2-selection-model-editor-ownership-plan.md
```

## Goal

Make Inspector views follow the editor selection snapshot introduced in Gate 2,
while supporting per-Inspector lock state.

After this gate:

- Inspector content is mounted through `UiElementComponent`, not a self-created
  DOM root;
- Inspector reads editor selection from `editorStatePaths.selection.snapshot`;
- unlocked Inspectors follow `selection.snapshot.activeActorId`;
- locked Inspectors keep their current inspected actor id when selection
  changes;
- Inspector displays the inspected actor name/id, no selection, or a missing
  actor message;
- Inspector does not read Hierarchy internals and does not reintroduce
  `selection.activeObject`;
- no visible lock control is required yet. Lock state is component-owned and
  testable through component methods/options. A later generic toolbar/button
  gate may add visible controls through actor input.

This is a product-visible slice for follow behavior, but it is still not the
full Inspector details UI. It deliberately avoids adding property editors,
component inspectors, persistence for pinned inspectors, or multi-selection
property merging.

## Current Facts

- Gate 2 completed the selection owner move:
  - `actor-system/core/selection` owns `ActorSelectionSnapshot`;
  - `packages/editor/src/selection` owns editor selection state/facade;
  - app composition installs one `Selection` provider;
  - Hierarchy row activation writes `selection.snapshot`;
  - production `selection.activeObject` is deleted.
- Current Inspector implementation is still old-shape:
  - `InspectorContentComponent` creates its own `div`;
  - it registers that self-created root with `WindowContentRegistrationPort`;
  - it only writes a static label;
  - it has no state observer binding and no selection awareness.
- Hierarchy and Debug already show the desired Arbor pattern:
  - actor factory adds `UiElementComponent`;
  - content component receives the same actor's `UiElementComponent`;
  - content component registers `uiElement.element` as window content.
- `StateObserverBindingComponent` already exists and can deliver editor state
  changes to components implementing `StateObserverResponder`.

## Non-Negotiables

- Do not restore `selection.activeObject`.
- Do not create Inspector-private selection state separate from
  `selection.snapshot`.
- Do not make Inspector read Hierarchy state, Hierarchy actors, TreeView rows,
  or TreeView DOM.
- Do not use DOM click handlers or direct DOM mutation shortcuts for lock UI.
- Do not add a visible lock control unless it routes through generic Arbor
  control/actor-input ownership. This gate should prefer no visible control.
- Do not use the global `Selection` facade inside Inspector components. The
  component should receive explicit editor state through a narrow selection
  source/state observer path so it stays testable and scoped.
- Do not introduce a service locator, keyed provider registry, or app-level
  Inspector manager.
- Do not persist Inspector lock/inspected actor state in this gate.
- Do not expand app composition beyond passing a narrow selection snapshot
  source into the Inspector feature.

## Target Design

### Display Source

Add a small editor-owned display source:

```ts
export interface InspectorActorDisplaySource {
  getActorDisplayName(actorId: string): string | null;
}

export function createActorSystemInspectorActorDisplaySource(
  actorSystem: ActorSystemView
): InspectorActorDisplaySource;
```

Rules:

- The implementation wraps `ActorSystemView`.
- Actor name is the display name; missing actor returns `null`.
- This source does not expose actor mutation, component inspection, hierarchy
  metadata, or app-local facts.

### Selection Source

Add a narrow source for initial state reads:

```ts
export interface InspectorSelectionSnapshotSource {
  getSelectionSnapshot(): ActorSelectionSnapshot;
}
```

Rules:

- App composition may create this source from `AppStateParameterStore`.
- Inspector also receives state changes through `StateObserverResponder`.
- The source is only for initial/catch-up reads such as construction and
  unlock. It must not become a second selection owner.

### Inspector Component State

`InspectorContentComponent` owns only its local presentation state:

```ts
inspectedActorId: string | null;
locked: boolean;
```

Behavior:

- On construction:
  - if `initialLocked` is true, inspect `initialInspectedActorId` when provided;
  - if `initialLocked` is true and no `initialInspectedActorId` is provided,
    inspect `selectionSource.getSelectionSnapshot().activeActorId`;
  - if `initialLocked` is false or omitted, ignore `initialInspectedActorId`
    and inspect `selectionSource.getSelectionSnapshot().activeActorId`;
  - a provided `initialInspectedActorId` is therefore only meaningful for an
    initially locked Inspector. Unlocked Inspectors must never show a stale
    initial id until the next selection change.
- On `selection.snapshot` change:
  - unlocked Inspector updates `inspectedActorId` to the new active actor id;
  - locked Inspector keeps the old inspected id.
- On `setLocked(false)`:
  - Inspector immediately catches up to current active selection.
- On `setLocked(true)`:
  - Inspector keeps the current inspected id until unlocked.
- On missing actor id:
  - keep `inspectedActorId`;
  - display a deterministic missing message.

Display text:

```text
No actor selected
Inspecting: <actor name>
Missing actor: <actor id>
```

The first implementation only needs text content and diagnostic dataset fields.
Do not add property rows, component lists, or editable controls.

### DOM Ownership

`InspectorContentComponent` must use the same-actor `UiElementComponent`:

- factory adds `UiElementComponent` with `className: "inspector-window__content"`;
- definition requires `uiElementComponentType`;
- component registers `uiElement.element` as window content;
- component no longer creates a DOM root and no longer accepts `document`.

This deletes the old dual-root risk and aligns Inspector with Hierarchy/Debug.

## Step 0: Entry Gate

1. Confirm Gate 2 is complete and no new blocker is recorded:

   ```text
   npm run test -w actor-system -- selection
   npm run test -w editor -- selection hierarchy
   npm run test -w wallpaper-tesseract -- architecture-boundaries
   ```

2. Confirm old selection path remains deleted:

   ```text
   rg -n "selection\\.activeObject" packages/editor/src apps/wallpaper-tesseract/src
   rg -n "\\bactiveObject\\b" packages/editor/src apps/wallpaper-tesseract/src
   ```

   Allowed hits are tests/boundaries explicitly asserting the old path is gone.

3. Keep current dirty baselines separate. Do not mix unrelated TreeView,
   diagnostics, or package-graph work into this gate's implementation commits.

## Step 1: Add Inspector Display And Selection Ports

Files:

```text
packages/editor/src/inspector/inspector-actor-display-source.ts
packages/editor/src/inspector/inspector-selection-source.ts
packages/editor/src/inspector/index.ts
```

Implement:

- `InspectorActorDisplaySource`;
- `createActorSystemInspectorActorDisplaySource(...)`;
- `InspectorSelectionSnapshotSource`;
- exports from `packages/editor/src/inspector/index.ts`.

Tests:

```text
packages/editor/src/inspector/inspector-actor-display-source.test.ts
```

Test cases:

- existing actor id returns actor name;
- missing actor id returns `null`;
- source does not expose mutable Actor or ActorSystem internals.

Validation:

```text
npm run test -w editor -- inspector
```

## Step 2: Move Inspector Content Onto UiElement

Files:

```text
packages/editor/src/inspector/inspector-content-component.ts
packages/editor/src/inspector/inspector-content-definition.ts
packages/editor/src/inspector/inspector-view-actor-factory.ts
packages/editor/src/inspector/inspector.css
```

Implementation changes:

- remove `document` and `label` as DOM root creation inputs from
  `InspectorContentComponentOptions`;
- require same-actor `UiElementComponent`;
- `InspectorContentComponent` constructor receives:
  - `UiElementComponent`;
  - `InspectorActorDisplaySource`;
  - `InspectorSelectionSnapshotSource`;
  - `contentId`;
  - `contentRegistration`;
  - optional `initialLocked`;
  - optional `initialInspectedActorId`;
- register `uiElement.element` as window content;
- remove all `document.createElement(...)` from Inspector production code;
- render the first text state during construction.

Definition changes:

- add `requires: [{ type: uiElementComponentType, autoAdd: false, reuseExisting: true }, { type: stateObserverBindingComponentType }]`;
- create should fail clearly if `UiElementComponent` is missing;
- create should fail clearly if display source, selection source, content id, or
  content registration are missing.

Factory changes:

- add `UiElementComponent` before adding Inspector content;
- pass `createActorSystemInspectorActorDisplaySource(context.actorSystem)`;
- pass `selectionSource` from `InspectorViewActorOptions`;
- keep runtime tracking/disposal shape.

CSS:

- keep only Inspector content styles needed by the UiElement root;
- remove selectors that assume a self-created nested root if any exist.

Tests:

```text
packages/editor/src/inspector/inspector-content-component.test.ts
packages/editor/src/inspector/inspector-view-actor-factory.test.ts
```

Test cases:

- component registers `UiElementComponent.element` as window content;
- component does not call `document.createElement`;
- missing `UiElementComponent` fails through definition requirements;
- initial no-selection renders `No actor selected`;
- initial active actor renders `Inspecting: <name>`;
- unlocked construction ignores `initialInspectedActorId` and follows current
  selection immediately;
- locked construction uses `initialInspectedActorId` when provided;
- initial missing inspected id renders `Missing actor: <id>`;
- dispose unregisters window content and disables component.

Validation:

```text
npm run test -w editor -- inspector
```

## Step 3: Add Follow/Lock Behavior

Files:

```text
packages/editor/src/inspector/inspector-content-component.ts
packages/editor/src/inspector/inspector-content-component.test.ts
```

Implementation:

- implement `StateObserverResponder`;
- implement `onStateChanged(event)` and respond only to
  `editorStatePaths.selection.snapshot`;
- add component methods:

  ```ts
  get inspectedActorId(): string | null;
  get locked(): boolean;
  setLocked(locked: boolean): void;
  inspectActor(actorId: string | null): void;
  ```

- `setLocked(false)` catches up to `selectionSource.getSelectionSnapshot()`;
- `inspectActor(...)` sets the inspected actor id and rerenders, but does not
  mutate editor selection;
- methods are component-level control hooks for tests/future generic controls,
  not a global facade and not a DOM shortcut.

Tests:

- unlocked component follows selection snapshot changes;
- locked component ignores selection changes;
- unlocking catches up to current active selection;
- two inspector components can diverge when one is locked. Use a concrete
  scenario: Inspector A starts locked on Scene, Inspector B remains unlocked;
  after selecting Camera3, A still displays Scene and B displays Camera3;
- multi-selection inspects `activeActorId`, not the first selected id;
- missing active actor id displays the missing-state message;
- unrelated state changes do not rerender or alter inspected actor;
- component does not import Hierarchy internals.

Validation:

```text
npm run test -w editor -- inspector selection hierarchy
```

## Step 4: Wire Inspector Feature And App Composition

Files:

```text
packages/editor/src/inspector/install-inspector-feature.ts
packages/editor/src/inspector/inspector-view-actor-factory.ts
packages/editor/src/inspector/index.ts
apps/wallpaper-tesseract/src/app/create-wallpaper-app.ts
apps/wallpaper-tesseract/src/app/create-wallpaper-app.test.ts
```

Implementation:

- extend `InstallInspectorFeatureOptions` with:

  ```ts
  readonly selectionSource: InspectorSelectionSnapshotSource;
  ```

- extend `InspectorViewActorOptions` with the same source;
- app composition passes a narrow source:

  ```ts
  const editorSelectionSnapshotSource = {
    getSelectionSnapshot: () => appStateStore.get(editorStatePaths.selection.snapshot)
  };
  ```

- pass the source into `installInspectorFeature(...)`;
- do not pass the whole `AppStateParameterStore` to Inspector feature;
- do not install another `Selection` provider;
- do not introduce an Inspector manager service.

Tests:

- app composition can create app with selection source wired;
- app creation failure still disposes diagnostics and selection providers;
- `installInspectorFeature(...)` requires explicit selection source;
- Inspector feature creation passes the same source to both default Inspector
  instances.

Validation:

```text
npm run test -w editor -- inspector
npm run test -w wallpaper-tesseract -- create-wallpaper-app
```

## Step 5: Boundary Tests And Deletion Gates

Files:

```text
apps/wallpaper-tesseract/src/architecture-boundaries.test.ts
docs/current-project-progress.md
docs/editor-selection-and-inspector-plan.md
```

Boundary additions:

- `packages/editor/src/inspector` must not import Hierarchy internals;
- Inspector content production code must not call `document.createElement` or
  create its own content root;
- Inspector content definition must require `uiElementComponentType` and
  `stateObserverBindingComponentType`;
- Inspector content must read `editorStatePaths.selection.snapshot`;
- Inspector content must not read `selection.activeObject` or `Selection`
  facade directly;
- `ui-framework` must remain free of editor selection/Inspector policy imports;
- app composition is the only production caller passing the Inspector selection
  source;
- no DOM `click`/`.onclick` shortcut is introduced in Inspector production code.

Grep gates:

```text
rg -n "createElement\\(" packages/editor/src/inspector --glob "!*.test.ts"
rg -n "selection\\.activeObject|\\bactiveObject\\b" packages/editor/src apps/wallpaper-tesseract/src
rg -n "from .*hierarchy|\\.\\./hierarchy" packages/editor/src/inspector --glob "!*.test.ts"
rg -n "import \\{[^}]*\\bSelection\\b|\\bSelection\\." packages/editor/src/inspector --glob "!*.test.ts"
rg -n "addEventListener\\s*\\(\\s*[\"']click[\"']|\\.onclick\\s*=" packages/editor/src/inspector
```

Allowed hits:

- tests may mention old paths only to assert removal;
- `createElement` should not appear in Inspector production code after Step 2;
- `InspectorSelectionSnapshotSource` and `ActorSelectionSnapshot` names are not
  violations. Only importing/using the `Selection` facade value from Inspector
  production code is forbidden.

Documentation:

- mark Gate 3 plan status as `completed` after validation;
- update `docs/current-project-progress.md` to say Inspector follow/lock first
  slice is complete;
- keep visible lock UI and property details as explicit follow-ups, not hidden
  incomplete work.

Validation:

```text
npm run test -w wallpaper-tesseract -- architecture-boundaries
```

## Step 6: Browser Smoke

Browser smoke is required because this gate changes visible Inspector behavior.

Preparation:

```text
npm run prism:smoke:prepare
npm run dev -w wallpaper-tesseract
```

Create a temporary smoke script under `temp/`, for example:

```text
temp/run-editor-gate-3-inspector-follow-smoke.mjs
```

Smoke coverage:

- console errors are 0;
- app boots with both default Inspectors visible;
- initial Inspector state is deterministic;
- clicking `Scene View` in Hierarchy selects it;
- an unlocked Inspector displays `Inspecting: Scene View`;
- clicking `Camera3` in Hierarchy updates the unlocked Inspector to
  `Inspecting: Camera3`;
- Debug diagnostics still appear after pointer input, proving Gate 1 was not
  regressed;
- Hierarchy disclosure expand/collapse still does not change selection.

Lock coverage:

- Component-level tests are the source of truth for lock semantics in this
  gate because no visible lock control exists yet.
- Browser smoke may omit lock toggling unless a proper actor-input lock control
  is implemented in this same gate.

Evidence:

```text
temp/editor-gate-3-inspector-follow-smoke-data.json
temp/editor-gate-3-inspector-follow-smoke-report.md
```

## Step 7: Final Validation

Run targeted checks:

```text
npm run test -w foundation
npm run test -w actor-system -- selection
npm run test -w editor -- selection hierarchy inspector debug
npm run test -w wallpaper-tesseract -- create-wallpaper-app architecture-boundaries
npm run typecheck -w foundation
npm run typecheck -w actor-system
npm run typecheck -w editor
npm run typecheck -w wallpaper-tesseract
npm run build -w foundation
npm run build -w actor-system
npm run build -w editor
npm run build -w wallpaper-tesseract
git diff --check
```

Then run root checks:

```text
npm run test
npm run typecheck
npm run build
```

`npm run build` may still show the existing Vite chunk-size warning. That is
not part of this gate unless new chunk warnings or build errors appear.

## Exit Criteria

Gate 3 is complete only when:

- Inspector content uses `UiElementComponent` for its content root;
- old Inspector self-created DOM root is deleted;
- Inspector follows `selection.snapshot.activeActorId` when unlocked;
- Inspector can stay locked to its current inspected actor id;
- unlocking catches up to current selection;
- missing actor id renders a deterministic missing state;
- no Inspector code reads Hierarchy internals;
- no Inspector code reads `selection.activeObject`;
- no visible lock UI is added through DOM click shortcuts;
- browser smoke proves real Hierarchy selection updates visible Inspector text;
- targeted and root validation pass.

## Stop Conditions

Stop and revise this plan if:

- Inspector follow requires app-local feature knowledge or Hierarchy internals;
- Inspector lock state requires persistent app state in this gate;
- visible lock control cannot be implemented without direct DOM click
  shortcuts;
- Inspector needs a broad manager/service locator to coordinate instances;
- component tests cannot prove two Inspector instances diverge when one is
  locked;
- app composition would need to pass the whole `AppStateParameterStore` instead
  of a narrow selection source.

## Deferred Follow-Ups

Do not implement these in Gate 3:

- visible lock toolbar/button;
- Inspector property rows;
- component-specific inspectors;
- edit controls;
- multi-selection property merging;
- selection range/Ctrl-toggle UI;
- persistent pinned Inspector state;
- scene object picking selection.
