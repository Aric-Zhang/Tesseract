import type { Actor, ActorCreationContext } from "actor-core";
import type { RuntimeThreeSceneRenderOutput } from "runtime-three";
import { camera3MotionComponentType, type Camera3MotionComponent } from "./camera3/camera3-motion-component";
import { createRuntimeSceneSession, type RuntimeSceneSession } from "./runtime-scene-session";
import { createTesseract4Actor } from "./tesseract4";

export interface RuntimeSceneContentActorIds {
  readonly sceneWindowActorId: string;
  readonly tesseract4ActorId: string;
  readonly tesseract4ActorName: string;
}

export interface RuntimeSceneContent {
  readonly camera3Motion: Camera3MotionComponent;
  readonly runtimeScene: RuntimeSceneSession;
  readonly renderOutput: RuntimeThreeSceneRenderOutput;
}

export interface CreateRuntimeSceneContentOptions {
  readonly context: ActorCreationContext;
  readonly actorIds: RuntimeSceneContentActorIds;
  readonly sceneActor: Actor;
  readonly runtimeScene?: RuntimeSceneSession;
}

export function createRuntimeSceneContent(options: CreateRuntimeSceneContentOptions): RuntimeSceneContent {
  const runtimeScene = options.runtimeScene ?? createRuntimeSceneSession({
    id: `${options.actorIds.sceneWindowActorId}:view:render-output`
  });
  try {
    const camera3Motion = options.context.componentRegistry.addComponent(
      options.sceneActor,
      camera3MotionComponentType,
      { distance: 6 }
    );
    const tesseract4 = createTesseract4Actor(options.context, {
      actorId: options.actorIds.tesseract4ActorId,
      actorName: options.actorIds.tesseract4ActorName,
      parentActor: options.sceneActor
    });
    tesseract4.component.attachToScene(runtimeScene);
    return {
      camera3Motion,
      runtimeScene,
      renderOutput: runtimeScene.renderOutput
    };
  } catch (error) {
    runtimeScene.dispose();
    throw error;
  }
}
