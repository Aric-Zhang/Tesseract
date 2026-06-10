import { createRegisteredActor, type Actor, type RegisteredActor } from "../actor-runtime";
import type { FeatureActorContext } from "../runtime/ports";
import { editorWindowLayoutPaths } from "../editor/window-layout-state";
import {
  floatingWindowComponentType,
  uiVec2,
  type FloatingWindowComponent,
  type FloatingWindowState,
  type RegisteredWindowActor,
  type WindowFrameIntentSink,
  type WindowFramePortRegistry,
  type WindowTabDragSink
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
  frameIntentSink?: WindowFrameIntentSink;
  framePortRegistry?: WindowFramePortRegistry;
  tabDragSink?: WindowTabDragSink;
}

export interface HierarchyPanelViewActorOptions {
  actorId?: string;
  actorName?: string;
  parentActor: Actor;
  objectSource: HierarchyObjectSource;
  document?: Pick<Document, "createElement">;
}

export interface RegisteredHierarchyPanelViewActor extends RegisteredActor<HierarchyPanelComponent> {
  disposeRuntimeTracking?(): void;
}

export function createHierarchyPanelViewActor(
  context: FeatureActorContext,
  options: HierarchyPanelViewActorOptions
): RegisteredHierarchyPanelViewActor {
  const actor = context.actorSystem.createActor({
    id: options.actorId,
    name: options.actorName ?? options.actorId,
    parent: options.parentActor
  });
  try {
    const component = context.componentRegistry.addComponent(actor, hierarchyPanelComponentType, {
      id: "hierarchy-panel",
      objectSource: options.objectSource,
      document: options.document
    });
    let untrack: ReturnType<FeatureActorContext["trackRegisteredActor"]> | null = null;
    const baseHandle = createRegisteredActor({
      actorSystem: context.actorSystem,
      actor,
      component,
      beforeDispose: () => untrack?.dispose()
    });
    const handle: RegisteredHierarchyPanelViewActor = {
      actor: baseHandle.actor,
      component: baseHandle.component,
      dispose: () => baseHandle.dispose(),
      disposeRuntimeTracking: () => {
        untrack?.dispose();
        untrack = null;
      }
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

export function createHierarchyPanelActor(
  context: FeatureActorContext,
  options: HierarchyPanelActorOptions
): RegisteredWindowActor<HierarchyPanelComponent> {
  const actor = context.actorSystem.createActor({
    id: options.actorId,
    name: options.actorName ?? options.actorId
  });
  try {
    const viewActorId = `${actor.id}:view`;
    const windowComponent = context.componentRegistry.addComponent(actor, floatingWindowComponentType, {
      id: "floating-window:hierarchy",
      parent: options.parent,
      document: options.document,
      title: options.title ?? "Hierarchy",
      paths: editorWindowLayoutPaths.hierarchyWindow,
      initialState: options.initialWindowState,
      minSize: uiVec2(HIERARCHY_WINDOW_MIN_WIDTH, HIERARCHY_WINDOW_MIN_HEIGHT),
      className: "hierarchy-window",
      priority: options.priority ?? 1100,
      activeViewActorId: viewActorId,
      activeViewKey: "hierarchy",
      frameIntentSink: options.frameIntentSink,
      framePortRegistry: options.framePortRegistry,
      tabDragSink: options.tabDragSink,
      windowMenu: {
        viewKey: "hierarchy"
      }
    });
    const viewActor = context.actorSystem.createActor({
      id: viewActorId,
      name: `${options.title ?? "Hierarchy"} View`,
      parent: actor
    });
    const component = context.componentRegistry.addComponent(viewActor, hierarchyPanelComponentType, {
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
      dispose: () => baseHandle.dispose(),
      disposeRuntimeTracking: () => {
        untrack?.dispose();
        untrack = null;
      }
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
