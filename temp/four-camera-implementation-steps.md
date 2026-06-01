# Four Camera 实现步骤拆分与自测清单

本文档基于 `four-camera-architecture.md`，用于指导 v0.1-v0.4 核心链路的逐步实现。目标不是重复架构设计，而是把实现拆成可执行、可自测、边界明确的小阶段。

第一阶段的胜利条件：

```text
Tesseract4D
+ rotateXU / rotateYZ / rotateZU
+ Camera4D deterministic lookAt
+ perspective projection
+ safeNear/far line clipping
+ LineProjectionResult
+ ThreeLineAdapter
= Wallpaper Engine Web 中稳定显示旋转 4D tesseract 线框
```

暂不进入第一阶段的内容：

```text
mesh / cell projection
transparent sorting
Worker / WebGPU / WebGL2 backend
continuous camera
complex controls
ThreeMeshAdapter
4D ray tracing
```

总体 DoD 简版：

```text
数学约定测试通过
Transform 组合/alias/translation 测试通过
Tesseract 生成和验证通过
Camera deterministic lookAt 通过
point projection 与 line projection 通过
near/far 裁剪无 NaN / Infinity
ThreeLineAdapter 能显示 tesseract
index.html 中稳定旋转
截图保存在 temp/
动画热路径不创建 transform array / result buffer
```

Codex 执行补充规则：

```text
1. 不允许跨步骤提前实现暂缓功能。
2. 每一步必须新增或更新对应测试。
3. 每一步完成后必须运行 test/typecheck。
4. 热路径函数不得 new 临时 Vec/Matrix 对象。
5. 如果某个 API 暂未实现，必须抛出明确错误，不得 silent fallback。
6. 每一步应说明修改了哪些文件。
7. 如果实现与本文档冲突，优先修改文档并说明原因，不得静默改变语义。
8. 不得引入外部数学库。
```

## 0. 执行原则

### 目的

确保后续每个实现步骤都遵守同一套数学、性能和测试约束，避免边做边改基础语义。

### 边界

本阶段不写功能代码，只确认工程执行规则、测试习惯和临时产物位置。

### 执行细节

- 临时截图、渲染图片、临时报告统一放入 `temp/`。
- 核心库热路径避免对象分配，尤其是动画循环和 `projectLines`。
- 每个实现步骤完成后先跑对应自测，再进入下一步。
- 若某项能力暂不实现，必须明确抛错或不暴露 API，不能 silent fallback。
- 每完成一个步骤，应产生一个可回滚 checkpoint。若项目使用 Git，建议每步完成后提交一次，例如 `step-04-transform4d`、`step-05-rotation4d`。

### 完成后可自测

- 文档中所有临时产物路径均指向 `temp/`。
- 后续实现任务均能映射到本文档某一步。

## 0.1 步骤依赖与产出文件索引

这张表用于按文件粒度推进实现。若实际工程结构需要调整，应先更新本表再实现。

| 步骤 | 依赖 | 主要产出文件 |
| --- | --- | --- |
| Step 1 工程骨架 | 无 | `package.json`, `tsconfig.json`, `src/index.ts`, `tests/` |
| Step 2 数学约定 | Step 1 | `src/math/constants.ts`, `src/math/mat4.ts`, `tests/conventions.test.ts` |
| Step 3 Vec4/Mat4 | Step 2 | `src/math/vec4.ts`, `src/math/mat4.ts`, `tests/math.test.ts` |
| Step 4 Transform4D | Step 3 | `src/math/transform4.ts`, `tests/transform4.test.ts` |
| Step 5 4D 旋转 | Step 4 | `src/math/rotation4.ts`, `tests/rotation4.test.ts` |
| Step 6 Tesseract4D | Step 3 | `src/geometry/geometry4.ts`, `src/geometry/tesseract.ts`, `tests/tesseract.test.ts` |
| Step 7 Geometry 验证 | Step 6 | `src/geometry/validate-geometry4.ts`, `tests/geometry-validation.test.ts` |
| Step 8 Camera4D | Step 3 | `src/camera/camera4.ts`, `tests/camera4.test.ts` |
| Step 9 lookAt4D | Step 8 | `src/camera/look-at4.ts`, `tests/look-at4.test.ts` |
| Step 10 Result 缓冲 | Step 6 | `src/projector/projection-result.ts`, `tests/projection-result.test.ts` |
| Step 11 points 正交 | Step 8, Step 10 | `src/projector/cpu-projector4.ts`, `tests/project-points-ortho.test.ts` |
| Step 12 points 透视 | Step 11 | `src/projector/cpu-projector4.ts`, `tests/project-points-perspective.test.ts` |
| Step 13 lines 基础 | Step 7, Step 10, Step 12 | `src/projector/cpu-projector4.ts`, `tests/project-lines.test.ts` |
| Step 14 line clipping | Step 13 | `src/projector/edge-clipper4.ts`, `tests/edge-clipper4.test.ts` |
| Step 15 three adapter | Step 10 | `src/adapters/three-line-adapter.ts`, `tests/three-line-adapter.test.ts` |
| Step 16 demo | Step 14, Step 15 | `index.html`, demo entry file |
| Step 17 visual verify | Step 16 | `temp/tesseract-demo-static.png`, `temp/tesseract-demo-rotating.png` |
| Step 18 frustum | Step 14 | `src/camera/frustum4.ts`, `tests/frustum4.test.ts` |
| Step 19 extra geometry | Step 7 | `src/geometry/simplex4.ts`, `src/geometry/hyperoctahedron4.ts` |
| Step 20 depth color | Step 15 | `src/animation/depth-style.ts`, `tests/depth-style.test.ts` |

## 1. 建立工程骨架

### 目的

为 4D 投影库建立可维护的源码、测试和示例结构，让后续模块可以独立实现和验证。

### 边界

只建立目录、入口文件、测试框架和基础导出，不实现数学逻辑。

### 执行细节

建议目录：

```text
src/
  math/
  geometry/
  camera/
  projector/
  adapters/
  animation/
  index.ts
tests/
examples/
```

第一轮可以只创建实际会用到的文件：

```text
src/math/
src/geometry/
src/camera/
src/projector/
src/adapters/
tests/
```

如果项目尚未使用构建工具，优先选择简单、浏览器友好的 TypeScript/ESM 架构。不要一开始引入 Worker/WebGPU 构建复杂度。

建议 `package.json` 至少提供：

```json
{
  "scripts": {
    "dev": "vite",
    "test": "vitest run",
    "typecheck": "tsc --noEmit",
    "build": "vite build"
  }
}
```

如果暂时不用 Vite，也至少应保留：

```text
npm run test
npm run typecheck
```

### 完成后可自测

- 可以运行测试命令，即使暂时没有实际测试。
- `src/index.ts` 能导出空壳或占位模块。
- 构建或类型检查能跑通。

## 2. 固化数学约定

### 目的

把所有会影响坐标方向、矩阵乘法和动画结果的约定写成代码和测试，防止实现分叉。

### 边界

本步只实现最基础的常量、索引函数和约定测试，不实现完整矩阵库。

### 执行细节

必须固定：

```text
4D point = column vector
matrix storage = column-major
mat4Index(row, col) = col * 4 + row
p_world = M * p_model + translation
multiplyTransform4D(a,b,out) = a ∘ b
u_eye > 0 表示在 Camera4D 前方
det[basisX,basisY,basisZ,basisU] > 0
```

实现：

```ts
export const EPSILON4D = 1e-6;

export function mat4Index(row: number, col: number): number {
  return col * 4 + row;
}
```

`mat4Index` 是低层工具，不在热路径做范围检查；测试必须覆盖调用方只使用 `0..3` 的 row/col。

### 完成后可自测

- `mat4Index(0,0) === 0`
- `mat4Index(1,0) === 1`
- `mat4Index(0,1) === 4`
- `mat4Index(3,3) === 15`
- 调用方测试覆盖 row/col 只使用 `0..3`。
- 测试文件能明确说明 column-major 和 column vector 约定。

## 3. 实现 Vec4 与 Mat4 基础工具

### 目的

提供后续 Transform、Camera、Projector 共用的无状态数学函数。

### 边界

只实现必要函数，不创建热路径中的 `class Vec4` 对象。不要引入外部数学库。

### 执行细节

建议实现：

```ts
dot4(ax, ay, az, au, bx, by, bz, bu): number
length4(...)
normalize4To(...)
subtract4To(...)
copy4To(...)
det4Columns(...)
rejectFromBasis4To(...)
identityMat4(out)
multiplyMat4(a, b, out)
transformMat4Vec4(m, x, y, z, u, out, offset)
```

注意：

- `multiplyMat4` 必须遵守 column-major。
- 若支持 alias，应先计算到局部 number，再写 `out`。
- 所有函数应尽量写入传入的 `out`。
- `det4Columns` 用于 Camera basis determinant 验证。
- `rejectFromBasis4To` 用于 Gram-Schmidt：先从输入向量中减去已有 basis 分量，返回结果长度是否足够可归一化。
- `cross4` 可选；若不实现，Step 9 使用 `rejectFromBasis4To` 从 fallback axes 构造 `basisX`。

### 完成后可自测

- 单位矩阵乘任意向量不改变结果。
- `dot4([1,0,0,0],[0,1,0,0]) === 0`
- `normalize4To([3,0,0,0])` 得到 `[1,0,0,0]`
- `multiplyMat4(identity, m)` 和 `multiplyMat4(m, identity)` 均等于 `m`
- `det4Columns(eX,eY,eZ,eU) > 0`。
- `rejectFromBasis4To(eX, [eX])` 返回退化结果，不产生 NaN。
- `rejectFromBasis4To(eY, [eX])` 得到 `eY`。
- 所有输出数值为 finite。

## 4. 实现 Transform4D

### 目的

支持 4D 模型变换，包括平移、旋转、缩放和组合，是所有几何进入相机空间前的基础。

### 边界

只做 4D affine transform：`Mat4 + Vec4 translation`。不实现 5x5 齐次矩阵。

### 执行细节

类型：

```ts
export interface Transform4D {
  matrix: Float32Array;      // length = 16
  translation: Float32Array; // length = 4
}
```

必须实现：

```ts
identityTransform4D(out?)
cloneTransform4D(t)
translate4D(offset, out?)
scale4D(scale, out?)
multiplyTransform4D(a, b, out)
composeTransform4D(parts, out?)
composeTransform4DInto(out, ...parts)
transformPoint4D(t, x, y, z, u, out, offset?)
```

`scale4D` 参数语义：

```ts
scale4D(scale: number | Vec4, out?: Transform4D): Transform4D
```

其中 `scale4D(2)` 等价于 `[2,2,2,2]`，`scale4D([1,2,3,4])` 表示分轴缩放。

组合语义：

```text
multiplyTransform4D(a,b,out) = a ∘ b
composeTransform4D([a,b,c]) = c ∘ b ∘ a
```

translation 组合公式：

```text
out.matrix = Ma * Mb
out.translation = Ma * tb + ta
```

alias 要求：

```text
multiplyTransform4D(a,b,a) 必须正确
multiplyTransform4D(a,b,b) 必须正确
```

`composeTransform4D([], out)` 必须返回 identity。

### 完成后可自测

- `identityTransform4D` 作用于点不改变点。
- `translate4D([1,2,3,4])` 作用于原点得到 `[1,2,3,4]`。
- `multiplyTransform4D(rotateXY90, translateX1)` 作用于原点得到 `[0,1,0,0]`。
- `composeTransform4D([translateX1, rotateXY90])` 作用于原点得到 `[0,1,0,0]`。
- `composeTransform4D([])` 返回 identity。
- `scale4D(2)` 等价于四轴同缩放。
- `scale4D([1,2,3,4])` 正确分轴缩放。
- alias 测试：`out === a` 和 `out === b` 结果与非 alias 相同。
- 所有 Transform 输出数值为 finite。

## 5. 实现 4D 旋转函数

### 目的

提供 4D 动画最核心的旋转能力。4D 旋转发生在二维平面内，不是绕单一轴旋转。

### 边界

只实现六个基础平面旋转和通用 `rotatePlane4D`。不实现四元数、双旋转插值或 keyframe 动画。

### 执行细节

必须实现：

```ts
rotateXY(angle, out?)
rotateXZ(angle, out?)
rotateXU(angle, out?)
rotateYZ(angle, out?)
rotateYU(angle, out?)
rotateZU(angle, out?)
rotatePlane4D(axisA, axisB, angle, out?)
```

`rotatePlane4D` 必须验证：

```text
axisA / axisB 在 0..3
axisA !== axisB
angle finite
```

若 `axisA === axisB`，必须抛错，不要静默返回 identity。

正方向：

```text
a' = cos(theta) * a - sin(theta) * b
b' = sin(theta) * a + cos(theta) * b
```

所有旋转函数传入 `out` 时必须完全覆盖：

```text
matrix = identity + rotation terms
translation = [0,0,0,0]
```

### 完成后可自测

- `rotateXY(PI/2)` 把 `[1,0,0,0]` 变为 `[0,1,0,0]`。
- 六个旋转平面都保持向量长度。
- `rotateXU(PI/2)` 把 `[1,0,0,0]` 变为 `[0,0,0,1]`。
- 用带 translation 的旧 `out` 调用 `rotateXU(angle,out)` 后，translation 被清零。
- `rotatePlane4D(0,0,angle)` 抛错。
- `rotatePlane4D(-1,2,angle)` 和 `rotatePlane4D(0,4,angle)` 抛错。
- `rotatePlane4D(0,1,NaN)` 抛错。
- 所有旋转矩阵符合 column-major `mat4Index(row,col)`。

## 6. 实现 Geometry4D 与 Tesseract4D

### 目的

提供第一个可视化对象：tesseract 线框。它是后续 projector、adapter 和 demo 的核心测试对象。

### 边界

第一阶段只必须实现 `createTesseract4D`。`createSimplex4D` 和 `createHyperoctahedron4D` 可以暂缓，若暂缓则不要导出未定义 API。

### 执行细节

类型：

```ts
export interface Geometry4D {
  positions4: Float32Array;
  vertexCount: number;
  edges?: Uint16Array | Uint32Array;
  edgeCount?: number;
  triangles?: Uint16Array | Uint32Array;
  triangleCount?: number;
}
```

tesseract 顶点：

```text
size 默认值为 2
center 默认值为 [0,0,0,0]
size 表示边长
s = size / 2
vertices = (±s, ±s, ±s, ±s)
```

tesseract 边：

```text
两个顶点只有一个 bit 不同时连边
vertexCount = 16
edgeCount = 32
```

### 完成后可自测

- `createTesseract4D({ size: 2 })` 的 `vertexCount === 16`。
- `edgeCount === 32`。
- `positions4.length === 64`。
- `edges.length === 64`。
- 每条边连接的两个顶点恰好只有一个坐标符号不同。
- 所有边长都等于 `size`。
- 所有顶点平均值等于 `center`。
- `createTesseract4D({ size: 2, center: [1,2,3,4] })` 的顶点平均值为 `[1,2,3,4]`。

## 7. 实现 Geometry 验证与归一化

### 目的

保证输入几何在进入 projector 前结构可靠，避免越界索引或 NaN 在投影阶段扩散。

### 边界

只验证数据结构，不修复错误几何。`normalizeGeometry4D` 可以补全 `edgeCount` / `triangleCount`，但不应猜测缺失拓扑。

### 执行细节

实现：

```ts
normalizeGeometry4D(input): Geometry4D
validateGeometry4D(input): void
validateTesseractOptions(options): void
```

验证项：

```text
positions4.length === vertexCount * 4
positions4 全部 finite
edges.length 可被 2 整除
triangles.length 可被 3 整除
edge/triangle index 均在 [0, vertexCount)
```

Factory options 验证不属于 `validateGeometry4D`，应拆到对应 factory：

```text
validateTesseractOptions:
  size > 0
  center finite

validateSimplex4DOptions:
  size > 0
  center finite

validateHyperoctahedron4DOptions:
  size > 0
  center finite
```

### 完成后可自测

- 合法 tesseract 通过验证。
- `positions4` 含 `NaN` 时抛错。
- `edges` 含越界 index 时抛错。
- `edges.length` 为奇数时抛错。
- 未传 `edgeCount` 时能从 `edges.length / 2` 推导。
- `validateTesseractOptions({ size: 0 })` 抛错。
- `validateTesseractOptions({ center: [0, NaN, 0, 0] })` 抛错。

## 8. 实现 Camera4D 基础结构

### 目的

建立 4D 摄影机的状态容器：位置、4D 正交 basis、投影参数、near/far 和 viewbox mapping。

### 边界

本步只实现构造、参数复制和验证。`setLookAt` 可在下一步实现。

### 执行细节

Camera 必须拥有：

```text
position[4]
basisX/Y/Z/U[4]
projection
focalScale[3]
tanHalfFov[3]
orthoHalfExtent[3]
near / far
viewBoxCenter[3]
viewBoxScale[3]
```

输入规则：

```text
用户传入数组必须复制，不保留引用
fov4/fovX/fovY/fovZ 只是输入简写
运行时唯一数据源为 focalScale + tanHalfFov
orthoScale 是 orthoHalfExtent=[s,s,s] 的简写
```

验证规则：

```text
near finite and > 0
safeNear = max(near, EPSILON4D)
far finite and > safeNear
viewBoxScale 每个分量非 0
手动 basis 必须 finite、归一、两两正交、det > 0
focalScale 每个分量 finite and > 0
tanHalfFov 每个分量 finite and > 0
orthoHalfExtent 每个分量 finite and > 0
fov4/fovX/fovY/fovZ 必须在 (0, PI)
projection 必须是 "orthographic" 或 "perspective"
```

### 完成后可自测

- 修改构造函数外部的 `position` 数组不会改变 camera 内部状态。
- `fov4` 能归一化为相同的 `focalScale[0..2]` 和 `tanHalfFov[0..2]`。
- 直接传 `focalScale` 时，`tanHalfFov = 1 / focalScale`。
- `far <= safeNear` 抛错。
- `viewBoxScale` 含 0 抛错。
- 非正交手动 basis 抛错。
- `focalScale` 含 0、负数或非有限数时抛错。
- `orthoHalfExtent` 含 0、负数或非有限数时抛错。
- 非法 `projection` 抛错。

## 9. 实现 deterministic lookAt4D

### 目的

从 position/target 构造稳定、可复现的 4D 相机正交标架。

### 边界

第一阶段只实现 deterministic。`continuous` 必须抛出明确错误，不 silent fallback。

### 执行细节

默认参数固定：

```text
defaultUpHint = [0,1,0,0]
defaultOverHint = [0,0,1,0]
fallback axes = [x,y,z,u]
```

步骤：

```text
basisU = normalize(target - position)
尝试用 upHint 生成 basisY：
  reject upHint from [basisU]
  先检查 reject 后长度，再 normalize
  若长度过小，则从 fallback axes 依次找一个可用向量
尝试用 overHint 生成 basisZ：
  reject overHint from [basisU,basisY]
  先检查 reject 后长度，再 normalize
  若长度过小，则从 fallback axes 依次找一个可用向量
basisX:
  若实现 cross4，则 basisX = normalize(cross4(basisY,basisZ,basisU))
  否则从 fallback axes 中 reject from [basisU,basisY,basisZ]
若 det < 0，翻转 basisX
```

### 完成后可自测

- `setLookAt([0,0,0,-5], [0,0,0,0])` 后 target 的 `u_eye > 0`。
- basis 两两点积接近 0。
- basis 长度接近 1。
- determinant > 0。
- `position == target` 抛错。
- `upHint` 与 `basisU` 平行时仍能 fallback。
- `upHint=[0,0,0,1]` 且 `basisU=[0,0,0,1]` 时，不产生 NaN。
- `stability: "continuous"` 抛出 `continuous lookAt4D is not implemented yet`。

## 10. 实现 ProjectionResult 缓冲

### 目的

建立 projector 输出缓存，保证投影阶段可以无分配写入结果。

### 边界

只创建 result buffer，不实现投影算法。

### 执行细节

点结果：

```text
IndexedPointProjectionResult
CompactPointProjectionResult
```

线结果：

```text
LineProjectionResult.positions3 length = edgeCount * 2 * 3
LineProjectionResult.depths4 length = edgeCount * 2
LineProjectionResult.segmentCount
LineProjectionResult.bounds3
```

`Bounds3`：

```ts
interface Bounds3 {
  min: Float32Array; // length=3
  max: Float32Array; // length=3
  valid: boolean;
}
```

### 完成后可自测

- `createCompactPointResult(tesseract)` 分配容量为 `vertexCount`。
- `createIndexedPointResult(tesseract)` 的 `visibility.length === vertexCount`。
- `createLineResult(tesseract)` 的 `positions3.length === edgeCount * 6`。
- `bounds3.valid` 初始为 `false`。
- `createLineResult` 在 `geometry.edges` 不存在时抛错。

## 11. 实现 projectPoints: 正交模式

### 目的

先跑通最简单的 4D 点投影路径，为 camera、viewbox 和 result 布局建立基线。

### 边界

只做点投影和正交模式。不做线段、不做透视、不做 frustum。

### 执行细节

流程：

```text
读取 positions4
应用 model transform
转入 camera space
safeNear/far 判断
正交投影：
  x3 = x_eye / orthoHalfExtent.x
  y3 = y_eye / orthoHalfExtent.y
  z3 = z_eye / orthoHalfExtent.z
viewbox mapping
写入 out
更新 bounds
```

`projectPoints` 必须根据 `out.layout` 分支，不得改变 layout。

本步 clipping 行为先按下表实现或抛错：

| clipping + policy | orthographic 行为 | perspective 行为 |
| --- | --- | --- |
| `none-unsafe + drop` | 不做 far，至少要求输出 finite | 只做 `u >= EPSILON4D` guard |
| `none-unsafe + allow` | 不保护 | 不保护 |
| `singularity-only + drop` | `u >= EPSILON4D` | `u >= EPSILON4D` |
| `singularity-only + allow` | 配置错误，抛错 | 配置错误，抛错 |
| `near-far + drop` | `safeNear <= u <= far` | `safeNear <= u <= far` |
| `near-far + allow` | 配置错误，抛错 | 配置错误，抛错 |
| `frustum + drop` | 未实现时抛错 | 未实现时抛错 |
| `frustum + allow` | 配置错误，抛错 | 配置错误，抛错 |

### 完成后可自测

- 正交模式下第四维只影响 depth/visibility，不影响 x/y/z 投影。
- compact result 的 `visiblePointCount` 正确。
- indexed result 的 `vertexCount` 保持原始顶点数。
- `visibility` 对 near/far 外点为 0。
- bounds 在有可见点时 `valid === true`。
- `clipping:"frustum"` 未实现时抛错。
- `near-far + allow` 抛配置错误。
- 所有 `positions3` 为 finite。

## 12. 实现 projectPoints: 透视与 singularity guard

### 目的

加入 4D 摄影感：用 `u_eye` 缩放前三个坐标，并防止透视除法爆炸。

### 边界

仍然只做点投影。不做线段裁剪。

### 执行细节

透视公式：

```text
x3 = focalScale.x * x_eye / u_eye
y3 = focalScale.y * y_eye / u_eye
z3 = focalScale.z * z_eye / u_eye
```

安全规则：

```text
safeNear = max(camera.near, EPSILON4D)
默认使用 safeNear <= u_eye <= far
singularityPolicy="allow" 只允许 clipping="none-unsafe"
```

### 完成后可自测

- 更大的 `u_eye` 产生更小投影比例。
- `u_eye < safeNear` 不会进入除法。
- `u_eye` 接近 0 时不产生 `NaN` / `Infinity`。
- `none-unsafe + allow` 可显式允许无保护除法。
- `singularity-only + allow` 抛配置错误。
- `near-far + allow` 抛配置错误。
- `frustum + allow` 抛配置错误。

## 13. 实现 CPUProjector4D scratch 与 projectLines 基础

### 目的

建立线框投影主路径，使用 `geometry.edges` 生成输出线段缓存。

### 边界

本步可以先只输出两个端点都在 safeNear/far 内的线段，暂不裁剪穿越 near/far 的线段。

### 执行细节

Projector 内部预留：

```text
scratchEye4: Float32Array
scratchVisibility: Uint8Array
ensureScratchCapacity(vertexCount)
```

流程：

```text
重置 out.segmentCount 和 bounds
所有顶点 model -> camera，写入 scratchEye4
遍历 edges
读取两个 eye4 端点
如果端点都可见，投影并写入 positions3/depths4
更新 segmentCount/bounds
```

本步 `projectLines` 的端点可见性必须复用 `projectPoints` 的同一套 point visibility 函数，不要重新写一套 `uEye` 判断。`scratchVisibility` 暂时可选；若实现，必须与 point visibility 规则一致。

### 完成后可自测

- `projectLines` 在没有 `geometry.edges` 时抛错。
- tesseract 在默认相机前方时输出 `segmentCount === 32`。
- `positions3.length` 不改变。
- `projectLines` 连续调用不会累加上一帧 segmentCount。
- line visibility 与 point visibility 对同一端点判断一致。
- 所有输出为 finite。

## 14. 实现 near/far 线段裁剪

### 目的

让穿越 near/far 的 4D 线段被正确截断，避免透视爆炸和线段突然消失。

### 边界

只实现 `safeNear <= u <= far` 的一维深度裁剪。不实现完整 frustum。

### 执行细节

裁剪区间：

```text
p(t) = p0 + t(p1-p0)
u(t) = u0 + t(u1-u0)
safeNear <= u(t) <= far
```

推荐使用半空间 / Liang-Barsky 风格实现，避免端点在区间内时被错误裁掉。

写入规则：

```text
depths4 必须写入裁剪后的 u_eye，而不是原始端点 u_eye
bounds3 必须基于裁剪后再投影的 3D 端点更新
```

### 完成后可自测

- 两端都在区间内：线段不变。
- 两端都小于 safeNear：线段丢弃。
- 两端都大于 far：线段丢弃。
- 一端小于 safeNear、一端在内部：输出端点被裁到 safeNear。
- 一端在内部、一端大于 far：输出端点被裁到 far。
- 穿过整个区间：输出两个端点分别在 safeNear 和 far。
- 裁剪后端点 `u` 与 `safeNear/far` 的误差 <= `EPSILON4D * 10`。
- `depths4` 保存裁剪后的 `u`。
- bounds 基于裁剪后投影点更新。
- 所有裁剪后端点投影为 finite。

## 15. 实现 ThreeLineAdapter 与可选 ThreePointAdapter

### 目的

把核心库的 3D buffer 写入 three.js，使浏览器可以显示投影结果。

### 边界

Adapter 不包含任何 4D 数学，不知道 `Camera4D`、`Transform4D`、`Geometry4D`。第一阶段刚需是 `ThreeLineAdapter`；`ThreePointAdapter` 可选。

### 执行细节

`ThreeLineAdapterOptions`：

```ts
{
  maxSegmentCount: number;
  usage?: THREE.Usage;
  boundsMode?: "none" | "fixed" | "compute-each-frame";
  fixedBoundingRadius?: number;
  vertexColors?: boolean;
}
```

规则：

```text
构造时创建 BufferGeometry / BufferAttribute
update 时只写已有 attribute
vertexColors:true 时构造 color attribute
vertexColors:false 时收到 result.colors 应抛错
默认不承诺可变线宽
```

### 完成后可自测

- adapter 构造后 geometry 有 position attribute。
- `update(lineResult)` 后 drawRange 等于 `segmentCount * 2`。
- `positionAttribute.needsUpdate === true`。
- 如果 `vertexColors:true`，则 `colorAttribute.needsUpdate === true`。
- 连续 update 不创建新的 BufferGeometry / BufferAttribute。
- `vertexColors:false` 且 result.colors 存在时抛错。
- `dispose()` 调用 `geometry.dispose()`。
- `boundsMode:"none"` 时示例对象应设置 `frustumCulled=false`。

## 16. 替换 index.html 为 Tesseract Demo

### 目的

在 Wallpaper Engine Web 工程中验证完整链路：4D 几何 -> 4D 投影 -> three.js 显示。

### 边界

只做一个稳定、克制的旋转 tesseract 线框 demo。不做 UI、不做复杂材质、不做 mesh。

### 执行细节

动画中必须预分配：

```text
rXU
rYZ
rZU
tmp
model4
lineResult
adapter buffers
```

动画循环：

```text
rotateXU(t, rXU)
rotateYZ(t, rYZ)
rotateZU(t, rZU)
multiplyTransform4D(rYZ, rXU, tmp)
multiplyTransform4D(rZU, tmp, model4)
projectLines(...)
adapter.update(...)
renderer.render(...)
```

临时截图保存到 `temp/`。

Demo 必须包含生命周期：

```ts
start()
stop()
dispose()
```

`requestAnimationFrame()` 是 one-shot，必须在回调内再次请求下一帧；动画进度使用回调传入的 `timeMs`，不要用固定帧步长驱动速度。

### 完成后可自测

- 浏览器中能看到旋转 tesseract 线框。
- 控制台无错误。
- 透视变化无爆炸闪烁。
- 输出截图保存到 `temp/`。
- 视觉上没有残留旧线段。
- 动画循环不创建 transform array / result buffer。
- `stop()` 能取消 raf。
- `dispose()` 能释放 adapter 和 renderer。

## 17. 浏览器与视觉验证

### 目的

确认页面在真实浏览器渲染中可用，而不只是单元测试通过。

### 边界

只验证当前 demo，不做跨浏览器兼容矩阵。

### 执行细节

建议验证：

```text
本地 file:// 或 dev server 打开 index.html
桌面尺寸截图
至少一张旋转中的截图
检查 canvas 非空
检查无 NaN/Infinity 导致的画面飞线
```

如果项目使用 Playwright，可加入最小截图测试；如果暂时不自动化，至少保留人工确认截图。建议截图路径：

```text
temp/tesseract-demo-static.png
temp/tesseract-demo-rotating.png
```

### 完成后可自测

- 截图中 tesseract 位于视野内。
- 背景和线条可辨识。
- 截图不是空白或全黑。
- 无明显线段残留。

## 18. Frustum Clipping 后续步骤

### 目的

在 near/far 稳定后，再实现完整 4D perspective frustum，使投影与规范视盒一致。

### 边界

这是第一阶段跑通后的增强项。未实现前，`clipping:"frustum"` 必须抛出明确错误。

### 执行细节

只有 Step 14 near/far 线段裁剪完全通过后，才允许实现本步骤。frustum 裁剪应复用 Step 14 的半空间裁剪框架，不写第二套裁剪算法。

frustum planes 只能由 Camera 生成：

```text
读取 camera.tanHalfFov
读取 safeNear/far
构造 8 个半空间
```

不得读取可能过期的 `fov4/fovX/fovY/fovZ`。

### 完成后可自测

- 未实现时：`clipping:"frustum"` 抛错。
- 实现后：frustum 可见点投影后满足 `|x3| <= 1`、`|y3| <= 1`、`|z3| <= 1`。
- 线段穿过 frustum 侧面时被裁剪。
- 所有输出为 finite。

## 19. Simplex / Hyperoctahedron 后续步骤

### 目的

扩展基础 4D polytope，用更多几何验证投影库的通用性。

### 边界

只有在 tesseract 主链路稳定后再实现。若不实现，不导出 API。

### 执行细节

统一语义：

```text
size 表示边长
center 表示顶点平均中心
```

Simplex4D：

```text
5 vertices
10 edges
任意两顶点连边
所有 pairwise distance = size
```

Hyperoctahedron4D：

```text
8 vertices
24 edges
顶点为 4D 坐标轴正负端点
s = size / sqrt(2)
不连接相反点
每个顶点 degree = 6
```

### 完成后可自测

- simplex: `vertexCount === 5`
- simplex: `edgeCount === 10`
- simplex: 所有 pairwise distance 近似等于 `size`
- hyperoctahedron: `vertexCount === 8`
- hyperoctahedron: `edgeCount === 24`
- hyperoctahedron: 每个顶点 degree 为 6
- 两者都能通过 `validateGeometry4D`
- 两者都能通过 `projectLines` 输出 finite 线段。

## 20. Depth Color 后续步骤

### 目的

利用 `depths4` 为线段提供第四维深度感，但不污染核心投影逻辑。

### 边界

只实现颜色映射工具，不实现可变线宽或透明排序。

### 执行细节

实现：

```ts
applyDepthColorToLines(result, camera, colorMap, outColors)
```

使用路径：

```ts
lineResult.colors = lineColors;
applyDepthColorToLines(lineResult, camera4, colorMap, lineResult.colors);
adapter.update(lineResult);
```

`ThreeLineAdapter` 必须以 `vertexColors:true` 构造。

`applyDepthColorToLines` 只处理当前有效端点：

```text
endpointCount = result.segmentCount * 2
```

不得写超出当前有效 drawRange 的颜色。

### 完成后可自测

- `outColors.length === maxSegmentCount * 2 * 3`
- 更近和更远的端点颜色不同。
- 只写入 `result.segmentCount * 2` 个端点颜色。
- `vertexColors:false` 时传入 colors 会抛错。
- demo 中能看到线条颜色随 4D depth 变化。

## 21. 最小验收清单

当以下全部成立，可以认为 v0.1-v0.4 核心链路完成：

- 数学约定测试通过。
- Transform 组合、alias、translation 测试通过。
- Tesseract 生成和验证测试通过。
- Camera deterministic lookAt 测试通过。
- point projection 正交和透视测试通过。
- line projection near/far 裁剪测试通过。
- 所有 projection 输出无 `NaN` / `Infinity`。
- ThreeLineAdapter 能显示 tesseract。
- `index.html` 中有稳定旋转的 tesseract 线框。
- 浏览器截图保存在 `temp/`。
- 动画热路径不创建 transform array / result buffer。
