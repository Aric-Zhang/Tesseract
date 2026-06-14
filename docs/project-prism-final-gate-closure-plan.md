# Project Prism Final Gate Closure Plan

Status: completed 2026-06-14. Drafted after completed Phase 10 runtime
production ownership.

Purpose: finish Project Prism by deleting or explicitly closing the remaining
historical debt found during the phase work. This is not a new extraction phase.
It is a final hardening gate: remove stale compatibility code, remove misleading
project memory from current-status paths, close the dev-server/package-output
ambiguity, decide and execute the layout-v1 migration cleanup, and prove the
final owner boundaries with fresh browser evidence.

## Execution Result

Project Prism Final Gate is complete:

- `DEV-001` is closed by the explicit `npm run prism:smoke:prepare` package
  dist-freshness contract before browser smoke.
- Layout schema version 1 migration support was deleted; the parser now accepts
  schema version 2 only. The existing `.v1` localStorage key suffix remains a
  storage namespace, not schema compatibility.
- `RuntimeSceneViewRuntime` is no longer a public constructible class;
  `wallpaper-runtime` exposes a narrow type-only handle from
  `RuntimeSceneViewRuntimeRegistry`.
- Boundary tests now lock the absence of layout V1 migration and public runtime
  scene internals.
- App frame updates clamp mixed RAF/immediate timestamps before entering
  `RuntimeFrameClock`, removing the Final Gate smoke monotonic-time console
  error without adding a second time owner.
- Fresh Final Gate smoke evidence lives at:

```text
temp/project-prism-final-gate-smoke-data.json
temp/project-prism-final-gate-smoke-report.md
```

The validator passed:

```powershell
$env:PROJECT_PRISM_SMOKE_EVIDENCE="temp/project-prism-final-gate-smoke-data.json"; npm run test -w wallpaper-tesseract -- project-prism-smoke-evidence-file
```

## Non-Negotiables

- Prefer deletion and simplification over new abstractions.
- Do not add compatibility barrels, migration aliases, or facade packages.
- Do not keep old behavior idle after the replacement owner is accepted.
- Do not widen public package APIs to make tests or app wiring easier.
- Do not treat documentation-only updates as a fix when stale production code
  or stale test contracts still exist.
- If a remaining debt cannot be deleted safely, write the owner, retention
  reason, and deletion trigger in `docs/known-defects-and-todos.md`.

## Current Accepted Baseline

- Phase 10 is complete.
- `packages/wallpaper-runtime` is the production Wallpaper runtime owner.
- `apps/wallpaper-tesseract/src/runtime` has been deleted.
- `RuntimeSceneSession` has been deleted.
- `wallpaper-runtime` public exports were initially narrowed after review, but
  the final public API audit remains part of this plan. Exports such as
  `RuntimeSceneViewRuntime`, `RuntimeWorkAttachmentRuntime`, and
  `camera3MotionComponentType` must be justified or deleted in Step 4.
- `wallpaper-scene-integration` is an app-local bridge zone, not an editor
  extraction candidate.
- Fresh Phase 10 smoke evidence lives at:

```text
temp/project-prism-phase-10-smoke-data.json
temp/project-prism-phase-10-smoke-report.md
```

The final gate must create new final-gate evidence. Phase 10 evidence is only a
baseline.

## Remaining Debt To Close

1. Current-status documents still contain historical phase wording that can read
   like active instructions.
2. `DEV-001` remains a watch item: the app dev server consumes built package
   output, so browser verification can use stale package code.
3. Layout persistence version 1 schema migration still hydrates, even though
   version 2 logical type/instance persistence is the accepted owner model.
4. Package public surfaces and app-local barrels need one last audit so the
   final state cannot bypass owners through convenience exports.
5. Boundary tests still contain many useful legacy locks; final gate should keep
   only locks that protect accepted owners and remove stale "current debt"
   assertions if any remain.
6. Final browser smoke must be regenerated after the above cleanup, not reused
   from Phase 10 or earlier phases.

## Step 0 - Baseline And Checkpoint

Goal: prove the Phase 10 baseline before deleting final debt.

Actions:

- Confirm the worktree is clean or document unrelated dirty files before
  editing.
- Run the Phase 10 evidence validator:

```powershell
$env:PROJECT_PRISM_SMOKE_EVIDENCE="temp/project-prism-phase-10-smoke-data.json"; npm run test -w wallpaper-tesseract -- project-prism-smoke-evidence-file
```

- Run targeted boundary/package checks:

```powershell
npm run test -w wallpaper-runtime
npm run test -w wallpaper-tesseract -- architecture-boundaries project-prism-boundary-report
```

Exit:

- Baseline checks pass.
- Any failure is investigated before proceeding; do not delete debt on top of
  an unexplained broken baseline.

## Step 1 - Delete Misleading Current-Status Documentation

Goal: make current project documents describe the current state and active final
gate, not old phase instructions.

Actions:

- Update `docs/current-project-progress.md` so the active plan is this file.
- Move old "current gate" language into clearly historical wording or delete it.
- Ensure the top-level Project Prism outline says Phase 10 is complete and the
  only active work is the final gate.
- Keep historical plans in `docs/` or `temp/` as memory only; do not let them
  appear as active instructions.

Required scan:

```powershell
rg -n "Current gate|active|blocked|Continue deletion-first.*Phase 7|apps/wallpaper-tesseract/src/runtime|features/install-wallpaper-product-features|workspace-mode" docs/current-project-progress.md docs/project-prism-engine-modularization-outline.md
```

Exit:

- Matches are either gone or clearly marked as historical/completed.
- No current-status section points to deleted owners as active topology.

## Step 2 - Close DEV-001 Without A Compatibility Layer

Goal: remove the stale package-output ambiguity from local browser verification.

Current debt:

- Workspace packages export built `dist`.
- `npm run dev -w wallpaper-tesseract` can run stale package output if a package
  source changed but the package was not rebuilt.

Preferred cleanup order:

1. Audit the actual Vite/npm workspace resolution path.
2. Choose the simplest reproducible contract that prevents stale verification.
3. Prefer an explicit pre-smoke/package-build contract. The current Vite config
   has no workspace source aliases, and a dist-based contract keeps package
   boundaries simple and visible.
4. Consider source-based dev resolution only if the dist contract is proven too
   costly. If source aliases are introduced, add boundary tests proving app code
   cannot bypass package exports or import package `src` directly.
5. If a watch/build helper is added, keep it in scripts/tooling only. Do not
   add runtime code, package facades, or duplicate source barrels.

Forbidden:

- No re-export package entrypoints just for dev.
- No app-local imports from package `src` as a hidden workaround.
- No broad resolver magic that makes package boundary tests meaningless.

Expected verification:

```powershell
npm run prism:smoke:prepare
npm run dev -w wallpaper-tesseract
```

`npm run prism:smoke:prepare` is the accepted dist-freshness contract for
browser smoke. It intentionally builds package output before starting the app
dev server instead of adding Vite package-source aliases.

Exit:

- `DEV-001` is either closed with a reproducible dev/smoke command, or retained
  with a precise owner and deletion trigger.
- `docs/known-defects-and-todos.md` no longer leaves the stale-output behavior
  as an ambiguous watch item.

## Step 3 - Delete Layout Version 1 Migration Or Make Its Retention Explicit

Goal: remove the last accepted compatibility schema if it is no longer needed.

Current facts:

- Version 2 persistence stores logical view descriptors with `typeKey` and
  `instanceId`.
- Version 1 migration still hydrates old `viewKey` descriptors.
- The storage key name still contains `.v1`; do not confuse that storage key
  namespace with the persisted schema version.

Storage key decision:

- Prefer not to rename the storage key during the same cleanup unless the
  implementation deliberately resets all saved layouts. If it remains
  `wallpaper-tesseract.windowWorkspaceFrameLayout.v1`, document it as a storage
  namespace only, not as schema compatibility.
- If the storage key is renamed, accept and document the one-time layout reset.
  Do not keep a fallback read from the old key unless this plan is amended with
  a dated deletion trigger.

Preferred cleanup:

- Delete schema version 1 support from
  `packages/ui-framework/src/model/window-workspace-layout-persistence.ts`.
- Remove V1-only descriptor types, parser branches, hidden-view migration
  behavior, and V1 migration tests.
- Keep version 2 serialization/hydration and reset/default-layout behavior.
- If old version 1 data is encountered after deletion, parsing should fail and
  the app should fall back to the current default layout path rather than
  carrying a compatibility migration.

Required scan before and after:

```powershell
rg -n "WINDOW_WORKSPACE_FRAME_LAYOUT_LEGACY_VERSION|PersistedWindowWorkspaceViewDescriptorV1|version === WINDOW_WORKSPACE_FRAME_LAYOUT_LEGACY_VERSION|migrates v1|legacy.*layout|hiddenViewKeys" packages/ui-framework/src apps/wallpaper-tesseract/src docs
```

Exit:

- No production parser/hydrator branch accepts schema version 1 unless the plan
  is amended with a dated retention reason.
- Tests prove:
  - V1 parse returns `null`;
  - invalid persisted data falls back to the default layout path;
  - V2 split/dock/fullscreen restore reload still uses type/instance
    descriptors and no actor ids.
- Browser smoke includes reload persistence after the cleanup.

Stop condition:

- If deleting V1 would strand a currently required released layout contract,
  stop and amend this plan. Do not keep the migration silently.

## Step 4 - Final Public API And Barrel Audit

Goal: prevent old implementation details from remaining reachable through
convenience exports.

Actions:

- Audit package public `index.ts` files for `actor-core`, `actor-input`,
  `ui-framework`, `runtime-core`, `runtime-three`, `wallpaper-runtime`, and
  `editor`.
- Audit app-local `index.ts` files and feature barrels.
- Produce a retained-export inventory for every public package export that
  remains. Each row must name the export, production caller, owner, and reason
  it is public rather than internal. Pay special attention to
  `RuntimeSceneViewRuntime`, `RuntimeWorkAttachmentRuntime`,
  `camera3MotionComponentType`, and `installWallpaperRuntimeComponentDefinitions`.
- Delete exports that expose internals no production caller should construct
  directly.
- Update tests to import through the owning package surface or colocated test
  paths. Do not widen production exports for tests.

Required scans:

```powershell
rg -n "createRuntimeSceneContent|createRenderableSceneView|SceneViewFrameSourceRegistry|RuntimeSceneSession|installWallpaperProductFeatures|WorkspaceModeController|app-menu-model|features/install-wallpaper-component-definitions|gizmo-runtime/install-component-definitions" apps packages docs
rg -n "from [\"']wallpaper-runtime\/src|from [\"']ui-framework\/src|from [\"']editor\/src" apps packages
```

Exit:

- App code cannot bypass `wallpaper-runtime` owner APIs by importing runtime
  internals.
- The retained-export inventory exists in this plan or a linked docs section,
  and every kept export has a production caller and owner rationale.
- Deleted product shells and old app-local barrels have no production imports.
- Boundary tests cover any rule that should stay invariant.

Retained `wallpaper-runtime` public export inventory after final audit:

| Export | Production caller | Owner | Reason |
| --- | --- | --- | --- |
| `ProductionRuntimeSchedulerService` | `create-wallpaper-app.ts` | `wallpaper-runtime` | App composition must create the product runtime scheduler once and pass it to runtime attachment/render loop owners. |
| `ProductionRuntimeSchedulerServiceOptions` | public type for scheduler construction | `wallpaper-runtime` | Type-only companion for the public scheduler constructor. |
| `RuntimeWorkAttachmentRuntime` | `create-wallpaper-app.ts` | `wallpaper-runtime` | Actor/component attachment bridge from actor lifecycle to the product runtime scheduler; app composition installs it once in the component registry. |
| `RuntimeWorkAttachmentRuntimeOptions` | public type for attachment construction | `wallpaper-runtime` | Type-only companion for the public attachment runtime constructor. |
| `installWallpaperRuntimeComponentDefinitions` | `create-wallpaper-app.ts`, component-definition tests | `wallpaper-runtime` | Single owner-level installer for runtime Camera3/Tesseract definitions; prevents app or Scene feature from installing individual runtime definitions. |
| `RuntimeSceneViewRuntimeRegistry` | `create-wallpaper-app.ts`, `install-scene-view-feature.ts` | `wallpaper-runtime` | Owner registry for runtime Scene view/frame-source lifecycle; app creates one registry and Scene integration requests handles through it. |
| `RuntimeSceneViewRuntime` | `install-scene-view-feature.ts` type-only handle | `wallpaper-runtime` | Narrow non-constructible handle returned by the registry; class implementation is internal. |
| `AttachRuntimeSceneViewOptions`, `CreateRuntimeSceneViewRuntimeOptions`, `RuntimeSceneViewVisibilityPort` | public type surfaces for Scene integration | `wallpaper-runtime` | Type-only contracts for app-local Scene integration to attach editor presentation visibility/measurement to runtime ownership without importing internals. |
| `camera3MotionComponentType` | Scene Camera3 viewport binding and component-definition tests | `wallpaper-runtime` | Shared component type token needed for editor Scene presentation binding to require/read the runtime-owned Camera3 motion component. |

## Step 5 - Collapse Stale Tests And Boundary Locks

Goal: keep tests that guard accepted architecture and delete tests that only
preserve old debt.

Actions:

- Review `apps/wallpaper-tesseract/src/architecture-boundaries.test.ts` for
  "legacy" checks.
- Prefer rewriting old blocker tests into current-owner invariants. Delete a
  test only when it purely describes an obsolete debt state and no longer guards
  a real regression path.
- Keep DCK-006/DCK-007 style regression tests when they protect real dock/input
  behavior, even if their historical blocker is closed.
- Ensure boundary facts have no blockers unless a real final-gate blocker is
  created.

Required checks:

```powershell
npm run test -w wallpaper-tesseract -- architecture-boundaries project-prism-boundary-report
```

Exit:

- Boundary tests describe accepted architecture, not stale phase debt.
- `projectPrismDebtBlockers`, runtime blockers, UI blockers, and app
  composition blockers remain empty unless a new issue is intentionally opened.

## Step 6 - Clean Historical Temp Artifacts Deliberately

Goal: reduce handoff noise without deleting useful final evidence.

Actions:

- Keep final evidence for Phase 8, Phase 9, Phase 10, and the new Final Gate.
- Keep blocker reports that explain closed high-risk regressions only if they
  remain useful debugging context.
- Delete obsolete intermediate screenshots, DOM dumps, and logs that are not
  referenced by docs or the defect ledger.

Required scan:

```powershell
Get-ChildItem temp | Sort-Object Name
rg -n "temp/" docs apps packages
```

Exit:

- Current docs do not reference deleted temp files.
- Final-gate evidence is present and named distinctly from prior phase evidence.

## Step 7 - Fresh Final Browser Smoke

Goal: prove the final state after all cleanup, not merely Phase 10.

Actions:

- Before collecting smoke data, strengthen the validator if needed so mobile
  evidence checks actual viewport intersection for Window menu, Camera3 gizmo,
  Scene rect, and Tesseract canvas host. Width/height greater than zero is not
  sufficient.
- Build workspace packages according to the Step 2 dev/smoke contract.
- For this final gate, the contract is:

```powershell
npm run prism:smoke:prepare
```

- Start the app dev server:

```powershell
npm run dev -w wallpaper-tesseract
```

- Generate fresh evidence:

```text
temp/project-prism-final-gate-smoke-data.json
temp/project-prism-final-gate-smoke-report.md
```

Required scenarios:

- fresh boot with console errors equal to 0;
- app menu hover highlights the hovered item, not a fixed first item;
- Debug -> Scene dock and Scene -> Debug dock both mutate graph/DOM layout;
- close/reopen Scene leaves exactly one Scene, Tesseract, and Camera3 hierarchy
  entry and no stale canvas/frame source;
- repeat Scene close/reopen enough times to prove lifecycle cleanup, not just a
  single happy path;
- splitter drag changes layout signature;
- Scene fullscreen/restore does not persist a runtime-only fullscreen frame;
- reload persistence uses version 2 logical type/instance descriptors and no
  actor ids;
- Camera3 action changes camera/gizmo evidence;
- 390x844 mobile viewport has Scene, Tesseract canvas host, Window menu, and
  Camera3 gizmo rects intersecting the viewport.

Validator:

```powershell
$env:PROJECT_PRISM_SMOKE_EVIDENCE="temp/project-prism-final-gate-smoke-data.json"; npm run test -w wallpaper-tesseract -- project-prism-smoke-evidence-file
```

Exit:

- Final-gate smoke evidence validates.
- No scenario reuses Phase 10 evidence as proof.

## Step 8 - Root Validation And Closure Docs

Goal: close Project Prism with reproducible checks.

Run:

```powershell
npm run test
npm run typecheck
npm run typecheck:test -w ui-framework
npm run build
```

Update:

- `docs/current-project-progress.md`
- `docs/known-defects-and-todos.md`
- `docs/project-prism-engine-modularization-outline.md`

Exit:

- Project Prism status is marked complete, or complete with explicitly named
  non-blocking watch items.
- Verification matrix points at final-gate evidence.
- Any remaining historical debt has an owner and deletion trigger.
- The final commit contains code cleanup, docs, and evidence references without
  unrelated worktree changes.

## Stop Conditions

Stop and amend this plan if:

- deleting layout V1 migration breaks a required released compatibility
  contract;
- closing `DEV-001` requires broad package aliasing or a new facade layer;
- final browser smoke finds a real UI/runtime behavior regression;
- a package public API must be widened to keep app code compiling;
- boundary facts need a new blocker.

Normal implementation failures, test rewrites, and grep discoveries are not
blockers. Continue through the plan when they can be solved by deleting old
paths, tightening ownership, or updating tests to the accepted architecture.
