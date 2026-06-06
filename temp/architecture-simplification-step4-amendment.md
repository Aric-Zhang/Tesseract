# Architecture Simplification Step 4 Amendment

Date: 2026-06-06

## Why Step 4 Must Be Split

The original Step 4 says to remove `SceneViewRuntime` and move Scene into pure actor subtree + components. After Step 3, this is still the right direction, but the current implementation shows that `SceneViewRuntime` owns several different responsibilities at once:

- creates the Scene ViewActor or legacy Scene window actor;
- creates Camera3 projection, rig, motion controller, and gizmo actor;
- wires Camera3 motion observer to gizmo updates;
- wires viewport resize to projection resize and gizmo updates;
- registers `Camera3MotionController` as a legacy runtime object;
- creates Tesseract4 actor and injects the Three scene;
- acts as current renderable Scene source for the app render loop;
- performs construction rollback and runtime cleanup.

Deleting or inlining this in one pass would only move the mixed ownership elsewhere. Step 4 should become a sequence of component/service extractions that reduce ownership one axis at a time.

## Revised Step 4 Sequence

## Step 3.5: Pre-Step4 Architecture Closure

This cleanup must happen before Step 4.1. It prevents the Scene refactor from copying the same ownership leaks that still exist in the window layer.

### Step 3.5.1: Surface Lifecycle Ownership

Goal:
- Make `WindowFrameSurfaceComponent` lifecycle owned only by `ComponentRegistry`.
- Frame shell components may attach/detach a surface host, but must not create or dispose the surface component.

Required changes:
- Remove `services.surface ?? new WindowFrameSurfaceComponent(actor)` from `FloatingWindowComponent`.
- Remove `services.surface ?? new WindowFrameSurfaceComponent(actor)` from `WorkspaceRootDockFrameComponent`.
- Require `surface` in both shell service objects.
- Shell `dispose()` may call `surface.detachHost(host)` but must not call `surface.dispose()`.
- `WindowFrameSurfaceComponent.dispose()` remains the only place that disposes content attachments.

Tests:
- Definition tests prove both shell definitions require and inject `windowFrameSurfaceComponentType`.
- Direct constructor tests pass an explicit surface.
- Boundary test forbids `new WindowFrameSurfaceComponent` in `floating-window-component.ts` and `workspace-root-dock-frame-component.ts`.
- Boundary test forbids `#surface.dispose()` in shell components.
- Full checks: `test`, `typecheck`, `build`.

### Step 3.5.2: Read-Only Window Workspace Catalog

Goal:
- Restore `WindowWorkspaceViewCatalog` to a pure read-only projection.
- Keep stack/focus mutation in a narrow window workspace command/service path, not in catalog entries.

Required changes:
- Remove `setStackPriority` from `WindowWorkspaceFrameEntry`.
- Keep read fields such as `baseStackPriority`, `stackPriority`, `stackManaged`, `visible`, and `presentation`.
- Add or reuse a narrow mutation port for stack priority updates, for example `WindowWorkspaceStackPriorityPort` backed by `WindowFramePortRegistry`.
- `WindowWorkspaceController` reads the catalog and writes through the mutation port.

Tests:
- Catalog tests prove changing frame registry state is reflected by re-reading catalog entries, without catalog-owned mutation.
- `WindowWorkspaceController` tests still cover focus-to-front and priority reset.
- Boundary test forbids `setStackPriority` in `window-workspace-view-catalog.ts`.

### Step 3.5.3: Remove Legacy Dock Target Alias

Goal:
- Finish the Step 3 region naming cleanup before Scene work begins.

Required changes:
- Delete `dock-target-frame-source.ts` and `dock-target-frame-source.test.ts`.
- Ensure production and tests import/use `dock-target-region-source.ts`.
- Remove architecture-boundary allowlist entries for the old files.

Tests:
- `dock-target-region-source` tests cover all former alias behavior.
- Boundary test forbids production source references to `DockTargetFrame` and `dock-target-frame-source`.

### Step 4.1: Introduce Scene View Runtime Ports

Goal:
- Define narrow actor/component-facing ports for renderable Scene views.
- Do not yet delete `SceneViewRuntime`.

Required contracts:
- `RenderableSceneView` exposes only `viewActorId`, `measureNow()`, `isRenderable()`, and `render()`.
- `RenderableSceneView` must not expose `dispose`, `disposeRuntimeResources`, actor mutation, frame mutation, or view creation.
- `RenderableSceneViewRegistry` or equivalent source is a read-only projection derived from actor/component state.
- The registry may register/unregister renderable participants through component lifecycle, but read consumers cannot mutate lifecycle.
- Render loop reads the registry/source, not a concrete `CurrentSceneViewSource`.

Tests:
- Unit test render loop source ignores disposed/inactive Scene views.
- Boundary test: app render loop must not refer to concrete `SceneViewRuntime`.
- Boundary test: `RenderableSceneView` type/source must not contain `dispose` or `destroy`.

### Step 4.2: Extract Camera3 Scene Components

Goal:
- Move Camera3 projection/rig/motion/resize/gizmo wiring into actor components under the Scene ViewActor.

Candidate components:
- `Camera3RigComponent`
  - owns `Camera3Rig`, `Camera3ProjectionModeController`, and active camera;
  - pure business component.
- `Camera3MotionComponent`
  - `requires: Camera3RigComponent`;
  - owns `Camera3MotionController`;
  - exposes command sink behavior through an explicit component-facing port, not app composition.
- `SceneCamera3ViewportBindingComponent`
  - `requires: SceneViewportComponent`, `Camera3RigComponent`, and Camera3 gizmo component or a narrow gizmo update port;
  - subscribes to viewport resize and motion changes;
  - owns/disposes these subscriptions in component lifecycle.
- `Camera3GizmoComponent`
  - remains the actor-input participant;
  - receives rig/projection/motion dependencies through component wiring or actor factory options, not app-level subscriptions.

Installation rule:
- Component dependencies must be expressed with `ComponentDefinition.requires`.
- Scene installer may create actors/components, but must not hand-wire long-lived subscriptions that should belong to a component.

Tests:
- Camera3 resize updates projection and gizmo.
- Camera3 double-click and drag remain actor-input routed.
- Destroying Scene ViewActor disposes camera motion/gizmo subscriptions without app-side cleanup.
- Boundary test forbids Scene installer/app composition from subscribing camera motion directly.

### Step 4.3: Extract Scene Content Installer

Goal:
- Replace the `SceneViewRuntime` construction body with a scene feature installer/factory that creates actor/component trees only:
  - Scene ViewActor,
  - `SceneViewportComponent`,
  - Camera3 components and child Camera3 gizmo actor,
  - Tesseract4 child actor.

Boundary:
- The installer may receive factories for test renderer/resize observer/gizmo.
- It must not register feature UI or camera motion through `registerLegacyRuntimeObject`.
- It must return a `WindowViewRuntimeFactoryResult` compatible with current lifecycle.
- It must not become a renamed `SceneViewRuntime`; no render loop ownership, no current-scene singleton, no direct runtime cleanup registry.
- Runtime cleanup must be owned by `disposeViewRuntime`, actor destruction, and component disposal.

Tests:
- Fresh Scene open creates actor tree: Scene ViewActor -> Camera3/Tesseract children.
- Close/reopen Scene three times leaves no stale canvas, resize observer, or camera callback.
- Construction failure rolls back all created actors and subscriptions.
- Boundary test forbids installer source from exposing `render()` or `measureNow()` as owner methods.

### Step 4.4: Replace `SceneViewRuntime` With Component-Owned Runtime

Goal:
- Delete `SceneViewRuntime` and `CurrentSceneViewSource`.
- App render loop consumes the renderable Scene source/registry only.

Tests:
- Boundary test: `SceneViewRuntime` and `CurrentSceneViewSource` do not exist in production source.
- Browser smoke: root/floating/split/fullscreen Scene renders and Camera3 drag/double-click works.
- Browser smoke: close/reopen Scene repeatedly, console errors 0.
- Browser smoke: docked Scene fullscreen/restore still acts on the correct owning frame/session.

## Stop Condition

Do not start Step 4.1 until:

- Step 3.5.1 surface lifecycle ownership is complete;
- Step 3.5.2 catalog mutation has been removed;
- Step 3.5.3 legacy dock target alias has been removed or explicitly reclassified as a blocking cleanup with a new date.

Do not continue into Step 5 until:

- `registerLegacyRuntimeObject(activeCamera3Motion)` is removed or renamed behind an approved runtime-service port;
- app render loop no longer holds a concrete `SceneViewRuntime`;
- Scene actor tree owns Camera3/Tesseract cleanup through component disposal.
