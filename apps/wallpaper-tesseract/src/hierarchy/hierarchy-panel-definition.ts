import type { ComponentDefinition } from "../actor-runtime";
import { gizmoEventBindingComponentType } from "../gizmo-runtime";
import { findOwningWindowContentHost } from "../window-runtime";
import {
  HierarchyPanelComponent,
  hierarchyPanelComponentType,
  type HierarchyPanelComponentOptions
} from "./hierarchy-panel-component";

export const hierarchyPanelComponentDefinition:
  ComponentDefinition<HierarchyPanelComponent, HierarchyPanelComponentOptions> = {
    type: hierarchyPanelComponentType,
    singleton: true,
    requires: [
      { type: gizmoEventBindingComponentType }
    ],
    createId(_actor, options) {
      return options?.id ?? "hierarchy-panel";
    },
    create(actor, context, options) {
      if (!options) {
        throw new Error("HierarchyPanelComponent options are required.");
      }
      const host = findOwningWindowContentHost(context.actorSystem, context.componentRegistry, actor);
      if (!host) {
        throw new Error("HierarchyPanelComponent requires an owning FloatingWindowComponent.");
      }
      return new HierarchyPanelComponent(actor, options, {
        host,
        commandSink: context.services.commandSink
      });
    }
  };
