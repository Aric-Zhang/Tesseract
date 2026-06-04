import type { ScreenPoint } from "gizmo-core";
import type { Actor, Component, ComponentType } from "../../actor-runtime";
import {
  sceneParameterPaths,
  type SceneCommandSink,
  type SceneStateChangedEvent
} from "../../scene-runtime";
import type {
  ActorInputEndEvent,
  ActorInputHit,
  ActorInputParticipant
} from "../../gizmo-runtime";
import type { StateObserverResponder } from "../../state-runtime";
import type { WindowControlItem, WindowControlSource } from "../../window-runtime";
import {
  createWindowMenuItems,
  type AppMenuItemViewModel,
  type AppMenuLeadingAccessory
} from "./app-menu-model";

export const appMenuBarComponentType =
  "app-menu-bar-component" as ComponentType<AppMenuBarComponent>;

export const APP_MENU_PRIORITY = 10_000;
export const APP_MENU_SOURCE = {
  id: "app-menu-bar",
  kind: "gizmo"
} as const;

export type AppMenuWorkspaceMode = "run" | "develop";

export interface AppMenuBarComponentOptions {
  readonly id?: string;
  readonly parent: HTMLElement;
  readonly windowSource: WindowControlSource;
  readonly initialMode?: AppMenuWorkspaceMode;
  readonly document?: Pick<Document, "createElement">;
}

export interface AppMenuBarComponentServices {
  readonly commandSink: SceneCommandSink;
}

interface MenuRow {
  readonly actorId: string;
  readonly element: HTMLButtonElement;
}

type AppMenuHitData =
  | { readonly kind: "window-toggle"; readonly actorId: string };

const DEFAULT_APP_MENU_BAR_COMPONENT_ID = "app-menu-bar";

export class AppMenuBarComponent
  implements Component, ActorInputParticipant, StateObserverResponder {
  readonly type = appMenuBarComponentType;
  readonly actor: Actor;
  readonly id: string;
  enabled = true;

  readonly #commandSink: SceneCommandSink;
  readonly #windowSource: WindowControlSource;
  readonly #root: HTMLDivElement;
  readonly #windowButton: HTMLButtonElement;
  readonly #menu: HTMLDivElement;
  #mode: AppMenuWorkspaceMode;
  #menuOpen = false;
  #rows: MenuRow[] = [];
  #lastSignature: string | null = null;

  constructor(
    actor: Actor,
    options: AppMenuBarComponentOptions,
    services: AppMenuBarComponentServices
  ) {
    this.actor = actor;
    this.id = options.id ?? DEFAULT_APP_MENU_BAR_COMPONENT_ID;
    this.#mode = options.initialMode ?? "develop";
    this.#windowSource = options.windowSource;
    this.#commandSink = services.commandSink;

    const documentRef = resolveDocument(options);
    this.#root = documentRef.createElement("div");
    this.#root.className = "app-menu-bar";
    this.#root.setAttribute("role", "menubar");
    this.#root.style.zIndex = String(APP_MENU_PRIORITY);

    this.#windowButton = documentRef.createElement("button");
    this.#windowButton.className = "app-menu-bar__button";
    this.#windowButton.type = "button";
    this.#windowButton.textContent = "Window";
    this.#windowButton.setAttribute("role", "menuitem");
    this.#windowButton.setAttribute("aria-haspopup", "menu");
    this.#windowButton.setAttribute("aria-expanded", "false");

    this.#menu = documentRef.createElement("div");
    this.#menu.className = "app-menu-bar__menu";
    this.#menu.setAttribute("role", "menu");
    this.#menu.hidden = true;

    this.#root.append(this.#windowButton, this.#menu);
    options.parent.append(this.#root);
    this.applyMode();
    this.renderIfChanged();
  }

  get inputStackPriority(): number {
    return APP_MENU_PRIORITY;
  }

  get inputPriority(): number {
    return APP_MENU_PRIORITY;
  }

  updateFrame(): void {
    this.renderIfChanged();
  }

  onSceneStateChanged(event: SceneStateChangedEvent): void {
    const modeChange = event.changes.find((change) => change.path === sceneParameterPaths.workspace.mode);
    if (!modeChange) return;
    this.#mode = modeChange.nextValue as AppMenuWorkspaceMode;
    this.applyMode();
  }

  hitTestInput(point: ScreenPoint): ActorInputHit | null {
    if (!this.enabled || this.#root.hidden) return null;
    if (isPointInsideRect(point, this.#windowButton.getBoundingClientRect())) {
      return this.createHit("menu-button", 80);
    }
    if (this.#menuOpen) {
      for (const row of this.#rows) {
        if (!isPointInsideRect(point, row.element.getBoundingClientRect())) continue;
        return this.createHit("window-item", 70, { kind: "window-toggle", actorId: row.actorId });
      }
      if (isPointInsideRect(point, this.#menu.getBoundingClientRect())) {
        return this.createHit("menu-surface", 60);
      }
    }
    return null;
  }

  onInputEnd(event: ActorInputEndEvent): void {
    if (!event.wasClick) return;
    if (event.hit.partId === "menu-button") {
      this.setMenuOpen(!this.#menuOpen);
      return;
    }
    if (event.hit.partId !== "window-item") return;
    const hitData = readWindowToggleHitData(event.hit);
    if (!hitData) return;
    const item = this.#windowSource.listWindows().find((candidate) => candidate.actorId === hitData.actorId);
    if (!item?.canToggle) return;
    const nextVisible = getNextVisibleValue(item);
    this.#commandSink.submit({
      source: APP_MENU_SOURCE,
      target: item.visiblePath,
      operation: "set",
      value: nextVisible,
      timeStamp: event.timeStamp
    });
    this.setMenuOpen(false);
  }

  dispose(): void {
    this.enabled = false;
    this.#rows = [];
    this.#root.remove();
  }

  private renderIfChanged(): void {
    const items = this.#windowSource.listWindows();
    const viewModels = createWindowMenuItems(items);
    const signature = createMenuItemsSignature(viewModels);
    if (signature === this.#lastSignature) return;
    this.#lastSignature = signature;
    this.renderMenu(viewModels);
  }

  private renderMenu(items: readonly AppMenuItemViewModel[]): void {
    this.#rows = [];
    this.#menu.replaceChildren();
    for (const item of items) {
      const row = this.createMenuItemElement(item);
      this.#menu.append(row);
      this.#rows.push({ actorId: item.actorId, element: row });
    }
    this.applyOpenState();
  }

  private applyMode(): void {
    const visible = this.#mode === "develop";
    this.#root.hidden = !visible;
    if (!visible) {
      this.#menuOpen = false;
    }
    this.applyOpenState();
  }

  private setMenuOpen(open: boolean): void {
    this.#menuOpen = open;
    this.applyOpenState();
  }

  private applyOpenState(): void {
    this.#root.className = joinClassNames(
      "app-menu-bar",
      this.#menuOpen ? "app-menu-bar--open" : undefined
    );
    this.#menu.hidden = !this.#menuOpen || this.#root.hidden;
    this.#windowButton.setAttribute("aria-expanded", String(this.#menuOpen && !this.#root.hidden));
  }

  private createMenuItemElement(item: AppMenuItemViewModel): HTMLButtonElement {
    const row = this.#menu.ownerDocument.createElement("button");
    row.className = joinClassNames(
      "app-menu-bar__menu-item",
      item.enabled ? undefined : "is-disabled"
    );
    row.type = "button";
    row.dataset.menuItemId = item.id;
    row.dataset.itemKind = item.kind;
    row.dataset.actorId = item.actorId;
    row.dataset.checked = String(item.checked);
    row.dataset.enabled = String(item.enabled);
    row.setAttribute("role", "menuitemcheckbox");
    row.setAttribute("aria-checked", String(item.checked));
    row.setAttribute("aria-disabled", String(!item.enabled));

    const leading = this.createLeadingAccessory(item.leading, item.checked);
    const label = this.#menu.ownerDocument.createElement("span");
    label.className = "app-menu-bar__menu-item-label";
    label.textContent = item.label;
    const shortcut = this.#menu.ownerDocument.createElement("span");
    shortcut.className = "app-menu-bar__menu-item-shortcut";
    shortcut.textContent = item.shortcutLabel ?? "";
    row.append(leading, label, shortcut);
    return row;
  }

  private createLeadingAccessory(accessory: AppMenuLeadingAccessory, checked: boolean): HTMLSpanElement {
    const leading = this.#menu.ownerDocument.createElement("span");
    leading.className = "app-menu-bar__menu-item-leading";
    if (accessory.kind === "checkbox") {
      const checkbox = this.#menu.ownerDocument.createElement("span");
      checkbox.className = joinClassNames(
        "app-menu-bar__checkbox",
        checked ? "app-menu-bar__checkbox--checked" : undefined
      );
      checkbox.setAttribute("aria-hidden", "true");
      leading.append(checkbox);
    } else if (accessory.kind === "icon") {
      const icon = this.#menu.ownerDocument.createElement("span");
      icon.className = `app-menu-bar__icon app-menu-bar__icon--${accessory.name}`;
      icon.setAttribute("aria-hidden", "true");
      leading.append(icon);
    }
    return leading;
  }

  private createHit(partId: string, hitPriority: number, data?: AppMenuHitData): ActorInputHit {
    return {
      componentId: this.id,
      partId,
      kind: "chrome",
      region: "actor-overlay",
      localRoutePriority: 4000,
      hitPriority,
      path: [{
        componentId: this.id,
        role: partId === "window-item" ? "control" : "container",
        partId
      }],
      data
    };
  }
}

function getNextVisibleValue(item: WindowControlItem): boolean {
  if (!item.visible) return true;
  if (!item.activeSelf || !item.activeInHierarchy) return true;
  return false;
}

function createMenuItemsSignature(items: readonly AppMenuItemViewModel[]): string {
  return JSON.stringify(items.map((item) => [
    item.kind,
    item.id,
    item.label,
    item.enabled,
    item.checked,
    item.leading.kind,
    item.leading.kind === "icon" ? item.leading.name : null,
    item.shortcutLabel ?? null
  ]));
}

function readWindowToggleHitData(hit: ActorInputHit): AppMenuHitData | null {
  const data = hit.data;
  if (typeof data !== "object" || data === null || !("kind" in data) || !("actorId" in data)) return null;
  const candidate = data as { kind?: unknown; actorId?: unknown };
  if (candidate.kind !== "window-toggle" || typeof candidate.actorId !== "string") return null;
  return {
    kind: "window-toggle",
    actorId: candidate.actorId
  };
}

function resolveDocument(options: AppMenuBarComponentOptions): Pick<Document, "createElement"> {
  if (options.document) return options.document;
  if (options.parent.ownerDocument) return options.parent.ownerDocument;
  if (typeof document !== "undefined") return document;
  throw new Error("AppMenuBarComponent requires a document.");
}

function isPointInsideRect(point: ScreenPoint, rect: DOMRectReadOnly): boolean {
  return point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom;
}

function joinClassNames(...classNames: Array<string | undefined>): string {
  return classNames.filter(Boolean).join(" ");
}
