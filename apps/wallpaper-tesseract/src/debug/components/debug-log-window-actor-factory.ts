import { createRegisteredActor } from "../../actor-runtime";
import type { FeatureActorContext } from "../../runtime/ports";
import { sceneParameterPaths, vec2 } from "../../scene-runtime";
import {
  floatingWindowComponentType,
  type FloatingWindowComponent,
  type FloatingWindowState,
  type RegisteredWindowActor
} from "../../window-runtime";
import {
  DEBUG_WINDOW_MIN_HEIGHT,
  DEBUG_WINDOW_MIN_WIDTH
} from "../debug-window-parameters";
import {
  debugLogContentComponentType,
  type DebugLogContentComponent
} from "./debug-log-content-component";

export interface DebugLogWindowActorOptions {
  actorId?: string;
  actorName?: string;
  parent: HTMLElement;
  initialState: FloatingWindowState;
  maxLines?: number;
  title?: string;
  priority?: number;
  document?: Pick<Document, "createElement">;
}

export function createDebugLogWindowActor(
  context: FeatureActorContext,
  options: DebugLogWindowActorOptions
): RegisteredWindowActor<DebugLogContentComponent> {
  const actor = context.actorSystem.createActor({
    id: options.actorId,
    name: options.actorName ?? options.actorId
  });
  try {
    const window = context.componentRegistry.addComponent(actor, floatingWindowComponentType, {
      id: "floating-window:debug-log",
      parent: options.parent,
      document: options.document,
      title: options.title ?? "Debug Log",
      paths: sceneParameterPaths.debugWindow,
      initialState: options.initialState,
      minSize: vec2(DEBUG_WINDOW_MIN_WIDTH, DEBUG_WINDOW_MIN_HEIGHT),
      className: "debug-log-window",
      priority: options.priority ?? 1000
    });
    const component = context.componentRegistry.addComponent(actor, debugLogContentComponentType, {
      id: "debug-log-content",
      maxLines: options.maxLines,
      document: options.document ?? options.parent.ownerDocument ?? undefined
    });
    let untrack: ReturnType<FeatureActorContext["trackRegisteredActor"]> | null = null;
    const baseHandle = createRegisteredActor({
      actorSystem: context.actorSystem,
      actor,
      component,
      beforeDispose: () => untrack?.dispose()
    });
    const handle: RegisteredWindowActor<DebugLogContentComponent> = {
      actor: baseHandle.actor,
      component: baseHandle.component,
      window: window as FloatingWindowComponent,
      dispose: () => baseHandle.dispose()
    };
    untrack = context.trackRegisteredActor(handle);
    return handle;
  } catch (error) {
    if (context.actorSystem.hasActor(actor)) {
      context.actorSystem.destroyActor(actor);
    }
    throw error;
  }
}
