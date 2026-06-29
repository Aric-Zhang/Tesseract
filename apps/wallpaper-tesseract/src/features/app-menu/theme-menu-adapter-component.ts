import type {
  Actor,
  ActorSystem,
  Component,
  ComponentRegistry,
  ComponentType
} from "../../actor-runtime";
import type { MenuCommand } from "ui-framework";
import {
  menuBarComponentType,
  menuItemComponentType,
  popupMenuComponentType,
  uiElementComponentType
} from "ui-framework";
import type { AppMenuThemeController } from "./app-menu-theme-port";
import {
  createThemeMenuItems,
  type ThemeMenuPayload
} from "./theme-menu-items";

export const themeMenuAdapterComponentType =
  "theme-menu-adapter-component" as ComponentType<ThemeMenuAdapterComponent>;

export interface ThemeMenuAdapterComponentOptions {
  readonly id?: string;
  readonly actorSystem: ActorSystem;
  readonly componentRegistry: ComponentRegistry;
  readonly menuBarActor: Actor;
  readonly themePopupActor: Actor;
  readonly themeController: AppMenuThemeController;
  readonly document?: Pick<Document, "createElement">;
}

interface ThemeItemActorRecord {
  readonly descriptorId: string;
  readonly actor: Actor;
}

export class ThemeMenuAdapterComponent implements Component {
  readonly type = themeMenuAdapterComponentType;
  readonly actor: Actor;
  readonly id: string;
  enabled = true;

  readonly #actorSystem: ActorSystem;
  readonly #componentRegistry: ComponentRegistry;
  readonly #menuBarActor: Actor;
  readonly #themePopupActor: Actor;
  readonly #themeController: AppMenuThemeController;
  readonly #document?: Pick<Document, "createElement">;
  readonly #itemActors = new Map<string, ThemeItemActorRecord>();
  #lastSignature = "";
  #disposed = false;

  constructor(actor: Actor, options: ThemeMenuAdapterComponentOptions) {
    this.actor = actor;
    this.id = options.id ?? "theme-menu-adapter";
    this.#actorSystem = options.actorSystem;
    this.#componentRegistry = options.componentRegistry;
    this.#menuBarActor = options.menuBarActor;
    this.#themePopupActor = options.themePopupActor;
    this.#themeController = options.themeController;
    this.#document = options.document;
    this.refreshMenuItems();
  }

  refreshMenuItems(): void {
    this.syncMenuItems();
  }

  activateMenuItem(command: MenuCommand<ThemeMenuPayload>): void {
    const themeId = command.payload?.action.themeId;
    if (!themeId) return;
    this.#themeController.setTheme(themeId);
    this.#componentRegistry.getComponent(this.#themePopupActor, popupMenuComponentType)?.setOpen(false);
    this.refreshMenuItems();
  }

  dispose(): void {
    this.#disposed = true;
    this.enabled = false;
    this.destroyStaleItemActors(new Set());
  }

  private syncMenuItems(): void {
    if (this.#disposed) return;
    const descriptors = createThemeMenuItems(
      this.#themeController.listThemes(),
      this.#themeController.getSelectedThemeId()
    );
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
    this.#componentRegistry.getComponent(this.#themePopupActor, popupMenuComponentType)?.refreshItems();
    this.#componentRegistry.getComponent(this.#menuBarActor, menuBarComponentType)?.refreshItems();
  }

  private getOrCreateItemActor(descriptorId: string): ThemeItemActorRecord {
    const existing = this.#itemActors.get(descriptorId);
    if (existing && this.#actorSystem.hasActor(existing.actor)) return existing;
    const actor = this.#actorSystem.createActor({
      id: createThemeMenuItemActorId(descriptorId),
      name: descriptorId,
      parent: this.#themePopupActor
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

  private resolveDocument(): Pick<Document, "createElement"> {
    if (this.#document) return this.#document;
    const popupElement = this.#componentRegistry.getComponent(this.#themePopupActor, uiElementComponentType)?.element;
    if (popupElement?.ownerDocument) return popupElement.ownerDocument;
    if (typeof document !== "undefined") return document;
    throw new Error("ThemeMenuAdapterComponent requires a document.");
  }
}

function createThemeMenuItemActorId(descriptorId: string): string {
  return `app-menu:theme-item:${descriptorId.replace(/[^a-zA-Z0-9:_-]/g, "-")}`;
}
