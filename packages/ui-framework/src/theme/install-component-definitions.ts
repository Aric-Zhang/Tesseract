import {
  installComponentDefinition,
  type ComponentRegistry
} from "actor-system/core";
import { uiThemeComponentDefinition } from "../ui/theme";

export function installThemeComponentDefinitions(componentRegistry: ComponentRegistry): void {
  installComponentDefinition(componentRegistry, uiThemeComponentDefinition);
}
