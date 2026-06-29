import type {
  Actor,
  ActorSystem,
  Component,
  ComponentRegistry,
  ComponentType
} from "../../actor-runtime";
import type { EditorStateChangedEvent, StateObserverResponder } from "editor";
import { type FrameUpdateParticipant } from "ui-framework/actor-ui";
import { type MenuCommand } from "ui-framework/menu";
import { menuBarComponentType, menuItemComponentType, popupMenuComponentType } from "ui-framework/menu";
import { uiElementComponentType } from "ui-framework/actor-ui";
import type {
  WindowFrameIntentSink,
  WindowWorkspaceViewCatalog
} from "../../window-runtime";
import {
  createWindowMenuItems,
  type WindowMenuPayload
} from "./window-menu-items";

export const appMenuAdapterComponentType =
  "app-menu-adapter-component" as ComponentType<AppMenuAdapterComponent>;

export type AppMenuWorkspaceMode = "run" | "develop";

export interface AppMenuAdapterComponentOptions {
  readonly id?: string;
  readonly actorSystem: ActorSystem;
  readonly componentRegistry: ComponentRegistry;
  readonly hostActor: Actor;
  readonly menuBarActor: Actor;
  readonly popupActor: Actor;
  readonly windowCatalog: WindowWorkspaceViewCatalog;
  readonly windowFrameIntents: WindowFrameIntentSink;
  readonly workspaceModePath: string;
  readonly initialMode?: AppMenuWorkspaceMode;
  readonly document?: Pick<Document, "createElement">;
}

interface MenuItemActorRecord {
  readonly descriptorId: string;
  readonly actor: Actor;
}

export class AppMenuAdapterComponent
implements Component, FrameUpdateParticipant, StateObserverResponder {
  readonly type = appMenuAdapterComponentType;
  readonly actor: Actor;
  readonly id: string;
  enabled = true;

  readonly #actorSystem: ActorSystem;
  readonly #componentRegistry: ComponentRegistry;
  readonly #hostActor: Actor;
  readonly #menuBarActor: Actor;
  readonly #popupActor: Actor;
  readonly #windowCatalog: WindowWorkspaceViewCatalog;
  readonly #windowFrameIntents: WindowFrameIntentSink;
  readonly #workspaceModePath: string;
  readonly #document?: Pick<Document, "createElement">;
  readonly #itemActors = new Map<string, MenuItemActorRecord>();
  #mode: AppMenuWorkspaceMode;
  #lastSignature = "";
  #disposed = false;

  constructor(actor: Actor, options: AppMenuAdapterComponentOptions) {
    this.actor = actor;
    this.id = options.id ?? "app-menu-adapter";
    this.#actorSystem = options.actorSystem;
    this.#componentRegistry = options.componentRegistry;
    this.#hostActor = options.hostActor;
    this.#menuBarActor = options.menuBarActor;
    this.#popupActor = options.popupActor;
    this.#windowCatalog = options.windowCatalog;
    this.#windowFrameIntents = options.windowFrameIntents;
    this.#workspaceModePath = options.workspaceModePath;
    this.#document = options.document;
    this.#mode = options.initialMode ?? "develop";
    this.applyMode();
    this.syncMenuItems();
  }

  updateFrame(): void {
    this.refreshMenuItems();
  }

  refreshMenuItems(): void {
    this.syncMenuItems();
  }

  onStateChanged(event: EditorStateChangedEvent): void {
    const modeChange = event.changes.find((change) => change.path === this.#workspaceModePath);
    if (!modeChange) return;
    this.#mode = modeChange.nextValue as AppMenuWorkspaceMode;
    this.applyMode();
  }

  activateMenuItem(command: MenuCommand<WindowMenuPayload>): void {
    const action = command.payload?.action;
    if (!action) return;
    if (action.kind === "open-or-focus-type") {
      this.#windowFrameIntents.requestOpenOrFocusViewType?.(action.typeKey, "menu");
      return;
    }
    if (action.kind === "new-instance") {
      this.#windowFrameIntents.requestCreateViewInstance?.(action.typeKey, "menu");
      return;
    }
    this.#windowFrameIntents.requestFocusViewInstance?.(action.identity, "menu");
  }

  dispose(): void {
    this.#disposed = true;
    this.enabled = false;
    this.destroyStaleItemActors(new Set());
  }

  private syncMenuItems(): void {
    if (this.#disposed) return;
    const descriptors = createWindowMenuItems(this.#windowCatalog.listViewEntries());
    const signature = JSON.stringify(descriptors);
    if (signature === this.#lastSignature) return;
    this.#lastSignature = signature;
    const activeIds = new Set<string>();
    for (const descriptor of descriptors) {
      activeIds.add(descriptor.id);
      const record = this.getOrCreateItemActor(descriptor.id);
      this.#componentRegistry.getComponent(record.actor, menuItemComponentType)?.setDescriptor(descriptor);
    }
    this.destroyStaleItemActors(activeIds);
    this.#componentRegistry.getComponent(this.#popupActor, popupMenuComponentType)?.refreshItems();
    this.#componentRegistry.getComponent(this.#menuBarActor, menuBarComponentType)?.refreshItems();
  }

  private getOrCreateItemActor(descriptorId: string): MenuItemActorRecord {
    const existing = this.#itemActors.get(descriptorId);
    if (existing && this.#actorSystem.hasActor(existing.actor)) return existing;
    const actor = this.#actorSystem.createActor({
      id: createMenuItemActorId(descriptorId),
      name: descriptorId,
      parent: this.#popupActor
    });
    this.#componentRegistry.addComponent(actor, uiElementComponentType, {
      tagName: "button",
      document: this.resolveDocument()
    });
    this.#componentRegistry.addComponent(actor, menuItemComponentType, {
      descriptor: {
        id: descriptorId,
        label: descriptorId
      }
    });
    const record = { descriptorId, actor };
    this.#itemActors.set(descriptorId, record);
    return record;
  }

  private destroyStaleItemActors(activeIds: ReadonlySet<string>): void {
    for (const [descriptorId, record] of [...this.#itemActors]) {
      if (activeIds.has(descriptorId)) continue;
      this.#itemActors.delete(descriptorId);
      if (this.#actorSystem.hasActor(record.actor)) {
        this.#actorSystem.destroyActor(record.actor);
      }
    }
  }

  private applyMode(): void {
    const visible = this.#mode === "develop";
    const hostElement = this.#componentRegistry.getComponent(this.#hostActor, uiElementComponentType);
    hostElement?.setHidden(!visible);
    if (!visible) {
      this.#componentRegistry.getComponent(this.#menuBarActor, menuBarComponentType)?.closeOpenMenu();
    }
  }

  private resolveDocument(): Pick<Document, "createElement"> {
    if (this.#document) return this.#document;
    const popupElement = this.#componentRegistry.getComponent(this.#popupActor, uiElementComponentType)?.element;
    if (popupElement?.ownerDocument) return popupElement.ownerDocument;
    if (typeof document !== "undefined") return document;
    throw new Error("AppMenuAdapterComponent requires a document.");
  }
}

function createMenuItemActorId(descriptorId: string): string {
  return `app-menu:item:${descriptorId.replace(/[^a-zA-Z0-9:_-]/g, "-")}`;
}
