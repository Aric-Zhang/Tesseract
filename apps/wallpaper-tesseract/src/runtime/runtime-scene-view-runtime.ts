import type { Actor, ActorCreationContext } from "actor-core";
import type { RuntimeThreeSceneRenderOutput } from "runtime-three";
import type { RuntimeThreeSceneRendererFactory } from "runtime-three";
import type { Camera3MotionComponent } from "./camera3/camera3-motion-component";
import {
  createRuntimeSceneContent,
  type RuntimeSceneContent
} from "./runtime-scene-content";
import {
  createRenderableSceneView,
  SceneViewFrameSourceRegistry,
  type RuntimeSceneViewPresentationPort
} from "./runtime-scene-frame-source";
import { createRuntimeSceneSession, type RuntimeSceneSession } from "./runtime-scene-session";

export interface CreateRuntimeSceneViewRuntimeOptions {
  readonly id: string;
  readonly createRenderer?: RuntimeThreeSceneRendererFactory;
}

export interface AttachRuntimeSceneViewOptions {
  readonly context: ActorCreationContext;
  readonly sceneActor: Actor;
  readonly presentation: RuntimeSceneViewPresentationPort;
}

export class RuntimeSceneViewRuntime {
  readonly #runtimeScene: RuntimeSceneSession;
  readonly #frameSources: SceneViewFrameSourceRegistry;
  #content: RuntimeSceneContent | null = null;
  #frameSourceRegistration: { dispose(): void } | null = null;
  #disposed = false;

  constructor(options: CreateRuntimeSceneViewRuntimeOptions, frameSources: SceneViewFrameSourceRegistry) {
    this.#runtimeScene = createRuntimeSceneSession({
      id: options.id,
      createRenderer: options.createRenderer
    });
    this.#frameSources = frameSources;
  }

  get renderTarget(): RuntimeThreeSceneRenderOutput {
    return this.#runtimeScene.renderTarget;
  }

  get renderOutput(): RuntimeThreeSceneRenderOutput {
    return this.#content?.renderOutput ?? this.#runtimeScene.renderOutput;
  }

  get camera3Motion(): Camera3MotionComponent {
    const content = this.#content;
    if (!content) {
      throw new Error("Runtime Scene content has not been attached.");
    }
    return content.camera3Motion;
  }

  attachSceneView(options: AttachRuntimeSceneViewOptions): RuntimeSceneContent {
    if (this.#content) {
      throw new Error("Runtime Scene content is already attached.");
    }
    this.#content = createRuntimeSceneContent({
      context: options.context,
      parentActor: options.sceneActor,
      runtimeScene: this.#runtimeScene
    });
    const renderable = createRenderableSceneView({
      presentation: options.presentation,
      camera3Motion: this.#content.camera3Motion,
      renderOutput: this.#content.renderOutput
    });
    this.#frameSourceRegistration = this.#frameSources.register(renderable);
    return this.#content;
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    try {
      this.#frameSourceRegistration?.dispose();
    } finally {
      this.#runtimeScene.dispose();
    }
  }
}

export class RuntimeSceneViewRuntimeRegistry {
  readonly #frameSources = new SceneViewFrameSourceRegistry();

  createRuntime(options: CreateRuntimeSceneViewRuntimeOptions): RuntimeSceneViewRuntime {
    return new RuntimeSceneViewRuntime(options, this.#frameSources);
  }

  measureCurrentView(): void {
    this.#frameSources.current?.measureNow();
  }

  renderCurrentFrameSource(): void {
    this.#frameSources.current?.render();
  }
}
