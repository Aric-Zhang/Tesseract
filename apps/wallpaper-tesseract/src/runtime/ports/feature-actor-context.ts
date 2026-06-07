import type {
  ActorSystem,
  ComponentRegistry,
  RegisteredActor
} from "../../actor-runtime";
import type { RuntimeRegistration } from "./update-frame";

export interface FeatureActorContext {
  readonly actorSystem: ActorSystem;
  readonly componentRegistry: ComponentRegistry;
  trackRegisteredActor(actor: RegisteredActor): RuntimeRegistration;
}
