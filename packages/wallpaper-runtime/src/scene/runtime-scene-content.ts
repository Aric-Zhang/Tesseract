import type { Actor, ActorCreationContext } from "actor-system/core";
import type { RuntimeThreeSceneRenderOutput } from "runtime-three";
import {
  camera3MotionComponentType,
  type Camera3MotionComponent
} from "../camera3/camera3-motion-component";
import { createTesseract4Actor } from "../tesseract4/tesseract4-actor-factory";

export const RUNTIME_SCENE_TESSERACT_LABEL = "Tesseract4";

export function createRuntimeSceneTesseract4ActorId(parentActorId: string): string {
  return `${parentActorId}:tesseract-4`;
}

export interface RuntimeSceneContent {
  readonly camera3Motion: Camera3MotionComponent;
  readonly renderOutput: RuntimeThreeSceneRenderOutput;
}

export interface CreateRuntimeSceneContentOptions {
  readonly context: ActorCreationContext;
  readonly parentActor: Actor;
  readonly renderOutput: RuntimeThreeSceneRenderOutput;
}

export function createRuntimeSceneContent(options: CreateRuntimeSceneContentOptions): RuntimeSceneContent {
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
    tesseract4.component.attachToScene(options.renderOutput);
    return {
      camera3Motion,
      renderOutput: options.renderOutput
    };
  } catch (error) {
    options.renderOutput.dispose();
    throw error;
  }
}
