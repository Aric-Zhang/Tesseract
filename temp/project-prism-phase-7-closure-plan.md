# Project Prism Phase 7 Closure Plan

Status: completed closure record, drafted and executed 2026-06-13.

This plan closes Phase 7 after reviewer acceptance of the runtime-owner /
app-bootstrap deletion slice. Phase 7's main implementation objective is
accepted: old `app-runtime`, `runtime/ports`, `update-runtime`, old
`features/camera3`, old `tesseract4`, the mixed Scene content installer, and
old app-local bootstrap policy files have been deleted or moved to narrower
owners. Root `test`, `typecheck`, `build`, targeted runtime/app tests, and the
Phase 7 smoke evidence validator have passed.

The closure goal is not to erase every remaining architecture debt before the
next phase. It makes the phase boundary honest: Phase 7 is complete, and the
smaller remaining app-composition / runtime-placement debts are the entry scope
for Phase 8 rather than hidden Phase 7 leftovers.

## Closure Principles

- Do not add compatibility layers, aliases, or bootstrap facades while closing
  the phase.
- Do not weaken boundary facts to make Phase 7 look cleaner.
- Do not move Scene runtime ownership into editor presentation.
- Do not let `features/install-wallpaper-product-features.ts` become a
  permanent product mega-facade; record it as next-phase cleanup.
- Do not call structurally validated smoke data a full interaction rerun. If a
  scenario was not freshly operated in browser, say so.
- Prefer documentation, boundary classification, and verification cleanup over
  new implementation. Phase 7 code changes are already accepted.

## Step 1: Mark Phase 7 Main Plan Complete

Purpose: remove the misleading "active / final validation required" wording
after reviewer acceptance.

Edit:

- `docs/project-prism-phase-7-runtime-owner-app-bootstrap-plan.md`
- `docs/current-project-progress.md`
- `docs/project-prism-engine-modularization-outline.md`

Required wording:

- Phase 7 runtime-owner/app-bootstrap deletion slice is complete and accepted.
- `create-wallpaper-app.ts` is thin enough for Phase 7 acceptance.
- Root validation and Phase 7 smoke evidence validator passed.
- Remaining debt is smaller, explicit, and belongs to the next phase.

Do not:

- Claim `wallpaper-app` has zero app-composition debt.
- Claim the Phase 7 smoke file proves every UI action was freshly rerun.
- Remove future debt from boundary facts merely because Phase 7 is complete.

Exit:

- No project-status document describes Phase 7 as still waiting for final
  validation.
- The Phase 7 plan becomes a completed execution record.

## Step 2: Reclassify Remaining Debt As Next-Phase Entry Scope

Purpose: keep the residual debt visible without treating it as a Phase 7
failure.

Remaining explicit debt:

- `features/install-wallpaper-product-features.ts`: centralizes Wallpaper
  product feature policy, actor ids, hierarchy metadata, default views,
  floating policy, app menu, and workspace-mode installation.
- `features/install-wallpaper-component-definitions.ts`: product component
  definition installer still composes app-local/editor/runtime integration
  definitions.
- `features/workspace-mode.ts`: app-local workspace-mode command policy.
- `gizmo-runtime/install-component-definitions.ts`: app-local actor/gizmo
  binding definition installation.
- `features/scene/install-scene-view-feature.ts`: still crosses editor Scene
  actor creation, runtime Scene session/content, Camera3 gizmo creation, and
  renderable bridge assembly.
- `runtime/runtime-scene-session.ts` and `runtime/runtime-scene-content.ts`:
  accepted Phase 7 runtime owner staging, but still app-local package-placement
  work for the next phase.

Boundary-fact expectation:

- `app-runtime` and `runtime/ports` blockers stay removed.
- `wallpaper-app` may remain blocked by `app-composition-debt` until the next
  phase deletes or moves the explicit product policy files.
- Runtime placement debt should name Scene runtime composition and app-local
  runtime package placement, not old `SceneRuntime`, `RuntimeObject`,
  `features/camera3`, or old `tesseract4` paths.

Exit:

- `projectPrismDebtBlockers`, `projectPrismAppCompositionBlockers`, and
  package target status distinguish "Phase 7 complete" from "next phase still
  has app-composition debt".
- Old path blockers are gone; current blockers point to current files.

## Step 3: Define Next Phase Gate

Purpose: make the handoff executable immediately after closure.

The next phase targets runtime/editor composition and product feature policy
cleanup:

```text
Phase 8: Runtime Scene Composition And Product Feature Policy Split
```

Detailed plan:

```text
docs/project-prism-phase-8-runtime-scene-composition-plan.md
```

Entry scope:

- Split `install-wallpaper-product-features.ts` into smaller owner-owned
  installers or delete facts that no longer need central product policy.
- Move component definition installation toward package/feature owners, not a
  central app-local installer.
- Decide whether workspace-mode belongs to editor state coordination,
  ui-framework window policy, or a smaller product command module; delete the
  current app-local controller if its behavior can be expressed through an
  existing owner.
- Reduce `install-scene-view-feature.ts` so Scene feature composition does not
  simultaneously create editor actors, runtime sessions, runtime content,
  Camera3 gizmo, and renderable bridge.
- Move app-local runtime Scene/Tesseract/Camera3 staging toward package-owned
  runtime owners only when it reduces ownership complexity. Do not extract a
  package just to relocate the same mixed facts.
- Improve browser smoke evidence for UI/runtime behavior by recording fresh
  dock, menu hover, mobile viewport, fullscreen, Scene visibility, Tesseract,
  and Camera3 interaction actions.

Non-goals:

- No app-local facade that simply wraps `install-wallpaper-product-features.ts`.
- No editor-owned runtime resource.
- No duplicate Scene runtime owner.
- No test-only casts or fake ports to preserve old installer shapes.

Exit:

- The next phase has a detailed plan before implementation begins.
- `docs/current-project-progress.md` names the next phase as the current gate
  after Phase 7 closure is executed.

## Step 4: Final Verification Before Closing

Run the reviewer-confirmed matrix once more after documentation and boundary
classification edits:

```text
$env:PROJECT_PRISM_SMOKE_EVIDENCE="temp/project-prism-phase-7-smoke-data.json"; npm run test -w wallpaper-tesseract -- project-prism-smoke-evidence-file
npm run test -w wallpaper-tesseract -- runtime-scene-session runtime-work-attachment-runtime camera3-components tesseract4 install-scene-view-feature component-definitions workspace-mode architecture-boundaries project-prism-boundary-report project-prism-frame-update-lane-map
npm run typecheck -w wallpaper-tesseract
npm run test
npm run typecheck
npm run build
```

Expected result:

- All commands pass.
- `npm run build` may still show the existing Vite chunk size warning; that is
  not a Phase 7 blocker.

## Step 5: Closure Commit Boundary

Purpose: make the next phase start from a clean, reviewable checkpoint.

Before committing:

- `git status --short` shows only intended Phase 7 implementation and closure
  documentation changes.
- Phase 7 plan and progress docs state the same status.
- Smoke evidence files named by the docs exist under `temp/`.
- No local dev server started for smoke verification remains running unless the
  user explicitly asks to keep it open.

Suggested commit message:

```text
Complete Phase 7 runtime-owner app bootstrap cleanup
```

Do not squash unrelated user work into this checkpoint.

## Closure Exit

Phase 7 is closed and the next phase can begin when:

- Phase 7 documents are marked completed.
- Remaining debt is explicit next-phase scope, not Phase 7 acceptance debt.
- Boundary facts reference current files and no deleted legacy paths as active
  blockers.
- The verification matrix passes.
- A Git checkpoint captures the accepted Phase 7 implementation and closure
  docs.
