# Editor Toolbar Gate 1: UI Framework Controls Plan

Status: completed
Date: 2026-06-30
Parent plan: `docs/editor-toolbar-button-inspector-lock-plan.md`
Scope: `packages/ui-framework` only, except boundary tests in
`apps/wallpaper-tesseract/src/architecture-boundaries.test.ts`.

## Goal

Create the reusable control foundation needed for toolbar-based window chrome:

- `ButtonComponent`
- `ToggleButtonComponent`
- `ToolbarComponent`
- shared button renderer/state helper
- generic theme tokens and CSS
- `ui-framework/controls` exports and definition installation
- `FullscreenableViewComponent` convergence onto the shared button rendering
  path

Gate 1 must not touch Inspector product wiring. Inspector adoption belongs to
Gate 2. The acceptance value of this gate is that `ui-framework` can express a
toolbar with buttons/toggles as an actor subtree, and the existing fullscreen
control no longer owns a separate generic button implementation.

## Entry Gate

1. Check worktree state and record unrelated dirty files. Do not edit unrelated
   dirty files.
2. Confirm the parent plan exists and still names this file as Gate 1.
3. Run targeted baseline:

```text
npm run test -w ui-framework -- menu fullscreenable-view collection
npm run typecheck:test -w ui-framework
npm run test -w wallpaper-tesseract -- architecture-boundaries
```

If baseline fails for unrelated dirty work, stop and document the failure before
editing.

## Non-Negotiables

- No root `ui-framework` export.
- No DOM `click` activation path.
- No Inspector, Editor, Scene, Window workspace command, app-local, runtime, or
  product semantics in `packages/ui-framework/src/ui/button` or
  `packages/ui-framework/src/ui/toolbar`.
- Button/toggle activation uses actor-input for pointer interaction.
- Enter/Space keyboard activation is generic button behavior and reaches the
  same command/toggle sink.
- Toolbar rehosts child actor `UiElementComponent.element` values directly. It
  must not create button wrappers, copy pressed/disabled state, or introduce a
  second toolbar item descriptor/order table.
- Toolbar refresh uses the existing UI frame update attachment pattern plus a
  signature guard. Do not add an actor-core tree observer or global UI
  registry for this gate.
- `FullscreenableViewComponent` must reuse the shared button renderer/state
  helper. Keeping the old hand-written fullscreen button path unchanged is not
  allowed.

## Step 1: Add Button Model And Shared Renderer

Create:

```text
packages/ui-framework/src/ui/button/button-model.ts
packages/ui-framework/src/ui/button/button-renderer.ts
packages/ui-framework/src/ui/button/index.ts
packages/ui-framework/src/ui/button/button-renderer.test.ts
```

### Model

Define a small generic model:

```text
UiButtonIconDescriptor
  none
  text
  svg-path

UiButtonDescriptor
  id
  label?
  accessibleLabel?
  title?
  icon?
  enabled?
  variant? ("plain" | "toolbar")

UiButtonState
  pressed?
  active?
  disabled?
```

Rules:

- `accessibleLabel` is required when neither visible label nor title gives an
  accessible name.
- descriptor `id` is a diagnostic/component-local identity only. It is not a
  business command id and must not be used to build a command registry inside
  `ui-framework`.
- Icon descriptor is generic. Do not add names such as `lock`, `unlock`, or
  `fullscreen` to `ui-framework`.
- SVG icon rendering must be deterministic and component-owned.
- Descriptor normalization clones inputs and rejects invalid values.

### Renderer

The renderer is an internal helper, not a component:

- applies generic button class/data/ARIA attributes;
- owns label/icon DOM under the button element;
- applies pressed/disabled/active state;
- restores or removes only state/DOM it owns on dispose;
- contains no actor-input logic and no product logic.

Tests:

- normalize descriptor rejects missing accessible name when there is no visible
  label/title;
- text icon and SVG path icon render deterministically;
- disabled and pressed state update data attributes and ARIA attributes;
- renderer updates replace old icon DOM without leaking children;
- dispose removes component-owned label/icon DOM and restores attributes it set;
- renderer has no imports from actor-input, editor, app, runtime, or menu.

## Step 2: Add ButtonComponent

Create:

```text
packages/ui-framework/src/ui/button/button-component.ts
packages/ui-framework/src/ui/button/button-definition.ts
packages/ui-framework/src/ui/button/button-component.test.ts
```

### Contract

`ButtonComponent`:

- requires same-actor `UiElementComponent`;
- owns command activation only;
- uses `button-renderer.ts` for DOM/state;
- implements `ActorInputParticipant`;
- uses actor-input hit test for pointer activation;
- supports generic Enter/Space keyboard activation through the same command
  sink;
- does not mutate feature state;
- does not register DOM `click`.

Intent shape:

```text
actorId
componentId
descriptor id (diagnostic only, not a command registry key)
reason: "actor-system/input" | "keyboard"
timeStamp
```

Keyboard rules:

- Enter activates on keydown.
- Space uses one deterministic phase only, preferably keyup after preventing
  scroll/native duplication on keydown, so one press cannot emit twice.
- keyboard listeners are registered only by the component and removed on
  dispose.
- disabled state blocks pointer and keyboard activation.
- keyboard intent includes actor id, component id, descriptor id, reason, and
  timestamp just like pointer intent.

Tests:

- pointer click through actor-input activates once;
- Enter activates once;
- Space activates once and prevents duplicate activation;
- disabled button does not activate by pointer or keyboard;
- keyboard listeners are removed on dispose;
- keyboard activation payload includes actor/component/descriptor ids and
  `reason: "keyboard"`;
- `setDescriptor(...)` updates label/title/icon/enabled state;
- dispose disables input behavior and removes renderer-owned DOM;
- source text has no `addEventListener("click")` or `.onclick`.

## Step 3: Add ToggleButtonComponent

Create:

```text
packages/ui-framework/src/ui/button/toggle-button-component.ts
packages/ui-framework/src/ui/button/toggle-button-definition.ts
packages/ui-framework/src/ui/button/toggle-button-component.test.ts
```

### Contract

`ToggleButtonComponent`:

- shares renderer/helper with `ButtonComponent`;
- owns visual pressed state only;
- applies `aria-pressed` and `data-ui-button-pressed`;
- emits requested next pressed state to its sink;
- waits for the owner to accept/reject by calling `setPressed(...)` or
  `setDescriptor(...)`;
- does not know what the toggle means.

Tests:

- initial pressed state sets `aria-pressed`;
- pointer activation emits requested next state;
- Enter/Space emit requested next state through the same sink;
- owner rejection can leave pressed state unchanged;
- `setPressed` is idempotent;
- disabled prevents pointer and keyboard activation;
- pressed/unpressed icon descriptors update through renderer without duplicate
  DOM.

## Step 4: Add ToolbarComponent

Create:

```text
packages/ui-framework/src/ui/toolbar/toolbar-component.ts
packages/ui-framework/src/ui/toolbar/toolbar-definition.ts
packages/ui-framework/src/ui/toolbar/toolbar-component.test.ts
packages/ui-framework/src/ui/toolbar/index.ts
```

### Contract

`ToolbarComponent`:

- requires same-actor `UiElementComponent`;
- requires `frameUpdateAttachmentComponentType`, following
  `UiLayoutHostComponent`'s refresh pattern;
- implements `FrameUpdateParticipant`;
- sets `role="toolbar"`;
- reads direct child actors only;
- includes child actors that have `UiElementComponent` and a button-like
  component (`ButtonComponent` or `ToggleButtonComponent`);
- rehosts each child actor element directly into toolbar root in actor child
  order;
- refreshes from frame update with a normalized signature containing child actor
  ids, element identity/order, and button-like component ids;
- frame updates must be O(1) no-op when the signature is unchanged;
- optional `refreshToolbar()` may exist for tests and explicit diagnostics, but
  frame update is the production refresh contract;
- removes stale child elements when actors are detached/reparented;
- preserves child button-owned DOM and state;
- does not create child actors, wrappers, or descriptor arrays.

First version uses actor child order only. Do not add `order`, groups, spacers,
or overflow handling in this gate.

Tests:

- toolbar realizes direct button children in actor child order;
- frame update realizes a newly added child actor;
- unchanged frame update does not mutate DOM;
- removing or reparenting a child removes the stale element from toolbar on the
  next frame update;
- explicit `refreshToolbar()` if exposed follows the same disposed/enabled
  semantics as frame update;
- pressed/disabled state remains owned by child component;
- toolbar dispose detaches toolbar-owned grouping state but does not dispose
  child actors or remove child-owned element content;
- no imports from menu, editor, app, runtime, or window workspace command code.

## Step 5: Exports And Component Installation

Update:

```text
packages/ui-framework/src/controls/index.ts
packages/ui-framework/src/controls/install-component-definitions.ts
```

Expected exports:

- `ButtonComponent`
- `buttonComponentType`
- `ButtonComponentOptions`
- `buttonComponentDefinition`
- `ToggleButtonComponent`
- `toggleButtonComponentType`
- `ToggleButtonComponentOptions`
- `toggleButtonComponentDefinition`
- `ToolbarComponent`
- `toolbarComponentType`
- `ToolbarComponentOptions`
- `toolbarComponentDefinition`
- model types needed by callers

Expected install:

- `installControlComponentDefinitions(...)` registers button, toggle button,
  and toolbar definitions.

Do not create `ui-framework/button`, `ui-framework/toolbar`, or root package
exports in this gate.

Boundary tests:

- exact `ui-framework` package exports are unchanged except the existing
  `./controls` submodule content;
- production root `from "ui-framework"` remains 0;
- source zones for `ui/button` and `ui/toolbar` are classified under controls;
- `ui/button` and `ui/toolbar` cannot import editor/app/runtime/window/menu
  internals;
- no `installUiComponentDefinitions` aggregate reappears.

## Step 6: Theme Tokens And CSS

Update:

```text
packages/ui-framework/src/ui/theme/ui-theme-tokens.ts
packages/ui-framework/src/ui/ui-framework-controls.css
packages/ui-framework/src/ui/theme/ui-theme-css-contract.test.ts
```

Add only generic tokens:

- button background;
- button hover background;
- button active background;
- button pressed background;
- button border;
- button text;
- button disabled text/background;
- toolbar background;
- toolbar border/separator if needed;
- control icon color.

Rules:

- no Inspector-specific tokens;
- no lock/unlock/fullscreen product color tokens;
- all new CSS variables must be declared in token definitions;
- raw style debt must be avoided or added to an explicit existing allowlist with
  owner/reason.

Tests:

- generated theme CSS contains new defaults;
- `ui-framework-controls.css` references only known `--ui-*` tokens;
- button/toggle/toolbar selectors are generic.

## Step 7: Collapse Fullscreen Button Rendering

Update:

```text
packages/ui-framework/src/ui/viewport/fullscreenable-view-component.ts
packages/ui-framework/src/ui/viewport/fullscreenable-view-component.test.ts
```

Required:

- keep fullscreen intent ownership inside `FullscreenableViewComponent`;
- replace hand-written button element state/styling with the shared renderer;
- use the same disabled/pressed/icon/title/ARIA mechanics as the new button
  foundation where applicable;
- preserve actor-input hit behavior and fullscreen intent payload;
- do not add a second `ButtonComponent` child actor inside
  `FullscreenableViewComponent` in this gate. The goal is renderer convergence,
  not changing fullscreen actor topology.

Tests:

- existing fullscreen enter/restore intent tests still pass;
- control element uses shared button classes/data attributes;
- state updates use shared renderer;
- no old private fullscreen-only button styling helper remains for label/icon/
  disabled/pressed state;
- any remaining fullscreen-specific style helper is limited to overlay
  placement/sizing and is not a button state renderer;
- browser-impacting positioning remains unchanged.

Stop and revise if:

- sharing the renderer requires changing fullscreen lifecycle ownership,
  fullscreen intent routing, or window presentation behavior.

## Step 8: Validation

Run targeted checks:

```text
npm run test -w ui-framework -- button toggle toolbar fullscreenable-view
npm run typecheck:test -w ui-framework
npm run build -w ui-framework
npm run test -w wallpaper-tesseract -- architecture-boundaries
```

If public control exports, CSS, or app build resolution changed in a way that
could affect consumers, also run:

```text
npm run typecheck -w wallpaper-tesseract
npm run build -w wallpaper-tesseract
```

Grep gates:

```text
rg -n "addEventListener\\([\"']click|\\.onclick" packages/ui-framework/src/ui/button packages/ui-framework/src/ui/toolbar packages/ui-framework/src/ui/viewport -g "*.ts"
rg -n "Inspector|inspector|Hierarchy|Scene|Camera3|Tesseract|WindowWorkspace|wallpaper" packages/ui-framework/src/ui/button packages/ui-framework/src/ui/toolbar -g "*.ts" -g "*.css"
rg -n "from [\"']ui-framework[\"']" packages apps -g "*.ts"
rg -n "installUiComponentDefinitions" packages apps -g "*.ts"
rg -n "applyControlStyle|fullscreen-only button|uiFullscreenControl.*style|data\\.uiFullscreenState" packages/ui-framework/src/ui/viewport/fullscreenable-view-component.ts
```

Expected:

- no DOM click activation;
- no product terms in generic button/toolbar source;
- no root `ui-framework` import;
- no old aggregate UI installer.
- no fullscreen-only button renderer/state helper remains; fullscreen-specific
  overlay placement code may remain if it is clearly not generic button state.

## Gate 1 Acceptance Criteria

- `ui-framework/controls` can express an actor subtree containing toolbar,
  button, and toggle controls.
- Pointer activation uses actor-input.
- Enter/Space keyboard activation is generic and tested.
- Toggle uses button semantics plus pressed state (`aria-pressed`).
- Toolbar only rehosts child actor elements and does not own button state.
- Fullscreen control uses the shared button renderer/state helper instead of a
  separate hand-written generic button path.
- No Inspector/product-specific implementation appears in `ui-framework`.
- No compatibility exports, root `ui-framework` imports, or duplicate generic
  button styling systems are introduced.

## Completion Notes

Completed on 2026-06-30.

Validation:

```text
npm run test -w ui-framework -- theme button toggle toolbar fullscreenable-view
npm run typecheck:test -w ui-framework
npm run build -w ui-framework
npm run test -w wallpaper-tesseract -- architecture-boundaries
npm run typecheck -w wallpaper-tesseract
npm run build -w wallpaper-tesseract
```

`wallpaper-tesseract` build retained only the existing Vite chunk size warning.
