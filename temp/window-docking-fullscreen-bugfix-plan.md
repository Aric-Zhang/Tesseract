# Window Docking And Scene Fullscreen Bugfix Plan

## Purpose

This plan collects the currently located docking/fullscreen bugs and turns them
into long-term architecture fixes instead of local patches.

It should be treated as a required gate before continuing broader docking,
persistence, and multi-instance work.

The two active bugs are:

1. When Scene is docked in a frame and is not the only tab/view, clicking
   fullscreen isolates Scene, but the original mixed frame may remain visible.
2. When a frame has multiple tabsets/panes, dragging a third window/tab onto the
   frame only docks into one tabset/pane; the other tabset/pane can be
   unresponsive.

Both bugs are caused by model boundaries that are still too coarse:

- Scene fullscreen isolation separates content ownership, but not transient
  frame visibility ownership.
- Dock target resolution treats each frame as one coarse hit candidate, even
  though split frames expose multiple tabset-level targets.

## Current Architecture Context

Already in place:

- FrameActor + ViewActor model.
- Content deck and rehost support.
- Merge tabs, split dock, float tab, splitter resize.
- Scene view fullscreen isolation for mixed frames.
- Layout persistence/hydration keyed by `WindowViewKey`.
- `WindowViewLocationSource` as the current view owner source.
- `WindowFramePort.getRuntimeDockRoot()` and
  `WindowFramePort.restoreRuntimeDockRoot()`.

Known implementation debt that this plan must explicitly retire:

- `WindowViewFullscreenRestoreTarget` currently stores mutable `Actor` and
  `WindowFramePort` references internally. That is acceptable only as a
  short-lived transition. The fix must move restore state to stable logical data
  and reacquire live frame ports through lifecycle-owned lookup.
- `FloatingWindowComponent` currently requires `FloatingWindowParameterPaths`.
  Runtime-only frames should not be implemented as scattered `paths === null`
  branches. Use a small state adapter/union so persistent and runtime-only frame
  state follow the same internal interface.
- `WindowDockTargetFrame` is now semantically a tabset-level target region. If
  the rename is low-churn, do it in this bugfix batch to prevent future
  frame-level misreadings.

Important invariant to preserve:

```text
View ownership and layout mutation are owned by window-runtime lifecycle ports.
Scene/App/Workspace code must not directly mutate actor tree or concrete window components.
```

## Bug A: Scene Fullscreen Leaves Original Mixed Frame Visible

### Symptom

Scene is docked into a frame with another view. When fullscreen is clicked:

- A temporary Scene-only fullscreen frame appears.
- Other ordinary frames can be hidden.
- The original mixed frame that contained Scene may stay visible.

This is easiest to reproduce when the mixed frame uses Scene's normal window
state path, such as `sceneWindow.visible`.

### Root Cause

The current fullscreen isolation implementation moves Scene content/view
ownership into a temporary frame, but the temporary frame can still reuse the
same persistent `FloatingWindowParameterPaths` as the normal Scene frame.

That means both of these can share one visible path:

```text
original mixed Scene frame -> sceneWindow.visible
temporary fullscreen Scene frame -> sceneWindow.visible
```

`WorkspaceModeController` must protect the current Scene owner from being
hidden during run mode. If the temporary fullscreen frame and source mixed frame
share the same visible path, hiding the original mixed frame would also hide the
temporary Scene fullscreen frame. Therefore the controller ends up unable to
hide the mixed source frame.

The current isolation is only partial:

```text
content ownership: isolated
actor parent: isolated
dock root: captured/restored
frame visibility state: not isolated enough
```

### Long-Term Design

Introduce explicit transient frame state for runtime-only fullscreen isolation
frames.

Temporary fullscreen isolation frames must not use the persistent state paths of
normal Scene/Debug/Hierarchy windows. They should be lifecycle-owned runtime
frames with:

- runtime-only bounds;
- runtime-only visible state;
- non-persistable marker;
- no `sceneParameterPaths.sceneWindow` ownership;
- a way for `WindowViewLocationSource` to report their visibility facts.

The normal source frame can then be hidden independently during run mode.

### Design Rules

1. Persistent frame state belongs to normal user windows.
2. Runtime isolation frames are not user-restorable windows and must not be
   persisted.
3. `WorkspaceModeController` protects the actual temporary fullscreen frame, not
   the source mixed frame.
4. The source mixed frame may be hidden while Scene is isolated.
5. Exiting fullscreen restores the source frame visibility according to the
   develop snapshot, then restores Scene to the captured dock root.

### Required API Changes

#### Frame State Adapter

Introduce a small internal adapter/union in `window-runtime`, not in app feature
code. This should be the only place where persistent scene-parameter state and
runtime-only frame state diverge.

```ts
type FloatingWindowStateBinding =
  | {
      readonly kind: "persistent";
      readonly paths: FloatingWindowParameterPaths;
      requestVisible(visible: boolean, timeStamp?: number): void;
      applySceneChange(event: SceneStateChangedEvent): boolean;
    }
  | {
      readonly kind: "runtime";
      readonly visiblePath: null;
      requestVisible(visible: boolean): void;
      applySceneChange(event: SceneStateChangedEvent): false;
    };
```

The exact names can differ, but the requirement is firm:

- `FloatingWindowComponent` should talk to one internal state binding.
- Persistent frames submit visible/position/size changes through
  `SceneCommandSink`.
- Runtime-only frames mutate local state directly through the binding.
- `visiblePath` is read from the binding and may be `null`.
- Runtime-only frames do not participate in scene parameter persistence.

Avoid implementing runtime-only frames by adding ad hoc null checks throughout
`FloatingWindowComponent`.

#### WindowFramePort

Extend `WindowFramePort` with visibility commands that work for both persistent
and runtime-only frames:

```ts
export interface WindowFramePort {
  readonly visiblePath: ParameterPath<boolean> | null;
  readonly visible: boolean;
  requestVisible(visible: boolean, timeStamp?: number): void;
  restoreFloatingState(state: FloatingWindowState): void;
}
```

`visiblePath === null` means:

- this frame is runtime-only;
- it cannot be hidden/restored through `SceneCommandSink`;
- the frame port owns its own visible state.

#### Lifecycle Fullscreen Session

Refactor isolated fullscreen session state into a logical restore token.

```ts
interface WindowViewFullscreenSession {
  readonly mode: "direct-frame" | "isolated-frame";
  readonly fullscreenFrameId: string;
  readonly sourceFrameId?: string;
  readonly sourceVisiblePath?: ParameterPath<boolean> | null;
}
```

Internal restore state should be based on data, not mutable object references:

```ts
interface WindowViewFullscreenRestoreToken {
  readonly sourceFrameId: string;
  readonly sourceRoot: WindowFrameRuntimeDockNode;
  readonly sourceTabs: readonly WindowFrameTab[];
  readonly sourceActiveViewActorId: string | null;
  readonly sourceBounds: FloatingWindowState;
  readonly sourcePresentation: WindowFramePresentation;
  readonly sourceVisiblePath: ParameterPath<boolean> | null;
  readonly sourceVisibleBeforeRun: boolean | null;
}
```

The lifecycle controller may keep private maps, but the token must not store:

- `Actor`;
- `WindowFramePort`;
- `FloatingWindowComponent`;
- DOM/content host elements.

When restoring, reacquire the source frame and port by `sourceFrameId`. If the
source frame is gone, use a tested fallback path: create a normal floating Scene
frame, rehost Scene there, and clear the fullscreen session. This makes restore
safe across close/destroy/recreate edges and prepares the model for future
hydration.

#### WorkspaceModeController

Change run entry ordering:

1. Ensure Scene view exists.
2. Snapshot develop visibility for all tool frames and the source owner frame.
3. Call `enterViewFullscreen(sceneViewActorId, "programmatic")`.
4. Query Scene location and fullscreen session again.
5. Protect the fullscreen isolation frame.
6. Hide all normal tool frames, including the old source owner frame if it is a
   tool frame or persistent Scene frame.
7. Do not hide the runtime-only fullscreen frame.

Change develop exit ordering:

1. Query fullscreen session.
2. Exit Scene fullscreen.
3. Query Scene location after restore.
4. Restore develop visibility snapshots.
5. Clear run-mode desired visibility.

### Implementation Steps

#### Step A1: Add Runtime-Only Frame State To FloatingWindowComponent

Goal:

- Add a state adapter/union so lifecycle-created temporary frames can exist
  without persistent parameter paths.

Boundary:

- Do not change normal Scene/Debug/Hierarchy persistent window behavior.
- Do not write transient frames into scene parameters or localStorage.

Expected effect:

- A temporary fullscreen frame can be visible even if the source frame is hidden.

Tests:

- `floating-window-component.test.ts`
  - component construction accepts a persistent state binding and a runtime-only
    state binding through the same internal adapter.
  - runtime-only frame has `visiblePath === null`.
  - `requestVisible(false)` on runtime-only frame hides it without submitting a
    scene command.
  - normal persistent frame still submits visible commands through
    `SceneCommandSink`.
  - runtime-only frame ignores unrelated scene state changes.
  - persistent frame still reacts to position/size/visible scene state changes.
  - `restoreFloatingState()` works for persistent and runtime-only frames.

#### Step A2: Make Fullscreen Isolation Frames Runtime-Only And Non-Persistable

Goal:

- `DefaultWindowFrameLifecycleController.enterIsolatedViewFullscreen()` creates
  a temporary frame whose state is independent from the source Scene frame.

Boundary:

- Do not change regular `float-tab` behavior. User-created floating frames still
  use normal persistent paths for now.

Expected effect:

- Source frame can be hidden while temporary Scene fullscreen frame remains
  visible.

Tests:

- `window-frame-lifecycle-controller.test.ts`
  - isolated fullscreen frame has `visiblePath === null`.
  - isolated fullscreen restore token stores frame id/root/tabs/bounds/path
    facts, not `Actor` or `WindowFramePort` references.
  - snapshot while isolation is active omits temporary frame.
  - source mixed frame remains represented by restore root in snapshot.
  - hiding the source frame does not hide temporary fullscreen frame.
  - exiting fullscreen restores Scene to source root.
  - source frame destroyed while fullscreen is active falls back to a normal
    floating Scene frame without stale references.
  - source frame recreated with the same id before restore is handled by
    explicit validation; restore either succeeds against a compatible frame or
    falls back cleanly.

- `window-workspace-layout-persistence.test.ts`
  - snapshot during active isolation does not persist the temporary frame.
  - snapshot during run mode does not persist the source mixed frame as hidden
    just because WorkspaceMode temporarily hid it.
  - persisted layout during isolation is logically equivalent to the develop
    dock layout plus the captured restore root.

#### Step A3: Update Workspace Run/Develop Visibility Rules

Goal:

- Hide the original mixed source frame after Scene is isolated into a temporary
  fullscreen frame.

Boundary:

- Do not hide the actual fullscreen isolation frame.
- Do not regress direct fullscreen when Scene is the only view in a frame.

Expected effect:

- In run/fullscreen mode only Scene is visible. The old mixed frame is hidden.

Tests:

- `workspace-mode.test.ts`
  - Scene in mixed Scene frame: enter run hides the old source frame and keeps
    temporary fullscreen frame visible.
  - Scene in mixed Debug/Hierarchy frame: enter run hides the source tool frame
    after isolation.
  - direct single-view Scene fullscreen still protects that same frame.
  - develop exits isolation before restoring source frame visibility.
  - external attempts to hide the temporary fullscreen frame during run are
    rejected or immediately restored.
  - external visible command against the old source frame during run records
    desired develop visibility but does not reveal the source frame over Scene
    fullscreen.
  - App Menu open/focus of a non-Scene view while Scene fullscreen is active
    exits Scene fullscreen first, then focuses the requested view.
  - Scene docked into a Debug-owned mixed frame and Hierarchy-owned mixed frame
    follows the same hide/restore contract as Scene-owned mixed frame.

#### Step A4: Browser Regression Smoke

Scenarios:

1. Dock Scene with Debug as tabs inside the Scene frame.
2. Click Scene fullscreen.
3. Confirm only the temporary Scene fullscreen frame is visible.
4. Confirm source mixed frame is hidden.
5. Restore and confirm source mixed frame returns with previous tabs.
6. Split Scene next to Hierarchy.
7. Fullscreen Scene.
8. Confirm only Scene fullscreen frame is visible.
9. Restore and confirm split layout returns.
10. While run mode is active, attempt to focus Debug/Hierarchy from the Window
    menu and verify Scene fullscreen exits before the target frame appears.
11. While run mode is active, submit or trigger a visible command for the source
    mixed frame and verify it does not cover the Scene fullscreen frame.
12. Confirm console errors are 0.

Record:

```text
temp/window-scene-fullscreen-source-hide-smoke-report.md
temp/window-scene-fullscreen-source-hide-smoke-data.json
temp/window-scene-fullscreen-source-hide-smoke.png
```

## Bug B: Only One Tabset/Pane Area Accepts Dock In A Multi-Tabset Frame

### Symptom

When a frame has multiple tabsets/panes, dragging a third tab/window over the
frame can dock into one tabset/pane but not the other. The other area behaves as
if no dock target exists.

### Root Cause

`DockTargetFrameSource` correctly exposes each tabset/pane as a separate
target. The current type is named `WindowDockTargetFrame`, but its real meaning
is already "one dockable tabset region inside a frame."

However, `resolveWindowDockPreview()` currently selects one target by checking
only coarse `frame.bounds` and stack priority:

```ts
const candidates = frames
  .filter((frame) => containsPoint(frame.bounds, point))
  .sort((a, b) => b.stackPriority - a.stackPriority);

const target = candidates[0];
```

For a split frame, multiple targets share:

- the same `frameId`;
- the same `bounds`;
- the same `stackPriority`.

Only their `tabBounds` and `contentBounds` differ. Because the resolver picks
the first frame-level candidate before checking those precise bounds, it may
choose the wrong tabset and never evaluate the actual tabset under the pointer.

### Long-Term Design

Dock target resolution must be tabset-target-first, not frame-first.

The target model should be renamed if the change is manageable:

```text
WindowDockTargetRegion = one dockable tabset target inside a frame
```

Preferred rename:

```text
WindowDockTargetFrame -> WindowDockTargetRegion
DockTargetFrameSource -> DockTargetRegionSource
createDockTargetFrameSource -> createDockTargetRegionSource
WindowDockPreviewControllerOptions.source: DockTargetRegionSource
```

If the rename causes too much churn, keep compatibility aliases temporarily, but
new implementation code and tests should use the region terminology.

Selection order:

1. Exclude source frame.
2. Compute a concrete preview candidate for every target:
   - merge if point is in `tabBounds`;
   - split if point is in `contentBounds` edge;
   - no candidate if point is in content center or outside this target.
3. Sort concrete preview candidates by:
   - `stackPriority` descending;
   - target specificity, with tab merge before content split when overlapping;
   - smaller target area first when stack priority ties;
   - stable source order as last tie-breaker.
4. Return the best concrete candidate.
5. Return floating preview only when no concrete candidate exists.

This keeps cross-frame z-order behavior while allowing every tabset/pane in the
front frame to be independently dockable.

### Implementation Steps

#### Step B1: Rename Dock Target Model To Region Terminology

Goal:

- Make the type names match the actual tabset-level model.

Boundary:

- Keep compatibility aliases only if needed to avoid a noisy migration.
- Do not change runtime behavior in this step.

Expected effect:

- New resolver code cannot accidentally treat a target region as the whole
  frame.

Tests:

- `architecture-boundaries.test.ts`
  - dock preview resolver source contains `WindowDockTargetRegion` or an
    explicit compatibility alias comment.
  - production code outside aliases does not introduce new
    `WindowDockTargetFrame` references.

#### Step B2: Refactor Dock Preview Resolution To Concrete Candidates

Goal:

- Evaluate every target's precise tab/content region before choosing a winner.

Boundary:

- Do not change the public drag session contract.
- Do not change lifecycle commit semantics.
- Do not change preview rendering shape.

Expected effect:

- Dragging over any split pane tabbar/content edge resolves to that pane's
  `targetTabsetId`.

Tests:

- `window-dock-targets.test.ts`
  - same frame, two tabset targets, pointer in second tabbar resolves
    `merge-tabs` to second target.
  - same frame, two tabset targets, pointer in second content left edge resolves
    `split` to second target.
  - same frame, pointer in first target still resolves first target.
  - content center across all targets still returns floating.
  - overlapping frames still choose higher `stackPriority`.
  - overlapping tabBounds/contentBounds in same stack prefers tab merge.
  - stable source order is used only as the final tie-breaker after priority,
    preview kind, and area specificity.

#### Step B3: Preserve Per-Tabset Target Reporting

Goal:

- Ensure `FloatingWindowComponent.listDockTargetTabsets()` returns all active
  tabset regions after merge, split, active tab switch, splitter resize, and
  restore from persistence.

Boundary:

- Do not include inactive hidden content as a target if its tabset is not
  visible.
- Do not expose DOM elements outside `FloatingWindowComponent`.

Expected effect:

- The resolver receives a complete list of visible tabset-level targets.

Tests:

- `dock-target-region-source.test.ts` or compatibility
  `dock-target-frame-source.test.ts`
  - split frame reports two target ids with distinct tab/content bounds.
  - after splitter resize, both target bounds update.
  - after restoreRuntimeDockRoot with nested split, all visible tabsets are
    reported.

#### Step B4: Browser Regression Smoke

Scenarios:

1. Create a split frame with two visible panes.
2. Drag a third tab to the first pane tabbar and confirm merge preview/commit.
3. Undo/recreate, then drag third tab to the second pane tabbar and confirm
   merge preview/commit.
4. Repeat for left/right/top/bottom content edge of the second pane.
5. Confirm content center still floats.
6. Confirm console errors are 0.

Record:

```text
temp/window-dock-multi-tabset-target-smoke-report.md
temp/window-dock-multi-tabset-target-smoke-data.json
temp/window-dock-multi-tabset-target-smoke.png
```

## Combined QA Gates

After implementing Bug A and Bug B fixes, run:

```text
npm run test -w wallpaper-tesseract -- workspace-mode window-frame-lifecycle-controller floating-window-component window-dock-targets dock-target-frame-source window-dock-preview-component
npm run test -w wallpaper-tesseract
npm run typecheck -w wallpaper-tesseract
npm run build -w wallpaper-tesseract
```

Browser verification must include:

- Scene docked as inactive tab, then fullscreen.
- Scene docked as active tab with another tab, then fullscreen.
- Scene split next to another view, then fullscreen.
- Source mixed frame hidden while temporary Scene fullscreen frame remains
  visible.
- Restore returns to the original tab/split position.
- Dock third tab into every visible tabset/pane region.
- App Menu remains reachable in develop mode.
- Camera3 drag and double-click still work after restore.
- Tesseract remains visible.
- Console errors = 0.

## Non-Goals

- Do not implement multi-instance windows.
- Do not implement per-tab close buttons.
- Do not rewrite the whole docking model.
- Do not make Scene non-dockable.
- Do not hide non-Scene views inside the same fullscreen mixed frame as the
  final fix.
- Do not persist runtime-only fullscreen frames.

## Handoff Notes

Suggested implementation order:

1. Fix Bug B first if the next work is docking interaction polish. It is smaller
   and mostly pure model/test work.
2. Fix Bug A before doing more run/fullscreen/persistence work. It touches
   lifecycle, workspace mode, and temporary frame state ownership.

The two fixes are independent enough to implement separately, but Bug A should
be completed before any future persistence format changes, because persistence
must never serialize temporary fullscreen isolation frames.
