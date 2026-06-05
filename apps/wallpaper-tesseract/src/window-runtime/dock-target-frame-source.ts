import type { Actor, ActorSystemView } from "../actor-runtime";
import {
  floatingWindowComponentType,
  type FloatingWindowComponent
} from "./floating-window-component";
import {
  rectFromDomRect,
  type WindowDockTargetRegion
} from "./window-dock-targets";

export interface DockTargetRegionSource {
  listDockTargetRegions(): readonly WindowDockTargetRegion[];
}

// Compatibility alias while callers migrate to region terminology.
export interface DockTargetFrameSource extends DockTargetRegionSource {
  listDockTargetFrames(): readonly WindowDockTargetFrame[];
}

export interface DockTargetRegionSourceOptions {
  readonly actorSystem: ActorSystemView;
}

export type DockTargetFrameSourceOptions = DockTargetRegionSourceOptions;
export type WindowDockTargetFrame = WindowDockTargetRegion;

interface IndexedFrame {
  readonly actor: Actor;
  readonly component: FloatingWindowComponent;
  readonly index: number;
}

export function createDockTargetRegionSource(options: DockTargetRegionSourceOptions): DockTargetFrameSource {
  return {
    listDockTargetRegions() {
      return listIndexedFrames(options.actorSystem)
        .flatMap((entry) => toDockTargetRegions(entry.actor.id, entry.component, entry.index));
    },
    listDockTargetFrames() {
      return this.listDockTargetRegions();
    }
  };
}

export const createDockTargetFrameSource = createDockTargetRegionSource;

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
        component.state.visible &&
        entry.actor.enabled &&
        actorSystem.isActorActive(entry.actor);
    });
}

function toDockTargetRegions(
  frameId: string,
  component: FloatingWindowComponent,
  index: number
): readonly WindowDockTargetRegion[] {
  return component.listDockTargetTabsets().map((target) => ({
    frameId,
    targetTabsetId: target.targetTabsetId,
    stackPriority: component.inputStackPriority + index * 0.001,
    bounds: rectFromDomRect(component.getBounds()),
    tabBounds: target.tabBounds,
    contentBounds: target.contentBounds
  }));
}
