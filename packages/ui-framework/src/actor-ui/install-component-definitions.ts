import {
  installComponentDefinition,
  type ComponentRegistry
} from "actor-system/core";
import { uiElementComponentDefinition } from "../ui/element";
import {
  uiLayoutHostComponentDefinition,
  uiLayoutItemComponentDefinition
} from "../ui/layout";

export function installActorUiComponentDefinitions(componentRegistry: ComponentRegistry): void {
  installComponentDefinition(componentRegistry, uiElementComponentDefinition);
  installComponentDefinition(componentRegistry, uiLayoutItemComponentDefinition);
  installComponentDefinition(componentRegistry, uiLayoutHostComponentDefinition);
}
