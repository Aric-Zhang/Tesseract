# Project Prism Phase 0B Boundary Summary

Status: complete

Verdict: Phase 0B boundary matrix is generated and clean; package extraction remains blocked only by the listed target blockers.

## Package Targets

| Target | Status | Phase | Clean Candidate Zones | Debt Zones | Blocked By |
| --- | --- | --- | --- | --- | --- |
| actor-core | allowed | Phase 2 | actor-core-candidate | (none) | (none) |
| actor-input | allowed | Phase 2 | actor-input-candidate | (none) | (none) |
| editor | deferred | Phase 6 | editor-candidate | runtime-ownership-debt | runtime-ownership-debt |
| runtime-core | blocked | Phase 4 | (none) | state-domain-debt, runtime-ownership-debt | state-domain-debt, runtime-ownership-debt |
| runtime-three | blocked | Phase 5 | (none) | runtime-ownership-debt | runtime-ownership-debt |
| ui-framework | deferred | Phase 3B/3C | ui-framework-candidate | (none) | (none) |
| wallpaper-app | blocked | Phase 7 | app-composition | app-composition-debt, app-runtime-debt | app-composition-debt, app-runtime-debt |

## Candidate Zones

- actor-core-candidate: 1 files. Actor primitives that are UI-free, scene-free, update-scheduler-free, and window-focus-free.
- actor-input-candidate: 1 files. Actor input and gizmo-core adapter candidates.
- app-composition: 8 files. Wallpaper app bootstrap and composition layer.
- editor-candidate: 54 files. Concrete editor features and editor presentation components.
- ui-framework-candidate: 53 files. Generic window, tab, dock, menu, and app shell UI candidates.

## Debt Zones

- actor-binding-debt: 10 files. App-local attachment/runtime placement that still blocks actor-input and state/runtime extraction.
- app-composition-debt: 4 files. Wallpaper app composition still knows concrete editor/runtime policy details.
- app-runtime-debt: 8 files. Transitional app runtime context and registration ports.
- runtime-ownership-debt: 21 files. Runtime-like world/camera/object code still owned by editor/app folders.
- state-domain-debt: 10 files. Mixed scene/editor/ui state runtime that must split before runtime extraction.

## Dependency Matrix

- Rules: 6
- Violations: 0
- none

## Dynamic Imports

- none

## Debt Blockers

- actor-binding-debt: blocks state/runtime bridge split. Delete when: Update runtime and state observer binding are expressed through package-owned ports outside app-local glue.
- app-composition-debt: blocks app bootstrap thinning, package extraction handoff. Delete when: App composition imports public runtime/editor/UI installers and bootstrap ports only.
- app-runtime-debt: blocks app runtime deletion, package-owned port extraction. Delete when: Reusable ports move to the package that owns the contract; wallpaper app becomes thin composition.
- state-domain-debt: blocks runtime-core extraction, state/scheduler split. Delete when: runtime-state, editor-state, and ui-layout-state become separate facts with explicit adapters.
- runtime-ownership-debt: blocks runtime-core extraction, runtime-three extraction. Delete when: Runtime worlds/cameras/projections expose command/query/frame-source ports consumed by editor Scene views.

## Runtime Extraction Blockers

- camera3-three-model: Camera3 model directly owns Three camera/vector objects instead of a runtime camera port plus renderer backend. Required port: RuntimeCameraActor + RuntimeThreeCameraBackend.
- camera3-motion-scene-scheduler: Camera3 motion implements app-local RuntimeObject and is still scheduled by the app scene runtime. Required port: RuntimeFrameSource + RuntimeCommandSink.
- scene-view-render-host: Scene View still binds runtime render output, editor window lifecycle, DOM host, and current renderable projection. Required port: FrameSourceRegistry + EditorSceneViewHost.
- tesseract4-runtime-object: Tesseract4 runtime object owns 4D world update, Three line adapter, app-local UpdateFrame scheduling, and actor component creation path together. Required port: RuntimeWorldActor + RuntimeThreeRenderable.

## UI Framework Extraction Blockers


## App Composition Blockers

- wallpaper-app-concrete-feature-policy: App composition still wires Scene/Debug/Hierarchy/Inspector state, actor ids, default views, floating policies, hierarchy metadata, and debug log sink policy.
- central-component-definition-installer: Component definition installation is still centralized at the app level.
- workspace-mode-app-controller: Workspace mode presentation controller lives in app composition and coordinates editor/window presentation state.

