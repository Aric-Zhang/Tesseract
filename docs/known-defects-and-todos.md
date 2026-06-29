# Known Defects And Todos

Last updated: 2026-06-29

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

Project Prism temporary smoke screenshots, blocker dumps, and phase execution
artifacts were cleaned after the Final Gate baseline. Historical closed entries
may mention removed `temp/` paths as context; the retained reproducible Project
Prism evidence is the Final Gate smoke data/report.

## Status Key

- `open`: confirmed issue or cleanup debt still needs implementation.
- `fixed-pending-verification`: code changed, but broader validation or commit
  is still pending.
- `watch`: not currently blocking, but keep visible because it can mislead
  future debugging.
- `closed`: retained only when recent context is still useful for handoff.

## Current Entries

The old dock-related Step 10 execution plan was retained in Git history and
removed from `temp/` during Project Prism closure cleanup.

### ARB-001: Gate 7B needs deterministic large Hierarchy smoke fixture

Status: `open`

Area: `packages/editor/src/hierarchy`, `apps/wallpaper-tesseract` smoke support

Evidence:

- Gate 7B migrated Hierarchy to actor-backed `ScrollViewComponent` /
  `TreeViewComponent` and generated fresh default browser smoke evidence in
  `temp/project-arbor-gate-7b-hierarchy-smoke-data.json`.
- The default product boot currently exposes 10 Hierarchy rows, which proves the
  new TreeView/ScrollView path and source-pollution guard, but does not prove
  large-node scrolling.

Impact:

- The UI architecture is not blocked, but future TreeView scrolling or
  virtualization changes should have a reproducible high-row-count browser
  fixture.

Next action:

- Add a deterministic test-only actor population or fixture source for browser
  smoke, run large Hierarchy scroll, then dispose the test population before
  handoff.
- Do not add smoke-only actors to the product default state.

Verification target:

- Fresh browser smoke records many Hierarchy rows, scroll position changes,
  no duplicate item ids, no visible Hierarchy item actor recursion, and no
  stale test actors after cleanup.

### ARB-002: Debug Log actor-backed ListView caused frame-time regression

Status: `closed`

Area: `packages/ui-framework/src/ui/collection`,
`packages/editor/src/debug`

Original evidence:

- Gate 7C moved Debug Log to `ScrollViewComponent` / `ListViewComponent` and
  stable log item actors.
- `ListViewComponent` currently has `frameUpdateAttachment`, so opening Debug
  causes `refreshItems()` to run every UI frame.
- `refreshItems()` walks child actors, reads item components, sorts rows,
  rewrites row DOM state, and appends rows even when no log data changed.
- Debug log append also reconciles up to `maxLines` per-log actors/components.
- Browser probing found continuous ListView row append work while Debug is
  open; closing Debug drops that work to zero and restores smoother frame
  cadence.

Closure:

- Gate 7C.5 removed `ListViewComponent`'s frame attachment and replaced Debug's
  per-log actor path with a Debug-owned fixed-height ring-buffer data source
  consumed by `VirtualListViewComponent`.
- `DebugLogEntryActorReconciler` and `isDebugLogEntryActorId` were deleted, and
  ToolWindow Hierarchy no longer needs Debug log actor filtering because log
  rows are private virtual-list DOM, not actors.
- Fresh browser evidence in
  `temp/project-arbor-gate-7c-5-debug-performance-data.json` records
  `itemCount: 200`, a bounded virtual row pool, zero Debug virtual-list DOM
  mutations or rebind batches during a 500ms open-idle probe, append bursts
  creating/removing zero virtual rows while touching only the bounded row pool,
  successful bottom/non-bottom scroll anchoring, Debug close/reopen, and zero
  Debug log row leakage into Hierarchy.

Impact:

- Retained for handoff context. The original regression is fixed and should not
  block Gate 7D.

Follow-up:

- If a future log view needs wrapped/variable-height rows, design a separate
  variable-height virtualization contract instead of weakening the fixed-height
  `VirtualListViewComponent`.

Verification:

- Targeted unit, typecheck, build, architecture-boundary, and fresh Gate 7C.5
  browser smoke validation passed during closure.

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

### BUILD-001: Vite production build reports chunk-size warning

Status: `watch`

Area: `apps/wallpaper-tesseract` production bundle

Evidence:

- Project Prism Final Gate `npm run build` passes, but Vite still reports the
  existing warning that some chunks exceed the default 500 kB limit.

Impact:

- This does not block Project Prism architecture closure or functional smoke
  verification.
- It may become a product performance concern if startup or Wallpaper Engine
  loading time becomes a real user-facing issue.

Next action:

- Treat this as ordinary build/performance maintenance, not a Project Prism
  compatibility task.
- If it becomes actionable, profile the actual production bundle first, then
  prefer deleting unused code or owner-local lazy loading over broad manual
  chunking rules.

Verification:

- `npm run build` must continue to pass. Any future fix should compare bundle
  output before and after and avoid weakening package boundaries.

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

Status: `closed`

Area: workspace dev/build tooling

Evidence:

- During dock debugging, changing `packages/ui-framework/src` did not affect
  the running app until `npm run build -w ui-framework` regenerated `dist`.

Impact:

- Browser verification can accidentally run stale package code.
- Debug sessions may appear contradictory when source tests pass but the app
  still runs old package output.

Completed decision:

- Keep the package `dist` contract for app dev/smoke. This avoids Vite source
  aliases, app-local package `src` imports, and compatibility barrels that
  would weaken package boundary tests.
- Browser smoke must run the explicit package build contract before starting
  the app dev server:

```powershell
npm run prism:smoke:prepare
npm run dev -w wallpaper-tesseract
```

Verification:

- `npm run prism:smoke:prepare` rebuilds workspace package output in dependency
  order. A package source change has a reproducible path into the running app
  before browser verification without changing runtime imports or Vite
  resolution.

### DCK-006: Floating Debug tab cannot dock into root Scene during Phase 8 smoke

Status: `closed`

Area: `apps/wallpaper-tesseract/src/window-runtime`,
`packages/ui-framework/src/chrome`, `packages/ui-framework/src/model`,
`packages/ui-framework/src/services`

Original evidence:

- During Phase 8 Step 7 smoke, the app booted at
  `http://127.0.0.1:5173/?resetWorkspaceLayout=1`.
- Dragging the floating `Debug` tab into the root `Scene` content area did not
  dock; DOM still showed `Debug` under `.floating-gizmo-window__titlebar`.
- Retrying against the Scene tab strip and Scene right-edge target also left
  `Debug` floating.
- `npm run build -w ui-framework` was run before a final retry to rule out the
  known stale package-output issue from `DEV-001`; the dock still failed.
- Evidence files:
  - `temp/project-prism-phase-8-smoke-report.md`
  - `temp/project-prism-phase-8-smoke-blocker-data.json`
  - `temp/project-prism-phase-8-dock-debug-into-scene.png`
  - `temp/project-prism-phase-8-dock-debug-into-scene-attempt-2.png`
  - `temp/project-prism-phase-8-dock-debug-into-scene-after-ui-framework-build.png`

Impact:

- Phase 8 cannot close because its fresh smoke contract requires a visual
  Debug/Scene dock mutation with graph/DOM evidence.
- This is not a smoke validator gap: the visual DOM after the drag does not show
  a docked root layout.

Completed fix:

- The primary failure branch was `test-driver-did-not-hit-tab-drag-path` /
  floating-frame tab drag state loss.
- `FloatingWindowComponent` now tracks an active tab drag for the whole pointer
  session, matching the root frame behavior, so moving away from the tab no
  longer falls through to floating-window movement.
- `handleWindowFrameTabInputEnd` now commits an already-started tab drag
  independently of the release hit part. The session state, not the final DOM
  hit, owns dock intent generation.
- A focused `floating-window-component.test.ts` regression proves that a drag
  starting on the Debug tab and ending on a non-tab hit still moves the tab
  drag session, submits a split dock intent, and leaves the floating window
  position unchanged.

Verification completed:

- Browser verification at `http://127.0.0.1:5173/?resetWorkspaceLayout=1`
  docked floating Debug into the root Scene right split; floating Debug shell
  count became `0`.
- Fresh evidence:
  - `temp/dck-006-debug-docked-into-scene-fixed.png`
  - `temp/project-prism-phase-8-smoke-data.json`
  - `temp/project-prism-phase-8-smoke-report.md`
- `$env:PROJECT_PRISM_SMOKE_EVIDENCE="temp/project-prism-phase-8-smoke-data.json"; npm run test -w wallpaper-tesseract -- project-prism-smoke-evidence-file`
- `npm run test -w wallpaper-tesseract -- floating-window-component window-frame-tab-input architecture-boundaries`
- `npm run test -w ui-framework -- window-tab-drag-session window-dock-targets dock-target-region-source window-dock-preview-component`
- Root `npm run test`, `npm run typecheck`, and `npm run build`.

### DCK-007: Scene root tab cannot visually dock into Debug during Phase 9 smoke

Status: `closed`

Area: `apps/wallpaper-tesseract/src/window-runtime`,
`packages/ui-framework/src/chrome`, `packages/ui-framework/src/model`,
`packages/ui-framework/src/services`

Evidence:

- Phase 9 fresh browser smoke used
  `http://127.0.0.1:5174/?resetWorkspaceLayout=1` after rebuilding the editor
  package and starting the app dev server.
- The prerequisite paths passed:
  - Window menu hover targeted `Debug Log Window`.
  - Scene close/reopen was repeated 3 times and Hierarchy showed `Scene View`,
    `Tesseract4`, and `Camera3` exactly once.
  - Floating `Debug` docked into the root `Scene` right split; floating Debug
    shell count became `0`.
- The original reverse path failed visually and structurally:
  - dragging `Scene` tab into the `Debug` pane left/internal region did not
    change the DOM layout;
  - dragging `Scene` tab into the `Debug` pane bottom region did not change the
    DOM layout;
  - dragging `Scene` tab onto the `Debug` tab strip did not merge or split the
    layout.
- Evidence files:
  - `temp/project-prism-phase-9-smoke-blocker-report.md`
  - `temp/project-prism-phase-9-smoke-blocker-data.json`
  - `temp/project-prism-phase-9-debug-docked-into-scene.png`
  - `temp/project-prism-phase-9-scene-docked-into-debug.png`
  - `temp/project-prism-phase-9-scene-docked-into-debug-bottom.png`
  - `temp/project-prism-phase-9-scene-merge-into-debug-attempt.png`

Impact:

- Phase 9 cannot close because its fresh smoke matrix requires bidirectional
  Debug/Scene dock visual success.
- The first reverse retest after the code fix exposed a stale smoke setup issue:
  the Hierarchy floating window was covering the Scene root tab, so the drag did
  not start from the intended tab. After closing that overlay, the root Scene tab
  was accessible and the fixed root drag session completed the reverse dock.

Next action:

- Closed by the nearest owner fix:
  `WorkspaceRootDockFrameComponent` now keeps an active root tab drag session
  moving after the pointer leaves the tab hit, matching `FloatingWindowComponent`.
  No product installer, app-menu, workspace-mode, graph reducer, or compatibility
  dock path was restored.

Verification:

- Add or update owner-level regression coverage for the failing same-frame
  Scene-to-Debug path.
- Code fix and owner tests have passed:
  - `WorkspaceRootDockFrameComponent` now keeps an active root tab drag session
    moving after the pointer leaves the tab hit.
  - `WorkspaceRootDockFrameComponent.onInputCancel` now cancels an active tab
    drag even when the cancel hit is non-tab content.
  - `workspace-root-dock-frame-component.test.ts` covers tab start hit plus
    non-tab move/end and non-tab cancel.
  - `npm run test -w wallpaper-tesseract -- workspace-root-dock-frame-component floating-window-component window-frame-tab-input`
  - `npm run test -w wallpaper-tesseract -- architecture-boundaries`
  - `npm run test -w ui-framework -- window-dock-targets window-tab-drag-session`
- Fresh Phase 9 browser smoke generated:
  - `temp/project-prism-phase-9-smoke-data.json`
  - `temp/project-prism-phase-9-smoke-report.md`
- The smoke evidence validator passed:
  - `$env:PROJECT_PRISM_SMOKE_EVIDENCE="temp/project-prism-phase-9-smoke-data.json"; npm run test -w wallpaper-tesseract -- project-prism-smoke-contract project-prism-smoke-evidence-file`
- DCK-007 blocker data remains historical failure evidence and must not be used
  as pass-state smoke evidence.

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
- DCK-006: closed by the Phase 8 dock blocker fix; floating tab-drag state is
  now session-owned through `FloatingWindowComponent` and
  `handleWindowFrameTabInputEnd`, with fresh Phase 8 smoke evidence.
- DCK-007: closed by the Phase 9 root dock owner fix; root tab-drag state now
  continues after the pointer leaves the tab hit, with fresh Phase 9 and Phase
  10 smoke evidence covering bidirectional Debug/Scene dock.

Move entries here only when retaining the full active-entry detail no longer
helps future agents.
