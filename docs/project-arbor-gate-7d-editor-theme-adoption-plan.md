# Project Arbor Gate 7D: Editor Theme Adoption And Theme Menu

Status: complete
Created: 2026-06-29
Completed: 2026-06-29
Scope: `packages/ui-framework` menu/theme primitives, app-local theme
integration, app/window/editor CSS token adoption, and browser smoke evidence.

## Goal

Finish Project Arbor Gate 7 by making the existing theme token foundation
visible in the real app:

- install one root theme owner for the app shell;
- apply semantic tokens to app shell, window chrome, generic controls, and
  editor panel surfaces;
- add generic submenu support to the menu controls;
- add a real `Edit -> Theme -> <theme>` menu path for manual switching;
- delete or tokenise old hard-coded generic UI styles rather than preserving
  local compatibility CSS.

This gate is not a new UI system. It is the final adoption pass for the
actor/component UI controls and theme primitives already added in Gates 7A-7C.5.

## Entry Gate

Start only from a clean Gate 7C.5 checkpoint or an explicitly accepted dirty
baseline. Gate 7C.5 currently changed Debug and virtual-list files; commit or
otherwise name that baseline before editing Gate 7D implementation files.

Required current facts:

- `packages/ui-framework/src/ui/theme/ui-theme-tokens.ts` is the only default
  token value source.
- `ui-framework/ui/theme.css` and `ui-framework/ui/ui-framework-controls.css`
  are imported through package exports.
- App Menu is an Arbor actor tree mounted through a borrowed App Shell menu
  slot. It currently creates only the `Window` top-level menu.
- Generic menu controls support menu bar items and popup menu items, but do not
  yet support nested submenu ownership.
- Debug Log is now virtual-list backed; do not reintroduce per-log actors or
  Debug CSS while editing theme smoke.

Baseline checks before implementation:

```powershell
npm run test -w ui-framework -- theme menu fullscreenable-view render-viewport scroll tree list virtual collection
npm run test -w editor -- debug hierarchy
npm run test -w wallpaper-tesseract -- architecture-boundaries
npm run typecheck -w wallpaper-tesseract
```

## Non-Negotiables

- `ui-framework` never owns theme file paths, app storage keys, or product
  theme discovery.
- Theme defaults must remain single-sourced in `ui-theme-tokens.ts`. New tokens
  go there first; generated CSS and tests must follow.
- No app-local menu row/highlight/popup DOM rendering. Theme switching must use
  generic menu actors/components.
- No generic control should gain product-specific theme knowledge such as
  Scene, Camera3, Tesseract, Debug, Hierarchy, Inspector, or window catalog
  data.
- Pointer activation remains actor-input driven. Do not add DOM `click`
  activation shortcuts to menu or theme controls.
- Do not create a global UI/theme registry in `ui-framework`. The app can own a
  small theme controller because it chooses concrete themes. Gate 7D should
  start with in-memory selection; if persistence is required during this gate,
  it must go through an app-local `ThemeSelectionStorage` port, not direct
  `localStorage` access in app composition or `ui-framework`.
- Do not add `--ui-axis-x/y/z` to the `ui-framework` core token set. Camera3
  axis colors are editor/product semantics and must either stay product-owned
  or become a later editor-owned theme extension.
- Hard-coded generic UI colors/borders/fonts/radii outside theme defaults must
  be deleted, tokenised, or explicitly allowlisted with an owner and reason.

## Current Implementation Facts

Relevant files:

- Theme primitives:
  - `packages/ui-framework/src/ui/theme/ui-theme-tokens.ts`
  - `packages/ui-framework/src/ui/theme/ui-theme-module.ts`
  - `packages/ui-framework/src/ui/theme/ui-theme-component.ts`
- Generic menu controls:
  - `packages/ui-framework/src/ui/menu/menu-model.ts`
  - `packages/ui-framework/src/ui/menu/menu-bar-component.ts`
  - `packages/ui-framework/src/ui/menu/menu-item-component.ts`
  - `packages/ui-framework/src/ui/menu/popup-menu-component.ts`
- App Menu integration:
  - `apps/wallpaper-tesseract/src/features/app-menu/install-app-menu-feature.ts`
  - `apps/wallpaper-tesseract/src/features/app-menu/app-menu-adapter-component.ts`
  - `apps/wallpaper-tesseract/src/features/app-menu/window-menu-items.ts`
- Root shell and styles:
  - `apps/wallpaper-tesseract/src/app/create-wallpaper-app.ts`
  - `apps/wallpaper-tesseract/src/app/app-shell.ts`
  - `apps/wallpaper-tesseract/src/app/app-shell.css`
  - `apps/wallpaper-tesseract/src/style.css`
  - `apps/wallpaper-tesseract/src/window-runtime/*.css`
  - `packages/editor/src/inspector/inspector.css`
  - `packages/editor/src/scene/scene-window.css`
  - `packages/editor/src/camera3/camera3-gizmo.css`
  - `apps/wallpaper-tesseract/src/ui-framework-fixture/ui-framework-fixture.css`

Current hard-coded style debt is concentrated in app shell/window-runtime CSS,
Inspector CSS, Scene content background, Camera3 text/shadow chrome, and the UI
framework fixture. `ui-framework` generic controls already mostly consume
tokens.

## Step 0: Style And API Audit Baseline

Purpose: make the deletion targets explicit before writing new code.

Actions:

1. Add or update an architecture/style audit test that scans CSS for raw color,
   border, radius, font, and scrollbar values outside approved places.
2. The approved places at the start of Gate 7D should be narrow:
   - `packages/ui-framework/src/ui/theme/ui-theme-tokens.ts` default values;
   - product-specific Camera3 axis/rendering values, if still not themeable;
   - generated CSS, if applicable;
   - comments/test fixture values only when explicitly named.
3. The allowlist should be data in test support, not a loose grep note. It must
   include path, pattern, owner, and reason.
4. Add boundary assertions that:
   - `ui-framework/src/ui/theme/**` imports no app/editor/product modules;
   - `ui-framework/src/ui/menu/**` imports no window catalog/app theme code;
   - `apps/wallpaper-tesseract/src/features/app-menu/**` does not create menu
     rows by direct DOM append outside `UiElementComponent`/menu components.

Exit:

- Style audit exists and initially records the real hard-coded style debt.
- No implementation has been changed yet except tests/audit facts.

## Step 1: Root Theme Owner And App Theme Controller

Purpose: create one app-level owner for selected theme and CSS variable
application.

Implementation shape:

1. In app composition, create an app theme actor after `ComponentRegistry` and
   `installUiComponentDefinitions(...)` exist:
   - actor id: `app-theme-root`;
   - `UiElementComponent` borrowed from `appShell.root`;
   - `UiThemeComponent` with the initial selected theme.
2. Add an app-local theme controller, for example under
   `apps/wallpaper-tesseract/src/features/theme/`:
   - owns the theme list and selected theme id;
   - wraps the root `UiThemeComponent.setTheme(...)`;
   - exposes `listThemes()`, `getSelectedThemeId()`, `setTheme(themeId)`;
   - keeps selection in memory by default.
3. Built-in themes must be created through `createUiThemeModule(...)`.
   Defaults are not copied into app code. Provide at least:
   - `default-dark`, using defaults only;
   - one visibly different theme with a small partial token override set, so
     smoke can prove switching.
4. Loading/validation policy:
   - app normal load uses `parseUiThemeModule(..., { unknownTokenPolicy:
     "warn" })`;
   - the theme controller stores parse diagnostics beside the theme id/module
     so warnings stay inspectable by tests and future UI;
   - only the parsed/normalised module is passed to `UiThemeComponent`; do not
     rely on `UiThemeComponent.setTheme(...)` to collect warning diagnostics;
   - cleanup/export helpers can use `createUiThemeModule(...)` / strip behavior;
   - invalid known-token values fall back to defaults via `ui-framework`.
5. Persistence is not required for Gate 7D. If it is added, define a narrow
   app-local `ThemeSelectionStorage` port with `loadSelectedThemeId()` and
   `saveSelectedThemeId(id)`. Unknown stored ids fall back to `default-dark`;
   do not add a compatibility migration layer or let `ui-framework` know the
   storage key/path.

Tests:

- Theme controller applies selected theme to the root `UiThemeComponent`.
- Missing/unknown persisted id falls back to default.
- Invalid/obsolete token diagnostics are surfaced in app-owned diagnostics or
  test-visible return values, not swallowed silently.
- Theme diagnostics are produced by controller parse, not by hidden
  `UiThemeComponent` side effects.
- If a storage port is added, tests use a fake app-local port and verify no
  direct `localStorage` access in app composition.
- App code never imports or duplicates `uiThemeTokenDefinitions` default values
  for manual fallback.

Exit:

- App root has `data-ui-theme="<theme-id>"` and root CSS variables from the
  selected theme.
- Theme controller is app-local and is the only owner of available themes,
  parse diagnostics, and selected theme.
- `ui-framework` still does not know any theme file path or app storage key.

## Step 2: Generic Menu Submenu Support

Purpose: implement nested menu behavior once, in generic menu components,
before adding `Edit -> Theme`.

Design:

- Extend generic menu semantics with a product-agnostic submenu role.
- Prefer actor tree ownership over descriptor-owned child arrays:
  - parent menu item actor has `MenuItemComponent` with role `"submenu"` or
    equivalent generic flag;
  - submenu popup actor is a child of that menu item actor;
  - submenu item actors are children of the submenu popup actor.
- `MenuItemDescriptor` may carry `role: "submenu"` and generic accessibility
  state, but it should not become a second source for submenu children. The
  actor tree remains the live submenu structure.

Required generic behavior:

1. `MenuItemComponent`:
   - supports submenu role/accessibility (`aria-haspopup`, `aria-expanded`,
     optional submenu indicator);
   - remains descriptor-only and product-agnostic.
2. `PopupMenuComponent`:
   - can discover submenu popup children of a menu item actor;
   - appends/positions submenu popup using generic menu DOM structure;
   - for Gate 7D, submenu popup DOM is anchored under the submenu item element
     owned by the parent popup. This keeps the child popup inside the visible
     menu chain without introducing a global overlay root or app-local portal.
     If later evidence proves an overlay root is necessary, it must replace
     this owner cleanly rather than coexist with it.
   - opens a submenu on hover or click of a submenu item;
   - closes stale submenu state when highlighted/open submenu item disappears;
   - activating a submenu item opens the submenu, not the command sink;
   - activating a leaf command still goes through actor-input and closes the
     menu chain once.
3. Close behavior:
   - outside pointer down closes the entire menu chain only when the event
     target is outside every element in that chain: menubar item, parent popup,
     open submenu item, and all open submenu popups. A click inside
     `Edit -> Theme -> item` must not be misclassified by the parent popup as
     outside before actor-input activation runs;
   - Escape closes the open chain;
   - pointer leaving behavior must be deterministic. If full hover-delay or
     left/right keyboard navigation is not implemented in this gate, record it
     as a follow-up, but do not fake it in app-local code.
4. `MenuBarComponent`:
   - continues to own top-level open item state;
   - passes a single close-chain request down into popup/submenu components.
5. Menu chain ownership:
   - use a small package-private generic menu-chain helper or equivalent
     component-internal state, owned by `MenuBarComponent` / open
     `PopupMenuComponent` instances;
   - it may track open popup elements and actor ids for containment and stale
     cleanup;
   - it must not become a public registry, app service, or product-specific
     theme/menu adapter.
6. Stacking:
   - submenu popups use the same generic menu z layer as other popup menus;
   - no app-specific z-index or Scene/window knowledge is allowed in generic
     menu code;
   - smoke must prove the submenu leaf is topmost/clickable through
     `elementsFromPoint` or equivalent evidence.

Tests:

- Submenu actor chain renders through generic menu components.
- Hover/click on submenu item opens exactly one child popup and closes stale
  sibling submenu popups.
- Parent outside-click handling treats child submenu popup targets as inside the
  same chain.
- Leaf command activation fires exactly one command sink call.
- Removing the currently open submenu item clears open/highlight state.
- Generic menu production files still have no DOM `click` activation shortcut.
- Generic menu production files still import no app/window/theme-controller
  modules.

Exit:

- `ui-framework` can render nested menu actor trees.
- The close-chain and popup placement model is generic and package-private.
- No app-local submenu DOM or theme-menu special case exists.

## Step 3: Rework App Menu Into Window + Edit/Theme Menus

Purpose: expose manual theme switching through the real Arbor menu tree.

Implementation shape:

1. Extend `installAppMenuFeature(...)` options with a narrow theme command port,
   for example:
   - `themeController.listThemes()`;
   - `themeController.getSelectedThemeId()`;
   - `themeController.setTheme(themeId)`.
2. Keep App Menu actor ownership explicit:
   - top-level `Window` menu bar item actor with its popup;
   - top-level `Edit` menu bar item actor with its popup;
   - `Theme` submenu item actor under `Edit`;
   - `Theme` submenu popup actor under the `Theme` item;
   - one theme item actor per available theme under the theme popup.
3. Split app-local descriptor construction by domain:
   - `window-menu-items.ts` remains window-catalog specific;
   - add `theme-menu-items.ts` for theme descriptors/payloads;
   - do not put theme payloads into generic `ui-framework` menu model.
4. Update `AppMenuAdapterComponent` or split small app-local reconcilers if that
   reduces complexity. Do not replace it with a broad product facade. The
   adapter/reconciler may create and delete menu item actors, but all visual
   rows remain generic menu components.
5. Theme items should reflect selected theme:
   - use checkbox/checkmark state or selected styling through generic menu item
     descriptor;
   - after `setTheme(...)`, refresh the theme menu descriptors so the selected
     item is deterministic.
6. Existing `Window` menu behavior must remain unchanged.

Tests:

- App Menu installs both `Window` and `Edit` menu bar item actors.
- `Edit -> Theme` is a generic submenu actor chain, not app-local DOM.
- Selecting a theme calls the app theme controller exactly once and updates the
  selected/check state.
- Window menu catalog updates still add/remove stale window menu actors.
- Removing a theme from the theme list removes stale theme menu actors and
  closes stale open submenu state.

Exit:

- Manual menu path exists:

```text
Window
Edit
  Theme
    Default Dark
    <Other available themes>
```

- No `ThemeMenu` DOM component, no local row rendering, no DOM `click`
  activation shortcut.

## Step 4: Tokenise App, Window, And Editor Chrome

Purpose: make theme switching visibly affect the real editor surface, not just
generic menu/list CSS.

CSS adoption order:

1. App shell:
   - `apps/wallpaper-tesseract/src/style.css`
   - `apps/wallpaper-tesseract/src/app/app-shell.css`
2. Window chrome:
   - `apps/wallpaper-tesseract/src/window-runtime/floating-window.css`
   - `apps/wallpaper-tesseract/src/window-runtime/window-frame-tab-chrome.css`
   - `apps/wallpaper-tesseract/src/window-runtime/workspace-root-dock-frame.css`
3. Editor panels:
   - `packages/editor/src/inspector/inspector.css`
   - `packages/editor/src/scene/scene-window.css`
   - `packages/editor/src/camera3/camera3-gizmo.css`, only for generic text,
     shadow, and chrome tokens that do not imply axis-color ownership.
4. Fixture:
   - `apps/wallpaper-tesseract/src/ui-framework-fixture/ui-framework-fixture.css`
     should either consume tokens or be explicitly named in the style audit as
     a fixture-only exception.

Token strategy:

- Reuse existing tokens first:
  - app/panel/content background: `--ui-color-app-bg`,
    `--ui-color-panel-bg`, `--ui-color-content-bg`;
  - text: `--ui-color-text`, `--ui-color-text-muted`,
    `--ui-color-text-disabled`, `--ui-color-text-selected`;
  - window: `--ui-window-*`;
  - border/radius/shadow/scrollbar: existing token groups.
- Add new tokens only when a repeated semantic surface cannot be represented by
  existing tokens. Candidate additions must be semantic, not selector-specific:
  - dock preview background/border/active background;
  - tab close hover background;
  - window titlebar border;
  - overlay/chrome shadow if `--ui-shadow-elevated` is not appropriate.
- Every new token must be added to `ui-theme-tokens.ts`; generated CSS/tests
  must prove defaults remain single-sourced.

Deletion rules:

- Delete old hard-coded color/font/radius values from generic app/window/editor
  chrome in the same pass.
- Do not keep raw values as CSS fallbacks next to `var(...)`; defaults already
  come from `theme.css` / `UiThemeComponent`.
- If a value remains raw, it must be in the style audit allowlist with an owner
  and reason. The allowlist should shrink during this gate.

Tests:

- Style audit fails for newly introduced raw generic colors/borders/fonts.
- CSS token references all exist in `ui-theme-tokens.ts`.
- Theme switching changes computed styles for:
  - app shell background;
  - root/floating window border or titlebar;
  - active tab background;
  - menu background/highlight;
  - Hierarchy selected row;
  - Debug/virtual-list row or scrollbar.

Exit:

- The real app surface visibly changes when theme is switched.
- Inspector no longer owns a local hard-coded generic panel theme.
- Camera3 axis/rendering color ownership is either unchanged by design and
  recorded, or implemented as a separate editor-owned theme extension. Do not
  smuggle it into `ui-framework` core tokens.

## Step 5: Inspector And Remaining Panel Audit

Purpose: avoid leaving one visible editor panel outside the Arbor theme model.

Current Inspector is simple static content. For Gate 7D:

- Require same-actor `UiElementComponent` if Inspector still creates its own
  content element and if doing so keeps the change small.
- Migrate Inspector visible styling to theme tokens.
- If a real property grid is needed, record it as a later gate; do not build an
  ad hoc form/control system inside Inspector during Gate 7D.

Tests:

- Inspector still registers window content.
- Inspector computed background/text style changes with theme.
- No local Inspector scrollbar/theme hard-coding remains unless explicitly
  allowlisted.

## Step 6: Smoke Runner And Evidence Contract

Purpose: make Gate 7D manually and automatically verifiable.

Add a stable runner, preferably:

```text
apps/wallpaper-tesseract/scripts/run-project-arbor-gate-7-theme-smoke.mjs
```

Output:

```text
temp/project-arbor-gate-7-theme-smoke-data.json
temp/project-arbor-gate-7-theme-smoke-report.md
```

Add a validator test, for example:

```text
apps/wallpaper-tesseract/src/test-support/project-arbor-gate-7-theme-smoke-contract.test.ts
```

Smoke coverage:

1. Boot baseline with console errors = 0.
2. Open `Edit -> Theme` submenu and select the non-default built-in theme.
3. Verify root `data-ui-theme` and selected theme id changed.
4. Compare computed styles before/after for:
   - app shell background;
   - Window menu or popup background/highlight;
   - active tab background;
   - window border/titlebar;
   - Hierarchy selected row;
   - Debug virtual-list row or scrollbar;
   - Inspector panel background/text.
5. Verify existing interaction paths still work:
   - Window menu opens/focuses a view;
   - tab close;
   - tab drag/dock preview sanity;
   - Scene fullscreen/restore;
   - Camera3 gizmo input still receives actor-input;
   - Debug bottom/non-bottom scroll remains stable.
6. Verify submenu behavior:
   - `Edit -> Theme` child popup is visible and topmost enough to click;
   - selecting a leaf theme item fires one theme change;
   - outside click/Escape closes the menu chain.
7. Always include browser mobile viewport sanity after theme switching:
   - use a mobile viewport such as `390x844`;
   - verify Window/Edit menu access, Theme submenu clickability, Scene/Debug/
     Hierarchy visibility, and no horizontal overflow introduced by theme
     chrome CSS.

Validator requirements:

- The evidence file must include actual computed style values before/after,
  not only `"clicked": true`.
- It must fail if theme id changes but sampled styles do not change.
- It must fail if old hard-coded app/window/editor colors still dominate the
  sampled elements.

## Step 7: Boundary And Cleanup Gates

Required grep/boundary checks:

```powershell
rg -n "addEventListener\\?\\(\\\"click\\\"|onclick|\\.onclick" packages/ui-framework/src/ui/menu -g "*.ts" -g "!*.test.ts"
rg -n "ThemeMenu|theme-menu__|app-menu-bar__|#rows|activeRowIndex" apps/wallpaper-tesseract/src packages/editor/src packages/ui-framework/src -g "*.ts" -g "*.css" -g "!*.test.ts"
rg -n "Scene|Camera3|Tesseract|Debug|Hierarchy|Inspector|WindowWorkspace|wallpaper" packages/ui-framework/src/ui/theme packages/ui-framework/src/ui/menu -g "*.ts" -g "!*.test.ts"
rg -n "--ui-axis-|axis-x|axis-y|axis-z" packages/ui-framework/src -g "*.ts" -g "*.css"
```

Expected:

- DOM click activation grep has no production hits in generic menu.
- Old App Menu row/highlight selectors do not return.
- `ui-framework` menu/theme stays product-agnostic.
- No Camera3 axis tokens in `ui-framework`.

Update:

- `apps/wallpaper-tesseract/src/architecture-boundaries.test.ts`
- `docs/current-project-progress.md`
- `docs/known-defects-and-todos.md` only if Camera3 axis styling or large
  Hierarchy smoke remains as a follow-up.

## Validation Matrix

Targeted checks while iterating:

```powershell
npm run test -w ui-framework -- theme menu
npm run typecheck:test -w ui-framework
npm run build -w ui-framework
npm run test -w editor -- inspector hierarchy debug
npm run typecheck -w editor
npm run build -w editor
npm run test -w wallpaper-tesseract -- architecture-boundaries project-arbor-gate-7-theme-smoke-contract
npm run typecheck -w wallpaper-tesseract
npm run build -w wallpaper-tesseract
```

Before final handoff:

```powershell
npm run prism:smoke:prepare
npm run dev -w wallpaper-tesseract
node apps/wallpaper-tesseract/scripts/run-project-arbor-gate-7-theme-smoke.mjs
$env:PROJECT_ARBOR_GATE_7_THEME_SMOKE_EVIDENCE="temp/project-arbor-gate-7-theme-smoke-data.json"; npm run test -w wallpaper-tesseract -- project-arbor-gate-7-theme-smoke-contract
npm run test
npm run typecheck
npm run build
```

## Exit Criteria

Gate 7D is complete when:

- One root `UiThemeComponent` owns app theme application.
- App/editor code owns theme discovery and in-memory selection; any persistence
  uses only the app-local `ThemeSelectionStorage` port. `ui-framework` owns only
  generic parse/create/validate/apply primitives.
- `Edit -> Theme -> <theme>` works through generic menu/submenu actors.
- Generic menu submenu support is tested and product-agnostic.
- App/window/editor visible chrome uses semantic tokens or is explicitly
  allowlisted with reason.
- Manual theme switching changes visible app, window, menu, Hierarchy, Debug,
  and Inspector styles.
- Existing Arbor/Prism smoke paths still pass.
- No old local menu row/highlight/DOM activation shortcuts are retained.

## Completion Evidence

Completed on 2026-06-29.

Implementation notes:

- App theme application is owned by an app-root `UiThemeComponent` and
  app-local in-memory theme controller.
- `Edit -> Theme -> <theme>` is a real App Menu actor subtree using generic
  menu/submenu components. Theme parsing diagnostics stay in the app-local
  controller; `ui-framework` does not own theme discovery or paths.
- Generic submenu placement flips away from viewport edges, and generic layout
  overlay wrappers no longer intercept empty overlay space.
- App shell, window chrome, Inspector, Scene surface, Camera3 chrome text, and
  Arbor controls consume semantic theme tokens.
- Review closure removed direct `gizmo-core` imports from `ui-framework` source,
  declared the missing `runtime-three -> four-camera` workspace dependency,
  tokenised dock preview/window splitter raw styles, and locked remaining
  Camera3 product-renderer shadows behind a raw-style allowlist with owner and
  reason.

Fresh browser evidence:

```text
temp/project-arbor-gate-7-theme-smoke-data.json
temp/project-arbor-gate-7-theme-smoke-report.md
```

Validator:

```powershell
$env:PROJECT_ARBOR_GATE_7_THEME_SMOKE_EVIDENCE="temp/project-arbor-gate-7-theme-smoke-data.json"; npm run test -w wallpaper-tesseract -- project-arbor-gate-7-theme-smoke-contract
```

The refreshed evidence proves visible token-driven style changes across app
shell, App Menu, active tabs, Hierarchy rows, Debug virtual-list rows,
Inspector, and scrollbar styling.
