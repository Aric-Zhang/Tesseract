# Project Prism: Engine Modularization Outline

Date: 2026-06-07

Current phase model assessment:

```text
temp/project-prism-phase-model-current-assessment.md
```

Current Phase 2 implementation plan:

```text
temp/project-prism-phase-2-actor-core-extraction-implementation-plan.md
```

## Codename

本次大重构代号：**Project Prism**。

命名理由：

- Runtime 负责 world、camera、projection、frame source 的真实计算链路；
- Editor 只通过 UI、Gizmo、command/query port 观察、组合、操作 Runtime；
- 4D -> 3D -> 2D 的投影关系像棱镜一样，把高维世界逐层投射为可显示画面。

Project Prism 的核心目标不是“整理目录”，而是把当前 app 内已经成形的
Actor/Component、Window/Dock UI、4D/3D Runtime、Editor UI 拆成可复用、
可独立发布、边界清晰的包。这个计划不追求维护过渡稳定层；它优先维护长期架构。

## Non-Negotiable Direction

Project Prism 必须避免“拆了包，但旧耦合换个目录继续存在”。

因此执行原则是：

- 先定义最小公共契约，再移动文件；
- 先去掉跨层能力，再抽 package；
- Runtime 不能依赖 Editor/UI/Gizmo；
- UI framework 不能知道 Tesseract、Camera3、Scene renderer 或 editor feature；
- Actor core 不能携带 gizmo、scene state、frame update、DOM 或 Three 能力；
- Wallpaper app 最终只做 bootstrap/composition，不承载窗口策略、runtime 资源所有权或 editor 功能实现。

## North Star Dependency Graph

下图中，右侧可以依赖左侧，左侧不能反向依赖右侧：

```text
actor-core <- actor-input <- ui-framework <- editor <- wallpaper-app
actor-core <- runtime-core <- runtime-three <- editor <- wallpaper-app
packages/four-* <- runtime-core/runtime-three
gizmo-core <- actor-input
```

关键判断：

- `actor-core` 是所有 actor/component 系统的骨架；
- `actor-input` 是 `actor-core + gizmo-core` 的 adapter，不属于 actor core；
- `ui-framework` 依赖 actor/input 基础，只提供通用桌面 UI；
- `runtime-core` 依赖 actor core 和数学/投影模型，不依赖 Three、DOM、UI、Editor；
- `runtime-three` 是 runtime backend，可依赖 Three/WebGL，但仍不依赖 Editor/UI；
- `editor` 组合 UI framework 与 Runtime ports，提供 Debug/Inspector/Hierarchy/Scene View/Gizmo；
- `wallpaper-app` 只安装 runtime/editor/ui，并连接 Wallpaper Engine 环境。

## Hard Boundaries

这些边界必须作为 architecture boundary tests 长期保留。

### Actor Core Must Be Decapable

`actor-core` 不能直接移动当前 `apps/wallpaper-tesseract/src/actor-runtime`。
Phase 1A-1D 已经移除了旧 `ComponentRuntimeBridge`、`ComponentCapability`、
legacy capability string、`SceneCommandSink` business context，以及结构探测式
active-input cancellation。当前剩余阻塞更窄：`UpdateFrame` 归属、
actor-window focus/stack context、state observer bridge staging、central
component-definition installer 仍需在 Phase 1F / Phase 2 前明确。

`actor-core` 只允许包含：

- `ActorSystem`；
- `Actor` / actor tree；
- `Component`；
- `ComponentRegistry`；
- `ComponentDefinition`；
- component dependency installation；
- lifecycle hooks；
- parent / active / effective-active；
- actor tree query。

`actor-core` 不允许包含：

- `updateFrame`；
- gizmo binding；
- state observer binding；
- scene command sink；
- DOM / `HTMLElement` / `Document`；
- Three.js；
- `gizmo-core`；
- `scene-runtime`；
- `window-runtime`；
- `app-runtime`。

Frame update、input binding、state observer binding 应移到 adapter 层：

```text
actor-core
  <- actor-input
  <- runtime/editor/ui binding adapters
```

### State Domains Must Split Before Runtime Extraction

当前 `scene-runtime` 不是纯 runtime。`sceneParameterPaths` 混合了 runtime、
workspace mode、debug window、hierarchy window、selection 等状态。

Project Prism 必须拆成三个状态域：

```text
runtime-state:
  worlds, cameras, projections, frame clock, runtime render graph

editor-state:
  selection, workspace mode, inspector target, editor command state

ui-layout-state:
  window bounds, dock layout, menu state, workspace visibility
```

约束：

- Runtime package 不包含 Debug/Hierarchy window path；
- Runtime package 不包含 editor selection path；
- UI layout state 不进入 runtime-core；
- Editor 只能通过 command/query port 修改 runtime state。

### Scheduler Domains Must Split

当前 `SceneRuntime.register()` 混合运行 Camera motion、workspace controller、
layout persistence 等 runtime/editor/UI 任务。Project Prism 必须拆成：

```text
RuntimeFrameScheduler:
  world update
  projection graph update
  render graph update
  frame source production

EditorFrameScheduler:
  menu/window focus
  docking/layout persistence
  debug log flush
  editor state observers
  UI-only runtime bridges
```

Runtime package 不能成为所有服务的 update bus。

### Runtime Must Not Depend On Editor

`runtime-core` 不允许 import：

- editor feature；
- debug/inspector/hierarchy window；
- menu/window/dock UI；
- Gizmo；
- actor-input；
- app composition；
- DOM / `HTMLElement` / `Document`。

Runtime 可以提供：

- world actor；
- camera actor；
- projection actor/component；
- render target / frame source interface；
- runtime command port；
- runtime query port；
- scheduler interface。

Runtime 不提供：

- Scene window；
- tab/dock/menu；
- editor toolbar；
- camera gizmo；
- hierarchy panel。

### UI Framework Must Be Product-Agnostic

`ui-framework` 只包含通用桌面 GUI 能力：

- app shell；
- window frame；
- root/floating frame；
- tab；
- dock；
- splitter；
- menu bar；
- layout persistence；
- pointer/input surface；
- frame/view lifecycle ports。

`ui-framework` 不允许知道：

- Tesseract；
- 4D/3D camera；
- Debug Log；
- Inspector 具体内容；
- Hierarchy 的业务数据；
- Scene renderer；
- `sceneParameterPaths`。

### Editor Owns Presentation, Not Runtime Resources

Editor 负责：

- 创建 Scene View；
- 把 Runtime 输出的 `FrameSource` 显示到 UI；
- 将用户输入/Gizmo 转换为 Runtime command；
- 管理 Debug/Inspector/Hierarchy/Menu/Dock；
- 选择哪个 Runtime frame source 显示在哪个 Scene View。

Editor 不应该成为 Runtime world/camera/projection 的真实所有者。

## Target Packages And Contracts

### Package 1: `actor-core`

Purpose:

提供可被任何工程复用的 Actor + Component 基础设施。

Candidate source:

- `apps/wallpaper-tesseract/src/actor-runtime` 中去能力化后的核心部分；
- actor parent/active/effective-active model；
- component registry / definition / dependency resolver。

Public API outline:

```text
Actor
ActorSystem
Component
ComponentRegistry
ComponentDefinition
ComponentType
ActorLifecycleHook
ActorTreeQuery
```

Acceptance:

- package has no DOM/Three/Gizmo dependency；
- package has no scene/window/app runtime dependency；
- app can import actor primitives from package；
- parent destroy and effective-active semantics remain unchanged。

### Package 2: `actor-input`

Purpose:

提供 actor/component 与 `gizmo-core` pointer kernel 的 adapter。

Included:

- actor input participant contract；
- actor input router；
- active interaction path tracking；
- stack priority / local route score rules；
- legacy-free pointer bridge。

Acceptance:

- depends on `actor-core` and `gizmo-core`；
- `actor-core` does not import it；
- `runtime-core` and `runtime-three` do not import it；
- `ui-framework` and `editor` may use it for pointer-driven UI/Gizmo。

### Package 3: `ui-framework`

Purpose:

提供可移植的 Editor-style desktop UI framework。

Hard dependency:

`window-view-instance-identity-continuation-plan.md` 必须先完成。否则
`WindowViewKey`、actor id、instance id 的旧混用会被固化进公共 API。

Included:

- app shell/layout slots；
- floating/root frame；
- tab chrome；
- dock tree；
- dock target region；
- dock preview；
- frame lifecycle；
- view factory/type registry；
- menu model/menu bar；
- layout persistence；
- actor-input-backed UI surface。

Public API outline:

```text
WindowFrame
WindowFrameTab
WindowViewIdentity
WindowViewTypeRegistration
WindowFrameLifecycleController
WindowFramePort
WindowFramePortRegistry
DockTree
DockTargetRegion
AppMenuBar
WindowMenuModel
LayoutPersistence
```

Acceptance:

- no import from tesseract/runtime/editor-specific features；
- can create windows/tabs/dock/menu in a fixture without 4D/Three scene；
- all input remains actor/component based；
- no DOM click mutation shortcuts；
- root dock frame and floating frame share the same surface logic；
- menu actions are type/instance actions, not product-specific ids。

### Package 4: `runtime-core`

Purpose:

提供可独立运行、无 UI/DOM/Three 依赖的 world/camera/projection graph。

Included:

- runtime actor/component definitions；
- 4D world actor；
- 3D world actor；
- camera actors；
- projection graph；
- runtime command/query contracts；
- frame source interface；
- runtime frame scheduler interface。

Public contracts:

```text
RuntimeCommandSink
RuntimeQueryPort
FrameSource
FrameSourceRegistry
WorldGraphQuery
SelectionAddress
RuntimeFrameScheduler
```

Acceptance:

- no dependency on `ui-framework` or `editor`；
- no dependency on actor-input/gizmo；
- no DOM/`HTMLElement`/`Document`；
- can instantiate multiple worlds/cameras in tests；
- camera math works without Gizmo。

### Package 5: `runtime-three`

Purpose:

提供基于 Three.js/WebGL 的 runtime backend。

Included:

- Three scene/camera/render backend；
- 3D render target implementation；
- Three-backed `FrameSource`；
- bridges to existing `packages/four-*` where needed。

Acceptance:

- depends on `runtime-core`；
- may depend on Three/WebGL；
- does not depend on `ui-framework` or `editor`；
- Scene View consumes its `FrameSource` but does not create its world/renderer directly。

### Package 6: `editor`

Purpose:

提供基于 `actor-core + actor-input + ui-framework + runtime-core/runtime-three`
的具体编辑器功能。

Included:

- Debug window；
- Inspector window；
- Hierarchy window；
- Scene View；
- Camera Gizmo；
- Runtime object/component inspector；
- editor menu commands；
- editor workspace composition；
- editor-specific command routing。

Editor may depend on:

- `actor-core`；
- `actor-input`；
- `ui-framework`；
- `runtime-core`；
- `runtime-three`。

Editor must operate Runtime through:

- `RuntimeCommandSink`；
- `RuntimeQueryPort`；
- `FrameSourceRegistry`；
- `WorldGraphQuery`；
- `SelectionAddress` or equivalent object/component reference model。

Acceptance:

- Debug/Inspector/Hierarchy/Scene View are editor features；
- Scene View can display any compatible Runtime frame source；
- Scene View does not create 4D/3D worlds directly except through runtime/editor commands；
- Gizmo manipulates camera through Runtime command/component ports。

### Package 7: Wallpaper App Composition

Purpose:

Thin app package that wires everything together for Wallpaper Engine.

Responsibilities:

- create actor system/component registry；
- install runtime world(s)；
- install editor workspace；
- connect render loop；
- register Wallpaper-specific lifecycle/bootstrap；
- install browser/app shell root。

Non-responsibilities:

- no window policy；
- no scene runtime internals；
- no editor feature implementation；
- no runtime component internals；
- no direct renderer/world ownership logic。

## Runtime Projection Architecture

Project Prism treats projection as a first-class runtime graph.

### 4D To 3D

```text
4DWorld
  -- observed by -->
4DCamera
  -- projects into -->
3DWorld or 3DProjectionBuffer
```

Potential components:

```text
FourWorldComponent
FourCameraComponent
FourToThreeProjectionComponent
ProjectionOutputComponent
```

### 3D To 2D

```text
3DWorld
  -- observed by -->
3DCamera
  -- renders into -->
2DFrameSource
```

Potential components:

```text
ThreeWorldComponent
ThreeCameraComponent
ThreeToTwoProjectionComponent
FrameSourceComponent
```

### Scene View

Scene View is editor UI:

```text
SceneView
  input: FrameSource
  output: visible UI viewport
  optional: editor gizmo overlay
```

Scene View must not be required for Runtime to render.

## Transform, Tree, And Projection

Project Prism may later introduce transform-like components, but parent-child
should not become overloaded.

Recommended split:

```text
Actor parent tree:
  lifecycle, ownership, active inheritance, hierarchy

Transform component:
  local/world transform, dimension-specific transform data

Projection component:
  world/camera/render target relation
```

Projection relation is not necessarily parent-child. A 4D camera can project one
4D world into a 3D world without being that world actor's child. A 3D camera can
produce a 2D frame source without depending on any editor Scene View.

## Migration Phases

### Current Phase Model Verdict

The original phase split was directionally correct, but part of it is now
outdated against the current implementation:

- The old `Phase -1: View Instance Identity Continuation` should no longer be a
  standalone phase. The identity foundation has already landed far enough to be
  treated as a UI framework extraction gate, with remaining evidence folded into
  Phase 0B and Phase 3.
- The old ordering put `Actor Core Purification And Extraction` before the
  state/scheduler/input bridge split that actually makes actor core pure. That
  is backwards. The mixed `SceneFrame`, `SceneCommandSink`, gizmo capability,
  and state observer capability references must be split first.
- Phase 0 is now a real multi-part baseline:
  - Phase 0A boundary helper and zone map: complete.
  - Phase 0C smoke baseline: recorded.
  - Phase 0D interaction/render host gate: complete.
  - Phase 0B generated report and structured smoke evidence: complete.
- Formal package extraction remains blocked by the package-target blockers
  recorded in the Phase 0B report, not by missing Phase 0 evidence.

The revised model below keeps package extraction honest: first freeze facts and
evidence, then split shared spine contracts, then extract packages.

### Phase Dependency Gates

These gates clarify what can proceed in parallel and what must wait:

- Formal package extraction must wait for the relevant package target blockers
  to be resolved.
- App-local refactors that reduce debt may proceed after Phase 0 completion
  only if they do not create new public package APIs and do not weaken boundary
  tests.
- Phase 2 actor package extraction must wait for Phase 1 shared-spine
  decoupling. Moving files first is explicitly forbidden.
- Phase 3 UI framework extraction must wait for:
  - Phase 1 UI state/scheduler ports;
  - Phase 2 actor-core/actor-input package boundaries;
  - a green structured browser evidence gate.
- Phase 4 runtime-core contract work may begin as design and app-local
  prototype after Phase 0B, but real runtime package extraction must wait until
  Phase 1 state/scheduler domains are split.
- Phase 7 app thinning must wait for package-owned installers from UI,
  runtime, and editor packages.

### Phase 0: Boundary And Evidence Freeze

Goal:

Make future package boundaries executable before moving production ownership.

Current status:

- Phase 0A complete.
- Phase 0C baseline recorded.
- Phase 0D complete.
- Phase 0B complete.

Phase 0B completion evidence:

- boundary report generated from
  `apps/wallpaper-tesseract/src/test-support/project-prism-boundary-facts.ts`;
- package-target matrix summary emitted from the same facts;
- browser smoke data regenerated under
  `apps/wallpaper-tesseract/src/test-support/project-prism-smoke-contract.ts`;
- Phase 0 acceptance report separates Phase 0 completion from later
  package extraction debt.

Acceptance:

- no production file is unclassified;
- no candidate zone has hidden reverse dependency;
- every mixed file is explicit debt with a deletion condition;
- browser evidence records structured DOM target, actor input hit, action
  result, screenshot path, viewport, and console errors;
- formal package extraction is either explicitly allowed or explicitly blocked
  per package target.

Reference plan:

```text
temp/project-prism-phase-0-acceptance-report.md
```

### Phase 1: Shared Spine Decoupling

Goal:

Split the mixed contracts that currently block more than one future package.
This phase does not extract packages yet; it removes the cross-domain concepts
that would poison extracted APIs.

Why this phase exists:

Historically, `actor-runtime/component.ts`, `ComponentRuntimeBridge`,
`scene-runtime`, and window/app workspace services shared frame update, command,
state, input, and scheduler concepts. Phase 1A-1D removed the broadest bridge
and capability coupling. The remaining Phase 1 work is to lock the boundary
facts and decide the still-open actor-core extraction blockers without moving
packages prematurely.

Work:

Phase 1 should be split into small app-local subphases:

```text
Phase 1A: scheduler/update ports
Phase 1B: command/state domain ports
Phase 1C: component contract decapability
Phase 1D: ComponentRuntimeBridge responsibility split
Phase 1E: boundary lock and deletion of old capability names
Phase 1F: actor-core extraction readiness decision
```

Phase 1A work:

- define scheduler/update ports that do not expose `SceneFrame` as an
  actor-core component primitive;
- migrate UI/editor services away from scene runtime registration where the
  service is not runtime-world work;
- keep runtime frame update and editor/UI update as separate concepts.

Phase 1B work:

- split command sink concepts into runtime command, editor command, and UI
  layout command ports;
- split state facts into `runtime-state`, `editor-state`, and
  `ui-layout-state`;
- ensure UI layout state owns window/menu/dock paths and geometry.

Phase 1C work:

- move gizmo capability and state observer capability out of core component
  contracts into binding/adaptor layers;
- remove `SceneFrame` and scene command concepts from the core component shape.

Phase 1D work:

- completed through the Step 1D amendment;
- `ComponentRuntimeBridge` and `ComponentCapability` are removed from
  actor-runtime;
- gizmo registration, state observer registration, and active input
  cancellation are owned by domain attachment runtimes;
- active input cancellation is explicit attachment metadata, not method-shape
  probing.

Phase 1E work:

- write the Phase 1 acceptance report;
- regenerate boundary facts and prove old capability/bridge facts stay deleted;
- keep all new seams legacy-free. Do not add wrapper adapters that preserve old
  concepts as public contracts.

Phase 1F work:

- decide `UpdateFrame` ownership before actor-core extraction;
- decide whether actor-window focus/stack context belongs in actor-core,
  actor-input, or UI framework;
- document remaining state observer / component definition installer blockers
  as precise Phase 2 inputs.

Acceptance:

- component core no longer requires `SceneFrame`;
- component business context no longer exposes `SceneCommandSink` directly;
- generic UI services do not register themselves through scene runtime types;
- runtime scheduler does not own menu/window/layout services;
- editor/UI scheduler does not own world/projection updates;
- boundary tests fail if the old mixed concepts re-enter candidate zones.
- tests prove each Phase 1 subphase does not add new product-specific imports
  to future package candidates.
- Phase 2 does not begin until Step 1F records the actor-core extraction
  decision.

### Phase 2: Actor Core And Actor Input Extraction

Goal:

Extract the reusable actor/component foundation and the actor-input adapter
after Phase 1 makes those APIs clean.

Work:

- extract `actor-core` with actor identity, parent tree, enabled/effective
  active state, lifecycle, component definition, dependency installation, and
  component registry primitives;
- extract `actor-input` as `actor-core + gizmo-core`, not as part of actor
  core;
- keep stack priority, route score, active path cancellation, and input
  participant contracts in actor-input;
- keep DOM, Three, scene runtime, window runtime, editor features, and app
  runtime out of actor-core;
- update app imports to use package APIs only after package tests exist.

Acceptance:

- `actor-core` has no dependency on `gizmo-core`, Three, DOM, scene-runtime,
  window-runtime, app-runtime, or editor features;
- `actor-input` depends on `actor-core` and `gizmo-core` only through explicit
  ports;
- parent destroy, effective-active, component dependency, input routing, click,
  double-click, and active cancellation tests pass;
- app code imports actor primitives from the package boundary.

### Phase 3: UI Framework Port Split And Extraction

Goal:

Extract product-agnostic window/tab/dock/menu/layout code into `ui-framework`.

Why this phase follows actor extraction:

The UI framework is actor/component-driven and pointer-driven. It should depend
on clean actor/input packages, not app-local actor runtime or scene-runtime
state.

Work:

- replace UI usage of scene-runtime `ParameterPath`, `Vec2`, `RuntimeObject`,
  frame update, and workspace mode paths with UI-owned ports;
- keep `WindowViewIdentity` public API split clean:
  - persistent/menu identity uses `typeKey` and `instanceId`;
  - runtime hosting/input still uses `viewActorId`;
- extract app shell, floating/root frame, shared tab chrome, dock tree,
  dock target region, dock preview, splitter, menu model, frame lifecycle,
  view type registry, and layout persistence;
- provide UI test fixtures that create dockable windows without Scene,
  Tesseract, Camera3, Debug content, Hierarchy content, or Inspector content;
- keep actor-input as the only pointer mutation path.

Subphase order:

```text
Phase 3A: UI-owned state/scheduler/geometry ports
Phase 3B: framework fixture that runs without product features
Phase 3C: package extraction
Phase 3D: browser smoke parity after extraction
```

Do not create a package before Phase 3B can run a generic fixture without
Scene/Tesseract/Camera3/Debug/Hierarchy/Inspector content.

Acceptance:

- `ui-framework` imports no Tesseract, Camera3, Scene renderer, Debug,
  Hierarchy, Inspector, or `sceneParameterPaths`;
- floating frame and root frame share the same frame surface/tab chrome logic;
- menu actions are generic type/instance actions, not product-specific IDs;
- wide, mobile, root/floating overlap, split-region docking, and repeated
  dock/undock browser evidence remains green.
- package API does not expose app-local actor ids, scene parameter paths, or
  product-specific window keys.

### Phase 4: Runtime Core Contracts And Projection Graph

Goal:

Define renderer-agnostic runtime world/camera/projection/frame-source contracts
before moving real Tesseract/Camera3 ownership.

Work:

- define `RuntimeWorldActor`, `RuntimeCameraActor`, `ProjectionLink`,
  `FrameSource`, `RuntimeCommandSink`, `RuntimeQueryPort`,
  `WorldGraphQuery`, and selection/address contracts;
- model 4D world, 3D world, 4D camera, 3D camera, projection relation, and
  frame source as runtime facts;
- ensure projection relations are not overloaded onto actor parent-child
  ownership;
- add headless tests for multiple worlds, multiple cameras, and projection
  graph construction;
- keep runtime-core free of DOM, Three, UI framework, editor, gizmo, and
  actor-input.

Subphase order:

```text
Phase 4A: renderer-agnostic runtime contracts
Phase 4B: headless multi-world/multi-camera fixture
Phase 4C: editor command/query adapter prototype
Phase 4D: package extraction gate
```

Do not move real Tesseract/Camera3 ownership in Phase 4. This phase defines and
tests the shape first.

Acceptance:

- runtime-core can represent 4D -> 3D -> 2D projection without any editor Scene
  View;
- runtime-core can create multiple worlds/cameras in tests;
- editor can query and command runtime through ports, not direct component
  mutation;
- runtime-core is ready to host real Tesseract/Camera ownership in the next
  phase.

### Phase 5: Runtime Three Backend And Scene View Inversion

Goal:

Move actual render ownership out of editor Scene View and into runtime packages,
while keeping Three/WebGL isolated from renderer-agnostic runtime-core.

Work:

- create `runtime-three` backend for Three scene/camera/render target ownership;
- move Tesseract/4D object update ownership into runtime world actors;
- move Camera3 model/control ownership into runtime camera actors or runtime
  backend adapters;
- produce 2D frame sources consumed by editor Scene View;
- make Scene View display a selected frame source instead of creating or owning
  runtime worlds/cameras;
- make Camera Gizmo mutate camera state through runtime commands.

Acceptance:

- runtime renders without editor;
- editor Scene View can display runtime output but does not own world/camera
  resources;
- Camera3 works without Gizmo;
- Gizmo is an editor input layer over runtime commands;
- `runtime-three` may import Three but not editor/UI/app composition.

### Phase 6: Editor Package Extraction

Goal:

Move concrete editor features into an `editor` package that composes
`ui-framework`, runtime ports, and actor-input.

Work:

- extract Debug, Inspector, Hierarchy, Scene View, Camera Gizmo, editor menu
  commands, editor workspace composition, and editor command/query bindings;
- make editor window registration/defaults editor-owned, not app-owned;
- make Scene View select and display runtime frame sources through
  `FrameSourceRegistry`;
- keep editor-specific content out of `ui-framework`.

Acceptance:

- editor depends on actor-core, actor-input, ui-framework, runtime-core, and
  runtime-three;
- runtime packages do not import editor;
- UI framework does not import editor feature content;
- editor can be installed by app composition through public installer APIs.

### Phase 7: Thin Wallpaper App Composition

Goal:

Turn the Wallpaper app into bootstrap/composition only.

Work:

- app creates shell/root services;
- app installs actor/component package definitions through package-owned
  installers;
- app installs runtime package defaults;
- app installs editor package defaults;
- app connects render loop and Wallpaper Engine lifecycle;
- app stops wiring concrete Debug/Hierarchy/Inspector/Scene window policies,
  actor IDs, hierarchy metadata, window defaults, or runtime ownership details.

Acceptance:

- app composition imports public installers/bootstrap ports only;
- app composition does not instantiate window lifecycle/controller/factory
  internals directly;
- app composition does not import concrete actor factories or runtime component
  internals;
- root validation and browser smoke remain green.

### Phase 8: Multi-World / Multi-Viewport Validation

Goal:

Prove the architecture supports the original Prism goal: multiple worlds,
multiple cameras, multiple Scene Views, and independent fullscreen sessions.

Scenarios:

- two independent 3D worlds;
- one 4D world projected into multiple 3D views;
- four-viewport layout similar to DCC software;
- multiple Scene Views, each fullscreen-capable;
- Camera/Gizmo association is per Scene View;
- window/tab/dock layout persists across reload;
- runtime can render without editor installed.

Acceptance:

- fullscreen one Scene View does not hide or corrupt unrelated Scene Views;
- each Scene View has explicit frame source and camera binding;
- world/camera/projection graph remains inspectable;
- no global singleton Scene assumptions remain;
- browser smoke covers desktop, mobile, docking loop, fullscreen/restore, and
  Camera3 interactions.

## Architecture Boundary Tests To Add

Recommended executable rules:

```text
dependency graph:
  actor-core <- actor-input <- ui-framework <- editor -> runtime-core/runtime-three
  runtime-core <- runtime-three
  no package cycle

actor-core:
  forbid gizmo-core
  forbid three
  forbid scene-runtime
  forbid window-runtime
  forbid HTMLElement
  forbid Document

actor-input:
  may import actor-core
  may import gizmo-core
  forbid runtime/editor product features

runtime-core:
  forbid HTMLElement
  forbid Document
  forbid window-runtime
  forbid features/app-menu
  forbid gizmos
  forbid editor

runtime-three:
  may import three
  may import runtime-core
  forbid editor/ui-framework/gizmos

ui-framework:
  forbid sceneParameterPaths
  forbid tesseract
  forbid camera3
  forbid three
  forbid editor feature imports

editor:
  may depend on runtime/ui-framework/actor-input
  runtime must not import editor

app:
  forbid direct window internals
  forbid runtime component internals
  forbid editor feature internals
  allow installer/bootstrap API only
```

## Testing Strategy

Every phase should include:

```text
npm run test -w wallpaper-tesseract
npm run typecheck -w wallpaper-tesseract
npm run build -w wallpaper-tesseract
```

When packages are added, also add package-level checks:

```text
npm run test -w actor-core
npm run test -w actor-input
npm run test -w ui-framework
npm run test -w runtime-core
npm run test -w runtime-three
npm run test -w editor
```

Browser smoke remains required for:

- window/tab/dock/menu changes；
- Scene View display；
- Camera Gizmo；
- fullscreen/restore；
- multi-viewport layout；
- mobile/narrow viewport usability。

## Stop Conditions

Stop and revise the plan if:

- actor-core still needs DOM/Three/gizmo/scene-runtime dependencies；
- Runtime cannot render without importing Editor；
- Scene View must own world/camera resources to work；
- `scene-runtime` state cannot be split into runtime/editor/ui-layout domains；
- Runtime scheduler still needs UI/editor services；
- UI framework needs product-specific ids/paths to function；
- view identity still mixes actor id, tab id, and persistent instance id；
- projection graph cannot support multiple worlds/cameras without global state；
- fullscreen Scene View requires global singleton Scene assumptions；
- app composition grows new feature logic instead of becoming thinner。

## Success Definition

Project Prism is successful when:

- Actor/Component runtime is a reusable, decapable package；
- actor input is a separate reusable adapter, not part of actor core；
- window/tab/dock/menu UI is a reusable product-agnostic package；
- Runtime core can independently model worlds/cameras/projections and frame sources；
- Three/WebGL backend is separate from runtime-core；
- Editor can display and manipulate Runtime through ports without owning Runtime resources；
- current Wallpaper app is a thin composition layer；
- multiple worlds, cameras, Scene Views, and fullscreen view sessions are possible without rewriting the architecture again。
