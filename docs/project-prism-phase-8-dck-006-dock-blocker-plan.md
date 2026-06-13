# Project Prism Phase 8 DCK-006 Dock Blocker Resolution Plan

Status: complete on 2026-06-13. The blocker was fixed and validated by fresh
Phase 8 smoke evidence.

Parent plan:

```text
docs/project-prism-phase-8-runtime-scene-composition-plan.md
```

Blocking defect:

```text
docs/known-defects-and-todos.md#dck-006-floating-debug-tab-cannot-dock-into-root-scene-during-phase-8-smoke
```

Current evidence:

```text
temp/project-prism-phase-8-smoke-report.md
temp/project-prism-phase-8-smoke-blocker-data.json
temp/project-prism-phase-8-dock-debug-into-scene.png
temp/project-prism-phase-8-dock-debug-into-scene-attempt-2.png
temp/project-prism-phase-8-dock-debug-into-scene-after-ui-framework-build.png
```

Phase 8 Step 7 now has a passing `temp/project-prism-phase-8-smoke-data.json`.

Resolution summary:

- Primary failure branch:
  `test-driver-did-not-hit-tab-drag-path`.
- Root cause: `FloatingWindowComponent` did not retain tab-drag state across
  the full pointer session. When the pointer moved/released outside the tab hit,
  floating-frame handling could fall through to window movement instead of tab
  dock intent.
- Production fix: floating frames now track `#draggingTab` like the root frame,
  and `handleWindowFrameTabInputEnd` commits an already-started tab drag without
  requiring the release hit to still be `WINDOW_FRAME_TAB_PART_ID`.
- No compatibility dock path, DOM listener shortcut, graph cache, or Debug Log
  placement authority was added.

## Non-Negotiables

- Do not weaken the Phase 8 smoke contract.
- Do not accept a pointer log, `capture=1`, or a floating-frame move as dock
  success. The visual root DOM layout must change.
- Do not add a compatibility dock path, coordinate-specific workaround, or
  fallback that bypasses `WindowWorkspaceGraph` / lifecycle ownership.
- Do not create a second placement truth, dock target cache, graph snapshot
  store, or Debug Log placement authority.
- Prefer deleting stale targetability/geometry/preview paths over layering new
  selection logic onto them.
- Any diagnostic surface added for the investigation must be test-support or
  narrow returned evidence only, and must not become a production owner.

## Desired Passing Behavior

Starting from:

- Root workspace has `Scene`.
- `Debug` is floating.
- User drags the `Debug` tab into a valid root `Scene` dock target area.

Expected:

- Dock preview resolves to a semantic root target, not a floating preview.
- `handleWindowFrameTabInputEnd` produces:
  - the preview target;
  - a `WindowDockCommitIntent`;
  - a `WindowDockCommitResult`.
- `requestCommitDock` returns `{ committed: true }`.
- `WindowWorkspaceGraph` revision advances.
- DOM realization moves Debug into the root frame/split/tabset and removes the
  stale floating Debug shell/content.
- Phase 8 smoke records this in `dockMutation`.

## Step 0: Preserve The Failure Baseline

Status: complete.

Purpose: keep the current real-browser failure reproducible while debugging.

Work:

- Keep the existing blocker files in `temp/` as immutable baseline evidence.
- Rebuild workspace packages before every browser attempt that depends on
  package source changes:

```text
npm run build -w ui-framework
npm run build -w actor-input
npm run build -w editor
npm run dev -w wallpaper-tesseract
```

- Reproduce from a reset layout:

```text
http://127.0.0.1:5173/?resetWorkspaceLayout=1
```

- Start from the default root `Scene` plus floating `Debug` layout unless a test
  explicitly states another setup.

Exit:

- A fresh reproduction confirms whether the failure still exists after any
  current uncommitted changes.
- The reproduction records whether `Debug` stayed floating, docked as a tab, or
  docked as a split.

## Step 1: Capture The Semantic Dock Chain

Status: complete. The semantic chain is covered by
`floating-window-component.test.ts`, `window-frame-tab-input.test.ts`, and the
fresh browser smoke evidence.

Purpose: locate the failing layer before changing behavior.

Trace the existing production path, starting at:

```text
apps/wallpaper-tesseract/src/window-runtime/window-frame-tab-input.ts
apps/wallpaper-tesseract/src/window-runtime/floating-window-component.ts
apps/wallpaper-tesseract/src/window-runtime/workspace-root-dock-frame-component.ts
apps/wallpaper-tesseract/src/features/window-workspace/install-window-workspace-feature.ts
packages/ui-framework/src/model/window-tab-drag-session.ts
packages/ui-framework/src/model/window-dock-targets.ts
packages/ui-framework/src/ports/dock-target-region-source.ts
packages/ui-framework/src/services/window-frame-lifecycle-controller.ts
packages/ui-framework/src/services/window-workspace-graph-reconciler.ts
```

Required evidence for one failing drag:

- Source:
  - source frame id;
  - source tabset id if present;
  - source view actor id / view key.
- Move/preview:
  - point used by `moveTabDrag`;
  - count and ids of `DockTargetRegionSource.listDockTargetRegions()`;
  - selected preview kind/operation/target frame/target tabset/placement/rect.
- Commit:
  - generated `WindowDockCommitIntent`;
  - `WindowDockCommitResult`;
  - graph revision before/after.
- DOM realization:
  - root frame tabs before/after;
  - floating Debug shell before/after;
  - content placement before/after.

Preferred implementation:

- First add targeted unit/component coverage using existing return values:
  `handleWindowFrameTabInputEnd` already returns `dockCommit`.
- If browser trace is needed, expose only a narrow test-support evidence hook
  or smoke-only collector that reads the existing `dockCommit` result. Do not
  make Debug Log, app menu, or any long-lived service own placement diagnostics.

Exit:

- The failure is classified into exactly one primary branch:
  - `preview-floating-or-null`
  - `commit-rejected`
  - `graph-committed-dom-stale`
  - `test-driver-did-not-hit-tab-drag-path`
- If multiple branches appear, fix the earliest semantic failure first.

Actual classification:

- `test-driver-did-not-hit-tab-drag-path`: the active drag began on a tab, but
  floating-frame code did not retain that fact through move/end when the hit
  changed. The root frame already carried this state; floating now matches it.

## Step 2A: If Preview Is Floating Or Null, Fix Target Region Ownership

Likely symptom:

- `WindowTabDragSession.end()` returns preview kind `floating`; or no preview is
  produced even though the pointer is inside the root Scene region.

Investigate:

```text
packages/ui-framework/src/ports/dock-target-region-source.ts
packages/ui-framework/src/model/window-dock-targets.ts
packages/ui-framework/src/chrome/window-dock-preview-component.ts
apps/wallpaper-tesseract/src/features/window-workspace/install-window-workspace-feature.ts
```

Questions to answer with tests:

- Does `createDockTargetRegionSource` include the root frame while dragging a
  floating tab?
- Are root `tabBounds` and `contentBounds` measured in viewport coordinates and
  non-zero?
- Does stack priority accidentally make the source floating frame the only
  effective target?
- Is the source frame excluded correctly without excluding all cross-frame
  root targets?
- Does `resolveWindowDockPreview` return a root split/merge preview for the
  blocker data points?

Allowed fixes:

- Delete stale geometry/targetability branches that return fallback or empty
  regions when graph surface geometry is available.
- Make region production purely graph/surface-geometry based when possible.
- Narrow targetability to frame-level facts only: visible, active in hierarchy,
  can receive dock targets, stack priority.

Forbidden fixes:

- Hard-code Scene, Debug, root frame ids, or screen coordinates.
- Add a second dock target source outside graph/surface geometry.
- Make floating frame movement decide whether a dock target is valid.

Required tests:

```text
npm run test -w ui-framework -- dock-target-region-source window-dock-targets window-tab-drag-session window-dock-preview-component
npm run test -w wallpaper-tesseract -- architecture-boundaries project-prism-boundary-report
```

## Step 2B: If Commit Is Rejected, Fix Lifecycle/Graph Ownership

Likely symptom:

- Preview is `split` or `merge-tabs`, but `requestCommitDock` returns
  `{ committed: false, reason: ... }`.

Investigate:

```text
packages/ui-framework/src/services/window-frame-lifecycle-controller.ts
packages/ui-framework/src/model/window-workspace-graph.ts
packages/ui-framework/src/services/window-frame-lifecycle.ts
```

Questions to answer with tests:

- Is the source view still live when the floating tab commit runs?
- Is the target frame/tabset still live and visible?
- Is the operation incorrectly downgraded to float or no-op?
- Does graph transaction validation reject a legitimate cross-frame split/merge?
- Does source removal happen before target split id allocation and validation?

Allowed fixes:

- Simplify lifecycle commit branching so cross-frame floating -> root dock uses
  the same graph-owned transaction path as other dock commits.
- Delete caller-side id derivation or stale source/target assumptions if any
  remain.
- Strengthen graph/lifecycle tests around the exact floating Debug -> root
  Scene path.

Forbidden fixes:

- Bypass lifecycle by mutating frame surfaces directly.
- Reintroduce public graph transaction ids or frame-local dock tree state.
- Swallow a rejected commit and visually move DOM anyway.

Required tests:

```text
npm run test -w ui-framework -- window-frame-lifecycle-controller window-workspace-graph
npm run test -w wallpaper-tesseract -- window-frame-tab-input architecture-boundaries project-prism-boundary-report
```

## Step 2C: If Graph Commits But DOM Is Stale, Fix Reconciler/Surface Realization

Likely symptom:

- `WindowDockCommitResult.committed === true` and graph revision advances, but
  Debug remains visibly floating or duplicated.

Investigate:

```text
packages/ui-framework/src/services/window-workspace-graph-reconciler.ts
packages/ui-framework/src/chrome/window-frame-surface-component.ts
apps/wallpaper-tesseract/src/window-runtime/floating-window-component.ts
apps/wallpaper-tesseract/src/window-runtime/workspace-root-dock-frame-component.ts
```

Questions to answer with tests:

- Does reconciler call `removeContent` on the previous floating frame surface?
- Does reconciler call `placeContent` on the root frame surface?
- Does `setContentActive` make only active root content interactable?
- Is an empty floating frame removed/closed after its content moves?
- Does any surface keep stale DOM parent ownership after graph placement moves?

Allowed fixes:

- Delete stale shell/content retention paths that survive after graph placement
  changes.
- Keep DOM placement as realization of graph placement only.
- Add tests proving content has exactly one parent after cross-frame dock.

Forbidden fixes:

- Add a shell-local list of tabs/contents to synchronize with graph.
- Preserve empty floating shells as a compatibility fallback for moved content.
- Let surface code decide placement independent of graph.

Required tests:

```text
npm run test -w ui-framework -- window-workspace-graph-reconciler window-frame-surface-component window-frame-lifecycle-controller
npm run test -w wallpaper-tesseract -- architecture-boundaries project-prism-boundary-report
```

## Step 2D: If The Browser Driver Misses The Tab Drag Path, Fix Input Routing

Status: complete. This was the active branch.

Likely symptom:

- Component/unit tests pass, but real browser drag does not produce tab drag
  preview/intent because the active input path changes, capture ends, or the
  floating tab is treated as titlebar movement.

Investigate:

```text
apps/wallpaper-tesseract/src/window-runtime/floating-window-component.ts
apps/wallpaper-tesseract/src/window-runtime/workspace-root-dock-frame-component.ts
packages/actor-input/src/actor-input-router.ts
packages/gizmo-core/src/gizmo-event-system.ts
```

Questions to answer with tests:

- Does floating window keep tab-drag state from pointer start through pointer
  end, independent of the pointer's final hit region?
- Does `onInputMove` call `moveTabDrag` for the whole active drag?
- Does `onInputEnd` pass `draggingTab: true` when the drag began on a tab?
- Is `buttons-zero-without-capture` only a misleading log, or does the active
  drag actually stop?

Allowed fixes:

- Track tab-drag state in the frame component that started the drag, like the
  root frame already does.
- Delete duplicated or inconsistent floating/root tab drag handling by sharing
  a small local helper if it removes real duplication.
- Keep actor-input as the route owner; frame components should still only emit
  lifecycle intent.

Forbidden fixes:

- Add DOM-level mouse listeners as a shortcut around actor input.
- Use titlebar movement as a fallback for failed tab drag.
- Add a second capture state outside actor-input/gizmo-core.

Required tests:

```text
npm run test -w wallpaper-tesseract -- floating-window-component window-frame-tab-input architecture-boundaries project-prism-boundary-report
npm run test -w actor-input
npm run test -w gizmo-core
```

Executed validation:

```text
npm run test -w wallpaper-tesseract -- floating-window-component window-frame-tab-input architecture-boundaries
npm run test -w ui-framework -- window-tab-drag-session window-dock-targets dock-target-region-source window-dock-preview-component
npm run typecheck -w wallpaper-tesseract
npm run typecheck -w ui-framework
npm run test
npm run typecheck
npm run build
```

## Step 3: Add The Smallest Durable Regression

Status: complete.

Purpose: keep the fixed path from regressing without broad fake facades.

Required coverage:

- One nearest-owner unit/integration test for the classified failure branch.
- One app/window-runtime test proving the returned `dockCommit` evidence chain
  for floating Debug -> root Scene.
- One browser smoke capture after the fix proving the visual root DOM layout
  changes.

Test rules:

- Do not use casts to bypass public contracts.
- Do not create fake placement facades that preserve removed APIs.
- Fake DOM/ports are allowed only when they model the current owner contract
  directly and are smaller than spinning up the whole app.

## Step 4: Complete Phase 8 Step 7

Status: complete.

After the production fix and regression tests:

1. Rebuild package output used by the app dev server:

```text
npm run build -w ui-framework
npm run build -w actor-input
npm run build -w editor
```

2. Run the Phase 8 browser smoke actions:

- boot with zero console errors;
- Window menu hover highlight follows hovered row;
- Debug -> Scene dock succeeds visually and records graph/DOM mutation;
- Scene fullscreen enter/exit restores graph/DOM/input parity;
- mobile viewport keeps menu, Scene, Tesseract/canvas, and Camera3 gizmo
  measurable;
- Camera3 interaction changes camera/view-state evidence.

3. Write:

```text
temp/project-prism-phase-8-smoke-data.json
temp/project-prism-phase-8-smoke-report.md
```

4. Validate:

```text
$env:PROJECT_PRISM_SMOKE_EVIDENCE="temp/project-prism-phase-8-smoke-data.json"; npm run test -w wallpaper-tesseract -- project-prism-smoke-evidence-file
```

## Final Gate

Status: complete.

DCK-006 is closed only when all are true:

- The semantic chain has been captured and the primary failure branch is named.
- The production fix lives in the nearest owner and deletes any stale path it
  replaces.
- No new compatibility dock path, DOM listener shortcut, graph cache, or Debug
  placement authority exists.
- Targeted tests for the fixed branch pass.
- Phase 8 smoke data exists and passes the evidence-file validator.
- Root validation passes:

```text
npm run test
npm run typecheck
npm run build
```

- `docs/known-defects-and-todos.md`, `docs/current-project-progress.md`, and
  the parent Phase 8 plan are updated from blocked to closed/complete.
