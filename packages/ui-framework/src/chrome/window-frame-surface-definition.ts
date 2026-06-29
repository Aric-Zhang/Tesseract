import type { ComponentDefinition } from "actor-system/core";
import {
  WindowFrameSurfaceComponent,
  windowFrameSurfaceComponentType,
  type WindowFrameSurfaceComponentOptions
} from "./window-frame-surface-component";

export const windowFrameSurfaceComponentDefinition:
  ComponentDefinition<WindowFrameSurfaceComponent, WindowFrameSurfaceComponentOptions> = {
    type: windowFrameSurfaceComponentType,
    singleton: true,
    createId(actor, options) {
      return options?.id ?? `${actor.id}:window-frame-surface`;
    },
    create(actor, _context, options) {
      return new WindowFrameSurfaceComponent(actor, options);
    }
  };
