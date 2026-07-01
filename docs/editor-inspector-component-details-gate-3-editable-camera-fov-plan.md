# Editor Inspector Component Details Gate 3: Editable Camera FOV Plan

Status: completed

Last updated: 2026-07-01

## Purpose

Make the first Inspector property truly editable without breaking the current
ownership model.

Gate 3 target:

- edit Camera3 FOV from Inspector;
- route the edit through a reusable UI field, an editor-owned property edit
  controller, and the runtime camera command surface;
- prove multi-Inspector synchronization through frame refresh;
- keep descriptor ownership and product/runtime dependencies in the same shape
  established by Gate 2.

This gate should be the first real proof of:

```text
generic UI control -> editor property edit controller -> descriptor apply path -> runtime command -> frame refresh
```

## Parent Plan

This gate belongs to:

```text
docs/editor-inspector-component-details-plan.md
```

Prerequisites:

```text
docs/editor-inspector-component-details-gate-0-interaction-contract-plan.md
docs/editor-inspector-component-details-gate-1-component-sections-plan.md
docs/editor-inspector-component-details-gate-2-read-only-properties-plan.md
```

Gate 2 must be complete: Inspector component sections render read-only property
rows from a required editor-owned descriptor registry, and wallpaper runtime
descriptors are installed only through app-local code.

## Current Facts

- `ui-framework/controls` has Button, ToggleButton, Toolbar, Tree/List/
  VirtualList, ScrollView, RenderViewport, and Fullscreen controls.
- There is no generic field control yet.
- Inspector body currently renders private non-input section/property DOM.
- Inspector body is a frame-update participant with a render signature guard.
- `InspectorComponentDescriptorRegistry` is editor-owned and explicitly passed
  into Inspector feature setup.
- App-local wallpaper descriptors can import both `editor` descriptor APIs and
  `wallpaper-runtime` component types.
- `Camera3MotionComponent` exposes `readViewState()` and implements
  `RuntimeCameraCommandSink`.
- `RuntimeCameraControlCommand` currently supports orbit drag, snap axis, and
  projection mode commands, but not FOV edits.
- `RuntimeThreeCameraMotionController` already queues runtime camera commands
  and applies them on frame update.
- Hierarchy item actors are filtered out of `ActorHierarchyObjectSource`;
  Inspector property control actors will need the same presentation-actor
  exclusion.

## Non-Goals

- Do not add broad reflection over Component object fields.
- Do not add editable properties other than Camera3 FOV.
- Do not edit Three camera state directly from Editor or app-local descriptor
  code.
- Do not make `packages/editor` import `wallpaper-runtime`.
- Do not add `FrameCommandBatch`, OnGUI, or any actor-system UI hook.
- Do not move docking/window graph transactions into the Inspector property
  edit controller.
- Do not add Inspector-private `<input>` DOM or DOM input shortcuts.
- Do not create a global property edit facade or service locator.
- Do not preserve a parallel read-only property path once a property becomes
  editable; the descriptor summary should describe both display and edit
  capability.

## Architecture Decisions

### Generic NumberField Control

Add a reusable number field to `ui-framework/controls`.

The NumberField may use native DOM `input` events internally because text entry
is a native field behavior, but that behavior belongs to the generic
`NumberFieldComponent`, not to Inspector. Inspector production code must still
not create `input`, `textarea`, or `select` elements directly.

The first version should be deliberately narrow:

- fixed numeric value;
- optional `min`, `max`, `step`;
- disabled/readonly state;
- invalid input state;
- commit on Enter, blur, and explicit change;
- Escape restores the last committed value;
- no spinner customization;
- no localization/formatting plugin;
- no product/editor-specific terms.

The field emits a commit intent to a sink. It does not know Component ids,
Camera3, Inspector descriptors, or runtime commands.

NumberField must also participate in actor-input routing. It may rely on the
native input for text editing once focused, but it must still implement
`ActorInputParticipant` or an equivalent control hit route that returns a
`content-control` hit. This keeps pointer ownership on the same path as
Button/Toggle and prevents window drag, dock preview, tab actions, or parent
controls from stealing clicks inside the field.

### Editable Descriptor Contract

Extend the Inspector descriptor model with explicit editable property metadata.

The descriptor remains editor-owned and generic, but concrete edit behavior is
provided by descriptor contributions:

- Editor descriptors may edit editor-owned components.
- Wallpaper descriptors may edit wallpaper-runtime components from app-local
  code.

Suggested shape:

```ts
export interface InspectorPropertySummary {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly kind: InspectorPropertyKind;
  readonly edit?: InspectorPropertyEditSummary;
}

export interface InspectorPropertyEditSummary {
  readonly control: "number";
  readonly value: number;
  readonly min?: number;
  readonly max?: number;
  readonly step?: number;
  readonly disabled?: boolean;
}

export interface InspectorPropertyEditRequest {
  readonly actorId: string;
  readonly componentId: string;
  readonly componentType: string;
  readonly propertyId: string;
  readonly value: number;
  readonly timeStamp: number;
  readonly source: string;
}

export interface InspectorComponentDescriptor<TComponent = unknown> {
  readonly componentType: string;
  readonly displayName?: string;
  readProperties(component: TComponent, context: InspectorPropertyReadContext): readonly InspectorPropertySummary[];
  applyEdit?(
    component: TComponent,
    request: InspectorPropertyEditRequest,
    context: InspectorPropertyReadContext
  ): InspectorPropertyEditResult;
}
```

The exact type names may change during implementation, but the ownership must
not: `InspectorContentComponent` consumes summaries, the edit controller uses
the descriptor apply path, and app-local descriptors own product-specific
runtime commands.

For Camera3 FOV, runtime camera command ownership is the only legality fact.
Descriptors may expose the same runtime-owned constraints to the UI and may do
non-authoritative pre-checks to produce useful user feedback, but they must not
define a separate FOV range or semantics. If descriptor and runtime disagree,
the runtime command owner wins and the descriptor must be fixed.

### Property Edit Controller

Add one editor-owned `InspectorPropertyEditController` instance per app/editor
runtime.

Owner and lifecycle:

- lives under `packages/editor/src/inspector`;
- implements `UiScheduledService` or another existing UI-frame service
  contract, not an actor-system hook;
- is created by app/editor composition and injected into all Inspector views;
- is disposed by app/editor composition;
- no module-level singleton, no facade, no provider stack.

Responsibilities:

- receive field commit intents;
- queue edits by `(actorId, componentId, propertyId)`;
- merge multiple edits in the same frame by keeping the last valid edit for
  that key;
- resolve the live component through a narrow editor target source;
- call the matching descriptor `applyEdit` from the same
  `InspectorComponentDescriptorRegistry` used for read summaries;
- expose a revision or committed event that Inspector can use for refresh
  tests if needed.

The controller must receive the Gate 2 descriptor registry in its constructor.
It must not create a second registry, hold an app-local descriptor side table,
or bypass the registry to locate edit handlers.

The controller does not validate Camera3 semantics itself. Runtime camera
command contracts own Camera3 FOV legality. Descriptor apply logic should
submit commands and translate runtime rejection into a failed edit result; it
should not invent another authoritative range.

Missing actor/component/descriptor during apply should drop the queued edit
deterministically without throwing during frame update. Tests must lock this
behavior.

### Property Control Actors

Editable fields are real UI controls, so they should be actor-backed controls.

Add an Inspector-owned reconciler similar in spirit to
`HierarchyTreeItemActorReconciler`:

```text
Inspector body actor
  private section/property DOM owned by InspectorContentComponent
  property control child actor(s) owned by InspectorPropertyControlActorReconciler
```

Rules:

- stable actor ids based on `(inspector body actor id, actorId, componentId,
  propertyId)`;
- property control actors are children of the Inspector body actor;
- the reconciler creates/destroys controls through `ActorCreationContext` and
  `ComponentRegistry`;
- the NumberField component owns its input DOM;
- `InspectorContentComponent` may rehost the NumberField actor's
  `UiElementComponent.element` into the property row slot;
- the reconciler is the only owner that creates, updates, and destroys property
  control actors;
- `InspectorContentComponent` only renders slots and rehosts already-declared
  control elements; it must not create control actors or own NumberField
  lifecycle;
- Inspector body must not create input DOM directly;
- stale property control actors are destroyed when the inspected actor changes,
  the component disappears, the descriptor removes edit capability, or the
  Inspector is disposed.

Add a stable helper such as:

```ts
isInspectorPropertyControlActorId(actorId: string): boolean
```

and update Hierarchy object source installation to exclude these presentation
actors. This avoids a recursive "Inspector shows its own controls" loop.

### Runtime FOV Command

FOV editing must go through runtime command ownership.

Required path:

```text
Inspector NumberField
  -> InspectorPropertyEditController
  -> app-local Camera3 descriptor applyEdit
  -> Camera3MotionComponent.submit({ type: "set-projection-fov", ... })
  -> RuntimeThreeCameraMotionController.updateFrame(...)
  -> RuntimeThreeOrbitCamera state/backend update
  -> Inspector frame refresh reads new FOV
```

Do not let the descriptor mutate Three camera objects or private runtime state.

### Dirty Field Synchronization

When a user is actively editing a field:

- the field may keep a local draft string;
- frame refresh should not overwrite that draft while it is dirty/focused;
- Escape cancels the draft and restores the last committed value;
- after commit, the next frame refresh should display the committed runtime
  value;
- another Inspector viewing the same property should update after the runtime
  command applies.

This belongs to `NumberFieldComponent` and the Inspector property control
adapter, not to app-local runtime descriptor code.

## Step 0: Entry Gate

1. Confirm Gate 2 remains green:

```powershell
npm run test -w editor -- inspector
npm run test -w wallpaper-tesseract -- create-wallpaper-app architecture-boundaries
npm run typecheck -w editor
npm run typecheck -w wallpaper-tesseract
```

2. Confirm no no-op editor descriptor installer has returned:

```powershell
rg -n "installEditorInspectorComponentDescriptors" apps packages -g "*.ts"
```

Expected: no matches.

3. Read the current owners before editing:

```text
packages/ui-framework/src/ui/button/button-component.ts
packages/ui-framework/src/ui/button/toggle-button-component.ts
packages/editor/src/inspector/inspector-component-descriptor.ts
packages/editor/src/inspector/inspector-content-component.ts
packages/editor/src/inspector/inspector-view-actor-factory.ts
packages/editor/src/hierarchy/hierarchy-tree-item-actor-reconciler.ts
packages/runtime-core/src/runtime-camera-control.ts
packages/runtime-three/src/runtime-three-camera-motion-controller.ts
packages/runtime-three/src/runtime-three-orbit-camera.ts
apps/wallpaper-tesseract/src/features/inspector/install-wallpaper-inspector-descriptors.ts
apps/wallpaper-tesseract/src/app/create-wallpaper-app.ts
```

Stop if Gate 2 old/fallback paths have reappeared.

## Step 1: Add Generic NumberField

Add a generic number field control under `ui-framework/controls`.

Suggested files:

```text
packages/ui-framework/src/ui/field/number-field-model.ts
packages/ui-framework/src/ui/field/number-field-component.ts
packages/ui-framework/src/ui/field/number-field-definition.ts
packages/ui-framework/src/ui/field/index.ts
```

Update:

```text
packages/ui-framework/src/controls/index.ts
packages/ui-framework/src/controls/install-component-definitions.ts
packages/ui-framework/src/ui/ui-framework-controls.css
```

Required behavior:

- requires same-actor `UiElementComponent`;
- creates and owns native number input DOM internally;
- writes stable diagnostics:
  - `data-ui-number-field`;
  - `data-ui-number-field-id`;
  - `data-ui-number-field-invalid`;
- supports `setDescriptor(...)` and `setValue(...)`;
- supports `disabled` / readonly state;
- emits commit intent only for valid finite numbers;
- Enter commits;
- blur/change commits the current valid draft;
- Escape cancels draft;
- dispose removes listeners and restores DOM state it owns;
- no Inspector, runtime, Camera, Tesseract, window, dock, or app terms.

Tests:

```text
packages/ui-framework/src/ui/field/number-field-component.test.ts
```

Cover:

- initial value rendering;
- min/max/step attributes;
- invalid draft does not emit commit;
- Enter/blur commit valid values once;
- Escape restores committed value;
- disabled field ignores commit;
- `setValue` updates display when not dirty;
- focused dirty field is not stomped by external `setValue`;
- dispose removes listeners and owned state;
- component definition dependency on `UiElementComponent`;
- `ui-framework/controls` exports the public NumberField API.

## Step 2: Add Runtime FOV Command

Extend runtime camera command contracts.

Update:

```text
packages/runtime-core/src/runtime-camera-control.ts
packages/runtime-three/src/runtime-three-orbit-camera.ts
packages/runtime-three/src/runtime-three-camera-motion-controller.ts
```

Required command:

```ts
interface RuntimeCameraSetProjectionFovCommand {
  type: "set-projection-fov";
  source: RuntimeCameraControlSource;
  fov: number;
}
```

Implementation rules:

- runtime camera command owner is the single source of FOV legality;
- expose the runtime-owned FOV constraints from runtime-core or runtime-three
  in a way descriptors can reuse without redefining them;
- validate finite FOV and reject values outside the runtime-owned constraint;
- preserve current projection mode;
- update `RuntimeCameraState.projection.fov`;
- recompute orthographic height when projection has viewport/distance data;
- notify observers only when state changes;
- no editor/UI/app imports.

Tests:

```text
packages/runtime-three/src/runtime-three-camera-motion-controller.test.ts
packages/runtime-three/src/runtime-three-orbit-camera.test.ts
```

Cover:

- queued FOV command applies on frame update;
- last queued FOV command wins when multiple commands are queued before frame;
- no notification when FOV is unchanged;
- invalid FOV throws at submit/validation boundary;
- orthographic projection state remains internally consistent.

## Step 3: Extend Inspector Descriptor/Edit Contracts

Update:

```text
packages/editor/src/inspector/inspector-component-descriptor.ts
packages/editor/src/inspector/inspector-actor-details-source.ts
packages/editor/src/inspector/inspector-actor-details-source.test.ts
```

Required behavior:

- `InspectorPropertySummary` can describe optional edit metadata;
- summary cloning freezes edit metadata as well as id/label/value/kind;
- details source remains immutable and still contains no live Component refs;
- descriptor read errors still produce deterministic error rows;
- no descriptor order field;
- no app/runtime/product imports.

Tests:

- editable metadata appears in property summary;
- external mutation of edit metadata does not mutate snapshot;
- read-only property rows remain supported;
- descriptor error row remains read-only and non-editable.

## Step 4: Add Inspector Property Edit Controller

Add:

```text
packages/editor/src/inspector/inspector-property-edit-controller.ts
packages/editor/src/inspector/inspector-property-edit-controller.test.ts
```

Suggested supporting port:

```ts
interface InspectorPropertyEditTargetSource {
  getEditableComponent(actorId: string, componentId: string): {
    readonly component: unknown;
    readonly componentType: string;
  } | null;
}
```

Required behavior:

- editor-owned class, no singleton/facade;
- implements existing `UiScheduledService` shape or is wrapped by app
  composition as a scheduled service;
- queues edit requests;
- merges requests by `(actorId, componentId, propertyId)` with last valid edit
  winning per frame;
- applies through descriptor `applyEdit`;
- never imports `wallpaper-runtime`;
- exposes a minimal revision/last-applied count only if needed for tests;
- dispose clears pending edits and disables future commits.

Tests:

- multiple edits for same key in one frame apply once with last value;
- edits for different keys both apply;
- missing actor/component/descriptor is dropped deterministically;
- descriptor apply error is captured as a failed edit result, not a frame crash;
- disposed controller ignores new commits;
- no app/runtime imports in the controller source.

## Step 5: Add Inspector Property Control Actor Reconciler

Add:

```text
packages/editor/src/inspector/inspector-property-control-actor-reconciler.ts
packages/editor/src/inspector/inspector-property-control-actor-reconciler.test.ts
```

Responsibilities:

- create stable child actors for editable property controls;
- add `UiElementComponent` and `NumberFieldComponent`;
- update existing NumberField descriptors/values when property summaries
  change;
- expose claimed control elements to `InspectorContentComponent` for row slot
  rehosting;
- destroy stale controls;
- dispose all owned controls.

Actor id rules:

- use a stable segment such as `:property-control:`;
- encode source actor id / component id / property id safely;
- provide `isInspectorPropertyControlActorId(...)`.

Update Hierarchy filtering:

```text
packages/editor/src/tool-windows/install-tool-window-features.ts
packages/editor/src/hierarchy/actor-hierarchy-object-source.test.ts
```

Gate 3 must prove Inspector property control actors do not appear in Hierarchy.

## Step 6: Wire Inspector Content To Editable Controls

Update:

```text
packages/editor/src/inspector/inspector-content-component.ts
packages/editor/src/inspector/inspector-view-actor-factory.ts
packages/editor/src/inspector/install-inspector-feature.ts
```

Required behavior:

- Inspector body still renders read-only rows itself;
- editable number rows reserve a control slot;
- the property control reconciler creates/reuses NumberField actor elements;
- `InspectorContentComponent` rehosts NumberField actor elements into the slot;
- selection change, lock change, component disappearance, and descriptor edit
  capability changes reconcile property controls;
- frame update refresh keeps active dirty NumberField drafts stable;
- dispose clears property control actors.

Tests:

- Camera3 FOV summary creates one NumberField actor;
- switching selection destroys stale FOV control actor;
- locked Inspector keeps its FOV control while another Inspector follows a new
  actor;
- direct frame refresh updates NumberField committed value when runtime value
  changes externally;
- Inspector body still contains no private input creation.

## Step 7: App-Local Camera3 Editable Descriptor

Update:

```text
apps/wallpaper-tesseract/src/features/inspector/install-wallpaper-inspector-descriptors.ts
```

Required behavior:

- Camera3 FOV property summary includes edit metadata:
  - control: number;
  - min/max/step;
  - numeric current value;
- `applyEdit` submits `set-projection-fov` to `Camera3MotionComponent`;
- descriptor validation is the source of Camera3 FOV constraints;
- descriptor uses only public `Camera3MotionComponent` APIs;
- Tesseract4 remains read-only.

Tests:

```text
apps/wallpaper-tesseract/src/features/inspector/install-wallpaper-inspector-descriptors.test.ts
```

Cover:

- Camera3 descriptor returns editable FOV metadata;
- applying valid FOV submits exactly one runtime command;
- invalid FOV is rejected or constrained according to descriptor policy;
- Tesseract4 descriptor has no edit metadata.

## Step 8: App Composition Wiring

Update:

```text
apps/wallpaper-tesseract/src/app/create-wallpaper-app.ts
```

Required wiring:

- create one `InspectorPropertyEditController`;
- inject it into Inspector feature setup;
- register it with `UiFrameScheduler`;
- dispose scheduler registration/controller in app dispose and failure paths;
- keep descriptor registry explicit and required;
- no generic app service container.

Failure path test:

- if app initialization fails after controller registration, registration and
  controller are disposed before the next app creation attempt.

## Step 9: Boundary Tests

Update:

```text
apps/wallpaper-tesseract/src/architecture-boundaries.test.ts
```

Required invariants:

- `ui-framework/controls` may own NumberField DOM input behavior;
- `packages/editor/src/inspector` production code may not create `input`,
  `textarea`, or `select` DOM directly;
- `NumberFieldComponent` participates in actor-input routing and marks hits as
  `content-control`;
- `packages/editor` still has no `wallpaper-runtime` manifest or production
  import;
- app-local inspector descriptor installer remains the only bridge importing
  editor descriptor APIs and wallpaper-runtime component types;
- `InspectorPropertyEditController` appears only under
  `packages/editor/src/inspector` and app composition wiring;
- `runtime-core` and `runtime-three` do not import editor/ui/app code;
- property control actor ids are excluded from Hierarchy source;
- no `FrameCommandBatch`, no actor-system OnGUI/UI hook.

## Step 10: Browser Smoke

Add:

```text
apps/wallpaper-tesseract/scripts/run-editor-inspector-editable-camera-fov-smoke.mjs
```

Smoke requirements:

- open app with reset layout;
- select Scene View;
- lock first Inspector;
- locate Camera3 Motion FOV NumberField in the locked Inspector;
- verify clicking/focusing the field does not trigger window drag/dock/tab
  actions;
- enter a new valid FOV;
- verify the NumberField emits/commits only one effective final value;
- verify the locked Inspector and a second Inspector show the committed FOV
  after frame update;
- select Tesseract4 and verify following Inspector remains read-only;
- verify Debug diagnostics rows remain visible;
- enter an invalid FOV and verify runtime state is unchanged and frame update
  does not crash;
- verify console errors are 0;
- write evidence:

```text
temp/editor-inspector-editable-camera-fov-smoke-data.json
temp/editor-inspector-editable-camera-fov-smoke-report.md
```

If browser automation cannot reliably type into native number input on the
first pass, targeted unit/integration tests must still prove the edit path; the
smoke may use Playwright `fill()` / keyboard events only through the visible
NumberField.

## Step 11: Documentation

Update:

```text
docs/editor-inspector-component-details-plan.md
docs/current-project-progress.md
docs/known-defects-and-todos.md
```

Required notes:

- Gate 3 complete only after targeted tests, root validation, and smoke pass;
- record FOV edit constraints;
- record smoke evidence paths;
- record any deferred follow-up, such as additional editable properties or
  eventual shared command-batch primitive, only if discovered during
  implementation.

## Validation

Targeted:

```powershell
npm run test -w ui-framework -- number-field controls
npm run test -w runtime-core -- camera
npm run test -w runtime-three -- camera
npm run test -w wallpaper-runtime -- camera3
npm run test -w editor -- inspector hierarchy
npm run test -w wallpaper-tesseract -- create-wallpaper-app architecture-boundaries
```

Cross-package:

```powershell
npm run typecheck -w ui-framework
npm run typecheck:test -w ui-framework
npm run typecheck -w runtime-core
npm run typecheck -w runtime-three
npm run typecheck -w wallpaper-runtime
npm run typecheck -w editor
npm run typecheck -w wallpaper-tesseract
npm run build -w ui-framework
npm run build -w runtime-core
npm run build -w runtime-three
npm run build -w wallpaper-runtime
npm run build -w editor
npm run build -w wallpaper-tesseract
```

Browser:

```powershell
npm run prism:smoke:prepare
npm run dev -w wallpaper-tesseract
node apps/wallpaper-tesseract/scripts/run-editor-inspector-editable-camera-fov-smoke.mjs
```

Final:

```powershell
npm run test
npm run typecheck
npm run build
git diff --check
```

## Exit Criteria

- Camera3 FOV is editable from Inspector.
- The edit goes through NumberField -> InspectorPropertyEditController ->
  descriptor apply path -> runtime camera command.
- No Inspector-private input DOM exists.
- No `editor -> wallpaper-runtime` dependency exists.
- Runtime FOV update is renderer/runtime-owned and test-covered.
- Multiple edits in one frame merge deterministically.
- Multiple Inspectors share one edit controller and converge after frame
  update.
- Property control actors are stable, disposed, and excluded from Hierarchy.
- Tesseract4 remains read-only.
- Browser smoke and root validation pass.

## Stop Conditions

Stop and revise if:

- FOV cannot be changed through a runtime command without editor/app direct
  mutation of runtime internals;
- NumberField requires product/editor-specific behavior to be usable;
- property controls cannot be actor-backed without creating recursive
  Hierarchy pollution;
- multiple Inspector instances require multiple edit controllers;
- command merging starts looking like a reusable primitive before a second real
  consumer exists;
- implementing this gate requires `packages/editor` to import
  `wallpaper-runtime`.
