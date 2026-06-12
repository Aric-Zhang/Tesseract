import type { GizmoHit, ScreenPoint } from "gizmo-core";
import type { RuntimeCameraAxis } from "runtime-core";
import type { Camera3GizmoState } from "./camera3-gizmo-state";

export interface Camera3GizmoHitTesterOptions {
  canvas: HTMLCanvasElement;
  size: number;
  state: Camera3GizmoState;
  gizmoId: string;
}

export class Camera3GizmoHitTester {
  private readonly canvas: HTMLCanvasElement;
  private readonly size: number;
  private readonly state: Camera3GizmoState;
  private readonly gizmoId: string;

  constructor(options: Camera3GizmoHitTesterOptions) {
    this.canvas = options.canvas;
    this.size = options.size;
    this.state = options.state;
    this.gizmoId = options.gizmoId;
  }

  hitTest(point: ScreenPoint): GizmoHit | null {
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    if (point.x < rect.left || point.x > rect.right || point.y < rect.top || point.y > rect.bottom) {
      return null;
    }

    const canvasPoint = {
      x: (point.x - rect.left) * (this.size / rect.width),
      y: (point.y - rect.top) * (this.size / rect.height)
    };
    const axis = this.hitAxis(canvasPoint.x, canvasPoint.y);
    if (axis) {
      return {
        gizmoId: this.gizmoId,
        partId: axis,
        kind: "axis",
        priority: 10,
        data: { axis }
      };
    }

    return {
      gizmoId: this.gizmoId,
      partId: "orbit",
      kind: "center",
      priority: 0
    };
  }

  private hitAxis(x: number, y: number): RuntimeCameraAxis | null {
    let bestAxis: RuntimeCameraAxis | null = null;
    let bestDistance = Infinity;
    for (const axis of this.state.axes) {
      if (axis.visibility <= 0.01) continue;
      if (axis.screenLength <= 0.5) continue;
      const distance = Math.hypot(x - axis.screenX, y - axis.screenY);
      if (distance < 16 && distance < bestDistance) {
        bestAxis = axis.axis;
        bestDistance = distance;
      }
    }
    return bestAxis;
  }
}
