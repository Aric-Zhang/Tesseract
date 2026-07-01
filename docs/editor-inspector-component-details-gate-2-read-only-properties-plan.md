# Editor Inspector Component Details Gate 2: Read-Only Properties Plan

Status: complete

Last updated: 2026-07-01

## Purpose

Add read-only property rows to Inspector Component sections.

Gate 2 should prove the descriptor ownership model and dynamic refresh path
without adding editable fields, runtime commands, or a property edit
controller. The Inspector becomes useful for inspection, but still cannot
mutate Actors or Components.

## Parent Plan

This gate belongs to:

```text
docs/editor-inspector-component-details-plan.md
```

Prerequisites:

```text
docs/editor-inspector-component-details-gate-0-interaction-contract-plan.md
docs/editor-inspector-component-details-gate-1-component-sections-plan.md
```

Gate 1 must already be complete: Inspector renders actor headers and read-only
Component sections from `InspectorActorDetailsSource`.

## Product References

Unity's Inspector exposes reflected fields/properties under each Component
section, while custom editors/descriptors decide what is visible. Unreal's
Details panel similarly uses metadata/customization to decide visible rows.

Gate 2 adopts only the read-only descriptor part:

- descriptors decide which properties are visible;
- descriptors format values into summary rows;
- Inspector UI renders property rows from summaries;
- no editing, no validation widgets, no commit path.

## Current Facts

- `InspectorContentComponent` consumes `InspectorActorDetailsSource`.
- `InspectorActorDetailsSource` currently returns actor summaries and
  `InspectorComponentSummary[]` with `id/type/displayName/enabled`.
- The details source adapter wraps `ActorSystemView` inside the inspector
  package, but Inspector body does not receive `ActorSystem`, `Actor`, or live
  `Component` references.
- `packages/editor` must not import `wallpaper-runtime`.
- `Camera3MotionComponent` and `Tesseract4Component` live in
  `packages/wallpaper-runtime`; their descriptors must be app-local
  contributions.
- `frameUpdateAttachment` is already the accepted UI refresh hook.

## Non-Goals

- Do not add editable fields.
- Do not add `NumberFieldComponent`.
- Do not add `InspectorPropertyEditController`.
- Do not add runtime camera commands.
- Do not mutate Components or Actor state.
- Do not create per-property Actor children.
- Do not make `packages/editor` depend on `wallpaper-runtime`.
- Do not add `FrameCommandBatch`.
- Do not introduce descriptor-driven sorting/foldout persistence beyond the
  explicit read-only row contract.

## Architecture Decisions

### Descriptor Registry Ownership

Add `InspectorComponentDescriptorRegistry` under:

```text
packages/editor/src/inspector
```

The editor package owns descriptor types and registry mechanics only. It may
register descriptors for editor-owned components. It must not import
wallpaper-runtime component classes or types.

Wallpaper product descriptors must live in app-local code, for example:

```text
apps/wallpaper-tesseract/src/features/inspector/install-wallpaper-inspector-descriptors.ts
```

App-local code may import both `editor` and `wallpaper-runtime`.

### Descriptor API

Use component type string as the descriptor key. Gate 2 should not require a
typed dependency from `editor` to product/runtime component classes.

Suggested shape:

```ts
export interface InspectorComponentDescriptor<TComponent = unknown> {
  readonly componentType: string;
  readonly displayName?: string;
  readProperties(component: TComponent, context: InspectorPropertyReadContext): readonly InspectorPropertySummary[];
}

export interface InspectorPropertyReadContext {
  readonly actorId: string;
  readonly componentId: string;
  readonly componentType: string;
}

export interface InspectorPropertySummary {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly kind?: "text" | "number" | "boolean" | "enum";
}
```

Descriptors may receive the live Component inside the details-source adapter,
but the returned `InspectorActorDetails` must still contain immutable summary
data only. `InspectorContentComponent` must not receive live Component objects.

Gate 2 does not include descriptor order. Component ordering remains
`actor.listComponents()` order until a later gate proves descriptor-driven
ordering is necessary.

The descriptor registry is required wiring. App composition creates the
registry, installs real descriptor contributions, and passes the registry into
Inspector feature setup. There is no no-registry fallback path and no empty
editor descriptor installer.

### Fallback Descriptor

If no descriptor exists for a Component, keep the Gate 1 behavior:

- Component section still appears;
- no property rows are rendered;
- section still shows `id/type/enabled`.

Do not add fake default properties like every enumerable object key. That would
be implicit reflection and could leak implementation details.

If a descriptor throws while reading, Inspector must render a deterministic
read-only error row with `kind: "error"`. The runtime UI must not crash, log a
console error, or silently swallow the failure.

### Dynamic Refresh

Gate 2 introduces dynamic read-only rows, so `InspectorContentComponent` should
participate in frame updates through the existing `frameUpdateAttachment`
path.

Rules:

- Use `FrameUpdateParticipant` / `frameUpdateAttachment` already owned by
  `ui-framework`.
- On each frame, if the inspected actor is unchanged, re-read details through
  `InspectorActorDetailsSource`.
- Use a render signature guard so unchanged details do not rebuild DOM.
- Selection changes should still render immediately.
- Locked Inspector still refreshes the locked actor's read-only rows.

This refresh is not a new OnGUI hook and must not move into `actor-system/core`.

### App-Local Wallpaper Descriptors

Add only read-only descriptors that can be supported by existing public
component APIs.

Candidate descriptors:

- `Camera3MotionComponent`
  - projection mode;
  - distance or camera position summary if exposed through public view state;
  - current FOV only if available through public runtime camera view state.
- `Tesseract4Component`
  - component id/type summary only if no useful public read API exists.

If a useful property requires reading private runtime state, skip that property
and record a follow-up. Do not add a broad runtime facade just for Gate 2.

## Step 0: Entry Gate

1. Confirm Gate 1 validation is still green:

```powershell
npm run test -w editor -- inspector
npm run test -w wallpaper-tesseract -- architecture-boundaries
```

2. Confirm worktree scope:

```powershell
git status --short
```

3. Read:

```text
packages/editor/src/inspector/inspector-actor-details-source.ts
packages/editor/src/inspector/inspector-content-component.ts
packages/editor/src/inspector/inspector-content-definition.ts
packages/editor/src/inspector/inspector-view-actor-factory.ts
packages/wallpaper-runtime/src/camera3/camera3-motion-component.ts
packages/wallpaper-runtime/src/tesseract4
apps/wallpaper-tesseract/src/app/create-wallpaper-app.ts
apps/wallpaper-tesseract/src/architecture-boundaries.test.ts
```

Stop if Gate 1 old display-source compatibility has reappeared.

## Step 1: Add Descriptor Registry Types

Create:

```text
packages/editor/src/inspector/inspector-component-descriptor.ts
packages/editor/src/inspector/inspector-component-descriptor-registry.ts
```

Required behavior:

- register descriptor by `componentType`;
- duplicate descriptor registration throws;
- lookup by component type returns descriptor or null;
- snapshots/returned descriptor lists are immutable or cloned enough that
  callers cannot mutate registry internals;
- descriptors are read-only and cannot expose mutation methods.

Do not export a root service singleton. The registry instance is created by
app/editor composition and passed explicitly.

Tests:

```text
packages/editor/src/inspector/inspector-component-descriptor-registry.test.ts
```

## Step 2: Expand Actor Details Source To Include Properties

Update `InspectorComponentSummary`:

```ts
readonly properties: readonly InspectorPropertySummary[];
```

Update `createActorSystemInspectorActorDetailsSource(...)` options to require a
descriptor registry:

```ts
createActorSystemInspectorActorDetailsSource(actorSystem, { descriptorRegistry })
```

The option object and registry are required even when the registry is empty.
This keeps one details path and avoids "with registry" / "without registry"
fallback behavior.

Rules:

- details source adapter reads live components;
- descriptor callbacks run inside the adapter;
- returned actor details and property summaries are snapshots;
- descriptor reader errors must not crash the whole Inspector. Render a
  deterministic read-only error property row for that component. Tests must
  prove the error is visible, no console error is emitted by the details source,
  and the error is not swallowed silently.

Tests:

- no descriptor -> no property rows;
- descriptor -> property rows appear in summary;
- descriptor receives component and context;
- returned property summaries are immutable snapshots;
- duplicate same-type components each get their own property rows;
- descriptor failure behavior is deterministic.

## Step 3: Render Read-Only Property Rows

Update `InspectorContentComponent`:

- render a property list inside each Component section;
- use stable diagnostics:

```text
data-inspector-property-id
data-inspector-property-kind
data-inspector-property-label
```

- render empty property state only when useful and not visually noisy;
- keep property rows private DOM;
- do not create input/select/textarea;
- do not add click/input/change DOM shortcuts.

Update CSS with existing `--ui-*` tokens only:

```text
packages/editor/src/inspector/inspector.css
```

## Step 4: Wire Registry Through Inspector Feature

Update:

```text
packages/editor/src/inspector/install-inspector-feature.ts
packages/editor/src/inspector/inspector-view-actor-factory.ts
packages/editor/src/inspector/inspector-content-definition.ts
```

Add a required descriptor registry option to Inspector feature installation.
App composition must create and pass a registry, even if it contains no
descriptors.

Do not create a module-level default registry.

Failure cleanup must still dispose/destroy root/toolbar/body/lock actors.

## Step 5: App-Local Descriptor Contributions

Create an app-local descriptor installer, for example:

```text
apps/wallpaper-tesseract/src/features/inspector/install-wallpaper-inspector-descriptors.ts
```

Responsibilities:

- create/register wallpaper product descriptors into the editor registry;
- import `wallpaper-runtime` types only from app-local code;
- keep descriptor contribution thin and read-only;
- return no broad service/facade.

Update app composition:

```text
apps/wallpaper-tesseract/src/app/create-wallpaper-app.ts
```

Wiring shape:

```text
create registry -> install app-local wallpaper descriptors -> install Inspector feature
```

Boundary tests must allowlist only:

```text
apps/wallpaper-tesseract/src/features/inspector/install-wallpaper-inspector-descriptors.ts
```

as the production file allowed to import both editor Inspector descriptor APIs
and `wallpaper-runtime`.

## Step 6: Dynamic Refresh

Update `InspectorContentComponent` definition to require/reuse frame update
attachment.

Implementation rules:

- `inspector-content-definition.ts` adds `frameUpdateAttachment` to
  `attachments`; do not manually subscribe from the factory or app composition.
- `InspectorContentComponent` implements `FrameUpdateParticipant`;
- `updateFrame(...)` calls a guarded refresh for the current inspected actor;
- render signature includes actor id/name/enabled, component id/type/enabled,
  property id/label/value/kind;
- unchanged signature does not call `replaceChildren`;
- selection change invalidates the signature and renders immediately;
- dispose disables future refresh.

Tests:

- unchanged frame update does not rebuild DOM;
- changing a descriptor-read value refreshes without selection change;
- locked Inspector refreshes its locked actor;
- disposed Inspector does not refresh.

## Step 7: Boundary Tests

Update:

```text
apps/wallpaper-tesseract/src/architecture-boundaries.test.ts
```

Rules:

- `packages/editor/package.json` still has no `wallpaper-runtime` dependency.
- `packages/editor/src/inspector` production imports do not resolve into
  `packages/wallpaper-runtime`.
- descriptor implementation files under `packages/editor` do not import
  wallpaper-runtime Camera3/Tesseract types.
- app-local descriptor installer is the only production path allowed to import
  both `editor` inspector descriptor APIs and `wallpaper-runtime`.
- `InspectorContentComponent` still does not receive live `ActorSystem` or
  `ActorSystemView`.
- no Inspector private `input` / `textarea` / `select` / number shortcuts.
- no `InspectorPropertyEditController` or editable field code appears in Gate 2.
- `actor-system/core` still has no UI/OnGUI/frame hook semantics.

## Step 8: Browser Smoke

Add or extend dedicated smoke evidence:

```text
apps/wallpaper-tesseract/scripts/run-editor-inspector-readonly-properties-smoke.mjs
temp/editor-inspector-readonly-properties-smoke-data.json
temp/editor-inspector-readonly-properties-smoke-report.md
```

The runner must self-validate before writing `passed: true`.

Required assertions:

- console errors are 0;
- selecting Scene shows Component sections and property rows for any descriptor
  registered for Scene components;
- selecting Camera3 shows Camera3 Component section and at least one read-only
  property row from an app-local wallpaper descriptor;
- property row diagnostics include id/label/value/kind;
- lock/follow behavior still works;
- Debug diagnostics rows remain visible;
- if a dynamic Camera3 property changes through existing gizmo/runtime behavior
  during the smoke, Inspector refreshes without selection change. If the
  current smoke cannot reliably trigger this, cover dynamic refresh in unit
  tests and record that browser dynamic proof is deferred to the first editable
  property gate.

## Step 9: Documentation

Update:

```text
docs/editor-inspector-component-details-plan.md
docs/current-project-progress.md
docs/known-defects-and-todos.md
```

Required updates:

- mark Gate 2 complete only after tests and smoke pass;
- record smoke evidence file paths;
- state which descriptors are registered and which properties are intentionally
  skipped because no public read API exists;
- keep editable fields/FOV command/property edit controller as Gate 3 work.

## Validation

Targeted:

```powershell
npm run test -w editor -- inspector
npm run test -w wallpaper-tesseract -- architecture-boundaries
```

Cross-package:

```powershell
npm run typecheck -w editor
npm run typecheck -w wallpaper-tesseract
npm run build -w editor
npm run build -w wallpaper-tesseract
```

Browser:

```powershell
npm run prism:smoke:prepare
npm run dev -w wallpaper-tesseract
node apps/wallpaper-tesseract/scripts/run-editor-inspector-readonly-properties-smoke.mjs
```

Required before handoff because this gate touches app composition and
wallpaper-runtime descriptor imports:

```powershell
npm run test
npm run typecheck
npm run build
git diff --check
```

## Exit Criteria

- Inspector Component sections can show read-only property rows.
- Descriptor registry exists under editor ownership.
- Wallpaper-runtime-specific descriptors are app-local contributions.
- `packages/editor` still does not import or depend on `wallpaper-runtime`.
- Dynamic read-only rows refresh through guarded `frameUpdateAttachment`.
- No editable field, property edit controller, runtime command, or
  frame-command batching primitive was added.
- Browser smoke proves visible read-only property rows and preserves
  lock/follow + Debug diagnostics.

## Stop Conditions

Stop and revise the plan if:

- a desired property requires reading runtime private fields;
- descriptor registration requires `packages/editor` to import
  `wallpaper-runtime`;
- property row refresh cannot be guarded without rebuilding DOM every frame;
- the first dynamic property cannot be observed through public APIs and would
  require a runtime facade;
- implementing property display pressures Inspector to create private editable
  field DOM.

## Completion Record

Completed on 2026-07-01.

Implemented:

- editor-owned `InspectorComponentDescriptorRegistry`;
- required descriptor registry wiring through app composition and Inspector
  feature installation;
- app-local wallpaper descriptor installer for Camera3 Motion and Tesseract4;
- read-only property rows under Inspector component sections;
- guarded frame-update refresh for dynamic read-only summaries;
- deterministic descriptor error rows;
- architecture boundary allowlist for the app-local descriptor bridge.

Registered app-local descriptors:

- Camera3 Motion: projection mode, distance, yaw, pitch, and FOV from public
  `readViewState()` / `distance` APIs.
- Tesseract4: component id and component type summary only; no new runtime
  facade was added.

Browser smoke evidence:

```text
temp/editor-inspector-readonly-properties-smoke-data.json
temp/editor-inspector-readonly-properties-smoke-report.md
```
