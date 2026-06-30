import type { ScreenPoint } from "actor-system/input";
import type {
  Actor,
  ActorSystemView,
  Component,
  ComponentRegistryView,
  ComponentType
} from "actor-system/core";
import type {
  ActorInputEndEvent,
  ActorInputHit,
  ActorInputParticipant
} from "actor-system/input";
import type { FrameUpdateParticipant } from "../../ports/ui-frame-update-attachment-runtime";
import type { UiFrame } from "../../ports/ui-scheduler";
import type { UiElementComponent } from "../element";
import type {
  TreeViewActivation,
  TreeViewActivationSink,
  TreeViewItemDescriptor
} from "./collection-types";
import {
  TreeViewItemComponent,
  treeViewItemComponentType
} from "./tree-view-item-component";

export const treeViewComponentType =
  "ui-tree-view-component" as ComponentType<TreeViewComponent>;

export interface TreeViewComponentOptions {
  readonly id?: string;
  readonly activationSink?: TreeViewActivationSink;
  readonly localRoutePriority?: number;
}

interface TreeViewDependencies {
  readonly actorSystem: ActorSystemView;
  readonly componentRegistry: ComponentRegistryView;
}

interface TreeViewItemEntry {
  readonly actor: Actor;
  readonly item: TreeViewItemComponent;
  readonly descriptor: TreeViewItemDescriptor;
  readonly depth: number;
  readonly expandable: boolean;
  readonly expanded: boolean;
  readonly treeOrder: number;
}

interface TreeViewRowRecord {
  readonly actorId: string;
  readonly element: HTMLElement;
  readonly disclosureElement: HTMLElement;
  readonly labelElement: HTMLElement;
}

export class TreeViewComponent implements Component, ActorInputParticipant, FrameUpdateParticipant {
  readonly type = treeViewComponentType;
  readonly actor: Actor;
  readonly id: string;
  readonly element: HTMLElement;
  readonly inputStackPriority?: number;
  readonly inputPriority?: number;
  enabled = true;

  readonly #actorSystem: ActorSystemView;
  readonly #componentRegistry: ComponentRegistryView;
  readonly #localRoutePriority: number;
  #activationSink?: TreeViewActivationSink;
  readonly #rows = new Map<string, TreeViewRowRecord>();
  readonly #collapsedItemIds = new Set<string>();
  #lastRenderSignature: string | null = null;
  #disposed = false;

  constructor(
    actor: Actor,
    uiElement: UiElementComponent,
    dependencies: TreeViewDependencies,
    options: TreeViewComponentOptions = {}
  ) {
    this.actor = actor;
    this.id = options.id ?? "ui-tree-view";
    this.element = uiElement.element;
    this.#actorSystem = dependencies.actorSystem;
    this.#componentRegistry = dependencies.componentRegistry;
    this.#activationSink = options.activationSink;
    this.#localRoutePriority = options.localRoutePriority ?? 0;
    this.element.className = joinClassNames(this.element.className, "ui-tree-view");
    this.element.dataset.uiTreeView = "true";
    this.element.setAttribute("role", "tree");
    this.element.tabIndex = this.element.tabIndex < 0 ? 0 : this.element.tabIndex;
  }

  setActivationSink(sink: TreeViewActivationSink | undefined): void {
    this.#activationSink = sink;
  }

  refreshItems(): void {
    if (this.#disposed) return;
    const entries = this.listItemEntries();
    const renderSignature = createRenderSignature(entries);
    if (renderSignature === this.#lastRenderSignature) return;
    this.#lastRenderSignature = renderSignature;
    const activeActorIds = new Set(entries.map((entry) => entry.actor.id));
    for (const actorId of [...this.#rows.keys()]) {
      if (!activeActorIds.has(actorId)) {
        this.removeRow(actorId);
      }
    }
    for (const entry of entries) {
      const row = this.getOrCreateRow(entry);
      applyRow(entry, row.element, row);
      this.element.append(row.element);
    }
    this.element.dataset.uiTreeRowCount = String(entries.length);
  }

  private setItemCollapsed(itemId: string, collapsed: boolean): void {
    if (this.#disposed) return;
    if (collapsed) {
      this.#collapsedItemIds.add(itemId);
    } else {
      this.#collapsedItemIds.delete(itemId);
    }
    this.#lastRenderSignature = null;
    this.refreshItems();
  }

  private toggleItemCollapsed(itemId: string): void {
    this.setItemCollapsed(itemId, !this.#collapsedItemIds.has(itemId));
  }

  updateFrame(_frame: UiFrame): void {
    this.refreshItems();
  }

  hitTestInput(point: ScreenPoint): ActorInputHit | null {
    if (!this.enabled || this.#disposed || this.element.hidden) return null;
    this.refreshItems();
    for (const entry of this.listItemEntries()) {
      const row = this.#rows.get(entry.actor.id);
      if (!row) continue;
      const rowRect = row.element.getBoundingClientRect();
      if (!isPointInsideRect(point, rowRect)) continue;
      if (entry.descriptor.enabled === false) return null;
      if (entry.expandable && isDisclosureHit(point, rowRect, row.disclosureElement.getBoundingClientRect())) {
        return this.createHit("tree-disclosure", 110, entry);
      }
      return this.createHit("tree-row", 100, entry);
    }
    if (isPointInsideRect(point, this.element.getBoundingClientRect())) {
      return this.createHit("tree-surface", 10);
    }
    return null;
  }

  onInputEnd(event: ActorInputEndEvent): void {
    if (!event.wasClick) return;
    const activation = readActivation(event.hit.data);
    if (!activation) return;
    if (event.hit.partId === "tree-disclosure") {
      this.toggleItemCollapsed(activation.itemId);
      return;
    }
    if (event.hit.partId !== "tree-row") return;
    this.#activationSink?.activateTreeItem({
      ...activation,
      inputKind: "pointer"
    });
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.enabled = false;
    for (const actorId of [...this.#rows.keys()]) {
      this.removeRow(actorId);
    }
    this.#collapsedItemIds.clear();
    this.#lastRenderSignature = null;
    delete this.element.dataset.uiTreeView;
    delete this.element.dataset.uiTreeRowCount;
  }

  private listItemEntries(): readonly TreeViewItemEntry[] {
    const entries = this.#actorSystem.listChildren(this.actor)
      .map((actor, treeOrder): Omit<TreeViewItemEntry, "depth" | "expandable" | "expanded"> | null => {
        if (!this.#actorSystem.isActorActive(actor)) return null;
        const item = this.#componentRegistry.getComponent(actor, treeViewItemComponentType);
        if (!item?.enabled) return null;
        return {
          actor,
          item,
          descriptor: item.descriptor,
          treeOrder
        };
      })
      .filter((entry): entry is Omit<TreeViewItemEntry, "depth" | "expandable" | "expanded"> => entry !== null);
    const model = createTreeModel(entries);
    pruneCollapsedItemIds(this.#collapsedItemIds, model.knownItemIds);
    return flattenVisibleEntries(entries, model, this.#collapsedItemIds);
  }

  private getOrCreateRow(entry: TreeViewItemEntry): TreeViewRowRecord {
    const existing = this.#rows.get(entry.actor.id);
    if (existing) return existing;
    const row = this.element.ownerDocument.createElement("div");
    const disclosureElement = this.element.ownerDocument.createElement("span");
    const labelElement = this.element.ownerDocument.createElement("span");
    row.dataset.uiTreeRow = "true";
    row.setAttribute("role", "treeitem");
    row.tabIndex = 0;
    row.addEventListener("keydown", (event) => this.handleRowKeyDown(event, entry.actor.id));
    disclosureElement.className = "ui-tree-view__disclosure";
    disclosureElement.dataset.uiTreeDisclosure = "true";
    disclosureElement.setAttribute("aria-hidden", "true");
    labelElement.className = "ui-tree-view__label";
    row.replaceChildren(disclosureElement, labelElement);
    const record = {
      actorId: entry.actor.id,
      element: row,
      disclosureElement,
      labelElement
    };
    this.#rows.set(entry.actor.id, record);
    return record;
  }

  private removeRow(actorId: string): void {
    const record = this.#rows.get(actorId);
    if (!record) return;
    record.element.remove();
    this.#rows.delete(actorId);
  }

  private handleRowKeyDown(event: KeyboardEvent, actorId: string): void {
    const entry = this.listItemEntries().find((candidate) => candidate.actor.id === actorId);
    if (!entry || entry.descriptor.enabled === false) return;
    if (event.key === "ArrowRight" && entry.expandable && !entry.expanded) {
      event.preventDefault();
      this.setItemCollapsed(entry.descriptor.itemId, false);
      return;
    }
    if (event.key === "ArrowLeft" && entry.expandable && entry.expanded) {
      event.preventDefault();
      this.setItemCollapsed(entry.descriptor.itemId, true);
      return;
    }
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    this.#activationSink?.activateTreeItem({
      itemActorId: entry.actor.id,
      itemId: entry.descriptor.itemId,
      inputKind: "keyboard"
    });
  }

  private createHit(partId: string, hitPriority: number, entry?: TreeViewItemEntry): ActorInputHit {
    return {
      componentId: this.id,
      partId,
      kind: partId === "tree-row" || partId === "tree-disclosure" ? "control" : "chrome",
      region: "content-control",
      localRoutePriority: this.#localRoutePriority,
      hitPriority,
      path: [{
        componentId: this.id,
        role: partId === "tree-row" || partId === "tree-disclosure" ? "control" : "container",
        partId
      }],
      data: entry
        ? {
            itemActorId: entry.actor.id,
            itemId: entry.descriptor.itemId
          }
        : undefined
    };
  }
}

function applyRow(entry: TreeViewItemEntry, row: HTMLElement, record: TreeViewRowRecord): void {
  const descriptor = entry.descriptor;
  row.className = "ui-tree-view__row";
  record.disclosureElement.textContent = entry.expandable
    ? entry.expanded ? "▾" : "▸"
    : "";
  record.labelElement.textContent = descriptor.label;
  row.dataset.uiTreeItemId = descriptor.itemId;
  row.dataset.uiTreeItemActorId = entry.actor.id;
  row.dataset.uiTreeDepth = String(entry.depth);
  row.dataset.uiTreeExpandable = String(entry.expandable);
  row.dataset.uiTreeExpanded = entry.expandable ? String(entry.expanded) : "";
  row.dataset.uiTreeSelected = String(descriptor.selected === true);
  row.dataset.uiTreeMuted = String(descriptor.muted === true);
  row.dataset.uiTreeEnabled = String(descriptor.enabled !== false);
  row.style.paddingLeft = `${8 + Math.max(0, entry.depth - 1) * 14}px`;
  row.setAttribute("aria-level", String(entry.depth));
  row.setAttribute("aria-selected", String(descriptor.selected === true));
  row.setAttribute("aria-disabled", String(descriptor.enabled === false));
  if (entry.expandable) {
    row.setAttribute("aria-expanded", String(entry.expanded));
  } else {
    row.removeAttribute("aria-expanded");
  }
}

interface TreeModel {
  readonly childrenByParentId: ReadonlyMap<string | null, readonly TreeViewItemEntry[]>;
  readonly depthByItemId: ReadonlyMap<string, number>;
  readonly knownItemIds: ReadonlySet<string>;
}

function createTreeModel(entries: readonly Omit<TreeViewItemEntry, "depth" | "expandable" | "expanded">[]): TreeModel {
  const descriptors = entries.map((entry) => entry.descriptor);
  const depthByItemId = computeDepthByItemId(descriptors);
  const childrenByParentId = new Map<string | null, TreeViewItemEntry[]>();
  const knownItemIds = new Set(entries.map((entry) => entry.descriptor.itemId));
  for (const entry of entries) {
    const parentId = entry.descriptor.parentItemId ?? null;
    const parentKey = parentId && knownItemIds.has(parentId) ? parentId : null;
    const children = childrenByParentId.get(parentKey) ?? [];
    children.push({
      ...entry,
      depth: depthByItemId.get(entry.descriptor.itemId) ?? 1,
      expandable: false,
      expanded: true
    });
    childrenByParentId.set(parentKey, children);
  }
  return {
    childrenByParentId,
    depthByItemId,
    knownItemIds
  };
}

function computeDepthByItemId(descriptors: readonly TreeViewItemDescriptor[]): Map<string, number> {
  const descriptorByItemId = new Map(descriptors.map((descriptor) => [descriptor.itemId, descriptor]));
  const depthByItemId = new Map<string, number>();
  const visiting = new Set<string>();

  const resolveDepth = (itemId: string): number => {
    const existing = depthByItemId.get(itemId);
    if (existing !== undefined) return existing;
    if (visiting.has(itemId)) return 1;
    visiting.add(itemId);
    const parentId = descriptorByItemId.get(itemId)?.parentItemId ?? null;
    const depth = parentId && descriptorByItemId.has(parentId)
      ? resolveDepth(parentId) + 1
      : 1;
    visiting.delete(itemId);
    depthByItemId.set(itemId, depth);
    return depth;
  };

  for (const descriptor of descriptors) {
    resolveDepth(descriptor.itemId);
  }
  return depthByItemId;
}

function flattenVisibleEntries(
  entries: readonly Omit<TreeViewItemEntry, "depth" | "expandable" | "expanded">[],
  model: TreeModel,
  collapsedItemIds: ReadonlySet<string>
): readonly TreeViewItemEntry[] {
  const result: TreeViewItemEntry[] = [];
  const emitted = new Set<string>();
  const appendChildren = (parentId: string | null): void => {
    const children = [...model.childrenByParentId.get(parentId) ?? []].sort(compareSiblingEntries);
    for (const childEntry of children) {
      const child = withExpansionState(childEntry, model.childrenByParentId, collapsedItemIds);
      if (emitted.has(child.descriptor.itemId)) continue;
      emitted.add(child.descriptor.itemId);
      result.push(child);
      if (child.expanded) {
        appendChildren(child.descriptor.itemId);
      }
    }
  };
  appendChildren(null);

  if (result.length < entries.length) {
    for (const entry of [...entries].sort(compareSiblingEntries)) {
      if (emitted.has(entry.descriptor.itemId)) continue;
      if (isHiddenByCollapsedAncestor(entry.descriptor, model, collapsedItemIds)) continue;
      emitted.add(entry.descriptor.itemId);
      result.push(withExpansionState({
        ...entry,
        depth: model.depthByItemId.get(entry.descriptor.itemId) ?? 1,
        expandable: false,
        expanded: true
      }, model.childrenByParentId, collapsedItemIds));
    }
  }
  return result;
}

function isHiddenByCollapsedAncestor(
  descriptor: TreeViewItemDescriptor,
  model: TreeModel,
  collapsedItemIds: ReadonlySet<string>
): boolean {
  const descriptorByItemId = new Map<string, TreeViewItemDescriptor>();
  for (const children of model.childrenByParentId.values()) {
    for (const child of children) {
      descriptorByItemId.set(child.descriptor.itemId, child.descriptor);
    }
  }
  const visited = new Set<string>();
  let parentId = descriptor.parentItemId ?? null;
  while (parentId && !visited.has(parentId)) {
    if (collapsedItemIds.has(parentId)) return true;
    visited.add(parentId);
    parentId = descriptorByItemId.get(parentId)?.parentItemId ?? null;
  }
  return false;
}

function withExpansionState(
  entry: TreeViewItemEntry,
  childrenByParentId: ReadonlyMap<string | null, readonly TreeViewItemEntry[]>,
  collapsedItemIds: ReadonlySet<string>
): TreeViewItemEntry {
  const expandable = (childrenByParentId.get(entry.descriptor.itemId)?.length ?? 0) > 0;
  return {
    ...entry,
    expandable,
    expanded: !expandable || !collapsedItemIds.has(entry.descriptor.itemId)
  };
}

function pruneCollapsedItemIds(collapsedItemIds: Set<string>, knownItemIds: ReadonlySet<string>): void {
  for (const itemId of [...collapsedItemIds]) {
    if (!knownItemIds.has(itemId)) {
      collapsedItemIds.delete(itemId);
    }
  }
}

function compareSiblingEntries(
  a: Pick<TreeViewItemEntry, "descriptor" | "treeOrder">,
  b: Pick<TreeViewItemEntry, "descriptor" | "treeOrder">
): number {
  return compareNumber(a.descriptor.order ?? 0, b.descriptor.order ?? 0)
    || compareNumber(a.treeOrder, b.treeOrder);
}

function compareNumber(a: number, b: number): number {
  return a === b ? 0 : a < b ? -1 : 1;
}

function readActivation(data: unknown): Omit<TreeViewActivation, "inputKind"> | null {
  if (typeof data !== "object" || data === null) return null;
  const candidate = data as {
    readonly itemActorId?: unknown;
    readonly itemId?: unknown;
  };
  if (typeof candidate.itemActorId !== "string" || typeof candidate.itemId !== "string") return null;
  return {
    itemActorId: candidate.itemActorId,
    itemId: candidate.itemId
  };
}

function isPointInsideRect(point: ScreenPoint, rect: DOMRectReadOnly): boolean {
  return point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom;
}

function isDisclosureHit(point: ScreenPoint, rowRect: DOMRectReadOnly, disclosureRect: DOMRectReadOnly): boolean {
  if (disclosureRect.width > 0 && disclosureRect.height > 0) {
    return isPointInsideRect(point, disclosureRect);
  }
  return point.x >= rowRect.left && point.x <= rowRect.left + 24 && point.y >= rowRect.top && point.y <= rowRect.bottom;
}

function createRenderSignature(entries: readonly TreeViewItemEntry[]): string {
  return JSON.stringify(entries.map((entry) => [
    entry.actor.id,
    entry.descriptor.itemId,
    entry.descriptor.label,
    entry.descriptor.parentItemId ?? null,
    entry.descriptor.order ?? 0,
    entry.descriptor.selected === true,
    entry.descriptor.enabled !== false,
    entry.descriptor.muted === true,
    entry.depth,
    entry.expandable,
    entry.expanded
  ]));
}

function joinClassNames(...classNames: Array<string | undefined>): string {
  return classNames
    .flatMap((className) => className?.split(/\s+/) ?? [])
    .filter(Boolean)
    .join(" ");
}
