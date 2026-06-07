import type { ComponentDefinition } from "../../actor-runtime";
import { frameUpdateAttachment } from "../../update-runtime";
import { findOwningWindowContentHost } from "../../window-runtime";
import {
  DebugLogContentComponent,
  debugLogContentComponentType,
  type DebugLogContentComponentOptions
} from "./debug-log-content-component";

export const debugLogContentComponentDefinition:
  ComponentDefinition<DebugLogContentComponent, DebugLogContentComponentOptions> = {
    type: debugLogContentComponentType,
    singleton: true,
    attachments: [frameUpdateAttachment],
    requires: [],
    createId(_actor, options) {
      return options?.id ?? "debug-log-content";
    },
    create(actor, context, options = {}) {
      const host = findOwningWindowContentHost(context.actorSystem, context.componentRegistry, actor);
      if (!host) {
        throw new Error("DebugLogContentComponent requires an owning FloatingWindowComponent.");
      }
      return new DebugLogContentComponent(actor, options, { host });
    }
  };
