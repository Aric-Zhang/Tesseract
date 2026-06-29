import type { ActorCreationContext, ActorRegistration } from "./actor-creation-context";
import type { ActorSystem } from "./actor-system";
import type { ComponentRegistry } from "./component-registry";
import type { RegisteredActor } from "./registered-actor";

export interface ActorCreationScope extends ActorCreationContext {
  dispose(): void;
}

export interface ActorCreationScopeOptions {
  readonly actorSystem: ActorSystem;
  readonly componentRegistry: ComponentRegistry;
}

export function createActorCreationScope(options: ActorCreationScopeOptions): ActorCreationScope {
  const registeredActors: RegisteredActor[] = [];
  let disposed = false;
  return {
    actorSystem: options.actorSystem,
    componentRegistry: options.componentRegistry,
    trackRegisteredActor(actor) {
      if (disposed) {
        throw new Error("Cannot track actors after ActorCreationScope.dispose().");
      }
      if (!registeredActors.includes(actor)) {
        registeredActors.push(actor);
      }
      return createActorRegistration(() => {
        const index = registeredActors.indexOf(actor);
        if (index >= 0) {
          registeredActors.splice(index, 1);
        }
      });
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (let i = registeredActors.length - 1; i >= 0; i -= 1) {
        registeredActors[i].dispose();
      }
      registeredActors.length = 0;
    }
  };
}

function createActorRegistration(dispose: () => void): ActorRegistration {
  let disposed = false;
  return {
    dispose() {
      if (disposed) return;
      disposed = true;
      dispose();
    }
  };
}
