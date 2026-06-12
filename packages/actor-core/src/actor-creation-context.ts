import type { ActorSystem } from "./actor-system";
import type { ComponentRegistry } from "./component-registry";
import type { RegisteredActor } from "./registered-actor";

export interface ActorRegistration {
  dispose(): void;
}

export interface ActorCreationContext {
  readonly actorSystem: ActorSystem;
  readonly componentRegistry: ComponentRegistry;
  trackRegisteredActor(actor: RegisteredActor): ActorRegistration;
}
