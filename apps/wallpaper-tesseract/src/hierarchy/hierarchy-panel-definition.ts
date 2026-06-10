import type { ComponentDefinition } from "../actor-runtime";
import { noopEditorCommandSink, type EditorCommandSink } from "../editor/editor-state";
import { gizmoEventBindingComponentType } from "../gizmo-runtime";
import { stateObserverBindingComponentType } from "../state-runtime";
import { frameUpdateAttachment } from "../update-runtime";
import { findOwningWindowContentHost } from "../window-runtime";
import {
  HierarchyPanelComponent,
  hierarchyPanelComponentType,
  type HierarchyPanelComponentOptions
} from "./hierarchy-panel-component";

export interface HierarchyPanelComponentDefinitionOptions {
  readonly commandSink?: EditorCommandSink;
}

export function createHierarchyPanelComponentDefinition(
  services: HierarchyPanelComponentDefinitionOptions = {}
): ComponentDefinition<HierarchyPanelComponent, HierarchyPanelComponentOptions> {
  return {
    type: hierarchyPanelComponentType,
    singleton: true,
    attachments: [frameUpdateAttachment],
    requires: [
      { type: gizmoEventBindingComponentType },
      { type: stateObserverBindingComponentType }
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
        commandSink: services.commandSink ?? noopEditorCommandSink
      });
    }
  };
}

export const hierarchyPanelComponentDefinition = createHierarchyPanelComponentDefinition();
