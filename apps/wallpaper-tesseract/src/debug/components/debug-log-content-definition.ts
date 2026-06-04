import type { ComponentDefinition } from "../../actor-runtime";
import { floatingWindowComponentType } from "../../window-runtime";
import {
  DebugLogContentComponent,
  debugLogContentComponentType,
  type DebugLogContentComponentOptions
} from "./debug-log-content-component";

export const debugLogContentComponentDefinition:
  ComponentDefinition<DebugLogContentComponent, DebugLogContentComponentOptions> = {
    type: debugLogContentComponentType,
    singleton: true,
    requires: [
      { type: floatingWindowComponentType, autoAdd: false }
    ],
    createId(_actor, options) {
      return options?.id ?? "debug-log-content";
    },
    create(actor, context, options = {}) {
      const host = context.componentRegistry.getComponent(actor, floatingWindowComponentType);
      if (!host) {
        throw new Error("DebugLogContentComponent requires FloatingWindowComponent on the same actor.");
      }
      return new DebugLogContentComponent(actor, options, { host });
    }
  };
