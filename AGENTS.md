# AGENTS.md

This file is the handoff guide for agents working in this repository.
Read it before making changes, especially when continuing component-system,
window/docking, scene view, gizmo, or actor input routing work.

## Project Shape

This is a TypeScript npm workspace for a Wallpaper Engine tesseract demo and
supporting 4D/gizmo libraries.

Workspace packages:

- `packages/four-rotation`: 4D rotation math.
- `packages/four-camera`: 4D camera/projection model.
- `packages/four-camera-three`: Three.js bridge for the 4D camera stack.
- `packages/gizmo-core`: framework-agnostic pointer/gizmo event system.
- `apps/wallpaper-tesseract`: Vite + Three.js Wallpaper Engine app.

Important app source areas:

- `apps/wallpaper-tesseract/src/app`: app composition, workspace mode,
  render loop, scene view runtime wiring.
- `apps/wallpaper-tesseract/src/actor-runtime`: actor/component runtime,
  component registry, lifecycle, runtime bridge.
- `apps/wallpaper-tesseract/src/app-runtime`: app-level runtime context and
  transitional legacy registration helpers.
- `apps/wallpaper-tesseract/src/features/app-menu`: app menu actor,
  component, and view/menu source models.
- `apps/wallpaper-tesseract/src/features/scene`: scene window actor and
  scene viewport component.
- `apps/wallpaper-tesseract/src/gizmo-runtime`: component-side binding between
  actors and `gizmo-core`.
- `apps/wallpaper-tesseract/src/window-runtime`: reusable floating window
  component and window state registration.
- `apps/wallpaper-tesseract/src/debug`: debug log content/window actor.
- `apps/wallpaper-tesseract/src/hierarchy`: hierarchy panel content/window
  actor.
- `apps/wallpaper-tesseract/src/gizmos/camera3`: Camera3 gizmo actor/component.
- `apps/wallpaper-tesseract/src/scene-runtime`: scene parameter store, frame
  clock, command sink.
- `apps/wallpaper-tesseract/src/tesseract4`: tesseract actor/component.

## Current Architecture Direction

The project is in a Phase B component-system refactor. New functionality should
prefer actors plus components over directly registered runtime objects.

The intended shape is:

```text
AppRuntimeContext
  -> ActorSystem
  -> ComponentRegistry
  -> ComponentRuntimeBridge
  -> binding components
  -> business components
```

Keep these boundaries:

- New actor-backed features should use `ActorSystem` and `ComponentRegistry`.
- Do not directly call legacy app registration helpers for new code.
- Component dependencies belong in `ComponentDefinition.requires`.
- External runtime registration belongs in binding components and
  `ComponentRuntimeBridge`, not in business components.
- Component mutation must go through `ComponentRegistry`.
- Do not import `ActorImpl` outside `actor-runtime`.
- Do not expose actor component arrays.
- State updates should go through `SceneCommandSink` / scene commands.
- Pointer-driven selection should stay on the gizmo/input path, not DOM click
  mutation.

There is an architecture boundary test at:

```text
apps/wallpaper-tesseract/src/architecture-boundaries.test.ts
```

Update it when adding a new architecture rule.

## Floating Window State

Floating windows are componentized.

Current expected pattern:

```text
window actor
  FloatingWindowComponent
  content component
```

Use this pattern for new windows before introducing any window manager.

Important constraints:

- `FloatingWindowComponent` is an actor-scope singleton.
- Content components should depend on `FloatingWindowComponent`.
- Content should use `FloatingWindowHost`.
- Do not expose or depend on the floating window root DOM.
- Window priority currently drives both input priority and DOM z-index.
- Multiple windows are separate actors.
- Do not introduce a broad `WindowManager` by default. Current window behavior
  is owned by narrow runtime services and the frame lifecycle controller.

Relevant files:

```text
apps/wallpaper-tesseract/src/window-runtime/
apps/wallpaper-tesseract/src/debug/components/
apps/wallpaper-tesseract/src/hierarchy/
temp/floating-window-window-manager-review.md
```

## Window, Docking, And Fullscreen Baseline

The current docking baseline is actor-backed and frame/view based:

- `FrameActor` owns the outer floating frame.
- `ViewActor` owns the content/runtime view inside a frame.
- Scene, Debug, and Hierarchy are singleton `WindowViewKey` views for now.
- Windows support tab merge, tab float, split dock, splitter resize, layout
  persistence/hydration, and Scene fullscreen isolation.

Preserve these standards:

- Lifecycle mutations have one owner. Creating, destroying, reparenting,
  docking, floating, closing, and fullscreen-isolating views should go through
  `WindowFrameLifecycleController` or a narrow port owned by it.
- Frame components emit lifecycle intent. They should not mutate the actor tree,
  rehost content, or destroy actors directly.
- View identity is not actor identity. Keep `WindowViewKey` as the current
  singleton identity; future multi-instance work needs a separate instance id
  instead of overloading actor ids.
- Frame state has two kinds. Persistent frames own scene parameter paths and may
  be serialized. Runtime-only frames have `visiblePath === null`, are not menu
  windows, and must never be serialized.
- Dock targets are tabset regions, not whole frames. Prefer
  `WindowDockTargetRegion`, `DockTargetRegionSource`, and
  `listDockTargetRegions()`. Old `Frame` target names are compatibility aliases
  only.
- Window menu entries for ordinary dockable windows are open/focus commands, not
  close toggles or checkboxes.
- Scene runtime resources follow the live Scene view location. Scene fullscreen
  is a presentation of the Scene view, not a persistent mutation of a mixed
  owner frame.
- Inactive tabs and hidden split panes must not be actor-input interactable.
  Frame stack priority controls cross-window priority; tab-local logic only
  chooses local route/hit behavior.
- The outer frame close button closes the whole frame. Per-tab close is future
  work and should be routed through lifecycle intent when introduced.

For ongoing docking work, use this plan as the current source of truth:

```text
temp/window-docking-continuation-development-plan.md
```

## Actor Input Router Work

The next planned input refactor is documented here:

```text
temp/actor-input-router-refactor-plan.md
temp/actor-input-router-implementation-steps.md
```

Follow the implementation steps document when doing that work.

Key constraints for the first implementation round:

- Implement target routing only.
- Do not implement wheel routing, scrollbar routing, capture, bubble, or
  disposition yet.
- Do not extend the closed `ComponentCapability` union for actor input in the
  first round.
- Identify new input participants with `isActorInputParticipant()`.
- Keep `stackPriority` separate from actor-local `routeScore`.
- `GizmoEventBindingComponent.priority` should preserve cross-actor/window
  stack priority semantics.
- Binding `GizmoHit.priority` may carry the actor-local route score.
- Legacy `GizmoResponder` support should be adapter-based.
- If a component implements both the new participant interface and legacy
  `GizmoResponder`, the new participant path wins.
- Preserve click and double-click behavior.
- Active interactions must cancel if any component in the active path is
  detached or disabled.

## Component Definition Installation

Component definitions are installed in grouped functions:

```text
apps/wallpaper-tesseract/src/component-definitions.ts
```

Current groups include:

- core bindings
- window
- camera3
- debug
- hierarchy
- tesseract4

Do not put window or hierarchy definitions into the core installer. Core should
stay limited to broadly required binding definitions.

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

For window/docking/fullscreen/persistence changes, useful targeted checks
include:

```text
npm run test -w wallpaper-tesseract -- workspace-mode window-frame-lifecycle-controller floating-window-component window-dock-targets dock-target-frame-source window-dock-preview-component window-workspace-layout window-workspace-layout-persistence window-workspace-layout-persistence-controller scene-view-runtime
npm run typecheck -w wallpaper-tesseract
npm run build -w wallpaper-tesseract
```

## Browser Verification

For UI/input/window changes, unit tests are not enough. Run the Vite dev server:

```text
npm run dev -w wallpaper-tesseract
```

Then verify at least:

- Debug window titlebar drag moves the window.
- Debug window resize changes size.
- Window focus-to-front works for overlapping windows.
- App Menu opens/focuses existing ordinary windows and recreates missing
  singleton windows.
- Mixed frame close can be recovered through the Window menu.
- Hierarchy row click selects the row/object.
- Content blank clicks do not drag windows or select rows.
- Overlapping windows route input to the higher z-index window.
- Scene docked in a mixed tab frame can fullscreen into a Scene-only
  runtime-only frame, hide the source mixed frame, and restore.
- Scene docked in a split frame can fullscreen/restore without persisting the
  runtime-only fullscreen frame.
- A third tab can dock into every visible tabset/pane region.
- Merge/split layout survives a page reload.
- Camera3 drag and double-click still work after docking/fullscreen restore.
- Tesseract remains visible and console errors are 0.
- Mobile-sized viewport still has usable controls without text overlap.

Store temporary screenshots or DOM dumps under `temp/` when useful.

## Coding Guidelines

- Follow the existing TypeScript style.
- Keep changes scoped to the requested subsystem.
- Prefer local helpers and current patterns over new abstractions.
- Add abstractions only when they remove real duplication or clarify a shared
  contract.
- Keep comments sparse and useful.
- Do not rewrite unrelated code during architecture work.
- Preserve user changes in the dirty worktree.
- Use tests to lock behavior before risky refactors.

## Plans And Temp Docs

The `temp/` directory contains architecture plans, implementation steps, review
notes, smoke artifacts, and logs. Treat these as project memory.

Read the relevant plan before implementing a subsystem. Current high-signal
documents include:

```text
temp/phase-b-component-system-refactor-plan.md
temp/phase-b-component-system-implementation-steps.md
temp/phase-b-component-system-step-21-review.md
temp/floating-window-component-refactor-plan.md
temp/floating-window-component-implementation-steps.md
temp/floating-window-window-manager-review.md
temp/window-docking-continuation-development-plan.md
temp/window-layout-persistence-smoke-report.md
temp/window-docking-fullscreen-bugfix-smoke-report.md
temp/actor-input-router-refactor-plan.md
temp/actor-input-router-implementation-steps.md
```

For docking/window work, treat
`temp/window-docking-continuation-development-plan.md` as superseding the
future-facing parts of older window docking plans. Keep older plans as context
and regression references, not as automatic implementation instructions.

Do not treat older plans as automatically authoritative when code has moved on.
Always compare plans against the current implementation.

## Git And Worktree Notes

This repository may be intentionally dirty. Do not revert unrelated changes.
Before editing a file, understand whether existing changes in that file are part
of the user's work. If unrelated files are dirty, leave them alone.

Do not use destructive git commands such as `git reset --hard` or checkout-based
reverts unless the user explicitly asks for that exact operation.
