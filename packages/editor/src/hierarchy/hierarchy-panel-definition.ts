import type { ComponentDefinition } from "actor-core";
import { noopEditorCommandSink, type EditorCommandSink } from "../editor-state";
import { stateObserverBindingComponentType } from "../state-observer/state-observer-binding-component";
import {
  frameUpdateAttachment,
  treeViewComponentType,
  uiElementComponentType
} from "ui-framework";
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
      {
        type: uiElementComponentType,
        autoAdd: false,
        reuseExisting: true
      },
      {
        type: treeViewComponentType,
        autoAdd: false,
        reuseExisting: true
      },
      { type: stateObserverBindingComponentType }
    ],
    createId(_actor, options) {
      return options?.id ?? "hierarchy-panel";
    },
    create(actor, context, options) {
      if (!options) {
        throw new Error("HierarchyPanelComponent options are required.");
      }
      if (!options.contentRegistration || !options.contentId) {
        throw new Error("HierarchyPanelComponent requires content registration options.");
      }
      if (!options.itemReconciler) {
        throw new Error("HierarchyPanelComponent requires item reconciler options.");
      }
      const uiElement = context.componentRegistry.getComponent(actor, uiElementComponentType);
      const treeView = context.componentRegistry.getComponent(actor, treeViewComponentType);
      if (!uiElement || !treeView) {
        throw new Error("HierarchyPanelComponent requires UiElementComponent and TreeViewComponent.");
      }
      return new HierarchyPanelComponent(actor, uiElement, treeView, options, {
        commandSink: services.commandSink ?? noopEditorCommandSink
      });
    }
  };
}

export const hierarchyPanelComponentDefinition = createHierarchyPanelComponentDefinition();
