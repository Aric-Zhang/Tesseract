# Project Prism Phase 1 Acceptance Report

Date: 2026-06-08

## Status

Phase 1 is complete as an app-local shared-spine decoupling phase.

This acceptance does not mean any target package is ready to extract. It means
the old mixed shared-spine contracts have been reduced to explicit blocker
facts, and the remaining package extraction risks are narrow enough for the
next phase to attack directly.

## Completed Scope

### Step 1A: Update Contract Split

- `UpdateFrame`, `RuntimeObject`, `FrameUpdatable`, and related update
  contracts now live under `runtime/ports/update-frame.ts`.
- `scene-runtime/scene-frame.ts` depends on the shared update contract instead
  of owning the generic frame/update fact.
- Actor and component update paths no longer import `SceneFrame`.

### Step 1B: UI Command And State Ports

- Generic floating window command paths use `UiLayoutCommandSink` instead of
  directly depending on `SceneCommandSink`.
- UI geometry/value types were separated into UI-owned modules.
- App Menu receives workspace mode observation facts through injected options
  instead of importing scene parameter paths.
- Persistent scene-state backing is now explicit staging debt, not hidden inside
  generic UI contracts.

### Step 1C: Legacy Capability Removal

- The old `"gizmo"` and `"state-observer"` capability adapter paths were
  deleted.
- Production component definitions use domain-owned attachment descriptors.
- Boundary tests now reject reintroducing legacy capability strings.

### Step 1D: Attachment Runtime Split

- `ComponentRuntimeBridge` was removed from actor-runtime.
- `ComponentCapability` and `ComponentDefinition.capabilities` were removed.
- `ComponentRegistry` now depends on the generic
  `ComponentAttachmentRuntime` contract.
- Gizmo controller binding, state observer binding, and active input
  cancellation each have explicit domain-owned attachment runtimes.
- `SceneCommandSink` is no longer part of `BusinessComponentContext`.
- The mixed `runtime/ports/runtime-registries.ts` file was split into narrower
  registry owners.

### Step 1E: Boundary Lock

- `project-prism-boundary-facts.ts` now describes the remaining blockers in
  terms of current reality rather than old bridge/capability debt.
- `npm run prism:phase0:report` regenerates the boundary report and summary
  from the same facts.
- The generated boundary report has zero dependency-matrix violations and zero
  dynamic imports.

### Step 1F: Actor-Core Readiness Gate

- Actor-core extraction remains blocked by a deliberate readiness decision.
- The blocker is no longer legacy component capability coupling.
- The exact remaining blockers are documented in:

```text
temp/project-prism-phase-1-actor-core-readiness-report.md
```

## Generated Boundary Snapshot

Current generated package extraction status:

- `actor-core`: blocked by `actor-core-debt`,
  `actor-binding-debt`, and `component-definition-installer-debt`.
- `actor-input`: blocked by `actor-binding-debt`.
- `ui-framework`: blocked by `ui-state-binding-debt` and
  `component-definition-installer-debt`.
- `runtime-core`: blocked by `state-domain-debt` and
  `runtime-ownership-debt`.
- `wallpaper-app`: blocked by app composition/runtime/installer debt.

The important Phase 1 improvement is that `actor-core-debt` and
`actor-binding-debt` now name current extraction blockers:

- app-local update scheduling ownership;
- component context service wiring;
- `UpdateFrame` imported through `runtime/ports`;
- actor-window focus service placement;
- staged state observer binding ownership.

## Validation

Final handoff validation:

```text
npm run prism:phase0:report
npm run test -w wallpaper-tesseract -- project-prism-boundary-report architecture-boundaries
npm run test -w wallpaper-tesseract
npm run typecheck -w wallpaper-tesseract
npm run build -w wallpaper-tesseract
npm run test
npm run typecheck
npm run build
```

Results:

- `npm run prism:phase0:report`: passed; regenerated the Phase 0 boundary
  report and summary.
- `npm run test -w wallpaper-tesseract -- project-prism-boundary-report architecture-boundaries`:
  passed, 2 files / 84 tests.
- `npm run test -w wallpaper-tesseract`: passed, 69 files / 625 tests.
- `npm run typecheck -w wallpaper-tesseract`: passed.
- `npm run build -w wallpaper-tesseract`: passed, with only the existing Vite
  chunk-size warning.
- `npm run test`: passed.
- `npm run typecheck`: passed.
- `npm run build`: passed, with only the existing Vite chunk-size warning.

## Acceptance Boundary

Phase 1 is accepted only under these limits:

- It is not a package extraction phase.
- It does not allow `actor-core`, `actor-input`, `ui-framework`, or
  `runtime-core` package moves yet.
- It does allow Phase 2 to start from the precise blockers in the readiness
  report without re-litigating old `ComponentRuntimeBridge` or capability
  string removal.

## Next Phase Entry

Phase 2 should start with actor lifecycle/update ownership, not file movement.
The first Phase 2 edit should remove or relocate `UpdateFrame` dependency from
the actor-core candidate before attempting any package extraction.
