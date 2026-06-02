# 3D Camera Gizmo 需求与实施步骤

## 1. 目标

参考 Unity Scene 视图右上角的方向 Gizmo，在当前 Wallpaper Engine Web 场景中增加一个用于操作 **three.js 3D 摄像机** 的屏幕叠加控件。

它的主要用途不是改变 4D 投影数学，而是让用户或开发者可以快速调整投影结果在 3D 场景中的观察角度：

```text
4D tesseract
-> 4D model rotation
-> 4D camera projection
-> 3D line buffer
-> three.js scene
-> 3D camera / 3D view gizmo
```

Gizmo 只控制最后一层 three.js 观察视角。

## 2. 当前场景状态

当前 demo 中 3D 摄像机位于：

```ts
const camera3 = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
camera3.position.set(0, 0, 6);
```

摄像机自身目前没有动画，只在窗口 resize 时更新 aspect。

当前超立方体动画包括：

```text
4D model rotation:
- XU plane
- YZ plane
- ZU plane

3D line object visual sway:
- object.rotation.y = sin(...)
- object.rotation.x = cos(...)
```

因此实现 Gizmo 时需要先明确：Gizmo 控制的是 `camera3`，不是 `camera4`，也不是 `lineAdapter.object` 的自动摆动。

## 3. 视觉参考拆解

参考图中的 Unity Gizmo 包含这些元素：

```text
右上角深色方形面板
中心白色立方体/中心点
Y 轴绿色箭头向上
X 轴红色箭头向右
另一个白色/灰色轴向箭头
透视模式文本 "< Persp"
锁图标
左上角菜单图标
```

在当前壁纸场景中不需要一比一复制 Unity UI，但应保留核心语义：

```text
轴向提示
点击轴向快速切换视角
拖拽 Gizmo 旋转 3D 摄像机
显示当前投影模式
可选锁定交互
可选菜单入口
```

## 4. 功能边界

### 应该实现

1. 在 canvas 之上渲染一个固定位置的 Gizmo overlay。
2. 显示当前 3D 摄像机相对于世界坐标轴的方向。
3. 点击 X/Y/Z 轴端点时，将 3D 摄像机吸附到对应正交方向。
4. 拖拽 Gizmo 区域时，围绕目标点 orbit 旋转 3D 摄像机。
5. 显示 Perspective / Orthographic 状态。
6. 支持锁定交互，锁定后 Gizmo 只显示不响应拖拽/点击。
7. 支持移动端触摸操作。

### 暂不实现

1. 不控制 4D Camera4D。
2. 不改变 4D model transform。
3. 不做 Unity 完整 Scene View 工具栏。
4. 不做复杂相机动画曲线编辑器。
5. 不做多视口。
6. 不做完整 OrbitControls 替代品，除非后续需要。

## 5. 推荐状态模型

新增一个 3D 摄像机控制状态，而不是直接在事件处理里散写 camera position：

```ts
interface Camera3RigState {
  target: THREE.Vector3;
  distance: number;
  yaw: number;
  pitch: number;
  roll: number;
  mode: "perspective" | "orthographic";
  locked: boolean;
}
```

推荐先使用 orbit 模式：

```text
target = scene origin
distance = camera 到 target 的距离
yaw/pitch 控制观察方向
roll 第一版保持 0
```

每帧或每次交互后根据 rig state 计算：

```ts
camera.position = target + direction * distance;
camera.lookAt(target);
```

这样 Gizmo、鼠标拖拽、键盘快捷键都可以共享同一个状态源。

## 6. 坐标约定

建议 three.js 世界坐标保持：

```text
X: 右，红色
Y: 上，绿色
Z: 朝屏幕外/内，蓝色或白色
```

Unity 图中 X 为红色、Y 为绿色，Z 在截图里不明显。当前实现可以使用：

```text
+X: red
+Y: green
+Z: blue/cyan
-X/-Y/-Z: darker or gray
```

如果为了贴近截图，也可以先让 Z 使用白色/灰色，避免色彩过多。

## 7. UI 结构

建议使用一个独立 DOM overlay，而不是把 Gizmo 画进主 three.js canvas。

原因：

```text
DOM overlay 更容易固定在右上角
按钮命中区域更容易处理
不影响主 WebGL renderer
可以用 CSS 管理 hover、lock、label
后续可替换为独立小 canvas
```

推荐结构：

```html
<div class="camera-gizmo" data-locked="false">
  <button class="gizmo-menu"></button>
  <button class="gizmo-lock"></button>
  <canvas class="gizmo-canvas"></canvas>
  <button class="gizmo-mode">&lt; Persp</button>
</div>
```

也可以第一版只用一个 `canvas` 加一个文本按钮：

```html
<div class="camera-gizmo">
  <canvas></canvas>
  <button>&lt; Persp</button>
</div>
```

## 8. Gizmo 渲染方案

### 方案 A：2D Canvas 绘制

推荐第一版使用。

流程：

```text
1. 取 camera3 的 inverse quaternion 或 world quaternion。
2. 将世界 X/Y/Z 轴转换到 camera/view 空间。
3. 将 3D 轴向投影到 Gizmo 的 2D 小画布。
4. 按深度排序绘制后方轴和前方轴。
5. 绘制中心方块、箭头、轴标签。
```

优点：

```text
轻量
不引入第二个 three renderer
命中测试可控
样式贴近 Unity 截图
```

缺点：

```text
需要自己写一点 3D->2D 投影和 hit testing
```

### 方案 B：第二个 three.js 小 renderer

后续可考虑。

优点：

```text
轴向几何可以直接用 three.js mesh
旋转和投影自然
```

缺点：

```text
多一个 WebGLRenderer 或复用 renderer viewport，复杂度更高
Wallpaper 场景里不一定值得
```

## 9. 交互需求

### 点击轴向

点击轴端点后，摄像机切换到对应方向：

```text
+X: camera 看向原点，位置在 target + X * distance
-X: camera 看向原点，位置在 target - X * distance
+Y: camera 在 target + Y * distance
-Y: camera 在 target - Y * distance
+Z: camera 在 target + Z * distance
-Z: camera 在 target - Z * distance
```

需要注意 top/bottom 视角的 up 向量：

```text
从 ±Y 看时，camera.up 不能与 view direction 平行。
需要选择稳定 up，例如 Z 或 -Z。
```

### 拖拽旋转

拖拽 Gizmo 主区域：

```text
horizontal drag -> yaw
vertical drag -> pitch
```

pitch 需要限制，避免相机翻转：

```text
pitch ∈ [-89°, 89°]
```

如果后续要支持 roll，可以通过按住修饰键或拖拽外圈实现，第一版不做。

### 模式切换

点击 `< Persp`：

```text
Perspective -> Orthographic
Orthographic -> Perspective
```

切换到 orthographic 时：

```text
替换 camera3 为 THREE.OrthographicCamera
或维护两个 camera3 实例并切换 active camera
```

为了第一版简单，可以只显示 `< Persp`，暂不切换；但 UI 上要避免用户误以为可点击。

### 锁定

锁定后：

```text
Gizmo 仍显示当前方向
不响应点击轴向
不响应拖拽
锁图标显示 locked
```

适合 Wallpaper 场景，避免用户误触。

## 10. 与当前动画的关系

当前 demo 有一段 3D line object 自动摆动：

```ts
lineAdapter.object.rotation.y = Math.sin(t * 0.2) * 0.12;
lineAdapter.object.rotation.x = Math.cos(t * 0.17) * 0.08;
```

如果 Gizmo 控制 3D 摄像机，应考虑关闭或弱化这段自动摆动。

原因：

```text
用户拖动摄像机时，物体还在额外摆动，会让方向感混乱。
Gizmo 显示的是 camera orientation，不是 object orientation。
```

建议：

```text
第一版 Gizmo 启用时，去掉 lineAdapter.object 的自动 x/y 摆动。
保留 4D model rotation，因为那是主题动画。
```

如果希望两者共存，应在文档中明确：

```text
Gizmo 控制的是 3D view。
物体本身仍有独立展示动画。
```

## 11. 输入事件与 Wallpaper 环境

Wallpaper 场景中交互需要谨慎：

```text
鼠标事件可能影响桌面使用体验。
Gizmo overlay 不应该覆盖整个屏幕。
只在右上角固定小区域捕获 pointer events。
非 Gizmo 区域保持 pointer-events: none 或不拦截。
```

通用 Gizmo 操作原则：

```text
一旦 pointerdown / touchstart 命中某个 Gizmo，该操作对象就固定为这个 Gizmo。
只要鼠标按键未松开或触摸未松开，即使指针移出 Gizmo 可视范围，也必须继续由原 Gizmo 处理。
操作只能在 pointerup / touchend 或 pointercancel 时结束。
后续所有 Gizmo 都必须遵守这个捕获语义，避免拖拽越界时交互突然中断。
```

建议：

```css
.camera-gizmo {
  pointer-events: auto;
}

.gizmo-layer {
  pointer-events: none;
}
```

如果后续希望普通壁纸模式隐藏 Gizmo，可以增加：

```text
debugGizmo: true/false
showCameraGizmo: true/false
```

或通过 URL 参数：

```text
?gizmo=1
```

第一版建议默认显示，便于验证；发布壁纸时再考虑默认隐藏或可配置。

## 12. 推荐文件拆分

当前 app 文件较少，但不要把 Gizmo 全塞进 `demo.ts`。

建议新增：

```text
apps/wallpaper-tesseract/src/camera3-rig.ts
apps/wallpaper-tesseract/src/camera-gizmo.ts
apps/wallpaper-tesseract/src/camera-gizmo.css
```

职责：

```text
camera3-rig.ts
- 保存 Camera3RigState
- 根据 yaw/pitch/distance 更新 THREE.Camera
- 提供 snapToAxis()
- 提供 orbit(deltaX, deltaY)

camera-gizmo.ts
- 创建 DOM overlay
- 绘制 2D gizmo
- 处理 pointer/mouse/touch
- 调用 camera3-rig

camera-gizmo.css
- 面板位置
- 颜色
- hover/locked 状态
```

## 13. 实施步骤

### Step 1：定义 3D camera rig

目的：

```text
把 3D 摄像机状态从 demo.ts 中抽离出来。
```

执行：

```text
1. 新建 camera3-rig.ts。
2. 定义 target/distance/yaw/pitch/mode/locked。
3. 提供 updateCamera(camera)。
4. 提供 orbit(dx, dy)。
5. 提供 snapToAxis(axis)。
```

完成标准：

```text
不接 Gizmo，只通过代码调用 snapToAxis/orbit 时，camera3 能正确改变视角。
```

### Step 2：添加静态 Gizmo overlay

目的：

```text
先确认 UI 位置、尺寸、样式不干扰主 canvas。
```

执行：

```text
1. 新建 camera-gizmo.ts 创建 DOM。
2. 新建 camera-gizmo.css。
3. 面板固定在右上角。
4. 绘制中心方块和 X/Y/Z 标签。
```

完成标准：

```text
右上角出现类似 Unity 的小面板。
主 tesseract 仍正常渲染。
非 Gizmo 区域不拦截鼠标。
```

### Step 3：让 Gizmo 跟随 camera3 方向刷新

目的：

```text
Gizmo 显示当前 3D 摄像机方向，而不是静态图标。
```

执行：

```text
1. 根据 camera3 quaternion 计算世界轴在 view space 中的位置。
2. 按 z/depth 排序绘制轴线。
3. 前方轴更亮，后方轴更暗。
4. 每帧或 camera rig 改变时 redraw。
```

完成标准：

```text
拖拽或 snap 改变 camera3 后，Gizmo 轴向随之变化。
```

### Step 4：实现点击轴向吸附

目的：

```text
提供 Unity Gizmo 最核心的点击轴向切视角能力。
```

执行：

```text
1. 为每个轴端点保存 2D hit circle。
2. pointerdown 时判断命中哪个轴。
3. 调用 rig.snapToAxis(axis)。
4. 更新 camera3 和 Gizmo。
```

完成标准：

```text
点击 X/Y/Z 正负方向后，camera3 能稳定切换到对应观察方向。
```

### Step 5：实现拖拽 orbit

目的：

```text
让用户通过拖拽 Gizmo 微调 3D 摄像机方向。
```

执行：

```text
1. pointerdown 记录起点。
2. pointermove 计算 dx/dy。
3. 调用 rig.orbit(dx, dy)。
4. 限制 pitch 防止翻转。
5. pointerup 结束。
```

完成标准：

```text
拖拽 Gizmo 面板时，3D 摄像机绕 target 旋转。
画面无跳动，无突然翻转。
```

### Step 6：添加锁定和模式显示

目的：

```text
补齐参考图中的 lock 和 < Persp 语义。
```

执行：

```text
1. 添加 locked 状态。
2. 锁定时事件处理直接 return。
3. 显示 < Persp 或 < Ortho。
4. 第一版可只显示模式，不做真正切换。
```

完成标准：

```text
锁定后 Gizmo 不响应操作。
模式文本与当前 camera 类型一致。
```

## 14. 测试与验收

### 视觉验收

```text
1. Gizmo 固定在右上角。
2. 小面板不遮挡主体 tesseract。
3. X/Y/Z 颜色与标签清楚。
4. 中心点和轴端点位置稳定。
5. 不出现文本溢出或 UI 重叠。
```

### 交互验收

```text
1. 点击 +X/-X 能切换视角。
2. 点击 +Y/-Y 不出现 camera.up 退化。
3. 点击 +Z/-Z 能恢复正面/背面观察。
4. 拖拽时视角连续旋转。
5. pitch 不会翻转。
6. locked 状态下无交互。
```

### 性能验收

```text
1. Gizmo 绘制不应创建大量临时对象。
2. 每帧更新应只重绘小 canvas。
3. 不新增第二个全屏 renderer。
4. 不影响主 tesseract 动画帧率。
```

### Wallpaper 环境验收

```text
1. dist/index.html 可通过 file:// 打开。
2. Wallpaper Engine Editor 打开 apps/wallpaper-tesseract 不应卡死。
3. Gizmo 只在自身区域捕获输入。
4. 可通过配置隐藏 Gizmo。
```

## 15. 风险点

### 风险 1：3D object 自动摆动与 camera 控制冲突

当前 line object 有轻微 3D 自动摆动。Gizmo 启用后，建议移除这段摆动，避免用户误判 camera 方向。

### 风险 2：top/bottom view 的 up 向量退化

从 Y 轴方向观察时，不能简单使用默认 `camera.up = (0,1,0)`。需要按目标方向选择稳定 up。

### 风险 3：Wallpaper 输入体验

壁纸场景不是普通 app，交互控件不应占据大面积屏幕，也不应影响桌面鼠标体验。

### 风险 4：Gizmo 与 4D Camera 概念混淆

UI 文案和代码命名必须明确：

```text
Camera3Gizmo / Camera3Rig
```

不要叫：

```text
CameraGizmo
```

否则后续容易和 `Camera4D` 混淆。

## 16. 建议第一版范围

第一版只做：

```text
右上角 overlay
2D canvas gizmo
X/Y/Z 轴显示
点击轴向 snap
拖拽 orbit
locked 状态
< Persp 文本显示
```

第一版暂不做：

```text
Perspective/Orthographic 真切换
roll 控制
复杂菜单
动画过渡
多语言
完整 Unity 风格图标系统
```

这样可以先验证“用 Gizmo 操作 3D 摄像机”这个核心体验，再决定是否把它做成正式可配置组件。
