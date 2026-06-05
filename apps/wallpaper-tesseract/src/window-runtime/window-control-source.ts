import type { Actor, ActorSystemView } from "../actor-runtime";
import type { ParameterPath } from "../scene-runtime";
import {
  floatingWindowComponentType,
  type FloatingWindowActivationMode,
  type FloatingWindowComponent
} from "./floating-window-component";
import { windowViewKey, type WindowViewKey } from "./window-view-key";

export interface WindowControlItem {
  readonly actor: Actor;
  readonly viewKey: WindowViewKey;
  readonly actorId: string;
  readonly componentId: string;
  readonly label: string;
  readonly order: number;
  readonly group: string | null;
  readonly visible: boolean;
  readonly activeSelf: boolean;
  readonly activeInHierarchy: boolean;
  readonly activationMode: FloatingWindowActivationMode;
  readonly canToggle: boolean;
  readonly visiblePath: ParameterPath<boolean>;
}

export interface WindowControlSource {
  listWindows(): readonly WindowControlItem[];
  findWindowByViewKey(viewKey: WindowViewKey): WindowControlItem | null;
  findWindowByVisiblePath(path: ParameterPath<boolean>): WindowControlItem | null;
}

export interface WindowControlSourceOptions {
  readonly actorSystem: ActorSystemView;
}

interface IndexedWindow {
  readonly actor: Actor;
  readonly component: FloatingWindowComponent;
  readonly index: number;
}

export function createWindowControlSource(options: WindowControlSourceOptions): WindowControlSource {
  return {
    listWindows() {
      return [...listIndexedWindows(options.actorSystem)]
        .sort(compareIndexedWindows)
        .map((entry) => toWindowControlItem(options.actorSystem, entry));
    },
    findWindowByViewKey(viewKey) {
      return this.listWindows().find((item) => item.viewKey === viewKey) ?? null;
    },
    findWindowByVisiblePath(path) {
      return this.listWindows().find((item) => item.visiblePath === path) ?? null;
    }
  };
}

function listIndexedWindows(actorSystem: ActorSystemView): readonly IndexedWindow[] {
  return actorSystem.listActorsInTreeOrder()
    .map((actor, index) => ({
      actor,
      component: actor.getComponent(floatingWindowComponentType),
      index
    }))
    .filter((entry): entry is IndexedWindow => {
      if (!entry.component) return false;
      return entry.component.menuDescriptor.include;
    });
}

function toWindowControlItem(actorSystem: ActorSystemView, entry: IndexedWindow): WindowControlItem {
  const { actor, component } = entry;
  const descriptor = component.menuDescriptor;
  return {
    actor,
    viewKey: descriptor.viewKey ?? windowViewKey(actor.id),
    actorId: actor.id,
    componentId: component.id,
    label: descriptor.label,
    order: descriptor.order,
    group: descriptor.group,
    visible: component.state.visible,
    activeSelf: actor.enabled,
    activeInHierarchy: actorSystem.isActorActive(actor),
    activationMode: descriptor.activationMode,
    canToggle: descriptor.activationMode === "visible",
    visiblePath: component.visiblePath
  };
}

function compareIndexedWindows(a: IndexedWindow, b: IndexedWindow): number {
  const orderDelta = a.component.menuDescriptor.order - b.component.menuDescriptor.order;
  if (orderDelta !== 0) return orderDelta;
  return a.index - b.index;
}
