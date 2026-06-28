# Project Arbor Gate 4: Generic Menus And App Menu Replacement

Status: completed
Created: 2026-06-28
Parent plan: `docs/project-arbor-ui-framework-actor-layout-plan.md`

Completed: 2026-06-28

Gate 4 landed the full vertical Arbor App Menu path and deleted the old
app-local row/highlight implementation. Fresh browser evidence is:

```text
temp/project-arbor-gate-4-smoke-data.json
temp/project-arbor-gate-4-smoke-report.md
```

Validate it with:

```powershell
$env:PROJECT_ARBOR_GATE_4_SMOKE_EVIDENCE="temp/project-arbor-gate-4-smoke-data.json"; npm run test -w wallpaper-tesseract -- project-arbor-gate-4-smoke-contract
```

Final validation passed:

```powershell
npm run test -w ui-framework
npm run typecheck:test -w ui-framework
npm run build -w ui-framework
$env:PROJECT_ARBOR_GATE_4_SMOKE_EVIDENCE="temp/project-arbor-gate-4-smoke-data.json"; npm run test -w wallpaper-tesseract -- app-menu architecture-boundaries project-prism-smoke-contract project-arbor-gate-4-smoke-contract
npm run typecheck -w wallpaper-tesseract
npm run build -w wallpaper-tesseract
npm run test
npm run typecheck
npm run build
```

`npm run build` keeps the existing Vite chunk size warning.

Closure hardening removed the generic popup DOM `click` activation path. Menu
item pointer activation now goes through actor-input `onInputEnd`; DOM pointer
handling is limited to hover and outside dismiss, and the boundary tests forbid
production `ui/menu` click listeners.

## Goal

Gate 4 proves the first real vertical Arbor control path:

```text
actor tree -> UiElement -> UiLayoutItem/Host -> generic menu components -> app Window menu
```

The gate must land as one acceptance unit. It may use internal checkpoints, but
it is not complete until the generic menu controls are used by the real App
Menu and the old app-local row/highlight implementation is deleted.

## Scope

In scope:

- `packages/ui-framework/src/ui/menu/**`
- `packages/ui-framework/src/ui/install-ui-component-definitions.ts`
- `packages/ui-framework/src/index.ts`
- `apps/wallpaper-tesseract/src/features/app-menu/**`
- `apps/wallpaper-tesseract/src/ui-framework-fixture/**` where it currently
  installs the old app-local App Menu
- `apps/wallpaper-tesseract/src/architecture-boundaries.test.ts`
- App style manifest entries needed to remove old app-menu-specific selectors
- Smoke evidence under `temp/`
- Progress document updates after implementation

Out of scope:

- Scene viewport, fullscreen, Camera3, render viewport, and Gate 5 work
- Adding UI semantics to `actor-core`
- Moving window workspace, docking, or lifecycle facts into generic menu code
- Preserving compatibility exports for the old App Menu model/component

## Current Facts

- `packages/ui-framework/src/model/app-menu-model.ts` currently mixes a menu
  item model with window workspace facts:
  - `WindowViewIdentity`
  - `WindowViewTypeKey`
  - `WindowViewKey`
  - `WindowWorkspaceViewEntry`
  - `createWindowMenuItem`
  - `createWindowMenuItems`
- `packages/ui-framework/src/index.ts` currently exports
  `./model/app-menu-model`.
- `apps/wallpaper-tesseract/src/features/app-menu/app-menu-bar-component.ts`
  directly renders the App Menu DOM, owns `#rows`, owns `#activeRowIndex`, owns
  menu open/highlight state, and imports `createWindowMenuItems` from
  `ui-framework`.
- `apps/wallpaper-tesseract/src/features/app-menu/index.ts` re-exports
  `createWindowMenuItem` and `createWindowMenuItems` from `ui-framework`.
- `apps/wallpaper-tesseract/src/features/app-menu/app-menu.css` uses
  `.app-menu-bar*` selectors tied to the old component DOM.
- `apps/wallpaper-tesseract/src/ui-framework-fixture/install-ui-framework-fixture.ts`
  currently installs the old app-local App Menu component definitions and
  feature.
- `packages/editor/src/hierarchy/hierarchy-panel-component.ts` also has a
  `#rows` field. Gate 4 grep checks must not scan all packages for `#rows`, or
  they will create false blockers.

## Target Shape

Generic menu controls live in `ui-framework`:

```text
packages/ui-framework/src/ui/menu/
  menu-action.ts
  menu-model.ts
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
```

The real Window menu becomes an app/window adapter over those generic controls:

```text
App Menu Host Actor
  UiElementComponent(borrowed app shell menuSlot)
  UiLayoutHostComponent

  App Menu Bar Actor
    UiElementComponent
    UiLayoutItemComponent(slot: fill)
    MenuBarComponent

    Window Menu Bar Item Actor
      UiElementComponent
      MenuBarItemComponent

      Window Popup Actor
        UiElementComponent
        PopupMenuComponent

        Window Menu Item Actor(s)
          UiElementComponent
          MenuItemComponent
```

Generic `ui-framework` menu components own generic menu behavior only:

- menu open/dismiss state;
- hover and keyboard active item state;
- disabled item behavior;
- item activation payload dispatch;
- actor-input hit routing for pointer activation;
- component-owned DOM structure and generic diagnostics.

The app/window adapter owns window-specific facts:

- reading `WindowWorkspaceViewCatalog`;
- deriving Window menu descriptors from view entries;
- translating menu activation payloads into `WindowFrameIntentSink`;
- hiding/showing App Menu in run/develop mode if that policy remains product
  behavior.
- creating the App Menu host actor over the app shell `menuSlot` using
  `UiElementComponent` borrowed ownership.

Gate 4 must remove the current `parent: HTMLElement` direct-append feature
contract. The app shell may still expose a physical `menuSlot`, but the App Menu
feature must treat it as a borrowed host element and let `UiLayoutHostComponent`
lay out the real menu bar child actor. This proves the production App Menu uses
the same Arbor layout chain as the ui-framework fixture.

## Non-Negotiables

- Do not leave `packages/ui-framework/src/model/app-menu-model.ts` as a public
  compatibility surface.
- Do not move the current app-menu model verbatim into `ui/menu/menu-model.ts`.
  Generic menu code must not import or encode window workspace identity,
  lifecycle, docking, or app-local product policy.
- Do not keep both `AppMenuBarComponent` row rendering and generic menu
  rendering in production.
- Do not add a global UI registry or a second UI tree.
- Do not let `WindowFrameSurfaceComponent` learn about menu bars.
- Do not keep `installAppMenuFeature({ parent: HTMLElement })` as the
  production App Menu placement contract. A borrowed host element is acceptable
  only as the `UiElementComponent` root for an App Menu Host actor.
- Do not hard-code product/global input stack priority in generic menu
  components. Generic menu components may define actor-local hit parts and route
  scores; cross-window `stackPriority` must be provided by actor-input binding
  options or the app/window adapter.
- Do not use DOM `click` handlers as the activation path. Pointer activation
  must remain on actor-input. Keyboard handling may stay component-owned until
  the project has a generic keyboard input route, but it must mutate only the
  menu component state and command sink.
- Do not keep old CSS selectors as compatibility aliases.

## Step 0: Entry Audit

Before edits, confirm the current symbols and stale surfaces:

```powershell
rg "createWindowMenuItems|createWindowMenuItem|AppMenuBarComponent|appMenuBarComponentType|#rows|#activeRowIndex|app-menu-bar__" apps/wallpaper-tesseract/src/features/app-menu packages/ui-framework/src
rg "export \\* from [\"']\\.\\/model\\/app-menu-model[\"']" packages/ui-framework/src/index.ts
rg "features/app-menu|app-menu-model|app-menu-bar" apps/wallpaper-tesseract/src/architecture-boundaries.test.ts apps/wallpaper-tesseract/src/ui-framework-fixture
```

Expected entry state:

- Matches exist. They are the old implementation to remove.
- Unrelated Hierarchy `#rows` is ignored.

Do not start Gate 4 by adding a compatibility barrel. The first code movement
must choose the new owner of the generic menu model and the window-specific
adapter.

## Step 1: Define Generic Menu Model And Move Window Adapter Out

Create `packages/ui-framework/src/ui/menu/menu-model.ts` with only generic menu
facts.

Allowed generic concepts:

- menu id;
- menu item id;
- label;
- enabled/disabled;
- checked state;
- item role such as command, checkbox, separator, submenu trigger;
- optional shortcut text;
- optional generic leading visual descriptor;
- opaque command payload owned by the caller;
- stable item ordering.

Forbidden generic concepts:

- `WindowViewIdentity`
- `WindowViewTypeKey`
- `WindowViewKey`
- `WindowWorkspaceViewEntry`
- `WindowFrameIntentSink`
- `WindowWorkspace`
- docking/lifecycle types
- Scene, Camera3, Tesseract, Debug, Hierarchy, Inspector policy
- app-local workspace mode paths

Move the current Window menu derivation into app/window composition:

- Prefer a new app-local file such as:

```text
apps/wallpaper-tesseract/src/features/app-menu/window-menu-items.ts
```

- It may import window workspace catalog/view-entry types.
- It may map window entries to generic menu descriptors.
- It may create opaque payloads such as `{ kind: "open-or-focus-type", ... }`,
  but those payload types stay app-local.
- It must not render DOM or own highlight/open state.

Delete the old public model path:

- Delete `packages/ui-framework/src/model/app-menu-model.ts`.
- Delete or move `packages/ui-framework/src/model/app-menu-model.test.ts`.
- Remove `export * from "./model/app-menu-model";` from
  `packages/ui-framework/src/index.ts`.
- Remove `createWindowMenuItem` / `createWindowMenuItems` re-exports from
  `apps/wallpaper-tesseract/src/features/app-menu/index.ts`.

Checkpoint tests:

```powershell
npm run test -w ui-framework -- menu
npm run typecheck:test -w ui-framework
npm run test -w wallpaper-tesseract -- app-menu
```

Exit checks:

```powershell
Test-Path packages/ui-framework/src/model/app-menu-model.ts
rg "WindowViewIdentity|WindowWorkspaceViewEntry|WindowWorkspace|WindowFrame|createWindowMenuItems" packages/ui-framework/src/ui/menu --glob "!*.test.ts"
rg "createWindowMenuItems|createWindowMenuItem" packages/ui-framework/src apps/wallpaper-tesseract/src/features/app-menu --glob "!*.test.ts"
```

The `Test-Path` command must print `False`. The final `rg` may match only the
new app-local adapter if the function names are still useful there; it must not
match `ui-framework`.

## Step 2: Implement Generic Menu Components

Add menu components and definitions under `packages/ui-framework/src/ui/menu`.

### MenuBarComponent

Responsibilities:

- Own the menu bar actor's root behavior.
- Read direct child `MenuBarItemComponent` actors.
- Coordinate which menu bar item has an open popup.
- Route pointer hits through actor-input.
- Expose stable diagnostics such as:
  - `data-ui-menu-role="menubar"`
  - `data-ui-menu-open-item-id`

Must not:

- derive window menu items;
- call window lifecycle;
- create product commands;
- layout unrelated sibling controls.

### MenuBarItemComponent

Responsibilities:

- Represent one top-level menu bar item.
- Own label/disabled state for the menu bar item actor.
- Point to its popup child actor if one exists.
- Request open/dismiss through its parent menu bar owner.

### PopupMenuComponent

Responsibilities:

- Own highlight/active item state for direct child `MenuItemComponent` actors.
- Dismiss on Escape or outside actor-input dismiss hit.
- Skip disabled items during keyboard navigation.
- Keep highlight state by item actor/id, not by stale row index.
- Recompute child item list from actor tree/component state.

### MenuItemComponent

Responsibilities:

- Represent a generic menu item.
- Store descriptor state.
- Expose generic activation payload.
- Emit activation to a narrow generic command sink or parent popup callback.
- Support disabled and checkable state.

### Definitions

Definitions should use existing component requirements:

- All visible menu controls require same-actor `UiElementComponent` with
  `autoAdd: false` and `reuseExisting: true`.
- Definitions are singleton unless there is a concrete need for multiple menu
  components on one actor.
- Use actor-input attachments where pointer hit routing is needed.
- Generic definitions must not bake in an `APP_MENU_PRIORITY`-style global
  value. If a menu needs cross-window/app-overlay priority, pass it through the
  same actor-input binding or adapter-owned stack priority path used by other
  UI actors.
- Do not add a package-level menu registry.

### Styles And DOM

The generic components may use component-owned classes or stable data
attributes. Prefer structural inline style only when needed for function. Do
not copy `.app-menu-bar__*` selectors into generic UI as compatibility names.

Unit tests must cover:

- hover highlight follows the hovered child, including the old first-row bug;
- keyboard next/previous skips disabled items;
- click/actor-input activation calls the generic command sink;
- disabled item does not activate;
- Escape/dismiss closes the popup;
- removing a highlighted actor clears or moves highlight deterministically;
- disposing popup/menu bar detaches owned DOM and leaves borrowed elements
  according to `UiElementComponent` rules;
- generic menu files contain no window workspace imports.

Checkpoint:

```powershell
npm run test -w ui-framework -- menu ui-element ui-layout-item ui-layout-host
npm run typecheck:test -w ui-framework
npm run build -w ui-framework
```

## Step 3: Install And Export UI Definitions

Add:

```text
packages/ui-framework/src/ui/install-ui-component-definitions.ts
packages/ui-framework/src/ui/index.ts
packages/ui-framework/src/ui/menu/index.ts
```

`installUiComponentDefinitions` should install only real generic UI
definitions that exist after Steps 1 and 2:

- `uiElementComponentDefinition`
- `uiLayoutItemComponentDefinition`
- `uiLayoutHostComponentDefinition`
- menu bar/item/popup/item definitions

Do not add placeholder viewport/fullscreen definitions in Gate 4.

Public exports:

- Export stable component types, definitions, and generic descriptor types.
- Keep helper internals package-private, especially highlight-controller
  helpers if no production caller needs them.
- Do not export old app-menu names.

Update any app/fixture component definition installation to use
`installUiComponentDefinitions` where it reduces duplication. Do not create a
new app-local "UI package facade".

Checkpoint:

```powershell
npm run test -w ui-framework -- menu
npm run typecheck:test -w ui-framework
npm run build -w ui-framework
```

## Step 4: Prove The Vertical Menu Layout Fixture

Add a ui-framework-only test fixture that proves the Arbor authoring model:

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

The fixture should live in tests near the relevant owner, for example:

```text
packages/ui-framework/src/ui/menu/menu-layout-fixture.test.ts
```

Assertions:

- Adding the menu child creates a top region/wrapper.
- Removing/destroying the menu child removes the top contribution.
- Fill body remains owned by the parent `UiLayoutHostComponent`.
- Overlay child stacks without moving the fill body.
- Menu hover/highlight follows the hovered child item.
- No `WindowFrameSurfaceComponent`, App Menu, Scene, or Editor code
  participates in the fixture.

Checkpoint:

```powershell
npm run test -w ui-framework -- menu-layout ui-layout-host ui-layout-item ui-element
npm run typecheck:test -w ui-framework
```

## Step 5: Replace App Menu With Actor-Backed Generic Menu

Replace the old app-local App Menu component with an app/window adapter that
constructs generic menu actors.

Required production subtree:

```text
App Menu Host Actor
  UiElementComponent(element: appShell.menuSlot, ownership: borrowed)
  UiLayoutHostComponent

  App Menu Bar Actor
    UiElementComponent
    UiLayoutItemComponent(slot: fill)
    MenuBarComponent

    Window Menu Bar Item Actor
      UiElementComponent
      MenuBarItemComponent

      Window Popup Actor
        UiElementComponent
        PopupMenuComponent

        Window Menu Item Actor(s)
          UiElementComponent
          MenuItemComponent
```

The app shell may continue to expose `menuSlot`, but the feature must no longer
append menu DOM directly to it. `menuSlot` is borrowed by `UiElementComponent`
on the host actor, and all real menu DOM is placed through
`UiLayoutHostComponent` and `UiLayoutItemComponent`.

Delete or rewrite these old files:

```text
apps/wallpaper-tesseract/src/features/app-menu/app-menu-bar-component.ts
apps/wallpaper-tesseract/src/features/app-menu/app-menu-bar-definition.ts
apps/wallpaper-tesseract/src/features/app-menu/app-menu-bar-actor-factory.ts
apps/wallpaper-tesseract/src/features/app-menu/app-menu-bar-component.test.ts
apps/wallpaper-tesseract/src/features/app-menu/app-menu-bar-actor-factory.test.ts
```

Allowed replacement files:

```text
apps/wallpaper-tesseract/src/features/app-menu/window-menu-items.ts
apps/wallpaper-tesseract/src/features/app-menu/window-menu-items.test.ts
apps/wallpaper-tesseract/src/features/app-menu/install-app-menu-feature.ts
apps/wallpaper-tesseract/src/features/app-menu/install-app-menu-feature.test.ts
```

If a small app-local component is still necessary to synchronize the Window
catalog into menu item actors, it must be an adapter only:

- It may read `WindowWorkspaceViewCatalog`.
- It may create/destroy child actors to match descriptor ids.
- It must derive stable actor ids from stable descriptor ids. Repeated
  catalog refreshes, menu open/close cycles, and view close/reopen cycles must
  update existing actors when possible and destroy stale actors deterministically.
- It may translate activation payloads into `WindowFrameIntentSink`.
- It may observe workspace mode to hide/show the App Menu if that policy
  remains product behavior.
- It must not render menu rows directly.
- It must not own active/highlight row state.
- It must not duplicate generic menu open/dismiss state.

Installation target:

- `installAppMenuFeature` should create an actor subtree using
  `UiElementComponent` plus generic menu components.
- `installAppMenuFeature` should accept a borrowed host element option, such as
  `hostElement`, rather than a direct append `parent`. If the option keeps the
  old name temporarily during editing, it must be renamed before the gate
  closes; no production API should imply direct DOM append ownership.
- `installAppMenuComponentDefinitions` should disappear if
  `installUiComponentDefinitions` covers all generic components and the app
  adapter has no component definition.
- If an app adapter component remains, its definition must be app-local and
  narrow. Do not export it as a reusable `ui-framework` menu API.
- `apps/wallpaper-tesseract/src/ui-framework-fixture/install-ui-framework-fixture.ts`
  should install the new definitions and app menu feature. It must not import
  deleted app-menu-bar component definitions.

Regression tests:

- Window menu item derivation preserves ordering and representative selection.
- Multi-instance views still expose "New <label>" where current behavior
  requires it.
- Activating a type item calls `requestOpenOrFocusViewType(..., "menu")`.
- Activating a new-instance item calls `requestCreateViewInstance(..., "menu")`.
- Activating an instance item calls `requestFocusViewInstance(..., "menu")`.
- Disabled descriptors do not activate.
- Workspace mode hides/closes the App Menu if the current product policy
  requires it.
- Repeated catalog refresh/open/close/reopen cycles do not duplicate menu bar,
  popup, or menu item actors.
- Closing a view removes its stale menu item actor.
- Reopening a view recreates or updates exactly one menu item actor.
- If the currently highlighted item is deleted, `PopupMenuComponent` clears or
  moves highlight deterministically according to generic menu rules.
- If the open popup's owning menu bar item is deleted, the menu closes
  deterministically.
- The host actor uses borrowed `menuSlot`, and dispose does not remove the app
  shell slot.
- No DOM row/highlight assertions remain in app-local tests.

Checkpoint:

```powershell
npm run test -w wallpaper-tesseract -- app-menu
npm run typecheck -w wallpaper-tesseract
npm run build -w wallpaper-tesseract
```

## Step 6: Delete Old CSS And Style Entrypoints

Delete or replace old selectors:

```text
.app-menu-bar
.app-menu-bar__button
.app-menu-bar__menu
.app-menu-bar__menu-item
.app-menu-bar__menu-item-leading
.app-menu-bar__menu-item-label
.app-menu-bar__menu-item-shortcut
.app-menu-bar__checkbox
.app-menu-bar__icon
```

Acceptable outcomes:

- `apps/wallpaper-tesseract/src/features/app-menu/app-menu.css` is deleted and
  removed from `apps/wallpaper-tesseract/src/app/styles.ts`; or
- it is replaced with a small app theme stylesheet that targets generic menu
  data/classes and contains no old `.app-menu-bar*` selectors.

Do not keep old selectors as aliases for the new menu DOM.

Checkpoint:

```powershell
rg "app-menu-bar" apps/wallpaper-tesseract/src packages --glob "!*.test.ts"
npm run build -w wallpaper-tesseract
```

The final `rg` may match documentation or test fixtures only if they are
explicit old-path deletion tests. It must not match production CSS/DOM code.

## Step 7: Flip Architecture Boundaries

Update `apps/wallpaper-tesseract/src/architecture-boundaries.test.ts`.

Replace old expectations that bless `app-menu-model.ts` and the app-local
component with rules that forbid the old shape:

- `packages/ui-framework/src/model/app-menu-model.ts` is undefined.
- `packages/ui-framework/src/index.ts` does not export app-menu model names.
- `packages/ui-framework/src/ui/menu/**` does not import window workspace,
  lifecycle, dock, app-local feature, Scene, Camera3, Tesseract, Debug,
  Hierarchy, or Inspector types.
- App-local App Menu does not contain `#rows`, `#activeRowIndex`,
  `renderMenu`, `createMenuItemElement`, `.onclick`, or DOM click listeners.
- App-local App Menu no longer accepts `parent: HTMLElement` as its production
  direct-append placement API; it uses a borrowed host element owned by a
  `UiElementComponent` on the App Menu Host actor.
- App-local App Menu imports generic menu APIs from `ui-framework` public
  exports only, never internal `ui-framework/src` paths.
- Generic menu sources do not contain `APP_MENU_PRIORITY`, `10_000`, or other
  product/global priority constants. If a generic menu participant exposes an
  `inputStackPriority` surface, the value must come from options, actor-input
  binding configuration, or app/window adapter ownership, not from a hard-coded
  product constant.
- `WindowFrameSurfaceComponent` has no menu-specific branch.
- `ui-framework-fixture` no longer imports old app-menu component definitions.

Checkpoint:

```powershell
npm run test -w wallpaper-tesseract -- architecture-boundaries
```

## Step 8: Gate 4 Browser Smoke

Before browser smoke:

```powershell
npm run prism:smoke:prepare
npm run dev -w wallpaper-tesseract
```

Generate fresh evidence. Do not reuse Project Prism or Gate 3 data.

Required smoke coverage:

- App boots with no console errors.
- Window menu is reachable.
- Hovering each menu item highlights that item, not always the first item.
- Keyboard navigation moves highlight and skips disabled items.
- Activation opens/focuses an existing view.
- Activation creates a new Inspector instance if that command remains.
- Escape or outside click/dismiss closes the popup.
- Menu hover/open does not break tab drag.
- Menu hover/open does not break dock preview.
- Menu hover/open does not break tab close hit target.
- Smoke records actor-input priority/route evidence for menu hits and for the
  tab drag, dock preview, and tab close sanity paths. At minimum, record the
  hit owner/actor id, part id, stack priority source, and route score so a menu
  priority regression is diagnosable.
- Mobile viewport can still reach the menu.

Write:

```text
temp/project-arbor-gate-4-smoke-data.json
temp/project-arbor-gate-4-smoke-report.md
```

The smoke data should include at least:

- viewport size;
- console error list;
- menu bar rect;
- popup rect;
- hovered item id/label;
- active item id/label after hover and after keyboard navigation;
- activation result or lifecycle intent evidence;
- tab drag/dock/tab-close sanity result.
- actor-input route/priority evidence for menu and non-menu sanity hits.

Validate evidence with the current smoke validator if possible. If the current
validator lacks Arbor-specific fields, add narrowly scoped contract tests rather
than accepting undocumented manual evidence.

## Step 9: Final Gate 4 Validation

Run:

```powershell
npm run test -w ui-framework
npm run typecheck:test -w ui-framework
npm run build -w ui-framework
npm run test -w wallpaper-tesseract -- app-menu architecture-boundaries project-prism-smoke-contract
npm run typecheck -w wallpaper-tesseract
npm run build -w wallpaper-tesseract
npm run test
npm run typecheck
npm run build
```

Then run the hard deletion greps:

```powershell
Test-Path packages/ui-framework/src/model/app-menu-model.ts
rg "WindowViewIdentity|WindowWorkspaceViewEntry|WindowWorkspace|WindowFrame|createWindowMenuItems" packages/ui-framework/src/ui/menu --glob "!*.test.ts"
rg "#rows|#activeRowIndex|renderMenu|createMenuItemElement|app-menu-bar__" apps/wallpaper-tesseract/src/features/app-menu --glob "!*.test.ts"
rg "parent:\\s*HTMLElement|APP_MENU_PRIORITY|10_000" apps/wallpaper-tesseract/src/features/app-menu packages/ui-framework/src/ui/menu --glob "!*.test.ts"
rg "from\\s+[\"']ui-framework/src|from\\s+[\"'][^\"']*packages/ui-framework/src" apps/wallpaper-tesseract/src packages/editor/src --glob "!*.test.ts"
rg "app-menu-model" packages/ui-framework/src apps/wallpaper-tesseract/src --glob "!*.test.ts"
```

Expected:

- `Test-Path` prints `False`.
- The remaining `rg` commands produce no production matches unless the plan was
  amended with a concrete, same-gate deletion reason.

Update `docs/current-project-progress.md` with:

- Gate 4 status;
- new files and deleted files;
- validation commands run;
- smoke evidence paths.

## Stop Conditions

Stop and amend the plan if:

- Generic menu needs window workspace or lifecycle types to function.
- App Menu replacement requires `WindowFrameSurfaceComponent` to know about
  menus.
- Menu controls need UI-specific changes in `actor-core`.
- Generic menu needs to hard-code app/global stack priority to remain
  interactable.
- The app-local adapter starts owning highlight/open menu state.
- The app-local adapter cannot keep menu item actors stable across catalog
  refresh/open/close/reopen without adding a second menu state model.
- Old App Menu component or app-menu model must remain in production after the
  new generic menu is installed.
- Browser smoke shows menu input blocks tab drag/dock/close and the cause is
  not local to menu actor-input priority or hit routing.

## Completion Criteria

Gate 4 is complete when:

- `ui-framework` owns generic menu controls and only generic menu facts.
- Window menu descriptor derivation lives outside generic `ui-framework`.
- The real App Menu uses a borrowed App Menu Host actor plus
  `UiLayoutHostComponent`/`UiLayoutItemComponent`; no direct `parent:
  HTMLElement` append contract remains.
- Generic menu does not hard-code app/global actor-input priority.
- The old public `app-menu-model` path is deleted.
- The old app-local App Menu DOM/highlight component is deleted or rewritten so
  it no longer renders rows or owns highlight state.
- The real app and ui-framework fixture use actor-backed generic menu controls.
- Boundary tests forbid old menu facts from returning.
- Fresh Gate 4 browser smoke evidence exists under `temp/`.
- The final validation matrix passes.
