# Current Project Progress

Last updated: 2026-07-01

This document is the mutable project-status companion to `AGENTS.md`. Keep
phase status, package lists, source topology, active plans, and verification
commands here instead of in `AGENTS.md`.

Known defects and confirmed follow-up cleanup live in:

```text
docs/known-defects-and-todos.md
```

Update that ledger when debugging finds a confirmed issue, when a fix lands, or
when a defect becomes a non-blocking architecture cleanup item.

## Repository Shape

This is a TypeScript npm workspace for a Wallpaper Engine tesseract demo and
supporting actor, UI, runtime, 4D, and gizmo libraries.

Current workspace packages:

- `packages/foundation`: zero-dependency shared facade/diagnostics foundation.
  It owns `foundation/facade` and `foundation/diagnostics`, has no root export,
  no workspace dependencies, and no profiling implementation yet.
- `packages/actor-system`: consolidated actor package with explicit
  `actor-system/core`, `actor-system/input`, and `actor-system/gizmo`
  submodule exports. It owns actor/component core, actor input participation,
  and framework-agnostic gizmo event machinery without a root production export.
- `packages/ui-framework`: extracted product-agnostic app shell, window, tab,
  dock, menu, layout, chrome, port, and service contracts.
- `packages/runtime-core`: extracted renderer-agnostic runtime contracts for
  ids, frames, scheduler, commands, queries, worlds, cameras, projection graph,
  and frame sources.
- `packages/runtime-three`: extracted Three/WebGL runtime backend package for
  runtime-core contracts.
- `packages/wallpaper-runtime`: Phase 10 production Wallpaper runtime package.
  It owns runtime scheduler/work attachment, Camera3 motion runtime,
  Tesseract4 runtime actor/renderable ownership, runtime Scene content,
  frame-source registration, and runtime Scene view registry. It must not
  import editor/UI/window/app composition or DOM/window ownership.
- `packages/editor`: Phase 6 editor package. It currently owns editor state,
  editor window-layout defaults, and editor state adapters, and must not import
  app-local runtime glue.
- `packages/four-rotation`: 4D rotation math.
- `packages/four-camera`: 4D camera/projection model.
- `packages/four-camera-three`: Three.js bridge for the 4D camera stack.
- `apps/wallpaper-tesseract`: Vite + Three.js Wallpaper Engine app and the
  remaining staging area for app/editor/runtime integration work.

## Project Prism Status

Project Prism is complete as of 2026-06-14. The remaining items in
`docs/known-defects-and-todos.md` are non-blocking historical/watch entries, not
active phase blockers.

## Project Arbor Status

Project Arbor is complete as of 2026-06-29. It moved ordinary UI controls into
the actor tree -> component composition model and deleted the old App Menu,
Scene viewport/fullscreen shell, Hierarchy row DOM/input, Debug `<pre>` renderer,
and app/editor hard-coded styling paths that were replaced by generic
`ui-framework` controls and theme tokens.

Accepted Arbor baseline:

- `ui-framework` owns `UiElementComponent`, `UiLayoutItemComponent`,
  `UiLayoutHostComponent`, generic menu/submenu controls, native
  `ScrollViewComponent`, actor-backed `TreeViewComponent` / `ListViewComponent`,
  data-backed `VirtualListViewComponent`, `RenderViewportComponent`,
  `FullscreenableViewComponent`, semantic theme token definitions,
  `UiThemeComponent`, generated theme CSS, and reusable control CSS exports.
- App Menu is now an Arbor actor subtree. Window-specific menu descriptors stay
  in the app-local adapter; the old `app-menu-model`, row/highlight state,
  direct `parent: HTMLElement` append path, and app-menu-specific selectors were
  deleted.
- Scene is now assembled as an Arbor subtree with a fill World Render View and
  sibling Camera3 overlay. The old editor `SceneViewportComponent`,
  `SceneModeToggle`, DOM host, raw Camera3 parent channel, and Scene-specific
  overlay/canvas/fullscreen selectors were deleted. Scene render target ownership
  remains borrowed from `wallpaper-runtime`.
- Hierarchy now uses `UiElement + ScrollView + TreeView` with stable item actors
  and generic activation. Hierarchy presentation/item actors are excluded from
  `ActorHierarchyObjectSource`; the old row DOM/CSS/input path was deleted.
- Debug Log now uses a Debug-owned data source plus
  `VirtualListViewComponent`. Per-log actors, the actor-backed Debug ListView
  path, `DebugLogEntryActorReconciler`, and Debug-specific row CSS were deleted.
- The app-owned root `UiThemeComponent` and app-local theme controller provide
  runtime theme switching through `Edit -> Theme -> <theme>`. Theme file paths
  and product theme selection stay outside `ui-framework`; `ui-framework` owns
  only parsing/creation/validation primitives, defaults, and component behavior.

Detailed Project Arbor execution plans, older Gate 4/Gate 5/Final smoke
contracts, and the old Arbor final smoke runner were removed during
post-completion cleanup. Use Git history for historical plan review; do not
treat deleted Arbor step/gate documents or old gate-specific smoke contracts as
active instructions.

Current Arbor acceptance checks:

```text
npm run test -w ui-framework -- theme menu fullscreenable-view render-viewport scroll tree list virtual collection
npm run typecheck:test -w ui-framework
npm run build -w ui-framework
npm run test -w editor -- inspector debug hierarchy
npm run typecheck -w editor
npm run build -w editor
npm run test -w wallpaper-tesseract -- architecture-boundaries project-arbor-gate-7-theme-smoke-contract
npm run typecheck -w wallpaper-tesseract
npm run build -w wallpaper-tesseract
```

The latest Arbor browser smoke can be regenerated with:

```text
npm run prism:smoke:prepare
npm run dev -w wallpaper-tesseract
node apps/wallpaper-tesseract/scripts/run-project-arbor-gate-7-theme-smoke.mjs
$env:PROJECT_ARBOR_GATE_7_THEME_SMOKE_EVIDENCE="temp/project-arbor-gate-7-theme-smoke-data.json"; npm run test -w wallpaper-tesseract -- project-arbor-gate-7-theme-smoke-contract
```

`ARB-001` remains a non-blocking follow-up for a deterministic large Hierarchy
browser fixture. It does not block the accepted Arbor architecture baseline.

## Project Canopy Status

- `docs/project-canopy-package-consolidation-plan.md` is the active package
  granularity plan. It evaluates consolidating the currently small actor/input/
  gizmo packages into one coherent actor-system package and tightening
  `ui-framework` submodule boundaries so reusable feature development needs
  fewer package-level dependencies without creating compatibility barrels. The
  first executable slice,
  `docs/project-canopy-gate-0-package-graph-baseline-plan.md`, is complete. It
  added package graph descriptors, centralized production source filtering,
  manifest cycle detection, undeclared workspace import checks, current package
  zone dependency rules, rule coverage checks for every non-app workspace
  package, and future `actor-system/core|input|gizmo` submodule boundary
  fixtures before any package files moved.
- Canopy Gate 1, `docs/project-canopy-gate-1-actor-system-package-plan.md`, is
  complete. It merged the former actor foundation packages into
  `packages/actor-system`, deleted the old package folders, and keeps internal
  `core/input/gizmo` direction enforced by boundary tests.
- Canopy Gate 2,
  `docs/project-canopy-gate-2-ui-framework-submodule-boundaries-plan.md`, is
  complete. `ui-framework` remains one package, but its public package surface
  is now explicit submodule exports only: `ui-framework/actor-ui`,
  `ui-framework/controls`, `ui-framework/menu`, `ui-framework/theme`, and
  `ui-framework/window`, plus the existing `ui-framework/ui/theme.css` and
  `ui-framework/ui/ui-framework-controls.css` CSS entries. The root package
  export was removed, production root imports were reduced from the reviewer
  baseline of about 63 files / 108 sites to 0, and the old aggregate
  `installUiComponentDefinitions` was deleted in favor of owner-specific
  installers.
- Canopy Gate 3,
  `docs/project-canopy-gate-3-root-script-workspace-simplification-plan.md`, is
  complete. Repeated root `test`, `typecheck`, `build`, and
  `prism:smoke:prepare` workspace chains now delegate to
  `scripts/run-workspace-sequence.mjs`, backed by the side-effect-free
  `scripts/workspace-sequence-config.mjs` sequence matrix. Package exports,
  dependencies, TypeScript references, app imports, and runtime behavior were
  not changed by Gate 3. Gate 2 and Gate 3 were committed together as
  `acc24120`.
- Canopy Gate 4 is planned in
  `docs/project-canopy-gate-4-runtime-consolidation-decision-plan.md` and is
  complete. The decision report is
  `docs/project-canopy-gate-4-runtime-consolidation-report.md`. Runtime/math
  packages stay in their current shape: `runtime-core`, `runtime-three`,
  `wallpaper-runtime`, `four-rotation`, `four-camera`, and
  `four-camera-three` still protect distinct contract/backend/product/math
  boundaries. No runtime merge implementation plan is created.

Project Canopy is complete as of 2026-06-30. Future package consolidation
should start from a new reviewed plan, not by extending Canopy by default.

## Next Editor Plan

`docs/editor-selection-and-inspector-plan.md` is the active
foundation/editor work item. Gate 0 is complete: `packages/foundation` now
provides `foundation/facade` and `foundation/diagnostics`, `Debug` has a
provider-backed diagnostics facade, profiling remains deferred, and architecture
boundaries enforce `foundation -> []`. Gate 1 is complete: app composition owns
one `DiagnosticHub`, installs it as the process-level `Debug` provider, passes a
`DiagnosticSource` into the Debug window feature, and deleted the old
app-to-Debug-window callback path. Debug Window is now only a diagnostics viewer;
`DiagnosticHub` owns diagnostic ids, timestamps, capacity, and retained event
history. Gate 2 is complete: `actor-system/core/selection` owns the pure
actor-id selection model, `packages/editor/src/selection` owns editor selection
state and the scoped `Selection` facade, app composition installs one selection
provider, Hierarchy row activation writes `selection.snapshot`, and the old
`selection.activeObject` path has been deleted. Gate 3 is complete: Inspector
content now uses `UiElementComponent`, unlocked Inspectors follow
`selection.snapshot.activeActorId`, component-local lock state keeps an
Inspector on its inspected actor until unlocked, and browser smoke proves real
Hierarchy selection updates visible Inspector text without reintroducing
Hierarchy-owned selection state.

The first executable slice is:

```text
docs/editor-selection-and-inspector-gate-0-foundation-diagnostics-plan.md
```

That slice is complete; keep it as the Gate 0 execution record.

The second executable slice is:

```text
docs/editor-selection-and-inspector-gate-1-diagnostics-product-migration-plan.md
```

That slice is complete; keep it as the Gate 1 execution record. Its browser
smoke evidence is:

```text
temp/editor-gate-1-diagnostics-smoke-data.json
temp/editor-gate-1-diagnostics-smoke-report.md
```

The completed Gate 2 executable slice is:

```text
docs/editor-selection-and-inspector-gate-2-selection-model-editor-ownership-plan.md
```

Gate 2 introduced the pure actor-id selection model, moved editor selection
state ownership out of Hierarchy, installed the scoped `Selection` facade
provider, and deleted the old `selection.activeObject` path in the same cleanup.
Its browser smoke evidence is:

```text
temp/editor-gate-2-selection-smoke-data.json
temp/editor-gate-2-selection-smoke-report.md
```

The completed Gate 3 executable slice is:

```text
docs/editor-selection-and-inspector-gate-3-inspector-follow-lock-plan.md
```

Gate 3 made Inspector content use `UiElementComponent`, follow
`selection.snapshot.activeActorId` when unlocked, keep its inspected actor when
locked, and prove the visible Inspector text updates from real Hierarchy
selection without reintroducing Hierarchy-owned selection state. Its browser
smoke evidence is:

```text
temp/editor-gate-3-inspector-follow-smoke-data.json
temp/editor-gate-3-inspector-follow-smoke-report.md
```

Inspector property rows and component-specific inspectors are now planned in:

```text
docs/editor-inspector-component-details-plan.md
```

That plan makes the shared interaction/update contract an explicit prerequisite:
Actor Input -> Editor-owned interaction controller -> `frameUpdateAttachment`
refresh. It does not add actor-system UI/OnGUI semantics, and it keeps the
generic frame-command batching extraction deferred until real duplication
beyond the first Inspector property-edit slice proves the need. Multi-selection
property merging, range/Ctrl selection UX, persistent pinned Inspector state,
and scene object picking remain ordinary follow-ups unless that plan promotes
them to an active gate.

The first executable slice is:

```text
docs/editor-inspector-component-details-gate-0-interaction-contract-plan.md
```

That slice is complete. It added executable architecture-boundary guardrails
before implementing component rows or editable properties: `actor-system/core`
must stay free of UI/OnGUI/Inspector hook semantics, `ui-framework` remains the
frame-update hook owner, `packages/editor` cannot depend on
`wallpaper-runtime` for descriptor types, Inspector cannot bypass the future
actor-details source through Hierarchy/app internals, and editable numeric
fields cannot be Inspector-private DOM shortcuts. Validation completed:

```text
npm run test -w wallpaper-tesseract -- architecture-boundaries
git diff --check
```

The completed Gate 3 executable slice is:

```text
docs/editor-inspector-component-details-gate-1-component-sections-plan.md
```

Gate 1 is complete. It replaced the display-name-only Inspector source with
`InspectorActorDetailsSource`, deleted the old display source/barrel exports,
kept the ActorSystem details-source adapter package-internal, and renders a
read-only Component section stack for the inspected Actor. Gate 1 does not add
descriptor registry, property rows, editable fields, runtime commands, or
frame-command batching.

Gate 1 browser smoke evidence:

```text
temp/editor-inspector-component-sections-smoke-data.json
temp/editor-inspector-component-sections-smoke-report.md
```

The smoke recorded console errors 0, Scene component count 5, Camera3 component
count 4, Inspector lock/follow split behavior, and Debug diagnostics still
visible.

Regenerate this Inspector component-section regression with:

```text
npm run prism:smoke:prepare
npm run dev -w wallpaper-tesseract
node apps/wallpaper-tesseract/scripts/run-editor-inspector-component-sections-smoke.mjs
```

The next executable slice is:

```text
docs/editor-inspector-component-details-gate-2-read-only-properties-plan.md
```

Gate 2 is complete. It added an editor-owned
`InspectorComponentDescriptorRegistry`, required registry wiring through app
composition and Inspector feature setup, read-only property rows under
Component sections, and guarded frame-update refresh for dynamic summaries.
Wallpaper-runtime-specific descriptors are registered from app-local code in
`apps/wallpaper-tesseract/src/features/inspector/install-wallpaper-inspector-descriptors.ts`:
Camera3 Motion exposes projection mode, distance, yaw, pitch, and FOV from
public runtime APIs; Tesseract4 exposes only component id/type summary. Gate 2
does not add an empty editor descriptor installer, editable fields, runtime
commands, Inspector-private input controls, descriptor ordering, or a property
edit controller.

Gate 2 browser smoke evidence:

```text
temp/editor-inspector-readonly-properties-smoke-data.json
temp/editor-inspector-readonly-properties-smoke-report.md
```

Regenerate this Inspector read-only property regression with:

```text
npm run prism:smoke:prepare
npm run dev -w wallpaper-tesseract
node apps/wallpaper-tesseract/scripts/run-editor-inspector-readonly-properties-smoke.mjs
```

The next executable slice is:

```text
docs/editor-inspector-component-details-gate-3-editable-camera-fov-plan.md
```

Gate 3 is complete. It added a generic `NumberFieldComponent`, a runtime camera
FOV command with runtime-owned validity constraints, one editor-owned
`InspectorPropertyEditController`, stable Inspector property control actors,
and app-local Camera3 FOV edit descriptor wiring. Inspector body still does not
create private input DOM, `packages/editor` still does not depend on
`wallpaper-runtime`, and no actor-system UI hook or generic frame-command batch
primitive was introduced. The gizmo event system now preserves native browser
default behavior for actor-input `content-control` hits so field controls can
receive text-editing focus without bypassing actor-input routing.

Gate 3 browser smoke evidence:

```text
temp/editor-inspector-editable-camera-fov-smoke-data.json
temp/editor-inspector-editable-camera-fov-smoke-report.md
```

Regenerate this Inspector editable FOV regression with:

```text
npm run prism:smoke:prepare
npm run dev -w wallpaper-tesseract -- --force
node apps/wallpaper-tesseract/scripts/run-editor-inspector-editable-camera-fov-smoke.mjs
```

Before Gate 4 hardening, Gate 3.5 closed the scroll ownership issue:

```text
docs/editor-inspector-component-details-gate-3-5-window-scroll-ownership-plan.md
```

Gate 3.5 is complete. The lower Inspector scrollbar bug exposed a real
window-scroll ownership split, so ordinary window content scrolling moved to
`WindowFrameSurfaceComponent` / `ui-framework/window`. The window surface now
wraps registered content in a window-owned scroll viewport, uses the shared
`--ui-scrollbar-*` styling, routes native scrollbar gutter hits as actor-input
`content-control`, and uses the wrapper as the only visual hidden owner.
Inspector no longer has local `overflow: auto`; Hierarchy no longer installs
`ScrollViewComponent` for whole-window scrolling; Debug keeps
`ScrollViewComponent` only as the tested `VirtualListViewComponent` nested scroll
source.

Gate 3.5 browser smoke evidence:

```text
temp/editor-inspector-window-scroll-ownership-smoke-data.json
temp/editor-inspector-window-scroll-ownership-smoke-report.md
```

Regenerate this window scroll ownership regression with:

```text
npm run prism:smoke:prepare
npm run dev -w wallpaper-tesseract -- --force
node apps/wallpaper-tesseract/scripts/run-editor-inspector-window-scroll-ownership-smoke.mjs
```

Gate 3.6 is complete. It closes the floating-window resize-hit follow-up:

```text
docs/editor-inspector-component-details-gate-3-6-floating-scrollbar-resize-hit-plan.md
```

Floating windows now choose input hits through local semantic candidate
arbitration instead of source-order resize checks. Visible content controls win
over parent frame resize affordances, content scrollbar hits use
`content-control` scope, resize handles no longer cover the window-owned
scrollbar gutter, and resize remains available outside the window frame. ARB-004
is verified: browser smoke now proves a positive native gutter, scrollbar drag,
bottom/right gutter not covered by resize, right-side resize, bottom-right
corner resize, and unchanged frame rect during scrollbar drag.

Gate 3.6 browser smoke evidence:

```text
temp/editor-inspector-window-scroll-ownership-smoke-data.json
temp/editor-inspector-window-scroll-ownership-smoke-report.md
```

Regenerate this window scroll ownership / floating resize-hit regression with:

```text
npm run build -w ui-framework
npm run dev -w wallpaper-tesseract -- --host 127.0.0.1
EDITOR_INSPECTOR_WINDOW_SCROLL_SMOKE_URL=http://127.0.0.1:<port>/?resetWorkspaceLayout=1 node apps/wallpaper-tesseract/scripts/run-editor-inspector-window-scroll-ownership-smoke.mjs
```

The next executable slice is Gate 4 hardening:

```text
docs/editor-inspector-component-details-gate-4-hardening-plan.md
```

Gate 4 should not add a new Inspector architecture. Its purpose is lifecycle and
QA hardening for the existing component/property path: component attach/detach,
destroyed Actor missing state, stale property control cleanup, multi-Inspector
sync, editable FOV robustness, boundary/public-surface audit, and final browser
smoke evidence.

## Editor Toolbar / Inspector Lock Plan

`docs/editor-toolbar-button-inspector-lock-plan.md` is complete. It added
visible Inspector lock UI and reusable toolbar/button controls without leaving
the old Inspector content-registration path alive.

Gate 1 is complete. `ui-framework/controls` now exposes generic
`ButtonComponent`, `ToggleButtonComponent`, and `ToolbarComponent`.
Button/toggle pointer activation uses actor-input, keyboard activation is
generic Enter/Space behavior, toolbar refresh uses frame update attachment plus
a signature guard, and `FullscreenableViewComponent` now reuses the shared
package-private button renderer/state helper instead of maintaining a separate
fullscreen-only button renderer. Gate 1 closure fixed the command/toggle ARIA
split: ordinary `ButtonComponent` no longer emits `aria-pressed`, while
`ToggleButtonComponent` and fullscreen controls opt into toggle pressed mode.
The shared renderer remains package-private and is not exported through
`ui-framework/controls`.

Gate 1 executable plan:

```text
docs/editor-toolbar-button-inspector-gate-1-ui-framework-controls-plan.md
```

Gate 2 is complete. Inspector is now an Arbor subtree with a root
`InspectorRootContentComponent` owning `WindowRegisteredContent`, a toolbar
child actor using `ToolbarComponent`, a lock button child actor using
`ToggleButtonComponent`, and a body child actor using `InspectorContentComponent`
for selection follow/lock display only. `InspectorContentComponent` no longer
registers window content, and direct `setLocked(...)` calls synchronize the
toolbar toggle pressed state, icon, label, and title through the lock-state
sink.

Gate 2 executable plan:

```text
docs/editor-toolbar-button-inspector-gate-2-inspector-toolbar-lock-plan.md
```

Gate 2 browser smoke evidence:

```text
temp/editor-toolbar-gate-2-inspector-lock-smoke-data.json
temp/editor-toolbar-gate-2-inspector-lock-smoke-report.md
```

Gate 3 is complete. It narrowed the remaining Inspector public barrel surface,
removed indirect public exports for the Inspector actor factory handle and
component definition installer, verified stale old-path deletion, generated
fresh Gate 3 smoke evidence, and ran the broad validation matrix.

Gate 3 executable plan:

```text
docs/editor-toolbar-button-inspector-gate-3-closure-plan.md
```

Gate 3 browser smoke evidence:

```text
temp/editor-toolbar-gate-3-closure-smoke-data.json
temp/editor-toolbar-gate-3-closure-smoke-report.md
```

Current package graph baseline:

```text
foundation -> []
actor-system -> []
ui-framework -> [actor-system]
runtime-core -> []
runtime-three -> [four-camera, four-camera-three, runtime-core]
wallpaper-runtime -> [actor-system, four-camera, four-rotation, runtime-core, runtime-three]
editor -> [actor-system, foundation, runtime-core, ui-framework]
four-rotation -> []
four-camera -> [four-rotation]
four-camera-three -> [four-camera]
wallpaper-tesseract -> [actor-system, editor, foundation, runtime-core, runtime-three, ui-framework, wallpaper-runtime]
```

Gate 2 reuses the Gate 0 package graph and resolved import helpers for package
export, root-import, and submodule-zone boundary checks.

Post-closure temp cleanup is complete for Project Prism and Project Arbor.
Tracked Project Prism Final Gate evidence remains under `temp/`. Arbor smoke
outputs are disposable regenerated evidence unless a current plan explicitly
names them; older Arbor gate logs, smoke intermediates, and temp runner scripts
were removed as completed work traces.

Accepted or completed phases:

- Phase 0 / 0B established boundary reports, interaction host evidence, and
  baseline acceptance.
- Phase 1 extracted shared spine concepts, attachment metadata/runtime paths,
  explicit update frame/state/UI ports, and removed old capability adapter
  paths from accepted ownership.
- Phase 2 extracted `actor-system/core` and `actor-system/input` package targets.
- Phase 3 extracted `ui-framework` and accepted root/floating dock surface
  semantics.
- Phase 4 extracted `runtime-core` contracts and removed the earlier runtime
  adapter prototype from accepted production ownership.
- Phase 5 current scope is accepted: `runtime-three` exists, runtime work has a
  scheduler lane, editor/app state is split out of scene-wide state, Phase 4
  runtime-adapter debt is gone, and the Camera3 gizmo view-state bug is closed.
- Phase 5.5 is complete for the pre-Phase 6 window-workspace gate. The generic `SceneRuntime` / `RuntimeObject` bus has
  been deleted from production, explicit app frame orchestration is in place,
  and the old `Tesseract4RuntimeObject` has been replaced by runtime renderable
  staging. The pre-Phase 6 window-workspace truth work has moved the main
  placement mutation path to `WindowWorkspaceGraph` transactions/projections,
  and the surface/content-host/dock-tree cleanup slice has deleted the old
  exposed placement implementation.

Completed phase record:

- Phase 6 editor package extraction is complete through the final browser
  evidence gate. Remaining work belongs to the next runtime-owner/app bootstrap
  cleanup slices, not to app-local editor compatibility.
- Phase 7 runtime-owner/app-bootstrap execution and closure are complete. Its
  implementation record is
  `docs/project-prism-phase-7-runtime-owner-app-bootstrap-plan.md`.
- The completed closure record is
  `temp/project-prism-phase-7-closure-plan.md`.
- Phase 8 is complete:
  `docs/project-prism-phase-8-runtime-scene-composition-plan.md`.
- The Phase 7 execution slice has landed. App-local `runtime/ports`,
  `app-runtime`, `update-runtime`, old app-local `features/camera3`, old
  app-local `tesseract4`, the mixed Scene content installer, app-local actor-id
  constants, and app-local component-definition/workspace-mode files under
  `src/app` have been deleted rather than preserved as compatibility shells.
  At the end of Phase 7 those owners still lived under app-local
  `apps/wallpaper-tesseract/src/runtime`; Phase 10 has since moved that
  production runtime ownership into `packages/wallpaper-runtime` and deleted
  the app-local runtime directory. Scene presentation binding stays in the
  Scene feature layer.
- Phase 8 execution has completed Steps 0-7. It deleted the app-local
  `features/install-wallpaper-component-definitions.ts` and
  `gizmo-runtime/install-component-definitions.ts` installers, moved
  actor-system/input component definition installation into `packages/actor-system/src/input`,
  moved renderable Scene frame-source ownership into runtime staging, and
  narrowed the old workspace mode module to product run-fullscreen command
  orchestration.
- `DCK-006` is closed. The root cause was floating-frame tab-drag state loss:
  `FloatingWindowComponent` did not retain that a pointer session started on a
  tab after the pointer left the tab hit, so real browser drags could move the
  floating shell instead of submitting a dock intent. Floating frames now carry
  `#draggingTab` like the root frame, and `handleWindowFrameTabInputEnd`
  commits an already-started tab drag without depending on the release hit
  still being a tab.
- Fresh Phase 8 smoke evidence now lives at
  `temp/project-prism-phase-8-smoke-data.json` and validates with
  `$env:PROJECT_PRISM_SMOKE_EVIDENCE="temp/project-prism-phase-8-smoke-data.json"; npm run test -w wallpaper-tesseract -- project-prism-smoke-evidence-file`.
  The report is `temp/project-prism-phase-8-smoke-report.md`.
- Phase 8.5 remaining-debt closure is complete:
  `docs/project-prism-phase-8-5-remaining-debt-closure-plan.md`.
- Phase 8.5 removed product-owned Scene/Tesseract/Camera3 internal actor ids,
  moved runtime Scene frame-source registration behind
  `RuntimeSceneViewRuntimeRegistry`, removed runtime frame-source re-exports
  from `features/scene/index.ts`, and deleted product-level Scene render/measure
  hooks from `install-wallpaper-product-features.ts`.
- Phase 8 remaining cleanup continued by moving Scene and Debug/Hierarchy
  default state registration and floating/default view policy construction into
  their owner modules (`features/scene` and `packages/editor/src/tool-windows`).
  Phase 9 then deleted the remaining product installer shell instead of
  preserving it as a thinner facade.
- Phase 8.5 narrowed workspace mode to product run-fullscreen orchestration.
  Phase 9 replaced that module with `features/scene-run-mode-command.ts`, which
  returns only a disposable installer handle.
- Runtime Scene child actor ids now derive from the Scene View actor identity
  (`scene-window:view:tesseract-4`, `scene-window:view:camera-3`) instead of
  living as product installer constants.
- Fresh post-remaining-debt smoke evidence lives at
  `temp/project-prism-post-remaining-debt-smoke-data.json` and validates with
  `$env:PROJECT_PRISM_SMOKE_EVIDENCE="temp/project-prism-post-remaining-debt-smoke-data.json"; npm run test -w wallpaper-tesseract -- project-prism-smoke-evidence-file`.
  The report is `temp/project-prism-post-remaining-debt-smoke-report.md`.
- Phase 9 app-composition closure is complete:
  `docs/project-prism-phase-9-app-composition-closure-plan.md`.
- Phase 9 has deleted the remaining product installer shell
  (`features/install-wallpaper-product-features.ts`), deleted the local
  app-menu model barrel, moved actor-backed Hierarchy source ownership into the
  Tool Window owner, removed product hierarchy metadata aggregation, removed
  Tool Window actor-id/label override hooks, and replaced the old workspace
  mode module with the narrow `features/scene-run-mode-command.ts` installer.
- Boundary facts now allow `wallpaper-app`; the former app-composition,
  Scene run-mode, and Scene runtime composition blockers are closed. DCK-007 was
  fixed in the root dock frame owner: active root tab drags now continue after
  the pointer leaves the tab hit and cancel from non-tab hits. Fresh Phase 9
  smoke evidence lives at `temp/project-prism-phase-9-smoke-data.json` and
  validates with
  `$env:PROJECT_PRISM_SMOKE_EVIDENCE="temp/project-prism-phase-9-smoke-data.json"; npm run test -w wallpaper-tesseract -- project-prism-smoke-contract project-prism-smoke-evidence-file`.
  The mobile viewport portion was rerun fresh at 390x844 on the rebuilt
  Phase 9 dev server and records measurable Scene, Tesseract canvas host,
  Window menu, and Camera3 gizmo rects.
  The historical DCK-007 failure evidence remains at
  `temp/project-prism-phase-9-smoke-blocker-report.md` and
  `temp/project-prism-phase-9-smoke-blocker-data.json`.
- Phase 9 final validation passed:
  `npm run test`, `npm run typecheck`, and `npm run build`. The build keeps the
  existing Vite chunk size warning.
- Phase 10 runtime production ownership is complete:
  `docs/project-prism-phase-10-runtime-production-ownership-plan.md`.
- Phase 10 created `packages/wallpaper-runtime` as a real production runtime
  owner, moved runtime scheduler/work attachment, Camera3 motion, Tesseract4
  runtime actor/renderable ownership, runtime Scene content/frame-source/view
  registry ownership into it, deleted `apps/wallpaper-tesseract/src/runtime`,
  and removed the thin `RuntimeSceneSession` wrapper instead of preserving a
  compatibility layer.
- Scene feature component definition installation now owns only Scene
  presentation binding. Runtime Camera3/Tesseract component definitions are
  installed through `installWallpaperRuntimeComponentDefinitions` from
  `wallpaper-runtime`.
- Fresh Phase 10 smoke evidence lives at
  `temp/project-prism-phase-10-smoke-data.json` and validates with
  `$env:PROJECT_PRISM_SMOKE_EVIDENCE="temp/project-prism-phase-10-smoke-data.json"; npm run test -w wallpaper-tesseract -- project-prism-smoke-evidence-file`.
  The report is `temp/project-prism-phase-10-smoke-report.md`. The Phase 10
  closure hardening tightened mobile smoke validation so Scene, Tesseract,
  Window menu, and Camera3 gizmo rects must intersect the 390x844 viewport.
  The refreshed Phase 10 evidence satisfies that stricter validator and has no
  console errors.
- The pre-Phase 6 window-workspace truth closure is complete.
- `ui-framework` and `editor` are no longer blocked by
  `window-workspace-multi-truth-debt`.
- `packages/editor` exists and owns the former app-local editor state/adapters.
  The app-local `src/editor` directory has been deleted rather than preserved
  as a compatibility barrel.
- The former app-local `FeatureActorContext` has been deleted from
  `runtime/ports`. Actor factories now depend on `actor-system/core`'s
  `ActorCreationContext`, so feature actor creation no longer pulls editor
  extraction back through app runtime glue.
- The old app-local `state-runtime`, `update-runtime`, and production
  `src/runtime` directories have been deleted. Editor state observer binding
  now lives in `packages/editor`, UI component frame update attachment lives in
  `packages/ui-framework`, and runtime-work attachment lives in
  `packages/wallpaper-runtime`.
- Current graph progress is real: `WindowFramePort` is now shell-only,
  production placement mutation goes through graph transaction/reconcile paths,
  graph transaction DOM atomicity was hardened, and `persistable` replaced the
  old `visiblePath === null` runtime-frame inference. The first final-closure
  execution slice also made `npm run typecheck:test -w ui-framework` pass,
  deleted legacy Debug/Hierarchy full-window factories, removed root/floating
  shell placement forwarding, closed content host/attachment placement APIs
  from ui-framework and app public barrels, and deleted the production graph
  diagnostic adapter/source contract. The surface simplification slice then
  made `WindowFrameSurfaceComponent` a graph snapshot DOM realization layer,
  added explicit reconciler stale-content cleanup and active/interactable
  operations, moved surviving content registration concepts to
  `window-content-registry.ts`, deleted `window-content-host.ts`,
  `WindowDockSurfaceModel`, and `window-frame-dock-tree`, removed runtime
  dock-root source types from `window-frame-tab.ts`, and tightened boundary
  tests so those old facts cannot return.
- The pre-Phase 6 final gate added structured smoke evidence for graph snapshots, DOM
  content parentage, active/interactable parity, actor-system/input target evidence,
  persistence descriptors, and required scenario coverage. The reproducible
  validator is `$env:PROJECT_PRISM_SMOKE_EVIDENCE="temp/project-prism-phase-6-entry-smoke-data.json"; npm run test -w wallpaper-tesseract -- project-prism-smoke-evidence-file`.
- The Phase 6 extraction gate regenerated browser smoke evidence at
  `temp/project-prism-phase-6-smoke-data.json` and validated it with
  `$env:PROJECT_PRISM_SMOKE_EVIDENCE="temp/project-prism-phase-6-smoke-data.json"; npm run test -w wallpaper-tesseract -- project-prism-smoke-evidence-file`.
- Project Prism Final Gate is complete. Future work should preserve the same
  deletion-first rules: do not add compatibility wrappers or idle legacy paths;
  simplify ownership or delete obsolete paths in the subsystem where new issues
  are found.

Current pre-Phase 6 blocker from boundary facts:

- None.

## Current Source Topology

Important app source areas:

- `apps/wallpaper-tesseract/src/app`: app bootstrap and composition. This area
  now wires environment services and package/feature installers. It should stay
  thin and must not reacquire concrete Scene, Camera3, Tesseract, Debug,
  Hierarchy, Inspector, menu, actor-id, runtime-frame-adapter, or component
  definition facts.
- `apps/wallpaper-tesseract/src/actor-runtime`: app-local actor runtime
  staging/candidate code that should stay aligned with the extracted
  `actor-system/core` package.
- `apps/wallpaper-tesseract/src/window-runtime`: app-local integration and
  staging code for frames, tabs, dock, split, lifecycle, layout, and view
  identity. Generic contracts have moved or should continue moving toward
  `packages/ui-framework`. Shell placement forwarding has been removed from
  public/production reachability; keep this layer focused on presentation,
  input intent, and app composition.
- `apps/wallpaper-tesseract/src/features/window-workspace`: feature-level
  assembly for workspace policy, persistence, and app integration. It wires the
  graph-derived dock target read path and must not revive frame-local placement
  reads.
- `apps/wallpaper-tesseract/src/features/app-menu`: app-local Window/Edit menu
  descriptor mapping, App Menu Arbor subtree installation, theme-selection
  menu wiring, and type/instance based window command model. Generic menu
  behavior belongs in `packages/ui-framework`.
- `apps/wallpaper-tesseract/src/features/scene-run-mode-command.ts`:
  app-local Scene run-mode command installer. It owns workspace-mode state
  registration/subscription and editor mode -> Scene run-fullscreen
  orchestration through narrow ports, returns only a disposable, and must not
  regain direct window visible-path mutation state.
- `apps/wallpaper-tesseract/src/features/install-wallpaper-product-features.ts`
  has been deleted. `create-wallpaper-app.ts` now calls public owner installers
  directly and should stay limited to top-level dependency passing and install
  order, not feature actor ids, hierarchy metadata tables, default state
  construction, runtime Scene resources, or app-menu model internals.
- `apps/wallpaper-tesseract/src/features/scene`: Scene feature installation and
  Scene/Camera presentation binding. It composes the Arbor Scene subtree and
  bridges editor presentation to `wallpaper-runtime`; it must not regain
  runtime resource ownership, raw DOM parent handoff, or old viewport shell
  responsibilities.
- `packages/editor/src/scene`: Scene View presentation state, actor factory, and
  Scene integration components. The old `SceneViewportComponent`, mode toggle,
  DOM host, and Scene-specific viewport CSS have been deleted. It must not
  import app-local runtime wiring, Camera3 runtime owners, Tesseract runtime
  owners, or runtime render output.
- `packages/editor/src/inspector`: multi-instance Inspector pilot and view
  identity reference implementation.
- `packages/editor/src/debug`, `packages/editor/src/hierarchy`,
  `packages/editor/src/camera3`, and `packages/editor/src/tool-windows`: Debug,
  Hierarchy, Camera3 gizmo presentation, component definitions, default window
  state, and tool-window installer. `packages/editor` also owns the unified
  `installEditorComponentDefinitions` package installer.
- `packages/runtime-three/src/runtime-three-camera-motion-controller.ts` and
  `runtime-three-orbit-camera.ts`: runtime-three now owns Camera3 motion
  command execution, orbit camera state, and Three camera realization. The old
  app-local `camera3-control` directory and `runtime/camera3-runtime-camera.ts`
  are deleted.
- `apps/wallpaper-tesseract/src/gizmo-runtime`: component-side binding between
  actors and `actor-system/gizmo`.
- `packages/wallpaper-runtime/src`: production Wallpaper runtime owner. It owns
  runtime scheduler service, runtime-work attachment, runtime Scene
  content/frame-source/view registry, Camera3 motion component ownership, and
  Tesseract runtime actor/renderable ownership. It is a real implementation
  package and must not become an app-local compatibility barrel.
- `packages/editor`: extracted editor state, window-layout default paths,
  editor state adapters, Debug, Hierarchy, Inspector, and tool-window
  installer ownership. Keep it on package contracts (`actor-system/core`,
  `actor-system/input`, `runtime-core`, and `ui-framework`) and do not let it import
  app-local `runtime/ports`, `window-runtime`, `app-runtime`, or feature
  runtime owners.
- `apps/wallpaper-tesseract/src/test-support`: boundary facts, Prism maps, and
  generated-report support. Keep these honest; do not remove blockers without
  code reality changing.

## Window And Docking Baseline

The current docking baseline is actor-backed, frame/view based, and uses
type/instance view identity:

- `FrameActor` owns the outer frame or root workspace frame.
- `ViewActor` owns the content/runtime view inside a frame.
- `WindowViewIdentity` is the logical view identity. It contains a `typeKey`
  plus an opaque `instanceId`.
- `WindowViewKey` remains a runtime/compatibility key. Do not treat it as actor
  identity or long-term persistence identity.
- Actor ids are runtime ownership details. Do not persist actor ids or use them
  as view instance ids.
- The Inspector feature is the current multi-instance pilot.
- Windows support root workspace docking, floating frames, tabs, tab close, tab
  float, split dock, splitter resize, layout persistence/hydration, and Scene
  fullscreen isolation.
- `WindowWorkspaceGraph` is now the intended production placement truth for
  ordinary open, close, dock, split, float, fullscreen restore, and persistence
  snapshots.
- `WindowFramePort` is shell/presentation only. Do not add tab, tabset, content,
  active-view, or dock-root placement reads back to it.
- `WindowFrameTargetabilitySource` provides narrow shell facts for dock target
  discovery. Dock target geometry comes from graph projection plus graph-keyed
  surface geometry.
- Persistence version 2 stores logical view descriptors by `typeKey` and
  `instanceId`. Version 1 migration support is compatibility debt and must not
  shape new APIs.
- Remaining window-workspace debt: none blocking Phase 6. Confirmed dock/debug
  follow-up items, including silent dock commit failures, Debug Log semantic
  trace gaps, and dock id derivation cleanup, are tracked in
  `docs/known-defects-and-todos.md`. Future changes must preserve
  graph/DOM/input/persistence parity through the smoke contract and boundary
  tests.

## Runtime Ownership Baseline

Runtime production ownership is package-owned after Phase 10.

Accepted runtime pieces:

- `runtime-core` contains runtime ids, frame/update contracts, scheduler,
  commands, queries, worlds, cameras, projection graph, and frame source
  contracts.
- `runtime-three` contains Three camera, scene, renderer, scene render output,
  frame source, WebGL renderer, and line renderable backends.
- `wallpaper-runtime` contains product runtime implementation over
  `actor-system/core`, `runtime-core`, `runtime-three`, `four-camera`, and
  `four-rotation`: scheduler/work attachment, runtime Scene content,
  frame-source registration, runtime Scene view registry, Camera3 motion
  component definitions, Tesseract4 actor binding, and Tesseract runtime
  renderable.
- Camera3 gizmo rendering now reads runtime-derived view state instead of the
  older projection controller camera state.

Remaining runtime ownership debt:

- `SceneRuntime` / `RuntimeObject` no longer act as the generic app-local mixed
  bus. App frame orchestration now explicitly runs runtime work, UI component
  ticks, UI scheduled services, editor state flush, and render frame sources.
- `Tesseract4RuntimeObject` and the old app-local `tesseract4` directory have
  been deleted. Tesseract runtime ownership now lives in
  `packages/wallpaper-runtime/src/tesseract4`.
- `SceneViewportComponent` now hosts a structural render target and owns DOM
  placement/measurement only; it no longer renders with `THREE.Camera` or
  imports the full runtime render output.
- `RuntimeSceneViewRuntimeRegistry` renders through the runtime render output
  after current graph/view visibility checks. The old mixed Scene content
  installer and app-local runtime Scene staging have been deleted.
- Camera3 runtime camera state is now the single camera truth. The old
  `Camera3Rig` / `Camera3ProjectionModeController` model and rig component were
  deleted instead of moved into editor presentation. Camera3 gizmo presentation,
  hit testing, actor-system/input component, styles, and tests now live under
  `packages/editor/src/camera3`. Camera3 motion runtime ownership now lives
  under `packages/wallpaper-runtime`.

## Active Plans And Reports

Active package granularity plan:

```text
docs/project-canopy-package-consolidation-plan.md
```

Project Canopy is the next architecture plan after Project Arbor. It should
consolidate package granularity only where it reduces consumer complexity and
must not create compatibility re-export packages or weaken internal submodule
boundaries.

Project Prism architecture outline:

```text
docs/project-prism-engine-modularization-outline.md
```

This is the restored north-star plan. It was previously kept under `temp/`, but
now lives in `docs/` so temporary artifact cleanup cannot remove it.

Permanent defect and follow-up ledger:

```text
docs/known-defects-and-todos.md
```

Use this for confirmed defects and cleanup items that should survive `temp/`
cleanup. It currently records the Debug/Scene repeated dock investigation,
the fixed-pending-verification graph split id collision, and related non-
blocking dock/debug diagnostics debt.

Executed pre-Phase 6 surface cleanup record:

```text
temp/project-prism-pre-phase-6-surface-simplification-plan.md
```

Treat it as the executed hard preflight implementation record before Phase 6.
It replaces the older
temporary final-closure, window-workspace truth, smoke, and handoff documents
that previously lived under `temp/`; those stale working traces were removed
from the working tree on 2026-06-12.

The implementation followed the deletion-first plan: `WindowFrameSurfaceComponent`
now renders graph snapshots directly, old content host/attachment mechanics and
old dock-tree/dock-surface models are deleted, runtime dock-root source types
are gone, app-local barrels no longer re-export them, and tests now assert graph
snapshot/reconciler surface behavior instead of legacy placement methods.

Completed Phase 6 entry gate plan:

```text
temp/project-prism-pre-phase-6-final-gate-plan.md
```

Treat this as the completed final gate record. It strengthened smoke evidence
validation, added a reproducible evidence-file validator command, collected
deterministic browser evidence for graph/DOM/input/persistence parity, and
removed `window-workspace-multi-truth-debt` from boundary facts.

Final gate evidence:

```text
temp/project-prism-phase-6-entry-smoke-data.json
temp/project-prism-phase-6-entry-smoke-report.md
temp/project-prism-phase-6-entry-browser-observations.json
temp/project-prism-phase-6-entry-splitter-probe.json
```

Phase 6 entry was allowed because `window-workspace-multi-truth-debt` was
removed from boundary facts, `typecheck:test` for `ui-framework` passed, legacy
placement APIs and old placement models were deleted from public/production
reachability, and browser smoke evidence validated graph placement, DOM
placement, splitter hit targets, actor input hits, persistence, and Scene render
measurement. Treat this as historical entry evidence; Phase 6 itself is now
complete.

Completed Phase 6 editor extraction plan:

```text
temp/project-prism-phase-6-editor-extraction-plan.md
```

Treat this as the completed execution record for Phase 6 editor package
extraction. The pre-entry checkpoint is committed, the first editor-owned
state/adapters have moved into
`packages/editor`, and the feature actor creation contract has moved out of
app-local runtime ports. The Step 3 preflight binding cleanup is also complete:
state observer binding is editor-owned and UI frame update attachment is
ui-framework-owned. Debug, Hierarchy, Inspector, and the tool-window installer
have moved into `packages/editor`; their old app-local directories are
deleted. Scene presentation now lives in `packages/editor` and consumes a
structural render target instead of owning runtime render output or
`THREE.Camera` rendering. App-local `features/scene` is now runtime wiring
only. Camera3 runtime camera state is the single truth, its motion/orbit camera
owner has moved into `packages/runtime-three`, Camera3 gizmo presentation has
moved into `packages/editor`, and app composition now installs editor component
definitions through the unified editor package installer. The
final Phase 6 browser smoke evidence was regenerated as
`temp/project-prism-phase-6-smoke-data.json` and validates with the smoke
evidence-file test. The remaining hard cleanup is runtime-owner work for
app-local Scene/Camera3 viewport binding, Tesseract, and Phase 7 bootstrap
thinning.

Completed post-Phase-6 dock gate: after Phase 6 extraction, a visible
Debug/Scene repeated dock investigation found a real graph reducer bug and
dock/debug diagnostic gaps. `Step 10: Post-Phase-6 Dock Regression And
Diagnostics Gate` is now complete: split dock ids are allocated by
`WindowWorkspaceGraph`, lifecycle callers no longer pass `newTabsetId` /
`newSplitId`, `requestCommitDock` returns `WindowDockCommitResult`, tab input
exposes a narrow assertable dock evidence object, root validation passed, and
browser evidence proves the repeated two-tab Debug/Scene dock path visually
lands in the expected root layout. DCK-003 remains a watch item in the
permanent defect ledger, but it does not block the next architecture slice.
DEV-001 is closed by the explicit `npm run prism:smoke:prepare` dist-freshness
contract before browser smoke.

The plan keeps
deletion-first rules explicit: no app-local compatibility barrels, no duplicate
state or runtime ownership, no fake facades, and no package extraction step is
complete until the old app-local owner is deleted or assigned to a later
non-editor owner with a deletion condition. The existing entry smoke data is
kept only as the immutable pre-extraction baseline.

Completed Phase 7 runtime-owner/app-bootstrap execution record:

```text
docs/project-prism-phase-7-runtime-owner-app-bootstrap-plan.md
```

Treat this as the completed implementation record for Phase 7. It intentionally
did not redo editor extraction or window-workspace graph cleanup. App-local
runtime port aliases, `app-runtime`, old mixed Scene/Tesseract/Camera3 staging,
and old app-local app policy files were deleted or moved to narrower owners.
Root validation and the Phase 7 smoke evidence-file validator passed.

Completed Phase 7 closure record:

```text
temp/project-prism-phase-7-closure-plan.md
```

This closure record marked Phase 7 documents completed, reclassified remaining
app-composition and runtime-placement debt as next-phase entry scope, and
records the Git checkpoint requirements for the accepted Phase 7 work.

Completed Phase 8 runtime Scene composition and product policy split plan:

```text
docs/project-prism-phase-8-runtime-scene-composition-plan.md
```

Treat this as the completed Phase 8 execution record. Steps 0-7 are complete,
`DCK-006` was fixed, and fresh Phase 8 smoke evidence validated.

Completed Phase 8.5 remaining debt closure gate:

```text
docs/project-prism-phase-8-5-remaining-debt-closure-plan.md
```

Treat this as the completed closure record before entering any larger
post-Phase-8 phase. It incorporates reviewer decisions: Scene View actor stays
the visible actor-tree parent anchor, runtime owns runtime content ids/subtree,
Camera3 gizmo remains editor presentation, and Scene run-mode behavior remains
a narrow product command rather than a placement or runtime-resource owner.

Completed Phase 9 app-composition closure plan:

```text
docs/project-prism-phase-9-app-composition-closure-plan.md
```

Treat this as the completed execution record. Code cleanup Steps 0-6 are
implemented, Step 7A closed DCK-007 through
`docs/project-prism-phase-9-dck-007-blocker-resolution-plan.md`, and fresh Phase
9 smoke evidence validates from `temp/project-prism-phase-9-smoke-data.json`.

Completed Phase 10 runtime production ownership plan:

```text
docs/project-prism-phase-10-runtime-production-ownership-plan.md
```

Treat this as the completed Phase 10 execution record. It moved the remaining
app-local production runtime staging into `packages/wallpaper-runtime`, deleted
`apps/wallpaper-tesseract/src/runtime`, removed the thin `RuntimeSceneSession`
wrapper, kept `runtime-core` renderer-agnostic and `runtime-three`
backend-only, split Scene presentation component definitions from runtime
Camera3/Tesseract definitions, and validated fresh Phase 10 browser smoke from
`temp/project-prism-phase-10-smoke-data.json`.

Completed Project Prism final gate closure plan:

```text
docs/project-prism-final-gate-closure-plan.md
```

Treat this as the completed Project Prism closeout record. It closed `DEV-001`
with `npm run prism:smoke:prepare`, deleted layout schema version 1 migration
support, tightened `wallpaper-runtime` public API boundaries, cleaned historical
temp run traces, and validated fresh Final Gate browser smoke from
`temp/project-prism-final-gate-smoke-data.json`.

Older window/docking/view-identity plans are now Git history, not active files
in `temp/`. Recover historical context from Git when needed, then compare it
against current implementation and boundary facts before acting on it.

## Verification Commands

Root-level checks:

```text
npm run test
npm run typecheck
npm run build
```

Main app checks:

```text
npm run test -w wallpaper-tesseract
npm run typecheck -w wallpaper-tesseract
npm run build -w wallpaper-tesseract
```

Shared package checks:

```text
npm run test -w actor-system
npm run test -w foundation
npm run typecheck -w foundation
npm run build -w foundation
npm run test -w ui-framework
npm run typecheck:test -w ui-framework
npm run test -w editor
npm run typecheck -w editor
npm run build -w editor
npm run test -w runtime-core
npm run test -w runtime-three
npm run test -w four-rotation
npm run test -w four-camera
npm run test -w four-camera-three
```

Useful Project Prism targeted checks:

```text
npm run test -w wallpaper-tesseract -- architecture-boundaries project-prism-boundary-report project-prism-state-domain-map project-prism-frame-update-lane-map
npm run test -w runtime-core
npm run test -w runtime-three
npm run typecheck -w wallpaper-tesseract
$env:PROJECT_PRISM_SMOKE_EVIDENCE="temp/project-prism-final-gate-smoke-data.json"; npm run test -w wallpaper-tesseract -- project-prism-smoke-evidence-file
```

Useful window/docking/view-identity checks:

```text
npm run test -w wallpaper-tesseract -- architecture-boundaries window-view-identity window-view-factory-registry window-frame-lifecycle-controller window-frame-lifecycle window-frame-tab-chrome floating-window-component workspace-root-dock-frame-component window-dock-targets window-dock-preview-component window-workspace-layout window-workspace-layout-persistence window-workspace-layout-persistence-controller app-menu
npm run test -w ui-framework -- window-workspace-graph window-workspace-graph-reconciler window-frame-lifecycle-controller dock-target-region-source window-frame-targetability-source window-frame-surface-component
npm run typecheck:test -w ui-framework
npm run typecheck -w wallpaper-tesseract
npm run build -w wallpaper-tesseract
```

Useful runtime ownership checks during Phase 7:

```text
npm run test -w actor-system
npm run test -w wallpaper-tesseract -- runtime-scene-session runtime-work-attachment-runtime camera3-components tesseract4 install-scene-view-feature component-definitions scene-run-mode-command architecture-boundaries project-prism-boundary-report project-prism-state-domain-map project-prism-frame-update-lane-map
npm run test -w runtime-core
npm run test -w runtime-three
npm run typecheck -w wallpaper-tesseract
$env:PROJECT_PRISM_SMOKE_EVIDENCE="temp/project-prism-phase-7-smoke-data.json"; npm run test -w wallpaper-tesseract -- project-prism-smoke-evidence-file
```

## Browser Verification Matrix

For UI/input/window/runtime-render changes, run the Vite dev server:

```text
npm run prism:smoke:prepare
npm run dev -w wallpaper-tesseract
```

Then verify at least:

- Root workspace Scene is visible and keeps usable height when toolbar or
  status areas are hidden.
- Debug, Hierarchy, Inspector, and Scene can be opened or focused through the
  app menu.
- Multi-instance commands create/focus distinct Inspector instances without
  confusing type identity and instance identity.
- Debug window titlebar drag moves the window.
- Debug window resize changes size.
- Window focus-to-front works for overlapping windows.
- Root/floating tab close closes only the selected view and leaves other views
  and frame ownership consistent.
- Mixed frame close can be recovered through the Window menu.
- Hierarchy row click selects the row/object.
- Content blank clicks do not drag windows or select rows.
- Overlapping windows route input to the higher z-index window.
- Scene docked in a mixed tab frame can fullscreen into a Scene-only
  runtime-only frame, hide the source mixed frame, and restore.
- Scene docked in a split frame can fullscreen/restore without persisting the
  runtime-only fullscreen frame.
- A third tab can dock into every visible tabset/pane region, including root
  workspace regions and floating frame regions.
- Root/floating drag and dock cycles work in both directions.
- Merge/split layout survives reload using version 2 type/instance
  persistence.
- Legacy layout schema version 1 is rejected by the current persistence parser.
  The `.v1` suffix in the localStorage key is retained only as a storage
  namespace, not as schema compatibility.
- Camera3 drag updates camera behavior and gizmo display.
- Camera3 double-click snap still works.
- Projection toggle updates the gizmo label/view state.
- Tesseract remains visible.
- Scene close/reopen leaves no stale canvas, observer, or renderer.
- For render ownership changes, loop Scene close/reopen 10 times and root/
  floating dock/undock 10 times.
- Mobile-sized viewport still has usable controls without text overlap.
- Console errors are 0.

For Phase 5.5 render ownership work, smoke data should record frame source id,
Scene View actor id, renderer/backend id or equivalent runtime output id,
canvas/overlay rects, actor-system/input hit for Camera3 interactions, projection mode
before/after, and camera state before/after.

For the completed pre-Phase 6 window-workspace gate, final browser smoke records
graph frame/tabset/content ids, each `contentId`'s single DOM parent, splitter
hit regions mapped to graph split ids, active tab/content parity with graph
projection, persisted layout without actor ids, and console errors. The
evidence-file validator command above is the reproducible gate for that data.

## Progress Document Maintenance

Update this file when:

- a workspace package is added, removed, extracted, or accepted;
- Project Prism phase status changes;
- an active plan changes;
- boundary facts add or remove blockers;
- the source topology or ownership map changes;
- verification commands or browser smoke requirements change.

Keep `AGENTS.md` focused on stable rules.
