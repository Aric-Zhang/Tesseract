import type { Actor, ActorCreationContext } from "actor-core";
import type { RuntimeThreeSceneRendererFactory } from "runtime-three";
import {
  createRuntimeThreeSceneRenderOutput,
  type RuntimeThreeSceneRenderOutput
} from "runtime-three";
import {
  createRuntimeSceneContent,
  type RuntimeSceneContent
} from "./runtime-scene-content";
import {
  createRenderableSceneView,
  SceneViewFrameSourceRegistry,
  type RuntimeSceneViewVisibilityPort
} from "./runtime-scene-frame-source";

export interface CreateRuntimeSceneViewRuntimeOptions {
  readonly id: string;
  readonly createRenderer?: RuntimeThreeSceneRendererFactory;
}

export interface AttachRuntimeSceneViewOptions {
  readonly context: ActorCreationContext;
  readonly sceneActor: Actor;
  readonly presentation: RuntimeSceneViewVisibilityPort;
}

export interface RuntimeSceneViewRuntime {
  readonly renderTarget: RuntimeThreeSceneRenderOutput;
  attachSceneView(options: AttachRuntimeSceneViewOptions): RuntimeSceneContent;
  dispose(): void;
}

class WallpaperRuntimeSceneViewRuntime implements RuntimeSceneViewRuntime {
  readonly #renderOutput: RuntimeThreeSceneRenderOutput;
  readonly #frameSources: SceneViewFrameSourceRegistry;
  #content: RuntimeSceneContent | null = null;
  #frameSourceRegistration: { dispose(): void } | null = null;
  #disposed = false;

  constructor(options: CreateRuntimeSceneViewRuntimeOptions, frameSources: SceneViewFrameSourceRegistry) {
    this.#renderOutput = createRuntimeThreeSceneRenderOutput({
      id: options.id,
      createRenderer: options.createRenderer
    });
    this.#frameSources = frameSources;
  }

  get renderTarget(): RuntimeThreeSceneRenderOutput {
    return this.#renderOutput;
  }

  attachSceneView(options: AttachRuntimeSceneViewOptions): RuntimeSceneContent {
    if (this.#content) {
      throw new Error("Runtime Scene content is already attached.");
    }
    this.#content = createRuntimeSceneContent({
      context: options.context,
      parentActor: options.sceneActor,
      renderOutput: this.#renderOutput
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
      this.#renderOutput.dispose();
    }
  }
}

export class RuntimeSceneViewRuntimeRegistry {
  readonly #frameSources = new SceneViewFrameSourceRegistry();

  createRuntime(options: CreateRuntimeSceneViewRuntimeOptions): RuntimeSceneViewRuntime {
    return new WallpaperRuntimeSceneViewRuntime(options, this.#frameSources);
  }

  measureCurrentView(): void {
    this.#frameSources.current?.measureNow();
  }

  renderCurrentFrameSource(): void {
    this.#frameSources.current?.render();
  }
}
