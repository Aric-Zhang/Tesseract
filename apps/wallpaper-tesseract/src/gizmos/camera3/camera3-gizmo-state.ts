import * as THREE from "three";
import type { RuntimeCameraState } from "runtime-core";
import type { Camera3Axis } from "../../features/camera3/model";

export interface AxisRenderState {
  axis: Camera3Axis;
  label: string;
  color: string;
  dimColor: string;
  world: THREE.Vector3;
  screenX: number;
  screenY: number;
  depth: number;
  screenLength: number;
  visibility: number;
  positive: boolean;
}

export interface CubeVertexRenderState {
  localX: number;
  localY: number;
  localZ: number;
  screenX: number;
  screenY: number;
  depth: number;
}

export interface CubeFaceRenderState {
  indices: readonly [number, number, number, number];
  normal: THREE.Vector3;
  fillStyle: string;
  depth: number;
  normalDepth: number;
}

export class Camera3GizmoState {
  readonly center: number;
  readonly radius: number;
  readonly cubeHalfSize: number;
  readonly axes: AxisRenderState[] = [
    { axis: "+x", label: "x", color: "#e55a52", dimColor: "#7b3c3c", world: new THREE.Vector3(1, 0, 0), screenX: 0, screenY: 0, depth: 0, screenLength: 0, visibility: 1, positive: true },
    { axis: "-x", label: "", color: "#d9dce0", dimColor: "#6d747d", world: new THREE.Vector3(-1, 0, 0), screenX: 0, screenY: 0, depth: 0, screenLength: 0, visibility: 1, positive: false },
    { axis: "+y", label: "y", color: "#7fd34e", dimColor: "#4c763c", world: new THREE.Vector3(0, 1, 0), screenX: 0, screenY: 0, depth: 0, screenLength: 0, visibility: 1, positive: true },
    { axis: "-y", label: "", color: "#d9dce0", dimColor: "#6d747d", world: new THREE.Vector3(0, -1, 0), screenX: 0, screenY: 0, depth: 0, screenLength: 0, visibility: 1, positive: false },
    { axis: "+z", label: "z", color: "#7eb6ff", dimColor: "#465c78", world: new THREE.Vector3(0, 0, 1), screenX: 0, screenY: 0, depth: 0, screenLength: 0, visibility: 1, positive: true },
    { axis: "-z", label: "", color: "#d9dce0", dimColor: "#6d747d", world: new THREE.Vector3(0, 0, -1), screenX: 0, screenY: 0, depth: 0, screenLength: 0, visibility: 1, positive: false }
  ];
  readonly sortedAxes: AxisRenderState[] = this.axes.slice();
  readonly cubeVertices: CubeVertexRenderState[] = [
    { localX: -1, localY: -1, localZ: -1, screenX: 0, screenY: 0, depth: 0 },
    { localX: 1, localY: -1, localZ: -1, screenX: 0, screenY: 0, depth: 0 },
    { localX: 1, localY: 1, localZ: -1, screenX: 0, screenY: 0, depth: 0 },
    { localX: -1, localY: 1, localZ: -1, screenX: 0, screenY: 0, depth: 0 },
    { localX: -1, localY: -1, localZ: 1, screenX: 0, screenY: 0, depth: 0 },
    { localX: 1, localY: -1, localZ: 1, screenX: 0, screenY: 0, depth: 0 },
    { localX: 1, localY: 1, localZ: 1, screenX: 0, screenY: 0, depth: 0 },
    { localX: -1, localY: 1, localZ: 1, screenX: 0, screenY: 0, depth: 0 }
  ];
  readonly cubeFaces: CubeFaceRenderState[] = [
    { indices: [1, 5, 6, 2], normal: new THREE.Vector3(1, 0, 0), fillStyle: "rgba(246, 212, 210, 0.96)", depth: 0, normalDepth: 0 },
    { indices: [0, 3, 7, 4], normal: new THREE.Vector3(-1, 0, 0), fillStyle: "rgba(213, 219, 226, 0.9)", depth: 0, normalDepth: 0 },
    { indices: [3, 2, 6, 7], normal: new THREE.Vector3(0, 1, 0), fillStyle: "rgba(226, 244, 213, 0.96)", depth: 0, normalDepth: 0 },
    { indices: [0, 4, 5, 1], normal: new THREE.Vector3(0, -1, 0), fillStyle: "rgba(207, 214, 222, 0.9)", depth: 0, normalDepth: 0 },
    { indices: [4, 7, 6, 5], normal: new THREE.Vector3(0, 0, 1), fillStyle: "rgba(224, 238, 255, 0.98)", depth: 0, normalDepth: 0 },
    { indices: [0, 1, 2, 3], normal: new THREE.Vector3(0, 0, -1), fillStyle: "rgba(210, 217, 225, 0.9)", depth: 0, normalDepth: 0 }
  ];
  readonly sortedCubeFaces: CubeFaceRenderState[] = this.cubeFaces.slice();
  readonly inverseCameraRotation = new THREE.Quaternion();
  private readonly axisFadeStart: number;
  private readonly axisFadeEnd: number;
  private readonly viewAxis = new THREE.Vector3();
  private readonly cubeVector = new THREE.Vector3();
  private readonly cameraPosition = new THREE.Vector3();
  private readonly cameraTarget = new THREE.Vector3();
  private readonly cameraUp = new THREE.Vector3();
  private readonly cameraMatrix = new THREE.Matrix4();

  constructor(options: { center: number; radius: number; cubeHalfSize: number; axisFadeStart: number; axisFadeEnd: number }) {
    this.center = options.center;
    this.radius = options.radius;
    this.cubeHalfSize = options.cubeHalfSize;
    this.axisFadeStart = options.axisFadeStart;
    this.axisFadeEnd = options.axisFadeEnd;
  }

  updateAxisProjection(cameraState: RuntimeCameraState): void {
    const [positionX = 0, positionY = 0, positionZ = 1] = cameraState.pose.position;
    const [targetX = 0, targetY = 0, targetZ = 0] = cameraState.pose.target ?? [0, 0, 0];
    const [upX = 0, upY = 1, upZ = 0] = cameraState.pose.up ?? [0, 1, 0];
    this.cameraPosition.set(positionX, positionY, positionZ);
    this.cameraTarget.set(targetX, targetY, targetZ);
    this.cameraUp.set(upX, upY, upZ);
    this.cameraMatrix.lookAt(this.cameraPosition, this.cameraTarget, this.cameraUp);
    this.inverseCameraRotation.setFromRotationMatrix(this.cameraMatrix).invert();
    for (const axis of this.axes) {
      this.viewAxis.copy(axis.world).applyQuaternion(this.inverseCameraRotation).normalize();
      axis.screenX = this.center + this.viewAxis.x * this.radius;
      axis.screenY = this.center - this.viewAxis.y * this.radius;
      axis.depth = this.viewAxis.z;
      axis.screenLength = Math.hypot(axis.screenX - this.center, axis.screenY - this.center);
      axis.visibility = smoothstep(this.axisFadeStart, this.axisFadeEnd, axis.screenLength);
    }
  }

  updateCubeProjection(): void {
    for (const vertex of this.cubeVertices) {
      this.cubeVector
        .set(vertex.localX * this.cubeHalfSize, vertex.localY * this.cubeHalfSize, vertex.localZ * this.cubeHalfSize)
        .applyQuaternion(this.inverseCameraRotation);
      vertex.screenX = this.center + this.cubeVector.x;
      vertex.screenY = this.center - this.cubeVector.y;
      vertex.depth = this.cubeVector.z;
    }

    for (const face of this.cubeFaces) {
      const a = this.cubeVertices[face.indices[0]];
      const b = this.cubeVertices[face.indices[1]];
      const c = this.cubeVertices[face.indices[2]];
      const d = this.cubeVertices[face.indices[3]];
      face.depth = (a.depth + b.depth + c.depth + d.depth) * 0.25;
      this.cubeVector.copy(face.normal).applyQuaternion(this.inverseCameraRotation);
      face.normalDepth = this.cubeVector.z;
    }
  }
}

export function smoothstep(edge0: number, edge1: number, value: number): number {
  const range = Math.max(edge1 - edge0, 1e-6);
  const t = Math.min(1, Math.max(0, (value - edge0) / range));
  return t * t * (3 - 2 * t);
}
