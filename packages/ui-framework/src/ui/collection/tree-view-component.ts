import type { ScreenPoint } from "gizmo-core";
import type {
  Actor,
  ActorSystemView,
  Component,
  ComponentRegistryView,
  ComponentType
} from "actor-core";
import type {
  ActorInputEndEvent,
  ActorInputHit,
  ActorInputParticipant
} from "actor-input";
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
  readonly treeOrder: number;
}

interface TreeViewRowRecord {
  readonly actorId: string;
  readonly element: HTMLElement;
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
    const activeActorIds = new Set(entries.map((entry) => entry.actor.id));
    for (const actorId of [...this.#rows.keys()]) {
      if (!activeActorIds.has(actorId)) {
        this.removeRow(actorId);
      }
    }
    for (const entry of entries) {
      const row = this.getOrCreateRow(entry);
      applyRow(entry, row.element);
      this.element.append(row.element);
    }
    this.element.dataset.uiTreeRowCount = String(entries.length);
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
      if (!isPointInsideRect(point, row.element.getBoundingClientRect())) continue;
      if (entry.descriptor.enabled === false) return null;
      return this.createHit("tree-row", 100, entry);
    }
    if (isPointInsideRect(point, this.element.getBoundingClientRect())) {
      return this.createHit("tree-surface", 10);
    }
    return null;
  }

  onInputEnd(event: ActorInputEndEvent): void {
    if (!event.wasClick || event.hit.partId !== "tree-row") return;
    const activation = readActivation(event.hit.data);
    if (!activation) return;
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
    delete this.element.dataset.uiTreeView;
    delete this.element.dataset.uiTreeRowCount;
  }

  private listItemEntries(): readonly TreeViewItemEntry[] {
    const entries = this.#actorSystem.listChildren(this.actor)
      .map((actor, treeOrder): Omit<TreeViewItemEntry, "depth"> | null => {
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
      .filter((entry): entry is Omit<TreeViewItemEntry, "depth"> => entry !== null);
    const depthByItemId = computeDepthByItemId(entries.map((entry) => entry.descriptor));
    return flattenEntries(entries
      .map((entry) => ({
        ...entry,
        depth: depthByItemId.get(entry.descriptor.itemId) ?? 1
      })));
  }

  private getOrCreateRow(entry: TreeViewItemEntry): TreeViewRowRecord {
    const existing = this.#rows.get(entry.actor.id);
    if (existing) return existing;
    const row = this.element.ownerDocument.createElement("div");
    row.dataset.uiTreeRow = "true";
    row.setAttribute("role", "treeitem");
    row.tabIndex = 0;
    row.addEventListener("keydown", (event) => this.handleRowKeyDown(event, entry.actor.id));
    const record = {
      actorId: entry.actor.id,
      element: row
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
    if (event.key !== "Enter" && event.key !== " ") return;
    const entry = this.listItemEntries().find((candidate) => candidate.actor.id === actorId);
    if (!entry || entry.descriptor.enabled === false) return;
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
      kind: partId === "tree-row" ? "control" : "chrome",
      region: "content-control",
      localRoutePriority: this.#localRoutePriority,
      hitPriority,
      path: [{
        componentId: this.id,
        role: partId === "tree-row" ? "control" : "container",
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

function applyRow(entry: TreeViewItemEntry, row: HTMLElement): void {
  const descriptor = entry.descriptor;
  row.className = "ui-tree-view__row";
  row.textContent = descriptor.label;
  row.dataset.uiTreeItemId = descriptor.itemId;
  row.dataset.uiTreeItemActorId = entry.actor.id;
  row.dataset.uiTreeDepth = String(entry.depth);
  row.dataset.uiTreeSelected = String(descriptor.selected === true);
  row.dataset.uiTreeMuted = String(descriptor.muted === true);
  row.dataset.uiTreeEnabled = String(descriptor.enabled !== false);
  row.style.paddingLeft = `${8 + Math.max(0, entry.depth - 1) * 14}px`;
  row.setAttribute("aria-level", String(entry.depth));
  row.setAttribute("aria-selected", String(descriptor.selected === true));
  row.setAttribute("aria-disabled", String(descriptor.enabled === false));
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

function flattenEntries(entries: readonly TreeViewItemEntry[]): readonly TreeViewItemEntry[] {
  const childrenByParentId = new Map<string | null, TreeViewItemEntry[]>();
  const knownItemIds = new Set(entries.map((entry) => entry.descriptor.itemId));
  for (const entry of entries) {
    const parentId = entry.descriptor.parentItemId ?? null;
    const parentKey = parentId && knownItemIds.has(parentId) ? parentId : null;
    const children = childrenByParentId.get(parentKey) ?? [];
    children.push(entry);
    childrenByParentId.set(parentKey, children);
  }

  const result: TreeViewItemEntry[] = [];
  const emitted = new Set<string>();
  const appendChildren = (parentId: string | null): void => {
    const children = [...childrenByParentId.get(parentId) ?? []].sort(compareSiblingEntries);
    for (const child of children) {
      if (emitted.has(child.descriptor.itemId)) continue;
      emitted.add(child.descriptor.itemId);
      result.push(child);
      appendChildren(child.descriptor.itemId);
    }
  };
  appendChildren(null);

  if (result.length < entries.length) {
    for (const entry of [...entries].sort(compareSiblingEntries)) {
      if (emitted.has(entry.descriptor.itemId)) continue;
      emitted.add(entry.descriptor.itemId);
      result.push(entry);
    }
  }
  return result;
}

function compareSiblingEntries(a: TreeViewItemEntry, b: TreeViewItemEntry): number {
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

function joinClassNames(...classNames: Array<string | undefined>): string {
  return classNames
    .flatMap((className) => className?.split(/\s+/) ?? [])
    .filter(Boolean)
    .join(" ");
}
