# AGENTS.md

This file is the handoff guide for agents working in this repository. Read it
before making changes, especially when continuing Project Prism, architecture
simplification, window/docking, view identity, scene/runtime, gizmo, or actor
input routing work.

## Project Shape

This is a TypeScript npm workspace for a Wallpaper Engine tesseract demo and
supporting 4D/gizmo libraries.

Workspace packages that exist today:

- `packages/four-rotation`: 4D rotation math.
- `packages/four-camera`: 4D camera/projection model.
- `packages/four-camera-three`: Three.js bridge for the 4D camera stack.
- `packages/gizmo-core`: framework-agnostic pointer/gizmo event system.
- `apps/wallpaper-tesseract`: Vite + Three.js Wallpaper Engine app.

Project Prism is the next architecture direction. The target packages described
by Prism, such as `actor-core`, reusable UI/window framework, runtime, and
editor packages, are not extracted yet unless the codebase shows otherwise.
Treat the current `apps/wallpaper-tesseract/src/*` folders as the staging area
for that split.

Important app source areas:

- `apps/wallpaper-tesseract/src/app`: app bootstrap and composition. This layer
  should wire feature installers and runtime services, not own renderer,
  window-policy, or feature internals.
- `apps/wallpaper-tesseract/src/actor-runtime`: current actor/component runtime
  and the future seed of Prism `actor-core`.
- `apps/wallpaper-tesseract/src/app-runtime`: app-level runtime context and
  remaining bridge services. Do not add new legacy registration paths here.
- `apps/wallpaper-tesseract/src/window-runtime`: reusable frame, tab, dock,
  split, lifecycle, layout, and view identity infrastructure. This is the seed
  of a product-agnostic UI/window framework.
- `apps/wallpaper-tesseract/src/features/window-workspace`: feature-level
  assembly for window workspace policy, persistence, and app integration.
- `apps/wallpaper-tesseract/src/features/app-menu`: app menu actor, component,
  and type/instance based window command model.
- `apps/wallpaper-tesseract/src/features/scene`: Scene feature installation and
  renderable view ownership.
- `apps/wallpaper-tesseract/src/features/inspector`: multi-instance Inspector
  pilot and view identity reference implementation.
- `apps/wallpaper-tesseract/src/features/tool-windows`: Debug and Hierarchy
  feature assembly.
- `apps/wallpaper-tesseract/src/features/camera3`: Camera3 feature components.
- `apps/wallpaper-tesseract/src/gizmo-runtime`: component-side binding between
  actors and `gizmo-core`.
- `apps/wallpaper-tesseract/src/scene-runtime`: scene state, frame clock,
  commands, and remaining runtime/editor boundaries that Project Prism should
  clarify.
- `apps/wallpaper-tesseract/src/runtime`: runtime-facing helpers that should
  move toward the Prism runtime package.
- `apps/wallpaper-tesseract/src/tesseract4`: tesseract actor/component code.
- `apps/wallpaper-tesseract/src/debug`,
  `apps/wallpaper-tesseract/src/hierarchy`,
  `apps/wallpaper-tesseract/src/gizmos/camera3`,
  `apps/wallpaper-tesseract/src/camera3-control`, and
  `apps/wallpaper-tesseract/src/state-runtime`: older or lower-level locations
  still present in the implementation. Do not treat their current placement as
  the Prism target; prefer feature installers and the boundaries above when
  moving code.

## Current Architecture Direction

The project is past the original Phase B component-system migration and is now
in architecture simplification plus Project Prism preparation. New work should
make the implementation more like the Prism target rather than adding
compatibility around older plans.

The current implementation still centers on:

```text
App bootstrap
  -> ActorSystem
  -> ComponentRegistry
  -> ComponentRuntimeBridge
  -> binding components
  -> feature/business components
```

Project Prism's long-term direction is:

```text
actor-core -> ui-framework -> editor/app composition
actor-core -> runtime      -> editor/app composition
packages/four-* -> runtime
```

Move code toward these boundaries:

- `actor-core` is minimal and framework-agnostic: actor system, actor tree,
  component definitions, component registry, lifecycle, parent/effective active
  state, and generic ports only. No DOM, Three.js, gizmo-core, scene-runtime,
  window-runtime, or app-runtime dependencies.
- UI/window framework code is product-agnostic: app shell, window frame, root
  workspace frame, tabs, docking, splitters, layout persistence, pointer
  surfaces, and frame lifecycle. It must not know about Scene rendering,
  Tesseract, Camera3, Debug Log contents, Inspector contents, or Hierarchy
  business data.
- Runtime/rendering code is editor-agnostic: worlds, projection graph,
  cameras, render/update orchestration, and scene commands. It must not import
  editor features, debug/inspector/hierarchy/menu/window/dock UI, or app
  composition.
- Editor/features own presentation and commands. They may compose runtime and
  UI framework ports, but should not become hidden owners of runtime resources.
- App composition is thin. It installs features, passes dependencies, and wires
  top-level ports; it should not directly create renderer internals, frame
  policies, Scene view runtimes, or feature actors.

Current architecture rules:

- New actor-backed features should use `ActorSystem` and `ComponentRegistry`.
- Component dependencies belong in `ComponentDefinition.requires`.
- External runtime registration belongs in binding components and
  `ComponentRuntimeBridge`, not in business components.
- Component mutation must go through `ComponentRegistry`.
- Do not import `ActorImpl` outside `actor-runtime`.
- Do not expose actor component arrays.
- State updates should go through explicit command or model ports, not direct
  DOM/event mutation.
- Pointer-driven selection should stay on the actor input/gizmo path, not DOM
  click mutation.

There is an architecture boundary test at:

```text
apps/wallpaper-tesseract/src/architecture-boundaries.test.ts
```

Update it whenever a newly clarified architecture rule should stay true.

## Architecture Integrity During Refactors

Project Prism intentionally favors a clean, coherent design over preserving
transitional code. When a refactor reveals that an old compatibility layer,
duplicate fact source, or patchy workaround conflicts with the intended
architecture, prefer a direct cleanup over another adapter.

Use these rules during architecture work:

- Treat the actor tree -> component composition model as the source of truth.
  Do not create parallel ownership, lifecycle, active-state, or identity
  channels to avoid changing the actor/component path.
- Keep each reusable fact in one owner. If view identity, frame ownership,
  scene runtime location, menu state, docking targets, or persistence data can
  be derived from several places, choose one authoritative model and delete or
  collapse the others.
- Treat legacy compatibility as temporary debt, not a design constraint. New
  code must not depend on compatibility aliases, migration-only APIs, or old
  registration helpers unless the active plan explicitly allows a short-lived
  bridge.
- Remove hacks and patches once their underlying contract is clear. Avoid
  preserving special cases simply because tests currently cover them.
- Let refactors expose broken assumptions. Do not hide architecture problems
  behind defensive fallback paths if the intended model can make the failure
  explicit and testable.
- Prefer bold, internally consistent changes over local edits that leave the
  subsystem harder to reason about. Scope discipline still matters: change the
  subsystem needed for the architecture goal, but finish the ownership cleanup
  inside that subsystem.
- Strengthen `architecture-boundaries.test.ts` when a rule graduates from
  review opinion to project invariant.

## Window, Docking, And View Identity Baseline

The current docking baseline is actor-backed, frame/view based, and moving from
singleton view keys to explicit type/instance identity:

- `FrameActor` owns the outer frame or root workspace frame.
- `ViewActor` owns the content/runtime view inside a frame.
- `WindowViewIdentity` is the logical view identity. It contains a `typeKey`
  plus an opaque `instanceId`.
- `WindowViewKey` remains a runtime/compatibility key. Do not treat it as actor
  identity or as the long-term persistence identity.
- Actor ids are runtime ownership details. Do not persist actor ids or use them
  as view instance ids.
- The Inspector feature is the current multi-instance pilot. Use it as a
  reference when extending type/instance behavior.
- Windows support root workspace docking, floating frames, tabs, tab close, tab
  float, split dock, splitter resize, layout persistence/hydration, and Scene
  fullscreen isolation.

Preserve these standards:

- Lifecycle mutations have one owner. Creating, destroying, reparenting,
  docking, floating, closing, focusing, and fullscreen-isolating views should
  go through `WindowFrameLifecycleController` or a narrow port owned by it.
- Frame components emit lifecycle intent. They should not mutate the actor tree,
  rehost content, or destroy actors directly.
- Per-view close uses the view-level lifecycle contract. Do not implement tab
  close by reusing whole-frame disposal.
- Frame state has two kinds. Persistent frames own visible scene paths and may
  be serialized. Runtime-only frames have `visiblePath === null`, are not menu
  windows, and must never be serialized.
- Persistence version 2 stores logical view descriptors by `typeKey` and
  `instanceId`. Version 1 migration support is compatibility debt and must not
  shape new APIs.
- Dock targets are tabset regions, not whole frames. Prefer
  `WindowDockTargetRegion`, `DockTargetRegionSource`, and
  `listDockTargetRegions()`. Old frame-level target names are compatibility
  aliases only.
- Root workspace and floating frames should share the same surface/view
  contracts where practical. Avoid shell-only frame state that duplicates
  window-runtime ownership.
- Window menu entries are type/instance commands: open or focus by type, create
  new instance where allowed, and focus a specific instance. Do not reintroduce
  checkbox-style close toggles for ordinary dockable windows.
- Scene runtime resources follow the live Scene view location. Scene fullscreen
  is a presentation of the Scene view, not a persistent mutation of a mixed
  owner frame.
- Inactive tabs and hidden split panes must not be actor-input interactable.
  Frame stack priority controls cross-window priority; tab-local logic only
  chooses local route/hit behavior.

Relevant files:

```text
apps/wallpaper-tesseract/src/window-runtime/
apps/wallpaper-tesseract/src/features/window-workspace/
apps/wallpaper-tesseract/src/features/app-menu/
apps/wallpaper-tesseract/src/features/inspector/
```

## Actor Input And UI Interaction

Actor input is the expected path for interactive UI and gizmo behavior.

Keep these constraints:

- Identify input participants with the actor input participant contract rather
  than ad hoc DOM listeners.
- Keep `stackPriority` separate from actor-local `routeScore`.
- `GizmoEventBindingComponent.priority` should preserve cross-actor/window
  stack priority semantics.
- Binding `GizmoHit.priority` may carry actor-local route score.
- If a component implements both a new actor input participant path and a
  legacy responder path, the new participant path wins.
- Preserve click and double-click behavior when refactoring routing.
- Active interactions must cancel if any component in the active path is
  detached or disabled.
- Hierarchy selection, menu activation, tab actions, docking, and gizmo
  interactions should route through actor input or narrow intent ports, not
  through direct DOM mutation shortcuts.
- `gizmo-core` must remain framework-agnostic. Runtime/rendering code must not
  depend on editor UI input details.

Older actor-input plans remain useful context, but they are not automatically
authoritative once implementation has moved on.

## Component Definition Installation

Component definitions are installed in grouped functions:

```text
apps/wallpaper-tesseract/src/component-definitions.ts
```

Keep definition groups aligned with ownership:

- Core/binding definitions should stay limited to broadly reusable actor and
  runtime bridge behavior.
- Window definitions belong with window/runtime installation, not core.
- Feature definitions such as app menu, scene, Camera3, Debug, Hierarchy,
  Inspector, and Tesseract should stay in feature-specific installers or
  grouped feature installation functions.
- Do not put product-specific feature definitions into the future actor-core or
  reusable UI/window layer.

## Testing Commands

Prefer targeted checks while iterating:

```text
npm run test -w wallpaper-tesseract
npm run typecheck -w wallpaper-tesseract
npm run build -w wallpaper-tesseract
```

Root-level checks:

```text
npm run test
npm run typecheck
npm run build
```

The root test/typecheck/build scripts build dependent packages in order. Use
them before broad handoff or when changes touch shared packages.

For narrow package work:

```text
npm run test -w gizmo-core
npm run test -w four-rotation
npm run test -w four-camera
npm run test -w four-camera-three
```

For window/docking/view-identity/persistence changes, useful targeted checks
include:

```text
npm run test -w wallpaper-tesseract -- architecture-boundaries window-view-identity window-view-factory-registry window-frame-lifecycle-controller window-frame-lifecycle window-frame-tab-chrome floating-window-component workspace-root-dock-frame-component window-dock-targets window-dock-preview-component window-workspace-layout window-workspace-layout-persistence window-workspace-layout-persistence-controller app-menu
npm run typecheck -w wallpaper-tesseract
npm run build -w wallpaper-tesseract
```

When Project Prism packages are extracted, add package-level checks for the new
`actor-core`, UI/window framework, runtime, and editor packages here and in the
root scripts.

## Browser Verification

For UI/input/window changes, unit tests are not enough. Run the Vite dev server:

```text
npm run dev -w wallpaper-tesseract
```

Then verify at least:

- Root workspace Scene is visible and keeps its usable height when toolbar or
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
- Legacy version 1 layout migration still hydrates until the active plan removes
  it.
- Camera3 drag and double-click still work after docking/fullscreen restore.
- Tesseract remains visible and console errors are 0.
- Mobile-sized viewport still has usable controls without text overlap.

Store temporary screenshots or DOM dumps under `temp/` when useful.

## Coding Guidelines

- Follow the existing TypeScript style.
- Keep changes scoped to the requested subsystem.
- Prefer local helpers and current patterns when they support the target
  architecture.
- Add abstractions when they clarify ownership, remove real duplication, or
  move code toward Project Prism boundaries.
- Do not preserve a local pattern just because it is old if it conflicts with
  actor tree -> component composition or Prism package boundaries.
- Keep comments sparse and useful.
- Do not rewrite unrelated code during architecture work.
- Preserve user changes in the dirty worktree.
- Use tests to lock behavior before risky refactors.

## Plans And Temp Docs

The `temp/` directory contains architecture plans, implementation steps, review
notes, smoke artifacts, and logs. Treat these as project memory, but do not
treat old plans as automatically authoritative when code has moved on.

Read the relevant plan before implementing a subsystem. Current high-signal
documents include:

```text
temp/project-prism-engine-modularization-outline.md
temp/architecture-simplification-refactor-plan.md
temp/architecture-simplification-step4-amendment.md
temp/window-view-instance-identity-continuation-plan.md
temp/window-view-instance-step0-baseline.md
temp/window-view-instance-step7-smoke-report.md
temp/window-persistence-gap-smoke-report.md
temp/window-docking-remaining-work-plan.md
temp/workspace-root-dock-development-plan.md
temp/workspace-root-dock-smoke-report.md
```

For Project Prism work, treat
`temp/project-prism-engine-modularization-outline.md` as the architecture north
star. For active view identity work, treat
`temp/window-view-instance-identity-continuation-plan.md` and the latest step
reports as the current implementation context. Keep older docking/window plans
as historical context and regression references, not as automatic
implementation instructions.

Always compare plans against the current implementation before editing.

## Git And Worktree Notes

This repository may be intentionally dirty. Do not revert unrelated changes.
Before editing a file, understand whether existing changes in that file are part
of the user's work. If unrelated files are dirty, leave them alone.

Do not use destructive git commands such as `git reset --hard` or checkout-based
reverts unless the user explicitly asks for that exact operation.
