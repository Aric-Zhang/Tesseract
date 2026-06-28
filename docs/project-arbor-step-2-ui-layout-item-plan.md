# Project Arbor Step 2: UI Layout Item Declaration

Status: completed 2026-06-27  
Created: 2026-06-27  
Amended: 2026-06-27  
Parent plan: `docs/project-arbor-ui-framework-actor-layout-plan.md`  
Depends on: `docs/project-arbor-step-1-ui-element-ownership-plan.md`  
Scope: `packages/ui-framework` only

## Objective

Add `UiLayoutItemComponent`, the smallest actor-backed layout declaration
needed before a parent layout host exists.

This step does not lay out anything. It gives an actor a typed, mutable
description of how its already-owned or borrowed DOM element wants to
participate in the future parent layout:

```text
Control Actor
  UiElementComponent
  UiLayoutItemComponent(slot: top | fill | overlay | ...)
```

The component must be useful to Step 3's `UiLayoutHostComponent`, but it must
not become a hidden host, DOM slot manager, actor-tree observer, or second UI
tree.

## Architectural Rule

The actor tree and component registry remain the UI composition truth.

`UiLayoutItemComponent` is a same-actor declaration:

- It requires a same-actor `UiElementComponent`.
- It exposes that element to the future parent layout host.
- It stores a layout descriptor owned by the same actor.
- It never mutates DOM siblings or parent layout.
- It never reads child actors, parent actors, or product/window state.

Parent layout behavior belongs to Step 3. Menu, viewport, fullscreen, App Menu,
Scene, and Editor migration remain out of scope.

## Non-Goals

- Do not add `UiLayoutHostComponent`.
- Do not add menu, viewport, fullscreen, toolbar, or status bar components.
- Do not migrate App Menu or Scene.
- Do not touch `WindowFrameSurfaceComponent`.
- Do not touch `actor-core`.
- Do not add actor tree observers.
- Do not add a global UI registry or layout registry.
- Do not add CSS, parent slots, overlay containers, or DOM append/remove logic.
- Do not make `UiElementComponent` responsible for layout attachment.
- Do not introduce product concepts such as Scene, Camera3, Debug, Hierarchy,
  Inspector, wallpaper runtime, dock graph, or window commands.

## Target Files

Add:

```text
packages/ui-framework/src/ui/layout/ui-layout-types.ts
packages/ui-framework/src/ui/layout/ui-layout-item-component.ts
packages/ui-framework/src/ui/layout/ui-layout-item-definition.ts
packages/ui-framework/src/ui/layout/ui-layout-item-component.test.ts
packages/ui-framework/src/ui/layout/index.ts
```

Update:

```text
packages/ui-framework/src/index.ts
docs/project-arbor-ui-framework-actor-layout-plan.md
docs/current-project-progress.md
```

Do not create broader catch-all files such as `ui-controls.ts`,
`layout-components.ts`, or `ui/index.ts` in this step. Root exports should stay
explicit.

## Public API Shape

Keep the public surface narrow and declarative.

```ts
export type UiLayoutSlot =
  | "top"
  | "bottom"
  | "left"
  | "right"
  | "fill"
  | "overlay";

export type UiLayoutStretch =
  | "none"
  | "horizontal"
  | "vertical"
  | "both";

export interface UiLayoutSize {
  readonly width?: number;
  readonly height?: number;
}

export interface UiLayoutItemDescriptor {
  readonly slot: UiLayoutSlot;
  readonly order: number;
  readonly layer: number;
  readonly stretch: UiLayoutStretch;
  readonly minSize?: UiLayoutSize;
  readonly preferredSize?: UiLayoutSize;
}

export interface UiLayoutItemComponentOptions {
  readonly id?: string;
  readonly slot?: UiLayoutSlot;
  readonly order?: number;
  readonly layer?: number;
  readonly stretch?: UiLayoutStretch;
  readonly minSize?: UiLayoutSize | null;
  readonly preferredSize?: UiLayoutSize | null;
}

export type UiLayoutItemUpdate = Partial<
  Omit<UiLayoutItemComponentOptions, "id">
>;
```

Defaults:

- `slot`: `"fill"`
- `order`: `0`
- `layer`: `0`
- `stretch`: `"both"`
- `minSize`: omitted
- `preferredSize`: omitted

Default stretch intentionally does not infer from slot in Step 2. Slot-specific
layout policy belongs to the future layout host or explicit callers, not the
declarative item.

Size clearing semantics:

- Omitting `minSize` or `preferredSize` in `setLayout(update)` preserves the
  current value.
- Passing `minSize: null` or `preferredSize: null` clears that size.
- Passing `undefined` should be treated the same as omission for update
  objects. Do not use `undefined` as the explicit clear signal.
- Construction options may pass `null`; normalize it to omitted.
- Use `Object.hasOwn(...)` or an equivalent own-property check to distinguish
  "not provided" from "provided as null".

Component surface:

```ts
export const uiLayoutItemComponentType =
  "ui-layout-item-component" as ComponentType<UiLayoutItemComponent>;

export class UiLayoutItemComponent implements Component {
  readonly type = uiLayoutItemComponentType;
  readonly actor: Actor;
  readonly id: string;
  readonly element: HTMLElement;
  enabled: boolean;

  get descriptor(): UiLayoutItemDescriptor;
  setLayout(update: UiLayoutItemUpdate): void;
  dispose(): void;
}
```

Descriptor immutability:

- Normalize by copying every supplied size object.
- The stored descriptor must not retain references to caller-provided
  `options`, `update`, `minSize`, or `preferredSize` objects.
- The `descriptor` getter must not expose a mutable internal object. Return a
  clone or a deeply frozen descriptor.
- Mutating the original options/update objects after construction or
  `setLayout` must not change component state.
- Mutating a descriptor object returned by the getter must not change component
  state.

Definition:

```ts
export const uiLayoutItemComponentDefinition:
  ComponentDefinition<UiLayoutItemComponent, UiLayoutItemComponentOptions>;
```

Do not expose helper internals unless a real production caller appears in a
later step.

## Same-Actor Dependency Contract

`UiLayoutItemComponent` must depend on the same actor's `UiElementComponent`.

Definition rules:

- `singleton: true`
- `requires: [{ type: uiElementComponentType, autoAdd: false, reuseExisting: true }]`
- `createId` returns `options.id ?? "ui-layout-item"`.
- `create` must read the same actor's `UiElementComponent` from
  `context.componentRegistry.getComponent(actor, uiElementComponentType)`.
- If the dependency is unexpectedly missing, throw a direct error instead of
  creating an element or silently continuing.

This is deliberate. Step 2 must not auto-add an element because that would hide
DOM ownership. The caller must choose the element ownership contract first.

Implementation shape:

```ts
create(actor, context, options) {
  const uiElement = context.componentRegistry.getComponent(
    actor,
    uiElementComponentType
  );
  if (!uiElement) {
    throw new Error("UiLayoutItemComponent requires UiElementComponent.");
  }
  return new UiLayoutItemComponent(actor, uiElement, options);
}
```

The component constructor may accept `UiElementComponent` directly. It should
store `uiElement.element` as its `element` and should not mutate
`UiElementComponent` state.

## Descriptor Validation

Validate descriptor values both during construction and `setLayout`.

Rules:

- `slot` must be one of the supported slot strings.
- `stretch` must be one of the supported stretch strings.
- `order` and `layer` must be finite numbers.
- `null` is invalid for `slot`, `stretch`, `order`, and `layer`. Only
  `minSize` and `preferredSize` use `null` as clear.
- `minSize.width`, `minSize.height`, `preferredSize.width`, and
  `preferredSize.height` must be finite non-negative numbers when supplied.
- Empty size objects are allowed but should be normalized away if doing so keeps
  descriptor equality simpler.
- Invalid `setLayout` calls must throw without partially changing the current
  descriptor.

Do not clamp invalid values. A silent clamp would create hidden layout facts.

## Mutation Semantics

`setLayout(update)` mutates only the component's own descriptor.

Allowed:

- Change slot/order/layer/stretch.
- Replace or clear min/preferred size descriptors.
- Leave `element` unchanged.

Forbidden:

- `append`, `remove`, `replaceChildren`, `insertBefore`, or parent DOM writes.
- Direct style writes such as `element.style...`.
- Actor tree reads such as `listChildren`, `getParentId`, or `ActorSystemView`.
- Component registry reads outside construction/definition dependency lookup.
- Layout refresh notifications, global events, or parent invalidation services.

The future `UiLayoutHostComponent` is responsible for observing or polling
layout item descriptors and then applying DOM layout. Step 2 should not invent
that channel early.

## Implementation Steps

### 0. Verify Step 1 Borrowed Restore Gate

Before implementing layout item, verify the Step 1 direct defect is fixed:

- Borrowed `UiElementComponent` must restore only generic DOM fields that the
  component actually wrote.
- A borrowed element that is only exposed as a root, with no `className`,
  `hidden`, or `interactable` write by `UiElementComponent`, must not have
  external owner changes rolled back on dispose.
- Tests must cover that external owner changes to `className`, `hidden`, and
  `data-ui-interactable` survive dispose when `UiElementComponent` did not
  write those fields.

If this gate fails, fix Step 1 first and rerun:

```powershell
npm run test -w ui-framework -- ui-element
npm run typecheck:test -w ui-framework
```

Do not implement Step 2 on top of ambiguous borrowed DOM ownership.

### 1. Create `ui/layout` Directory

Create:

```text
packages/ui-framework/src/ui/layout/
```

Keep this directory limited to the Step 2 layout item files. Do not add host,
dock layout, menu, viewport, or fullscreen files yet.

### 2. Add Layout Types

Create `ui-layout-types.ts` with:

- `UiLayoutSlot`
- `UiLayoutStretch`
- `UiLayoutSize`
- `UiLayoutItemDescriptor`
- `UiLayoutItemComponentOptions`
- `UiLayoutItemUpdate`

Keep these types product-agnostic and DOM-light. They may describe element
layout contribution, but they must not mention `WindowFrame`, dock graph,
Scene, menu, Camera3, or runtime terms.

### 3. Implement Descriptor Normalization

Inside `ui-layout-item-component.ts`, add small local helpers:

- `createDefaultDescriptor()`
- `normalizeDescriptor(options)`
- `mergeDescriptor(current, update)`
- validation helpers for slot/stretch/number/size

Keep helpers file-private unless tests need only public behavior. Do not create
a reusable validation library in Step 2.

Implementation requirements:

- `normalizeDescriptor` must clone supplied size objects.
- `mergeDescriptor` must validate the complete next descriptor before returning
  it.
- `mergeDescriptor` must preserve old size values when update keys are omitted.
- `mergeDescriptor` must clear old size values when update keys are present
  with `null`.
- Invalid updates must not partially mutate the current descriptor.

### 4. Implement `UiLayoutItemComponent`

Rules:

- Constructor takes `(actor, uiElement, options)`.
- Store `element = uiElement.element`.
- Store a normalized descriptor.
- `descriptor` getter returns a clone or deeply frozen descriptor, never the
  mutable internal object.
- `setLayout(update)` validates the full next descriptor before assignment.
- `dispose()` sets `enabled = false` and does not touch DOM.
- `dispose()` is idempotent.

Do not call any `UiElementComponent` methods from this component. Hidden and
interactable state remain owned by the element/control layer, not layout item.

### 5. Implement Component Definition

Create `ui-layout-item-definition.ts`.

Rules:

- Register `uiLayoutItemComponentType`.
- Set `singleton: true`.
- Require same-actor `uiElementComponentType` with `autoAdd: false`.
- Read the existing element component through the definition context.
- Do not add attachments.
- Do not install this definition automatically yet.

### 6. Add Local Index

Create `ui/layout/index.ts` exporting:

- layout types;
- `UiLayoutItemComponent`;
- `uiLayoutItemComponentType`;
- `uiLayoutItemComponentDefinition`.

Do not export file-private validation helpers.

### 7. Update Root `ui-framework` Export

Add one explicit root export:

```ts
export * from "./ui/layout";
```

Keep the existing explicit `./ui/element` export. Do not add a broad
`export * from "./ui"` barrel in Step 2.

### 8. Add Unit Tests

Create `ui-layout-item-component.test.ts`.

Required tests:

- Adding a layout item through `ComponentRegistry` succeeds when the actor
  already has `UiElementComponent`.
- Adding a layout item fails when the same actor lacks `UiElementComponent`.
- The layout item reads and exposes the exact same element from the same
  actor's `UiElementComponent`.
- Default descriptor is `{ slot: "fill", order: 0, layer: 0, stretch: "both" }`.
- Supplied `slot`, `order`, `layer`, `stretch`, `minSize`, and `preferredSize`
  are preserved.
- `setLayout` updates slot/order/layer/stretch without changing the element.
- `setLayout` can set/replace/clear optional size descriptors.
- Omitting `minSize`/`preferredSize` in `setLayout` preserves existing values.
- Passing `minSize: null` or `preferredSize: null` clears the corresponding
  value.
- Invalid clear/update input throws without producing a half-updated
  descriptor.
- Mutating the original constructor options object after construction does not
  change the component descriptor.
- Mutating the original update object after `setLayout` does not change the
  component descriptor.
- Mutating size objects nested inside options/update objects after use does not
  change the component descriptor.
- Mutating the descriptor object returned by the getter does not change the
  component descriptor.
- Invalid slot/stretch/order/layer/size values throw.
- Invalid `setLayout` leaves the previous descriptor unchanged.
- `dispose()` disables the component but does not remove or move the element.
- Repeated `dispose()` is safe.
- Duplicate layout item on the same actor is blocked by registry singleton
  behavior.

DOM mutation proof:

- Use the Step 1 fake element shape or a local equivalent.
- Attach the element to a fake parent.
- After `setLayout` and `dispose`, assert the parent/children relationship is
  unchanged.

Dependency proof:

- Register both `uiElementComponentDefinition` and
  `uiLayoutItemComponentDefinition`.
- Add `UiElementComponent` explicitly before adding the layout item.
- For the missing dependency test, register both definitions but do not add the
  element. The expected failure should come from the required same-actor
  dependency, not from an unregistered definition and not from a create-time
  fallback that silently creates a `UiElementComponent`.

### 9. Keep Step 1 Untouched Unless A Defect Is Found

After Step 0 passes, do not expand `UiElementComponent` with parent-slot
attachment APIs for Step 2. If the layout item seems to need parent/slot state,
stop and re-check whether that state belongs to Step 3's host instead.

Only fix additional Step 1 code if another direct defect is discovered. Do not
change its public contract for layout convenience.

## Validation Commands

Run targeted checks:

```powershell
npm run test -w ui-framework -- ui-layout-item
npm run typecheck:test -w ui-framework
npm run build -w ui-framework
```

Then run grep gates:

```powershell
rg -n "append|remove\(|replaceChildren|insertBefore|parentElement|children|style\." packages/ui-framework/src/ui/layout --glob "!*.test.ts"
rg -n "ActorSystemView|listChildren|getParentId|UiLayoutHost|MenuBarComponent|RenderViewportComponent|FullscreenableViewComponent" packages/ui-framework/src/ui/layout --glob "!*.test.ts"
rg -n "Scene|Camera3|Tesseract|Debug|Hierarchy|Inspector|wallpaper-runtime|features/app-menu|WindowFrameSurfaceComponent|WindowWorkspaceGraph" packages/ui-framework/src/ui/layout --glob "!*.test.ts"
```

Expected result:

- First grep has no production matches.
- Second grep has no production matches.
- Third grep has no production matches.

Test files may mention forbidden words only when asserting the boundary itself.
Production files should not.

## Completion Criteria

Step 2 is complete when:

- `UiLayoutItemComponent` exists under `packages/ui-framework/src/ui/layout`.
- It requires a same-actor `UiElementComponent`.
- It exposes the same actor's element for future parent layout.
- It stores and mutates only a validated descriptor.
- It performs no DOM parent/sibling mutation.
- It reads no actor tree parent/child facts.
- It introduces no global registry, host, menu, viewport, fullscreen, Scene, or
  App Menu behavior.
- Targeted tests, test typecheck, package build, and grep gates pass.

## Handoff Notes For Step 3

Step 3 may introduce `UiLayoutHostComponent`.

That host should be the first owner allowed to:

- read direct child actors;
- gather child `UiLayoutItemComponent` descriptors;
- append/reorder child elements into layout regions;
- decide how top/bottom/left/right/fill/overlay consume space.

If Step 3 needs actor tree lifecycle observation, first try deterministic
rebuilds from `ActorSystemView.listChildren(...)` during refresh/frame update.
Only consider actor-core observer changes if repeated review shows a
framework-agnostic lifecycle observation primitive is truly needed. UI-specific
layout or DOM semantics must not enter actor-core.

## Execution Result

Completed on 2026-06-27.

Implemented:

```text
packages/ui-framework/src/ui/layout/ui-layout-types.ts
packages/ui-framework/src/ui/layout/ui-layout-item-component.ts
packages/ui-framework/src/ui/layout/ui-layout-item-definition.ts
packages/ui-framework/src/ui/layout/ui-layout-item-component.test.ts
packages/ui-framework/src/ui/layout/index.ts
```

Updated:

```text
packages/ui-framework/src/index.ts
```

Validation passed:

```powershell
npm run test -w ui-framework -- ui-element ui-layout-item
npm run test -w ui-framework -- ui-layout-item
npm run typecheck:test -w ui-framework
npm run build -w ui-framework
rg -n "append|remove\(|replaceChildren|insertBefore|parentElement|children|style\." packages/ui-framework/src/ui/layout --glob "!*.test.ts"
rg -n "ActorSystemView|listChildren|getParentId|UiLayoutHost|MenuBarComponent|RenderViewportComponent|FullscreenableViewComponent" packages/ui-framework/src/ui/layout --glob "!*.test.ts"
rg -n "Scene|Camera3|Tesseract|Debug|Hierarchy|Inspector|wallpaper-runtime|features/app-menu|WindowFrameSurfaceComponent|WindowWorkspaceGraph" packages/ui-framework/src/ui/layout --glob "!*.test.ts"
```

The three grep commands returned no matches. Step 2 did not add parent layout
host behavior, DOM sibling mutation, menu, viewport, fullscreen, App Menu,
Scene, or Editor migration work.

Post-review amendment:

- `slot`, `stretch`, `order`, and `layer` now reject `null` instead of treating
  it as omitted.
- Additional tests cover scalar `null` rejection during construction and
  `setLayout`.
