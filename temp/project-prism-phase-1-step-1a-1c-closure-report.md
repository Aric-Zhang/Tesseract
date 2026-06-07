# Project Prism Phase 1 Step 1A-1C Closure Report

Date: 2026-06-08

## Status

Step 1A through Step 1C are accepted as an effective staged convergence.
Phase 1 is not complete. Work should stop before the old Step 1D and continue
only through the Step 1D amendment plan.

This checkpoint proves that several shared-spine debts have been reduced
without hiding the next design break behind a compatibility adapter.

## Completed Scope

### Step 1A: Update Frame Port

- `runtime/ports/update-frame.ts` is now the source of update/frame contracts.
- `actor-runtime/actor-system.ts` and component update contracts consume
  `UpdateFrame`.
- `scene-runtime/scene-frame.ts` is reduced to a scene-local compatibility
  alias.

Result:

- generic actor/component update flow no longer treats `SceneFrame` as the
  universal contract.

### Step 1B.1: UI Geometry

- `window-runtime/ui-geometry.ts` owns UI value types and helpers.
- generic window state no longer needs scene-runtime `Vec2` as its public
  geometry contract.

Result:

- UI/window geometry is now an explicit UI fact, not a scene fact.

### Step 1B.2: UI Layout Commands

- `window-runtime/ui-layout-state.ts` owns UI layout paths and commands.
- `FloatingWindowComponent` now writes through `UiLayoutCommandSink`.
- persistent scene-state backing is isolated in
  `window-runtime/floating-window-scene-state-adapter.ts`.

Result:

- generic window code can express layout state without importing
  `SceneCommandSink`.

### Step 1B.3: Shared State Observer Event

- `runtime/ports/state.ts` owns `StateChangedEvent`.
- UI/state observer responders consume `onStateChanged(...)`.
- scene state observation remains an adapter responsibility.

Result:

- UI components no longer implement scene-named state observer callbacks as
  their generic state contract.

### Step 1B.4: App Menu Workspace Mode Injection

- App Menu consumes an injected `workspaceModePath`.
- App Menu no longer imports `sceneParameterPaths.workspace.mode`.

Result:

- generic App Menu code does not know scene parameter paths.

### Step 1C: Legacy Capability Adapter Deletion

- `ComponentCapability` no longer includes `"gizmo"` or `"state-observer"`.
- `ComponentRuntimeBridge` no longer adapts legacy direct component
  capabilities.
- tests now prove binding-only behavior and deleted legacy capability strings.

Result:

- legacy direct gizmo/state observer capability behavior is no longer a
  supported production path.

## Current Remaining Blockers

These blockers are intentionally left visible. They are not Phase 1 regressions;
they define the required Step 1D amendment.

1. `actor-runtime/component.ts` still imports and exposes `SceneCommandSink`
   through `BusinessComponentContext.services.commandSink`.
2. `actor-runtime/component.ts` still defines domain-named capabilities:
   `"gizmo-controller-binding"` and `"state-observer-binding"`.
3. `actor-runtime/component-registry.ts` still depends on the concrete
   `ComponentRuntimeBridge` class.
4. `runtime/ports/runtime-registries.ts` still mixes `gizmo-core`,
   `SceneCommandSink`, and `SceneStateObserver` in one port file.
5. `window-runtime/floating-window-scene-state-adapter.ts` is acceptable
   staging debt, but it must not become part of a future reusable UI framework
   package.

## Why Step 1D Must Be Amended

Continuing the old Step 1D directly would remove the remaining capability
strings before the component metadata and attachment runtime model is ready.
That would encourage another hidden adapter layer.

The next step needs to define:

- a generic `ComponentAttachmentRuntime` owned by actor-runtime;
- domain-owned attachment descriptors/kinds outside actor-runtime;
- separate gizmo, state observer, and active input cancellation runtimes;
- explicit command service injection instead of `SceneCommandSink` in
  `BusinessComponentContext`;
- boundary rules proving actor-runtime does not import `scene-runtime` or
  `gizmo-core`.

## Validation Already Run

Targeted review validation:

```text
npm run test -w wallpaper-tesseract -- architecture-boundaries component-runtime-bridge floating-window-component app-menu-bar-component state-observer-binding-component
npm run typecheck -w wallpaper-tesseract
```

Result:

```text
5 test files / 153 tests passed
typecheck passed
```

Full local validation from the implementation pass:

```text
npm run test -w wallpaper-tesseract
npm run typecheck -w wallpaper-tesseract
npm run build -w wallpaper-tesseract
npm run test
npm run typecheck
npm run build
```

Result:

```text
workspace test passed: 66 files / 615 tests
workspace typecheck passed
workspace build passed with the existing Vite chunk size warning
root test passed
root typecheck passed
root build passed with the existing Vite chunk size warning
```

Browser smoke fallback:

```text
temp/project-prism-phase1-browser-smoke.json
temp/project-prism-phase1-browser-smoke.png
```

Result:

```text
passed
console errors: 0
```

The Phase 1 smoke is intentionally lighter than the Phase 0B structured smoke.
If Step 1D touches binding runtime, actor input, active interaction
cancellation, or frame surface input, it must restore Phase 0B style structured
browser evidence: viewport, click point, DOM top stack, actor input hit,
action result, screenshot path, and console errors.

## Handoff Notes

- Do not mark Phase 1 complete from this report alone.
- Do not execute the old Step 1D text directly.
- Use `temp/project-prism-phase-1-step-1d-amendment.md` as the next
  implementation plan.
- Any Step 1D implementation that keeps actor-runtime aware of gizmo/state
  observer domain strings should be treated as a failed cleanup, even if tests
  pass.

