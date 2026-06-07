# Project Prism Phase 1D Completion Report

Date: 2026-06-08

## Status

Step 1D is complete.

This report covers the execution of:

```text
temp/project-prism-phase-1-step-1d-amendment.md
```

The old historical Step 1D in the shared-spine plan remains non-authoritative.

## Architecture Changes

- Introduced the actor-owned generic attachment contract:
  - `apps/wallpaper-tesseract/src/actor-runtime/component-attachment-runtime.ts`
  - `ComponentAttachmentDescriptor`
  - `ComponentAttachmentRuntime`
  - `ComponentAttachmentRegistration`
- Reworked `ComponentRegistry` so it depends only on `ComponentAttachmentRuntime`.
- Removed the concrete `ComponentRuntimeBridge` from actor-runtime.
- Removed `ComponentCapability` and `ComponentDefinition.capabilities`.
- Replaced domain capability strings with domain-owned attachment descriptors.
- Moved gizmo controller registration into `gizmo-runtime`.
- Moved state observer subscription into `state-runtime`.
- Split active input cancellation into a named gizmo-runtime service.
- Tightened active input cancellation after review so participation is declared
  through `activeInputCancellationAttachment`, not inferred from component
  method shape.
- Removed `SceneCommandSink` from `BusinessComponentContext`.
- Split the mixed `runtime/ports/runtime-registries.ts` into narrower owners:
  - gizmo controller registry under `gizmo-runtime`;
  - state observer registry under `state-runtime`;
  - runtime object registry under neutral runtime ports.
- Updated boundary facts and architecture tests so the old bridge/capability path cannot be reintroduced silently.

## Boundary Result

The following production blockers were removed:

- `actor-runtime` no longer imports `scene-runtime`.
- `actor-runtime` no longer imports `gizmo-core`.
- `actor-runtime` no longer defines `ComponentCapability`.
- `actor-runtime` no longer defines domain binding capability strings.
- `actor-runtime/index.ts` no longer exports `ComponentRuntimeBridge`.
- `ComponentRegistry` no longer imports or constructs a concrete runtime bridge.
- `runtime/ports/runtime-registries.ts` has been deleted.

Remaining expected staging:

- `state-runtime` still adapts scene state observer types. This is outside the actor-core candidate boundary and should be handled by a later state/runtime package split.
- feature installers still carry app/product policy. This is outside Step 1D and belongs to later Project Prism package-boundary phases.

## Tests

Targeted checks:

```text
npm run test -w wallpaper-tesseract -- composite-component-attachment-runtime gizmo-controller-attachment-runtime active-input-cancellation-runtime state-observer-attachment-runtime gizmo-event-binding-component state-observer-binding-component architecture-boundaries
npm run test -w wallpaper-tesseract -- project-prism-boundary-report architecture-boundaries
npm run test -w wallpaper-tesseract -- project-prism-smoke-contract gizmo-event-binding-component architecture-boundaries
npm run test -w wallpaper-tesseract -- active-input-cancellation-runtime composite-component-attachment-runtime project-prism-smoke-contract gizmo-event-binding-component architecture-boundaries
npm run typecheck -w wallpaper-tesseract
npm run build -w wallpaper-tesseract
```

Broad checks:

```text
npm run test -w wallpaper-tesseract
npm run test
npm run typecheck
npm run build
```

Results:

- `npm run test -w wallpaper-tesseract`: passed, 69 files / 620 tests.
- Post-review targeted closure test: passed, 5 files / 121 tests.
- Post-review full app test: passed, 69 files / 625 tests.
- `npm run test`: passed.
- `npm run typecheck`: passed.
- `npm run build`: passed.
- Build retains only the existing Vite chunk-size warning.

## Browser Smoke

Structured browser smoke artifacts:

```text
temp/project-prism-phase1d-browser-smoke.json
temp/project-prism-phase1d-browser-smoke.png
temp/project-prism-phase1d-menu-open.png
temp/project-prism-phase1d-menu-focus.png
temp/project-prism-phase1d-tab-close.png
temp/project-prism-phase1d-hierarchy-restore.png
temp/project-prism-phase1d-scene-fullscreen.png
temp/project-prism-phase1d-scene-restore.png
temp/project-prism-phase1d-camera3.png
temp/project-prism-phase1d-camera3-double-click.png
```

Coverage:

- App Menu open.
- App Menu focus existing Debug view.
- Floating Hierarchy tab close.
- App Menu restore Hierarchy after tab close.
- Scene fullscreen.
- Scene restore.
- Camera3 drag.
- Camera3 double-click.

Smoke result:

- `passed: true`.
- `validationErrors: []`.
- console errors: 0.
- actor-input capture present for every pointer action.
- Camera3 drag and double-click both hit `camera-3`.
- Scene fullscreen/restore both hit `scene-window:view` / `scene-mode-toggle`.
- tab close hit the owning window actor through `window-tab-action`.

## Completion Criteria

Step 1D acceptance criteria are satisfied:

- `ComponentRegistry` depends only on `ComponentAttachmentRuntime`.
- attachment runtime receives normalized attachment descriptors, not full definitions.
- actor-runtime owns the minimal attachment registration contract.
- actor-runtime does not import `scene-runtime`.
- actor-runtime does not import `gizmo-core`.
- actor-runtime does not export `ComponentRuntimeBridge`.
- production code no longer uses `ComponentCapability` or `capabilities:`.
- `SceneCommandSink` is not part of `BusinessComponentContext`.
- gizmo binding, state observer binding, and active input cancellation have separate owners and tests.
- active input cancellation uses an explicit attachment descriptor and has a boundary test blocking structural method-probing registration.
- generated Project Prism boundary facts reflect the reduced Step 1D blockers.

## Post-Review Closure

Reviewer feedback after the initial Step 1D pass identified two small hardening
items. Both are now closed:

- Active input cancellation is no longer registered by checking whether a
  component happens to expose `cancelActiveInput()`. The component definition
  must declare `activeInputCancellationAttachment`, and the runtime only
  validates the method after that explicit declaration.
- `CompositeComponentAttachmentRuntime` now continues disposing remaining
  registrations if one cleanup throws. A single cleanup error is rethrown after
  all registrations have been attempted; multiple cleanup errors are reported
  as an `AggregateError`.

The remaining `UpdateFrame` ownership question is intentionally not solved in
this Step 1D closure. It belongs to the next actor-core extraction boundary
decision because it changes the location of the generic update lifecycle
contract, not the attachment runtime model.
