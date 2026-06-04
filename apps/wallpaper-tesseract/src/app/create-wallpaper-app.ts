import * as THREE from "three";
import { GizmoEventSystem } from "gizmo-core";
import { AppRuntimeContext } from "../app-runtime";
import { Camera3MotionController } from "../camera3-control";
import {
  createDebugLogWindowActor,
  createDefaultDebugWindowState,
  registerDebugWindowParameters
} from "../debug";
import {
  createCamera3GizmoActor
} from "../gizmos/camera3";
import {
  Camera3ProjectionModeController,
  Camera3Rig
} from "../features/camera3/model";
import {
  createDefaultSceneWindowState,
  createSceneWindowActor,
  registerSceneWindowParameters
} from "../features/scene";
import { createAppMenuBarActor } from "../features/app-menu";
import {
  createActorHierarchyObjectSource,
  createDefaultHierarchyPanelState,
  createHierarchyPanelActor,
  registerHierarchyPanelParameters
} from "../hierarchy";
import {
  FrameStateController,
  sceneParameterPaths,
  SceneFrameClock,
  SceneParameterStore,
  SceneRuntime
} from "../scene-runtime";
import type { SceneStateObserverRegistry } from "../runtime/ports";
import { createTesseract4Actor } from "../tesseract4";
import {
  createWindowControlSource,
  WindowVisibilityActivationController
} from "../window-runtime";
import {
  APP_MENU_BAR_ACTOR_ID,
  APP_MENU_BAR_ACTOR_NAME,
  CAMERA3_GIZMO_ACTOR_ID,
  CAMERA3_GIZMO_ACTOR_NAME,
  DEBUG_LOG_WINDOW_ACTOR_ID,
  DEBUG_LOG_WINDOW_ACTOR_NAME,
  HIERARCHY_PANEL_ACTOR_ID,
  HIERARCHY_PANEL_ACTOR_NAME,
  SCENE_WINDOW_ACTOR_ID,
  SCENE_WINDOW_ACTOR_NAME,
  TESSERACT4_ACTOR_ID,
  TESSERACT4_ACTOR_NAME
} from "./app-actor-ids";
import { installWallpaperComponentDefinitions } from "./install-component-definitions";
import { ImmediateUpdateScheduler } from "./immediate-update-scheduler";
import { RenderLoop } from "./render-loop";
import {
  registerWorkspaceModeParameters,
  WorkspaceModeController
} from "./workspace-mode";

export interface WallpaperApp {
  dispose(): void;
}

export function createWallpaperApp(mount: HTMLElement): WallpaperApp {
  mount.replaceChildren();

  const sceneRuntime = new SceneRuntime();
  const frameClock = new SceneFrameClock();
  const sceneStore = new SceneParameterStore();
  const sceneWindowState = createDefaultSceneWindowState();
  const debugWindowState = createDefaultDebugWindowState();
  const hierarchyPanelState = createDefaultHierarchyPanelState();
  registerSceneWindowParameters(sceneStore, sceneWindowState);
  registerDebugWindowParameters(sceneStore, debugWindowState);
  registerHierarchyPanelParameters(sceneStore, hierarchyPanelState);
  registerWorkspaceModeParameters(sceneStore);

  let isUpdatingFrame = false;
  const immediateUpdates = new ImmediateUpdateScheduler({
    update,
    isUpdatingFrame: () => isUpdatingFrame
  });

  const frameStateController = new FrameStateController({ store: sceneStore });
  const frameStateBridge: SceneStateObserverRegistry = {
    submit(command) {
      frameStateController.submit(command);
      immediateUpdates.requestUpdate(command.timeStamp);
    },
    subscribe(observer) {
      return frameStateController.subscribe(observer);
    },
    dispose() {
      frameStateController.dispose();
    }
  };

  let debugLogWindow: ReturnType<typeof createDebugLogWindowActor> | null = null;
  const gizmoEventSystem = new GizmoEventSystem({
    buttonsReleasedFallback: false,
    debug: true,
    debugConsole: true,
    onDebugLog: (entry) => debugLogWindow?.component.append(entry)
  });
  const runtimeContext = new AppRuntimeContext({
    sceneRuntime,
    frameStateController: frameStateBridge,
    gizmoEventSystem
  });

  installWallpaperComponentDefinitions(runtimeContext.componentRegistry);

  const sceneWindow = createSceneWindowActor(runtimeContext, {
    actorId: SCENE_WINDOW_ACTOR_ID,
    actorName: SCENE_WINDOW_ACTOR_NAME,
    parent: mount,
    initialState: sceneWindowState
  });
  debugLogWindow = createDebugLogWindowActor(runtimeContext, {
    actorId: DEBUG_LOG_WINDOW_ACTOR_ID,
    actorName: DEBUG_LOG_WINDOW_ACTOR_NAME,
    parent: mount,
    initialState: debugWindowState
  });
  const camera3Projection = new Camera3ProjectionModeController();
  const camera3Rig = new Camera3Rig({
    target: new THREE.Vector3(0, 0, 0),
    distance: 6
  });
  const camera3Motion = new Camera3MotionController({
    rig: camera3Rig,
    projectionMode: camera3Projection
  });
  const camera3Gizmo = createCamera3GizmoActor(runtimeContext, {
    actorId: CAMERA3_GIZMO_ACTOR_ID,
    actorName: CAMERA3_GIZMO_ACTOR_NAME,
    projectionMode: camera3Projection,
    commandSink: camera3Motion,
    parent: sceneWindow.viewport.overlayElement,
    parentActor: sceneWindow.actor
  });
  const unregisterCamera3MotionObserver = camera3Motion.subscribe({
    onCamera3MotionChanged: () => camera3Gizmo.component.update()
  });
  const unregisterSceneViewportResizeObserver = sceneWindow.viewport.subscribeResize(({ width, height }) => {
    camera3Projection.resize(width, height, camera3Motion.distance);
    camera3Gizmo.component.update();
  });
  const initialViewportSize = sceneWindow.viewport.getSize();
  if (initialViewportSize) {
    camera3Projection.resize(initialViewportSize.width, initialViewportSize.height, camera3Motion.distance);
    camera3Gizmo.component.update();
  } else {
    sceneWindow.viewport.measureNow();
  }
  runtimeContext.registerLegacyRuntimeObject(frameStateController);
  runtimeContext.registerLegacyRuntimeObject(camera3Motion);

  createTesseract4Actor(runtimeContext, {
    actorId: TESSERACT4_ACTOR_ID,
    actorName: TESSERACT4_ACTOR_NAME,
    scene: sceneWindow.viewport.scene,
    parentActor: sceneWindow.actor
  });
  const hierarchyObjectSource = createActorHierarchyObjectSource({
    actorSystem: runtimeContext.actorSystem,
    metadataByActorId: {
      [SCENE_WINDOW_ACTOR_ID]: { label: SCENE_WINDOW_ACTOR_NAME, order: 0 },
      [TESSERACT4_ACTOR_ID]: { label: TESSERACT4_ACTOR_NAME, order: 10 },
      [CAMERA3_GIZMO_ACTOR_ID]: { label: CAMERA3_GIZMO_ACTOR_NAME, order: 20 },
      [DEBUG_LOG_WINDOW_ACTOR_ID]: { label: DEBUG_LOG_WINDOW_ACTOR_NAME, order: 1000 },
      [HIERARCHY_PANEL_ACTOR_ID]: { label: HIERARCHY_PANEL_ACTOR_NAME, order: 1010 },
      [APP_MENU_BAR_ACTOR_ID]: { label: APP_MENU_BAR_ACTOR_NAME, order: 1020 }
    }
  });
  createHierarchyPanelActor(runtimeContext, {
    actorId: HIERARCHY_PANEL_ACTOR_ID,
    actorName: HIERARCHY_PANEL_ACTOR_NAME,
    parent: mount,
    initialWindowState: hierarchyPanelState.window,
    objectSource: hierarchyObjectSource
  });
  const windowControlSource = createWindowControlSource({
    actorSystem: runtimeContext.actorSystem
  });
  const windowActivationController = new WindowVisibilityActivationController({
    source: windowControlSource
  });
  const unregisterWindowActivationObserver = frameStateBridge.subscribe(windowActivationController);
  runtimeContext.registerLegacyRuntimeObject(windowActivationController);
  createAppMenuBarActor(runtimeContext, {
    actorId: APP_MENU_BAR_ACTOR_ID,
    actorName: APP_MENU_BAR_ACTOR_NAME,
    parent: mount,
    windowSource: windowControlSource
  });
  const workspaceModeController = new WorkspaceModeController({
    commandSink: frameStateBridge,
    getValue: (path) => sceneStore.get(path),
    sceneWindow: sceneWindow.window,
    toolWindows: [
      { id: DEBUG_LOG_WINDOW_ACTOR_ID, paths: sceneParameterPaths.debugWindow },
      { id: HIERARCHY_PANEL_ACTOR_ID, paths: sceneParameterPaths.hierarchyWindow }
    ],
    onScenePresentationChanged: () => sceneWindow.viewport.measureNow()
  });
  const unregisterWorkspaceModeObserver = frameStateBridge.subscribe(workspaceModeController);

  const renderLoop = new RenderLoop({ update });

  function measureSceneViewport(): void {
    sceneWindow.viewport.measureNow();
  }

  function isSceneRenderable(): boolean {
    return sceneWindow.window.state.visible &&
      runtimeContext.actorSystem.isActorActive(sceneWindow.actor);
  }

  function update(timeMs: number): void {
    const frame = frameClock.tick(timeMs);
    isUpdatingFrame = true;
    try {
      sceneRuntime.updateFrame(frame);
      if (isSceneRenderable()) {
        sceneWindow.viewport.render(camera3Motion.activeCamera);
      }
    } finally {
      isUpdatingFrame = false;
    }
  }

  function handleVisibilityChange(): void {
    measureSceneViewport();
    renderLoop.restart();
  }

  function handleKeyDown(event: KeyboardEvent): void {
    if (event.key !== "Escape") return;
    frameStateBridge.submit({
      source: { id: "scene-window-keyboard", kind: "keyboard" },
      target: sceneParameterPaths.workspace.mode,
      operation: "set",
      value: "develop",
      timeStamp: event.timeStamp
    });
  }

  function dispose(): void {
    window.removeEventListener("resize", measureSceneViewport);
    document.removeEventListener("visibilitychange", handleVisibilityChange);
    document.removeEventListener("keydown", handleKeyDown);
    renderLoop.dispose();
    immediateUpdates.dispose();
    unregisterWorkspaceModeObserver.dispose();
    unregisterWindowActivationObserver.dispose();
    workspaceModeController.dispose();
    unregisterSceneViewportResizeObserver.dispose();
    unregisterCamera3MotionObserver.dispose();
    runtimeContext.dispose();
  }

  measureSceneViewport();
  renderLoop.start();
  window.addEventListener("resize", measureSceneViewport);
  document.addEventListener("visibilitychange", handleVisibilityChange);
  document.addEventListener("keydown", handleKeyDown);

  return { dispose };
}
