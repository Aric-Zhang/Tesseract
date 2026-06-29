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
  #documentOutsideCloseEnabled = true;
  #open = false;
  #highlightedItemActorId: string | null = null;
  #openSubmenuItemActorId: string | null = null;
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

  setDocumentOutsideCloseEnabled(enabled: boolean): void {
    this.#documentOutsideCloseEnabled = enabled;
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
    } else {
      this.syncOpenSubmenu();
    }
  }

  refreshItems(): void {
    const items = this.listItems();
    const itemActorIds = new Set(items.map((item) => item.actor.id));
    for (const { actor, item } of items) {
      this.element.append(item.element);
      const submenu = this.findSubmenuPopupForItem(actor);
      if (submenu) {
        submenu.setRequestCloseMenu(() => this.requestClose());
        submenu.setDocumentOutsideCloseEnabled(false);
        item.element.append(submenu.element);
      }
    }
    if (this.#highlightedItemActorId && !itemActorIds.has(this.#highlightedItemActorId)) {
      this.setHighlightedItemActorId(null);
    } else {
      this.applyHighlight();
    }
    if (this.#openSubmenuItemActorId && !itemActorIds.has(this.#openSubmenuItemActorId)) {
      this.setOpenSubmenuItemActorId(null);
    } else {
      this.syncOpenSubmenu();
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
    if (entry.item.itemRole === "submenu") {
      this.setHighlightedItemActorId(entry.actor.id);
      this.setOpenSubmenuItemActorId(entry.actor.id);
      return;
    }
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
    const entry = actorId
      ? this.listItems().find((candidate) => candidate.actor.id === actorId)
      : null;
    if (entry?.item.itemRole === "submenu") {
      this.setOpenSubmenuItemActorId(entry.actor.id);
    } else if (!this.isActorInsideOpenSubmenu(actorId)) {
      this.setOpenSubmenuItemActorId(null);
    }
  }

  private applyHighlight(): void {
    for (const { actor, item } of this.listItems()) {
      item.setHighlighted(this.#open && actor.id === this.#highlightedItemActorId);
    }
    this.element.dataset.uiMenuHighlightedItemActorId = this.#highlightedItemActorId ?? "";
  }

  private setOpenSubmenuItemActorId(actorId: string | null): void {
    this.#openSubmenuItemActorId = actorId;
    this.syncOpenSubmenu();
  }

  private syncOpenSubmenu(): void {
    for (const { actor, item } of this.listItems()) {
      const submenu = this.findSubmenuPopupForItem(actor);
      const open = this.#open && actor.id === this.#openSubmenuItemActorId && item.itemRole === "submenu";
      item.setSubmenuOpen(open);
      submenu?.setOpen(open);
      if (open && submenu) {
        positionSubmenuPopup(item.element, submenu.element);
      }
    }
    this.element.dataset.uiMenuOpenSubmenuItemActorId = this.#openSubmenuItemActorId ?? "";
  }

  private findSubmenuPopupForItem(itemActor: Actor): PopupMenuComponent<TPayload> | null {
    for (const child of this.#actorSystem.listChildren(itemActor)) {
      const popup = this.#componentRegistry.getComponent(child, popupMenuComponentType) as
        PopupMenuComponent<TPayload> | null;
      if (popup?.enabled) return popup;
    }
    return null;
  }

  private isActorInsideOpenSubmenu(actorId: string | null): boolean {
    if (!actorId || !this.#openSubmenuItemActorId) return false;
    const openEntry = this.listItems().find((entry) => entry.actor.id === this.#openSubmenuItemActorId);
    if (!openEntry) return false;
    const submenu = this.findSubmenuPopupForItem(openEntry.actor);
    if (!submenu) return false;
    return submenu.listItems().some((entry) => entry.actor.id === actorId);
  }

  private isTargetInsideMenuChain(target: EventTarget | null): boolean {
    if (isNodeInsideElement(target, this.element)) return true;
    for (const { actor } of this.listItems()) {
      const submenu = this.findSubmenuPopupForItem(actor);
      if (submenu?.open && submenu.isTargetInsideMenuChain(target)) return true;
    }
    return false;
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
    if (!this.#open || this.#disposed || !this.#documentOutsideCloseEnabled) return;
    if (this.isTargetInsideMenuChain(event.target)) return;
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
  if (!target) return false;
  if (
    typeof Node !== "undefined" &&
    target instanceof Node &&
    element.contains(target)
  ) {
    return true;
  }
  let current = target as { readonly parentElement?: unknown } | null;
  while (current) {
    if (current === element) return true;
    const parent = current.parentElement;
    current = typeof parent === "object" && parent !== null
      ? parent as { readonly parentElement?: unknown }
      : null;
  }
  return false;
}

function positionSubmenuPopup(itemElement: HTMLElement, popupElement: HTMLElement): void {
  const itemRect = itemElement.getBoundingClientRect();
  const popupRect = popupElement.getBoundingClientRect();
  const viewport = readViewportSize(itemElement.ownerDocument);
  const offset = 4;
  const wouldOverflowRight = itemRect.right + offset + popupRect.width > viewport.width;
  const fitsLeft = itemRect.left - offset - popupRect.width >= 0;
  if (wouldOverflowRight && fitsLeft) {
    popupElement.style.left = "auto";
    popupElement.style.right = `calc(100% + ${offset}px)`;
  } else {
    popupElement.style.left = `calc(100% + ${offset}px)`;
    popupElement.style.right = "auto";
  }

  const wouldOverflowBottom = itemRect.top + popupRect.height > viewport.height - offset;
  const top = wouldOverflowBottom
    ? Math.max(offset - itemRect.top, viewport.height - popupRect.height - itemRect.top - offset)
    : 0;
  popupElement.style.top = `${top}px`;
}

function readViewportSize(documentRef: Document): { readonly width: number; readonly height: number } {
  const documentWithView = documentRef as Document & {
    readonly defaultView?: Pick<Window, "innerWidth" | "innerHeight"> | null;
  };
  return {
    width: documentWithView.defaultView?.innerWidth
      ?? documentRef.documentElement?.clientWidth
      ?? Number.POSITIVE_INFINITY,
    height: documentWithView.defaultView?.innerHeight
      ?? documentRef.documentElement?.clientHeight
      ?? Number.POSITIVE_INFINITY
  };
}
