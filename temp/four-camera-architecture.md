# Four Camera 4D Projection Library: 实现计划与架构设计

## 0. 目标定位

这个库的第一版目标不是做完整的 4D 渲染引擎，而是做一个适用于网页动画的 **4D 摄影/投影内核**：

```text
4D Geometry
-> 4D Model Transform
-> 4D Camera View Transform
-> 4D Clipping
-> 4D to 3D Projection
-> 3D Viewbox Mapping
-> Projected 3D Buffers
```

最终的屏幕显示交给普通 3D 渲染器，例如 three.js、Babylon.js、原生 WebGL 或 WebGPU。本库只负责把 4D 世界“拍成”普通 3D 几何缓存。

核心原则：

- 保持边界清晰：4D 数学和投影在核心库里，材质、光照、阴影、后处理和 3D 相机控制在外部渲染器里。
- 第一版优先支持线框和点云，尤其是 tesseract、simplex、hyperoctahedron 等 4D polytope。
- 默认使用 CPU + TypedArray，保证实现可调试、可验证、可移植。
- 动画循环中避免临时对象分配，所有投影结果尽量写入预分配缓冲。
- 第四维空间坐标统一命名为 `u`，避免和图形学齐次坐标 `w` 混淆。

### 0.1 强制数学约定

这些约定不是建议，而是实现和测试必须遵守的契约。后续如果单独拆出 `CONVENTIONS.md`，应与本节保持一致。

```text
4D 点向量：column vector，p = [x, y, z, u]^T
矩阵存储：column-major
点变换：p_world = M * p_model + translation
组合语义：multiplyTransform4D(a, b, out) 返回 a ∘ b，即 p' = a(b(p))
相机深度：u_eye > 0 表示点位于 Camera4D 前方
相机手性：det[basisX, basisY, basisZ, basisU] > 0
```

4D 平面旋转的正方向固定为：

```text
a' = cos(theta) * a - sin(theta) * b
b' = sin(theta) * a + cos(theta) * b
```

因此 `rotateXY(Math.PI / 2)` 应把 `(1, 0, 0, 0)` 变为 `(0, 1, 0, 0)`。这个具体数值必须进入单元测试，不能只测试长度保持。

## 1. 版本路线

### v0.1: Conventions + 数学核心

交付内容：

- 固化并测试本文件 `0.1` 节中的数学约定。
- `Vec4Like` 类型与基础函数。
- `Mat4` 表示 4D 线性变换。
- `Transform4D` 表示 4D 模型变换，使用 `Mat4 + Vec4 translation`。
- 六个基础 4D 旋转平面：`xy`、`xz`、`xu`、`yz`、`yu`、`zu`。
- 组合变换函数：缩放、平移、旋转、矩阵相乘、点变换。
- 组合顺序测试，明确 `multiplyTransform4D(a,b)` 是 `a ∘ b`。

### v0.2: 4D 相机

交付内容：

- `Camera4D` 类或工厂函数。
- `basisX/Y/Z/U` 四维正交标架。
- `lookAt4D` 构造相机朝向，包含 deterministic fallback。
- 预留 continuous lookAt 模式，避免动画相机 roll snapping。
- 正交投影与透视投影参数，支持 `fov4` 简写和 `fovX/Y/Z` 高级模式。
- near/far 裁剪参数。
- 3D viewbox 映射参数。
- 相机参数验证和 basis determinant 正号约束。

### v0.3: 4D 几何

交付内容：

- `Geometry4D` 数据结构。
- `createTesseract4D`。
- 可选：`createSimplex4D`，若实现必须满足第 6.4 节标准。
- 可选：`createHyperoctahedron4D`，若实现必须满足第 6.5 节标准。
- 可选：4D 曲线采样器。

### v0.4: CPU 投影器

交付内容：

- `CPUProjector4D`。
- `projectPoints`。
- `projectLines`，输入 `geometry.edges`，输出裁剪后的 `LineProjectionResult`。
- near/far 边裁剪。
- 透视 singularity guard。
- 明确 compact / indexed 点结果语义。
- `LineProjectionResult`。
- bounds、depth、visibility 输出。
- 可选 frustum clipping；未实现时必须抛错，不能静默降级。

### v0.5: three.js 适配

交付内容：

- `ThreePointAdapter`。
- `ThreeLineAdapter`。
- 可选 `ThreeFatLineAdapter`，用于粗线、屏幕空间线宽或深度线宽。
- 适配层只写入 `BufferGeometry`，不包含 4D 数学。
- 暂不交付 `ThreeMeshAdapter`。若后续加入，应命名为 experimental，并明确不处理严谨 4D triangle clipping / cell projection。

### v0.6: 动画工具

交付内容：

- `RotationAnimator4D`。
- keyframe 插值。
- 深度颜色映射工具。
- 简单 4D 相机轨道控制。
- `start()` / `stop()` / `dispose()` / `resize()` 示例生命周期。
- Wallpaper Engine Web 示例。

### v0.7: 性能扩展

交付内容：

- Worker backend。
- WebGL2 experimental backend。
- WebGPU compute backend。
- Worker 后端使用异步帧流和双缓冲语义。
- WebGPU 后端输出 GPUBuffer 结果类型，不承诺每帧 readback 成 `Float32Array`。

## 2. 推荐目录结构

```text
src/
  math/
    types.ts
    vec4.ts
    mat4.ts
    transform4.ts
    rotation4.ts
    basis4.ts

  geometry/
    geometry4.ts
    tesseract.ts
    simplex4.ts
    hyperoctahedron4.ts
    curves4.ts

  camera/
    camera4.ts
    look-at4.ts
    projection4.ts
    frustum4.ts

  projector/
    projection-result.ts
    edge-clipper4.ts
    cpu-projector4.ts

  adapters/
    three-line-adapter.ts
    three-point-adapter.ts

  animation/
    rotation-animator4.ts
    depth-style.ts

  index.ts
```

第一版可以先把模块保持为少量文件，等 API 稳定后再拆细。关键是让职责边界保持清楚：

- `math`：无状态数学函数。
- `geometry`：生成和描述 4D 几何。
- `camera`：描述 4D 摄影机。
- `projector`：把 4D 几何投影成 3D 缓存。
- `adapters`：把投影结果写入具体渲染器。
- `animation`：可选工具层，不进入核心投影逻辑。

## 3. 核心数据结构

### 3.1 Vec4 与 Vec3

第一版不建议在热路径中创建 `class Vec4` 对象。公开 API 可以接受 tuple，内部热路径使用数字和 TypedArray。

```ts
export type Vec3 = [number, number, number];
export type Vec4 = [number, number, number, number];

export interface Vec4Like {
  0: number;
  1: number;
  2: number;
  3: number;
}
```

TypedArray 布局：

```text
positions4 = [x0,y0,z0,u0, x1,y1,z1,u1, ...]
positions3 = [x0,y0,z0, x1,y1,z1, ...]
edges      = [a0,b0, a1,b1, ...]
```

### 3.2 Geometry4D

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

约定：

- `positions4.length === vertexCount * 4`。
- `edges.length === edgeCount * 2`。
- `triangles.length === triangleCount * 3`。
- 第一版线框投影以 `edges` 为主。
- 即使几何使用 `Uint16Array`，投影器不应假设顶点数永远小于 65536。
- `edgeCount` / `triangleCount` 可以由 `normalizeGeometry4D` 自动推导，但必须能被 2 / 3 整除。

第一版暂不在 `Geometry4D` 中放含糊的 `colors` 字段。若需要颜色，应明确拆成：

```ts
vertexColors?: Float32Array; // length = vertexCount * 3, linear RGB
edgeColors?: Float32Array;   // length = edgeCount * 3, linear RGB
```

辅助 API：

```ts
export function normalizeGeometry4D(input: Geometry4D): Geometry4D;
export function validateGeometry4D(input: Geometry4D): void;
```

### 3.3 Transform4D

使用 4x4 线性部分加 4D 平移，而不是 5x5 齐次矩阵。这样更轻、更适合每帧更新。

```ts
export interface Transform4D {
  // column-major storage, column-vector convention.
  matrix: Float32Array; // length = 16
  translation: Float32Array; // length = 4
}
```

公开工具：

```ts
export function identityTransform4D(out?: Transform4D): Transform4D;
export function composeTransform4D(parts: Transform4D[], out?: Transform4D): Transform4D;
export function composeTransform4DInto(out: Transform4D, ...parts: Transform4D[]): Transform4D;
export function multiplyTransform4D(a: Transform4D, b: Transform4D, out: Transform4D): Transform4D;
export function transformPoint4D(t: Transform4D, x: number, y: number, z: number, u: number, out: Float32Array, offset?: number): void;
```

`multiplyTransform4D(a, b, out)` 的语义固定为 `a ∘ b`，也就是先应用 `b`，再应用 `a`。

`composeTransform4D(parts, out)` 的顺序也必须固定：

```text
composeTransform4D([a, b, c], out)
= 按数组顺序依次应用 a、b、c
= c ∘ b ∘ a
```

测试示例：

```ts
const composed = composeTransform4D([translateX1, rotateXY90]);
const p = transformPoint4D(composed, 0, 0, 0, 0);
// expected: (0, 1, 0, 0)
```

Mat4 索引函数必须写死为 column-major：

```ts
export function mat4Index(row: number, col: number): number {
  return col * 4 + row;
}
```

`mat4.ts` 文件头部也应重复这一约定，所有旋转矩阵测试必须基于这个索引规则。

若：

```text
b(p) = Mb * p + tb
a(p) = Ma * p + ta
```

则：

```text
a(b(p)) = Ma * (Mb * p + tb) + ta
        = (Ma * Mb) * p + (Ma * tb + ta)
```

所以实现必须满足：

```ts
// out = a ∘ b
out.matrix = a.matrix * b.matrix;
out.translation = a.matrix * b.translation + a.translation;
```

`multiplyTransform4D(a, b, out)` 必须支持 alias：

```text
out === a
out === b
```

实现时用局部 number 临时变量保存 16 个矩阵结果和 4 个平移结果，最后再写入 `out`。必须增加 alias 测试，确认 `multiplyTransform4D(aliasedA, b, aliasedA)` 与非 alias 输出一致。

必须增加 translation composition 测试：

```ts
// b: translate x by 1
// a: rotateXY 90 degrees
// a ∘ b applied to origin should be (0, 1, 0, 0)
```

所有 `rotateXY` / `rotateXU` 等旋转函数在传入 `out` 时，必须把 `out` 完全覆盖为纯旋转变换：

```text
matrix 重置为 identity 后写入旋转项
translation 重置为 [0,0,0,0]
```

这样复用 `out` 时不会残留上一帧的平移或缩放。

### 3.4 Camera4D

```ts
export type ProjectionMode4D = "orthographic" | "perspective";
export type LookAtStabilityMode = "deterministic" | "continuous";

export interface Camera4DOptions {
  position?: Vec4;
  basisX?: Vec4;
  basisY?: Vec4;
  basisZ?: Vec4;
  basisU?: Vec4;

  projection?: ProjectionMode4D;

  // Simple perspective mode. If provided alone, fovX/Y/Z all use this value.
  fov4?: number;

  // Advanced perspective mode. Overrides fov4 per projected axis.
  fovX?: number;
  fovY?: number;
  fovZ?: number;

  // Direct focal scale. Overrides fov values if provided.
  focalScale?: Vec3;

  // Orthographic mode. orthoScale is shorthand for orthoHalfExtent=[s,s,s].
  orthoScale?: number;
  orthoHalfExtent?: Vec3;

  near?: number;
  far?: number;

  viewBoxCenter?: Vec3;
  viewBoxScale?: Vec3;
}

export class Camera4D {
  position: Float32Array; // length = 4
  basisX: Float32Array;   // projected 3D x direction
  basisY: Float32Array;   // projected 3D y direction
  basisZ: Float32Array;   // projected 3D z direction
  basisU: Float32Array;   // 4D depth direction

  projection: ProjectionMode4D;
  focalScale: Float32Array; // length = 3
  tanHalfFov: Float32Array; // length = 3

  orthoScale: number;
  orthoHalfExtent: Float32Array; // length = 3

  near: number;
  far: number;

  viewBoxCenter: Float32Array; // length = 3
  viewBoxScale: Float32Array;  // length = 3

  constructor(options?: Camera4DOptions);
  setLookAt(
    position: Vec4,
    target: Vec4,
    options?: {
      upHint?: Vec4;
      overHint?: Vec4;
      stability?: LookAtStabilityMode;
      preserveRoll?: boolean;
    }
  ): this;
  setProjection(
    mode: ProjectionMode4D,
    options?: {
      fov4?: number;
      fovX?: number;
      fovY?: number;
      fovZ?: number;
      focalScale?: Vec3;
      orthoScale?: number;
      orthoHalfExtent?: Vec3;
    }
  ): this;
}
```

`basisU` 是 4D 相机的深度方向。投影到 3D 前，每个点先变到相机空间：

```text
r = p_world - camera.position
x_eye = dot(r, basisX)
y_eye = dot(r, basisY)
z_eye = dot(r, basisZ)
u_eye = dot(r, basisU)
```

构造函数必须复制用户传入的 tuple/array，不保留外部引用。`viewBoxScale` 允许负数以表达轴翻转，但不允许任一分量为 0。

如果用户手动传入 `basisX/Y/Z/U`，构造函数必须严格验证，不自动修正：

```text
所有 basis 分量必须 finite
每个 basis 长度接近 1
两两点积接近 0
det[basisX,basisY,basisZ,basisU] > 0
```

若验证失败，应抛出明确错误。自动构造相机姿态应使用 `setLookAt(...)`。

`near/far` 验证必须基于 `safeNear`：

```ts
const safeNear = Math.max(near, EPSILON4D);
```

要求：

```text
near 必须 finite 且 > 0
far 必须 finite 且 > safeNear
```

透视投影参数的运行时唯一数据源是：

```text
camera.focalScale[3]
camera.tanHalfFov[3]
```

`fov4`、`fovX`、`fovY`、`fovZ` 只是输入简写，不应作为投影热路径或 frustum 构造的权威状态。构造函数或 `setProjection` 必须立刻归一化：

```text
focalScale.x = fx
focalScale.y = fy
focalScale.z = fz

tanHalfFov.x = 1 / fx
tanHalfFov.y = 1 / fy
tanHalfFov.z = 1 / fz
```

如果用户直接传 `focalScale`，则 `tanHalfFov` 必须由 `1 / focalScale` 得到，不能读取旧的 `fovX/Y/Z`。`buildPerspectiveFrustum4D(camera)` 只能读取 `camera.tanHalfFov`。

正交投影参数的唯一尺度是 `orthoHalfExtent`。`orthoScale` 只是简写：

```text
orthoHalfExtent = [orthoScale, orthoScale, orthoScale]
```

正交投影和正交裁剪都必须使用 `orthoHalfExtent`，避免投影范围和视体范围分裂。

### 3.5 Projection Result

点投影结果有两种布局，不能混用一个含糊的 `pointCount`：

```ts
export interface IndexedPointProjectionResult {
  layout: "indexed";
  positions3: Float32Array;
  depths4: Float32Array;
  visibility: Uint8Array;
  vertexCount: number;
  bounds3: Bounds3;
}

export interface CompactPointProjectionResult {
  layout: "compact";
  positions3: Float32Array;
  depths4: Float32Array;
  sourceIndices: Uint32Array;
  visiblePointCount: number;
  bounds3: Bounds3;
}

export type PointProjectionResult =
  | IndexedPointProjectionResult
  | CompactPointProjectionResult;
```

第一版默认面向 three.js 显示时使用 `compact`，这样可以直接用 `drawRange(0, visiblePointCount)`。如果需要保留原始顶点索引关系，则使用 `indexed`。

线框投影结果：

```ts
export interface LineProjectionResult {
  positions3: Float32Array;
  depths4: Float32Array;
  colors?: Float32Array;
  alphas?: Float32Array;
  segmentCount: number;
  bounds3: Bounds3;
}
```

`LineProjectionResult.positions3` 的布局是裁剪后的线段端点：

```text
[x0,y0,z0, x1,y1,z1, x2,y2,z2, x3,y3,z3, ...]
```

也就是每条线段占 6 个 float。这样可以直接喂给 three.js 的 `LineSegments`，不用维护裁剪后索引。

```ts
export interface Bounds3 {
  min: Float32Array; // length = 3
  max: Float32Array; // length = 3
  valid: boolean;
}
```

`bounds3` 在 `create*Result` 时创建并复用，投影器不得每帧 new bounds。每帧开始时设置 `bounds3.valid = false`，写入第一个可见点/线段端点时再置为 `true` 并更新 min/max。外部不能把 `valid === false` 的 bounds 当成本帧有效结果。

## 4. 公开 API 设计

### 4.1 最小使用方式

```ts
import {
  Camera4D,
  CPUProjector4D,
  createTesseract4D,
  identityTransform4D,
  multiplyTransform4D,
  rotateXU,
  rotateYZ,
  rotateZU,
} from "four-camera";

const geometry = createTesseract4D({ size: 2 });

const camera4 = new Camera4D({
  position: [0, 0, 0, -5],
  projection: "perspective",
  fov4: Math.PI / 3, // expands to fovX/Y/Z internally
  near: 0.1,
  far: 100,
  viewBoxCenter: [0, 0, 0],
  viewBoxScale: [2, 2, 2],
});

camera4.setLookAt([0, 0, 0, -5], [0, 0, 0, 0], {
  stability: "deterministic",
});

const projector = new CPUProjector4D({
  clipping: "near-far",
});

const result = projector.createLineResult(geometry);

const rXU = identityTransform4D();
const rYZ = identityTransform4D();
const rZU = identityTransform4D();
const tmp = identityTransform4D();
const model4 = identityTransform4D();

function update(timeMs: number) {
  const t = timeMs * 0.001;

  rotateXU(t * 0.45, rXU);
  rotateYZ(t * 0.28, rYZ);
  rotateZU(t * 0.18, rZU);

  multiplyTransform4D(rYZ, rXU, tmp);
  multiplyTransform4D(rZU, tmp, model4);

  projector.projectLines({
    geometry,
    model: model4,
    camera: camera4,
    out: result,
  });
}
```

### 4.2 Projector API

```ts
export type ClippingMode4D =
  | "none-unsafe"
  | "singularity-only"
  | "near-far"
  | "frustum";

export type SingularityPolicy4D = "drop" | "allow";

export interface CPUProjector4DOptions {
  clipping?: ClippingMode4D;
  singularityPolicy?: SingularityPolicy4D;
  computeBounds?: boolean;
}

export interface ProjectInput4D<TOut> {
  geometry: Geometry4D;
  model?: Transform4D;
  camera: Camera4D;
  out: TOut;
}

export class CPUProjector4D {
  clipping: ClippingMode4D;
  singularityPolicy: SingularityPolicy4D;
  computeBounds: boolean;

  constructor(options?: CPUProjector4DOptions);

  createIndexedPointResult(geometry: Geometry4D): IndexedPointProjectionResult;
  createCompactPointResult(geometry: Geometry4D): CompactPointProjectionResult;
  createLineResult(geometry: Geometry4D): LineProjectionResult;

  projectPoints(input: ProjectInput4D<PointProjectionResult>): PointProjectionResult;
  projectLines(input: ProjectInput4D<LineProjectionResult>): LineProjectionResult;
}
```

设计取舍：

- `projectLines` 输出裁剪后的线段顶点，不输出索引。
- `createLineResult` 按 `edgeCount * 2 * 3` 预分配 `positions3`，按 `edgeCount * 2` 预分配 `depths4`。
- `createLineResult(geometry)` 和 `projectLines(input)` 在 `geometry.edges` 不存在时必须抛出明确错误：`CPUProjector4D.projectLines requires geometry.edges.` 不要静默输出 `segmentCount = 0`。
- 如果后续完整 frustum 裁剪不会增加线段数量，线段裁剪仍最多一条边输出一条线段，所以容量稳定。
- `model` 缺省时使用 identity。
- 透视模式下默认 `singularityPolicy: "drop"`。即使 `clipping: "none-unsafe"`，也必须显式选择 `allow` 才允许 `u_eye` 接近 0 的除法风险。
- 如果当前版本尚未实现 `"frustum"`，构造或投影时必须抛出明确错误，不能静默退回 `"near-far"`。
- `projectPoints` 和 `projectLines` 必须只写入传入的 `out`，不得返回新分配 result。
- `projectPoints` 根据 `out.layout` 分支执行。`createCompactPointResult` 生成 compact out，`createIndexedPointResult` 生成 indexed out，`projectPoints` 不得在内部改变 `out.layout`。

`clipping` 与 `singularityPolicy` 的实际行为：

| clipping | singularityPolicy | 实际行为 |
| --- | --- | --- |
| `none-unsafe` | `drop` | 不做 near/far/frustum，但丢弃点或裁剪线段到 `u_eye >= EPSILON4D` |
| `none-unsafe` | `allow` | 完全不保护，可能产生 `Infinity` / `NaN`，由用户负责 |
| `singularity-only` | `drop` | 只做 `u_eye >= EPSILON4D` 保护 |
| `singularity-only` | `allow` | 矛盾配置，应抛错；如需完全无保护，使用 `none-unsafe + allow` |
| `near-far` | `drop` | 裁剪到 `safeNear <= u_eye <= far` |
| `near-far` | `allow` | 仍使用 `safeNear <= u_eye <= far`，不允许绕过 near/far |
| `frustum` | `drop` | 使用完整 4D frustum，并包含 singularity protection |
| `frustum` | `allow` | 仍使用完整 4D frustum，并包含 singularity protection |

其中：

```ts
const safeNear = Math.max(camera.near, EPSILON4D);
```

第一版不提供 `"clamp"`。如果未来需要，应命名为 `"clip-to-epsilon"` 并定义为：点在 `u_eye < EPSILON4D` 时丢弃，线段裁剪到 `u_eye >= EPSILON4D`。

`singularityPolicy: "allow"` 只在 `clipping: "none-unsafe"` 时真正放开除法保护。其他 clipping 模式必须使用 `safeNear`，或者对矛盾组合抛出配置错误。

### 4.3 Geometry API

```ts
export interface TesseractOptions {
  size?: number;
  center?: Vec4;
}

export function createTesseract4D(options?: TesseractOptions): Geometry4D;

export interface Simplex4DOptions {
  size?: number;
  center?: Vec4;
}

export function createSimplex4D(options?: Simplex4DOptions): Geometry4D;

export interface Hyperoctahedron4DOptions {
  size?: number;
  center?: Vec4;
}

export function createHyperoctahedron4D(options?: Hyperoctahedron4DOptions): Geometry4D;
```

如果第一轮实现暂不做 `createSimplex4D` 和 `createHyperoctahedron4D`，应从 v0.3 交付内容移入暂缓，不能保留未定义行为的 API 承诺。若实现，必须遵守第 6 节的生成算法和测试标准。

### 4.4 Rotation API

4D 旋转发生在二维平面上。第一版暴露具名函数：

```ts
export function rotateXY(angle: number, out?: Transform4D): Transform4D;
export function rotateXZ(angle: number, out?: Transform4D): Transform4D;
export function rotateXU(angle: number, out?: Transform4D): Transform4D;
export function rotateYZ(angle: number, out?: Transform4D): Transform4D;
export function rotateYU(angle: number, out?: Transform4D): Transform4D;
export function rotateZU(angle: number, out?: Transform4D): Transform4D;

export function rotatePlane4D(axisA: 0 | 1 | 2 | 3, axisB: 0 | 1 | 2 | 3, angle: number, out?: Transform4D): Transform4D;
```

### 4.5 three.js Adapter API

适配层放在可选入口中，例如：

```ts
import { ThreeLineAdapter } from "four-camera/three";
```

接口：

```ts
export interface ThreeLineAdapterOptions {
  maxSegmentCount: number;
  usage?: THREE.Usage;
  boundsMode?: "none" | "fixed" | "compute-each-frame";
  fixedBoundingRadius?: number;
  vertexColors?: boolean;
}

export class ThreeLineAdapter {
  geometry: THREE.BufferGeometry;
  positionAttribute: THREE.BufferAttribute;
  colorAttribute?: THREE.BufferAttribute;

  constructor(options: ThreeLineAdapterOptions);

  update(result: LineProjectionResult): void;
  dispose(): void;
}
```

实现职责：

- 构造 `BufferGeometry`。
- 写入 position attribute。
- 如果 `vertexColors: true`，构造时预分配 color attribute；如果 `result.colors` 存在，写入 color attribute。
- 设置 draw range。
- 标记 `needsUpdate`。
- 根据 `boundsMode` 处理 bounds。

它不应该知道 `Camera4D`、`Geometry4D`、`Transform4D`。

现实限制：

- `ThreeLineAdapter` 只承诺普通细线，输出 `THREE.LineSegments + BufferGeometry`。
- 如果 `vertexColors: false` 或未设置，但 `update(result)` 收到 `result.colors`，应抛出明确错误：`ThreeLineAdapter received result.colors but vertexColors was not enabled.` 不要在 update 时临时创建 color attribute。
- 普通 WebGL line width 的可用范围由浏览器/驱动决定，不承诺可变线宽。
- 若需要粗线、屏幕空间线宽、world units 或基于 4D 深度变化的线宽，应提供单独的 `ThreeFatLineAdapter`，基于 three.js addon 的 `LineSegments2` / `Line2` / `LineMaterial` 路线。
- 动态线框每帧 `computeBoundingSphere()` 可能有额外开销。小模型可以使用 `boundsMode: "compute-each-frame"`；大模型建议 `boundsMode: "fixed"` 或直接令 line object `frustumCulled = false`。

暂缓：

- 不在 v0.5 交付 `ThreeMeshAdapter`。
- 如果后续加入三角形适配器，应命名为 `ExperimentalThreeTriangleAdapter`，并明确它只适合已经在 4D 视体内的 triangle soup，不处理穿越 near/far 的三角形裁剪，不处理 4D cell 投影，也不保证透明排序正确。

## 5. 关键算法

### 5.1 4D 旋转矩阵

对于平面 `(a,b)` 上的旋转：

```text
p_a' =  cos(theta) * p_a - sin(theta) * p_b
p_b' =  sin(theta) * p_a + cos(theta) * p_b
```

其余两个坐标不变。

实现时在 identity 4x4 矩阵上修改四个元素。若使用 column-major，需要统一测试确认方向。

伪代码：

```ts
function makePlaneRotation4D(a: number, b: number, angle: number, out: Float32Array) {
  identityMat4(out);

  const c = Math.cos(angle);
  const s = Math.sin(angle);

  out[index(a, a)] = c;
  out[index(b, b)] = c;
  out[index(a, b)] = -s;
  out[index(b, a)] = s;
}
```

### 5.2 4D 相机 lookAt

输入：

```text
position: 4D 相机位置
target:   4D 观察目标
upHint:   倾向作为投影 y 方向的参考向量
overHint: 倾向作为投影 z 方向的参考向量
```

默认 hint 必须固定，避免不同实现得到不同 roll：

```ts
const defaultUpHint: Vec4 = [0, 1, 0, 0];
const defaultOverHint: Vec4 = [0, 0, 1, 0];
```

deterministic 模式步骤：

1. `basisU = normalize(target - position)`。
2. `basisY = normalize(reject(upHint, [basisU]))`。
3. `basisZ = normalize(reject(overHint, [basisU, basisY]))`。
4. 优先用 `basisX = normalize(cross4(basisY, basisZ, basisU))` 构造第四个方向。
5. 如果第一版不实现 `cross4`，则用 Gram-Schmidt 从 fallback axes 中选出与 `basisY/Z/U` 正交的第四个 basis，并赋给 `basisX`。
6. 对所有 basis 做归一化和正交性检查。
7. 计算 `det[basisX,basisY,basisZ,basisU]`。如果 determinant 为负，翻转 `basisX`，保证手性为正。

这里最稳的是使用 4D Gram-Schmidt：

```text
candidate basis list:
  eU = normalize(target - position)
  yCandidate = upHint
  zCandidate = overHint
  fallback axes = [1,0,0,0], [0,1,0,0], [0,0,1,0], [0,0,0,1]

从候选向量中依次挑选与已有基向量不共线的向量，减去已有基向量投影并归一化，直到得到 4 个基。
```

fallback axes 的选择顺序固定为：

```text
x, y, z, u
```

也就是：

```text
[1,0,0,0] -> [0,1,0,0] -> [0,0,1,0] -> [0,0,0,1]
```

最终约定：

```text
basisX, basisY, basisZ: 成像 3D 超平面
basisU: 4D 深度方向
```

注意：如果 `position` 和 `target` 重合，应抛出清晰错误或回退到默认方向。

推荐策略是抛出明确错误，因为相机朝向未定义：

```text
Camera4D.setLookAt failed: position and target must not be equal.
```

continuous 模式用于动画相机，避免 Gram-Schmidt 在 hint 退化时突然切换 fallback axis 导致画面 roll snapping。基本策略：

```text
1. 用新 position/target 得到新的 basisU。
2. 优先把上一帧 basisY / basisZ 投影到新的成像超平面中。
3. 若上一帧 basis 退化，再使用 upHint / overHint。
4. 若 hints 也退化，最后才使用 deterministic fallback axes。
5. 最终仍做 Gram-Schmidt、归一化和 determinant 正号修正。
```

第一版可以先实现 deterministic，但 API 必须预留 `stability: "continuous"`。如果 continuous 尚未实现，必须抛出明确错误：

```ts
throw new Error("continuous lookAt4D is not implemented yet");
```

不要 silent fallback 到 deterministic，否则用户会误以为已经启用连续相机。

### 5.3 4D 模型到相机空间

对每个顶点：

```text
p_world = model.matrix * p_model + model.translation
r = p_world - camera.position
p_eye = [
  dot(r, basisX),
  dot(r, basisY),
  dot(r, basisZ),
  dot(r, basisU)
]
```

为减少临时对象：

- 不返回 `{ x, y, z, u }`。
- 在局部 number 变量中完成。
- 线段投影中，一个端点处理为四个 number。

### 5.4 4D 正交投影

```text
x3 = x_eye / orthoHalfExtent.x
y3 = y_eye / orthoHalfExtent.y
z3 = z_eye / orthoHalfExtent.z
```

如果只提供 `orthoScale`，则展开为：

```text
orthoHalfExtent = [orthoScale, orthoScale, orthoScale]
```

严谨正交裁剪还应支持 3D 成像超平面范围：

```text
|x_eye| <= orthoHalfExtent.x
|y_eye| <= orthoHalfExtent.y
|z_eye| <= orthoHalfExtent.z
safeNear <= u_eye <= far
```

第一版可以只实现 near/far，但 `orthoHalfExtent` 必须作为唯一正交相机尺度保留。启用正交 frustum clipping 时，裁剪平面必须由 `orthoHalfExtent` 和 `safeNear/far` 自动生成。这样可见正交投影天然落入 `[-1,1]^3`。

### 5.5 4D 透视投影

使用第四维深度 `u_eye` 缩放前三个坐标：

```text
fx = focalScale.x
fy = focalScale.y
fz = focalScale.z

x3 = fx * x_eye / u_eye
y3 = fy * y_eye / u_eye
z3 = fz * z_eye / u_eye
```

如果只提供 `fov4`，构造或 `setProjection` 时先归一化：

```text
fovX = fovY = fovZ = fov4
fx = 1 / tan(fovX / 2)
fy = 1 / tan(fovY / 2)
fz = 1 / tan(fovZ / 2)
```

如果提供 `focalScale = [fx, fy, fz]`，则它直接覆盖 FOV 计算。同时必须写入：

```text
tanHalfFov.x = 1 / fx
tanHalfFov.y = 1 / fy
tanHalfFov.z = 1 / fz
```

这样 API 既保留简单用法，也允许 4D 成像超平面的三个方向有独立尺度。

必须满足：

```text
safeNear <= u_eye <= far
```

其中 `safeNear = max(camera.near, EPSILON4D)`。否则丢弃或裁剪。不要在未裁剪或未执行 singularity guard 的情况下执行除法，除非用户显式选择 `singularityPolicy: "allow"`。

### 5.6 3D Viewbox Mapping

投影得到的中间 3D 坐标映射到普通 3D 场景：

```text
out.x = viewBoxCenter.x + viewBoxScale.x * x3
out.y = viewBoxCenter.y + viewBoxScale.y * y3
out.z = viewBoxCenter.z + viewBoxScale.z * z3
```

`viewBoxScale` 可以理解为 4D 摄影结果在 3D 场景里的显示尺寸。

### 5.7 点裁剪

near/far 裁剪：

```ts
const safeNear = Math.max(camera.near, EPSILON4D);
visible = uEye >= safeNear && uEye <= camera.far;
```

完整 perspective frustum 裁剪：

```ts
const safeNear = Math.max(camera.near, EPSILON4D);
const limitX = uEye * camera.tanHalfFov[0];
const limitY = uEye * camera.tanHalfFov[1];
const limitZ = uEye * camera.tanHalfFov[2];

visible =
  uEye >= safeNear &&
  uEye <= far &&
  Math.abs(xEye) <= limitX &&
  Math.abs(yEye) <= limitY &&
  Math.abs(zEye) <= limitZ;
```

第一版建议先实现 near/far。frustum 可作为 v0.4 后半或 v0.6 内容。

### 5.8 边裁剪: near/far

对相机空间中的线段端点：

```text
p0 = (x0, y0, z0, u0)
p1 = (x1, y1, z1, u1)
```

裁剪到：

```text
safeNear <= u <= far
```

使用参数区间裁剪：

```text
p(t) = p0 + t * (p1 - p0), t in [0,1]
u(t) = u0 + t * (u1 - u0)
```

算法：

1. 初始化 `t0 = 0`，`t1 = 1`。
2. 对 near 平面更新区间。
3. 对 far 平面更新区间。
4. 如果区间为空，丢弃线段。
5. 计算裁剪后的两个端点。

伪代码：

```ts
function clipSegmentNearFar(u0: number, u1: number, safeNear: number, far: number) {
  let t0 = 0;
  let t1 = 1;
  const du = u1 - u0;

  if (Math.abs(du) < EPSILON) {
    if (u0 < safeNear || u0 > far) return null;
    return [0, 1];
  }

  const tNear = (safeNear - u0) / du;
  const tFar = (far - u0) / du;

  const enter = Math.min(tNear, tFar);
  const exit = Math.max(tNear, tFar);

  t0 = Math.max(t0, enter);
  t1 = Math.min(t1, exit);

  if (t0 > t1) return null;
  return [t0, t1];
}
```

注意：上面的简写只在区间边界为 `near` 和 `far` 时成立，但实现中要小心端点已经完全在区间内的情况。更通用的 Liang-Barsky 风格半空间裁剪更稳：

```text
u >= safeNear  ->  u - safeNear >= 0
u <= far   ->  far - u >= 0
```

对每个半空间计算：

```text
value(t) = value0 + t * (value1 - value0)
```

如果 `value0` 和 `value1` 都小于 0，丢弃。
如果一正一负，更新 `tEnter` 或 `tExit`。

### 5.9 边裁剪: 通用半空间

后续完整 frustum 可以统一用半空间：

```ts
export interface Plane4D {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
}

// inside when a*x + b*y + c*z + d*u + e >= 0
```

对线段执行半空间裁剪：

```ts
function clipSegmentByPlanes4D(p0, p1, planes) {
  let tEnter = 0;
  let tExit = 1;

  for (const plane of planes) {
    const v0 = evalPlane(plane, p0);
    const v1 = evalPlane(plane, p1);

    if (v0 < 0 && v1 < 0) return null;
    if (v0 >= 0 && v1 >= 0) continue;

    const t = v0 / (v0 - v1);

    if (v0 < 0) {
      tEnter = Math.max(tEnter, t);
    } else {
      tExit = Math.min(tExit, t);
    }

    if (tEnter > tExit) return null;
  }

  return [tEnter, tExit];
}
```

完整 4D 透视 frustum 的六个侧向平面必须与投影公式一致。运行时只读取 `camera.tanHalfFov`：

```text
u * camera.tanHalfFov[0] - x >= 0
u * camera.tanHalfFov[0] + x >= 0
u * camera.tanHalfFov[1] - y >= 0
u * camera.tanHalfFov[1] + y >= 0
u * camera.tanHalfFov[2] - z >= 0
u * camera.tanHalfFov[2] + z >= 0
```

再加：

```text
u - safeNear >= 0
far - u >= 0
```

一共 8 个半空间。

建议类型：

```ts
export interface Frustum4D {
  safeNear: number;
  far: number;
  tanHalfFov: Float32Array; // length = 3
  planes: Plane4D[];
}

export function buildPerspectiveFrustum4D(camera: Camera4D, out?: Frustum4D): Frustum4D;
```

规则：

- frustum planes 只能由 `Camera4D` 当前 projection 参数生成。
- 用户不应该手写 frustum planes，避免投影公式和裁剪公式不一致。
- perspective frustum 必须读取 `camera.tanHalfFov`，不得读取可能过期的 `fov4/fovX/fovY/fovZ`。
- 测试必须覆盖：如果点被 frustum 判为可见，则投影后 `|x3| <= 1`、`|y3| <= 1`、`|z3| <= 1`。

完整正交 frustum 则由：

```text
halfExtent.x - x >= 0
halfExtent.x + x >= 0
halfExtent.y - y >= 0
halfExtent.y + y >= 0
halfExtent.z - z >= 0
halfExtent.z + z >= 0
u - safeNear >= 0
far - u >= 0
```

生成。

### 5.10 线框投影流程

推荐流程是先缓存所有顶点的 camera-space 结果，再遍历 edges。这样共享顶点不会被重复执行 model/view 变换。

`CPUProjector4D` 应预留 scratch 管理：

```ts
scratchEye4: Float32Array;      // vertexCount * 4
scratchVisibility: Uint8Array;  // vertexCount

ensureScratchCapacity(vertexCount: number): void;
```

每帧线框投影：

```text
1. 重置 `out.segmentCount`、bounds、写入游标。
2. 确保 scratch 容量足够。
3. 将所有 4D 顶点变换到 camera-space，写入 `scratchEye4`。
4. 遍历 edges，从 `scratchEye4` 读取两个端点。
5. 执行 singularity guard、near/far 或 frustum 裁剪。
6. 如果线段可见，将裁剪后的两个端点投影到 3D。
7. 执行 viewbox mapping。
8. 写入 positions3。
9. 写入 depths4、可选 colors/alphas。
10. 更新 segmentCount 和 bounds3。
```

伪代码：

```ts
for each edge(a, b):
  p0Eye = scratchEye4[a]
  p1Eye = scratchEye4[b]

  clipped = clipSegment(p0Eye, p1Eye, camera)
  if (!clipped) continue

  c0 = lerp4(p0Eye, p1Eye, clipped.t0)
  c1 = lerp4(p0Eye, p1Eye, clipped.t1)

  writeProjectedEndpoint(c0)
  writeProjectedEndpoint(c1)
  segmentCount++
```

### 5.11 Bounds 计算

投影器可选计算 bounds：

```text
min = [ Infinity,  Infinity,  Infinity]
max = [-Infinity, -Infinity, -Infinity]
```

每写入一个 3D 顶点后更新 bounds。

如果 `segmentCount === 0`，不要把 bounds 假装成有效的 `[0,0,0]`。应复用 result 中已有的 bounds 对象，并设置 `bounds3.valid = false`。

### 5.12 深度输出

`depths4` 保存每个输出端点的 `u_eye`。线段结果中每条线段有两个 depth：

```text
depths4 = [u0,u1, u2,u3, ...]
```

用途：

- 根据第四维深度改变颜色。
- 根据第四维深度改变透明度。
- 根据第四维深度改变线宽。
- 后续透明排序或分层渲染。

深度归一化：

```ts
function normalizeDepth4(u: number, near: number, far: number) {
  return Math.min(1, Math.max(0, (u - near) / (far - near)));
}
```

颜色映射建议作为独立工具，不进入投影热路径的必选步骤：

```ts
export interface DepthColorMap4D {
  near: Vec3;
  far: Vec3;
  gamma?: number;
}

export function applyDepthColorToLines(
  result: LineProjectionResult,
  camera: Camera4D,
  colorMap: DepthColorMap4D,
  outColors: Float32Array
): void;
```

`outColors.length` 应为 `maxSegmentCount * 2 * 3`。适配器可以把它作为 `color` attribute 写入 three.js，但普通 `ThreeLineAdapter` 不承诺按深度改变线宽。深度线宽属于 `ThreeFatLineAdapter` 或自定义 shader 的范围。

如果要让 `ThreeLineAdapter` 写入 `color` attribute，必须显式把颜色缓冲挂到结果上：

```ts
lineResult.colors = lineColors;
applyDepthColorToLines(lineResult, camera4, colorMap, lineResult.colors);
adapter.update(lineResult);
```

普通 `ThreeLineAdapter` 不消费 `alphas`。`alphas` 只给 `ThreeFatLineAdapter` 或自定义 shader 使用，不保证自动影响 `THREE.LineBasicMaterial` 的透明度。

## 6. Tesseract 生成算法

几何生成 API 中，`size` 统一表示边长，而不是外接半径或坐标轴半径。`center` 必须表示所有顶点的平均中心。

### 6.1 顶点

tesseract 有 16 个顶点：

```text
(±s, ±s, ±s, ±s)
```

如果 `size = 2`，则 `s = 1`。

生成方式：

```ts
for i in 0..15:
  x = (i & 1) ? s : -s
  y = (i & 2) ? s : -s
  z = (i & 4) ? s : -s
  u = (i & 8) ? s : -s
```

### 6.2 边

两个顶点只有一个 bit 不同时，它们之间有边。总共 32 条边。

生成方式：

```ts
for i in 0..15:
  for axisBit in [1, 2, 4, 8]:
    j = i ^ axisBit
    if i < j:
      addEdge(i, j)
```

这样能避免重复边。

### 6.3 面与胞元

第一版可以不输出 faces/cells。后续若支持：

- 每个面由固定两个轴变化、另外两个轴固定得到。
- tesseract 有 24 个正方形面。
- 每个胞元是一个立方体，共 8 个。

但完整胞元投影会涉及 3D 多面体重建、遮挡和透明排序，建议推迟。

### 6.4 Simplex4D 生成算法

4D simplex，即 5-cell，最低标准：

```text
vertexCount = 5
edgeCount = 10
任意两个顶点之间都有边
所有边长相等
顶点中心在给定 center
```

一种稳妥生成方式是使用 5 个在 4D 中等距的顶点。实现时可以先在 5D 中取：

```text
e_i - mean(e_0..e_4)
```

得到位于 4D 超平面中的 5 个点，再投到一个固定 4D 正交基上，最后缩放到 pairwise distance 等于 `size`，并平移到 `center`。

测试标准：

```text
vertexCount === 5
edgeCount === 10
所有 pairwise distance 在误差范围内相等
所有顶点平均值等于 center
```

如果第一轮暂不实现，应把 `createSimplex4D` 从 v0.3 交付内容移到暂缓，不能保留未定义的 API。

### 6.5 Hyperoctahedron4D 生成算法

4D hyperoctahedron，也就是 16-cell，可以用 8 个坐标轴端点：

```text
(±s,0,0,0)
(0,±s,0,0)
(0,0,±s,0)
(0,0,0,±s)
```

由于相邻轴端点之间距离为 `sqrt(2) * s`，若 `size` 表示边长，则：

```text
s = size / sqrt(2)
```

边连接规则：

```text
除自己和自己的相反点外，其余都连接
```

每个顶点连接 6 个顶点：

```text
edgeCount = 8 * 6 / 2 = 24
```

测试标准：

```text
vertexCount === 8
edgeCount === 24
每个顶点 degree === 6
不存在连接相反点的边
所有顶点平均值等于 center
```

如果第一轮暂不实现，应把 `createHyperoctahedron4D` 从 v0.3 交付内容移到暂缓。

## 7. 性能策略

### 7.1 热路径规则

动画循环中避免：

```ts
new Vec4()
new Matrix()
array.push()
map/filter/reduce
temporary object returns
```

优先：

```text
预分配 Float32Array
局部 number 变量
for 循环
原地写入
复用 Transform4D 和 ProjectionResult
```

### 7.2 缓冲容量

线框投影：

```text
maxSegmentCount = geometry.edgeCount
positions3.length = maxSegmentCount * 2 * 3
depths4.length = maxSegmentCount * 2
```

点投影：

```text
indexed:
  positions3.length = geometry.vertexCount * 3
  depths4.length = geometry.vertexCount
  visibility.length = geometry.vertexCount

compact:
  positions3.length = geometry.vertexCount * 3
  depths4.length = geometry.vertexCount
  sourceIndices.length = geometry.vertexCount
  visiblePointCount <= geometry.vertexCount
```

### 7.3 变换缓存

如果后续需要优化：

- `modelViewBasis` 可预先合成，减少每顶点 dot 次数。
- 对线框几何可先投影所有顶点，再根据可见性生成线段；但 near/far 边裁剪仍需要端点相机空间坐标。
- 对大规模点云可使用 Worker 双缓冲。

第一版保持直接实现，便于验证。

### 7.4 Worker 和 WebGPU 后端边界

CPU 后端是同步、原地写入：

```ts
projector.projectLines({ geometry, model, camera, out });
```

Worker 后端不应该伪装成同样的同步引用语义。跨线程传输大数组时，应转移底层 `ArrayBuffer`，这会让原上下文失去该 buffer 的所有权。因此 Worker backend 应设计为异步帧流和双/三缓冲：

```ts
export interface WorkerProjectionFrame {
  positions3Buffer: ArrayBuffer;
  depths4Buffer: ArrayBuffer;
  colorsBuffer?: ArrayBuffer;
  segmentCount: number;
  bounds3?: Bounds3;
}
```

主线程拥有 display buffer，worker 拥有 compute buffer，每帧交换 buffer ownership 或使用多缓冲避免阻塞。不要在 Worker 后端中承诺“同一个 `Float32Array` 每帧原地可用”。

WebGPU backend 也应单独定义结果类型：

```ts
export interface GPUProjectionResult {
  positions3Buffer: GPUBuffer;
  depths4Buffer?: GPUBuffer;
  drawCount: number;
}
```

如果 WebGPU compute 每帧 readback 到 CPU `Float32Array` 再交给 three.js WebGL renderer，可能抵消 GPU 计算收益。长期更合理的路径是 WebGPU compute 输出 `GPUBuffer`，由 WebGPU renderer 直接消费。

## 8. 错误处理与数值稳定性

建议常量：

```ts
export const EPSILON4D = 1e-6;
```

需要处理：

- `fov4 <= 0` 或 `fov4 >= Math.PI`。
- `fovX/Y/Z <= 0` 或 `>= Math.PI`。
- `near <= 0`。
- `far <= safeNear`。
- `position` 与 `target` 重合。
- `basis` 非正交或长度过小。
- 透视投影中 `u_eye < safeNear` 或接近 0。
- `viewBoxScale` 任一分量为 0。
- 裁剪线段与裁剪平面近乎平行。
- `positions4` 中存在非有限数。
- `edges` / `triangles` 中存在越界索引。
- 几何生成参数 `size <= 0`。
- 几何生成参数 `center` 存在非有限数。

策略：

- 构造相机时做参数归一化和合理默认值。
- 开发模式可提供 `validateCamera4D(camera)` 和 `validateGeometry4D(geometry)`。
- 投影热路径中不频繁抛异常，尽量在入口参数阶段验证。
- `validateGeometry4D` 必须检查长度整除、索引范围和所有输入数值为 finite。

## 9. 测试计划

### 9.1 数学测试

- `rotateXY(Math.PI / 2)` 能把 `(1,0,0,0)` 转到预期方向。
- 所有旋转正方向都有数值测试，不只测试长度保持。
- 六个旋转平面都保持向量长度不变。
- `multiplyTransform4D(a,b)` 的 `a ∘ b` 顺序用具体点验证。
- `composeTransform4D([a,b,c])` 必须测试为 `c ∘ b ∘ a`。
- `mat4Index(row,col)` 必须测试为 `col * 4 + row`。
- `multiplyTransform4D(a,b)` 必须测试 translation 组合公式：translate x by 1 再 rotateXY 90 degrees，origin 结果为 `(0,1,0,0)`。
- `multiplyTransform4D(a,b,out)` 必须测试 `out === a` 和 `out === b` alias 情况。
- `rotateXU(angle,out)` 等函数必须完全覆盖 `out`，清空旧 translation。
- `dot4`、`normalize4`、Gram-Schmidt 正交性误差在容忍范围内。

### 9.2 几何测试

- `createTesseract4D({ size: 2 })` 生成 16 个顶点。
- tesseract 生成 32 条边。
- 每条 tesseract 边连接的两个顶点恰好只有一个坐标符号不同。
- 如果实现 simplex4D：5 vertices、10 edges、所有 pairwise distance 相等。
- 如果实现 hyperoctahedron4D：8 vertices、24 edges、每个顶点 degree 为 6，不连接相反点。
- `validateGeometry4D` 检查 finite positions 和索引越界。

### 9.3 相机测试

- 默认相机 basis 互相正交。
- `lookAt4D([0,0,0,-5], [0,0,0,0])` 的 `basisU` 指向正 `u`。
- 相机空间变换后，target 的 `u_eye` 为正。
- `position == target` 抛出明确错误。
- `upHint` 与 `basisU` 平行时 deterministic fallback 不崩溃。
- `overHint` 与 `basisU` 或 `upHint` 平行时 deterministic fallback 不崩溃。
- 手动传入非法 basis 时构造函数抛出明确错误，不自动修正。
- basis determinant 保持正号。
- continuous 模式未实现时应抛出明确错误；实现后，相邻帧 basis 不应突然翻转。

### 9.4 投影测试

- 正交投影丢弃第四维，只映射 x/y/z。
- 透视投影中更大的 `u_eye` 产生更小的投影比例。
- `near/far` 之外的点 visibility 为 0。
- 穿过 near 平面的线段被正确裁剪。
- 完全在裁剪区外的线段不会输出。
- 输出 `segmentCount` 不超过 `edgeCount`。
- 透视模式下 `u_eye` 接近 0 时不会产生 `NaN` 或 `Infinity`。
- `clipping: "frustum"` 的可见点投影后满足 `|x3| <= 1`、`|y3| <= 1`、`|z3| <= 1`。
- 如果当前版本未实现 `frustum`，测试应检查它抛出明确错误；实现后再启用投影一致性测试。
- 投影后 `positions3` 全部为有限数。
- `projectLines` 每帧重置 `segmentCount` 和 bounds，不泄漏上一帧结果。
- `createLineResult` / `projectLines` 在 `geometry.edges` 不存在时抛出明确错误。

### 9.5 热路径和基准测试

- 连续投影 1000 帧，不重新创建 result buffer。
- `projectLines` 不修改输入 geometry。
- `projectLines` 只写入传入的 `out`。
- tesseract: 16 vertices, 32 edges。
- random wireframe: 10k vertices, 30k edges。
- point cloud: 100k points。
- 记录平均 project time、最大 project time、是否产生 NaN、segmentCount 是否稳定。

### 9.6 浏览器视觉测试

临时截图和渲染产物放入：

```text
temp/
```

建议保留这些检查：

- tesseract 静态线框截图。
- tesseract 旋转若干帧截图。
- 透视投影近裁剪不爆炸。
- `LineSegments` draw range 正确，没有残留旧线段。

## 10. 构建与发布建议

如果工程后续转成 npm 包，建议：

```text
package.json
src/
examples/
tests/
dist/
```

输出格式：

- ESM 优先。
- 可选 CJS。
- TypeScript 类型声明。

推荐入口：

```json
{
  "name": "four-camera",
  "type": "module",
  "sideEffects": false,
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    },
    "./three": {
      "types": "./dist/adapters/three.d.ts",
      "import": "./dist/adapters/three.js"
    }
  },
  "peerDependencies": {
    "three": ">=0.160.0"
  },
  "peerDependenciesMeta": {
    "three": {
      "optional": true
    }
  }
}
```

Wallpaper Engine Web 项目中可以选择两种方式：

1. 简单方式：直接使用浏览器可加载的 ESM 文件。
2. 工程方式：用 Vite/Rollup 打包到 `dist`，`index.html` 引用打包结果。

第一阶段建议先以本项目内源码运行，等 API 稳定后再抽包。

## 11. 示例: three.js 动画集成

```ts
const geometry4 = createTesseract4D({ size: 2 });
const projector4 = new CPUProjector4D({ clipping: "near-far" });
const lineResult = projector4.createLineResult(geometry4);

const camera4 = new Camera4D({
  position: [0, 0, 0, -5],
  projection: "perspective",
  fov4: Math.PI / 3,
  near: 0.05,
  far: 50,
  viewBoxCenter: [0, 0, 0],
  viewBoxScale: [2, 2, 2],
});

camera4.setLookAt([0, 0, 0, -5], [0, 0, 0, 0], {
  stability: "deterministic",
});

const adapter = new ThreeLineAdapter({
  maxSegmentCount: geometry4.edgeCount ?? 0,
  boundsMode: "none",
});

const lineObject = new THREE.LineSegments(
  adapter.geometry,
  new THREE.LineBasicMaterial({ color: 0x28d17c })
);

lineObject.frustumCulled = false;
scene.add(lineObject);

const rXU = identityTransform4D();
const rYZ = identityTransform4D();
const rZU = identityTransform4D();
const tmp = identityTransform4D();
const model4 = identityTransform4D();

let rafId: number | null = null;

function update(timeMs: number) {
  const t = timeMs * 0.001;

  rotateXU(t * 0.45, rXU);
  rotateYZ(t * 0.3, rYZ);
  rotateZU(t * 0.2, rZU);

  multiplyTransform4D(rYZ, rXU, tmp);
  multiplyTransform4D(rZU, tmp, model4);

  projector4.projectLines({
    geometry: geometry4,
    model: model4,
    camera: camera4,
    out: lineResult,
  });

  adapter.update(lineResult);
}

function animate(timeMs: number) {
  rafId = requestAnimationFrame(animate);
  update(timeMs);
  renderer.render(scene, camera3);
}

function start() {
  if (rafId === null) {
    rafId = requestAnimationFrame(animate);
  }
}

function stop() {
  if (rafId !== null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
}

function dispose() {
  stop();
  adapter.dispose();
  renderer.dispose();
}

start();
```

## 12. 实现前补充约束

在开始实现 v0.1-v0.4 前，必须遵守以下约束：

1. `composeTransform4D(parts,out)` 的顺序必须写死：
   `composeTransform4D([a,b,c])` 表示按数组顺序依次应用 `a,b,c`，即 `out = c ∘ b ∘ a`。

2. Mat4 索引必须写死：
   column-major 下 `index(row,col)=col*4+row`。所有旋转矩阵测试必须基于该索引规则。

3. `multiplyTransform4D(a,b,out)` 必须支持 `out === a` 或 `out === b` alias，并用局部 number 临时变量保证正确。

4. `Camera4D` 验证必须使用 `safeNear`：
   `safeNear=max(near,EPSILON4D)`，要求 `far > safeNear`。

5. `singularityPolicy="allow"` 只允许与 `clipping="none-unsafe"` 搭配。其他 clipping 模式始终使用 `safeNear`，或对矛盾组合抛错。

6. 手动传入 `basisX/Y/Z/U` 时必须严格验证：finite、归一、两两正交、determinant > 0。不自动修正用户手动 basis。

7. deterministic `lookAt4D` 的默认 hint 和 fallback 顺序必须固定：
   `defaultUpHint=[0,1,0,0]`，`defaultOverHint=[0,0,1,0]`，`fallback axes=[x,y,z,u]`。

8. `createLineResult` / `projectLines` 在 `geometry.edges` 不存在时应抛出明确错误。

9. 若实现 `createSimplex4D` / `createHyperoctahedron4D`，`size` 统一表示边长。

10. `ThreeLineAdapter` 如需支持 `result.colors`，应在构造时通过 `vertexColors:true` 预分配 color attribute。

## 13. 第一轮实现任务拆分

建议按以下顺序实现，保证每一步都有可验证结果：

1. 固化 `0.1` 节约定，并建立对应测试。
2. 建立 `src/math`，实现 `Vec4` 工具、`Mat4`、`Transform4D`、六个旋转函数。
3. 实现 `multiplyTransform4D(a,b)` 的 `a ∘ b` 组合语义和 translation 组合测试。
4. 实现 `createTesseract4D`，用测试确认 16 顶点、32 边。
5. 实现 `normalizeGeometry4D` / `validateGeometry4D`。
6. 实现 `Camera4D` 默认相机和 deterministic `setLookAt`。
7. 实现 `Camera4D` 参数归一化：`fov4/fovX/Y/Z/focalScale -> focalScale + tanHalfFov`。
8. 实现 `CPUProjector4D.projectPoints`，先做正交投影，并决定 compact/indexed 默认。
9. 加入透视投影、singularity guard 和 near/far 点裁剪。
10. 实现 `projectLines`，使用 scratch eye4 缓冲。
11. 加入 near/far 线段裁剪。
12. 写 `ThreePointAdapter` 和 `ThreeLineAdapter`。
13. 在 `index.html` 中替换测试正方形为零分配旋转 tesseract demo。
14. 用浏览器截图验证，并把截图保存到 `temp/`。
15. 再补 frustum clipping；若暂未实现，确保 `"frustum"` 抛出明确错误。
16. 再补 simplex / hyperoctahedron / depth color。

## 14. 暂缓内容

这些内容不建议进入第一版核心：

- 4D 面/胞元的严谨裁剪。
- 透明面排序。
- 4D 体渲染。
- 4D ray tracing。
- WebGPU compute。
- WebGL2 transform feedback。
- Worker 后端。
- 复杂 UI 控制面板。
- `ThreeMeshAdapter` / 4D triangle surface rendering。
- 如果第一轮未实现，`createSimplex4D` 和 `createHyperoctahedron4D` 也应暂缓，不能暴露未定义 API。

这些都很有价值，但会显著扩大第一版的复杂度。第一版的胜利条件应该是：稳定、优雅、能实时渲染旋转 tesseract 线框，并且 API 之后可以自然扩展。

## 15. 最小可交付定义

当以下条件满足时，可以认为 v0.1-v0.4 的核心已经跑通：

- 可以创建 tesseract 4D 几何。
- 可以构建 4D 相机。
- 可以组合 4D 旋转模型变换。
- 可以把 4D tesseract 线框投影成 3D 线段缓存。
- 可以正确处理 near/far 裁剪，不出现透视爆炸。
- 透视投影结果不产生 `NaN` / `Infinity`。
- 相机 basis 正交归一且 determinant 为正。
- 可以将结果写入 three.js `BufferGeometry`。
- 动画示例在 requestAnimationFrame 热路径中不创建 transform array / result buffer。
- Wallpaper Engine Web 页面中能显示平滑旋转的 4D tesseract 线框。

一句话总结：

> Four Camera 的第一版应该是一台轻巧、稳定、可组合的 4D 摄影机：输入 4D 几何，输出 3D 缓存，把最终显示交给成熟的 3D 渲染器。
