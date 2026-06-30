# Editor Inspector Component Details Plan

Status: planned

Last updated: 2026-07-01

## Purpose

Make Inspector real, not just a selected actor name display:

- show every Component attached to the inspected Actor;
- show explicitly inspectable Component properties;
- edit supported properties through an owner-controlled command/merge/update
  path instead of direct UI mutation.

This plan follows the existing actor tree -> component composition direction.
It must not create a parallel UI tree, a reflection-based field dumper, or a
global service locator.

## Current Baseline

- Inspector is already an Arbor subtree:
  - root actor owns `InspectorRootContentComponent` and window content
    registration;
  - toolbar child actor owns the lock toggle;
  - body child actor owns `InspectorContentComponent`.
- Unlocked Inspectors follow `selection.snapshot.activeActorId`; locked
  Inspectors keep their current inspected actor.
- `Actor.listComponents()` already exposes the components attached to an actor.
- `ComponentDefinition` does not own Inspector metadata. Keep it that way:
  actor-system must stay editor-agnostic.
- `InspectorContentComponent` currently receives a display-name source, not an
  actor/details source. Gate 1 must add a narrow actor-details source before it
  can list components.
- `FrameUpdateAttachmentRuntime` already provides a UI-frame hook owned by
  `ui-framework`, while actor-system only provides generic component attachment
  plumbing.
- `AppFrameStateController` and `RuntimeThreeCameraMotionController` both show
  frame command batching patterns, but they are not yet one reusable primitive.

## External Reference Summary

Unity and Unreal both separate object state from Inspector UI:

- Unity Inspectors work through serialized property streams. Fields are visible
  only when serialization/Inspector rules allow them, and custom editors update
  serialized objects before applying modified properties.
- Unity uses explicit metadata such as `SerializeField`, `HideInInspector`, and
  range attributes to decide visibility and editor widget behavior.
- Unreal Details Panels use property metadata and customization hooks. The
  details UI does not blindly expose every private runtime field.

Tesseract should follow the same principle with explicit descriptors, not
TypeScript object reflection.

## Non-Negotiable Architecture Rules

- Do not put Inspector metadata in `actor-system/core`.
- Do not add an actor-system-owned `OnGUI`, frame loop, or UI repaint hook.
- Do not make `ui-framework` know Editor Inspector, Component property policy,
  Camera3, Tesseract, or wallpaper-runtime internals.
- Do not make `packages/editor` depend on `wallpaper-runtime` to register
  product/runtime component descriptors.
- Do not let Inspector controls mutate Component fields directly.
- Do not preserve the current body text-only path as a compatibility renderer.
  Each gate must replace and delete the old path it supersedes.
- Do not expose Component internals by default. A property is inspectable only
  when an Editor-owned descriptor declares it.
- Dock/window graph transactions should not be migrated into the Inspector
  property-edit controller merely because both use the word "commit".

## Unified Interaction Contract

The long-term project-wide interaction shape should be:

```text
Actor Input -> domain interaction controller -> frame update/render
```

This plan applies that shape to Inspector without creating a broad new
framework.

### Actor Input

All interactive Inspector controls must use actor-input or reusable
ui-framework controls that already use actor-input. No DOM `click` shortcuts.

### Domain Interaction Controller

Inspector editable properties will use an Editor-owned
`InspectorPropertyEditController`.

There must be one Editor/app-runtime instance of this controller, injected into
all Inspector views. Do not create one controller per Inspector or per Actor;
that would create multiple batch truths when two Inspectors edit the same
property.

Responsibilities:

- queue property edit commands during a frame;
- group commands by `(actorId, componentId, propertyId)`;
- resolve priority/order according to descriptor policy;
- validate and constrain values through the descriptor;
- apply the final edit through the descriptor-owned mutation path;
- publish a committed property-change event/revision.

The controller owns only Inspector property-edit batching. It is not a
replacement for:

- `AppFrameStateController`;
- `RuntimeThreeCameraMotionController`;
- window docking lifecycle/graph transactions;
- component registry lifecycle.

### Frame Update

Inspector sections and property controls should refresh through the existing
`frameUpdateAttachment` / `FrameUpdateParticipant` path where polling or
projection is needed.

Actor-system remains unaware of UI hook semantics. It only attaches components
to external attachment runtimes. `ui-framework` owns the frame update hook and
app composition wires the runtime.

### Future Shared Primitive

Do not extract a generic `FrameCommandBatch` before this plan produces a second
real user beyond existing AppState/Camera patterns. If Inspector property
editing and another high-frequency controller show real duplication, extract a
small primitive that owns only:

- queue;
- target grouping;
- priority/order;
- no-op suppression;
- observer notification.

Domain owners must still provide target keys, validation, merge/apply rules,
and change-event semantics.

This watch item is tracked as `ARCH-001` in
`docs/known-defects-and-todos.md`.

## Inspector Descriptor Ownership

Create an Editor-owned descriptor registry, for example:

```ts
InspectorComponentDescriptorRegistry
```

Descriptor owner:

- lives under `packages/editor/src/inspector`;
- may depend on `actor-system/core`;
- must not be imported by `actor-system`, `ui-framework`, or pure math/runtime
  contracts.
- defines the registry, descriptor types, default display rules, and generic
  read/edit contracts only.

Concrete descriptor contributions:

- Editor-owned component descriptors may be registered by `packages/editor`.
- Product/runtime descriptors for `wallpaper-runtime` components such as
  `Camera3MotionComponent` and `Tesseract4Component` must be registered by
  app-local composition or an app-local descriptor installer. This installer may
  import both editor descriptor types and wallpaper-runtime component types.
- `packages/editor` must not import `wallpaper-runtime` just to populate
  Inspector details.

Descriptor shape:

```ts
interface InspectorComponentDescriptor<TComponent extends Component = Component> {
  readonly componentType: ComponentType<TComponent>;
  readonly displayName: string;
  readonly order?: number;
  readonly properties?: readonly InspectorPropertyDescriptor<TComponent>[];
}
```

Default behavior:

- every attached Component is shown;
- components with no descriptor use `component.type` as display name;
- components with no properties show a collapsed/empty details body;
- property values are hidden unless a descriptor explicitly exposes them.

## Inspector Actor Details Source

Gate 1 must replace the current display-name-only source with a narrow details
source:

```ts
interface InspectorActorDetailsSource {
  getActor(actorId: string): Actor | null;
  getActorDisplayName(actorId: string): string | null;
}
```

Rules:

- the source may wrap `ActorSystemView`;
- Inspector receives this narrow source, not the whole `ActorSystem`;
- it exposes Actor identity and attached components only through the returned
  `Actor`;
- it must not expose Hierarchy metadata, TreeView rows, app-local view
  factories, or window placement state.

## Property Descriptor Rules

First supported property kinds:

- readonly text;
- number;
- boolean;
- enum.

Later kinds:

- vector2/vector3;
- color;
- asset/reference picker;
- custom component drawer.

Descriptor responsibilities:

- `read(component)` returns the displayed value;
- `editable` defaults to false;
- editable descriptors define validation/constrain rules;
- editable descriptors define an apply path or command sink;
- labels, ranges, step, units, and grouping are metadata, not business state.
- product/runtime descriptors may be installed outside `packages/editor`, but
  the descriptor registry API remains editor-owned.

Hidden by default:

- functions;
- DOM elements;
- runtime registrations/subscriptions;
- renderables/Three objects;
- command sinks;
- caches;
- private controller/session state;
- any object not explicitly declared by a descriptor.

## Gate 0: Interaction And Refresh Contract

Purpose: lock the architecture before adding rows.

Detailed executable plan:

```text
docs/editor-inspector-component-details-gate-0-interaction-contract-plan.md
```

Work:

1. Add or update documentation and boundary tests for the Inspector interaction
   contract:
   - actor input is the only interactive control entry path;
   - `frameUpdateAttachment` is the UI refresh hook;
   - actor-system must not define UI/OnGUI semantics;
   - Inspector property edits must go through the Editor-owned controller.
2. Add package-boundary rules for descriptor ownership:
   - `packages/editor` may define Inspector descriptor registry/types;
   - `packages/editor` must not import `wallpaper-runtime`;
   - app-local code may register wallpaper-runtime descriptors by depending on
     both sides.
3. Add boundary rules for actor details:
   - Inspector may consume `InspectorActorDetailsSource`;
   - Inspector must not import Hierarchy internals to discover actors;
   - Inspector must not receive a broad app composition object.
4. Do not implement generic `FrameCommandBatch` yet.
5. Do not modify Camera3/Dock to fit this plan.
6. Confirm existing UI frame update runtime remains the one update hook.

Exit:

- no actor-system import of UI/editor/runtime update concepts;
- no new global controller/service locator;
- editor package still has no wallpaper-runtime dependency;
- `ARCH-001` remains a watch item, not an active blocker.

## Gate 1: Component Sections

Purpose: prove Inspector can display the inspected Actor's Component list.

Work:

1. Split Inspector body rendering from text-only `Inspecting: <name>` into an
   actor-details view.
2. Add `InspectorActorDetailsSource` and update Inspector construction to pass
   this source instead of the current display-name-only source.
3. For the inspected actor:
   - read `actor.listComponents()`;
   - sort by descriptor order, then component attach order;
   - render one Component section per Component.
4. Show:
   - Component display name;
   - component type;
   - component id;
   - enabled state.
5. Keep Component section DOM private to Inspector for the first gate. Do not
   create section actors until there is a real need for per-section interaction
   through actor tree children.
6. Preserve lock/follow behavior.
7. Delete the old `Inspecting: <name>` text as the primary renderer. It may
   remain only as a title/header inside the actor details view.

Exit:

- every component attached to the inspected Actor appears in Inspector;
- component section count, type, id, and enabled state are visible in browser
  smoke after selecting Scene/Camera3;
- Actor with no selection still shows empty state;
- missing actor state still works;
- lock/unlock smoke still passes;
- no property editing exists yet.

## Gate 2: Read-Only Properties

Purpose: add explicit property display without editing.

Work:

1. Add `InspectorComponentDescriptorRegistry`.
2. Add read-only property row rendering:
   - label;
   - value;
   - kind-specific formatting.
3. Register descriptors for editor-owned components inside `packages/editor`.
4. Register wallpaper-runtime descriptors from app-local code or an app-local
   descriptor installer, not from `packages/editor`:
   - `Camera3MotionComponent`: projection mode, distance, current FOV if
     available through `readViewState()`;
   - `Tesseract4Component`: readonly id/type summary if useful.
5. Make `InspectorContentComponent` participate in `frameUpdateAttachment` once
   it renders dynamic component/property rows. It must use a render signature or
   revision guard so unchanged property values do not rebuild DOM every frame.
6. Add CSS using existing theme tokens.

Exit:

- no descriptor means no exposed properties;
- read-only property rows update after selection changes;
- dynamic read-only rows refresh when runtime/gizmo changes the underlying
  value without a selection change;
- frame refresh is guarded and does not recreate unchanged section/property DOM
  every frame;
- Inspector does not read private runtime fields outside descriptor callbacks;
- ui-framework remains generic.

## Gate 3: Editable Property Controller

Purpose: make a first real editable property work through the unified
interaction contract.

First target: Camera FOV.

Work:

1. Add `InspectorPropertyEditController` under editor Inspector ownership.
   - one controller instance is installed per editor/app runtime;
   - all Inspector views receive the same edit controller;
   - dispose clears pending edits and subscriptions.
2. Add a generic field control before using editable number properties:
   - preferred: `NumberFieldComponent` in `ui-framework/controls`;
   - acceptable only after plan amendment: a smaller generic field-control
     foundation if number input requires more design.
   The control may use native `<input type="number">`, but interaction,
   validation handoff, commit sink, disabled state, and refresh must be
   first-class component behavior, not Inspector-private DOM listeners.
3. Extend runtime camera command surfaces before wiring Inspector:
   - `runtime-core` command type for setting projection FOV or equivalent;
   - `runtime-three` controller/orbit camera applies the command and notifies
     observers;
   - `wallpaper-runtime` component tests cover the command through
     `Camera3MotionComponent`.
   The mutation owner remains Camera3 motion/runtime, not the Inspector UI.
4. Register the Camera FOV descriptor from app-local descriptor contribution
   code that can import wallpaper-runtime component types.
5. Descriptor for Camera FOV:
   - reads committed FOV;
   - validates finite number;
   - constrains allowed range;
   - submits/apply through the controller and Camera3 command path.
6. Controller commits once per frame and notifies controls on the next frame.

Exit:

- editing FOV changes the rendered camera behavior;
- multiple same-frame edits to FOV commit once according to descriptor policy;
- rapid input submits only the final valid value for last-write-wins
  descriptors unless a descriptor explicitly chooses another policy;
- invalid input is rejected or constrained by descriptor policy with visible
  control state, not by mutating runtime private state;
- UI refreshes from committed value, not local optimistic state;
- another Inspector refreshes to the committed value on the next frame;
- Camera3 Gizmo still works and does not share Inspector UI state;
- no direct DOM or component field mutation from property controls.

## Gate 4: Hardening

Purpose: make the feature stable enough to extend.

Work:

1. Component attach/detach:
   - sections appear/disappear without stale rows.
2. Actor destruction:
   - locked Inspector on destroyed actor shows missing state;
   - no stale property controls keep mutating dead components.
3. Multi Inspector:
   - one locked, one unlocked;
   - edits in one Inspector refresh other Inspectors after commit.
4. Boundary tests:
   - no Inspector descriptor registry in actor-system or ui-framework;
   - no DOM click shortcut in Inspector controls;
   - no direct Camera3 internals from generic controls.
5. Browser smoke:
   - select Camera3 in Hierarchy;
   - verify Component sections include Camera3 motion;
   - move Camera3 with gizmo and verify read-only camera values refresh without
     changing selection;
   - edit FOV;
   - verify Scene changes and Inspector displays committed value;
   - verify Debug diagnostics and dock/menu interactions still work.

Exit:

- Inspector component/property feature is no longer a prototype path;
- ordinary follow-ups can add descriptors and property kinds without changing
  the interaction architecture.

## Stop Conditions

Stop and revise the plan if:

- property editing requires actor-system to know Inspector, UI, DOM, or frame
  repaint semantics;
- ui-framework needs Camera3/Inspector-specific property concepts;
- Component definitions must carry Editor-only metadata;
- Camera FOV editing can only be implemented by mutating Three camera objects
  directly from Inspector;
- `packages/editor` must depend on `wallpaper-runtime` for product/runtime
  component descriptors;
- editable number fields require Inspector-private DOM input shortcuts instead
  of a generic ui-framework control contract;
- multiple Inspector instances require multiple property edit controllers to
  edit the same app/editor runtime;
- Dock/window lifecycle is forced into the Inspector property controller;
- section actors are required just to display simple component rows.

## Validation Matrix

Targeted:

```text
npm run test -w editor -- inspector
npm run test -w wallpaper-tesseract -- architecture-boundaries
npm run typecheck -w editor
npm run build -w editor
```

When editing ui-framework controls:

```text
npm run test -w ui-framework -- button toggle toolbar
npm run typecheck:test -w ui-framework
npm run build -w ui-framework
```

When editing runtime/camera commands:

```text
npm run test -w runtime-core
npm run test -w runtime-three -- runtime-three-camera-motion-controller
npm run test -w wallpaper-runtime -- camera3-components
npm run typecheck
```

Before handoff for any gate that touches visible Inspector behavior or runtime
commands:

```text
npm run test
npm run typecheck
npm run build
```

Final visible gates:

```text
npm run prism:smoke:prepare
npm run dev -w wallpaper-tesseract
```

Collect fresh smoke data under `temp/` for the first visible Component section
gate and the first editable Camera FOV gate.
