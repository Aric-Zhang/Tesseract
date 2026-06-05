import type { Actor, ActorSystemView } from "../actor-runtime";
import {
  floatingWindowComponentType,
  type FloatingWindowComponent
} from "./floating-window-component";
import {
  rectFromDomRect,
  type WindowDockTargetFrame
} from "./window-dock-targets";

export interface DockTargetFrameSource {
  listDockTargetFrames(): readonly WindowDockTargetFrame[];
}

export interface DockTargetFrameSourceOptions {
  readonly actorSystem: ActorSystemView;
}

interface IndexedFrame {
  readonly actor: Actor;
  readonly component: FloatingWindowComponent;
  readonly index: number;
}

export function createDockTargetFrameSource(options: DockTargetFrameSourceOptions): DockTargetFrameSource {
  return {
    listDockTargetFrames() {
      return listIndexedFrames(options.actorSystem)
        .map((entry) => toDockTargetFrame(entry.actor.id, entry.component, entry.index));
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
        component.state.visible &&
        entry.actor.enabled &&
        actorSystem.isActorActive(entry.actor);
    });
}

function toDockTargetFrame(
  frameId: string,
  component: FloatingWindowComponent,
  index: number
): WindowDockTargetFrame {
  return {
    frameId,
    stackPriority: component.inputStackPriority + index * 0.001,
    bounds: rectFromDomRect(component.getBounds()),
    tabBounds: rectFromDomRect(component.getTabBounds()),
    contentBounds: rectFromDomRect(component.getContentBounds())
  };
}
