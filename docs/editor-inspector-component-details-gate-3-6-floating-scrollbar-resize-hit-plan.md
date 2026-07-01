# Editor Inspector Component Details Gate 3.6: Floating Content-Control Hit Closure

Status: completed / verified

Last updated: 2026-07-01

## Purpose

Close the follow-up UX issue exposed after Gate 3.5:

When a window is floating and its content has a vertical scrollbar, moving the
cursor onto the scrollbar can hit the floating window side resize area first.
The cursor becomes an `ew-resize` double arrow, making the scrollbar hard to
target and drag.

Gate 3.5 made ordinary window scrolling window-owned. Gate 3.6 makes floating
window resize ownership respect that window-owned content scrollbar and the
existing actor-input `content-control` priority model.

This is not an Inspector-specific fix. The invariant is:

```text
visible content controls > parent frame resize/chrome > ordinary content
```

The immediate visible control is the native content scrollbar gutter/thumb, but
the rule is intentionally broader: when a parent window chrome affordance and a
child content control overlap, the child control must be allowed to report its
semantic actor-input hit first. The actor-input router already has
`content-control`; Gate 3.6 must use that existing fact instead of adding a
feature-local exception.

## External Reference Summary

Mature UI systems distinguish client-area controls from non-client resize
borders:

- browsers pick the topmost element at a viewport coordinate; anonymous native
  UI such as textbox scrollbars resolves to the first non-anonymous ancestor,
  so the owning element must still be treated as the event target;
- resize borders are frame affordances, normally outside the client area or in a
  narrow border band;
- explicit resize grips are usually corner/status-bar widgets rather than
  overlays over full-height content controls.
- after a target is selected, frameworks propagate the event through the visual
  tree. Unity UI Toolkit uses target, trickle-down, and bubble-up phases; Qt
  propagates unaccepted mouse events to parents until a widget accepts the
  event or a filter consumes it.
- pointer capture is a separate step after pointer down. Unity documents this
  for controls such as buttons, sliders, and scrollbars; the initial target is
  still chosen by picking.

Reference examples:

- MDN `Document.elementFromPoint(...)`: returns the topmost element at a point
  and ignores `pointer-events: none`.
- W3C Pointer Events: pointer events are a unified hardware-agnostic event
  family over mouse, touch, and pen.
- Unity UI Toolkit dispatch: target selection is followed by trickle-down,
  target, and bubble-up propagation; most mouse events target the topmost
  pickable element under the pointer.
- Qt mouse events: unhandled events propagate up the parent widget chain until
  accepted or filtered.

## Current Evidence

Floating window hit-test currently checks resize handles before the content
surface:

```text
apps/wallpaper-tesseract/src/window-runtime/floating-window-component.ts
  hitTestInput(...)
    resize handles
    surface.hitTest(...)
```

The right/left resize handle CSS also creates a transparent full-height edge
area with an `ew-resize` cursor:

```text
apps/wallpaper-tesseract/src/window-runtime/floating-window.css
  .floating-gizmo-window__resize--right
  .floating-gizmo-window__resize--left
```

After Gate 3.5 the window surface can semantically report
`content-scrollbar`, and floating/root frame adapters can map that to
actor-input `content-control`. However, floating window resize handles still
get the first chance to own the pointer/cursor when the scrollbar is near the
window edge.

The frame adapters also currently weaken the actor-input semantics:

```text
root-content-scrollbar / window-content-scrollbar
  region: "content-control"
  scopeRoutePriority: actorInputScopeRoutePriority.windowContent
```

That explicit `windowContent` scope is inconsistent with the region. It prevents
the router/binding layer from naturally treating the scrollbar as a content
control. Gate 3.6 must fix this mismatch at the same time as the floating
hit-test order.

Gate 3.5 smoke could still pass with `nativeVerticalGutter: 0`, which proved
wheel/default scrolling but did not prove native scrollbar hover/drag ownership.
Gate 3.6 must force or require a measurable native gutter and fail if the
browser environment cannot expose one.

## Event Audit Summary

The current UI event paths were reviewed before refining this gate:

- `GizmoEventSystem` is the single low-level pointer/mouse DOM event source for
  actor input. This is expected, not a bypass.
- Button, ToggleButton, TreeView, FullscreenableView, Camera3 gizmo, root frame,
  and floating frame pointer activation all expose `ActorInputParticipant`
  hits.
- `NumberFieldComponent` uses native input/focus/change/blur/key events inside
  a generic control, but it also declares an actor-input `content-control` hit.
  This is the accepted boundary for browser-native text editing.
- `ScrollViewComponent` and `VirtualListViewComponent` listen to native
  `scroll` only to maintain scroll diagnostics and virtual row realization.
- `PopupMenuComponent` still uses DOM pointermove/document pointerdown/keydown
  for hover, outside dismiss, and keyboard navigation. Menu activation remains
  actor-input only. This is recorded as `ARB-005` watch debt and is not part of
  Gate 3.6.

Therefore the confirmed Gate 3.6 defect is not "DOM listeners exist"; it is that
floating frame hit arbitration and scrollbar scope priority do not yet respect
the existing `content-control` event-system contract.

## Non-Negotiable Rules

- Do not special-case Inspector.
- Do not move content inward with arbitrary padding just to avoid the edge.
- Do not create a feature-local scrollbar or resize workaround.
- Do not disable floating resize globally.
- Do not make `actor-system` know DOM scrollbar or resize-border semantics.
- Do not preserve two competing hit paths for scrollbar drag.
- Do not add new event-system concepts for this gate. Reuse existing
  `content-control` region/scope semantics.
- Do not treat `content-control` as `windowContent` by explicit
  `scopeRoutePriority`.

## Target Behavior

1. If the pointer is on a native content scrollbar gutter/thumb, the hit is
   `window-content-scrollbar` with actor-input region and scope
   `content-control`.
2. Dragging that area scrolls the content and does not resize, move, dock, or
   tab-drag the floating window.
3. Pointer positions on the actual floating frame border outside the content
   scrollbar still resize the window.
4. Corner resize remains available.
5. Root workspace behavior remains aligned with Gate 3.5 and does not regress.
6. Corner resize only wins where it does not cover a visible content scrollbar
   gutter. If the corner affordance overlaps the scrollbar gutter, the
   scrollbar remains the visible control and wins.

## Design

### Unified Hit Arbitration Rule

Gate 3.6 should not hard-code another one-off event order. It should apply this
window/input rule:

```text
collect visible hit candidates -> compare by shared event semantics -> dispatch
```

The shared semantics are:

1. Topmost visible/pickable content controls win over parent frame background
   affordances when their geometry overlaps.
2. Parent frame resize handles are background chrome affordances unless they are
   visually outside the client/content control area.
3. Explicit chrome controls such as close buttons, tabs, tab close buttons, and
   splitters remain controls in their own visible geometry.
4. Ordinary content loses to chrome and content controls.
5. After a hit owns pointer down, the existing gizmo/actor-input capture path
   owns the drag until end/cancel.

Implementation guidance:

- Introduce a small candidate/comparator helper for window-frame hits instead
  of relying on imperative checks whose order encodes behavior.
- Candidate data should include at least:
  - `partId`
  - `region`
  - `kind`
  - `hitPriority`
  - whether the candidate is a visible content control, explicit chrome
    control, resize affordance, or ordinary content.
- `FloatingWindowComponent.hitTestInput(...)` should collect candidates from:
  - close button;
  - `WindowFrameSurfaceComponent.hitTest(...)`;
  - resize handles;
  - titlebar background.
- The comparator should make the scrollbar result fall out naturally because
  `content-scrollbar` is a visible content-control candidate, while side/corner
  resize handles are parent-frame resize affordance candidates.
- This helper should stay in the window/input owner. Do not put DOM scrollbar
  concepts into `actor-system`.

This is intentionally close to browser/Unity/Qt behavior: find the best visible
target first, then route/propagate; do not let a parent background affordance
preempt a child control merely because code checked the parent first.

### Comparator Outcome

The comparator must be defined in terms of semantic candidate classes, not old
source-code branch order:

```text
visible content control >
explicit chrome control >
resize affordance >
chrome background >
ordinary content
```

Examples:

- native content scrollbar gutter/thumb: `visible content control`;
- tab, tab close/action, close button, splitter: `explicit chrome control`;
- side/corner resize handles: `resize affordance`;
- titlebar empty space: `chrome background`;
- ordinary window content: `ordinary content`.

Candidates in the same class should be ordered by existing local data such as
`hitPriority` and stable collection order. Do not introduce product-specific
priority constants for this gate.

Why scrollbar before resize handles?

- content scrollbars are visible controls;
- side resize strips and corner resize grips are parent-frame affordances;
- if a resize handle overlaps the visible scrollbar gutter, the parent frame is
  covering a child control and must defer;
- corner resize remains available in corner pixels outside the content
  scrollbar gutter.

This ordering stays local to floating frame arbitration. Cross-actor priority
should be handled by the existing actor-input scope model, not by more local
special cases.

The old imperative sequence in `FloatingWindowComponent.hitTestInput(...)`
should be deleted as the owner of priority truth. The component may still
contain small geometry readers, but priority must come from the shared
candidate comparator.

### Surface Hit Scope

`WindowFrameSurfaceComponent.hitTest(...)` currently owns tab, tab action,
splitter, content-scrollbar, and content hits inside the rendered window
surface. Gate 3.6 does not expand the comparator into that surface internals
unless implementation evidence shows it is necessary.

This is acceptable only if tests prove current surface chrome does not cover the
native content scrollbar gutter:

- splitter geometry must not overlap a measured scrollbar gutter;
- tab/tab-action geometry must not overlap the content scrollbar gutter;
- if such overlap is discovered, move the same candidate classification into
  the surface owner instead of adding another local exception in
  `FloatingWindowComponent`.

### Content-Control Scope Priority

Scrollbar hits must not override their own region with `windowContent` scope.

Acceptable implementation:

- Remove explicit `scopeRoutePriority` from content scrollbar hits and let
  `getActorInputScopeRoutePriority(hit)` derive `contentControl` from
  `region: "content-control"`.
- Or explicitly set
  `scopeRoutePriority: actorInputScopeRoutePriority.contentControl`.

Do this for both:

- `root-content-scrollbar`
- `window-content-scrollbar`

Ordinary content hits should remain `window-content` / `windowContent`.

### CSS Geometry

Hit-test order alone may not fix hover cursor if transparent resize handle DOM
still visually overlays the scrollbar gutter. Therefore the CSS resize handle
geometry must also avoid covering the content scrollbar area.

Preferred approach:

- Add or preserve `scrollbar-gutter: stable` on the window-owned scroll
  viewport so smoke can measure a real native gutter when content overflows.
- Keep side resize handles in the frame border band.
- Do not let `.floating-gizmo-window__resize--left/right` cover the tab/pane
  content area's native scrollbar gutter.
- Keep corner handles as small corner affordances.
- Do not let corner handles cover the visible scrollbar gutter. Corner resize
  should remain reachable in the frame corner outside that gutter.
- A resize handle element must own its visual affordance, cursor, and
  actor-input hit-test rectangle together. Do not draw a resize grip back into
  the content area with an offset pseudo-element if that area is not inside the
  same handle's hit rectangle.

Acceptable implementation detail:

- Side handles may be positioned just outside the content box or clipped to the
  frame edge, as long as:
  - ordinary right-edge border resize still works;
  - content scrollbar hover shows scrollbar cursor/behavior, not `ew-resize`;
  - corner grip visuals remain inside their corresponding corner handle
    rectangle, so a diagonal cursor never appears where actor-input cannot
    resize;
  - no feature/content-specific CSS is added.

### No New Owner

Do not create a new resize service. `FloatingWindowComponent` remains the
floating frame resize owner; `WindowFrameSurfaceComponent` remains content
scrollbar semantic owner.

## Execution Plan

### Step 1: Replace Floating Hit-Test Order With Candidate Arbitration

1. Add a local window-frame hit candidate type/helper in the window-runtime
   owner. Do not expose it from `ui-framework/window` unless root and floating
   frames immediately share it in the same gate.
2. Collect candidates from close button, `WindowFrameSurfaceComponent.hitTest`,
   resize handles, titlebar background, and ordinary content.
3. Classify candidates as visible content control, explicit chrome control,
   resize affordance, chrome background, or ordinary content.
4. Select the winning candidate through the comparator.
5. Convert only the winning candidate to the existing `ActorInputHit`.
6. Delete the previous source-order priority logic from
   `FloatingWindowComponent.hitTestInput(...)`.
7. Preserve existing tab, tab-action, titlebar, splitter, and content hit
   behavior.

Tests:

- pointer in scrollbar gutter returns `window-content-scrollbar`;
- tab, tab close/action, close button, and splitter beat resize affordances in
  their own visible geometry because they are explicit chrome controls;
- pointer in side border but outside scrollbar gutter returns `resize-right` or
  `resize-left`;
- corner resize wins only when the point is outside a visible scrollbar gutter;
- pointer in a scrollbar gutter overlapped by the bottom/right corner affordance
  still returns `window-content-scrollbar`;
- ordinary content still returns `window-content`.
- unit tests prove candidate ordering without relying on source-order regex.
- surface geometry tests prove splitters and tab chrome do not cover the
  measured native scrollbar gutter. If they do, the surface owner must adopt the
  same candidate categories before Gate 3.6 can pass.

### Step 2: Align Content-Control Scope Priority

1. Update `WorkspaceRootDockFrameComponent.createHit(...)` so
   `root-content-scrollbar` uses `content-control` scope.
2. Update `FloatingWindowComponent.createContentScrollbarHit(...)` so
   `window-content-scrollbar` uses `content-control` scope.
3. Keep ordinary content hits on `windowContent`.
4. Add tests or boundary checks that forbid content-scrollbar hits from being
   explicitly downgraded to `windowContent`.

Tests:

- root content scrollbar hit has `region: "content-control"` and
  `getActorInputScopeRoutePriority(hit) === actorInputScopeRoutePriority.contentControl`;
- floating content scrollbar hit has `region: "content-control"` and
  `getActorInputScopeRoutePriority(hit) === actorInputScopeRoutePriority.contentControl`;
- ordinary root/floating content hits remain `window-content`.

Regex boundary checks are useful as a backstop, but this gate must include
targeted behavior tests against the real hit objects so the route priority
result is proven, not merely inferred from source text.

### Step 3: Correct Floating Resize Handle CSS

1. Inspect `.floating-gizmo-window__resize--left/right/top/bottom` geometry.
2. Add `scrollbar-gutter: stable` to `.ui-window-content-scroll-viewport` if it
   is not already present, then require the smoke to observe a positive native
   vertical gutter for the overflowing Inspector.
3. Adjust side resize handle positioning so it does not overlay the content
   scrollbar gutter.
4. Keep resize affordance discoverable at the outer window frame edge.
5. Keep bottom/right corner grip visuals inside the bottom/right resize handle
   element. Do not use `::after` offsets that draw the grip back into the
   window content area while the real handle rectangle remains outside.
6. Do not add content/Inspector/Hierarchy/Debug-specific CSS.

Tests/smoke:

- computed cursor over visible scrollbar gutter is not `ew-resize`;
- computed cursor over side border resize band remains `ew-resize`;
- resize handle DOM does not cover the sampled scrollbar point.
- diagonal resize cursor only appears inside the actual corner handle
  rectangle that `FloatingWindowComponent.hitTestInput(...)` can hit;
- `nativeVerticalGutter > 0`; if it remains 0 after `scrollbar-gutter: stable`,
  the smoke fails and Gate 3.6 is blocked instead of accepting weak evidence.

### Step 4: Update Gate 3.5 Smoke Or Add Gate 3.6 Smoke

Prefer extending the existing Gate 3.5 smoke runner if it keeps the evidence
simple; otherwise create a dedicated Gate 3.6 smoke runner.

Required browser evidence:

- create/focus a floating Inspector with overflowing content;
- assert the window-owned scroll viewport reports `nativeVerticalGutter > 0`;
- sample a scrollbar gutter point on the Inspector window viewport;
- `document.elementFromPoint(...)` at that point is not a resize handle;
- dragging the scrollbar changes `scrollTop`;
- floating window rect is unchanged after scrollbar drag;
- dragging the side resize band outside the scrollbar still changes the window
  width;
- corner resize remains available outside the scrollbar gutter;
- scrollbar gutter points near the bottom/right corner still hit the scrollbar,
  not the resize grip;
- console errors are zero.

Evidence files:

```text
temp/editor-inspector-window-scroll-ownership-smoke-data.json
temp/editor-inspector-window-scroll-ownership-smoke-report.md
```

Implementation note: Chromium's native scrollbar drag in headless mode can
change scroll position without exposing the scrollbar pointer as a page-level
actor-input event. Gate 3.6 therefore proves actor-input semantics with
targeted component tests against the real `ActorInputHit` objects, and proves
browser-visible behavior with smoke evidence: positive native gutter,
`elementFromPoint(...)` not on a resize handle, scrollTop changed, and the
floating frame rect unchanged. The enhanced smoke also verifies right-side
resize still changes width, bottom-right corner resize still changes width and
height, and a bottom/right scrollbar gutter sample remains outside resize
handles.

Closure amendment: the first Gate 3.6 pass moved corner handles outside the
content edge but accidentally drew the bottom-right `::after` grip back into
the window content area. That created a second visual/cursor fact: the browser
could show a diagonal resize cursor where actor-input could not hit
`resize-bottom-right`. The closure patch keeps the grip visual inside the same
bottom-right handle element (`right: 4px; bottom: 4px`) and adds a boundary
test to prevent the old `right: 20px; bottom: 20px` offset from returning.

### Step 5: Boundary Tests

Update `architecture-boundaries.test.ts` or targeted tests to lock:

- floating hit-test no longer lets side/corner resize handles preempt
  `content-scrollbar`; this must be proven by comparator and behavior tests,
  not by source-order regex as the primary evidence;
- `window-content-scrollbar` uses actor-input region `content-control`;
- `root-content-scrollbar` and `window-content-scrollbar` do not explicitly use
  `actorInputScopeRoutePriority.windowContent`;
- the window hit candidate helper must live in the window/input owner and not
  in `actor-system/core`; in this gate it should remain window-runtime internal
  unless root and floating frames share it immediately;
- surface internals remain safe: splitters/tab chrome must not overlap the
  measured content scrollbar gutter, or the surface owner must adopt the same
  comparator categories;
- side resize handles remain present but do not become a feature-local scroll
  workaround;
- bottom/right grip visual CSS stays inside the same resize handle rectangle
  that owns cursor and hit-test; boundary tests should reject the old
  `right: 20px; bottom: 20px` style that drew the grip into content.
- no Inspector-specific scrollbar/resize CSS is introduced.
- accepted DOM auxiliary paths remain narrow:
  - pointer activation stays actor-input;
  - NumberField native input events remain inside the generic field control;
  - menu DOM hover/outside-dismiss remains tracked by `ARB-005`, is allowlisted
    only inside `packages/ui-framework/src/ui/menu`, and does not reintroduce
    DOM click activation.

### Step 6: Validation Matrix

Targeted:

```text
npm run test -w wallpaper-tesseract -- floating-window-component workspace-root-dock-frame-component architecture-boundaries
npm run test -w ui-framework -- window-frame-surface-component
npm run typecheck -w wallpaper-tesseract
npm run typecheck:test -w ui-framework
npm run build -w ui-framework
npm run build -w wallpaper-tesseract
```

Browser:

```text
npm run dev -w wallpaper-tesseract -- --host 127.0.0.1
EDITOR_INSPECTOR_WINDOW_SCROLL_SMOKE_URL=http://127.0.0.1:<port>/?resetWorkspaceLayout=1 node apps/wallpaper-tesseract/scripts/run-editor-inspector-window-scroll-ownership-smoke.mjs
```

Final:

```text
npm run test
npm run typecheck
npm run build
git diff --check
```

## Exit Criteria

- Visible floating content scrollbar can be hovered and dragged without resize
  cursor or resize behavior stealing the pointer.
- Gate 3.6 smoke proves a real positive native scrollbar gutter; weak
  `nativeVerticalGutter: 0` evidence cannot pass.
- Content scrollbar hits use the existing actor-input `content-control` scope.
- Floating side resize still works outside the content scrollbar gutter.
- Corner resize still works outside the content scrollbar gutter and does not
  cover a visible scrollbar control.
- Resize cursor visibility and resize operability are the same fact: a diagonal
  resize cursor must only appear where the corresponding corner resize handle
  can actually be hit by actor input.
- The fix is generic to floating windows, not Inspector-specific.
- Gate 3.5 window-owned scroll model remains intact.
- No new DOM event shortcut is introduced to compensate for hit-test ordering.

## Stop Conditions

Stop and revise if:

- scrollbar priority requires disabling floating resize entirely;
- CSS geometry cannot avoid covering the scrollbar without app/feature-specific
  selectors;
- fixing hover cursor requires browser-specific hacks that make hit-test state
  diverge from DOM state;
- the root/floating frame adapters need incompatible scrollbar semantics.
