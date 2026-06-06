import type { ActorSystemView } from "../../actor-runtime";
import type { Camera3MotionComponent } from "../camera3/components";
import type { WindowViewLocationSource } from "../../window-runtime";
import type { RegisteredSceneViewActor } from "./scene-window-actor-factory";

export interface RenderableSceneView {
  readonly viewActorId: string;
  measureNow(): void;
  isRenderable(): boolean;
  render(): void;
}

export interface RenderableSceneViewSource {
  readonly current: RenderableSceneView | null;
}

export interface RenderableSceneViewRegistry extends RenderableSceneViewSource {
  setCurrent(view: RenderableSceneView): void;
  clear(view: RenderableSceneView): void;
}

export class CurrentRenderableSceneViewRegistry implements RenderableSceneViewRegistry {
  #current: RenderableSceneView | null = null;

  get current(): RenderableSceneView | null {
    return this.#current;
  }

  setCurrent(view: RenderableSceneView): void {
    this.#current = view;
  }

  clear(view: RenderableSceneView): void {
    if (this.#current === view) {
      this.#current = null;
    }
  }
}

export interface CreateRenderableSceneViewOptions {
  readonly actorSystem: ActorSystemView;
  readonly locations: WindowViewLocationSource;
  readonly sceneView: RegisteredSceneViewActor;
  readonly camera3Motion: Camera3MotionComponent;
}

export function createRenderableSceneView(options: CreateRenderableSceneViewOptions): RenderableSceneView {
  const viewActorId = options.sceneView.viewport.actor.id;
  return {
    viewActorId,
    measureNow() {
      options.sceneView.viewport.measureNow();
    },
    isRenderable() {
      const location = options.locations.getLocationByViewActorId(viewActorId);
      return location !== null &&
        location.ownerFrameVisible &&
        location.ownerFrameActiveInHierarchy &&
        location.visibleInFrame &&
        options.actorSystem.hasActor(options.sceneView.viewport.actor) &&
        options.actorSystem.isActorActive(options.sceneView.viewport.actor);
    },
    render() {
      const location = options.locations.getLocationByViewActorId(viewActorId);
      if (
        location === null ||
        !location.ownerFrameVisible ||
        !location.ownerFrameActiveInHierarchy ||
        !location.visibleInFrame ||
        !options.actorSystem.hasActor(options.sceneView.viewport.actor) ||
        !options.actorSystem.isActorActive(options.sceneView.viewport.actor)
      ) {
        return;
      }
      options.sceneView.viewport.render(options.camera3Motion.activeCamera);
    }
  };
}
