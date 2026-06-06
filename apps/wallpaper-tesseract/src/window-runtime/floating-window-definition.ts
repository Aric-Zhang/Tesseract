import type { ComponentDefinition } from "../actor-runtime";
import { gizmoEventBindingComponentType } from "../gizmo-runtime";
import { stateObserverBindingComponentType } from "../state-runtime";
import {
  FloatingWindowComponent,
  floatingWindowComponentType,
  type FloatingWindowComponentOptions
} from "./floating-window-component";
import { windowFrameSurfaceComponentType } from "./window-frame-surface-component";

export const floatingWindowComponentDefinition:
  ComponentDefinition<FloatingWindowComponent, FloatingWindowComponentOptions> = {
    type: floatingWindowComponentType,
    singleton: true,
    requires: [
      { type: gizmoEventBindingComponentType },
      { type: stateObserverBindingComponentType },
      { type: windowFrameSurfaceComponentType }
    ],
    createId(_actor, options) {
      if (!options?.id) {
        throw new Error("FloatingWindowComponent options.id is required.");
      }
      return options.id;
    },
    create(actor, context, options) {
      if (!options) {
        throw new Error("FloatingWindowComponent options are required.");
      }
      const surface = context.componentRegistry.getComponent(actor, windowFrameSurfaceComponentType);
      if (!surface) {
        throw new Error("FloatingWindowComponent requires WindowFrameSurfaceComponent.");
      }
      return new FloatingWindowComponent(actor, options, {
        commandSink: context.services.commandSink,
        surface
      });
    }
  };
