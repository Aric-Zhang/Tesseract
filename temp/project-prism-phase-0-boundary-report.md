# Project Prism Phase 0B Boundary Summary

Status: complete

Verdict: Phase 0B boundary matrix is generated and clean; package extraction remains blocked only by the listed target blockers.

## Package Targets

| Target | Status | Phase | Clean Candidate Zones | Debt Zones | Blocked By |
| --- | --- | --- | --- | --- | --- |
| actor-core | blocked | Phase 2 | actor-core-candidate | actor-core-debt, actor-binding-debt, component-definition-installer-debt | actor-core-debt, actor-binding-debt, component-definition-installer-debt |
| actor-input | blocked | Phase 2 | actor-input-candidate | actor-binding-debt | actor-binding-debt |
| editor | deferred | Phase 6 | editor-candidate | runtime-ownership-debt, ui-state-binding-debt | runtime-ownership-debt, ui-state-binding-debt |
| runtime-core | blocked | Phase 4 | (none) | state-domain-debt, runtime-ownership-debt | state-domain-debt, runtime-ownership-debt |
| runtime-three | blocked | Phase 5 | (none) | runtime-ownership-debt | runtime-ownership-debt |
| ui-framework | blocked | Phase 3 | ui-framework-candidate | ui-state-binding-debt, component-definition-installer-debt | ui-state-binding-debt, component-definition-installer-debt |
| wallpaper-app | blocked | Phase 7 | app-composition | app-composition-debt, app-runtime-debt, component-definition-installer-debt | app-composition-debt, app-runtime-debt, component-definition-installer-debt |

## Candidate Zones

- actor-core-candidate: 1 files. Actor primitives that are already UI-free and scene-free.
- actor-input-candidate: 6 files. Actor input and gizmo-core adapter candidates.
- app-composition: 8 files. Wallpaper app bootstrap and composition layer.
- editor-candidate: 53 files. Concrete editor features and editor presentation components.
- ui-framework-candidate: 47 files. Generic window, tab, dock, menu, and app shell UI candidates.

## Debt Zones

- actor-binding-debt: 7 files. Actor component contracts and bridges that still know scene, gizmo, or state domains.
- actor-core-debt: 4 files. Actor system and registry files that still depend on scene/runtime bridge concepts.
- app-composition-debt: 3 files. Wallpaper app composition still knows concrete editor/runtime policy details.
- app-runtime-debt: 5 files. Transitional app runtime context and registration ports.
- component-definition-installer-debt: 1 files. Central component definition installer still shared by app and feature modules.
- runtime-ownership-debt: 21 files. Runtime-like world/camera/object code still owned by editor/app folders.
- state-domain-debt: 10 files. Mixed scene/editor/ui state runtime that must split before runtime extraction.
- ui-state-binding-debt: 38 files. Generic UI candidates still coupled to scene-runtime state/path/vector types.

## Dependency Matrix

- Rules: 6
- Violations: 0
- none

## Dynamic Imports

- none

## Debt Blockers

- actor-core-debt: blocks actor-core extraction. Delete when: Actor core owns only actor identity, tree, enabled state, lifecycle, and component attachment primitives.
- actor-binding-debt: blocks actor-core extraction, actor-input extraction, state/runtime bridge split. Delete when: Frame update, command, gizmo, and state observer capabilities move to explicit binding packages or ports.
- ui-state-binding-debt: blocks ui-framework extraction. Delete when: UI receives state/path/vector/update services through UI-owned ports or a ui-layout-state package.
- app-composition-debt: blocks app bootstrap thinning, package extraction handoff. Delete when: App composition imports public runtime/editor/UI installers and bootstrap ports only.
- component-definition-installer-debt: blocks actor-core extraction, ui-framework extraction. Delete when: Component definitions are installed through package-owned installers instead of a central app surface.
- app-runtime-debt: blocks app runtime deletion, package-owned port extraction. Delete when: Reusable ports move to the package that owns the contract; wallpaper app becomes thin composition.
- state-domain-debt: blocks runtime-core extraction, ui-framework extraction, state/scheduler split. Delete when: runtime-state, editor-state, and ui-layout-state become separate facts with explicit adapters.
- runtime-ownership-debt: blocks runtime-core extraction, runtime-three extraction. Delete when: Runtime worlds/cameras/projections expose command/query/frame-source ports consumed by editor Scene views.

## Runtime Extraction Blockers

- camera3-three-model: Camera3 model directly owns Three camera/vector objects instead of a runtime camera port plus renderer backend. Required port: RuntimeCameraActor + RuntimeThreeCameraBackend.
- camera3-motion-scene-scheduler: Camera3 motion implements RuntimeObject and consumes SceneFrame from scene-runtime. Required port: RuntimeFrameSource + RuntimeCommandSink.
- scene-view-render-host: Scene View still binds runtime render output, editor window lifecycle, DOM host, and current renderable projection. Required port: FrameSourceRegistry + EditorSceneViewHost.
- tesseract4-runtime-object: Tesseract4 runtime object owns 4D world update, Three line adapter, SceneFrame update, and actor component creation path together. Required port: RuntimeWorldActor + RuntimeThreeRenderable.

## UI Framework Extraction Blockers

- floating-window-scene-state-paths: Generic window state still uses scene-runtime ParameterPath, SceneCommandSink, and Vec2 facts. Required port: ui-layout-state path/value port + UI-owned geometry types.
- workspace-runtime-service-registration: Workspace controllers are registered as scene-runtime RuntimeObject services and consume SceneFrame. Required port: ui-scheduler-port + workspace layout persistence port.
- app-menu-workspace-mode-state: App Menu observes sceneParameterPaths.workspace.mode directly. Required port: workspace-mode view model port.

## App Composition Blockers

- wallpaper-app-concrete-feature-policy: App composition still wires Scene/Debug/Hierarchy/Inspector state, actor ids, default views, floating policies, hierarchy metadata, and debug log sink policy.
- central-component-definition-installer: Component definition installation is still centralized at the app level.
- workspace-mode-app-controller: Workspace mode presentation controller lives in app composition and coordinates editor/window presentation state.

