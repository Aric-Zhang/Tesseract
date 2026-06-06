# Workspace Root Dock Development Plan

Date: 2026-06-06

## Purpose

This plan adds a new top-level dockable workspace: the whole browser viewport is
treated as the application shell, with a menu bar at the top, optional future
toolbar/status bar slots, and a central root dock area that can host the same
ViewActors as floating frames.

This is now the priority feature before the previous remaining cleanup plan,
because it changes the meaning of dock targets, persistence, and frame ownership.

## Requirement Summary

The browser window should feel like a traditional desktop application shell,
similar to Blender, Unity, or VS:

- the browser viewport is the outer application shell;
- the shell itself has no normal window titlebar;
- the top area contains the App Menu, and can later contain a toolbar;
- the bottom area can later contain a status bar;
- the central area is a dockable root workspace;
- normal windows can dock into the root workspace;
- root workspace content can use tabs, splits, and existing ViewActor content;
- floating windows still exist as overlays above the root workspace.

## Architectural Decision

Do not implement this by creating a giant fullscreen `FloatingWindowComponent`.

The root workspace is not a normal floating frame:

- it has no titlebar drag;
- it has no frame close button;
- it does not own floating bounds;
- it should not be hidden through the Window menu;
- it is always present while the app shell exists;
- closing its last tab leaves an empty root workspace, not a destroyed frame.

Instead, add an actor-backed root frame:

```text
AppShellActor
  AppShellComponent
    menu slot
    toolbar slot (future)
    root dock slot
    status slot (future)
    floating overlay slot

WorkspaceRootFrameActor
  WorkspaceRootDockFrameComponent
    ViewActors docked into root

FloatingFrameActor
  FloatingWindowComponent
    ViewActors docked into floating frame
```

`WorkspaceRootDockFrameComponent` should implement the same narrow
`WindowFramePort` contract used by the lifecycle controller, but with root-frame
semantics. It should share dock tree/content-deck behavior with floating frames
where possible, while keeping chrome/bounds/close/drag behavior out.

## Non-Goals

This batch does not implement:

- true multi-instance view identity;
- new menu item types beyond existing open/focus behavior;
- a broad `WindowManager`;
- keyboard docking;
- detachable browser-level native windows;
- toolbar/status bar feature content;
- new Scene resource duplication;
- long-term persistence schema v2 unless the root frame cannot be represented
  safely in the current schema.

## Key Contracts

### Three Core Window Services

The root dock work should introduce or formalize three narrow services instead
of widening `FloatingWindowComponent` into a general manager:

```text
WindowFramePortRegistry
  owns live frame port discovery for floating, root, and runtime fullscreen frames

WindowDockSurface
  owns reusable tab/split/content-deck behavior shared by floating and root frames

WindowFrameKind metadata
  separates floating, root, and runtime-fullscreen frame semantics
```

These services prevent root frames from being controlled by ordinary
visible-path toggles, z-index stack assumptions, or floating-window chrome.

### Root Frame Identity

Use a stable frame id:

```text
workspace-root-frame
```

This id is reserved. User-created floating frames must not reuse it.

### Root Frame State

The root frame is always mounted with the app shell.

Suggested `WindowFramePort` semantics:

| Port Field Or Method | Root Behavior |
| --- | --- |
| `frameId` | `"workspace-root-frame"` |
| `frameKind` | `"root"` |
| `persistenceKind` | `"persistent"` |
| `canSerialize` | `true` when the root has non-empty dock content |
| `visiblePath` | may be `null`; serialization must not be inferred from this field |
| `visible` | `true` while app shell is alive |
| `presentation` | `"windowed"` for develop shell; no titlebar/fullscreen chrome |
| `getFloatingBounds()` | current root dock slot rect |
| `restoreFloatingState()` | no-op for bounds; may restore dock tree |
| `requestVisible()` | no-op or warning; root cannot be hidden by Window menu |
| `setPresentation()` | generally no-op; Scene fullscreen isolation must not fullscreen the whole root |
| `listDockTargetTabsets()` | root tabsets and split panes |
| `getRuntimeDockRoot()` | root dock tree |
| `restoreRuntimeDockRoot()` | restore root dock tree |
| `getContentHost(viewActorId)` | per-view content deck host |

`visiblePath` must stop being the implicit persistence discriminator. The plan
requires explicit frame metadata:

| Frame Kind | `visiblePath` | `persistenceKind` | `canSerialize` |
| --- | --- | --- | --- |
| floating | parameter path or runtime binding | persistent or runtime-only | explicit |
| root | usually `null` | persistent | true only with non-empty dock content |
| runtime-fullscreen | `null` | runtime-only | false |

Architecture docs and boundary tests should be updated when this metadata lands.

### Input Priority

The root dock frame participates in actor input, but with lower stack priority
than floating frames.

Recommended priority order:

```text
App Menu / global shell controls
Floating frames, ordered by focus stack
Workspace root dock frame
Scene/canvas background inside root content
```

This protects the App Menu and focused floating windows from being covered by
the root workspace.

### Lifecycle Ownership

`WorkspaceRootDockFrameComponent` must not mutate the actor tree directly.

It emits the same lifecycle intents as floating frames:

- activate tab;
- request tab close;
- request tab float;
- request dock commit.

`WindowFrameLifecycleController` remains the single owner of create/destroy,
reparent, float, split, merge, close, and fullscreen-isolation mutations.

### Persistence

The root frame is a persistent frame, but its bounds are shell-derived.

Initial persistence rule:

- serialize root frame dock tree and tabs only when it has content;
- ignore root frame bounds on restore;
- never serialize runtime-only Scene fullscreen frames;
- closing the last root tab omits the root frame from persistence.

First-version rule:

```text
Empty root is omitted from persistence.
Boot always recreates the empty root shell.
If a persisted root frame exists, it restores tabs/splits into the shell dock slot.
```

Do not introduce an empty-tabset schema in this batch.

### Scene Fullscreen

Scene fullscreen is still a Scene view presentation, not a root frame
presentation.

If Scene is docked in the root workspace, fullscreen always uses view-level
isolation through a runtime-only Scene frame, even when Scene is the only root
tab. Root `setPresentation("fullscreen")` should not be used for Scene
fullscreen.

When Scene enters fullscreen from root:

- entering fullscreen creates or uses a runtime-only Scene isolation frame;
- the root workspace remains a develop-layout owner, not a fullscreen frame;
- exiting fullscreen rehosts Scene back to its original root tabset/split slot;
- root shell menu/tool/status visibility in run mode is controlled by
  `WorkspaceModeController`, not by root frame presentation.

## Implementation Steps

## Step 0: Baseline Checkpoint

### Goal

Freeze the current stable state before introducing the root workspace.

### Work

- Run:

```text
npm run test -w wallpaper-tesseract
npm run typecheck -w wallpaper-tesseract
npm run build -w wallpaper-tesseract
```

- Record `git status --short`.
- Keep current tab-close persistence smoke artifacts.

### Boundary

- No product behavior changes.
- No temp artifact churn beyond the baseline note if needed.

## Step 1: Add App Shell Skeleton

### Goal

Introduce a real app shell DOM structure without changing docking behavior yet.

### Work

- Add an app-shell component/module that creates:
  - menu slot;
  - optional toolbar slot placeholder;
  - root dock slot;
  - optional status slot placeholder;
  - floating overlay slot.
- Mount App Menu into the menu slot.
- Mount floating windows and dock preview overlay into the floating overlay slot.
- Keep existing floating window behavior unchanged.

### Boundary

- Do not create root dock behavior yet.
- Do not move Scene/Debug/Hierarchy default placement yet.
- Do not change persistence format.

### Tests

```text
npm run test -w wallpaper-tesseract -- app-menu-bar-component app-menu-bar-actor-factory architecture-boundaries
npm run typecheck -w wallpaper-tesseract
npm run build -w wallpaper-tesseract
```

Browser smoke:

- App Menu remains visible and clickable in the top shell slot.
- Existing floating windows drag, resize, close, focus-to-front.
- Dock preview overlay still appears above floating windows.

## Step 2: Add Frame Port Registry

### Goal

Make dock target discovery operate on frame ports, not by scanning only
`FloatingWindowComponent` instances.

### Work

- Add a narrow `WindowFramePortRegistry` in `window-runtime`.
- Floating frames register/unregister their `WindowFramePort`.
- Future root frame registers the same port type.
- Dock target source reads registered ports.
- Lifecycle controller resolves all target/source frame ports through the
  registry.
- Remove controller dependencies on `listLiveViewsForFrame()[0]` as a way to
  rediscover a frame port.
- Treat an empty registered root frame as a valid dock target.

### Boundary

- Do not change public lifecycle commands.
- Do not expose component internals through the registry.
- Do not make app code import internal dock tree modules.
- The registry is a live frame-port index, not a window manager.

### Tests

```text
npm run test -w wallpaper-tesseract -- dock-target-frame-source window-dock-targets window-dock-preview-component window-frame-lifecycle-controller architecture-boundaries
npm run typecheck -w wallpaper-tesseract
```

Add tests that:

- registered floating frames still produce the same target regions;
- unregistered/destroyed frames disappear from target regions;
- a fake non-floating frame port can be discovered as a dock target;
- empty registered root-like frame ports are legal targets;
- lifecycle commit can target a registered frame with no live views;
- runtime-only fullscreen frames are excluded from persistence but may still be
  available as appropriate live frame ports.

## Step 3: Split View Runtime Creation From Frame Shell Creation

### Goal

Allow `openView(...)` to place a new view into an existing frame, including the
root workspace, instead of always relying on factories that create their own
default floating shell.

### Current Problem

Current `WindowViewFactoryResult` requires:

```text
frameActor + framePort + viewActor + content
```

That shape means the factory owns both:

- the view runtime/content;
- the initial floating frame shell.

Root default placement cannot be implemented cleanly until these two operations
are separated.

### Work

- Introduce a view-runtime creation path that creates:
  - `viewActor`;
  - runtime/content attachment;
  - `disposeViewRuntime`;
  - view metadata.
- Keep or wrap the current factory path as a compatibility helper that creates a
  default floating frame shell plus the view runtime.
- Add lifecycle support for:

```text
openView(viewKey, { preferredFrameId })
```

or an equivalent command that can:

- create a view runtime;
- attach it to an existing registered frame port;
- fall back to creating a floating frame shell when no preferred frame is
  available.
- Ensure the Window menu still means open/focus, not close.

### Boundary

- Do not let components create or destroy actor trees directly.
- Do not use actor id as a future multi-instance identity.
- Do not change Scene runtime resource ownership beyond what is needed to attach
  Scene view content to a chosen frame.

### Tests

```text
npm run test -w wallpaper-tesseract -- window-view-factory-registry window-frame-lifecycle-controller window-menu-view-source app-menu-bar-component
npm run typecheck -w wallpaper-tesseract
```

Add tests that:

- `openView("scene", { preferredFrameId: "workspace-root-frame" })` creates the
  Scene view in the preferred frame;
- missing preferred frame falls back to a floating frame;
- menu open/focus still focuses an existing live view;
- view runtime cleanup does not dispose an unrelated frame shell.

## Step 4: Extract Shared Dock Surface Model

### Goal

Prepare the existing floating dock tree/content deck logic for reuse by the root
workspace.

### Work

- Extract behavior-preserving internals from `FloatingWindowComponent`:
  - dock tree render model;
  - tabset list and active-tab calculation;
  - content deck attachment/interactability;
  - dock target tabset data;
  - split resize helpers where practical.
- Keep floating chrome, titlebar drag, resize, frame close, and bounds state in
  `FloatingWindowComponent`.

### Boundary

- This step should be mostly refactor, not new UX.
- Avoid exposing extracted internals outside `window-runtime`.

### Tests

```text
npm run test -w wallpaper-tesseract -- floating-window-component window-frame-dock-tree window-frame-lifecycle-controller architecture-boundaries
npm run typecheck -w wallpaper-tesseract
```

## Step 5: Implement WorkspaceRootDockFrameComponent

### Goal

Create the root dock frame as an actor-backed, chrome-less frame port.

### Work

- Add `WorkspaceRootDockFrameComponent`.
- Register it as a `WindowFramePort`.
- Provide explicit frame metadata:
  - `frameKind: "root"`;
  - `persistenceKind: "persistent"`;
  - `canSerialize` based on non-empty dock content.
- Render tabsets/splits/content into the app shell root dock slot.
- Support empty root workspace state.
- Support tab close, tab activate, tab drag, split resize, and content
  interactability through the same actor-input/lifecycle intent path.

### Boundary

- No titlebar.
- No frame close button.
- No floating drag/resize.
- No Window menu hide/close behavior.
- Root frame actor is not destroyed when empty.

### Tests

```text
npm run test -w wallpaper-tesseract -- workspace-root-dock-frame-component window-frame-lifecycle-controller window-dock-targets window-dock-preview-component
npm run typecheck -w wallpaper-tesseract
npm run build -w wallpaper-tesseract
```

Add tests that:

- empty root frame has a valid dock region;
- root frame can host one tab;
- root frame can host multiple tabs;
- inactive root tabs are not interactable;
- split panes in root report all dock regions;
- root close request is rejected or ignored by design.

## Step 6: Lifecycle Integration For Root Docking

### Goal

Allow existing views to dock into, float out of, split inside, and close from
the root frame.

### Work

- Create the root frame actor before any default/restored view placement.
- Allow `commitDock(...)` to target the root frame.
- Allow `floatView(...)` from root into a normal floating frame.
- Ensure closing the last root tab leaves root frame alive.
- Ensure root frame never appears as an ordinary Window menu item.
- Use the Step 3 view-runtime/frame-shell split for initial default placement:
  - Scene opens in the root workspace;
  - Debug/Hierarchy may remain floating until a later default-layout pass.

### Boundary

- Do not add true multi-instance behavior.
- Do not let root frame become a runtime-only fullscreen frame.
- Do not let root frame be destroyed by `closeFrame`.

### Tests

```text
npm run test -w wallpaper-tesseract -- window-frame-lifecycle-controller workspace-root-dock-frame-component window-menu-view-source app-menu-bar-component
npm run typecheck -w wallpaper-tesseract
npm run build -w wallpaper-tesseract
```

Add tests that:

- Scene can be created in root;
- Debug/Hierarchy can dock into root;
- a root tab can float into a normal floating frame;
- closing root tabs updates registry and actor tree correctly;
- Window menu recreates missing singleton views according to the current menu
  open/focus semantics.

## Step 7: Persistence And Hydration

### Goal

Persist root dock layout without confusing it with floating frame layout.

### Work

- Add root frame handling to layout snapshot/hydration.
- Preserve root dock tree ids where possible.
- Ignore shell-derived root bounds.
- Omit empty root frames from persistence.
- Recreate the empty root shell on boot regardless of persisted layout.
- Add storage compatibility behavior for layouts without a root frame.
- Keep runtime-only fullscreen frames out of persistence through explicit
  `canSerialize: false`, not through `visiblePath === null`.

### Boundary

- Do not serialize runtime-only fullscreen frames.
- Do not introduce multi-instance schema changes yet.

### Tests

```text
npm run test -w wallpaper-tesseract -- window-workspace-layout-persistence window-workspace-layout-persistence-controller window-frame-lifecycle-controller workspace-root-dock-frame-component
npm run typecheck -w wallpaper-tesseract
npm run build -w wallpaper-tesseract
```

Browser smoke:

- dock Scene in root;
- dock Debug/Hierarchy into root split/tab layouts;
- reload;
- root layout restores;
- floating overlays restore separately;
- console errors are 0.

## Step 8: Scene Fullscreen And Workspace Mode

### Goal

Keep Scene fullscreen/run behavior correct when Scene is in the root workspace.

### Work

- Ensure Scene fullscreen isolation works from root mixed tab/split layouts.
- Ensure Scene fullscreen isolation is also used when Scene is the only root
  tab.
- Ensure exiting fullscreen restores Scene to the exact root tabset/split slot.
- Define run mode shell behavior:
  - menu/tool/status may hide in run mode;
  - root workspace itself is not treated as a floating frame;
  - source root layout is not persisted as hidden.
- Ensure Camera3 overlay and Tesseract render after root dock, fullscreen, and
  restore.

### Tests

```text
npm run test -w wallpaper-tesseract -- workspace-mode scene-view-runtime window-frame-lifecycle-controller workspace-root-dock-frame-component
npm run typecheck -w wallpaper-tesseract
npm run build -w wallpaper-tesseract
```

Browser smoke:

- Scene in root as only tab -> fullscreen -> restore;
- Scene in root mixed tabset -> fullscreen -> restore;
- Scene in root split pane -> fullscreen -> restore;
- root layout remains intact;
- no runtime-only frame is persisted;
- Camera3 drag/double-click still works.

## Step 9: Root Workspace Browser Smoke Gate

### Goal

Verify the full desktop-application feel before returning to cleanup work.

### Browser Smoke

Desktop viewport:

- menu stays at top;
- root dock fills central area;
- future toolbar/status slots do not overlap root content;
- Scene in root renders Tesseract;
- Debug/Hierarchy can dock into root tabs and splits;
- floating windows overlay root;
- drag/drop target preview works across root and floating frames;
- close tab, menu recreate, float, merge, split all work;
- console errors are 0.

Mobile-sized viewport:

- menu remains reachable;
- tab close buttons stay inside tab bounds;
- root dock regions remain usable;
- floating overlay windows do not permanently block menu access.

Artifacts:

- screenshot;
- smoke data JSON with frame ids, root dock tree, floating frames, active tabs,
  canvas rect, Camera3 rect, console error count.

## Impact On Previous Remaining Work Plan

This feature changes the order of the previous cleanup plan:

1. `Step 0: Baseline Checkpoint` still comes first.
2. The root workspace plan becomes the next priority.
3. Dock region naming finalization should happen after or during the frame port
   registry work, because root dock targets make the old "frame target"
   terminology even more misleading.
4. Persistence gap fill should wait until root frame serialization semantics are
   added, otherwise the persistence tests will lock the old floating-only shape.
5. Repeat-cycle regression gates should be rerun after the root workspace is
   implemented.
6. Further `FloatingWindowComponent` extraction becomes partly prerequisite work
   for the root frame and should be scoped around shared dock surface reuse.
7. Do not return to the old cleanup plan until root persistence, root Scene
   fullscreen, and root browser smoke pass. Otherwise cleanup work will lock a
   half-finished root dock model into tests and persistence.

## Recommended Implementation Batch

Execute in this order:

1. Step 0: baseline checkpoint.
2. Step 1: app shell skeleton.
3. Step 2: frame port registry.
4. Step 3: split view runtime creation from frame shell creation.
5. Step 4: shared dock surface extraction.
6. Step 5: root dock frame component.
7. Step 6: lifecycle integration.

Mandatory merge gate before returning to the previous cleanup plan:

1. Step 7: persistence and hydration.
2. Step 8: Scene fullscreen and workspace mode.
3. Step 9: root workspace browser smoke gate.

Stop for plan review if Step 2 or Step 3 reveals that the existing
`WindowFramePort` contract cannot support a root frame without widening into a
general manager.
