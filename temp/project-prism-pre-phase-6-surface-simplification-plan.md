# Project Prism Pre-Phase 6 Surface Simplification Plan

Last updated: 2026-06-12

Status: implementation executed on 2026-06-12. Phase 6 remains blocked until
the final browser smoke gate proves graph/DOM/input/persistence parity and the
`window-workspace-multi-truth-debt` boundary blocker is removed.

Review amendments applied: full surface active/focus truth deletion checks,
runtime dock-root source type deletion, explicit reconciler stale-content
cleanup semantics, and content registry filename split.

This plan replaces the previous `temp/` handoff plans and reports. The older
temporary documents, smoke screenshots, logs, and working traces were removed
from the working tree on 2026-06-12. Historical context should now be recovered
from Git history, `docs/current-project-progress.md`, and this active plan.

## Current Verified State

The handoff state has been checked against the current implementation rather
than accepted from memory.

- `WindowWorkspaceGraph` is the intended placement truth for production
  placement mutation.
- `WindowFramePort` has been reduced to shell/presentation behavior.
- Public `ui-framework` and app-local barrels no longer expose
  `WindowContentHost`, `WindowContentAttachment`, or placement attachment
  factory APIs.
- Root and floating frame components no longer expose the old public placement
  forwarding methods.
- Production window lifecycle no longer exposes graph diagnostic
  adapter/source/result contracts.
- `npm run typecheck:test -w ui-framework` now passes, so test fixtures can no
  longer be ignored as an untyped legacy surface.

The surface internals and old model tests no longer preserve a second placement
implementation under the graph projection path.

## Execution Result

Completed in this slice:

- `WindowFrameSurfaceComponent` now renders `WindowFrameSurfaceSnapshot`
  directly and exposes only reconciler-facing `placeContent`, `removeContent`,
  and `setContentActive` realization operations for content placement.
- `WindowWorkspaceGraphReconcilerSurface` now has explicit stale-content
  cleanup and active/interactable operations, and reconciler tests implement
  that contract.
- `window-content-host.ts`, host/attachment types, attachment factories, and
  attachment tests were deleted. Surviving registration/layout concepts moved
  to `window-content-registry.ts`.
- `WindowDockSurfaceModel`, `window-frame-dock-tree`, their tests, their public
  exports, and app-local runtime dock-root re-exports were deleted.
- `window-frame-tab-chrome` and hit data no longer import old dock-tree types.
- Boundary tests now require the deleted files to stay absent and reject old
  surface placement/focus APIs.

Still pending before Phase 6:

- Run final browser smoke for dock mutation, fullscreen restore, persistence
  reload, mobile tab close/menu focus, graph/DOM/input parity, and console
  errors.
- Remove `window-workspace-multi-truth-debt` from boundary facts only after
  that smoke evidence is collected and any issues are fixed by deletion or
  simplification, not compatibility.

## Deleted Debt Facts

These facts were deleted or collapsed by the implementation slice.

- `packages/ui-framework/src/chrome/window-frame-surface-component.ts` no longer
  owns legacy placement fields and methods internally:
  `#tabs`, `#root`, `#focusedViewActorId`, `listTabs`,
  `getRuntimeDockRoot`, `restoreRuntimeDockRoot`, `listDockTargetTabsets`,
  `getFocusedViewActorId`, `getActiveViewActorIds`, `isViewActiveInFrame`,
  `isViewVisibleInFrame`, `addTab`, `splitTab`, `removeTab`, `activateTab`,
  `hasTab`, `hasTabset`, `getContentHost`, and `mountContent`.
- The surface no longer converts graph snapshots back into
  `WindowFrameDockTreeNode`.
- `packages/ui-framework/src/ports/window-content-host.ts` no longer exists.
- `packages/ui-framework/src/model/window-dock-surface-model.ts` and
  `packages/ui-framework/src/model/window-frame-dock-tree.ts` no longer exist.
- `window-frame-tab-chrome` and `window-frame-hit-data` now type against
  graph/snapshot-local inputs instead of old dock tree types.
- App-local window-runtime barrels no longer re-export runtime dock-tree types
  such as `WindowFrameRuntimeDockNode` and `WindowFrameDockTargetTabset`.
- The source definitions for those runtime dock-root types were deleted from
  `packages/ui-framework/src/model/window-frame-tab.ts`.
- Boundary facts still include `window-workspace-multi-truth-debt`, and final
  browser smoke has not yet proved graph, DOM, actor-input, and persistence
  parity.

## Non-Negotiable Rules

- Do not add compatibility facades, aliases, or test-only fake ports to keep old
  placement methods compiling.
- Do not preserve old tests by casting through `unknown`, `any`, or fake
  legacy implementations. Rewrite tests around graph snapshots, lifecycle
  intents, DOM realization, and actor-input hit behavior.
- Delete obsolete implementation and obsolete tests in the same slice.
- Prefer direct graph snapshot rendering over adapters that translate snapshots
  into older dock-tree structures.
- The surface may remember DOM realization details, but it must not own
  placement truth.
- Reconciler/surface contracts must explicitly remove stale content and update
  active/interactable state after every graph commit. Do not rely on attachment
  disposal side effects or previous DOM state.
- Any new helper must replace more old code than it adds and must have one
  clear owner.

## Step 1: Collapse `WindowFrameSurfaceComponent` To Snapshot-Only Rendering

Goal: the surface renders `WindowFrameSurfaceSnapshot` and reports graph-keyed
geometry; it no longer owns tabs, dock roots, active view truth, or placement
mutation.

Delete from the surface:

- `#tabs`, `#root`, `#focusedViewActorId`.
- All public/internal placement read and mutation methods listed in the debt
  facts above.
- `snapshotNodeToDockTree` and all imports from
  `../model/window-frame-dock-tree`.
- The surface-local conversion path that rehydrates runtime dock roots.

Keep or replace only with graph-derived facts:

- `#lastSnapshot` as the only placement snapshot remembered by the surface.
- DOM maps keyed by graph ids: frame id, tabset id, split id, content id, and
  view actor id only where needed to place registered content.
- Splitter resize tracking by graph split id.
- `placeContent`, `removeContent`, and `setContentActive` as reconciler-facing
  DOM realization operations, not public content host APIs.
- Geometry and hit data derived from rendered DOM and graph snapshot ids.

Update the graph reconciler surface contract in the same step:

- Extend `WindowWorkspaceGraphReconcilerSurface<TContent>` beyond
  `renderFrameSurface`, `measureFrameSurfaceGeometry`, and `placeContent`.
- Add an explicit stale-content cleanup operation, keyed by graph
  `contentId`, that detaches content no longer present in the next projection
  and clears surface DOM maps.
- Add an explicit active-state operation, keyed by graph `contentId`, that
  makes currently active and visible content interactable and makes inactive,
  hidden, or previously active content non-interactable.
- Reconciler commits must call these operations from previous/next graph
  placement diffs. Close, dock, undock, fullscreen restore, and reopen must not
  depend on old attachment disposal to clear DOM or interactability.
- Tests should cover removal and active-state transitions through the
  reconciler contract, not by directly mutating surface internals.

Rewrite `window-frame-surface-component.test.ts` around:

- Rendering a single-tab snapshot.
- Rendering tabsets and splits directly from snapshot nodes.
- Calling graph reconciler surface operations to place/remove content.
- Verifying one DOM parent per content id.
- Verifying inactive tabs are not interactable.
- Verifying tab chrome, close/float actions, splitter hit data, and content hit
  data report graph ids rather than old dock-tree ids.
- Verifying layout commit callbacks fire from direct content placement.

Exit criteria:

- `rg "#tabs\\b|#root\\b|#focusedViewActorId\\b|getRuntimeDockRoot|restoreRuntimeDockRoot|listDockTargetTabsets|listTabs|getFocusedViewActorId|getActiveViewActorIds|isViewActiveInFrame|isViewVisibleInFrame|addTab|splitTab|removeTab|activateTab|hasTab|hasTabset|getContentHost|mountContent" packages/ui-framework/src/chrome/window-frame-surface-component.ts` returns no matches.
- The surface no longer imports `window-frame-dock-tree`.
- `WindowWorkspaceGraphReconcilerSurface` includes explicit stale-content
  cleanup and active-state operations, and reconciler tests prove those calls.
- Surface tests do not call removed methods.

## Step 2: Delete Content Host / Attachment Mechanics

Goal: registered window content is placed directly by the graph reconciler and
surface DOM slots. There is no host/attachment API, even internally.

Delete:

- `WindowContentHost`.
- `WindowContentAttachment`.
- `WindowContentAttachmentRequest`.
- `createWindowContentAttachment`.
- `getWindowContentAttachment`.
- Attachment weak maps and element back-pointers.
- `packages/ui-framework/src/ports/window-content-host.test.ts` if it only
  tests deleted attachment mechanics.

Move the surviving registry concepts to a renamed file such as
`packages/ui-framework/src/ports/window-content-registry.ts`. Do not leave them
in `window-content-host.ts`, because the old filename would preserve the host
concept as project vocabulary.

Keep only the registry concepts that are still required:

- `WindowRegisteredContent`.
- `WindowContentRegistry`.
- `WindowContentRegistrationPort`.
- `WindowContentLayoutCommit`.
- `WindowContentLayoutCommitCallback`.

Implementation direction:

- `WindowRegisteredContent` owns the element and layout commit subscription.
- The surface places the registered element into the current content slot.
- Disposing or removing content detaches the element and unsubscribes any layout
  commit callback.
- No API returns an attachment object that can become a parallel lifecycle
  owner.
- `window-content-host.ts` should be deleted, not left as a renamed host with
  fewer exports. Update imports and tests to use the new registry filename.

Exit criteria:

- `rg "WindowContentHost|WindowContentAttachment|createWindowContentAttachment|getWindowContentAttachment" packages/ui-framework/src apps/wallpaper-tesseract/src` only matches boundary tests or this plan.
- `rg "window-content-host" packages/ui-framework/src apps/wallpaper-tesseract/src` only matches deletion history outside source, not production or tests.
- Public and app-local barrels still do not export content host or attachment
  names.

## Step 3: Delete Old Dock Surface Models

Goal: remove the old dock-tree and dock-surface model after snapshot rendering
no longer depends on them.

Delete:

- `packages/ui-framework/src/model/window-dock-surface-model.ts`.
- `packages/ui-framework/src/model/window-dock-surface-model.test.ts`.
- `packages/ui-framework/src/model/window-frame-dock-tree.ts`.
- `packages/ui-framework/src/model/window-frame-dock-tree.test.ts`.
- Any `export * from "./model/window-frame-dock-tree"` public barrel export.
- Source definitions and app-local re-exports of `WindowFrameRuntimeDockNode`,
  `WindowFrameRuntimeSplitNode`, `WindowFrameRuntimeTabsetNode`, and
  `WindowFrameDockTargetTabset`. These currently originate in
  `packages/ui-framework/src/model/window-frame-tab.ts`; keeping them there
  would preserve the old dock-root shape as reusable public model.

Required rewrites:

- `window-frame-tab-chrome` should accept a minimal graph snapshot tabset render
  input instead of `WindowFrameDockTreeTabsetNode`.
- `window-frame-hit-data` should use either graph snapshot split direction or a
  local `"horizontal" | "vertical"` type, not dock-tree types.
- `window-frame-tab.ts` should keep only tab/view identity concepts that are
  still graph-neutral. Runtime dock-root node names must be deleted or renamed
  to `WindowWorkspaceGraph*` / snapshot semantics owned by the graph model.
- Any remaining tests should be graph snapshot tests. Do not retain old
  dock-tree unit tests as an alternate placement specification.

Exit criteria:

- `rg "WindowDockSurfaceModel|window-dock-surface-model|WindowFrameDockTree|window-frame-dock-tree|WindowFrameRuntimeDockNode|WindowFrameRuntimeSplitNode|WindowFrameRuntimeTabsetNode|WindowFrameDockTargetTabset" packages/ui-framework/src apps/wallpaper-tesseract/src` only matches boundary tests or this plan.
- `packages/ui-framework/src/model` contains no second dock placement model.

## Step 4: Tighten Boundary Facts

Goal: make the deletion irreversible before Phase 6.

Add or update boundary checks so production and public source cannot reintroduce:

- Surface placement read/mutation APIs.
- `WindowContentHost` / `WindowContentAttachment`.
- `WindowDockSurfaceModel`.
- `WindowFrameDockTree*`.
- `WindowFrameRuntimeDockNode`, `WindowFrameRuntimeSplitNode`,
  `WindowFrameRuntimeTabsetNode`, and `WindowFrameDockTargetTabset` from both
  source model files and app-local barrels.
- `window-content-host.ts` as a source/test filename after registry migration.
- Lifecycle diagnostic adapter/source/result production contracts.

Do not remove `window-workspace-multi-truth-debt` in this step. The blocker is
removed only after the final browser smoke proves runtime behavior.

Exit criteria:

- Architecture boundary tests fail if any old placement API is reintroduced in
  public or production paths.
- Boundary facts still mark Phase 6 blocked until smoke evidence exists.

## Step 5: Verification Matrix

Run these after the deletion slice:

```text
npm run typecheck -w ui-framework
npm run typecheck:test -w ui-framework
npm run test -w ui-framework
npm run build -w ui-framework
npm run typecheck -w wallpaper-tesseract
npm run test -w wallpaper-tesseract
npm run build -w wallpaper-tesseract
```

Then run root checks before declaring the pre-Phase 6 gate ready:

```text
npm run test
npm run typecheck
npm run build
```

Finally run browser smoke with:

```text
npm run dev -w wallpaper-tesseract
```

The smoke report must record:

- Graph frame, tabset, split, and content ids.
- Each content id's single DOM parent.
- Splitter hit regions mapped to graph split ids.
- Active tab/content parity with graph projection.
- Actor-input hits for tab, content, and splitter surfaces.
- 5B/5C dock mutation coverage.
- Scene fullscreen restore coverage.
- Persistence reload without actor ids.
- Mobile tab close/menu focus coverage.
- Console errors equal 0.

## Phase 6 Entry Criteria

Phase 6 can start only when all are true:

- No old content host/attachment implementation remains.
- No old dock surface model or dock-tree model remains.
- The surface is a graph snapshot DOM realization layer, not a placement owner.
- Public and production barrels expose no legacy placement APIs.
- `window-workspace-multi-truth-debt` is removed from boundary facts because the
  code and smoke evidence both support removal.
- The verification matrix and final browser smoke pass.
