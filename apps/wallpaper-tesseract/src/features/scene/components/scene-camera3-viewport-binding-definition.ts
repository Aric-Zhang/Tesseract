import type { ComponentDefinition } from "../../../actor-runtime";
import {
  camera3MotionComponentType
} from "wallpaper-runtime";
import { renderViewportComponentType } from "ui-framework";
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
      { type: camera3MotionComponentType, autoAdd: true }
    ],
    createId(_actor, options) {
      return options?.id ?? "scene-camera3-viewport-binding";
    },
    create(actor, context, options) {
      if (!options?.camera3GizmoActorId) {
        throw new Error("SceneCamera3ViewportBindingComponent options.camera3GizmoActorId is required.");
      }
      if (!options.renderViewportActorId) {
        throw new Error("SceneCamera3ViewportBindingComponent options.renderViewportActorId is required.");
      }
      const renderViewportActor = context.actorSystem.getActor(options.renderViewportActorId);
      const viewport = renderViewportActor
        ? context.componentRegistry.getComponent(renderViewportActor, renderViewportComponentType)
        : null;
      const motion = context.componentRegistry.getComponent(actor, camera3MotionComponentType);
      const camera3Actor = context.actorSystem.getActor(options.camera3GizmoActorId);
      const gizmo = camera3Actor ? getCamera3GizmoComponent(camera3Actor) : null;
      if (!viewport || !motion || !gizmo) {
        throw new Error("SceneCamera3ViewportBindingComponent requires render viewport, Camera3 motion, and gizmo.");
      }
      return new SceneCamera3ViewportBindingComponent(actor, options, {
        viewport,
        motion,
        gizmo
      });
    }
  };
