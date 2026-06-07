# Project Prism Phase Model Current Assessment

Date: 2026-06-08

## Verdict

The Project Prism package direction is still sound:

```text
actor-core <- actor-input <- ui-framework <- editor <- wallpaper-app
actor-core <- runtime-core <- runtime-three <- editor <- wallpaper-app
packages/four-* <- runtime-core/runtime-three
gizmo-core <- actor-input
```

The old phase split, however, needed adjustment against the current
implementation state.

## What Still Fits

- Phase 0 as a boundary/evidence baseline is correct.
- `actor-core` must be decapable before extraction.
- `ui-framework` must be product-agnostic and must not know Scene/Tesseract/
  Camera3/Debug/Hierarchy/Inspector content.
- Runtime must not depend on Editor/UI/Gizmo.
- Scene View should become an editor consumer of runtime frame sources, not the
  owner of runtime worlds/cameras.
- The final validation must prove multiple worlds, cameras, Scene Views, and
  fullscreen sessions.

## What Was Outdated

### `Phase -1` Should Be Removed As A Standalone Phase

The old `Phase -1: View Instance Identity Continuation` was useful earlier, but
the project now has enough `WindowViewIdentity` foundation that it should not
remain a separate top-level phase.

Remaining identity risks should be handled as:

- Phase 0B structured evidence requirements;
- Phase 3 UI framework extraction gates;
- multi-instance browser smoke in Phase 8.

### Actor-Core Extraction Was Too Early

The old outline placed actor-core extraction before the state/scheduler/input
bridge split. Current facts show that is backwards.

After Phase 1A-1D, the old `SceneCommandSink`,
`ComponentRuntimeBridge`, `ComponentCapability`, legacy capability strings, and
structural active-input cancellation probing have been removed from the actor
runtime path.

Actor-core extraction is still too early because the remaining blockers are now
more specific:

- `actor-runtime` still imports the app-local `UpdateFrame` contract from
  `runtime/ports`;
- actor-window focus/stack context still needs an extraction ownership decision;
- state observer binding is outside actor-runtime, but still staged in
  app-local state-runtime;
- component definition installation remains app-owned.

These are now the Phase 1F readiness gate, not the old Step 1D bridge problem.

### App Composition Thinning Should Be A Late Phase

The old sequence treated app composition mostly as a Phase 0/early blocker.
Current implementation shows app composition cannot become truly thin until:

- UI framework has package-owned installers;
- runtime has package-owned installers;
- editor has package-owned installers;
- component definition installation is package-owned.

So app composition should be a final extraction/thinning phase, while Phase 0B
only records and gates the debt.

### Phase 1 Was Too Broad Without Subphases

`Shared Spine Decoupling` is the right next architecture phase, but it is too
large if left as one open-ended bucket. It must be executed as smaller
boundaries:

```text
Phase 1A: scheduler/update ports
Phase 1B: command/state domain ports
Phase 1C: component contract decapability
Phase 1D: ComponentRuntimeBridge responsibility split
Phase 1E: boundary lock and deletion of old capability names
Phase 1F: actor-core extraction readiness decision
```

This avoids the failure mode where several mixed concepts are touched, but no
single boundary becomes clean.

## Revised Phase Model

### Phase 0: Boundary And Evidence Freeze

Complete Phase 0B:

- generated boundary report from shared facts;
- package-target matrix summary;
- structured browser smoke evidence;
- final Phase 0B exit report.

No package extraction here.

### Phase 1: Shared Spine Decoupling

Split the mixed contracts that block every package:

- scheduler/update ports;
- runtime/editor/UI command ports;
- runtime/editor/UI state domains;
- gizmo and state observer capabilities out of core component contracts;
- `ComponentRuntimeBridge` responsibility split;
- actor-core extraction readiness decision for `UpdateFrame`, focus/stack, and
  remaining state/definition-installer blockers.

No package extraction unless the boundary is already clean.

Phase 1 owns the shared port definitions and removes mixed contracts. It should
not migrate window/app-menu/workspace feature implementation into a UI package;
that belongs to Phase 3.

### Phase 2: Actor Core And Actor Input Extraction

Extract:

- `actor-core`;
- `actor-input`.

This can only start after Phase 1F either marks actor-core / actor-input
extraction allowed in generated facts, or records a precise blocker report with
a first executable Phase 2 step.

### Phase 3: UI Framework Port Split And Extraction

Extract product-agnostic UI:

- app shell;
- root/floating frame;
- tab chrome;
- dock tree/region/preview;
- menu;
- layout persistence;
- frame lifecycle;
- view type registry.

UI must use UI-owned state/scheduler/geometry ports, not scene-runtime.

Phase 3 consumes the shared ports established in Phase 1. Its job is to migrate
window/app-menu/workspace implementation to UI-owned contracts and prove the UI
framework can run without product features.

### Phase 4: Runtime Core Contracts And Projection Graph

Define runtime-core APIs before moving real ownership:

- worlds;
- cameras;
- projection links;
- frame sources;
- runtime command/query ports;
- world graph queries.

Runtime-core stays DOM/Three/UI/editor/gizmo free.

### Phase 5: Runtime Three Backend And Scene View Inversion

Move real render ownership:

- Tesseract/4D ownership into runtime;
- Camera3 ownership into runtime;
- Three/WebGL ownership into runtime-three;
- Scene View becomes an editor frame-source consumer;
- Gizmo becomes an editor command surface.

### Phase 6: Editor Package Extraction

Extract editor-specific features:

- Debug;
- Inspector;
- Hierarchy;
- Scene View;
- Camera Gizmo;
- editor menus and workspace.

### Phase 7: Thin Wallpaper App Composition

App becomes bootstrap only:

- install UI/runtime/editor packages;
- connect stores, shell, render loop, and Wallpaper Engine lifecycle;
- no concrete window/runtime/editor policy ownership.

Current `app-composition` is both a candidate and a debt zone in the boundary
facts. Future generated package-target reports must distinguish clean
candidates from candidate-with-debt. A green test for `app-composition` must not
be interpreted as a clean extraction boundary while `app-composition-debt`
still covers the same app-root policy files.

### Phase 8: Multi-World / Multi-Viewport Validation

Prove the design:

- multiple worlds;
- multiple cameras;
- multiple Scene Views;
- four-viewport layout;
- per-view fullscreen;
- no singleton Scene assumptions.

## Updated Main Outline

The migration phase section in:

```text
temp/project-prism-engine-modularization-outline.md
```

has been updated to this revised model.

## Immediate Next Step

Continue Phase 1, not package extraction:

```text
temp/project-prism-phase-1-shared-spine-implementation-plan.md
```

Specifically:

1. complete Step 1E by writing the Phase 1 acceptance report and refreshing
   generated boundary facts;
2. execute Step 1F to decide the remaining actor-core extraction blockers,
   especially `UpdateFrame` ownership;
3. only then begin Phase 2 actor-core / actor-input extraction planning.

Phase 0B is now a completed boundary baseline. Its smoke contract remains the
browser evidence shape for later risky UI/input changes.
