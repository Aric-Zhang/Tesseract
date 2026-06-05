import type { Actor, ActorSystemView } from "../actor-runtime";
import {
  floatingWindowComponentType,
  type FloatingWindowComponent,
  type FloatingWindowActivationMode
} from "./floating-window-component";
import type { WindowViewKey } from "./window-view-key";

export interface WindowMenuViewItem {
  readonly actor: Actor;
  readonly actorId: string;
  readonly frameActor: Actor;
  readonly frameActorId: string;
  readonly viewActorId: string;
  readonly viewKey: WindowViewKey;
  readonly label: string;
  readonly order: number;
  readonly group: string | null;
  readonly activeTab: boolean;
  readonly activeSelf: boolean;
  readonly activeInHierarchy: boolean;
  readonly activationMode: FloatingWindowActivationMode;
  readonly canToggle: boolean;
}

export interface WindowMenuViewSource {
  listMenuViews(): readonly WindowMenuViewItem[];
  findMenuViewByViewKey(viewKey: WindowViewKey): WindowMenuViewItem | null;
}

export interface WindowMenuViewSourceOptions {
  readonly actorSystem: ActorSystemView;
}

interface IndexedFrame {
  readonly actor: Actor;
  readonly component: FloatingWindowComponent;
  readonly index: number;
}

export function createWindowMenuViewSource(options: WindowMenuViewSourceOptions): WindowMenuViewSource {
  return {
    listMenuViews() {
      return listIndexedFrames(options.actorSystem)
        .flatMap((entry) => toWindowMenuViewItems(options.actorSystem, entry))
        .sort(compareWindowMenuViewItems);
    },
    findMenuViewByViewKey(viewKey) {
      return this.listMenuViews().find((item) => item.viewKey === viewKey) ?? null;
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
    .filter((entry): entry is IndexedFrame => Boolean(entry.component?.menuDescriptor.include));
}

function toWindowMenuViewItems(actorSystem: ActorSystemView, entry: IndexedFrame): readonly WindowMenuViewItem[] {
  const { actor, component } = entry;
  const descriptor = component.menuDescriptor;
  const tabs = component.listTabs();
  const activeViewActorId = component.getActiveViewActorId();
  return tabs.map((tab, tabIndex) => ({
    actor,
    actorId: actor.id,
    frameActor: actor,
    frameActorId: actor.id,
    viewActorId: tab.viewActorId,
    viewKey: tab.viewKey,
    label: tab.title || descriptor.label,
    order: descriptor.order + tabIndex * 0.001,
    group: descriptor.group,
    activeTab: tab.viewActorId === activeViewActorId,
    activeSelf: actor.enabled,
    activeInHierarchy: actorSystem.isActorActive(actor),
    activationMode: descriptor.activationMode,
    canToggle: descriptor.activationMode === "visible"
  }));
}

function compareWindowMenuViewItems(a: WindowMenuViewItem, b: WindowMenuViewItem): number {
  const orderDelta = a.order - b.order;
  if (orderDelta !== 0) return orderDelta;
  return a.viewActorId.localeCompare(b.viewActorId);
}
