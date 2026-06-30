import type { ActorSystemView } from "actor-system/core";

export interface InspectorActorDisplaySource {
  getActorDisplayName(actorId: string): string | null;
}

export function createActorSystemInspectorActorDisplaySource(
  actorSystem: ActorSystemView
): InspectorActorDisplaySource {
  return {
    getActorDisplayName(actorId: string): string | null {
      return actorSystem.getActor(actorId)?.name ?? null;
    }
  };
}
