import type { GizmoController } from "gizmo-core";

export interface GizmoControllerRegistration {
  dispose(): void;
}

export interface GizmoControllerRegistry {
  register(object: GizmoController): GizmoControllerRegistration;
  dispose(): void;
}

