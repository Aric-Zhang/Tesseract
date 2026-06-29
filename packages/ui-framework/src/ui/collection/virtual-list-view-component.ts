import type { Actor, Component, ComponentType } from "actor-system/core";
import type { ScrollViewComponent } from "../scroll";
import type { UiElementComponent } from "../element";
import type { VirtualListDataSource, VirtualListItemSnapshot } from "./collection-types";

export const virtualListViewComponentType =
  "ui-virtual-list-view-component" as ComponentType<VirtualListViewComponent>;

export type VirtualListTextStyle = "default" | "mono";
export type VirtualListTextOverflow = "truncate";

export interface VirtualListViewComponentOptions {
  readonly id?: string;
  readonly source: VirtualListDataSource;
  readonly rowHeightPx?: number;
  readonly overscan?: number;
  readonly textStyle?: VirtualListTextStyle;
  readonly textOverflow?: VirtualListTextOverflow;
}

interface VirtualListAppliedState {
  readonly className: string;
  readonly role: string | null;
  readonly uiVirtualListView: string | undefined;
  readonly uiVirtualListItemCount: string | undefined;
  readonly uiVirtualListFirstIndex: string | undefined;
  readonly uiVirtualListLastIndex: string | undefined;
  readonly uiVirtualListRowPoolSize: string | undefined;
  readonly uiVirtualListTextStyle: string | undefined;
  readonly uiVirtualListTextOverflow: string | undefined;
}

interface VirtualRange {
  readonly firstIndex: number;
  readonly lastExclusive: number;
}

export class VirtualListViewComponent implements Component {
  readonly type = virtualListViewComponentType;
  readonly actor: Actor;
  readonly id: string;
  readonly element: HTMLElement;
  readonly source: VirtualListDataSource;
  readonly rowHeightPx: number;
  readonly overscan: number;
  enabled = true;

  readonly #scrollView: ScrollViewComponent;
  readonly #spacer: HTMLElement;
  readonly #rows: HTMLElement[] = [];
  readonly #appliedState: VirtualListAppliedState;
  readonly #handleScroll = (): void => {
    this.#scrollView.refreshScrollDiagnostics();
    this.refreshItems();
  };
  #lastSignature: string | null = null;
  #disposed = false;

  constructor(
    actor: Actor,
    uiElement: UiElementComponent,
    scrollView: ScrollViewComponent,
    options: VirtualListViewComponentOptions
  ) {
    if (!options.source) {
      throw new Error("VirtualListViewComponent requires a data source.");
    }
    this.actor = actor;
    this.id = options.id ?? "ui-virtual-list-view";
    this.element = uiElement.element;
    this.source = options.source;
    this.#scrollView = scrollView;
    this.rowHeightPx = normalizePositiveNumber(options.rowHeightPx ?? 18, "rowHeightPx");
    this.overscan = normalizeNonNegativeInteger(options.overscan ?? 3, "overscan");
    this.#appliedState = captureAppliedState(this.element);
    this.element.className = joinClassNames(this.element.className, "ui-virtual-list-view");
    this.element.dataset.uiVirtualListView = "true";
    this.element.dataset.uiVirtualListTextStyle = normalizeTextStyle(options.textStyle ?? "default");
    this.element.dataset.uiVirtualListTextOverflow = normalizeTextOverflow(options.textOverflow ?? "truncate");
    this.element.setAttribute("role", "list");
    this.#spacer = this.element.ownerDocument.createElement("div");
    this.#spacer.className = "ui-virtual-list-view__spacer";
    this.#spacer.style.position = "relative";
    this.element.append(this.#spacer);
    this.element.addEventListener("scroll", this.#handleScroll);
    this.refreshItems();
  }

  refreshItems(): void {
    if (this.#disposed) return;
    const itemCount = normalizeItemCount(this.source.getItemCount());
    const range = this.calculateVisibleRange(itemCount);
    const signature = `${this.source.revision}:${itemCount}:${range.firstIndex}:${range.lastExclusive}`;
    if (signature === this.#lastSignature) return;
    this.#lastSignature = signature;
    this.#spacer.style.height = `${itemCount * this.rowHeightPx}px`;
    const rowCount = range.lastExclusive - range.firstIndex;
    this.resizeRowPool(rowCount);
    for (let offset = 0; offset < rowCount; offset += 1) {
      const index = range.firstIndex + offset;
      const row = this.#rows[offset]!;
      applyRow(row, this.source.getItem(index), index, this.rowHeightPx);
    }
    this.element.dataset.uiVirtualListItemCount = String(itemCount);
    this.element.dataset.uiVirtualListFirstIndex = rowCount === 0 ? "-1" : String(range.firstIndex);
    this.element.dataset.uiVirtualListLastIndex = rowCount === 0 ? "-1" : String(range.lastExclusive - 1);
    this.element.dataset.uiVirtualListRowPoolSize = String(this.#rows.length);
    this.#scrollView.refreshScrollDiagnostics();
  }

  refreshItemsPreservingEnd(): void {
    if (this.#disposed) return;
    this.#scrollView.preserveEndOnMutation(() => {
      this.refreshItems();
    });
    // preserveEndOnMutation may move scrollTop to the new end; refresh again so
    // the visible range is recalculated for the final anchored viewport.
    this.refreshItems();
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.enabled = false;
    this.element.removeEventListener("scroll", this.#handleScroll);
    for (const row of this.#rows.splice(0)) {
      row.remove();
    }
    this.#spacer.remove();
    this.#lastSignature = null;
    restoreAppliedState(this.element, this.#appliedState);
  }

  private calculateVisibleRange(itemCount: number): VirtualRange {
    if (itemCount === 0) {
      return { firstIndex: 0, lastExclusive: 0 };
    }
    const viewportHeight = Math.max(this.rowHeightPx, this.element.clientHeight);
    const firstVisible = Math.floor(Math.max(0, this.element.scrollTop) / this.rowHeightPx);
    const visibleCount = Math.ceil(viewportHeight / this.rowHeightPx);
    const firstIndex = Math.max(0, firstVisible - this.overscan);
    const lastExclusive = Math.min(itemCount, firstVisible + visibleCount + this.overscan);
    return { firstIndex, lastExclusive };
  }

  private resizeRowPool(rowCount: number): void {
    while (this.#rows.length > rowCount) {
      this.#rows.pop()?.remove();
    }
    while (this.#rows.length < rowCount) {
      const row = this.element.ownerDocument.createElement("div");
      row.className = "ui-virtual-list-view__row";
      row.dataset.uiVirtualListRow = "true";
      row.setAttribute("role", "listitem");
      row.style.position = "absolute";
      row.style.left = "0";
      row.style.right = "0";
      row.style.height = `${this.rowHeightPx}px`;
      this.#spacer.append(row);
      this.#rows.push(row);
    }
  }
}

function applyRow(
  row: HTMLElement,
  item: VirtualListItemSnapshot,
  index: number,
  rowHeightPx: number
): void {
  setText(row, item.text);
  setDataset(row, "uiVirtualListKey", item.key);
  setDataset(row, "uiVirtualListIndex", String(index));
  setDataset(row, "uiVirtualListSelected", String(item.selected === true));
  setDataset(row, "uiVirtualListMuted", String(item.muted === true));
  setDataset(row, "uiVirtualListEnabled", String(item.enabled !== false));
  setAttribute(row, "aria-selected", String(item.selected === true));
  setAttribute(row, "aria-disabled", String(item.enabled === false));
  setStyle(row, "transform", `translateY(${index * rowHeightPx}px)`);
}

function setText(row: HTMLElement, text: string): void {
  const firstChild = row.firstChild;
  if (firstChild?.nodeType === 3) {
    if (firstChild.nodeValue !== text) {
      firstChild.nodeValue = text;
    }
    return;
  }
  row.textContent = text;
}

function setDataset(row: HTMLElement, key: string, value: string): void {
  if (row.dataset[key] !== value) {
    row.dataset[key] = value;
  }
}

function setAttribute(row: HTMLElement, name: string, value: string): void {
  if (row.getAttribute(name) !== value) {
    row.setAttribute(name, value);
  }
}

function setStyle(row: HTMLElement, name: "transform", value: string): void {
  if (row.style[name] !== value) {
    row.style[name] = value;
  }
}

function normalizeTextStyle(textStyle: unknown): VirtualListTextStyle {
  if (textStyle === "default" || textStyle === "mono") return textStyle;
  throw new Error(`Invalid VirtualListView textStyle: ${String(textStyle)}`);
}

function normalizeTextOverflow(textOverflow: unknown): VirtualListTextOverflow {
  if (textOverflow === "truncate") return textOverflow;
  throw new Error(`Invalid VirtualListView textOverflow: ${String(textOverflow)}`);
}

function normalizePositiveNumber(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    throw new Error(`Invalid VirtualListView ${label}: ${String(value)}`);
  }
  return value;
}

function normalizeNonNegativeInteger(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new Error(`Invalid VirtualListView ${label}: ${String(value)}`);
  }
  return value;
}

function normalizeItemCount(value: number): number {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`Invalid VirtualListView item count: ${String(value)}`);
  }
  return value;
}

function captureAppliedState(element: HTMLElement): VirtualListAppliedState {
  return {
    className: element.className,
    role: element.getAttribute("role"),
    uiVirtualListView: element.dataset.uiVirtualListView,
    uiVirtualListItemCount: element.dataset.uiVirtualListItemCount,
    uiVirtualListFirstIndex: element.dataset.uiVirtualListFirstIndex,
    uiVirtualListLastIndex: element.dataset.uiVirtualListLastIndex,
    uiVirtualListRowPoolSize: element.dataset.uiVirtualListRowPoolSize,
    uiVirtualListTextStyle: element.dataset.uiVirtualListTextStyle,
    uiVirtualListTextOverflow: element.dataset.uiVirtualListTextOverflow
  };
}

function restoreAppliedState(element: HTMLElement, state: VirtualListAppliedState): void {
  element.className = state.className;
  if (state.role === null) {
    element.removeAttribute("role");
  } else {
    element.setAttribute("role", state.role);
  }
  restoreOptionalDataset(element, "uiVirtualListView", state.uiVirtualListView);
  restoreOptionalDataset(element, "uiVirtualListItemCount", state.uiVirtualListItemCount);
  restoreOptionalDataset(element, "uiVirtualListFirstIndex", state.uiVirtualListFirstIndex);
  restoreOptionalDataset(element, "uiVirtualListLastIndex", state.uiVirtualListLastIndex);
  restoreOptionalDataset(element, "uiVirtualListRowPoolSize", state.uiVirtualListRowPoolSize);
  restoreOptionalDataset(element, "uiVirtualListTextStyle", state.uiVirtualListTextStyle);
  restoreOptionalDataset(element, "uiVirtualListTextOverflow", state.uiVirtualListTextOverflow);
}

function restoreOptionalDataset(element: HTMLElement, key: string, value: string | undefined): void {
  if (value === undefined) {
    delete element.dataset[key];
    return;
  }
  element.dataset[key] = value;
}

function joinClassNames(...classNames: Array<string | undefined>): string {
  return classNames
    .flatMap((className) => className?.split(/\s+/) ?? [])
    .filter(Boolean)
    .join(" ");
}
