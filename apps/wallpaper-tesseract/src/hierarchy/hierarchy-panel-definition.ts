import type { ComponentDefinition } from "../actor-runtime";
import { noopEditorCommandSink, type EditorCommandSink } from "editor";
import { gizmoEventBindingComponentType } from "../gizmo-runtime";
import { stateObserverBindingComponentType } from "../state-runtime";
import { frameUpdateAttachment } from "../update-runtime";
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
    create(actor, _context, options) {
      if (!options) {
        throw new Error("HierarchyPanelComponent options are required.");
      }
      if (!options.contentRegistration || !options.contentId) {
        throw new Error("HierarchyPanelComponent requires content registration options.");
      }
      return new HierarchyPanelComponent(actor, options, {
        commandSink: services.commandSink ?? noopEditorCommandSink
      });
    }
  };
}

export const hierarchyPanelComponentDefinition = createHierarchyPanelComponentDefinition();
