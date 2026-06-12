import type { ActorSystemView } from "actor-core";
import type { WindowViewLocationSource } from "ui-framework";
import type { RegisteredSceneViewActor } from "./scene-window-actor-factory";

export interface EditorSceneViewHost {
  readonly viewActorId: string;
  measureNow(): void;
  isVisibleInCurrentLocation(): boolean;
}

export interface CreateEditorSceneViewHostOptions {
  readonly actorSystem: ActorSystemView;
  readonly locations: WindowViewLocationSource;
  readonly sceneView: RegisteredSceneViewActor;
}

export function createEditorSceneViewHost(options: CreateEditorSceneViewHostOptions): EditorSceneViewHost {
  const viewActorId = options.sceneView.viewport.actor.id;
  return {
    viewActorId,
    measureNow() {
      options.sceneView.viewport.measureNow();
    },
    isVisibleInCurrentLocation() {
      const location = options.locations.getLocationByViewActorId(viewActorId);
      return location !== null &&
        location.ownerFrameVisible &&
        location.ownerFrameActiveInHierarchy &&
        location.visibleInFrame &&
        options.actorSystem.hasActor(options.sceneView.viewport.actor) &&
        options.actorSystem.isActorActive(options.sceneView.viewport.actor);
    }
  };
}
