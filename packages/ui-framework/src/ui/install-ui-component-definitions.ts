import {
  installComponentDefinition,
  type ComponentRegistry
} from "actor-core";
import { uiElementComponentDefinition } from "./element";
import {
  menuBarComponentDefinition,
  menuBarItemComponentDefinition,
  menuItemComponentDefinition,
  popupMenuComponentDefinition
} from "./menu";
import {
  uiLayoutHostComponentDefinition,
  uiLayoutItemComponentDefinition
} from "./layout";
import {
  fullscreenableViewComponentDefinition,
  renderViewportComponentDefinition
} from "./viewport";

export function installUiComponentDefinitions(componentRegistry: ComponentRegistry): void {
  installComponentDefinition(componentRegistry, uiElementComponentDefinition);
  installComponentDefinition(componentRegistry, uiLayoutItemComponentDefinition);
  installComponentDefinition(componentRegistry, uiLayoutHostComponentDefinition);
  installComponentDefinition(componentRegistry, menuBarComponentDefinition);
  installComponentDefinition(componentRegistry, menuBarItemComponentDefinition);
  installComponentDefinition(componentRegistry, popupMenuComponentDefinition);
  installComponentDefinition(componentRegistry, menuItemComponentDefinition);
  installComponentDefinition(componentRegistry, renderViewportComponentDefinition);
  installComponentDefinition(componentRegistry, fullscreenableViewComponentDefinition);
}
