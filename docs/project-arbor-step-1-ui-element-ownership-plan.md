# Project Arbor Step 1: UI Element Ownership

Status: detailed execution plan  
Parent plan: `docs/project-arbor-ui-framework-actor-layout-plan.md`  
Scope: `packages/ui-framework` only

## Objective

Create the smallest generic DOM element ownership component needed by Project
Arbor. This step introduces `UiElementComponent` as the same-actor DOM root
provider for later layout, menu, viewport, and fullscreen components.

This step must not migrate App Menu, Scene, Editor, or window surface behavior.
It is foundation work only.

## Architectural Rule

An actor-backed UI control should not hide DOM ownership inside every leaf
component. The actor should have one generic component that exposes its root
element, and other same-actor UI components should depend on that generic
element component instead of each creating their own parent/root DOM.

`UiElementComponent` is not a layout manager. It does not inspect child actors,
move sibling elements, compute menu state, resize render targets, or dispatch
window commands.

## Non-Goals

- Do not add `UiLayoutItemComponent`.
- Do not add `UiLayoutHostComponent`.
- Do not add menu components.
- Do not add render viewport or fullscreen components.
- Do not touch app-local `features/app-menu`.
- Do not touch `packages/editor/src/scene`.
- Do not change `WindowFrameSurfaceComponent`.
- Do not add actor-core APIs.
- Do not add a global UI registry.
- Do not create compatibility exports for future components.

## Target Files

Add:

```text
packages/ui-framework/src/ui/element/ui-element-component.ts
packages/ui-framework/src/ui/element/ui-element-definition.ts
packages/ui-framework/src/ui/element/ui-element-component.test.ts
packages/ui-framework/src/ui/element/index.ts
```

Update:

```text
packages/ui-framework/src/index.ts
```

Do not create broader files such as `ui-controls.ts`, `ui-components.ts`, or
`ui-framework.ts`.

## Public API Shape

Keep the public surface narrow and explicit.

Proposed names:

```ts
export const uiElementComponentType =
  "ui-element-component" as ComponentType<UiElementComponent>;

export type UiElementOwnership = "owned" | "borrowed";

export interface UiElementComponentOptions {
  readonly id?: string;
  readonly element?: HTMLElement;
  readonly tagName?: keyof HTMLElementTagNameMap;
  readonly className?: string;
  readonly hidden?: boolean;
  readonly interactable?: boolean;
  readonly ownership?: UiElementOwnership;
  readonly document?: Pick<Document, "createElement">;
}
```

`element` and `ownership` rules:

- If `element` is omitted, the component creates an element and ownership is
  `owned`.
- If `element` is provided, ownership defaults to `borrowed`.
- If `element` is provided with `ownership: "owned"`, the caller transfers DOM
  removal responsibility to this component.
- If `element` is omitted with `ownership: "borrowed"`, construction should
  throw because there is no external owner to borrow from.
- If `element` and `tagName` are both provided, construction should throw.
  `tagName` only applies when `UiElementComponent` creates the element.
- If `element` and `document` are both provided, `document` is ignored for
  creation but may still be accepted for type consistency. Do not read from it
  while borrowing.
- If a borrowed `element` is provided with `className`, `hidden`, or
  `interactable`, the component must snapshot the previous generic state and
  restore it on dispose.

Component surface:

```ts
export class UiElementComponent implements Component {
  readonly element: HTMLElement;
  readonly ownership: UiElementOwnership;
  readonly type = uiElementComponentType;
  readonly actor: Actor;
  readonly id: string;
  enabled: boolean;

  setHidden(hidden: boolean): void;
  setInteractable(interactable: boolean): void;
  dispose(): void;
}
```

Definition:

```ts
export const uiElementComponentDefinition:
  ComponentDefinition<UiElementComponent, UiElementComponentOptions>;
```

Do not expose helper internals unless a real production caller appears in a
later step.

## Ownership Semantics

`owned` element:

- Created by the component or explicitly transferred to it.
- `dispose()` removes the element from the DOM.
- `dispose()` is idempotent.
- After dispose, `enabled` is false.

`borrowed` element:

- Supplied by an external owner.
- `dispose()` must not call `element.remove()`.
- `dispose()` must restore every generic DOM state that `UiElementComponent`
  applied to the borrowed element:
  - original `className`;
  - original `hidden`;
  - original `data-ui-interactable` attribute presence/value.
- Do not store a parent pointer for borrowed cleanup yet. Parent layout slots
  are Step 3 work, not Step 1.

Hidden/interactable:

- `setHidden(true)` should use `element.hidden = true`.
- `setInteractable` must use one expression only:
  `element.dataset.uiInteractable = String(interactable)`.
- Step 1 must not write `style.pointerEvents`. Pointer blocking belongs to
  later control/layout CSS or actor-input behavior after real callers prove the
  need.
- Do not introduce product-specific active/visible state.

## Implementation Steps

### 1. Create `ui/element` Directory

Create:

```text
packages/ui-framework/src/ui/element/
```

Keep this directory only for the element component and its definition. Later
layout/menu/viewport components get separate sibling directories.

### 2. Implement `UiElementComponent`

Implement constructor validation:

- Resolve `document` from options or global `document`.
- If creating an element, use `tagName ?? "div"`.
- If borrowing an element, do not require `document`.
- Throw if `element` and `tagName` are both provided.
- Throw if `ownership: "borrowed"` is requested without an external `element`.
- Apply optional `className`, `hidden`, and `interactable`.
- Snapshot borrowed element generic state before applying optional state.
- Store the effective ownership mode.

Avoid:

- No actor tree reads.
- No component registry reads.
- No append to parent.
- No layout slot concepts.
- No frame update attachment.

### 3. Implement Component Definition

Add `ui-element-definition.ts`.

Rules:

- `singleton: true`.
- `createId` returns `options.id ?? "ui-element"`.
- `create` returns `new UiElementComponent(actor, options ?? {})`.
- Do not add requirements or attachments in Step 1.

### 4. Add Local Index

Add `ui/element/index.ts` that exports:

- `UiElementComponent`
- `uiElementComponentType`
- `UiElementComponentOptions`
- `UiElementOwnership`
- `uiElementComponentDefinition`

Do not export tests, helpers, or unneeded implementation details.

### 5. Update `ui-framework` Root Index

Add one explicit export line:

```ts
export * from "./ui/element";
```

Do not add `export * from "./ui"` in Step 1. The root `ui` barrel can wait
until more than one primitive exists and there is a real simplification.

### 6. Add Unit Tests

Create `ui-element-component.test.ts`.

Required tests:

- Creates an owned `div` by default.
- Creates an owned custom tag when `tagName` is supplied.
- Providing `element` without `ownership` defaults to borrowed.
- Providing `element` with `tagName` throws.
- Providing `element` with `document` does not create or replace the borrowed
  element.
- Applies `className`, initial `hidden`, and initial `interactable`.
- `setHidden` updates `element.hidden`.
- `setInteractable` updates only `data-ui-interactable`.
- Repeated `setHidden` and `setInteractable` calls do not produce extra DOM
  mutations beyond the final generic state.
- Disposing an owned created element removes it from its parent.
- Disposing an owned transferred element removes it from its parent.
- Disposing a borrowed element does not remove it from its parent.
- Disposing a borrowed element leaves its parent/children relationships intact.
- Disposing a borrowed element restores `className`, `hidden`, and
  `data-ui-interactable` values that were present before construction.
- `dispose()` is idempotent for owned and borrowed elements.
- Throws when `ownership: "borrowed"` is requested without an external
  `element`.
- Throws when no document exists and the component needs to create an element.

Test style:

- Use tiny fake document/element helpers if existing DOM test helpers are not
  available.
- Do not add jsdom or a browser-only dependency just for Step 1.
- Keep fake element behavior local to the test file.

### 7. Add Definition Tests

Either extend the same test file or add a small section that proves:

- `uiElementComponentDefinition` is singleton.
- Default component id is `ui-element`.
- Supplied id is respected.
- Component can be added through `ComponentRegistry` after explicitly
  registering the definition with `registry.registerDefinition(...)` or the
  existing `installComponentDefinition(...)` helper.
- Singleton duplicate addition is rejected by the registry; do not add a custom
  duplicate guard to `UiElementComponent`.

### 8. Run Targeted Validation

Run:

```powershell
npm run test -w ui-framework -- ui-element
npm run typecheck:test -w ui-framework
npm run build -w ui-framework
```

If `typecheck:test` exposes unrelated existing failures, stop and inspect
whether they are real current debt. Do not relax strict checks or hide the
failure.

### 9. Grep Exit Gate

Run:

```powershell
rg -n "Scene|Camera3|Tesseract|Debug|Hierarchy|wallpaper-runtime|features/app-menu|WindowFrameSurfaceComponent" packages/ui-framework/src/ui/element --glob "!*.test.ts"
rg -n "UiLayoutItem|UiLayoutHost|MenuBarComponent|RenderViewportComponent|FullscreenableViewComponent" packages/ui-framework/src/ui/element --glob "!*.test.ts"
```

Expected result:

- First grep has no production matches.
- Second grep has no production matches.

The Step 1 component must remain generic and standalone.

## Completion Criteria

Step 1 is complete when:

- `UiElementComponent` exists in `packages/ui-framework/src/ui/element`.
- DOM ownership is explicit and covered by tests.
- Borrowed DOM is not removed on dispose.
- Owned DOM is removed on dispose.
- The component has no layout, menu, viewport, fullscreen, Scene, or app-local
  responsibilities.
- Root `ui-framework` public exports expose only the Step 1 element API.
- Targeted tests, test typecheck, and package build pass.

## Handoff Notes For Step 2

Step 2 may depend on `UiElementComponent` by reading the same actor's element
through the component registry. It should not change Step 1 ownership semantics.

If Step 2 discovers that `UiElementComponent` needs a parent-slot attach API,
do not patch that into Step 1 retroactively. Put that behavior in the layout
host/item ownership path unless repeated review proves element ownership itself
needs it.
