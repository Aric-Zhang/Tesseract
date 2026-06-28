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
  treeViewComponentDefinition,
  treeViewItemComponentDefinition
} from "./collection";
import {
  uiLayoutHostComponentDefinition,
  uiLayoutItemComponentDefinition
} from "./layout";
import { scrollViewComponentDefinition } from "./scroll";
import { uiThemeComponentDefinition } from "./theme";
import {
  fullscreenableViewComponentDefinition,
  renderViewportComponentDefinition
} from "./viewport";

export function installUiComponentDefinitions(componentRegistry: ComponentRegistry): void {
  installComponentDefinition(componentRegistry, uiElementComponentDefinition);
  installComponentDefinition(componentRegistry, uiThemeComponentDefinition);
  installComponentDefinition(componentRegistry, uiLayoutItemComponentDefinition);
  installComponentDefinition(componentRegistry, uiLayoutHostComponentDefinition);
  installComponentDefinition(componentRegistry, scrollViewComponentDefinition);
  installComponentDefinition(componentRegistry, treeViewItemComponentDefinition);
  installComponentDefinition(componentRegistry, treeViewComponentDefinition);
  installComponentDefinition(componentRegistry, menuBarComponentDefinition);
  installComponentDefinition(componentRegistry, menuBarItemComponentDefinition);
  installComponentDefinition(componentRegistry, popupMenuComponentDefinition);
  installComponentDefinition(componentRegistry, menuItemComponentDefinition);
  installComponentDefinition(componentRegistry, renderViewportComponentDefinition);
  installComponentDefinition(componentRegistry, fullscreenableViewComponentDefinition);
}
