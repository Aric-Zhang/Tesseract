import { createRegisteredActor } from "../../actor-runtime";
import {
  menuBarComponentType,
  menuBarItemComponentType,
  menuItemComponentType,
  popupMenuComponentType,
  uiElementComponentType,
  uiLayoutHostComponentType,
  uiLayoutItemComponentType,
  WINDOW_TOP_DOCKED_CHROME_LAYER
} from "ui-framework";
import type {
  UiActorContext,
  WindowFrameIntentSink,
  WindowWorkspaceViewCatalog
} from "../../window-runtime";
import type { AppMenuThemeController } from "./app-menu-theme-port";
import {
  appMenuAdapterComponentType,
  type AppMenuAdapterComponent,
  type AppMenuWorkspaceMode
} from "./app-menu-adapter-component";
import {
  themeMenuAdapterComponentType,
  type ThemeMenuAdapterComponent
} from "./theme-menu-adapter-component";

const APP_MENU_HOST_ACTOR_ID = "app-menu-host";
const APP_MENU_HOST_ACTOR_NAME = "App Menu Host";
const APP_MENU_BAR_ACTOR_ID = "app-menu:bar";
const APP_MENU_BAR_ACTOR_NAME = "App Menu";
const WINDOW_MENU_ITEM_ACTOR_ID = "app-menu-window";
const WINDOW_MENU_POPUP_ACTOR_ID = "app-menu-window-popup";
const EDIT_MENU_ITEM_ACTOR_ID = "app-menu-edit";
const EDIT_MENU_POPUP_ACTOR_ID = "app-menu-edit-popup";
const THEME_MENU_ITEM_ACTOR_ID = "app-menu-edit-theme";
const THEME_MENU_POPUP_ACTOR_ID = "app-menu-edit-theme-popup";

export interface InstallAppMenuFeatureOptions {
  readonly context: UiActorContext;
  readonly actorId?: string;
  readonly actorName?: string;
  readonly hostElement: HTMLElement;
  readonly windowCatalog: WindowWorkspaceViewCatalog;
  readonly windowFrameIntents: WindowFrameIntentSink;
  readonly themeController: AppMenuThemeController;
  readonly workspaceModePath: string;
  readonly initialMode?: AppMenuWorkspaceMode;
}

export function installAppMenuFeature(options: InstallAppMenuFeatureOptions): void {
  const hostActor = options.context.actorSystem.createActor({
    id: options.actorId ?? APP_MENU_HOST_ACTOR_ID,
    name: options.actorName ?? APP_MENU_HOST_ACTOR_NAME
  });
  try {
    options.context.componentRegistry.addComponent(hostActor, uiElementComponentType, {
      element: options.hostElement,
      ownership: "borrowed"
    });
    const hostLayout = options.context.componentRegistry.addComponent(hostActor, uiLayoutHostComponentType, {});

    const menuBarActor = options.context.actorSystem.createActor({
      id: APP_MENU_BAR_ACTOR_ID,
      name: APP_MENU_BAR_ACTOR_NAME,
      parent: hostActor
    });
    options.context.componentRegistry.addComponent(menuBarActor, uiElementComponentType, {
      tagName: "div",
      document: options.hostElement.ownerDocument
    });
    options.context.componentRegistry.addComponent(menuBarActor, uiLayoutItemComponentType, {
      slot: "fill"
    });
    const menuBar = options.context.componentRegistry.addComponent(menuBarActor, menuBarComponentType, {
      inputStackPriority: WINDOW_TOP_DOCKED_CHROME_LAYER
    });

    const windowItemActor = options.context.actorSystem.createActor({
      id: WINDOW_MENU_ITEM_ACTOR_ID,
      name: "Window Menu",
      parent: menuBarActor
    });
    options.context.componentRegistry.addComponent(windowItemActor, uiElementComponentType, {
      tagName: "button",
      document: options.hostElement.ownerDocument
    });
    options.context.componentRegistry.addComponent(windowItemActor, menuBarItemComponentType, {
      descriptor: {
        id: "window",
        label: "Window"
      }
    });

    const popupActor = options.context.actorSystem.createActor({
      id: WINDOW_MENU_POPUP_ACTOR_ID,
      name: "Window Menu Popup",
      parent: windowItemActor
    });
    options.context.componentRegistry.addComponent(popupActor, uiElementComponentType, {
      tagName: "div",
      document: options.hostElement.ownerDocument
    });

    const editItemActor = options.context.actorSystem.createActor({
      id: EDIT_MENU_ITEM_ACTOR_ID,
      name: "Edit Menu",
      parent: menuBarActor
    });
    options.context.componentRegistry.addComponent(editItemActor, uiElementComponentType, {
      tagName: "button",
      document: options.hostElement.ownerDocument
    });
    options.context.componentRegistry.addComponent(editItemActor, menuBarItemComponentType, {
      descriptor: {
        id: "edit",
        label: "Edit"
      }
    });
    const editPopupActor = options.context.actorSystem.createActor({
      id: EDIT_MENU_POPUP_ACTOR_ID,
      name: "Edit Menu Popup",
      parent: editItemActor
    });
    options.context.componentRegistry.addComponent(editPopupActor, uiElementComponentType, {
      tagName: "div",
      document: options.hostElement.ownerDocument
    });
    const themeItemActor = options.context.actorSystem.createActor({
      id: THEME_MENU_ITEM_ACTOR_ID,
      name: "Theme Menu",
      parent: editPopupActor
    });
    options.context.componentRegistry.addComponent(themeItemActor, uiElementComponentType, {
      tagName: "button",
      document: options.hostElement.ownerDocument
    });
    options.context.componentRegistry.addComponent(themeItemActor, menuItemComponentType, {
      descriptor: {
        id: "theme",
        label: "Theme",
        role: "submenu"
      }
    });
    const themePopupActor = options.context.actorSystem.createActor({
      id: THEME_MENU_POPUP_ACTOR_ID,
      name: "Theme Menu Popup",
      parent: themeItemActor
    });
    options.context.componentRegistry.addComponent(themePopupActor, uiElementComponentType, {
      tagName: "div",
      document: options.hostElement.ownerDocument
    });

    const adapter = options.context.componentRegistry.addComponent(hostActor, appMenuAdapterComponentType, {
      actorSystem: options.context.actorSystem,
      componentRegistry: options.context.componentRegistry,
      hostActor,
      menuBarActor,
      popupActor,
      windowCatalog: options.windowCatalog,
      windowFrameIntents: options.windowFrameIntents,
      workspaceModePath: options.workspaceModePath,
      initialMode: options.initialMode,
      document: options.hostElement.ownerDocument
    });
    options.context.componentRegistry.addComponent(popupActor, popupMenuComponentType, {
      commandSink: adapter,
      inputStackPriority: WINDOW_TOP_DOCKED_CHROME_LAYER
    });
    options.context.componentRegistry.addComponent(editPopupActor, popupMenuComponentType, {
      inputStackPriority: WINDOW_TOP_DOCKED_CHROME_LAYER
    });
    const themeAdapter = options.context.componentRegistry.addComponent(hostActor, themeMenuAdapterComponentType, {
      actorSystem: options.context.actorSystem,
      componentRegistry: options.context.componentRegistry,
      menuBarActor,
      themePopupActor,
      themeController: options.themeController,
      document: options.hostElement.ownerDocument
    });
    options.context.componentRegistry.addComponent(themePopupActor, popupMenuComponentType, {
      commandSink: themeAdapter,
      inputStackPriority: WINDOW_TOP_DOCKED_CHROME_LAYER
    });
    let untrack: ReturnType<UiActorContext["trackRegisteredActor"]> | null = null;
    const handle = createRegisteredActor<AppMenuAdapterComponent>({
      actorSystem: options.context.actorSystem,
      actor: hostActor,
      component: adapter,
      beforeDispose: () => untrack?.dispose()
    });
    untrack = options.context.trackRegisteredActor(handle);
    let untrackTheme: ReturnType<UiActorContext["trackRegisteredActor"]> | null = null;
    const themeHandle = createRegisteredActor<ThemeMenuAdapterComponent>({
      actorSystem: options.context.actorSystem,
      actor: hostActor,
      component: themeAdapter,
      beforeDispose: () => untrackTheme?.dispose()
    });
    untrackTheme = options.context.trackRegisteredActor(themeHandle);
    adapter.refreshMenuItems();
    themeAdapter.refreshMenuItems();
    menuBar.refreshItems();
    hostLayout.refreshLayout();
  } catch (error) {
    if (options.context.actorSystem.hasActor(hostActor)) {
      options.context.actorSystem.destroyActor(hostActor);
    }
    throw error;
  }
}
