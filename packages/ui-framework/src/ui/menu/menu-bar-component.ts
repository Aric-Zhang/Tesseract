import type { ScreenPoint } from "actor-system/input";
import type {
  Actor,
  ActorSystemView,
  Component,
  ComponentRegistryView,
  ComponentType
} from "actor-system/core";
import {
  type ActorInputEndEvent,
  type ActorInputHit,
  type ActorInputParticipant
} from "actor-system/input";
import type { UiElementComponent } from "../element";
import {
  MenuBarItemComponent,
  menuBarItemComponentType
} from "./menu-bar-item-component";
import {
  PopupMenuComponent,
  popupMenuComponentType
} from "./popup-menu-component";
import { isElementExposedAtPoint } from "./menu-dom-hit";

export const menuBarComponentType =
  "ui-menu-bar-component" as ComponentType<MenuBarComponent>;

export interface MenuBarComponentOptions {
  readonly id?: string;
  readonly inputStackPriority?: number;
  readonly localRoutePriority?: number;
}

interface MenuBarDependencies {
  readonly actorSystem: ActorSystemView;
  readonly componentRegistry: ComponentRegistryView;
}

export class MenuBarComponent implements Component, ActorInputParticipant {
  readonly type = menuBarComponentType;
  readonly actor: Actor;
  readonly id: string;
  readonly element: HTMLElement;
  readonly inputStackPriority?: number;
  readonly inputPriority?: number;
  enabled = true;

  readonly #actorSystem: ActorSystemView;
  readonly #componentRegistry: ComponentRegistryView;
  readonly #localRoutePriority: number;
  #openItemActorId: string | null = null;
  #disposed = false;

  constructor(
    actor: Actor,
    uiElement: UiElementComponent,
    dependencies: MenuBarDependencies,
    options: MenuBarComponentOptions = {}
  ) {
    this.actor = actor;
    this.id = options.id ?? "ui-menu-bar";
    this.element = uiElement.element;
    this.#actorSystem = dependencies.actorSystem;
    this.#componentRegistry = dependencies.componentRegistry;
    this.inputStackPriority = options.inputStackPriority;
    this.inputPriority = options.inputStackPriority;
    this.#localRoutePriority = options.localRoutePriority ?? 0;
    this.element.className = "ui-menu-bar";
    this.element.dataset.uiMenuRole = "menubar";
    this.element.setAttribute("role", "menubar");
  }

  get openItemActorId(): string | null {
    return this.#openItemActorId;
  }

  refreshItems(): void {
    const items = this.listItems();
    const itemActorIds = new Set(items.map((entry) => entry.actor.id));
    for (const { actor, item } of items) {
      this.element.append(item.element);
      const popup = this.findPopupForItem(actor);
      if (popup) {
        popup.setRequestCloseMenu(() => this.closeOpenMenu());
        item.element.append(popup.element);
      }
    }
    if (this.#openItemActorId && !itemActorIds.has(this.#openItemActorId)) {
      this.closeOpenMenu();
    } else {
      this.applyOpenState();
    }
  }

  closeOpenMenu(): void {
    this.setOpenItemActorId(null);
  }

  hitTestInput(point: ScreenPoint): ActorInputHit | null {
    if (!this.enabled || this.#disposed || this.element.hidden) return null;
    this.refreshItems();
    for (const { actor, item } of this.listItems()) {
      if (!isPointInsideRect(point, item.element.getBoundingClientRect())) continue;
      if (!isElementExposedAtPoint(item.element, point)) continue;
      return this.createHit("menu-bar-item", 100, {
        itemActorId: actor.id,
        itemId: item.itemId
      });
    }
    if (
      isPointInsideRect(point, this.element.getBoundingClientRect()) &&
      isElementExposedAtPoint(this.element, point)
    ) {
      return this.createHit("menu-bar-surface", 80);
    }
    return null;
  }

  onInputEnd(event: ActorInputEndEvent): void {
    if (!event.wasClick || event.hit.partId !== "menu-bar-item") return;
    const itemActorId = readItemActorId(event.hit.data);
    if (!itemActorId) return;
    const item = this.listItems().find((entry) => entry.actor.id === itemActorId);
    if (!item?.item.itemEnabled) return;
    this.setOpenItemActorId(this.#openItemActorId === itemActorId ? null : itemActorId);
  }

  dispose(): void {
    this.#disposed = true;
    this.enabled = false;
    this.closeOpenMenu();
  }

  private listItems(): ReadonlyArray<{ readonly actor: Actor; readonly item: MenuBarItemComponent }> {
    return this.#actorSystem.listChildren(this.actor)
      .map((actor) => {
        if (!this.#actorSystem.isActorActive(actor)) return null;
        const item = this.#componentRegistry.getComponent(actor, menuBarItemComponentType);
        if (!item?.enabled) return null;
        return { actor, item };
      })
      .filter((entry): entry is { readonly actor: Actor; readonly item: MenuBarItemComponent } => entry !== null);
  }

  private setOpenItemActorId(actorId: string | null): void {
    this.#openItemActorId = actorId;
    this.applyOpenState();
  }

  private applyOpenState(): void {
    for (const { actor, item } of this.listItems()) {
      const open = actor.id === this.#openItemActorId;
      item.setOpen(open);
      this.findPopupForItem(actor)?.setOpen(open);
    }
    this.element.dataset.uiMenuOpenItemActorId = this.#openItemActorId ?? "";
  }

  private findPopupForItem(itemActor: Actor): PopupMenuComponent | null {
    for (const child of this.#actorSystem.listChildren(itemActor)) {
      const popup = this.#componentRegistry.getComponent(child, popupMenuComponentType);
      if (popup) return popup;
    }
    return null;
  }

  private createHit(partId: string, hitPriority: number, data?: unknown): ActorInputHit {
    return {
      componentId: this.id,
      partId,
      kind: "chrome",
      region: "actor-overlay",
      localRoutePriority: this.#localRoutePriority,
      hitPriority,
      path: [{
        componentId: this.id,
        role: partId === "menu-bar-item" ? "control" : "container",
        partId
      }],
      data
    };
  }
}

function readItemActorId(data: unknown): string | null {
  if (typeof data !== "object" || data === null || !("itemActorId" in data)) return null;
  const value = (data as { readonly itemActorId?: unknown }).itemActorId;
  return typeof value === "string" ? value : null;
}

function isPointInsideRect(point: ScreenPoint, rect: DOMRectReadOnly): boolean {
  return point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom;
}
