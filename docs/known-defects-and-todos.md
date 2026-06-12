# Known Defects And Todos

Last updated: 2026-06-13

This document is the permanent defect and follow-up ledger for the repository.
Use it for known bugs, reproducible investigation findings, and non-plan
cleanup items that should survive temp artifact cleanup.

Keep this file current when:

- A defect is confirmed by real implementation evidence, browser evidence, or
  a failing test.
- A defect is fixed but still needs broader verification, commit, or follow-up
  simplification.
- A debugging session exposes architecture friction that is likely to slow down
  future maintenance.

Do not use this file as a dumping ground for speculative ideas. Each entry
should include status, evidence, impact, next action, and verification.

## Status Key

- `open`: confirmed issue or cleanup debt still needs implementation.
- `fixed-pending-verification`: code changed, but broader validation or commit
  is still pending.
- `watch`: not currently blocking, but keep visible because it can mislead
  future debugging.
- `closed`: retained only when recent context is still useful for handoff.

## Current Entries

Completed execution plan for the dock-related Step 10 entries:
`temp/project-prism-phase-6-editor-extraction-plan.md`, Step 10.

### DCK-001: Dock commit failures are silent

Status: `closed`

Area: `apps/wallpaper-tesseract/src/features/window-workspace`,
`packages/ui-framework/src/services`

Original evidence:

- `requestCommitDock(intent)` currently calls `requireLifecycle().commitDock(intent)`
  and discards the result.
- During the repeated Debug/Scene dock failure, pointer logs showed successful
  input end, while the graph reducer returned a no-commit warning that never
  reached visible diagnostics.

Impact:

- Dock validation failures, graph transaction warnings, and hard/soft projection
  issues are easy to mistake for pointer capture or DOM realization problems.
- Browser debugging becomes slow because the only visible log stream is low
  level gizmo input.

Next action:

Completed fix:

- `WindowFrameIntentSink.requestCommitDock` now returns
  `WindowDockCommitResult`.
- `install-window-workspace-feature.ts` returns the lifecycle `commitDock`
  result instead of discarding it.
- `handleWindowFrameTabInputEnd` exposes a narrow `dockCommit` evidence object
  for tests and smoke plumbing without owning placement state.

Verification completed:

- `npm run test -w wallpaper-tesseract -- window-frame-tab-input`
- `npm run test -w wallpaper-tesseract -- architecture-boundaries`
- Root `npm run test`, `npm run typecheck`, and `npm run build`

### DCK-002: Debug Log does not show dock semantic trace

Status: `closed`

Area: `packages/editor/src/debug`, `apps/wallpaper-tesseract/src/window-runtime`,
`packages/ui-framework/src/services`

Original evidence:

- Debug Log records gizmo pointer lifecycle events such as `pointermove`,
  `capture`, and `end`.
- It does not show the semantic chain:
  `preview -> dock intent -> lifecycle validation -> graph transaction -> commit result`.

Impact:

- Input logs can look correct even when lifecycle rejects the dock operation.
- Future dock bugs require ad hoc DOM/storage/model probes.

Next action:

Completed fix:

- The semantic trace is exposed through the tab-input `dockCommit` result:
  `preview -> dock intent -> commit result`.
- Debug Log remains a low-level gizmo log and was not made a placement owner,
  graph cache, or lifecycle authority.

Verification completed:

- `window-frame-tab-input.test.ts` asserts the preview, generated intent, and
  failed commit reason in one place.

### DCK-003: Gizmo "ignore" log is misleading for buttons-zero-without-capture

Status: `watch`

Area: `packages/gizmo-core/src/gizmo-event-system.ts`

Evidence:

- `buttons-zero-without-capture` is logged as `ignore`, but `handlePointerMove`
  continues to update active state and dispatch `onGizmoMove`.

Impact:

- Debugging can incorrectly focus on pointer capture loss when the move was not
  actually ignored.

Next action:

- Rename the log type/reason to a warning-style diagnostic, or make the code
  actually stop processing if that is the intended behavior.

Verification:

- Gizmo tests should describe whether the event continues or is canceled.

### DCK-004: Dock node id derivation still lives outside the graph reducer

Status: `closed`

Step 10 blocker: resolved.

Area: `packages/ui-framework/src/services/window-frame-lifecycle-controller.ts`,
`packages/ui-framework/src/model/window-workspace-graph.ts`

Original evidence:

- `commitSameFrameSplitTab` and cross-frame split code pass
  `newTabsetId` / `newSplitId` into graph transactions.
- Repeated dock operations create long derived ids based on historical target
  tabset ids.

Impact:

- Callers need to understand graph id construction.
- Repeated dock paths can produce hard-to-read persistence and were able to
  trigger duplicate id rejection before DCK-005's reducer fix.

Next action:

Completed fix:

- Split tabset/split id allocation moved into `WindowWorkspaceGraph`.
- `newTabsetId` and `newSplitId` were removed from the public
  `WindowWorkspaceGraphTransaction` split surface.
- Lifecycle split callers no longer derive or pass dock node ids.
- `createDerivedGraphSplitId` was deleted.

Verification completed:

- `rg "newTabsetId|newSplitId|createDerivedGraphSplitId" apps packages --glob "*.ts"`
  returns no old public/caller API matches.
- Graph tests cover repeated split/dock cycles without caller-provided dock
  node ids.
- Persistence should remain logical and must not contain actor or DOM ids.

### DCK-005: Repeated same-frame split can reuse ids released by source collapse

Status: `closed`

Area: `packages/ui-framework/src/model/window-workspace-graph.ts`

Evidence:

- Visible-window reproduction: `Debug` and `Scene` in one root frame, then
  repeated dock from one sibling into the other.
- Before the fix, graph reduction returned
  `cannot split with duplicate dock node id` because duplicate id validation
  ran before source removal collapsed the old branch.

Completed fix:

- `split-content` now removes the source content and collapses empty branches
  before allocating split dock node ids.
- Split dock id allocation is now graph-owned, so lifecycle callers no longer
  need to understand or pass released dock node ids.
- Regression coverage was added for splitting into a sibling tabset after the
  source branch releases derived ids.

Verification completed:

- `npm run test -w ui-framework -- window-workspace-graph`
- `npm run build -w ui-framework`
- `npm run typecheck -w ui-framework`
- Visible Chromium verification showed the repeated dock path producing the
  expected Scene-left / Debug-right layout.
- `window-frame-lifecycle-controller.test.ts` covers the actual repeated
  `commitDock` split path.
- Root `npm run test`, `npm run typecheck`, and `npm run build`
- Browser evidence:
  `temp/project-prism-phase-6-step10-dock-regression-evidence.json`
  and `temp/project-prism-phase-6-step10-debug-scene-repeat-dock.png`

### DEV-001: App dev server consumes built package output for ui-framework

Status: `watch`

Area: workspace dev/build tooling

Evidence:

- During dock debugging, changing `packages/ui-framework/src` did not affect
  the running app until `npm run build -w ui-framework` regenerated `dist`.

Impact:

- Browser verification can accidentally run stale package code.
- Debug sessions may appear contradictory when source tests pass but the app
  still runs old package output.

Next action:

- Decide whether the app dev server should alias workspace package source,
  run package build/watch automatically, or keep the current dist contract with
  explicit documentation.

Verification:

- A package source change should have an obvious, reproducible path into the
  running app during local debugging.

## Recently Closed Or Historical Notes

Closed entries retained above:

- DCK-001: closed by commit `5d528a4`; dock commit result is now returned
  through `WindowFrameIntentSink.requestCommitDock`.
- DCK-002: closed by commit `5d528a4`; tab input exposes the assertable
  `dockCommit` evidence chain without making Debug Log a placement owner.
- DCK-004: closed by commit `5d528a4`; split dock node id allocation now belongs
  to `WindowWorkspaceGraph`.
- DCK-005: closed by commit `5d528a4`; repeated Debug/Scene split dock is
  covered by reducer, lifecycle/controller, root validation, and browser
  evidence.

Move entries here only when retaining the full active-entry detail no longer
helps future agents.
