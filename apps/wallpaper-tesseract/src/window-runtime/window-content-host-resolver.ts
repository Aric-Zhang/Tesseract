import type {
  Actor,
  ActorSystemView,
  ComponentRegistryView
} from "../actor-runtime";
import {
  floatingWindowComponentType,
  type FloatingWindowComponent
} from "./floating-window-component";

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
