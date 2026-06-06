import { createRegisteredActor, type RegisteredActor } from "../../actor-runtime";
import type { FeatureActorContext } from "../../runtime/ports";
import type {
  WindowFrameIntentSink,
  WindowWorkspaceViewCatalog
} from "../../window-runtime";
import {
  appMenuBarComponentType,
  type AppMenuBarComponent,
  type AppMenuWorkspaceMode
} from "./app-menu-bar-component";

export interface AppMenuBarActorOptions {
  readonly actorId?: string;
  readonly actorName?: string;
  readonly parent: HTMLElement;
  readonly windowCatalog: WindowWorkspaceViewCatalog;
  readonly windowFrameIntents?: WindowFrameIntentSink;
  readonly initialMode?: AppMenuWorkspaceMode;
  readonly document?: Pick<Document, "createElement">;
}

export function createAppMenuBarActor(
  context: FeatureActorContext,
  options: AppMenuBarActorOptions
): RegisteredActor<AppMenuBarComponent> {
  const actor = context.actorSystem.createActor({
    id: options.actorId,
    name: options.actorName ?? options.actorId
  });
  try {
    const component = context.componentRegistry.addComponent(actor, appMenuBarComponentType, {
      id: "app-menu-bar",
      parent: options.parent,
      document: options.document ?? options.parent.ownerDocument ?? undefined,
      windowCatalog: options.windowCatalog,
      windowFrameIntents: options.windowFrameIntents,
      initialMode: options.initialMode
    });
    let untrack: ReturnType<FeatureActorContext["trackRegisteredActor"]> | null = null;
    const handle = createRegisteredActor({
      actorSystem: context.actorSystem,
      actor,
      component,
      beforeDispose: () => untrack?.dispose()
    });
    untrack = context.trackRegisteredActor(handle);
    return handle;
  } catch (error) {
    if (context.actorSystem.hasActor(actor)) {
      context.actorSystem.destroyActor(actor);
    }
    throw error;
  }
}
