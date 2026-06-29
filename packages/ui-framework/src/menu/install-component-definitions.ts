import {
  installComponentDefinition,
  type ComponentRegistry
} from "actor-system/core";
import {
  menuBarComponentDefinition,
  menuBarItemComponentDefinition,
  menuItemComponentDefinition,
  popupMenuComponentDefinition
} from "../ui/menu";

export function installMenuComponentDefinitions(componentRegistry: ComponentRegistry): void {
  installComponentDefinition(componentRegistry, menuBarComponentDefinition);
  installComponentDefinition(componentRegistry, menuBarItemComponentDefinition);
  installComponentDefinition(componentRegistry, popupMenuComponentDefinition);
  installComponentDefinition(componentRegistry, menuItemComponentDefinition);
}
