import type { Actor } from "actor-core";

export interface ActorInputStackPrioritySource {
  getEffectiveStackPriorityForActor(actor: Actor): number | null;
}

