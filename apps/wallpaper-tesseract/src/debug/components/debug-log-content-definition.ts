import type { ComponentDefinition } from "../../actor-runtime";
import { frameUpdateAttachment } from "ui-framework";
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
    create(actor, _context, options) {
      if (!options?.contentRegistration || !options.contentId) {
        throw new Error("DebugLogContentComponent requires content registration options.");
      }
      return new DebugLogContentComponent(actor, options);
    }
  };
