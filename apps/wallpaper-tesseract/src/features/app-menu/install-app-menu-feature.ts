import type { FeatureActorContext } from "../../runtime/ports";
import type { UiLayoutPath, WindowFrameIntentSink, WindowWorkspaceViewCatalog } from "../../window-runtime";
import { createAppMenuBarActor } from "./app-menu-bar-actor-factory";
import type { AppMenuWorkspaceMode } from "./app-menu-bar-component";

export interface InstallAppMenuFeatureOptions {
  readonly context: FeatureActorContext;
  readonly actorId: string;
  readonly actorName: string;
  readonly parent: HTMLElement;
  readonly windowCatalog: WindowWorkspaceViewCatalog;
  readonly windowFrameIntents: WindowFrameIntentSink;
  readonly workspaceModePath: UiLayoutPath<AppMenuWorkspaceMode>;
}

export function installAppMenuFeature(options: InstallAppMenuFeatureOptions): void {
  createAppMenuBarActor(options.context, {
    actorId: options.actorId,
    actorName: options.actorName,
    parent: options.parent,
    windowCatalog: options.windowCatalog,
    windowFrameIntents: options.windowFrameIntents,
    workspaceModePath: options.workspaceModePath
  });
}
