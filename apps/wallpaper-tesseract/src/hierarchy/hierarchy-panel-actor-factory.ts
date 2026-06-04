import { createRegisteredActor } from "../actor-runtime";
import type { FeatureActorContext } from "../runtime/ports";
import { sceneParameterPaths, vec2 } from "../scene-runtime";
import {
  floatingWindowComponentType,
  type FloatingWindowComponent,
  type FloatingWindowState,
  type RegisteredWindowActor
} from "../window-runtime";
import {
  HIERARCHY_WINDOW_MIN_HEIGHT,
  HIERARCHY_WINDOW_MIN_WIDTH
} from "./hierarchy-panel-state";
import {
  hierarchyPanelComponentType,
  type HierarchyPanelComponent
} from "./hierarchy-panel-component";
import type { HierarchyObjectSource } from "./hierarchy-object-source";

export interface HierarchyPanelActorOptions {
  actorId?: string;
  actorName?: string;
  parent: HTMLElement;
  initialWindowState: FloatingWindowState;
  objectSource: HierarchyObjectSource;
  priority?: number;
  title?: string;
  document?: Pick<Document, "createElement">;
}

export function createHierarchyPanelActor(
  context: FeatureActorContext,
  options: HierarchyPanelActorOptions
): RegisteredWindowActor<HierarchyPanelComponent> {
  const actor = context.actorSystem.createActor({
    id: options.actorId,
    name: options.actorName ?? options.actorId
  });
  try {
    const windowComponent = context.componentRegistry.addComponent(actor, floatingWindowComponentType, {
      id: "floating-window:hierarchy",
      parent: options.parent,
      document: options.document,
      title: options.title ?? "Hierarchy",
      paths: sceneParameterPaths.hierarchyWindow,
      initialState: options.initialWindowState,
      minSize: vec2(HIERARCHY_WINDOW_MIN_WIDTH, HIERARCHY_WINDOW_MIN_HEIGHT),
      className: "hierarchy-window",
      priority: options.priority ?? 1100
    });
    const component = context.componentRegistry.addComponent(actor, hierarchyPanelComponentType, {
      id: "hierarchy-panel",
      objectSource: options.objectSource,
      document: options.document ?? options.parent.ownerDocument ?? undefined
    });
    let untrack: ReturnType<FeatureActorContext["trackRegisteredActor"]> | null = null;
    const baseHandle = createRegisteredActor({
      actorSystem: context.actorSystem,
      actor,
      component,
      beforeDispose: () => untrack?.dispose()
    });
    const handle: RegisteredWindowActor<HierarchyPanelComponent> = {
      actor: baseHandle.actor,
      component: baseHandle.component,
      window: windowComponent as FloatingWindowComponent,
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
