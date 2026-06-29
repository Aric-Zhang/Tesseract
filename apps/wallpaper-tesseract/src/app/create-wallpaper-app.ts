import { GizmoEventSystem } from "actor-system/gizmo";
import {
  ActorSystem,
  ComponentRegistry,
  CompositeComponentAttachmentRuntime,
  createActorCreationScope,
  type Component
} from "actor-system/core";
import { installActorInputComponentDefinitions } from "actor-system/input";
import {
  AppFrameStateController,
  installInspectorFeature,
  installInspectorWorkspacePolicy,
  installToolWindowFeatures,
  installToolWindowWorkspacePolicy,
  StateObserverAttachmentRuntime,
  type AppStateObserver,
  type DebugLogContentComponent
} from "editor";
import { AppStateParameterStore } from "editor";
import type { AppStateCommandSink } from "editor";
import { editorStatePaths } from "editor";
import {
  createEditorBackedWorkspaceCommandSink,
  installEditorComponentDefinitions
} from "editor";
import { RuntimeFrameClock } from "runtime-core";
import { ActiveInputCancellationRuntime, GizmoControllerAttachmentRuntime } from "../gizmo-runtime";
import {
  FrameUpdateAttachmentRuntime,
  installUiComponentDefinitions,
  uiElementComponentType,
  uiThemeComponentType
} from "ui-framework";
import type { StateObserverRegistry } from "editor";
import {
  createWindowFocusServiceProxy,
  installWindowComponentDefinitions,
  type UiLayoutCommandSink,
  WINDOW_WORKSPACE_FRAME_LAYOUT_STORAGE_KEY
} from "../window-runtime";
import {
  createBrowserWindowWorkspaceFrameLayoutStorage,
  installWindowWorkspaceFeature,
  type InstalledWindowWorkspaceFeature
} from "../features/window-workspace";
import {
  installAppMenuComponentDefinitions,
  installAppMenuFeature
} from "../features/app-menu";
import { createAppThemeController } from "../features/theme";
import {
  installSceneViewFeature,
  installSceneWorkspacePolicy
} from "../features/scene";
import {
  installSceneRunModeCommand,
  installSceneRunModeState
} from "../features/scene-run-mode-command";
import { installSceneIntegrationComponentDefinitions } from "../features/scene/components";
import { createWallpaperAppShell } from "./app-shell";
import { ImmediateUpdateScheduler } from "./immediate-update-scheduler";
import { RenderLoop } from "./render-loop";
import { AppFrameOrchestrator } from "./app-frame-orchestrator";
import { UiFrameScheduler } from "./ui-frame-scheduler";
import {
  ProductionRuntimeSchedulerService,
  RuntimeSceneViewRuntimeRegistry,
  RuntimeWorkAttachmentRuntime,
  installWallpaperRuntimeComponentDefinitions
} from "wallpaper-runtime";

export interface WallpaperApp {
  dispose(): void;
}

export function createWallpaperApp(mount: HTMLElement): WallpaperApp {
  const appShell = createWallpaperAppShell(mount);
  const floatingFrameParent = appShell.floatingOverlaySlot;

  const frameClock = new RuntimeFrameClock();
  const uiFrameScheduler = new UiFrameScheduler();
  const appStateStore = new AppStateParameterStore();
  const scenePolicy = installSceneWorkspacePolicy(appStateStore);
  const inspectorPolicy = installInspectorWorkspacePolicy();
  const toolWindowPolicy = installToolWindowWorkspacePolicy(appStateStore);
  installSceneRunModeState(appStateStore);
  const floatingFramePolicies = new Map([
    scenePolicy.floatingFramePolicy,
    ...inspectorPolicy.floatingFramePolicies,
    ...toolWindowPolicy.floatingFramePolicies
  ]);
  const defaultOpenViews = [
    scenePolicy.defaultOpenView,
    ...toolWindowPolicy.defaultOpenViews
  ];

  let isUpdatingFrame = false;
  const immediateUpdates = new ImmediateUpdateScheduler({
    update,
    isUpdatingFrame: () => isUpdatingFrame
  });

  const frameStateController = new AppFrameStateController({ store: appStateStore });
  const frameStateBridge: StateObserverRegistry<AppStateObserver> & AppStateCommandSink = {
    submit(command) {
      frameStateController.submit(command);
      immediateUpdates.requestUpdate();
    },
    subscribe(observer) {
      return frameStateController.subscribe(observer);
    },
    dispose() {
      frameStateController.dispose();
    }
  };

  let debugLogTarget: DebugLogContentComponent | null = null;
  const windowFocus = createWindowFocusServiceProxy();
  const gizmoEventSystem = new GizmoEventSystem({
    debug: true,
    debugConsole: true,
    onDebugLog: (entry) => debugLogTarget?.append(entry)
  });
  const actorSystem = new ActorSystem();
  const runtimeScheduler = new ProductionRuntimeSchedulerService();
  const runtimeSceneViews = new RuntimeSceneViewRuntimeRegistry();
  const frameUpdateRuntime = new FrameUpdateAttachmentRuntime({ actorSystem });
  const activeInputCancellationRuntime = new ActiveInputCancellationRuntime();
  const componentRegistry = new ComponentRegistry({
    actorSystem,
    attachmentRuntime: new CompositeComponentAttachmentRuntime([
      new RuntimeWorkAttachmentRuntime({
        actorSystem,
        scheduler: runtimeScheduler
      }),
      frameUpdateRuntime,
      new GizmoControllerAttachmentRuntime({ registry: gizmoEventSystem }),
      new StateObserverAttachmentRuntime({
        registry: frameStateBridge,
        getObserver: assertAppStateObserverBinding
      }),
      activeInputCancellationRuntime
    ])
  });
  const actorCreationScope = createActorCreationScope({ actorSystem, componentRegistry });

  installActorInputComponentDefinitions(componentRegistry, {
    gizmoEventBinding: {
      actorInputStackPriority: windowFocus,
      requestPointerFocus: (actor) => windowFocus.focusActorWindow(actor, "pointer-down")
    }
  });
  installWindowComponentDefinitions(componentRegistry, {
    commandSink: createEditorBackedUiLayoutCommandSink(frameStateBridge)
  });
  installUiComponentDefinitions(componentRegistry);
  installAppMenuComponentDefinitions(componentRegistry);
  installEditorComponentDefinitions(componentRegistry, {
    commandSink: createEditorBackedWorkspaceCommandSink(frameStateBridge)
  });
  installWallpaperRuntimeComponentDefinitions(componentRegistry);
  installSceneIntegrationComponentDefinitions(componentRegistry);

  const appThemeActor = actorSystem.createActor({
    id: "app-theme-root",
    name: "App Theme Root"
  });
  componentRegistry.addComponent(appThemeActor, uiElementComponentType, {
    element: appShell.root,
    ownership: "borrowed"
  });
  const rootTheme = componentRegistry.addComponent(appThemeActor, uiThemeComponentType, {
    theme: { id: "default-dark", label: "Default Dark" }
  });
  const themeController = createAppThemeController({ rootTheme });

  const layoutStorage = createBrowserWindowWorkspaceFrameLayoutStorage(window, {
    resetKeys: shouldResetWindowWorkspaceLayout(window)
      ? [WINDOW_WORKSPACE_FRAME_LAYOUT_STORAGE_KEY]
      : []
  });
  const windowWorkspace = installWindowWorkspaceFeature({
    context: actorCreationScope,
    layoutState: appStateStore,
    floatingFrameParent,
    rootFrameParent: appShell.rootDockSlot,
    windowFocus,
    cancelActiveInput: () => activeInputCancellationRuntime.cancelActiveActorInput(),
    floatingFramePolicies,
    defaultOpenViews,
    layoutStorage,
    registerUiScheduledService: (service) => uiFrameScheduler.register(service)
  });
  installSceneViewFeature({
    context: actorCreationScope,
    mount: floatingFrameParent,
    runtimeSceneViews,
    viewFactories: windowWorkspace.viewFactories,
    locations: windowWorkspace.lifecycle,
    workspacePresentation: windowWorkspace.presentationController
  });
  installInspectorFeature({
    context: actorCreationScope,
    viewFactories: windowWorkspace.viewFactories
  });
  installToolWindowFeatures({
    context: actorCreationScope,
    viewFactories: windowWorkspace.viewFactories,
    onDebugLogContentChanged: (component) => {
      debugLogTarget = component;
    }
  });
  installAppMenuFeature({
    context: actorCreationScope,
    hostElement: appShell.menuSlot,
    windowCatalog: windowWorkspace.catalog,
    windowFrameIntents: windowWorkspace.frameIntents,
    workspaceModePath: editorStatePaths.workspace.mode,
    themeController
  });
  const sceneRunMode = installSceneRunModeCommand({
    stateStore: appStateStore,
    stateBridge: frameStateBridge,
    sceneView: {
      viewKey: "scene",
      locations: windowWorkspace.lifecycle,
      commands: windowWorkspace.lifecycle,
      open: () => windowWorkspace.lifecycle.openView("scene", "programmatic")
    },
    workspacePresentation: windowWorkspace.presentationController,
    onScenePresentationChanged: () => runtimeSceneViews.measureCurrentView()
  });
  if (!windowWorkspace.restorePersistedLayout()) {
    windowWorkspace.openDefaultViews();
  }

  const renderLoop = new RenderLoop({ update });
  const frameOrchestrator = new AppFrameOrchestrator({
    updateRuntimeWork(frame) {
      runtimeScheduler.updateRuntimeFrame(frame);
    },
    tickUiComponents(frame) {
      frameUpdateRuntime.updateFrame(frame);
    },
    tickUiServices(frame) {
      uiFrameScheduler.updateFrame(frame);
    },
    flushEditorState(frame) {
      frameStateController.updateFrame(frame);
    },
    renderFrameSources() {
      runtimeSceneViews.renderCurrentFrameSource();
    }
  });

  function measureScenePresentationAfterVisibilityChange(): void {
    runtimeSceneViews.measureCurrentView();
  }

  let lastRuntimeFrameTimeMs = Number.NEGATIVE_INFINITY;

  function update(timeMs: number): void {
    const runtimeTimeMs = Math.max(timeMs, lastRuntimeFrameTimeMs);
    lastRuntimeFrameTimeMs = runtimeTimeMs;
    const frame = frameClock.tick(runtimeTimeMs);
    isUpdatingFrame = true;
    try {
      frameOrchestrator.updateFrame(frame);
    } finally {
      isUpdatingFrame = false;
    }
  }

  function handleVisibilityChange(): void {
    measureScenePresentationAfterVisibilityChange();
    renderLoop.restart();
  }

  function handleKeyDown(event: KeyboardEvent): void {
    if (event.key !== "Escape") return;
    frameStateBridge.submit({
      source: { id: "scene-window-keyboard", kind: "keyboard" },
      target: editorStatePaths.workspace.mode,
      operation: "set",
      value: "develop",
      timeStamp: event.timeStamp
    });
  }

  function dispose(): void {
    document.removeEventListener("visibilitychange", handleVisibilityChange);
    document.removeEventListener("keydown", handleKeyDown);
    renderLoop.dispose();
    immediateUpdates.dispose();
    sceneRunMode.dispose();
    closeLiveWindowFrames(windowWorkspace.lifecycle);
    windowWorkspace.dispose();
    uiFrameScheduler.dispose();
    windowFocus.dispose();
    actorCreationScope.dispose();
    actorSystem.dispose();
    runtimeScheduler.dispose();
    frameUpdateRuntime.dispose();
    gizmoEventSystem.dispose();
    frameStateBridge.dispose();
    appShell.dispose();
  }

  measureScenePresentationAfterVisibilityChange();
  renderLoop.start();
  document.addEventListener("visibilitychange", handleVisibilityChange);
  document.addEventListener("keydown", handleKeyDown);

  return { dispose };
}

function createEditorBackedUiLayoutCommandSink(commandSink: AppStateCommandSink): UiLayoutCommandSink {
  return {
    submit(command) {
      commandSink.submit(command);
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

function assertAppStateObserverBinding(component: Component): AppStateObserver {
  const candidate = component as Partial<AppStateObserver>;
  if (typeof candidate.onStateChanged !== "function") {
    throw new Error(
      `Component ${component.type} declares state-observer attachment but does not implement StateObserver.`
    );
  }
  return candidate as AppStateObserver;
}
