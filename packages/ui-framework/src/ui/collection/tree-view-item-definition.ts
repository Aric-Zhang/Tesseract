import type { ComponentDefinition } from "actor-core";
import {
  TreeViewItemComponent,
  treeViewItemComponentType,
  type TreeViewItemComponentOptions
} from "./tree-view-item-component";

export const treeViewItemComponentDefinition:
  ComponentDefinition<TreeViewItemComponent, TreeViewItemComponentOptions> = {
    type: treeViewItemComponentType,
    singleton: true,
    createId(_actor, options) {
      return options?.id ?? "ui-tree-view-item";
    },
    create(actor, _context, options) {
      if (!options?.descriptor) {
        throw new Error("TreeViewItemComponent requires descriptor options.");
      }
      return new TreeViewItemComponent(actor, options);
    }
  };
