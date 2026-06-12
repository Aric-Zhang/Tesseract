import type { ComponentDefinition } from "../../../actor-runtime";
import {
  sceneViewportComponentType
} from "editor";
import {
  camera3MotionComponentType
} from "./camera3-motion-component";
import {
  camera3RigComponentType
} from "./camera3-rig-component";
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
      { type: camera3RigComponentType, autoAdd: true },
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
      const rig = context.componentRegistry.getComponent(actor, camera3RigComponentType);
      const motion = context.componentRegistry.getComponent(actor, camera3MotionComponentType);
      const camera3Actor = context.actorSystem.getActor(options.camera3GizmoActorId);
      const gizmo = camera3Actor ? getCamera3GizmoComponent(camera3Actor) : null;
      if (!viewport || !rig || !motion || !gizmo) {
        throw new Error("SceneCamera3ViewportBindingComponent requires Scene viewport, Camera3 rig, motion, and gizmo.");
      }
      return new SceneCamera3ViewportBindingComponent(actor, options, {
        viewport,
        rig,
        motion,
        gizmo
      });
    }
  };
