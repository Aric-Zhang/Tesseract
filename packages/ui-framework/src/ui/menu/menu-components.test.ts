import { describe, expect, it } from "vitest";
import { ActorSystem, ComponentRegistry } from "actor-core";
import {
  actorInputScopeRoutePriority,
  getActorInputScopeRoutePriority,
  installActorInputComponentDefinitions
} from "actor-input";
import {
  installUiComponentDefinitions,
  menuBarComponentType,
  menuBarItemComponentType,
  menuItemComponentType,
  popupMenuComponentType,
  uiElementComponentType,
  type MenuCommand
} from "..";

class FakeDocument {
  elementsAtPoint: FakeElement[] = [];
  readonly defaultView = {
    innerWidth: 1280,
    innerHeight: 720
  };
  readonly documentElement = {
    clientWidth: 1280,
    clientHeight: 720
  };
  readonly #listeners = new Map<string, Set<(event: never) => void>>();

  createElement(tagName: string): FakeElement {
    return new FakeElement(this, tagName);
  }

  elementsFromPoint(): FakeElement[] {
    return this.elementsAtPoint;
  }

  addEventListener(type: string, listener: (event: never) => void): void {
    this.#listeners.set(type, new Set([
      ...(this.#listeners.get(type) ?? []),
      listener
    ]));
  }

  removeEventListener(type: string, listener: (event: never) => void): void {
    this.#listeners.get(type)?.delete(listener);
  }

  dispatch(type: string, event: unknown): void {
    for (const listener of this.#listeners.get(type) ?? []) {
      listener(event as never);
    }
  }
}

class FakeElement {
  readonly ownerDocument: FakeDocument;
  readonly tagName: string;
  readonly style: Record<string, string> = {};
  readonly children: FakeElement[] = [];
  readonly dataset: Record<string, string> = {};
  readonly attributes = new Map<string, string>();
  className = "";
  textContent = "";
  hidden = false;
  type = "";
  disabled = false;
  parentElement: FakeElement | null = null;
  rect: DOMRectReadOnly = createRect(0, 0, 0, 0);

  constructor(ownerDocument: FakeDocument, tagName: string) {
    this.ownerDocument = ownerDocument;
    this.tagName = tagName;
  }

  append(...children: FakeElement[]): void {
    for (const child of children) {
      child.remove();
      child.parentElement = this;
      this.children.push(child);
    }
  }

  replaceChildren(...children: FakeElement[]): void {
    for (const child of this.children) {
      child.parentElement = null;
    }
    this.children.length = 0;
    this.append(...children);
  }

  remove(): void {
    if (!this.parentElement) return;
    const index = this.parentElement.children.indexOf(this);
    if (index >= 0) this.parentElement.children.splice(index, 1);
    this.parentElement = null;
  }

  getBoundingClientRect(): DOMRectReadOnly {
    return this.rect;
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }

  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }

  removeAttribute(name: string): void {
    this.attributes.delete(name);
  }
}

function createRect(x: number, y: number, width: number, height: number): DOMRectReadOnly {
  return {
    x,
    y,
    width,
    height,
    left: x,
    top: y,
    right: x + width,
    bottom: y + height,
    toJSON() {
      return this;
    }
  };
}

function createRegistry(): {
  readonly actorSystem: ActorSystem;
  readonly componentRegistry: ComponentRegistry;
  readonly document: FakeDocument;
} {
  const actorSystem = new ActorSystem();
  const componentRegistry = new ComponentRegistry({ actorSystem });
  installActorInputComponentDefinitions(componentRegistry);
  installUiComponentDefinitions(componentRegistry);
  return {
    actorSystem,
    componentRegistry,
    document: new FakeDocument()
  };
}

function addElement(
  componentRegistry: ComponentRegistry,
  actor: ReturnType<ActorSystem["createActor"]>,
  document: FakeDocument,
  options: { readonly tagName?: "div" | "button"; readonly rect?: DOMRectReadOnly } = {}
): FakeElement {
  const element = componentRegistry.addComponent(actor, uiElementComponentType, {
    tagName: options.tagName ?? "div",
    document: document as unknown as Document
  }).element as unknown as FakeElement;
  element.rect = options.rect ?? element.rect;
  return element;
}

describe("generic menu components", () => {
  it("opens a popup from a menu bar item and activates a generic command payload", () => {
    const { actorSystem, componentRegistry, document } = createRegistry();
    const activated: Array<MenuCommand<{ readonly command: string }>> = [];
    const menuActor = actorSystem.createActor({ id: "menu" });
    const windowActor = actorSystem.createActor({ id: "menu-window", parent: menuActor });
    const popupActor = actorSystem.createActor({ id: "menu-window-popup", parent: windowActor });
    const sceneActor = actorSystem.createActor({ id: "menu-window-scene", parent: popupActor });
    addElement(componentRegistry, menuActor, document, {
      rect: createRect(0, 0, 200, 24)
    });
    addElement(componentRegistry, windowActor, document, {
      tagName: "button",
      rect: createRect(0, 0, 80, 24)
    });
    addElement(componentRegistry, popupActor, document, {
      rect: createRect(0, 28, 180, 32)
    });
    addElement(componentRegistry, sceneActor, document, {
      tagName: "button",
      rect: createRect(4, 32, 172, 24)
    });
    const menu = componentRegistry.addComponent(menuActor, menuBarComponentType, {
      inputStackPriority: 42,
      localRoutePriority: 7
    });
    const windowItem = componentRegistry.addComponent(windowActor, menuBarItemComponentType, {
      descriptor: { id: "window", label: "Window" }
    });
    const popup = componentRegistry.addComponent(popupActor, popupMenuComponentType, {
      commandSink: {
        activateMenuItem(command: MenuCommand<{ readonly command: string }>) {
          activated.push(command);
        }
      },
      inputStackPriority: 42,
      localRoutePriority: 7
    });
    const sceneItem = componentRegistry.addComponent(sceneActor, menuItemComponentType, {
      descriptor: {
        id: "scene",
        label: "Scene",
        payload: { command: "open-scene" }
      }
    });

    const barHit = menu.hitTestInput({ x: 10, y: 12 });
    expect(windowItem.element.parentElement).toBe(menu.element);
    expect(popup.element.parentElement).toBe(windowItem.element);
    expect(barHit?.partId).toBe("menu-bar-item");
    expect(barHit?.localRoutePriority).toBe(7);
    expect(barHit?.scopeRoutePriority).toBeUndefined();
    expect(getActorInputScopeRoutePriority(barHit!)).toBe(actorInputScopeRoutePriority.actorOverlay);
    expect(menu.inputStackPriority).toBe(42);

    menu.onInputEnd({
      hit: barHit!,
      wasClick: true,
      buttons: 0,
      point: { x: 10, y: 12 },
      startPoint: { x: 10, y: 12 },
      pointerId: 1,
      pointerType: "mouse",
      totalDelta: { dx: 0, dy: 0 },
      gizmo: null as never,
      timeStamp: 1
    });

    expect(menu.openItemActorId).toBe("menu-window");
    expect(windowItem.element.dataset.uiMenuOpen).toBe("true");
    expect(popup.open).toBe(true);
    expect(popup.element.hidden).toBe(false);

    const itemHit = popup.hitTestInput({ x: 10, y: 40 });
    expect(sceneItem.element.parentElement).toBe(popup.element);
    expect(itemHit?.partId).toBe("menu-item");
    expect(itemHit?.scopeRoutePriority).toBeUndefined();
    expect(getActorInputScopeRoutePriority(itemHit!)).toBe(actorInputScopeRoutePriority.actorOverlay);
    expect(popup.highlightedItemActorId).toBe("menu-window-scene");
    expect(sceneItem.highlighted).toBe(true);

    popup.onInputEnd({
      hit: itemHit!,
      wasClick: true,
      buttons: 0,
      point: { x: 10, y: 40 },
      startPoint: { x: 10, y: 40 },
      pointerId: 1,
      pointerType: "mouse",
      totalDelta: { dx: 0, dy: 0 },
      gizmo: null as never,
      timeStamp: 2
    });

    expect(activated).toEqual([{
      itemActorId: "menu-window-scene",
      itemId: "scene",
      payload: { command: "open-scene" }
    }]);
    expect(popup.open).toBe(false);
    expect(sceneItem.highlighted).toBe(false);
  });

  it("keeps popup highlight deterministic when item actors are removed", () => {
    const { actorSystem, componentRegistry, document } = createRegistry();
    const popupActor = actorSystem.createActor({ id: "popup" });
    const sceneActor = actorSystem.createActor({ id: "scene", parent: popupActor });
    const debugActor = actorSystem.createActor({ id: "debug", parent: popupActor });
    addElement(componentRegistry, popupActor, document);
    addElement(componentRegistry, sceneActor, document, { tagName: "button" });
    addElement(componentRegistry, debugActor, document, { tagName: "button" });
    const popup = componentRegistry.addComponent(popupActor, popupMenuComponentType, {});
    const scene = componentRegistry.addComponent(sceneActor, menuItemComponentType, {
      descriptor: { id: "scene", label: "Scene" }
    });
    const debug = componentRegistry.addComponent(debugActor, menuItemComponentType, {
      descriptor: { id: "debug", label: "Debug" }
    });

    popup.setOpen(true, { activateFirstItem: true });
    expect(popup.highlightedItemActorId).toBe("scene");
    expect(scene.highlighted).toBe(true);

    actorSystem.destroyActor(sceneActor);
    popup.refreshItems();

    expect(popup.highlightedItemActorId).toBeNull();
    expect(debug.highlighted).toBe(false);
  });

  it("opens submenu actor chains without treating child popup clicks as outside", () => {
    const { actorSystem, componentRegistry, document } = createRegistry();
    const activated: Array<MenuCommand<{ readonly themeId: string }>> = [];
    const editPopupActor = actorSystem.createActor({ id: "edit-popup" });
    const themeItemActor = actorSystem.createActor({ id: "theme-item", parent: editPopupActor });
    const themePopupActor = actorSystem.createActor({ id: "theme-popup", parent: themeItemActor });
    const darkThemeActor = actorSystem.createActor({ id: "theme-dark", parent: themePopupActor });
    const editPopupElement = addElement(componentRegistry, editPopupActor, document, {
      rect: createRect(0, 0, 180, 80)
    });
    const themeItemElement = addElement(componentRegistry, themeItemActor, document, {
      tagName: "button",
      rect: createRect(0, 0, 180, 24)
    });
    const themePopupElement = addElement(componentRegistry, themePopupActor, document, {
      rect: createRect(180, 0, 180, 80)
    });
    const darkThemeElement = addElement(componentRegistry, darkThemeActor, document, {
      tagName: "button",
      rect: createRect(184, 4, 172, 24)
    });
    const editPopup = componentRegistry.addComponent(editPopupActor, popupMenuComponentType, {
      commandSink: {
        activateMenuItem(command: MenuCommand<{ readonly themeId: string }>) {
          activated.push(command);
        }
      }
    });
    const themeItem = componentRegistry.addComponent(themeItemActor, menuItemComponentType, {
      descriptor: {
        id: "theme",
        label: "Theme",
        role: "submenu"
      }
    });
    const themePopup = componentRegistry.addComponent(themePopupActor, popupMenuComponentType, {
      commandSink: {
        activateMenuItem(command: MenuCommand<{ readonly themeId: string }>) {
          activated.push(command);
        }
      }
    });
    componentRegistry.addComponent(darkThemeActor, menuItemComponentType, {
      descriptor: {
        id: "default-dark",
        label: "Default Dark",
        payload: { themeId: "default-dark" }
      }
    });

    editPopup.setOpen(true);

    const submenuHit = editPopup.hitTestInput({ x: 10, y: 10 });
    expect(submenuHit?.partId).toBe("menu-item");
    editPopup.onInputEnd({
      hit: submenuHit!,
      wasClick: true,
      buttons: 0,
      point: { x: 10, y: 10 },
      startPoint: { x: 10, y: 10 },
      pointerId: 1,
      pointerType: "mouse",
      totalDelta: { dx: 0, dy: 0 },
      gizmo: null as never,
      timeStamp: 1
    });

    expect(activated).toEqual([]);
    expect(editPopup.open).toBe(true);
    expect(themePopup.open).toBe(true);
    expect(themeItem.element.dataset.uiMenuSubmenuOpen).toBe("true");
    expect(themeItem.element.getAttribute("aria-expanded")).toBe("true");
    expect(themePopupElement.parentElement).toBe(themeItemElement);
    expect(darkThemeElement.parentElement).toBe(themePopupElement);

    document.dispatch("pointerdown", { target: darkThemeElement });
    expect(editPopup.open).toBe(true);
    expect(themePopup.open).toBe(true);

    const leafHit = themePopup.hitTestInput({ x: 190, y: 10 });
    expect(leafHit?.partId).toBe("menu-item");
    themePopup.onInputEnd({
      hit: leafHit!,
      wasClick: true,
      buttons: 0,
      point: { x: 190, y: 10 },
      startPoint: { x: 190, y: 10 },
      pointerId: 1,
      pointerType: "mouse",
      totalDelta: { dx: 0, dy: 0 },
      gizmo: null as never,
      timeStamp: 2
    });

    expect(activated).toEqual([{
      itemActorId: "theme-dark",
      itemId: "default-dark",
      payload: { themeId: "default-dark" }
    }]);
    expect(editPopup.open).toBe(false);
    expect(themePopup.open).toBe(false);
    expect(editPopupElement.dataset.uiMenuOpenSubmenuItemActorId).toBe("");
  });

  it("flips submenu popups away from the viewport edge", () => {
    const { actorSystem, componentRegistry, document } = createRegistry();
    document.defaultView.innerWidth = 320;
    document.documentElement.clientWidth = 320;
    const editPopupActor = actorSystem.createActor({ id: "edit-popup" });
    const themeItemActor = actorSystem.createActor({ id: "theme-item", parent: editPopupActor });
    const themePopupActor = actorSystem.createActor({ id: "theme-popup", parent: themeItemActor });
    addElement(componentRegistry, editPopupActor, document, {
      rect: createRect(0, 0, 180, 80)
    });
    const themeItemElement = addElement(componentRegistry, themeItemActor, document, {
      tagName: "button",
      rect: createRect(220, 10, 92, 24)
    });
    const themePopupElement = addElement(componentRegistry, themePopupActor, document, {
      rect: createRect(316, 10, 158, 80)
    });
    const editPopup = componentRegistry.addComponent(editPopupActor, popupMenuComponentType, {});
    componentRegistry.addComponent(themeItemActor, menuItemComponentType, {
      descriptor: {
        id: "theme",
        label: "Theme",
        role: "submenu"
      }
    });
    const themePopup = componentRegistry.addComponent(themePopupActor, popupMenuComponentType, {});

    editPopup.setOpen(true);
    editPopup.onInputEnd({
      hit: {
        componentId: editPopup.id,
        partId: "menu-item",
        kind: "chrome",
        region: "actor-overlay",
        localRoutePriority: 0,
        hitPriority: 100,
        path: [],
        data: {
          itemActorId: themeItemActor.id,
          itemId: "theme"
        }
      },
      wasClick: true,
      buttons: 0,
      point: { x: 230, y: 20 },
      startPoint: { x: 230, y: 20 },
      pointerId: 1,
      pointerType: "mouse",
      totalDelta: { dx: 0, dy: 0 },
      gizmo: null as never,
      timeStamp: 1
    });

    expect(themePopup.open).toBe(true);
    expect(themePopupElement.parentElement).toBe(themeItemElement);
    expect(themePopupElement.style.left).toBe("auto");
    expect(themePopupElement.style.right).toBe("calc(100% + 4px)");
  });

  it("does not hit menu bar items covered by another DOM element", () => {
    const { actorSystem, componentRegistry, document } = createRegistry();
    const menuActor = actorSystem.createActor({ id: "menu" });
    const itemActor = actorSystem.createActor({ id: "menu-window", parent: menuActor });
    const menuElement = addElement(componentRegistry, menuActor, document, {
      rect: createRect(0, 0, 120, 24)
    });
    const itemElement = addElement(componentRegistry, itemActor, document, {
      tagName: "button",
      rect: createRect(0, 0, 80, 24)
    });
    const cover = document.createElement("div");
    document.elementsAtPoint = [cover];
    const menu = componentRegistry.addComponent(menuActor, menuBarComponentType, {});
    componentRegistry.addComponent(itemActor, menuBarItemComponentType, {
      descriptor: { id: "window", label: "Window" }
    });
    menu.refreshItems();

    expect(itemElement.parentElement).toBe(menuElement);
    expect(menu.hitTestInput({ x: 10, y: 10 })).toBeNull();
  });

  it("does not hit popup menu items covered by another DOM element", () => {
    const { actorSystem, componentRegistry, document } = createRegistry();
    const popupActor = actorSystem.createActor({ id: "popup" });
    const itemActor = actorSystem.createActor({ id: "scene", parent: popupActor });
    const popupElement = addElement(componentRegistry, popupActor, document, {
      rect: createRect(0, 0, 120, 80)
    });
    const itemElement = addElement(componentRegistry, itemActor, document, {
      tagName: "button",
      rect: createRect(0, 0, 120, 24)
    });
    const cover = document.createElement("div");
    document.elementsAtPoint = [cover];
    const popup = componentRegistry.addComponent(popupActor, popupMenuComponentType, {});
    componentRegistry.addComponent(itemActor, menuItemComponentType, {
      descriptor: { id: "scene", label: "Scene" }
    });
    popup.setOpen(true);

    expect(itemElement.parentElement).toBe(popupElement);
    expect(popup.hitTestInput({ x: 10, y: 10 })).toBeNull();
  });

  it("skips disabled items during keyboard-style selection", () => {
    const { actorSystem, componentRegistry, document } = createRegistry();
    const popupActor = actorSystem.createActor({ id: "popup" });
    const disabledActor = actorSystem.createActor({ id: "disabled", parent: popupActor });
    const enabledActor = actorSystem.createActor({ id: "enabled", parent: popupActor });
    addElement(componentRegistry, popupActor, document);
    addElement(componentRegistry, disabledActor, document, { tagName: "button" });
    addElement(componentRegistry, enabledActor, document, { tagName: "button" });
    const popup = componentRegistry.addComponent(popupActor, popupMenuComponentType, {});
    componentRegistry.addComponent(disabledActor, menuItemComponentType, {
      descriptor: { id: "disabled", label: "Disabled", enabled: false }
    });
    const enabled = componentRegistry.addComponent(enabledActor, menuItemComponentType, {
      descriptor: { id: "enabled", label: "Enabled" }
    });

    popup.setOpen(true, { activateFirstItem: true });

    expect(popup.highlightedItemActorId).toBe("enabled");
    expect(enabled.highlighted).toBe(true);
  });
});
