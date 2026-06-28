import { createRegisteredActor } from "../../actor-runtime";
import {
  menuBarComponentType,
  menuBarItemComponentType,
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
import {
  appMenuAdapterComponentType,
  type AppMenuAdapterComponent,
  type AppMenuWorkspaceMode
} from "./app-menu-adapter-component";

const APP_MENU_HOST_ACTOR_ID = "app-menu-host";
const APP_MENU_HOST_ACTOR_NAME = "App Menu Host";
const APP_MENU_BAR_ACTOR_ID = "app-menu:bar";
const APP_MENU_BAR_ACTOR_NAME = "App Menu";
const WINDOW_MENU_ITEM_ACTOR_ID = "app-menu-window";
const WINDOW_MENU_POPUP_ACTOR_ID = "app-menu-window-popup";

export interface InstallAppMenuFeatureOptions {
  readonly context: UiActorContext;
  readonly actorId?: string;
  readonly actorName?: string;
  readonly hostElement: HTMLElement;
  readonly windowCatalog: WindowWorkspaceViewCatalog;
  readonly windowFrameIntents: WindowFrameIntentSink;
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
    let untrack: ReturnType<UiActorContext["trackRegisteredActor"]> | null = null;
    const handle = createRegisteredActor<AppMenuAdapterComponent>({
      actorSystem: options.context.actorSystem,
      actor: hostActor,
      component: adapter,
      beforeDispose: () => untrack?.dispose()
    });
    untrack = options.context.trackRegisteredActor(handle);
    adapter.refreshMenuItems();
    menuBar.refreshItems();
    hostLayout.refreshLayout();
  } catch (error) {
    if (options.context.actorSystem.hasActor(hostActor)) {
      options.context.actorSystem.destroyActor(hostActor);
    }
    throw error;
  }
}
