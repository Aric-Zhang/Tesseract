# Project Canopy Gate 1: Actor System Package Consolidation Plan

Status: `completed`

Last updated: 2026-06-29

Parent plan:

```text
docs/project-canopy-package-consolidation-plan.md
```

Preconditions:

```text
docs/project-canopy-gate-0-package-graph-baseline-plan.md
```

Gate 1 started only after:

- Gate 0 is committed.
- Gate 0 closure and this Gate 1 plan are committed as a separate checkpoint.
- The worktree is clean before any package files are moved.

## Goal

Merge the three small actor foundation packages into one coherent
`actor-system` package with explicit submodule exports:

```text
actor-system/core
actor-system/input
actor-system/gizmo
```

The old packages must be deleted in the same gate:

```text
packages/actor-core
packages/actor-input
packages/gizmo-core
```

No compatibility packages, compatibility exports, or old-name re-export barrels
are allowed.

## Non-Goals

- Do not change actor/component runtime semantics.
- Do not move UI framework, editor, runtime, or app product code into
  `actor-system`.
- Do not merge runtime packages.
- Do not create a broad `actor-system` root barrel for production use.
- Do not leave old package folders in place as migration shims.

## Target Package Shape

Create:

```text
packages/actor-system
```

Move source into:

```text
packages/actor-system/src/core
packages/actor-system/src/input
packages/actor-system/src/gizmo
```

The package should use the same simple build/test style as the existing actor
packages:

```json
{
  "name": "actor-system",
  "version": "0.1.0",
  "type": "module",
  "sideEffects": false,
  "files": [
    "dist/**/*.js",
    "dist/**/*.js.map",
    "dist/**/*.d.ts",
    "dist/**/*.d.ts.map"
  ],
  "exports": {
    "./core": {
      "types": "./dist/core/index.d.ts",
      "import": "./dist/core/index.js"
    },
    "./input": {
      "types": "./dist/input/index.d.ts",
      "import": "./dist/input/index.js"
    },
    "./gizmo": {
      "types": "./dist/gizmo/index.d.ts",
      "import": "./dist/gizmo/index.js"
    }
  },
  "scripts": {
    "test": "vitest run --passWithNoTests src",
    "typecheck": "tsc --noEmit -p tsconfig.json",
    "build": "tsc -p tsconfig.json"
  }
}
```

Gate 1 should start with no package root export. If a root export becomes
necessary, stop and revise the plan with a reviewed allowlist. The root export
must never become a replacement for `core`, `input`, and `gizmo` submodules.

## Step 0: Baseline Check

Actions:

1. Confirm clean worktree.
2. Run the Gate 0 boundary baseline:

```text
npm run test -w wallpaper-tesseract -- architecture-boundaries
```

3. Confirm Gate 0 helper files exist:

```text
apps/wallpaper-tesseract/src/test-support/package-graph-boundaries.ts
```

Exit:

- Worktree is clean.
- Gate 0 boundary tests pass.

Stop:

- If Gate 0 tests fail, fix Gate 0 before moving package files.

## Step 1: Create `packages/actor-system`

Actions:

1. Add `packages/actor-system/package.json`.
2. Add `packages/actor-system/tsconfig.json`.

The new `tsconfig.json` must exclude test files from package build output:

```json
{
  "include": ["src"],
  "exclude": ["src/**/*.test.ts"]
}
```

Tests may live under `src/**`, matching the moved actor package style, but
`tsc -p packages/actor-system/tsconfig.json` must not compile Vitest files into
`dist`.

3. Add source directories:

```text
packages/actor-system/src/core
packages/actor-system/src/input
packages/actor-system/src/gizmo
```

4. Do not add a root `src/index.ts` unless a reviewed root export decision is
   made. Submodule `index.ts` files come from the moved packages.

Exit:

- `npm run build -w actor-system` can run after source moves.
- No other package imports `actor-system` yet.

## Step 2: Move Source And Tests

Actions:

1. Move actor core source and tests:

```text
packages/actor-core/src/* -> packages/actor-system/src/core/*
```

2. Move actor input source and tests:

```text
packages/actor-input/src/* -> packages/actor-system/src/input/*
```

3. Move gizmo source:

```text
packages/gizmo-core/src/* -> packages/actor-system/src/gizmo/*
```

4. Move gizmo tests into the new package test tree:

```text
packages/gizmo-core/test/gizmo-event-system.test.ts
  -> packages/actor-system/src/gizmo/gizmo-event-system.test.ts
```

5. Preserve test names where practical so reviewers can map old coverage to new
   submodules.

Exit:

- Old package source folders are empty or removed.
- Actor-system submodule directories contain all former source and tests.

## Step 3: Rewrite Actor-System Internal Imports

Actions:

1. Inside `packages/actor-system/src/input`, replace imports from old package
   names with internal submodule imports:

```text
actor-core -> ../core
gizmo-core -> ../gizmo
```

2. Inside `packages/actor-system/src/core`, no imports may point to `../input`,
   `../gizmo`, or `actor-system`.
3. Inside `packages/actor-system/src/gizmo`, no imports may point to `../core`,
   `../input`, or `actor-system`.
4. Inside `packages/actor-system/src/input`, imports from `../core` and
   `../gizmo` are allowed; imports from `actor-system` root are forbidden.
5. Keep package-internal imports relative. External consumers use
   `actor-system/core`, `actor-system/input`, and `actor-system/gizmo`.

Exit:

- `rg "actor-core|actor-input|gizmo-core" packages/actor-system/src` returns no
  production import path that refers to old package names.
- Gate 0 future submodule rules can be applied to real actor-system files.

## Step 4: Rewrite Workspace Consumer Imports

Actions:

1. Replace imports in all packages and apps:

```text
from "actor-core"  -> from "actor-system/core"
from "actor-input" -> from "actor-system/input"
from "gizmo-core"  -> from "actor-system/gizmo"
```

2. Update app-local barrels:

```text
apps/wallpaper-tesseract/src/actor-runtime/index.ts
apps/wallpaper-tesseract/src/gizmo-runtime/index.ts
```

3. Do not introduce root imports from `actor-system`.
4. Keep historical text in completed Prism docs only when it clearly describes
   old phases. Current architecture docs and tests must use the new names.

Exit:

- Production and test source have no imports from old package names.
- Any remaining old package names are historical docs or temporary Gate 1
  fixture expectations with explicit comments.

## Step 5: Update Package Manifests, Lockfile, And Scripts

Actions:

1. Add `actor-system` dependency where consumers previously depended on
   `actor-core`, `actor-input`, or `gizmo-core`.
2. Remove old actor package dependencies:

```text
actor-core
actor-input
gizmo-core
```

3. Update root scripts:

```text
npm run build -w actor-system
npm run test -w actor-system
npm run typecheck -w actor-system
```

Remove root script steps for:

```text
actor-core
actor-input
gizmo-core
```

4. Update package-lock after manifest changes:

```text
npm install --package-lock-only
```

5. Update TypeScript project references. At minimum inspect and update:

```text
apps/wallpaper-tesseract/tsconfig.json
packages/ui-framework/tsconfig.json
packages/editor/tsconfig.json
packages/wallpaper-runtime/tsconfig.json
```

The old `packages/actor-input/tsconfig.json` is deleted with the package. Any
reference to `packages/actor-core`, `packages/actor-input`, or
`packages/gizmo-core` must be removed or replaced by `packages/actor-system`
where the consumer still needs the actor package in its project graph.

6. Verify no workspace manifest or tsconfig still names deleted packages.

Exit:

- `package.json` root scripts use `actor-system`.
- Consumers depend on `actor-system`, not old actor packages.
- Lockfile matches workspace package layout.
- No `tsconfig*.json` file references deleted actor packages.

## Step 6: Delete Old Packages

Actions:

1. Delete:

```text
packages/actor-core
packages/actor-input
packages/gizmo-core
```

2. Do not leave package directories containing `package.json`, `src`, `dist`, or
   re-export files.
3. Remove old generated/dist artifacts with the packages.

Exit:

- `Test-Path packages/actor-core`, `packages/actor-input`, and
  `packages/gizmo-core` all return false.
- `git status` shows deletions, not compatibility replacements.

## Step 7: Flip Canopy Package Graph And Boundary Tests

Actions:

1. Update `workspacePackageDescriptors`:

```text
remove actor-core
remove actor-input
remove gizmo-core
add actor-system
```

2. Update package graph baseline in `docs/current-project-progress.md`.
3. Update package dependency rules:
   - `actor-system` may not import UI, editor, runtime, app, or math packages;
   - submodule rules define allowed internal dependencies.
4. Apply the future actor-system submodule rules to real production files under:

```text
packages/actor-system/src/core
packages/actor-system/src/input
packages/actor-system/src/gizmo
```

5. Keep fixture tests for relative bypass behavior. They protect the evaluator
   from regressing.
6. Update tests that currently reference `actorInputPackageSources`,
   `actor-core-candidate`, or old package targets so current architecture facts
   use actor-system language.

Exit:

- `npm run test -w wallpaper-tesseract -- architecture-boundaries` passes.
- Boundary failures name actor-system submodules, not deleted package names.
- Old package names are absent from current package graph descriptors.

## Step 8: Update Stable Documentation

Actions:

1. Update `AGENTS.md` stable architecture direction:
   - `actor-system/core` replaces `actor-core` as the minimal core submodule;
   - `actor-system/input` replaces `actor-input`;
   - `actor-system/gizmo` replaces `gizmo-core`;
   - preserve the rule that core/gizmo are framework-agnostic and actor input
     remains separate from core semantics.
2. Update `docs/current-project-progress.md`:
   - package list;
   - source topology;
   - verification commands;
   - Canopy Gate 1 completion status when done.
3. Update active docs/tests that use old package names as current architecture
   facts. Historical Prism phase records may mention old packages as history.

Exit:

- New handoff agents reading `AGENTS.md` and current progress see actor-system
  terminology, not old package names.

## Step 9: Validation

Targeted validation during migration:

```text
npm run build -w actor-system
npm run test -w actor-system
npm run typecheck -w actor-system
npm run test -w ui-framework
npm run test -w editor
npm run test -w wallpaper-runtime
npm run test -w wallpaper-tesseract -- architecture-boundaries
npm run typecheck -w wallpaper-tesseract
```

Final validation:

```text
npm run test
npm run typecheck
npm run build
```

Gate 1 changes package exports and app import resolution across the workspace.
After root validation, run the current Arbor theme browser smoke rather than
relying on compile-time resolution alone:

```text
npm run prism:smoke:prepare
npm run dev -w wallpaper-tesseract
node apps/wallpaper-tesseract/scripts/run-project-arbor-gate-7-theme-smoke.mjs
$env:PROJECT_ARBOR_GATE_7_THEME_SMOKE_EVIDENCE="temp/project-arbor-gate-7-theme-smoke-data.json"; npm run test -w wallpaper-tesseract -- project-arbor-gate-7-theme-smoke-contract
```

## Exit Criteria

Gate 1 is complete only when:

- `packages/actor-system` exists and builds/tests/typechecks.
- `packages/actor-core`, `packages/actor-input`, and `packages/gizmo-core` are
  deleted.
- No production or test import points at old actor package names.
- No workspace manifest depends on old actor package names.
- No `tsconfig*.json` file references old actor package paths.
- Root scripts no longer build/test/typecheck old actor packages.
- Gate 0 package graph tests pass with `actor-system`.
- Real actor-system submodule boundary tests are active, not only fixture tests.
- `AGENTS.md` and `docs/current-project-progress.md` use current actor-system
  terminology.
- The old package name grep covers:

```text
package.json
package-lock.json
packages/**/package.json
apps/**/package.json
**/tsconfig*.json
packages/**/src
apps/**/src
AGENTS.md
docs/current-project-progress.md
docs/project-canopy-*.md
```

Historical Prism/Arbor records may mention old names only as completed history,
not as current package facts.

- Root `test`, `typecheck`, and `build` pass.
- Current Arbor theme browser smoke is regenerated and validated.

## Stop Conditions

Stop and revise the plan if:

- TypeScript cannot resolve subpath exports without adding compatibility aliases
  for old package names.
- `actor-system/core` or `actor-system/gizmo` needs UI/editor/runtime/app code.
- A root `actor-system` export becomes necessary for production code.
- Package graph tests reveal a real dependency cycle after manifest updates.
- The migration starts requiring unrelated UI/runtime/editor refactors.

## Completion Record

Completed on 2026-06-29.

Implemented outcome:

- `packages/actor-system` owns the former actor core, actor input, and gizmo
  source under `src/core`, `src/input`, and `src/gizmo`.
- The package exposes only explicit `./core`, `./input`, and `./gizmo`
  submodule exports. It has no production root export.
- `packages/actor-core`, `packages/actor-input`, and `packages/gizmo-core` were
  deleted rather than retained as compatibility packages.
- Workspace imports, package manifests, lockfile, root scripts, and tsconfig
  references now use `actor-system`.
- Boundary tests enforce both package graph rules and real actor-system
  submodule direction.

Validated with:

```text
npm run build -w actor-system
npm run test -w actor-system
npm run typecheck -w actor-system
npm run test -w wallpaper-tesseract -- architecture-boundaries project-prism-boundary-report
npm run test -w ui-framework
npm run test -w editor
npm run test -w wallpaper-runtime
npm run typecheck:test -w ui-framework
npm run test
npm run typecheck
npm run build
npm run prism:smoke:prepare
node apps/wallpaper-tesseract/scripts/run-project-arbor-gate-7-theme-smoke.mjs
$env:PROJECT_ARBOR_GATE_7_THEME_SMOKE_EVIDENCE="temp/project-arbor-gate-7-theme-smoke-data.json"; npm run test -w wallpaper-tesseract -- project-arbor-gate-7-theme-smoke-contract
```

`npm run build` retains the existing Vite chunk size warning.

## Commit Boundary

Commit Gate 1 as a single package consolidation checkpoint after validation.
The commit should not include unrelated feature work.
