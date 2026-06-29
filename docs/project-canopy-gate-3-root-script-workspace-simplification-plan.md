# Project Canopy Gate 3: Root Script And Workspace Simplification

Status: completed
Last updated: 2026-06-29

Completion note: Gate 3 was executed while the completed Gate 2 changes were
still uncommitted. Treat the current worktree as a combined Gate 2 + Gate 3
checkpoint until it is committed.

Final root script shape:

```text
npm run test                 -> node scripts/run-workspace-sequence.mjs test
npm run typecheck            -> node scripts/run-workspace-sequence.mjs typecheck
npm run build                -> node scripts/run-workspace-sequence.mjs build
npm run prism:smoke:prepare  -> node scripts/run-workspace-sequence.mjs prism:smoke:prepare
```

The sequence facts live in `scripts/workspace-sequence-config.mjs`; the
executable wrapper is `scripts/run-workspace-sequence.mjs`. The config has no
side effects and is imported by boundary tests.

Gate 3 makes the root workspace commands match the package shape produced by
Canopy Gates 1 and 2. It does not move packages, change runtime behavior, add
compatibility aliases, or rename public exports. The goal is to delete repeated
root-script command chains and keep package order as one explicit operational
fact.

## Current Facts

- Gate 1 consolidated the old actor foundation packages into
  `packages/actor-system`.
- Gate 2 removed the broad `ui-framework` root export and split UI definition
  installation by owner.
- Root `package.json` still contains long repeated command chains for:
  - `test`
  - `typecheck`
  - `build`
  - `prism:smoke:prepare`
- Those chains already reference the current package names, but they duplicate
  the workspace order several times.
- The current root build order is:

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

- `prism:smoke:prepare` intentionally builds only dependency packages through
  `editor`; it does not build the app.
- `build:wallpaper`, `dev`, and `prism:phase0:report` are not duplicated
  workspace chains and should not be rewritten unless execution proves they are
  stale.

## Non-Negotiables

- Do not reintroduce old package names: `actor-core`, `actor-input`, or
  `gizmo-core`.
- Do not create compatibility npm scripts for removed package names.
- Do not add another package graph solver. Gate 0 already owns package graph
  validation; Gate 3 only needs a small execution helper if it removes repeated
  root command text.
- Do not infer build order dynamically from imports at runtime. Keep the order
  explicit and easy to inspect.
- Do not change package public exports, package dependencies, TypeScript
  references, UI behavior, runtime behavior, or browser smoke contracts.
- If root scripts become longer or harder to understand, stop and simplify the
  plan before implementing.

## Target Shape

The preferred Gate 3 result is:

```json
{
  "scripts": {
    "test": "node scripts/run-workspace-sequence.mjs test",
    "typecheck": "node scripts/run-workspace-sequence.mjs typecheck",
    "build": "node scripts/run-workspace-sequence.mjs build",
    "build:wallpaper": "npm run build -w wallpaper-tesseract",
    "prism:smoke:prepare": "node scripts/run-workspace-sequence.mjs prism:smoke:prepare"
  }
}
```

Use a different command spelling only if implementation proves a simpler shape.
Do not add a broad task runner dependency.

## Step 0: Entry Gate

Before editing:

1. Prefer committing the completed Gate 2 checkpoint before starting Gate 3.
   Gate 2 changed public `ui-framework` imports and package exports; Gate 3
   changes root scripts and validation plumbing. Keeping them in separate Git
   checkpoints prevents later failures from being misattributed.
2. If Gate 2 is intentionally not committed, record in the Gate 3 completion
   notes that the worktree contains a combined "Gate 2 + Gate 3" checkpoint,
   and keep Gate 3 edits limited to root scripts, the workspace-sequence helper,
   boundary tests, and active docs.
3. Confirm root validation passed after Gate 2:

```text
npm run test
npm run typecheck
npm run build
npm run prism:smoke:prepare
```

4. Confirm production root `ui-framework` imports remain 0:

```text
rg 'from "ui-framework"|export \* from "ui-framework"|export \{[^\n]*\} from "ui-framework"' apps packages -n --glob '!**/dist/**' --glob '!**/node_modules/**'
```

Expected: no output.

5. Confirm `packages/ui-framework/package.json` still has no `"."` export.

Stop if Gate 2 is dirty in a way that needs review or if root validation is
already failing before Gate 3 changes.

## Step 1: Audit Root Scripts

Record the current root scripts before changing them:

```text
node -e "const p=require('./package.json'); console.log(p.scripts)"
```

Confirm:

- `test` builds and tests every dependency package, then tests
  `wallpaper-tesseract`.
- `typecheck` typechecks and builds each dependency package, then typechecks
  `wallpaper-tesseract`.
- `build` builds all workspaces including `wallpaper-tesseract`.
- `prism:smoke:prepare` builds dependency packages only through `editor`.

Do not preserve accidental duplication. Preserve only the command semantics
above.

## Step 2: Add A Minimal Workspace Sequence Runner

Create a side-effect-free config module and a tiny executable runner:

```text
scripts/workspace-sequence-config.mjs
scripts/run-workspace-sequence.mjs
```

`scripts/workspace-sequence-config.mjs` owns the operational sequence facts:

- `WORKSPACE_ORDER`;
- a `SEQUENCES` matrix for `test`, `typecheck`, `build`, and
  `prism:smoke:prepare`;
- no process spawning, filesystem writes, or command execution.

`scripts/run-workspace-sequence.mjs` owns execution only. It imports the config
and should be intentionally small:

- execute commands with `npm.cmd` on Windows and `npm` elsewhere;
- stream stdio;
- exit non-zero on the first failed command;
- print the workspace and script being run before each command;
- avoid shell string concatenation for command execution.

The runner must have a main guard. Importing either file from a test must not
run npm commands. Acceptable patterns include comparing
`import.meta.url` with `pathToFileURL(process.argv[1]).href`, or keeping all
test imports pointed at the side-effect-free config module only.

Recommended semantics:

- `build`:
  - run `npm run build -w <workspace>` for every workspace in order, including
    `wallpaper-tesseract`.
- `test`:
  - for every library/package workspace before `wallpaper-tesseract`, run
    `build` then `test`;
  - for `wallpaper-tesseract`, run `test` only.
- `typecheck`:
  - for every library/package workspace before `wallpaper-tesseract`, run
    `typecheck` then `build`;
  - for `wallpaper-tesseract`, run `typecheck` only.
- `prism:smoke:prepare`:
  - run `build` for `actor-system`, `ui-framework`, `runtime-core`,
    `four-rotation`, `four-camera`, `four-camera-three`, `runtime-three`,
    `wallpaper-runtime`, and `editor`;
  - do not build `wallpaper-tesseract`.

The runner should not read app source code, package graph test-support code, or
TypeScript source. Keep it a root operational helper, not a second architecture
model.

## Step 3: Replace Root Script Chains

Update root `package.json`:

- replace the long `test`, `typecheck`, `build`, and `prism:smoke:prepare`
  script chains with the new runner commands;
- keep `dev`, `build:wallpaper`, and `prism:phase0:report` unless they are
  proven stale;
- do not add scripts for old package names;
- do not add compatibility aliases for old commands.

Exit check:

```text
node -e "const p=require('./package.json'); for (const k of ['test','typecheck','build','prism:smoke:prepare']) console.log(k+': '+p.scripts[k])"
```

Expected: each command uses `scripts/run-workspace-sequence.mjs`.

## Step 4: Lock The Script Shape With Boundary Tests

Extend the existing architecture boundary tests rather than adding a separate
test framework.

Recommended checks in:

```text
apps/wallpaper-tesseract/src/architecture-boundaries.test.ts
```

Add tests that verify:

- root `package.json` scripts for `test`, `typecheck`, `build`, and
  `prism:smoke:prepare` call `scripts/run-workspace-sequence.mjs`;
- root scripts do not mention `actor-core`, `actor-input`, or `gizmo-core`;
- the runner workspace order exactly matches the current package graph order:

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

- the runner has no removed package names;
- the sequence matrix exactly preserves command semantics:
  - `test`: every library/package workspace before `wallpaper-tesseract` runs
    `build` then `test`; `wallpaper-tesseract` runs `test` only;
  - `typecheck`: every library/package workspace before `wallpaper-tesseract`
    runs `typecheck` then `build`; `wallpaper-tesseract` runs `typecheck` only;
  - `build`: every workspace, including `wallpaper-tesseract`, runs `build`;
  - `prism:smoke:prepare`: every dependency workspace through `editor` runs
    `build`, and `wallpaper-tesseract` is excluded;
- the root scripts do not call package-specific build/test chains directly for
  the consolidated package set.

Implementation note: prefer importing `WORKSPACE_ORDER` and `SEQUENCES` from
`scripts/workspace-sequence-config.mjs` in the test. Do not import an executable
runner unless the main guard is already tested or source-reviewed. Do not add a
heavyweight parser.

## Step 5: Active Documentation Cleanup

Update:

```text
docs/current-project-progress.md
docs/project-canopy-package-consolidation-plan.md
docs/project-canopy-gate-3-root-script-workspace-simplification-plan.md
```

Required updates:

- mark Gate 3 complete after validation;
- list the final root script command shape;
- keep the current package graph baseline;
- note that `prism:smoke:prepare` uses the same workspace sequence helper and
  intentionally excludes the app build;
- remove or reword any non-historical active-doc text that implies
  `actor-core`, `actor-input`, or `gizmo-core` still exist as workspace
  packages.
- clarify `docs/project-prism-engine-modularization-outline.md` status if it is
  still referenced as a north-star document: either mark its old
  `actor-core` / `actor-input` / `gizmo-core` terms as Prism-era historical
  terminology, or update the active package-fact passages to
  `actor-system/core|input|gizmo`.

Historical Prism/Arbor/Canopy plan files may mention old package names as
history. Do not rewrite historical records merely to make grep empty.

## Step 6: Validation

Targeted validation:

```text
npm run test -w wallpaper-tesseract -- architecture-boundaries
npm run prism:smoke:prepare
```

Root validation:

```text
npm run test
npm run typecheck
npm run build
```

Formatting:

```text
git diff --check
```

Browser smoke is not required by default because Gate 3 changes root command
execution only. If implementation touches app imports, CSS entries, package
exports, or Vite config unexpectedly, stop and run the current Arbor browser
smoke before closure:

```text
npm run prism:smoke:prepare
npm run dev -w wallpaper-tesseract
node apps/wallpaper-tesseract/scripts/run-project-arbor-gate-7-theme-smoke.mjs
$env:PROJECT_ARBOR_GATE_7_THEME_SMOKE_EVIDENCE="temp/project-arbor-gate-7-theme-smoke-data.json"; npm run test -w wallpaper-tesseract -- project-arbor-gate-7-theme-smoke-contract
```

## Exit Criteria

- Root scripts are short and delegate repeated workspace order to one helper.
- The workspace order appears in one operational place and is locked by
  boundary tests.
- `npm run test`, `npm run typecheck`, `npm run build`, and
  `npm run prism:smoke:prepare` preserve their pre-Gate-3 semantics.
- No removed package names appear in root scripts or active package facts.
- No package exports, dependencies, or TypeScript references change.
- Current progress documentation matches the filesystem and command shape.

## Stop Conditions

Stop and amend this plan if:

- the sequence runner needs to understand production import graphs;
- root scripts require package-specific special cases beyond the app exclusion
  already present in `test`, `typecheck`, and `prism:smoke:prepare`;
- simplifying scripts would hide a real dependency-order problem;
- package manifests or tsconfig references need to change;
- command behavior changes in a way that invalidates existing root validation
  expectations.

## Expected Result

Gate 3 should be a small cleanup gate. It should remove repeated command text,
not introduce a build system. The final code should make the current package
shape easier to operate and harder to accidentally drift from.
