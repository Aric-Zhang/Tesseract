import type {
  ActorSystem,
  ComponentRegistry,
  RegisteredActor
} from "actor-core";

export interface UiActorContextRegistration {
  dispose(): void;
}

export interface UiActorContext {
  readonly actorSystem: ActorSystem;
  readonly componentRegistry: ComponentRegistry;
  trackRegisteredActor(actor: RegisteredActor): UiActorContextRegistration;
}
