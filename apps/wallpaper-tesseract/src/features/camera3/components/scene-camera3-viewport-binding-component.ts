import type { Actor, Component, ComponentType } from "../../../actor-runtime";
import type { RuntimeRegistration } from "../../../runtime/ports";
import {
  SceneViewportComponent
} from "editor";
import {
  Camera3GizmoComponent,
  camera3GizmoComponentType
} from "../../../gizmos/camera3/components";
import type { Camera3MotionComponent } from "./camera3-motion-component";

export const sceneCamera3ViewportBindingComponentType =
  "scene-camera3-viewport-binding-component" as ComponentType<SceneCamera3ViewportBindingComponent>;

export interface SceneCamera3ViewportBindingComponentOptions {
  readonly id?: string;
  readonly camera3GizmoActorId: string;
}

export class SceneCamera3ViewportBindingComponent implements Component {
  readonly type = sceneCamera3ViewportBindingComponentType;
  readonly actor: Actor;
  readonly id: string;
  enabled = true;
  readonly #motionRegistration: RuntimeRegistration;
  readonly #resizeRegistration: RuntimeRegistration;

  constructor(
    actor: Actor,
    options: SceneCamera3ViewportBindingComponentOptions,
    services: {
      readonly viewport: SceneViewportComponent;
      readonly motion: Camera3MotionComponent;
      readonly gizmo: Camera3GizmoComponent;
    }
  ) {
    this.actor = actor;
    this.id = options.id ?? "scene-camera3-viewport-binding";
    this.#motionRegistration = services.motion.subscribe({
      onCamera3MotionChanged: () => services.gizmo.update(services.motion.readViewState())
    });
    this.#resizeRegistration = services.viewport.subscribeResize(({ width, height }) => {
      services.motion.resizeProjection(width, height);
      services.gizmo.update(services.motion.readViewState());
    });
    const initialViewportSize = services.viewport.getSize();
    if (initialViewportSize) {
      services.motion.resizeProjection(initialViewportSize.width, initialViewportSize.height);
      services.gizmo.update(services.motion.readViewState());
    } else {
      services.viewport.measureNow();
    }
  }

  dispose(): void {
    if (!this.enabled) return;
    this.enabled = false;
    this.#resizeRegistration.dispose();
    this.#motionRegistration.dispose();
  }
}

export function getCamera3GizmoComponent(
  actor: Actor
): Camera3GizmoComponent | null {
  return actor.getComponent(camera3GizmoComponentType);
}
