import type { Actor } from "../actor-runtime";
import type { ActorInputStackPrioritySource } from "../gizmo-runtime";
import type { WindowFocusCommandPort, WindowFocusReason } from "./window-focus-command-port";

export interface WindowFocusServiceProxy extends ActorInputStackPrioritySource, WindowFocusCommandPort {
  bind(service: ActorInputStackPrioritySource & WindowFocusCommandPort): void;
  unbind(): void;
  dispose(): void;
}

export function createWindowFocusServiceProxy(): WindowFocusServiceProxy {
  let target: (ActorInputStackPrioritySource & WindowFocusCommandPort) | null = null;
  return {
    bind(service) {
      target = service;
    },
    unbind() {
      target = null;
    },
    getEffectiveStackPriorityForActor(actor: Actor): number | null {
      return target?.getEffectiveStackPriorityForActor(actor) ?? null;
    },
    focusActorWindow(actor: Actor, reason: WindowFocusReason): void {
      target?.focusActorWindow(actor, reason);
    },
    requestFocusOnVisible(actor: Actor, reason: WindowFocusReason): void {
      target?.requestFocusOnVisible(actor, reason);
    },
    dispose() {
      target = null;
    }
  };
}
