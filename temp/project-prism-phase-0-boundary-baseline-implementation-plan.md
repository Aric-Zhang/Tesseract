# Project Prism Phase 0: Boundary Baseline Implementation Plan

Date: 2026-06-07

Status note:

This document is a historical Phase 0 implementation plan. Its references to
`Phase -1` are superseded by the current phase model:

```text
temp/project-prism-phase-model-current-assessment.md
temp/project-prism-engine-modularization-outline.md
```

Current execution is past Phase 0B and Step 1D. Do not use this document's old
`Phase -1` wording as the active roadmap. The current executable roadmap is:

```text
temp/project-prism-phase-1-shared-spine-implementation-plan.md
```

Related outline:

- `temp/project-prism-engine-modularization-outline.md`

## Phase Goal

Phase 0 的目标不是抽包，也不是维护当前过渡层稳定，而是先建立一套可长期执行的
架构边界测试和基线报告，让后续 Project Prism 的每一次大胆重构都有硬边界保护。

这一步要把“未来 package 边界”提前投射到当前 monorepo 目录上：

```text
actor-core <- actor-input <- ui-framework <- editor <- wallpaper-app
actor-core <- runtime-core <- runtime-three <- editor <- wallpaper-app
```

Phase 0 结束时，后续 Phase -1 / Phase 1 / Phase 2 不应该再靠口头约定判断是否越界。
它们应该被测试直接拦住。

## Current Status

当前仓库还不能标记为 Phase 0 complete。已存在的 `architecture-boundaries.test.ts`
能证明旧边界测试仍然通过，但还没有完成 Phase 0 要求的实施产物。

Phase 0 complete 前必须存在：

```text
apps/wallpaper-tesseract/src/test-support/architecture-boundaries.ts
temp/project-prism-phase-0-boundary-report.md
temp/project-prism-phase-0-smoke-report.md
temp/project-prism-phase-0-smoke-data.json
temp/project-prism-phase-0-interaction-host-report.md
```

如果这些产物缺失，只能说 Phase 0 计划存在，不能说 Phase 0 已落地。

## Refactor Principles

本阶段遵循这些原则：

- 架构设计优先于过渡兼容。
- 删除 legacy 和双轨事实源，不新增临时 adapter 掩盖问题。
- 允许测试暴露深层错误；暴露后要么修，要么停下来修订计划。
- 当前无法立即清掉的耦合不得伪装成目标架构；必须标成 debt zone + blocker。
- 每清理一个边界成果，都必须用 architecture boundary test 锁住。
- 不为了让 Phase 0 看起来“绿”而加入宽泛 allowlist。
- 不把 `temp/` 文档、smoke artifact 当成 production 事实源。
- zone map、dependency graph、blocker report 必须来自同一套扫描事实源，不手写两份事实。

## Commit Slices

Phase 0 范围较大，必须拆成三个可验收提交点。不要一次性把所有规则堆进
`architecture-boundaries.test.ts`。

### Phase 0A: Test Harness And Zone Map

目标：

- 抽出 boundary helper；
- 建立 source zone map；
- 建立 debt zone 机制；
- 生成第一版 boundary report。

完成后，仍不要求所有依赖方向都锁死，但所有 production 文件必须有明确归属或 debt。

### Phase 0B: Dependency Rules And Legacy Locks

目标：

- 基于解析 import/export-from 的依赖图建立 zone dependency rules；
- 锁住 legacy 删除成果；
- 建立 actor-core / ui-framework / runtime / app composition 的第一批禁入规则。

完成后，旧 API 不能再以新名字复活，新的越界 import 会被测试直接拦住。

### Phase 0C: Smoke Baseline And Exit Report

目标：

- 运行真实浏览器 smoke；
- 记录可对比数据；
- 产出 Phase 0 exit report；
- 明确 Phase -1 / Phase 1 / Phase 2 的 blocker。

完成后，Phase 0 才能被标记为 complete。

## Non-Goals

Phase 0 不做：

- 不创建新 workspace package。
- 不移动大量生产代码到 `packages/*`。
- 不实现 Phase -1 的完整 view instance identity 闭环。
- 不把当前 `actor-runtime` 直接改名为 `actor-core`。
- 不把 `scene-runtime` 直接归入 runtime package。
- 不抽 UI framework。

如果某个边界测试暴露的问题必须依赖上述大迁移才能修，Phase 0 应将它记录为后续
Phase 的硬 blocker，而不是创建过渡兼容层。

## Expected Files

主要会改动：

```text
apps/wallpaper-tesseract/src/architecture-boundaries.test.ts
apps/wallpaper-tesseract/src/test-support/architecture-boundaries.ts
temp/project-prism-phase-0-boundary-report.md
temp/project-prism-phase-0-smoke-report.md
temp/project-prism-phase-0-smoke-data.json
```

允许少量生产代码删除/收口，但只限于被 Phase 0 测试直接证明的 legacy 残留。
如果需要大规模重排生产代码，应停下，转入对应 Phase 的计划。

## Step 0.0: Baseline Checkpoint

### Goal

冻结当前可运行事实，确认后续边界测试不是建立在未知坏状态上。

### Boundary

只收集事实，不修源码。发现当前测试失败时先定位原因；如果失败来自当前未提交开发状态，
应先处理或记录，不继续堆新边界测试。

### Work

- 记录当前 dirty scope：

```text
git status --short
```

- 跑当前验证：

```text
npm run test -w wallpaper-tesseract
npm run typecheck -w wallpaper-tesseract
npm run build -w wallpaper-tesseract
```

- 如果本轮涉及已有 package 边界，也跑 root 检查：

```text
npm run test
npm run typecheck
npm run build
```

- 创建或更新 `temp/project-prism-phase-0-boundary-report.md`：
  - 当前 commit / dirty scope；
  - 当前测试结果；
  - 当前已知 Project Prism blocker；
  - 当前 `temp/` 中需要保留的 smoke artifact。

### Tests

以上命令必须通过。若不通过，停止并修复当前基线。

### Effect

后续步骤有一份可比较的基线，避免把原本已坏的问题误判为边界测试引入的问题。

## Step 0.1: Boundary Test Harness

### Goal

这是 Phase 0 必须先做的步骤。把当前 `architecture-boundaries.test.ts` 从“单文件正则清单”
升级为可复用的边界测试工具层。后续每个 package 边界都用同一套扫描能力表达。

### Boundary

只新增测试支持工具，不引入生产代码依赖。测试工具不得被 production module import。

### Work

- 新增 `apps/wallpaper-tesseract/src/test-support/architecture-boundaries.ts`。
- 从 `architecture-boundaries.test.ts` 移出通用 helper。
- 提供这些测试工具：
  - `collectSourceFiles()`
  - `normalizeSourcePath()`
  - `parseStaticImports(source)`
  - `parseStaticExportFrom(source)`
  - `resolveImportSpecifier(fromFile, specifier)`
  - `listModuleEdges(files)`
  - `findForbiddenImports(files, rule)`
  - `findForbiddenSymbols(files, rule)`
  - `createSourceZoneMap(files, zones)`
  - `expectNoForbiddenImports(rule)`
  - `expectNoForbiddenSymbols(rule)`
- `parseStaticImports()` 至少覆盖：
  - `import ... from "x"`；
  - `import type ... from "x"`；
  - `export ... from "x"`；
  - `export type ... from "x"`；
  - side-effect import `import "x"`。
- 动态 `import()` 第一阶段不必完整解析，但必须报告为 `dynamic-import-debt`，不能静默忽略。
- 规范化：
  - relative path；
  - `.ts` / `index.ts` barrel；
  - workspace package import；
  - query suffix if any。
- 禁止测试 helper 读取 `temp/` 作为架构事实源。

### Tests

```text
npm run test -w wallpaper-tesseract -- architecture-boundaries
npm run typecheck -w wallpaper-tesseract
```

新增或保留断言：

- production 禁止 import `test-support`；
- boundary helper 自身不被 production module import；
- helper 能解析 barrel export，不允许 `index.ts` re-export 绕过规则。

### Effect

后续新增边界不再靠复制粘贴正则，减少“测试本身变成 legacy”的风险。

## Step 0.2: Source Zone Map And Debt Zones

### Goal

在还没抽 package 前，先用测试定义“哪些目录未来属于哪个 package”。这会暴露当前最危险的双轨事实源。

### Boundary

这一步不要求所有 zone 都已经纯净，但不允许把混合代码伪装成纯净代码。
无法归入目标 package 的文件必须进入明确 debt zone，而不是 allowlist。

### Work

在 boundary helper 中定义虚拟 zone：

```text
actor-core-candidate:
  actor tree / registry / lifecycle primitives that are already UI-free

actor-binding-debt:
  current Component contract / ComponentRuntimeBridge pieces that still know scene/gizmo/state

actor-input-candidate:
  actor input router and gizmo-core adapter candidates

ui-framework-candidate:
  window-runtime
  generic app-menu model/component
  window-workspace feature shell
  app-shell if product-agnostic

runtime-core-candidate:
  pure world/camera/projection/state candidates
  packages/four-*

runtime-three-candidate:
  Three/WebGL backend candidates

editor-candidate:
  debug
  hierarchy
  inspector
  scene view UI
  camera gizmo UI

app-composition:
  app/create-wallpaper-app.ts
  app/install-component-definitions.ts
  demo.ts

mixed-boundary-debt:
  files that currently combine package responsibilities and must be split before extraction

dynamic-import-debt:
  files with dynamic imports that cannot yet be classified by static edge rules
```

规则：

- 每个 production `.ts` 文件必须属于一个 zone。
- `*.test.ts` 和 `test-support` 可单独分类。
- 一个 production 文件不能同时属于多个 non-debt candidate zone。
- debt zone 必须输出到 boundary report。
- 每个 debt entry 必须说明：
  - 为什么混合；
  - 阻塞哪个 Phase；
  - 删除条件是什么。
- 新文件如果没有 zone，测试失败。

### Tests

```text
npm run test -w wallpaper-tesseract -- architecture-boundaries
```

新增断言：

- all production source files are classified；
- no production file lives in multiple candidate zones；
- debt zones are explicitly named and reported；
- no silent allowlist for mixed files。

### Effect

后续讨论“抽哪个包”时不再靠记忆，而是有一张可执行的未来 package 地图。

## Step 0.3: Dependency Graph Rules

### Goal

用 zone map 和解析出来的 module edges 建立依赖方向规则。优先锁住已经清理出来的边界，
发现反向依赖时直接修掉。

### Boundary

不为 production 越界创建临时 adapter。若越界源自深层职责混合，记录为对应 Phase blocker 并停止扩张规则。

### Work

新增 zone 依赖矩阵：

```text
actor-core-candidate:
  may import nothing product-specific

actor-binding-debt:
  may remain only as Phase 1 blocker
  must not expand into ui/runtime/editor new code

actor-input-candidate:
  may import actor-core-candidate and gizmo-core

ui-framework-candidate:
  may import actor-core/actor-input
  must not import editor/runtime product features

runtime-core-candidate:
  may import actor-core and math packages
  must not import UI/editor/gizmo/DOM

runtime-three-candidate:
  may import runtime-core and three
  must not import editor/ui-framework

editor-candidate:
  may import actor/ui/runtime ports

app-composition:
  may import public installer/bootstrap API only
```

新增测试：

- dependency graph has no cycle；
- `window-runtime` does not import feature implementations；
- `features/app-menu` may adapt window facts, but `window-runtime` must not import app-menu；
- app composition does not import concrete window internals or runtime component internals；
- editor/runtime import direction is one-way；
- barrel export cannot hide forbidden dependencies。

### Tests

```text
npm run test -w wallpaper-tesseract -- architecture-boundaries
npm run typecheck -w wallpaper-tesseract
```

### Effect

Project Prism 的依赖方向从文档变成 executable rule。

## Step 0.4: Legacy Lock With Replacement Contracts

### Goal

把已经删掉的 legacy 入口永久锁住，防止后续大重构为了“方便”偷偷复活旧路径。

### Boundary

只锁已经清理过或能在本阶段干净删除的 legacy。不添加兼容 re-export；不新增 `legacy/` 目录。

### Work

扩展 boundary tests，禁止这些生产符号或路径复活，并为每条 legacy lock 写明替代契约：

```text
GizmoResponder / hitTestGizmo / gizmoPriority
  -> ActorInputParticipant + ActorInputRouter

Camera3 legacy factory
  -> Camera3 actor/component + Scene viewport overlay parent

Debug legacy window factory
  -> debug view actor + window lifecycle view factory

SceneViewRuntime / CurrentSceneViewSource
  -> RenderableSceneView + current renderable scene view registry

createDockTargetFrameSource / WindowDockTargetFrame
  -> DockTargetRegionSource / WindowDockTargetRegion

window-control-source / window-menu-view-source / visible activation controller
  -> WindowWorkspaceViewCatalog + App Menu model adapter

old actor-id workspace layout API
  -> WindowViewIdentity typeKey/instanceId persisted layout

DOM click shortcuts for actor-input UI
  -> actor input hit/action intent path
```

如果发现仍有生产残留：

- 可小范围删除则直接删除；
- 删除会牵出大职责混合则停止，转成后续 Phase blocker；
- 不创建适配层维持旧 API。

### Tests

```text
npm run test -w wallpaper-tesseract -- architecture-boundaries
npm run test -w wallpaper-tesseract
```

### Effect

旧事实源不会在 Prism 执行中“死灰复燃”，且后续 agent 知道应该走哪个新契约。

## Step 0.5: Actor Core Purity Gates Without Pretending It Is Ready

### Goal

明确哪些 actor-runtime 文件已经可以成为 `actor-core` 候选，哪些仍是 Phase 1 必须拆除的 blocker。

### Boundary

不把当前 `component.ts` / `component-runtime-bridge.ts` 直接标成 `actor-core`。
它们仍含 scene/gizmo/state bridge 能力，应进入 `actor-binding-debt`，直到 Phase 1 真正去能力化。

### Work

新增边界测试：

- `actor-core-candidate` 禁止：
  - `gizmo-core`
  - `three`
  - `scene-runtime`
  - `window-runtime`
  - `app-runtime`
  - `HTMLElement`
  - `Document`
- `actor-runtime` 整体禁止：
  - `app-runtime`
  - `window-runtime`
  - feature imports
- `actor-binding-debt` 只能被当前 registry/bridge/app wiring 使用，不得被 ui/runtime/editor 新代码扩大引用。

`project-prism-phase-0-boundary-report.md` 必须强制列出 Phase 1 blockers：

- `Component.updateFrame(frame: SceneFrame)`；
- `ComponentCapability` 中 binding/legacy capability 与 core contract 混合；
- `BusinessComponentContext.services.commandSink: SceneCommandSink`；
- `GizmoCapableComponent`；
- `StateObserverCapableComponent`；
- `ComponentRuntimeBridge` 同时处理 gizmo/state observer/active input。

### Tests

```text
npm run test -w wallpaper-tesseract -- architecture-boundaries actor-system component-registry
npm run typecheck -w wallpaper-tesseract
```

### Effect

Phase 1 的目标会很清楚：不是“搬 actor-runtime”，而是删除 `actor-binding-debt` zone。

## Step 0.6: State Domain Boundary Inventory

### Goal

把当前 `scene-runtime` 的混合状态拆解成待迁移域，防止它被错误归入 `runtime-core`。

### Boundary

这一步不要求完成 state split，但必须明确哪些文件不能进入 runtime package。

### Work

建立 state domain inventory：

```text
runtime-state:
  worlds
  cameras
  projections
  frame clock
  runtime frame source

editor-state:
  selection
  workspace mode
  inspector target

ui-layout-state:
  window bounds
  dock layout
  menu state
  workspace visibility
```

新增边界测试：

- `runtime-core-candidate` 禁止 `sceneParameterPaths`；
- `window-runtime` 禁止 import `sceneParameterPaths`；
- `features/app-menu` 禁止直接 import `sceneParameterPaths`；
- `sceneParameterPaths.debugWindow|hierarchyWindow|selection|workspace` 不得被标成 runtime-state；
- app composition 不得直接操作 storage/localStorage layout internals。

报告中列出 Phase 2 blockers：

- `scene-runtime/parameter-paths.ts` 混合 runtime/editor/ui layout；
- `SceneRuntime.register()` 混合 runtime and editor scheduler；
- `FrameStateController` 与 editor state observer 的边界。

### Tests

```text
npm run test -w wallpaper-tesseract -- architecture-boundaries scene-runtime frame-state-controller
npm run typecheck -w wallpaper-tesseract
```

### Effect

后续不会把 `scene-runtime` 整包误搬成 runtime-core。

## Step 0.7: UI Framework Candidate Gates

### Goal

锁住当前 window/tab/dock/menu 已经清理出的通用性，避免再次写出 root/floating 两套逻辑或 product-specific UI framework。

### Boundary

不抽 `ui-framework` package，但把未来 package 的禁入项先测住。

### Work

新增或收紧测试：

- `window-runtime` 禁止 import：
  - `features/scene`
  - `debug`
  - `hierarchy`
  - `features/inspector`
  - `tesseract4`
  - `camera3`
  - `three`
  - `sceneParameterPaths`
- root/floating frame must share `WindowFrameSurfaceComponent`；
- tab rendering must be one shared surface path；
- dock target naming must be region-first；
- menu model must be an adapter over generic window facts；
- pointer mutation must go through actor input, not DOM click。

### Tests

```text
npm run test -w wallpaper-tesseract -- architecture-boundaries floating-window workspace-root window-frame-surface app-menu
npm run typecheck -w wallpaper-tesseract
```

### Effect

`ui-framework` 的公共 API 不再被具体 Scene/Debug/Hierarchy 反向污染。

## Step 0.8: Runtime Candidate Gates

### Goal

锁住 runtime 的独立性方向：Runtime 可以产出 frame source，但不能知道 Editor/UI/Gizmo。

### Boundary

当前 runtime 仍未抽出。测试应先覆盖已经纯净的候选区；混合区进入 blocker report，不假装完成。

### Work

新增测试：

- `packages/four-*` 禁止 import app/editor/ui；
- `runtime-core-candidate` 禁止：
  - `HTMLElement`
  - `Document`
  - `window-runtime`
  - `features/app-menu`
  - `gizmos`
  - `actor-input`
- `runtime-three-candidate` 可以 import `three`，但禁止 import editor/ui-framework；
- editor Scene View consumes `FrameSource` style projection instead of owning runtime world/camera resources。

报告中列出 Phase 4/5 blockers：

- Tesseract runtime ownership still under app/editor feature；
- Camera3 runtime model vs gizmo UI boundary；
- Scene viewport renderer ownership；
- lack of formal `RuntimeCommandSink` / `RuntimeQueryPort` / `FrameSourceRegistry`。

### Tests

```text
npm run test -w wallpaper-tesseract -- architecture-boundaries
npm run test -w four-rotation
npm run test -w four-camera
npm run test -w four-camera-three
npm run typecheck
```

### Effect

Runtime 抽包前的禁入项被提前锁住。

## Step 0.9: App Composition Thinness Gates

### Goal

防止 `create-wallpaper-app.ts` 在 Prism 中继续吸收具体策略。

### Boundary

不要求 app composition 立刻变成最终形态，但新增逻辑必须通过 installer/bootstrap API。

### Work

新增或收紧测试：

- app composition 禁止直接 new：
  - window controller；
  - dock preview controller；
  - view factory registry；
  - renderable scene runtime；
  - runtime world/camera component internals。
- app composition 禁止直接 import：
  - concrete Debug/Hierarchy/Scene view actor factories；
  - window internals outside public feature installer；
  - runtime component internals；
  - editor feature internals once installer exists。
- app composition only wires：
  - actor system；
  - component registry；
  - runtime installer；
  - editor installer；
  - render loop；
  - app shell root。

### Tests

```text
npm run test -w wallpaper-tesseract -- architecture-boundaries create-wallpaper-app
npm run typecheck -w wallpaper-tesseract
```

### Effect

Wallpaper app 不再成为新功能最容易偷懒堆进去的地方。

## Step 0.10: Browser Smoke Baseline

### Goal

为 Phase -1/1/2 之前的 UI/input 行为留下真实浏览器基线。Phase 0 的测试不能只有静态扫描。

### Boundary

只验证现有行为，不新增 UI 功能。

### Work

启动 dev server：

```text
npm run dev -w wallpaper-tesseract
```

记录：

- server port；
- server PID；
- browser URL；
- viewport；
- layout storage initial state；
- layout storage after operations；
- reload 前后 view identity；
- console error count；
- screenshot/data artifact path；
- 每一步操作结果。

Smoke 场景：

- root dock Scene 正常渲染；
- floating Debug/Hierarchy/Inspector 可打开、聚焦、关闭、恢复；
- tab drag / dock preview / dock commit 主路径；
- Scene fullscreen/restore；
- Camera3 drag and double-click；
- Window menu open/focus；
- narrow/mobile viewport 下 tab close/menu controls 不越界；
- overlapping frames input hits topmost frame。

输出：

```text
temp/project-prism-phase-0-smoke-report.md
temp/project-prism-phase-0-smoke-data.json
```

`smoke-data.json` 必须包含：

```text
viewport
url
serverPort
consoleErrors
storageBefore
storageAfter
viewIdentitiesBeforeReload
viewIdentitiesAfterReload
frameIds
screenshots
operationResults
knownLimitations
```

无论通过或失败，停止本次启动的 dev server。

### Tests

```text
npm run test -w wallpaper-tesseract
npm run typecheck -w wallpaper-tesseract
npm run build -w wallpaper-tesseract
```

Browser smoke 失败时，先判断：

- 若是当前已知 UI/input bug，修复后再进入 Phase -1；
- 若是 Playwright/in-app browser 限制，报告必须记录限制和手工验证证据。

### Effect

后续 package extraction 引发 UI 退化时，有真实可比的 baseline。

## Step 0.10D: Interaction And Render Host Evidence Gate

### Goal

把当前抽查暴露出的两个真实风险纳入 Phase 0 验收，而不是作为临时 bug 单独修：

- root dock frame 与 floating frame 之间可能出现“视觉上看得见，但 actor input 命中上层 floating frame”的状态；
- Scene view 的内容渲染依赖 view location / frame visibility / active tab / render host 同步，dock、close/reopen、fullscreen/restore 后必须证明不会留下空白或 stale host。

这一步是 Project Prism 后续 UI package 和 Runtime/Editor 分离的前置证据门槛。Phase 0 不要求在这里完成大规模实现重构，但必须把问题变成可执行测试、明确 blocker 和后续修复入口。

### Boundary

- 不用 debounce、重复点击、DOM click shortcut 或局部 z-index 补丁掩盖问题。
- 不新增 root-only 或 floating-only 的特殊输入规则。
- 不让 Scene runtime 重新依赖具体 window/frame actor。
- 如果修复需要统一 frame surface/chrome 或 render host binding，记录为 Phase -1/Phase 1 前置 blocker，并停止进入相关实现阶段。

### Required Evidence

新增或更新：

```text
temp/project-prism-phase-0-interaction-host-report.md
temp/project-prism-phase-0-smoke-data.json
```

报告必须记录：

- 复现布局：root Scene tab、floating Debug/Hierarchy/Inspector 的 frame id、view identity、bounds、z-index、input stack priority；
- 点击 root tab close/fullscreen 坐标时的 `document.elementsFromPoint()` top stack；
- 同一坐标对应的 actor input hit target；
- 当 floating frame 覆盖 root tab/control 时，视觉遮挡、DOM top target、actor hit target 是否一致；
- Scene close/reopen、dock/undock、fullscreen/restore 后的 canvas rect、Camera3 overlay rect、view location、owner frame id、active tab、console errors；
- 如果 Scene 内容空白，记录 `isRenderable()` 相关事实：owner frame visible、owner frame active in hierarchy、visible in frame、view actor active、viewport size。

### Required Tests

新增或扩展 architecture boundary tests：

- root dock frame 和 floating frame 不允许各自维护彼此分叉的 tab close / tab action hit model；tab action 必须来自共享 frame surface/chrome model。
- workspace layer/input priority 的事实源必须是同一条 projection；禁止新增独立 DOM z-index 事实源或 actor-input priority 事实源。
- Scene render loop 不允许直接依赖具体 frame/window actor；只能依赖 renderable view / render host binding / location projection。
- UI framework candidate 不允许 import Scene/Camera/Tesseract runtime facts；Editor adapter 才能连接 UI frame host 与 runtime render output。

新增或扩展 browser smoke：

- `floating-over-root-tab`: 把 floating frame 放到 root Scene tab/close/fullscreen control 上方，验证视觉 top layer、DOM top target、actor input hit target 三者一致。若按钮可见但不可命中，smoke 必须失败。
- `root-tab-uncovered`: 移开 floating frame 后，root Scene tab close/fullscreen control 一次点击必须响应。
- `scene-render-host-loop`: Scene close/reopen 10 次，dock/undock 5 次，fullscreen/restore 10 次；每次都记录 canvas/overlay rect 非零、console error 为 0。
- `scene-host-stale-guard`: 在 dock/rehost 后立刻触发 measure/render，确认不会出现 0x0 host 被持久保存或 current renderable 指向 stale owner。

### Effect

这一步把当前抽查出的两个问题转化为 Project Prism 的硬验收：

- UI package extraction 必须消灭 root/floating 双轨 chrome 和双轨输入事实源；
- Runtime/Editor split 必须让 Scene runtime 与 Editor frame lifecycle 解耦；
- 后续 Phase 不得以“当前偶现但可重开恢复”为理由绕过这些证据。

## Step 0.11: Phase 0 Exit Report

### Goal

把 Phase 0 的成果从“测试绿了”变成后续 agent 能直接执行的边界契约。

### Work

更新 `temp/project-prism-phase-0-boundary-report.md`，包含：

- source zone map summary；
- dependency graph rules；
- newly locked legacy deletions and replacement contracts；
- current actor-core blockers；
- current state/scheduler blockers；
- current runtime-core/runtime-three blockers；
- current ui-framework extraction blockers；
- interaction/render host evidence gate result；
- debt zone entries, each with owner phase and deletion condition；
- smoke result links；
- exact validation commands and results；
- next phase recommended entry point。

### Required Commands

```text
npm run test -w wallpaper-tesseract
npm run typecheck -w wallpaper-tesseract
npm run build -w wallpaper-tesseract
```

Before broad handoff：

```text
npm run test
npm run typecheck
npm run build
```

### Exit Criteria

Phase 0 can be marked complete only when:

- boundary helper 已抽出；
- production 禁止 import test-support；
- zone map / dependency graph / blocker report 是同一套事实源生成，不手写两份；
- 当前无法通过的边界以 debt zone + blocker 形式记录，不能用 allowlist 静默放行；
- all production files are classified into explicit future zones or debt zones；
- no legacy path locked by Step 0.4 exists in production；
- current package direction has executable dependency graph tests；
- actor-core candidate purity is tested；
- ui-framework candidate product-agnostic boundary is tested；
- runtime candidate no-editor/no-ui direction is tested；
- app composition thinness is tested；
- smoke baseline is recorded；
- root/floating input layer consistency evidence is recorded；
- Scene render host stability evidence is recorded；
- Phase -1/1/2 blockers are documented without pretending they are solved。

## Stop Conditions

Stop and revise the plan if:

- a boundary test requires a broad allowlist to pass；
- a production module must import a future lower-level package backward；
- a supposed generic UI module needs Scene/Debug/Camera/Tesseract facts；
- actor-core candidate cannot be separated from gizmo/scene state without Phase 1 work；
- runtime-core candidate requires DOM/Editor/UI to construct；
- fixing a boundary exposes a deeper ownership issue that belongs to Phase -1/1/2；
- root/floating frame chrome or input hit behavior requires separate special cases to pass；
- Scene render host evidence shows stale owner, 0x0 persisted host, or missing canvas after close/reopen/dock/fullscreen；
- browser smoke reveals broken input/focus/docking behavior not covered by unit tests。

## Hand-Off To Next Phases

Historical note:

The old handoff below has been superseded. Do not execute the old Phase -1
route. The current handoff is:

1. Finish Phase 1E: boundary lock and Phase 1 acceptance report.
2. Finish Phase 1F: actor-core extraction readiness decision.
3. Start Phase 2 only after generated boundary facts either allow actor-core /
   actor-input extraction or name the exact remaining blockers.

Old handoff, retained only as historical context:

1. Run Phase -1: view instance identity continuation.
2. Run Phase 1: actor-core purification and extraction.
3. Run Phase 2: state/scheduler/input bridge split.

Do not extract `ui-framework` before Phase -1 passes.
Do not extract `actor-core` before `actor-binding-debt` is removed.
Do not extract `runtime-core` before state domains and scheduler domains are split.
