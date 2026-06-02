import * as THREE from "three";
import { Camera3Rig, type Camera3Axis } from "./camera3-rig";

interface AxisRenderState {
  axis: Camera3Axis;
  label: string;
  color: string;
  dimColor: string;
  world: THREE.Vector3;
  screenX: number;
  screenY: number;
  depth: number;
  positive: boolean;
}

interface CubeVertexRenderState {
  localX: number;
  localY: number;
  localZ: number;
  screenX: number;
  screenY: number;
  depth: number;
}

interface CubeFaceRenderState {
  indices: readonly [number, number, number, number];
  normal: THREE.Vector3;
  fillStyle: string;
  depth: number;
  normalDepth: number;
}

export interface Camera3GizmoOptions {
  camera: THREE.PerspectiveCamera | THREE.OrthographicCamera;
  rig: Camera3Rig;
  parent?: HTMLElement;
  size?: number;
}

export class Camera3Gizmo {
  readonly element: HTMLDivElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly context: CanvasRenderingContext2D;
  private readonly modeLabel: HTMLButtonElement;
  private readonly size: number;
  private readonly center: number;
  private readonly radius: number;
  private readonly camera: THREE.PerspectiveCamera | THREE.OrthographicCamera;
  private readonly rig: Camera3Rig;
  private readonly inverseCameraRotation = new THREE.Quaternion();
  private readonly viewAxis = new THREE.Vector3();
  private readonly cubeVector = new THREE.Vector3();
  private readonly cubeVertices: CubeVertexRenderState[] = [
    { localX: -1, localY: -1, localZ: -1, screenX: 0, screenY: 0, depth: 0 },
    { localX: 1, localY: -1, localZ: -1, screenX: 0, screenY: 0, depth: 0 },
    { localX: 1, localY: 1, localZ: -1, screenX: 0, screenY: 0, depth: 0 },
    { localX: -1, localY: 1, localZ: -1, screenX: 0, screenY: 0, depth: 0 },
    { localX: -1, localY: -1, localZ: 1, screenX: 0, screenY: 0, depth: 0 },
    { localX: 1, localY: -1, localZ: 1, screenX: 0, screenY: 0, depth: 0 },
    { localX: 1, localY: 1, localZ: 1, screenX: 0, screenY: 0, depth: 0 },
    { localX: -1, localY: 1, localZ: 1, screenX: 0, screenY: 0, depth: 0 }
  ];
  private readonly cubeFaces: CubeFaceRenderState[] = [
    { indices: [1, 5, 6, 2], normal: new THREE.Vector3(1, 0, 0), fillStyle: "rgba(246, 212, 210, 0.96)", depth: 0, normalDepth: 0 },
    { indices: [0, 3, 7, 4], normal: new THREE.Vector3(-1, 0, 0), fillStyle: "rgba(213, 219, 226, 0.9)", depth: 0, normalDepth: 0 },
    { indices: [3, 2, 6, 7], normal: new THREE.Vector3(0, 1, 0), fillStyle: "rgba(226, 244, 213, 0.96)", depth: 0, normalDepth: 0 },
    { indices: [0, 4, 5, 1], normal: new THREE.Vector3(0, -1, 0), fillStyle: "rgba(207, 214, 222, 0.9)", depth: 0, normalDepth: 0 },
    { indices: [4, 7, 6, 5], normal: new THREE.Vector3(0, 0, 1), fillStyle: "rgba(224, 238, 255, 0.98)", depth: 0, normalDepth: 0 },
    { indices: [0, 1, 2, 3], normal: new THREE.Vector3(0, 0, -1), fillStyle: "rgba(210, 217, 225, 0.9)", depth: 0, normalDepth: 0 }
  ];
  private readonly sortedCubeFaces: CubeFaceRenderState[] = this.cubeFaces.slice();
  private readonly axes: AxisRenderState[] = [
    { axis: "+x", label: "x", color: "#e55a52", dimColor: "#7b3c3c", world: new THREE.Vector3(1, 0, 0), screenX: 0, screenY: 0, depth: 0, positive: true },
    { axis: "-x", label: "", color: "#d9dce0", dimColor: "#6d747d", world: new THREE.Vector3(-1, 0, 0), screenX: 0, screenY: 0, depth: 0, positive: false },
    { axis: "+y", label: "y", color: "#7fd34e", dimColor: "#4c763c", world: new THREE.Vector3(0, 1, 0), screenX: 0, screenY: 0, depth: 0, positive: true },
    { axis: "-y", label: "", color: "#d9dce0", dimColor: "#6d747d", world: new THREE.Vector3(0, -1, 0), screenX: 0, screenY: 0, depth: 0, positive: false },
    { axis: "+z", label: "z", color: "#7eb6ff", dimColor: "#465c78", world: new THREE.Vector3(0, 0, 1), screenX: 0, screenY: 0, depth: 0, positive: true },
    { axis: "-z", label: "", color: "#d9dce0", dimColor: "#6d747d", world: new THREE.Vector3(0, 0, -1), screenX: 0, screenY: 0, depth: 0, positive: false }
  ];
  private readonly sortedAxes: AxisRenderState[] = this.axes.slice();
  private dragging = false;
  private dragX = 0;
  private dragY = 0;
  private currentModeLabel = "";

  constructor(options: Camera3GizmoOptions) {
    this.camera = options.camera;
    this.rig = options.rig;
    this.size = options.size ?? 132;
    this.center = this.size * 0.5;
    this.radius = this.size * 0.32;

    this.element = document.createElement("div");
    this.element.className = "camera3-gizmo";

    this.canvas = document.createElement("canvas");
    this.canvas.className = "camera3-gizmo__canvas";
    const context = this.canvas.getContext("2d");
    if (!context) {
      throw new Error("Camera3Gizmo requires a 2D canvas context.");
    }
    this.context = context;

    this.modeLabel = document.createElement("button");
    this.modeLabel.className = "camera3-gizmo__mode";
    this.modeLabel.type = "button";
    this.modeLabel.tabIndex = -1;
    this.modeLabel.textContent = "< Persp";

    this.element.append(this.canvas, this.modeLabel);
    (options.parent ?? document.body).append(this.element);

    this.resizeCanvas();
    this.bindPointerEvents();
    this.draw();
  }

  update(): void {
    const nextModeLabel = this.rig.mode === "perspective" ? "< Persp" : "< Ortho";
    if (nextModeLabel !== this.currentModeLabel) {
      this.currentModeLabel = nextModeLabel;
      this.modeLabel.textContent = nextModeLabel;
    }
    this.draw();
  }

  dispose(): void {
    this.element.remove();
  }

  private resizeCanvas(): void {
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.style.width = `${this.size}px`;
    this.canvas.style.height = `${this.size}px`;
    this.canvas.width = Math.round(this.size * pixelRatio);
    this.canvas.height = Math.round(this.size * pixelRatio);
    this.context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  }

  private bindPointerEvents(): void {
    this.canvas.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      const point = this.toCanvasPoint(event);
      const hit = this.hitAxis(point.x, point.y);
      if (hit) {
        this.rig.snapToAxis(hit);
        this.rig.updateCamera(this.camera);
        this.draw();
        return;
      }
      this.dragging = true;
      this.dragX = event.clientX;
      this.dragY = event.clientY;
      this.canvas.setPointerCapture(event.pointerId);
    });

    this.canvas.addEventListener("pointermove", (event) => {
      if (!this.dragging) return;
      const dx = event.clientX - this.dragX;
      const dy = event.clientY - this.dragY;
      this.dragX = event.clientX;
      this.dragY = event.clientY;
      this.rig.orbit(dx, dy);
      this.rig.updateCamera(this.camera);
      this.draw();
    });

    const endDrag = (event: PointerEvent) => {
      if (!this.dragging) return;
      this.dragging = false;
      if (this.canvas.hasPointerCapture(event.pointerId)) {
        this.canvas.releasePointerCapture(event.pointerId);
      }
    };
    this.canvas.addEventListener("pointerup", endDrag);
    this.canvas.addEventListener("pointercancel", endDrag);
    this.canvas.addEventListener("pointerleave", endDrag);
  }

  private draw(): void {
    const ctx = this.context;
    ctx.clearRect(0, 0, this.size, this.size);
    this.updateAxisProjection();

    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    this.sortedAxes.sort((a, b) => b.depth - a.depth);
    for (const axis of this.sortedAxes) {
      this.drawAxis(axis);
    }
    this.drawCenter();
    for (const axis of this.sortedAxes) {
      if (axis.positive) this.drawLabel(axis);
    }
    ctx.restore();
  }

  private updateAxisProjection(): void {
    this.inverseCameraRotation.copy(this.camera.quaternion).invert();
    for (const axis of this.axes) {
      this.viewAxis.copy(axis.world).applyQuaternion(this.inverseCameraRotation).normalize();
      axis.screenX = this.center + this.viewAxis.x * this.radius;
      axis.screenY = this.center - this.viewAxis.y * this.radius;
      axis.depth = this.viewAxis.z;
    }
  }

  private drawAxis(axis: AxisRenderState): void {
    const ctx = this.context;
    const opacity = axis.depth < 0 ? 1 : 0.48;
    const color = axis.positive ? axis.color : axis.dimColor;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.globalAlpha = opacity;
    ctx.lineWidth = axis.positive ? 4 : 3;
    ctx.beginPath();
    ctx.moveTo(this.center, this.center);
    ctx.lineTo(axis.screenX, axis.screenY);
    ctx.stroke();
    this.drawArrowHead(axis.screenX, axis.screenY, axis.screenX - this.center, axis.screenY - this.center, axis.positive ? 9 : 7);
  }

  private drawArrowHead(x: number, y: number, dx: number, dy: number, size: number): void {
    const ctx = this.context;
    const length = Math.hypot(dx, dy) || 1;
    const ux = dx / length;
    const uy = dy / length;
    const px = -uy;
    const py = ux;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - ux * size + px * size * 0.55, y - uy * size + py * size * 0.55);
    ctx.lineTo(x - ux * size - px * size * 0.55, y - uy * size - py * size * 0.55);
    ctx.closePath();
    ctx.fill();
  }

  private drawCenter(): void {
    const ctx = this.context;
    this.updateCubeProjection();
    this.sortedCubeFaces.sort((a, b) => a.depth - b.depth);

    ctx.globalAlpha = 1;
    ctx.lineWidth = 1.35;
    ctx.strokeStyle = "rgba(250, 253, 255, 0.9)";

    for (const face of this.sortedCubeFaces) {
      if (face.normalDepth < -0.02) continue;
      this.drawCubeFace(face);
    }
  }

  private updateCubeProjection(): void {
    const cubeHalfSize = 9;
    for (const vertex of this.cubeVertices) {
      this.cubeVector
        .set(vertex.localX * cubeHalfSize, vertex.localY * cubeHalfSize, vertex.localZ * cubeHalfSize)
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

  private drawCubeFace(face: CubeFaceRenderState): void {
    const ctx = this.context;
    const a = this.cubeVertices[face.indices[0]];
    const b = this.cubeVertices[face.indices[1]];
    const c = this.cubeVertices[face.indices[2]];
    const d = this.cubeVertices[face.indices[3]];

    ctx.fillStyle = face.fillStyle;
    ctx.beginPath();
    ctx.moveTo(a.screenX, a.screenY);
    ctx.lineTo(b.screenX, b.screenY);
    ctx.lineTo(c.screenX, c.screenY);
    ctx.lineTo(d.screenX, d.screenY);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  private drawLabel(axis: AxisRenderState): void {
    const ctx = this.context;
    const dx = axis.screenX - this.center;
    const dy = axis.screenY - this.center;
    const length = Math.hypot(dx, dy) || 1;
    const x = axis.screenX + dx / length * 13;
    const y = axis.screenY + dy / length * 13;
    ctx.globalAlpha = 1;
    ctx.fillStyle = axis.color;
    ctx.font = "700 13px Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(axis.label, x, y);
  }

  private hitAxis(x: number, y: number): Camera3Axis | null {
    let bestAxis: Camera3Axis | null = null;
    let bestDistance = Infinity;
    for (const axis of this.axes) {
      const distance = Math.hypot(x - axis.screenX, y - axis.screenY);
      if (distance < 16 && distance < bestDistance) {
        bestAxis = axis.axis;
        bestDistance = distance;
      }
    }
    return bestAxis;
  }

  private toCanvasPoint(event: PointerEvent): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * (this.size / rect.width),
      y: (event.clientY - rect.top) * (this.size / rect.height)
    };
  }
}
