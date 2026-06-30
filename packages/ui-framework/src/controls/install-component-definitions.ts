import {
  installComponentDefinition,
  type ComponentRegistry
} from "actor-system/core";
import {
  buttonComponentDefinition,
  toggleButtonComponentDefinition
} from "../ui/button";
import {
  listViewComponentDefinition,
  listViewItemComponentDefinition,
  treeViewComponentDefinition,
  treeViewItemComponentDefinition,
  virtualListViewComponentDefinition
} from "../ui/collection";
import { scrollViewComponentDefinition } from "../ui/scroll";
import { toolbarComponentDefinition } from "../ui/toolbar";
import {
  fullscreenableViewComponentDefinition,
  renderViewportComponentDefinition
} from "../ui/viewport";

export function installControlComponentDefinitions(componentRegistry: ComponentRegistry): void {
  installComponentDefinition(componentRegistry, buttonComponentDefinition);
  installComponentDefinition(componentRegistry, toggleButtonComponentDefinition);
  installComponentDefinition(componentRegistry, toolbarComponentDefinition);
  installComponentDefinition(componentRegistry, scrollViewComponentDefinition);
  installComponentDefinition(componentRegistry, listViewItemComponentDefinition);
  installComponentDefinition(componentRegistry, listViewComponentDefinition);
  installComponentDefinition(componentRegistry, virtualListViewComponentDefinition);
  installComponentDefinition(componentRegistry, treeViewItemComponentDefinition);
  installComponentDefinition(componentRegistry, treeViewComponentDefinition);
  installComponentDefinition(componentRegistry, renderViewportComponentDefinition);
  installComponentDefinition(componentRegistry, fullscreenableViewComponentDefinition);
}
