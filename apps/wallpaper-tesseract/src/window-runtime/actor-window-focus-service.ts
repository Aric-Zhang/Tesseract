import type { Actor, ActorWindowFocusReason, ActorWindowFocusService } from "../actor-runtime";

export interface ActorWindowFocusServiceProxy extends ActorWindowFocusService {
  bind(service: ActorWindowFocusService): void;
  unbind(): void;
  dispose(): void;
}

export function createActorWindowFocusServiceProxy(): ActorWindowFocusServiceProxy {
  let target: ActorWindowFocusService | null = null;
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
    focusActorWindow(actor: Actor, reason: ActorWindowFocusReason): void {
      target?.focusActorWindow(actor, reason);
    },
    requestFocusOnVisible(actor: Actor, reason: ActorWindowFocusReason): void {
      target?.requestFocusOnVisible(actor, reason);
    },
    dispose() {
      target = null;
    }
  };
}
