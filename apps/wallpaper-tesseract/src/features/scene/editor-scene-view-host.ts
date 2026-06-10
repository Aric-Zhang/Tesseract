import type * as THREE from "three";
import type { ActorSystemView } from "../../actor-runtime";
import type { WindowViewLocationSource } from "../../window-runtime";
import type { RegisteredSceneViewActor } from "./scene-window-actor-factory";

export interface EditorSceneViewHost {
  readonly viewActorId: string;
  measureNow(): void;
  isVisibleInCurrentLocation(): boolean;
  renderWithCamera(camera: THREE.Camera): void;
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
    },
    renderWithCamera(camera) {
      options.sceneView.viewport.render(camera);
    }
  };
}
