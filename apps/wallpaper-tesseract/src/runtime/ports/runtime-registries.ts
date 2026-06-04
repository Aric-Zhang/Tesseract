import type { GizmoController } from "gizmo-core";
import type {
  RuntimeObject,
  RuntimeRegistration,
  SceneCommandSink,
  SceneStateObserver
} from "../../scene-runtime";

export interface RuntimeObjectRegistry {
  register(object: RuntimeObject): RuntimeRegistration;
  dispose(): void;
}

export interface GizmoControllerRegistry {
  register(object: GizmoController): RuntimeRegistration;
  dispose(): void;
}

export interface SceneStateObserverRegistry extends SceneCommandSink {
  subscribe(observer: SceneStateObserver): RuntimeRegistration;
  dispose(): void;
}
