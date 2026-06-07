import { GizmoEventSystem } from "gizmo-core";
import { AppRuntimeContext } from "../app-runtime";
import {
  createDefaultDebugWindowState,
  registerDebugWindowParameters,
  type DebugLogContentComponent
} from "../debug";
import {
  createSceneDefaultOpenView,
  createDefaultSceneWindowState,
  createSceneWindowWorkspaceFloatingFramePolicy,
  installSceneViewFeature,
  registerSceneWindowParameters
} from "../features/scene";
import { installAppMenuFeature } from "../features/app-menu";
import {
  createInspectorWindowWorkspaceFloatingFramePolicies,
  installInspectorFeature
} from "../features/inspector";
import {
  createActorHierarchyObjectSource,
  createDefaultHierarchyPanelState,
  registerHierarchyPanelParameters
} from "../hierarchy";
import {
  createToolWindowDefaultOpenViews,
  createToolWindowWorkspaceFloatingFramePolicies,
  installToolWindowFeatures
} from "../features/tool-windows";
import {
  FrameStateController,
  type SceneCommandSink,
  type SceneUpdateCommand,
  sceneParameterPaths,
  SceneParameterStore,
  SceneRuntime,
  type SceneStateObserver
} from "../scene-runtime";
import { UpdateFrameClock } from "../runtime/ports";
import type { StateObserverRegistry } from "../state-runtime";
import {
  createActorWindowFocusServiceProxy,
  type UiLayoutCommandSink,
  WINDOW_WORKSPACE_FRAME_LAYOUT_STORAGE_KEY,
  WORKSPACE_ROOT_FRAME_ID
} from "../window-runtime";
import {
  createBrowserWindowWorkspaceFrameLayoutStorage,
  installWindowWorkspaceFeature,
  type InstalledWindowWorkspaceFeature
} from "../features/window-workspace";
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
import { createWallpaperAppShell } from "./app-shell";
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
  const appShell = createWallpaperAppShell(mount);
  const floatingFrameParent = appShell.floatingOverlaySlot;

  const sceneRuntime = new SceneRuntime();
  const frameClock = new UpdateFrameClock();
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
  const frameStateBridge: StateObserverRegistry<SceneStateObserver> & SceneCommandSink = {
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

  let debugLogWindow: { readonly component: DebugLogContentComponent } | null = null;
  const actorWindowFocus = createActorWindowFocusServiceProxy();
  const gizmoEventSystem = new GizmoEventSystem({
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

  installWallpaperComponentDefinitions(runtimeContext.componentRegistry, {
    sceneCommandSink: frameStateBridge,
    uiLayoutCommandSink: createSceneBackedUiLayoutCommandSink(frameStateBridge)
  });

  runtimeContext.registerRuntimeService(frameStateController);

  const hierarchyObjectSource = createActorHierarchyObjectSource({
    actorSystem: runtimeContext.actorSystem,
    metadataByActorId: {
      [SCENE_WINDOW_ACTOR_ID]: { label: SCENE_WINDOW_ACTOR_NAME, order: 0 },
      [TESSERACT4_ACTOR_ID]: { label: TESSERACT4_ACTOR_NAME, order: 10 },
      [CAMERA3_GIZMO_ACTOR_ID]: { label: CAMERA3_GIZMO_ACTOR_NAME, order: 20 },
      [DEBUG_LOG_WINDOW_ACTOR_ID]: { label: DEBUG_LOG_WINDOW_ACTOR_NAME, order: 1000 },
      [HIERARCHY_PANEL_ACTOR_ID]: { label: HIERARCHY_PANEL_ACTOR_NAME, order: 1010 },
      [APP_MENU_BAR_ACTOR_ID]: { label: APP_MENU_BAR_ACTOR_NAME, order: 1020 },
      [WORKSPACE_ROOT_FRAME_ID]: { label: "Workspace Root", order: 1030 }
    }
  });
  const layoutStorage = createBrowserWindowWorkspaceFrameLayoutStorage(window, {
    resetKeys: shouldResetWindowWorkspaceLayout(window)
      ? [WINDOW_WORKSPACE_FRAME_LAYOUT_STORAGE_KEY]
      : []
  });
  const windowWorkspace = installWindowWorkspaceFeature({
    context: runtimeContext,
    sceneStore,
    floatingFrameParent,
    rootFrameParent: appShell.rootDockSlot,
    actorWindowFocus,
    cancelActiveInput: () => runtimeContext.cancelActiveActorInput(),
    floatingFramePolicies: new Map([
      createSceneWindowWorkspaceFloatingFramePolicy(sceneWindowState),
      ...createInspectorWindowWorkspaceFloatingFramePolicies(),
      ...createToolWindowWorkspaceFloatingFramePolicies({
        debugFallbackState: debugWindowState,
        hierarchyFallbackState: hierarchyPanelState.window
      })
    ]),
    defaultOpenViews: [
      createSceneDefaultOpenView(),
      ...createToolWindowDefaultOpenViews()
    ],
    layoutStorage,
    registerRuntimeService: (object) => runtimeContext.registerRuntimeService(object)
  });
  const sceneFeature = installSceneViewFeature({
    context: runtimeContext,
    mount: floatingFrameParent,
    actorIds: {
      sceneWindowActorId: SCENE_WINDOW_ACTOR_ID,
      sceneWindowActorName: SCENE_WINDOW_ACTOR_NAME,
      camera3GizmoActorId: CAMERA3_GIZMO_ACTOR_ID,
      camera3GizmoActorName: CAMERA3_GIZMO_ACTOR_NAME,
      tesseract4ActorId: TESSERACT4_ACTOR_ID,
      tesseract4ActorName: TESSERACT4_ACTOR_NAME
    },
    viewFactories: windowWorkspace.viewFactories,
    locations: windowWorkspace.lifecycle
  });
  installInspectorFeature({
    context: runtimeContext,
    viewFactories: windowWorkspace.viewFactories
  });
  installToolWindowFeatures({
    context: runtimeContext,
    viewFactories: windowWorkspace.viewFactories,
    hierarchyObjectSource,
    debugLogLabel: DEBUG_LOG_WINDOW_ACTOR_NAME,
    hierarchyLabel: HIERARCHY_PANEL_ACTOR_NAME,
    actorIds: {
      debugLogViewActorId: `${DEBUG_LOG_WINDOW_ACTOR_ID}:view`,
      debugLogViewActorName: `${DEBUG_LOG_WINDOW_ACTOR_NAME} View`,
      hierarchyPanelViewActorId: `${HIERARCHY_PANEL_ACTOR_ID}:view`,
      hierarchyPanelViewActorName: `${HIERARCHY_PANEL_ACTOR_NAME} View`
    },
    onDebugLogContentChanged(component) {
      debugLogWindow = component ? { component } : null;
    }
  });
  if (!windowWorkspace.restorePersistedLayout()) {
    windowWorkspace.openDefaultViews();
  }
  installAppMenuFeature({
    context: runtimeContext,
    actorId: APP_MENU_BAR_ACTOR_ID,
    actorName: APP_MENU_BAR_ACTOR_NAME,
    parent: appShell.menuSlot,
    windowCatalog: windowWorkspace.catalog,
    windowFrameIntents: windowWorkspace.frameIntents,
    workspaceModePath: sceneParameterPaths.workspace.mode
  });
  const workspaceModeController = new WorkspaceModeController({
    commandSink: frameStateBridge,
    getValue: (path) => sceneStore.get(path),
    sceneView: {
      viewKey: "scene",
      locations: windowWorkspace.lifecycle,
      commands: windowWorkspace.lifecycle,
      presentation: windowWorkspace.lifecycle,
      open: () => windowWorkspace.lifecycle.openView("scene", "programmatic")
    },
    workspacePresentation: windowWorkspace.presentationController,
    toolWindows: [],
    onScenePresentationChanged: () => sceneFeature.renderableSceneViews.current?.measureNow()
  });
  const unregisterWorkspaceModeObserver = frameStateBridge.subscribe(workspaceModeController);

  const renderLoop = new RenderLoop({ update });

  function measureSceneViewport(): void {
    sceneFeature.renderableSceneViews.current?.measureNow();
  }

  function update(timeMs: number): void {
    const frame = frameClock.tick(timeMs);
    isUpdatingFrame = true;
    try {
      sceneRuntime.updateFrame(frame);
      sceneFeature.renderableSceneViews.current?.render();
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
    workspaceModeController.dispose();
    closeLiveWindowFrames(windowWorkspace.lifecycle);
    windowWorkspace.dispose();
    actorWindowFocus.dispose();
    runtimeContext.dispose();
    appShell.dispose();
  }

  measureSceneViewport();
  renderLoop.start();
  window.addEventListener("resize", measureSceneViewport);
  document.addEventListener("visibilitychange", handleVisibilityChange);
  document.addEventListener("keydown", handleKeyDown);

  return { dispose };
}

function createSceneBackedUiLayoutCommandSink(commandSink: SceneCommandSink): UiLayoutCommandSink {
  return {
    submit(command) {
      commandSink.submit(command as unknown as SceneUpdateCommand);
    }
  };
}

const RESET_WORKSPACE_LAYOUT_QUERY_PARAM = "resetWorkspaceLayout";

function shouldResetWindowWorkspaceLayout(target: Pick<Window, "location">): boolean {
  try {
    return new URL(target.location.href).searchParams.has(RESET_WORKSPACE_LAYOUT_QUERY_PARAM);
  } catch {
    return false;
  }
}

function closeLiveWindowFrames(controller: InstalledWindowWorkspaceFeature["lifecycle"]): void {
  if (!controller) return;
  const frameIds = new Set(controller.listLiveViews().map((view) => view.frameActor.id));
  for (const frameId of frameIds) {
    controller.closeFrame(frameId, "programmatic");
  }
}
