# Workspace Presentation Session Refactor Plan

Date: 2026-06-06

## Purpose

This document defines the required architecture fix for the current Scene
fullscreen bug:

```text
With Scene, Debug, and Hierarchy in separate non-docked frames, entering Scene
fullscreen can leave the other frames visible above Scene.
```

The bug is not just a z-index issue. It exposes a deeper split between:

- Scene view fullscreen ownership, currently handled by
  `WindowFrameLifecycleController`;
- run/develop workspace mode, currently handled by `WorkspaceModeController`;
- persistent window visibility, currently driven by scene parameter paths;
- temporary runtime presentation state, which does not yet have a dedicated
  owner.

The long-term fix is to introduce an explicit workspace presentation session
layer before continuing the remaining docking cleanup plan.

## Current Diagnosis

### What Happens Today

When Scene is the only tab/view in its current frame,
`WindowFrameLifecycleController.enterViewFullscreen()` takes the direct-frame
path:

```text
single-view Scene frame -> set the existing owner frame presentation to fullscreen
```

That changes only the Scene owner frame's presentation.

Separately, `WorkspaceModeController.enterRunMode()` submits scene commands to
hide known tool windows:

```text
debugWindow.visible = false
hierarchyWindow.visible = false
```

Those commands are queued through `FrameStateController`, so they are not part
of the same transaction as the fullscreen presentation mutation.

### Why Other Frames Stay Above Scene

`WindowWorkspaceController` excludes fullscreen floating frames from its dense
window focus stack, but it does not assign fullscreen frames a global modal
priority above every other frame.

Therefore, if Debug or Hierarchy remain visible even briefly, their frame
priority can still put them above Scene.

This can become visible as:

- Scene is fullscreen, but Debug/Hierarchy still render on top;
- other frames remain hit-testable above Scene;
- behavior depends on frame timing and whether queued visibility commands have
  already committed.

### Why A Simple Priority Patch Is Not Enough

Giving fullscreen Scene a larger z-index would cover the visual symptom, but it
would leave these model problems:

- other frames would still be visible in state;
- window menu and persistence would still see those frames as ordinary visible
  windows;
- dock target discovery could still include suppressed frames unless special
  cased;
- future toolbar/statusbar/root workspace behavior would need more exceptions;
- multi-Scene fullscreen would have no clear session ownership.

The correct fix is to make run fullscreen a first-class presentation session.

## Design Goals

1. A Scene run fullscreen operation is one coherent transaction.
2. Temporary runtime presentation state must not mutate persistent visibility.
3. Persistence must save the develop layout, not the runtime fullscreen layout.
4. Input, z-index, dock target discovery, menu state, and DOM visibility must
   agree on effective visibility.
5. The design must naturally support future multiple Scene views, such as
   3ds Max style four viewports.
6. App code should express intent, not manipulate specific frame components.

## Non-Goals

- Do not implement true multi-instance Scene in this batch.
- Do not add multiple simultaneous fullscreen sessions.
- Do not use a global z-index override as the main fix.
- Do not reintroduce static lists of business windows into new presentation
  code.
- Do not rewrite the actor/component runtime.

## Target Architecture

Introduce a narrow controller between workspace mode and frame lifecycle:

```text
WorkspaceModeController
  owns workspace.mode parameter and user intent
  |
  v
WindowWorkspacePresentationController
  owns run/develop presentation sessions
  |
  v
WindowFrameLifecycleController
  owns view rehost, runtime-only fullscreen frame, restore, close, dock
  |
  v
WindowFramePort / FloatingWindowComponent / WorkspaceRootDockFrameComponent
  owns DOM, input, dock tree, local frame presentation
```

`WorkspaceModeController` should stop directly hiding Debug and Hierarchy by
static parameter paths. Instead it should request:

```ts
enterRunPresentationForView(sceneViewIdentity)
exitRunPresentation()
```

The presentation controller then coordinates the frame-level work.

## Core Concepts

### Workspace Presentation Session

Only one workspace presentation session may be active at a time.

First version:

```ts
interface WorkspacePresentationSession {
  readonly id: string;
  readonly kind: "scene-run-fullscreen";
  readonly viewKey: WindowViewKey;
  readonly viewActorId: string;
  readonly sourceFrameId: string;
  readonly fullscreenFrameId: string;
  readonly suppressedFrameIds: readonly string[];
}
```

Future multi-instance version:

```ts
interface WorkspacePresentationSession {
  readonly id: string;
  readonly kind: "scene-run-fullscreen";
  readonly viewInstanceId: WindowViewInstanceId;
  readonly viewActorId: string;
  readonly sourceFrameId: string;
  readonly fullscreenFrameId: string;
  readonly suppressedFrameIds: readonly string[];
}
```

### Effective Visibility

Frame visibility must be split into persistent and transient parts:

```text
persistentVisible
  value stored in scene parameters or root frame existence

presentationSuppressed
  transient runtime flag owned by an active presentation session

effectiveVisible
  persistentVisible && !presentationSuppressed
```

`effectiveVisible` must drive:

- DOM display;
- actor input targetability;
- dock target discovery;
- frame port registry `canTarget()`;
- `WindowControlSource` visible state if it represents actual live visibility;
- `WindowWorkspaceController` stack eligibility.

Persistent layout snapshots must not serialize `presentationSuppressed`.

### Fullscreen Strategy

Scene run fullscreen should always use an isolated runtime-only fullscreen frame,
even if Scene is currently the only view in its source frame.

```text
Scene view in any frame/root/split/tab
  -> create runtime-only fullscreen frame
  -> rehost Scene view into that frame
  -> suppress all other ordinary frames
  -> restore exactly on exit
```

Direct-frame fullscreen can remain for other future window maximize behavior,
but Scene run mode should not use it.

### Suppression Scope

Suppress every live frame except:

- the runtime-only fullscreen frame for the active session;
- app shell chrome that must remain outside the root dock area, if the product
  wants it visible;
- frames explicitly marked non-suppressible by metadata, if such metadata is
  introduced later.

For the current product, App Menu is outside normal frame control and should
remain available unless the UX later chooses a stricter run mode.

### Persistence During A Session

If a layout snapshot is taken while a presentation session is active:

- omit the runtime-only fullscreen frame;
- save the source frame/root dock tree from the session restore token;
- ignore temporary suppression;
- do not persist direct runtime bounds of the fullscreen frame.

This prevents refresh/save during run mode from corrupting the develop layout.

## Multi-Scene Considerations

Future multiple Scene views can conflict if fullscreen is keyed only by
`WindowViewKey: "scene"`.

The session model should therefore be prepared to migrate from singleton
`WindowViewKey` to `WindowViewInstanceId`.

Rules for future multi-Scene fullscreen:

1. Only one active workspace fullscreen session exists.
2. If the active view requests fullscreen again, exit the session.
3. If a different Scene view requests fullscreen, restore the current session
   first, then enter a new session for the requested view.
4. Persistence saves the develop layout, not the active runtime session.
5. Each Scene instance owns its own renderer/camera/tesseract runtime resources
   or a clearly scoped shared resource handle.

This batch should not implement multi-instance Scene, but the new controller
API should avoid assuming `"scene"` is the only possible fullscreen-capable
view forever.

## Proposed Public Ports

### Workspace Presentation Intent Port

Owned by the presentation controller:

```ts
interface WindowWorkspacePresentationPort {
  enterRunFullscreenForView(
    viewActorId: string,
    reason: "workspace-mode" | "programmatic"
  ): WorkspacePresentationResult;

  exitRunFullscreen(
    reason: "workspace-mode" | "programmatic"
  ): WorkspacePresentationResult;

  getActiveSession(): WorkspacePresentationSession | null;
}
```

`WorkspaceModeController` should depend only on this port and the workspace mode
parameter store.

### Frame Suppression Port

Implemented by `WindowFramePort` or a narrow extension:

```ts
interface WindowFrameSuppressionPort {
  readonly frameId: string;
  readonly persistentVisible: boolean;
  readonly effectiveVisible: boolean;

  setPresentationSuppressed(
    reason: "workspace-run",
    suppressed: boolean
  ): void;
}
```

The implementation can live in `FloatingWindowComponent` and
`WorkspaceRootDockFrameComponent`, but app code should not call those concrete
components directly.

### Lifecycle Fullscreen Strategy

Extend the lifecycle fullscreen intent:

```ts
enterViewFullscreen(viewActorId, {
  reason: "workspace-mode",
  strategy: "isolated-runtime-frame"
})
```

or add a new explicit method:

```ts
enterViewWorkspaceFullscreen(viewActorId, reason)
```

The explicit method is clearer if direct fullscreen remains available for other
uses.

## Implementation Plan

## Step 0: Freeze And Reproduce

### Goal

Capture the current bug as a failing regression before changing architecture.

### Work

- Add a unit test for three independent frames:
  - Scene is the only view in its own frame;
  - Debug and Hierarchy are visible in separate frames;
  - entering run fullscreen suppresses or hides non-Scene frames before they can
    remain targetable.
- Add or update a browser smoke scenario:
  - open Scene, Debug, Hierarchy as separate frames;
  - click Scene fullscreen;
  - assert Debug/Hierarchy are not visible above Scene and not hit-testable;
  - record frame ids, presentation state, effective visibility, and console
    errors in JSON.

### Boundary

- Do not fix by increasing z-index yet.
- Do not change persistence format.

### Tests

```text
npm run test -w wallpaper-tesseract -- workspace-mode window-frame-lifecycle-controller window-workspace-controller
npm run typecheck -w wallpaper-tesseract
```

## Step 1: Add Runtime Frame Suppression

### Goal

Separate persistent visibility from transient presentation suppression.

### Work

- Add suppression state to floating frame and root frame ports.
- Expose `effectiveVisible`.
- Make DOM visibility, input targetability, dock target discovery, and stack
  eligibility use `effectiveVisible`.
- Keep persistent `visiblePath` values unchanged.
- Ensure menu open/focus can still restore or focus frames after suppression is
  cleared.

### Boundary

- Do not change menu open/focus semantics.
- Do not serialize suppression.
- Do not suppress App Menu.

### Tests

- Floating frame:
  - persistent visible true + suppressed true -> DOM/input inactive;
  - clearing suppression restores DOM/input without changing parameter state.
- Root frame:
  - suppression hides/blocks central dock content;
  - app shell menu remains outside the suppression contract.
- Dock targets:
  - suppressed frames do not produce dock target regions.
- Window workspace:
  - suppressed frames are not eligible for dense stack or input priority.

Commands:

```text
npm run test -w wallpaper-tesseract -- floating-window-component workspace-root-dock-frame-component dock-target-region-source window-workspace-controller
npm run typecheck -w wallpaper-tesseract
```

## Step 2: Add Workspace Presentation Controller

### Goal

Create a single owner for run/develop presentation sessions.

### Work

- Add `WindowWorkspacePresentationController` in `window-runtime` or `app`.
- Inject:
  - `WindowFrameLifecycleController` fullscreen/rehost port;
  - `WindowFramePortRegistry`;
  - optional current Scene location source;
  - active input cancel hook if not already owned by lifecycle.
- Implement:
  - `enterRunFullscreenForView(viewActorId, reason)`;
  - `exitRunFullscreen(reason)`;
  - `getActiveSession()`.
- On enter:
  - request isolated runtime fullscreen for the target view;
  - suppress every other suppressible frame;
  - record suppressed frame ids.
- On exit:
  - restore the fullscreen view;
  - clear suppression;
  - focus the restored source frame or root frame.

### Boundary

- The controller must not read concrete `FloatingWindowComponent` internals.
- The controller must not submit scene parameter visible commands for ordinary
  suppression.
- Only lifecycle owns actor reparent/destroy.

### Tests

- Enters one session and suppresses all non-fullscreen frames.
- Re-entering for the same view is idempotent.
- Entering another view first exits the current session.
- Exit clears suppression even if fullscreen restore returns warnings.
- Runtime-only fullscreen frame is not suppressible.

Commands:

```text
npm run test -w wallpaper-tesseract -- window-workspace-presentation-controller window-frame-lifecycle-controller
npm run typecheck -w wallpaper-tesseract
```

## Step 3: Force Scene Run Fullscreen To Use Isolated Runtime Frame

### Goal

Remove the direct-frame path from Scene run mode.

### Work

- Add an explicit lifecycle API for workspace fullscreen, or extend the existing
  API with `strategy: "isolated-runtime-frame"`.
- Ensure Scene run mode always creates a runtime-only fullscreen frame:
  - Scene in floating single-view frame;
  - Scene in root single tab;
  - Scene in mixed tabs;
  - Scene in split pane.
- Preserve direct-frame fullscreen for non-workspace use if needed.

### Boundary

- Do not change normal dock/float behavior.
- Do not persist the runtime fullscreen frame.

### Tests

- Single floating Scene frame enters isolated session, not direct session.
- Root-only Scene tab enters isolated session.
- Mixed and split Scene cases continue to pass existing tests.
- Exiting restores exact source tabset/split/active tab.

Commands:

```text
npm run test -w wallpaper-tesseract -- window-frame-lifecycle-controller workspace-root-dock-frame-component scene-view-runtime
npm run typecheck -w wallpaper-tesseract
```

## Step 4: Refactor WorkspaceModeController

### Goal

Make workspace mode a high-level parameter observer rather than a static
tool-window visibility mutator.

### Work

- Replace static `toolWindows` hide/restore logic with calls to
  `WindowWorkspacePresentationController`.
- Keep develop snapshot only for persistent values that still need restoration,
  not for transient suppression.
- Handle external mode changes:
  - `develop -> run` enters presentation session;
  - `run -> develop` exits session;
  - repeated run mode events do not refresh persistent snapshots;
  - if Scene is missing, open it then enter session.

### Boundary

- Do not use a hard-coded Debug/Hierarchy list for run suppression.
- Do not write `visible=false` for ordinary tool windows just because run mode
  is active.
- Preserve user-intended visibility when returning to develop mode.

### Tests

- Three independent frames:
  - entering run creates Scene-only runtime fullscreen frame;
  - Debug and Hierarchy are suppressed, not persistently hidden.
- Scene docked in Debug frame:
  - source mixed frame is suppressed while fullscreen is active;
  - exiting restores the mixed frame.
- Scene in root:
  - root source is suppressed or hidden according to the presentation policy;
  - App Menu remains available if required.
- External visible commands in run mode:
  - do not break active session;
  - desired develop visibility is preserved if still part of product policy.

Commands:

```text
npm run test -w wallpaper-tesseract -- workspace-mode window-workspace-presentation-controller window-frame-lifecycle-controller
npm run typecheck -w wallpaper-tesseract
```

## Step 5: Persistence Guard For Active Presentation Sessions

### Goal

Prevent active run fullscreen state from corrupting develop layout snapshots.

### Work

- Teach snapshot creation about active presentation sessions.
- Omit runtime-only fullscreen frames.
- Save source frame/root dock root from restore state.
- Ignore suppression.
- Ensure `hiddenViewKeys` semantics remain unchanged.

### Boundary

- Do not migrate persistence schema unless unavoidable.
- Do not store actor ids or runtime fullscreen frame ids.

### Tests

- Save while Scene run fullscreen is active from:
  - independent Scene frame;
  - root workspace;
  - mixed tab frame;
  - split frame.
- Reload restores develop layout, not fullscreen runtime layout.
- Runtime-only fullscreen frame is absent from persisted JSON.

Commands:

```text
npm run test -w wallpaper-tesseract -- window-workspace-layout-persistence window-workspace-layout-persistence-controller window-frame-lifecycle-controller
npm run typecheck -w wallpaper-tesseract
```

## Step 6: Browser Smoke Gate

### Goal

Verify real DOM, pointer routing, canvas rendering, and menu behavior.

### Scenarios

- Scene, Debug, Hierarchy as three separate floating frames:
  - Scene fullscreen;
  - Debug/Hierarchy disappear and are not clickable above Scene;
  - Scene restore returns to original floating frame.
- Scene in root as only tab:
  - fullscreen uses runtime-only Scene frame;
  - restore returns to root tab.
- Scene docked with Debug/Hierarchy:
  - fullscreen isolates Scene only;
  - source frame is suppressed;
  - restore returns to original tab/split.
- Run mode persistence:
  - save/reload while fullscreen;
  - no runtime-only fullscreen frame persists.
- Mobile viewport:
  - fullscreen/restore button remains reachable near Camera3 controls;
  - App Menu remains reachable if product policy says it should.

### Artifacts

Write to `temp/`:

- smoke report markdown;
- data JSON with:
  - frame ids;
  - active session id;
  - presentation mode;
  - suppressed frame ids;
  - effective visibility;
  - persisted layout frame ids;
  - console error count;
- desktop and mobile screenshots.

Commands:

```text
npm run test -w wallpaper-tesseract
npm run typecheck -w wallpaper-tesseract
npm run build -w wallpaper-tesseract
```

## Architecture Boundary Updates

Add or update boundary tests:

- `WorkspaceModeController` must not hard-code Debug/Hierarchy visible paths for
  run-mode suppression.
- App code must not mutate concrete frame components to enter run fullscreen.
- Runtime-only fullscreen frames must never be serialized.
- Presentation suppression must not be implemented by writing persistent
  `visible=false`.
- New code must use region terminology for dock targets.

## Acceptance Criteria

The bug is fixed only when all of these are true:

1. Independent Debug/Hierarchy frames do not remain above fullscreen Scene.
2. Other frames are not hit-testable while the run session suppresses them.
3. Exiting run mode restores the original develop layout and visibility.
4. Persistence taken during run mode restores the develop layout on reload.
5. Scene fullscreen from root, mixed tab, split pane, and independent floating
   frame all use the same session model.
6. The implementation has no static business-window hide list in the
   presentation path.

## Relationship To Existing Plans

This plan must run before returning to:

- `temp/window-docking-remaining-work-plan.md`
- `temp/window-docking-continuation-development-plan.md`
- multi-instance pilot work

The reason is simple: persistence, accessibility, hierarchy display, and
multi-instance identity should build on the final presentation/session model,
not on the current direct-frame workaround.

