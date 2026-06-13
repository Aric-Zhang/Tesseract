import type { ComponentDefinition } from "../../../actor-runtime";
import {
  sceneViewportComponentType
} from "editor";
import {
  camera3MotionComponentType
} from "wallpaper-runtime";
import {
  getCamera3GizmoComponent,
  SceneCamera3ViewportBindingComponent,
  sceneCamera3ViewportBindingComponentType,
  type SceneCamera3ViewportBindingComponentOptions
} from "./scene-camera3-viewport-binding-component";

export const sceneCamera3ViewportBindingComponentDefinition:
  ComponentDefinition<SceneCamera3ViewportBindingComponent, SceneCamera3ViewportBindingComponentOptions> = {
    type: sceneCamera3ViewportBindingComponentType,
    singleton: true,
    requires: [
      { type: sceneViewportComponentType, autoAdd: false },
      { type: camera3MotionComponentType, autoAdd: true }
    ],
    createId(_actor, options) {
      return options?.id ?? "scene-camera3-viewport-binding";
    },
    create(actor, context, options) {
      if (!options?.camera3GizmoActorId) {
        throw new Error("SceneCamera3ViewportBindingComponent options.camera3GizmoActorId is required.");
      }
      const viewport = context.componentRegistry.getComponent(actor, sceneViewportComponentType);
      const motion = context.componentRegistry.getComponent(actor, camera3MotionComponentType);
      const camera3Actor = context.actorSystem.getActor(options.camera3GizmoActorId);
      const gizmo = camera3Actor ? getCamera3GizmoComponent(camera3Actor) : null;
      if (!viewport || !motion || !gizmo) {
        throw new Error("SceneCamera3ViewportBindingComponent requires Scene viewport, Camera3 motion, and gizmo.");
      }
      return new SceneCamera3ViewportBindingComponent(actor, options, {
        viewport,
        motion,
        gizmo
      });
    }
  };
