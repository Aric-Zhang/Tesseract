# Project Arbor: Actor-Backed UI Layout And Controls

Status: consolidated execution plan, amended after Step 3 closure
Created: 2026-06-14
Amended: 2026-06-28
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
    UiLayoutItemComponent(slot: overlay, layer: CAMERA3_GIZMO_OVERLAY_LAYER)
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
    UiLayoutItemComponent(slot: overlay, layer: CAMERA3_GIZMO_OVERLAY_LAYER)
    Camera3GizmoComponent

  Runtime Content Actor(s)
    Runtime components, not UI layout ownership
```

The world render view is the presentation target. Runtime content remains owned
by runtime owners. Camera3 gizmo is a sibling overlay, not a child of the world
render view.

`CAMERA3_GIZMO_OVERLAY_LAYER` is a numeric app/editor constant. Generic
`ui-framework` layout knows only numeric layer ordering, not product layer names.

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
- Do not move the current `app-menu-model.ts` into `ui/menu/menu-model.ts`
  verbatim. The generic menu model may contain only product-agnostic menu
  descriptors, menu item state, hierarchy, and opaque command payloads. It must
  not import or encode `WindowViewIdentity`, `WindowWorkspaceViewEntry`,
  window lifecycle types, docking/window commands, or app-local view policy.
- Window-specific menu item derivation, such as `createWindowMenuItems`, must
  either remain in the app/window composition layer as a thin adapter over the
  generic menu descriptor or be deleted/replaced. It must not become part of the
  generic menu model.

## Completed Foundation Gate

The first three small steps are already complete and are kept as historical
foundation records. Do not split future work this narrowly unless a real
architecture blocker appears.

Completed records:

```text
docs/project-arbor-step-1-ui-element-ownership-plan.md
docs/project-arbor-step-2-ui-layout-item-plan.md
docs/project-arbor-step-3-ui-layout-host-plan.md
```

Delivered foundation:

- `UiElementComponent`: explicit owned/borrowed DOM root ownership.
- `UiLayoutItemComponent`: same-actor layout declaration.
- `UiLayoutHostComponent`: first direct-child layout owner with host-owned
  regions/wrappers and no product concepts.

The remaining gates are intentionally wider. Each must prove a vertical
capability and delete the old implementation path in the same gate.

## Remaining Execution Gates

### Gate 4: Generic Menus And App Menu Replacement

Detailed execution file:

```text
docs/project-arbor-gate-4-generic-menu-app-menu-plan.md
```

This gate merges the old generic menu, UI definition installer, vertical layout
slice, and app-local App Menu replacement steps.

Former steps covered:

- old Step 4: generic menu components;
- old Step 7: conservative UI definition installer and boundary checks;
- old Step 7.5: vertical layout/menu fixture;
- old Step 8: replace app-local App Menu monolith.

Why these belong together:

- Generic menu components are not sufficiently proven until a real menu and a
  layout-host fixture use them.
- The old App Menu row/highlight implementation is the current duplicate menu
  behavior; keeping it after generic menu lands would create two menu truths.
- `installUiComponentDefinitions` should be introduced when real generic UI
  definitions are installed together, not as a standalone mini-step.

Required work:

Execute the gate internally in this order while keeping it one acceptance gate:

1. Define the generic menu model boundary and delete/rename the old public
   `app-menu-model` path without preserving compatibility exports.
2. Implement generic menu components and their definitions.
3. Prove the vertical layout/menu fixture in `ui-framework`.
4. Replace the app-local App Menu presentation and delete the old row DOM,
   highlight, and selector implementation.
5. Run fresh browser smoke and write evidence under `temp/`.

- Add generic menu actors/components in `packages/ui-framework/src/ui/menu`:
  - `MenuBarComponent`
  - `MenuBarItemComponent`
  - `PopupMenuComponent`
  - `MenuItemComponent`
  - a small highlight/open-menu owner, kept package-private unless needed.
- Move/rename or delete `packages/ui-framework/src/model/app-menu-model.ts`.
  There must not be both public `app-menu-model` and `ui/menu/menu-model`
  concepts after the gate closes.
- Generic `ui/menu` files must not import window workspace identity, view entry,
  lifecycle, docking, or app-local product command types. If app/window code
  still needs a window-menu adapter, keep it outside the generic menu package.
- Add `installUiComponentDefinitions` only for definitions that are real and
  used in this gate.
- Add a ui-framework vertical fixture:

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

- Migrate app-local App Menu presentation to actor-backed generic menu
  components.
- Production App Menu must create a borrowed App Menu Host actor over the app
  shell menu slot, then use `UiLayoutHostComponent` and `UiLayoutItemComponent`
  to place the real menu bar child actor. The old direct `parent: HTMLElement`
  append contract must be deleted before Gate 4 closes.
- Keep product-specific menu descriptors/actions outside generic `ui-framework`
  controls.
- Generic menu components must not hard-code app/global stack priority such as
  the old `APP_MENU_PRIORITY`. Cross-window priority must be injected through
  actor-input binding or app/window adapter ownership.
- Delete app-local row DOM/highlight/open-state implementation instead of
  wrapping it.
- Clean old App Menu CSS/selectors; no compatibility selectors remain.
- Add or update architecture boundaries:
  - `packages/ui-framework/src/ui/**` must not import `editor`,
    `wallpaper-runtime`, app-local feature modules, Scene, Camera3, Tesseract,
    Debug, Inspector, or Hierarchy code.
  - `WindowFrameSurfaceComponent` must not contain menu/toolbar/viewport/Scene
    branches.
  - generic menu files must not import window workspace command or lifecycle
    types; product actions must use a generic command sink/descriptor.
  - app-local App Menu must not render menu rows directly.
  - app-local App Menu must not expose a direct DOM parent append API.

Exit gates:

- Unit tests cover hover highlight, keyboard active item, click activation,
  disabled item behavior, Escape/dismiss, and nested actor disposal.
- The old "highlight first row forever" failure shape is covered.
- The vertical fixture proves:
  - adding the menu child gives the body less vertical space;
  - removing/destroying the menu child collapses the body back to full height;
  - adding/removing overlay children updates stacking without moving the body;
  - menu hover/highlight follows the hovered child menu item.
- Real App Menu uses the same borrowed-host + layout-host path as the fixture;
  no production direct DOM append menu path remains.
- App/window adapter tests prove descriptor diffing uses stable actor ids,
  deletes stale menu item actors, and converges highlight/open state when the
  highlighted/open item disappears.
- App-local App Menu no longer owns `#rows`, `#activeRowIndex`, or direct row
  rendering.
- Grep has no production matches for old menu row/highlight helpers outside the
  old app-local App Menu path. Do not scan all `packages` for `#rows`, because
  Hierarchy has an unrelated row implementation:

```powershell
rg "#rows|#activeRowIndex|renderMenu|createMenuItemElement|app-menu-bar__" apps/wallpaper-tesseract/src/features/app-menu --glob "!*.test.ts"
```

- Grep proves generic menu files did not absorb window-specific menu facts:

```powershell
Test-Path packages/ui-framework/src/model/app-menu-model.ts
rg "WindowViewIdentity|WindowWorkspaceViewEntry|WindowWorkspace|WindowFrame|createWindowMenuItems" packages/ui-framework/src/ui/menu --glob "!*.test.ts"
```

The `Test-Path` command must print `False`; the old public app-menu model path
must not remain as a compatibility surface.

- App-local code does not import internal `ui-framework/src` paths.
- Browser smoke verifies menu hover, activation, tab drag, dock preview, and
  tab close hit targets still work. Smoke data and a short report must be
  written under `temp/`, for example:

```text
temp/project-arbor-gate-4-smoke-data.json
temp/project-arbor-gate-4-smoke-report.md
```

- Validation:

```powershell
npm run test -w ui-framework
npm run typecheck:test -w ui-framework
npm run build -w ui-framework
npm run test -w wallpaper-tesseract -- architecture-boundaries app-menu
npm run typecheck -w wallpaper-tesseract
npm run build -w wallpaper-tesseract
```

### Gate 5: Generic Render View, Fullscreen Intent, And Scene Migration

Status: completed on 2026-06-28. Fresh evidence:
`temp/project-arbor-gate-5-smoke-data.json` and
`temp/project-arbor-gate-5-smoke-report.md`.

Detailed execution plan:

```text
docs/project-arbor-gate-5-render-viewport-scene-migration-plan.md
```

This gate merges generic render viewport, fullscreen intent, generic view shell,
Scene split, fullscreen migration, and legacy Scene/App presentation deletion.

Entry guard: before Gate 5 starts, production `packages/ui-framework/src/ui/**`
must have no DOM `click` activation shortcuts. Generic UI pointer activation
must go through actor-input; DOM hover/outside-dismiss listeners are allowed
only when they do not activate commands or intents.

Former steps covered:

- old Step 5: generic render viewport;
- old Step 6: fullscreenable view intent component;
- old Step 9: generic view shell for window content;
- old Step 10: split Scene view into ordinary UI actors;
- old Step 11: move fullscreen intent to render view;
- old Step 12: remove legacy Editor/App Scene presentation APIs.

Why these belong together:

- `RenderViewportComponent` and `FullscreenableViewComponent` are only proven
  when the Scene world view uses them.
- A separate view shell step risks adding an abstraction before the Scene
  migration proves it removes real complexity.
- The old `SceneViewportComponent` DOM shell, overlay handoff, and fullscreen
  shell behavior must be deleted in the same gate to avoid dual Scene
  presentation ownership.

Required work:

Execute the gate internally with these checkpoints, but close it only after the
whole Scene migration and old implementation deletion are complete:

1. Implement `RenderViewportComponent` and `FullscreenableViewComponent` with
   product-free unit tests.
2. Migrate Scene to the ordinary actor subtree and delete the old
   `SceneViewportComponent`/DOM handoff paths.
3. Run fullscreen, close/reopen, mobile, and interaction smoke with fresh
   evidence under `temp/`.

- Add `RenderViewportComponent` in `ui-framework`:
  - generic render target interface with `domElement`, `setSize`, and optional
    `dispose`;
  - explicit render target ownership:
    - `owned`: viewport disposes target exactly once;
    - `borrowed`: viewport only detaches/unsubscribes; runtime owner disposes;
  - Scene must use borrowed render target mode while
    `RuntimeSceneViewRuntime` remains the runtime render output disposal owner;
  - measurement and resize ownership;
  - no Scene/Camera/Tesseract/runtime package imports.
- `RenderViewportComponent` must not implement or import
  `WindowRegisteredContent`, `WindowContentRegistrationPort`, or any window
  content-registration contract. Window content registration remains owned by
  the Scene View/root content actor or the existing window content owner; the
  render viewport owns only render target DOM, resize, and target disposal
  according to its explicit ownership mode.
- Add `FullscreenableViewComponent` in `ui-framework`:
  - emits fullscreen/restore intent through a narrow presentation command port;
  - does not mutate `WindowWorkspaceGraph` or lifecycle directly;
  - emits source actor intent; app/editor integration must resolve that source
    to the registered Scene root view actor before calling window lifecycle.
- Add a generic view shell only if `UiLayoutHostComponent` alone cannot express
  tab content composition without duplication. If added, it must be a small
  owner-backed component, not a new window/content facade.
- Replace the current `SceneViewportComponent` monolith with ordinary actors:

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
    UiLayoutItemComponent(slot: overlay, layer: CAMERA3_GIZMO_OVERLAY_LAYER)
    Camera3GizmoComponent
```

- Camera3 gizmo becomes a sibling overlay actor, not a child of the render view.
- Camera3 overlay ordering is a numeric app/editor constant, not a string layer
  known by `ui-framework`.
- Delete the raw Camera3 DOM parent channel (`Camera3GizmoOptions.parent` and
  `parent:` handoff); Camera3 presentation must use its own actor element.
- World render view owns only render target display/resize. Runtime content
  remains owned by runtime owners.
- Move Scene fullscreen/run-mode command to target the render view fullscreen
  intent, while workspace presentation/lifecycle remains the placement mutation
  owner.
- Delete old Scene presentation facts:
  - `SceneViewportComponent` ownership of `canvasHostElement`;
  - `SceneViewportComponent` ownership of `overlayElement`;
  - direct parent DOM handoff from Scene viewport to Camera3;
  - `sceneView.viewport.overlayElement` public path;
  - `sceneView.viewport.canvasHostElement` public path;
  - old `createEditorSceneViewHost().measureNow()` assumptions if they only
    support the previous shell;
  - Scene-specific fullscreen implementation on the tab/Scene shell.
- Clean old CSS selectors such as `.scene-window__canvas-host` and
  `.scene-window__overlay`; no compatibility selectors remain.

Exit gates:

- Tests prove render target resize/measure and disposal for owned/borrowed
  targets.
- Scene migration tests prove the runtime render target is borrowed and viewport
  disposal does not dispose the runtime-owned render output.
- Tests or boundary checks prove render viewport does not implement/import
  window content registration contracts.
- Tests prove fullscreen component emits intent through a port and does not
  mutate workspace graph/lifecycle.
- A tab content actor can gain/remove top/fill/overlay children without
  notifying `WindowFrameSurfaceComponent`.
- `WindowFrameSurfaceComponent` contains no menu/toolbar/Scene/viewport
  special cases.
- Grep has no production references to old Scene viewport DOM handoff:

```powershell
rg "overlayElement|canvasHostElement|sceneView\\.viewport" packages apps/wallpaper-tesseract/src
```

- Grep has no production Camera3 raw DOM parent handoff:

```powershell
rg "Camera3GizmoOptions[\\s\\S]*parent\\?|parent\\s*:\\s*.*HTMLElement|parent\\s*:\\s*sceneView|parent\\s*:\\s*.*overlay" packages/editor/src apps/wallpaper-tesseract/src --glob "!*.test.ts"
```

- Grep proves the generic viewport did not absorb old window content
  registration ownership:

```powershell
rg "WindowRegisteredContent|WindowContentRegistrationPort" packages/ui-framework/src/ui/viewport --glob "!*.test.ts"
```

- Camera3 gizmo is a sibling overlay actor under Scene.
- Hierarchy shows Scene View, World Render View, Camera3, and runtime content
  without duplicates after repeated close/reopen.
- Fullscreen/restore smoke proves runtime-only fullscreen frames are not
  persisted.
- Browser smoke records render viewport rect, canvas rect, overlay rect, and
  Camera3 actor-input hit evidence. Smoke data and a short report must be
  written under `temp/`, for example:

```text
temp/project-arbor-gate-5-smoke-data.json
temp/project-arbor-gate-5-smoke-report.md
```

- Validation:

```powershell
npm run test -w ui-framework
npm run typecheck:test -w ui-framework
npm run build -w ui-framework
npm run test -w editor
npm run typecheck -w editor
npm run build -w editor
npm run test -w wallpaper-tesseract -- architecture-boundaries project-prism-smoke-contract
npm run typecheck -w wallpaper-tesseract
npm run build -w wallpaper-tesseract
```

### Gate 6: Arbor Final Boundary And Browser Gate

Detailed execution plan:

```text
docs/project-arbor-gate-6-final-boundary-browser-gate-plan.md
```

Update architecture boundaries once the new rules are real, and fold in the
cleanup discovered by the Gate 4/5 incremental implementation:

- collapse duplicate generic UI input priority facts;
- move reusable `.ui-*` control base styles to `ui-framework` with a real
  package CSS distribution/export contract;
- remove or narrow app-bootstrap Scene resize measurement if the render
  viewport owner now covers it;
- disambiguate app-local Scene integration component-definition ownership;
- consolidate Arbor smoke helper duplication around the final contract;
- keep the final Arbor smoke runner in a stable script location, with `temp/`
  reserved for generated data/report artifacts;
- audit new Arbor barrels so adapter/internal helpers do not become convenient
  public surfaces.

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
npm run build -w wallpaper-tesseract
npm run test
npm run typecheck
npm run build
```

Final browser smoke evidence must be written under `temp/`, for example:

```text
temp/project-arbor-final-smoke-data.json
temp/project-arbor-final-smoke-report.md
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
