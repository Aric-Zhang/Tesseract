# Project Prism Phase 3.0: Dock Surface Truth Model Cleanup

Status: planned, must run before Phase 3A UI framework port split.

This is a pre-extraction closure step for the dock/tab/window UI model. It
addresses the current root split/tab bugs where hidden docked tabs can reappear
only after menu focus, focused tabs can occupy the whole frame, and inactive
tabs inside a root split pane sometimes do not activate.

The issue is not a local root-frame click bug. It is a model mismatch:

- `WindowDockSurfaceModel` keeps a frame-level `activeViewActorId`.
- Each dock tree tabset also keeps its own `activeViewActorId`.
- `WindowFramePort.getActiveViewActorId()` exposes the frame-level assumption.
- content placement can fall back to frame `primaryContent` for a known
  `viewActorId` when the tabset target is missing.

That was tolerable while a frame effectively contained one tabset. It is no
longer valid once root/floating frames can host split panes, multiple tabsets,
menu focus, fullscreen isolation, and content rehosting.

## Goal

Make the dock tree tabset state the only display truth for active tabs and
content visibility.

Frame-level active view may continue to exist only as a focus/MRU projection. It
must not decide which content is visible, which tab is selected inside a tabset,
or where a view's content is mounted.

## Non-Goals

- Do not extract `ui-framework` yet.
- Do not add product-specific special cases for Scene, Debug, Hierarchy, or
  Inspector.
- Do not make root and floating frames diverge again.
- Do not patch the menu to move or recreate views as a substitute for correct
  dock tree activation.
- Do not change persistence schema unless the dock tree active-tab semantics
  require a minimal validation update.

## Step 3.0.0: Baseline And Reproduction Tests

Target:

- Freeze the current failing behaviors as executable tests before changing the
  model.

Work:

- Add unit tests that reproduce:
  - root split pane with two tabs in one tabset; clicking the inactive tab
    activates that tabset and only that tabset;
  - floating split pane with the same interaction;
  - menu focus of a live view inside a split pane does not move content to the
    frame root;
  - closing the visible tab in one tabset does not reveal or hide unrelated
    tabsets incorrectly.
- Add a small browser smoke fixture that records:
  - dock root JSON;
  - per-tabset active tab ids;
  - content parent class/id for each live view;
  - DOM top element and actor-input hit at the clicked tab point.

Boundaries:

- Do not leave failing tests in the handoff state. During implementation, the
  first reproduction can be recorded as a temporary failing local run, a
  `test.fails`/`it.todo`-style note if the test framework supports it cleanly,
  or a structured reproduction report under `temp/`. Before Step 3.0 closes,
  every reproduction must be converted into a normal passing regression test.
- Do not weaken existing Phase 0B/Phase 2 smoke shape.
- The root-tab click fix currently in `WorkspaceRootDockFrameComponent` is a
  valid short-term reproduction aid, but it is not the final architecture. Do
  not expand that root-only branch; Step 3.0.4 must absorb it into shared tab
  interaction logic.

Acceptance:

- At least one targeted test or structured report proves the current bug before
  model changes.
- No failing reproduction remains enabled after the corresponding fix lands.
- The smoke data shape is machine-readable and includes `validationErrors`.

Commands:

```text
npm run test -w wallpaper-tesseract -- window-dock-surface-model window-frame-surface-component workspace-root-dock-frame-component floating-window-component
npm run typecheck -w wallpaper-tesseract
```

## Step 3.0.1: Remove Frame-Level Active Tab As Display Truth

Target:

- Make tabset-local active ids the only source of visible/selected content.

Work:

- Refactor `WindowDockSurfaceModel` so it no longer stores a display-driving
  `#activeViewActorId`.
- Keep, if needed, an explicitly named `lastActivatedViewActorId` or
  `focusedViewActorId` projection for MRU/focus only.
- Ensure `activateTab(viewActorId)` updates only the tabset containing that
  view and updates the optional focus projection.
- Ensure `removeTab(viewActorId)` updates only the affected tabset and collapses
  empty split branches through the dock tree reducer.
- Replace `findActiveViewActorIdInWindowFrameDockTree()` call sites that assume
  a single frame active tab with explicit semantics:
  - tabset-local active for rendering/content;
  - first active tab only for fallback focus/MRU, never for content placement.

Boundaries:

- Do not change `WindowFrameTab.viewActorId`; runtime hosting/input still uses
  actor ids.
- Do not replace runtime tab ids with persistent `instanceId`.

Acceptance:

- There is no display-state field named `activeViewActorId` outside dock tree
  tabset nodes.
- Every content visibility check goes through "is active in its own tabset".
- Split roots can have multiple active views, one per tabset.

Tests:

- `WindowDockSurfaceModel` verifies independent tabset activation.
- `WindowFrameDockTree` verifies active ids stay valid after split, remove,
  restore, and collapse.

## Step 3.0.2: Refine WindowFramePort Active Semantics

Target:

- Remove the misleading "one frame active tab" API from the generic frame port.

Work:

- Replace or deprecate `WindowFramePort.getActiveViewActorId()` with narrower
  methods:
  - `isViewActiveInFrame(viewActorId)` for tabset-local visibility;
  - `getFocusedViewActorId()` or `getLastActivatedViewActorId()` only if
    lifecycle/MRU needs it;
  - `getActiveViewActorIds()` if snapshot/debug code needs every active tabset.
- Update lifecycle call sites:
  - menu focus activates the view's owning tabset and focuses the owner frame;
  - close-view chooses the next active tab from the source view's tabset, not
    from the whole frame;
  - fullscreen isolation takes the source root snapshot without rewriting
    unrelated tabset active states.

Boundaries:

- Do not let lifecycle infer a target tabset from DOM order.
- Do not let menu focus rebuild a frame or move content unless the view is not
  live and must be newly opened.

Acceptance:

- `WindowFramePort` no longer advertises a single frame active tab as a display
  primitive.
- Lifecycle still has a clear focus/MRU path, but it is named as focus/MRU.

Tests:

- Existing lifecycle tests updated to assert tabset-local next-active behavior.
- Add stale hit test: tab action carries `viewActorId + identity`; lifecycle
  rejects mismatch without touching unrelated tabsets.

## Step 3.0.3: Make Content Placement Strict

Target:

- A known view's content must never silently mount to the whole frame root when
  its tabset target is missing.

Work:

- Change `WindowFrameSurfaceComponent.appendContentElement()`:
  - `viewActorId === null` may still mount to primary content for legacy-free
    generic content only if explicitly allowed;
  - known `viewActorId` must resolve to a dock tree tabset target;
  - if the target is missing before a render pass completes, keep the content
    detached or hidden/non-interactable and retry placement after the next
    render;
  - if the target is still missing after render, record a structured invariant
    error and fail closed. In tests/development this should throw. In production
    it may log/report and keep the content hidden, but it must not mount the
    known view to whole-frame primary content.
- Add an invariant helper that can be reused by root and floating frame hosts:
  every mounted view content parent must match its current tabset content
  target.
- Ensure `placeContentAttachments()` runs after render and never creates a
  fallback whole-frame overlay for known tabs.

Boundaries:

- Do not use CSS z-index to hide the misplaced content.
- Do not special-case root frame.

Acceptance:

- No known view content can be a direct child of frame `primaryContent` while
  the dock root is a split.
- Menu focus cannot change a content element's parent except when a deliberate
  rehost/dock operation occurs.
- Production behavior for a missing target is explicit: retry once after render,
  then fail closed with structured diagnostics; never silently display the view
  in the wrong host.

Tests:

- Unit test: split root, focus inactive tab, content parent remains the pane
  content element.
- Unit test: missing tabset target produces an invariant failure instead of a
  silent full-frame mount.

## Step 3.0.4: One Tab Interaction State Machine For Root And Floating

Target:

- Finish the previously planned removal of root/floating tab input dual-track,
  but against the corrected dock surface model.

Work:

- Move tab click/close/drag/cancel interpretation into a shared frame surface
  tab interaction helper.
- Root and floating shell components should only translate shell-specific actor
  input hits into shared surface intents.
- Ensure:
  - click activates tabset-local tab;
  - drag threshold starts docking;
  - click does not commit a dock drag;
  - close action always goes through lifecycle `requestCloseView`;
  - inactive tab content is not interactable.

Boundaries:

- No DOM `click` handlers for tab actions.
- No root-only or floating-only tab activation branch except shell hit
  translation.

Acceptance:

- Boundary test forbids divergent root/floating implementations of tab click,
  tab close, tab drag, drag cancel, and dock commit.
- Root and floating tests share the same tab interaction fixtures where
  practical.

Tests:

- Root split pane tab click.
- Floating split pane tab click.
- Root/floating tab close rect at mobile width.
- Drag cancel leaves active tab unchanged.

## Step 3.0.4a: Same-Frame Dock Split And Reorder Semantics

Target:

- Make a frame able to dock one of its own tabs into another tabset or edge
  region inside the same frame.
- Fix the long-standing root bug where only the top tab bar accepts drops while
  root left/right/top/bottom content edges behave like non-targets.

Why This Belongs Here:

- This is still Phase 3.0 truth-model work, not a Phase 3A extraction task.
- The current preview/commit contract treats "same frame" as invalid:
  - `resolveWindowDockPreview()` filters regions whose `frameId` equals the
    source frame;
  - `validateDockCommit()` rejects `targetFrameId === source.frameId`.
- That rule was safe when dock operations only meant cross-frame rehosting. It
  is now wrong because root/floating frames are dock surfaces with internal
  tabsets and split panes.
- If Phase 3A extracts `ui-framework` before this is fixed, the public dock API
  will incorrectly encode "same-frame edge docking is impossible".

Work:

- Make dock preview / commit intent carry an explicit operation kind instead of
  requiring lifecycle code to infer semantics from frame ids:
  - `cross-frame-merge`;
  - `cross-frame-split`;
  - `cross-frame-float`;
  - `same-frame-reorder`;
  - `same-frame-split`;
  - `no-op`.
- Split dock commit semantics into explicit operations:
  - cross-frame merge;
  - cross-frame split;
  - cross-frame float;
  - same-frame tab merge/reorder;
  - same-frame split to a target tabset edge.
- Update preview resolution so `sourceFrameId` only filters illegal targets:
  - reject dropping onto the same tabset as a no-op merge;
  - allow dropping onto another tabset in the same frame;
  - allow dropping onto the source tabset's content edge when the operation is a
    same-frame split;
  - keep center-content/no-placement as floating/no-op according to existing
    floating rules.
- Update lifecycle validation:
  - `targetFrameId === source.frameId` is valid for same-frame split/reorder;
  - the source tab must be removed from its original tabset before insertion;
  - empty source tabset branches must collapse through the dock tree reducer;
  - active/focused tab updates remain tabset-local plus MRU projection.
- Update `WindowDockSurfaceModel` / dock tree helpers if needed so moving an
  existing tab within the same root is an atomic reducer operation, not a
  rehost/destroy sequence.
- For root empty-state behavior, define one explicit policy:
  - if the root has no tabs, any edge drop fills the root as the initial tabset;
  - if the root has tabs, edge drop splits the target tabset.

Boundaries:

- Do not special-case Scene, Debug, Hierarchy, Inspector, root, or floating
  content.
- Do not implement this by temporarily floating the tab and docking it back.
- Do not rehost content when source and target frame are the same unless the tab
  moves to a different pane content host.
- Do not allow same-frame operations to bypass actor-input tab interaction.
- Do not keep a blanket `targetFrameId === sourceFrameId` rejection in preview
  or lifecycle validation. Only explicit no-op same-tabset drops may be
  rejected.

Acceptance:

- Dragging a tab already in root to root left/right/top/bottom produces a split
  preview and commits a split.
- Dragging a tab already in a floating frame to another tabset/edge in the same
  floating frame works through the same code path.
- Dropping a tab on its own tabset header without meaningful movement is a
  no-op/activation, not a duplicate tab.
- Preview result and commit intent expose the chosen operation kind; lifecycle
  does not infer same-frame legality from frame id equality alone.
- No remaining blanket same-frame rejection exists in preview or lifecycle
  validation.
- Same-frame split does not destroy the frame, view actor, content component, or
  runtime resources.
- Content parent after commit matches the new tabset content host.

Tests:

- `WindowTabDragSession` / `resolveWindowDockPreview`:
  - same-frame source tab to same-frame content left/right/top/bottom returns
    `split`;
  - every target resolves to an explicit operation kind;
  - same-frame source tab to same tabset header returns no-op or merge-reorder
    according to the chosen contract, never floating by accident;
  - cross-frame behavior remains unchanged.
- `WindowDockSurfaceModel` / dock tree:
  - moving an existing tab to split inside its own frame removes it from the
    source tabset and inserts it into the new tabset once;
  - empty source tabset collapses correctly.
- `DefaultWindowFrameLifecycleController`:
  - same-frame split commit succeeds;
  - no frame destroy occurs;
  - no stale content host remains;
  - active input is cancelled before the model mutation.
- Browser smoke:
  - root Scene + Debug in one tabset;
  - drag Debug tab to root left/right/top/bottom;
  - floating Debug + Scene in one tabset;
  - drag one floating tab to floating left/right/top/bottom;
  - verify split preview, split result, per-tabset active ids, content parents,
    console errors = 0.

## Step 3.0.5: Persistence And Snapshot Validation

Target:

- Persist every tabset's active tab and prevent old single-active assumptions
  from returning through layout hydrate.

Work:

- Audit `createFrameLayoutSnapshot`, runtime dock root mapping, and persistence
  hydration.
- Ensure persisted dock roots store tabset-local `activeTabId` at every tabset.
  Persistence uses logical view keys / persisted tab ids. Runtime dock roots
  use `viewActorId`. Both layers must remain per-tabset; neither may introduce
  a frame-level active tab.
- Validate or normalize payloads where:
  - active tab is missing;
  - duplicate view appears in more than one tabset;
  - split child is empty;
  - root/floating frame has malformed tabset ids.

Boundaries:

- Do not introduce schema churn unless necessary.
- If schema stays the same, document that `activeTabId` is a persisted logical
  per-tabset id and `activeViewActorId` is a runtime per-tabset id.

Acceptance:

- Reload preserves root split panes and active tabs in each pane.
- Reload does not turn a split pane view into whole-frame content.

Tests:

- Persistence unit tests for split root with two tabsets and multiple tabs in
  one tabset.
- Browser smoke reloads after tab switch and after menu focus.

## Step 3.0.6: Browser Smoke Gate

Target:

- Prove the fixed model under real DOM rects and actor input.

Required scenarios:

- Root frame split into two panes; one pane has Debug + Scene tabs. Click the
  inactive tab and verify:
  - selected tab changes only in that pane;
  - content parent remains that pane;
  - the other pane stays visible;
  - actor input hit reports the clicked tab.
- Floating frame split with the same tab interaction.
- Menu focus a live tab inside a root split pane; no dock root mutation except
  tabset activation.
- Close visible tab; adjacent hidden tab in the same tabset appears, unrelated
  tabsets are unchanged.
- Mobile/narrow width tab close still has reachable hit target.
- Same-frame root left/right/top/bottom dock.
- Same-frame floating left/right/top/bottom dock.

Smoke data must record:

- viewport;
- initial persisted layout;
- dock root before/after each operation;
- per-tabset active ids;
- content parent for every live view;
- `elementsFromPoint()[0]`;
- actor-input hit actor/component/part/data;
- console errors;
- screenshots.

Commands:

```text
npm run test -w wallpaper-tesseract
npm run typecheck -w wallpaper-tesseract
npm run build -w wallpaper-tesseract
```

## Step 3.0.7: Boundary And Plan Closure

Target:

- Lock the cleanup so Phase 3A cannot regress into a single-active frame model.

Work:

- Add architecture boundary tests:
  - no new root/floating divergent tab input handlers;
  - `WindowFramePort` does not expose a display-driving single active tab;
  - known view content cannot fallback to root primary content in split mode;
  - UI framework candidate remains product-agnostic.
- Update Phase 3 planning documents to mark Phase 3.0 as complete only after
  unit, typecheck, build, and browser smoke pass.
- Generate a short completion report under `temp/`.

Exit Criteria:

- The reported bug cannot be reproduced.
- Root/floating split-pane tab switching uses the same model and tests.
- Phase 3A may start without carrying the old frame-level active tab assumption.
