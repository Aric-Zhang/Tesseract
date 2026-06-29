import type { Actor, Component, ComponentType } from "actor-system/core";
import type { UiElementComponent } from "../element";
import {
  normalizeMenuBarItemDescriptor,
  type MenuBarItemDescriptor
} from "./menu-model";

export const menuBarItemComponentType =
  "ui-menu-bar-item-component" as ComponentType<MenuBarItemComponent>;

export interface MenuBarItemComponentOptions {
  readonly id?: string;
  readonly descriptor: MenuBarItemDescriptor;
}

export class MenuBarItemComponent implements Component {
  readonly type = menuBarItemComponentType;
  readonly actor: Actor;
  readonly id: string;
  readonly element: HTMLElement;
  enabled = true;

  #descriptor: Required<MenuBarItemDescriptor>;
  #open = false;
  #disposed = false;

  constructor(
    actor: Actor,
    uiElement: UiElementComponent,
    options: MenuBarItemComponentOptions
  ) {
    this.actor = actor;
    this.id = options.id ?? "ui-menu-bar-item";
    this.element = uiElement.element;
    this.#descriptor = normalizeMenuBarItemDescriptor(options.descriptor);
    this.applyDescriptor();
  }

  get itemId(): string {
    return this.#descriptor.id;
  }

  get itemEnabled(): boolean {
    return this.enabled && this.#descriptor.enabled;
  }

  get descriptor(): MenuBarItemDescriptor {
    return { ...this.#descriptor };
  }

  setDescriptor(descriptor: MenuBarItemDescriptor): void {
    if (this.#disposed) return;
    this.#descriptor = normalizeMenuBarItemDescriptor(descriptor);
    if (!this.itemEnabled) {
      this.setOpen(false);
    }
    this.applyDescriptor();
  }

  setOpen(open: boolean): void {
    if (this.#disposed) return;
    this.#open = open && this.itemEnabled;
    this.element.dataset.uiMenuOpen = String(this.#open);
    this.element.setAttribute("aria-expanded", String(this.#open));
  }

  dispose(): void {
    this.#disposed = true;
    this.enabled = false;
  }

  private applyDescriptor(): void {
    this.element.className = "ui-menu-bar-item";
    this.element.dataset.uiMenuRole = "menubaritem";
    this.element.dataset.uiMenuItemId = this.#descriptor.id;
    this.element.dataset.uiMenuItemEnabled = String(this.#descriptor.enabled);
    this.element.textContent = this.#descriptor.label;
    this.element.setAttribute("role", "menuitem");
    this.element.setAttribute("aria-haspopup", "menu");
    this.element.setAttribute("aria-disabled", String(!this.#descriptor.enabled));
    this.element.setAttribute("aria-expanded", String(this.#open));
    if (isButtonElement(this.element)) {
      this.element.type = "button";
      this.element.disabled = !this.#descriptor.enabled;
    }
  }
}

function isButtonElement(element: HTMLElement): element is HTMLButtonElement {
  return typeof HTMLButtonElement !== "undefined"
    ? element instanceof HTMLButtonElement
    : element.tagName.toLowerCase() === "button";
}
