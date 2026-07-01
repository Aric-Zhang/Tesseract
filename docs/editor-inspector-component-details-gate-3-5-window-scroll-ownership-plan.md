# Editor Inspector Component Details Gate 3.5: Window Scroll Ownership Closure

Status: complete

Last updated: 2026-07-01

## Purpose

Close the scroll ownership gap exposed after Gate 3 editable Inspector work:
ordinary window content should get one consistent, themed native scrollbar
behavior from the window surface owner. Individual windows and editor features
must not implement their own default scrollbars.

This gate runs before Gate 4 hardening because the current Inspector scrollbar
bug is visible product behavior and an architecture multi-truth:

- Inspector body still uses local `overflow: auto`;
- Hierarchy installs `ScrollViewComponent` as a default whole-window scroll
  owner;
- Debug installs `ScrollViewComponent` for its virtualized list control;
- the actual window content host still directly appends registered content
  elements and does not own default overflow behavior.

The target is not a local Inspector style patch. The target is one window-owned
default scroll container that every ordinary `WindowRegisteredContent` can use.

## External Reference Summary

Browser UI conventions make scroll ownership a container concern:

- a fixed-size container becomes a scroll container with `overflow: auto`;
- vertical scrollbars appear only when content exceeds the container height;
- horizontal scrollbars appear only when content cannot shrink below the
  container width;
- native scrollbars can be themed through shared CSS scrollbar properties and
  tokens.

Useful references:

- MDN CSS `overflow`;
- MDN CSS `scrollbar-color`;
- MDN CSS `scrollbar-width`;
- common web UI library practice, where `overflow: auto` is applied to layout
  containers rather than reimplemented inside every feature panel.

## Current Evidence

Inspector still owns a feature-local default scrollbar:

```text
packages/editor/src/inspector/inspector.css
  .inspector-window__body { overflow: auto; }
```

Hierarchy currently owns whole-window scroll explicitly:

```text
packages/editor/src/hierarchy/hierarchy-panel-actor-factory.ts
  componentRegistry.addComponent(actor, scrollViewComponentType, ...)
```

Debug uses a scroll view for a different reason: `VirtualListViewComponent`
needs a bounded scroll source to calculate visible rows. That is a
control-specific nested scroll case, not the ordinary default window scrollbar.

The window surface currently places content directly:

```text
packages/ui-framework/src/chrome/window-frame-surface-component.ts
  placeContent(...) -> appendContentElement(..., placement.content.element)
```

The input issue is related: the gizmo event system preserves browser default
behavior only for actor-input hits whose region is `content-control`. A default
window content hit is `window-content`, so native scrollbar dragging can be
prevented unless the window surface marks scrollbar gutter hits as a content
control.

## Desired Invariant

For ordinary window content:

```text
WindowFrameSurfaceComponent
  -> tab/pane content host
    -> window-owned scroll viewport
      -> registered feature content element
```

Rules:

- Vertical scrolling is `auto` and appears when content exceeds viewport height.
- Horizontal scrolling is `auto` and appears only when content cannot compress.
- The scroll viewport uses the shared `--ui-scrollbar-*` tokens.
- Feature CSS must not implement default whole-window scrollbars.
- Feature factories must not install `ScrollViewComponent` just to make the
  whole window scroll.
- Nested scroll controls remain allowed only when the control itself owns a
  scroll interaction, such as a virtualized list.
- Scrollbar gutter/thumb pointer hits route as `content-control`, so native
  scrollbar dragging is not blocked by window drag/dock/tab input paths.

## Non-Goals

- Do not create custom scrollbar thumbs or drag mechanics.
- Do not make every feature view actor install `ScrollViewComponent`.
- Do not add Inspector-specific scrollbar CSS or a compatibility selector.
- Do not make `actor-system` know scroll, DOM, or UI layout semantics.
- Do not change runtime Scene rendering ownership.
- Do not remove Debug virtual list scrolling unless the default window viewport
  can be used as its actual virtual-list scroll source in the same clean change.

## Design Decision

Implement ordinary window scroll in `ui-framework/window` ownership, centered on
`WindowFrameSurfaceComponent`.

The surface already owns:

- tabset content host DOM;
- content placement/reparenting;
- active/interactable state;
- layout commit projection;
- frame hit-test classification.

Therefore it is the only owner that can make scroll behavior uniform without
requiring each feature window to remember the same component recipe.

## Execution Plan

### Step 0: Entry Audit

1. Record the current dirty worktree before editing. Preserve unrelated user
   changes.
2. Confirm the current scroll facts:
   - Inspector has local `overflow: auto`;
   - Hierarchy installs `scrollViewComponentType`;
   - Debug virtual list installs `scrollViewComponentType`;
   - no window-owned content scroll viewport exists.
3. Do not start Gate 4 hardening until this gate is complete or explicitly
   blocked.

### Step 1: Add Window-Owned Content Scroll Viewport

Modify `WindowFrameSurfaceComponent` so each placed content id has a
surface-owned viewport element.

Requirements:

- Create one viewport element per `contentId`.
- Add stable diagnostic classes/data, for example:
  - `ui-window-content-scroll-viewport`;
  - `data-ui-window-content-scroll-viewport="true"`;
  - `data-ui-window-content-id="<contentId>"`.
- Apply shared scroll styling:
  - `overflow-y: auto`;
  - `overflow-x: auto`;
  - `min-width: 0`;
  - `min-height: 0`;
  - width/height fill the tabset content host.
- Reuse the existing scrollbar token rules from `ui-framework` rather than
  duplicating raw colors.
- The `.ui-window-content-scroll-viewport` CSS must live in reusable
  `ui-framework` CSS or stable component-applied styles. Do not add separate
  floating/root/app-local scrollbar styles.
- Prefer sharing the existing `.ui-scroll-view` token styling rule with
  `.ui-window-content-scroll-viewport` so scrollbar visual ownership has one
  style source.
- Append the registered content element inside the viewport.
- Reparent the viewport when a tab moves between panes or frames.
- Remove and dispose the viewport when content is removed.
- Keep `WindowRegisteredContent.element` as the feature-owned content root; the
  window surface owns only the viewport wrapper.

Visibility/interactable rule:

- The window-owned viewport wrapper is the only visual active/hidden owner for
  placed window content.
- `content.element.hidden` must not be used as a long-term visibility truth by
  `WindowFrameSurfaceComponent`.
- `WindowRegisteredContent.setInteractable(...)` remains the input/activity
  owner.
- If existing tests reveal code that relies on `content.element.hidden`, update
  that code to use the layout commit/interactable state. Do not keep wrapper
  hidden + content hidden as parallel facts.

Layout commit rule:

- `contentRect` should describe the visible window content viewport, not a
  feature element that may be taller than the viewport.
- Existing layout commit subscribers should keep receiving active/interactable
  changes.

### Step 2: Route Window Scrollbar Hits As Content Controls

Extend the window surface hit-test so pointer hits on the window-owned native
scrollbar gutter/thumb are classified as a content-control region.

Implementation direction:

- Add a semantic hit part such as `content-scrollbar` or equivalent.
- Detect vertical and horizontal scrollbar gutter regions from the active
  content viewport using browser-native gutter dimensions:
  - vertical gutter width = `offsetWidth - clientWidth`;
  - horizontal gutter height = `offsetHeight - clientHeight`;
  - if the gutter dimension is `0` (overlay scrollbar or no native gutter), do
    not synthesize a scrollbar hit.
- Only return a scrollbar hit when overflow exists on the corresponding axis.
- In root and floating frame components, map that hit to actor-input
  `region: "content-control"` and a stable part id such as
  `window-content-scrollbar`.
- Do not start tab drag, dock drag, split resize, or window content drag from
  scrollbar hits.
- Do not special-case Inspector.

Tests must prove:

- scrollbar-gutter hits are not `window-content`;
- ordinary content interior hits remain `window-content`;
- vertical gutter, horizontal gutter, no-overflow, and zero-gutter cases are
  covered;
- tab, tab action, splitter, and dock hit behavior is unchanged.

### Step 3: Delete Feature-Owned Default Scroll Paths

Replace feature-local ordinary scroll ownership with the window-owned viewport.

Inspector:

- Delete `overflow: auto` from `packages/editor/src/inspector/inspector.css`.
- Do not add `ScrollViewComponent` to Inspector body.
- Keep Inspector body as ordinary content that may exceed its window viewport.

Hierarchy:

- Remove `scrollViewComponentType` from `createHierarchyPanelViewActor`.
- Keep `TreeViewComponent` as the row/disclosure/selection interaction owner.
- Ensure TreeView still uses actor-input `content-control` for rows and
  disclosures.
- Update tests that currently expect Hierarchy to install `ScrollViewComponent`.

Debug:

- Keep its `ScrollViewComponent` only because `VirtualListViewComponent` owns a
  virtualized nested scroll source.
- Ensure the Debug registered content root fills the window viewport and does
  not make the window-owned outer viewport scroll:
  - `height: 100%`;
  - `min-height: 0`;
  - no feature-local default overflow that competes with the virtual list.
- Add an explicit test/boundary allowlist documenting this as a control-specific
  nested scroll exception, not a default window scrollbar.
- Verify the window-owned outer viewport does not create a second visible
  scrollbar around Debug. If double scroll appears, either:
  - make the Debug registered content root fit the window viewport while the
    virtual list remains the sole inner scroll source; or
  - amend the plan to let `VirtualListViewComponent` consume the window viewport
    as its scroll source and delete the nested scroll owner in the same gate.

### Step 4: Strengthen Boundaries

Add or update `architecture-boundaries.test.ts` rules:

- Production feature CSS must not define default window scrollbars:
  - no `overflow: auto|scroll` in `packages/editor/src/inspector`;
  - no feature-local `scrollbar-color`, `scrollbar-width`, or
    `::-webkit-scrollbar` outside `ui-framework` styles and explicitly named
    fixtures.
- Ordinary feature factories must not install `scrollViewComponentType` solely
  for whole-window scrolling.
- Hierarchy no longer installs `scrollViewComponentType`.
- Inspector does not install `scrollViewComponentType` and does not use local
  scroll CSS.
- Debug virtual list remains the only editor production allowlist entry for
  nested scroll ownership unless a later gate changes the virtual-list contract.
- Window surface code owns the default scroll viewport and scrollbar hit part.

### Step 5: Targeted Unit Tests

Add focused tests in `ui-framework`:

- `WindowFrameSurfaceComponent` wraps registered content in the window-owned
  scroll viewport.
- Re-rendering and split layout changes reuse/reparent the viewport without
  duplicating content elements.
- Removing content removes the viewport and leaves no stale wrapper.
- Layout commits use viewport rects.
- Scrollbar-gutter hit returns the content-control scrollbar hit.
- Interior content hit remains ordinary content.

Update editor tests:

- Inspector body no longer owns local overflow.
- Hierarchy actor factory no longer installs `ScrollViewComponent`.
- Debug virtual list still has its explicit nested scroll dependency.

### Step 6: Browser Smoke

Create or update a smoke runner for this gate. Required evidence:

- Select a content-heavy Inspector target, such as the Inspector lock toggle
  actor, so Inspector content overflows.
- Inspector window has a `ui-window-content-scroll-viewport`.
- Inspector body does not have local scroll styling.
- Computed scrollbar styling comes from shared `--ui-scrollbar-*` theme tokens.
- Wheel scroll changes the Inspector window viewport `scrollTop`.
- Dragging the visible scrollbar thumb/gutter changes `scrollTop` and does not
  move, dock, or resize the window.
- Hierarchy still scrolls and its scrollbar styling matches Inspector.
- Scene window does not show scrollbars when its content fits.
- Debug window keeps virtualized rows working without an outer double scrollbar.
- NumberField focus/editing from Gate 3 still works.
- Console errors are 0.

Evidence files:

```text
temp/editor-inspector-window-scroll-ownership-smoke-data.json
temp/editor-inspector-window-scroll-ownership-smoke-report.md
```

### Step 7: Validation Matrix

Targeted:

```text
npm run test -w ui-framework -- window-frame-surface scroll
npm run test -w editor -- inspector hierarchy debug
npm run test -w wallpaper-tesseract -- architecture-boundaries
npm run typecheck:test -w ui-framework
npm run typecheck -w editor
npm run typecheck -w wallpaper-tesseract
npm run build -w ui-framework
npm run build -w wallpaper-tesseract
```

Browser:

```text
npm run prism:smoke:prepare
npm run dev -w wallpaper-tesseract -- --force
node apps/wallpaper-tesseract/scripts/run-editor-inspector-window-scroll-ownership-smoke.mjs
```

Final before Gate 4:

```text
npm run test
npm run typecheck
npm run build
git diff --check
```

## Exit Criteria

- Ordinary window content scrollbars are owned by `WindowFrameSurfaceComponent`
  / `ui-framework/window`.
- Inspector and Hierarchy no longer own default whole-window scrollbars.
- Scrollbar styling is visually and programmatically consistent across ordinary
  windows.
- Scrollbar drag is not blocked by actor-input/gizmo default prevention.
- Debug's remaining scroll owner is documented and tested as a virtualized
  control exception.
- No feature-local compatibility scroll path remains.
- Gate 4 hardening can proceed without preserving the current Inspector
  scrollbar bug as a known exception.

## Stop Conditions

Stop and revise if:

- Scene or another full-bleed view cannot fit the window viewport without
  adding a feature-specific scroll opt-out.
- Debug virtual list cannot avoid double scrollbars without a larger
  virtual-list scroll-source redesign.
- The window surface cannot distinguish scrollbar gutter hits from ordinary
  content hits without browser-specific hacks that would be worse than the
  current bug.
- Fixing scrollbar drag requires actor-system to know DOM scrollbar semantics.
- The implementation requires each feature window to keep installing its own
  default `ScrollViewComponent`.
