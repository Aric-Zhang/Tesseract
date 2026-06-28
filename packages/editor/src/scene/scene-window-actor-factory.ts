import { createRegisteredActor, type Actor, type ActorCreationContext, type RegisteredActor } from "actor-core";
import {
  fullscreenableViewComponentType,
  renderViewportComponentType,
  uiElementComponentType,
  uiLayoutHostComponentType,
  uiLayoutItemComponentType,
  type FullscreenableViewComponent,
  type FullscreenableViewIntentSink,
  type RenderViewportComponent,
  type RenderViewportResizeObserverFactory,
  type RenderViewportTarget,
  type WindowContentRegistrationPort
} from "ui-framework";
import {
  sceneViewContentComponentType,
  type SceneViewContentComponent
} from "./components";

export interface SceneViewActorOptions {
  actorId?: string;
  actorName?: string;
  parentActor: Actor;
  document?: Pick<Document, "createElement">;
  createResizeObserver?: RenderViewportResizeObserverFactory;
  renderTarget: RenderViewportTarget;
  devicePixelRatio?: () => number;
  contentId: string;
  contentRegistration: WindowContentRegistrationPort;
  fullscreenIntentSink: FullscreenableViewIntentSink;
}

export interface RegisteredSceneViewActor extends RegisteredActor<SceneViewContentComponent> {
  readonly sceneActor: Actor;
  readonly content: SceneViewContentComponent;
  readonly worldRenderActor: Actor;
  readonly renderViewport: RenderViewportComponent;
  readonly fullscreenableView: FullscreenableViewComponent;
  disposeRuntimeTracking?(): void;
}

export function createSceneViewActor(
  context: ActorCreationContext,
  options: SceneViewActorOptions
): RegisteredSceneViewActor {
  const actor = context.actorSystem.createActor({
    id: options.actorId,
    name: options.actorName ?? options.actorId,
    parent: options.parentActor
  });
  try {
    context.componentRegistry.addComponent(actor, uiElementComponentType, {
      className: "scene-view",
      tagName: "section",
      document: options.document
    });
    context.componentRegistry.addComponent(actor, uiLayoutHostComponentType, {
      id: "scene-view-layout"
    });
    const content = context.componentRegistry.addComponent(actor, sceneViewContentComponentType, {
      id: "scene-view-content",
      contentId: options.contentId,
      contentRegistration: options.contentRegistration
    });
    const worldRenderActor = context.actorSystem.createActor({
      id: `${actor.id}:world-render-view`,
      name: "World Render View",
      parent: actor
    });
    context.componentRegistry.addComponent(worldRenderActor, uiElementComponentType, {
      className: "scene-world-render-view",
      tagName: "div",
      document: options.document
    });
    context.componentRegistry.addComponent(worldRenderActor, uiLayoutItemComponentType, {
      id: "scene-world-render-layout-item",
      slot: "fill",
      stretch: "both"
    });
    const renderViewport = context.componentRegistry.addComponent(worldRenderActor, renderViewportComponentType, {
      id: "scene-world-render-viewport",
      target: options.renderTarget,
      targetOwnership: "borrowed",
      createResizeObserver: options.createResizeObserver,
      devicePixelRatio: options.devicePixelRatio
    });
    const fullscreenableView = context.componentRegistry.addComponent(
      worldRenderActor,
      fullscreenableViewComponentType,
      {
        id: "scene-world-render-fullscreen",
        document: options.document,
        intentSink: options.fullscreenIntentSink
      }
    );
    const layout = context.componentRegistry.getComponent(actor, uiLayoutHostComponentType);
    layout?.refreshLayout();
    let untrack: ReturnType<ActorCreationContext["trackRegisteredActor"]> | null = null;
    const baseHandle = createRegisteredActor({
      actorSystem: context.actorSystem,
      actor,
      component: content,
      beforeDispose: () => untrack?.dispose()
    });
    const handle: RegisteredSceneViewActor = {
      actor: baseHandle.actor,
      component: baseHandle.component,
      sceneActor: actor,
      content,
      worldRenderActor,
      renderViewport,
      fullscreenableView,
      dispose: () => {
        baseHandle.dispose();
      },
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
