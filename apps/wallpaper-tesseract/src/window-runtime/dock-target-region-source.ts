import type { Actor, ActorSystemView } from "../actor-runtime";
import {
  floatingWindowComponentType,
  type FloatingWindowComponent
} from "./floating-window-component";
import type { WindowDockTargetRegion } from "./window-dock-targets";
import type { WindowFramePort, WindowFrameDockTargetTabset } from "./window-frame-port";
import type { WindowFramePortRegistryView } from "./window-frame-port-registry";

export interface DockTargetRegionSource {
  listDockTargetRegions(): readonly WindowDockTargetRegion[];
}

export interface DockTargetRegionSourceOptions {
  readonly actorSystem?: ActorSystemView;
  readonly framePorts?: WindowFramePortRegistryView;
}

interface IndexedFrame {
  readonly actor: Actor;
  readonly component: FloatingWindowComponent;
  readonly index: number;
}

export function createDockTargetRegionSource(options: DockTargetRegionSourceOptions): DockTargetRegionSource {
  return {
    listDockTargetRegions() {
      if (options.framePorts) {
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
      if (!options.actorSystem) return [];
      return listIndexedFrames(options.actorSystem)
        .flatMap((entry) => toDockTargetRegions(
          entry.actor.id,
          entry.component,
          entry.component.inputStackPriority,
          entry.index
        ));
    }
  };
}

function listIndexedFrames(actorSystem: ActorSystemView): readonly IndexedFrame[] {
  return actorSystem.listActorsInTreeOrder()
    .map((actor, index) => ({
      actor,
      component: actor.getComponent(floatingWindowComponentType),
      index
    }))
    .filter((entry): entry is IndexedFrame => {
      const component = entry.component;
      return component !== null &&
        component.effectiveVisible &&
        entry.actor.enabled &&
        actorSystem.isActorActive(entry.actor);
    });
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
