import type { ComponentDefinition } from "../../actor-runtime";
import { runtimeWorkAttachment } from "../runtime-work-attachment-runtime";
import {
  Camera3MotionComponent,
  camera3MotionComponentType,
  type Camera3MotionComponentOptions
} from "./camera3-motion-component";

export const camera3MotionComponentDefinition:
  ComponentDefinition<Camera3MotionComponent, Camera3MotionComponentOptions> = {
    type: camera3MotionComponentType,
    singleton: true,
    attachments: [runtimeWorkAttachment],
    createId(_actor, options) {
      return options?.id ?? "camera3-motion-controller";
    },
    create(actor, _context, options) {
      return new Camera3MotionComponent(actor, options ?? {});
    }
  };
