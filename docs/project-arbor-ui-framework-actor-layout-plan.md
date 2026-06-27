# Project Arbor: Actor-Backed UI Layout And Controls

Status: draft execution plan, amended after review  
Created: 2026-06-14  
Scope: `packages/ui-framework`, `packages/editor`, and the app-local Scene/App
Menu integration needed to remove old presentation ownership.

## Goal

Project Arbor makes ordinary UI controls use the same actor tree and component
composition model as the rest of the application. The immediate feature target
is tab-local menu bars and a cleaner Scene view hierarchy. The architecture
target is broader: menu bars, toolbars, status bars, render viewports, overlays,
and future controls should all be composed by adding child actors with small UI
components, not by manually notifying a tab, frame, or product-specific shell.

The desired authoring shape is:

```text
Tab Content Actor
  UiLayoutHostComponent

  Menu Bar Actor
    UiElementComponent
    UiLayoutItemComponent(slot: top)
    MenuBarComponent

  World Render View Actor
    UiElementComponent
    UiLayoutItemComponent(slot: fill)
    RenderViewportComponent
    FullscreenableViewComponent

  Camera3 Gizmo Actor
    UiElementComponent
    UiLayoutItemComponent(slot: overlay, layer: gizmo)
    Camera3GizmoComponent
```

Adding or removing a child actor should update layout through the parent
layout host. No caller should manually tell the tab that a menu bar, toolbar,
viewport, or overlay was added.

## Non-Negotiables

- Do not create a parallel UI tree. The actor tree plus component registry is
  the source of truth.
- Do not put UI layout into `actor-core`; actor-core remains framework-agnostic.
- Do not let `WindowFrameSurfaceComponent` become a generic control manager.
  It remains the window placement/content realization owner.
- Do not let `MenuBarComponent`, `RenderViewportComponent`, or any leaf control
  directly lay out sibling controls.
- Do not add compatibility barrels or old/new dual menu implementations.
- Do not preserve app-local App Menu or Scene viewport DOM implementations once
  their new `ui-framework` replacements are installed.
- Do not move product/runtime facts into `ui-framework`. Scene, Camera3,
  Tesseract, Debug, Hierarchy, and app menu policy stay outside generic UI
  controls.
- Fullscreen/restore intent may originate from a control, but workspace
  presentation mutation remains owned by the existing window presentation /
  lifecycle owner.
- Prefer smaller files with one control/component per file. Avoid large
  `controls.ts`, `ui.ts`, or catch-all component modules.

## Current Facts

- `ui-framework` already depends on `actor-core` and `actor-input`, so
  actor-backed controls are allowed inside the package.
- `ui-framework` currently has only generic App Menu model helpers. The active
  App Menu component still lives in app-local `features/app-menu`.
- The existing `ui-framework/src/model/app-menu-model.ts` is the only current
  generic menu model. Project Arbor must migrate or rename it into the new menu
  area, not create a second `ui/menu/menu-model.ts` with overlapping menu truth.
- The current App Menu component is a monolith: it creates menu DOM rows,
  stores row state, manages active row highlighting, and triggers window
  commands.
- `WindowFrameSurfaceComponent` owns tab/split/content realization and should
  not absorb menu or Scene-specific control behavior.
- `SceneViewportComponent` in `packages/editor` currently mixes content
  registration, canvas host, overlay host, render target resize, and the parent
  DOM for Camera3 gizmo.
- Scene integration currently creates the Scene view, runtime render output,
  runtime content, and Camera3 gizmo in one app-local installer. It is cleaner
  than pre-Prism code, but still not a fully generic actor-backed UI subtree.

## Target Architecture

### Generic UI Primitives

`ui-framework` owns generic DOM/control composition primitives:

- `UiElementComponent`: owns or borrows one HTMLElement for the actor. Ownership
  is explicit; owned elements are removed on dispose, borrowed elements are
  detached only from generic layout slots and are not destroyed.
- `UiLayoutItemComponent`: declares how the actor should be laid out by its
  parent, such as `top`, `bottom`, `left`, `right`, `fill`, or `overlay`.
- `UiLayoutHostComponent`: reads direct child actors and their layout items,
  then lays out their elements.
- `UiDockLayoutComponent` or equivalent host implementation: first practical
  host for view chrome: top/bottom/left/right/fill plus overlays.
- `MenuBarComponent`, `MenuBarItemComponent`, `PopupMenuComponent`,
  `MenuItemComponent`: generic menu behavior.
- `RenderViewportComponent`: generic render target DOM host and resize owner.
  Render target disposal is explicit: either the viewport owns the target and
  disposes it, or it borrows the target and only detaches/unsubscribes.
- `FullscreenableViewComponent`: generic control-side fullscreen command
  surface that delegates mutation to a narrow presentation port.

`ui-framework` may know about DOM, actor-input, layout, and command ports. It
must not know about Scene, Camera3, Tesseract, Debug, Inspector, Hierarchy, or
Wallpaper runtime.

### Scene As Ordinary Composition

Scene should become a regular tab content subtree:

```text
Scene View Actor
  UiElementComponent
  UiLayoutHostComponent

  World Render View Actor
    UiElementComponent
    UiLayoutItemComponent(slot: fill)
    RenderViewportComponent
    FullscreenableViewComponent

  Camera3 Gizmo Actor
    UiElementComponent
    UiLayoutItemComponent(slot: overlay, layer: gizmo)
    Camera3GizmoComponent

  Runtime Content Actor(s)
    Runtime components, not UI layout ownership
```

The world render view is the presentation target. Runtime content remains owned
by runtime owners. Camera3 gizmo is a sibling overlay, not a child of the world
render view.

## Suggested File Structure

Keep one meaningful control/component per file:

```text
packages/ui-framework/src/ui/element/
  ui-element-component.ts
  ui-element-definition.ts
  ui-element-component.test.ts

packages/ui-framework/src/ui/layout/
  ui-layout-types.ts
  ui-layout-item-component.ts
  ui-layout-item-definition.ts
  ui-layout-host-component.ts
  ui-layout-host-definition.ts
  ui-dock-layout.ts
  ui-layout-host-component.test.ts

packages/ui-framework/src/ui/menu/
  menu-action.ts
  menu-model.ts            # migrated/renamed from model/app-menu-model.ts
  menu-bar-component.ts
  menu-bar-definition.ts
  menu-bar-item-component.ts
  menu-bar-item-definition.ts
  popup-menu-component.ts
  popup-menu-definition.ts
  menu-item-component.ts
  menu-item-definition.ts
  menu-highlight-controller.ts
  menu-components.test.ts

packages/ui-framework/src/ui/viewport/
  render-viewport-component.ts
  render-viewport-definition.ts
  fullscreenable-view-component.ts
  fullscreenable-view-definition.ts
  render-viewport-component.test.ts

packages/ui-framework/src/ui/
  install-ui-component-definitions.ts
```

Only export the public pieces needed by packages/apps. Keep helper layout
algorithms package-private unless a production caller needs them.

Menu model rule:

- `packages/ui-framework/src/model/app-menu-model.ts` must not coexist as a
  second public menu model after the new generic menu model lands. Execute one
  of these cleanly:
  - move/rename it to `src/ui/menu/menu-model.ts` and update callers; or
  - delete it after replacing all callers with actor-backed menu descriptors.
- Do not keep compatibility re-exports from the old path unless an active step
  explicitly names a short-lived migration boundary with a same-step deletion.

## Part I: `ui-framework` Internal Refactor

This part prepares the generic foundation without migrating Editor behavior yet.

### Step 1: Add UI Element Ownership

Add `UiElementComponent` and definition.

Detailed execution file:

```text
docs/project-arbor-step-1-ui-element-ownership-plan.md
```

Responsibilities:

- Create or accept an HTMLElement with explicit ownership:
  - `owned`: created by the component or transferred to it; removed on dispose.
  - `borrowed`: provided by another owner; never removed or disposed by this
    component.
- Expose the root element to sibling components on the same actor.
- Own generic enabled/hidden/interactable DOM state only when it is generic.
- Dispose by removing only owned elements and by detaching borrowed elements
  only from generic layout slots that this component attached them to.

Exit gates:

- Tests prove owned element disposal removes the element.
- Tests prove borrowed element disposal does not remove the external element.
- No product concepts appear in `ui/element`.
- No existing App Menu or Scene component imports this yet.

### Step 2: Add Layout Item Declaration

Add `UiLayoutItemComponent`.

Responsibilities:

- Declare the actor's desired parent layout contribution.
- First supported fields:
  - `slot: "top" | "bottom" | "left" | "right" | "fill" | "overlay"`
  - `order`
  - `layer`
  - `stretch`
  - optional `minSize` / `preferredSize`
- Require a same-actor `UiElementComponent`.

Exit gates:

- Tests prove layout item reads the same actor's UI element.
- No DOM sibling mutation exists in `UiLayoutItemComponent`.
- No global registry or second UI tree is introduced.
- Tests cover slot/order/layer changes without requiring product-specific
  parent knowledge.

### Step 3: Add Parent Layout Host

Add `UiLayoutHostComponent` with the first dock/fill/overlay layout.

Responsibilities:

- Read direct child actors from `ActorSystemView`.
- For each child, read `UiLayoutItemComponent`.
- Append child elements into deterministic regions.
- Lay out top/bottom/left/right/fill and overlay layers.
- Recompute from actor tree/component state on frame update or explicit refresh.

Initial implementation should favor simple deterministic rebuilds over a
complex observer system. If framework-agnostic actor tree lifecycle observation
is later needed, evaluate it as an actor-core capability separately. UI
layout/DOM semantics must not enter actor-core.

Exit gates:

- Adding/removing child actors updates layout without manually notifying the
  parent.
- A `top` child consumes a row and a `fill` child receives the remaining area.
- An `overlay` child renders over `fill` by layer/order.
- Disabled/inactive child actors do not contribute interactable UI.
- No actor-core change is required.

### Step 4: Add Generic Menu Components

Add generic menu actors/components in `ui-framework`.

Responsibilities:

- `MenuBarComponent`: top-level menubar behavior and open menu coordination.
- `MenuBarItemComponent`: menubar item behavior.
- `PopupMenuComponent`: owns open menu active/highlight state for its child
  menu items.
- `MenuItemComponent`: command/checkable item behavior.
- Highlight belongs to the popup/menu parent component, not each item.
- Menu input goes through actor-input.

Exit gates:

- Unit tests cover hover highlight, keyboard active item, click activation,
  disabled item behavior, Escape/dismiss, and nested child actor disposal.
- The old "highlight first row forever" failure shape is covered by tests.
- No app-local window command logic exists in generic menu components.
- Product menu actions are represented by generic command payloads or a narrow
  command sink.
- `model/app-menu-model.ts` is either moved/renamed into the new generic menu
  model or explicitly deleted once replacement descriptors exist. No two public
  menu models remain.

### Step 5: Add Generic Render Viewport

Add `RenderViewportComponent`.

Responsibilities:

- Own a generic viewport/root element and canvas/render-target host.
- Accept a generic render target interface with `domElement`, `setSize`, and
  optional `dispose`.
- Accept explicit render target ownership:
  - `owned`: `RenderViewportComponent.dispose()` disposes the render target.
  - `borrowed`: `RenderViewportComponent.dispose()` only detaches from DOM and
    unsubscribes; the runtime owner disposes the target.
- Measure itself and resize the target.
- Optionally expose a resize subscription.
- Stay independent from Scene/Camera/Tesseract/runtime package names.

Exit gates:

- Tests prove resize/measure behavior and disposal.
- Tests prove borrowed render targets are not disposed.
- Tests prove owned render targets are disposed exactly once.
- No `editor`, `wallpaper-runtime`, `runtime-three`, Scene, or Camera3 imports
  enter this generic component.

### Step 6: Add Fullscreenable View Intent Component

Add `FullscreenableViewComponent`.

Responsibilities:

- Represent control-level fullscreen state/commands.
- Delegate workspace fullscreen/restore to a narrow presentation command port.
- Optionally toggle local layout fullscreen if a parent layout host supports
  local-only fullscreen.

Exit gates:

- Tests prove the component emits intent through a port and does not mutate
  `WindowWorkspaceGraph` directly.
- Existing lifecycle/presentation owner remains the only workspace presentation
  mutation owner.

### Step 7: Install And Export UI Definitions Conservatively

Add `installUiComponentDefinitions`.

Exit gates:

- `ui-framework/src/index.ts` exports only stable generic UI APIs.
- Internal helper files are not exported unless required by production callers.
- Add early boundary tests:
  - `packages/ui-framework/src/ui/**` must not import `editor`,
    `wallpaper-runtime`, app-local feature modules, Scene, Camera3, Tesseract,
    Debug, Inspector, or Hierarchy code.
  - `WindowFrameSurfaceComponent` must not contain menu, toolbar, viewport, or
    Scene-specific branches.
  - generic menu files must not import window workspace command or lifecycle
    types; product actions are provided by a generic command sink/descriptor.
- `npm run test -w ui-framework`
- `npm run typecheck:test -w ui-framework`
- `npm run build -w ui-framework`

### Step 7.5: Prove A Vertical UI Layout Slice

Before migrating App Menu or Scene, create a small fixture in `ui-framework`
that exercises the intended authoring model end to end.

Fixture shape:

```text
Fixture Root Actor
  UiElementComponent
  UiLayoutHostComponent

  Menu Child Actor
    UiElementComponent
    UiLayoutItemComponent(slot: top)
    MenuBarComponent

  Fill Body Actor
    UiElementComponent
    UiLayoutItemComponent(slot: fill)

  Overlay Child Actor
    UiElementComponent
    UiLayoutItemComponent(slot: overlay, layer: 10)
```

Required proof:

- Adding the menu child gives the body less vertical space without manual parent
  notification.
- Removing/destroying the menu child collapses the body back to full height.
- Adding/removing the overlay child updates stacking without moving the body.
- Menu hover/highlight follows the hovered child menu item.
- No `WindowFrameSurfaceComponent`, app-local Scene, or app-local App Menu code
  participates in the fixture.

Exit gates:

- `npm run test -w ui-framework -- ui-layout`
- `npm run typecheck:test -w ui-framework`
- Do not begin Part II until this fixture proves the new layout fact is real.

## Part II: Editor And Scene Migration

This part removes old Editor/app-local presentation ownership and moves real
features onto the new `ui-framework` primitives.

### Step 8: Replace App-Local App Menu Monolith

Move App Menu presentation onto generic menu primitives.

Required changes:

- Delete app-local row DOM/highlight/open-state implementation.
- Keep product-specific menu descriptor/action wiring outside `ui-framework`.
- Build the current Window menu as actor children:
  - app menu bar actor
  - Window menu bar item actor
  - popup menu actor
  - menu item actors
- Generic menu components manage hover/highlight/keyboard/dismiss.
- Migrate or delete the old `model/app-menu-model.ts` path so there is one
  menu model/descriptive fact.

Exit gates:

- App-local App Menu component no longer owns `#rows`, `#activeRowIndex`, or
  direct row rendering.
- `rg "#rows|#activeRowIndex|renderMenu|createMenuItemElement" apps/wallpaper-tesseract/src/features/app-menu packages`
  has no production matches outside new generic menu implementation/tests.
- CSS cleanup is complete: old `.app-menu-bar__*` selectors are either moved
  to generic menu styles with matching ownership or deleted. No orphan
  compatibility selectors remain.
- App-local code does not import internal `ui-framework/src` paths.
- Browser smoke verifies menu hover, activation, tab drag, dock preview, and
  tab close hit targets still work.
- Architecture boundary test forbids reintroducing app-local menu DOM row
  rendering.

### Step 9: Introduce Generic View Shell For Window Content

Create a reusable view shell in `ui-framework` and migrate Editor view content
to use it where useful.

Responsibilities:

- A tab content actor can host menu/toolbar/status/render/body children through
  `UiLayoutHostComponent`.
- `WindowFrameSurfaceComponent` remains unaware of menus/toolbars.
- Window content registration still registers one root content element; the
  internal child layout is owned by the view shell actor tree.

Exit gates:

- A test proves a tab content actor gains a menu bar by adding a child actor,
  with no manual tab notification.
- A test proves removing that child actor collapses the layout.
- No special-case menu logic is added to `WindowFrameSurfaceComponent`.

### Step 10: Split Scene View Into Ordinary UI Actors

Replace the current `SceneViewportComponent` monolith.

Target subtree:

```text
Scene View Actor
  UiElementComponent
  UiLayoutHostComponent

  World Render View Actor
    UiElementComponent
    UiLayoutItemComponent(slot: fill)
    RenderViewportComponent
    FullscreenableViewComponent

  Camera3 Gizmo Actor
    UiElementComponent
    UiLayoutItemComponent(slot: overlay, layer: gizmo)
    Camera3GizmoComponent
```

Required deletion:

- Remove `SceneViewportComponent` ownership of `canvasHostElement` and
  `overlayElement` once `RenderViewportComponent` and layout overlay host are
  active.
- Remove any direct parent DOM handoff from Scene viewport to Camera3 gizmo.
- Remove `sceneView.viewport.overlayElement` as the parent path for Camera3.
- Remove `sceneView.viewport.canvasHostElement` as a public Scene shell fact.
- Remove or rewrite `createEditorSceneViewHost().measureNow()` assumptions so
  measurement belongs to the render viewport/layout host, not the old shell.
- Remove Scene-specific fullscreen ownership from the tab/Scene shell.

Exit gates:

- World render view owns only render target display/resize.
- Render target ownership is explicit. If the runtime still owns the render
  output, `RenderViewportComponent` uses borrowed-target semantics and never
  disposes it.
- Camera3 gizmo is a sibling overlay actor.
- Scene view is just a composition host.
- Grep has no production matches for `overlayElement`, `canvasHostElement`, or
  direct `sceneView.viewport` DOM handoff except deletion-proof tests.
- CSS cleanup is complete: `.scene-window__canvas-host` and
  `.scene-window__overlay` are deleted or renamed to the new generic viewport /
  overlay classes. No compatibility selectors remain.
- Hierarchy shows Scene View, World Render View, Camera3, and runtime content
  without duplicates after repeated close/reopen.

### Step 11: Move Fullscreen Intent To Render View

Make the render viewport control the fullscreen/restore command surface.

Required changes:

- Scene run mode command asks the render view fullscreen command, not the Scene
  tab/shell.
- The render view sends presentation intent through the existing window
  presentation/lifecycle owner.
- Workspace presentation owner still performs isolation/suppression and
  restore.

Exit gates:

- `WindowWorkspaceGraph` and lifecycle remain the only placement/presentation
  mutation truth.
- Scene tab has no fullscreen-specific implementation.
- Fullscreen/restore smoke proves runtime-only fullscreen frames are not
  persisted.

### Step 12: Remove Legacy Editor Dependencies

Delete old Editor/App Scene presentation APIs after migration.

Candidates to remove or shrink:

- `SceneViewportComponent` old DOM/registration responsibilities.
- Old `createEditorSceneViewHost` overlay assumptions if they only exist for
  the previous viewport component.
- App-local Scene installer code that manually wires overlay parent DOM.
- App-local App Menu component if all menu behavior is generic.

Exit gates:

- Grep has no production references to old Scene viewport overlay DOM fields.
- Grep has no production references to app-local menu row/highlight state.
- No compatibility re-export exists for old Scene/App Menu component APIs.

### Step 13: Boundary Tests And QA

Update architecture boundaries once the new rules are real.

Required invariants:

- `ui-framework` generic controls do not import product/editor/runtime feature
  code.
- App-local App Menu does not render menu rows directly.
- Scene view no longer provides a special overlay parent to Camera3.
- Camera3 gizmo is a sibling overlay actor under Scene, not a child of the
  render viewport actor.
- Fullscreen intent originates from a generic control port; workspace mutation
  remains lifecycle/presentation-owned.

Validation matrix:

```powershell
npm run prism:smoke:prepare
npm run test -w ui-framework
npm run typecheck:test -w ui-framework
npm run build -w ui-framework
npm run test -w editor
npm run typecheck -w editor
npm run build -w editor
npm run test -w wallpaper-tesseract -- architecture-boundaries project-prism-smoke-contract project-prism-smoke-evidence-file
npm run test
npm run typecheck
npm run build
```

Browser smoke must cover:

- Tab-local menu bar appears when a child menu actor is added.
- Removing the menu actor collapses the view body back to full height.
- Menu hover/highlight follows the hovered item, not the first item.
- Menu hover/activation does not break tab drag, dock preview, or tab close hit
  targets.
- Scene World Render View resizes correctly.
- Smoke data records render viewport rect, canvas rect, overlay rect, and
  Camera3 actor-input hit evidence.
- Camera3 gizmo renders above the world view and remains interactable.
- Scene close/reopen repeated several times has no stale canvas or duplicate
  actors, no old resize subscriber, and no stale frame source.
- Render view fullscreen/restore works and persistence remains logical.
- Mobile viewport still has menu/viewport/gizmo reachable.

## Stop Conditions

Stop and amend this plan if:

- The implementation requires adding UI-specific layout, DOM, style, or
  control semantics to `actor-core`.
- A framework-agnostic actor tree observation need appears and cannot be
  satisfied by frame-update diffing; pause and design that actor-core capability
  explicitly before continuing.
- `WindowFrameSurfaceComponent` needs product-specific menu/Scene knowledge.
- A generic UI control needs to import `editor`, `wallpaper-runtime`, or app
  feature modules.
- Fullscreen cannot be expressed as an intent to the existing presentation
  owner.
- Migrating Scene requires a compatibility Scene viewport component to remain
  in production.

## Completion Criteria

Project Arbor is complete when:

- `ui-framework` owns generic actor-backed UI layout/control primitives.
- A menu bar can be added to a tab by adding a child actor with layout/menu
  components.
- Scene is a normal actor-backed UI subtree, not a special viewport shell.
- The world render view is a generic render viewport control plus product
  runtime binding.
- Camera3 gizmo is a sibling overlay actor.
- Fullscreen/restore is exposed by the render view control and executed by the
  existing workspace presentation owner.
- Old app-local App Menu and Scene viewport implementations are deleted, not
  kept as compatibility paths.
