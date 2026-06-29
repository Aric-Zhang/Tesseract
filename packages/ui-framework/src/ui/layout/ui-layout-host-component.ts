import type {
  Actor,
  ActorSystemView,
  Component,
  ComponentRegistryView,
  ComponentType
} from "actor-system/core";
import type { FrameUpdateParticipant } from "../../ports/ui-frame-update-attachment-runtime";
import type { UiFrame } from "../../ports/ui-scheduler";
import type { UiElementComponent } from "../element";
import {
  uiLayoutItemComponentType
} from "./ui-layout-item-component";
import type {
  UiLayoutItemDescriptor,
  UiLayoutSize,
  UiLayoutSlot,
  UiLayoutStretch
} from "./ui-layout-types";

export const uiLayoutHostComponentType =
  "ui-layout-host-component" as ComponentType<UiLayoutHostComponent>;

export interface UiLayoutHostComponentOptions {
  readonly id?: string;
}

export interface UiLayoutHostContributionSnapshot {
  readonly actorId: string;
  readonly slot: UiLayoutSlot;
  readonly order: number;
  readonly layer: number;
  readonly stretch: UiLayoutStretch;
  readonly minSize?: UiLayoutSize;
  readonly preferredSize?: UiLayoutSize;
}

export interface UiLayoutHostCommit {
  readonly revision: number;
  readonly contributions: readonly UiLayoutHostContributionSnapshot[];
}

interface UiLayoutHostComponentDependencies {
  readonly actorSystem: ActorSystemView;
  readonly componentRegistry: ComponentRegistryView;
}

interface UiLayoutContribution {
  readonly actor: Actor;
  readonly treeOrder: number;
  readonly element: HTMLElement;
  readonly descriptor: UiLayoutItemDescriptor;
}

interface UiLayoutWrapperRecord {
  readonly actorId: string;
  readonly element: HTMLElement;
  readonly wrapper: HTMLElement;
}

type UiLayoutRegionName =
  | "top"
  | "middle"
  | "left"
  | "fill"
  | "right"
  | "bottom"
  | "overlay";

type UiLayoutSlotRegionName = Exclude<UiLayoutRegionName, "middle">;

export class UiLayoutHostComponent implements Component, FrameUpdateParticipant {
  readonly type = uiLayoutHostComponentType;
  readonly actor: Actor;
  readonly id: string;
  readonly element: HTMLElement;
  enabled = true;

  readonly #actorSystem: ActorSystemView;
  readonly #componentRegistry: ComponentRegistryView;
  readonly #internalRoot: HTMLElement;
  readonly #regions: Record<UiLayoutRegionName, HTMLElement>;
  readonly #wrappers = new Map<string, UiLayoutWrapperRecord>();
  #lastSignature = "";
  #lastCommit: UiLayoutHostCommit = freezeCommit({ revision: 0, contributions: [] });
  #disposed = false;

  constructor(
    actor: Actor,
    uiElement: UiElementComponent,
    dependencies: UiLayoutHostComponentDependencies,
    options: UiLayoutHostComponentOptions = {}
  ) {
    this.actor = actor;
    this.id = options.id ?? "ui-layout-host";
    this.element = uiElement.element;
    this.#actorSystem = dependencies.actorSystem;
    this.#componentRegistry = dependencies.componentRegistry;

    const documentRef = uiElement.element.ownerDocument;
    this.#internalRoot = documentRef.createElement("div");
    this.#internalRoot.dataset.uiLayoutRoot = "true";
    applyInternalRootStyle(this.#internalRoot);

    const top = createRegion(documentRef, "top");
    const middle = createRegion(documentRef, "middle");
    const left = createRegion(documentRef, "left");
    const fill = createRegion(documentRef, "fill");
    const right = createRegion(documentRef, "right");
    const bottom = createRegion(documentRef, "bottom");
    const overlay = createRegion(documentRef, "overlay");
    middle.append(left, fill, right);
    this.#internalRoot.append(top, middle, bottom, overlay);
    this.element.append(this.#internalRoot);
    this.#regions = {
      top,
      middle,
      left,
      fill,
      right,
      bottom,
      overlay
    };
  }

  refreshLayout(): UiLayoutHostCommit {
    if (!this.enabled || this.#disposed) {
      return cloneCommit(this.#lastCommit);
    }
    const contributions = this.collectContributions();
    this.commitLayout(contributions);
    return cloneCommit(this.#lastCommit);
  }

  updateFrame(_frame: UiFrame): void {
    this.refreshLayout();
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.enabled = false;
    this.removeAllWrappers();
    this.#internalRoot.remove();
  }

  private collectContributions(): readonly UiLayoutContribution[] {
    return this.#actorSystem.listChildren(this.actor)
      .map((actor, treeOrder): UiLayoutContribution | null => {
        if (!this.#actorSystem.isActorActive(actor)) return null;
        const item = this.#componentRegistry.getComponent(actor, uiLayoutItemComponentType);
        if (!item?.enabled) return null;
        return {
          actor,
          treeOrder,
          element: item.element,
          descriptor: item.descriptor
        };
      })
      .filter((contribution): contribution is UiLayoutContribution => contribution !== null)
      .sort(compareContributions);
  }

  private commitLayout(contributions: readonly UiLayoutContribution[]): void {
    const activeActorIds = new Set(contributions.map((contribution) => contribution.actor.id));
    for (const actorId of [...this.#wrappers.keys()]) {
      if (!activeActorIds.has(actorId)) {
        this.removeWrapper(actorId);
      }
    }

    const snapshots: UiLayoutHostContributionSnapshot[] = [];
    for (const contribution of contributions) {
      const wrapper = this.getOrCreateWrapper(contribution);
      applyWrapperDescriptor(wrapper.wrapper, contribution);
      wrapper.wrapper.append(contribution.element);
      this.#regions[regionNameForSlot(contribution.descriptor.slot)].append(wrapper.wrapper);
      snapshots.push(snapshotContribution(contribution));
    }

    const nextSignature = signatureForSnapshots(snapshots);
    if (nextSignature !== this.#lastSignature) {
      this.#lastSignature = nextSignature;
      this.#lastCommit = freezeCommit({
        revision: this.#lastCommit.revision + 1,
        contributions: snapshots
      });
    }
  }

  private getOrCreateWrapper(contribution: UiLayoutContribution): UiLayoutWrapperRecord {
    const existing = this.#wrappers.get(contribution.actor.id);
    if (existing) return existing;
    const wrapper = this.element.ownerDocument.createElement("div");
    const record = {
      actorId: contribution.actor.id,
      element: contribution.element,
      wrapper
    };
    this.#wrappers.set(contribution.actor.id, record);
    return record;
  }

  private removeAllWrappers(): void {
    for (const actorId of [...this.#wrappers.keys()]) {
      this.removeWrapper(actorId);
    }
  }

  private removeWrapper(actorId: string): void {
    const record = this.#wrappers.get(actorId);
    if (!record) return;
    if (record.element.parentElement === record.wrapper) {
      record.element.remove();
    }
    record.wrapper.remove();
    this.#wrappers.delete(actorId);
  }
}

function createRegion(documentRef: Document, name: UiLayoutRegionName): HTMLElement {
  const region = documentRef.createElement("div");
  region.dataset.uiLayoutRegion = name;
  applyRegionStyle(region, name);
  return region;
}

function applyInternalRootStyle(element: HTMLElement): void {
  element.style.display = "flex";
  element.style.flexDirection = "column";
  element.style.position = "relative";
  element.style.width = "100%";
  element.style.height = "100%";
}

function applyRegionStyle(element: HTMLElement, name: UiLayoutRegionName): void {
  element.style.boxSizing = "border-box";
  element.style.minWidth = "0";
  element.style.minHeight = "0";
  if (name === "middle") {
    element.style.display = "flex";
    element.style.flexDirection = "row";
    element.style.flex = "1 1 auto";
    return;
  }
  if (name !== "overlay") {
    element.style.display = "flex";
    element.style.flexDirection = "column";
  }
  if (name === "fill") {
    element.style.flex = "1 1 auto";
    return;
  }
  if (name === "overlay") {
    element.style.position = "absolute";
    element.style.inset = "0";
    element.style.width = "100%";
    element.style.height = "100%";
    element.style.pointerEvents = "none";
    return;
  }
  element.style.flex = "0 0 auto";
}

function compareContributions(a: UiLayoutContribution, b: UiLayoutContribution): number {
  if (a.descriptor.slot === "overlay" || b.descriptor.slot === "overlay") {
    if (a.descriptor.slot !== b.descriptor.slot) {
      return slotSortIndex(a.descriptor.slot) - slotSortIndex(b.descriptor.slot);
    }
    return compareNumber(a.descriptor.layer, b.descriptor.layer)
      || compareNumber(a.descriptor.order, b.descriptor.order)
      || compareNumber(a.treeOrder, b.treeOrder);
  }
  return slotSortIndex(a.descriptor.slot) - slotSortIndex(b.descriptor.slot)
    || compareNumber(a.descriptor.order, b.descriptor.order)
    || compareNumber(a.treeOrder, b.treeOrder);
}

function slotSortIndex(slot: UiLayoutSlot): number {
  switch (slot) {
    case "top":
      return 0;
    case "left":
      return 1;
    case "fill":
      return 2;
    case "right":
      return 3;
    case "bottom":
      return 4;
    case "overlay":
      return 5;
  }
}

function compareNumber(a: number, b: number): number {
  return a === b ? 0 : a < b ? -1 : 1;
}

function regionNameForSlot(slot: UiLayoutSlot): UiLayoutSlotRegionName {
  return slot;
}

function applyWrapperDescriptor(
  wrapper: HTMLElement,
  contribution: UiLayoutContribution
): void {
  const descriptor = contribution.descriptor;
  wrapper.dataset.uiLayoutActorId = contribution.actor.id;
  wrapper.dataset.uiLayoutSlot = descriptor.slot;
  wrapper.dataset.uiLayoutOrder = String(descriptor.order);
  wrapper.dataset.uiLayoutLayer = String(descriptor.layer);
  wrapper.dataset.uiLayoutStretch = descriptor.stretch;
  setOptionalDataset(wrapper, "uiLayoutMinWidth", descriptor.minSize?.width);
  setOptionalDataset(wrapper, "uiLayoutMinHeight", descriptor.minSize?.height);
  setOptionalDataset(wrapper, "uiLayoutPreferredWidth", descriptor.preferredSize?.width);
  setOptionalDataset(wrapper, "uiLayoutPreferredHeight", descriptor.preferredSize?.height);

  wrapper.style.order = String(descriptor.order);
  wrapper.style.zIndex = String(descriptor.layer);
  wrapper.style.boxSizing = "border-box";
  wrapper.style.display = "flex";
  wrapper.style.minWidth = styleSizeValue(descriptor.minSize?.width, "0");
  wrapper.style.minHeight = styleSizeValue(descriptor.minSize?.height, "0");
  wrapper.style.width = styleSizeValue(
    descriptor.preferredSize?.width,
    descriptor.slot === "overlay" ? "100%" : ""
  );
  wrapper.style.height = styleSizeValue(
    descriptor.preferredSize?.height,
    descriptor.slot === "overlay" ? "100%" : ""
  );
  wrapper.style.flex = flexForStretch(descriptor.stretch);
  wrapper.style.alignSelf = alignSelfForStretch(descriptor.stretch);
  if (descriptor.slot === "overlay") {
    wrapper.style.position = "absolute";
    wrapper.style.inset = "0";
    wrapper.style.pointerEvents = "none";
  } else {
    wrapper.style.position = "";
    wrapper.style.inset = "";
    wrapper.style.pointerEvents = "";
  }
}

function setOptionalDataset(element: HTMLElement, key: string, value: number | undefined): void {
  if (value === undefined) {
    delete element.dataset[key];
    return;
  }
  element.dataset[key] = String(value);
}

function styleSizeValue(value: number | undefined, fallback = ""): string {
  return value === undefined ? fallback : `${value}px`;
}

function flexForStretch(stretch: UiLayoutStretch): string {
  switch (stretch) {
    case "both":
    case "vertical":
      return "1 1 auto";
    case "horizontal":
      return "0 1 auto";
    case "none":
      return "0 0 auto";
  }
}

function alignSelfForStretch(stretch: UiLayoutStretch): string {
  switch (stretch) {
    case "both":
    case "horizontal":
      return "stretch";
    case "vertical":
    case "none":
      return "flex-start";
  }
}

function snapshotContribution(contribution: UiLayoutContribution): UiLayoutHostContributionSnapshot {
  return freezeContribution({
    actorId: contribution.actor.id,
    slot: contribution.descriptor.slot,
    order: contribution.descriptor.order,
    layer: contribution.descriptor.layer,
    stretch: contribution.descriptor.stretch,
    ...optionalSize("minSize", cloneSize(contribution.descriptor.minSize)),
    ...optionalSize("preferredSize", cloneSize(contribution.descriptor.preferredSize))
  });
}

function signatureForSnapshots(snapshots: readonly UiLayoutHostContributionSnapshot[]): string {
  return snapshots.map((snapshot) => [
    snapshot.actorId,
    snapshot.slot,
    snapshot.order,
    snapshot.layer,
    snapshot.stretch,
    snapshot.minSize?.width ?? "",
    snapshot.minSize?.height ?? "",
    snapshot.preferredSize?.width ?? "",
    snapshot.preferredSize?.height ?? ""
  ].join(":")).join("|");
}

function cloneCommit(commit: UiLayoutHostCommit): UiLayoutHostCommit {
  return freezeCommit({
    revision: commit.revision,
    contributions: commit.contributions.map(cloneContribution)
  });
}

function freezeCommit(commit: UiLayoutHostCommit): UiLayoutHostCommit {
  return Object.freeze({
    revision: commit.revision,
    contributions: Object.freeze(commit.contributions.map(freezeContribution))
  });
}

function cloneContribution(
  contribution: UiLayoutHostContributionSnapshot
): UiLayoutHostContributionSnapshot {
  return freezeContribution({
    actorId: contribution.actorId,
    slot: contribution.slot,
    order: contribution.order,
    layer: contribution.layer,
    stretch: contribution.stretch,
    ...optionalSize("minSize", cloneSize(contribution.minSize)),
    ...optionalSize("preferredSize", cloneSize(contribution.preferredSize))
  });
}

function freezeContribution(
  contribution: UiLayoutHostContributionSnapshot
): UiLayoutHostContributionSnapshot {
  return Object.freeze({
    actorId: contribution.actorId,
    slot: contribution.slot,
    order: contribution.order,
    layer: contribution.layer,
    stretch: contribution.stretch,
    ...optionalSize("minSize", freezeSize(contribution.minSize)),
    ...optionalSize("preferredSize", freezeSize(contribution.preferredSize))
  });
}

function cloneSize(size: UiLayoutSize | undefined): UiLayoutSize | undefined {
  if (!size) return undefined;
  return freezeSize({
    ...optionalDimension("width", size.width),
    ...optionalDimension("height", size.height)
  });
}

function freezeSize(size: UiLayoutSize | undefined): UiLayoutSize | undefined {
  if (!size) return undefined;
  return Object.freeze({
    ...optionalDimension("width", size.width),
    ...optionalDimension("height", size.height)
  });
}

function optionalSize(
  key: "minSize" | "preferredSize",
  size: UiLayoutSize | undefined
): Pick<UiLayoutHostContributionSnapshot, "minSize" | "preferredSize"> {
  return size ? { [key]: size } : {};
}

function optionalDimension(
  key: "width" | "height",
  value: number | undefined
): Pick<UiLayoutSize, "width" | "height"> {
  return value === undefined ? {} : { [key]: value };
}
