import { Camera3GizmoHitTester } from "./camera3-gizmo-hit-test";
import { Camera3ProjectionModeController, type Camera3Axis } from "../../features/camera3/model";
import { Camera3GizmoRenderer } from "./camera3-gizmo-renderer";
import { Camera3GizmoState } from "./camera3-gizmo-state";
import type { Camera3CommandSink } from "../../camera3-control";
import type { GizmoClickEvent, GizmoController, GizmoHit, GizmoMoveEvent, ScreenPoint } from "gizmo-core";

export interface Camera3GizmoOptions {
  projectionMode: Camera3ProjectionModeController;
  commandSink: Camera3CommandSink;
  parent?: HTMLElement;
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
  private readonly commandSink: Camera3CommandSink;
  private readonly projectionMode: Camera3ProjectionModeController;
  private currentModeLabel = "";

  constructor(options: Camera3GizmoOptions) {
    this.commandSink = options.commandSink;
    this.projectionMode = options.projectionMode;
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
    this.modeLabel.addEventListener("click", this.handleModeLabelClick);

    this.element.append(this.canvas, this.modeLabel);
    (options.parent ?? document.body).append(this.element);

    this.draw();
  }

  update(): void {
    const nextModeLabel = this.projectionMode.mode === "perspective" ? "< Persp" : "|| Iso";
    if (nextModeLabel !== this.currentModeLabel) {
      this.currentModeLabel = nextModeLabel;
      this.modeLabel.textContent = nextModeLabel;
    }
    this.draw();
  }

  dispose(): void {
    this.enabled = false;
    this.modeLabel.removeEventListener("click", this.handleModeLabelClick);
    this.element.remove();
  }

  hitTest(point: ScreenPoint): GizmoHit | null {
    return this.hitTester.hitTest(point);
  }

  onGizmoMove(event: GizmoMoveEvent): void {
    if (!event.isDragging) return;
    this.commandSink.submit({
      type: "orbit-delta",
      source: "camera3-gizmo",
      dx: event.delta.dx,
      dy: event.delta.dy
    });
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

  private readonly handleModeLabelClick = (event: MouseEvent): void => {
    event.preventDefault();
    event.stopPropagation();
    this.commandSink.submit({
      type: "toggle-projection",
      source: "camera3-gizmo"
    });
  };

  private draw(): void {
    this.renderer.draw(this.projectionMode.activeCamera);
  }

  private getAxisFromHit(hit: GizmoHit): Camera3Axis | null {
    const axis = (hit.data as { axis?: unknown } | undefined)?.axis;
    return typeof axis === "string" && this.isCamera3Axis(axis) ? axis : null;
  }

  private isCamera3Axis(axis: string): axis is Camera3Axis {
    return axis === "+x" || axis === "-x" || axis === "+y" || axis === "-y" || axis === "+z" || axis === "-z";
  }
}
