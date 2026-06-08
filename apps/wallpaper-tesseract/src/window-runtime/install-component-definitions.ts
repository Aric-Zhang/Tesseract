import { installComponentDefinition, type ComponentRegistry } from "../actor-runtime";
import {
  createFloatingWindowComponentDefinition,
  floatingWindowComponentDefinition,
  type FloatingWindowComponentDefinitionOptions
} from "./floating-window-definition";
import { windowFrameSurfaceComponentDefinition } from "./window-frame-surface-definition";
import { workspaceRootDockFrameComponentDefinition } from "./workspace-root-dock-frame-definition";

export type InstallWindowComponentDefinitionsOptions = FloatingWindowComponentDefinitionOptions;

export function installWindowComponentDefinitions(
  componentRegistry: ComponentRegistry,
  options: InstallWindowComponentDefinitionsOptions = {}
): void {
  installComponentDefinition(componentRegistry, windowFrameSurfaceComponentDefinition);
  installComponentDefinition(
    componentRegistry,
    options.commandSink
      ? createFloatingWindowComponentDefinition(options)
      : floatingWindowComponentDefinition
  );
  installComponentDefinition(componentRegistry, workspaceRootDockFrameComponentDefinition);
}
