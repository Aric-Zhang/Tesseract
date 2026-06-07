# Project Prism Phase 2 Acceptance Report

Date: 2026-06-08

## Verdict

Phase 2 is complete within the intended scope:

- `actor-core` has been extracted into a reusable workspace package.
- `actor-input` has been extracted into a reusable workspace package.
- App-local `actor-runtime` and `gizmo-runtime` implementation files have been reduced to forwarding/installer surfaces rather than duplicate implementations.
- Frame update scheduling, window focus commands, and component definition installers are no longer actor-core facts.

This does not mean `ui-framework`, `runtime-core`, `runtime-three`, `editor`, or `wallpaper-app` are extractable yet. The generated boundary facts still correctly block those targets.

## Completed Steps

### Step 2.0 Baseline

- Regenerated Project Prism boundary facts before contract movement.
- Verified Phase 1 handoff state with architecture boundary tests and typecheck.

### Step 2A Update Ownership Split

- Removed `updateFrame` from the actor-core component primitive.
- Removed `RuntimeObject` implementation from `ActorSystem`.
- Added app-local `FrameUpdateAttachmentRuntime` and explicit `frameUpdateAttachment`.
- Moved old actor update behavior into update-runtime tests.

### Step 2B Window Focus Ownership Split

- Removed `ActorWindowFocusService` from actor-core component context.
- Split focus into:
  - actor-input stack priority query;
  - UI-owned window focus command port.
- Kept pointer focus behavior explicit at app/window composition boundaries.

### Step 2C Component Definition Installer Split

- Deleted the misleading broad `installCoreComponentDefinitions` path.
- Moved gizmo and state binding installation into domain-owned installers.
- Kept only a small idempotent component definition helper in app-local source.

### Step 2D Boundary Reclassification

- Regenerated boundary facts after 2A-2C.
- Marked `actor-core` and later `actor-input` as allowed only after corresponding code facts were clean.

### Step 2E Actor-Core Package Extraction

- Created `packages/actor-core`.
- Moved actor identity, actor tree, component primitives, component registry, attachment runtime contracts, and related tests into the package.
- Kept app-local `actor-runtime/index.ts` as an explicit forwarding barrel.

### Step 2F Actor-Input Package Extraction

- Created `packages/actor-input`.
- Moved actor input participant/router, active interaction cancellation, gizmo-controller attachment runtime, event binding component/definition, stack priority source, and related tests into the package.
- Kept app-local `gizmo-runtime/index.ts` as an explicit forwarding plus installer surface.

### Step 2G Acceptance Evidence

- Regenerated Project Prism boundary reports.
- Added Phase 2 browser smoke:
  - `temp/project-prism-phase2-browser-smoke.mjs`
  - `temp/project-prism-phase2-browser-smoke.json`
  - `temp/project-prism-phase2-browser-smoke.png`

## Package Status

From `temp/project-prism-phase-0b-boundary-summary.json` after Phase 2:

- `actor-core`: `allowed`
- `actor-input`: `allowed`
- `ui-framework`: `blocked`
- `runtime-core`: `blocked`
- `runtime-three`: `blocked`
- `editor`: `deferred`
- `wallpaper-app`: `blocked`

The remaining blockers are expected and belong to later phases:

- `ui-state-binding-debt`
- `component-definition-installer-debt`
- `state-domain-debt`
- `runtime-ownership-debt`
- `app-runtime-debt`
- `app-composition-debt`

## Browser Smoke

`temp/project-prism-phase2-browser-smoke.json` passed with:

- desktop viewport `1365x768`;
- root Scene tab visible;
- non-zero Scene canvas and Camera3 overlay rects;
- floating frame drag moved a frame;
- Hierarchy tab close removed only the Hierarchy view;
- Window menu restored Hierarchy;
- Scene fullscreen created one runtime-only fullscreen floating frame and suppressed unrelated floating frames;
- Scene restore brought floating frames back;
- Camera3 actor input capture recorded pointer hits including `orbit` and `-z`;
- console/page errors: `0`;
- validation errors: `0`.

## Important Architecture Notes

- The fullscreen Scene smoke intentionally allows one visible `.floating-gizmo-window--fullscreen` frame. That frame is the runtime-only fullscreen isolation frame, not an unrelated tool window.
- `actor-input` depends on `actor-core` and `gizmo-core`; `actor-core` does not depend on `actor-input`.
- App-local `gizmo-runtime/install-component-definitions.ts` is not actor-input package API. It remains app/package-installation glue and is tracked as later installer debt where appropriate.
- `FrameUpdateAttachmentRuntime` remains app-local update glue. It removes update scheduling from actor-core but is not the final runtime scheduler split.

## Phase 3 Entry Point

Phase 3 should start with UI framework extraction blockers, not runtime extraction:

1. split UI layout state away from `scene-runtime`;
2. move generic window/tab/dock/menu installers and ports toward a UI-owned boundary;
3. keep product-specific Scene/Debug/Hierarchy/Inspector content outside the UI package;
4. preserve actor-input-backed UI behavior and reuse the Phase 2 browser smoke shape for high-risk UI/input changes.

Do not begin `runtime-core` extraction until the state-domain and runtime-ownership blockers are addressed in the later runtime phases.
