import type { ActorSystemView } from "actor-core";
import type { WindowDockTargetRegion } from "../model/window-dock-targets";
import type { WindowFrameDockTargetTabset } from "../model/window-frame-tab";
import type { WindowFramePort } from "./window-frame-port";
import type { WindowFramePortRegistryView } from "./window-frame-port-registry";

export interface DockTargetRegionSourceOptions {
  readonly actorSystem?: ActorSystemView;
  readonly framePorts: WindowFramePortRegistryView;
}

export interface DockTargetRegionSource {
  listDockTargetRegions(): readonly WindowDockTargetRegion[];
}

export function createDockTargetRegionSource(options: DockTargetRegionSourceOptions): DockTargetRegionSource {
  return {
    listDockTargetRegions() {
      return options.framePorts.list()
        .filter((entry) => (
          entry.framePort.effectiveVisible &&
          (entry.canTarget?.() ?? true) &&
          (options.actorSystem?.isActorActive(entry.frameActor) ?? entry.frameActor.enabled)
        ))
        .flatMap((entry, index) => toDockTargetRegions(
          entry.frameActor.id,
          entry.framePort,
          entry.getStackPriority(),
          index
        ));
    }
  };
}

function toDockTargetRegions(
  frameId: string,
  framePort: WindowFramePort,
  stackPriority: number,
  index: number
): readonly WindowDockTargetRegion[] {
  return framePort.listDockTargetTabsets().map((target: WindowFrameDockTargetTabset) => ({
    frameId,
    targetTabsetId: target.targetTabsetId,
    stackPriority: stackPriority + index * 0.001,
    bounds: framePort.getFloatingBounds(),
    tabBounds: target.tabBounds,
    contentBounds: target.contentBounds
  }));
}
