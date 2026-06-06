# Window Docking Remaining Work Plan

Date: 2026-06-06

## Purpose

This is the current remaining-work plan for the window docking system after the
temp cleanup. It is intentionally written as:

```text
current facts -> remaining gaps -> regression gates
```

The goal is to avoid re-implementing completed work while still protecting the
recently stabilized docking, fullscreen, tab close, and persistence contracts.

## Current Facts

Already implemented:

- FrameActor + ViewActor model.
- Scene, Debug, and Hierarchy as frame-hosted views.
- Content deck and content rehost.
- Tab merge, tab float, split dock, splitter resize.
- Scene fullscreen isolation through runtime-only frames.
- Region-level dock target resolution is implemented, though compatibility
  names still exist.
- Layout persistence and hydration exist.
- `closeView(...)` view-level lifecycle exists.
- Per-tab close action routes through actor input and
  `WindowFrameIntentSink.requestCloseView`.
- Visual tab close buttons exist.
- Tab close persistence smoke exists:
  - closed views disappear from persisted live layout;
  - `hiddenViewKeys` remains empty;
  - Window menu recreates missing singleton views.

Retained smoke evidence:

- `temp/window-tab-close-persistence-smoke-report.md`
- `temp/window-tab-close-persistence-smoke-data.json`
- `temp/window-tab-close-persistence-smoke.png`

## Priority Change: Workspace Presentation Session

The next priority is no longer docking cleanup or root workspace follow-up.
The current fullscreen bug shows that workspace run mode still splits one user
operation between two systems:

- `WindowFrameLifecycleController` handles Scene fullscreen/rehost.
- `WorkspaceModeController` hides known tool windows through queued persistent
  visibility commands.

This is not a clean enough baseline for more persistence, accessibility,
hierarchy, or multi-instance work. Before resuming the remaining steps in this
document, execute:

```text
temp/workspace-presentation-session-refactor-plan.md
```

That plan introduces an explicit workspace presentation session layer, runtime
frame suppression, and Scene run fullscreen as an isolated runtime-only session
even when Scene is the only view in its source frame.

Do not resume Step 1 of this plan until that session refactor and its browser
smoke gate pass.

## Previous Priority: Workspace Root Dock

The previous priority was the root dock workspace. Most of that work has landed
and should be preserved. Its remaining QA and cleanup items now depend on the
presentation session refactor because root Scene fullscreen, persistence, and
suppression semantics must agree.

Use this plan as the new priority document:

```text
temp/workspace-root-dock-development-plan.md
```

This changes the remaining-work order because the root dock workspace affects:

- dock target discovery;
- frame port ownership;
- `FloatingWindowComponent` extraction scope;
- persistence and hydration semantics;
- Scene fullscreen/run-mode restore behavior;
- browser smoke coverage.

The previous Step 1 naming cleanup still matters, but should be folded into the
root dock work after a frame port registry exists. The previous Step 2
persistence gap fill should wait until root frame persistence semantics are
defined and tested. The previous cleanup plan should not resume until root
persistence, root Scene fullscreen, and root browser smoke pass.

## Step 0: Baseline Checkpoint

### Goal

Freeze the current baseline before doing more naming or persistence refactors.

### Why First

The worktree currently contains uncommitted source changes, untracked smoke
artifacts, and a recently cleaned `temp/` directory. Before touching naming or
layout code, record exactly what is stable.

### Work

- Run the baseline commands:

```text
npm run test -w wallpaper-tesseract
npm run typecheck -w wallpaper-tesseract
npm run build -w wallpaper-tesseract
```

- Confirm the retained tab-close persistence smoke artifacts still exist.
- Record current dirty scope with `git status --short`.
- If the session calls for a checkpoint, commit the current stable source and
  retained smoke artifacts before Step 1.

### Boundary

- Do not change product behavior.
- Do not re-expand `temp/` with old artifacts.
- Do not clean unrelated user changes.

## Step 1: Dock Region Naming Finalization

### Goal

Finish the transition from frame-level dock target terminology to region-level
terminology.

### Current Facts

- Main behavior already uses `WindowDockTargetRegion`,
  `DockTargetRegionSource`, and `listDockTargetRegions()`.
- Compatibility aliases still exist:
  - `WindowDockTargetFrame`
  - `DockTargetFrameSource`
  - `createDockTargetFrameSource`
  - `listDockTargetFrames()`
- The implementation file and test still use old names:
  - `dock-target-frame-source.ts`
  - `dock-target-frame-source.test.ts`

### Remaining Gaps

- Move the main implementation to region-first file names, such as:
  - `dock-target-region-source.ts`
  - `dock-target-region-source.test.ts`
- Keep one small compatibility re-export module if needed.
- Rename tests and test commands to region terminology.
- Add architecture boundary tests:
  - production code may not introduce old frame-target names;
  - old names are allowed only in compatibility alias code and alias tests.

### Tests

```text
npm run test -w wallpaper-tesseract -- window-dock-targets dock-target-region-source window-dock-preview-component architecture-boundaries
npm run typecheck -w wallpaper-tesseract
```

## Step 2: Persistence And Hydration Gap Fill

### Goal

Document current persistence behavior and fill only missing coverage.

### Current Facts

Several persistence cases already exist:

- Invalid top-level shapes return `null`.
- Unsupported versions return `null`.
- Top-level-valid payloads prune malformed entries.
- Unknown views are skipped during hydration.
- Duplicate views normalize deterministically in persistence tests.
- Tab close persistence smoke proves:
  - closed singleton views are removed from persisted `views`;
  - `hiddenViewKeys` remains empty;
  - Window menu recreates missing singleton views.

### Required Strategy Table

Before adding new behavior, write or update tests/docs to lock this table:

| Case | Current Intended Strategy |
| --- | --- |
| Bad JSON in storage | Ignore for boot; storage key may remain unless controller cleanup is explicitly added |
| Unsupported version | Ignore for boot; keep migration path open |
| Top-level invalid shape | Reject as `null` |
| Top-level valid with malformed entries | Prune malformed entries |
| Unknown views during hydration | Skip unknown views, keep valid known views |
| Duplicate persisted views | Normalize deterministically |
| Runtime-only fullscreen frames | Never serialize |
| Run-mode temporary hidden source frame | Do not persist as hidden develop layout |
| Tab close | Remove closed view from persisted `views`; keep `hiddenViewKeys` empty |

### Remaining Gaps

- Identify which rows above already have tests and which do not.
- Add only missing cases.
- Add a browser smoke for corrupted storage boot if not already covered.
- Add a layout restore smoke for valid merge/split storage.
- Document whether storage cleanup is deliberately not performed.

### Tests

```text
npm run test -w wallpaper-tesseract -- window-workspace-layout-persistence window-workspace-layout-persistence-controller window-frame-lifecycle-controller
npm run typecheck -w wallpaper-tesseract
```

Browser smoke:

- corrupted storage -> app boots;
- valid merge/split storage -> app restores;
- console errors are 0.

## Step 3: Repeat-Cycle Regression Gates

### Goal

Convert the most fragile docking sequences into repeatable regression coverage.

### Current Facts

There is already strong unit coverage for:

- merge/float/split;
- Scene fullscreen isolation;
- tab close;
- persistence snapshot semantics.

### Remaining Gaps

Add repeat-cycle smoke/tests that run each sequence at least 3 times:

- Debug/Hierarchy merge -> float -> merge -> close -> menu recreate.
- Scene dock -> fullscreen -> restore -> float -> fullscreen -> restore.
- Scene split beside Hierarchy -> resize splitter -> reload -> fullscreen ->
  restore.
- Close a mixed frame -> menu recreate Scene/Debug/Hierarchy.

### Mandatory Close Lifecycle Regression Items

These contracts must stay protected in this step and all future steps:

- `closeFrame` cleanup failure keeps frame/view live and leaves registry intact.
- `closeView` runtime cleanup failure keeps tab/view/frame live.
- `closeView` cleanup success means close is committed; later tab removal or
  actor destroy failures return warning rather than `closed: false`.
- Repeated `closeView` returns stable `closed: false`.
- Tab close intent carries enough identity to reject stale hits:
  - `viewActorId`;
  - `viewKey`;
  - owner frame id.

### Smoke Data

Record:

- live frame ids;
- view actor ids;
- actor parent ids;
- frame tabs and active tabs;
- canvas count and rect;
- Camera3 overlay rect;
- tab close rects;
- console error count.

### Tests

```text
npm run test -w wallpaper-tesseract -- window-frame-lifecycle-controller floating-window-component scene-view-runtime
npm run typecheck -w wallpaper-tesseract
```

Run a browser smoke and store fresh artifacts under `temp/`.

## Step 4: Stabilize Existing Opaque Layout Node ID Contract

### Goal

Stabilize the existing node id behavior. Do not re-design it from scratch.

### Current Facts

- `window-frame-dock-tree.ts` already has opaque runtime dock tree node id
  generation and preservation.
- Frame layout normalization already generates missing ids only when needed.
- Legacy actor-id-oriented layout helper code still has derived/volatile ids in
  some older pure layout paths.

### Correct Scope

This step is not "introduce a new allocator" unless a true gap is found.

Instead:

- lock the current opaque id contract with tests;
- avoid expanding legacy derived-id behavior;
- keep volatile ids documented as volatile where legacy helpers remain.

### Remaining Gaps

- Add/confirm tests that:
  - active tab switch does not change tabset id;
  - merge does not recreate unrelated tabset ids;
  - split creates exactly one new tabset id and one split id;
  - remove/collapse preserves the surviving tabset id;
  - hydration of missing-id payloads generates valid ids;
  - persisted valid ids are preserved.

### Tests

```text
npm run test -w wallpaper-tesseract -- window-workspace-layout window-frame-dock-tree floating-window-component window-frame-lifecycle-controller dock-target-region-source
npm run typecheck -w wallpaper-tesseract
```

## Step 5: Continue FloatingWindowComponent Extraction

### Goal

Keep `FloatingWindowComponent` maintainable as docking grows.

### Current Facts

- Pure dock tree logic has already started moving into
  `window-frame-dock-tree.ts`.
- `FloatingWindowComponent` still owns a lot of chrome, content deck, hit-test,
  render, and tab action logic.

### Remaining Gaps

Extract behavior-preserving internal modules:

- content deck attachment/interactability model;
- chrome hit data model;
- tab strip render model;
- tab action model helpers if useful.

Add architecture boundary tests so `app/`, `features/`, `debug/`, `hierarchy/`,
and `gizmos/` do not import internal window-runtime modules directly.

### Tests

```text
npm run test -w wallpaper-tesseract -- floating-window-component window-frame-dock-tree architecture-boundaries
npm run typecheck -w wallpaper-tesseract
```

## Step 6: Keyboard And Accessibility Pass

### Goal

Improve desktop GUI usability without bypassing actor/lifecycle command paths.

### Remaining Gaps

App menu:

- Escape closes menu.
- Arrow keys move between items.
- Enter activates item.
- Disabled entries cannot submit commands.

Tab strip:

- clear roles and labels;
- keyboard path for focused tab close or close-active-view;
- pointer tab close remains actor input routed.

### Tests

```text
npm run test -w wallpaper-tesseract -- app-menu-bar-component app-menu-model floating-window-component
npm run typecheck -w wallpaper-tesseract
```

Browser smoke:

- menu keyboard basics;
- tab close remains pointer-functional;
- console errors are 0.

## Step 7: Hierarchy Tree Follow-Up

### Goal

Make Hierarchy clearly communicate docking and actor parent changes.

### Current Facts

- Hierarchy already uses actor tree data.
- It already has `aria-level` and inactive state data.
- Visual affordance and transient fullscreen semantics are still light.

### Remaining Gaps

- Verify ViewActors appear under their current FrameActor after:
  - dock;
  - float;
  - close;
  - menu recreate;
  - Scene fullscreen isolation.
- Decide how runtime-only fullscreen frames appear:
  - shown and marked transient; or
  - hidden from user-facing tree.
- Improve visual tree affordance:
  - indentation;
  - inactive/transient styling;
  - clearer parent/child grouping.

### Tests

```text
npm run test -w wallpaper-tesseract -- actor-hierarchy-object-source hierarchy-panel-component
npm run typecheck -w wallpaper-tesseract
```

Browser smoke:

- dock Scene into Debug and verify tree parent changes;
- fullscreen Scene and verify transient behavior;
- restore and verify tree returns.

## Step 8: Multi-Instance Identity Design Gate

### Goal

Design the identity model before implementing a true multi-instance pilot.

### Why This Gate Exists

Current frame layout still stores `views` keyed by singleton `WindowViewKey`.
True multi-instance cannot be safely added until menu identity, persisted
identity, actor id, and future instance id are separated.

### Design Work

Define:

- `WindowViewTypeKey`;
- `WindowViewInstanceId`;
- menu action identity;
- persisted view identity;
- actor id role;
- migration/versioning strategy for persisted layout;
- menu strategy for multiple instances:
  - focus most recently active instance;
  - separate "New X" action;
  - future submenu/list of instances.

### Boundary

- Do not implement multiple Scene windows yet.
- Do not change persisted schema before the migration contract is written.
- Do not use actor id as instance identity.

### Tests

Design-level tests may target:

```text
npm run test -w wallpaper-tesseract -- window-view-factory-registry window-menu-view-source app-menu-model window-workspace-layout-persistence
npm run typecheck -w wallpaper-tesseract
```

## Step 9: True Multi-Instance Pilot

### Goal

After Step 8, validate the identity model with one low-risk view type.

### Boundary

- Do not use Scene as the first multi-instance target unless Scene resource
  duplication has been designed.
- Prefer a Debug-like or Inspector-like view.

### Remaining Work

- Create two instances of one view type.
- Menu focuses most recently active instance.
- "New X" creates another instance.
- Persistence restores both instances.
- Closing one instance does not affect the other.
- Docking one instance does not move the other.

### Tests

```text
npm run test -w wallpaper-tesseract -- window-view-factory-registry window-menu-view-source app-menu-model window-frame-lifecycle-controller
npm run typecheck -w wallpaper-tesseract
```

## Global Gates

After any step touching window-runtime, app menu, Scene presentation, or actor
input:

```text
npm run test -w wallpaper-tesseract
npm run typecheck -w wallpaper-tesseract
```

After any visible UI, docking, fullscreen, persistence, or Scene change:

```text
npm run build -w wallpaper-tesseract
```

Browser smoke should cover desktop and mobile-sized viewports:

- Debug titlebar drag and resize;
- focus-to-front;
- App Menu open/focus;
- App Menu remains reachable on mobile;
- tab close rects stay inside tab/frame bounds on mobile;
- Scene fullscreen/restore;
- Scene docked in mixed tab frame fullscreen/restore;
- Scene docked in split frame fullscreen/restore;
- Camera3 drag and double-click after docking/restore;
- Tesseract visible;
- console errors 0.

## Recommended Next Batch

1. Step 0: baseline checkpoint.
2. Execute `temp/workspace-root-dock-development-plan.md` Steps 1-6:
   - app shell skeleton;
   - frame port registry;
   - view runtime/frame shell split;
   - shared dock surface extraction;
   - root dock frame component;
   - lifecycle integration.
3. Execute `temp/workspace-root-dock-development-plan.md` Steps 7-9 as mandatory
   merge gates:
   - persistence and hydration;
   - Scene fullscreen and workspace mode;
   - root workspace browser smoke.
4. Return to this plan's Step 1 and finish region naming finalization using the
   new registry/root-frame terminology.
5. Return to this plan's Step 2 and fill persistence/hydration gaps with root
   frame semantics included.
6. Rerun Step 3 repeat-cycle regression gates with root dock cases included.

Only after those pass should work continue to opaque id contract stabilization,
accessibility, hierarchy polish, and multi-instance identity design.
