# Project Canopy: Package Consolidation And Submodule Boundary Plan

Status: `completed`

Last updated: 2026-06-30

## Purpose

Project Prism split ownership into packages. Project Arbor then made ordinary UI
controls follow actor tree -> component composition. The next maintenance
problem is package granularity: some foundational pieces are now clean but small
enough that everyday feature work must import several packages just to use one
coherent subsystem.

Project Canopy consolidates those small foundational packages into fewer
complete libraries while preserving internal architectural boundaries through
subpath exports, tests, and package graph rules. The goal is not to undo Prism.
The goal is to make the extracted architecture easier to consume.

## Current Package Shape

Current workspace packages:

- `actor-system`: consolidated actor package with explicit `actor-system/core`,
  `actor-system/input`, and `actor-system/gizmo` submodule exports. Gate 1
  deleted the former `actor-core`, `actor-input`, and `gizmo-core` packages
  instead of preserving compatibility shells.
- `ui-framework`: product-agnostic UI/window/app-shell controls, layout, menu,
  theme, docking, frame lifecycle, and persistence.
- `runtime-core`: renderer-agnostic runtime contracts.
- `runtime-three`: Three/WebGL runtime backend.
- `wallpaper-runtime`: product runtime owner over runtime packages.
- `editor`: editor presentation/features over actor, UI, and runtime contracts.
- `four-rotation`, `four-camera`, `four-camera-three`: 4D math/camera packages.
- `wallpaper-tesseract`: app composition and Wallpaper Engine app.

Current pain points:

- Gate 1 closed the actor foundation package split. Historical pre-Gate-1
  actor-backed feature work usually needed `actor-core`, `actor-input`, and
  `gizmo-core` together; current code depends on one `actor-system` package and
  imports explicit submodules.
- `ui-framework` has become the correct umbrella for product-agnostic UI, but
  its public root barrel can hide which sub-area a feature really needs.
- Further package extraction would likely add ceremony before it removes
  complexity. The next cleanup should shrink package count and clarify module
  entry points.

## Non-Negotiables

- No compatibility packages. If `actor-core`, `actor-input`, or `gizmo-core`
  are merged, the old packages are deleted in the same gate. Do not leave
  re-export shells behind.
- No broad "convenience" facade that hides ownership. A larger package may
  expose submodules, but each submodule keeps explicit import rules.
- Physical package boundaries may be replaced only after tests enforce the
  internal boundaries that package folders used to protect.
- No product/editor/runtime concepts may enter actor or generic UI internals.
- Package consolidation must reduce real complexity: fewer workspace package
  manifests, fewer root script build steps, fewer cross-package dependency
  declarations, and clearer consumer imports.
- Internal source moves must update production imports, tests, package exports,
  root scripts, TypeScript configs, package-lock, and architecture boundary
  tests in the same gate.
- Delete stale package files, docs, scripts, and references immediately. Do not
  leave idle old package folders.

## Target Shape

### Actor System Package

Create one foundational actor package, tentatively:

```text
packages/actor-system
```

Suggested submodules:

```text
actor-system/core
actor-system/input
actor-system/gizmo
actor-system/testing
```

Internal rules:

- `core` imports no `input`, no `gizmo`, no DOM, no UI, no runtime, no editor.
- `gizmo` remains framework-agnostic and imports no UI/editor/runtime.
- `input` may import `core` and `gizmo`; it remains the only place that adapts
  actor participation to pointer/gizmo input semantics.
- `testing` may expose package-local helpers only if they are already reusable
  and do not pull product dependencies into production exports.

Consumer intent:

- Actor-only features import `actor-system/core`.
- Interactive actor features import `actor-system/input`.
- Low-level pointer/gizmo code imports `actor-system/gizmo`.
- Apps that want the whole actor subsystem depend on one package, not three.
- Production code must use explicit submodule imports. Gate 1 intentionally did
  not create an `actor-system` root export; if a root export is ever needed, it
  requires a reviewed follow-up plan rather than an opportunistic convenience
  barrel.

### UI Framework Package

Keep `packages/ui-framework` as the UI/window umbrella package, but tighten
submodule exports and source layout.

Suggested public submodules:

```text
ui-framework/actor-ui
ui-framework/controls
ui-framework/menu
ui-framework/theme
ui-framework/window
```

Source can stay close to current directories where that avoids churn, but public
exports should make ownership clear:

- `actor-ui`: `UiElementComponent`, layout item/host, and generic actor-backed
  UI composition primitives.
- `controls`: scroll/tree/list/virtual-list/render-viewport/fullscreenable
  controls.
- `menu`: menu model and generic menu/submenu controls.
- `theme`: token definitions, theme parser/creator/validator, `UiThemeComponent`.
- `window`: app shell, window frame, docking, layout persistence, lifecycle,
  presentation stack, and window-specific services.

Do not move `editor`, `wallpaper-runtime`, Scene/Tesseract/Camera3 product
logic, or app composition into `ui-framework`.

The current CSS entry points are:

```text
ui-framework/ui/theme.css
ui-framework/ui/ui-framework-controls.css
```

If Project Canopy replaces them with a cleaner entry such as
`ui-framework/css`, the old CSS exports must be deleted in the same gate and all
callers must be updated. Do not keep compatibility CSS paths.
Gate 2 does not introduce `ui-framework/css`; it keeps the current CSS paths and
only tightens TypeScript submodule entry points. A CSS path rename requires a
separate reviewed cleanup.

### Runtime Packages

Runtime package consolidation is not part of the first execution gate.

Keep:

- `runtime-core`
- `runtime-three`
- `wallpaper-runtime`
- `four-rotation`
- `four-camera`
- `four-camera-three`

Reason: these packages still separate renderer-agnostic runtime contracts,
Three backend implementation, product runtime ownership, and 4D math. Merging
them before actor/UI consolidation would likely reduce clarity less than it
increases blast radius.

## Pre-Canopy: Arbor Closure Checkpoint

Goal: finish Project Arbor as its own history checkpoint before moving package
files.

Steps:

1. Keep the completed Arbor cleanup separate from package moves:
   - deleted Arbor execution docs;
   - deleted old Arbor Gate 4/Gate 5/Final smoke contracts and runner;
   - cleaned Arbor temp work traces;
   - added this Project Canopy plan.
2. Run final Arbor/root validation before the package move begins:

```text
npm run test
npm run typecheck
npm run build
```

3. Commit the Arbor closure and Canopy plan as a standalone checkpoint before
   creating or deleting packages.

Exit criteria:

- Project Arbor is marked complete in `docs/current-project-progress.md`.
- The working tree is clean before Gate 0 package graph work begins.
- Any remaining Arbor follow-up, such as `ARB-001`, is recorded in
  `docs/known-defects-and-todos.md` as non-blocking.

Stop conditions:

- If root validation fails because of the Arbor cleanup, fix that before
  starting package consolidation. Do not mix Arbor closure fixes with Canopy
  file moves.

## Gate 0: Baseline And Graph Audit

Detailed execution plan:

```text
docs/project-canopy-gate-0-package-graph-baseline-plan.md
```

Goal: freeze current working state and make package graph facts explicit before
moving files.

Steps:

1. Confirm the worktree only contains intended planning/doc cleanup changes.
2. Run baseline validation:

```text
npm run test
npm run typecheck
npm run build
```

3. Record the current package graph in a small generated report or in
   `docs/current-project-progress.md`.
4. Add or retain hard package graph tests before any package is merged:
   - workspace package dependency graph has no cycles;
   - every workspace package import is declared in the importing package's
     `package.json`;
   - app/editor/runtime/ui package zones do not import forbidden owners;
   - current actor package internals are covered by equivalent submodule
     forbidden-import assertions that can survive the physical package merge.
5. Add an explicit report or test fixture that lists the package graph expected
   by this gate. A failing package graph must fail tests, not just documentation
   review.
6. Make a checkpoint commit before moving packages.

Exit criteria:

- Root validation passes.
- Current graph facts are documented.
- Cycle, undeclared workspace import, and forbidden-import tests pass and are
  ready to protect internal submodules after Gate 1 removes physical package
  boundaries.
- Any unrelated dirty work is either committed separately or explicitly left
  untouched.

Stop conditions:

- If root validation fails for reasons unrelated to package consolidation, stop
  and resolve the baseline first.
- If boundary tests cannot distinguish `actor-system/core`, `actor-system/input`,
  and `actor-system/gizmo` after a merge, stop and design that test surface
  before moving files.

## Gate 1: Merge Actor Core, Actor Input, And Gizmo Core

Status: `completed` on 2026-06-29.

Detailed execution plan:

```text
docs/project-canopy-gate-1-actor-system-package-plan.md
```

Goal: make actor/component/input/gizmo functionality available as one coherent
actor-system package while preserving internal submodule boundaries.

Steps:

1. Create `packages/actor-system` with package metadata, build, test,
   typecheck, exports, and `tsconfig`.
2. Move source without compatibility wrappers:

```text
packages/actor-core/src   -> packages/actor-system/src/core
packages/actor-input/src  -> packages/actor-system/src/input
packages/gizmo-core/src   -> packages/actor-system/src/gizmo
```

3. Define package exports:

```json
{
  "./core": "./dist/core/index.js",
  "./input": "./dist/input/index.js",
  "./gizmo": "./dist/gizmo/index.js"
}
```

Use the exact export shape required by the existing package build convention.
Gate 1 must not create an `actor-system` root export. If a root export becomes
necessary, stop and revise this plan with a reviewed allowlist. Production code
must use explicit submodule imports.

Root export rule:

- Production code migrated in this gate must use `actor-system/core`,
  `actor-system/input`, or `actor-system/gizmo`.
- `actor-system/core`, `actor-system/input`, and `actor-system/gizmo` must not
  import the `actor-system` root, even if a root export is designed later.
- Boundary tests must flag production imports from `actor-system` root.

4. Update imports in all packages and apps:

```text
actor-core  -> actor-system/core
actor-input -> actor-system/input
gizmo-core  -> actor-system/gizmo
```

5. Update package manifests:

- Add `actor-system` dependencies where needed.
- Remove `actor-core`, `actor-input`, and `gizmo-core` dependencies.
- Remove old workspace packages from root build/test/typecheck scripts.
- Add `actor-system` in the correct build order.
- Update lockfile.

6. Move tests into the new package and keep targeted names recognizable.
7. Delete old package directories:

```text
packages/actor-core
packages/actor-input
packages/gizmo-core
```

8. Add boundary tests for internal actor-system submodules:

- `core` must not import `input` or `gizmo`.
- `core` and `gizmo` must not import DOM, UI, editor, runtime, or app code.
- `input` may import `core` and `gizmo`, but not UI/editor/runtime/app code.

9. Update `AGENTS.md` stable architecture names and rules in the same gate:
   - replace stable references to `actor-core`, `actor-input`, and `gizmo-core`
     as packages with `actor-system/core`, `actor-system/input`, and
     `actor-system/gizmo`;
   - preserve historical references only where they describe completed Project
     Prism history;
   - keep the rule that actor core remains DOM/UI/runtime/editor agnostic.

Validation:

```text
npm run test -w actor-system
npm run typecheck -w actor-system
npm run build -w actor-system
npm run test -w ui-framework
npm run test -w editor
npm run test -w wallpaper-runtime
npm run test -w wallpaper-tesseract -- architecture-boundaries
npm run typecheck
npm run build
```

Exit criteria:

- No production or test import references `actor-core`, `actor-input`, or
  `gizmo-core`.
- The old package folders are gone.
- Root scripts no longer mention the old package names.
- Architecture boundary tests enforce actor-system internal direction.
- `AGENTS.md` and `docs/current-project-progress.md` use the new package names
  for current architecture guidance, so handoff agents do not follow stale
  package terminology.

Stop conditions:

- If any migration requires UI/window/editor/runtime facts inside
  `actor-system/core` or `actor-system/gizmo`, stop and redesign before
  continuing.

## Gate 2: Tighten UI Framework Submodule Boundaries

Status: completed as of 2026-06-29.

Goal: keep `ui-framework` as one reusable UI/window package while making its
public entry points clearer and reducing accidental root-barrel coupling.

Detailed execution plan:

```text
docs/project-canopy-gate-2-ui-framework-submodule-boundaries-plan.md
```

Steps:

1. Audit current `ui-framework` exports and production callers.
2. Create or normalize public submodule barrels:

```text
src/actor-ui/index.ts
src/controls/index.ts
src/menu/index.ts
src/theme/index.ts
src/window/index.ts
```

Use existing source files where possible. Do not move files merely for visual
symmetry if a clear export layer solves the consumer problem.

3. Update `packages/ui-framework/package.json` exports for the submodules and
   CSS entries.
   - Do not export the old aggregate `installUiComponentDefinitions` from
     `actor-ui`.
   - Split definition installers by owner:
     `installActorUiComponentDefinitions`, `installControlComponentDefinitions`,
     `installMenuComponentDefinitions`, and `installThemeComponentDefinitions`.
4. Tighten the `ui-framework` root barrel:
   - production imports added or touched by this gate should use explicit
     submodules such as `ui-framework/menu`, `ui-framework/theme`,
     `ui-framework/window`, `ui-framework/controls`, or
     `ui-framework/actor-ui`;
   - the root export may remain only as a small curated surface for
     already-stable broad UI framework symbols;
   - do not add new app/editor imports from the root barrel when a submodule
     exists.
   The default Gate 2 exit is stronger: no production root imports and no
   package `"."` export. If that is impossible, a reviewed allowlist with exact
   symbol/caller/reason is required.
5. Update app/editor imports when a submodule import makes ownership clearer.
   Avoid churn only when the root export is intentionally broad, documented,
   and covered by an allowlist.
6. Keep the current CSS export shape as one truth:
   - keep `ui-framework/ui/theme.css` and
     `ui-framework/ui/ui-framework-controls.css` as the stable current paths;
   - do not add `ui-framework/css` or any other CSS compatibility alias in
     Gate 2.
7. Delete stale internal barrels that only exist as historical convenience
   aliases.
8. Strengthen boundary tests:

- `ui-framework/actor-ui`, `controls`, `menu`, and `theme` must not import
  `window` workspace models unless explicitly listed.
- `menu` and `theme` must remain product/window agnostic.
- `window` may depend on actor-system and UI primitives, but not editor,
  wallpaper-runtime, Scene/Tesseract/Camera3, or app composition.
- New app/editor production imports from `ui-framework` root are forbidden
  unless they are in a small documented allowlist.
- CSS package exports are singular: tests should fail if both old and new CSS
  paths are exported after the migration decision.
- `ui-framework` submodule zones must support multiple source prefixes and must
  fail on overlapping or unclassified production source files.

Validation:

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

Browser smoke is required if app/editor imports or CSS entry points change:

```text
npm run prism:smoke:prepare
npm run dev -w wallpaper-tesseract
```

Exit criteria:

- UI consumers can import the stable submodule they need without knowing
  package internals.
- New or touched app/editor imports use explicit `ui-framework` submodules
  except for reviewed allowlisted root imports.
- No product facts enter generic UI submodules.
- Removed barrels have no references.
- CSS package exports still work after build and there is no compatibility CSS
  export path left behind.

Stop conditions:

- If submodule exports require duplicating models or re-exporting product
  adapters, stop and split the model at the owner instead.

## Gate 3: Root Script And Workspace Simplification

Status: completed as of 2026-06-29.

Goal: make workspace commands reflect the consolidated package shape.

Detailed execution plan:

```text
docs/project-canopy-gate-3-root-script-workspace-simplification-plan.md
```

Preferred approach:

- replace repeated root `test`, `typecheck`, `build`, and
  `prism:smoke:prepare` chains with one small explicit workspace sequence
  runner;
- keep package order easy to inspect and locked by boundary tests;
- do not add compatibility scripts or a second package graph solver.

Summary steps:

1. Simplify root `test`, `typecheck`, `build`, and `prism:smoke:prepare` scripts
   after Gate 1 removes three small packages.
2. Keep build order explicit and minimal:

```text
actor-system
ui-framework
runtime-core
four-rotation
four-camera
four-camera-three
runtime-three
wallpaper-runtime
editor
wallpaper-tesseract
```

Adjust exact order if package manifests require it.

3. Update `docs/current-project-progress.md` package list, source topology, and
   verification commands.
4. Remove stale references to old package names from docs that are not
   historical Prism records. Historical records may mention old names as history.

Validation:

```text
npm run test
npm run typecheck
npm run build
```

Exit criteria:

- Root scripts are shorter and match the actual package graph.
- Current progress documentation matches the filesystem.
- Old package names are absent from active docs except historical phase records.

## Gate 4: Runtime Consolidation Decision

Status: completed as of 2026-06-30. Decision: keep the current runtime/math
package shape; no runtime merge implementation plan is created.

Goal: decide, after actor/UI consolidation, whether runtime package granularity
still creates enough friction to justify another package move.

This is a decision gate, not an automatic implementation gate.

Detailed execution plan:

```text
docs/project-canopy-gate-4-runtime-consolidation-decision-plan.md
```

Questions:

- Does feature work routinely need `runtime-core`, `runtime-three`, and
  `wallpaper-runtime` together, or are those still different ownership layers?
- Would merging `runtime-core` and `runtime-three` make renderer-agnostic runtime
  contracts harder to preserve?
- Would merging `wallpaper-runtime` into a generic runtime package mix product
  ownership back into reusable runtime code?
- Do the `four-*` packages behave like reusable math libraries, or are they now
  just package-management overhead?

Default decision:

- Do not merge runtime packages unless there is concrete maintenance evidence
  that package count is now more harmful than the boundary protection.
- Do not merge `wallpaper-runtime` into generic runtime packages without a new
  plan and review.

Exit criteria:

- A short decision record is added to `docs/current-project-progress.md` or a
  new plan is created only if a runtime merge is justified.

Decision report:

```text
docs/project-canopy-gate-4-runtime-consolidation-report.md
```

## Final Validation

Run after all executed gates:

```text
npm run test
npm run typecheck
npm run build
```

If app imports, CSS entries, or package dist contracts changed, also run browser
smoke:

```text
npm run prism:smoke:prepare
npm run dev -w wallpaper-tesseract
```

Minimum smoke coverage:

- App boots with console errors at 0.
- App Menu opens and theme submenu still works.
- Scene render view, Camera3 gizmo, fullscreen/restore, Debug, Hierarchy, and
  Inspector remain usable.
- Window docking and tab close still route through actor input/window lifecycle.

## Success Criteria

- Package count is reduced without reintroducing broad compatibility layers.
- Actor-system consumers can build actor/component/input features by depending
  on one package with clear submodule imports.
- UI consumers can use one `ui-framework` package with explicit submodule
  exports rather than coordinating separate UI micro-packages.
- Internal boundaries are enforced by tests rather than package fragmentation
  alone.
- Root scripts and package manifests become smaller, not larger.
- Old package directories and package names are removed from active production
  imports.

## Risks

- A physical package merge can hide bad imports if internal boundary tests are
  weak. Mitigation: add submodule import tests before deleting old packages.
- Updating all imports has a large blast radius. Mitigation: make a clean
  checkpoint after Gate 0, migrate one package family per gate, and run targeted
  package tests before root validation.
- Root package export changes can break Vite or CSS imports. Mitigation: keep
  package build/export checks in each gate and run app build whenever exports
  change.

## Out Of Scope

- Rewriting actor/component runtime semantics.
- Moving editor features into `ui-framework`.
- Moving wallpaper product runtime into generic runtime packages.
- Adding compatibility aliases for old package names.
- Changing the UI theme model beyond import/package cleanup.
