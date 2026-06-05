import { createRegisteredActor, type RegisteredActor } from "../../actor-runtime";
import type { FeatureActorContext } from "../../runtime/ports";
import { sceneParameterPaths, vec2 } from "../../scene-runtime";
import {
  floatingWindowComponentType,
  type FloatingWindowComponent,
  type FloatingWindowState,
  type WindowFrameIntentSink,
  type WindowTabDragSink
} from "../../window-runtime";
import {
  SCENE_WINDOW_MIN_HEIGHT,
  SCENE_WINDOW_MIN_WIDTH,
  SCENE_WINDOW_PRIORITY_DEVELOP
} from "./scene-window-state";
import {
  sceneModeToggleComponentType,
  type SceneModeToggleComponent,
  sceneViewportComponentType,
  type SceneViewportRendererFactory,
  type SceneViewportResizeObserverFactory,
  type SceneViewportComponent
} from "./components";

export interface SceneWindowActorOptions {
  actorId?: string;
  actorName?: string;
  parent: HTMLElement;
  initialState: FloatingWindowState;
  title?: string;
  priority?: number;
  document?: Pick<Document, "createElement">;
  createRenderer?: SceneViewportRendererFactory;
  createResizeObserver?: SceneViewportResizeObserverFactory;
  devicePixelRatio?: () => number;
  frameIntentSink?: WindowFrameIntentSink;
  tabDragSink?: WindowTabDragSink;
}

export interface RegisteredSceneWindowActor extends RegisteredActor<SceneViewportComponent> {
  readonly window: FloatingWindowComponent;
  readonly viewport: SceneViewportComponent;
  readonly modeToggle: SceneModeToggleComponent;
}

export function createSceneWindowActor(
  context: FeatureActorContext,
  options: SceneWindowActorOptions
): RegisteredSceneWindowActor {
  const actor = context.actorSystem.createActor({
    id: options.actorId,
    name: options.actorName ?? options.actorId
  });
  try {
    const viewActorId = `${actor.id}:view`;
    const window = context.componentRegistry.addComponent(actor, floatingWindowComponentType, {
      id: "floating-window:scene",
      parent: options.parent,
      document: options.document,
      title: options.title ?? "Scene",
      paths: sceneParameterPaths.sceneWindow,
      initialState: options.initialState,
      minSize: vec2(SCENE_WINDOW_MIN_WIDTH, SCENE_WINDOW_MIN_HEIGHT),
      className: "scene-window",
      contentClassName: "scene-window__content",
      priority: options.priority ?? SCENE_WINDOW_PRIORITY_DEVELOP,
      activeViewActorId: viewActorId,
      activeViewKey: "scene",
      frameIntentSink: options.frameIntentSink,
      tabDragSink: options.tabDragSink,
      windowMenu: {
        include: true,
        viewKey: "scene",
        label: "Scene",
        order: 0,
        activationMode: "visible"
      }
    });
    const viewActor = context.actorSystem.createActor({
      id: viewActorId,
      name: `${options.title ?? "Scene"} View`,
      parent: actor
    });
    const viewport = context.componentRegistry.addComponent(viewActor, sceneViewportComponentType, {
      id: "scene-viewport",
      document: options.document ?? options.parent.ownerDocument ?? undefined,
      createRenderer: options.createRenderer,
      createResizeObserver: options.createResizeObserver,
      devicePixelRatio: options.devicePixelRatio
    });
    const modeToggle = context.componentRegistry.addComponent(viewActor, sceneModeToggleComponentType, {
      id: "scene-mode-toggle",
      document: options.document ?? options.parent.ownerDocument ?? undefined
    });
    let untrack: ReturnType<FeatureActorContext["trackRegisteredActor"]> | null = null;
    const baseHandle = createRegisteredActor({
      actorSystem: context.actorSystem,
      actor,
      component: viewport,
      beforeDispose: () => untrack?.dispose()
    });
    const handle: RegisteredSceneWindowActor = {
      actor: baseHandle.actor,
      component: baseHandle.component,
      window: window as FloatingWindowComponent,
      viewport,
      modeToggle,
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
