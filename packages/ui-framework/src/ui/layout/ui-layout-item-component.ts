import type { Actor, Component, ComponentType } from "actor-system/core";
import type { UiElementComponent } from "../element";
import type {
  UiLayoutItemComponentOptions,
  UiLayoutItemDescriptor,
  UiLayoutItemUpdate,
  UiLayoutSize,
  UiLayoutSlot,
  UiLayoutStretch
} from "./ui-layout-types";

export const uiLayoutItemComponentType =
  "ui-layout-item-component" as ComponentType<UiLayoutItemComponent>;

const uiLayoutSlots = new Set<UiLayoutSlot>([
  "top",
  "bottom",
  "left",
  "right",
  "fill",
  "overlay"
]);

const uiLayoutStretches = new Set<UiLayoutStretch>([
  "none",
  "horizontal",
  "vertical",
  "both"
]);

export class UiLayoutItemComponent implements Component {
  readonly type = uiLayoutItemComponentType;
  readonly actor: Actor;
  readonly id: string;
  readonly element: HTMLElement;
  enabled = true;

  #descriptor: UiLayoutItemDescriptor;
  #disposed = false;

  constructor(
    actor: Actor,
    uiElement: UiElementComponent,
    options: UiLayoutItemComponentOptions = {}
  ) {
    this.actor = actor;
    this.id = options.id ?? "ui-layout-item";
    this.element = uiElement.element;
    this.#descriptor = normalizeDescriptor(options);
  }

  get descriptor(): UiLayoutItemDescriptor {
    return cloneDescriptor(this.#descriptor);
  }

  setLayout(update: UiLayoutItemUpdate): void {
    if (this.#disposed) return;
    this.#descriptor = mergeDescriptor(this.#descriptor, update);
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.enabled = false;
  }
}

function normalizeDescriptor(options: UiLayoutItemComponentOptions): UiLayoutItemDescriptor {
  return freezeDescriptor({
    slot: normalizeSlot(optionOrDefault(options, "slot", "fill")),
    order: normalizeFiniteNumber(optionOrDefault(options, "order", 0), "order"),
    layer: normalizeFiniteNumber(optionOrDefault(options, "layer", 0), "layer"),
    stretch: normalizeStretch(optionOrDefault(options, "stretch", "both")),
    ...optionalSizeDescriptor("minSize", normalizeInitialSize(options.minSize, "minSize")),
    ...optionalSizeDescriptor("preferredSize", normalizeInitialSize(options.preferredSize, "preferredSize"))
  });
}

function mergeDescriptor(
  current: UiLayoutItemDescriptor,
  update: UiLayoutItemUpdate
): UiLayoutItemDescriptor {
  const minSize = Object.hasOwn(update, "minSize")
    ? normalizeUpdateSize(update.minSize, current.minSize, "minSize")
    : cloneSize(current.minSize);
  const preferredSize = Object.hasOwn(update, "preferredSize")
    ? normalizeUpdateSize(update.preferredSize, current.preferredSize, "preferredSize")
    : cloneSize(current.preferredSize);

  return freezeDescriptor({
    slot: normalizeSlot(updateOrCurrent(update, "slot", current.slot)),
    order: normalizeFiniteNumber(updateOrCurrent(update, "order", current.order), "order"),
    layer: normalizeFiniteNumber(updateOrCurrent(update, "layer", current.layer), "layer"),
    stretch: normalizeStretch(updateOrCurrent(update, "stretch", current.stretch)),
    ...optionalSizeDescriptor("minSize", minSize),
    ...optionalSizeDescriptor("preferredSize", preferredSize)
  });
}

function optionOrDefault(
  options: UiLayoutItemComponentOptions,
  key: "slot" | "order" | "layer" | "stretch",
  defaultValue: unknown
): unknown {
  const value = options[key];
  return Object.hasOwn(options, key) && value !== undefined ? value : defaultValue;
}

function updateOrCurrent(
  update: UiLayoutItemUpdate,
  key: "slot" | "order" | "layer" | "stretch",
  currentValue: unknown
): unknown {
  const value = update[key];
  return Object.hasOwn(update, key) && value !== undefined ? value : currentValue;
}

function normalizeSlot(slot: unknown): UiLayoutSlot {
  if (typeof slot !== "string" || !uiLayoutSlots.has(slot as UiLayoutSlot)) {
    throw new Error(`Invalid UI layout slot: ${String(slot)}`);
  }
  return slot as UiLayoutSlot;
}

function normalizeStretch(stretch: unknown): UiLayoutStretch {
  if (typeof stretch !== "string" || !uiLayoutStretches.has(stretch as UiLayoutStretch)) {
    throw new Error(`Invalid UI layout stretch: ${String(stretch)}`);
  }
  return stretch as UiLayoutStretch;
}

function normalizeFiniteNumber(value: unknown, fieldName: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`UiLayoutItemComponent ${fieldName} must be a finite number.`);
  }
  return value;
}

function normalizeInitialSize(
  size: UiLayoutSize | null | undefined,
  fieldName: string
): UiLayoutSize | undefined {
  if (size == null) return undefined;
  return normalizeSize(size, fieldName);
}

function normalizeUpdateSize(
  nextSize: UiLayoutSize | null | undefined,
  currentSize: UiLayoutSize | undefined,
  fieldName: string
): UiLayoutSize | undefined {
  if (nextSize === undefined) return cloneSize(currentSize);
  if (nextSize === null) return undefined;
  return normalizeSize(nextSize, fieldName);
}

function normalizeSize(size: UiLayoutSize, fieldName: string): UiLayoutSize | undefined {
  const width = normalizeOptionalDimension(size.width, `${fieldName}.width`);
  const height = normalizeOptionalDimension(size.height, `${fieldName}.height`);
  if (width === undefined && height === undefined) return undefined;
  return freezeSize({
    ...optionalDimension("width", width),
    ...optionalDimension("height", height)
  });
}

function normalizeOptionalDimension(value: unknown, fieldName: string): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error(`UiLayoutItemComponent ${fieldName} must be a finite non-negative number.`);
  }
  return value;
}

function optionalSizeDescriptor(
  key: "minSize" | "preferredSize",
  size: UiLayoutSize | undefined
): Pick<UiLayoutItemDescriptor, "minSize" | "preferredSize"> {
  return size ? { [key]: size } : {};
}

function optionalDimension(
  key: "width" | "height",
  value: number | undefined
): Pick<UiLayoutSize, "width" | "height"> {
  return value === undefined ? {} : { [key]: value };
}

function cloneDescriptor(descriptor: UiLayoutItemDescriptor): UiLayoutItemDescriptor {
  return freezeDescriptor({
    slot: descriptor.slot,
    order: descriptor.order,
    layer: descriptor.layer,
    stretch: descriptor.stretch,
    ...optionalSizeDescriptor("minSize", cloneSize(descriptor.minSize)),
    ...optionalSizeDescriptor("preferredSize", cloneSize(descriptor.preferredSize))
  });
}

function cloneSize(size: UiLayoutSize | undefined): UiLayoutSize | undefined {
  if (!size) return undefined;
  return freezeSize({
    ...optionalDimension("width", size.width),
    ...optionalDimension("height", size.height)
  });
}

function freezeDescriptor(descriptor: UiLayoutItemDescriptor): UiLayoutItemDescriptor {
  return Object.freeze(descriptor);
}

function freezeSize(size: UiLayoutSize): UiLayoutSize {
  return Object.freeze(size);
}
