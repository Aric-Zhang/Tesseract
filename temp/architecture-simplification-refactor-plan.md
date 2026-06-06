# 架构简化收口重构方案

本文档用于替代 `window-docking-continuation-development-plan.md` 中尚未执行的后续功能推进部分。当前目标不是维护过渡态稳定，而是主动清除过渡兼容、双轨实现和 UI 层补丁，使窗口、Scene、输入、菜单重新收敛到长期可维护的 actor tree + component 架构。

本轮允许大胆重构和阶段性破坏，但每个步骤结束时必须减少事实源、减少双轨、减少 legacy 面，而不是用新抽象包住旧混乱。

## 原则

- 不再新增 UX 功能，直到窗口事实源、view/frame 生命周期、root/floating surface 和 Scene runtime 收口完成。
- 不为过渡稳定保留双轨。一个步骤内部可以短暂迁移，但步骤结束时必须删除旧入口、旧测试或旧 source。
- UI 交互必须经 actor input 或明确的 component keyboard boundary，不允许新增 DOM click/mutation shortcut。
- Frame 是容器，View 是内容，Tab 是 Frame 根据 child ViewActor 渲染出的 chrome，不是第三套状态源。
- Root frame 和 floating frame 只允许 shell 差异，不允许维护两套 tab/split/content/hit-test/dock 行为。
- Catalog 只能是只读投影，不能成为新的事实源。
- App composition 只负责安装 feature 和启动 render loop，不再承载业务闭包和窗口细节。

## 当前事实校正

- Root direct view runtime 已部分实现，`tryOpenViewRuntimeInFrame()` 可直接把 view 创建进 root frame，不必再先创建临时 Scene floating frame。
- `WindowFramePortRegistry` 已经强制 `frameActor.id === framePort.frameId`，这一点应继续保留为边界。
- Root tab close 的窄 tab 溢出已有 shared chrome/CSS 和 smoke 证据，但 root/floating 的 surface 行为仍然是两套。
- `WindowViewIdentity` 已有雏形，但 lifecycle 仍以 `WindowViewKey` 作为 singleton live map key；identity 契约不能等到最后才补。
- 当前测试绿灯可以作为大胆收口的起点，但不能作为继续堆 UX 的理由。

## Step 0：冻结架构基线

目标：

- 记录当前 dirty scope、当前测试结果、当前 smoke 证据。
- 只用于确保后续重构知道自己破坏了什么，不用于保护过渡兼容层。

边界：

- 不修功能。
- 不提交 temp 噪音作为长期文档，除非是本轮计划或必要 smoke 证据。

验收：

- `npm run test -w wallpaper-tesseract`
- `npm run typecheck -w wallpaper-tesseract`
- `npm run build -w wallpaper-tesseract`
- 记录一次最小浏览器 smoke：菜单可打开、Scene 可渲染、Debug/Hierarchy 可打开、tab drag 至少进入 preview。

## Step 1：建立只读 `WindowWorkspaceViewCatalog` 与 identity 契约

目标：

- 删除 `WindowControlSource`、`WindowMenuViewSource`、`WindowVisibilityActivationController` 的长期角色。
- 新增唯一 catalog，但 catalog 只能是 `WindowFrameLifecycleController + WindowFramePortRegistry + factory metadata` 的只读投影。
- 提前引入 `WindowViewIdentity` 语义，避免 Step 2、Step 8、Step 9 继续把 `WindowViewKey` 当成 singleton 和 instance 的混合身份。

硬约束：

- Catalog 不缓存 live state。
- Catalog 不维护自己的 registry。
- Catalog 不提供 mutation API。
- View/frame 生命周期、位置、dock root、presentation session 仍只能由 lifecycle 和 frame port 拥有。

建议接口：

```ts
interface WindowWorkspaceViewCatalog {
  listViewEntries(): readonly WindowWorkspaceViewEntry[];
  getViewEntryByIdentity(identity: WindowViewIdentity): WindowWorkspaceViewEntry | null;
  getViewEntryByActorId(viewActorId: string): WindowWorkspaceViewEntry | null;
  listFrameEntries(): readonly WindowWorkspaceFrameEntry[];
}

interface WindowViewIdentity {
  typeKey: WindowViewTypeKey;
  instanceId: WindowViewInstanceId;
}
```

Entry 来源：

- factory metadata：type key、label、order、dockable、singleton/multi-instance metadata、default placement。
- lifecycle location：identity、viewActorId、ownerFrameId、activeInFrame、visibleInFrame、owner frame presentation。
- frame port：priority、visible、presentation、runtime root。

必须删除或替代：

- `window-control-source.ts`
- `window-menu-view-source.ts`
- `window-visibility-activation-controller.ts`
- AppMenu 中 `windowSource + windowMenuViewSource` 拼接逻辑。
- focus-to-front 对 `FloatingWindowComponent` 的扫描依赖。

边界：

- 菜单点击已存在 view：只发 `requestActivateView(identity/viewActorId, "menu")`。
- 菜单点击不存在 singleton view：只发 `requestOpenView(typeKey, "menu")`。
- 不再通过 visible path 恢复旧窗口。
- Persistence 和 presentation 读取 catalog 只为列举对象，实际 snapshot/restore 仍归 lifecycle。

验收：

- 菜单中 root Scene 被识别为 live，而不是 factory-only 项。
- 菜单点击已存在 view：激活 tab 并聚焦 owner frame。
- 菜单点击不存在 view：通过 lifecycle fresh create。
- root/floating/mixed frame 均在 catalog 中一致显示。
- 单测证明 catalog 是纯投影：改变 lifecycle/frame port 后 catalog 结果立即变化，无独立缓存。
- Architecture boundary 禁止生产代码 import `WindowControlSource` / `WindowMenuViewSource` / `WindowVisibilityActivationController`。

## Step 2：删除 full-frame factory 双轨，引入 placement/shell policy

目标：

- `WindowViewFactory` 只负责创建 `ViewActor + content + disposeViewRuntime`。
- Frame shell 创建/选择一律归 `WindowFrameLifecycleController`。
- 从 full-frame factory 中抽出初始 bounds、persistent paths、runtime-only shell、default root/floating placement 等 shell 信息，避免这些信息散回 app composition。

新增概念：

```ts
interface WindowViewRuntimeFactory {
  createViewRuntime(options: WindowViewRuntimeCreateOptions): WindowViewRuntimeFactoryResult;
}

interface WindowViewRuntimeFactoryResult {
  identity: WindowViewIdentity;
  viewActor: Actor;
  content: WindowContentHostParticipant;
  title?: string;
  disposeViewRuntime(): void;
}

interface WindowViewPlacementPolicy {
  resolveInitialPlacement(request: WindowOpenViewRequest): WindowViewPlacement;
}

interface WindowFrameShellFactory {
  createFrameShell(options: WindowFrameShellCreateOptions): WindowFrameShellResult;
}
```

Lifecycle 负责：

- 如果 preferred frame 存在：创建 view runtime，加入目标 frame tabset。
- 如果 preferred frame 不存在：通过 placement policy 决定 root/floating/runtime-only/persistent shell，再由 shell factory 创建 frame。
- 如果 menu open singleton 已存在：focus + activate，不重复创建。

必须删除或替代：

- `WindowViewFactory.create()`
- `WindowViewFactoryResult.frameActor`
- `WindowViewFactoryResult.framePort`
- deprecated `dispose`
- Scene/Debug/Hierarchy 在 `create-wallpaper-app.ts` 中的双 factory 分支。
- app composition 中直接调用 `getFloatingFrameOptions()` 决定每类 view shell 的逻辑。

边界：

- 不保留兼容 alias。
- Debug/Hierarchy/Scene factory 不得返回原始 frame handle disposer。
- Placement policy 不创建 actor，只返回意图和配置。
- Shell factory 创建 FrameActor/FrameShellComponent/WindowFrameSurfaceComponent，但不创建 view runtime。

验收：

- root 默认 Scene 创建时不生成临时 floating frame。
- menu 打开 Debug/Hierarchy 仍可进入 root 或 floating placement。
- close view 调用 `disposeViewRuntime`，不调用旧 `dispose`。
- full-frame factory API 从生产代码和测试中删除。
- Boundary test：`WindowViewFactory` 不包含 `create(` full-frame API 和 `dispose?:`。

## Step 3：抽取 actor-backed `WindowFrameSurfaceComponent`

目标：

- Root frame 和 floating frame 复用同一个 tab/split/content/hit-test/dock surface。
- Surface 必须是 actor component，而不是隐藏 helper class。
- 拆分 `WindowFramePort` 中混合的 shell 字段和 surface 行为，避免 root/floating 各自拼一个不一致 port。

目标 actor shape：

```text
FrameActor
  FloatingFrameShellComponent | WorkspaceRootFrameShellComponent
  WindowFrameSurfaceComponent
  WindowFramePortComponent/Adapter
```

建议拆分：

```text
WindowFrameSurfaceComponent
  - WindowDockSurfaceModel
  - tab chrome render
  - split render
  - content deck placement
  - active/interactable state
  - tab hit test
  - tab action hit test
  - splitter hit test/resize
  - dock target tabset map

FloatingFrameShellComponent
  - fixed/windowed bounds
  - titlebar empty drag
  - resize handles
  - close frame button
  - fullscreen/windowed shell layout

WorkspaceRootFrameShellComponent
  - app shell root slot sizing
  - no titlebar/no resize
  - root priority/presentation integration

WindowFramePortComponent/Adapter
  - combines shell visibility/presentation/priority
  - delegates tabs/splits/content host to surface
  - registered once in WindowFramePortRegistry
```

必须删除或替代：

- `FloatingWindowComponent.renderSplitNode/renderTabsetTabs/placeContentAttachments/applyActiveContentState/updateSplitRatioFromDrag` 的私有重复实现。
- `WorkspaceRootDockFrameComponent.renderSplitNode/renderTabsetTabs/placeContentAttachments/applyActiveContentState/updateSplitRatioFromDrag` 的私有重复实现。
- root/floating 各自维护 tab action maps 的分叉。
- `dock-target-frame-source.ts` compatibility alias 和旧 frame-target 命名。

边界：

- Surface 不知道它是 root 还是 floating。
- Shell 不知道 split tree 的内部 DOM 结构。
- Shell 只把 pointer hit 交给 surface 或处理 shell 自己的 chrome。
- Registry 只注册 `WindowFramePortComponent/Adapter`，不直接注册 shell 或 surface。

验收：

- root/floating tab 样式一致，仅 shell 外框不同。
- root/floating 多 tab close 命中一致。
- root/floating split resize 行为一致。
- root/floating inactive tab content 不可 hit。
- root/floating drag-to-dock preview 和 commit 使用同一 target region。
- mobile viewport 下 tab close rect 不越界。
- Boundary test 禁止生产代码使用 `DockTargetFrame` / `dock-target-frame-source` 旧命名。

## Step 3.5：Step 4 前置架构收口

目标：

- 把 Step 3 中仍残留的生命周期越权、catalog mutation、legacy alias 清理掉。
- 防止 Step 4 拆 `SceneViewRuntime` 时复制同类问题。
- 此步骤是进入 Step 4.1 的硬门槛。

必须修正：

- `FloatingWindowComponent` / `WorkspaceRootDockFrameComponent` 不得 fallback `new WindowFrameSurfaceComponent(actor)`。
- shell component 不得在 `dispose()` 中调用 `surface.dispose()`；只能 `detachHost()`，surface 生命周期由 `ComponentRegistry` 统一管理。
- `WindowWorkspaceViewCatalog` 必须恢复为只读 projection，不得在 `WindowWorkspaceFrameEntry` 暴露 `setStackPriority`。
- stack/focus mutation 改走窄命令端口或 workspace focus service。
- 删除 `dock-target-frame-source.ts` 和对应测试；生产/测试统一使用 `dock-target-region-source.ts`。
- architecture boundary 不再允许旧 frame-target 命名。

边界：

- Surface 可以管理 tab/split/content 行为，但不能由 shell 私自创建或销毁。
- Catalog 只能读 lifecycle/registry/factory metadata 派生事实，不能持有 mutation API。
- 旧 alias 不保留为长期兼容层。

验收：

- shell definitions 通过 `requires` 注入 `windowFrameSurfaceComponentType`。
- shell 直接构造测试必须显式传入 surface。
- Boundary test 禁止 shell 源码出现 `new WindowFrameSurfaceComponent` 和 `#surface.dispose()`。
- Boundary test 禁止 catalog 源码出现 `setStackPriority`。
- Boundary test 禁止生产源码引用 `dock-target-frame-source` / `DockTargetFrame`。
- `npm run test -w wallpaper-tesseract`
- `npm run typecheck -w wallpaper-tesseract`
- `npm run build -w wallpaper-tesseract`

## Step 4：拆除 `SceneViewRuntime` app-side runtime

执行细分以 `temp/architecture-simplification-step4-amendment.md` 为准。关键原则是：
`RenderableSceneView` 只能是只读渲染投影，不得携带 dispose/destroy 权限；Camera3 组件依赖必须通过 `ComponentDefinition.requires` 串联；Scene installer 只能组装 actor/component tree，不能成为改名后的 `SceneViewRuntime`。

目标：

- Scene 成为纯 actor subtree + components。
- Camera3 motion/Tesseract/viewport/renderability 不再由 app runtime 对象集中拥有。
- 避免 Step 5 拆 app composition 时先抽临时 Scene installer，再重复重写。

建议 actor tree：

```text
Scene ViewActor
  SceneViewportComponent
  SceneRenderParticipantComponent
  Camera3RigComponent
  Camera3MotionComponent
  Camera3GizmoActor
    Camera3GizmoComponent
  Tesseract4Actor
    Tesseract4Component
```

RenderLoop 逻辑：

- 查询 active renderable Scene view component。
- component 自己判断 owner frame visible/active/visibleInFrame。
- render loop 不持有具体 `SceneViewRuntime`。

必须删除或替代：

- `SceneViewRuntime`
- `CurrentSceneViewSource`
- Scene 内 `registerLegacyRuntimeObject(activeCamera3Motion)`
- Scene 创建时 app-side 直接 new `Camera3MotionController`。

边界：

- Scene fullscreen/run mode 通过 lifecycle/session service 找当前 view location。
- Scene dispose 由 actor tree destroy + component dispose 完成，不由 app runtime 手写 rollback。
- Camera3/Tesseract 必须是 Scene ViewActor 子树的一部分。

验收：

- close/reopen Scene 三次，无 stale canvas、observer、Camera3 callback。
- Scene dock/root/floating/split/fullscreen 后仍可渲染。
- Camera3 drag/double-click 在 Scene 所有 owner frame 中可用。
- Scene view 被关闭后 render loop 无 console error。

## Step 5：拆 `create-wallpaper-app.ts` composition god file

目标：

- 顶层只保留 app shell、runtime context、feature installer 顺序、render loop。
- 窗口系统、Scene、菜单、工具窗口各自成为 feature installer。
- 此步在 Step 4 之后执行，避免保留一个临时 Scene feature installer 过渡层。

建议模块：

```text
src/features/window-workspace/install-window-workspace-feature.ts
src/features/scene/install-scene-view-feature.ts
src/features/app-menu/install-app-menu-feature.ts
src/features/tool-windows/install-tool-windows-feature.ts
```

`installWindowWorkspaceFeature()` 返回：

- lifecycle controller
- read-only catalog
- frame intent sink
- frame port registry
- presentation/session service
- persistence controller
- root frame actor handle
- placement policy / shell factory

`installSceneViewFeature()` 返回：

- scene view factory registration
- renderable scene query
- scene presentation commands

边界：

- Feature installer 可以接线，但不得绕过 ActorSystem/ComponentRegistry 创建 UI DOM。
- App-level 闭包只能保存 feature service，不保存具体 Debug/Scene component。

验收：

- `create-wallpaper-app.ts` 不直接 new `WindowWorkspaceController`、`WindowViewFactoryRegistry`、`WindowDockPreviewController`。
- `create-wallpaper-app.ts` 不直接注册 Scene/Debug/Hierarchy view factories。
- `create-wallpaper-app.ts` 不直接创建 root/floating frame component。
- render loop 不闭包持有具体 Scene runtime/component。

## Step 6：输入语义正式化

目标：

- 删除 app-level `buttonsReleasedFallback: false` 补丁。
- `gizmo-core` 定义明确 pointer active interaction policy。
- Camera3 mode label 不再使用 DOM click。

建议：

- `gizmo-core` active interaction 只通过 pointerup/pointercancel/explicit cancel 结束。
- `buttons === 0` 的 mouse move 只作为 debug signal，不默认 cancel；若需要，应作为清晰策略枚举而非 app 布尔补丁。
- Camera3 mode label 成为 `Camera3GizmoComponent` 的 actor input hit part，例如 `mode-toggle`。
- AppMenu/Hierarchy keyboard 事件登记为明确的 component keyboard boundary；禁止 pointer/click DOM shortcut。

验收：

- window titlebar drag、tab drag、splitter drag、Camera3 drag 全部不依赖 app flag。
- `create-wallpaper-app.ts` 不传 `buttonsReleasedFallback`。
- `Camera3Gizmo` 或其替代实现不包含 `addEventListener("click")`。
- actor input boundary test 禁止新增 DOM click shortcut。

## Step 7：删除 legacy 表面并硬化 runtime service 边界

目标：

- 删除旧 Debug/Camera3 legacy factory 和 legacy tests。
- 把 `registerLegacyRuntimeObject` 正名或移除。
- 防止 feature UI/runtime 借 runtime service 名义继续绕过 actor/component。

允许注册为 app-level runtime service 的对象：

- frame clock / frame state controller
- immediate update scheduler
- layout persistence scheduler
- app-level presentation/session coordinator

不允许注册为 app-level runtime service 的对象：

- feature UI
- Camera motion
- Scene render participant
- window surface
- dock preview UI
- any component-owned behavior

必须删除或替代：

- `debug/legacy`
- `gizmos/camera3/legacy`
- architecture boundary 中 legacy 允许名单。

验收：

- `architecture-boundaries.test.ts` 从“限制 legacy 范围”改成“禁止 legacy 生产路径”。
- `rg -n "legacy|registerLegacyRuntimeObject"` 在生产源码中无命中；测试中只允许迁移断言。
- 新 `registerRuntimeService` 若存在，必须有 boundary test 限制可注册类型和路径。

## Step 8：持久化模型收口并删除旧 layout 兼容

目标：

- 只持久化 canonical frame/view layout。
- 不持久化 runtime-only fullscreen/isolation frame。
- 不持久化 legacy visible path 状态作为窗口事实。
- 删除旧 actor-id layout transitional model。

必须删除或替代：

- `window-workspace-layout.ts` 中旧 actor-id layout transitional API。
- 旧 layout 测试中只为兼容 actor-id tab/split 派生 id 的测试。
- 任何 persistence 读取 `FloatingWindowComponent.visiblePath` 作为窗口存在事实的路径。

规则：

- root frame bounds 是兼容字段，restore 时忽略具体 bounds。
- close view 后从 persisted visible layout 中消失。
- factory default/placement policy 决定首次启动默认打开项。
- 坏 JSON/坏版本/未知 view 按明确策略剪枝或忽略，并有测试表。
- Layout 以 `WindowViewIdentity` / instance id 表达 view，不以 actor id 表达菜单 identity。

验收：

- root/floating/split/mixed frame reload 后结构稳定。
- runtime fullscreen 中保存布局不会污染 develop layout。
- 关闭 Debug/Hierarchy/Scene 后 reload 行为符合 menu recreate 语义。
- Boundary test 禁止生产代码 import 旧 actor-id layout API。

## Step 9：多实例能力扩展

目标：

- 在 Step 1 已落地 identity 契约的基础上，真正允许同一 type 创建多个 instance。
- 不再把 actor id、view type、menu identity、layout identity 混用。

规则：

- 菜单按 type 打开/聚焦默认实例。
- Layout/persistence 按 instance 保存。
- Actor id 不作为菜单 identity。
- Singleton 只是 registry metadata，不是类型系统默认。

验收：

- 现有 Scene/Debug/Hierarchy 仍可作为 singleton metadata 工作。
- lifecycle live map 不再以 `WindowViewKey` 作为唯一 key。
- close/reopen 后 instance 语义明确。
- 至少加一个非 Scene 的测试型 multi-instance view fixture，不急着做完整 Inspector UX。

## 全局回归门

每完成一个 Step：

- `npm run test -w wallpaper-tesseract`
- `npm run typecheck -w wallpaper-tesseract`

涉及 UI/input/window/Scene 的 Step：

- `npm run build -w wallpaper-tesseract`
- 浏览器 smoke，至少覆盖：
  - Scene render/canvas 非空
  - Camera3 drag + double-click
  - menu open/focus/create
  - root/floating tab drag preview
  - merge/split/float commit
  - tab close
  - mobile/narrow viewport tab close
  - console error 为 0

架构边界必须持续更新：

- catalog 不提供 mutation API。
- app code 不直接 import shared surface internals。
- app code 不直接扫描 DOM 改窗口状态。
- menu 不依赖旧 `WindowControlSource` / `WindowMenuViewSource`。
- root/floating 不复制 surface 行为，也不创建/销毁 required surface component。
- feature UI 不注册 runtime service。
- legacy 目录和 legacy adapter 不作为允许名单存在。

## 推荐执行顺序

1. Step 0：冻结基线。
2. Step 1：只读 catalog + identity 契约。
3. Step 2：删除 full-frame factory + placement/shell policy。
4. Step 3：actor-backed `WindowFrameSurfaceComponent` + port 拆分。
5. Step 3.5：surface 生命周期、catalog mutation、dock target alias 收口。
6. Step 4：拆 `SceneViewRuntime`。
7. Step 5：拆 app composition。
8. Step 6：输入语义正式化。
9. Step 7：删 legacy + runtime service 边界。
10. Step 8：持久化模型收口 + 删除旧 layout 兼容。
11. Step 9：多实例能力扩展。

最关键的是 Step 1-3.5。若只做其中一步并长期停留，会产生新的过渡层；因此本计划不建议在 Step 1-3.5 之间继续添加功能。
