import type { ComponentRegistry } from "../actor-runtime";
import { installComponentDefinition } from "../component-definitions";
import { floatingWindowComponentDefinition } from "./floating-window-definition";
import { windowFrameSurfaceComponentDefinition } from "./window-frame-surface-definition";
import { workspaceRootDockFrameComponentDefinition } from "./workspace-root-dock-frame-definition";

export function installWindowComponentDefinitions(componentRegistry: ComponentRegistry): void {
  installComponentDefinition(componentRegistry, windowFrameSurfaceComponentDefinition);
  installComponentDefinition(componentRegistry, floatingWindowComponentDefinition);
  installComponentDefinition(componentRegistry, workspaceRootDockFrameComponentDefinition);
}
