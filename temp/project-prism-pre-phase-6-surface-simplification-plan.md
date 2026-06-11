# Project Prism Pre-Phase 6 Surface Simplification Plan

Last updated: 2026-06-12

Status: active pre-Phase 6 debt plan. Phase 6 remains blocked until this plan
is executed, verified, and followed by the final browser smoke gate.

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

The remaining blocker is smaller but still real: the surface internals and old
model tests still preserve a second placement implementation under the graph
projection path.

## Remaining Debt Facts

These facts must be deleted or collapsed before Phase 6 can start.

- `packages/ui-framework/src/chrome/window-frame-surface-component.ts` still
  owns legacy placement fields and methods internally:
  `#tabs`, `#root`, `#focusedViewActorId`, `listTabs`,
  `getRuntimeDockRoot`, `restoreRuntimeDockRoot`, `listDockTargetTabsets`,
  `getFocusedViewActorId`, `getActiveViewActorIds`, `isViewActiveInFrame`,
  `isViewVisibleInFrame`, `addTab`, `splitTab`, `removeTab`, `activateTab`,
  `hasTab`, `hasTabset`, `getContentHost`, and `mountContent`.
- The surface still converts graph snapshots back into
  `WindowFrameDockTreeNode`, keeping the old dock-tree model alive.
- `packages/ui-framework/src/ports/window-content-host.ts` still contains the
  internal `WindowContentHost` / `WindowContentAttachment` implementation and
  attachment weak-map mechanics.
- `packages/ui-framework/src/model/window-dock-surface-model.ts` and
  `packages/ui-framework/src/model/window-frame-dock-tree.ts` remain as old
  placement models with their own tests.
- `window-frame-tab-chrome` and `window-frame-hit-data` still type against the
  old dock tree instead of graph snapshot inputs.
- App-local window-runtime barrels still re-export runtime dock-tree types such
  as `WindowFrameRuntimeDockNode` and `WindowFrameDockTargetTabset`.
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

- `rg "getRuntimeDockRoot|restoreRuntimeDockRoot|listDockTargetTabsets|listTabs|addTab|splitTab|removeTab|activateTab|getContentHost|mountContent" packages/ui-framework/src/chrome/window-frame-surface-component.ts` returns no matches.
- The surface no longer imports `window-frame-dock-tree`.
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

Keep, rename, or split only the registry concepts that are still required:

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

Exit criteria:

- `rg "WindowContentHost|WindowContentAttachment|createWindowContentAttachment|getWindowContentAttachment" packages/ui-framework/src apps/wallpaper-tesseract/src` only matches boundary tests or this plan.
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
- App-local re-exports of `WindowFrameRuntimeDockNode`,
  `WindowFrameRuntimeSplitNode`, `WindowFrameRuntimeTabsetNode`, and
  `WindowFrameDockTargetTabset` unless a current production graph/persistence
  owner still requires them.

Required rewrites:

- `window-frame-tab-chrome` should accept a minimal graph snapshot tabset render
  input instead of `WindowFrameDockTreeTabsetNode`.
- `window-frame-hit-data` should use either graph snapshot split direction or a
  local `"horizontal" | "vertical"` type, not dock-tree types.
- Any remaining tests should be graph snapshot tests. Do not retain old
  dock-tree unit tests as an alternate placement specification.

Exit criteria:

- `rg "WindowDockSurfaceModel|window-dock-surface-model|WindowFrameDockTree|window-frame-dock-tree" packages/ui-framework/src apps/wallpaper-tesseract/src` only matches boundary tests or this plan.
- `packages/ui-framework/src/model` contains no second dock placement model.

## Step 4: Tighten Boundary Facts

Goal: make the deletion irreversible before Phase 6.

Add or update boundary checks so production and public source cannot reintroduce:

- Surface placement read/mutation APIs.
- `WindowContentHost` / `WindowContentAttachment`.
- `WindowDockSurfaceModel`.
- `WindowFrameDockTree*`.
- Runtime dock-tree node exports from app-local barrels.
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
