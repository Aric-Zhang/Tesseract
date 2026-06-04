import type {
  GizmoCancelEvent,
  GizmoClickEvent,
  GizmoEndEvent,
  GizmoHit,
  GizmoMoveEvent,
  GizmoStartEvent,
  ScreenPoint
} from "gizmo-core";
import type { Component } from "../actor-runtime";

export interface GizmoResponder extends Component {
  readonly gizmoPriority: number;
  hitTestGizmo(point: ScreenPoint): GizmoHit | null;
  onGizmoStart?(event: GizmoStartEvent): void;
  onGizmoMove?(event: GizmoMoveEvent): void;
  onGizmoEnd?(event: GizmoEndEvent): void;
  onGizmoCancel?(event: GizmoCancelEvent): void;
  onGizmoClick?(event: GizmoClickEvent): void;
  onGizmoDoubleClick?(event: GizmoClickEvent): void;
}

export function isGizmoResponder(component: Component): component is GizmoResponder {
  const candidate = component as Partial<GizmoResponder>;
  return (
    typeof candidate.gizmoPriority === "number" &&
    typeof candidate.hitTestGizmo === "function"
  );
}
