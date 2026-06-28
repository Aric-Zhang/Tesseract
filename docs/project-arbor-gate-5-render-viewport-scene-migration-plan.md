# Project Arbor Gate 5: Render Viewport, Fullscreen Intent, And Scene Migration

Status: completed
Created: 2026-06-28
Parent plan: `docs/project-arbor-ui-framework-actor-layout-plan.md`

Completion: Gate 5 completed on 2026-06-28. Fresh browser smoke evidence lives
at `temp/project-arbor-gate-5-smoke-data.json` with report
`temp/project-arbor-gate-5-smoke-report.md`, and validates with
`$env:PROJECT_ARBOR_GATE_5_SMOKE_EVIDENCE="temp/project-arbor-gate-5-smoke-data.json"; npm run test -w wallpaper-tesseract -- project-arbor-gate-5-smoke-contract`.

Gate 5 is the next Project Arbor acceptance unit after the completed menu
gate. It must prove that a real Scene tab can be expressed as ordinary
actor-backed UI composition:

```text
actor tree -> UiElement -> UiLayoutItem/Host -> generic render viewport
  -> fullscreen intent -> Scene app/editor/runtime integration
```

This gate should land as one acceptance unit. Internal checkpoints are useful,
but Gate 5 is not complete until the real Scene view uses the new generic
controls and the old Scene viewport shell, DOM parent handoff, and fullscreen
shell paths are deleted.

## Goal

Make the Scene tab an ordinary Arbor UI subtree:

```text
Scene View Actor
  UiElementComponent
  UiLayoutHostComponent
  SceneViewContentComponent or equivalent narrow content-registration owner

  World Render View Actor
    UiElementComponent
    UiLayoutItemComponent(slot: fill)
    RenderViewportComponent
    FullscreenableViewComponent

  Camera3 Gizmo Actor
    UiElementComponent
    UiLayoutItemComponent(slot: overlay, layer: CAMERA3_GIZMO_OVERLAY_LAYER)
    Camera3GizmoComponent

  Runtime Scene Content Actor(s)
    Runtime-owned content components
```

The result should make the world render view a normal reusable UI control. It
owns render target display, resize measurement, and fullscreen intent. It does
not own window content registration, docking, tab lifecycle, runtime Scene
resources, or Camera3 presentation.

## Non-Negotiables

- Do not preserve `SceneViewportComponent` as a compatibility shell or rename it
  into a new facade.
- `RenderViewportComponent` must not implement or import
  `WindowRegisteredContent`, `WindowContentRegistrationPort`, or any other
  window content-registration contract.
- Window content registration belongs to a narrow Scene/root content actor or
  existing window content owner, not to the generic render viewport.
- Camera3 gizmo must become a sibling overlay actor under the Scene View actor.
  It must not receive a raw `sceneView.viewport.overlayElement` or any equivalent
  DOM parent handoff.
- Fullscreen intent belongs to the render view actor, but placement mutation
  remains owned by the existing window/workspace presentation lifecycle.
- Pointer activation for generic UI controls must go through actor-input. Gate 5
  must not start while `packages/ui-framework/src/ui/**` production code still
  contains DOM `click` activation shortcuts such as `addEventListener("click")`,
  `addEventListener?.("click")`, or `.onclick`.
- Runtime render target ownership must be explicit:
  - `owned`: the viewport disposes the render target exactly once;
  - `borrowed`: the viewport detaches/unsubscribes only; the runtime owner
    disposes the target.
- For the current Scene migration, the runtime render target must be passed to
  `RenderViewportComponent` as `borrowed`. `RuntimeSceneViewRuntime` already
  disposes the render output; using `owned` in the Scene path would create a
  double-dispose risk unless this gate also moves runtime ownership.
- Do not move Scene, Camera3, Tesseract, runtime, dock, or window workspace
  facts into generic `ui-framework/src/ui/**` code.
- Do not add actor-core UI, DOM, layout, Scene, viewport, or fullscreen
  semantics.
- Delete old CSS selectors and exports in the same gate; no idle legacy paths.

## Scope

In scope:

- `packages/ui-framework/src/ui/viewport/**`
- `packages/ui-framework/src/ui/install-ui-component-definitions.ts`
- `packages/ui-framework/src/ui/index.ts`
- `packages/ui-framework/src/index.ts`
- `packages/editor/src/scene/**`
- `packages/editor/src/camera3/components/camera3-gizmo-actor-factory.ts`
- `apps/wallpaper-tesseract/src/features/scene/**`
- `packages/wallpaper-runtime/src/scene/**` only where its presentation port
  still assumes the old Scene viewport shell
- `apps/wallpaper-tesseract/src/architecture-boundaries.test.ts`
- `apps/wallpaper-tesseract/src/component-definitions.test.ts`
- Scene/App style entries needed to delete old selectors
- Fresh Gate 5 smoke evidence under `temp/`
- `docs/current-project-progress.md`

Out of scope:

- Reworking window docking/lifecycle semantics.
- Replacing `RuntimeSceneViewRuntimeRegistry` package ownership.
- Moving product Scene run-mode policy into `ui-framework`.
- Reintroducing a product-level Scene facade to hide migration details.
- Rewriting Camera3 math, runtime camera truth, or Tesseract runtime ownership.

## Current Facts

These facts must be verified again immediately before editing:

- `packages/editor/src/scene/components/scene-viewport-component.ts` is the
  current monolith. It implements `WindowRegisteredContent`, creates
  `viewportElement`, `canvasHostElement`, and `overlayElement`, appends the
  runtime render target DOM element, observes resize, registers content, and
  disposes the render target.
- `packages/editor/src/scene/components/scene-mode-toggle-component.ts` appends
  controls to `SceneViewportComponent.overlayElement` and sends editor
  workspace mode commands.
- `packages/editor/src/scene/scene-window-actor-factory.ts` creates one Scene
  actor with `SceneViewportComponent` and `SceneModeToggleComponent`.
- `packages/editor/src/scene/editor-scene-view-host.ts` forwards
  `sceneView.viewport.measureNow()` and checks visibility through window
  locations.
- `apps/wallpaper-tesseract/src/features/scene/install-scene-view-feature.ts`
  creates the Scene view, runtime Scene runtime, runtime content, Camera3 gizmo,
  renderable frame source, and DOM parent handoff in one place.
- The same installer currently passes `parent: sceneView.viewport.overlayElement`
  and `parentActor: sceneView.viewport.actor` to `createCamera3GizmoActor`.
- `packages/editor/src/camera3/camera3-gizmo.ts` still exposes
  `Camera3GizmoOptions.parent?: HTMLElement`, which is the raw DOM parent
  channel that allowed Scene to hand its overlay DOM to Camera3.
- `apps/wallpaper-tesseract/src/features/scene/components/scene-camera3-viewport-binding-component.ts`
  depends on `SceneViewportComponent` for resize and `measureNow()`.
- `packages/wallpaper-runtime/src/scene/runtime-scene-frame-source.ts` currently
  consumes `RuntimeSceneViewVisibilityPort` with `viewActorId`, `measureNow()`,
  and `isVisibleInCurrentLocation()`.

## Target Ownership

### Ui Framework

`ui-framework` owns only generic controls:

- `RenderViewportComponent`: render target DOM placement, size measurement,
  resize subscription, target resize call, and target disposal according to
  explicit ownership.
- `FullscreenableViewComponent`: actor-input participant and fullscreen/restore
  intent emission through a narrow product-free port.
- Component definitions and tests for those controls.

It must not know Scene, Camera3, Tesseract, Wallpaper runtime, app menu,
window content registration, docking, or workspace graph types.

### Editor

`editor` owns Scene and Camera3 presentation:

- Scene View root actor creation.
- Any narrow Scene View content-registration component needed to register the
  root Scene content element with the window framework.
- Camera3 gizmo actor creation as an overlay child actor.
- Editor-only scene presentation components.

It must not own runtime render output disposal when the render target is
borrowed from `wallpaper-runtime`.

### Wallpaper App Integration

The app-local Scene installer remains a wiring point, but it should wire owners
instead of owning their internal facts:

- Create the runtime Scene view runtime.
- Pass its render target to the world render view actor as an explicit
  borrowed target. The app must not let Scene choose `owned` while
  `RuntimeSceneViewRuntime` remains the render output disposal owner.
- Attach runtime Scene content under the intended runtime actor parent.
- Adapt fullscreen intent to existing workspace presentation/lifecycle.
- Derive visibility/measurement through the new render viewport and actor tree,
  not through `sceneView.viewport`.

## File Structure

Expected new generic files:

```text
packages/ui-framework/src/ui/viewport/render-viewport-component.ts
packages/ui-framework/src/ui/viewport/render-viewport-definition.ts
packages/ui-framework/src/ui/viewport/render-viewport-component.test.ts
packages/ui-framework/src/ui/viewport/fullscreenable-view-component.ts
packages/ui-framework/src/ui/viewport/fullscreenable-view-definition.ts
packages/ui-framework/src/ui/viewport/fullscreenable-view-component.test.ts
packages/ui-framework/src/ui/viewport/index.ts
```

Expected editor/app replacements may use different final names if the
implementation finds a simpler shape, but they must keep the ownership split:

```text
packages/editor/src/scene/components/scene-view-content-component.ts
packages/editor/src/scene/components/scene-view-content-definition.ts
packages/editor/src/scene/scene-window-actor-factory.ts
apps/wallpaper-tesseract/src/features/scene/components/scene-render-viewport-binding-component.ts
```

Do not keep old file names as aliases. If a legacy file is no longer the owner,
delete it and update callers/tests.

## Step 0: Entry Audit

1. Confirm the working tree and avoid mixing unrelated user changes:

```powershell
git status --short
```

2. Capture the current Scene viewport debt:

```powershell
rg "SceneViewportComponent|sceneView\.viewport|overlayElement|canvasHostElement|createEditorSceneViewHost|scene-window__canvas-host|scene-window__overlay" packages/editor/src apps/wallpaper-tesseract/src packages/wallpaper-runtime/src --glob "!*.test.ts"
```

3. Close the known Gate 4 actor-input exception before adding another generic
   UI control. Production `ui-framework/src/ui/**` must have no DOM click
   activation shortcuts:

```powershell
rg 'addEventListener\??\(\s*["'']click|\.onclick' packages/ui-framework/src/ui --glob "!*.test.ts"
```

Expected result: no production matches. If `PopupMenuComponent` or another
generic UI component still activates through DOM click, fix and test that first.
Outside dismiss/hover DOM listeners are allowed only when they do not activate a
command or intent.

4. Baseline targeted tests:

```powershell
npm run test -w ui-framework -- ui-layout-host ui-layout-item ui-element menu
npm run test -w editor -- scene camera3
npm run test -w wallpaper-tesseract -- architecture-boundaries component-definitions workspace-mode project-prism-smoke-contract
npm run typecheck:test -w ui-framework
npm run typecheck -w editor
npm run typecheck -w wallpaper-tesseract
```

If any baseline failure is unrelated to Gate 5, record it before proceeding. If
it changes Scene/viewport assumptions, amend this plan first.

## Step 1: Add Generic Viewport Controls In Ui Framework

1. Add `packages/ui-framework/src/ui/viewport/**`.
2. Define a product-free render target contract. It should be no wider than:

```ts
interface RenderViewportTarget {
  readonly domElement: HTMLElement;
  setSize(width: number, height: number, pixelRatio: number): void;
  dispose?(): void;
}
```

3. Add `RenderViewportComponent` with these rules:
   - Requires same-actor `UiElementComponent`.
   - Appends only the target `domElement` into the actor element or a
     component-owned viewport root.
   - Uses `ResizeObserver` when available and exposes explicit `measureNow()`.
   - Emits resize subscriptions for app/editor binding code.
   - Supports `owned` and `borrowed` render target ownership.
   - On dispose, disconnects observers, clears subscribers, detaches target DOM,
     and disposes only owned targets.
   - Does not register window content and does not know about tab/content ids.
   - Accepts an injectable `devicePixelRatio` source and uses its current value
     during each real measurement.
4. Add `FullscreenableViewComponent` with these rules:
   - Requires same-actor `UiElementComponent`.
   - Participates in actor-input for its control/hit part.
   - Emits fullscreen/restore intent through a narrow port such as
     `requestFullscreen(actorId, reason)` / `requestRestore(actorId, reason)`.
   - Does not import or mutate `WindowWorkspaceGraph`, dock lifecycle, or
     app/editor state paths.
   - If a visible button/control is needed, its DOM belongs to this component or
     to a separate child actor, not to Scene-specific overlay DOM.
5. Register both definitions through `installUiComponentDefinitions`.
6. Export only the generic components/types from `ui-framework` barrels.

Tests:

- Owned target is resized and disposed exactly once.
- Borrowed target is resized but not disposed.
- Scene migration tests must use borrowed target mode and prove viewport dispose
  does not call the runtime render target dispose path.
- Target DOM is detached on component dispose without removing the actor element.
- `measureNow()` ignores zero-size rects and publishes only real size changes.
- Device pixel ratio injection is honored; a later DPR change is used on the
  next measured resize.
- Resize subscription cleanup works after dispose.
- Fullscreen component emits exactly one intent per actor-input click.
- Fullscreen component has no DOM `click` activation shortcut.
- Missing `UiElementComponent` fails through required dependency.

Boundary grep:

```powershell
rg "Scene|Camera3|Tesseract|WindowWorkspaceGraph|WindowRegisteredContent|WindowContentRegistrationPort|WindowFrame|Dock|app-menu|workspace-mode" packages/ui-framework/src/ui/viewport --glob "!*.test.ts"
rg 'addEventListener\??\(\s*["'']click|\.onclick' packages/ui-framework/src/ui/viewport --glob "!*.test.ts"
```

Both greps should have no production matches unless a test-only explanation is
added outside production sources.

## Step 2: Split Editor Scene Root From Render Viewport

1. Replace the old one-actor Scene shell with a Scene View root actor using:
   - `UiElementComponent`;
   - `UiLayoutHostComponent`;
   - a narrow Scene content-registration component if the root content element
     still needs to register with the window framework.
2. The content-registration component may import window content registration
   contracts because it is the Scene/window content owner. It must not:
   - own render target DOM;
   - expose `canvasHostElement` or `overlayElement`;
   - dispose the runtime render target;
   - provide fullscreen behavior.
3. Add a World Render View child actor under the Scene View actor. It gets:
   - `UiElementComponent`;
   - `UiLayoutItemComponent({ slot: "fill" })`;
   - `RenderViewportComponent`;
   - `FullscreenableViewComponent`.
4. Keep Camera3 out of this step unless the implementation can cleanly migrate
   it as part of the same editor factory change. It is acceptable for Step 2
   tests to create only the root and world render actors, but the final gate
   must migrate Camera3 before closing.
5. Update `scene-window-actor-factory.ts` return type so callers receive named
   handles such as:
   - `sceneActor`;
   - `content`;
   - `worldRenderActor`;
   - `renderViewport`;
   - `fullscreenableView`.
6. Do not expose generic host DOM regions/wrappers as production API.

Tests:

- `createSceneViewActor` creates a root Scene actor and a World Render View
  child actor.
- Root content registration registers the root Scene element, not the render
  target element.
- Render target disposal follows `RenderViewportComponent` ownership mode.
- In the real Scene path, the render target is configured as `borrowed`, and
  Scene/root disposal does not dispose the runtime-owned render output.
- Disposing Scene root destroys child actors and leaves no stale render target
  DOM.
- Hierarchy names are stable and exact once in repeated create/dispose cycles.

## Step 3: Replace Scene Runtime Presentation Port

1. Delete the old `createEditorSceneViewHost()` assumption if it only forwards
   `sceneView.viewport.measureNow()`.
2. Create a new narrow presentation adapter around the World Render View actor
   and `RenderViewportComponent`.
3. Preserve `RuntimeSceneViewVisibilityPort` semantics without depending on the
   old Scene shell:
   - `viewActorId` should identify the logical Scene view/root actor unless a
     better single owner is established in this step.
   - `measureNow()` calls the new render viewport.
   - `isVisibleInCurrentLocation()` derives from existing window location and
     actor active state.
4. Do not make `wallpaper-runtime` import editor/UI/window implementation
   details. It should continue to consume a narrow port.
5. Update `RuntimeSceneViewRuntime.attachSceneView()` call sites to pass the new
   Scene/root actor and presentation adapter.

Tests:

- Runtime frame source registration uses the new presentation adapter.
- Closing Scene unregisters the frame source and stale render views are not
  renderable.
- Reopening Scene registers only the new render view.
- `measureCurrentView()` reaches the new render viewport.

## Step 4: Migrate Camera3 To A Sibling Overlay Actor

1. Change Camera3 gizmo creation so it no longer accepts a raw overlay DOM
   parent for Scene composition.
2. Create the Camera3 gizmo actor as a direct child of the Scene View actor.
   Define the overlay ordering in editor/app code as a numeric constant, for
   example:

```ts
const CAMERA3_GIZMO_OVERLAY_LAYER = 100;
```

   Do not teach `ui-framework` about `"gizmo"` or any other product layer name.
3. Attach:
   - `UiElementComponent`;
   - `UiLayoutItemComponent({ slot: "overlay", layer: CAMERA3_GIZMO_OVERLAY_LAYER })`;
   - `Camera3GizmoComponent`.
4. Delete the raw Camera3 DOM parent channel:
   - remove `parent?: HTMLElement` from `Camera3GizmoOptions`;
   - stop passing any `parent:` option to `createCamera3GizmoActor` or
     `Camera3Gizmo`;
   - make `Camera3GizmoComponent` obtain its host element from the same actor's
     `UiElementComponent`.
5. Replace `SceneCamera3ViewportBindingComponent` so it depends on the new
   `RenderViewportComponent` or its resize port, not `SceneViewportComponent`.
6. The binding remains app-local if it wires app runtime Camera3 motion to editor
   presentation. Do not move runtime Camera3 ownership into editor or
   ui-framework.

Tests:

- Camera3 actor is a sibling overlay child under Scene View.
- Camera3 hit testing still routes through actor-input.
- Render viewport resize updates Camera3 projection and gizmo state.
- Scene close/reopen does not duplicate Camera3 actors or resize subscribers.
- No production code passes `overlayElement` or an equivalent raw parent from
  Scene to Camera3.
- No production Camera3 code exposes `Camera3GizmoOptions.parent` or accepts a
  `parent: HTMLElement` host option.

## Step 5: Move Scene Fullscreen To The Render View Actor

1. Replace old Scene-mode toggle shell behavior with `FullscreenableViewComponent`
   intent on the World Render View actor.
2. Keep the existing workspace presentation/lifecycle owner as the only code
   that mutates fullscreen placement.
3. The app/editor adapter may translate render-view fullscreen intent to the
   logical Scene root view actor, but that mapping must be derived from the
   actor tree or an explicit owner created in this gate. Do not add a parallel
   global map.
   - `FullscreenableViewComponent` emits a source actor intent for the World
     Render View actor.
   - The adapter maps that source actor to the already registered Scene root
     view actor before calling window lifecycle/presentation.
   - The World Render View actor id must not be passed directly to window
     lifecycle as if it were the registered dockable Scene view.
4. Remove `SceneModeToggleComponent` if it is fully superseded. If a small
   product command button is still needed, make it a separate actor/control
   built on generic UI components rather than a Scene viewport overlay append.
5. Update `scene-run-mode-command.ts` only as needed so product run/develop
   commands call the same fullscreen presentation port used by the render view
   intent.

Tests:

- Clicking the render view fullscreen control enters fullscreen.
- Clicking restore exits fullscreen.
- Programmatic run/develop commands and actor-input fullscreen intent converge
  on the same Scene root view fullscreen session.
- Fullscreen/restore does not persist runtime-only frame ids.
- Fullscreen does not require tab/shell-specific Scene code.

## Step 6: Delete Legacy Scene Shell And Compatibility Paths

Delete or rewrite all old facts in the same cleanup:

- `packages/editor/src/scene/components/scene-viewport-component.ts`
- `packages/editor/src/scene/components/scene-viewport-definition.ts`
- `packages/editor/src/scene/components/scene-mode-toggle-component.ts` if
  superseded by the generic fullscreen path
- `packages/editor/src/scene/components/scene-mode-toggle-definition.ts` if
  superseded
- `packages/editor/src/scene/editor-scene-view-host.ts` if it only supports the
  old viewport shell
- stale exports from `packages/editor/src/scene/components/index.ts`
- `Camera3GizmoOptions.parent` and any raw DOM `parent:` option accepted by
  Camera3 gizmo construction
- old tests that assert the deleted shell shape
- old CSS selectors:
  - `.scene-window__viewport` if replaced by generic viewport styling;
  - `.scene-window__canvas-host`;
  - `.scene-window__overlay`;
  - `.scene-window__view-controls`;
  - `.scene-window__mode-toggle-button`;
  - Scene-specific fullscreen shell selectors.

Required grep gates:

```powershell
rg "SceneViewportComponent|sceneViewportComponentType|sceneView\\.viewport|overlayElement|canvasHostElement|createEditorSceneViewHost" packages/editor/src apps/wallpaper-tesseract/src packages/wallpaper-runtime/src --glob "!*.test.ts"
rg "Camera3GizmoOptions[\\s\\S]*parent\\?|parent\\s*:\\s*.*HTMLElement|parent\\s*:\\s*sceneView|parent\\s*:\\s*.*overlay" packages/editor/src apps/wallpaper-tesseract/src --glob "!*.test.ts"
rg "scene-window__(canvas-host|overlay|view-controls|mode-toggle|viewport)" packages apps/wallpaper-tesseract/src --glob "!*.test.ts"
rg "WindowRegisteredContent|WindowContentRegistrationPort" packages/ui-framework/src/ui/viewport --glob "!*.test.ts"
```

Expected result: no production matches. Tests may mention old names only to
assert they are forbidden or deleted.

## Step 7: Boundary Tests And Package Tests

Update architecture/boundary tests so the deleted old shape cannot return:

- `ui-framework/src/ui/viewport/**` must not import editor, wallpaper-runtime,
  app-local feature code, window content registration, docking, or workspace
  graph.
- `WindowFrameSurfaceComponent` must not contain Scene, viewport, fullscreen,
  Camera3, or render target special cases.
- App/editor Scene code must not pass `overlayElement`, `canvasHostElement`, or
  `sceneView.viewport` to any owner.
- Camera3 must be a Scene sibling overlay actor, not a DOM child of the render
  viewport.
- Camera3 production construction must not accept or pass raw DOM `parent`
  options.
- Fullscreenable render-view intent must resolve to the registered Scene root
  view actor before entering window lifecycle.
- The Scene runtime presentation port must be narrow and not expose DOM/window
  shell internals.

Targeted validation:

```powershell
npm run test -w ui-framework -- render-viewport fullscreenable-view ui-layout-host ui-layout-item ui-element
npm run test -w editor -- scene camera3
npm run test -w wallpaper-tesseract -- architecture-boundaries component-definitions workspace-mode project-prism-smoke-contract
npm run typecheck:test -w ui-framework
npm run typecheck -w editor
npm run typecheck -w wallpaper-tesseract
npm run build -w ui-framework
npm run build -w editor
npm run build -w wallpaper-tesseract
```

## Step 8: Fresh Browser Smoke

Run the existing dist freshness preparation before browser smoke:

```powershell
npm run prism:smoke:prepare
npm run dev -w wallpaper-tesseract
```

Generate fresh Gate 5 evidence:

```text
temp/project-arbor-gate-5-smoke-data.json
temp/project-arbor-gate-5-smoke-report.md
```

The smoke data must cover:

- boot with zero console errors;
- Scene visible as root Scene View actor plus World Render View child plus
  Camera3 overlay child;
- render viewport rect and render target/canvas rect are measurable and nested
  in the expected fill region;
- overlay rect/hit evidence proves Camera3 is above the render viewport and
  actor-input still reaches Camera3;
- fullscreen enter/restore through render view intent;
- programmatic Scene run/develop command still works and uses the same
  Scene root fullscreen session as actor-input fullscreen intent;
- Scene close/reopen at least twice: Scene, World Render View, Camera3, runtime
  content, frame source, and canvas are exact-once after each reopen;
- Debug -> Scene and Scene -> Debug dock sanity still pass;
- persistence after fullscreen/restore/reload remains version 2 and does not
  contain actor ids, DOM ids, frame ids, runtime-only fullscreen frames, or
  render target ids;
- mobile viewport confirms Window menu, Scene render view, Camera3 hit/control,
  and fullscreen control have clickable intersection with the viewport.

Add or update a Gate 5 smoke contract test if the existing Project Prism smoke
contract cannot assert the new Arbor-specific Scene actor/viewport evidence.

## Step 9: Final Validation

After fresh smoke passes:

```powershell
npm run test -w ui-framework
npm run typecheck:test -w ui-framework
npm run build -w ui-framework
npm run test -w editor
npm run typecheck -w editor
npm run build -w editor
npm run test -w wallpaper-tesseract
npm run typecheck -w wallpaper-tesseract
npm run build -w wallpaper-tesseract
npm run test
npm run typecheck
npm run build
```

Update:

- `docs/current-project-progress.md`
- `docs/project-arbor-ui-framework-actor-layout-plan.md` Gate 5 status
- `docs/known-defects-and-todos.md` only if a confirmed defect is found or
  closed

## Stop Conditions

Stop and amend the plan before continuing if any of these occur:

- The implementation needs UI-specific layout/DOM/fullscreen semantics in
  `actor-core`.
- `RenderViewportComponent` needs to import or implement window content
  registration to make Scene work.
- The app needs a compatibility `SceneViewportComponent` or app-local facade
  after migration.
- Camera3 cannot become a sibling overlay actor without adding a parallel DOM
  parent channel.
- Fullscreen can only be implemented by mutating `WindowWorkspaceGraph` directly
  from a generic UI component.
- Runtime render output disposal has two possible owners after migration.
- Fresh smoke cannot prove close/reopen removes stale canvas, stale frame
  source, and stale Camera3 subscribers.

## Acceptance Checklist

- `RenderViewportComponent` and `FullscreenableViewComponent` exist in
  `ui-framework` with product-free tests.
- Scene uses a root Arbor host actor with a fill World Render View child.
- Scene render target is passed to the render viewport as borrowed while
  runtime remains the render output disposal owner.
- Camera3 gizmo is a sibling overlay actor.
- Camera3 raw DOM `parent` option is deleted from production construction.
- Old Scene viewport shell, DOM parent handoff, Scene-specific overlay CSS, and
  old fullscreen shell implementation are deleted.
- Boundary tests prevent the old shape from returning.
- Fresh Gate 5 browser evidence exists and validates.
- Root `test`, `typecheck`, and `build` pass.
