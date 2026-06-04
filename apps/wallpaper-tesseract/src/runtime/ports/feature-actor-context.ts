import type {
  ActorSystem,
  ComponentRegistry,
  RegisteredActor
} from "../../actor-runtime";
import type { RuntimeRegistration } from "../../scene-runtime";

export interface FeatureActorContext {
  readonly actorSystem: ActorSystem;
  readonly componentRegistry: ComponentRegistry;
  trackRegisteredActor(actor: RegisteredActor): RuntimeRegistration;
}
