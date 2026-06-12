import type { ScreenPoint } from "gizmo-core";
import type { Actor, Component, ComponentType } from "../../actor-runtime";
import { actorInputScopeRoutePriority } from "../../gizmo-runtime";
import type {
  ActorInputEndEvent,
  ActorInputHit,
  ActorInputParticipant
} from "../../gizmo-runtime";
import type { StateObserverResponder } from "editor";
import type { StateChangedEvent } from "../../runtime/ports";
import type {
  WindowFrameIntentSink,
  WindowWorkspaceViewCatalog,
  WindowViewIdentity,
  WindowViewTypeKey
} from "../../window-runtime";
import {
  createWindowMenuItems,
  type AppMenuItemViewModel,
  type AppMenuLeadingAccessory,
  type AppMenuWindowAction
} from "./app-menu-model";

export const appMenuBarComponentType =
  "app-menu-bar-component" as ComponentType<AppMenuBarComponent>;

export const APP_MENU_PRIORITY = 10_000;

export type AppMenuWorkspaceMode = "run" | "develop";

export interface AppMenuBarComponentOptions {
  readonly id?: string;
  readonly parent: HTMLElement;
  readonly windowCatalog: WindowWorkspaceViewCatalog;
  readonly windowFrameIntents?: WindowFrameIntentSink;
  readonly workspaceModePath: string;
  readonly initialMode?: AppMenuWorkspaceMode;
  readonly document?: Pick<Document, "createElement">;
}

export interface AppMenuBarComponentServices {}

interface MenuRow {
  readonly kind: "window-command";
  readonly action: AppMenuWindowAction;
  readonly actorId: string | null;
  readonly enabled: boolean;
  readonly element: HTMLButtonElement;
}

type AppMenuHitData =
  | { readonly kind: "window-command"; readonly action: AppMenuWindowAction };

const DEFAULT_APP_MENU_BAR_COMPONENT_ID = "app-menu-bar";

export class AppMenuBarComponent
  implements Component, ActorInputParticipant, StateObserverResponder {
  readonly type = appMenuBarComponentType;
  readonly actor: Actor;
  readonly id: string;
  enabled = true;

  readonly #windowCatalog: WindowWorkspaceViewCatalog;
  readonly #windowFrameIntents?: WindowFrameIntentSink;
  readonly #workspaceModePath: string;
  readonly #root: HTMLDivElement;
  readonly #windowButton: HTMLButtonElement;
  readonly #menu: HTMLDivElement;
  #mode: AppMenuWorkspaceMode;
  #menuOpen = false;
  #rows: MenuRow[] = [];
  #activeRowIndex = -1;
  #lastSignature: string | null = null;
  readonly #onKeyDown = (event: KeyboardEvent): void => {
    this.handleKeyDown(event);
  };

  constructor(
    actor: Actor,
    options: AppMenuBarComponentOptions,
    _services: AppMenuBarComponentServices
  ) {
    this.actor = actor;
    this.id = options.id ?? DEFAULT_APP_MENU_BAR_COMPONENT_ID;
    this.#mode = options.initialMode ?? "develop";
    this.#windowCatalog = options.windowCatalog;
    this.#windowFrameIntents = options.windowFrameIntents;
    this.#workspaceModePath = options.workspaceModePath;

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
    this.#root.addEventListener("keydown", this.#onKeyDown);
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

  onStateChanged(event: StateChangedEvent<string>): void {
    const modeChange = event.changes.find((change) => change.path === this.#workspaceModePath);
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
        return this.createHit("window-command-item", 70, {
          kind: "window-command",
          action: row.action
        });
      }
      if (isPointInsideRect(point, this.#menu.getBoundingClientRect())) {
        return this.createHit("menu-surface", 60);
      }
      return this.createHit("menu-dismiss", 50);
    }
    return null;
  }

  onInputEnd(event: ActorInputEndEvent): void {
    if (!event.wasClick) return;
    if (event.hit.partId === "menu-button") {
      this.setMenuOpen(!this.#menuOpen);
      return;
    }
    if (event.hit.partId === "menu-dismiss") {
      this.setMenuOpen(false);
      return;
    }
    if (event.hit.partId !== "window-command-item") return;
    const hitData = readWindowCommandHitData(event.hit);
    if (!hitData) return;
    const row = this.#rows.find((candidate) => areWindowActionsEqual(candidate.action, hitData.action));
    if (!row?.enabled) return;
    this.activateWindowCommandRow(row, event.timeStamp);
  }

  dispose(): void {
    this.enabled = false;
    this.#rows = [];
    this.#root.removeEventListener("keydown", this.#onKeyDown);
    this.#root.remove();
  }

  private handleKeyDown(event: KeyboardEvent): void {
    if (!this.enabled || this.#root.hidden) return;
    if (event.key === "Escape" && this.#menuOpen) {
      event.preventDefault();
      this.setMenuOpen(false);
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!this.#menuOpen) {
        this.setMenuOpen(true);
        return;
      }
      this.moveActiveRow(event.key === "ArrowDown" ? 1 : -1);
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (!this.#menuOpen) {
        this.setMenuOpen(true);
        return;
      }
      const row = this.#rows[this.#activeRowIndex];
      if (row?.enabled) {
        this.activateWindowCommandRow(row, event.timeStamp);
      }
    }
  }

  private activateWindowCommandRow(row: MenuRow, _timeStamp?: number): void {
    if (row.action.kind === "open-or-focus-type") {
      if (this.#windowFrameIntents?.requestOpenOrFocusViewType) {
        this.#windowFrameIntents.requestOpenOrFocusViewType(row.action.typeKey, "menu");
      }
      return this.setMenuOpen(false);
    }
    if (row.action.kind === "new-instance") {
      this.#windowFrameIntents?.requestCreateViewInstance?.(row.action.typeKey, "menu");
      return this.setMenuOpen(false);
    }
    this.#windowFrameIntents?.requestFocusViewInstance?.(row.action.identity, "menu");
    this.setMenuOpen(false);
  }

  private renderIfChanged(): void {
    const viewModels = createWindowMenuItems(this.#windowCatalog.listViewEntries());
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
      if (item.kind === "window-command") {
        this.#rows.push({
          kind: item.kind,
          action: item.action,
          actorId: item.actorId,
          enabled: item.enabled,
          element: row
        });
      }
    }
    if (this.#activeRowIndex >= this.#rows.length || !this.#rows[this.#activeRowIndex]?.enabled) {
      this.#activeRowIndex = this.findFirstEnabledRowIndex();
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
    this.#activeRowIndex = open ? this.findFirstEnabledRowIndex() : -1;
    this.applyOpenState();
  }

  private applyOpenState(): void {
    this.#root.className = joinClassNames(
      "app-menu-bar",
      this.#menuOpen ? "app-menu-bar--open" : undefined
    );
    this.#menu.hidden = !this.#menuOpen || this.#root.hidden;
    this.#windowButton.setAttribute("aria-expanded", String(this.#menuOpen && !this.#root.hidden));
    this.applyKeyboardActiveRowState();
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
    if (item.kind === "window-command") {
      row.dataset.actionKind = item.action.kind;
      row.dataset.typeKey = "typeKey" in item.action ? item.action.typeKey : item.action.identity.typeKey;
      if (item.viewKey) {
        row.dataset.viewKey = item.viewKey;
      } else {
        delete row.dataset.viewKey;
      }
      row.dataset.live = String(item.live);
    } else {
      delete row.dataset.actionKind;
      delete row.dataset.typeKey;
      delete row.dataset.viewKey;
      delete row.dataset.live;
    }
    if (item.kind === "window-command" && item.actorId) {
      row.dataset.actorId = item.actorId;
    } else {
      delete row.dataset.actorId;
    }
    if (item.kind === "checkable-command") {
      row.dataset.commandId = item.commandId;
      row.dataset.checked = String(item.checked);
    } else {
      delete row.dataset.commandId;
      delete row.dataset.checked;
    }
    row.dataset.enabled = String(item.enabled);
    row.setAttribute("role", getMenuItemRole(item));
    if (item.kind === "checkable-command") {
      row.setAttribute("aria-checked", String(item.checked));
    }
    row.setAttribute("aria-disabled", String(!item.enabled));

    const leading = this.createLeadingAccessory(item.leading, isCheckableCommandChecked(item));
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
      scopeRoutePriority: actorInputScopeRoutePriority.appOverlay,
      localRoutePriority: 4000,
      hitPriority,
      path: [{
        componentId: this.id,
        role: partId === "window-command-item" || partId === "menu-dismiss" ? "control" : "container",
        partId
      }],
      data
    };
  }

  private findFirstEnabledRowIndex(): number {
    return this.#rows.findIndex((row) => row.enabled);
  }

  private moveActiveRow(delta: 1 | -1): void {
    const enabledIndexes = this.#rows
      .map((row, index) => row.enabled ? index : -1)
      .filter((index) => index >= 0);
    if (enabledIndexes.length === 0) {
      this.#activeRowIndex = -1;
      this.applyKeyboardActiveRowState();
      return;
    }
    const currentIndex = enabledIndexes.indexOf(this.#activeRowIndex);
    const nextEnabledIndex = currentIndex < 0
      ? enabledIndexes[0]
      : enabledIndexes[(currentIndex + delta + enabledIndexes.length) % enabledIndexes.length];
    this.#activeRowIndex = nextEnabledIndex ?? -1;
    this.applyKeyboardActiveRowState();
  }

  private applyKeyboardActiveRowState(): void {
    this.#rows.forEach((row, index) => {
      const active = this.#menuOpen && index === this.#activeRowIndex;
      row.element.dataset.keyboardActive = String(active);
    });
  }
}

function createMenuItemsSignature(items: readonly AppMenuItemViewModel[]): string {
  return JSON.stringify(items.map((item) => [
    item.kind,
    item.id,
    item.kind === "window-command" ? item.action.kind : item.commandId,
    item.kind === "window-command" && "typeKey" in item.action ? item.action.typeKey : null,
    item.kind === "window-command" && "identity" in item.action ? item.action.identity.instanceId : null,
    item.kind === "window-command" ? item.viewKey : null,
    item.kind === "window-command" ? item.actorId : null,
    item.label,
    item.enabled,
    item.kind === "window-command" ? item.live : item.checked,
    item.leading.kind,
    item.leading.kind === "icon" ? item.leading.name : null,
    item.shortcutLabel ?? null
  ]));
}

function readWindowCommandHitData(hit: ActorInputHit): AppMenuHitData | null {
  const data = hit.data;
  if (
    typeof data !== "object" ||
    data === null ||
    !("kind" in data) ||
    !("action" in data)
  ) return null;
  const candidate = data as { kind?: unknown; action?: unknown };
  if (candidate.kind !== "window-command") return null;
  const action = readWindowAction(candidate.action);
  if (!action) return null;
  return {
    kind: "window-command",
    action
  };
}

function readWindowAction(value: unknown): AppMenuWindowAction | null {
  if (typeof value !== "object" || value === null || !("kind" in value)) return null;
  const candidate = value as {
    readonly kind?: unknown;
    readonly typeKey?: unknown;
    readonly identity?: unknown;
  };
  if (
    (candidate.kind === "open-or-focus-type" || candidate.kind === "new-instance") &&
    typeof candidate.typeKey === "string"
  ) {
    return { kind: candidate.kind, typeKey: candidate.typeKey as WindowViewTypeKey };
  }
  if (candidate.kind === "focus-instance" && isWindowViewIdentity(candidate.identity)) {
    return { kind: "focus-instance", identity: candidate.identity };
  }
  return null;
}

function isWindowViewIdentity(value: unknown): value is WindowViewIdentity {
  return (
    typeof value === "object" &&
    value !== null &&
    "typeKey" in value &&
    "instanceId" in value &&
    typeof (value as { readonly typeKey?: unknown }).typeKey === "string" &&
    typeof (value as { readonly instanceId?: unknown }).instanceId === "string"
  );
}

function areWindowActionsEqual(a: AppMenuWindowAction, b: AppMenuWindowAction): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === "focus-instance" && b.kind === "focus-instance") {
    return a.identity.instanceId === b.identity.instanceId;
  }
  if ("typeKey" in a && "typeKey" in b) {
    return a.typeKey === b.typeKey;
  }
  return false;
}

function getMenuItemRole(item: AppMenuItemViewModel): string {
  return item.kind === "checkable-command" ? "menuitemcheckbox" : "menuitem";
}

function isCheckableCommandChecked(item: AppMenuItemViewModel): boolean {
  return item.kind === "checkable-command" ? item.checked : false;
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
