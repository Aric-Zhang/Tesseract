# Project Canopy Gate 0: Package Graph Baseline Plan

Status: `complete`

Last updated: 2026-06-29

Parent plan:

```text
docs/project-canopy-package-consolidation-plan.md
```

## Goal

Gate 0 prepares the repository for package consolidation without moving any
package files. It must turn the current package graph and future submodule
boundaries into executable tests before Gate 1 removes physical package
boundaries between `actor-core`, `actor-input`, and `gizmo-core`.

This gate is deliberately about facts, tests, and checkpoint hygiene. It must
not create `packages/actor-system`, change package names, rewrite imports, or
add compatibility barrels.

## Current Facts

- `apps/wallpaper-tesseract/src/architecture-boundaries.test.ts` already has a
  production import declaration check named
  `keeps workspace package production imports declared in package manifests`.
- That check hardcodes package directories in the test body. It catches
  undeclared workspace imports today, but it is not yet a reusable package graph
  fixture for Canopy.
- Current boundary tests do not yet make package graph cycles a first-class
  failing assertion.
- Current boundary tests do not yet describe post-merge actor submodule rules
  such as `actor-system/core` not importing `actor-system/input` or
  `actor-system/gizmo`.
- Current static edge data includes resolved relative imports through
  `resolvedFile`; Gate 0 must use that resolved file information for owner and
  submodule checks instead of relying only on bare import specifiers.
- Project Arbor is complete. The working tree may still contain the Arbor
  closure cleanup and Canopy planning changes; those must be checkpointed before
  Gate 0 implementation begins.

## Non-Goals

- Do not move package source files.
- Do not rename package imports.
- Do not add `actor-system`.
- Do not modify `AGENTS.md` yet; that belongs to Gate 1 when package names
  actually change.
- Do not introduce a new external dependency graph tool unless the existing
  static import scanner cannot express the checks.
- Do not keep a docs-only graph report as the authority. Tests must be the
  authority; reports may be generated from the same facts.

## Expected New Or Changed Files

Preferred implementation shape:

```text
apps/wallpaper-tesseract/src/test-support/package-graph-boundaries.ts
apps/wallpaper-tesseract/src/test-support/package-graph-boundaries.test.ts
```

or, if keeping all architecture checks in one file is cleaner:

```text
apps/wallpaper-tesseract/src/architecture-boundaries.test.ts
apps/wallpaper-tesseract/src/test-support/package-graph-boundaries.ts
```

Use the existing scanner from:

```text
apps/wallpaper-tesseract/src/test-support/architecture-boundaries.ts
```

Do not duplicate static import parsing logic.

## Step 0: Arbor Closure Checkpoint

Purpose: keep Arbor closure and Canopy package moves separable.

Actions:

1. Confirm the current worktree contains only intended Arbor closure cleanup and
   Canopy planning changes.
2. Run root validation:

```text
npm run test
npm run typecheck
npm run build
```

3. Commit the Arbor closure and Canopy plan before implementing Gate 0.

Exit:

- Worktree is clean.
- Project Arbor is closed in `docs/current-project-progress.md`.
- `docs/project-canopy-package-consolidation-plan.md` is present.
- `docs/project-canopy-gate-0-package-graph-baseline-plan.md` is present.

Stop:

- If root validation fails due to the Arbor cleanup, fix that first and do not
  begin Gate 0 implementation.

## Step 1: Centralize Workspace Package Facts

Purpose: remove hardcoded package-directory lists from individual tests so the
graph can be reused by cycle, undeclared import, and Canopy submodule checks.

Implementation requirements:

1. Define a package descriptor type similar to:

```ts
interface WorkspacePackageDescriptor {
  readonly name: string;
  readonly directory: string;
  readonly sourceRoot: string;
  readonly manifestPath: string;
  readonly zone:
    | "actor"
    | "ui"
    | "runtime"
    | "editor"
    | "app"
    | "math";
}
```

2. Describe the current packages explicitly:

```text
actor-core
actor-input
gizmo-core
ui-framework
runtime-core
runtime-three
wallpaper-runtime
editor
four-rotation
four-camera
four-camera-three
wallpaper-tesseract
```

3. Read each package's `package.json` through the descriptor. Do not maintain
   dependency facts separately from manifests.
4. Expose helpers that return:
   - workspace package descriptors;
   - workspace package name set;
   - production source files per package;
   - production module edges per package;
   - manifest dependency names per package.
5. Add a single production-source filter helper, for example
   `isProductionSourceFile(path)`, and reuse it in every package graph check.
   The helper should:
   - include package/app `src/**/*.ts` production source;
   - exclude `*.test.ts`;
   - exclude `src/test-support/**` unless a specific future production package
     intentionally ships that folder;
   - exclude generated/build output and non-source files.
   Do not let undeclared import, zone dependency, and submodule checks each
   define their own filtering rules.

Tests:

- Every descriptor points to an existing manifest.
- Every descriptor's manifest `name` matches its descriptor `name`.
- Every package manifest under `packages/*` and `apps/*` that is part of this
  product workspace is represented by exactly one descriptor.

Exit:

- `architecture-boundaries.test.ts` no longer owns a one-off package directory
  list for undeclared import checking.

## Step 2: Keep Undeclared Workspace Import Check As A Hard Gate

Purpose: preserve the existing useful check while making it reusable and ready
for package moves.

Implementation requirements:

1. Reuse `listModuleEdges(...)` and `barePackageName(...)` behavior from the
   existing architecture boundary scanner.
2. Scan production source only through the shared `isProductionSourceFile(...)`
   helper from Step 1.
3. For each bare workspace package import, assert the imported package is listed
   in `dependencies` or `peerDependencies` unless it is the same package.
4. Keep the failure message specific:

```text
<package-name>: <from-file> imports undeclared <imported-package>
```

Tests:

- Current repository returns `[]`.
- Add a focused unit test for the helper using an in-memory graph fixture:
  - declared import passes;
  - undeclared import fails;
  - self import is ignored;
  - non-workspace package import is ignored.

Exit:

- `npm run test -w wallpaper-tesseract -- architecture-boundaries` proves
  undeclared workspace imports are still clean.

## Step 3: Add Package Cycle Detection

Purpose: make "workspace package graph has no cycles" executable before package
boundaries change.

Implementation requirements:

1. Build package-level cycle edges from `package.json` `dependencies` and
   `peerDependencies`. This is the cycle truth source because package manager
   resolution, build order, and workspace install behavior are controlled by
   manifests even when source currently happens not to import a dependency.
2. Use production import edges for undeclared import and forbidden owner checks,
   not as the primary cycle source.
3. Only workspace package names participate in cycle detection.
4. Report the full cycle path in deterministic order.
5. Keep this as a hard failing test. No allowlist should be needed for current
   graph.

Tests:

- Current package graph has no cycles.
- In-memory fixture detects:
  - direct `a -> a` cycle;
  - two-package `a -> b -> a` cycle;
  - longer `a -> b -> c -> a` cycle;
  - acyclic diamond graph as clean.

Exit:

- A package cycle introduced by later Gate 1 import moves would fail before
  root build/typecheck.

## Step 4: Add Current Zone Dependency Rules

Purpose: keep package consolidation from weakening high-level ownership.

Rules to lock now:

- `actor-core` production source imports no `actor-input`, `gizmo-core`,
  `ui-framework`, `editor`, `runtime-core`, `runtime-three`,
  `wallpaper-runtime`, or app-local code.
- `gizmo-core` production source imports no `actor-core`, `actor-input`,
  `ui-framework`, `editor`, runtime packages, or app-local code.
- `actor-input` may import `actor-core` and `gizmo-core`, but not
  `ui-framework`, `editor`, runtime packages, or app-local code.
- `ui-framework` may import `actor-core` and `actor-input`, but not `editor`,
  `wallpaper-runtime`, `runtime-core`, `runtime-three`, app-local features, or
  product Scene/Tesseract/Camera3 code.
- `runtime-core` imports no UI/editor/app/product runtime owners.
- `runtime-three` may import `runtime-core`, `four-camera`,
  `four-camera-three`, and `three`, but not editor/UI/app code.
- `wallpaper-runtime` may import actor/runtime/math packages, but not editor,
  app-local features, `ui-framework`, or DOM/window ownership.
- `editor` may import actor/input/UI/runtime contracts as already accepted, but
  not app-local runtime/app composition/window-runtime internals.

Implementation requirements:

1. Use package descriptors and production edges.
2. Keep rules data-backed, not scattered as one-off `expect(...).not.toMatch`
   assertions.
3. Failure messages should name the importing package, imported package, and
   source file.
4. Rules must inspect both:
   - bare package imports, via imported workspace package name; and
   - resolved relative imports, via `resolvedFile` mapped back to a package or
     source zone.
   Do not allow a relative path such as `../../apps/wallpaper-tesseract/src/...`
   or `../runtime/...` to bypass the same rule that would reject the equivalent
   package import.

Exit:

- These rules pass for the current graph.
- The rule set can be mechanically renamed in Gate 1 to
  `actor-system/core`, `actor-system/input`, and `actor-system/gizmo` rules.

## Step 5: Add Future Actor-System Submodule Rule Fixtures

Purpose: make the future internal boundaries testable before the physical merge
removes old package folders.

Implementation requirements:

1. Define planned submodules:

```text
actor-system/core
actor-system/input
actor-system/gizmo
```

2. Define the post-Gate-1 rules:
   - `actor-system/core` imports no `actor-system/input` or
     `actor-system/gizmo`.
   - `actor-system/gizmo` imports no `actor-system/core` or
     `actor-system/input`.
   - `actor-system/input` may import `actor-system/core` and
     `actor-system/gizmo`.
   - `actor-system/core`, `actor-system/input`, and `actor-system/gizmo` do not
     import `actor-system` root. The root export is a consumer surface, not an
     internal dependency path.
   - none of the actor-system submodules import UI/editor/runtime/app code.
3. The evaluator must be based on source zone and `resolvedFile`, not only on
   import specifier text. It must catch all of these future violations:
   - `actor-system/core` importing `actor-system/input`;
   - `actor-system/core` importing `../input`;
   - `actor-system/core` importing `../input/foo`;
   - `actor-system/input` importing `actor-system` root;
   - `actor-system/gizmo` importing `../../input/foo`;
   - any actor-system submodule importing UI/editor/runtime/app code through a
     relative path.
4. Add fixture tests using synthetic file paths to prove the rule evaluator can
   distinguish submodules inside the same package and catch resolved relative
   cross-submodule imports.
5. Do not apply these rules to current production files until Gate 1 creates
   `packages/actor-system`.

Exit:

- Gate 1 has a ready test helper for internal submodule forbidden imports.
- If the helper cannot distinguish same-package submodule ownership, stop here
  and redesign the evaluator.

## Step 6: Generate Or Record Baseline Package Graph

Purpose: leave a clear baseline for reviewers and future agents.

Preferred option:

- Add a small test-support function that produces a deterministic package graph
  summary from descriptors and manifests.
- Use it in a test snapshot or explicit expected object.

Acceptable option:

- Record the current graph in `docs/current-project-progress.md` under the
  Project Canopy section, with a note that tests are the source of truth.

Current expected manifest graph:

```text
actor-core -> []
gizmo-core -> []
actor-input -> [actor-core, gizmo-core]
ui-framework -> [actor-core, actor-input]
runtime-core -> []
runtime-three -> [four-camera, four-camera-three, runtime-core]
wallpaper-runtime -> [actor-core, four-camera, four-rotation, runtime-core, runtime-three]
editor -> [actor-core, actor-input, gizmo-core, runtime-core, ui-framework]
four-rotation -> []
four-camera -> [four-rotation]
four-camera-three -> [four-camera]
wallpaper-tesseract -> [actor-core, actor-input, editor, gizmo-core, runtime-core, runtime-three, ui-framework, wallpaper-runtime]
```

Exit:

- The baseline graph is visible to reviewers.
- If the graph changes during Gate 0, the change is explained by code reality,
  not by planning drift.

## Step 7: Update Progress Documentation

Purpose: make Gate 0 status discoverable.

Update:

```text
docs/current-project-progress.md
```

Required content:

- Gate 0 is the active Canopy gate.
- Gate 0 does not move packages.
- Gate 0's exit condition is package graph and submodule-boundary tests passing.
- Gate 1 must not begin until the Arbor closure checkpoint and Gate 0 baseline
  are committed.

Do not update `AGENTS.md` in Gate 0 unless the implementation reveals a stable
architecture rule unrelated to package names.

## Validation Matrix

Targeted checks during implementation:

```text
npm run test -w wallpaper-tesseract -- architecture-boundaries
npm run typecheck -w wallpaper-tesseract
```

Root checks before Gate 0 closure:

```text
npm run test
npm run typecheck
npm run build
```

No browser smoke is required for Gate 0 because no runtime, UI, CSS, or package
entry behavior should change.

## Exit Criteria

Gate 0 is complete only when:

- Arbor closure is committed separately.
- Package graph descriptors exist and cover current workspace packages.
- Undeclared workspace import check is data-backed and passes.
- Package cycle detection exists and passes.
- Current package zone dependency rules exist and pass.
- Future actor-system submodule rule fixtures exist and prove the evaluator can
  enforce boundaries after Gate 1.
- `docs/current-project-progress.md` points to this Gate 0 plan as active or
  completed, depending on execution status.
- Root `test`, `typecheck`, and `build` pass.

## Stop Conditions

Stop and revise the plan if:

- The current package graph already has a real cycle or undeclared import.
- Boundary helpers cannot distinguish same-package submodules.
- Enforcing current package rules would require allowlisting a production
  dependency that contradicts AGENTS architecture direction.
- The work starts requiring package moves or import rewrites; that belongs to
  Gate 1.

## Handoff Notes For Gate 1

Gate 1 may start only after Gate 0 is committed. Gate 1 should reuse the Gate 0
helpers instead of writing new import scanners. The first Gate 1 code change
should be creating `packages/actor-system` and moving source into the submodule
shape that Gate 0 already knows how to validate.

## Completion Record

Implemented on 2026-06-29.

Production code was not changed. Gate 0 added the reusable package graph helper
at:

```text
apps/wallpaper-tesseract/src/test-support/package-graph-boundaries.ts
```

and strengthened:

```text
apps/wallpaper-tesseract/src/architecture-boundaries.test.ts
apps/wallpaper-tesseract/src/test-support/architecture-boundaries.ts
```

Locked checks:

- workspace package descriptors cover every current workspace package;
- production source filtering is centralized through `isProductionSourceFile`;
- undeclared workspace imports remain a hard gate;
- manifest dependency cycles are a hard gate;
- current package zone dependency rules cover bare imports and resolved relative
  imports;
- every non-app workspace package is covered by a package dependency rule unless
  explicitly exempted;
- future `actor-system/core`, `actor-system/input`, and `actor-system/gizmo`
  submodule fixtures catch bare subpath imports, root import bypasses, and
  relative cross-submodule imports.

Validation:

```text
npm run test -w wallpaper-tesseract -- architecture-boundaries
npm run typecheck -w wallpaper-tesseract
npm run test
npm run typecheck
npm run build
```
