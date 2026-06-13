import type { Actor, ActorCreationContext } from "actor-core";
import type { RuntimeThreeSceneRenderOutput } from "runtime-three";
import { camera3MotionComponentType, type Camera3MotionComponent } from "./camera3/camera3-motion-component";
import { createRuntimeSceneSession, type RuntimeSceneSession } from "./runtime-scene-session";
import { createTesseract4Actor } from "./tesseract4";

export const RUNTIME_SCENE_TESSERACT_LABEL = "Tesseract4";

export function createRuntimeSceneTesseract4ActorId(parentActorId: string): string {
  return `${parentActorId}:tesseract-4`;
}

export interface RuntimeSceneContent {
  readonly camera3Motion: Camera3MotionComponent;
  readonly runtimeScene: RuntimeSceneSession;
  readonly renderOutput: RuntimeThreeSceneRenderOutput;
}

export interface CreateRuntimeSceneContentOptions {
  readonly context: ActorCreationContext;
  readonly parentActor: Actor;
  readonly runtimeScene?: RuntimeSceneSession;
}

export function createRuntimeSceneContent(options: CreateRuntimeSceneContentOptions): RuntimeSceneContent {
  const runtimeScene = options.runtimeScene ?? createRuntimeSceneSession({ id: "runtime-scene" });
  try {
    const camera3Motion = options.context.componentRegistry.addComponent(
      options.parentActor,
      camera3MotionComponentType,
      { distance: 6 }
    );
    const tesseract4 = createTesseract4Actor(options.context, {
      actorId: createRuntimeSceneTesseract4ActorId(options.parentActor.id),
      actorName: RUNTIME_SCENE_TESSERACT_LABEL,
      parentActor: options.parentActor
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
