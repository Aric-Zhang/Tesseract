import type { ComponentDefinition } from "../../../actor-runtime";
import {
  Camera3RigComponent,
  camera3RigComponentType,
  type Camera3RigComponentOptions
} from "./camera3-rig-component";

export const camera3RigComponentDefinition:
  ComponentDefinition<Camera3RigComponent, Camera3RigComponentOptions> = {
    type: camera3RigComponentType,
    singleton: true,
    createId(_actor, options) {
      return options?.id ?? "camera3-rig";
    },
    create(actor, _context, options) {
      return new Camera3RigComponent(actor, options ?? {});
    }
  };
