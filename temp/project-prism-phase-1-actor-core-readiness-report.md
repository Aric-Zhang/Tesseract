# Project Prism Phase 1F Actor-Core Readiness Report

Date: 2026-06-08

## Decision

Actor-core and actor-input package extraction are not ready.

The blocker is now narrow and intentional: actor-runtime no longer owns domain
attachment bridge facts, but it still contains app-local update lifecycle,
focus/context service, and component definition installation seams that would
be wrong to freeze into a reusable package.

Phase 2 may begin only by resolving these blockers. It should not start by
moving current actor-runtime files into `packages/actor-core`.

## Current Clean Actor-Core Candidate

The current clean candidate remains small:

```text
apps/wallpaper-tesseract/src/actor-runtime/actor.ts
apps/wallpaper-tesseract/src/actor-runtime/component-attachment-runtime.ts
```

These files are UI-free, scene-free, and domain-attachment-free.

## Remaining Blockers

### 1. Update Lifecycle Ownership

Current facts:

- `Component.updateFrame(frame: UpdateFrame)` is defined in
  `actor-runtime/component.ts`.
- `ActorSystem` still implements `RuntimeObject`.
- Both facts import `UpdateFrame` / `RuntimeObject` from
  `runtime/ports/update-frame.ts`.

Decision:

`actor-core` should not depend on `runtime/ports`. Either actor-core owns a
minimal generic update lifecycle contract directly, or the update/update-frame
behavior moves outside actor-core into an actor scheduler/update adapter.

Preferred Phase 2 direction:

Remove frame update from the actor-core primitive boundary. Keep actor identity,
tree, enabled state, and component attachment primitives in actor-core; move
frame-updatable behavior behind a package-owned actor update runtime or adapter.

Acceptance for resolving this blocker:

- `actor-runtime` files marked as actor-core candidates do not import
  `runtime/ports`.
- `ActorSystem` package boundary does not implement an app-local
  `RuntimeObject` contract.
- Components that need frame updates receive that capability through an update
  runtime owned outside actor-core, or actor-core explicitly owns the minimal
  update contract with no dependency on app runtime ports.

### 2. Actor Window Focus Service Ownership

Current facts:

- `ActorWindowFocusService` still lives in `actor-runtime/component.ts`.
- `BusinessComponentContext.services.actorWindowFocus` exposes focus and stack
  priority behavior to components.

Decision:

Window focus is not actor-core. It is presentation/input coordination and
belongs to actor-input or ui-framework ownership, supplied as an explicit
service to the features that need it.

Acceptance for resolving this blocker:

- actor-core does not define `ActorWindowFocusService`.
- focus-to-front and stack-priority projection are supplied by an
  actor-input/ui-framework service port outside actor-core.
- boundary tests prevent actor-core from re-importing window focus facts.

### 3. State Observer Binding Ownership

Current facts:

- State observer attachment runtime is now outside actor-runtime.
- `state-runtime` still adapts app-local scene state observer facts.

Decision:

State observer binding is outside actor-core. It should remain a staged state
split blocker until UI layout state, editor state, and runtime state are
separated.

Acceptance for resolving this blocker:

- actor-core does not import state-runtime.
- generic UI framework state observers use UI-owned layout state ports.
- runtime/editor state observers use their own package-owned ports.

### 4. Component Definition Installation Ownership

Current facts:

- `component-definitions.ts` remains a central app-level installer.
- Package-owned component definitions are not yet the only installation path.

Decision:

Central definition installation blocks actor-core and ui-framework extraction
because it keeps app composition as the owner of package behavior.

Acceptance for resolving this blocker:

- reusable packages export their own definition installers.
- app composition imports package installers, not individual component
  definition details.
- actor-core extraction does not depend on a central app installer.

## Not Blockers Anymore

The following old reasons should not be used to block actor-core extraction
again:

- `ComponentRuntimeBridge` in actor-runtime;
- `ComponentCapability`;
- `ComponentDefinition.capabilities`;
- legacy `"gizmo"` / `"state-observer"` capability strings;
- `SceneCommandSink` inside `BusinessComponentContext`;
- structural probing for `cancelActiveInput()`.

Those paths have been removed or replaced with explicit domain-owned
attachments.

## Phase 2 First Step

Recommended first Phase 2 step:

```text
Phase 2A: Actor lifecycle/update ownership split
```

Goal:

Remove app-local update lifecycle contracts from the actor-core candidate before
any file movement.

Concrete work:

1. Decide whether `Component.updateFrame` is actor-core API or an update
   runtime attachment.
2. If it is not actor-core API, move update participation into an explicit
   update attachment/runtime.
3. Remove `ActorSystem implements RuntimeObject` from the actor-core boundary;
   keep app scheduling in an app/runtime adapter.
4. Update generated boundary facts so `actor-core-debt` shrinks or is replaced
   by a more precise remaining blocker.
5. Run boundary, actor-system, component-registry, workspace, Camera3, and
   Tesseract update tests.

Stop condition:

If update ownership cannot be split without redesigning runtime scheduling,
stop and write the scheduler ownership amendment before touching package
structure.

## Readiness Verdict

`actor-core` extraction remains blocked, but it is blocked for the right
reason. Phase 1 has removed the legacy bridge/capability confusion and left a
clear Phase 2 starting line:

```text
actor-core = actor identity/tree/lifecycle/attachment primitives
not app update scheduling, window focus, state observer binding, or app
definition installation
```
