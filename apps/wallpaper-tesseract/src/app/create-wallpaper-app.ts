import { GizmoEventSystem } from "gizmo-core";
import { AppRuntimeContext } from "../app-runtime";
import {
  createDebugLogWindowActor,
  createDefaultDebugWindowState,
  DEBUG_WINDOW_MIN_HEIGHT,
  DEBUG_WINDOW_MIN_WIDTH,
  registerDebugWindowParameters
} from "../debug";
import {
  createDefaultSceneWindowState,
  registerSceneWindowParameters,
  SCENE_WINDOW_MIN_HEIGHT,
  SCENE_WINDOW_MIN_WIDTH,
  SCENE_WINDOW_PRIORITY_DEVELOP
} from "../features/scene";
import { createAppMenuBarActor } from "../features/app-menu";
import {
  createActorHierarchyObjectSource,
  createDefaultHierarchyPanelState,
  createHierarchyPanelActor,
  HIERARCHY_WINDOW_MIN_HEIGHT,
  HIERARCHY_WINDOW_MIN_WIDTH,
  registerHierarchyPanelParameters
} from "../hierarchy";
import {
  FrameStateController,
  sceneParameterPaths,
  SceneFrameClock,
  SceneParameterStore,
  SceneRuntime,
  vec2,
  type Vec2
} from "../scene-runtime";
import type { SceneStateObserverRegistry } from "../runtime/ports";
import {
  createActorWindowFocusServiceProxy,
  createDockTargetFrameSource,
  DefaultWindowFrameLifecycleController,
  floatingWindowComponentType,
  type FloatingWindowParameterPaths,
  type FloatingWindowState,
  createWindowControlSource,
  createWindowMenuViewSource,
  WindowDockPreviewController,
  type WindowDockRect,
  type WindowFloatingFrameCreateOptions,
  type WindowFrameIntentSink,
  type WindowFramePort,
  type WindowFrameTab,
  type WindowViewKey,
  WindowViewFactoryRegistry,
  WindowWorkspaceController,
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
import { CurrentSceneViewSource, SceneViewRuntime } from "./scene-view-runtime";
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
  const actorWindowFocus = createActorWindowFocusServiceProxy();
  const gizmoEventSystem = new GizmoEventSystem({
    buttonsReleasedFallback: false,
    debug: true,
    debugConsole: true,
    onDebugLog: (entry) => debugLogWindow?.component.append(entry)
  });
  const runtimeContext = new AppRuntimeContext({
    sceneRuntime,
    frameStateController: frameStateBridge,
    gizmoEventSystem,
    actorWindowFocus
  });

  installWallpaperComponentDefinitions(runtimeContext.componentRegistry);

  runtimeContext.registerLegacyRuntimeObject(frameStateController);

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
  const windowControlSource = createWindowControlSource({
    actorSystem: runtimeContext.actorSystem
  });
  const dockTargetFrameSource = createDockTargetFrameSource({
    actorSystem: runtimeContext.actorSystem
  });
  const windowMenuViewSource = createWindowMenuViewSource({
    actorSystem: runtimeContext.actorSystem
  });
  const windowDockPreview = new WindowDockPreviewController({
    source: dockTargetFrameSource,
    parent: mount
  });
  const windowWorkspaceController = new WindowWorkspaceController({
    actorSystem: runtimeContext.actorSystem,
    source: windowControlSource
  });
  actorWindowFocus.bind(windowWorkspaceController);
  runtimeContext.registerLegacyRuntimeObject(windowWorkspaceController);
  const currentSceneView = new CurrentSceneViewSource();
  const windowViewFactories = new WindowViewFactoryRegistry();
  let windowFrameLifecycleController: DefaultWindowFrameLifecycleController | null = null;
  const requireWindowFrameLifecycleController = (): DefaultWindowFrameLifecycleController => {
    if (!windowFrameLifecycleController) {
      throw new Error("Window frame lifecycle controller is not initialized.");
    }
    return windowFrameLifecycleController;
  };
  const windowFrameIntents: WindowFrameIntentSink = {
    requestOpenView(viewKey, reason) {
      requireWindowFrameLifecycleController().openView(viewKey, reason);
    },
    requestCloseFrame(frameId, reason) {
      requireWindowFrameLifecycleController().closeFrame(frameId, reason);
    },
    requestActivateFrameTab(frameId, viewActorId, reason) {
      requireWindowFrameLifecycleController().activateFrameTab(frameId, viewActorId, reason);
    },
    requestCommitDock(intent) {
      requireWindowFrameLifecycleController().commitDock(intent);
    }
  };
  const floatingFrameCounters = new Map<WindowViewKey, number>();
  const createFloatingFrameForView = (options: WindowFloatingFrameCreateOptions): {
    frameActor: ReturnType<typeof runtimeContext.actorSystem.createActor>;
    framePort: WindowFramePort;
  } => {
    const frameOptions = getFloatingFrameOptions(options.source.viewKey, options.tab, options.bounds);
    const ids = allocateFloatingFrameIds(
      runtimeContext.actorSystem,
      floatingFrameCounters,
      options.source.viewKey,
      frameOptions.preferredActorId,
      frameOptions.preferredComponentId
    );
    const actor = runtimeContext.actorSystem.createActor({
      id: ids.actorId,
      name: `${options.tab.title} Window`
    });
    try {
      const window = runtimeContext.componentRegistry.addComponent(actor, floatingWindowComponentType, {
        id: ids.componentId,
        parent: mount,
        title: options.tab.title,
        paths: frameOptions.paths,
        initialState: frameOptions.initialState,
        minSize: frameOptions.minSize,
        className: frameOptions.className,
        contentClassName: frameOptions.contentClassName,
        priority: frameOptions.priority,
        activeViewActorId: options.tab.viewActorId,
        activeViewKey: options.tab.viewKey,
        tabs: [options.tab],
        frameIntentSink: windowFrameIntents,
        tabDragSink: windowDockPreview,
        windowMenu: frameOptions.windowMenu
      });
      return {
        frameActor: actor,
        framePort: window as WindowFramePort
      };
    } catch (error) {
      if (runtimeContext.actorSystem.hasActor(actor)) {
        runtimeContext.actorSystem.destroyActor(actor);
      }
      throw error;
    }
  };
  windowViewFactories.register({
    viewKey: "scene",
    label: SCENE_WINDOW_ACTOR_NAME,
    order: 0,
    create: (options) => {
      const runtime = new SceneViewRuntime({
        context: runtimeContext,
        mount,
        initialState: readFloatingWindowState(sceneStore, sceneParameterPaths.sceneWindow, {
          fallback: sceneWindowState,
          forceVisible: options.reason === "menu"
        }),
        actorIds: {
          sceneWindowActorId: SCENE_WINDOW_ACTOR_ID,
          sceneWindowActorName: SCENE_WINDOW_ACTOR_NAME,
          camera3GizmoActorId: CAMERA3_GIZMO_ACTOR_ID,
          camera3GizmoActorName: CAMERA3_GIZMO_ACTOR_NAME,
          tesseract4ActorId: TESSERACT4_ACTOR_ID,
          tesseract4ActorName: TESSERACT4_ACTOR_NAME
        },
        frameIntentSink: windowFrameIntents,
        tabDragSink: windowDockPreview
      });
      currentSceneView.setCurrent(runtime);
      if (sceneStore.get(sceneParameterPaths.workspace.mode) === "run") {
        runtime.window.setPresentation("fullscreen");
      }
      return {
        frameActor: runtime.sceneWindow.actor,
        framePort: runtime.sceneWindow.window,
        viewActor: runtime.sceneWindow.viewport.actor,
        content: runtime.sceneWindow.viewport,
        dispose: () => {
          currentSceneView.clear(runtime);
          runtime.dispose();
        }
      };
    }
  });
  windowViewFactories.register({
    viewKey: "debug",
    label: DEBUG_LOG_WINDOW_ACTOR_NAME,
    order: 1000,
    create: (options) => {
      const handle = createDebugLogWindowActor(runtimeContext, {
        actorId: DEBUG_LOG_WINDOW_ACTOR_ID,
        actorName: DEBUG_LOG_WINDOW_ACTOR_NAME,
        parent: mount,
        initialState: readFloatingWindowState(sceneStore, sceneParameterPaths.debugWindow, {
          fallback: debugWindowState,
          forceVisible: options.reason === "menu"
        }),
        frameIntentSink: windowFrameIntents,
        tabDragSink: windowDockPreview
      });
      debugLogWindow = handle;
      return {
        frameActor: handle.actor,
        framePort: handle.window,
        viewActor: handle.component.actor,
        content: handle.component,
        dispose: () => {
          if (debugLogWindow === handle) {
            debugLogWindow = null;
          }
          handle.dispose();
        }
      };
    }
  });
  windowViewFactories.register({
    viewKey: "hierarchy",
    label: HIERARCHY_PANEL_ACTOR_NAME,
    order: 1010,
    create: (options) => {
      const handle = createHierarchyPanelActor(runtimeContext, {
        actorId: HIERARCHY_PANEL_ACTOR_ID,
        actorName: HIERARCHY_PANEL_ACTOR_NAME,
        parent: mount,
        initialWindowState: readFloatingWindowState(sceneStore, sceneParameterPaths.hierarchyWindow, {
          fallback: hierarchyPanelState.window,
          forceVisible: options.reason === "menu"
        }),
        objectSource: hierarchyObjectSource,
        frameIntentSink: windowFrameIntents,
        tabDragSink: windowDockPreview
      });
      return {
        frameActor: handle.actor,
        framePort: handle.window,
        viewActor: handle.component.actor,
        content: handle.component,
        dispose: () => handle.dispose()
      };
    }
  });
  windowFrameLifecycleController = new DefaultWindowFrameLifecycleController({
    actorSystem: runtimeContext.actorSystem,
    factories: windowViewFactories,
    actorWindowFocus,
    cancelActiveInput: () => runtimeContext.cancelActiveActorInput(),
    createFloatingFrame: createFloatingFrameForView
  });
  windowFrameLifecycleController.openView("scene", "programmatic");
  windowFrameLifecycleController.openView("debug", "programmatic");
  windowFrameLifecycleController.openView("hierarchy", "programmatic");
  const windowActivationController = new WindowVisibilityActivationController({
    source: windowControlSource
  });
  const unregisterWindowActivationObserver = frameStateBridge.subscribe(windowActivationController);
  runtimeContext.registerLegacyRuntimeObject(windowActivationController);
  createAppMenuBarActor(runtimeContext, {
    actorId: APP_MENU_BAR_ACTOR_ID,
    actorName: APP_MENU_BAR_ACTOR_NAME,
    parent: mount,
    windowSource: windowControlSource,
    windowMenuViewSource,
    windowViewFactories,
    windowFrameIntents
  });
  const workspaceModeController = new WorkspaceModeController({
    commandSink: frameStateBridge,
    getValue: (path) => sceneStore.get(path),
    getSceneWindow: () => currentSceneView.current?.window ?? null,
    toolWindows: [
      { id: DEBUG_LOG_WINDOW_ACTOR_ID, paths: sceneParameterPaths.debugWindow },
      { id: HIERARCHY_PANEL_ACTOR_ID, paths: sceneParameterPaths.hierarchyWindow }
    ],
    onScenePresentationChanged: () => currentSceneView.current?.measureNow()
  });
  const unregisterWorkspaceModeObserver = frameStateBridge.subscribe(workspaceModeController);

  const renderLoop = new RenderLoop({ update });

  function measureSceneViewport(): void {
    currentSceneView.current?.measureNow();
  }

  function update(timeMs: number): void {
    const frame = frameClock.tick(timeMs);
    isUpdatingFrame = true;
    try {
      sceneRuntime.updateFrame(frame);
      currentSceneView.current?.render();
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
    closeLiveWindowFrames(windowFrameLifecycleController);
    windowDockPreview.dispose();
    actorWindowFocus.dispose();
    runtimeContext.dispose();
  }

  measureSceneViewport();
  renderLoop.start();
  window.addEventListener("resize", measureSceneViewport);
  document.addEventListener("visibilitychange", handleVisibilityChange);
  document.addEventListener("keydown", handleKeyDown);

  return { dispose };
}

function closeLiveWindowFrames(controller: DefaultWindowFrameLifecycleController | null): void {
  if (!controller) return;
  const frameIds = new Set(controller.listLiveViews().map((view) => view.frameActor.id));
  for (const frameId of frameIds) {
    controller.closeFrame(frameId, "programmatic");
  }
}

interface FloatingFrameShellOptions {
  readonly preferredActorId: string;
  readonly preferredComponentId: string;
  readonly paths: FloatingWindowParameterPaths;
  readonly initialState: FloatingWindowState;
  readonly minSize: Vec2;
  readonly className: string;
  readonly contentClassName?: string;
  readonly priority: number;
  readonly windowMenu: {
    readonly include?: boolean;
    readonly viewKey: WindowViewKey;
    readonly label?: string;
    readonly order?: number;
    readonly activationMode?: "visible";
  };
}

function getFloatingFrameOptions(
  viewKey: WindowViewKey,
  tab: WindowFrameTab,
  bounds: WindowDockRect
): FloatingFrameShellOptions {
  switch (viewKey) {
    case "scene": {
      const minSize = vec2(SCENE_WINDOW_MIN_WIDTH, SCENE_WINDOW_MIN_HEIGHT);
      return {
        preferredActorId: SCENE_WINDOW_ACTOR_ID,
        preferredComponentId: "floating-window:scene",
        paths: sceneParameterPaths.sceneWindow,
        initialState: createFloatingStateFromBounds(bounds, minSize),
        minSize,
        className: "scene-window",
        contentClassName: "scene-window__content",
        priority: SCENE_WINDOW_PRIORITY_DEVELOP,
        windowMenu: {
          include: true,
          viewKey,
          label: tab.title,
          order: 0,
          activationMode: "visible"
        }
      };
    }
    case "debug": {
      const minSize = vec2(DEBUG_WINDOW_MIN_WIDTH, DEBUG_WINDOW_MIN_HEIGHT);
      return {
        preferredActorId: DEBUG_LOG_WINDOW_ACTOR_ID,
        preferredComponentId: "floating-window:debug-log",
        paths: sceneParameterPaths.debugWindow,
        initialState: createFloatingStateFromBounds(bounds, minSize),
        minSize,
        className: "debug-log-window",
        priority: 1000,
        windowMenu: { viewKey, label: tab.title, activationMode: "visible" }
      };
    }
    case "hierarchy": {
      const minSize = vec2(HIERARCHY_WINDOW_MIN_WIDTH, HIERARCHY_WINDOW_MIN_HEIGHT);
      return {
        preferredActorId: HIERARCHY_PANEL_ACTOR_ID,
        preferredComponentId: "floating-window:hierarchy",
        paths: sceneParameterPaths.hierarchyWindow,
        initialState: createFloatingStateFromBounds(bounds, minSize),
        minSize,
        className: "hierarchy-window",
        priority: 1100,
        windowMenu: { viewKey, label: tab.title, activationMode: "visible" }
      };
    }
    default:
      throw new Error(`No floating frame shell is registered for view: ${viewKey}`);
  }
}

function createFloatingStateFromBounds(bounds: WindowDockRect, minSize: Vec2): FloatingWindowState {
  return {
    position: vec2(Math.max(0, Math.round(bounds.left)), Math.max(0, Math.round(bounds.top))),
    size: vec2(
      Math.max(minSize.x, Math.round(bounds.width)),
      Math.max(minSize.y, Math.round(bounds.height))
    ),
    visible: true
  };
}

function allocateFloatingFrameIds(
  actorSystem: { getActor(id: string): unknown },
  counters: Map<WindowViewKey, number>,
  viewKey: WindowViewKey,
  preferredActorId: string,
  preferredComponentId: string
): { readonly actorId: string; readonly componentId: string } {
  if (!actorSystem.getActor(preferredActorId)) {
    return { actorId: preferredActorId, componentId: preferredComponentId };
  }
  let counter = counters.get(viewKey) ?? 1;
  while (true) {
    const actorId = `${preferredActorId}:floating-${counter}`;
    const componentId = `${preferredComponentId}:floating-${counter}`;
    counters.set(viewKey, counter + 1);
    counter += 1;
    if (!actorSystem.getActor(actorId)) {
      return { actorId, componentId };
    }
  }
}

function readFloatingWindowState(
  store: SceneParameterStore,
  paths: FloatingWindowParameterPaths,
  options: {
    readonly fallback: FloatingWindowState;
    readonly forceVisible?: boolean;
  }
): FloatingWindowState {
  const position = readVec2(store, paths.position, options.fallback.position);
  const size = readVec2(store, paths.size, options.fallback.size);
  const visible = options.forceVisible ? true : store.get<boolean>(paths.visible);
  return { position, size, visible };
}

function readVec2(
  store: SceneParameterStore,
  path: FloatingWindowParameterPaths["position"] | FloatingWindowParameterPaths["size"],
  fallback: Vec2
): Vec2 {
  const value = store.get<Vec2>(path);
  return value ? vec2(value.x, value.y) : vec2(fallback.x, fallback.y);
}
