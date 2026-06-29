import type { ActorSystemView } from "actor-system/core";
import type { WindowFramePortRegistryView } from "./window-frame-port-registry";

export interface WindowFrameTargetability {
  readonly frameId: string;
  readonly frameActorId: string;
  readonly activeInHierarchy: boolean;
  readonly canReceiveDockTargets: boolean;
  readonly stackPriority: number;
}

export interface WindowFrameTargetabilitySource {
  listTargetableFrames(): readonly WindowFrameTargetability[];
}

export interface WindowFrameTargetabilitySourceOptions {
  readonly actorSystem?: ActorSystemView;
  readonly framePorts: WindowFramePortRegistryView;
}

export function createWindowFrameTargetabilitySource(
  options: WindowFrameTargetabilitySourceOptions
): WindowFrameTargetabilitySource {
  return {
    listTargetableFrames() {
      return options.framePorts.list().map((entry) => ({
        frameId: entry.framePort.frameId,
        frameActorId: entry.frameActor.id,
        activeInHierarchy: options.actorSystem?.isActorActive(entry.frameActor) ?? entry.frameActor.enabled,
        canReceiveDockTargets: entry.canTarget?.() ?? true,
        stackPriority: entry.getStackPriority()
      }));
    }
  };
}
