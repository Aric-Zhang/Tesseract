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

## Active Entries

Current execution plan for the dock-related active entries:
`temp/project-prism-phase-6-editor-extraction-plan.md`, Step 10.

### DCK-001: Dock commit failures are silent

Status: `open`

Area: `apps/wallpaper-tesseract/src/features/window-workspace`,
`packages/ui-framework/src/services`

Evidence:

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

- Route `WindowDockCommitResult` through one explicit, testable contract exit:
  either make `WindowFrameIntentSink.requestCommitDock` return the result, or
  give the lifecycle owner a narrow diagnostic sink for the existing result and
  reasons.
- Do not use internal-only logging as the contract; QA and smoke evidence must
  be able to assert the semantic result.
- Keep production behavior unchanged except for narrow diagnostics and tests.

Verification:

- A failed dock commit should produce a concise reason in debug/smoke evidence.
- Existing dock behavior and graph/DOM parity tests must still pass.

### DCK-002: Debug Log does not show dock semantic trace

Status: `open`

Area: `packages/editor/src/debug`, `apps/wallpaper-tesseract/src/window-runtime`,
`packages/ui-framework/src/services`

Evidence:

- Debug Log records gizmo pointer lifecycle events such as `pointermove`,
  `capture`, and `end`.
- It does not show the semantic chain:
  `preview -> dock intent -> lifecycle validation -> graph transaction -> commit result`.

Impact:

- Input logs can look correct even when lifecycle rejects the dock operation.
- Future dock bugs require ad hoc DOM/storage/model probes.

Next action:

- Add a narrow dock trace event stream or smoke evidence hook owned by the
  lifecycle/debug boundary and backed by the same explicit result contract used
  for DCK-001.
- Do not make Debug Log a placement owner or alternate source of truth.

Verification:

- A repeated dock scenario should expose the final commit result and target
  tabset id in one place.

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

Status: `open`

Step 10 blocker: yes.

Area: `packages/ui-framework/src/services/window-frame-lifecycle-controller.ts`,
`packages/ui-framework/src/model/window-workspace-graph.ts`

Evidence:

- `commitSameFrameSplitTab` and cross-frame split code pass
  `newTabsetId` / `newSplitId` into graph transactions.
- Repeated dock operations create long derived ids based on historical target
  tabset ids.

Impact:

- Callers need to understand graph id construction.
- Repeated dock paths can produce hard-to-read persistence and were able to
  trigger duplicate id rejection before DCK-005's reducer fix.

Next action:

- Move split/tabset id allocation into the graph model/reducer.
- Remove `newTabsetId` and `newSplitId` from the public transaction surface.
- Prefer deleting lifecycle-side id derivation over adding another id adapter.

Verification:

- Graph tests should cover repeated split/dock cycles without caller-provided
  dock node ids.
- Persistence should remain logical and must not contain actor or DOM ids.

### DCK-005: Repeated same-frame split can reuse ids released by source collapse

Status: `fixed-pending-verification`

Area: `packages/ui-framework/src/model/window-workspace-graph.ts`

Evidence:

- Visible-window reproduction: `Debug` and `Scene` in one root frame, then
  repeated dock from one sibling into the other.
- Before the fix, graph reduction returned
  `cannot split with duplicate dock node id` because duplicate id validation
  ran before source removal collapsed the old branch.

Current fix:

- `split-content` now removes the source content and collapses empty branches
  before checking whether `newTabsetId` or `newSplitId` still conflict.
- Regression coverage was added for splitting into a sibling tabset after the
  source branch releases derived ids.

Verification completed:

- `npm run test -w ui-framework -- window-workspace-graph`
- `npm run build -w ui-framework`
- `npm run typecheck -w ui-framework`
- Visible Chromium verification showed the repeated dock path producing the
  expected Scene-left / Debug-right layout.

Remaining verification:

- Run broader root checks before committing this fix.
- Add lifecycle/controller-level coverage for the actual repeated `commitDock`
  split path, not only reducer-level coverage.
- Add or update browser smoke evidence if this scenario should become a
  permanent Phase 6+ regression gate.

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

No closed entries yet. When an entry is fully fixed, verified, and committed,
either remove it if it no longer helps future agents or move it here briefly
with the closing commit and validation summary.
