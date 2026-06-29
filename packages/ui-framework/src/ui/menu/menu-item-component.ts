import type { Actor, Component, ComponentType } from "actor-system/core";
import type { UiElementComponent } from "../element";
import {
  normalizeMenuItemDescriptor,
  type MenuItemDescriptor,
  type MenuLeadingAccessory
} from "./menu-model";

export const menuItemComponentType =
  "ui-menu-item-component" as ComponentType<MenuItemComponent>;

export interface MenuItemComponentOptions<TPayload = unknown> {
  readonly id?: string;
  readonly descriptor: MenuItemDescriptor<TPayload>;
}

export class MenuItemComponent<TPayload = unknown> implements Component {
  readonly type = menuItemComponentType;
  readonly actor: Actor;
  readonly id: string;
  readonly element: HTMLElement;
  enabled = true;

  #descriptor: ReturnType<typeof normalizeMenuItemDescriptor<TPayload>>;
  #highlighted = false;
  #submenuOpen = false;
  #disposed = false;

  constructor(
    actor: Actor,
    uiElement: UiElementComponent,
    options: MenuItemComponentOptions<TPayload>
  ) {
    this.actor = actor;
    this.id = options.id ?? "ui-menu-item";
    this.element = uiElement.element;
    this.#descriptor = normalizeMenuItemDescriptor(options.descriptor);
    this.applyDescriptor();
  }

  get descriptor(): MenuItemDescriptor<TPayload> {
    return { ...this.#descriptor };
  }

  get highlighted(): boolean {
    return this.#highlighted;
  }

  get payload(): TPayload | undefined {
    return this.#descriptor.payload;
  }

  get itemId(): string {
    return this.#descriptor.id;
  }

  get itemEnabled(): boolean {
    return this.enabled && this.#descriptor.enabled && this.#descriptor.role !== "separator";
  }

  get itemRole(): ReturnType<typeof normalizeMenuItemDescriptor<TPayload>>["role"] {
    return this.#descriptor.role;
  }

  setDescriptor(descriptor: MenuItemDescriptor<TPayload>): void {
    if (this.#disposed) return;
    this.#descriptor = normalizeMenuItemDescriptor(descriptor);
    if (!this.itemEnabled) {
      this.setHighlighted(false);
    }
    this.applyDescriptor();
  }

  setHighlighted(highlighted: boolean): void {
    if (this.#disposed) return;
    this.#highlighted = highlighted && this.itemEnabled;
    this.element.dataset.uiMenuHighlighted = String(this.#highlighted);
  }

  setSubmenuOpen(open: boolean): void {
    if (this.#disposed) return;
    this.#submenuOpen = open && this.itemEnabled && this.#descriptor.role === "submenu";
    if (this.#descriptor.role === "submenu") {
      this.element.dataset.uiMenuSubmenuOpen = String(this.#submenuOpen);
      this.element.setAttribute("aria-expanded", String(this.#submenuOpen));
    } else {
      delete this.element.dataset.uiMenuSubmenuOpen;
      this.element.removeAttribute("aria-expanded");
    }
  }

  dispose(): void {
    this.#disposed = true;
    this.enabled = false;
  }

  private applyDescriptor(): void {
    const descriptor = this.#descriptor;
    this.element.className = "ui-menu-item";
    this.element.dataset.uiMenuRole = "menuitem";
    this.element.dataset.uiMenuItemId = descriptor.id;
    this.element.dataset.uiMenuItemEnabled = String(descriptor.enabled);
    this.element.dataset.uiMenuItemRole = descriptor.role;
    this.element.dataset.uiMenuHighlighted = String(this.#highlighted);
    this.element.setAttribute("role", descriptor.role === "checkbox" ? "menuitemcheckbox" : "menuitem");
    this.element.setAttribute("aria-disabled", String(!descriptor.enabled));
    if (descriptor.role === "checkbox") {
      this.element.setAttribute("aria-checked", String(descriptor.checked));
    } else {
      this.element.removeAttribute("aria-checked");
    }
    if (descriptor.role === "submenu") {
      this.element.setAttribute("aria-haspopup", "menu");
      this.element.setAttribute("aria-expanded", String(this.#submenuOpen));
      this.element.dataset.uiMenuSubmenuOpen = String(this.#submenuOpen);
    } else {
      this.element.removeAttribute("aria-haspopup");
      this.element.removeAttribute("aria-expanded");
      delete this.element.dataset.uiMenuSubmenuOpen;
      this.#submenuOpen = false;
    }
    if (isButtonElement(this.element)) {
      this.element.type = "button";
      this.element.disabled = !descriptor.enabled;
    }
    this.element.replaceChildren(
      createLeadingElement(this.element.ownerDocument, descriptor.leading, descriptor.checked),
      createTextElement(this.element.ownerDocument, "ui-menu-item__label", descriptor.label),
      createTextElement(
        this.element.ownerDocument,
        "ui-menu-item__shortcut",
        descriptor.role === "submenu" ? ">" : descriptor.shortcutLabel ?? ""
      )
    );
  }
}

function isButtonElement(element: HTMLElement): element is HTMLButtonElement {
  return typeof HTMLButtonElement !== "undefined"
    ? element instanceof HTMLButtonElement
    : element.tagName.toLowerCase() === "button";
}

function createLeadingElement(
  documentRef: Document,
  accessory: MenuLeadingAccessory,
  checked: boolean
): HTMLElement {
  const leading = documentRef.createElement("span");
  leading.className = "ui-menu-item__leading";
  leading.setAttribute("aria-hidden", "true");
  if (accessory.kind === "checkbox") {
    const checkbox = documentRef.createElement("span");
    checkbox.className = checked ? "ui-menu-item__checkbox is-checked" : "ui-menu-item__checkbox";
    leading.append(checkbox);
  } else if (accessory.kind === "icon") {
    const icon = documentRef.createElement("span");
    icon.className = "ui-menu-item__icon";
    icon.dataset.uiMenuIcon = accessory.name;
    leading.append(icon);
  }
  return leading;
}

function createTextElement(documentRef: Document, className: string, text: string): HTMLElement {
  const element = documentRef.createElement("span");
  element.className = className;
  element.textContent = text;
  return element;
}
