import type {
  Actor,
  ActorSystemView,
  ComponentRegistryView
} from "../actor-runtime";
import {
  floatingWindowComponentType,
  type FloatingWindowComponent
} from "./floating-window-component";
import type { WindowContentHost } from "./floating-window-host";
import type { WindowFramePort } from "./window-frame-port";
import { workspaceRootDockFrameComponentType } from "./workspace-root-dock-frame-component";

export function findOwningFloatingWindowHost(
  actorSystem: ActorSystemView,
  componentRegistry: ComponentRegistryView,
  actor: Actor
): FloatingWindowComponent | null {
  let current: Actor | null = actor;
  while (current) {
    const host = componentRegistry.getComponent(current, floatingWindowComponentType);
    if (host) return host;
    const parentId = actorSystem.getParentId(current);
    current = parentId ? actorSystem.getActor(parentId) : null;
  }
  return null;
}

export function findOwningWindowContentHost(
  actorSystem: ActorSystemView,
  componentRegistry: ComponentRegistryView,
  actor: Actor
): WindowContentHost | null {
  let current: Actor | null = actor;
  let childOfWindow: Actor | null = null;
  while (current) {
    const host = findWindowFrameContentHost(componentRegistry, current);
    if (host) {
      if (childOfWindow) {
        return host.getContentHost(childOfWindow.id);
      }
      return host;
    }
    const parentId = actorSystem.getParentId(current);
    childOfWindow = current;
    current = parentId ? actorSystem.getActor(parentId) : null;
  }
  return null;
}

function findWindowFrameContentHost(
  componentRegistry: ComponentRegistryView,
  actor: Actor
): (WindowContentHost & Pick<WindowFramePort, "getContentHost">) | null {
  return componentRegistry.getComponent(actor, floatingWindowComponentType) ??
    componentRegistry.getComponent(actor, workspaceRootDockFrameComponentType);
}
