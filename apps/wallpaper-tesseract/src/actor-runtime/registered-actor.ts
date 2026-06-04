import type { Actor } from "./actor";
import type { ActorSystem } from "./actor-system";
import type { Component } from "./component";

export interface RegisteredActor<TComponent extends Component = Component> {
  readonly actor: Actor;
  readonly component: TComponent;
  dispose(): void;
}

export interface CreateRegisteredActorOptions<TComponent extends Component> {
  actorSystem: ActorSystem;
  actor: Actor;
  component: TComponent;
  beforeDispose?: () => void;
}

export function createRegisteredActor<TComponent extends Component>(
  options: CreateRegisteredActorOptions<TComponent>
): RegisteredActor<TComponent> {
  let disposed = false;
  return {
    actor: options.actor,
    component: options.component,
    dispose() {
      if (disposed) return;
      disposed = true;
      try {
        options.beforeDispose?.();
      } finally {
        if (options.actorSystem.hasActor(options.actor)) {
          options.actorSystem.destroyActor(options.actor);
        }
      }
    }
  };
}
