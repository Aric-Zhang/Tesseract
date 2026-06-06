# Window View Instance Identity Continuation Plan

Date: 2026-06-07

## Purpose

This plan continues the architecture simplification work after the latest review.
The important correction is that Step 9 is not complete yet. The code already
has `WindowViewIdentity` and live maps keyed by identity, but the system is still
mostly driven by `WindowViewKey`:

- `WindowViewFactoryRegistry` is still keyed by `WindowViewKey`.
- `WindowFrameLifecycleController.openView(...)` still accepts a view key.
- App Menu actions still mostly express "open this view key".
- layout persistence is still version 1 and stores only `viewKey`.
- Step 9 smoke did not exercise a real multi-instance lifecycle.

The next objective is to make view identity a real closed loop:

```text
view type -> view instance -> menu action -> lifecycle -> layout persistence
```

Actor ids remain runtime-only. They must not become persisted instance identity.

Important distinction:

```text
persistent/logical identity = WindowViewIdentity(typeKey, instanceId)
runtime carrier identity     = viewActorId
```

Runtime frame surfaces, content hosts, active tab lookup, hit testing, and tab
close still need `viewActorId` because they operate on live actors and DOM
attachments. Persistence, menu actions, and multi-instance product semantics use
`WindowViewIdentity`, especially `identity.instanceId`.

`WindowFrameTab` should therefore carry both:

```ts
interface WindowFrameTab {
  readonly viewActorId: string;
  readonly identity: WindowViewIdentity;
  readonly title: string;
  readonly canDock: boolean;
}
```

Do not replace runtime tab ids with instance ids. Instead, make every path
explicit about which identity it is using.

## Current Baseline

Accepted as complete or mostly complete:

- Step 0-7 are functionally complete.
- Step 8 is partially complete.
- Step 9 has identity primitives and unit-test fixtures, but not a production
  multi-instance loop.
- `SceneViewRuntime` and `CurrentSceneViewSource` have been removed.
- Scene renderability is exposed as a readonly `RenderableSceneView` projection.
- Camera3 rig/motion/viewport binding is split into components.
- legacy Debug, Camera3, `GizmoResponder`, and old dock target names are cleaned
  or only remain as forbidden boundary references.
- `WindowWorkspaceViewCatalog` no longer exposes stack mutation.
- window frame surface ownership is component-registry owned, not shell-owned.

Known remaining gaps from review:

- true instance identity is not the primary API yet;
- app composition still knows too much concrete window policy;
- Scene content installation still has a full-frame escape path;
- smoke coverage does not prove multi-instance close/reload/root/floating/split
  behavior.

## Non-Goals

- Do not use Scene as the first multi-instance pilot. Scene has renderer,
  Camera3, fullscreen, and run-mode coupling.
- Do not persist actor ids.
- Do not revive checkbox-close semantics in the Window menu.
- Do not use `hiddenViewKeys` as the normal runtime close model.
- Do not add a broad WindowManager. Lifecycle mutation should remain in the
  narrow window workspace/lifecycle ports.
- Do not make runtime hit testing or content hosting depend only on persisted
  instance ids.

## Step 0 - Freeze Baseline Before Identity Work

### Goal

Create a clean checkpoint for the current post-Step-7/partial-Step-9 state so
future identity changes can be judged against a known green baseline.

### Work

- Record the current dirty scope with `git status --short`.
- Run the full app package verification:

```text
npm run test -w wallpaper-tesseract
npm run typecheck -w wallpaper-tesseract
npm run build -w wallpaper-tesseract
```

- Preserve the latest useful browser smoke artifacts under `temp/`, especially
  the existing tab-close persistence and Step 9 smoke reports.
- Add a short baseline note if the current smoke evidence is incomplete.

### Boundary

No source behavior changes in this step.

### Acceptance

- tests, typecheck, and build pass;
- the current dirty scope is known;
- Step 9 is explicitly marked as "identity foundation only", not complete.

## Step 1 - Remove Scene Full-Frame Creation Escape

### Goal

Make Scene view runtime creation always happen inside an owning frame. Scene
content should be a view subtree, not a hidden way to create a whole frame.

### Work

- Change `installSceneViewContent(...)` so `parentFrameActor` is required in
  production code.
- Delete the production no-parent branch that calls `createSceneWindowActor(...)`.
- Move any full Scene frame helper needed by tests into test support.
- Production Scene feature code should expose/create a Scene view/content actor
  subtree only, such as `createSceneViewActor(...)`; it should not expose a full
  frame actor factory.
- Remove production exports that let other features opt into full Scene frame
  creation.
- Update architecture boundary tests:
  - production Scene content installer must not call `createSceneWindowActor`;
  - app composition must not directly create Scene window actors;
  - Scene view runtime factories must create only view/content actor subtrees.

### Boundary

- Do not change Scene fullscreen behavior in this step.
- Do not change Scene actor ids except where required to remove the escape path.

### Tests

Targeted:

```text
npm run test -w wallpaper-tesseract -- scene-view-content-installer scene-window-actor-factory architecture-boundaries
npm run typecheck -w wallpaper-tesseract
```

Full gate after completion:

```text
npm run test -w wallpaper-tesseract
npm run typecheck -w wallpaper-tesseract
```

### Acceptance

- Scene opens through the window lifecycle path only.
- Root-preferred Scene opening still works.
- No temporary full Scene frame is created just to immediately rehost content.
- production code has no full-frame Scene actor factory escape hatch.

## Step 2 - Make Identity the Primary Runtime Contract Without Replacing Runtime Actor Ids

### Goal

Move runtime APIs from `WindowViewKey` as identity to
`WindowViewTypeKey + WindowViewInstanceId`, while keeping `viewActorId` as the
runtime carrier id for live hosting/input.

### Work

- Make `WindowViewIdentity.instanceId` non-null for all live views.
- Define `WindowViewInstanceId` as a globally opaque id. Singleton default ids
  may include the type prefix:

```text
scene:default
debug:default
hierarchy:default
```

- Because instance ids are globally opaque, do not blindly serialize identity as
  `${typeKey}:${instanceId}`. Use explicit helpers such as
  `serializeWindowViewIdentity(identity)` and
  `parseWindowViewIdentityKey(value)`.
- Keep `WindowViewKey` only as a compatibility label for singleton type keys
  during the transition.
- Introduce the minimal `WindowViewTypeRegistration` contract here, so registry
  and feature registration do not churn twice:

```ts
interface WindowViewTypeRegistration {
  readonly typeKey: WindowViewTypeKey;
  readonly multiplicity: "singleton" | "multi";
  readonly label: string;
  readonly defaultPlacement: "root" | "floating";
  readonly defaultBounds?: FloatingWindowState;
  readonly createViewRuntime: WindowViewFactory["createViewRuntime"];
}
```

- Change `WindowViewFactoryRegistry` to register these registrations by
  `WindowViewTypeKey`.
- Add or formalize a small instance id allocator:
  - deterministic default id for singleton;
  - generated stable ids for multi-instance creation;
  - no actor id reuse as instance id.
- Update `WindowFrameTab` to carry both logical identity and runtime actor id:
  - `identity` is used by persistence, menu, and product identity;
  - `viewActorId` is used by runtime surface, host lookup, active tab,
    hit testing, tab close, and actor tree mutation.
- Replace or wrap lifecycle entry points:
  - `openOrFocusViewType(typeKey, reason, options?)`;
  - `createViewInstance(typeKey, reason, options?)`;
  - `focusViewInstance(identity, reason)`;
  - `openView(viewKey, ...)` may remain only as a temporary singleton wrapper.
- Update `WindowViewLocationSource` and catalog lookups to support identity
  lookup directly.
- Maintain an activation sequence in the lifecycle controller:
  - increment on open, focus, owner focus, and active tab change;
  - store `lastActivatedAt` or `activationSequence` per live view identity;
  - expose it through the readonly catalog/location projection.
- Ensure dock tree/tab data can be serialized by instance identity while live
  frame operations still route through `viewActorId`.

### Boundary

- Do not add product multi-instance UI yet.
- Do not persist schema v2 yet; this step prepares runtime identity.
- Do not change close semantics except where required by identity lookup.
- Do not replace runtime `viewActorId` with `instanceId` in hit data, host
  lookup, active tab routing, or tab close.

### Tests

Targeted:

```text
npm run test -w wallpaper-tesseract -- window-view-identity window-view-factory-registry window-frame-lifecycle-controller window-workspace-view-catalog window-frame-port
npm run typecheck -w wallpaper-tesseract
```

Regression:

```text
npm run test -w wallpaper-tesseract
npm run typecheck -w wallpaper-tesseract
```

### Acceptance

- two live views of the same type can be represented by distinct identities in
  tests;
- singleton open/focus remains idempotent;
- actor ids are not required to find persisted/logical view instances;
- `WindowFrameTab` exposes both `identity` and `viewActorId`;
- lifecycle/catalog expose a stable activation sequence suitable for MRU menu
  behavior;
- existing Scene, Debug, and Hierarchy still open, focus, dock, close, and
  recreate.

## Step 3 - Move Window Policy Out of App Composition

### Goal

Reduce `create-wallpaper-app.ts` to app shell and service wiring. Concrete view
policy should live in feature installers/descriptors.

### Work

- Use the `WindowViewTypeRegistration` contract introduced in Step 2.
- Move Scene default root placement, frame paths, default bounds, actor id
  conventions, and labels into `features/scene`.
- Move Debug/Hierarchy default bounds and labels into `features/tool-windows`.
- Let `features/window-workspace` install the lifecycle/controller from these
  registrations.
- Keep `create-wallpaper-app.ts` responsible for:
  - creating app shell;
  - creating actor/component systems;
  - installing feature modules;
  - wiring render loop and top-level disposers.

### Boundary

- This is an ownership cleanup, not a new layout feature.
- Do not change visual layout intentionally.

### Tests

Targeted:

```text
npm run test -w wallpaper-tesseract -- install-window-workspace-feature install-scene-view-feature install-tool-window-features architecture-boundaries
npm run typecheck -w wallpaper-tesseract
```

Boundary rules to add:

- `create-wallpaper-app.ts` must not hard-code Debug/Hierarchy/Scene frame
  bounds.
- `create-wallpaper-app.ts` must not hard-code `sceneParameterPaths.sceneWindow`
  for view factory policy.
- app composition must not import concrete window actor factories.

### Acceptance

- adding a new view type does not require editing app composition except through
  a feature installer list;
- existing app startup still creates root Scene and default tool windows as
  before.

## Step 4 - Add Persistence Schema V2

### Goal

Persist layout by logical view instance identity instead of singleton view key.

### Work

- Introduce schema version 2.
- Persist view descriptors by instance:

```text
views: [
  { instanceId, typeKey, title, canDock, singleton? }
]
frames[].root.tabs: [instanceId]
frames[].root.activeTabId: instanceId
```

- Keep actor ids out of persistence. Version 2 payloads must not contain
  `actorId`, `viewActorId`, or `frameActorId`.
- Migrate version 1:
  - `scene` -> `{ typeKey: "scene", instanceId: "scene:default" }`;
  - `debug` -> `{ typeKey: "debug", instanceId: "debug:default" }`;
  - `hierarchy` -> `{ typeKey: "hierarchy", instanceId: "hierarchy:default" }`.
- Define storage failure policy explicitly:
  - invalid JSON: ignore and preserve storage unless product chooses cleanup;
  - unsupported version: ignore;
  - malformed top-level payload: reject;
  - valid payload with unknown view types: prune unknown views/frames and keep
    valid parts when possible;
  - runtime-only fullscreen/isolation frames: never serialize.
- Keep `hiddenViewKeys` as compatibility-only. Normal tab close removes the
  instance from persisted `views`.

### Boundary

- Do not introduce multi-instance UI before schema v2 is tested.
- Do not overfit v2 to the Inspector pilot; it must support any view type.

### Tests

Targeted:

```text
npm run test -w wallpaper-tesseract -- window-workspace-layout window-workspace-layout-persistence window-workspace-layout-persistence-controller window-frame-lifecycle-controller
npm run typecheck -w wallpaper-tesseract
```

Required cases:

- v1 migration for Scene/Debug/Hierarchy;
- v1 hydrate followed by the next persist writes version 2;
- v2 round trip with two instances of the same type;
- v2 payload contains `typeKey`/`instanceId` but no `actorId`, `viewActorId`, or
  `frameActorId`;
- unknown type pruning;
- duplicate instance id normalization/rejection;
- close one instance, persist, reload, and confirm the other remains;
- runtime-only fullscreen frame is omitted;
- `hiddenViewKeys` remains empty for normal tab close snapshots.

### Acceptance

- persistence no longer uses `viewKey` as the durable tab identity;
- existing v1 layouts can still hydrate into the new model;
- closing one instance cannot accidentally close all instances of that type.

## Step 5 - Redesign Window Menu Around Type and Instance Actions

### Goal

Make the Window menu express commands, not visibility checkboxes or actor ids.

### Work

- Replace menu window action identity with discriminated actions:

```text
open-or-focus-type(typeKey)
new-instance(typeKey)
focus-instance(instanceId)
```

- Singleton rows:
  - click opens if missing;
  - click focuses if live;
  - no checkbox close.
- Multi-instance type rows:
  - click focuses most recently active live instance if one exists;
  - if none exists, either create one or route to `new-instance`, according to
    feature policy;
  - expose an explicit `New X` command for additional instances.
- Use the activation sequence from Step 2 as the only MRU source. App Menu must
  not infer MRU from DOM order, frame order, actor id, or z-index.
- Future instance submenu/list can be added later. The first implementation can
  keep the UI simple as long as action identity is correct.
- Ensure App Menu remains actor-input driven; no DOM click shortcut.
- Tab action hit data should carry both `viewActorId` and `identity`. The
  lifecycle controller must verify they still refer to the same live view before
  closing, so stale actor ids or actor id reuse cannot close the wrong tab.

### Boundary

- Do not implement keyboard menu navigation in this step.
- Do not make menu close normal windows.

### Tests

Targeted:

```text
npm run test -w wallpaper-tesseract -- app-menu-model app-menu-bar-component app-menu-bar-actor-factory window-frame-lifecycle-controller architecture-boundaries
npm run typecheck -w wallpaper-tesseract
```

Required cases:

- existing singleton menu row focuses instead of creating duplicate;
- missing singleton menu row creates;
- multi-instance `New X` creates another instance;
- type row focuses MRU instance;
- stale actor id in hit data cannot close or focus the wrong instance;
- stale tab close hit data with mismatched `viewActorId + identity` is rejected;
- architecture boundary: App Menu source must not hard-code `scene`, `debug`,
  or `hierarchy` actor ids.

### Acceptance

- menu identity is type/instance based;
- menu can support multiple instances without being rewritten;
- normal window close remains tab/frame chrome responsibility.

## Step 6 - Add a Lightweight Multi-Instance Pilot

### Goal

Prove true multi-instance behavior without using Scene as the pilot.

### Preferred Pilot

Use a minimal Inspector-like view:

- simple content component;
- normal actor/component path;
- dockable;
- multi-instance enabled;
- no renderer, Camera3, fullscreen, or app-level singleton resource.

The pilot may be a development feature if product UX is not ready, but it must
run through the same registry, lifecycle, menu, docking, close, and persistence
paths as real views.

### Work

- Register `inspector` as a multi-instance view type.
- Add `New Inspector` or equivalent menu command.
- Ensure each instance has a distinct title or suffix.
- Allow root/floating/split docking.
- Allow closing one instance without affecting another.
- Persist and hydrate multiple inspector instances.

### Boundary

- Do not use Scene multi-instance yet.
- Do not add complex Inspector behavior. The pilot exists to prove identity.

### Tests

Targeted:

```text
npm run test -w wallpaper-tesseract -- window-frame-lifecycle-controller window-workspace-layout-persistence app-menu-model app-menu-bar-component
npm run typecheck -w wallpaper-tesseract
npm run build -w wallpaper-tesseract
```

Required cases:

- create two Inspector instances;
- dock one into root and one into floating frame;
- split inspectors into separate panes;
- close one inspector and verify the other remains live;
- reload persisted layout and verify distinct instance ids remain;
- menu type action focuses MRU instance.

### Acceptance

- Step 9 can be called complete only after this pilot passes unit and browser
  smoke.

## Step 7 - Browser Smoke Gate for Multi-Instance Closure

### Goal

Produce real browser evidence for the multi-instance loop and regressions that
unit tests cannot catch.

### Smoke Scenarios

Run Vite dev server and record report/data under `temp/`.

Desktop viewport:

- load app with root Scene;
- create two Inspector instances from Window menu;
- dock one Inspector into root, leave one floating;
- split or merge at least one tabset;
- close only one Inspector tab;
- reload and verify the closed instance stays gone while the other remains;
- verify Window menu can focus existing Inspector and create a new one;
- verify Scene still renders Tesseract and Camera3 overlay;
- verify console errors are 0.

Mobile/narrow viewport:

- menu remains reachable;
- root/floating tab close buttons stay inside tab rect;
- no text overlap that prevents actor-input hit testing.

### Tests

Automated where possible with Playwright/in-app browser. If drag/drop cannot be
fully automated, collect DOM state plus manual pointer smoke notes in the report.

Always finish with:

```text
npm run test -w wallpaper-tesseract
npm run typecheck -w wallpaper-tesseract
npm run build -w wallpaper-tesseract
```

### Acceptance

- smoke report records instance ids, type keys, frame ids, root/floating/split
  state, and console errors;
- smoke report records each Inspector as a four-tuple:
  `typeKey / instanceId / viewActorId / frameId`;
- no stale actor/canvas/frame remains after close/reload;
- Step 9 is upgraded from "partial" to "complete".

## Step 8 - Resume Remaining Cleanup Plan

Only after Step 9 is truly complete:

- continue naming and persistence cleanup from
  `temp/window-docking-remaining-work-plan.md`;
- stabilize opaque dock-tree id contract;
- split large frame component internals if still needed;
- design Scene multi-instance separately when there is a real product need,
  such as four-view layout.

## Global Regression Gates

These invariants must stay green through every step:

- `closeView(...)` cleanup success means close is committed; later exceptions
  are warnings and must not leave registry/dock tree split.
- `closeFrame(...)` must not prune live views if per-view cleanup fails.
- normal tab close removes live/persisted view instances and keeps
  `hiddenViewKeys` empty.
- runtime-only fullscreen/isolation frames are never persisted.
- App Menu uses actor input, not DOM click mutation.
- view factories create view content under a provided frame actor.
- Actor ids are runtime ids only.
- runtime frame/tab operations validate `viewActorId + identity` together when
  both are available.
- MRU behavior comes from lifecycle activation sequence, not derived UI order.

## Stop Conditions

Stop for plan revision if any of these occur:

- schema v2 requires persisting actor ids to work;
- Scene cleanup requires reviving a full-frame factory path;
- menu actions cannot distinguish type, instance, and actor ids cleanly;
- runtime tab operations require replacing `viewActorId` with `instanceId`;
- MRU cannot be exposed from lifecycle/catalog without App Menu guessing from
  DOM/frame order;
- multi-instance pilot forces app composition to hard-code per-window policy;
- browser smoke shows intermittent stale frame/content after close or reload.
