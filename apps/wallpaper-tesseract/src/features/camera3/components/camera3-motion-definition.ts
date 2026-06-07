import type { ComponentDefinition } from "../../../actor-runtime";
import { frameUpdateAttachment } from "../../../update-runtime";
import {
  Camera3MotionComponent,
  camera3MotionComponentType,
  type Camera3MotionComponentOptions
} from "./camera3-motion-component";
import {
  camera3RigComponentType
} from "./camera3-rig-component";

export const camera3MotionComponentDefinition:
  ComponentDefinition<Camera3MotionComponent, Camera3MotionComponentOptions> = {
    type: camera3MotionComponentType,
    singleton: true,
    attachments: [frameUpdateAttachment],
    requires: [{
      type: camera3RigComponentType,
      autoAdd: true
    }],
    createId(_actor, options) {
      return options?.id ?? "camera3-motion-controller";
    },
    create(actor, context, options) {
      const rig = context.componentRegistry.getComponent(actor, camera3RigComponentType);
      if (!rig) {
        throw new Error("Camera3MotionComponent requires Camera3RigComponent.");
      }
      return new Camera3MotionComponent(actor, rig, options ?? {});
    }
  };
