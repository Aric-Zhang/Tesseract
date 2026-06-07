# Project Prism Phase 1D Amendment: Component Attachment Runtime Split

Date: 2026-06-08

## Status

Completed on 2026-06-08.

Completion report:

```text
temp/project-prism-phase-1-step-1d-completion-report.md
```

This amendment replaces the old Step 1D execution plan. The old plan correctly
identified `ComponentRuntimeBridge` as the next pressure point, but it did not
define the component metadata model needed to remove domain capability strings
from actor-runtime safely.

## Purpose

Make actor-runtime own only actor/component lifecycle and generic attachment
contracts. Domain binding behavior must move to domain-owned runtime services.

Phase 1D succeeds only if actor-runtime stops knowing about gizmo/state
observer binding domain names and stops depending on concrete bridge classes.

## Core Principles

- Actor-runtime owns component creation, dependency resolution, attachment, and
  disposal.
- Actor-runtime does not own gizmo, state observer, scene command, DOM, Three,
  or editor/runtime feature facts.
- Component metadata may declare generic attachment descriptors, but the
  descriptor kind must be owned by the domain runtime that understands it.
- Binding runtime services register external behavior. They must not mutate
  business component state directly.
- Lifecycle mutation still goes through `ComponentRegistry` and actor/component
  ownership rules.
- Do not preserve the old capability enum under a new name.

## Non-Goals

- Do not extract packages yet.
- Do not keep a compatibility adapter for legacy `"gizmo"` or
  `"state-observer"` capability strings.
- Do not introduce a universal app service bag.
- Do not make app composition inspect concrete component internals.
- Do not move scene/window/editor product policy into actor-runtime.

## Target Model

### Generic Actor-Runtime Contracts

Create an actor-runtime owned attachment contract:

```ts
export interface ComponentAttachmentRegistration {
  dispose(): void;
}

export type ComponentAttachmentKind = string & {
  readonly __componentAttachmentKind?: never;
};

export interface ComponentAttachmentDescriptor<TOptions = unknown> {
  readonly kind: ComponentAttachmentKind;
  readonly options?: TOptions;
}

export interface ComponentAttachmentRuntime {
  attach(
    actor: Actor,
    component: Component,
    attachments: readonly ComponentAttachmentDescriptor[]
  ): ComponentAttachmentRegistration;
}
```

Exact names may change, but these constraints are mandatory:

- `ComponentAttachmentKind` is generic and branded only for type safety.
- `ComponentAttachmentRegistration` is owned by actor-runtime or a lower-level
  shared disposable contract. It must not come from `runtime/ports/update-frame`
  or another higher runtime package.
- actor-runtime does not export a union of domain strings.
- actor-runtime does not import `gizmo-core`, `scene-runtime`, or
  state-observer domain types.
- `ComponentDefinition` no longer exposes `capabilities`.
- new metadata uses `attachments?: readonly ComponentAttachmentDescriptor[]`
  or an equivalent generic field.
- the attachment runtime receives only normalized attachment descriptors. It
  must not receive the full `ComponentDefinition` and must not inspect
  `requires`, `create`, `kind`, `singleton`, or other component-definition
  fields.

### Domain-Owned Attachment Kinds

The owning runtime defines the descriptor kind and options:

```text
gizmo-runtime/
  gizmo-controller-attachment.ts
    gizmoControllerAttachmentKind
    GizmoControllerAttachmentOptions
    GizmoControllerAttachmentRuntime

state-runtime/
  state-observer-attachment.ts
    stateObserverAttachmentKind
    StateObserverAttachmentOptions
    StateObserverAttachmentRuntime

gizmo-runtime or actor-input runtime/
  active-input-cancellation-runtime.ts
    ActiveInputCancellationRuntime
```

The component definition imports the domain-owned descriptor helper, not a
domain string from actor-runtime.

### Composition

`ComponentRegistry` should depend only on `ComponentAttachmentRuntime`.

Composition belongs outside actor-runtime:

```text
app-runtime or feature installer
  CompositeComponentAttachmentRuntime
    -> GizmoControllerAttachmentRuntime
    -> StateObserverAttachmentRuntime
    -> ActiveInputCancellationRuntime
```

`ComponentRuntimeBridge` should either be deleted or reduced to a composition
wrapper outside the actor-core candidate boundary. It must not remain the class
that actor-runtime imports.

By final Step 1D acceptance:

- `actor-runtime/index.ts` must not export `ComponentRuntimeBridge`;
- tests must not import `ComponentRuntimeBridge` from `actor-runtime`;
- any remaining bridge/composite runtime must live outside the actor-core
  candidate boundary and be named as composition, not actor-core API.

## Required Substeps

### Step 1D.0: Freeze Current Blockers

Goal:

Record the exact pre-1D state and add tests for the intended cleanup before
changing runtime behavior.

Implementation:

1. Add or update boundary tests proving the current blockers are recognized:
   - `actor-runtime` still imports `scene-runtime` only as known Step 1D debt;
   - `ComponentCapability` still contains domain binding names only as known
     Step 1D debt;
   - `ComponentRegistry` still imports `ComponentRuntimeBridge` only as known
     Step 1D debt.
2. Ensure the generated Prism boundary report names these as Step 1D blockers.

Tests:

```text
npm run test -w wallpaper-tesseract -- project-prism-boundary-report architecture-boundaries
npm run typecheck -w wallpaper-tesseract
```

Acceptance:

- the debt is explicit and executable;
- no new allowlist silently permits the same dependency after Step 1D.

### Step 1D.1: Introduce Generic Attachment Runtime Port

Goal:

Invert `ComponentRegistry -> ComponentRuntimeBridge` without changing domain
behavior.

Implementation:

1. Add `actor-runtime/component-attachment-runtime.ts`.
2. Add `ComponentAttachmentDescriptor` to component definition metadata.
3. Add actor-runtime owned `ComponentAttachmentRegistration`.
4. Add `ComponentAttachmentRuntime`.
5. Change `ComponentRegistryOptions.bridge` to an attachment runtime option.
6. Normalize definitions so the registry passes only
   `definition.attachments ?? []` into the attachment runtime.
7. Keep behavior green by making the current bridge implement the generic
   interface temporarily, but do not add new legacy capability support and do
   not let the bridge inspect full definitions.

Tests:

```text
npm run test -w wallpaper-tesseract -- component-registry component-runtime-bridge architecture-boundaries
npm run typecheck -w wallpaper-tesseract
```

Acceptance:

- `ComponentRegistry` no longer imports the concrete bridge class.
- `ComponentRegistry` passes normalized attachments, not full definitions, to
  the attachment runtime.
- actor-runtime does not import `RuntimeRegistration` from `runtime/ports`.
- existing attach/detach rollback tests still pass.
- no business component state is mutated by the attachment runtime.

Stop if:

- registry needs to inspect feature-specific attachment options;
- app composition needs per-component special cases to attach components.

### Step 1D.2: Move Gizmo Attachment Ownership To Gizmo Runtime

Goal:

Remove the actor-runtime owned `"gizmo-controller-binding"` domain fact.

Implementation:

1. Add a gizmo-owned descriptor helper.
2. Create a gizmo-owned registry port in `gizmo-runtime` or a
   gizmo-owned port module. Do not continue routing new gizmo attachment code
   through `runtime/ports/runtime-registries.ts`.
3. Update gizmo binding component definitions to declare that descriptor.
4. Move gizmo controller registration into `GizmoControllerAttachmentRuntime`.
5. Remove gizmo domain strings from actor-runtime tests and metadata.

Tests:

```text
npm run test -w wallpaper-tesseract -- component-runtime-bridge gizmo-event-binding-component actor-input-router architecture-boundaries
npm run typecheck -w wallpaper-tesseract
```

Browser smoke required if input registration or active path behavior changes:

- Camera3 drag;
- Camera3 double-click;
- tab close click;
- menu click;
- active interaction cancel when a hit component is detached or disabled.

Structured smoke is mandatory for this step if the registration path changes,
even if unit tests pass. Record DOM top stack, actor-input hit, action result,
viewport, screenshot path, and console errors.

Acceptance:

- actor-runtime does not define or import the gizmo attachment kind.
- gizmo-runtime owns all `gizmo-core` registration.
- new gizmo attachment code does not import the mixed
  `runtime/ports/runtime-registries.ts` file.

### Step 1D.3: Move State Observer Attachment Ownership To State Runtime

Goal:

Remove the actor-runtime owned `"state-observer-binding"` domain fact.

Implementation:

1. Add a state-runtime owned descriptor helper.
2. Create a state-owned observer registry port in `state-runtime`,
   `scene-runtime`, or a named scene/state adapter module. Do not continue
   routing new state observer attachment code through the mixed
   `runtime/ports/runtime-registries.ts` file.
3. Update state observer binding component definitions.
4. Move observer subscription into `StateObserverAttachmentRuntime`.
5. Keep scene-state observer adaptation outside actor-runtime.

Tests:

```text
npm run test -w wallpaper-tesseract -- state-observer-binding-component app-menu-bar-component floating-window-component architecture-boundaries
npm run typecheck -w wallpaper-tesseract
```

Acceptance:

- actor-runtime does not define or import state observer attachment kinds.
- state observer subscription is owned by state/runtime adapter code.
- new state observer attachment code does not import the mixed
  `runtime/ports/runtime-registries.ts` file.

### Step 1D.4: Split Active Input Cancellation From Binding Registration

Goal:

Make active interaction cancellation an explicit runtime service, not hidden
inside the general bridge.

Implementation:

1. Identify current active interaction cancellation responsibilities in
   binding/runtime code.
2. Extract a narrow cancellation registry/service.
3. Register cancellation participants through attachment runtime or explicit
   actor input runtime ownership.
4. Ensure detach, disable, inactive tab, and hidden pane cancel active paths.

Tests:

```text
npm run test -w wallpaper-tesseract -- actor-input-router gizmo-event-binding-component floating-window-component workspace-root-dock-frame-component architecture-boundaries
npm run typecheck -w wallpaper-tesseract
```

Browser smoke:

- start a drag on Camera3 or frame/tab;
- hide/detach/close the active view;
- verify the interaction cancels and no stale pointer action continues.

Structured smoke is mandatory for this step. Record DOM top stack,
actor-input hit, action result, viewport, screenshot path, and console errors.

Acceptance:

- active input cancellation has a named owner;
- binding registration no longer hides cancellation behavior.

### Step 1D.5: Remove ComponentCapability From Actor Runtime

Goal:

Complete the metadata switch from actor-owned capability strings to generic
attachment descriptors.

Implementation:

1. Remove `ComponentCapability`.
2. Remove `capabilities` from `ComponentDefinition`.
3. Update all component definitions to use `attachments` or no attachment
   metadata.
4. Update tests to forbid all old capability strings in production code.

Tests:

```text
npm run test -w wallpaper-tesseract -- component-registry component-runtime-bridge architecture-boundaries
npm run typecheck -w wallpaper-tesseract
```

Acceptance:

- `rg "capabilities:" apps/wallpaper-tesseract/src` has no production hits.
- `actor-runtime` contains no gizmo/state observer domain binding strings.

### Step 1D.6: Remove SceneCommandSink From BusinessComponentContext

Goal:

Stop actor-runtime from exposing scene commands as a universal business
component service.

Implementation:

1. Introduce a generic command port only if it stays domain-neutral, such as
   `CommandSink<TCommand>`.
2. Prefer explicit feature options for domain command sinks:
   - window components receive `UiLayoutCommandSink`;
   - scene/editor features receive scene/editor command sinks through their
     installers;
   - generic business component context does not include scene commands.
3. Remove the hard-coded `services.commandSink: SceneCommandSink` field.
4. Update component factories and tests.

Tests:

```text
npm run test -w wallpaper-tesseract -- component-registry floating-window-component app-menu-bar-component hierarchy-panel-component scene-mode-toggle-component architecture-boundaries
npm run typecheck -w wallpaper-tesseract
```

Acceptance:

- `actor-runtime` no longer imports `scene-runtime`.
- generic UI/window components do not rely on scene command services.

Stop if:

- the replacement becomes a universal untyped service locator;
- a feature cannot name its command sink owner explicitly.

### Step 1D.7: Delete Remaining Mixed Runtime Registry Port Usage

Goal:

Remove any remaining usage of `runtime/ports/runtime-registries.ts` as a mixed
owner of gizmo, scene state, and update runtime facts. This step is not where
gizmo/state ports are first created; those must already be created in 1D.2 and
1D.3.

Implementation:

1. Delete or empty the mixed registry module if all imports have moved.
2. If compatibility must remain for one edit, mark it as blocker debt and keep
   it outside actor-core candidate paths.
3. Keep update-frame runtime object registry in a neutral runtime port only if
   it does not import scene or gizmo facts.
4. Update imports and boundary facts.

Tests:

```text
npm run test -w wallpaper-tesseract -- architecture-boundaries project-prism-boundary-report
npm run typecheck -w wallpaper-tesseract
```

Acceptance:

- no single port file imports both `gizmo-core` and `scene-runtime`.
- generated boundary facts show the runtime registry blocker narrowed or
  removed.
- `runtime/ports/runtime-registries.ts` is deleted or no longer used by
  production attachment runtimes.

### Step 1D.8: Boundary Report And Structured Smoke

Goal:

Prove the cleanup changed architecture facts and preserved interaction
behavior.

Implementation:

1. Regenerate the Prism boundary report.
2. Add hard boundary tests:
   - `actor-runtime` does not import `scene-runtime`;
   - `actor-runtime` does not import `gizmo-core`;
   - `actor-runtime` does not define gizmo/state observer capability strings;
   - binding runtimes do not import product feature modules.
3. Run structured browser smoke if input/binding/cancellation changed.

Tests:

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

Structured smoke minimum:

- desktop root Scene tab hit;
- floating-over-root tab hit;
- App Menu open/focus;
- tab close;
- Camera3 drag and double-click;
- Scene fullscreen/restore;
- console errors 0;
- captured actor-input hit data for each pointer action.

This final smoke does not replace the required 1D.2 and 1D.4 structured smoke
when those steps change registration or cancellation behavior.

Acceptance:

- Phase 0 boundary facts show the Step 1D blockers reduced or removed.
- interaction smoke has DOM top stack and actor-input hit evidence.
- no broad allowlist was added to pass architecture tests.

## Final Step 1D Acceptance

Step 1D is accepted only when all are true:

- `ComponentRegistry` depends only on `ComponentAttachmentRuntime`.
- `ComponentAttachmentRuntime` receives only normalized attachment descriptors,
  not full component definitions.
- actor-runtime owns its minimal attachment disposable/registration contract
  and does not import runtime package registration types.
- `actor-runtime` does not import `scene-runtime`.
- `actor-runtime` does not import `gizmo-core`.
- `actor-runtime/index.ts` does not export `ComponentRuntimeBridge`.
- tests do not import `ComponentRuntimeBridge` from `actor-runtime`.
- actor-runtime does not define domain capability strings.
- `SceneCommandSink` is not part of `BusinessComponentContext`.
- gizmo binding, state observer binding, and active input cancellation have
  separate owners and tests.
- generated Project Prism boundary facts show real blocker reduction.

## Stop Conditions

Stop and revise the plan if:

- attachment metadata needs feature-specific payloads inside actor-runtime;
- the composition layer must inspect concrete component classes;
- active input cancellation cannot be separated without changing pointer
  semantics;
- explicit command sink injection turns into a universal service locator;
- browser smoke shows intermittent missed clicks, stale active interactions, or
  Scene render loss after the runtime split.
