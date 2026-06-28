# Project Arbor Gates 7A-7D: Unified Controls And Theme System

Status: Gate 7A complete; Gates 7B-7D pending
Created: 2026-06-29
Amended: 2026-06-29 after review
Scope: primarily `packages/ui-framework`; `packages/editor` adopts the new UI
controls and theme APIs, deletes old panel-local DOM/CSS paths, and adds the
manual theme switcher entry point.

## Summary

The original Gate 7 scope is real but too large for one reliable execution
slice. It is split into four gates, each with its own deletion target and
acceptance evidence:

- **Gate 7A: Theme Token Foundation And Theme Module Contract**
  - Add semantic tokens, default values, theme parsing/validation, theme module
    creation helpers, and package CSS distribution.
  - Status: complete.
- **Gate 7B: ScrollView + TreeView + Hierarchy Migration**
  - Add generic native-scroll and tree controls, migrate Hierarchy, delete old
    Hierarchy row/scroll DOM and CSS.
- **Gate 7C: ListView/TableView + Debug Log Migration**
  - Add generic list/table collection controls as needed, migrate Debug Log,
    delete the old `<pre>` presentation.
- **Gate 7D: Editor Theme Adoption, Window Chrome Tokens, And Theme Menu**
  - Apply tokens to app/window/editor chrome, audit Inspector, add Edit -> Theme
    submenu and theme switching.

Do not start a later gate by leaving the previous gate's old implementation
alive. Each gate must close with the relevant old path deleted or explicitly
converted into a follow-up defect/plan item.

## Current Facts

- `ui-framework` owns the Arbor base controls:
  `UiElementComponent`, `UiLayoutItemComponent`, `UiLayoutHostComponent`,
  generic menu controls, `RenderViewportComponent`,
  `FullscreenableViewComponent`, and generic control CSS.
- App Menu and Scene have already migrated to Arbor actor composition. Do not
  reopen those migrations except to consume the new theme tokens.
- There is no generic `ScrollViewComponent`, `TreeViewComponent`,
  `ListViewComponent`, or `TableViewComponent`.
- `HierarchyPanelComponent` still directly owns row DOM: `#rows`,
  `replaceChildren()`, button creation, local selection/hover CSS, and root
  native `overflow: auto`.
- `DebugLogContentComponent` still owns a single `<pre>` and rewrites
  `textContent` from joined log lines.
- Inspector and remaining editor panels still use local CSS with hard-coded
  colors and may need a ScrollView adoption pass after Hierarchy/Debug.
- Window/app/editor CSS contains many hard-coded colors, borders, fonts,
  shadows, and radii. Existing CSS variables are mostly presentation stack
  layers, not a full theme system.

## External UI System Lessons

Use the durable parts of mature UI style systems without importing their
complexity:

- MDN CSS custom properties: custom properties cascade and inherit, so they are
  a good runtime transport for app-wide and scoped themes.
- VS Code Theme Color Reference: expose semantic color ids such as panel
  background or list hover, not component-private raw color names.
- Qt Style Sheets: widget behavior and styling are separate; styling addresses
  states and subcontrols without replacing widget logic.
- Unity UI Toolkit/USS: custom properties make large UI style sets manageable
  while controls continue to own behavior.

Arbor should therefore expose semantic theme tokens and component state
attributes. Product code must not branch on private control DOM structure.

References:

- `https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Cascading_variables/Using_custom_properties`
- `https://code.visualstudio.com/api/references/theme-color`
- `https://doc.qt.io/qt-6/stylesheet-reference.html`
- `https://docs.unity3d.com/Manual/UIE-USS.html`

## Non-Negotiables

- `ui-framework` controls must not import `editor`, `wallpaper-runtime`,
  app-local features, Scene, Camera3, Tesseract, Debug, Hierarchy, or Inspector
  product data.
- `ui-framework` may provide generic scroll/tree/list/table mechanics; product
  data, object ids, log formatting, editor commands, and theme file paths stay
  outside `ui-framework`.
- Do not add a second UI tree or a global UI registry. Actor tree plus component
  registry remains the owner/lifecycle truth.
- Native browser scrolling is the Gate 7 scroll implementation. Do not build a
  custom scrollbar thumb/drag engine in this gate.
- Tree/List item identity must have one source. Do not let both actor parentage
  and a tree descriptor independently encode hierarchy.
- Generic collection controls read actor children plus item components. They do
  not create, destroy, or diff product item actors from raw arrays; product
  owners such as Hierarchy and Debug own stable item actor creation/deletion.
- Tree/List item actors represent externally composable logical items, not
  internal rendered rows/cells/indent markers. Internal DOM rows, virtualized
  rows, expand affordances, indent wrappers, cells, and scroll filler elements
  are private control implementation details and must not enter the actor tree.
- Pointer-driven item activation must go through actor-input or a narrow control
  intent port. No DOM click activation shortcuts.
- Theme customization flows through semantic tokens and CSS custom properties.
  Do not add imperative per-control color/border/font mutation APIs.
- When Hierarchy/Debug migrate, delete old local row/list rendering and old CSS
  selectors in the same gate.
- `ui-framework` must not hard-code theme file paths. It provides parsing,
  validation, defaults, creation, and application interfaces. Editor/app code
  may choose concrete paths or persistence locations.

## Theme Contract Requirements

Gate 7A must implement these requirements before Editor theme switching begins:

1. Every themeable appearance property has a default value.
   - If a theme module omits a valid token, the default value is used.
   - `ui-theme-tokens.ts` is the only default-value fact source.
   - `ui-theme.css` should be generated from `ui-theme-tokens.ts`. If that is
     unexpectedly impractical, stop and amend this plan before hand-writing CSS
     defaults. Tests must still prove CSS defaults exactly match token
     definitions.
   - Defaults never live in app/editor code.
2. `ui-framework` provides a function to create a complete theme module from a
   partial input.
   - The output includes every currently valid token.
   - Missing values are filled from defaults.
   - The output is suitable for saving as a new theme file/module by Editor.
3. `ui-framework` does not own theme file loading paths.
   - It exposes pure APIs such as `parseUiThemeModule`,
     `createUiThemeModule`, `validateUiThemeModule`, and
     `applyUiThemeTokens`.
   - Editor/app code owns concrete path/module discovery and persistence.
4. Invalid/obsolete token handling is explicit and configurable.
   - `ignore`: unknown properties are ignored.
   - `warn`: unknown properties are ignored and reported in diagnostics.
   - `strip`: unknown properties are cleared from the returned normalized
     module, suitable for cleanup/save.
   - Invalid values for known tokens produce diagnostics and fall back to the
     default token value unless a strict validation mode is explicitly selected.
5. Editor exposes manual theme switching.
   - Add `Edit` to the menu bar.
   - Add `Edit -> Theme`.
   - `Theme` opens a submenu of available themes.
   - Selecting a theme applies it to the root theme owner.
   - If generic submenu support does not exist yet, implement nested/submenu
     menu support before adding the Editor theme menu entry.

## Gate 7A: Theme Token Foundation And Theme Module Contract

Status: complete.

### Goal

Create the reusable theme system inside `ui-framework`, update existing generic
controls to consume tokens, and prove default/fallback/theme-module behavior.
No Editor panel migration happens in this gate.

### Required `ui-framework` Files

```text
packages/ui-framework/src/ui/theme/
  ui-theme-tokens.ts
  ui-theme-schema.ts
  ui-theme-module.ts
  ui-theme-component.ts
  ui-theme-definition.ts
  ui-theme.css
  ui-theme-component.test.ts
  ui-theme-module.test.ts
```

### Required Token Groups

- font:
  - `--ui-font-family`
  - `--ui-font-family-mono`
  - `--ui-font-size`
  - `--ui-line-height`
- surface:
  - `--ui-color-app-bg`
  - `--ui-color-panel-bg`
  - `--ui-color-surface`
  - `--ui-color-surface-elevated`
  - `--ui-color-content-bg`
- text:
  - `--ui-color-text`
  - `--ui-color-text-muted`
  - `--ui-color-text-disabled`
  - `--ui-color-text-selected`
- accent/state:
  - `--ui-color-accent`
  - `--ui-color-accent-muted`
  - `--ui-color-hover-bg`
  - `--ui-color-selected-bg`
  - `--ui-color-focus-ring`
- border:
  - `--ui-border-color`
  - `--ui-border-color-strong`
  - `--ui-border-width`
  - `--ui-radius-control`
  - `--ui-radius-panel`
- scrollbar:
  - `--ui-scrollbar-size`
  - `--ui-scrollbar-track`
  - `--ui-scrollbar-thumb`
  - `--ui-scrollbar-thumb-hover`
- window:
  - `--ui-window-bg`
  - `--ui-window-border`
  - `--ui-window-titlebar-bg`
  - `--ui-window-tab-bg`
  - `--ui-window-tab-active-bg`
  - `--ui-window-splitter-bg`
- shadow:
  - `--ui-shadow-elevated`

Do not add Camera3 axis tokens to the `ui-framework` core token set in Gate 7A.
Axis colors are editor/product semantics. If Gate 7D needs themeable Camera3
axes, design an editor-owned theme extension or record a follow-up instead of
promoting axis tokens into generic UI.

### Theme Module And Token Schema

`ui-theme-tokens.ts` owns token definitions. Each definition should include:

- token css variable name;
- semantic group;
- value kind, such as `color`, `length`, `fontFamily`, `fontSize`, `lineHeight`,
  `borderWidth`, `radius`, or `shadow`;
- default value;
- short description.

`UiThemeModule` should be a serializable data shape, not executable code:

```ts
type UiThemeModule = {
  id: string;
  label?: string;
  tokens?: Record<string, string>;
};
```

`parseUiThemeModule` accepts unknown or partial input, validates known token
values by value kind, and returns a normalized result plus diagnostics.
`createUiThemeModule(partial)` returns a complete module containing every valid
token and default-filled values.

### Implementation Rules

- `ui-theme-tokens.ts` defines defaults in one place.
- `ui-theme.css` should be generated from `ui-theme-tokens.ts`. If generation
  is unexpectedly impractical, stop and amend the plan; do not hand-maintain
  independent CSS defaults. A dedicated test must still compare every CSS
  custom property default against `ui-theme-tokens.ts`.
- `ui-framework-controls.css` uses `var(--ui-*)` tokens for generic control
  chrome. It may not keep raw hard-coded generic colors after this gate.
- `UiThemeComponent` requires same-actor `UiElementComponent`.
- `UiThemeComponent` applies `data-ui-theme` and CSS variables to the actor root.
- `UiThemeComponent` restores/removes only values it applied.
- `parseUiThemeModule` accepts unknown-token policy:
  - `ignore`;
  - `warn`;
  - `strip`/clear;
  - `strict`.
- `createUiThemeModule(partial)` returns a complete normalized module with
  defaults filled in.
- `ui-framework` package CSS build/export contract from Gate 6 must remain
  intact and must add `./ui/theme.css` (or the final theme CSS path) to
  `package.json` `exports`, `files`, `sideEffects`, and `scripts/copy-css.mjs`.
  App/editor code must import the exported CSS path, not source files.

### Entry Gate

- Re-run current Arbor final validator if evidence is available:

```powershell
$env:PROJECT_ARBOR_FINAL_SMOKE_EVIDENCE="temp/project-arbor-final-smoke-data.json"; npm run test -w wallpaper-tesseract -- project-arbor-final-smoke-contract
```

- Confirm dirty work unrelated to Gate 7 is committed or explicitly documented.
  Current known unrelated dirty work includes Camera3 gizmo drag-session fixes;
  do not start Gate 7A until those changes are committed or written into the
  step report as an intentional concurrent baseline.

### Exit Gate

- Tests prove omitted tokens use defaults.
- Tests prove `ui-theme-tokens.ts` is the only default source by either
  verifying generated CSS or comparing all CSS defaults to token definitions.
- Tests prove token value kind validation rejects invalid known-token values and
  falls back to defaults outside strict mode.
- Tests prove unknown tokens follow `ignore`, `warn`, `strip`, and `strict`
  behavior.
- Tests prove invalid known-token values fall back to defaults with diagnostics.
- Tests prove `createUiThemeModule` emits all valid tokens.
- Generic controls consume theme variables.
- No generic control CSS has raw product color constants outside `ui-theme.css`.
- `packages/ui-framework/package.json` exports theme CSS, the build copies it to
  `dist`, and package boundary tests prevent app/editor imports from reaching
  `packages/ui-framework/src/ui/theme/*.css` directly.
- Validation:

```powershell
npm run test -w ui-framework -- theme menu fullscreenable-view render-viewport
npm run typecheck:test -w ui-framework
npm run build -w ui-framework
```

### Gate 7A Execution Evidence

- Entry validator passed:

```powershell
$env:PROJECT_ARBOR_FINAL_SMOKE_EVIDENCE="temp/project-arbor-final-smoke-data.json"; npm run test -w wallpaper-tesseract -- project-arbor-final-smoke-contract
```

- Targeted validation passed:

```powershell
npm run test -w ui-framework -- theme menu fullscreenable-view render-viewport
npm run typecheck:test -w ui-framework
npm run build -w ui-framework
npm run test -w wallpaper-tesseract -- architecture-boundaries
npm run typecheck -w wallpaper-tesseract
npm run build -w wallpaper-tesseract
```

- `packages/ui-framework/src/ui/ui-framework-controls.css` has no raw color
  constants.
- App and fixture styles import theme CSS through `ui-framework/ui/theme.css`,
  not a source path.
- Known unrelated dirty work at execution start: Camera3 gizmo drag-session
  fixes in editor/runtime packages. Gate 7A did not modify or revert them.

## Gate 7B: ScrollView, TreeView, And Hierarchy Migration

Status: implementation complete; default browser smoke complete; large-node
browser fixture follow-up tracked as `ARB-001`.

### Goal

Add generic native-scroll and tree controls, migrate Hierarchy, and delete the
old Hierarchy row/scroll implementation.

### Tree Fact Source Decision

Use a flat item actor list for TreeView. Tree hierarchy is expressed only by
`TreeViewItemComponent` descriptor fields:

- `itemId`;
- `parentItemId?: string`;
- `order?: number`.

`TreeViewComponent` must not infer tree hierarchy from actor parentage. Actor
parentage remains ownership/lifecycle; tree descriptors own tree presentation.
This avoids actor-tree/product-tree double truth.

`TreeViewItemComponent` is descriptor-only in Gate 7B. It does not require
`UiElementComponent`; item row DOM is private to `TreeViewComponent`.

Do not add `level` in the first TreeView implementation. TreeView computes
display depth from `parentItemId`. If a future performance or virtualization
need requires precomputed level hints, add them in a separate plan with mismatch
tests.

The first TreeView implementation does not own expand/collapse state. It
renders every item supplied by the product owner. Expand/collapse affordances
and state can be added in a later gate only if there is a real product command
that owns that state.

### Required Controls

```text
packages/ui-framework/src/ui/scroll/
  scroll-view-component.ts
  scroll-view-definition.ts
  scroll-view-component.test.ts

packages/ui-framework/src/ui/collection/
  collection-types.ts
  tree-view-component.ts
  tree-view-definition.ts
  tree-view-item-component.ts
  tree-view-item-definition.ts
  tree-view-component.test.ts
```

`installUiComponentDefinitions()` must install the new scroll/tree definitions.
`ui-framework/src/ui/index.ts` must export them from narrow `scroll` and
`collection` folders. Do not place these controls in a catch-all `controls.ts`.

### ScrollView Rules

- Native scrolling only.
- `ScrollViewComponent` requires same-actor `UiElementComponent`.
- The component owns native overflow behavior, themeable scrollbar appearance,
  scroll position reads, and diagnostics on that same element.
- It does not implement custom scrollbar thumb dragging.
- It does not move siblings; layout remains `UiLayoutHost`.
- It does not create a nested viewport element unless a real browser behavior
  requires it. Prefer the same actor element as the scroll container.
- Dispose restores only generic state/styles that `ScrollViewComponent` applied.
- Diagnostics:
  - `data-ui-scroll-view`;
  - `data-ui-scroll-orientation`;
  - `data-ui-scroll-at-start`;
  - `data-ui-scroll-at-end`.

Suggested options:

```ts
type ScrollViewOrientation = "vertical" | "horizontal" | "both";

interface ScrollViewComponentOptions {
  readonly id?: string;
  readonly orientation?: ScrollViewOrientation;
  readonly className?: string;
}
```

Do not add product-specific scroll commands or custom thumb state in Gate 7B.

### TreeView Rules

- `TreeViewComponent` requires same-actor `UiElementComponent` and actor-input
  binding, following the generic menu component pattern.
- `TreeViewComponent` reads direct child actors of its own actor and their
  `TreeViewItemComponent` descriptors.
- Pointer activation goes through `ActorInputParticipant` on `TreeViewComponent`.
  Do not add DOM `click` activation.
- Keyboard activation may use DOM `keydown` on private rows, but it must emit
  the same generic activation sink as pointer activation. It must not mutate
  editor state directly.
- TreeView owns private row DOM, hover/highlight, selected visual state, depth
  calculation, aria tree roles, and row diagnostics.
- TreeView does not own product selection. Selection is supplied by item
  descriptors.
- TreeView exposes a generic `TreeViewActivationSink`:

```ts
interface TreeViewActivation {
  readonly itemActorId: string;
  readonly itemId: string;
  readonly inputKind: "pointer" | "keyboard";
}
```

Suggested item descriptor fields:

```ts
interface TreeViewItemDescriptor {
  readonly itemId: string;
  readonly label: string;
  readonly parentItemId?: string | null;
  readonly order?: number;
  readonly selected?: boolean;
  readonly enabled?: boolean;
  readonly muted?: boolean;
}
```

`muted` is generic visual state. Hierarchy maps inactive actors to `muted`; the
generic UI framework must not know `activeSelf` or `activeInHierarchy`.

Stable row diagnostics:

- row: `data-ui-tree-row`;
- row item id: `data-ui-tree-item-id`;
- row actor id: `data-ui-tree-item-actor-id`;
- depth: `data-ui-tree-depth`;
- selected: `data-ui-tree-selected`;
- muted: `data-ui-tree-muted`.

### Collection Ownership Rules

- `ScrollViewComponent`, `TreeViewComponent`, and `TreeViewItemComponent` read
  existing child actors and their components.
- They may sort, layout, highlight, render selected visual state, and route
  activation intent.
- They must not accept raw product arrays and create actors internally.
- They must not create actor children for internal rendered rows, virtualized
  rows, indent guides, expand arrows, cells, or scroll filler. Those are private
  DOM/rendering details owned by the control.
- If large data requires virtualization, virtualize DOM rows inside the control;
  do not implement virtualization by creating/destroying actor children.
- They must not own Hierarchy object ids, Scene object ids, or editor selection
  state.
- Hierarchy owns stable item actor creation/deletion and descriptor updates.

`TreeViewComponent` may create/destroy internal DOM rows keyed by item actor id.
Those internal rows must not be registered as actors or components.

### Hierarchy Source Pollution Guard

Hierarchy Tree item actors are presentation actors. They must never appear as
domain objects returned by `HierarchyObjectSource`.

`ActorHierarchyObjectSource` already supports an `includeActor` predicate. Gate
7B must use that existing owner-side filter instead of adding a second source or
post-processing rendered rows:

- Prefer excluding the entire Hierarchy view actor presentation subtree from the
  source in the tool-window owner that creates `ActorHierarchyObjectSource`.
- At minimum, exclude the stable item actor namespace used by the Hierarchy
  reconciler, such as `${hierarchyActor.id}:item:`.
- Add tests proving Tree item actors are not returned by `listObjects()` and do
  not recursively generate additional Tree item actors on the next refresh.

Do not solve this by hiding item actors in `TreeViewComponent`, by filtering row
DOM, or by adding a second hierarchy source just for UI. The displayed
Hierarchy source must remain a single source with an explicit include rule.

### Execution Slices

1. Add `ScrollViewComponent`.
   - Same-actor `UiElementComponent` dependency.
   - Native overflow and scrollbar CSS using Gate 7A tokens.
   - Tests for orientation, diagnostics, disposal restoration, and no sibling
     movement.
2. Add `TreeViewItemComponent`.
   - Descriptor-only component, no `UiElementComponent` dependency.
   - Normalizes/clones descriptor; updates do not retain caller object
     references.
   - Tests for parent/ordering/selected/muted/enabled descriptors and invalid
     values.
3. Add `TreeViewComponent`.
   - Same-actor `UiElementComponent` and actor-input binding dependency.
   - Reads direct child item actors and descriptors.
   - Computes depth from `parentItemId`.
   - Emits activation through a generic sink.
   - Uses private row DOM and `data-ui-tree-*` diagnostics.
   - Tests for depth, ordering, actor churn avoidance, keyboard/pointer
     activation, stale child removal, and row DOM not registering actors.
4. Migrate Hierarchy.
   - `createHierarchyPanelViewActor()` creates the root `UiElementComponent`,
     `ScrollViewComponent`, `TreeViewComponent`, and the product
     `HierarchyPanelComponent` on the hierarchy view actor.
   - `HierarchyPanelComponent` no longer creates its own DOM root. It requires
     the same-actor `UiElementComponent` and registers that element as the
     window content root. There must not be a second Hierarchy DOM root.
   - `HierarchyPanelComponent` definition no longer requires
     `gizmoEventBindingComponentType`; TreeView owns actor-input participation.
     Keep `stateObserverBinding` or frame update attachment only if the
     product mapper/reconciler still needs them after row rendering is removed.
   - `createHierarchyPanelViewActor()` creates the generic
     `TreeViewActivationSink` at the same product wiring point as the TreeView
     component and passes it into `TreeViewComponent`. The sink maps generic
     activation to editor selection commands. TreeView must not import
     Hierarchy code, and Hierarchy must not query DOM rows to discover the
     activated item.
   - `HierarchyPanelComponent` remains the window content registration owner
     for the root element, but it stops rendering rows and stops implementing
     actor-input row hit testing.
   - Add a small editor-owned item actor reconciler, for example
     `hierarchy-tree-item-actor-reconciler.ts`, using the existing
     `ActorCreationContext` from the hierarchy actor factory. This reconciler
     owns stable child item actor create/update/destroy and adds
     `TreeViewItemComponent` to those item actors.
   - `HierarchyPanelComponent` reads `HierarchyObjectSource`, delegates item
     actor reconciliation, maps TreeView activation to editor selection
     commands, and updates `selected` descriptors from
     `editorStatePaths.selection.activeObject`.
   - The actor hierarchy source used by Hierarchy filters out Hierarchy
     presentation actors and item actors through its existing `includeActor`
     option before reconciliation runs.
   - Do not pass raw object arrays into `TreeViewComponent`.
5. Delete old Hierarchy DOM/CSS path.
   - Remove direct row `button` construction.
   - Remove `#rows`, `replaceChildren()` row rendering, row keydown selection
     handling, and row hit-test loops from `HierarchyPanelComponent`.
   - Delete `packages/editor/src/hierarchy/hierarchy.css` if no feature-specific
     styling remains, and remove the import from
     `apps/wallpaper-tesseract/src/app/styles.ts`.
   - If a root feature class remains for diagnostics, it must not carry generic
     scroll/tree row styling.

### Hierarchy Migration Rules

- `HierarchyPanelComponent` becomes a mapper:
  - reads `HierarchyObjectSource`;
  - diffs stable item actor ids by object id;
  - creates/updates/removes TreeView item actors/components;
  - maps generic tree activation to editor selection commands.
- It keeps window content registration ownership until a future generic content
  registration component exists. It registers the same-actor
  `UiElementComponent.element`; it must not create or register a second local
  row root.
- Stable item actor id format must be deterministic and derived from object id.
  Suggested format: `${hierarchyActor.id}:item:${sanitizeObjectId(item.id)}`.
- The diff strategy must update existing item actors rather than destroy/recreate
  the whole tree on each frame.
- The Hierarchy source must exclude the Hierarchy presentation subtree or the
  stable item actor namespace before returning objects. Tests must lock that
  Tree item actors do not appear in the visible Hierarchy.
- `TreeViewActivationSink` wiring is product-owned. It is created by the
  Hierarchy actor factory or a small Hierarchy mapper and passed to
  `TreeViewComponent`; neither TreeView nor DOM row code may know editor
  selection paths.
- Delete:
  - `#rows`;
  - `replaceChildren()` row rendering;
  - direct `createElement("button")` row creation;
  - local Hierarchy generic row hover/selected/disabled CSS;
  - local native scrollbar styling.

### Boundary Updates

- `ui-framework/src/ui/scroll/**` and `ui-framework/src/ui/collection/**` must
  not import editor, wallpaper runtime, app-local features, window workspace,
  Scene, Camera3, Debug, Hierarchy, or Inspector product modules.
- `HierarchyPanelComponent` must not implement `ActorInputParticipant` after
  migration; pointer selection belongs to `TreeViewComponent`.
- `HierarchyPanelComponent` definition must not require
  `gizmoEventBindingComponentType` after migration.
- `ActorHierarchyObjectSource` usage for the Hierarchy panel must exclude
  Hierarchy presentation/item actors. Boundary tests should prevent item actor
  namespaces from becoming visible Hierarchy objects.
- `packages/editor/src/hierarchy/index.ts` should export the product Hierarchy
  surface, not generic tree internals from `ui-framework`.
- App style manifest must not import `editor/hierarchy/hierarchy.css` after the
  old CSS path is deleted.

### Exit Gate

- Tests prove TreeView computes display depth from `parentItemId`.
- Tests prove TreeView never creates item actors from raw data arrays.
- Tests prove TreeView internal row/cell/indent DOM is private implementation
  detail and does not register additional actors.
- Tests prove TreeView pointer activation goes through actor-input and produces
  the same generic activation sink payload as keyboard activation.
- Tests prove Hierarchy item actor ids are stable across source refresh and
  Scene close/reopen.
- Tests prove Tree item actors are excluded from `HierarchyObjectSource` and do
  not recursively appear as Hierarchy rows.
- Tests prove `HierarchyPanelComponent` registers the same-actor
  `UiElementComponent.element` as window content and does not create a second
  DOM root.
- Hierarchy large-node scroll visually uses themed ScrollView.
- Selection survives source refresh without losing stable item actors.
- Scene close/reopen exact-once remains true.
- Fresh Gate 7B default browser smoke evidence was generated:

```text
temp/project-arbor-gate-7b-hierarchy-smoke-data.json
temp/project-arbor-gate-7b-hierarchy-smoke-report.md
```

The default smoke proves the new TreeView/ScrollView path, source-pollution
guard, no legacy row DOM, no duplicate default item ids, and exact-once default
Scene/Tesseract/Camera3 rows. Large Hierarchy scroll still requires a
deterministic test-only actor population or fixture source; that evidence gap is
tracked as `ARB-001` and must not be solved by adding smoke-only actors to the
product default state.
- Grep has no production hits:

```powershell
rg -n "#rows|hierarchy-panel__row|createElement\(\"button\"|replaceChildren|overflow:\s*auto" packages/editor/src/hierarchy -g "*.ts" -g "*.css" -g "!*.test.ts"
rg -n "ActorInputParticipant|hitTestInput|onInputEnd|addEventListener\\(\"click\"|addEventListener\\(\"pointer" packages/editor/src/hierarchy/hierarchy-panel-component.ts
rg -n "editor/hierarchy/hierarchy\\.css|hierarchy\\.css" apps/wallpaper-tesseract/src/app/styles.ts packages/editor/src -g "*.ts"
```

- Validation:

```powershell
npm run test -w ui-framework -- scroll tree ui-layout-host
npm run test -w editor -- hierarchy
npm run typecheck -w editor
npm run build -w editor
npm run test -w wallpaper-tesseract -- architecture-boundaries
npm run typecheck -w wallpaper-tesseract
npm run build -w wallpaper-tesseract
```

## Gate 7C: ListView/TableView And Debug Log Migration

### Goal

Add generic list/table controls as needed, migrate Debug Log, and delete the old
monolithic `<pre>` presentation.

### Required Controls

```text
packages/ui-framework/src/ui/collection/
  list-view-component.ts
  list-view-definition.ts
  list-view-item-component.ts
  list-view-item-definition.ts
  list-view-component.test.ts
```

Add `TableViewComponent` only if Debug needs columns immediately. Prefer
`ListViewComponent` with monospace formatted rows unless a real multi-column
behavior is required.

### Collection Ownership Rules

- `ListViewComponent` and `ListViewItemComponent` read existing child item
  actors and components.
- They may sort, layout, highlight, select, and route activation intent.
- They must not accept raw log arrays and create actors internally.
- Debug owns stable log-entry actor creation/deletion and descriptor updates.

### Debug Migration Rules

- `DebugLogContentComponent` owns:
  - max-line policy;
  - log entry formatting;
  - stable row actor ids based on monotonic log entry ids, not array index or
    text content;
  - mapping log entries to list item descriptors.
- `ListViewComponent` owns row layout, selection/highlight styling if needed,
  and generic list semantics.
- `ScrollViewComponent` owns scrolling and `autoScroll: "end"`.
- Auto-scroll rule:
  - if user is at end, new log entries keep the view at end;
  - if user scrolled away from end, new log entries do not steal scroll.
- Delete:
  - `<pre>` root;
  - `debug-log-window__content` generic presentation CSS;
  - whole-log `textContent = lines.join("\n")` rendering.

### Exit Gate

- Tests prove maxLines trims row actors.
- Tests prove maxLines trim does not cause actor churn for retained monotonic
  log entry ids.
- Tests prove append updates list items rather than a single text node.
- Tests prove non-bottom scroll does not auto-jump.
- Fresh Gate 7C browser smoke evidence is generated; do not wait for Gate 7D:

```text
temp/project-arbor-gate-7c-debug-smoke-data.json
temp/project-arbor-gate-7c-debug-smoke-report.md
```

Smoke must cover Debug at bottom, Debug scrolled away from bottom, new log
append without scroll stealing, and no duplicate/churned retained row actors.
- Grep has no production hits:

```powershell
rg -n "debug-log-window__content|createElement\(\"pre\"|textContent\s*=.*join\\(" packages/editor/src/debug -g "*.ts" -g "*.css" -g "!*.test.ts"
```

- Validation:

```powershell
npm run test -w ui-framework -- scroll list collection
npm run test -w editor -- debug
npm run typecheck -w editor
npm run build -w editor
npm run test -w wallpaper-tesseract -- architecture-boundaries
```

## Gate 7D: Editor Theme Adoption, Window Chrome Tokens, And Theme Menu

### Goal

Wire real Editor/app theme selection, apply tokens to window/editor chrome, and
provide manual acceptance through the menu bar.

### Root Theme Owner

- App shell/root actor owns the root `UiThemeComponent`.
- `app/styles.ts` imports `ui-framework/ui/theme.css` and existing
  `ui-framework/ui/ui-framework-controls.css`.
- Theme modules are discovered/loaded by Editor/app code. `ui-framework` never
  knows the path.
- The selected theme id may be persisted by Editor/app state, not by
  `ui-framework`.

### Theme Module Loading And Creation

Editor/app should own a small theme registry:

- built-in default dark theme produced by `createUiThemeModule({ id: "default-dark" })`;
- optional additional theme modules from an app/editor-owned path or static
  import list;
- save/export helper can call `createUiThemeModule(partial)` to create a full
  module with defaults filled in.

Unknown/obsolete properties use the policy selected by the caller:

- during normal load: `warn`;
- during cleanup/export: `strip`/clear;
- during tests or strict validation: `strict`.

### Menu Requirement

Add manual theme switching:

```text
Window
Edit
  Theme
    Default Dark
    <Other available themes>
```

If generic submenu support does not exist:

1. Add submenu support to `ui-framework` generic menu components.
2. Extend the generic menu model with product-agnostic submenu descriptors, for
   example `children` or an explicit submenu role. Do not add an app-local
   `ThemeMenu` special case.
3. Define submenu popup ownership:
   - submenu popup actor is owned by the parent menu item actor;
   - submenu item actors are children of that popup actor;
   - open/highlight state is still controlled by generic menu components.
4. Define close/hover behavior before the App Menu adapter changes:
   - hover may open a submenu after the generic component decides it;
   - pointer leaving the menu/submenu chain closes deterministically;
   - keyboard escape/left/right behavior is either implemented generically or
     explicitly recorded as a follow-up, not faked in app-local code.
5. Update App Menu adapter to map Editor theme descriptors to generic submenu
   descriptors.
6. Do not reintroduce app-local row/highlight rendering.

### Styling Adoption

Apply tokens to:

- app shell background and top-docked chrome;
- root/floating window chrome;
- tabs and tab close buttons;
- splitters and dock previews;
- generic menus;
- generic scroll/tree/list controls;
- Hierarchy, Debug, Inspector panel surfaces;
- Camera3 chrome if feasible without a complex CSS-to-canvas bridge.

For Camera3 axis colors, do not add `--ui-axis-*` to `ui-framework`.
Choose one:

- editor-owned extension: define editor/product theme extension tokens such as
  `--editor-camera3-axis-x` outside the `ui-framework` core token registry and
  pass them through the Camera3 owner; or
- explicit follow-up: leave axis colors as product semantic constants and record
  the reason in `known-defects-and-todos.md`.

Do not add partial theme mutation APIs to individual components.

### Inspector Audit

- If Inspector is simple/static content, migrate it to ScrollView/theme tokens.
- If Inspector needs a future `PropertyGridComponent`, record that as a next
  gate instead of adding ad hoc local form controls.

### Exit Gate

- Manual menu switching changes at least:
  - app background;
  - window border/titlebar;
  - active tab background;
  - menu background/highlight;
  - Hierarchy selected row;
  - Debug scroll/list appearance;
  - scrollbar thumb.
- Theme switching produces no console errors.
- Menu submenu hover/activation does not break tab drag, dock preview, tab
  close, or Scene fullscreen controls.
- No editor panel owns local generic scrollbar styling.
- Hard-coded style cleanup is enforced by an allowlist/test script. Raw color,
  border, radius, font, and scrollbar constants outside theme defaults are
  allowed only when listed with an owner and reason; the allowlist should shrink
  during Gate 7D rather than become a compatibility escape hatch.
- No repeated hard-coded generic window/editor chrome colors remain outside
  theme defaults or the explicit allowlist.

Browser smoke evidence:

```text
temp/project-arbor-gate-7-theme-smoke-data.json
temp/project-arbor-gate-7-theme-smoke-report.md
```

Smoke must include:

- Hierarchy with enough nodes to scroll;
- Hierarchy selection after refresh/reopen;
- Debug log while at bottom and while scrolled away from bottom;
- Edit -> Theme submenu open and theme selection;
- Window/Menu/Hierarchy/Debug visual token changes;
- App Menu, Scene fullscreen, Camera3 gizmo, tab drag, dock preview, tab close;
- console errors = 0.

Validation:

```powershell
npm run prism:smoke:prepare
npm run test -w ui-framework
npm run typecheck:test -w ui-framework
npm run build -w ui-framework
npm run test -w editor
npm run typecheck -w editor
npm run build -w editor
npm run test -w wallpaper-tesseract -- architecture-boundaries
npm run typecheck -w wallpaper-tesseract
npm run build -w wallpaper-tesseract
npm run test
npm run typecheck
npm run build
```

## Completion Criteria For The Whole Gate 7 Series

Gates 7A-7D are complete when:

- `ui-framework` owns theme defaults, theme validation, theme creation, and
  theme application primitives without knowing file paths.
- `ScrollViewComponent` owns generic scroll appearance/semantics.
- `TreeViewComponent` and `ListViewComponent` are product-agnostic and used by
  real Editor panels.
- Hierarchy no longer owns generic row/scroll DOM or CSS.
- Debug no longer owns monolithic `<pre>` presentation.
- Window/editor/generic control chrome uses semantic theme tokens.
- Editor menu exposes Edit -> Theme submenu and can switch themes manually.
- Old Hierarchy/Debug row/list/scroll selectors and direct DOM implementations
  are deleted, not preserved as compatibility paths.
