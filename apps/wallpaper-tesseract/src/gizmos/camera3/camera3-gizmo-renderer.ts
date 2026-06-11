import type { RuntimeCameraState } from "runtime-core";
import { Camera3GizmoState, type AxisRenderState, type CubeFaceRenderState } from "./camera3-gizmo-state";

export interface Camera3GizmoRendererOptions {
  canvas: HTMLCanvasElement;
  size: number;
  state: Camera3GizmoState;
}

export class Camera3GizmoRenderer {
  private readonly canvas: HTMLCanvasElement;
  private readonly context: CanvasRenderingContext2D;
  private readonly size: number;
  private readonly state: Camera3GizmoState;

  constructor(options: Camera3GizmoRendererOptions) {
    this.canvas = options.canvas;
    this.size = options.size;
    this.state = options.state;
    const context = this.canvas.getContext("2d");
    if (!context) {
      throw new Error("Camera3GizmoRenderer requires a 2D canvas context.");
    }
    this.context = context;
    this.resizeCanvas();
  }

  resizeCanvas(): void {
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.style.width = `${this.size}px`;
    this.canvas.style.height = `${this.size}px`;
    this.canvas.width = Math.round(this.size * pixelRatio);
    this.canvas.height = Math.round(this.size * pixelRatio);
    this.context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  }

  draw(cameraState: RuntimeCameraState): void {
    const ctx = this.context;
    ctx.clearRect(0, 0, this.size, this.size);

    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    this.state.updateAxisProjection(cameraState);
    this.state.sortedAxes.sort((a, b) => a.depth - b.depth);
    for (const axis of this.state.sortedAxes) {
      if (axis.depth <= 0) this.drawAxis(axis);
    }
    this.drawCenter();
    for (const axis of this.state.sortedAxes) {
      if (axis.depth > 0) this.drawAxis(axis);
    }
    for (const axis of this.state.sortedAxes) {
      if (axis.positive) this.drawLabel(axis);
    }
    ctx.restore();
  }

  private drawAxis(axis: AxisRenderState): void {
    if (axis.visibility <= 0.01) return;
    const ctx = this.context;
    const color = axis.positive ? axis.color : axis.dimColor;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.globalAlpha = axis.visibility;
    ctx.lineWidth = axis.positive ? 4 : 3;
    const arrowSize = axis.positive ? 9 : 7;
    const dx = axis.screenX - this.state.center;
    const dy = axis.screenY - this.state.center;
    const length = axis.screenLength || 1;
    const ux = dx / length;
    const uy = dy / length;
    const shaftStartDistance = length * (this.state.cubeHalfSize / this.state.radius);
    const shaftEndDistance = length - arrowSize * 0.62;
    if (shaftEndDistance > shaftStartDistance + 0.5) {
      ctx.save();
      ctx.lineCap = "butt";
      ctx.beginPath();
      ctx.moveTo(this.state.center + ux * shaftStartDistance, this.state.center + uy * shaftStartDistance);
      ctx.lineTo(this.state.center + ux * shaftEndDistance, this.state.center + uy * shaftEndDistance);
      ctx.stroke();
      ctx.restore();
    }
    this.drawArrowHead(axis.screenX, axis.screenY, ux, uy, arrowSize);
  }

  private drawArrowHead(x: number, y: number, ux: number, uy: number, size: number): void {
    const ctx = this.context;
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
    this.state.updateCubeProjection();
    this.state.sortedCubeFaces.sort((a, b) => a.depth - b.depth);

    ctx.globalAlpha = 1;
    ctx.lineWidth = 1.35;
    ctx.strokeStyle = "rgba(250, 253, 255, 0.9)";

    for (const face of this.state.sortedCubeFaces) {
      if (face.normalDepth < -0.02) continue;
      this.drawCubeFace(face);
    }
  }

  private drawCubeFace(face: CubeFaceRenderState): void {
    const ctx = this.context;
    const a = this.state.cubeVertices[face.indices[0]];
    const b = this.state.cubeVertices[face.indices[1]];
    const c = this.state.cubeVertices[face.indices[2]];
    const d = this.state.cubeVertices[face.indices[3]];

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
    if (axis.visibility <= 0.01) return;
    const ctx = this.context;
    const dx = axis.screenX - this.state.center;
    const dy = axis.screenY - this.state.center;
    const length = axis.screenLength || 1;
    const x = axis.screenX + dx / length * 13;
    const y = axis.screenY + dy / length * 13;
    ctx.globalAlpha = axis.visibility;
    ctx.fillStyle = axis.color;
    ctx.font = "700 13px Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(axis.label, x, y);
  }
}
