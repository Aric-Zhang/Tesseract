import { describe, expect, it } from "vitest";
import { installActorInputComponentDefinitions } from "actor-input";
import { ActorSystem, ComponentRegistry } from "../../actor-runtime";
import { installEditorStateObserverComponentDefinitions } from "editor";
import {
  installUiComponentDefinitions,
  menuBarComponentType,
  menuBarItemComponentType,
  menuItemComponentType,
  popupMenuComponentType,
  uiElementComponentType,
  WINDOW_TOP_DOCKED_CHROME_LAYER
} from "ui-framework";
import {
  createSingletonWindowViewIdentity,
  windowViewKey,
  type WindowFrameIntentSink,
  type WindowWorkspaceViewCatalog,
  type WindowWorkspaceViewEntry
} from "../../window-runtime";
import { appMenuAdapterComponentType } from "./app-menu-adapter-component";
import { installAppMenuComponentDefinitions } from "./install-component-definitions";
import { installAppMenuFeature } from "./install-app-menu-feature";
import { themeMenuAdapterComponentType } from "./theme-menu-adapter-component";
import type { WindowMenuPayload } from "./window-menu-items";

class FakeDocument {
  createElement(tagName: string): FakeElement {
    return new FakeElement(this, tagName);
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
    return {
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      left: 0,
      top: 0,
      right: 0,
      bottom: 0,
      toJSON() {
        return this;
      }
    };
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }

  removeAttribute(name: string): void {
    this.attributes.delete(name);
  }
}

function createViewEntry(viewKey: string, actorId: string | null, order: number): WindowWorkspaceViewEntry {
  return {
    identity: createSingletonWindowViewIdentity(windowViewKey(viewKey)),
    viewKey: windowViewKey(viewKey),
    viewActorId: actorId,
    ownerFrameActorId: actorId ? `${viewKey}-frame` : null,
    label: viewKey === "debug" ? "Debug Log" : "Scene",
    order,
    sourceIndex: order,
    group: null,
    enabled: true,
    live: actorId !== null,
    activeInFrame: true,
    visibleInFrame: true,
    ownerFrameVisible: true,
    ownerFrameActiveInHierarchy: true,
    presentation: actorId ? "windowed" : null,
    activationSequence: order
  };
}

function createSubject(entries: WindowWorkspaceViewEntry[] = [
  createViewEntry("scene", "scene-view", 0),
  createViewEntry("debug", "debug-view", 10)
]) {
  const actorSystem = new ActorSystem();
  const componentRegistry = new ComponentRegistry({ actorSystem });
  installActorInputComponentDefinitions(componentRegistry);
  installEditorStateObserverComponentDefinitions(componentRegistry);
  installUiComponentDefinitions(componentRegistry);
  installAppMenuComponentDefinitions(componentRegistry);
  const document = new FakeDocument();
  const hostElement = document.createElement("div");
  const intents: string[] = [];
  const themeSelections: string[] = [];
  let selectedThemeId = "default-dark";
  const themeController = {
    listThemes: () => [
      { id: "default-dark", label: "Default Dark", diagnostics: [] },
      { id: "graphite-blue", label: "Graphite Blue", diagnostics: [] }
    ],
    getSelectedThemeId: () => selectedThemeId,
    getSelectedThemeDiagnostics: () => [],
    setTheme(themeId: string) {
      selectedThemeId = themeId;
      themeSelections.push(themeId);
      return {
        id: themeId,
        label: themeId,
        tokens: {} as never
      };
    }
  };
  const windowCatalog: WindowWorkspaceViewCatalog = {
    listViewEntries: () => entries.map((entry) => ({ ...entry })),
    getViewEntryByIdentity: () => null,
    getViewEntryByActorId: () => null,
    listFrameEntries: () => []
  };
  const windowFrameIntents: WindowFrameIntentSink = {
    requestOpenView: () => {},
    requestCloseFrame: () => {},
    requestCloseView: () => {},
    requestActivateFrameTab: () => {},
    requestCommitDock: () => ({ committed: true, sourceFrameDestroyed: false }),
    requestOpenOrFocusViewType: (typeKey, reason) => intents.push(`open-type:${typeKey}:${reason}`),
    requestCreateViewInstance: (typeKey, reason) => intents.push(`new-instance:${typeKey}:${reason}`),
    requestFocusViewInstance: (identity, reason) => intents.push(`focus-instance:${identity.instanceId}:${reason}`)
  };
  installAppMenuFeature({
    context: {
      actorSystem,
      componentRegistry,
      trackRegisteredActor() {
        return { dispose(): void {} };
      }
    },
    hostElement: hostElement as unknown as HTMLElement,
    windowCatalog,
    windowFrameIntents,
    themeController,
    workspaceModePath: "workspace.mode"
  });
  const adapter = actorSystem.getActor("app-menu-host")?.getComponent(appMenuAdapterComponentType);
  if (!adapter) throw new Error("Expected app menu adapter.");
  return {
    actorSystem,
    componentRegistry,
    hostElement,
    entries,
    intents,
    themeSelections,
    themeController,
    adapter
  };
}

describe("installAppMenuFeature", () => {
  it("creates an Arbor host actor over the borrowed menu slot", () => {
    const { actorSystem, hostElement } = createSubject();
    const hostActor = actorSystem.getActor("app-menu-host");
    const menuBarActor = actorSystem.getActor("app-menu:bar");
    const popupActor = actorSystem.getActor("app-menu-window-popup");
    const editPopupActor = actorSystem.getActor("app-menu-edit-popup");
    const themePopupActor = actorSystem.getActor("app-menu-edit-theme-popup");

    expect(hostActor).not.toBeNull();
    expect(menuBarActor && actorSystem.getParentId(menuBarActor)).toBe("app-menu-host");
    expect(popupActor && actorSystem.getParentId(popupActor)).toBe("app-menu-window");
    expect(editPopupActor && actorSystem.getParentId(editPopupActor)).toBe("app-menu-edit");
    expect(themePopupActor && actorSystem.getParentId(themePopupActor)).toBe("app-menu-edit-theme");
    expect(hostActor?.getComponent(uiElementComponentType)?.element).toBe(hostElement);
    expect(hostElement.children.length).toBe(1);
  });

  it("uses the shared top-docked chrome layer for menu input priority", () => {
    const { actorSystem } = createSubject();
    const menuBar = actorSystem.getActor("app-menu:bar")?.getComponent(menuBarComponentType);
    const popup = actorSystem.getActor("app-menu-window-popup")?.getComponent(popupMenuComponentType);
    const editPopup = actorSystem.getActor("app-menu-edit-popup")?.getComponent(popupMenuComponentType);
    const themePopup = actorSystem.getActor("app-menu-edit-theme-popup")?.getComponent(popupMenuComponentType);

    expect(menuBar?.inputStackPriority).toBe(WINDOW_TOP_DOCKED_CHROME_LAYER);
    expect(popup?.inputStackPriority).toBe(WINDOW_TOP_DOCKED_CHROME_LAYER);
    expect(editPopup?.inputStackPriority).toBe(WINDOW_TOP_DOCKED_CHROME_LAYER);
    expect(themePopup?.inputStackPriority).toBe(WINDOW_TOP_DOCKED_CHROME_LAYER);
  });

  it("installs Edit -> Theme as a generic submenu actor chain", () => {
    const { actorSystem } = createSubject();
    const editItem = actorSystem.getActor("app-menu-edit")?.getComponent(menuBarItemComponentType);
    const themeItem = actorSystem.getActor("app-menu-edit-theme")?.getComponent(menuItemComponentType);
    const themePopup = actorSystem.getActor("app-menu-edit-theme-popup")?.getComponent(popupMenuComponentType);
    const defaultThemeItem = actorSystem.getActor("app-menu:theme-item:theme:default-dark")
      ?.getComponent(menuItemComponentType);
    const graphiteThemeItem = actorSystem.getActor("app-menu:theme-item:theme:graphite-blue")
      ?.getComponent(menuItemComponentType);

    expect(actorSystem.getActor("app-menu-edit")).not.toBeNull();
    expect(editItem?.descriptor.id).toBe("edit");
    expect(themeItem?.descriptor.role).toBe("submenu");
    expect(themePopup).not.toBeNull();
    expect(defaultThemeItem?.descriptor.checked).toBe(true);
    expect(graphiteThemeItem?.descriptor.checked).toBe(false);
  });

  it("routes theme menu activation to the app theme controller once", () => {
    const { actorSystem, themeSelections } = createSubject();
    const adapter = actorSystem.getActor("app-menu-host")?.getComponent(themeMenuAdapterComponentType);
    const graphiteThemeItem = actorSystem.getActor("app-menu:theme-item:theme:graphite-blue")
      ?.getComponent(menuItemComponentType);
    if (!adapter || !graphiteThemeItem) throw new Error("Expected theme menu adapter and item.");

    adapter.activateMenuItem({
      itemActorId: "app-menu:theme-item:theme:graphite-blue",
      itemId: graphiteThemeItem.itemId,
      payload: graphiteThemeItem.payload as never
    });

    expect(themeSelections).toEqual(["graphite-blue"]);
    expect(
      actorSystem.getActor("app-menu:theme-item:theme:graphite-blue")
        ?.getComponent(menuItemComponentType)?.descriptor.checked
    ).toBe(true);
    expect(
      actorSystem.getActor("app-menu:theme-item:theme:default-dark")
        ?.getComponent(menuItemComponentType)?.descriptor.checked
    ).toBe(false);
  });

  it("diffs window menu item actors without duplicating them", () => {
    const { actorSystem, adapter, entries } = createSubject();

    expect(actorSystem.getActor("app-menu:item:type:scene")).not.toBeNull();
    expect(actorSystem.getActor("app-menu:item:type:debug")).not.toBeNull();

    adapter.updateFrame();
    adapter.updateFrame();
    expect(actorSystem.listActors().filter((actor) => actor.id === "app-menu:item:type:scene")).toHaveLength(1);

    entries.splice(1, 1);
    adapter.updateFrame();
    expect(actorSystem.getActor("app-menu:item:type:debug")).toBeNull();

    entries.push(createViewEntry("debug", "debug-view-2", 10));
    adapter.updateFrame();
    expect(actorSystem.getActor("app-menu:item:type:debug")).not.toBeNull();
  });

  it("clears popup highlight when a highlighted window item is removed", () => {
    const { actorSystem, componentRegistry, adapter, entries } = createSubject();
    const popup = actorSystem.getActor("app-menu-window-popup")?.getComponent(popupMenuComponentType);
    const sceneItem = actorSystem.getActor("app-menu:item:type:scene")?.getComponent(menuItemComponentType);
    if (!popup || !sceneItem) throw new Error("Expected popup and Scene item.");

    popup.setOpen(true, { activateFirstItem: true });
    expect(popup.highlightedItemActorId).toBe("app-menu:item:type:scene");

    entries.splice(0, 1);
    adapter.updateFrame();

    expect(actorSystem.getActor("app-menu:item:type:scene")).toBeNull();
    expect(popup.highlightedItemActorId).toBeNull();
    expect(componentRegistry.getComponent(actorSystem.getActor("app-menu-window-popup")!, popupMenuComponentType))
      .toBe(popup);
  });

  it("routes generic menu activation payloads to window lifecycle intents", () => {
    const { actorSystem, adapter, intents } = createSubject();
    const sceneItem = actorSystem.getActor("app-menu:item:type:scene")?.getComponent(menuItemComponentType);
    if (!sceneItem) throw new Error("Expected Scene item.");

    adapter.activateMenuItem({
      itemActorId: "app-menu:item:type:scene",
      itemId: sceneItem.itemId,
      payload: sceneItem.payload as WindowMenuPayload
    });

    expect(intents).toEqual(["open-type:scene:menu"]);
  });

  it("activates a menu item once through actor-input end", () => {
    const { actorSystem, intents } = createSubject();
    const popup = actorSystem.getActor("app-menu-window-popup")?.getComponent(popupMenuComponentType);
    const sceneItem = actorSystem.getActor("app-menu:item:type:scene")?.getComponent(menuItemComponentType);
    if (!popup || !sceneItem) throw new Error("Expected popup and Scene item.");

    popup.setOpen(true);
    popup.onInputEnd({
      hit: {
        componentId: popup.id,
        partId: "menu-item",
        kind: "chrome",
        region: "actor-overlay",
        scopeRoutePriority: 0,
        localRoutePriority: 0,
        hitPriority: 100,
        path: [{
          componentId: popup.id,
          role: "control",
          partId: "menu-item"
        }],
        data: {
          itemActorId: "app-menu:item:type:scene",
          itemId: sceneItem.itemId
        }
      },
      wasClick: true,
      buttons: 0,
      point: { x: 0, y: 0 },
      startPoint: { x: 0, y: 0 },
      pointerId: 1,
      pointerType: "mouse",
      totalDelta: { dx: 0, dy: 0 },
      gizmo: null as never,
      timeStamp: 1
    });

    expect(intents).toEqual(["open-type:scene:menu"]);
    expect(popup.open).toBe(false);
  });
});
