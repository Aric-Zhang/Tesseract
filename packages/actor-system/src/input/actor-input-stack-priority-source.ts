import type { Actor } from "../core";

export interface ActorInputStackPrioritySource {
  getEffectiveStackPriorityForActor(actor: Actor): number | null;
}

