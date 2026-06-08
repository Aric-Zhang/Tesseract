# Project Prism Phase 3 Detailed Implementation Plan

Status: implemented through Phase 3D; accepted pending reviewer sign-off.

This is the executable Phase 3 plan. It consolidates:

- `temp/project-prism-phase-3-ui-framework-implementation-plan.md`
- `temp/project-prism-phase-3a-ui-state-scheduler-ports-implementation-plan.md`
- Phase 3.0 review follow-up requirements.

The goal of Phase 3 is to turn the current app-local window/tab/dock/menu system
into a product-agnostic `ui-framework` package without preserving root/floating
dual behavior, scene-state coupling, or app-local installer shortcuts.

## Phase 3 Current State

- Phase 0 is accepted as the boundary baseline.
- Phase 1 is accepted as app-local shared-spine decoupling.
- Phase 2 is accepted for `actor-core` and `actor-input` extraction.
- Phase 3.0 dock surface truth model cleanup is implemented and can be treated
  as the Phase 3 base model.
- `packages/ui-framework` now exists and is consumed by the wallpaper app.
- `ui-framework` is allowed in the generated boundary facts.

Phase 3 is not complete until:

- `packages/ui-framework` exists.
- The package is product-agnostic.
- Wallpaper app consumes the public UI package API.
- Browser smoke parity is recorded after extraction.
- Generated Project Prism boundary facts agree with that state.

## Global Architecture Rules

- Do not move code into `packages/ui-framework` until Phase 3A and Phase 3B
  pass.
- Do not preserve root-only or floating-only tab/input behavior.
- Do not encode Scene, Debug, Hierarchy, Inspector, Camera3, Tesseract, or
  wallpaper app policy into reusable UI APIs.
- Do not persist actor ids, frame actor ids, DOM ids, or content host ids.
- Runtime hosting and actor input use `viewActorId`.
- Menu and persistence use `WindowViewIdentity` (`typeKey` plus opaque
  `instanceId`).
- Pointer-driven UI mutation stays on actor input and intent ports.
- Known view content must not silently mount to whole-frame primary content
  when a target tabset/content host is missing.
- Scene-backed state adapters belong to app/editor integration, not reusable UI
  runtime or public barrels.
- Remaining blocker facts must be updated in generated boundary data, not only
  in prose reports.

## Global Verification Gates

Run targeted tests after every step. Run close checks before marking each
subphase complete.

Targeted Phase 3 UI gate:

```text
npm run test -w wallpaper-tesseract -- architecture-boundaries project-prism-boundary-report window-dock-targets window-tab-drag-session window-frame-dock-tree window-frame-surface-component floating-window-component workspace-root-dock-frame-component window-frame-lifecycle-controller window-workspace-layout window-workspace-layout-persistence app-menu-bar-component
npm run typecheck -w wallpaper-tesseract
```

Subphase close gate:

```text
npm run test -w wallpaper-tesseract
npm run typecheck -w wallpaper-tesseract
npm run build -w wallpaper-tesseract
```

After `packages/ui-framework` exists:

```text
npm run test -w ui-framework
npm run typecheck -w ui-framework
npm run build -w ui-framework
npm run test
npm run typecheck
npm run build
```

Browser smoke is mandatory for steps that affect:

- actor input;
- DOM hit rects;
- tab chrome;
- docking preview/commit;
- fullscreen/restore;
- menu behavior;
- layout persistence/hydration;
- scheduler/frame timing.

## Phase 3.0: Dock Surface Truth Model Closure

Status: implemented, pending final handoff artifacts if not already committed.

Purpose:

- Make dock tree tabset state the only content display truth.
- Make same-frame dock split/reorder an explicit operation.
- Remove root/floating tab behavior drift before UI API extraction.

### Step 3.0.0: Reproduction Baseline

Goal:

- Freeze the root/floating split-tab bugs that motivated Phase 3.0.

Boundary:

- Failing reproduction tests are allowed only while developing this step. They
  must be green before handoff.

Expected effect:

- Split tab activation and misplaced content are model-level test cases.

Required tests:

- Root split tab click activates the clicked tab.
- Floating split tab click activates the clicked tab.
- Menu focus does not rehost content into whole-frame primary content.
- Close visible tab in one tabset reveals the correct sibling content.

### Step 3.0.1: Tabset-Local Active State

Goal:

- Remove display-driving frame-level active tab state.

Boundary:

- Frame-level MRU/focus may exist only if named as focus/MRU, not display
  truth.

Expected effect:

- A frame with multiple tabsets can have one active view per tabset.

Required tests:

- Independent activation per tabset.
- Closing a tab updates only the affected tabset.
- Split collapse keeps a valid active tab in remaining tabsets.

### Step 3.0.2: Strict Content Placement

Goal:

- Known view content mounts only into the matching tabset content host.

Boundary:

- No whole-frame fallback for known content.
- Missing target fails closed with structured diagnostics or retries as an
  explicitly hidden/non-interactable state.

Expected effect:

- Hidden tabs no longer appear by occupying the entire frame after menu focus.

Required tests:

- Known view content parent remains the expected tabset host.
- Missing target does not append to primary content.

### Step 3.0.3: Shared Tab Input State Machine

Goal:

- Root and floating frames share tab click, close, drag, cancel, and dock
  interpretation.

Boundary:

- No DOM click shortcut.
- No root-only or floating-only tab activation branch.

Expected effect:

- Root/floating tab interaction cannot drift.

Required tests:

- Root/floating click inactive tab.
- Root/floating close tab.
- Drag threshold and cancel behavior.
- Mobile/narrow close rect remains reachable.

### Step 3.0.4: Same-Frame Dock Operations

Goal:

- Allow root and floating same-frame left/right/top/bottom docking.

Boundary:

- No blanket `targetFrameId === sourceFrameId` rejection.
- Same-frame operations must not destroy/recreate frame or view actors.
- Only explicit no-op same-tabset drops may be rejected.

Expected effect:

- Root content edges and floating content edges accept legal dock drops.

Required tests:

- Preview resolves explicit operations:
  - `same-frame-split`;
  - `same-frame-reorder`;
  - `cross-frame-split`;
  - `cross-frame-merge`;
  - `cross-frame-float`;
  - `no-op`.
- Same-frame split moves a tab exactly once.
- Same-frame reorder preserves view actor and content host.

### Step 3.0.5: Persistence And Browser Gate

Goal:

- Prove corrected model under persistence and real DOM hit behavior.

Boundary:

- Persistence stores logical identity and tabset-local active tab only.
- No actor ids in storage.

Required browser smoke:

- Root same-frame left/right/top/bottom dock.
- Floating same-frame left/right/top/bottom dock.
- Root/floating split tab switch.
- Tab close.
- Menu focus.
- Reload after split layout.
- Mobile close rect.

Smoke data must record:

- viewport;
- layout before/after;
- per-tabset active ids;
- content parent for live views;
- `elementsFromPoint()[0]`;
- actor-input hit if available;
- screenshots;
- console errors.

### Step 3.0.6: Boundary Closure

Goal:

- Make Phase 3A safe to start.

Required work:

- Regenerate Project Prism boundary report.
- Remove or narrow `dock-surface-truth-debt`.
- Add or update Phase 3.0 completion report.
- Ensure `WindowDockCommitIntent.operation` is explicit for all commit paths.

Exit:

- `dock-surface-truth-debt` no longer blocks `ui-framework`.
- Phase 3A may begin.

## Phase 3A: UI State, Scheduler, And Installer Ports

Purpose:

- Remove scene/app runtime facts from generic UI candidates while staying
  app-local.

This subphase incorporates the detailed plan from:

```text
temp/project-prism-phase-3a-ui-state-scheduler-ports-implementation-plan.md
```

### Step 3A.0: Baseline UI Dependency Audit

Goal:

- Freeze exact remaining `ui-framework` blockers before import changes.

Work:

1. Regenerate Project Prism boundary report.
2. Add `temp/project-prism-phase-3a-baseline-report.md`.
3. List generic UI candidate imports to:
   - `scene-runtime`;
   - `runtime/ports`;
   - app composition;
   - product feature folders;
   - scene-backed adapters.
4. List public barrel exports that would pollute future UI API.

Boundary:

- No code moves.
- Do not mark blockers complete unless source imports and generated facts agree.

Tests:

```text
node scripts/generate-project-prism-phase0-report.mjs
npm run test -w wallpaper-tesseract -- project-prism-boundary-report architecture-boundaries
```

Exit:

- Baseline report exists and names every file targeted by Phase 3A.

### Step 3A.1: Public Barrel And Export Quarantine

Goal:

- Keep reusable UI public surfaces free of app/scene-backed glue.

Work:

1. Audit `window-runtime/index.ts` and any feature index/public entrypoint.
2. Remove public exports for:
   - scene-backed state adapters;
   - app composition helpers;
   - product-specific window/view policies;
   - migration aliases.
3. Re-export scene-backed adapters only from app/editor integration paths if
   still needed.
4. Add boundary tests that future UI public barrels cannot export scene/app
   adapters.

Boundary:

- No broad compatibility barrel.

Expected effect:

- Future `ui-framework` public API cannot include scene glue by accident.

Tests:

```text
npm run test -w wallpaper-tesseract -- architecture-boundaries project-prism-boundary-report
npm run typecheck -w wallpaper-tesseract
```

### Step 3A.2: UI Layout State Contracts

Goal:

- Make layout state a UI-owned contract.

Work:

1. Define or complete UI-owned contracts:
   - `UiLayoutPath<TValue>`;
   - `UiLayoutCommandSink`;
   - `UiLayoutStateReader`;
   - `UiLayoutStateObserver`;
   - `UiLayoutStateStore` if useful;
   - local disposable/registration.
2. Add fake UI layout state support for tests.
3. Move generic tests away from `SceneParameterStore`.

Boundary:

- UI state contracts cannot import `scene-runtime`.
- No global store singleton.

Expected effect:

- Generic UI tests can run without scene state.

Tests:

```text
npm run test -w wallpaper-tesseract -- floating-window-state floating-window-component app-menu-bar-component
npm run typecheck -w wallpaper-tesseract
```

### Step 3A.3: Move Scene-Backed UI State Adapter Out Of Window Runtime

Goal:

- Remove `scene-runtime` imports from reusable `window-runtime`.

Work:

1. Move `floating-window-scene-state-adapter` into app/editor integration,
   such as `features/window-workspace/scene-ui-layout-state-adapter.ts`.
2. Update app composition and tests.
3. Delete the old `window-runtime` adapter file.
4. Keep adapter tests near the app/editor adapter.

Boundary:

- `window-runtime` must not import `SceneParameterStore`,
  `sceneParameterPaths`, or `SceneCommandSink`.
- No re-export from `window-runtime/index.ts`.

Expected effect:

- `floating-window-scene-state-paths` stops being a reusable UI blocker.

Tests:

```text
npm run test -w wallpaper-tesseract -- floating-window-state floating-window-component architecture-boundaries project-prism-boundary-report
npm run typecheck -w wallpaper-tesseract
```

Browser smoke:

- Window drag.
- Window resize.
- Window close/open via menu.
- Layout persistence if persistence wiring changes.

### Step 3A.4: UI Scheduler Ports

Goal:

- Remove app `RuntimeObject` from reusable workspace UI services.

Work:

1. Define UI-owned scheduler contracts:
   - `UiFrame`;
   - `UiScheduledService`;
   - `UiSchedulerRegistration`;
   - `UiScheduler`.
2. Convert:
   - `WindowWorkspaceController`;
   - `WindowWorkspaceFrameLayoutPersistenceController`;
   - `WindowWorkspacePresentationController`
   away from app `RuntimeObject`.
3. Make `install-window-workspace-feature` accept UI scheduler ports.
4. Add app adapter that registers UI scheduled services in the current app
   frame loop.

Boundary:

- Generic UI services cannot import `runtime/ports`.
- Do not change runtime-core scheduler ownership in Phase 3.

Expected effect:

- `workspace-runtime-service-registration` clears or moves to app adapter.

Tests:

```text
npm run test -w wallpaper-tesseract -- window-workspace-controller window-workspace-layout-persistence-controller window-workspace-presentation-controller
npm run typecheck -w wallpaper-tesseract
```

Browser smoke:

- focus-to-front;
- menu focus;
- dock/persist;
- fullscreen/restore.

### Step 3A.5: Workspace Mode View Model Isolation

Goal:

- Keep workspace mode as generic UI/editor state rather than scene path
  knowledge inside menu/window components.

Work:

1. Define:
   - `WorkspaceModeValue`;
   - `WorkspaceModeStatePort` or typed UI layout wrapper;
   - `WorkspacePresentationIntentPort` if needed.
2. Keep mapping from `sceneParameterPaths.workspace.mode` in app integration.
3. Ensure App Menu receives only generic workspace mode state/port.

Boundary:

- App Menu must not import scene paths.
- Generic UI ports must not know Scene/Camera/Tesseract.

Expected effect:

- App Menu remains reusable and editor-like.

Tests:

```text
npm run test -w wallpaper-tesseract -- app-menu-bar-component app-menu-bar-actor-factory workspace-mode
npm run typecheck -w wallpaper-tesseract
```

### Step 3A.6: Component Definition Installer Ownership

Goal:

- Stop reusable UI installers from depending on app-root installer helpers.

Work:

1. Audit installers importing `component-definitions.ts`.
2. Decide the owner of idempotent install helper:
   - component registry package/helper; or
   - package-local installer helper; or
   - direct idempotent registry API.
3. Update UI installers so they do not import app-root helpers.
4. Keep app installation as composition only.

Boundary:

- No new mega-installer.
- Scene/Debug/Hierarchy/Inspector definitions stay out of UI installer.
- Window/menu/root definitions stay out of actor-core.

Expected effect:

- `component-definition-installer-debt` clears or narrows.

Tests:

```text
npm run test -w wallpaper-tesseract -- component-definitions architecture-boundaries project-prism-boundary-report
npm run typecheck -w wallpaper-tesseract
```

### Step 3A.7: Product-Free UI Port Test Helpers

Goal:

- Prepare Phase 3B fixture by making tests independent of product state.

Work:

1. Add reusable test helpers for:
   - fake UI layout store;
   - fake UI scheduler;
   - fake workspace mode state;
   - fake view catalog if needed.
2. Use them in window/menu/workspace tests.
3. Keep scene-backed adapter tests separate.

Boundary:

- No production fake services.
- Tests must not mask missing production ports.

Tests:

```text
npm run test -w wallpaper-tesseract -- floating-window-component app-menu-bar-component window-workspace-controller window-workspace-layout-persistence-controller
npm run typecheck -w wallpaper-tesseract
```

### Step 3A.8: Browser Regression Gate

Goal:

- Prove UI state/scheduler rewrites preserved real behavior.

Required scenarios:

- Root Scene visible on startup.
- Floating frame opens from Window menu.
- Window click/focus brings frame to front.
- Floating drag and resize.
- Tab click switches root and floating split content.
- Tab close closes only clicked view.
- Dock root/floating left/right/top/bottom.
- Scene fullscreen/restore from root/floating/split pane.
- Layout persistence survives reload.
- Mobile viewport keeps menu and tab close reachable.

Smoke data:

- viewport;
- storage/layout state;
- view identity tuple;
- DOM top stack;
- actor-input hit if available;
- action result;
- persisted layout;
- screenshots;
- console errors.

### Step 3A.9: Boundary Closure

Goal:

- Make Phase 3B safe to begin.

Work:

1. Regenerate boundary reports.
2. Update `project-prism-boundary-facts.ts`:
   - clear/narrow `ui-state-binding-debt`;
   - clear/narrow `component-definition-installer-debt`.
3. Add `temp/project-prism-phase-3a-acceptance-report.md`.
4. Update Phase 3 master plan if Phase 3B entry state changes.

Close gate:

```text
npm run test -w wallpaper-tesseract
npm run typecheck -w wallpaper-tesseract
npm run build -w wallpaper-tesseract
```

Exit:

- Generic UI candidates no longer import `scene-runtime`.
- Generic UI candidates no longer import app `runtime/ports`.
- Public UI barrels do not export scene/app adapters.
- Phase 3B may start.

## Phase 3B: Product-Free UI Framework Fixture

Purpose:

- Prove the UI framework can run without product features before package
  extraction.

### Step 3B.0: Fixture Architecture

Goal:

- Define a minimal product-free UI app inside the workspace.

Work:

1. Create a fixture location, for example:
   - `apps/wallpaper-tesseract/src/ui-framework-fixture/`; or
   - `apps/wallpaper-tesseract/src/window-runtime/fixture/`.
2. The fixture must create:
   - actor system;
   - component registry;
   - attachment runtimes;
   - root workspace frame;
   - one floating frame;
   - menu;
   - generic content view factories;
   - fake UI layout store;
   - fake UI scheduler.

Boundary:

- No Scene, Tesseract, Camera3, Debug, Hierarchy, Inspector, or app
  composition policy.
- No scene-runtime.
- No runtime/ports.

Expected effect:

- Any missing UI package port appears before file movement.

Tests:

```text
npm run test -w wallpaper-tesseract -- ui-framework-fixture architecture-boundaries project-prism-boundary-report
npm run typecheck -w wallpaper-tesseract
```

### Step 3B.1: Generic View Types

Goal:

- Replace product windows with generic dockable test views.

Work:

1. Add generic view type registrations:
   - `panel`;
   - `log`;
   - `details`;
   - optional disabled/non-closeable view.
2. Use `WindowViewIdentity` for menu/persistence.
3. Use `viewActorId` only for runtime hosting/input.
4. Support multiple instances of at least one generic view type.

Boundary:

- Do not copy Debug/Hierarchy/Scene internals.

Expected effect:

- Menu, lifecycle, docking, close, split, persistence, and reopen are tested
  without product windows.

Tests:

- Open/focus by type.
- Create multiple instances.
- Close one instance.
- Reopen through menu.
- Persist/reload type/instance layout.

### Step 3B.2: Real DOM Fixture Browser Smoke

Goal:

- Test real CSS, DOM rects, and actor-input paths in a product-free UI.

Work:

1. Mount the fixture in a browser-accessible route or dev query mode.
2. Use the same frame/tab/menu CSS as production.
3. Execute:
   - root tab click;
   - floating tab click;
   - tab close;
   - merge tabs;
   - same-frame split;
   - cross-frame split;
   - menu focus;
   - reload persistence;
   - mobile viewport close/menu.

Boundary:

- A pure model test is not enough for this step.
- Browser hook must be read-only.

Smoke data:

- DOM top stack;
- actor-input hit;
- tab rect;
- content parent;
- layout before/after;
- screenshots;
- console errors.

Acceptance:

- DOM top target and actor-input hit agree.
- No product feature imports in the fixture.

### Step 3B.3: Public UI API Draft

Goal:

- Decide the package surface before extraction.

Work:

1. Draft package public exports:
   - app shell/root frame;
   - floating frame;
   - frame surface/tab chrome;
   - dock tree/target/preview;
   - lifecycle controller;
   - view type registry;
   - menu model/menu bar;
   - layout persistence;
   - UI state/scheduler ports;
   - component definition installer.
2. Mark internals:
   - reducer internals;
   - DOM helpers;
   - fixture helpers;
   - CSS internals if not public.
3. Add boundary tests so wallpaper app cannot import future package internals
   once extraction starts.

Boundary:

- Public API must not expose scene paths, product names, actor ids as stable
  identity, or app-specific bootstrap policy.

Expected effect:

- Phase 3C has a concrete move list.

### Step 3B.4: Fixture Closure

Goal:

- Decide whether package extraction may begin.

Work:

1. Add `temp/project-prism-phase-3b-fixture-report.md`.
2. Regenerate boundary matrix.
3. Confirm blockers relevant to UI package are cleared or moved outside
   generic UI candidates.

Close gate:

```text
npm run test -w wallpaper-tesseract
npm run typecheck -w wallpaper-tesseract
npm run build -w wallpaper-tesseract
```

Exit:

- Product-free fixture unit tests pass.
- Product-free fixture browser smoke passes on desktop and mobile.
- Phase 3C may start.

## Phase 3C: Extract `ui-framework` Package

Purpose:

- Move proven product-agnostic UI code into a formal workspace package.

### Step 3C.0: Package Scaffold

Goal:

- Create package infrastructure without moving behavior.

Work:

1. Add `packages/ui-framework`.
2. Add:
   - `package.json`;
   - `tsconfig.json`;
   - test config;
   - `src/index.ts`;
   - build/typecheck/test scripts.
3. Add package to workspace scripts.

Boundary:

- No product code.
- No unstable public exports.

Tests:

```text
npm run test -w ui-framework
npm run typecheck -w ui-framework
npm run build -w ui-framework
```

### Step 3C.1: Move Pure Model Modules

Goal:

- Move low-risk model/reducer code first.

Candidate modules:

- `window-view-identity`;
- `window-dock-surface-model`;
- `window-frame-dock-tree`;
- `window-dock-targets`;
- `window-tab-drag-session`;
- `window-workspace-layout`;
- `window-workspace-layout-persistence`;
- app-menu model if product-free.

Boundary:

- No DOM.
- No CSS.
- No Scene/Debug/Hierarchy/Inspector/Camera3/Tesseract.
- No imports from `apps/wallpaper-tesseract/src`.
- `WindowViewIdentity` is public persistent/menu identity.
- `WindowViewKey` may remain compatibility/internal only.

Expected effect:

- Model tests move to package.

Tests:

```text
npm run test -w ui-framework
npm run test -w wallpaper-tesseract -- window-dock-targets window-tab-drag-session window-workspace-layout window-workspace-layout-persistence
npm run typecheck
```

### Step 3C.2: Move UI Ports

Goal:

- Move generic state/scheduler/geometry contracts.

Candidate modules:

- `ui-geometry`;
- `ui-layout-state`;
- UI scheduler ports;
- workspace mode view model ports;
- layout persistence storage interfaces.

Boundary:

- Scene-backed adapters stay in wallpaper app/editor integration.

Expected effect:

- UI package owns the abstractions needed to run without scene-runtime.

Tests:

```text
npm run test -w ui-framework
npm run test -w wallpaper-tesseract -- floating-window-state app-menu-bar-component window-workspace-controller
npm run typecheck
```

### Step 3C.3: Move Frame Surface, Chrome, And CSS

Goal:

- Move product-agnostic DOM components after model and ports are in place.

Candidate modules:

- floating frame component/definition/CSS;
- workspace root frame component/definition/CSS;
- window frame surface component/definition;
- tab chrome/input/action modules;
- content host resolver;
- dock preview component;
- frame port/registry.

Boundary:

- CSS moves with owning component.
- Components may depend on `actor-core` and `actor-input`.
- Components must not know product view types.

Expected effect:

- Root/floating implementation becomes reusable package code.

Tests:

```text
npm run test -w ui-framework
npm run test -w wallpaper-tesseract -- floating-window-component workspace-root-dock-frame-component window-frame-surface-component window-dock-preview-component
npm run typecheck
```

Browser smoke:

- root/floating tab click;
- tab close;
- floating drag/resize;
- root/floating dock preview.

### Step 3C.4: Move Lifecycle, Registry, Menu, And Workspace Services

Goal:

- Move generic UI orchestration.

Candidate modules:

- `WindowFrameLifecycleController`;
- `WindowViewFactoryRegistry`;
- `WindowWorkspaceController`;
- presentation controller;
- layout persistence controller;
- App Menu model/component/definition if product-free;
- view type registration contracts.

Boundary:

- Product view factories remain in app/editor features.
- Wallpaper app passes registrations into UI package; UI package does not import
  wallpaper app policy.

Expected effect:

- Wallpaper app becomes a UI package consumer.

Tests:

```text
npm run test -w ui-framework
npm run test -w wallpaper-tesseract -- window-frame-lifecycle-controller app-menu-bar-component window-workspace-controller
npm run typecheck
```

Browser smoke:

- menu open/focus;
- tab close;
- dock;
- fullscreen/restore;
- reload persistence.

### Step 3C.5: Replace App Imports And Delete App-Local Copies

Goal:

- Make extraction real, not a re-export facade.

Work:

1. Update wallpaper app imports to use `ui-framework` public API.
2. Delete app-local copies of moved modules.
3. Keep app-local adapters:
   - scene-backed UI layout store;
   - product view factories;
   - editor menu command registrations;
   - feature installers.
4. Update architecture boundaries:
   - `ui-framework` cannot import app/editor/runtime product features;
   - app cannot import package internals.

Boundary:

- No duplicate facts under old names.

Tests:

```text
npm run test -w ui-framework
npm run test -w wallpaper-tesseract
npm run typecheck
npm run build
```

### Step 3C.6: Extraction Closure

Goal:

- Prove package extraction is stable enough for Phase 3D parity smoke.

Work:

1. Regenerate boundary report.
2. Update Project Prism package matrix so `ui-framework` is allowed or has only
   explicitly deferred non-blocking items.
3. Add `temp/project-prism-phase-3c-ui-framework-extraction-report.md`.

Exit:

- `ui-framework` test/typecheck/build pass.
- Wallpaper app no longer owns generic UI model internals.

## Phase 3D: Browser Smoke Parity After Extraction

Purpose:

- Prove extracted UI framework preserved editor-like behavior.

### Step 3D.0: Smoke Harness Refresh

Goal:

- Make before/after browser evidence comparable.

Work:

1. Ensure smoke data records:
   - viewport;
   - storage/layout initial state;
   - view identity tuple;
   - dock root before/after;
   - DOM top stack;
   - actor-input hit result;
   - console errors;
   - screenshots.
2. Keep smoke hook read-only.

Boundary:

- Smoke hook must not affect route/hit/action behavior.

### Step 3D.1: Desktop Parity Smoke

Required scenarios:

- root Scene visible;
- Window menu opens/focuses live views;
- Debug/Hierarchy/Inspector open/focus;
- tab close closes only one view;
- cross-frame merge and split;
- same-frame root/floating left/right/top/bottom split;
- floating overlap routes input to front frame;
- Scene fullscreen/restore from root, floating, and split pane.

Acceptance:

- console errors = 0;
- no stale content host;
- Tesseract visible;
- Camera3 overlay visible and interactive;
- DOM top stack and actor-input hit agree.

### Step 3D.2: Mobile/Narrow Parity Smoke

Required scenarios:

- root tabs fit or scroll without unreachable close buttons;
- menu remains reachable;
- tab close hit target stays inside tab rect;
- dock preview remains visible and usable.

Acceptance:

- no text overlap causing unusable controls;
- tab close and menu click work through actor input;
- screenshots recorded.

### Step 3D.3: Persistence/Reload Parity Smoke

Required scenarios:

- root split layout reloads;
- floating layout reloads;
- multiple instances reload;
- same-frame split layout reloads;
- runtime-only fullscreen frame is not serialized;
- legacy version migration still hydrates if retained.

Acceptance:

- persisted layout contains logical identity only.
- no `viewActorId`, `frameActorId`, DOM id, or content host id in storage.
- every tabset has a valid active tab after reload.

### Step 3D.4: Phase 3 Acceptance

Work:

1. Add `temp/project-prism-phase-3-acceptance-report.md`.
2. Update:
   - `temp/project-prism-engine-modularization-outline.md`;
   - `temp/project-prism-phase-model-current-assessment.md`;
   - generated boundary report;
   - AGENTS.md if package paths or commands changed.
3. Record final commands and smoke artifacts.

Close gate:

```text
npm run test -w ui-framework
npm run test -w wallpaper-tesseract
npm run test
npm run typecheck
npm run build
```

Exit:

- `ui-framework` package exists.
- Package is product-agnostic.
- Package has tests/typecheck/build.
- Wallpaper app consumes public UI API.
- Browser smoke parity is recorded.

## Stop Conditions

Stop and revise the plan if:

- Phase 3A cannot remove `scene-runtime` or `runtime/ports` from generic UI
  candidates without changing the UI public model.
- Product-free fixture cannot run without Scene/Tesseract/Camera3/Debug/
  Hierarchy/Inspector.
- App code must import `ui-framework` internals to keep behavior.
- Browser smoke reveals DOM top stack and actor-input hit target disagree.
- Persistence requires a schema change that invalidates current version
  assumptions.
- Runtime/editor state ownership turns out to belong to Phase 4 or Phase 6
  before UI extraction can continue.

## Recommended Commit Boundaries

- Commit 1: Phase 3.0 final closure artifacts.
- Commit 2: Phase 3A state/scheduler/installer ports.
- Commit 3: Phase 3B product-free fixture.
- Commit 4: Phase 3C package scaffold and pure model move.
- Commit 5: Phase 3C component/lifecycle/menu extraction.
- Commit 6: Phase 3C app import cleanup.
- Commit 7: Phase 3D smoke parity and Phase 3 acceptance.
