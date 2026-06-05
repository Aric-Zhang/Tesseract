import * as THREE from "three";
import { Camera3MotionController } from "../camera3-control";
import {
  createCamera3GizmoActor
} from "../gizmos/camera3";
import type { Camera3GizmoViewFactory } from "../gizmos/camera3/components";
import {
  Camera3ProjectionModeController,
  Camera3Rig
} from "../features/camera3/model";
import {
  createSceneWindowActor,
  type RegisteredSceneWindowActor
} from "../features/scene";
import type {
  SceneViewportRendererFactory,
  SceneViewportResizeObserverFactory
} from "../features/scene/components";
import type { FeatureActorContext } from "../runtime/ports";
import type { RuntimeObject, RuntimeRegistration } from "../scene-runtime";
import { createTesseract4Actor } from "../tesseract4";
import type {
  FloatingWindowComponent,
  FloatingWindowState,
  WindowFrameIntentSink,
  WindowViewLocationSource,
  WindowTabDragSink
} from "../window-runtime";

export interface SceneViewRuntimeContext extends FeatureActorContext {
  registerLegacyRuntimeObject(object: RuntimeObject): RuntimeRegistration;
}

export interface SceneViewRuntimeActorIds {
  readonly sceneWindowActorId: string;
  readonly sceneWindowActorName: string;
  readonly camera3GizmoActorId: string;
  readonly camera3GizmoActorName: string;
  readonly tesseract4ActorId: string;
  readonly tesseract4ActorName: string;
}

export interface SceneViewRuntimeOptions {
  readonly context: SceneViewRuntimeContext;
  readonly mount: HTMLElement;
  readonly initialState: FloatingWindowState;
  readonly actorIds: SceneViewRuntimeActorIds;
  readonly createRenderer?: SceneViewportRendererFactory;
  readonly createResizeObserver?: SceneViewportResizeObserverFactory;
  readonly createCamera3Gizmo?: Camera3GizmoViewFactory;
  readonly devicePixelRatio?: () => number;
  readonly frameIntentSink?: WindowFrameIntentSink;
  readonly tabDragSink?: WindowTabDragSink;
  readonly viewLocationSource: WindowViewLocationSource;
}

export interface SceneViewRuntimeDisposeOptions {
  readonly destroyActorTree?: boolean;
}

export class CurrentSceneViewSource {
  #current: SceneViewRuntime | null = null;

  get current(): SceneViewRuntime | null {
    return this.#current;
  }

  setCurrent(runtime: SceneViewRuntime): void {
    this.#current = runtime;
  }

  clear(runtime: SceneViewRuntime): void {
    if (this.#current === runtime) {
      this.#current = null;
    }
  }
}

export class SceneViewRuntime {
  readonly sceneWindow!: RegisteredSceneWindowActor;
  readonly camera3Motion!: Camera3MotionController;
  readonly #context: SceneViewRuntimeContext;
  readonly #viewLocationSource: WindowViewLocationSource;
  readonly #sceneViewActorId: string;
  #motionRegistration: RuntimeRegistration | null = null;
  #camera3MotionObserver: RuntimeRegistration | null = null;
  #sceneViewportResizeObserver: RuntimeRegistration | null = null;
  #disposed = false;

  constructor(options: SceneViewRuntimeOptions) {
    const { actorIds, context } = options;
    this.#context = context;
    this.#viewLocationSource = options.viewLocationSource;
    let sceneWindow: RegisteredSceneWindowActor | null = null;
    let camera3Motion: Camera3MotionController | null = null;
    let camera3MotionObserver: RuntimeRegistration | null = null;
    let sceneViewportResizeObserver: RuntimeRegistration | null = null;
    let motionRegistration: RuntimeRegistration | null = null;

    try {
      sceneWindow = createSceneWindowActor(context, {
        actorId: actorIds.sceneWindowActorId,
        actorName: actorIds.sceneWindowActorName,
        parent: options.mount,
        initialState: options.initialState,
        createRenderer: options.createRenderer,
        createResizeObserver: options.createResizeObserver,
        devicePixelRatio: options.devicePixelRatio,
        frameIntentSink: options.frameIntentSink,
        tabDragSink: options.tabDragSink
      });

      const camera3Projection = new Camera3ProjectionModeController();
      const camera3Rig = new Camera3Rig({
        target: new THREE.Vector3(0, 0, 0),
        distance: 6
      });
      camera3Motion = new Camera3MotionController({
        rig: camera3Rig,
        projectionMode: camera3Projection
      });
      const activeCamera3Motion = camera3Motion;
      const camera3Gizmo = createCamera3GizmoActor(context, {
        actorId: actorIds.camera3GizmoActorId,
        actorName: actorIds.camera3GizmoActorName,
        projectionMode: camera3Projection,
        commandSink: activeCamera3Motion,
        parent: sceneWindow.viewport.overlayElement,
        parentActor: sceneWindow.viewport.actor
      }, options.createCamera3Gizmo);
      camera3MotionObserver = activeCamera3Motion.subscribe({
        onCamera3MotionChanged: () => camera3Gizmo.component.update()
      });
      sceneViewportResizeObserver = sceneWindow.viewport.subscribeResize(({ width, height }) => {
        camera3Projection.resize(width, height, activeCamera3Motion.distance);
        camera3Gizmo.component.update();
      });
      const initialViewportSize = sceneWindow.viewport.getSize();
      if (initialViewportSize) {
        camera3Projection.resize(initialViewportSize.width, initialViewportSize.height, activeCamera3Motion.distance);
        camera3Gizmo.component.update();
      } else {
        sceneWindow.viewport.measureNow();
      }
      motionRegistration = context.registerLegacyRuntimeObject(activeCamera3Motion);

      createTesseract4Actor(context, {
        actorId: actorIds.tesseract4ActorId,
        actorName: actorIds.tesseract4ActorName,
        scene: sceneWindow.viewport.scene,
        parentActor: sceneWindow.viewport.actor
      });

      this.sceneWindow = sceneWindow;
      this.#sceneViewActorId = sceneWindow.viewport.actor.id;
      this.camera3Motion = camera3Motion;
      this.#camera3MotionObserver = camera3MotionObserver;
      this.#sceneViewportResizeObserver = sceneViewportResizeObserver;
      this.#motionRegistration = motionRegistration;
    } catch (error) {
      disposeSceneViewConstruction({
        sceneWindow,
        camera3Motion,
        camera3MotionObserver,
        sceneViewportResizeObserver,
        motionRegistration
      });
      throw error;
    }
  }

  get actor() {
    return this.sceneWindow.actor;
  }

  get window(): FloatingWindowComponent {
    return this.sceneWindow.window;
  }

  measureNow(): void {
    if (this.#disposed) return;
    this.sceneWindow.viewport.measureNow();
  }

  isRenderable(): boolean {
    const location = this.#viewLocationSource.getLocationByViewActorId(this.#sceneViewActorId);
    return !this.#disposed &&
      location !== null &&
      location.ownerFrameVisible &&
      location.ownerFrameActiveInHierarchy &&
      location.visibleInFrame &&
      this.#context.actorSystem.hasActor(this.sceneWindow.viewport.actor) &&
      this.#context.actorSystem.isActorActive(this.sceneWindow.viewport.actor);
  }

  render(): void {
    if (!this.isRenderable()) return;
    this.sceneWindow.viewport.render(this.camera3Motion.activeCamera);
  }

  dispose(options: SceneViewRuntimeDisposeOptions = {}): void {
    this.disposeRuntimeResources();
    if (options.destroyActorTree !== false) {
      this.sceneWindow.dispose();
    }
  }

  disposeRuntimeResources(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#sceneViewportResizeObserver?.dispose();
    this.#sceneViewportResizeObserver = null;
    this.#camera3MotionObserver?.dispose();
    this.#camera3MotionObserver = null;
    this.#motionRegistration?.dispose();
    this.#motionRegistration = null;
    this.camera3Motion.dispose();
  }
}

function disposeSceneViewConstruction(options: {
  readonly sceneWindow: RegisteredSceneWindowActor | null;
  readonly camera3Motion: Camera3MotionController | null;
  readonly camera3MotionObserver: RuntimeRegistration | null;
  readonly sceneViewportResizeObserver: RuntimeRegistration | null;
  readonly motionRegistration: RuntimeRegistration | null;
}): void {
  options.sceneViewportResizeObserver?.dispose();
  options.camera3MotionObserver?.dispose();
  options.motionRegistration?.dispose();
  options.camera3Motion?.dispose();
  options.sceneWindow?.dispose();
}
