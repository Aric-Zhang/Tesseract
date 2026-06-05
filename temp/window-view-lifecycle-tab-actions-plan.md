# Window View Lifecycle And Tab Actions Plan

Date: 2026-06-06

## Context

The continuation work reached Step 8 and then correctly stopped before Step 9.
Dock preview UX, dock tree extraction, and future view identity scaffolding are
in place. The next planned item, tab-level actions, cannot be implemented by
reusing the current frame close path.

Current facts:

- `WindowFrameLifecycleController` exposes `closeFrame(...)`, but no
  `closeView(...)`.
- `closeFrame(...)` is intentionally a whole-frame transaction: it collects all
  live views currently owned by that frame, runs their cleanup, then destroys the
  frame actor.
- `WindowViewFactoryResult.dispose` is a generic callback and does not state
  whether it disposes view runtime resources, the view actor, or the original
  frame handle.
- `RegisteredActor.dispose()` directly calls `ActorSystem.destroyActor(actor)`,
  so a factory disposer derived from a registered frame handle is a frame/tree
  disposer, not a view-runtime cleanup hook.
- Debug/Hierarchy factory disposers still come from their original
  `RegisteredWindowActor` handle. After docking/reparenting, that handle no
  longer means "close this tab".
- Scene has additional runtime resources, current-scene source state, observers,
  renderer/camera/tesseract actors, and fullscreen sessions. It needs explicit
  view-level cleanup.

Therefore, tab close must wait for an explicit view-level lifecycle contract.

## Non-Goals

- Do not add tab close buttons before the lifecycle contract is implemented and
  tested.
- Do not make tab actions DOM click shortcuts; they must go through actor input
  and lifecycle intent ports.
- Do not change frame close behavior by silently reusing tab close semantics.
- Do not introduce multi-instance behavior in this batch.
- Do not change the persisted layout main format in this batch.

## Step 8.5: Current Work Cleanup Gate

### Goal

Close out the already implemented Step 6-8 work before starting lifecycle
contract changes.

### Required Work

- Review and keep only source/test/temp artifacts relevant to Step 6-8:
  - `window-frame-dock-tree.ts` and tests;
  - `window-view-identity.ts` and tests;
  - dock preview CSS/data attribute changes and tests;
  - Step 7 smoke report/data/screenshot.
- Ensure obsolete or failed dev-server artifacts are not mistaken for current
  smoke evidence.
- If the repository policy for this session requires a checkpoint, make a git
  commit before Step 9 lifecycle work.

### Tests

```text
npm run test -w wallpaper-tesseract
npm run typecheck -w wallpaper-tesseract
npm run build -w wallpaper-tesseract
```

Expected: all pass; Vite chunk warning is allowed.

## Step 8.6: Real Pointer Path Docking Smoke

### Goal

Fill the QA gap left by the Step 7 browser report: static/browser read checks
and unit tests are enough for architecture confidence, but not enough to prove
native drag behavior end-to-end.

### Required Work

- Run the app in a browser path capable of native pointer drag.
- Verify:
  - dragging a tab to another tabbar shows merge preview and commits merge;
  - dragging a tab to left/right/top/bottom content edges shows split preview
    and commits split;
  - dragging to content center produces floating/no-dock behavior according to
    current rule;
  - dragging titlebar empty area moves the frame and never starts dock preview;
  - console errors are 0.
- Save report and, where possible, screenshots or DOM/state dumps under
  `temp/`.

### Browser Fallback Rule

If in-app browser automation cannot synthesize native pointer input, use the
available desktop/browser automation path that can. Record which tool path was
used and stop the dev server started for the smoke.

## Step 9: View-Level Lifecycle Contract

### Goal

Add a first-class "close one view" lifecycle operation that is independent from
"close one frame".

### Public Contract

Add a lifecycle entry:

```ts
closeView(
  viewActorId: string,
  reason: "tab-action" | "programmatic"
): WindowCloseViewResult
```

Add an intent sink entry for future UI:

```ts
requestCloseView?(
  viewActorId: string,
  reason: "tab-action" | "programmatic"
): void
```

`WindowCloseViewResult` should report:

- `closed: true | false`;
- reason if not closed;
- source frame id;
- whether the owner frame was destroyed;
- next active view actor id when a frame remains;
- optional `warning` for recoverable cleanup failures;
- optional `error` for unrecoverable failures where the controller could not
  reach a consistent state.

### Factory Contract

Replace or supplement the ambiguous `WindowViewFactoryResult.dispose` with a
clear view-runtime cleanup hook:

```ts
disposeViewRuntime?(): void
```

Rules:

- This hook is idempotent.
- It must not destroy the frame actor.
- It must not destroy the view actor unless explicitly documented later.
- It may unregister app-level tracking, clear current runtime pointers, and
  dispose non-component resources such as observers.
- Actor tree mutation remains owned by `WindowFrameLifecycleController`.

Transitional rule:

- Keep old `dispose` only as a compatibility alias until every factory migrates.
- `closeView(...)` must use an explicitly provided `disposeViewRuntime`.
- `closeView(...)` must not fall back to the old `dispose` field. If a live view
  has no explicit `disposeViewRuntime`, closing it should fail with
  `closed: false` and a clear reason.
- Factories must not implement `disposeViewRuntime` by calling
  `RegisteredActor.dispose()` for the original frame handle.
- `closeFrame(...)` may be refactored to use the same internal per-view cleanup
  helper, but it remains a whole-frame operation.

### Close Sequence

`closeView(viewActorId, reason)` should:

1. Resolve the live view by actor id.
2. Cancel active actor input.
3. Exit that view's fullscreen session if present.
4. Run `disposeViewRuntime` once.
5. Remove the tab from the owner `WindowFramePort`.
6. Destroy the view actor subtree through `ActorSystem.destroyActor(viewActor)`.
7. Remove the live view registry entry.
8. If the owner frame has no remaining live views or tabs, destroy the frame
   actor.
9. If the frame remains, ensure the frame has a valid active tab and focus the
   owner frame.

### Exception Strategy

The controller should preserve consistency over optimistic progress:

- Validate that the live view, owner frame, owner port, and tab still exist
  before mutating.
- Cancel input before any mutation.
- If `disposeViewRuntime` throws, do not remove the tab or destroy actors. Return
  `closed: false` with `error`, and leave live registry/dock tree unchanged.
- If fullscreen exit/restore throws, return `closed: false` with `error`; do
  not continue into tab removal while the view may still be owned by a temporary
  fullscreen frame.
- If tab removal throws before actor destruction, return `closed: false` and
  leave the live registry intact.
- If `ActorSystem.destroyActor(viewActor)` throws after the tab was removed,
  remove the live registry only if the actor is no longer present; otherwise
  attempt to restore the tab when possible and return `closed: false` with
  `error`.
- If empty-frame destruction throws after the view was closed, return
  `closed: true` with `warning`; the closed view must not remain live.
- Repeated `closeView` for the same view after a successful close should return
  `closed: false` with a stable "view is not live" reason.

### Fullscreen Session Rules

Closing a view with an active fullscreen session is part of Step 9, not a later
UI cleanup:

- Direct fullscreen, single Scene frame:
  - exit fullscreen or clear the session before removing the view;
  - closing the only view destroys the frame;
  - render loop must not hold stale Scene runtime references.
- Isolated fullscreen from a mixed tab frame:
  - close must remove the runtime-only fullscreen frame;
  - restore source frame layout only as needed to keep remaining tabs
    consistent;
  - the source frame must not remain hidden because the fullscreen frame was
    closed.
- Isolated fullscreen from a split frame:
  - close must remove the runtime-only fullscreen frame;
  - source split root must be restored or normalized without the closed view;
  - no stale tabset, fullscreen session, or current Scene pointer may remain.

Close-view implementation may call an internal fullscreen cleanup helper, but it
must not rely on user-visible "restore" UI before closing.

### Scene-Specific Rules

Scene view close must:

- clear `CurrentSceneViewSource` if it points to that runtime;
- dispose Scene runtime observers/motion resources idempotently;
- destroy Scene view actor subtree, including Camera3/Tesseract child actors;
- leave Window menu able to recreate a fresh Scene view later;
- not leave stale render loop references. The app render loop should continue to
  use `currentSceneView.current?.render()`.

### Debug/Hierarchy Rules

Debug/Hierarchy view close must:

- unregister app-level tracking without calling the original frame handle
  disposer;
- the factory should keep the `RuntimeRegistration` returned by
  `trackRegisteredActor(handle)` and expose a `disposeViewRuntime` hook that
  only calls that registration's `dispose()`;
- the hook must not call `handle.dispose()` and must not call
  `RegisteredActor.dispose()` for the original frame actor;
- let `ActorSystem.destroyActor(viewActor)` dispose the content component and
  detach the content attachment;
- keep menu recreate behavior fresh-create based on `WindowViewKey`.

### Tests

Add or update `window-frame-lifecycle-controller.test.ts`:

- closes inactive tab in a mixed frame and keeps frame alive;
- closes active tab and selects a neighboring tab;
- closes tab in split pane and collapses empty split branches;
- closes last tab and destroys the frame actor;
- closes Scene tab and clears current Scene runtime;
- closes Scene from direct fullscreen single-frame state;
- closes Scene from isolated fullscreen created from a mixed tab frame;
- closes Scene from isolated fullscreen created from a split frame;
- menu recreate works after Scene/Debug/Hierarchy view close;
- closing a view then saving/refreshing layout does not persist stale views or
  runtime-only fullscreen frames;
- closing active Scene leaves render loop quiet and error-free;
- closing split pane last item collapses the split while preserving the
  surviving tabset id;
- repeated `closeView` is idempotent and returns `closed: false`;
- no stale live view remains in location/source snapshot;
- active input cancel is called.

Add factory tests where needed:

- Scene `disposeViewRuntime` does not destroy frame actor directly.
- Debug/Hierarchy runtime cleanup unregisters tracking without calling frame
  handle dispose.
- Missing `disposeViewRuntime` is not silently replaced with old `dispose`.

Run:

```text
npm run test -w wallpaper-tesseract -- window-frame-lifecycle-controller scene-view-runtime debug-log-window-actor-factory hierarchy-panel-actor-factory
npm run typecheck -w wallpaper-tesseract
```

## Step 9.5: Refactor Frame Close To Share Per-View Cleanup Safely

### Goal

Keep frame close behavior intact while removing the duplicate/ambiguous disposer
path.

This step is mandatory before implementing visual tab close. Skipping it would
leave frame close and tab close on divergent cleanup paths.

### Required Work

- Introduce an internal helper such as `disposeLiveViewForClose(...)`.
- `closeView(...)` uses it for one view, then maybe destroys empty frame.
- `closeFrame(...)` uses it for all current live views in that frame, then
  destroys the frame once.
- `closeFrame(...)` must not recursively call public `closeView(...)` in a way
  that races empty-frame destruction after each tab.

### Tests

- Existing frame close tests remain green.
- Closing a mixed frame still closes all views and destroys one outer frame.
- Repeated frame close remains idempotent.

Run:

```text
npm run test -w wallpaper-tesseract -- window-frame-lifecycle-controller floating-window-component
npm run typecheck -w wallpaper-tesseract
```

## Step 10: Tab Action Model Without Visual Buttons

### Goal

Add the tab action data model and actor-input hit path while keeping visual tab
close buttons off until the model is proven.

### Model

```ts
type WindowTabAction =
  | {
      kind: "close-view";
      viewActorId: string;
      viewKey: WindowViewKey;
    };
```

### Required Work

- Add a tab action model module or colocate it with `window-frame-port`.
- Add `requestCloseView` to `WindowFrameIntentSink`.
- Add component tests using a non-visual/hit fixture to prove tab action hits go
  through actor input.
- Add or update an architecture boundary test:
  - tab action code must not use DOM `click` listeners or `.onclick`;
  - tab action code must submit through
    `WindowFrameIntentSink.requestCloseView`;
  - tab action code must not call `closeFrame` or `requestCloseFrame`.
- Do not add visible close buttons to every tab in this step.

### Tests

- action hit data is strongly typed;
- disabled/nonexistent tab action does not submit command;
- tab action intent calls `requestCloseView(viewActorId, "tab-action")`;
- frame close button still submits `requestCloseFrame`;
- tab action does not trigger titlebar drag or tab drag.

## Step 11: Visual Tab Close UI

### Goal

Add actual per-tab close controls after lifecycle and action model are stable.

### Design Rules

- The outer frame close button remains one per frame.
- Tab close button is visually inside the tab and only closes that view.
- Hit-test priority distinguishes:
  - tab close action;
  - tab drag/activate;
  - titlebar empty drag;
  - frame close.
- On narrow tabs, close control may appear only on active/hovered tab if needed
  for layout stability.

### Tests

- Component tests for tab close hit priority.
- Architecture boundary from Step 10 remains green.
- Browser smoke:
  - close inactive tab;
  - close active tab;
  - close split-pane tab;
  - close Scene tab and recreate via Window menu;
  - outer frame close still closes all contained tabs.

## Step 12: Continue With Responsive And Accessibility Work

After Step 11 passes, resume the broader continuation plan:

- responsive tab strip and mobile viewport;
- keyboard/accessibility pass;
- Hierarchy tree follow-up;
- true multi-instance pilot.

Do not start true multi-instance until view-level close, menu recreate, and
layout persistence are stable with tab close.
