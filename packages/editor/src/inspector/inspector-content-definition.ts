import type { ComponentDefinition } from "actor-core";
import {
  InspectorContentComponent,
  inspectorContentComponentType,
  type InspectorContentComponentOptions
} from "./inspector-content-component";

export const inspectorContentComponentDefinition:
  ComponentDefinition<InspectorContentComponent, InspectorContentComponentOptions> = {
    type: inspectorContentComponentType,
    singleton: true,
    requires: [],
    createId(_actor, options) {
      return options?.id ?? "inspector-content";
    },
    create(actor, _context, options) {
      if (!options?.contentRegistration || !options.contentId) {
        throw new Error("InspectorContentComponent requires content registration options.");
      }
      return new InspectorContentComponent(actor, options);
    }
  };
