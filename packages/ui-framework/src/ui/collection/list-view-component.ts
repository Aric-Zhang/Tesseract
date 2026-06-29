import type {
  Actor,
  ActorSystemView,
  Component,
  ComponentRegistryView,
  ComponentType
} from "actor-core";
import type { UiElementComponent } from "../element";
import type { ListViewItemDescriptor } from "./collection-types";
import {
  ListViewItemComponent,
  listViewItemComponentType
} from "./list-view-item-component";

export const listViewComponentType =
  "ui-list-view-component" as ComponentType<ListViewComponent>;

export type ListViewTextStyle = "default" | "mono";
export type ListViewTextWrap = "truncate" | "wrap";

export interface ListViewComponentOptions {
  readonly id?: string;
  readonly textStyle?: ListViewTextStyle;
  readonly textWrap?: ListViewTextWrap;
}

interface ListViewDependencies {
  readonly actorSystem: ActorSystemView;
  readonly componentRegistry: ComponentRegistryView;
}

interface ListViewItemEntry {
  readonly actor: Actor;
  readonly item: ListViewItemComponent;
  readonly descriptor: ListViewItemDescriptor;
  readonly treeOrder: number;
}

interface ListViewRowRecord {
  readonly actorId: string;
  readonly element: HTMLElement;
}

interface ListViewAppliedState {
  readonly className: string;
  readonly role: string | null;
  readonly uiListView: string | undefined;
  readonly uiListRowCount: string | undefined;
  readonly uiListTextStyle: string | undefined;
  readonly uiListTextWrap: string | undefined;
}

export class ListViewComponent implements Component {
  readonly type = listViewComponentType;
  readonly actor: Actor;
  readonly id: string;
  readonly element: HTMLElement;
  enabled = true;

  readonly #actorSystem: ActorSystemView;
  readonly #componentRegistry: ComponentRegistryView;
  readonly #rows = new Map<string, ListViewRowRecord>();
  readonly #appliedState: ListViewAppliedState;
  #lastSignature: string | null = null;
  #disposed = false;

  constructor(
    actor: Actor,
    uiElement: UiElementComponent,
    dependencies: ListViewDependencies,
    options: ListViewComponentOptions = {}
  ) {
    this.actor = actor;
    this.id = options.id ?? "ui-list-view";
    this.element = uiElement.element;
    this.#actorSystem = dependencies.actorSystem;
    this.#componentRegistry = dependencies.componentRegistry;
    this.#appliedState = captureAppliedState(this.element);
    this.element.className = joinClassNames(this.element.className, "ui-list-view");
    this.element.dataset.uiListView = "true";
    this.element.dataset.uiListTextStyle = normalizeTextStyle(options.textStyle ?? "default");
    this.element.dataset.uiListTextWrap = normalizeTextWrap(options.textWrap ?? "truncate");
    this.element.setAttribute("role", "list");
  }

  refreshItems(): void {
    if (this.#disposed) return;
    const entries = this.listItemEntries();
    const signature = createEntriesSignature(entries);
    if (signature === this.#lastSignature) return;
    this.#lastSignature = signature;
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
    this.element.dataset.uiListRowCount = String(entries.length);
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.enabled = false;
    for (const actorId of [...this.#rows.keys()]) {
      this.removeRow(actorId);
    }
    this.#lastSignature = null;
    restoreAppliedState(this.element, this.#appliedState);
  }

  private listItemEntries(): readonly ListViewItemEntry[] {
    return this.#actorSystem.listChildren(this.actor)
      .map((actor, treeOrder): ListViewItemEntry | null => {
        if (!this.#actorSystem.isActorActive(actor)) return null;
        const item = this.#componentRegistry.getComponent(actor, listViewItemComponentType);
        if (!item?.enabled) return null;
        return {
          actor,
          item,
          descriptor: item.descriptor,
          treeOrder
        };
      })
      .filter((entry): entry is ListViewItemEntry => entry !== null)
      .sort(compareEntries);
  }

  private getOrCreateRow(entry: ListViewItemEntry): ListViewRowRecord {
    const existing = this.#rows.get(entry.actor.id);
    if (existing) return existing;
    const row = this.element.ownerDocument.createElement("div");
    row.dataset.uiListRow = "true";
    row.setAttribute("role", "listitem");
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
}

function applyRow(entry: ListViewItemEntry, row: HTMLElement): void {
  const descriptor = entry.descriptor;
  row.className = "ui-list-view__row";
  row.textContent = descriptor.text;
  row.dataset.uiListItemId = descriptor.itemId;
  row.dataset.uiListItemActorId = entry.actor.id;
  row.dataset.uiListSelected = String(descriptor.selected === true);
  row.dataset.uiListMuted = String(descriptor.muted === true);
  row.dataset.uiListEnabled = String(descriptor.enabled !== false);
  row.setAttribute("aria-selected", String(descriptor.selected === true));
  row.setAttribute("aria-disabled", String(descriptor.enabled === false));
}

function compareEntries(a: ListViewItemEntry, b: ListViewItemEntry): number {
  return compareNumber(a.descriptor.order ?? 0, b.descriptor.order ?? 0)
    || compareNumber(a.treeOrder, b.treeOrder);
}

function compareNumber(a: number, b: number): number {
  return a === b ? 0 : a < b ? -1 : 1;
}

function createEntriesSignature(entries: readonly ListViewItemEntry[]): string {
  return JSON.stringify(entries.map((entry) => [
    entry.actor.id,
    entry.descriptor.itemId,
    entry.descriptor.text,
    entry.descriptor.order ?? 0,
    entry.descriptor.selected === true,
    entry.descriptor.enabled !== false,
    entry.descriptor.muted === true,
    entry.treeOrder
  ]));
}

function normalizeTextStyle(textStyle: unknown): ListViewTextStyle {
  if (textStyle === "default" || textStyle === "mono") return textStyle;
  throw new Error(`Invalid ListView textStyle: ${String(textStyle)}`);
}

function normalizeTextWrap(textWrap: unknown): ListViewTextWrap {
  if (textWrap === "truncate" || textWrap === "wrap") return textWrap;
  throw new Error(`Invalid ListView textWrap: ${String(textWrap)}`);
}

function joinClassNames(...classNames: Array<string | undefined>): string {
  return classNames
    .flatMap((className) => className?.split(/\s+/) ?? [])
    .filter(Boolean)
    .join(" ");
}

function captureAppliedState(element: HTMLElement): ListViewAppliedState {
  return {
    className: element.className,
    role: element.getAttribute("role"),
    uiListView: element.dataset.uiListView,
    uiListRowCount: element.dataset.uiListRowCount,
    uiListTextStyle: element.dataset.uiListTextStyle,
    uiListTextWrap: element.dataset.uiListTextWrap
  };
}

function restoreAppliedState(element: HTMLElement, state: ListViewAppliedState): void {
  element.className = state.className;
  if (state.role === null) {
    element.removeAttribute("role");
  } else {
    element.setAttribute("role", state.role);
  }
  restoreOptionalDataset(element, "uiListView", state.uiListView);
  restoreOptionalDataset(element, "uiListRowCount", state.uiListRowCount);
  restoreOptionalDataset(element, "uiListTextStyle", state.uiListTextStyle);
  restoreOptionalDataset(element, "uiListTextWrap", state.uiListTextWrap);
}

function restoreOptionalDataset(element: HTMLElement, key: string, value: string | undefined): void {
  if (value === undefined) {
    delete element.dataset[key];
    return;
  }
  element.dataset[key] = value;
}
