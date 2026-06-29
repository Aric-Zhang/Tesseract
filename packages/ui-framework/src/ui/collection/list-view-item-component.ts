import type { Actor, Component, ComponentType } from "actor-system/core";
import type {
  ListViewItemDescriptor,
  ListViewItemUpdate
} from "./collection-types";

export const listViewItemComponentType =
  "ui-list-view-item-component" as ComponentType<ListViewItemComponent>;

export interface ListViewItemComponentOptions {
  readonly id?: string;
  readonly descriptor: ListViewItemDescriptor;
}

export class ListViewItemComponent implements Component {
  readonly type = listViewItemComponentType;
  readonly actor: Actor;
  readonly id: string;
  enabled = true;

  #descriptor: ListViewItemDescriptor;
  #disposed = false;

  constructor(actor: Actor, options: ListViewItemComponentOptions) {
    this.actor = actor;
    this.id = options.id ?? "ui-list-view-item";
    this.#descriptor = normalizeDescriptor(options.descriptor);
  }

  get descriptor(): ListViewItemDescriptor {
    return cloneDescriptor(this.#descriptor);
  }

  setDescriptor(update: ListViewItemUpdate): void {
    if (this.#disposed) return;
    this.#descriptor = normalizeDescriptor({
      ...this.#descriptor,
      ...update
    });
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.enabled = false;
  }
}

function normalizeDescriptor(descriptor: ListViewItemDescriptor): ListViewItemDescriptor {
  const itemId = normalizeNonEmptyString(descriptor.itemId, "itemId");
  const text = normalizeText(descriptor.text);
  const order = normalizeOptionalOrder(descriptor.order);
  return Object.freeze({
    itemId,
    text,
    ...(order === undefined ? {} : { order }),
    ...(descriptor.selected === undefined ? {} : { selected: Boolean(descriptor.selected) }),
    ...(descriptor.enabled === undefined ? {} : { enabled: Boolean(descriptor.enabled) }),
    ...(descriptor.muted === undefined ? {} : { muted: Boolean(descriptor.muted) })
  });
}

function cloneDescriptor(descriptor: ListViewItemDescriptor): ListViewItemDescriptor {
  return normalizeDescriptor(descriptor);
}

function normalizeNonEmptyString(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`ListViewItemComponent descriptor.${fieldName} must be a non-empty string.`);
  }
  return value;
}

function normalizeText(value: unknown): string {
  if (typeof value !== "string") {
    throw new Error("ListViewItemComponent descriptor.text must be a string.");
  }
  return value;
}

function normalizeOptionalOrder(value: unknown): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error("ListViewItemComponent descriptor.order must be a finite number.");
  }
  return value;
}
