# Project Prism Phase 3A: UI State, Scheduler, And Installer Ports

Status: planned.

This document expands Phase 3A from
`temp/project-prism-phase-3-ui-framework-implementation-plan.md` into an
executable step-by-step plan.

The same steps are now merged into the Phase 3 detailed execution master at
`temp/project-prism-phase-3-detailed-implementation-plan.md`. Treat that master
document as the primary execution checklist when working through all of Phase 3.

Phase 3.0 made the dock surface model safe enough to build on. Phase 3A must now
remove scene/app runtime facts from reusable UI candidates before any
`ui-framework` package extraction begins.

## Current Entry State

- Phase 3.0 is accepted with follow-up items.
- `dock-surface-truth-debt` has been removed from the generated boundary facts.
- `ui-framework` is still blocked by:
  - `ui-state-binding-debt`;
  - `component-definition-installer-debt`.
- Generic UI candidate zones still include:
  - `apps/wallpaper-tesseract/src/window-runtime/`;
  - `apps/wallpaper-tesseract/src/features/app-menu/`;
  - `apps/wallpaper-tesseract/src/features/window-workspace/`;
  - `apps/wallpaper-tesseract/src/app/app-shell.ts`.
- Known remaining coupling:
  - `window-runtime/floating-window-scene-state-adapter.ts` imports
    `scene-runtime`.
  - `window-runtime/index.ts` still publicly exports the scene-backed floating
    window state adapter.
  - `features/window-workspace/install-window-workspace-feature.ts` imports
    `SceneParameterStore` and app `RuntimeObject`/`RuntimeRegistration`.
  - workspace controllers still implement app `RuntimeObject`.
  - UI component definition installers still import the app-local
    `component-definitions.ts` helper.

## Phase 3A Goal

After Phase 3A, reusable UI candidates should be app-local but package-shaped:

- Generic UI files do not import `scene-runtime`.
- Generic UI files do not import app `runtime/ports`.
- Public UI barrels do not export scene-backed adapters or app composition
  helpers.
- UI layout state is represented by UI-owned ports.
- UI scheduling is represented by UI-owned ports.
- Scene-backed state/scheduler implementations live in app/editor integration
  adapter paths.
- Component definition installation is moving toward package ownership; central
  app installation only composes feature/package installers.
- Boundary facts and reports reflect the reduced blockers.

Phase 3A does **not** extract `packages/ui-framework`. That happens only after
Phase 3B proves a product-free fixture.

## Non-Goals

- Do not move UI code into a package in this phase.
- Do not add broad compatibility barrels.
- Do not keep scene-backed adapters in future UI public API paths.
- Do not special-case Scene, Debug, Hierarchy, Inspector, or Tesseract in
  reusable UI ports.
- Do not replace runtime `viewActorId` with persistent `WindowViewIdentity`.
  Runtime hosting/input still uses `viewActorId`.
- Do not hide remaining blockers in allowlists. If a blocker remains, document
  the deletion condition.

## Global Gates

Run targeted checks after each step. Run the full close checks before marking
Phase 3A complete.

Targeted checks:

```text
npm run test -w wallpaper-tesseract -- architecture-boundaries project-prism-boundary-report floating-window-state floating-window-component window-workspace-controller window-workspace-layout-persistence-controller window-workspace-presentation-controller app-menu-bar-component
npm run typecheck -w wallpaper-tesseract
```

Close checks:

```text
npm run test -w wallpaper-tesseract
npm run typecheck -w wallpaper-tesseract
npm run build -w wallpaper-tesseract
```

Run root checks if any shared package or workspace script changes:

```text
npm run test
npm run typecheck
npm run build
```

Browser smoke is required for any step that changes window commands,
workspace scheduling, layout persistence, menu input, fullscreen, or docking.

## Step 3A.0: Baseline UI Dependency Audit

Goal:

- Freeze the exact UI extraction blockers before changing imports.

Work:

1. Regenerate the Project Prism boundary report.
2. Add a short Phase 3A baseline report under `temp/`.
3. Record current imports from generic UI candidates to:
   - `scene-runtime`;
   - `runtime/ports`;
   - app composition;
   - product feature folders;
   - scene-backed adapters.
4. Record public barrel exports that would pollute a future UI package.

Boundary:

- Do not move code in this step.
- Do not mark a blocker complete unless generated facts and source imports agree.

Expected effect:

- The next steps are measured against a concrete blocker list.

Tests:

```text
node scripts/generate-project-prism-phase0-report.mjs
npm run test -w wallpaper-tesseract -- project-prism-boundary-report architecture-boundaries
```

Exit:

- `temp/project-prism-phase-3a-baseline-report.md` exists.
- It lists every source file that must move or adapt during Phase 3A.

## Step 3A.1: Public Barrel And Export Quarantine

Goal:

- Stop reusable UI public surfaces from exporting app/scene-backed glue.

Work:

1. Audit:
   - `window-runtime/index.ts`;
   - `features/app-menu/index.ts` if present;
   - `features/window-workspace/index.ts` if present;
   - any planned UI public entrypoint.
2. Remove public exports for:
   - `floating-window-scene-state-adapter`;
   - app composition helpers;
   - scene-backed state registration helpers;
   - product-specific view policies.
3. If app code still needs a scene-backed adapter, expose it from an app or
   feature integration path, not from `window-runtime`.
4. Add boundary tests that fail if future UI public barrels export files whose
   names include:
   - `scene-state-adapter`;
   - `scene-ui-layout`;
   - `app-adapter`;
   - product feature names.

Boundary:

- Do not replace the old public export with a new broad compatibility export.
- Tests may import internal helpers only through test-support or explicit
  adapter paths.

Expected effect:

- The future `ui-framework` public API cannot accidentally include scene/app
  integration glue.

Tests:

```text
npm run test -w wallpaper-tesseract -- architecture-boundaries project-prism-boundary-report
npm run typecheck -w wallpaper-tesseract
```

Browser smoke:

- Not required if this step only changes exports and app imports.

## Step 3A.2: Define UI Layout State Contracts

Goal:

- Make layout state a UI-owned contract instead of a scene-runtime fact.

Work:

1. Expand `window-runtime/ui-layout-state.ts` or split a nearby UI-owned module
   to define:
   - `UiLayoutPath<TValue>`;
   - `UiLayoutCommandSink`;
   - `UiLayoutStateReader`;
   - `UiLayoutStateObserver`;
   - `UiLayoutStateStore` if a combined interface is useful;
   - `UiLayoutStateRegistration` or local disposable contract.
2. Add fake UI layout state support for tests.
3. Update generic window/menu/workspace tests to use fake UI layout state
   instead of `SceneParameterStore` where they are not testing the adapter.
4. Keep `UiLayoutPath` as a logical state path. It should not encode scene
   parameter ownership.

Boundary:

- The reusable UI contract must not import `scene-runtime`.
- Do not make UI state ports know about workspace app policy or Scene paths.
- Do not add a global store singleton.

Expected effect:

- Generic UI tests can run without constructing a scene store.

Tests:

```text
npm run test -w wallpaper-tesseract -- floating-window-state floating-window-component app-menu-bar-component
npm run typecheck -w wallpaper-tesseract
```

Acceptance:

- `window-runtime` model/component tests that do not specifically test scene
  integration no longer import `scene-runtime`.

## Step 3A.3: Move Scene-Backed Floating Window State Adapter Out Of UI Runtime

Goal:

- Remove `scene-runtime` imports from reusable `window-runtime` source.

Work:

1. Move or recreate the scene-backed implementation currently in
   `window-runtime/floating-window-scene-state-adapter.ts` into an app/editor
   adapter path, for example:
   - `features/window-workspace/scene-ui-layout-state-adapter.ts`; or
   - `app/adapters/scene-ui-layout-state-adapter.ts`.
2. Update app composition and tests to import the adapter from its new
   integration owner.
3. Delete the old `window-runtime` adapter file once imports are migrated.
4. Keep adapter tests near the adapter and explicitly mark them as scene-backed.

Boundary:

- `window-runtime` must not import `SceneParameterStore`,
  `sceneParameterPaths`, `SceneCommandSink`, or `scene-runtime`.
- Do not keep a re-export from `window-runtime/index.ts`.

Expected effect:

- `floating-window-scene-state-paths` is no longer a window-runtime blocker;
  any remaining scene backing is correctly classified as app/editor glue.

Tests:

```text
npm run test -w wallpaper-tesseract -- floating-window-state floating-window-component architecture-boundaries project-prism-boundary-report
npm run typecheck -w wallpaper-tesseract
```

Browser smoke:

- Window drag.
- Window resize.
- Window close/open via menu.
- Layout persistence after reload if the adapter path changed persistence.

Smoke data:

- initial bounds;
- bounds after drag/resize;
- visible state after close/open;
- console errors.

## Step 3A.4: Introduce UI Scheduler Ports

Goal:

- Remove app `RuntimeObject` from reusable workspace UI services.

Work:

1. Define UI-owned scheduler contracts, for example:
   - `UiFrame`;
   - `UiScheduledService`;
   - `UiSchedulerRegistration`;
   - `UiScheduler`.
2. Convert these classes away from `RuntimeObject`:
   - `WindowWorkspaceController`;
   - `WindowWorkspaceFrameLayoutPersistenceController`;
   - `WindowWorkspacePresentationController`.
3. Make `features/window-workspace/install-window-workspace-feature.ts` accept a
   UI scheduler or scheduled-service registration port rather than
   `registerRuntimeService(RuntimeObject)`.
4. Add an app adapter that registers UI scheduled services into the existing
   app frame loop.
5. Keep update timing behavior intact:
   - focus stack reconciles before input priority is needed;
   - persistence saves after layout mutations;
   - presentation mode changes trigger immediate update when needed.

Boundary:

- Generic UI services must not import `runtime/ports`.
- Do not change runtime-core frame/update ownership in this phase.
- Do not make UI scheduler depend on scene frame types.

Expected effect:

- `workspace-runtime-service-registration` is cleared or narrowed to app
  adapter code.

Tests:

```text
npm run test -w wallpaper-tesseract -- window-workspace-controller window-workspace-layout-persistence-controller window-workspace-presentation-controller features/window-workspace
npm run typecheck -w wallpaper-tesseract
```

Browser smoke:

- Click window/frame to focus-to-front.
- Menu focus existing view.
- Dock and persist layout.
- Scene fullscreen/restore.

Acceptance:

- No generic UI source imports `RuntimeObject` or `RuntimeRegistration`.

## Step 3A.5: Isolate Workspace Mode View Model

Goal:

- Make workspace mode a UI/editor state view model instead of a scene path
  baked into menu/window components.

Work:

1. Define a generic workspace mode contract:
   - `WorkspaceModeValue`;
   - `WorkspaceModeStatePort` or a typed UI layout path wrapper;
   - `WorkspacePresentationIntentPort` if needed.
2. Keep the mapping from `sceneParameterPaths.workspace.mode` in app/editor
   integration.
3. Update App Menu and workspace mode wiring so reusable menu code receives
   generic workspace mode state.
4. Ensure run/develop presentation behavior still uses current Scene owner
   location and fullscreen isolation semantics.

Boundary:

- App Menu component must not import scene parameter paths.
- Generic UI ports must not know Scene, Camera3, or Tesseract.

Expected effect:

- The menu remains reusable and editor-like; wallpaper-specific state paths are
  app glue.

Tests:

```text
npm run test -w wallpaper-tesseract -- app-menu-bar-component app-menu-bar-actor-factory workspace-mode
npm run typecheck -w wallpaper-tesseract
```

Browser smoke:

- Window menu opens.
- Existing live view focus works.
- Scene fullscreen and restore work.
- Develop/run transitions do not lose root/floating layout.

## Step 3A.6: Move Component Definition Installation Toward Package Owners

Goal:

- Remove the app-local central installer as a dependency of reusable UI
  installers.

Work:

1. Audit installers that import app-local `component-definitions.ts`.
2. Decide the narrow owner of idempotent definition installation:
   - actor-core/component registry helper; or
   - package-local installer utility; or
   - direct registry API if already idempotent enough.
3. Update:
   - `window-runtime/install-component-definitions.ts`;
   - `features/app-menu/install-component-definitions.ts`;
   - any UI-owned installer
   so they do not import app-root `component-definitions.ts`.
4. Keep central app installation as composition:
   - it calls package/feature installers;
   - it does not define package-owned component details inline.
5. Keep product/editor feature installers separate from reusable UI installers.

Boundary:

- Do not put Scene/Debug/Hierarchy/Inspector definitions in a UI package
  installer.
- Do not put window/menu/root definitions in actor-core.
- Do not create a new mega-installer with a different name.

Expected effect:

- `component-definition-installer-debt` is cleared or narrowed.

Tests:

```text
npm run test -w wallpaper-tesseract -- component-definitions architecture-boundaries project-prism-boundary-report
npm run typecheck -w wallpaper-tesseract
```

Browser smoke:

- Required if app boot/install composition changes materially.

Acceptance:

- App boot installs all existing component definitions.
- Duplicate installer calls remain safe.
- Boundary tests prevent package installers from depending on app-root
  installer helpers.

## Step 3A.7: Product-Free Test Fixtures For UI Ports

Goal:

- Make Phase 3B cheaper by preparing fake ports now.

Work:

1. Add reusable test helpers for:
   - fake UI layout state store;
   - fake UI scheduler;
   - fake workspace mode state;
   - fake menu/window view catalog if needed.
2. Use them in window/menu/workspace tests that currently pull in scene state
   for convenience.
3. Keep scene-backed adapter tests separate and clearly named.

Boundary:

- Do not introduce production fake services.
- Do not let tests mask missing production ports.

Expected effect:

- The test suite starts proving generic UI can run without product state.

Tests:

```text
npm run test -w wallpaper-tesseract -- floating-window-component app-menu-bar-component window-workspace-controller window-workspace-layout-persistence-controller
npm run typecheck -w wallpaper-tesseract
```

## Step 3A.8: Browser Regression Gate

Goal:

- Prove the UI state/scheduler rewrite preserved real interaction behavior.

Required scenarios:

- Root Scene visible on startup.
- Floating frame can be opened from Window menu.
- Window click/focus brings frame to front.
- Floating drag and resize work.
- Tab click switches active content in root and floating split frames.
- Tab close closes only the clicked view.
- Dock root/floating left/right/top/bottom still works.
- Scene fullscreen/restore works from root, floating, and split pane.
- Layout persistence survives reload.
- Mobile/narrow viewport keeps menu and tab close reachable.

Smoke data must record:

- viewport;
- storage/layout initial state;
- view identity tuple (`typeKey`, `instanceId`, `viewActorId`, `frameId`);
- DOM top stack for click points;
- actor-input hit data if available;
- action result;
- persisted layout payload after save/reload;
- screenshots;
- console errors.

Boundary:

- Smoke hooks must be read-only.
- If actor-input hook cannot be installed by browser automation, the report must
  say so and include DOM stack plus app-visible action results.

Acceptance:

- console errors = 0;
- no stale content host;
- no frame-level active display regression;
- no lost Scene canvas after close/reopen or fullscreen/restore.

## Step 3A.9: Boundary Report And Closure

Goal:

- Make Phase 3A handoff auditable.

Work:

1. Regenerate Project Prism boundary reports.
2. Update `project-prism-boundary-facts.ts`:
   - clear or narrow `ui-state-binding-debt`;
   - clear or narrow `component-definition-installer-debt`;
   - ensure any remaining debt points only to app/editor adapter paths, not
     generic UI candidate files.
3. Add `temp/project-prism-phase-3a-acceptance-report.md`.
4. Update the Phase 3 master plan if the next subphase needs a different
   boundary.

Close checks:

```text
npm run test -w wallpaper-tesseract
npm run typecheck -w wallpaper-tesseract
npm run build -w wallpaper-tesseract
```

If shared packages changed:

```text
npm run test
npm run typecheck
npm run build
```

Exit criteria:

- Generic UI candidate files no longer import `scene-runtime`.
- Generic UI candidate files no longer import app `runtime/ports`.
- Public UI barrels do not export scene/app adapters.
- Scene-backed UI adapters live outside reusable UI runtime.
- UI state/scheduler contracts are package-shaped and testable without
  product features.
- Boundary reports reflect the blocker reduction.
- Phase 3B product-free fixture may start.

## Stop Conditions

Stop and revise the plan if:

- UI scheduler extraction requires changing app frame loop ordering.
- Scene-backed adapters cannot move without reintroducing broad app context
  access.
- Component definition installer ownership conflicts with actor-core package
  boundaries.
- Generic UI tests still require `SceneParameterStore` after Step 3A.3.
- Browser smoke shows DOM top stack and actor-input action result disagree.
- Persistence format needs schema changes beyond adapter relocation.
- Any step would require product-specific behavior inside reusable UI ports.

## Recommended Commit Boundaries

- Commit 1: Step 3A.0-3A.3, scene-backed UI state moved out of window runtime.
- Commit 2: Step 3A.4-3A.5, UI scheduler and workspace mode ports.
- Commit 3: Step 3A.6-3A.7, installer ownership and generic test fixtures.
- Commit 4: Step 3A.8-3A.9, browser smoke and boundary closure.
