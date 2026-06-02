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
  private readonly lockButton: HTMLButtonElement;
  private readonly size: number;
  private readonly center: number;
  private readonly radius: number;
  private readonly camera: THREE.PerspectiveCamera | THREE.OrthographicCamera;
  private readonly rig: Camera3Rig;
  private readonly inverseCameraRotation = new THREE.Quaternion();
  private readonly viewAxis = new THREE.Vector3();
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
    this.element.dataset.locked = String(this.rig.locked);

    const toolbar = document.createElement("div");
    toolbar.className = "camera3-gizmo__toolbar";

    const menuButton = document.createElement("button");
    menuButton.className = "camera3-gizmo__icon camera3-gizmo__menu";
    menuButton.type = "button";
    menuButton.setAttribute("aria-label", "Camera gizmo menu");
    menuButton.tabIndex = -1;

    this.lockButton = document.createElement("button");
    this.lockButton.className = "camera3-gizmo__icon camera3-gizmo__lock";
    this.lockButton.type = "button";
    this.lockButton.setAttribute("aria-label", "Lock camera gizmo");
    this.lockButton.addEventListener("click", () => {
      this.rig.locked = !this.rig.locked;
      this.element.dataset.locked = String(this.rig.locked);
      this.draw();
    });

    toolbar.append(menuButton, this.lockButton);

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

    this.element.append(toolbar, this.canvas, this.modeLabel);
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
      if (this.rig.locked) return;
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
      if (!this.dragging || this.rig.locked) return;
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
    ctx.globalAlpha = this.rig.locked ? 0.55 : 1;
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
    ctx.globalAlpha = this.rig.locked ? opacity * 0.55 : opacity;
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
    ctx.globalAlpha = this.rig.locked ? 0.72 : 1;
    ctx.fillStyle = "#eef2f6";
    ctx.strokeStyle = "#bfc8d2";
    ctx.lineWidth = 1.5;
    ctx.fillRect(this.center - 9, this.center - 9, 18, 18);
    ctx.strokeRect(this.center - 9, this.center - 9, 18, 18);
  }

  private drawLabel(axis: AxisRenderState): void {
    const ctx = this.context;
    const dx = axis.screenX - this.center;
    const dy = axis.screenY - this.center;
    const length = Math.hypot(dx, dy) || 1;
    const x = axis.screenX + dx / length * 13;
    const y = axis.screenY + dy / length * 13;
    ctx.globalAlpha = this.rig.locked ? 0.65 : 1;
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
