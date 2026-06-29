# Project Canopy Gate 4: Runtime Consolidation Decision

Status: completed
Last updated: 2026-06-30

Decision: keep the current runtime/math package shape. Do not create a runtime
merge implementation plan. Evidence and candidate decisions are recorded in:

```text
docs/project-canopy-gate-4-runtime-consolidation-report.md
```

Gate 4 decides whether the remaining runtime/math package granularity should
stay as-is or become a follow-up consolidation plan. This is a decision gate,
not an implementation gate. It should produce evidence and a recorded decision;
it should not move packages, rewrite imports, or create compatibility aliases.

## Current Runtime Package Shape

Current runtime and math packages:

```text
runtime-core
runtime-three
wallpaper-runtime
four-rotation
four-camera
four-camera-three
```

Current package graph baseline:

```text
runtime-core -> []
four-rotation -> []
four-camera -> [four-rotation]
four-camera-three -> [four-camera]
runtime-three -> [four-camera, four-camera-three, runtime-core]
wallpaper-runtime -> [actor-system, four-camera, four-rotation, runtime-core, runtime-three]
```

Current ownership intent:

- `runtime-core` owns renderer-agnostic runtime contracts: ids, frames,
  scheduler, commands, queries, worlds, cameras, projection graph, and frame
  sources.
- `runtime-three` owns the Three/WebGL backend for runtime-core contracts.
- `wallpaper-runtime` owns product runtime behavior for this Wallpaper Engine
  app: runtime work attachment, Camera3 motion runtime, Tesseract4 runtime
  actor/renderable ownership, runtime Scene content, frame-source registration,
  and runtime Scene view registry.
- `four-rotation` owns pure 4D rotation math.
- `four-camera` owns 4D camera/projection model.
- `four-camera-three` owns the bridge between the 4D camera model and Three.js.

## Gate Output

Gate 4 must end with exactly one of these outcomes:

1. **Keep current runtime package shape.**
   - Update `docs/current-project-progress.md` with a decision record.
   - Mark Project Canopy package consolidation complete unless a separate
     reviewed cleanup item remains.

2. **Create a new implementation plan for a justified runtime consolidation.**
   - Do not perform the consolidation in Gate 4.
   - Add a detailed follow-up plan with owner boundaries, deletion steps,
     boundary tests, and validation.
   - Keep current packages untouched until that plan is reviewed.

The default decision is outcome 1. A merge is justified only if evidence shows
that package count now costs more maintenance than the boundary protection it
provides.

Gate 4 must always leave a durable decision artifact:

```text
docs/project-canopy-gate-4-runtime-consolidation-report.md
```

Do not bury the evidence only in `docs/current-project-progress.md`; progress
docs should summarize the decision and link to the report.

## Non-Negotiables

- Do not merge runtime packages during Gate 4.
- Do not add compatibility re-exports or alias packages.
- Do not create another broad runtime umbrella package merely for convenience.
- Do not move product runtime ownership into renderer-agnostic runtime code.
- Do not merge `wallpaper-runtime` into `runtime-core` or `runtime-three`
  without a separate reviewed implementation plan.
- Do not weaken current boundary tests to make a potential merge look easier.
- Do not use import count alone as merge justification. Ownership clarity and
  long-term maintenance cost matter more than raw import frequency.
- Prefer no change when the evidence is ambiguous.

## Step 0: Entry Gate

Before auditing:

1. Confirm Gate 2 and Gate 3 are committed.

```text
git status --short
git log --oneline -5
```

2. Confirm the current root sequence helper still works:

```text
npm run test -w wallpaper-tesseract -- architecture-boundaries
npm run prism:smoke:prepare
```

3. Confirm no old actor package names appear in root scripts or current package
   manifests:

```text
rg 'actor-core|actor-input|gizmo-core' package.json packages/*/package.json apps/*/package.json scripts -n
```

Expected: no output.

Stop if the worktree is dirty in unrelated areas, or if Gate 3 root command
behavior is failing before this decision gate starts.

## Step 1: Runtime Package Inventory

Produce a current inventory table for:

```text
runtime-core
runtime-three
wallpaper-runtime
four-rotation
four-camera
four-camera-three
```

For each package, record:

- package manifest dependencies and peer dependencies;
- public exports;
- source file count;
- test file count;
- independent `tests/` file count for packages that keep tests outside `src`;
- production importers from other workspaces;
- current boundary rules from `architecture-boundaries`;
- whether the package contains product-specific code, renderer-specific code,
  or pure math/contracts.

Suggested commands:

```text
node -e "const fs=require('fs'); for (const p of ['runtime-core','runtime-three','wallpaper-runtime','four-rotation','four-camera','four-camera-three']) { const j=JSON.parse(fs.readFileSync(`packages/${p}/package.json`, 'utf8')); console.log(p, { dependencies:j.dependencies||{}, peerDependencies:j.peerDependencies||{}, exports:j.exports }); }"
Get-ChildItem packages/runtime-core,packages/runtime-three,packages/wallpaper-runtime,packages/four-rotation,packages/four-camera,packages/four-camera-three -Recurse -File | Where-Object { $_.FullName -match '\\(src|tests)\\' } | ForEach-Object { $package = ($_.FullName -split '\\packages\\')[1].Split('\\')[0]; $bucket = if ($_.FullName -match '\\tests\\') { 'tests' } else { 'src' }; [pscustomobject]@{ Package = $package; Bucket = $bucket } } | Group-Object Package,Bucket | Select-Object Name,Count
```

Important: `four-rotation`, `four-camera`, and `four-camera-three` currently
have independent `tests/` directories. Do not judge these math packages by
`src/**/*.test.ts` counts alone.

Record the inventory in:

```text
docs/project-canopy-gate-4-runtime-consolidation-report.md
```

## Step 2: Ownership Boundary Audit

Audit whether current packages still protect real ownership boundaries.

Required checks:

1. `runtime-core` must remain renderer-agnostic:
   - no `three`;
   - no `editor`;
   - no `ui-framework`;
   - no app-local imports;
   - no `wallpaper-runtime`.

2. `runtime-three` must remain renderer backend code:
   - may import `runtime-core`, `four-camera`, `four-camera-three`, and `three`;
   - must not import `editor`, `ui-framework`, `wallpaper-runtime`, or app-local
     source.

3. `wallpaper-runtime` must remain product runtime owner:
   - may import reusable runtime/math packages and `actor-system`;
   - must not import editor, UI/window framework, app composition, DOM/window
     ownership, or feature presentation code.
   - direct `three` imports must be explicitly classified. Current manifests
     and source allow direct Three type usage in `wallpaper-runtime`; Gate 4
     must decide whether this is an acceptable product-runtime renderable/scene
     host contract, or a non-blocking cleanup to push further into
     `runtime-three`.

4. `four-rotation` and `four-camera` should stay pure math/model packages:
   - no Three.js, DOM, editor, UI, app, or wallpaper-runtime imports.

5. `four-camera-three` should remain the renderer bridge:
   - may depend on `four-camera` and `three`;
   - must not import app/editor/UI/wallpaper-runtime.

Suggested commands:

```text
rg 'from "(three|editor|ui-framework|wallpaper-runtime)"|from "\.\./\.\./' packages/runtime-core/src -n
rg 'from "(editor|ui-framework|wallpaper-runtime)"|apps/wallpaper-tesseract' packages/runtime-three/src -n
rg 'from "(editor|ui-framework)"|apps/wallpaper-tesseract|window-runtime|document|HTMLElement|Window' packages/wallpaper-runtime/src -n
rg 'from "three"' packages/wallpaper-runtime/src -n
rg 'from "(three|editor|ui-framework|runtime-core|runtime-three|wallpaper-runtime)"|document|HTMLElement|Window' packages/four-rotation/src packages/four-camera/src -n
rg 'from "(editor|ui-framework|runtime-core|runtime-three|wallpaper-runtime)"|apps/wallpaper-tesseract|document|HTMLElement|Window' packages/four-camera-three/src -n
npm run test -w wallpaper-tesseract -- architecture-boundaries
```

If any check fails, Gate 4 should classify it as an architecture bug or cleanup
item before discussing package merges.

The decision report must include a short subsection for `wallpaper-runtime`
direct `three` dependency:

- current import sites;
- whether imports are type-only or runtime value imports;
- owner rationale;
- keep/follow-up decision.

## Step 3: Friction Evidence Audit

Collect evidence for whether package count is causing real maintenance friction.

Questions to answer:

- Do app/editor/product features routinely need to import from three or more of
  `runtime-core`, `runtime-three`, and `wallpaper-runtime` in the same file?
- Are package exports forcing consumers to coordinate multiple packages for one
  coherent runtime task?
- Are repeated test/build commands now solved by Gate 3, reducing the main
  operational cost of package count?
- Are there duplicated concepts across runtime packages that can be deleted or
  collapsed without a package merge?
- Are `four-*` packages used as reusable math boundaries, or are they only
  package-management overhead?

Suggested commands:

```text
rg 'runtime-core' apps packages -n --glob '!**/dist/**' --glob '!**/node_modules/**'
rg 'runtime-three' apps packages -n --glob '!**/dist/**' --glob '!**/node_modules/**'
rg 'wallpaper-runtime' apps packages -n --glob '!**/dist/**' --glob '!**/node_modules/**'
rg 'four-rotation|four-camera|four-camera-three' apps packages -n --glob '!**/dist/**' --glob '!**/node_modules/**'
```

Use `rg` for exploration only. The report's importer/co-import tables should be
based on production-only data, reusing the Gate 0 source filtering and import
edge helpers when practical:

```text
apps/wallpaper-tesseract/src/test-support/package-graph-boundaries.ts
apps/wallpaper-tesseract/src/test-support/architecture-boundaries.ts
```

Recommended implementation: add a small temporary or checked-in report script
only if necessary. It should use `isProductionSourceFile(...)` semantics and
`parseStaticImports` / `listModuleEdges` style parsing, so docs, tests,
historical plans, and smoke artifacts do not drive the decision. If a script is
kept, place it under `scripts/` and keep it read-only/report-only; if it is only
for local evidence generation, place output under `temp/` and summarize the
result in the report.

For higher-signal evidence, inspect files that import multiple runtime/math
packages and classify each as:

- legitimate composition point;
- accidental coupling;
- candidate for deleting a duplicate local helper;
- candidate for a future package merge.

Do not count tests alone as merge justification. Tests can import multiple
owners for verification without implying production package friction.

Minimum production-only report tables:

- package manifest dependency/export table;
- production importer table by target package;
- production co-import table for files importing more than one runtime/math
  package;
- direct `wallpaper-runtime -> three` import table;
- `src` and `tests` file counts for each runtime/math package.

## Step 4: Evaluate Merge Candidates

Evaluate each candidate separately.

### Candidate A: `runtime-core` + `runtime-three`

Approve only if:

- renderer-agnostic contract boundaries are already ineffective;
- most production consumers must use both packages together;
- keeping them separate creates duplicated public API or repeated owner logic.

Reject if:

- `runtime-core` still has clean no-Three/no-DOM/no-editor boundaries;
- `runtime-three` remains a replaceable backend;
- the only friction is package count or root script length.

Default: reject.

### Candidate B: `runtime-three` + `wallpaper-runtime`

Approve only if:

- `wallpaper-runtime` is no longer product-specific;
- product runtime owner and renderer backend are inseparable in production;
- merging would delete real duplicate ownership rather than hiding it.

Reject if:

- `wallpaper-runtime` still owns Tesseract4, Camera3 motion, runtime Scene view
  registry, or app-product runtime concepts;
- merging would make renderer backend know Wallpaper product semantics.

Default: reject.

### Candidate C: `runtime-core` + `wallpaper-runtime`

This should almost always be rejected. It would mix reusable runtime contracts
with product runtime ownership.

Default: reject.

### Candidate D: `four-rotation` + `four-camera`

Approve only if:

- `four-camera` is the sole meaningful consumer of `four-rotation`;
- `four-rotation` has no independent tests or reusable math surface worth
  preserving;
- merging would delete package overhead without muddying renderer/product
  ownership.

Reject if:

- `four-rotation` remains a clean reusable math package;
- independent tests document useful math contracts;
- future non-camera 4D code can reasonably depend on it.

Default: keep unless evidence says otherwise.

### Candidate E: `four-camera` + `four-camera-three`

Approve only if:

- the camera model has no renderer-agnostic use left;
- the Three bridge cannot be kept separate without duplicate APIs.

Reject if:

- `four-camera` remains a pure camera/projection model;
- `four-camera-three` is clearly a renderer adapter;
- merging would force Three.js into model-only consumers.

Default: reject.

## Step 5: Decision Record

Write one concise decision record.

If keeping current package shape, update:

```text
docs/current-project-progress.md
docs/project-canopy-package-consolidation-plan.md
docs/project-canopy-gate-4-runtime-consolidation-decision-plan.md
docs/project-canopy-gate-4-runtime-consolidation-report.md
```

Include:

- decision date;
- evidence summary;
- link to the report;
- rejected merge candidates and reasons;
- explicit judgment for `wallpaper-runtime` direct `three` dependency;
- any small cleanup follow-ups;
- statement that Project Canopy is complete if no follow-up implementation plan
  is created.

If a merge is justified, create a new detailed implementation plan instead of
editing packages immediately:

```text
docs/project-canopy-gate-5-<specific-runtime-merge>-plan.md
```

That plan must include:

- exact package deletion/move steps;
- import rewrites;
- package manifest and tsconfig changes;
- boundary-test replacements;
- browser smoke requirements if app/runtime behavior is touched;
- explicit deletion of old package folders and old package names.

## Step 6: Boundary Test Updates

If the decision is to keep current package shape:

- ensure existing boundary tests already protect the ownership reasons used in
  the decision;
- add small tests only if a reviewed boundary is missing.

Good candidate tests:

- `runtime-core` has no `three`, editor, UI, wallpaper-runtime, or app imports;
- `runtime-three` has no editor/UI/wallpaper-runtime/app imports;
- `wallpaper-runtime` has no editor/UI/app composition/DOM ownership imports;
- `four-camera` remains free of Three.js and UI/app/product runtime imports.

Do not add tests that merely freeze file names or implementation details.

If a merge plan is created, defer test changes to that plan unless an immediate
boundary bug is found.

## Step 7: Validation

Because Gate 4 is a decision gate, browser smoke is not required unless source
or package behavior changes unexpectedly.

Required:

```text
npm run test -w wallpaper-tesseract -- architecture-boundaries
npm run test
npm run typecheck
npm run build
git diff --check
```

If Gate 4 only changes docs, `architecture-boundaries` plus `git diff --check`
is sufficient before review, but run root validation before marking Canopy
complete.

## Exit Criteria

- A decision is recorded in current progress docs.
- Runtime package ownership is either explicitly kept or handed to a separate
  reviewed implementation plan.
- No package move is performed in Gate 4.
- No compatibility aliases or broad umbrella runtime exports are added.
- Any newly clarified runtime boundary is locked in `architecture-boundaries`.
- Current package graph in docs matches the filesystem.

## Stop Conditions

Stop and ask for plan review if:

- evidence points to a package merge that would touch production imports;
- the audit finds an existing boundary violation;
- ownership boundaries are unclear enough that a merge would be a guess;
- a proposed merge would require keeping old package names as compatibility
  paths;
- runtime behavior or browser-visible behavior must change.

## Expected Result

Gate 4 should probably end with "keep current runtime package shape" unless the
audit finds concrete package-friction evidence. The most valuable outcome is a
clear decision record, not another package move by inertia.
