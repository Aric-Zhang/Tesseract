import type { Actor, Component, ComponentType } from "actor-core";
import type {
  TreeViewItemDescriptor,
  TreeViewItemUpdate
} from "./collection-types";

export const treeViewItemComponentType =
  "ui-tree-view-item-component" as ComponentType<TreeViewItemComponent>;

export interface TreeViewItemComponentOptions {
  readonly id?: string;
  readonly descriptor: TreeViewItemDescriptor;
}

export class TreeViewItemComponent implements Component {
  readonly type = treeViewItemComponentType;
  readonly actor: Actor;
  readonly id: string;
  enabled = true;

  #descriptor: TreeViewItemDescriptor;
  #disposed = false;

  constructor(actor: Actor, options: TreeViewItemComponentOptions) {
    this.actor = actor;
    this.id = options.id ?? "ui-tree-view-item";
    this.#descriptor = normalizeDescriptor(options.descriptor);
  }

  get descriptor(): TreeViewItemDescriptor {
    return cloneDescriptor(this.#descriptor);
  }

  setDescriptor(update: TreeViewItemUpdate): void {
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

function normalizeDescriptor(descriptor: TreeViewItemDescriptor): TreeViewItemDescriptor {
  const itemId = normalizeNonEmptyString(descriptor.itemId, "itemId");
  const label = normalizeNonEmptyString(descriptor.label, "label");
  const parentItemId = normalizeOptionalParentId(descriptor.parentItemId);
  const order = normalizeOptionalOrder(descriptor.order);
  return Object.freeze({
    itemId,
    label,
    ...(parentItemId === undefined ? {} : { parentItemId }),
    ...(order === undefined ? {} : { order }),
    ...(descriptor.selected === undefined ? {} : { selected: Boolean(descriptor.selected) }),
    ...(descriptor.enabled === undefined ? {} : { enabled: Boolean(descriptor.enabled) }),
    ...(descriptor.muted === undefined ? {} : { muted: Boolean(descriptor.muted) })
  });
}

function cloneDescriptor(descriptor: TreeViewItemDescriptor): TreeViewItemDescriptor {
  return normalizeDescriptor(descriptor);
}

function normalizeNonEmptyString(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`TreeViewItemComponent descriptor.${fieldName} must be a non-empty string.`);
  }
  return value;
}

function normalizeOptionalParentId(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string" || value.length === 0) {
    throw new Error("TreeViewItemComponent descriptor.parentItemId must be a non-empty string or null.");
  }
  return value;
}

function normalizeOptionalOrder(value: unknown): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error("TreeViewItemComponent descriptor.order must be a finite number.");
  }
  return value;
}
