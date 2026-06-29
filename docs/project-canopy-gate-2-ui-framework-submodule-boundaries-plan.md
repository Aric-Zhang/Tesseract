# Project Canopy Gate 2: UI Framework Submodule Boundaries

Status: completed
Last updated: 2026-06-29

This gate keeps `ui-framework` as one workspace package and makes its public
surface easier to consume through explicit submodule exports. It is not a
package split, not a compatibility layer, and not a product feature migration.

The main cleanup target is the current broad root barrel at
`packages/ui-framework/src/index.ts`. It exports generic actor UI controls,
theme/menu primitives, window chrome, docking models, ports, and window
services through one entry point. That made early refactors convenient, but it
now hides ownership and encourages app/editor code to import more surface than
it needs.

## Completion Summary

- `packages/ui-framework/package.json` now exports only:
  - `./actor-ui`
  - `./controls`
  - `./menu`
  - `./theme`
  - `./window`
  - `./ui/theme.css`
  - `./ui/ui-framework-controls.css`
- The package root `"."` export and top-level package `types` entry were
  removed.
- `packages/ui-framework/src/index.ts` and `packages/ui-framework/src/ui/index.ts`
  were deleted instead of retained as compatibility barrels.
- The old aggregate `installUiComponentDefinitions` was deleted. App and
  fixture composition now call owner-specific actor-ui, controls, menu, and
  theme installers explicitly.
- Production root `ui-framework` imports are 0 after Gate 2. The reviewer scan
  baseline before this gate was about 63 production files / 108 import sites.
- Boundary tests now verify exact public exports, root import deletion,
  resolved-file submodule ownership, zone overlap/unclassified files, and
  relative-path bypass fixtures.

## Pre-Gate Facts

- `packages/ui-framework/package.json` currently exports only:
  - `.`
  - `./ui/theme.css`
  - `./ui/ui-framework-controls.css`
- `packages/ui-framework/src/index.ts` currently re-exports:
  - all `src/ui/**` primitives;
  - window chrome under `src/chrome/**`;
  - window placement/layout/dock models under `src/model/**`;
  - UI and window ports under `src/ports/**`;
  - window lifecycle/workspace services under `src/services/**`.
- `packages/ui-framework/src/ui/index.ts` already groups:
  - `element`
  - `collection`
  - `layout`
  - `menu`
  - `scroll`
  - `theme`
  - `viewport`
  - `install-ui-component-definitions`
- `install-ui-component-definitions` is a full UI aggregate installer. It
  installs element, theme, layout, scroll, list/tree/virtual-list, menu, and
  viewport definitions. It is not an `actor-ui` primitive and must not be
  exported from `ui-framework/actor-ui` as-is.
- Production consumers still import many symbols from root `ui-framework`,
  especially editor window state/adapters, app menu/theme code, app shell,
  app frame loop, scene integration, and app-local `window-runtime` barrels.
  Reviewer scan found about 63 production files and 108 root import sites; Gate
  2 must record the exact before/after inventory in its completion report.
- CSS consumers currently import the stable paths directly from the package:
  - `ui-framework/ui/theme.css`
  - `ui-framework/ui/ui-framework-controls.css`
- This gate should not move product concepts into `ui-framework` and should not
  create a second CSS export path.

## Non-Negotiables

- Do not split `ui-framework` into more workspace packages.
- Do not add compatibility re-export packages or compatibility CSS paths.
- Do not keep old and new CSS paths at the same time.
- Do not add product facts to generic UI submodules.
- Do not let `menu`, `theme`, `controls`, or `actor-ui` import window workspace
  models or services.
- Do not use the root `ui-framework` barrel for new or touched production
  imports when a specific submodule exists.
- Do not export the old aggregate `installUiComponentDefinitions` from
  `actor-ui`. Split definition installation by owner, or stop and amend the
  plan if a temporary aggregate installer is proven necessary.
- Do not move files only for visual symmetry. Add small public submodule barrels
  over existing owners unless a file move deletes real confusion.
- Boundary rules must inspect resolved file/zone, not only bare import text, so
  relative-path bypasses are caught.

## Target Public Surface

Create explicit package submodules:

```text
ui-framework/actor-ui
ui-framework/controls
ui-framework/menu
ui-framework/theme
ui-framework/window
```

Keep current CSS package exports for this gate:

```text
ui-framework/ui/theme.css
ui-framework/ui/ui-framework-controls.css
```

Do not introduce `ui-framework/css` in Gate 2. Renaming CSS paths can be a later
reviewed cleanup, but adding it now would create a compatibility-path decision
where none is needed.

## Submodule Ownership

`ui-framework/actor-ui`

Owns generic actor-backed UI foundation:

- `ui/element`
- `ui/layout`
- `ports/ui-actor-context`
- `ports/ui-frame-update-attachment-runtime`
- `ports/ui-geometry`
- `ports/ui-layout-state`
- `ports/ui-scheduler`
- `installActorUiComponentDefinitions`, which installs only actor UI foundation
  definitions such as element and layout definitions.

It must not import window chrome, dock models, menu business descriptors,
theme-controller app code, editor, runtime, or app-local paths.

`ui-framework/controls`

Owns reusable non-window controls:

- `ui/collection`
- `ui/scroll`
- `ui/viewport`
- `installControlComponentDefinitions`, which installs only scroll,
  collection, render viewport, and fullscreenable view definitions.

It may import `actor-ui` internals through relative source paths while still in
the same package, but it must not import `window` models/services or product
features. It may use `actor-system/core` and `actor-system/input` only where
the control itself participates in actor input.

`ui-framework/menu`

Owns generic menu descriptors and menu components:

- `ui/menu`
- `installMenuComponentDefinitions`, which installs only generic menu
  definitions.

It must not import window view descriptors, workspace commands, app menu
payloads, theme storage, editor state, or app-local feature paths. Window menu
adapters stay in app/window composition.

`ui-framework/theme`

Owns theme tokens, schema parsing, module creation, CSS generation helpers, and
`UiThemeComponent`:

- `ui/theme`
- `installThemeComponentDefinitions`, which installs only the theme definition.

It must not own theme file paths, theme storage, product theme catalog
discovery, or editor/app-specific theme lists.

Definition installation rule:

- Delete or stop exporting the old all-in-one `installUiComponentDefinitions`.
- App/fixture composition should explicitly call the owner installers it needs:
  `installActorUiComponentDefinitions`, `installControlComponentDefinitions`,
  `installMenuComponentDefinitions`, and `installThemeComponentDefinitions`.
- If execution proves a single convenience installer is still required, it must
  be a clearly named composition installer outside `actor-ui`, with an explicit
  allowlist and deletion/review note. Do not silently preserve the old name.

`ui-framework/window`

Owns the reusable window, dock, tab, frame, workspace, and presentation stack
surface:

- `chrome/**`
- `model/window*`
- `model/floating-window-state`
- `ports/dock-target-region-source`
- `ports/window*`
- `services/window*`
- window-facing exports from `ports/window-content-registry`

It may depend on `actor-ui` primitives and `controls` only when the window
implementation actually renders them. It must not import editor, wallpaper
runtime, Scene/Tesseract/Camera3/Debug/Hierarchy product code, or app
composition.

## Step 0: Entry Gate And Inventory

1. Confirm the worktree is clean or contains only explicitly reviewed plan
   edits.

```text
git status --short
```

2. Re-run the current package/boundary baseline:

```text
npm run test -w wallpaper-tesseract -- architecture-boundaries
npm run build -w ui-framework
```

3. Generate the exact current root import inventory before editing:

```text
rg 'ui-framework' packages/editor/src apps/wallpaper-tesseract/src packages/wallpaper-runtime/src -n --glob '!**/*.test.ts' --glob '!**/*.md'
rg 'ui-framework/ui/theme.css|ui-framework/ui/ui-framework-controls.css' apps packages -n --glob '!**/dist/**' --glob '!**/node_modules/**'
```

4. Classify every production root import into one target submodule:

```text
actor-ui | controls | menu | theme | window | keep-root-allowlist
```

The default Gate 2 target is an empty keep-root allowlist. Record the before
count and after count for production root imports in the completion report. If
a root import cannot be removed without turning the gate into a broader
architectural migration, stop for review or write the exact symbol, caller, and
reason into a boundary-tested allowlist. A vague "broad UI convenience" reason
is not acceptable.

## Step 1: Add Public Submodule Barrels

Add small explicit barrels:

```text
packages/ui-framework/src/actor-ui/index.ts
packages/ui-framework/src/controls/index.ts
packages/ui-framework/src/menu/index.ts
packages/ui-framework/src/theme/index.ts
packages/ui-framework/src/window/index.ts
```

Implementation rules:

- Re-export existing source owners; do not duplicate models.
- Keep each barrel sorted by ownership, not alphabetic convenience.
- Do not re-export from root `../index`.
- Do not import product packages.
- Do not move files unless a move deletes a misleading old owner.

Expected initial mapping:

```text
actor-ui -> ui/element, ui/layout, actor UI definitions, UI ports
controls -> ui/collection, ui/scroll, ui/viewport, control definitions
menu     -> ui/menu, menu definitions
theme    -> ui/theme, theme definitions
window   -> chrome, window models, window ports, window services
```

If a symbol appears to belong to two submodules, stop and decide the owner. Do
not export the same symbol from multiple new submodules merely to keep imports
easy.

Installer split:

- Replace `installUiComponentDefinitions` with owner-specific installers:
  - `installActorUiComponentDefinitions`
  - `installControlComponentDefinitions`
  - `installMenuComponentDefinitions`
  - `installThemeComponentDefinitions`
- Delete the old aggregate installer or remove it from public exports in this
  gate. Do not re-export it from `actor-ui`.
- App and fixture composition must call the explicit installers it needs.

## Step 2: Update Package Exports

Update `packages/ui-framework/package.json` exports:

```json
{
  "./actor-ui": {
    "types": "./dist/actor-ui/index.d.ts",
    "import": "./dist/actor-ui/index.js"
  },
  "./controls": {
    "types": "./dist/controls/index.d.ts",
    "import": "./dist/controls/index.js"
  },
  "./menu": {
    "types": "./dist/menu/index.d.ts",
    "import": "./dist/menu/index.js"
  },
  "./theme": {
    "types": "./dist/theme/index.d.ts",
    "import": "./dist/theme/index.js"
  },
  "./window": {
    "types": "./dist/window/index.d.ts",
    "import": "./dist/window/index.js"
  }
}
```

Keep the two current CSS exports unchanged:

```json
"./ui/theme.css": "./dist/ui/theme.css",
"./ui/ui-framework-controls.css": "./dist/ui/ui-framework-controls.css"
```

Do not add `./css`, `./style.css`, `./theme.css`, or other aliases.

Default export cleanup:

- Remove the root `"."` export once production root imports are migrated.
- Remove the top-level `"types"` field that points at `dist/index.d.ts`.
- Keep `src/index.ts` only if TypeScript/build tooling still needs it; it must
  not be a public package export by default.

Fallback export cleanup, only after reviewed allowlist:

- If root export must remain, the allowed root symbols and callers must be
  encoded in boundary tests.
- The root export still must not re-export every submodule.

## Step 3: Migrate Production Consumers

Migrate production imports from root `ui-framework` to specific submodules.
Prioritize production code first, then tests.

Expected directions:

- App menu descriptors/adapters:
  - `ui-framework/menu`
  - `ui-framework/theme` only for theme module types or diagnostics
  - `ui-framework/actor-ui` only for frame update attachment or base UI ports
- App theme controller:
  - `ui-framework/theme`
- UI framework fixture:
  - `ui-framework/theme` for `createUiThemeModule`
  - explicit owner installers from `actor-ui`, `controls`, `menu`, and `theme`
    instead of `installUiComponentDefinitions`
- Editor Hierarchy/Debug/Inspector/Scene UI components:
  - `ui-framework/actor-ui`
  - `ui-framework/controls`
  - `ui-framework/window` only for window content registration or window view
    descriptors
- Editor app/window state adapters:
  - `ui-framework/window`
  - `ui-framework/actor-ui` only for UI layout state primitives
- App-local `window-runtime` wrappers:
  - `ui-framework/window`
  - Consider deleting wrappers that only re-export `ui-framework/window` symbols
    and are no longer needed by production callers.
- App shell/frame loop:
  - `ui-framework/actor-ui` for `UiFrame` and scheduler-facing UI types
  - `ui-framework/window` only for presentation stack constants or window shell
    models
- Scene integration:
  - `ui-framework/controls` for `RenderViewportComponent`
  - `ui-framework/actor-ui` for base UI element/layout types
  - `ui-framework/window` only for actual window content registration

Deletion rule:

- If a local app/editor barrel exists only to re-export root `ui-framework`
  symbols, delete it or retarget it to the proper submodule in the same change.
- Do not preserve a local compatibility wrapper just because old imports still
  compile.

## Step 4: Tighten The Root Barrel

After production callers migrate, shrink `packages/ui-framework/src/index.ts`.

Preferred final shape:

- No production consumer imports from root `ui-framework`.
- `packages/ui-framework/package.json` removes the `"."` export and top-level
  `"types"` field.
- `packages/ui-framework/src/index.ts` is deleted or reduced to a non-exported
  internal test fixture only if the build requires the file. Prefer deletion.

Fallback final shape, only after review:

- root exports a small documented umbrella set only where broad package import
  is intentionally stable;
- every root-imported symbol has an allowlisted caller and reason;
- `architecture-boundaries` fails any non-allowlisted production root import.

The root barrel must not become a duplicate of every submodule. If review
decides the root should remain temporarily, the allowlist must be encoded in
boundary tests and documented in the Gate 2 completion notes.

New or touched production imports from root `ui-framework` are forbidden once
the matching submodule exists.

## Step 5: Add Submodule Boundary Tests

Extend the Gate 0 package graph helper or `architecture-boundaries.test.ts` with
`ui-framework` source zones. The evaluator must use resolved files and source
zones so relative imports cannot bypass the rule.

The existing `defineSubmoduleZone(id, prefix)` shape is not enough for Gate 2,
because `ui-framework` submodules span multiple directories. Add a
multi-prefix or predicate-based helper, for example:

```text
defineSubmoduleZone(id, prefixes[])
defineSubmoduleZoneByPredicate(id, predicate)
```

The helper must support:

- multiple source prefixes per logical zone;
- checking that no production file belongs to more than one zone;
- checking that every production `packages/ui-framework/src/**` file belongs to
  a known zone, or is explicitly listed as exempt with a reason;
- checking resolved relative imports, not only bare package specifiers.

Required zones:

```text
ui-framework/actor-ui -> packages/ui-framework/src/actor-ui, ui/element, ui/layout, UI ports
ui-framework/controls -> packages/ui-framework/src/controls, ui/collection, ui/scroll, ui/viewport
ui-framework/menu     -> packages/ui-framework/src/menu, ui/menu
ui-framework/theme    -> packages/ui-framework/src/theme, ui/theme
ui-framework/window   -> packages/ui-framework/src/window, chrome, window models, window ports, window services
```

Required rules:

- `actor-ui` must not import `window`, `menu`, `theme`, app, editor, or runtime
  zones.
- `controls` must not import `window`, app, editor, wallpaper-runtime, Scene,
  Camera3, Tesseract, Debug, Hierarchy, or app menu zones.
- `menu` must not import `window`, app menu adapters, window view descriptors,
  workspace commands, theme storage, editor, runtime, or app-local zones.
- `theme` must not import app theme catalog/storage, menu adapters, editor,
  runtime, or app-local zones.
- `window` must not import editor, wallpaper-runtime, runtime-three,
  Scene/Tesseract/Camera3/Debug/Hierarchy product code, app composition, or app
  feature zones.
- Public submodule barrels must not import from root `ui-framework`.
- `ui-framework` package exports must exactly match the Gate 2 decision:
  submodule exports plus the current two CSS paths, with no extra CSS aliases
  and no root `"."` export unless the reviewed root allowlist fallback is
  activated.
- CSS exports must be exactly the current two paths unless this plan is amended
  to replace them in one deletion step.

Add fixture tests proving:

- A non-allowlisted production `from "ui-framework"` import fails.
- A relative import from `ui/menu` into `model/window-workspace-graph` fails.
- A relative import from `ui/theme` into app theme controller code fails.
- A relative import from `window` into editor Scene/Camera3 code fails.
- A production caller importing a moved symbol from root `ui-framework` fails
  unless it is in the explicit keep-root allowlist.
- Package exports fail if `./css`, `./theme.css`, `./style.css`, or any other
  CSS compatibility alias appears.

## Step 6: CSS Export Audit

Keep CSS entry points unchanged in Gate 2.

Required checks:

```text
rg 'ui-framework/ui/theme.css|ui-framework/ui/ui-framework-controls.css' apps packages -n --glob '!**/dist/**' --glob '!**/node_modules/**'
```

Exit rule:

- App and fixture CSS imports still resolve after `npm run build -w ui-framework`.
- No additional CSS export path is present in `packages/ui-framework/package.json`.
- No source file imports package CSS through a private `src` path.

## Step 7: Documentation Updates

Update:

- `docs/current-project-progress.md`
- `docs/project-canopy-package-consolidation-plan.md`

If Gate 2 changes a stable architecture rule, also update `AGENTS.md`.

Required progress document facts:

- Gate 2 completion status.
- Final `ui-framework` submodule export list.
- Root import before/after count.
- Root barrel removal status, or any explicit keep-root allowlist with symbol,
  caller, and reason.
- CSS export decision.
- Definition installer split status.

## Step 8: Validation Matrix

Targeted validation while editing:

```text
npm run test -w ui-framework
npm run typecheck:test -w ui-framework
npm run build -w ui-framework
npm run test -w editor
npm run typecheck -w editor
npm run build -w editor
npm run test -w wallpaper-tesseract -- architecture-boundaries
npm run typecheck -w wallpaper-tesseract
npm run build -w wallpaper-tesseract
```

Final validation before declaring Gate 2 complete:

```text
npm run test
npm run typecheck
npm run build
```

Browser smoke is required if app/editor production imports or CSS entries are
changed:

```text
npm run prism:smoke:prepare
npm run dev -w wallpaper-tesseract
node apps/wallpaper-tesseract/scripts/run-project-arbor-gate-7-theme-smoke.mjs
```

Then validate the generated smoke evidence with the current smoke contract.

## Exit Criteria

- `ui-framework` has explicit public submodule exports for actor UI, controls,
  menu, theme, and window surfaces.
- Production consumers use explicit submodules instead of root `ui-framework`.
- Root production import count is zero, and the package root `"."` export plus
  top-level `"types"` field are removed; or a reviewed allowlist fallback is
  encoded in boundary tests with symbol, caller, and reason.
- `installUiComponentDefinitions` is deleted from the public surface and
  replaced by owner-specific definition installers.
- Generic UI submodules do not import window or product facts.
- Window submodule does not import editor/runtime/product facts.
- Multi-prefix/predicate submodule zone checks prove no overlapping
  `ui-framework` zone ownership and no unclassified production source files.
- CSS package exports remain singular and buildable.
- Local app/editor barrels that only existed as historical convenience wrappers
  are deleted or retargeted to a single owner.
- Boundary tests catch bare and relative cross-submodule violations.
- Root `test`, `typecheck`, and `build` pass.

## Stop Conditions

Stop and amend this plan if:

- A symbol needs to be exported from multiple submodules to satisfy current
  callers.
- Migrating imports requires creating a compatibility wrapper.
- Removing the root package export breaks a legitimate external or internal
  consumer that cannot be migrated within this gate.
- Splitting `installUiComponentDefinitions` requires a new aggregate installer
  to preserve old call sites.
- Generic menu/theme/control code needs window workspace facts.
- Window code needs product Scene/Tesseract/Camera3/Debug/Hierarchy facts.
- CSS export cleanup would require keeping old and new package paths at the
  same time.
- The boundary helper cannot resolve relative imports to source zones.
