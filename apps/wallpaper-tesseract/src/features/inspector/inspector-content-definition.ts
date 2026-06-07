import type { ComponentDefinition } from "../../actor-runtime";
import { findOwningWindowContentHost } from "../../window-runtime";
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
    create(actor, context, options = { label: "Inspector" }) {
      const host = findOwningWindowContentHost(context.actorSystem, context.componentRegistry, actor);
      if (!host) {
        throw new Error("InspectorContentComponent requires an owning window content host.");
      }
      return new InspectorContentComponent(actor, options, { host });
    }
  };
