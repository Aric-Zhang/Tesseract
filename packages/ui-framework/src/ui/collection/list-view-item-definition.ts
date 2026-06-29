import type { ComponentDefinition } from "actor-system/core";
import {
  ListViewItemComponent,
  listViewItemComponentType,
  type ListViewItemComponentOptions
} from "./list-view-item-component";

export const listViewItemComponentDefinition:
  ComponentDefinition<ListViewItemComponent, ListViewItemComponentOptions> = {
    type: listViewItemComponentType,
    singleton: true,
    createId(_actor, options) {
      return options?.id ?? "ui-list-view-item";
    },
    create(actor, _context, options) {
      if (!options?.descriptor) {
        throw new Error("ListViewItemComponent requires descriptor options.");
      }
      return new ListViewItemComponent(actor, options);
    }
  };
