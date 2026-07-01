# Editor Inspector Component Details Gate 4: Hardening Plan

Status: completed

Last updated: 2026-07-01

## Purpose

Make the Inspector component/property path stable enough to extend without
changing the architecture again.

Gates 0-3.6 established the vertical slice:

```text
selection -> InspectorActorDetailsSource -> component/property summaries
  -> InspectorContentComponent -> property control actors
  -> NumberFieldComponent -> InspectorPropertyEditController
  -> app-local Camera3 descriptor -> runtime camera command
```

Gate 4 is a hardening gate, not a new feature gate. It should prove that the
existing owners behave correctly when Actors, Components, property descriptors,
Inspectors, and windows are created/destroyed/updated repeatedly.

## Current Implementation Facts

- `packages/editor/src/inspector/inspector-actor-details-source.ts` is the
  narrow read source. It returns immutable Actor/Component/property summaries
  and does not expose live `Actor` or `Component` objects.
- `InspectorComponentDescriptorRegistry` is editor-owned and explicitly created
  by app composition. There is no global registry fallback.
- Wallpaper-runtime descriptors live only in
  `apps/wallpaper-tesseract/src/features/inspector/install-wallpaper-inspector-descriptors.ts`.
  `packages/editor` must not import `wallpaper-runtime`.
- `InspectorContentComponent` owns rendering of actor header, component
  sections, read-only property rows, editable property slots, and follow/lock
  state. It refreshes through frame update with a render signature guard.
- `InspectorPropertyControlActorReconciler` is the only owner that creates,
  updates, and destroys property control child actors.
- `InspectorPropertyEditController` is the single editor-owned batch/apply
  controller for Inspector property edits in the current app runtime.
- `NumberFieldComponent` is a generic `ui-framework/controls` control. Inspector
  must not create private `<input>` DOM.
- Gate 3.5/3.6 verified window-owned scroll behavior and floating resize-hit
  arbitration. Gate 4 must not reopen scrollbar/resize ownership.

## Non-Goals

- Do not add new editable property kinds.
- Do not add new runtime commands unless a current hardening test proves the
  existing FOV command contract is incomplete.
- Do not add descriptor sorting, grouping, foldouts, search, prefab-like
  overrides, or multi-select mixed-value UI in this gate.
- Do not introduce a generic frame command batch, OnGUI hook, service locator,
  or new event system.
- Do not move Inspector metadata into `actor-system/core`,
  `ComponentDefinition`, or `ui-framework`.
- Do not make `packages/editor` depend on `wallpaper-runtime`.
- Do not keep stale actors/controls as compatibility fallbacks.

## Non-Negotiable Rules

- One descriptor registry per app/editor runtime.
- One Inspector property edit controller per app/editor runtime.
- Property control actors are owned only by
  `InspectorPropertyControlActorReconciler`.
- Inspector body may rehost property control elements into slots, but it must
  not create or dispose property control actors directly.
- Missing Actor/Component/property targets must become deterministic UI state or
  edit failure results, not silent mutation or thrown UI crashes.
- Property editability has one owner: the current descriptor property summary
  and that descriptor's `applyEdit` path. The controller must not create a
  second property registry or infer editability from stale UI controls.
- Locked Inspector state is local presentation state. Selection remains the
  editor-owned source of selection truth.
- `NumberFieldComponent` native input events remain inside the generic control;
  Inspector-specific DOM input/click/change shortcuts stay forbidden.

## Completion Evidence

Gate 4 was completed after checkpoint commit `ebb03fa4`.

Targeted validation:

```text
npm run test -w editor -- inspector
npm run test -w wallpaper-tesseract -- architecture-boundaries
npm run test -w ui-framework -- field number controls
npm run build -w ui-framework
npm run typecheck -w editor
npm run typecheck -w wallpaper-tesseract
npm run build -w editor
npm run build -w wallpaper-tesseract
EDITOR_INSPECTOR_GATE_4_SMOKE_URL=http://127.0.0.1:5178/?resetWorkspaceLayout=1 node apps/wallpaper-tesseract/scripts/run-editor-inspector-gate-4-hardening-smoke.mjs
```

Browser evidence:

```text
temp/editor-inspector-gate-4-hardening-smoke-data.json
temp/editor-inspector-gate-4-hardening-smoke-report.md
```

The smoke proves two Inspector convergence for FOV, invalid FOV rejection in
both Inspectors, lock/follow split behavior, Inspector close/reopen without
property-control actor leaks, zero property-control presentation actors in
Hierarchy, Debug diagnostics visibility, Window menu usability, and Edit ->
Theme submenu reachability.

## Entry Gates

Before starting implementation:

1. Commit or otherwise checkpoint the current Gate 0-3.6 baseline before
   changing Gate 4 implementation code. Gate 4 touches lifecycle,
   multi-Inspector, and edit-controller behavior, so blocker attribution must
   not be mixed with earlier Inspector/scroll/resize/FOV work.
2. Gate 3.6 must be verified:

   ```text
   npm run test -w wallpaper-tesseract -- floating-window-component workspace-root-dock-frame-component architecture-boundaries
   npm run test -w ui-framework -- window-frame-surface-component
   npm run typecheck -w wallpaper-tesseract
   npm run typecheck:test -w ui-framework
   npm run build -w ui-framework
   npm run build -w wallpaper-tesseract
   node apps/wallpaper-tesseract/scripts/run-editor-inspector-window-scroll-ownership-smoke.mjs
   ```

3. `ARB-004` must remain `verified` in
   `docs/known-defects-and-todos.md`.
4. Do not mix unrelated UI/window smoke fixes into Gate 4. New defects should
   be recorded separately unless they directly block Inspector hardening.

## Step 1: Component Attach/Detach Hardening

Goal: component sections and property controls follow the current inspected
Actor's live component set without stale rows or stale controls.

Implementation tasks:

1. Add targeted editor tests that mutate an inspected Actor's component set
   using the existing `ComponentRegistry` path.
2. Prove a newly added component appears in the next Inspector frame refresh
   without changing selection.
3. Prove a removed component section disappears in the next refresh.
4. Prove editable property control actors for removed components/properties are
   disposed by `InspectorPropertyControlActorReconciler`.
5. Prove repeated no-op refresh does not recreate unchanged section DOM or
   property control actors.
6. If current render signatures do not include enough component/property
   identity to detect attach/detach, extend the signature in
   `InspectorContentComponent`. Do not add an observer service.

Tests to add or strengthen:

```text
npm run test -w editor -- inspector-content inspector-property-control
```

Required assertions:

- section keys use component id, not component type;
- multiple components of the same type remain distinct;
- property control keys include `actorId`, `componentId`, and `propertyId`;
- stale property control actors are destroyed, not hidden.

## Step 2: Actor Destruction And Missing Target Hardening

Goal: locked and unlocked Inspectors behave deterministically when the inspected
Actor disappears.

Implementation tasks:

1. Add tests for an unlocked Inspector when the selected Actor is destroyed or
   missing.
2. Add tests for a locked Inspector pinned to an Actor that is later destroyed.
3. Missing locked Actor should render the existing missing state, e.g.
   `Missing actor: <id>`, and `data-inspector-state="missing"`.
4. Missing targets must clear editable property control specs so stale controls
   cannot continue to submit edits.
5. If a property disappears from the current descriptor summary, the reconciler
   removes its control actor. If a stale commit still reaches
   `InspectorPropertyEditController`, the descriptor/apply path must return a
   deterministic reject result. The controller must not consult a separate
   property registry.
6. `InspectorPropertyEditController` must reject or no-op commits whose actor,
   component, or property target no longer exists. Failure should be
   deterministic and testable.
7. Do not use selection reset as a workaround for locked missing state.

Tests to add or strengthen:

```text
npm run test -w editor -- inspector-content inspector-property-edit-controller
```

Required assertions:

- locked Inspector remains locked while showing missing state;
- unlocked Inspector follows the next active selection if one exists;
- pending edit commands against removed targets are not applied;
- no stale property control child actors remain under the Inspector body actor.

## Step 3: Multi-Inspector Synchronization Hardening

Goal: multiple Inspectors share the same source/controller facts while keeping
local lock state independent.

Implementation tasks:

1. Add tests with two real `InspectorContentComponent` instances sharing one
   `InspectorSelectionSnapshotSource`, one `InspectorActorDetailsSource`, one
   `InspectorComponentDescriptorRegistry`, and one
   `InspectorPropertyEditController`.
2. Lock Inspector A to Scene or Camera3; leave Inspector B unlocked.
3. Change selection; Inspector A must keep its inspected Actor, Inspector B must
   follow selection.
4. Commit Camera3 FOV from one Inspector; after controller/frame refresh, the
   other Inspector must show the committed value if it is inspecting the same
   Actor.
5. Dispose one Inspector; the other Inspector and shared controller must keep
   working.
6. Dispose/recreate an Inspector; property control actor ids must not duplicate
   or leak into Hierarchy.

Tests to add or strengthen:

```text
npm run test -w editor -- inspector-content inspector-view-actor-factory inspector-property-control inspector-property-edit-controller
```

Required assertions:

- exactly one controller instance is used in the fixture;
- control actors are children of the Inspector body actor only;
- disposed Inspector controls cannot submit further edits;
- lock toggle visual state remains a mirror of `InspectorContentComponent.locked`.

## Step 4: Editable FOV Commit Robustness

Goal: the first editable property remains a clean example for future properties.

Implementation tasks:

1. Prove rapid FOV input commits coalesce so the last valid value in a frame is
   the committed value.
2. Prove invalid FOV input is rejected at both intended layers without creating
   two authority sources:
   - UI/control tests verify `NumberFieldComponent` and descriptor metadata can
     prevent invalid user input from submitting.
   - controller/runtime tests bypass the UI and commit an invalid value
     directly, proving the runtime camera command remains the final
     authoritative FOV validity source.
3. Descriptor UI metadata may expose runtime-owned constraints for display and
   pre-validation, but it must not invent a separate legal range.
4. Prove a descriptor `applyEdit` exception creates a visible, non-crashing
   error row/result and does not poison later valid edits.
5. Prove the Scene render state and Inspector displayed value converge after a
   valid FOV edit.

Tests to add or strengthen:

```text
npm run test -w editor -- inspector-property-edit-controller inspector-property-control
npm run test -w wallpaper-tesseract -- app-menu theme-controller architecture-boundaries
npm run test -w runtime-core -- camera
npm run test -w runtime-three -- camera
npm run test -w wallpaper-runtime -- camera3
```

Adjust exact filters to existing test names. Do not add a test-only product API
to prove FOV; use existing runtime command and descriptor wiring.

## Step 5: Browser Smoke Hardening

Goal: one browser smoke proves the user-visible Inspector component/property
path survives common interactions.

Preferred approach:

- Extend `apps/wallpaper-tesseract/scripts/run-editor-inspector-editable-camera-fov-smoke.mjs`
  if it remains readable.
- Create a new Gate 4 smoke runner only if extending the existing script makes
  the evidence harder to understand.

Required evidence:

1. Console errors are zero.
2. Select Camera3 in Hierarchy.
3. Inspector shows Camera3 Motion component and FOV property.
4. Edit FOV through the NumberField.
5. The committed value appears in the same Inspector.
6. A second Inspector inspecting the same Camera3 shows the committed value
   after frame refresh.
7. Lock one Inspector and change selection; locked Inspector stays pinned while
   unlocked Inspector follows.
8. Close/reopen an Inspector and verify no duplicate property control actors
   appear in Hierarchy.
9. Hierarchy must show zero property-control presentation actors; Inspector
   property controls are private presentation children and must not pollute the
   real actor tree display.
10. Debug diagnostics remain visible.
11. Window menu/theme submenu remain usable.
12. Gate 3.5/3.6 window scrolling smoke remains valid; do not fold it into this
    smoke unless the scripts naturally share setup.

Evidence files:

```text
temp/editor-inspector-gate-4-hardening-smoke-data.json
temp/editor-inspector-gate-4-hardening-smoke-report.md
```

The smoke must self-validate before writing `passed: true`.

## Step 6: Boundary And Public Surface Audit

Update `architecture-boundaries.test.ts` to lock any new rules discovered during
hardening.

Minimum boundary checks:

- `packages/editor` still has no manifest or production import dependency on
  `wallpaper-runtime`.
- The only app-local bridge that imports both editor Inspector descriptor API
  and `wallpaper-runtime` remains
  `apps/wallpaper-tesseract/src/features/inspector/install-wallpaper-inspector-descriptors.ts`.
- `ui-framework` controls do not import Inspector, Camera3, runtime, or app
  concepts.
- Inspector production code still has no private `input`, `change`, `click`, or
  number-field DOM shortcut.
- Old Inspector paths have no production hits:
  `InspectorActorDisplaySource`, `selection.activeObject`,
  `installEditorInspectorComponentDescriptors`, private `<input>` creation,
  DOM `input/change/click` shortcuts, and any no-op descriptor installer.
- `InspectorPropertyEditController` production occurrences remain in
  `packages/editor/src/inspector` and app/editor composition wiring only.
- No `FrameCommandBatch`, `OnGUI`, or actor-system UI hook was introduced.
- Inspector public barrel does not expose internal view actor factory handles,
  root/content component classes, or property control actor reconciler unless a
  real production caller requires it and the plan is amended.

## Step 7: Documentation And Defect Ledger

1. Update `docs/current-project-progress.md` with Gate 4 completion, smoke
   evidence, and verification matrix.
2. Update `docs/known-defects-and-todos.md`:
   - close or update any Inspector hardening defects found during this gate;
   - do not leave resolved smoke gaps as `open`;
   - record non-blocking follow-ups only when they are real, reproducible debt.
3. If no new defects remain, state that future Inspector work can add
   descriptors/property kinds without changing the current architecture.

## Validation Matrix

Targeted:

```text
npm run test -w editor -- inspector
npm run test -w wallpaper-tesseract -- architecture-boundaries
npm run typecheck -w editor
npm run typecheck -w wallpaper-tesseract
npm run build -w editor
npm run build -w wallpaper-tesseract
```

When runtime/camera code is touched:

```text
npm run test -w runtime-core -- camera
npm run test -w runtime-three -- camera
npm run test -w wallpaper-runtime -- camera3
npm run typecheck -w runtime-core
npm run typecheck -w runtime-three
npm run typecheck -w wallpaper-runtime
```

When `ui-framework` controls are touched:

```text
npm run test -w ui-framework -- field number controls
npm run typecheck:test -w ui-framework
npm run build -w ui-framework
```

Browser:

```text
npm run build -w ui-framework
npm run dev -w wallpaper-tesseract -- --host 127.0.0.1
EDITOR_INSPECTOR_GATE_4_SMOKE_URL=http://127.0.0.1:<port>/?resetWorkspaceLayout=1 node apps/wallpaper-tesseract/scripts/run-editor-inspector-gate-4-hardening-smoke.mjs
```

Final:

```text
npm run test
npm run typecheck
npm run build
git diff --check
```

## Exit Criteria

- Component sections and property controls appear/disappear with component
  attach/detach and leave no stale actors or DOM.
- Locked Inspector on a destroyed Actor shows deterministic missing state.
- Property edits against destroyed/missing targets do not mutate runtime state.
- Multiple Inspectors share the same descriptor registry and edit controller
  while retaining independent lock/follow presentation state.
- FOV editing remains routed through descriptor -> edit controller -> runtime
  command; Inspector never mutates runtime/Three internals directly.
- Browser smoke proves Camera3 property display/editing, multi-Inspector
  convergence, Debug visibility, and app menu/theme usability.
- Boundary tests prove no new reverse dependencies, DOM shortcuts, or public
  surface leaks.

## Stop Conditions

Stop and revise the plan if:

- hardening requires adding a second descriptor registry or property edit
  controller;
- property controls cannot be cleaned up without keeping stale actors alive;
- multi-Inspector convergence requires direct component mutation from UI;
- runtime FOV state cannot be changed through the current command path;
- `ui-framework` must learn Inspector/Camera3 property semantics;
- actor-system must learn Inspector, DOM, OnGUI, or frame repaint semantics.
