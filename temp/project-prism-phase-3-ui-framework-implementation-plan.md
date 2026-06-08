# Project Prism Phase 3: UI Framework Port Split And Extraction

Status: planned; detailed execution has been consolidated into
`temp/project-prism-phase-3-detailed-implementation-plan.md`.

This document is the Phase 3 master route. The step-by-step executable plan now
lives in `temp/project-prism-phase-3-detailed-implementation-plan.md`, which
merges the detailed Phase 3A state/scheduler/installer plan and expands Phase
3B/3C/3D to the same granularity.

Phase 3 must not start by moving files into a package. It starts by making the
window/tab/dock/menu model product-agnostic and internally consistent. Only
after the model runs in a product-free fixture should code move to a formal
`ui-framework` package.

## Current Entry State

- Phase 0 is accepted as the boundary baseline.
- Phase 1 is accepted as app-local shared-spine decoupling.
- Phase 2 is accepted for `actor-core` and `actor-input` extraction.
- `actor-core` and `actor-input` are package targets.
- `ui-framework` remains blocked in the generated boundary matrix.

Current generated blockers for `ui-framework`:

- `dock-surface-truth-debt`
- `ui-state-binding-debt`
- `component-definition-installer-debt`

Current UI framework extraction blockers:

- `dock-surface-truth-model`
- `floating-window-scene-state-paths`
- `workspace-runtime-service-registration`

Phase 3 is complete only when the generated boundary facts mark the reusable UI
framework boundary as clean enough to package and the browser smoke parity is
recorded after extraction.

## Global Rules

- Do not extract `ui-framework` before Phase 3.0 and Phase 3B pass.
- Do not preserve root-only or floating-only tab behavior.
- Do not encode product windows such as Scene, Debug, Hierarchy, Inspector, or
  Tesseract into reusable UI APIs.
- Do not persist actor ids, frame actor ids, or content DOM ids as stable view
  identity.
- Runtime tab hosting and actor input continue to use `viewActorId`.
- Menu and persistence use `WindowViewIdentity` (`typeKey` + opaque
  `instanceId`).
- Pointer-driven UI mutation must stay on actor input / intent ports, not DOM
  click handlers.
- Known view content must never silently mount to whole-frame primary content
  when a split/tabset target is missing.
- UI framework candidate files must not import `scene-runtime`,
  `sceneParameterPaths`, Scene/Tesseract/Camera3/Debug/Hierarchy/Inspector
  feature internals, or app composition policy.

## Global Test Gates

Run targeted checks after each step, then run broader checks before each
subphase closes.

Targeted window/UI checks:

```text
npm run test -w wallpaper-tesseract -- architecture-boundaries project-prism-boundary-report window-dock-surface-model window-frame-dock-tree window-frame-surface-component floating-window-component workspace-root-dock-frame-component window-frame-lifecycle-controller window-workspace-layout window-workspace-layout-persistence app-menu
npm run typecheck -w wallpaper-tesseract
```

Subphase close checks:

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

Browser smoke is mandatory for every step that touches actor input, DOM rects,
tab chrome, docking, persistence, fullscreen, or menu behavior.

## Phase 3.0: Dock Surface Truth Model Cleanup

Purpose:

Fix the reusable dock/tab model before any UI package API can freeze the wrong
semantics.

This subphase is already expanded in:

```text
temp/project-prism-phase-3-0-dock-surface-truth-model-plan.md
```

The following steps are repeated here as the Phase 3 master checklist.

### Step 3.0.0: Baseline And Reproduction Tests

Goal:

- Freeze root/floating split-tab activation and misplaced-content bugs before
  refactoring the surface model.

Work:

- Add or verify regression coverage for:
  - root split pane with two tabs in one tabset;
  - floating split pane with the same interaction;
  - menu focus of a live split-pane view;
  - closing a visible tab inside one tabset;
  - content parent and actor-input hit evidence at the clicked tab point.

Boundary:

- Temporary failing tests or reports are allowed only during implementation.
  They must be converted into normal passing tests before Phase 3.0 closes.

Effect:

- The current bug becomes a reproducible model failure, not an anecdotal UI
  report.

Tests:

```text
npm run test -w wallpaper-tesseract -- window-dock-surface-model window-frame-surface-component workspace-root-dock-frame-component floating-window-component
npm run typecheck -w wallpaper-tesseract
```

### Step 3.0.1: Remove Frame-Level Active Tab As Display Truth

Goal:

- Dock tree tabset active ids become the only selected/visible content truth.

Work:

- Remove display-driving `activeViewActorId` from `WindowDockSurfaceModel`.
- Keep any frame-level active/focused value only as explicitly named MRU/focus
  projection.
- Make `activateTab(viewActorId)` update the tabset containing that view.
- Make `removeTab(viewActorId)` update only the affected tabset and collapse
  empty split branches through the dock tree reducer.

Boundary:

- Do not replace runtime `viewActorId` with persistent `instanceId`.
- Do not infer tabset activity from DOM order.

Effect:

- A split frame can have multiple active views, one per tabset.

Tests:

- Unit tests for independent tabset activation.
- Dock tree tests for split, remove, collapse, and restore.

### Step 3.0.2: Refine WindowFramePort Active Semantics

Goal:

- Remove the misleading "one active tab per frame" public API.

Work:

- Replace `getActiveViewActorId()` with narrower methods:
  - `isViewActiveInFrame(viewActorId)`;
  - `getFocusedViewActorId()` or `getLastActivatedViewActorId()` if needed;
  - `getActiveViewActorIds()` for debug/snapshot use.
- Update lifecycle, menu focus, close-view, and fullscreen isolation call sites.

Boundary:

- Lifecycle may focus a frame or activate a tabset. It must not move content
  unless a dock/rehost operation explicitly requests it.

Effect:

- The frame port describes focus/MRU separately from tabset display state.

Tests:

- Lifecycle tests for tabset-local next-active behavior.
- Stale tab action hit data test: `viewActorId + identity` mismatch is rejected.

### Step 3.0.3: Make Content Placement Strict

Goal:

- Known view content never falls back to whole-frame primary content.

Work:

- Change `WindowFrameSurfaceComponent.appendContentElement()` so known
  `viewActorId` content must resolve to a dock tree tabset target.
- If a target is temporarily missing, keep content detached or
  hidden/non-interactable and retry after render.
- If still missing, fail closed with structured diagnostics.
- Add a reusable invariant helper for root and floating hosts.

Boundary:

- Do not hide misplaced content with CSS.
- Do not special-case root frame.

Effect:

- Menu focus can no longer make a hidden tab occupy the whole frame.

Tests:

- Split root/floating focus tests assert content parent remains the pane host.
- Missing tabset target fails instead of mounting to primary content.

### Step 3.0.4: One Tab Interaction State Machine

Goal:

- Root and floating frames share tab click, close, drag, cancel, and dock
  interpretation.

Work:

- Move tab interaction interpretation into a shared helper such as
  `window-frame-tab-input.ts`.
- Keep root/floating shell components responsible only for hit translation and
  intent dispatch.
- Make close action route through lifecycle `requestCloseView`.
- Ensure inactive tab content is not interactable.

Boundary:

- No DOM click handler shortcut.
- No root-only or floating-only tab activation branch.

Effect:

- Root/floating tab behavior stops drifting.

Tests:

- Root split pane tab click.
- Floating split pane tab click.
- Root/floating mobile tab close rect.
- Drag cancel leaves active tab unchanged.

### Step 3.0.4a: Same-Frame Dock Split And Reorder Semantics

Goal:

- Fix the root bug where only the top tab bar accepts drops and root
  left/right/top/bottom content edges cannot be docked.
- Make same-frame dock split/reorder a first-class dock operation.

Current structural cause:

- `resolveWindowDockPreview()` rejects regions whose `frameId` equals the
  source frame.
- `validateDockCommit()` rejects `targetFrameId === source.frameId`.
- Edge split on an empty or source-owned tabset is not modeled as a valid
  reducer operation.

Work:

- Make dock preview / commit intent carry an explicit operation kind instead of
  requiring lifecycle code to infer semantics from frame ids:
  - `cross-frame-merge`;
  - `cross-frame-split`;
  - `cross-frame-float`;
  - `same-frame-reorder`;
  - `same-frame-split`;
  - `no-op`.
- Split dock commit semantics into explicit operations:
  - cross-frame merge;
  - cross-frame split;
  - cross-frame float;
  - same-frame tab merge/reorder;
  - same-frame split to target tabset edge.
- Update preview resolution so `sourceFrameId` filters only illegal no-ops.
- Allow same-frame edge targets for root and floating frames.
- Update lifecycle validation to allow `targetFrameId === source.frameId` when
  the operation is a same-frame split/reorder.
- Add or refine dock tree reducer operations so moving a tab within one frame
  removes it from the source tabset and inserts it once in the target tabset.
- Define root empty-state behavior:
  - if root has no tabs, any edge drop fills root as the initial tabset;
  - if root has tabs, edge drop splits the target tabset.

Boundary:

- Do not implement by temporarily floating and docking back.
- Do not destroy/recreate frame or view actor for same-frame moves.
- Do not special-case Scene, Debug, Hierarchy, Inspector, root, or floating.
- Do not keep a blanket `targetFrameId === sourceFrameId` rejection in preview
  or lifecycle validation. Only explicit no-op same-tabset drops may be
  rejected.

Effect:

- Same-frame edge docking becomes part of the public dock contract that an
  extracted UI framework can safely expose.

Tests:

- Preview tests: same-frame content left/right/top/bottom returns split.
- Preview/intent tests: every target resolves to an explicit operation kind.
- Dock tree tests: move existing tab within same frame, collapse empty source.
- Lifecycle tests: same-frame commit succeeds without frame destroy or stale
  content host.
- Browser smoke: root Scene + Debug in one tabset, drag Debug to root
  left/right/top/bottom and verify preview/result/content parents.
- Browser smoke: floating Debug + Scene in one tabset, drag one tab to floating
  left/right/top/bottom and verify the same preview/result/content parent
  evidence.

### Step 3.0.5: Persistence And Snapshot Validation

Goal:

- Persist per-tabset active state and prevent frame-level active assumptions
  from returning through hydrate.

Work:

- Audit `createFrameLayoutSnapshot`, runtime dock root mapping, and hydrate.
- Ensure persisted dock roots store tabset-local `activeTabId` at every tabset.
- Validate/normalize:
  - missing active tab;
  - duplicate view in multiple tabsets;
  - empty split child;
  - malformed root/floating tabset ids.

Boundary:

- Avoid schema churn unless required.
- Runtime uses `viewActorId`; persistence uses logical tab/view descriptors.

Effect:

- Reload preserves root/floating split panes and active tabs in every pane.

Tests:

- Persistence unit tests for split root with multiple tabsets.
- Browser smoke reload after tab switch and menu focus.

### Step 3.0.6: Browser Smoke Gate

Goal:

- Prove the corrected model under real DOM rects and actor input.

Required scenarios:

- Root split pane with one pane containing Debug + Scene tabs.
- Floating split pane with the same tab interaction.
- Menu focus of a live tab inside a root split pane.
- Close visible tab in one tabset.
- Mobile/narrow tab close.
- Same-frame root left/right/top/bottom dock.
- Same-frame floating left/right/top/bottom dock.

Smoke data must record:

- viewport;
- initial persisted layout;
- dock root before/after;
- per-tabset active ids;
- content parent for every live view;
- `elementsFromPoint()[0]`;
- actor-input hit actor/component/part/data;
- console errors;
- screenshots.

### Step 3.0.7: Boundary And Plan Closure

Goal:

- Make Phase 3A safe to start.

Work:

- Add architecture boundary tests:
  - no root/floating divergent tab input handlers;
  - `WindowFramePort` does not expose a display-driving single active tab;
  - known view content cannot fallback to primary content in split mode;
  - same-frame dock split/reorder must be covered by dock target/lifecycle
    tests;
  - UI framework candidates remain product-agnostic.
- Regenerate Project Prism boundary report.
- Add a Phase 3.0 completion report under `temp/`.

Exit:

- `dock-surface-truth-debt` is cleared or its remaining deletion condition is
  strictly non-blocking.
- Phase 3A may start.

## Phase 3A: UI-Owned State, Scheduler, And Geometry Ports

Purpose:

Remove app/scene-runtime state and scheduler dependencies from generic
window/menu/workspace code while keeping implementation app-local.

### Step 3A.0: Baseline UI Dependency Audit

Goal:

- Freeze the remaining UI framework blockers after Phase 3.0.

Work:

- Regenerate the Project Prism boundary report.
- List every import from generic UI candidate files to:
  - `scene-runtime`;
  - `runtime/ports`;
  - product features;
  - app composition.
- Record the current blocker count under a Phase 3A report.
- Audit app-local barrels and future package export candidates, especially
  `window-runtime/index.ts`, for accidental public exports of app/scene-backed
  adapters.

Boundary:

- Do not move files yet.
- A scene-backed adapter may exist in app integration, but it must not be
  exported from the reusable UI framework public surface.

Effect:

- Phase 3A works from generated facts, not guesses.

Tests:

```text
npm run prism:phase0:report
npm run test -w wallpaper-tesseract -- project-prism-boundary-report architecture-boundaries
```

### Step 3A.0a: Public Barrel And Export Audit

Goal:

- Prevent cleaned internals from being re-polluted through public barrels.

Work:

- Audit `window-runtime/index.ts`, `features/app-menu/index.ts`,
  `features/window-workspace/index.ts`, and the planned `ui-framework` public
  entrypoint.
- Remove or quarantine public exports for:
  - scene-backed adapters such as `floating-window-scene-state-adapter`;
  - app composition helpers;
  - product-specific window/view policies;
  - migration-only aliases.
- Add explicit package-public export lists before extraction. Anything not on
  the list stays internal.

Boundary:

- Do not solve this with a broad compatibility barrel.
- Tests may import internals only through test-support paths, not future public
  package entrypoints.

Effect:

- `ui-framework` public API cannot accidentally include scene/runtime/app glue
  after internal imports are cleaned.

Tests:

- Boundary test: future UI public barrels must not export scene-backed adapters.
- Boundary test: app integration may import adapters from app/editor adapter
  paths, not from reusable UI public API.

### Step 3A.1: Stabilize UI Geometry And Layout Value Ports

Goal:

- Make UI geometry/value types self-contained.

Work:

- Treat `ui-geometry.ts` as the only generic UI vector/geometry source.
- Ensure window/menu/dock code does not use `Vec2`, `vec2`, or value helpers
  from `scene-runtime`.
- Add test helpers that create `UiVec2`, `UiRect`, `UiLayoutPath`, and fake
  state changes without importing `scene-runtime`.

Boundary:

- Tests may keep scene-runtime fixtures only if they are explicitly testing an
  app adapter, not the reusable UI model.

Effect:

- `window-runtime` tests become usable for a future package without a scene
  store.

Tests:

- `floating-window-state`
- `floating-window-component`
- `window-workspace-controller`
- `dock-target-region-source`

### Step 3A.2: Introduce UI Layout State Store/Command Ports

Goal:

- Replace scene-state backing in generic UI with UI-owned state contracts.

Work:

- Define narrow UI layout contracts:
  - `UiLayoutPath<T>`;
  - `UiLayoutCommandSink`;
  - `UiLayoutStateReader`;
  - `UiLayoutStateObserver` or subscription port;
  - validation/clone/add helpers for UI values.
- Move scene-backed implementation out of reusable window runtime into an app
  or feature adapter, for example:
  - `features/window-workspace/scene-ui-layout-state-adapter.ts`;
  - or `app/adapters/scene-ui-layout-state-adapter.ts`.
- Update `FloatingWindowComponent`, frame lifecycle, and app menu to consume
  the UI port only.

Boundary:

- The reusable UI side must not import `SceneParameterStore`,
  `sceneParameterPaths`, or scene update command types.
- The adapter may import scene-runtime because it belongs to app integration.

Effect:

- `floating-window-scene-state-adapter.ts` no longer blocks UI framework
  extraction from inside `window-runtime`.

Tests:

- Adapter tests: scene store backing produces equivalent UI commands.
- UI tests: fake UI state store drives window drag/resize/visibility.
- Boundary test: generic window/menu files cannot import `scene-runtime`.

### Step 3A.3: Introduce UI Scheduler Ports

Goal:

- Remove app runtime `RuntimeObject` registration from workspace UI services.

Work:

- Define UI scheduler contracts:
  - `UiScheduledService` or `UiFrameTask`;
  - `UiSchedulerRegistration`;
  - `UiFrame`.
- Convert:
  - `WindowWorkspaceController`;
  - `WindowWorkspaceFrameLayoutPersistenceController`;
  - `WindowWorkspacePresentationController`
  away from app `RuntimeObject`.
- Provide an app adapter that registers UI scheduled services into the current
  app frame loop until a package-level scheduler exists.

Boundary:

- Generic UI services must not import `runtime/ports`.
- Do not change runtime-core scheduling in this phase.

Effect:

- `workspace-runtime-service-registration` blocker becomes clearable.

Tests:

- Workspace controller tests use fake UI scheduler.
- Presentation/persistence controller tests do not import runtime ports.
- Browser smoke: focus-to-front, persistence save, fullscreen/restore still
  work.

### Step 3A.4: Isolate Workspace Mode View Model

Goal:

- Keep workspace mode as a UI/editor state view model instead of scene path
  knowledge inside menu/window components.

Work:

- Define a generic workspace mode state contract:
  - `WorkspaceModeValue`;
  - `WorkspaceModeStatePort`;
  - `WorkspacePresentationIntentPort`.
- Keep product/app mapping from `sceneParameterPaths.workspace.mode` in the app
  adapter.
- Ensure App Menu receives only the generic mode state path/port.

Boundary:

- App Menu must not import scene paths.
- Workspace mode controller must not hide runtime/editor feature assumptions in
  generic UI package APIs.

Effect:

- The menu can become a reusable UI menu rather than a wallpaper-specific menu.

Tests:

- App menu tests use fake workspace mode port.
- Browser smoke: Window menu focus/open still works in develop mode and while
  Scene fullscreen is entered/restored.

### Step 3A.5: Move Component Definition Installation Toward Package Owners

Goal:

- Prevent a future UI package from depending on app-local central definition
  installation.

Work:

- Split reusable UI component definitions into a UI-owned installer.
- Keep product feature definitions in product/editor installers.
- Ensure the central app installer only calls package/feature installers.
- Move or duplicate no generic helper unless one package clearly owns it.

Boundary:

- Do not put Scene/Debug/Hierarchy/Inspector definitions in the UI installer.
- Do not put window/root/menu definitions in actor-core.

Effect:

- `component-definition-installer-debt` shrinks for UI framework extraction.

Tests:

- Definition installation is idempotent.
- App boot still installs all existing components.
- Boundary test: central installer does not define UI component details inline.

### Step 3A.6: Boundary Closure For UI Ports

Goal:

- Prove Phase 3A removed scene/runtime state blockers from generic UI.

Work:

- Regenerate boundary report.
- Update `project-prism-boundary-facts.ts`:
  - clear or narrow `ui-state-binding-debt`;
  - clear or narrow `workspace-runtime-service-registration`;
  - keep any remaining state adapter debt outside reusable UI candidate files.
- Add a Phase 3A closure report.

Exit:

- Generic UI candidate files no longer import `scene-runtime` or `runtime/ports`.
- Phase 3B product-free fixture may start.

## Phase 3B: Product-Free UI Framework Fixture

Purpose:

Prove the UI framework can run without Scene, Tesseract, Camera3, Debug,
Hierarchy, Inspector, or app-specific runtime features before extracting a
package.

### Step 3B.0: Define Fixture Scope

Goal:

- Create a small generic UI fixture inside the app repo before package
  extraction.

Work:

- Add a fixture entry under a clearly marked test/fixture location, such as:
  - `apps/wallpaper-tesseract/src/ui-framework-fixture/`;
  - or `apps/wallpaper-tesseract/src/window-runtime/fixture/`.
- It should create:
  - actor system/component registry;
  - root workspace frame;
  - floating frame;
  - menu;
  - generic content views.

Boundary:

- No imports from Scene, Tesseract, Camera3, Debug, Hierarchy, Inspector, or
  app composition policy.
- The fixture may use fake content components and fake state/scheduler ports.

Effect:

- Package API gaps become visible before file moves.

Tests:

- Fixture unit tests can create/destroy all UI primitives without product
  feature installers.
- Fixture browser smoke mounts real DOM, real CSS, and actor-input bindings.

### Step 3B.1: Add Generic View Types

Goal:

- Replace product content in fixture tests with generic dockable views.

Work:

- Add generic view type registrations:
  - text panel;
  - colored panel;
  - scrollable panel if needed for hit testing;
  - disabled/non-closeable item if needed for menu behavior.
- Use `WindowViewIdentity` for type/instance.
- Use runtime `viewActorId` for hosting/input only.

Boundary:

- Do not copy Debug/Hierarchy/Scene internals into generic fixtures.

Effect:

- Menu, lifecycle, docking, close, split, persistence, and re-open can be
  tested without product windows.

Tests:

- Open/focus by type.
- Create multiple instances.
- Close one instance.
- Reopen through menu.
- Persist/reload type/instance layout.

### Step 3B.2: Product-Free Dock/Menu/Persistence Loop

Goal:

- Prove the full UI loop in the fixture.

Work:

- Fixture must support:
  - root and floating frames;
  - tab merge;
  - same-frame split/reorder;
  - cross-frame split;
  - tab close;
  - menu open/focus;
  - layout persistence/hydration;
  - mobile tab geometry.
- Browser fixture must render the real tab chrome, dock preview, frame CSS,
  menu CSS, and actor-input hit path. Model-only tests are not enough for this
  step.

Boundary:

- Do not use product-specific actor ids or view type ids.

Effect:

- UI framework extraction becomes mechanical rather than speculative.

Tests:

- Unit tests cover model/lifecycle.
- Browser smoke runs the generic fixture and records DOM/actor-input evidence.
- Browser smoke verifies:
  - tab close rect stays inside the tab;
  - dock preview appears in the expected region;
  - `elementsFromPoint()[0]` and actor-input hit agree;
  - mobile overflow does not hide required controls.

### Step 3B.3: Freeze Public UI Framework API Shape

Goal:

- Decide what the package exports before moving code.

Work:

- Draft package API:
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
- Mark internal-only modules:
  - DOM helpers;
  - reducer internals;
  - test fixtures;
  - CSS internals if not public.

Boundary:

- Public API must not expose wallpaper app paths, actor ids as persistent
  identity, scene parameter paths, or product feature names.

Effect:

- Phase 3C has a concrete move list and export contract.

Tests:

- Boundary tests assert app code imports public UI installers/ports, not
  internals, after extraction.

### Step 3B.4: Phase 3B Closure

Goal:

- Decide whether package extraction can begin.

Work:

- Generate a Phase 3B fixture report.
- Regenerate boundary matrix.
- Confirm `dock-surface-truth-debt`, `ui-state-binding-debt`, and relevant
  installer debt are either cleared or explicitly moved outside UI candidates.

Exit:

- Product-free fixture runs.
- Browser smoke is green on desktop and mobile.
- Phase 3C extraction may start.

## Phase 3C: Extract `ui-framework` Package

Purpose:

Move reusable UI code into a formal workspace package after the model and
fixture prove the boundary.

### Step 3C.0: Package Scaffold

Goal:

- Create the workspace package without moving behavior yet.

Work:

- Add `packages/ui-framework`.
- Add `package.json`, `tsconfig.json`, test config, source entry, and build
  scripts.
- Add workspace scripts:
  - test;
  - typecheck;
  - build.

Boundary:

- Do not move product code.
- Do not expose unstable internal modules.

Effect:

- CI/root scripts can run the new package.

Tests:

```text
npm run test -w ui-framework
npm run typecheck -w ui-framework
npm run build -w ui-framework
```

### Step 3C.1: Move Pure Model First

Goal:

- Move non-DOM, non-CSS model code with minimal risk.

Candidate modules:

- `window-view-identity`
- `window-view-key` only if still needed as runtime/app compatibility; it must
  not become the long-term public identity axis
- `window-dock-surface-model`
- `window-frame-dock-tree`
- `window-dock-targets`
- `window-tab-drag-session`
- `window-workspace-layout`
- `window-workspace-layout-persistence`
- app-menu model if product-free

Boundary:

- No imports from `wallpaper-tesseract/src`.
- No DOM, Three, Scene, Debug, Hierarchy, Inspector, Camera3, Tesseract.
- `WindowViewIdentity` is the public persistent/menu identity. `WindowViewKey`
  may be internal compatibility or app bridge only, and public APIs must not
  require consumers to build long-term identity around it.

Effect:

- Reducer/model tests move to the package first.

Tests:

- Package model tests.
- Wallpaper app tests still pass through package imports.

### Step 3C.2: Move UI Ports And State/Scheduler Contracts

Goal:

- Move generic UI state/scheduler/geometry ports after Phase 3A cleaned them.

Candidate modules:

- `ui-geometry`
- `ui-layout-state`
- UI scheduler ports
- workspace mode view model ports
- layout persistence storage interfaces

Boundary:

- Scene-backed adapters stay in wallpaper app or editor/app integration.

Effect:

- UI package owns the abstractions it needs to run without scene-runtime.

Tests:

- Package port tests.
- Wallpaper adapter tests.

### Step 3C.3: Move Frame Surface, Chrome, And Components

Goal:

- Move product-agnostic UI components and CSS.

Candidate modules:

- floating frame component/definition/CSS;
- workspace root frame component/definition/CSS;
- window frame surface component/definition;
- tab chrome/input/action modules;
- content host resolver;
- dock preview component;
- frame port/registry;
- focus command port/service proxy if product-agnostic.

Boundary:

- CSS moves with the component that owns it.
- Components may depend on `actor-core` and `actor-input`.
- Components must not know product view types.

Effect:

- Root/floating frame implementation becomes reusable package code.

Tests:

- Package component tests.
- Wallpaper app root/floating smoke remains green.

### Step 3C.4: Move Lifecycle, Registry, Menu, And Workspace Services

Goal:

- Move generic orchestration once component and port dependencies are in the
  package.

Candidate modules:

- `WindowFrameLifecycleController`;
- `WindowViewFactoryRegistry`;
- `WindowWorkspaceController`;
- presentation controller;
- layout persistence controller;
- App Menu model/component/definition if generic after Phase 3A/B;
- view type registration contracts.

Boundary:

- Product view factories remain in editor/app feature packages.
- Wallpaper app installers pass registrations into package lifecycle, not the
  other way around.

Effect:

- Wallpaper app becomes a consumer of UI framework services.

Tests:

- Lifecycle tests in package.
- Wallpaper feature integration tests.
- Browser smoke for menu open/focus, tab close, dock, fullscreen.

### Step 3C.5: Replace App-Local Imports With Package Imports

Goal:

- Remove duplicate facts and local compatibility barrels.

Work:

- Update wallpaper app to import from `ui-framework` public API.
- Delete app-local copies of moved modules.
- Keep app-local adapters:
  - scene-backed UI layout store;
  - product view factories;
  - editor menu command registration;
  - feature installers.
- Update architecture boundaries:
  - `ui-framework` cannot import app/editor/runtime product features;
  - app should import public UI installers/ports, not package internals.

Boundary:

- Do not leave two implementations under different names.

Effect:

- The extraction is real, not a re-export facade over app source.

Tests:

```text
npm run test -w ui-framework
npm run test -w wallpaper-tesseract
npm run typecheck
npm run build
```

### Step 3C.6: Package Extraction Closure

Goal:

- Prove `ui-framework` package is stable enough for Phase 3D smoke parity.

Work:

- Regenerate boundary report.
- Update Project Prism package target matrix so `ui-framework` is allowed or
  has only explicitly deferred non-blocking items.
- Add a Phase 3C extraction report.

Exit:

- `ui-framework` package tests/typecheck/build pass.
- Wallpaper app no longer owns generic UI model internals.

## Phase 3D: Browser Smoke Parity After Extraction

Purpose:

Prove the extracted package preserved the real editor-like UI behavior.

### Step 3D.0: Smoke Harness Refresh

Goal:

- Make browser smoke comparable before and after extraction.

Work:

- Ensure smoke data records:
  - viewport;
  - storage/layout initial state;
  - view identity tuple (`typeKey`, `instanceId`, `viewActorId`, `frameId`);
  - dock root before/after;
  - DOM top stack;
  - actor-input hit result;
  - console errors;
  - screenshots.

Boundary:

- Smoke hook must be read-only and must not affect actor input routing.

### Step 3D.1: Desktop UI Parity

Scenarios:

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
- no frame-level active display regression;
- Tesseract visible;
- Camera3 overlay visible and interactive.

### Step 3D.2: Mobile/Narrow UI Parity

Scenarios:

- root tabs fit or scroll without unreachable close buttons;
- menu remains reachable;
- tab close hit target stays inside tab rect;
- docking preview remains visible and does not overlap controls incoherently.

Acceptance:

- no text overlap causing unusable controls;
- tab close and menu click work through actor input;
- screenshots recorded.

### Step 3D.3: Persistence/Reload Parity

Scenarios:

- root split layout reloads;
- floating layout reloads;
- multiple instances reload;
- same-frame split layout reloads;
- runtime-only fullscreen frame is not serialized;
- legacy version 1 migration still hydrates if the active plan has not removed
  it.

Acceptance:

- persistence writes logical view identity, not actor ids.
- every tabset has a valid active tab after reload.
- smoke JSON records the persisted layout payload and asserts it contains no
  `viewActorId`, `frameActorId`, frame actor id, content host id, or DOM id.
- persisted views are described by `typeKey` and opaque `instanceId`; runtime
  `viewActorId` appears only in live runtime smoke fields, not storage fields.

### Step 3D.4: Phase 3 Closure

Work:

- Add `temp/project-prism-phase-3-acceptance-report.md`.
- Update:
  - `temp/project-prism-engine-modularization-outline.md`;
  - `temp/project-prism-phase-model-current-assessment.md`;
  - generated boundary report;
  - AGENTS.md if package paths or test commands changed.
- Record final commands and smoke artifacts.

Exit:

- `ui-framework` extraction is complete in the Project Prism sense:
  - package exists;
  - package is product-agnostic;
  - package has tests/typecheck/build;
  - wallpaper app consumes public UI API;
  - browser smoke parity is recorded.

## Stop Conditions

Stop and revise the plan if:

- Phase 3.0 cannot clear same-frame dock split/reorder without changing the
  public dock model.
- UI framework candidates still require `scene-runtime` after Phase 3A.
- A product-free fixture cannot run without Scene/Tesseract/Camera3/Debug/
  Hierarchy/Inspector content.
- App code must import package internals to keep existing behavior.
- Browser smoke reveals DOM top stack and actor-input hit target disagree.
- Persistence needs a schema change that invalidates existing version 2 layout
  assumptions.
- Runtime/editor state ownership becomes a blocker that belongs to Phase 4/6
  rather than Phase 3.

## Recommended Commit Boundaries

- Commit 1: Phase 3.0 complete, `dock-surface-truth-debt` cleared or narrowed.
- Commit 2: Phase 3A UI state/scheduler/geometry ports complete.
- Commit 3: Phase 3B product-free fixture complete.
- Commit 4: `packages/ui-framework` scaffold and pure model move.
- Commit 5: component/lifecycle/menu extraction.
- Commit 6: app import cleanup and Phase 3D smoke closure.
