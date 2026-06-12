# Project Prism Pre-Phase 6 Final Gate Execution Plan

Last updated: 2026-06-12

Status: completed final gate record. This plan has been executed and verified;
the `window-workspace-multi-truth-debt` blocker has been removed from boundary
facts, so Phase 6 editor package extraction may begin.

Completion evidence:

```text
temp/project-prism-phase-6-entry-smoke-data.json
temp/project-prism-phase-6-entry-smoke-report.md
```

## Goal

Prove that the window workspace graph is the single production placement truth
across graph state, DOM placement, actor-input hits, fullscreen presentation,
and persistence. After this plan completes, `ui-framework` and `editor` should
no longer be blocked by `window-workspace-multi-truth-debt`, and Phase 6 editor
package extraction can start without carrying pre-Phase 6 window placement
debt.

## Starting State

The implementation cleanup before this plan is complete:

- `WindowFramePort` is shell/presentation-only.
- `WindowFrameSurfaceComponent` renders `WindowFrameSurfaceSnapshot` directly.
- `WindowWorkspaceGraphReconcilerSurface` has explicit `removeContent` and
  `setContentActive` operations.
- `WindowContentHost`, `WindowContentAttachment`, `WindowDockSurfaceModel`, and
  `window-frame-dock-tree` are deleted from production and tests.
- Runtime dock-root source types and app-local re-exports are deleted.
- Root checks passed after the cleanup: `npm run test`, `npm run typecheck`,
  and `npm run build`.

The remaining blocker is evidence, not a known production code path. Final
browser smoke must prove the graph/DOM/input/persistence parity end to end.
The current smoke contract is not yet sufficient for blocker removal: it only
validates the minimal URL/viewport/console/interactions shape. Step 1 is a
mandatory prerequisite, not optional hardening.

## Non-Negotiable Rules

- Do not reintroduce compatibility facades, old placement APIs, dock-root
  models, content host/attachment APIs, or fallback ownership paths.
- Do not add permanent production debug APIs just to make smoke data easier to
  read. Prefer existing DOM, existing graph projection code, and test-support
  contracts.
- If graph ids cannot be observed from the browser through existing surfaces,
  add the smallest smoke-only/test-support read surface needed, use it to
  collect evidence, and either delete it before completion or keep it under
  explicit test-support ownership. It must not become product behavior.
- Any smoke failure should be fixed by deleting obsolete paths, simplifying
  ownership, or routing through `WindowWorkspaceGraph` / lifecycle intent.
  Defensive sync, compatibility aliases, or special fallback branches are not
  acceptable Phase 6 gate fixes.
- Do not remove `window-workspace-multi-truth-debt` until the evidence file,
  validator, architecture-boundary tests, and root verification all pass.

## Step 0: Confirm The Baseline Is Still Clean

Purpose: avoid validating smoke on top of a partially regressed tree.

Run:

```text
rg "window-content-host|WindowContentHost|WindowContentAttachment|createWindowContentAttachment|getWindowContentAttachment|WindowFrameRuntimeDockNode|WindowFrameRuntimeTabsetNode|WindowFrameRuntimeSplitNode|WindowFrameDockTargetTabset|WindowFrameDockTabOptions|WindowFrameDockSplitOptions|window-frame-dock-tree|WindowDockSurfaceModel|window-dock-surface-model|getRuntimeDockRoot|restoreRuntimeDockRoot|listDockTargetTabsets|getFocusedViewActorId|getActiveViewActorIds|isViewActiveInFrame|isViewVisibleInFrame|getContentHost|mountContent|tabs\\?: readonly WindowFrameTab|activeViewActorId\\?:|activeViewKey\\?:" packages/ui-framework/src apps/wallpaper-tesseract/src --glob "!**/*.test.ts" --glob "!apps/wallpaper-tesseract/src/architecture-boundaries.test.ts"
npm run typecheck:test -w ui-framework
npm run test -w ui-framework
npm run test -w wallpaper-tesseract -- architecture-boundaries project-prism-smoke-contract
npm run typecheck -w wallpaper-tesseract
```

Exit criteria:

- The grep has no production matches.
- All commands pass.
- Any failure is fixed before browser smoke begins.

## Step 1: Harden The Smoke Evidence Contract

Use the existing `apps/wallpaper-tesseract/src/test-support/project-prism-smoke-contract.ts`
instead of creating a production observer.

Current gap to close before any blocker removal:

- `ProjectPrismSmokeEvidence` currently has only `url`, `viewport`,
  `consoleErrors`, and `interactions`.
- It does not yet represent graph snapshots, content-id DOM parent assertions,
  active tab/content parity, splitter graph ids, or persistence JSON.
- Therefore Step 4 is forbidden until this step adds those fields and tests
  malformed evidence for them.

Extend the contract only as much as needed to prove the final gate:

- graph snapshot evidence:
  - frame ids;
  - tabset ids;
  - split ids;
  - content ids;
  - active content per tabset;
  - view identity descriptors by type/instance, not actor ids.
- DOM realization evidence:
  - each graph `contentId` has exactly one DOM parent;
  - inactive tab content is hidden/non-interactable;
  - visible active tab content has a measurable rect;
  - no stale DOM parent remains after close, dock, undock, or fullscreen
    restore.
- actor-input evidence:
  - tab close/action hits route to `window-tab-action`;
  - tab body hits route to `window-tab`;
  - splitter hits include the graph `splitId`;
  - inactive tabs/hidden split panes are not interactable.
- persistence evidence:
  - persisted layout stores logical `typeKey` / `instanceId` descriptors;
  - persisted layout contains no actor ids, DOM ids, frame runtime ids, or
    content DOM ids;
  - runtime-only fullscreen frames are not persisted.

Add or update validator tests so malformed evidence fails for:

- duplicate DOM parents for one `contentId`;
- missing graph id for a tabset/split/content;
- active tab mismatch between graph and DOM;
- splitter hit without the graph `splitId`;
- persisted actor id / DOM id / runtime frame id;
- console errors;
- missing screenshot or action result for required interactions.

Add a dedicated evidence-file validator test:

```text
apps/wallpaper-tesseract/src/test-support/project-prism-smoke-evidence-file.test.ts
```

Required behavior:

- Reads the evidence path from `PROJECT_PRISM_SMOKE_EVIDENCE`.
- Fails when that environment variable is set but the file is missing,
  malformed, or does not satisfy `validateProjectPrismSmokeEvidence`.
- Skips itself when the environment variable is not set, so normal unit test
  runs do not require a browser-smoke artifact before the final gate.
- Prints validation errors with enough context to fix the evidence or the
  underlying product behavior.

Exit criteria:

```text
npm run test -w wallpaper-tesseract -- project-prism-smoke-contract
$env:PROJECT_PRISM_SMOKE_EVIDENCE="temp/project-prism-phase-6-entry-smoke-data.json"; npm run test -w wallpaper-tesseract -- project-prism-smoke-evidence-file
```

The second command is expected to fail until Step 2 creates the JSON evidence
file. After Step 2 it must pass. The contract and file validator must remain in
test-support only.

## Step 2: Collect Deterministic Browser Smoke Evidence

Run the Vite dev server:

```text
npm run dev -w wallpaper-tesseract
```

Use a reset workspace layout URL for deterministic setup, then collect evidence
into:

```text
temp/project-prism-phase-6-entry-smoke-data.json
temp/project-prism-phase-6-entry-smoke-report.md
temp/project-prism-phase-6-entry-*.png
```

The smoke must cover these scenarios.

1. Boot baseline at desktop viewport.
   - Scene is visible.
   - Workspace root frame exists.
   - Scene canvas has nonzero rect.
   - Initial graph frame/tabset/content ids match DOM placement.
   - Console errors are zero.

2. Window menu open/focus flow.
   - Debug, Hierarchy, Inspector, and a second Inspector can be opened or
     focused through menu commands.
   - Type identity and instance identity stay distinct for Inspector
     instances.

3. Root tab close and reopen.
   - Closing one root tab removes only that view.
   - Reopening through menu creates a new graph placement with one DOM parent.
   - Other views in the frame remain placed and interactable only when active.

4. Dock mutation 5B/5C coverage.
   - Dock a third tab into every visible region type: root tabset center,
     root split side, floating tabset center, and floating split side.
   - Run root-to-floating and floating-to-root dock/undock cycles in both
     directions.
   - For each operation, record graph frame/tabset/content ids, DOM parent by
     `contentId`, active content, and console errors.

5. Splitter resize.
   - Hit-test a splitter and record the graph `splitId`.
   - Drag resize and record the graph ratio change.
   - Verify inactive or hidden panes are not actor-input interactable.

6. Scene fullscreen restore.
   - Fullscreen Scene from a mixed tab frame.
   - Fullscreen Scene from a split frame.
   - Restore both sessions.
   - Verify the runtime-only fullscreen frame is not persisted and source
     mixed/split frames restore graph placement and DOM parentage.

7. Persistence reload.
   - Build a mixed split/tab layout.
   - Reload.
   - Verify version 2 persistence hydrates logical descriptors by type/instance.
   - Verify persisted layout contains no actor ids, DOM ids, graph content DOM
     ids, or runtime-only fullscreen frame ids.

8. Mobile viewport.
   - Verify menu focus, tab close, and root/floating frame controls remain
     usable without text overlap.
   - Verify console errors remain zero.

9. Render/input sanity.
   - Camera3 drag changes camera behavior and visible gizmo state.
   - Camera3 double-click snap still works.
   - Projection toggle updates the label/view state.
   - Tesseract remains visible.

Exit criteria:

- The dedicated evidence-file validator passes:

  ```text
  $env:PROJECT_PRISM_SMOKE_EVIDENCE="temp/project-prism-phase-6-entry-smoke-data.json"; npm run test -w wallpaper-tesseract -- project-prism-smoke-evidence-file
  ```

- Report includes the exact date/time, browser URL, viewport sizes, console
  errors, graph ids, DOM parent assertions, persistence assertions, and
  screenshot paths.
- The dev server is stopped after evidence collection.

## Step 3: Fix Any Smoke Failures By Deletion Or Simplification

If smoke fails, classify the failure and fix the owner directly.

Use these preferred fixes:

- stale DOM parent: fix reconciler/surface removal or graph placement diff;
- duplicate content parent: delete the extra placement path, do not sync it;
- active/interactable mismatch: route active state through graph placement and
  `setContentActive`;
- splitter hit mismatch: use graph split ids from snapshot geometry;
- persistence leak: delete persistence of runtime ids and persist only logical
  descriptors;
- fullscreen leak: keep runtime-only fullscreen frames out of persisted layout;
- menu/open/focus mismatch: route through lifecycle intent and graph placement.

Forbidden fixes:

- adding old placement reads back to `WindowFramePort`;
- recreating dock-root/dock-tree models;
- adding content host/attachment compatibility;
- keeping two placement facts synchronized;
- adding product-visible debug state as a permanent API.

Exit criteria:

- The smoke scenario that failed passes after the fix.
- Step 0 and Step 2 checks are rerun after every structural fix.
- Deleted code is removed in the same change, not left idle.

## Step 4: Remove The Boundary Blocker

Only after Step 2 evidence passes and Step 3 has no open failures:

- Confirm Step 1's expanded contract and evidence-file validator are in place.
- Confirm the evidence-file validator command passes against
  `temp/project-prism-phase-6-entry-smoke-data.json`.
- Remove `window-workspace-multi-truth-debt` from
  `projectPrismPrePhase6UiFrameworkBlockers`.
- Update `projectPrismPackageTargets`:
  - `ui-framework.blockedBy` becomes `[]`;
  - `ui-framework.extractionStatus` becomes `allowed`;
  - `editor.blockedBy` becomes `[]`;
  - `editor.extractionStatus` becomes `allowed`.
- Replace the architecture-boundary test that says Phase 6 is blocked with a
  test that says Phase 6 is allowed only because:
  - the blocker list is empty;
  - old placement APIs/files remain absent;
  - the smoke evidence contract exists and validates the final gate shape.
- Update tests that currently expect
  `projectPrismPrePhase6UiFrameworkBlockers` to contain
  `window-workspace-multi-truth-debt`.

Exit criteria:

```text
npm run test -w wallpaper-tesseract -- architecture-boundaries project-prism-smoke-contract
```

passes, and `rg "window-workspace-multi-truth-debt" apps/wallpaper-tesseract/src`
only matches historical comments if any remain intentionally documented.

## Step 5: Update Project Status And Phase 6 Entry State

Update:

- `docs/current-project-progress.md`;
- `docs/project-prism-engine-modularization-outline.md` if its Phase 6 gate
  language still says blocked;
- this plan, marking it complete and linking the smoke evidence files.

The progress document should say:

- pre-Phase 6 window-workspace gate is complete;
- Phase 6 editor package extraction may begin;
- remaining Phase 6 work is editor extraction work, not pre-Phase 6
  window-workspace truth debt.

Exit criteria:

- No mutable status in `AGENTS.md`.
- Active plan section points to the completed final gate evidence, not to an
  obsolete cleanup plan.

## Step 6: Final Verification Matrix

Run:

```text
npm run test
npm run typecheck
npm run build
npm run typecheck:test -w ui-framework
npm run test -w wallpaper-tesseract -- architecture-boundaries project-prism-smoke-contract
$env:PROJECT_PRISM_SMOKE_EVIDENCE="temp/project-prism-phase-6-entry-smoke-data.json"; npm run test -w wallpaper-tesseract -- project-prism-smoke-evidence-file
```

Exit criteria:

- All commands pass.
- Browser smoke evidence validates with zero errors through the reproducible
  evidence-file test command.
- Console errors are zero.
- Production old-placement grep from Step 0 has no matches.
- `window-workspace-multi-truth-debt` no longer blocks any package target.

## Definition Of Done

Phase 6 can start when all are true:

- `projectPrismPrePhase6UiFrameworkBlockers` no longer contains
  `window-workspace-multi-truth-debt`.
- `ui-framework` and `editor` package targets are not blocked by
  `window-workspace-multi-truth-debt`.
- Final browser smoke evidence exists under `temp/`, validates successfully,
  and records graph/DOM/input/persistence parity.
- Root `test`, `typecheck`, and `build` pass.
- `ui-framework` test typecheck passes.
- Architecture boundaries pass with Phase 6 marked allowed.
- No production compatibility surface for the deleted placement model exists.
