import { Camera3GizmoHitTester } from "./camera3-gizmo-hit-test";
import { Camera3GizmoRenderer } from "./camera3-gizmo-renderer";
import { Camera3GizmoState } from "./camera3-gizmo-state";
import type {
  GizmoCancelEvent,
  GizmoClickEvent,
  GizmoController,
  GizmoEndEvent,
  GizmoHit,
  GizmoMoveEvent,
  GizmoStartEvent,
  ScreenPoint
} from "gizmo-core";
import type { RuntimeCameraAxis, RuntimeCameraCommandSink, RuntimeCameraViewState } from "runtime-core";

const projectionModePartId = "projection-mode";

export interface Camera3GizmoOptions {
  commandSink: RuntimeCameraCommandSink;
  initialViewState: RuntimeCameraViewState;
  size?: number;
}

export class Camera3Gizmo implements GizmoController {
  readonly id = "camera3-view-gizmo";
  readonly priority = 100;
  enabled = true;
  readonly element: HTMLDivElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly modeLabel: HTMLButtonElement;
  private readonly size: number;
  private readonly state: Camera3GizmoState;
  private readonly renderer: Camera3GizmoRenderer;
  private readonly hitTester: Camera3GizmoHitTester;
  private readonly commandSink: RuntimeCameraCommandSink;
  private viewState: RuntimeCameraViewState;
  private currentModeLabel = "";
  private activeOrbitDragSessionId: string | null = null;
  private nextOrbitDragSessionIndex = 1;

  constructor(options: Camera3GizmoOptions) {
    this.commandSink = options.commandSink;
    this.viewState = options.initialViewState;
    this.size = options.size ?? 132;
    this.state = new Camera3GizmoState({
      center: this.size * 0.5,
      radius: this.size * 0.32,
      cubeHalfSize: this.size * (9 / 132),
      axisFadeStart: this.size * 0.07,
      axisFadeEnd: this.size * 0.18
    });

    this.element = document.createElement("div");
    this.element.className = "camera3-gizmo";

    this.canvas = document.createElement("canvas");
    this.canvas.className = "camera3-gizmo__canvas";
    this.renderer = new Camera3GizmoRenderer({
      canvas: this.canvas,
      size: this.size,
      state: this.state
    });
    this.hitTester = new Camera3GizmoHitTester({
      canvas: this.canvas,
      size: this.size,
      state: this.state,
      gizmoId: this.id
    });

    this.modeLabel = document.createElement("button");
    this.modeLabel.className = "camera3-gizmo__mode";
    this.modeLabel.type = "button";
    this.modeLabel.tabIndex = -1;
    this.modeLabel.textContent = "< Persp";

    this.element.append(this.canvas, this.modeLabel);
    this.draw();
  }

  update(viewState = this.viewState): void {
    this.viewState = viewState;
    const nextModeLabel = viewState.projectionMode === "perspective" ? "< Persp" : "|| Iso";
    if (nextModeLabel !== this.currentModeLabel) {
      this.currentModeLabel = nextModeLabel;
      this.modeLabel.textContent = nextModeLabel;
    }
    this.draw();
  }

  dispose(): void {
    this.enabled = false;
    this.element.remove();
  }

  hitTest(point: ScreenPoint): GizmoHit | null {
    return this.hitTester.hitTest(point) ?? this.hitTestModeLabel(point);
  }

  onGizmoMove(event: GizmoMoveEvent): void {
    if (!event.isDragging) return;
    if (!this.activeOrbitDragSessionId) return;
    this.commandSink.submit({
      type: "orbit-drag-delta",
      source: "camera3-gizmo",
      sessionId: this.activeOrbitDragSessionId,
      dx: event.delta.dx,
      dy: event.delta.dy
    });
  }

  onGizmoStart(event: GizmoStartEvent): void {
    if (!this.isOrbitDragHit(event.hit)) return;
    this.activeOrbitDragSessionId = `${this.id}:orbit:${this.nextOrbitDragSessionIndex++}`;
    this.commandSink.submit({
      type: "orbit-drag-start",
      source: "camera3-gizmo",
      sessionId: this.activeOrbitDragSessionId
    });
  }

  onGizmoEnd(_event: GizmoEndEvent): void {
    this.endActiveOrbitDrag("pointerup");
  }

  onGizmoCancel(_event: GizmoCancelEvent): void {
    this.endActiveOrbitDrag("cancel");
  }

  onGizmoDoubleClick(event: GizmoClickEvent): void {
    if (event.hit.kind !== "axis") return;
    const axis = this.getAxisFromHit(event.hit);
    if (!axis) return;
    this.commandSink.submit({
      type: "snap-axis",
      source: "camera3-gizmo",
      axis
    });
  }

  onGizmoClick(event: GizmoClickEvent): void {
    if (event.hit.partId !== projectionModePartId) return;
    this.commandSink.submit({
      type: "toggle-projection",
      source: "camera3-gizmo"
    });
  }

  private hitTestModeLabel(point: ScreenPoint): GizmoHit | null {
    const rect = this.modeLabel.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    if (point.x < rect.left || point.x > rect.right || point.y < rect.top || point.y > rect.bottom) {
      return null;
    }
    return {
      gizmoId: this.id,
      partId: projectionModePartId,
      kind: "custom",
      priority: 20
    };
  }

  private draw(): void {
    this.renderer.draw(this.viewState.cameraState);
  }

  private getAxisFromHit(hit: GizmoHit): RuntimeCameraAxis | null {
    const axis = (hit.data as { axis?: unknown } | undefined)?.axis;
    return typeof axis === "string" && this.isCamera3Axis(axis) ? axis : null;
  }

  private isCamera3Axis(axis: string): axis is RuntimeCameraAxis {
    return axis === "+x" || axis === "-x" || axis === "+y" || axis === "-y" || axis === "+z" || axis === "-z";
  }

  private isOrbitDragHit(hit: GizmoHit): boolean {
    return hit.partId !== projectionModePartId;
  }

  private endActiveOrbitDrag(reason: "pointerup" | "cancel"): void {
    if (!this.activeOrbitDragSessionId) return;
    this.commandSink.submit({
      type: "orbit-drag-end",
      source: "camera3-gizmo",
      sessionId: this.activeOrbitDragSessionId,
      reason
    });
    this.activeOrbitDragSessionId = null;
  }
}
