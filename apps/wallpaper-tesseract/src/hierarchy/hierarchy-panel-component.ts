import type { ScreenPoint } from "gizmo-core";
import type { Actor, Component, ComponentType } from "../actor-runtime";
import { editorStatePaths, type EditorCommandSink } from "editor";
import type { ActorInputEndEvent, ActorInputHit, ActorInputParticipant } from "../gizmo-runtime";
import type { StateChangedEvent } from "../runtime/ports";
import type { StateObserverResponder } from "../state-runtime";
import type {
  WindowContentLayoutCommit,
  WindowContentLayoutCommitRegistration,
  WindowContentRegistrationPort,
  WindowRegisteredContent
} from "../window-runtime";
import type { HierarchyObjectItem, HierarchyObjectSource } from "./hierarchy-object-source";

export const hierarchyPanelComponentType =
  "hierarchy-panel-component" as ComponentType<HierarchyPanelComponent>;

export interface HierarchyPanelComponentOptions {
  id?: string;
  objectSource: HierarchyObjectSource;
  document?: Pick<Document, "createElement">;
  emptyLabel?: string;
  priority?: number;
  contentId: string;
  contentRegistration: WindowContentRegistrationPort;
  inputStackPriority?: () => number;
}

export interface HierarchyPanelComponentServices {
  commandSink: EditorCommandSink;
}

interface RowEntry {
  objectId: string;
  element: HTMLElement;
}

const DEFAULT_HIERARCHY_PANEL_ID = "hierarchy-panel";
const DEFAULT_EMPTY_LABEL = "No objects";
const DEFAULT_HIERARCHY_PANEL_PRIORITY = 900;

export class HierarchyPanelComponent
  implements Component, ActorInputParticipant, StateObserverResponder, WindowRegisteredContent {
  readonly id: string;
  readonly type = hierarchyPanelComponentType;
  readonly actor: Actor;
  enabled = true;

  readonly #objectSource: HierarchyObjectSource;
  readonly #commandSink: EditorCommandSink;
  readonly #priority: number;
  readonly #inputStackPriority?: () => number;
  readonly #root: HTMLDivElement;
  #registration: WindowRegisteredContent;
  readonly #emptyLabel: string;
  #rows: RowEntry[] = [];
  #activeObject: string | null = null;
  #lastItemsSignature: string | null = null;

  constructor(
    actor: Actor,
    options: HierarchyPanelComponentOptions,
    services: HierarchyPanelComponentServices
  ) {
    this.actor = actor;
    this.id = options.id ?? DEFAULT_HIERARCHY_PANEL_ID;
    this.#objectSource = options.objectSource;
    this.#commandSink = services.commandSink;
    this.#priority = options.priority ?? DEFAULT_HIERARCHY_PANEL_PRIORITY;
    this.#inputStackPriority = options.inputStackPriority;
    this.#emptyLabel = options.emptyLabel ?? DEFAULT_EMPTY_LABEL;
    const documentRef = resolveDocument(options);
    this.#root = documentRef.createElement("div");
    this.#root.className = "hierarchy-panel";
    this.#root.setAttribute("role", "tree");
    this.#root.tabIndex = -1;
    this.renderIfItemsChanged();
    this.#registration = options.contentRegistration.registerContent({
      contentId: options.contentId,
      element: this.#root
    });
  }

  get contentId(): string {
    return this.#registration.contentId;
  }

  get element(): HTMLElement {
    return this.#root;
  }

  get interactable(): boolean {
    return this.#registration.interactable;
  }

  setInteractable(interactable: boolean): void {
    this.#registration.setInteractable(interactable);
  }

  subscribeLayoutCommit(
    callback: (commit: WindowContentLayoutCommit) => void
  ): WindowContentLayoutCommitRegistration {
    return this.#registration.subscribeLayoutCommit(callback);
  }

  get inputStackPriority(): number {
    return this.#registration.inputStackPriority ?? this.#inputStackPriority?.() ?? 0;
  }

  get inputPriority(): number {
    return this.#priority;
  }

  updateFrame(): void {
    this.renderIfItemsChanged();
  }

  onStateChanged(event: StateChangedEvent): void {
    let changed = false;
    for (const change of event.changes) {
      if (change.path !== editorStatePaths.selection.activeObject) continue;
      this.#activeObject = change.nextValue as string | null;
      changed = true;
    }
    if (changed) {
      this.applySelection();
    }
  }

  hitTestInput(point: ScreenPoint): ActorInputHit | null {
    if (!this.enabled) return null;
    if (!this.#registration.interactable) return null;
    const rootRect = this.#root.getBoundingClientRect();
    if (!isPointInsideRect(point, rootRect)) return null;
    for (const row of this.#rows) {
      if (!isPointInsideRect(point, row.element.getBoundingClientRect())) continue;
      return {
        componentId: this.id,
        partId: "row",
        kind: "control",
        region: "content-control",
        localRoutePriority: 2000,
        hitPriority: 1,
        path: [
          { componentId: this.#registration.contentId, role: "surface" },
          { componentId: this.id, role: "container" },
          { componentId: this.id, role: "control", partId: "row" }
        ],
        data: { objectId: row.objectId }
      };
    }
    return null;
  }

  onInputEnd(event: ActorInputEndEvent): void {
    if (!event.wasClick) return;
    const objectId = readObjectId(event.hit);
    if (!objectId) return;
    this.submitSelection(objectId, "gizmo", event.timeStamp);
  }

  dispose(): void {
    this.enabled = false;
    this.#rows = [];
    this.#registration.dispose();
  }

  private renderIfItemsChanged(): void {
    const items = this.#objectSource.listObjects();
    const signature = createItemsSignature(items);
    if (signature === this.#lastItemsSignature) {
      this.applySelection();
      return;
    }
    this.#lastItemsSignature = signature;
    this.render(items);
  }

  private render(items: readonly HierarchyObjectItem[]): void {
    this.#rows = [];
    this.#root.replaceChildren();
    if (items.length === 0) {
      const empty = this.#root.ownerDocument.createElement("div");
      empty.className = "hierarchy-panel__empty";
      empty.textContent = this.#emptyLabel;
      this.#root.append(empty);
      return;
    }
    const levels = createItemLevels(items);
    for (const item of items) {
      const row = this.#root.ownerDocument.createElement("button");
      const activeSelf = item.activeSelf ?? true;
      const activeInHierarchy = item.activeInHierarchy ?? activeSelf;
      row.className = joinClassNames(
        "hierarchy-panel__row",
        activeInHierarchy ? undefined : "is-inactive"
      );
      row.type = "button";
      row.textContent = item.label;
      row.tabIndex = 0;
      row.dataset.objectId = item.id;
      row.dataset.activeSelf = String(activeSelf);
      row.dataset.activeInHierarchy = String(activeInHierarchy);
      const level = levels.get(item.id) ?? 1;
      row.style.setProperty?.("--hierarchy-indent", `${Math.max(0, level - 1) * 14}px`);
      if (item.parentId) {
        row.dataset.parentId = item.parentId;
      } else {
        delete row.dataset.parentId;
      }
      row.setAttribute("role", "treeitem");
      row.setAttribute("aria-level", String(level));
      row.setAttribute("aria-disabled", String(!activeInHierarchy));
      row.setAttribute("aria-selected", String(item.id === this.#activeObject));
      row.addEventListener("keydown", this.onRowKeyDown);
      this.#root.append(row);
      this.#rows.push({ objectId: item.id, element: row });
    }
    this.applySelection();
  }

  private applySelection(): void {
    for (const row of this.#rows) {
      const selected = row.objectId === this.#activeObject;
      row.element.classList.toggle("is-selected", selected);
      row.element.setAttribute("aria-selected", String(selected));
    }
  }

  private readonly onRowKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== "Enter" && event.key !== " ") return;
    const target = event.currentTarget as HTMLElement | null;
    const objectId = target?.dataset.objectId;
    if (!objectId) return;
    event.preventDefault();
    this.submitSelection(objectId, "keyboard", event.timeStamp);
  };

  private submitSelection(objectId: string, kind: "gizmo" | "keyboard", timeStamp?: number): void {
    this.#commandSink.submit({
      source: { id: this.id, kind },
      target: editorStatePaths.selection.activeObject,
      operation: "set",
      value: objectId,
      timeStamp
    });
  }
}

function resolveDocument(options: HierarchyPanelComponentOptions): Pick<Document, "createElement"> {
  if (options.document) return options.document;
  if (typeof document !== "undefined") return document;
  throw new Error("HierarchyPanelComponent requires a document.");
}

function isPointInsideRect(point: ScreenPoint, rect: DOMRectReadOnly): boolean {
  return point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom;
}

function createItemsSignature(items: readonly HierarchyObjectItem[]): string {
  return JSON.stringify(items.map((item) => [
    item.id,
    item.label,
    item.parentId ?? null,
    item.activeSelf ?? true,
    item.activeInHierarchy ?? item.activeSelf ?? true
  ]));
}

function createItemLevels(
  items: readonly HierarchyObjectItem[]
): Map<string, number> {
  const parentById = new Map(items.map((item) => [item.id, item.parentId ?? null]));
  const levels = new Map<string, number>();
  const visiting = new Set<string>();

  const resolveLevel = (id: string): number => {
    const existing = levels.get(id);
    if (existing !== undefined) return existing;
    if (visiting.has(id)) return 1;
    visiting.add(id);
    const parentId = parentById.get(id);
    const level = parentId && parentById.has(parentId)
      ? resolveLevel(parentId) + 1
      : 1;
    visiting.delete(id);
    levels.set(id, level);
    return level;
  };

  for (const item of items) {
    resolveLevel(item.id);
  }
  return levels;
}

function joinClassNames(...classNames: Array<string | undefined>): string {
  return classNames.filter(Boolean).join(" ");
}

function readObjectId(hit: ActorInputHit): string | null {
  const data = hit.data;
  if (typeof data !== "object" || data === null || !("objectId" in data)) return null;
  const objectId = (data as { objectId?: unknown }).objectId;
  return typeof objectId === "string" ? objectId : null;
}
