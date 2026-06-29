export interface ScreenPoint {
  /** Viewport coordinates from PointerEvent.clientX / clientY. */
  x: number;
  /** Viewport coordinates from PointerEvent.clientX / clientY. */
  y: number;
}

export interface ScreenDelta {
  dx: number;
  dy: number;
}

export interface Disposable {
  dispose(): void;
}

export type GizmoHitKind = "axis" | "center" | "ring" | "plane" | "custom";

export interface GizmoHit {
  gizmoId: string;
  partId: string;
  kind: GizmoHitKind;
  priority?: number;
  data?: unknown;
}

export interface GizmoController {
  id: string;
  priority: number;
  enabled?: boolean;

  hitTest(point: ScreenPoint): GizmoHit | null;

  onGizmoStart?(event: GizmoStartEvent): void;
  onGizmoMove?(event: GizmoMoveEvent): void;
  onGizmoEnd?(event: GizmoEndEvent): void;
  onGizmoCancel?(event: GizmoCancelEvent): void;
  onGizmoClick?(event: GizmoClickEvent): void;
  onGizmoDoubleClick?(event: GizmoClickEvent): void;
}

export interface GizmoBaseEvent {
  gizmo: GizmoController;
  hit: GizmoHit;
  pointerId: number;
  pointerType: string;
  timeStamp: number;
  point: ScreenPoint;
  startPoint: ScreenPoint;
  buttons: number;
  rawEvent?: PointerEvent | MouseEvent;
}

export interface GizmoStartEvent extends GizmoBaseEvent {}

export interface GizmoMoveEvent extends GizmoBaseEvent {
  delta: ScreenDelta;
  totalDelta: ScreenDelta;
  /** True once totalDelta has exceeded the event system clickMoveThreshold. */
  isDragging: boolean;
}

export interface GizmoEndEvent extends GizmoBaseEvent {
  totalDelta: ScreenDelta;
  wasClick: boolean;
}

export interface GizmoCancelEvent extends GizmoBaseEvent {
  reason: "pointercancel" | "system-dispose" | "gizmo-disabled";
}

export interface GizmoClickEvent extends GizmoBaseEvent {
  clickCount: 1 | 2;
}
