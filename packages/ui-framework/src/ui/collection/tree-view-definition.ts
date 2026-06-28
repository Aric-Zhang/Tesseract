import type { ComponentDefinition } from "actor-core";
import { gizmoEventBindingComponentType } from "actor-input";
import { frameUpdateAttachment } from "../../ports/ui-frame-update-attachment-runtime";
import { uiElementComponentType } from "../element";
import {
  TreeViewComponent,
  treeViewComponentType,
  type TreeViewComponentOptions
} from "./tree-view-component";

export const treeViewComponentDefinition:
  ComponentDefinition<TreeViewComponent, TreeViewComponentOptions> = {
    type: treeViewComponentType,
    singleton: true,
    attachments: [frameUpdateAttachment],
    requires: [
      {
        type: uiElementComponentType,
        autoAdd: false,
        reuseExisting: true
      },
      {
        type: gizmoEventBindingComponentType,
        autoAdd: true,
        reuseExisting: true
      }
    ],
    createId(_actor, options) {
      return options?.id ?? "ui-tree-view";
    },
    create(actor, context, options) {
      const uiElement = context.componentRegistry.getComponent(actor, uiElementComponentType);
      if (!uiElement) {
        throw new Error("TreeViewComponent requires UiElementComponent.");
      }
      return new TreeViewComponent(actor, uiElement, {
        actorSystem: context.actorSystem,
        componentRegistry: context.componentRegistry
      }, options);
    }
  };
