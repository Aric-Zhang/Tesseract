import type { UiActorContext, WindowFrameIntentSink, WindowWorkspaceViewCatalog } from "../../window-runtime";
import { createAppMenuBarActor } from "./app-menu-bar-actor-factory";

export const APP_MENU_BAR_ACTOR_ID = "app-menu-bar";
export const APP_MENU_BAR_ACTOR_NAME = "App Menu";

export function createAppMenuActorHierarchyMetadata(): Record<string, { readonly label: string; readonly order: number }> {
  return {
    [APP_MENU_BAR_ACTOR_ID]: { label: APP_MENU_BAR_ACTOR_NAME, order: 1020 }
  };
}

export interface InstallAppMenuFeatureOptions {
  readonly context: UiActorContext;
  readonly actorId?: string;
  readonly actorName?: string;
  readonly parent: HTMLElement;
  readonly windowCatalog: WindowWorkspaceViewCatalog;
  readonly windowFrameIntents: WindowFrameIntentSink;
  readonly workspaceModePath: string;
}

export function installAppMenuFeature(options: InstallAppMenuFeatureOptions): void {
  createAppMenuBarActor(options.context, {
    actorId: options.actorId ?? APP_MENU_BAR_ACTOR_ID,
    actorName: options.actorName ?? APP_MENU_BAR_ACTOR_NAME,
    parent: options.parent,
    windowCatalog: options.windowCatalog,
    windowFrameIntents: options.windowFrameIntents,
    workspaceModePath: options.workspaceModePath
  });
}
