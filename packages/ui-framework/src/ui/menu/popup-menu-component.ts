import type { ScreenPoint } from "gizmo-core";
import type {
  Actor,
  ActorSystemView,
  Component,
  ComponentRegistryView,
  ComponentType
} from "actor-core";
import {
  type ActorInputEndEvent,
  type ActorInputHit,
  type ActorInputParticipant
} from "actor-input";
import type { UiElementComponent } from "../element";
import {
  MenuItemComponent,
  menuItemComponentType
} from "./menu-item-component";
import type { MenuCommandSink } from "./menu-model";
import { isElementExposedAtPoint } from "./menu-dom-hit";

export const popupMenuComponentType =
  "ui-popup-menu-component" as ComponentType<PopupMenuComponent>;

export interface PopupMenuComponentOptions<TPayload = unknown> {
  readonly id?: string;
  readonly commandSink?: MenuCommandSink<TPayload>;
  readonly inputStackPriority?: number;
  readonly localRoutePriority?: number;
}

interface PopupMenuDependencies {
  readonly actorSystem: ActorSystemView;
  readonly componentRegistry: ComponentRegistryView;
}

export class PopupMenuComponent<TPayload = unknown>
implements Component, ActorInputParticipant {
  readonly type = popupMenuComponentType;
  readonly actor: Actor;
  readonly id: string;
  readonly element: HTMLElement;
  readonly inputStackPriority?: number;
  readonly inputPriority?: number;
  enabled = true;

  readonly #actorSystem: ActorSystemView;
  readonly #componentRegistry: ComponentRegistryView;
  readonly #commandSink?: MenuCommandSink<TPayload>;
  readonly #localRoutePriority: number;
  #requestCloseMenu: (() => void) | null = null;
  #open = false;
  #highlightedItemActorId: string | null = null;
  #disposed = false;

  constructor(
    actor: Actor,
    uiElement: UiElementComponent,
    dependencies: PopupMenuDependencies,
    options: PopupMenuComponentOptions<TPayload> = {}
  ) {
    this.actor = actor;
    this.id = options.id ?? "ui-popup-menu";
    this.element = uiElement.element;
    this.#actorSystem = dependencies.actorSystem;
    this.#componentRegistry = dependencies.componentRegistry;
    this.#commandSink = options.commandSink;
    this.inputStackPriority = options.inputStackPriority;
    this.inputPriority = options.inputStackPriority;
    this.#localRoutePriority = options.localRoutePriority ?? 0;
    this.element.className = "ui-popup-menu";
    this.element.dataset.uiMenuRole = "popup";
    this.element.setAttribute("role", "menu");
    this.element.addEventListener?.("pointermove", this.handlePointerMove);
    this.element.ownerDocument?.addEventListener?.("keydown", this.handleDocumentKeyDown);
    this.element.ownerDocument?.addEventListener?.("pointerdown", this.handleDocumentPointerDown);
    this.setOpen(false);
  }

  get open(): boolean {
    return this.#open;
  }

  get highlightedItemActorId(): string | null {
    return this.#highlightedItemActorId;
  }

  setRequestCloseMenu(handler: (() => void) | null): void {
    this.#requestCloseMenu = handler;
  }

  setOpen(open: boolean, options: { readonly activateFirstItem?: boolean } = {}): void {
    if (this.#disposed) return;
    this.#open = open && this.enabled;
    this.element.hidden = !this.#open;
    this.element.dataset.uiMenuOpen = String(this.#open);
    if (!this.#open) {
      this.setHighlightedItemActorId(null);
      return;
    }
    this.refreshItems();
    if (options.activateFirstItem) {
      this.setHighlightedItemActorId(this.listEnabledItems()[0]?.actor.id ?? null);
    }
  }

  refreshItems(): void {
    const items = this.listItems();
    const itemActorIds = new Set(items.map((item) => item.actor.id));
    for (const { item } of items) {
      this.element.append(item.element);
    }
    if (this.#highlightedItemActorId && !itemActorIds.has(this.#highlightedItemActorId)) {
      this.setHighlightedItemActorId(null);
    } else {
      this.applyHighlight();
    }
  }

  selectNext(delta: 1 | -1): void {
    if (!this.#open) return;
    const items = this.listEnabledItems();
    if (items.length === 0) {
      this.setHighlightedItemActorId(null);
      return;
    }
    const currentIndex = items.findIndex((entry) => entry.actor.id === this.#highlightedItemActorId);
    const nextIndex = currentIndex < 0
      ? 0
      : (currentIndex + delta + items.length) % items.length;
    this.setHighlightedItemActorId(items[nextIndex]?.actor.id ?? null);
  }

  activateHighlighted(): void {
    if (!this.#highlightedItemActorId) return;
    this.activateItemActorId(this.#highlightedItemActorId);
  }

  hitTestInput(point: ScreenPoint): ActorInputHit | null {
    if (!this.enabled || !this.#open || this.element.hidden) return null;
    for (const { actor, item } of this.listItems()) {
      if (!isPointInsideRect(point, item.element.getBoundingClientRect())) continue;
      if (!isElementExposedAtPoint(item.element, point)) continue;
      this.setHighlightedItemActorId(item.itemEnabled ? actor.id : null);
      return this.createHit("menu-item", 100, {
        itemActorId: actor.id,
        itemId: item.itemId
      });
    }
    if (
      isPointInsideRect(point, this.element.getBoundingClientRect()) &&
      isElementExposedAtPoint(this.element, point)
    ) {
      return this.createHit("menu-surface", 80);
    }
    return null;
  }

  onInputEnd(event: ActorInputEndEvent): void {
    if (!event.wasClick) return;
    if (event.hit.partId !== "menu-item") return;
    const itemActorId = readItemActorId(event.hit.data);
    if (!itemActorId) return;
    this.activateItemActorId(itemActorId);
  }

  dispose(): void {
    this.#disposed = true;
    this.enabled = false;
    this.element.removeEventListener?.("pointermove", this.handlePointerMove);
    this.element.ownerDocument?.removeEventListener?.("keydown", this.handleDocumentKeyDown);
    this.element.ownerDocument?.removeEventListener?.("pointerdown", this.handleDocumentPointerDown);
    this.setHighlightedItemActorId(null);
  }

  private listItems(): ReadonlyArray<{ readonly actor: Actor; readonly item: MenuItemComponent<TPayload> }> {
    return this.#actorSystem.listChildren(this.actor)
      .map((actor) => {
        if (!this.#actorSystem.isActorActive(actor)) return null;
        const item = this.#componentRegistry.getComponent(actor, menuItemComponentType) as
          MenuItemComponent<TPayload> | null;
        if (!item?.enabled) return null;
        return { actor, item };
      })
      .filter((entry): entry is { readonly actor: Actor; readonly item: MenuItemComponent<TPayload> } => (
        entry !== null
      ));
  }

  private listEnabledItems(): ReadonlyArray<{ readonly actor: Actor; readonly item: MenuItemComponent<TPayload> }> {
    return this.listItems().filter(({ item }) => item.itemEnabled);
  }

  private activateItemActorId(itemActorId: string): void {
    const entry = this.listItems().find((candidate) => candidate.actor.id === itemActorId);
    if (!entry?.item.itemEnabled) return;
    this.#commandSink?.activateMenuItem({
      itemActorId: entry.actor.id,
      itemId: entry.item.itemId,
      payload: entry.item.payload
    });
    this.requestClose();
  }

  private requestClose(): void {
    if (this.#requestCloseMenu) {
      this.#requestCloseMenu();
      return;
    }
    this.setOpen(false);
  }

  private setHighlightedItemActorId(actorId: string | null): void {
    this.#highlightedItemActorId = actorId;
    this.applyHighlight();
  }

  private applyHighlight(): void {
    for (const { actor, item } of this.listItems()) {
      item.setHighlighted(this.#open && actor.id === this.#highlightedItemActorId);
    }
    this.element.dataset.uiMenuHighlightedItemActorId = this.#highlightedItemActorId ?? "";
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
        role: partId === "menu-item" ? "control" : "container",
        partId
      }],
      data
    };
  }

  private readonly handlePointerMove = (event: PointerEvent): void => {
    if (!this.#open || this.#disposed) return;
    const entry = this.findItemForTarget(event.target);
    this.setHighlightedItemActorId(entry?.item.itemEnabled ? entry.actor.id : null);
  };

  private readonly handleDocumentKeyDown = (event: KeyboardEvent): void => {
    if (!this.#open || this.#disposed) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      this.selectNext(1);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      this.selectNext(-1);
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      this.activateHighlighted();
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      this.requestClose();
    }
  };

  private readonly handleDocumentPointerDown = (event: PointerEvent): void => {
    if (!this.#open || this.#disposed) return;
    if (isNodeInsideElement(event.target, this.element)) return;
    this.requestClose();
  };

  private findItemForTarget(
    target: EventTarget | null
  ): { readonly actor: Actor; readonly item: MenuItemComponent<TPayload> } | null {
    if (!target) return null;
    return this.listItems().find(({ item }) => isNodeInsideElement(target, item.element)) ?? null;
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

function isNodeInsideElement(target: EventTarget | null, element: HTMLElement): boolean {
  return typeof Node !== "undefined" &&
    target instanceof Node &&
    element.contains(target);
}
