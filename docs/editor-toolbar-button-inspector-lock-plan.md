# Editor Toolbar, Button, And Inspector Lock Plan

Status: planned  
Date: 2026-06-30  
Scope: two implementation gates plus one closure checklist. Gate 1 builds
generic `ui-framework` toolbar/button/toggle controls and collapses existing
button-like duplication. Gate 2 adopts those controls in `packages/editor`
Inspector. Gate 3 is validation/cleanup and may be executed at the end of Gate
2 if no separate blocker appears.

## Purpose

Add a reusable toolbar/button/toggle control layer so any window content can
compose common chrome through the actor tree:

- menu bars, toolbars, status bars, and body content are ordinary child actors
  arranged by `UiLayoutHostComponent`;
- toolbar buttons are ordinary child actors of a toolbar actor;
- Inspector gets a visible lock toggle in a top toolbar without inventing an
  Inspector-only DOM path;
- existing duplicated button-like behavior is either collapsed into the new
  shared control behavior or explicitly kept out of scope with a follow-up.

This plan continues the Arbor direction: actor tree -> component composition is
the UI fact source. Do not add compatibility DOM hooks, hidden registries, or
window-specific toolbar APIs.

## Reference Patterns

Mature UI systems converge on the same model:

- WAI-ARIA toolbar: a toolbar is a grouped container for controls such as
  buttons, menu buttons, checkboxes, and similar widgets.
  Reference: https://www.w3.org/WAI/ARIA/apg/patterns/toolbar/
- WAI-ARIA / MDN toggle button: a toggle is a button with pressed state,
  represented by `aria-pressed`, not a separate unrelated interaction model.
  References:
  https://www.w3.org/WAI/ARIA/apg/patterns/button/
  https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-pressed
- Qt: `QAbstractButton` owns common button state, while checkable/checked and
  tool-button variants layer on top of the same base behavior.
  Reference: https://doc.qt.io/qt-6/qabstractbutton.html
- Unity UI Toolkit: toolbar toggles are toolbar-styled toggle controls, not a
  separate product-specific button stack.
  Reference: https://docs.unity3d.com/Manual/UIE-uxml-element-ToolbarToggle.html

## Current Facts

- `UiLayoutHostComponent` already supports `top`, `bottom`, `left`, `right`,
  `fill`, and `overlay` slots.
- `ui-framework/controls` currently re-exports collection, scroll, and viewport
  controls plus `installControlComponentDefinitions(...)`.
- There is no generic `ToolbarComponent`, `ButtonComponent`, or
  `ToggleButtonComponent`.
- `MenuBarComponent` / `PopupMenuComponent` are menu-specific controls. They
  should not become the generic toolbar button implementation.
- `FullscreenableViewComponent` currently creates its own button element and
  owns its own button state/DOM styling. This is the most visible existing
  duplicate button-like implementation.
- Inspector content now uses same-actor `UiElementComponent`, follows
  `selection.snapshot`, and has component-local lock state, but it renders text
  directly into the registered root element and has no visible lock UI.

## Target Architecture

Use this shape for any window with chrome:

```text
Window Content Root Actor
  UiElementComponent
  UiLayoutHostComponent
  WindowRegisteredContent owner component

  Toolbar Actor
    UiElementComponent
    UiLayoutItemComponent(slot: "top")
    ToolbarComponent

    Button Actor
      UiElementComponent
      ButtonComponent or ToggleButtonComponent

  Body Actor
    UiElementComponent
    UiLayoutItemComponent(slot: "fill", stretch: "both")
    feature-specific body component

  Status Bar Actor
    UiElementComponent
    UiLayoutItemComponent(slot: "bottom")
    future StatusBarComponent
```

The framework provides the reusable controls; feature/editor code provides
business intent sinks and product icons.

## Non-Negotiables

- No root `ui-framework` export. New controls are exported through
  `ui-framework/controls`.
- No DOM `click` activation shortcuts. Pointer activation goes through
  actor-input participants.
- No Inspector-specific toolbar or button in `ui-framework`.
- No toolbar/menu conflation. Menu items keep menu-chain semantics; toolbar
  buttons use button/toggle semantics.
- No global icon registry in this slice. The control owns an icon slot and
  rendering primitives; products provide icon descriptors.
- Toggle state is not a second business fact. The toggle component owns visual
  pressed state; the feature owner remains the source of domain truth.
- If an old implementation is replaced, delete the old path in the same gate.
  Do not leave compatibility selectors, aliases, or dual activation paths.

## Execution Split

This plan should be executed in at most three gates:

1. **Gate 1: `ui-framework` Toolbar/Button/Toggle Foundation.**  
   Deliver reusable `ButtonComponent`, `ToggleButtonComponent`,
   `ToolbarComponent`, shared button renderer/state behavior, generic theme/CSS
   support, public `ui-framework/controls` exports, and
   `FullscreenableViewComponent` button-rendering convergence. This gate has a
   dedicated executable plan:
   `docs/editor-toolbar-button-inspector-gate-1-ui-framework-controls-plan.md`.
2. **Gate 2: Inspector Toolbar Adoption.**  
   Refactor Inspector into a root layout/content-registration component plus
   toolbar/body child actors. Add the visible lock toggle as a normal toolbar
   child actor using Gate 1 controls. Delete the old Inspector root text
   rendering path.
3. **Gate 3: Closure And Validation.**  
   No new feature work. Run broad validation, delete stale selectors/tests/docs,
   confirm grep/boundary gates, and update progress/defect docs. If Gate 2
   finishes cleanly, Gate 3 can be performed as Gate 2's final checklist rather
   than a separate implementation checkpoint.

## Design Decisions

### Button And Toggle

Implement a shared button control foundation, then expose:

- `ButtonComponent`: command button.
- `ToggleButtonComponent`: controlled toggle button using the same renderer and
  input behavior, with `aria-pressed` and `data-ui-button-pressed`.

Do not implement TypeScript inheritance as the architecture boundary. Prefer a
small shared helper such as `button-control-state.ts` or `button-renderer.ts`
used by both components. This keeps the implementation explicit and avoids a
deep class hierarchy.

### Toggle Ownership

The generic toggle emits an intent:

```text
current pressed state + requested next pressed state + actor/component id
```

The feature owner applies or rejects the change, then updates the toggle's
visual state. For Inspector, `InspectorContentComponent.locked` remains the
domain truth; the lock toggle mirrors it.

### Icon Support

Add a small descriptor, not a registry:

```text
none
text label/symbol
svg path + viewBox
```

The descriptor is generic. `lock` / `unlock` meaning belongs to Editor.
The UI framework may render the SVG/icon slot, but it must not import Editor
icons or product assets.

### Toolbar Layout

`ToolbarComponent` reads direct child actors that have button-like toolbar item
components. It owns only toolbar container/grouping semantics. It rehosts direct
child actor `UiElementComponent.element` values into the toolbar in actor child
order. Button and toggle components own their own label/icon/pressed DOM.

The first implementation must not introduce a toolbar wrapper per button, a
parallel toolbar item descriptor table, or explicit toolbar item ordering. If a
future product needs custom ordering, that must be designed as a single owner
instead of leaving actor child order and toolbar order as two valid facts.

Toolbar must not create button actors from arrays and must not know about
Inspector, Scene, Menu, or Window workspace commands.

Toolbar refresh follows the existing UI frame update pattern used by layout
components: `ToolbarComponent` should implement `FrameUpdateParticipant`, use
`frameUpdateAttachmentComponentType`, and guard DOM work with a normalized
signature. Do not add actor-core tree observers or a global UI registry just to
notice toolbar children.

## Gate 1: Generic Toolbar And Button Controls

Detailed executable plan:
`docs/editor-toolbar-button-inspector-gate-1-ui-framework-controls-plan.md`.

### 1.0. Entry Gate

1. Confirm no implementation work is mixed into this plan gate.
2. Record any unrelated dirty worktree changes; do not edit them unless they
   are in the touched files.
3. Run targeted baseline:

```text
npm run test -w ui-framework -- menu fullscreenable-view collection
npm run test -w editor -- inspector
npm run test -w wallpaper-tesseract -- architecture-boundaries
```

### 1.1. Add Button Model And Component

Create files under `packages/ui-framework/src/ui/button/`:

- `button-model.ts`
- `button-component.ts`
- `button-definition.ts`
- `button-component.test.ts`
- `index.ts`

Expected model:

- descriptor id;
- optional label;
- optional title / accessible label;
- optional icon descriptor;
- enabled / disabled;
- variant at most `"plain" | "toolbar"` if styling needs it;
- intent sink for activation.

Expected behavior:

- same-actor `UiElementComponent` is required;
- button component sets `role="button"` unless the element is an actual
  `HTMLButtonElement`;
- disabled state sets `aria-disabled`, `data-ui-button-disabled`, and native
  `disabled` when the element is a button;
- input hit test uses actor-input and returns a control hit;
- pointer activation occurs on `ActorInputEndEvent.wasClick`;
- keyboard activation is part of the generic button contract: Enter and Space
  must route through the same activation sink as pointer activation. This may
  be implemented with a minimal key listener owned by the button component, but
  it must be generic button behavior, not an Inspector-specific DOM shortcut;
- keyboard listeners must be removed on dispose, Space must not emit duplicate
  keydown/keyup/native activations, disabled buttons must block pointer and
  keyboard activation, and keyboard intents must carry actor id, component id,
  descriptor id, `reason: "keyboard"`, and timestamp;
- no DOM `click` listener;
- dispose restores generic state it applied or removes owned child icon DOM.

Tests:

- creates accessible button DOM from a `UiElementComponent`;
- activation goes through actor-input only;
- Enter/Space keyboard activation reaches the same command path and respects
  disabled state;
- disabled button does not activate;
- icon descriptor renders and updates deterministically;
- dispose removes only component-owned icon/content and restores applied attrs;
- no DOM click listener path.

### 1.2. Add Toggle Button Component

Create:

- `toggle-button-component.ts`
- `toggle-button-definition.ts`
- `toggle-button-component.test.ts`

Expected behavior:

- shares button renderer/helper with `ButtonComponent`;
- exposes `pressed` getter and `setPressed(pressed: boolean)`;
- applies `aria-pressed`, `data-ui-button-pressed`, and pressed CSS class/data;
- activation emits requested next state, but does not mutate domain truth
  behind the feature owner's back;
- disabled toggle does not activate;
- icon can update based on pressed state either by explicit descriptor update or
  a small caller-provided `icons: { pressed, unpressed }` descriptor.

Tests:

- pressed state updates ARIA and dataset;
- activation intent includes requested next pressed state;
- rejected owner change can leave visual state unchanged;
- disabled prevents activation;
- repeated `setPressed` is idempotent.

### 1.3. Add Toolbar Component

Create files under `packages/ui-framework/src/ui/toolbar/`:

- `toolbar-component.ts`
- `toolbar-definition.ts`
- `toolbar-component.test.ts`
- `index.ts`

Expected behavior:

- same-actor `UiElementComponent` is required;
- use frame update attachment plus signature guard as the production refresh
  contract;
- toolbar root uses `role="toolbar"`;
- direct child actors with button/toggle components are realized in actor child
  order only;
- toolbar component owns grouping DOM only, not button internals;
- toolbar rehosts child actor `UiElementComponent.element` values directly and
  does not create button wrappers, copy button state, or mirror pressed/disabled
  state into a second toolbar-owned model;
- it may set orientation dataset, e.g. horizontal by default;
- it must not create child actors from descriptor arrays.

Tests:

- child button actors are laid out by actor tree;
- adding/removing/reparenting child actors updates toolbar DOM;
- toolbar preserves child button-owned label/icon/pressed DOM and does not add a
  toolbar-owned wrapper state layer;
- disabled child remains visible but non-interactive;
- toolbar does not import menu/window/editor/app/runtime modules.

### 1.4. Export And Install Definitions

Update:

- `packages/ui-framework/src/controls/index.ts`
- `packages/ui-framework/src/controls/install-component-definitions.ts`

Export the new components through `ui-framework/controls`. Do not add a root
export. Register definitions through `installControlComponentDefinitions(...)`.

Boundary tests:

- `ui-framework/controls` exports button/toggle/toolbar;
- no `ui-framework` root import is reintroduced;
- `packages/ui-framework/src/ui/button` and `src/ui/toolbar` do not import
  `editor`, app-local code, runtime packages, window workspace model, or menu
  chain internals.

### 1.5. Theme And CSS

Extend `ui-framework` theme tokens only for generic control styling:

- button background / hover / active / disabled;
- button border;
- button text;
- button pressed background/border;
- toolbar background / separator if needed;
- icon color.

Update `ui-framework-controls.css`.

Do not add Inspector-specific lock colors or icon tokens. Product icon meaning
stays in Editor.

CSS validation:

- all new `--ui-*` tokens exist in `ui-theme-tokens.ts`;
- no raw style debt outside an existing allowlist;
- button/toggle/toolbar selectors are generic (`.ui-button-*`,
  `.ui-toolbar-*`) and do not mention Inspector.

### 1.6. Collapse Fullscreen Button Duplication

After Button/Toggle exists, audit `FullscreenableViewComponent`.

Required outcome:

- `FullscreenableViewComponent` must reuse the same button renderer/state helper
  used by `ButtonComponent` / `ToggleButtonComponent` for its control element,
  including label/icon/disabled/pressed styling mechanics where applicable.
- Fullscreen ownership stays in `FullscreenableViewComponent`; only the
  duplicated button DOM/state/rendering path is collapsed.

Not allowed:

- leaving two divergent generic button CSS/state systems once the shared
  renderer can cover both.
- keeping the current hand-written fullscreen button path unchanged as a
  casual follow-up.

Stop and revise the plan if:

- sharing the renderer requires changing fullscreen lifecycle ownership,
  fullscreen intent routing, or window presentation behavior. In that case,
  do not preserve the old button path as compatibility; write a focused
  fullscreen-control cleanup plan before continuing.

## Gate 2: Inspector Toolbar And Lock Toggle

### 2.0. Entry Gate

Gate 1 must be complete and validated. Do not begin Inspector migration while
button/toggle semantics are still changing.

### 2.1. Split Inspector Root Into Layout Host

Refactor Inspector actor construction:

```text
Inspector View Actor
  UiElementComponent
  UiLayoutHostComponent
  Inspector window content registration component/owner

  Inspector Toolbar Actor
    UiElementComponent
    UiLayoutItemComponent(slot: "top")
    ToolbarComponent

  Inspector Body Actor
    UiElementComponent
    UiLayoutItemComponent(slot: "fill", stretch: "both")
    InspectorContentComponent
```

Delete the old path where `InspectorContentComponent` writes directly into the
registered root element. The body component owns body text only.

If the current `InspectorContentComponent` is still the window content
registration owner, split responsibilities cleanly:

- root content registration must belong to an Inspector root component attached
  to the Inspector view actor;
- body display belongs to `InspectorContentComponent`;
- no second DOM root.

Do not perform naked `contentRegistration.registerContent(...)` from the actor
factory as a lifecycle shortcut. The registration lifecycle must remain owned by
an actor component so disposal, enablement, and future content-state changes
stay inside the component tree.

### 2.2. Add Inspector Lock Toolbar Button

Create a lock toggle button actor as a child of the toolbar actor.

Rules:

- the button is a `ToggleButtonComponent`;
- lock state truth remains `InspectorContentComponent.locked`;
- activation intent calls `setLocked(requestedPressed)`;
- after applying the lock state, sync the toggle pressed state from
  `InspectorContentComponent.locked`;
- icon descriptor comes from Editor, not `ui-framework`;
- accessible label changes between lock/unlock states.

Use code-drawn SVG path descriptors or a local Editor icon descriptor helper.
Do not introduce a global icon registry in this gate.

### 2.3. Inspector Tests

Add or update tests in `packages/editor/src/inspector`:

- Inspector root registers one content element and contains toolbar/body child
  actors;
- lock button actor is a toolbar child actor;
- clicking lock via actor-input sets Inspector locked;
- selecting another actor while locked keeps body text unchanged;
- unlocking catches up to current selection;
- two Inspector instances can diverge: one locked, one following;
- no DOM click listener shortcut is used;
- no direct import of Hierarchy or `Selection` facade from Inspector content.

### 2.4. Browser Smoke

Run a browser smoke that proves:

- select Scene in Hierarchy -> unlocked Inspector shows Scene;
- press Inspector lock button -> button visually pressed;
- select Camera3 -> locked Inspector remains Scene;
- unlock -> Inspector changes to Camera3;
- second Inspector, if visible, can remain unlocked and follow selection;
- menu, toolbar, tab close, dock preview, and Debug diagnostics still route
  through actor-input correctly;
- console errors are 0.

Store evidence under `temp/`.

## Gate 3: Validation And Cleanup

Gate 3 is a closure checklist, not a new implementation surface. Prefer running
it immediately after Gate 2 unless Gate 2 exposes a blocker that requires a
separate plan amendment.

Run:

```text
npm run test -w ui-framework -- button toggle toolbar fullscreenable-view
npm run typecheck:test -w ui-framework
npm run build -w ui-framework
npm run test -w editor -- inspector
npm run typecheck -w editor
npm run build -w editor
npm run test -w wallpaper-tesseract -- architecture-boundaries
npm run typecheck -w wallpaper-tesseract
npm run build -w wallpaper-tesseract
```

Before handoff, broaden if shared control exports or app smoke wiring changed:

```text
npm run test
npm run typecheck
npm run build
```

Grep gates:

```text
rg -n "addEventListener\\([\"']click|\\.onclick" packages/ui-framework/src/ui/button packages/ui-framework/src/ui/toolbar packages/editor/src/inspector -g "*.ts"
rg -n "inspector.*button|lock.*button" packages/ui-framework/src -g "*.ts" -g "*.css"
rg -n "from [\"']ui-framework[\"']" packages apps -g "*.ts"
rg -n "textContent\\s*=\\s*`?Inspecting|textContent\\s*=\\s*[\"']No actor selected" packages/editor/src/inspector -g "*.ts"
```

Expected:

- no click shortcut matches;
- no Inspector/product wording in `ui-framework`;
- no root `ui-framework` imports;
- old Inspector root text rendering deleted or moved to the body component only.

## Stop Conditions

Stop and revise the plan if:

- adding toolbar requires `WindowFrameSurfaceComponent` special casing;
- a button/toggle needs a global registry to work;
- Inspector lock state starts duplicating `selection.snapshot` or introduces a
  second selection owner;
- the generic button API starts importing menu/window/editor concepts;
- migrating fullscreen button would require a fullscreen lifecycle redesign
  larger than this plan.
- Inspector content registration cannot be represented as an actor component
  without a wider window-content contract change.

## Acceptance Criteria

- Any window content can add a toolbar/status/body arrangement by actor child
  composition and `UiLayoutItemComponent` slots.
- Toolbar and buttons are reusable `ui-framework/controls` components.
- Toggle uses button semantics plus pressed state (`aria-pressed`), not a
  separate interaction universe.
- Inspector lock is visible, actor-input driven, and implemented as a toolbar
  child actor.
- Old Inspector direct-root content rendering is deleted or reduced to a body
  child component.
- No compatibility barrel, DOM click shortcut, product-specific UI framework
  code, or duplicate button state path remains.
