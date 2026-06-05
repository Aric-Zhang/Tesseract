# Window Docking Continuation Development Plan

## Purpose

This plan replaces the remaining future-facing parts of the older docking plans
after the current implementation reached a stable baseline.

Reviewed source plans:

- `temp/unity-style-window-docking-design-plan.md`
- `temp/window-workspace-focus-and-docking-implementation-steps.md`
- `temp/window-docking-step24-plus-development-plan.md`
- `temp/scene-view-owner-docking-continuation-plan.md`
- `temp/window-docking-fullscreen-bugfix-plan.md`

The old plans were valuable, but large parts are now already implemented:

- FrameActor + ViewActor model.
- Window menu open/focus by `WindowViewKey`.
- Single-tab frame shell for Scene, Debug, and Hierarchy.
- Content deck and content rehost.
- Tab merge, tab float, split dock, splitter resize.
- Layout persistence and hydration.
- Scene docking ownership through `WindowViewLocationSource`.
- Scene view fullscreen isolation using runtime-only fullscreen frames.
- Region-level dock target resolution for split/multi-tabset frames.

This document should be used as the new step-by-step plan for work after the
fullscreen/docking bugfix batch.

## Current Accepted Baseline

As of this plan, the following checks are expected to pass:

```text
npm run test -w wallpaper-tesseract
npm run typecheck -w wallpaper-tesseract
npm run build -w wallpaper-tesseract
```

The latest browser smoke evidence:

- `temp/window-layout-persistence-smoke-report.md`
- `temp/window-docking-fullscreen-bugfix-smoke-report.md`

Important behaviors already verified:

- Scene can be docked with other views, fullscreened into a Scene-only temporary
  frame, restored, and rendered correctly.
- Runtime-only fullscreen frames are not persisted.
- A third tab can dock into any visible tabset/pane region, including the second
  pane in a split frame.
- Console errors were 0 in the latest smoke.

## Architecture Standards

All future window/docking work should preserve these standards.

1. Lifecycle mutations have one owner.
   - Creating, destroying, reparenting, moving, docking, floating, and
     fullscreen-isolating views goes through `WindowFrameLifecycleController` or
     a narrow port owned by it.
   - Frame components emit intent; they do not mutate the actor tree directly.

2. View identity is not actor identity.
   - `WindowViewKey` is the current singleton view identity.
   - Future multi-instance work must introduce a separate instance identity
     instead of overloading actor ids.

3. Frame state has two kinds.
   - Persistent frames own scene parameter paths and may be serialized.
   - Runtime-only frames have `visiblePath === null`, are not menu windows, and
     must never be serialized.

4. Dock targets are regions, not frames.
   - A dock target means one visible tabset region inside a frame.
   - Hit testing must evaluate concrete region candidates before choosing the
     best preview.

5. Window menu is open/focus, not close.
   - Choosing an existing ordinary window focuses and activates one existing
     view.
   - Choosing a missing singleton window creates it.
   - The menu should not act like a checkbox for ordinary dockable windows.

6. Scene runtime owns resources, not frame identity.
   - Scene rendering, Camera3, and Tesseract resources follow the live Scene
     view location.
   - Scene fullscreen is a presentation of the Scene view, not a persistent
     mutation of a mixed owner frame.

7. Inactive content is not interactable.
   - Inactive tabs and hidden split panes must not hit actor input.
   - The owning frame priority controls cross-window priority; tab-local logic
     only decides local route/hit behavior.

8. Keep ports narrow.
   - Avoid exposing DOM roots, actor component arrays, or concrete
     `FloatingWindowComponent` internals to app code.
   - Prefer `WindowFramePort`, `WindowContentHost`, `WindowViewLocationSource`,
     and lifecycle intent ports.

## Retired Or Superseded Plan Sections

Do not restart these old steps:

- Old Step 14-29 from `window-workspace-focus-and-docking-implementation-steps.md`
  as implementation steps.
- Step 24.0-29 from `window-docking-step24-plus-development-plan.md` as primary
  work; their core behavior has landed.
- Step 28.5 / 28.7 / 28.8 from
  `scene-view-owner-docking-continuation-plan.md` as new work. Keep their tests
  as regression gates.
- Bug A/B implementation from `window-docking-fullscreen-bugfix-plan.md` as new
  work. Keep it as a regression reference.

## Step 0: Baseline Gate Before New Work

### Goal

Freeze the current working baseline before adding new behavior.

### Boundary

- Do not change product behavior.
- Do not clean unrelated temp files or unrelated dirty worktree entries.

### Effect

Future regressions can be compared against the current stable docking/fullscreen
state.

### Tests

Run:

```text
npm run test -w wallpaper-tesseract
npm run typecheck -w wallpaper-tesseract
npm run build -w wallpaper-tesseract
```

Required browser smoke:

- Scene + Debug merge -> Scene fullscreen -> restore.
- Scene + Hierarchy split -> Debug docks into each pane.
- Camera3 overlay remains visible and interactive after restore.
- Tesseract remains visible.
- Console errors are 0.

Record evidence under `temp/`:

```text
temp/window-docking-baseline-smoke-report.md
temp/window-docking-baseline-smoke-data.json
temp/window-docking-baseline-smoke.png
temp/window-docking-baseline-smoke-server.json
```

This smoke is not optional for future docking/fullscreen batches. Docking and
Scene fullscreen are high-risk UI/input paths, and each batch should start from
a fresh proof of the current baseline.

## Step 1: Finalize Dock Region Terminology And Boundaries

### Goal

Finish the naming cleanup started by the fullscreen bugfix batch so future code
does not reintroduce frame-level dock target thinking.

### Boundary

- Keep compatibility aliases only if removing them causes noisy churn.
- Do not change dock behavior.
- Do not rename files if it creates broad import churn in the same step.
- The only production code allowed to mention old frame-target names is the
  alias declaration file. Compatibility tests may mention old names only when
  they explicitly verify the alias.

### Effect

New code reads as region-based:

```text
WindowDockTargetRegion
DockTargetRegionSource
createDockTargetRegionSource
listDockTargetRegions()
```

### Implementation

- Prefer region terminology in production code.
- Keep old `WindowDockTargetFrame` / `DockTargetFrameSource` aliases only as
  explicitly marked compatibility aliases.
- Update tests to use region terminology wherever they are not testing
  compatibility.
- Add or update architecture boundary tests so future production code does not
  add new frame-target names except in alias declarations.
- Boundary scan should fail if new production imports or declarations use
  `WindowDockTargetFrame`, `DockTargetFrameSource`, `createDockTargetFrameSource`,
  or `listDockTargetFrames()` outside the compatibility alias module.

### Tests

- `window-dock-targets.test.ts`
- `dock-target-frame-source.test.ts` or renamed equivalent
- `window-dock-preview-component.test.ts`
- `architecture-boundaries.test.ts`

Run:

```text
npm run test -w wallpaper-tesseract -- window-dock-targets dock-target-frame-source window-dock-preview-component architecture-boundaries
npm run typecheck -w wallpaper-tesseract
```

## Step 2: Harden Layout Persistence And Hydration

### Goal

Make persistence boring and resilient before adding multi-instance or richer tab
features.

### Boundary

- Do not change the visible layout UX.
- Do not persist runtime-only fullscreen frames.
- Do not introduce multi-instance ids yet.
- Do not lock in the current derived tabset/split id details. Step 2 validates
  semantic layout recovery; Step 5 owns opaque id stability.

### Effect

Reload and invalid storage recovery are predictable:

- Unknown views are skipped.
- Duplicate view entries normalize deterministically.
- Empty frames/tabsets are removed.
- Runtime-only frames never enter storage.
- Run-mode temporary hidden source frames do not pollute develop layout.
- Bad storage never prevents the app from booting.

Bad storage policy:

- Invalid JSON: ignore the stored value for this boot and report a recoverable
  parse failure through tests/smoke data; do not attempt partial recovery.
- Unsupported version: ignore the stored value for this boot; keep a migration
  hook available for future versions.
- Valid layout with unknown views: keep known valid views and skip unknown
  views.
- Partially malformed layout: normalize what can be normalized only if the
  payload still has a valid top-level shape; otherwise return `null`.
- Storage cleanup is a product decision, not an implicit parser side effect.
  The first hardening step may leave the bad key in storage, but tests must
  document whether it is left in place or explicitly removed by a controller.

### Implementation

- Add a test helper such as `expectValidWindowFrameLayout()` if it is not already
  present in a central layout test support file.
- Add explicit tests for malformed persisted JSON, unknown views, duplicate
  views, missing frame ids, empty tabsets, nested split collapse, and old version
  payloads.
- Add tests for bad JSON, old version, unknown view mixed with valid views, and
  malformed-but-top-level-valid payloads. Each test must assert whether storage
  is ignored, preserved, cleaned, or partially recovered.
- Add a debug-readable smoke data hook for current live layout facts:
  - frames;
  - tabs;
  - active tab per tabset;
  - split ratios;
  - runtime-only flag;
  - view actor parent ids.
- Keep storage format keyed by logical singleton `WindowViewKey` until Step 8.

### Tests

- `window-workspace-layout-persistence.test.ts`
- `window-workspace-layout-persistence-controller.test.ts`
- `window-frame-lifecycle-controller.test.ts`
- Browser smoke: corrupted storage -> app starts; valid merge/split storage ->
  app restores.

Run:

```text
npm run test -w wallpaper-tesseract -- window-workspace-layout-persistence window-workspace-layout-persistence-controller window-frame-lifecycle-controller
npm run typecheck -w wallpaper-tesseract
```

## Step 3: Add Repeat-Cycle Regression Coverage

### Goal

Turn the most failure-prone docking sequences into repeatable regression tests
and browser smoke.

### Boundary

- Prefer tests and smoke helpers over product behavior changes.
- Do not build a full E2E framework yet.

### Effect

The app catches stale host, stale observer, duplicate canvas, and parent-tree
bugs earlier.

### Test Scenarios

Run each sequence at least 3 times in unit or browser smoke:

- Debug/Hierarchy merge -> float -> merge -> close -> menu recreate.
- Scene dock -> fullscreen -> restore -> float -> fullscreen -> restore.
- Scene split beside Hierarchy -> resize splitter -> reload -> fullscreen ->
  restore.
- Close a mixed frame -> menu recreate Scene/Debug/Hierarchy.

Smoke data should record:

- live frame ids;
- view actor ids;
- actor parent ids;
- canvas count and rect;
- Camera3 overlay rect;
- active tab labels;
- console error count.

### Tests

- `window-frame-lifecycle-controller.test.ts`
- `floating-window-component.test.ts`
- `scene-view-runtime.test.ts`
- Browser smoke artifact under `temp/`.

Run:

```text
npm run test -w wallpaper-tesseract -- window-frame-lifecycle-controller floating-window-component scene-view-runtime
```

## Step 4: Normalize Close Semantics

### Goal

Make close behavior explicit and maintainable now that frames can contain
multiple views.

### Boundary

- Do not add per-tab close buttons yet.
- Do not make the Window menu close ordinary dockable windows.
- Do not silently hide actors while pretending they are destroyed.
- Do not use `hiddenViewKeys` as the runtime close model for ordinary singleton
  dockable windows in this step.

### Current Standard

- The outer frame close button closes the whole frame.
- Closing a frame destroys all ViewActors under that frame.
- The Window menu can recreate singleton views later through the factory
  registry.
- A future per-tab close control must be a separate tab action routed through
  lifecycle intent, not the current frame close button.

Runtime close and persisted close are intentionally different:

- Runtime close:
  - destroys the frame actor;
  - destroys child ViewActors through actor parent cascade;
  - disposes view runtimes;
  - removes closed views from the live registry.
- Current persistence snapshot:
  - records only live frames and live views;
  - closed ordinary singleton views disappear from the persisted layout;
  - `hiddenViewKeys` remains empty for runtime frame-close snapshots unless a
    future feature explicitly introduces persisted hidden singleton state.
- Menu restore:
  - recreates missing singleton views through `WindowViewFactoryRegistry`;
  - does not depend on a persisted hidden marker.

The layout helper `hiddenViewKeys` may remain for pure layout experiments or a
future "persist hidden singleton" feature, but production runtime close must not
silently rely on it until that feature is designed.

### Implementation

- Encode this standard in tests and documentation.
- Ensure close-frame uses one transaction:
  - cancel active input;
  - dispose view runtimes once;
  - destroy frame actor and child view actors;
  - prune live view registry;
  - leave persistence snapshot consistent.
- Add a browser smoke for closing a mixed frame and reopening each singleton view
  from the Window menu.
- Add persistence assertions showing that after a frame close, the snapshot does
  not contain that frame or its closed views, and `hiddenViewKeys` remains empty
  under the current product rule.

### Tests

- `window-frame-lifecycle-controller.test.ts`
- `floating-window-component.test.ts`
- `app-menu-bar-component.test.ts`
- Browser smoke:
  - mixed frame close;
  - Window -> Scene recreates Scene;
  - Window -> Debug Log recreates Debug;
  - Window -> Hierarchy recreates Hierarchy;
  - no stale canvas or duplicate observers.

## Step 5: Stable Opaque Layout Node IDs

### Goal

Stop deriving tabset/split ids from tab contents before adding more tab actions,
overflow UI, or multi-instance support.

### Boundary

- Do not implement multi-instance yet.
- Do not change the persisted view identity format yet.
- Do not change drag/drop UX.
- This is the first step that may assert id stability. Earlier persistence
  hardening should only assert layout semantic validity, not the current derived
  id strings.

### Effect

Tabset and split ids become stable layout node identities:

- UI keys do not change just because tabs move.
- Dock target ids remain stable across active tab switches.
- Persistence can round-trip ids without deriving them from view order.

### Implementation

- Introduce a layout id allocator owned by window-runtime.
- Hydration preserves persisted ids when valid.
- Normalization generates missing ids only for malformed or old layouts.
- Frame port operations preserve ids where possible:
  - add tab;
  - remove tab;
  - split tabset;
  - collapse split;
  - restore runtime dock root.

### Tests

- `window-workspace-layout.test.ts`
- `floating-window-component.test.ts`
- `window-frame-lifecycle-controller.test.ts`
- `dock-target-frame-source.test.ts` or renamed region-source test

Assertions:

- Active tab switch does not change tabset id.
- Merge does not recreate unrelated tabset ids.
- Split creates exactly one new tabset id and one split id.
- Remove/collapse preserves the surviving tabset id.
- Hydration of old missing-id payloads normalizes successfully.

## Step 6: Extract Pure Dock Tree Logic From FloatingWindowComponent

### Goal

Prevent `FloatingWindowComponent` from becoming the long-term owner of every
frame, tabset, split, render, input, and content-deck concern.

### Boundary

- Do not replace the component with a new component yet.
- Do not introduce a WindowManager.
- Do not alter public behavior.
- Treat extracted dock-tree/content-deck modules as window-runtime internals
  unless a later step deliberately promotes a narrow public API.

### Effect

The component becomes easier to maintain:

- pure dock-tree model functions are separately tested;
- content deck logic is separable;
- chrome rendering and hit-test mapping become smaller;
- lifecycle remains the owner of actor mutation.

### Implementation

Extract in small slices:

1. `window-frame-dock-tree.ts`
   - tabset/split node operations;
   - active tab resolution;
   - id preservation.
2. `window-frame-content-deck.ts`
   - attachment map;
   - active/inactive interactability.
3. Optional `window-frame-chrome-model.ts`
   - tab hit data;
   - titlebar/close/splitter hit data.

Each extraction must be behavior-preserving.

### Tests

- New pure model tests for each extracted module.
- Existing `floating-window-component.test.ts` remains green.
- `architecture-boundaries.test.ts` ensures app code does not import extracted
  internals unless explicitly public.
- Add a boundary rule that `app/`, `features/`, `debug/`, `hierarchy/`, and
  `gizmos/` cannot import internal modules such as `window-frame-dock-tree.ts`
  or `window-frame-content-deck.ts`.

## Step 7: Improve Docking UX Without Changing Ownership Semantics

### Goal

Make docking feel closer to Unity/Blender while preserving the proven model.

### Boundary

- No multi-instance.
- No per-tab close.
- No persisted layout format change unless Step 5 already landed.

### Features

- More legible merge preview on tab strip.
- More legible split preview on left/right/top/bottom zones.
- Content center explicitly shows floating/no-dock state only if helpful.
- Drag threshold and preview clearing behave consistently.
- Dragging a tab over its own only tabset is treated as no-op/floating according
  to a documented rule.
- Dragging titlebar empty area always moves the frame, never starts docking.

### Tests

- `window-dock-targets.test.ts`
- `window-tab-drag-session.test.ts`
- `window-dock-preview-component.test.ts`
- Browser smoke:
  - merge preview;
  - split preview in each direction;
  - content center floats;
  - source self-drop no-op rule;
  - console errors 0.

## Step 8: Prepare View Identity For Multi-Instance

### Goal

Introduce the identity model needed for future multiple Scene/Inspector/etc.
without immediately creating multiple instances.

### Boundary

- Do not implement multiple Scene windows yet.
- Do not change singleton menu behavior.
- Do not migrate all persistence in one risky step.
- Do not change the persisted layout main format in this step.
- Do not let menu identity, layout identity, and actor id collapse back into one
  field.

### Design

Keep current singleton identity working:

```text
WindowViewKey = singleton view key, such as "scene" or "hierarchy"
```

Prepare future identity:

```text
WindowViewTypeKey = kind of view, such as "scene"
WindowViewInstanceId = stable instance id, such as "scene:1"
```

The future menu rule:

- Singleton view type:
  - menu item focuses existing instance;
  - creates one if missing.
- Multi-instance view type:
  - main menu item focuses the most recently active instance;
  - separate "New X" action creates a new instance;
  - later submenus can list instances.

### Implementation

- Add types and documentation near `window-view-key.ts` or a new
  `window-view-identity.ts`.
- Add registry metadata fields, but keep production factories singleton.
- Add tests that prevent app menu from binding ordinary actions to actor ids.
- Do not rewrite persistence yet; add a migration note and tests proving the
  current singleton format still round-trips.
- Add explicit comments/tests distinguishing:
  - menu action identity;
  - persisted view identity;
  - runtime actor id;
  - future instance id.

### Tests

- `window-view-factory-registry.test.ts`
- `window-menu-view-source.test.ts`
- `app-menu-model.test.ts`
- `architecture-boundaries.test.ts`

## Step 9: Add Optional Tab-Level Actions

### Goal

Create an extensible model for tab-local controls without confusing them with
frame-level close.

### Boundary

- Do not add the visual close button to every tab until the model is tested.
- Do not make tab close a DOM click shortcut.
- Do not alter frame close behavior.

### Design

Introduce a tab action model:

```text
WindowTabAction
  kind: "close-view" | future action
  viewActorId
  viewKey or view instance id
```

Rules:

- Tab close closes/removes one view.
- If it was the last view in a frame, the frame closes.
- If a split tabset becomes empty, split collapses.
- Scene tab close destroys Scene runtime but Window menu can recreate it.

### Tests

- Pure lifecycle tests:
  - close inactive tab;
  - close active tab;
  - close tab in split pane;
  - close last tab destroys frame;
  - menu recreate after tab close.
- Component tests:
  - tab action hit path uses actor input;
  - frame close remains one per outer frame;
  - tab action does not trigger titlebar drag.
- Browser smoke after implementation.

## Step 10: Responsive Tab Strip And Mobile Viewport

### Goal

Make tabbed/split frames usable in narrow viewports.

### Boundary

- Do not implement full detachable workspace panels.
- Do not add heavy styling refactors unrelated to window-runtime.

### Features

- Tab labels truncate without overlapping close/frame controls.
- Very narrow tabsets keep a usable active tab area.
- Splitter remains hittable on mobile-sized viewport.
- App menu remains reachable.
- Scene fullscreen restore button remains visible near Camera3 controls.

### Tests

- `floating-window-component.test.ts` for stable dimensions and text overflow
  class behavior.
- Browser smoke at the default in-app viewport and a mobile-sized viewport if
  the browser tool supports it.
- Screenshots under `temp/`.

## Step 11: Keyboard And Accessibility Pass

### Goal

Make the menu/tab UX closer to desktop software expectations without changing
the actor-input pointer architecture.

### Boundary

- Pointer input remains actor-routed.
- Keyboard handling may use focused DOM/ARIA where appropriate, but commands
  still route through the same app/lifecycle ports.

### Features

- App menu closes when clicking/dismissing outside. This should remain covered.
- Escape closes an open menu.
- Arrow keys move through menu items.
- Enter activates a menu item.
- Tab strip exposes clear roles/labels.
- Disabled menu entries cannot submit commands.

### Tests

- `app-menu-bar-component.test.ts`
- `app-menu-model.test.ts`
- Browser smoke for menu keyboard basics.

## Step 12: Hierarchy Tree Follow-Up

### Goal

Make the Hierarchy panel clearly reflect the actor tree after docking and
fullscreen isolation.

### Boundary

- Do not make Hierarchy mutate docking state.
- Do not introduce drag/drop in Hierarchy yet.

### Features

- ViewActors appear under their current FrameActor.
- Docking, floating, close, and menu recreate update parent relationships.
- Runtime-only fullscreen frame appears only while it exists, or is optionally
  marked as transient if shown.
- Inactive/hidden frames or views have a clear visual treatment.
- Tree indentation is visible, not only `aria-level`.

### Tests

- `actor-hierarchy-object-source.test.ts`
- `hierarchy-panel-component.test.ts`
- Browser smoke:
  - dock Scene into Debug and confirm tree parent changes;
  - fullscreen Scene and confirm transient frame behavior is understandable;
  - restore and confirm tree returns.

## Step 13: True Multi-Instance Pilot

### Goal

Only after Steps 1-12 are stable, implement one small multi-instance pilot to
validate the identity model.

### Boundary

- Pick one low-risk view type first. Avoid Scene as the first multi-instance
  target unless Scene resource duplication has been designed.
- Do not expose broad factory APIs until the pilot proves the shape.

### Candidate

Use a simple future view such as Inspector or a duplicated Debug-like tool, not
Scene.

### Tests

- Create two instances.
- Menu focuses most recently active instance.
- "New X" creates another instance.
- Persistence restores both instances with stable ids.
- Closing one instance does not affect the other.
- Docking one instance into a frame does not move the other.

## Global QA Gates

After any step that touches window-runtime, app menu, Scene presentation, or
actor input:

```text
npm run test -w wallpaper-tesseract
npm run typecheck -w wallpaper-tesseract
```

After any step that touches visible UI, docking, fullscreen, persistence, or
Scene:

```text
npm run build -w wallpaper-tesseract
npm run dev -w wallpaper-tesseract
```

Browser smoke must cover at least:

- Debug titlebar drag and resize.
- Window focus-to-front.
- App Menu open/focus.
- Scene fullscreen/restore.
- Scene docked in mixed tab frame fullscreen/restore.
- Scene docked in split frame fullscreen/restore.
- Dock third tab into every visible pane region.
- Camera3 drag and double-click after docking/restore.
- Tesseract visible.
- Console errors 0.

## Do Not Do Yet

- Do not introduce a broad WindowManager class.
- Do not let app code mutate actor parent/destroy/rehost directly.
- Do not make ordinary Window menu entries checkboxes.
- Do not persist runtime-only frames.
- Do not make Scene non-dockable to avoid fixing ownership bugs.
- Do not implement multi-instance Scene before resource ownership is designed.
- Do not move to a new persisted identity format without a compatibility test.

## Recommended Next Batch

The next implementation batch should be conservative and mostly structural:

1. Step 1: finalize dock region terminology and architecture boundaries.
2. Step 2: harden persistence/hydration edge cases.
3. Step 3: add repeat-cycle regression coverage.
4. Step 4: normalize close semantics.

Only after those pass should work proceed to stable opaque layout ids and
component extraction.
