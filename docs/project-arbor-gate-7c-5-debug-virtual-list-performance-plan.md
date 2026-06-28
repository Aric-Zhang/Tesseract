# Project Arbor Gate 7C.5: Virtual List And Debug Performance Closure

Status: planned, must run before Gate 7D
Created: 2026-06-29
Scope: `packages/ui-framework` collection controls and
`packages/editor/src/debug`; app code changes only for boundary/smoke support.

## Reason

Gate 7C successfully moved Debug Log from a monolithic `<pre>` to
`UiElementComponent + ScrollViewComponent + ListViewComponent`, but it exposed a
performance problem: opening Debug Window noticeably slows pointer/render
interaction, and closing it restores smoothness.

The confirmed hot path is not theme/CSS/scrollbar rendering. It is the current
collection refresh model:

- `ListViewComponent` declares `frameUpdateAttachment`.
- Its `updateFrame()` calls `refreshItems()` every frame.
- `refreshItems()` walks child actors, reads `ListViewItemComponent`, sorts
  entries, rewrites row DOM state, and appends every row to the list root.
- Debug Log also reconciles up to `maxLines` log entries through per-log actor
  and component updates whenever the log is dirty.

Browser probing during Gate 7C closure showed that, with Debug open, ListView
row append calls continue in stable frames; with Debug closed, those calls drop
to zero and frame cadence recovers. This makes Gate 7C.5 a required cleanup
before Gate 7D theme work. Gate 7D should not build theme/manual-switching UX on
top of a known high-frequency collection performance flaw.

## Design Direction

Keep two collection families with distinct owners:

- `ListViewComponent`: actor-backed, for moderate-size collections whose items
  are true actor/component participants. It is useful for selectable rows,
  inspector fields, commands, or future interactive lists.
- `VirtualListViewComponent`: data-backed, for large or high-frequency passive
  collections such as logs. The actor is the view/control; rows are private DOM
  pool entries, not actors.

Do not turn `ListViewComponent` into a multi-mode catch-all. A single component
that sometimes reads actor children and sometimes consumes a data source would
create a confusing double ownership model. Debug Log is an append-only passive
stream; its individual lines are not UI actors and should not enter the actor
tree.

This follows the durable pattern used by mature UI systems:

- Virtualized list controls recycle a small number of row visuals.
- Large data sets are represented as models/data sources, not as one UI object
  tree node per row.
- Expensive rebuilds are explicit and rare; common updates are incremental or
  viewport-bound.

## Non-Negotiables

- No compatibility path from Debug Log back to `<pre>` or whole-log
  `textContent = join(...)`.
- No Debug-specific special case in `ui-framework`.
- No per-log actor/component path after Debug migrates to virtual list.
- No actor-input activation for the virtual list in this gate. Debug is a
  passive stream.
- No custom scrollbar/thumb implementation. Native scrolling remains owned by
  `ScrollViewComponent`.
- No async/infinite-loading abstraction in this gate. The first data source is
  synchronous and in-memory.
- No variable-height virtualization in this gate. Fixed row height is the
  explicit contract.
- No app/editor product imports in `packages/ui-framework/src/ui/collection`.
- Row pool DOM is private implementation. Product code may use stable diagnostic
  datasets for smoke/test evidence only.

## Target API

Add a reusable `VirtualListViewComponent` under
`packages/ui-framework/src/ui/collection`:

```ts
export interface VirtualListItemSnapshot {
  readonly key: string;
  readonly text: string;
  readonly selected?: boolean;
  readonly enabled?: boolean;
  readonly muted?: boolean;
}

export interface VirtualListDataSource {
  readonly revision: number;
  getItemCount(): number;
  getItem(index: number): VirtualListItemSnapshot;
}

export interface VirtualListViewComponentOptions {
  readonly id?: string;
  readonly source: VirtualListDataSource;
  readonly rowHeightPx?: number;
  readonly overscan?: number;
  readonly textStyle?: "default" | "mono";
  readonly textOverflow?: "truncate";
}
```

Required behavior:

- Requires same-actor `UiElementComponent` and `ScrollViewComponent`.
- Uses the `UiElementComponent.element` as the scroll root, sharing the
  `ScrollViewComponent` native scroll state.
- The `source` object is owned by the feature/view actor factory that creates
  the view. `VirtualListViewComponent` only reads it. Business components may
  mutate the same source only through explicit methods on that source object.
  The virtual list must not discover sources through a global registry, DOM,
  actor lookup, or component lookup.
- Maintains one spacer element for total height and a small absolute-positioned
  row pool for visible rows plus overscan.
- Reuses row elements by pool slot; it must not create one DOM node per data
  item.
- Rebinds visible rows on scroll and explicit source refresh.
- Tracks `source.revision`; if revision and viewport range did not change,
  refresh is a no-op.
- Assumes fixed `rowHeightPx`. Text is rendered as a single visual line with
  `white-space: nowrap`, `overflow: hidden`, and `text-overflow: ellipsis`.
  This is a deliberate Debug behavior change from wrapping rows so fixed-height
  virtualization remains simple and correct. If wrapped/variable-height logs
  become necessary later, they require a separate variable-height virtualization
  design.
- On its own scroll handler, rebind visible rows and refresh
  `ScrollViewComponent` diagnostics so `data-ui-scroll-at-end` / start do not
  go stale after user scrolling.
- Exposes explicit methods such as `refreshItems()` and
  `scrollToEnd()`/`preserveEndOnMutation(...)` only if needed by Debug. Do not
  attach it to every frame by default.
- Writes stable diagnostics:
  - `data-ui-virtual-list-view`
  - `data-ui-virtual-list-item-count`
  - `data-ui-virtual-list-first-index`
  - `data-ui-virtual-list-last-index`
  - row `data-ui-virtual-list-row`
  - row `data-ui-virtual-list-key`
  - row `data-ui-virtual-list-index`

Reuse existing semantic token styling where possible. If new CSS is needed,
add generic `.ui-virtual-list-view` / row selectors to
`ui-framework-controls.css` and keep all colors/borders/fonts token-backed.

## Execution Steps

### Step 0: Baseline And Guardrails

0. Create a Git checkpoint for the completed Gate 7C implementation before
   deleting the per-log actor path in Gate 7C.5. The current worktree contains
   Gate 7C code and docs; do not mix an uncommitted 7C baseline with the 7C.5
   deletion unless the user explicitly chooses to keep one combined commit.
1. Record the current issue in `docs/known-defects-and-todos.md` as an Arbor
   performance closure item.
2. Keep Gate 7C smoke evidence as the functional baseline:
   `temp/project-arbor-gate-7c-debug-smoke-data.json`.
3. Confirm the current performance suspicion with a light browser probe or
   targeted test evidence:
   - Debug open causes repeated ListView row refresh/append without log change.
   - Debug closed drops this work to zero.
4. Do not start Gate 7D until this plan is either complete or explicitly
   amended.

### Step 1: Make Actor-Backed ListView Owner-Driven

Remove `frameUpdateAttachment` from `ListViewComponent`.

Required cleanup:

- Delete `FrameUpdateParticipant` from `ListViewComponent`.
- Delete `updateFrame()` from `ListViewComponent`.
- Delete `attachments: [frameUpdateAttachment]` from
  `list-view-definition.ts`.
- Keep `refreshItems()` as the explicit owner-driven update path.

Rationale:

- Actor-backed lists do not know when their data changed unless an owner tells
  them.
- Per-frame refresh is the wrong default and was the immediate source of Debug
  idle cost.

Tests:

- Update ListView tests to prove no `frameUpdateAttachment` import/attachment.
- Keep tests for explicit `refreshItems()` rendering, stale row cleanup, and
  dispose restoration.

### Step 2: Add A Minimal ListView No-Op Guard

Keep actor-backed `ListViewComponent` simple. After Debug moves away from
per-log actors, there is no current high-frequency production owner for
actor-backed ListView. Do not add a full diff/cache system for hypothetical
future controls.

Required behavior:

- Add a minimal normalized signature from active item entries:
  actor id, item id, text, order, selected/enabled/muted.
- If the signature matches the previous explicit `refreshItems()` call, return
  without DOM writes.
- Keep the existing full refresh path when the signature changes.
- Do not add per-row descriptor caches, row patch APIs, or future selection
  plumbing in this gate.

Tests:

- Repeated `refreshItems()` with unchanged descriptors performs no row append.
- Descriptor or order changes still refresh rows deterministically.

This preserves `ListViewComponent` as a reusable actor-backed collection while
avoiding speculative complexity.

### Step 3: Add Generic VirtualListViewComponent

Implement `VirtualListViewComponent` and definition under
`packages/ui-framework/src/ui/collection`.

Required files:

- `virtual-list-view-component.ts`
- `virtual-list-view-definition.ts`
- tests in `virtual-list-view-component.test.ts`
- exports through `collection/index.ts`
- registration in `install-ui-component-definitions.ts`

Tests:

- Renders only visible rows plus overscan for a large data source.
- Scrolling changes bound row keys/indexes without increasing row pool beyond
  the visible+overscan limit.
- Source revision changes rebind rows.
- Same revision and same range is a no-op.
- Dispose removes pool/spacer DOM and restores any component-applied state.
- Requires same-actor `UiElementComponent` and `ScrollViewComponent`; no hidden
  DOM ownership is created.
- User scroll updates visible range and refreshes scroll diagnostics.
- Fixed-height contract rejects or normalizes unsupported wrap/variable-height
  options; no wrapping text mode is exposed in Gate 7C.5.
- Production source grep proves no editor/app/window/runtime product imports.

### Step 4: Migrate Debug Log To Virtual List

Replace the Debug-specific actor item path with a data-backed model.

Required cleanup:

- Delete `DebugLogEntryActorReconciler`.
- Delete `isDebugLogEntryActorId` exports and imports.
- Delete Debug log item actor filtering from ToolWindow hierarchy source
  filters.
- Delete `ListViewComponent` / `ListViewItemComponent` use from Debug Log.
- Create a Debug-owned data source object in `createDebugLogViewActor(...)`.
  The same object is injected into `VirtualListViewComponent` and
  `DebugLogContentComponent`.
- `DebugLogContentComponent` writes only to that source: append log line,
  trim ring buffer, advance revision, mark dirty. It must not look up the
  virtual list through a global registry or discover it via DOM.
- `VirtualListViewComponent` reads only from that source. It must not mutate
  Debug log data.
- Debug factory should install:
  - `UiElementComponent`
  - `ScrollViewComponent`
  - `VirtualListViewComponent`
  - `DebugLogContentComponent`
- Empty Debug state should be represented by the virtual list source, not by a
  placeholder actor.

Required behavior:

- Append is O(1) for the data model, except for ring-buffer trim.
- Refresh scheduling is owned by `DebugLogContentComponent`:
  - `append(...)` must not synchronously rebind DOM for each log entry;
  - existing `frameUpdateAttachment` remains as the dirty batching entry;
  - idle frames do only an O(1) dirty check and return;
  - dirty frames call the virtual list once, bounded by visible row count.
- If the user is at bottom before append, Debug stays at bottom.
- If the user has scrolled away from bottom, append does not steal scroll.
- Closing Debug destroys no per-log actors because none exist.

Tests:

- Debug factory registers same actor UI element as content.
- After many appends, actor children under Debug do not include log-entry
  actors.
- Max-line trim keeps correct visible/log source content.
- Close/dispose removes virtual rows and content registration.
- Idle update frames do not rebind virtual rows when no log data changed.
- Multiple appends before one update frame produce one virtual-list refresh.
- No `DebugLogEntryActorReconciler`, `isDebugLogEntryActorId`, or
  `:log-entry:` production path remains.

### Step 5: Boundary, Smoke, And Performance Evidence

Update architecture boundaries:

- Generic collection controls remain product-agnostic.
- `ListViewComponent` is not frame-attached.
- Debug Log uses `VirtualListViewComponent`, not actor item rows.
- Debug has no `<pre>`, whole-log `join`, Debug CSS import/export, or per-log
  actor id path.

Refresh Gate 7C browser smoke:

- Use real app pointer/gizmo activity to generate logs.
- Record row count, virtual item count, visible range, row pool size, and
  row-pool upper bound.
- Verify bottom auto-scroll and non-bottom scroll preservation.
- Verify Debug close/reopen.
- Verify Hierarchy does not show Debug log lines or virtual rows.
- Add performance evidence:
  - idle Debug open does not perform per-frame row append/rebind;
  - generated log bursts update only bounded visible row pool;
  - Debug closed performs zero virtual list work.

Suggested evidence files:

- `temp/project-arbor-gate-7c-5-debug-performance-data.json`
- `temp/project-arbor-gate-7c-5-debug-performance-report.md`

### Step 6: Validation Matrix

Run targeted checks:

```text
npm run test -w ui-framework -- scroll list virtual collection
npm run typecheck:test -w ui-framework
npm run build -w ui-framework
npm run test -w editor -- debug
npm run typecheck -w editor
npm run build -w editor
npm run test -w wallpaper-tesseract -- architecture-boundaries
npm run typecheck -w wallpaper-tesseract
npm run build -w wallpaper-tesseract
```

Then run fresh browser smoke for Gate 7C.5.

Run root checks if the implementation touches shared definitions beyond the
files listed in this plan:

```text
npm run test
npm run typecheck
npm run build
```

## Exit Criteria

Gate 7C.5 is complete only when:

- Debug no longer creates one actor/component per log line.
- Debug no longer uses `ListViewComponent` for high-frequency log rows.
- `ListViewComponent` no longer refreshes every frame by default.
- `VirtualListViewComponent` is generic, package-owned, tested, and installed
  through the normal UI definition path.
- Browser evidence proves Debug open idle state does not continuously rewrite
  list rows.
- Gate 7D can proceed without carrying a known Debug performance workaround.

## Future Follow-Ups

These are intentionally not part of Gate 7C.5:

- Table/multi-column virtual view.
- Row activation/selection for virtual lists.
- Variable row height virtualization.
- Async/infinite data loading.
- Custom scrollbars.
- Large Hierarchy fixture `ARB-001`, unless the virtual list work naturally
  provides reusable smoke utilities.
