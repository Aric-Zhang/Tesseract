import {
  installComponentDefinition,
  type ComponentRegistry
} from "actor-system/core";
import {
  listViewComponentDefinition,
  listViewItemComponentDefinition,
  treeViewComponentDefinition,
  treeViewItemComponentDefinition,
  virtualListViewComponentDefinition
} from "../ui/collection";
import { scrollViewComponentDefinition } from "../ui/scroll";
import {
  fullscreenableViewComponentDefinition,
  renderViewportComponentDefinition
} from "../ui/viewport";

export function installControlComponentDefinitions(componentRegistry: ComponentRegistry): void {
  installComponentDefinition(componentRegistry, scrollViewComponentDefinition);
  installComponentDefinition(componentRegistry, listViewItemComponentDefinition);
  installComponentDefinition(componentRegistry, listViewComponentDefinition);
  installComponentDefinition(componentRegistry, virtualListViewComponentDefinition);
  installComponentDefinition(componentRegistry, treeViewItemComponentDefinition);
  installComponentDefinition(componentRegistry, treeViewComponentDefinition);
  installComponentDefinition(componentRegistry, renderViewportComponentDefinition);
  installComponentDefinition(componentRegistry, fullscreenableViewComponentDefinition);
}
