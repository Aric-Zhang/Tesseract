# Project Arbor Step 3: UI Layout Host

Status: completed 2026-06-28  
Created: 2026-06-27  
Amended: 2026-06-28  
Parent plan: `docs/project-arbor-ui-framework-actor-layout-plan.md`  
Depends on:

```text
docs/project-arbor-step-1-ui-element-ownership-plan.md
docs/project-arbor-step-2-ui-layout-item-plan.md
```

Scope: `packages/ui-framework` only

## Objective

Add `UiLayoutHostComponent`, the first Project Arbor component allowed to read
direct child actors and move child UI elements into a deterministic parent
layout.

This step proves the core authoring model:

```text
Host Actor
  UiElementComponent
  UiLayoutHostComponent

  Top Child Actor
    UiElementComponent
    UiLayoutItemComponent(slot: top)

  Fill Child Actor
    UiElementComponent
    UiLayoutItemComponent(slot: fill)

  Overlay Child Actor
    UiElementComponent
    UiLayoutItemComponent(slot: overlay, layer: 10)
```

Adding, removing, disabling, or reparenting child actors should be reflected by
a normal layout refresh or frame update. No caller should notify the parent host
with a control-specific API.

## Entry Gates

Before starting implementation:

- Step 1 must have the borrowed element restore fix:
  borrowed `UiElementComponent` restores only fields it actually wrote.
- Step 2 must have the scalar `null` validation fix:
  `slot`, `stretch`, `order`, and `layer` reject `null`; only
  `minSize` / `preferredSize` use `null` as clear.
- These commands must pass:

```powershell
npm run test -w ui-framework -- ui-element ui-layout-item
npm run typecheck:test -w ui-framework
```

Do not build a host on top of ambiguous element ownership or descriptor
mutation semantics.

## Architecture Contract

`UiLayoutHostComponent` is the first and only Step 3 owner allowed to:

- read `ActorSystemView.listChildren(hostActor)`;
- read each direct child's `UiLayoutItemComponent`;
- append/reorder direct child elements into host-owned layout regions;
- decide how `top`, `bottom`, `left`, `right`, `fill`, and `overlay` slots are
  arranged.

It must not:

- create or destroy child actors;
- dispose child components;
- mutate `WindowWorkspaceGraph` or any window lifecycle state;
- import App Menu, Scene, Camera3, Tesseract, Debug, Hierarchy, Inspector, or
  wallpaper runtime code;
- introduce a global UI tree, layout registry, or product policy table;
- add actor-core APIs;
- write layout/DOM semantics into `actor-core`.

The actor tree and component registry remain the source of truth.

## DOM Ownership Contract

Host actor:

- owns one `UiElementComponent` root element;
- receives `UiLayoutHostComponent` on the same actor.

Host component:

- creates one owned internal layout root element inside the host root;
- creates owned slot/region elements inside that internal root;
- creates owned wrapper elements for child contributions;
- may write classes, dataset fields, and inline styles only on host-owned
  layout root, region elements, and wrapper elements;
- must not write class, dataset, hidden, interactable, or style state on child
  actor elements;
- must not remove or dispose child actor elements.
- must not call `replaceChildren` or clear the host root element.
- must preserve any pre-existing non-host-owned children in the host root.
- must remove only its own internal root on dispose.

Child elements:

- remain owned by their child actor's `UiElementComponent`;
- may be moved by the parent host into host-owned wrappers;
- are detached from host-owned wrappers before wrappers/regions are removed on
  host dispose.
- Adding `UiLayoutItemComponent` to a child actor means that child's DOM
  placement is delegated to its direct parent `UiLayoutHostComponent` while the
  child remains under that parent in the actor tree.
- This delegation applies to both owned and borrowed child elements. Step 3
  does not limit layout participation to owned child roots.
- If a borrowed child element had an earlier DOM parent outside the host, the
  host does not remember or restore that old parent. On stale contribution,
  reparent, host disable, or host dispose, the host only detaches the child
  element from host-owned wrappers.
- External owners that need a borrowed DOM element to keep its old parent must
  not add `UiLayoutItemComponent` under this host.

This avoids borrowed-root restore debt and keeps child element styling/layout
facts owned by the parent host wrappers instead of being smeared onto child
controls.

## Target Files

Add:

```text
packages/ui-framework/src/ui/layout/ui-layout-host-component.ts
packages/ui-framework/src/ui/layout/ui-layout-host-definition.ts
packages/ui-framework/src/ui/layout/ui-layout-host-component.test.ts
```

Update:

```text
packages/ui-framework/src/ui/layout/index.ts
docs/project-arbor-ui-framework-actor-layout-plan.md
docs/current-project-progress.md
```

Do not create App Menu, viewport, fullscreen, toolbar, or Scene files in this
step.

If the ordering/region algorithm becomes too large for the component file, add
one package-private helper file:

```text
packages/ui-framework/src/ui/layout/ui-dock-layout.ts
```

Do not export that helper unless a production caller outside the host component
appears.

## Public API Shape

Keep the public surface narrow.

```ts
export const uiLayoutHostComponentType =
  "ui-layout-host-component" as ComponentType<UiLayoutHostComponent>;

export interface UiLayoutHostComponentOptions {
  readonly id?: string;
}

export interface UiLayoutHostContributionSnapshot {
  readonly actorId: string;
  readonly slot: UiLayoutSlot;
  readonly order: number;
  readonly layer: number;
  readonly stretch: UiLayoutStretch;
  readonly minSize?: UiLayoutSize;
  readonly preferredSize?: UiLayoutSize;
}

export interface UiLayoutHostCommit {
  readonly revision: number;
  readonly contributions: readonly UiLayoutHostContributionSnapshot[];
}

export class UiLayoutHostComponent implements Component, FrameUpdateParticipant {
  readonly type = uiLayoutHostComponentType;
  readonly actor: Actor;
  readonly id: string;
  readonly element: HTMLElement;
  enabled: boolean;

  refreshLayout(): UiLayoutHostCommit;
  updateFrame(frame: UiFrame): void;
  dispose(): void;
}
```

Definition:

```ts
export const uiLayoutHostComponentDefinition:
  ComponentDefinition<UiLayoutHostComponent, UiLayoutHostComponentOptions>;
```

Do not expose region elements or wrapper elements as public API in Step 3. Tests
can inspect DOM structure through the host root element.

Commit immutability:

- `refreshLayout()` must return a clone or deeply frozen commit snapshot.
- The last commit stored by the component must not retain references to mutable
  caller-facing objects.
- Nested contribution `minSize` / `preferredSize` objects must be cloned or
  frozen.
- Mutating a returned commit, contribution, or nested size object must not
  change the component's internal last commit or future returned commits.
- Disabled/disposed `refreshLayout()` returns an immutable snapshot of the last
  commit, not the mutable internal object.

Stable diagnostics:

- Internal root must expose `data-ui-layout-root="true"`.
- Region elements must expose
  `data-ui-layout-region="top|middle|left|fill|right|bottom|overlay"`.
- Wrapper elements must expose:
  - `data-ui-layout-actor-id`
  - `data-ui-layout-slot`
  - `data-ui-layout-order`
  - `data-ui-layout-layer`
  - `data-ui-layout-stretch`
- If wrapper style or sizing is applied from `minSize` / `preferredSize`, expose
  matching diagnostics such as `data-ui-layout-min-width`,
  `data-ui-layout-min-height`, `data-ui-layout-preferred-width`, and
  `data-ui-layout-preferred-height`.

Tests and future smoke should use these dataset facts instead of relying on
class names or brittle positional guesses.

## Component Definition Contract

`UiLayoutHostComponent` must depend on the same actor's `UiElementComponent`.

Definition rules:

- `singleton: true`
- `requires: [{ type: uiElementComponentType, autoAdd: false, reuseExisting: true }]`
- `attachments: [frameUpdateAttachment]`
- `createId` returns `options.id ?? "ui-layout-host"`.
- `create` reads the same actor's `UiElementComponent` from
  `context.componentRegistry`.
- `create` passes `context.actorSystem` and `context.componentRegistry` into the
  host component as read-only views.

The frame update attachment already exists in `ui-framework`. Step 3 must not
add a new scheduler service or a new observation runtime.

## Layout Model

Use a stable internal region tree:

```text
host root element (from UiElementComponent)
  ui-layout-host internal root (owned by UiLayoutHostComponent)
    top region
    middle region
      left region
      fill region
      right region
    bottom region
    overlay region
```

Slot placement:

- `top` -> top region
- `bottom` -> bottom region
- `left` -> left region
- `right` -> right region
- `fill` -> fill region
- `overlay` -> overlay region

Ordering:

- `top`, `bottom`, `left`, `right`, and `fill` children sort by:
  1. `order`
  2. actor tree child order
- `overlay` children sort by:
  1. `layer`
  2. `order`
  3. actor tree child order

Multiple `fill` children are allowed in Step 3 and are appended in deterministic
order. Step 3 should not add single-fill policy unless a real caller requires
it.

Contribution filter:

- Only direct children of the host actor are considered.
- Child actor must be active according to `ActorSystemView.isActorActive`.
- Child must have an enabled `UiLayoutItemComponent`.
- The layout item's element is the child element to place.
- Children without `UiLayoutItemComponent` are ignored.

## Refresh Algorithm

Prefer deterministic rebuilds over observer complexity.

`refreshLayout()` should:

1. Read direct child actors from `ActorSystemView.listChildren(actor)`.
2. Build contribution records from enabled child `UiLayoutItemComponent`
   instances.
3. Sort contributions by slot rules.
4. Create or reuse host-owned wrappers keyed by child actor id.
5. Apply wrapper class/dataset/style from the current descriptor.
6. Append each child element into its wrapper.
7. Append each wrapper into the correct host-owned region.
8. Remove stale wrappers after detaching any child elements they still contain.
9. Increment a local revision only when the committed layout signature changed.
10. Return a `UiLayoutHostCommit` snapshot.

`updateFrame()` should call `refreshLayout()`. Tests may call `refreshLayout()`
directly for deterministic assertions.

`refreshLayout()` disabled/disposed semantics:

- If `enabled === false`, return the last commit snapshot and perform no DOM
  mutation.
- If disposed, return the last commit snapshot and perform no DOM mutation.
- The initial last commit is revision `0` with no contributions.
- `updateFrame()` follows the same semantics because it delegates to
  `refreshLayout()`.

Commit signature:

- Avoid deep diff machinery in Step 3, but the signature must include every
  descriptor field that can affect wrapper DOM or diagnostics.
- Include at least:
  - contribution actor id;
  - slot;
  - order;
  - layer;
  - stretch;
  - normalized `minSize.width` / `minSize.height`;
  - normalized `preferredSize.width` / `preferredSize.height`;
  - active contribution order after sorting.
- Changing only `stretch`, `minSize`, or `preferredSize` must produce a new
  commit/revision and updated wrapper diagnostics/styles.

## Structural Layout Styling Contract

Step 3 must implement minimal real structural layout, not just DOM partitioning.
The first host must be sufficient for later Step 7.5 tests to prove a `top`
child consumes a row, `fill` receives the remaining space, and `overlay` sits
above fill.

The host must apply generic inline style only to host-owned internal root,
region, and wrapper elements.

Required minimal styles:

- internal root:
  - `display: flex`
  - `flexDirection: column`
  - `position: relative`
  - `width: 100%`
  - `height: 100%`
- middle region:
  - `display: flex`
  - `flexDirection: row`
  - `flex: 1 1 auto`
  - `minHeight: 0`
- fill region:
  - `flex: 1 1 auto`
  - `minWidth: 0`
  - `minHeight: 0`
- overlay region:
  - `position: absolute`
  - `inset: 0`
  - `pointerEvents: none`
- overlay wrappers:
  - `position: absolute`
  - `inset: 0`
  - `pointerEvents` may be restored to an interactable value on the wrapper
    when later controls need it; Step 3 should prefer wrapper-level facts and
    must not write child element interactable state.
- top/bottom/left/right wrappers:
  - size should follow `minSize` / `preferredSize` when supplied.
- wrapper order/layer/stretch/min/preferred diagnostics/styles;
- wrapper dataset `uiLayoutActorId`, `uiLayoutSlot`, `uiLayoutOrder`,
  `uiLayoutLayer`, `uiLayoutStretch`, and optional size diagnostics for
  test/smoke evidence.

Forbidden:

- style/class/dataset writes to child actor elements;
- product-specific classes;
- window frame or dock graph classes;
- menu/Scene/Camera-specific classes.

If a style choice is not required to prove structural layout behavior, prefer
class and dataset first. Keep the first host small, but do not defer the basic
top/fill/overlay layout to Step 7.5.

## Implementation Slices

The work is intentionally grouped into larger slices. Execute each slice
end-to-end instead of stopping after every tiny file addition.

### Slice 1: Host API, Region DOM, And Definition

Create:

```text
packages/ui-framework/src/ui/layout/ui-layout-host-component.ts
packages/ui-framework/src/ui/layout/ui-layout-host-definition.ts
```

Implement in the same slice:

- public host types:
  - `uiLayoutHostComponentType`
  - `UiLayoutHostComponentOptions`
  - `UiLayoutHostContributionSnapshot`
  - `UiLayoutHostCommit`
  - `UiLayoutHostComponent`
- component definition:
  - `singleton: true`
  - same-actor `uiElementComponentType` required with `autoAdd: false`
  - `attachments: [frameUpdateAttachment]`
  - read-only `ActorSystemView` and `ComponentRegistryView` passed to the host
- constructor behavior:
  - accept the same-actor `UiElementComponent`;
  - use `uiElement.element.ownerDocument` to create host-owned nodes;
  - create internal root and six stable regions;
  - append the internal root to `uiElement.element`;
  - do not modify the host root element's class/style/dataset;
  - preserve pre-existing host root children and remove only the internal root
    on dispose.

Region nodes should be stable for the component lifetime. Rebuild wrappers, not
the whole region tree, during normal refresh.

Keep helper types local unless later production callers need them.

### Slice 2: Contribution Collection, Commit, Refresh, And Dispose

Implement contribution collection and DOM commit in the same slice.

Collect only direct children:

```ts
for (const child of actorSystem.listChildren(actor)) {
  if (!actorSystem.isActorActive(child)) continue;
  const item = componentRegistry.getComponent(child, uiLayoutItemComponentType);
  if (!item?.enabled) continue;
  // contribution
}
```

Do not scan all actors. Do not recurse. Step 3 is direct-child layout only.

Implement `refreshLayout()` and a private `commitLayout(contributions)` that:

- sorts by the slot ordering rules;
- ensures a wrapper exists for each child actor id;
- appends the child element into the wrapper;
- appends the wrapper into the appropriate region;
- removes wrappers for no-longer-contributing child actors;
- increments revision only when the normalized signature changes;
- returns a commit snapshot that includes stretch and size fields.

Wrapper ownership rules:

- wrapper is host-owned;
- wrapper removal must not dispose child elements;
- if a wrapper is stale and still contains a child element, detach that child
  element before removing the wrapper.
- stale wrapper cleanup must not try to restore borrowed child elements to any
  old parent outside the host.

`refreshLayout()`:

- returns the last commit with no DOM mutation when disabled or disposed;
- updates wrapper diagnostics/styles when any descriptor field changes.
- returns an immutable commit snapshot.

`updateFrame()`:

- delegates to `refreshLayout()`.

`dispose()`:

- is idempotent;
- disables the component;
- detaches child elements from host-owned wrappers;
- does not restore borrowed child elements to their pre-layout DOM parent;
- removes wrappers;
- removes host-owned region/internal-root elements;
- does not remove the host root element;
- does not dispose child components or child elements;
- preserves host-root siblings that existed before or outside the host internal
  root.

### Slice 3: Exports And Tests

Update `ui/layout/index.ts` to export:

- host component type/class/options/commit types;
- `uiLayoutHostComponentDefinition`.

No root `ui` barrel.

Create `ui-layout-host-component.test.ts`.

Required tests:

- Adds host through `ComponentRegistry` when same actor has `UiElementComponent`.
- Fails through required dependency when same actor lacks `UiElementComponent`.
- Host constructor appends one internal layout root to the host root.
- Host constructor/refresh/dispose preserves unrelated existing children in the
  host root.
- Region and wrapper nodes expose stable dataset diagnostics.
- A `top` child and `fill` child are placed into their respective regions after
  `refreshLayout()`.
- Adding a child actor after host creation appears after `refreshLayout()`
  without a parent-specific notification call.
- Destroying/removing a child actor removes its wrapper after `refreshLayout()`.
- Reparenting a child away removes its wrapper after `refreshLayout()`.
- Reparenting the child back makes it reappear after `refreshLayout()`.
- Disabled child actor is removed from layout after `refreshLayout()`.
- Disabled layout item is removed from layout after `refreshLayout()`.
- `top`/`bottom`/`left`/`right`/`fill` ordering follows `order` then actor tree
  child order.
- `overlay` ordering follows `layer`, then `order`, then actor tree child
  order.
- `setLayout()` on a child item changes placement/order after host
  `refreshLayout()`.
- Changing only `stretch`, `minSize`, or `preferredSize` produces a new
  commit/revision and updates wrapper diagnostics/styles.
- Returned commit snapshots are immutable or cloned; mutating a returned
  commit, contribution, or nested size object does not affect later
  `refreshLayout()` results.
- `refreshLayout()` returns the last commit and performs no DOM mutation when
  the host is disabled.
- `refreshLayout()` returns the last commit and performs no DOM mutation after
  dispose.
- Host does not mutate child element `className`, `dataset`, `hidden`,
  `style`, or `data-ui-interactable`.
- Host applies required structural layout styles only to host-owned internal
  root, region, and wrapper elements.
- Host dispose removes only host-owned DOM and does not dispose/remove child
  actor elements.
- Host dispose leaves child elements alive and not removed from their owner.
- Borrowed child elements are detached from host wrappers on stale/remove or
  dispose and are not restored to their old external parent.
- Frame update attachment can call `updateFrame()` through the existing
  `FrameUpdateAttachmentRuntime`.

Use fake document/element helpers local to the test. Add only the fake DOM
capabilities the host actually uses.

### Slice 4: Scope Check And Validation

Do not add:

- menu components;
- render viewport;
- fullscreen behavior;
- app-local fixture migration;
- CSS files unless implementation proves class-only DOM is insufficient;
- actor-core observer APIs.

If Step 3 cannot satisfy automatic layout refresh with `updateFrame()` and
explicit `refreshLayout()`, stop and amend the plan before adding observers.

## Validation Commands

Run:

```powershell
npm run test -w ui-framework -- ui-layout-host ui-layout-item ui-element
npm run typecheck:test -w ui-framework
npm run build -w ui-framework
```

Run grep gates:

```powershell
rg -n "Scene|Camera3|Tesseract|Debug|Hierarchy|Inspector|wallpaper-runtime|features/app-menu|WindowFrameSurfaceComponent|WindowWorkspaceGraph" packages/ui-framework/src/ui/layout --glob "!*.test.ts"
rg -n "querySelector|localStorage|window\\.|globalThis|document\\.body" packages/ui-framework/src/ui/layout --glob "!*.test.ts"
rg -n "append|remove\\(|replaceChildren|insertBefore|parentElement|children|style\\." packages/ui-framework/src/ui/layout/ui-layout-item-component.ts
```

Expected result:

- First grep has no production matches.
- Second grep has no production matches.
- Third grep has no matches; DOM mutation remains host-owned, not item-owned.

No browser smoke is required for Step 3 because no app/editor feature migrates
yet. Browser smoke begins when Part II starts moving real App Menu or Scene UI
onto the new primitives.

## Completion Criteria

Step 3 is complete when:

- `UiLayoutHostComponent` exists in `packages/ui-framework/src/ui/layout`.
- It requires a same-actor `UiElementComponent`.
- It reads only direct child actors.
- It places child `UiLayoutItemComponent` elements into host-owned regions.
- It updates on explicit `refreshLayout()` and frame update.
- It treats disabled/disposed `refreshLayout()` as no-op and returns the last
  commit.
- Its returned commit snapshots are immutable or cloned.
- Its commit signature includes stretch and size descriptor fields.
- It implements minimal real top/fill/overlay structural layout styles on
  host-owned DOM.
- It owns and removes only its internal layout DOM.
- It preserves unrelated children already present in the host root.
- It exposes stable dataset diagnostics for regions and wrappers.
- It does not mutate child element generic state.
- It introduces no global registry, observer API, product concept, menu,
  viewport, fullscreen, App Menu, Scene, or Editor migration.
- Targeted tests, test typecheck, package build, and grep gates pass.

## Handoff Notes For Step 4

Step 4 may add generic menu components on top of this layout foundation.

Menu components should be ordinary child actors with `UiElementComponent` and
`UiLayoutItemComponent`. They must not reach into host internals. If a menu
needs a top row, it should declare `slot: "top"` and let the host place it.

Step 4 and later migrations must treat the `UiLayoutHostComponent` DOM structure
as private implementation detail:

- Do not branch product behavior on region/wrapper DOM hierarchy.
- Do not use `data-ui-layout-*` as product logic. These attributes are only
  diagnostic/smoke/test evidence.
- App Menu, Scene, Editor, and future controls must communicate layout by
  adding child actors with `UiElementComponent` + `UiLayoutItemComponent`, not
  by querying or mutating host regions.
- Any future package-private helper for host layout must remain package-private
  unless a real production caller requires a public contract. Do not export
  helper algorithms from `packages/ui-framework/src/index.ts` for convenience.

## Execution Result

Completed on 2026-06-28.

Implemented:

```text
packages/ui-framework/src/ui/layout/ui-layout-host-component.ts
packages/ui-framework/src/ui/layout/ui-layout-host-definition.ts
packages/ui-framework/src/ui/layout/ui-layout-host-component.test.ts
```

Updated:

```text
packages/ui-framework/src/ui/layout/index.ts
```

Validation passed:

```powershell
npm run test -w ui-framework -- ui-layout-host
npm run test -w ui-framework -- ui-layout-host ui-layout-item ui-element
npm run typecheck:test -w ui-framework
npm run build -w ui-framework
rg -n "Scene|Camera3|Tesseract|Debug|Hierarchy|Inspector|wallpaper-runtime|features/app-menu|WindowFrameSurfaceComponent|WindowWorkspaceGraph" packages/ui-framework/src/ui/layout --glob "!*.test.ts"
rg -n "querySelector|localStorage|window\.|globalThis|document\.body" packages/ui-framework/src/ui/layout --glob "!*.test.ts"
rg -n "append|remove\(|replaceChildren|insertBefore|parentElement|children|style\." packages/ui-framework/src/ui/layout/ui-layout-item-component.ts
```

The three grep commands returned no matches. Step 3 did not add menu,
viewport, fullscreen, App Menu, Scene, Editor migration, actor-core APIs, a
global registry, or product concepts.

Reviewer closure:

- Step 3 is accepted as complete.
- `UiLayoutHostComponent` is the sole Step 3 owner for reading direct child
  actors and moving child UI elements.
- Its region/wrapper DOM remains private, while `data-ui-layout-*` is reserved
  for diagnostics and smoke/test evidence only.
