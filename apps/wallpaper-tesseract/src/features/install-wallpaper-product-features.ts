import type { GizmoDebugLogEntry } from "gizmo-core";
import type { ActorCreationContext } from "actor-core";
import {
  AppStateParameterStore,
  createActorHierarchyObjectSource,
  createDefaultDebugWindowState,
  createDefaultHierarchyPanelState,
  createDefaultSceneWindowState,
  createEditorBackedWorkspaceCommandSink,
  createInspectorWindowWorkspaceFloatingFramePolicies,
  createToolWindowDefaultOpenViews,
  createToolWindowWorkspaceFloatingFramePolicies,
  editorStatePaths,
  registerDebugWindowParameters,
  registerHierarchyPanelParameters,
  registerSceneWindowParameters,
  registerWorkspaceModeParameters,
  type AppStateCommandSink,
  type AppStateObserver,
  type DebugLogContentComponent
} from "editor";
import type { StateObserverRegistry } from "editor";
import {
  WORKSPACE_ROOT_FRAME_ID,
  type WindowFrameIntentSink,
  type WindowViewFactoryRegistry,
  type DefaultWindowFrameLifecycleController,
  type WindowWorkspacePresentationController,
  type WindowWorkspaceViewCatalog
} from "../window-runtime";
import type {
  WindowWorkspaceDefaultOpenView,
  WindowWorkspaceFloatingFramePolicy
} from "./window-workspace";
import { installAppMenuFeature } from "./app-menu";
import {
  createSceneDefaultOpenView,
  createSceneWindowWorkspaceFloatingFramePolicy,
  installSceneViewFeature,
} from "./scene";
import { installInspectorFeature } from "editor";
import { installToolWindowFeatures } from "editor";
import { WorkspaceModeController } from "./workspace-mode";

const SCENE_WINDOW_ACTOR_ID = "scene-window";
const SCENE_WINDOW_ACTOR_NAME = "Scene";
const TESSERACT4_ACTOR_ID = "tesseract-4";
const TESSERACT4_ACTOR_NAME = "Tesseract4";
const CAMERA3_GIZMO_ACTOR_ID = "camera-3";
const CAMERA3_GIZMO_ACTOR_NAME = "Camera3";
const DEBUG_LOG_WINDOW_ACTOR_ID = "debug-log-window";
const DEBUG_LOG_WINDOW_ACTOR_NAME = "Debug Log Window";
const HIERARCHY_PANEL_ACTOR_ID = "hierarchy-panel";
const HIERARCHY_PANEL_ACTOR_NAME = "Hierarchy Panel";
const APP_MENU_BAR_ACTOR_ID = "app-menu-bar";
const APP_MENU_BAR_ACTOR_NAME = "App Menu";

export interface WallpaperProductWindowPolicy {
  readonly floatingFramePolicies: ReadonlyMap<string, WindowWorkspaceFloatingFramePolicy>;
  readonly defaultOpenViews: readonly WindowWorkspaceDefaultOpenView[];
}

export interface WallpaperDebugLogSink {
  append(entry: GizmoDebugLogEntry): void;
  bind(component: DebugLogContentComponent | null): void;
}

export function createWallpaperDebugLogSink(): WallpaperDebugLogSink {
  let target: DebugLogContentComponent | null = null;
  return {
    append(entry) {
      target?.append(entry);
    },
    bind(component) {
      target = component;
    }
  };
}

export interface InstallWallpaperProductFeaturesOptions {
  readonly context: ActorCreationContext;
  readonly mount: HTMLElement;
  readonly menuParent: HTMLElement;
  readonly stateStore: AppStateParameterStore;
  readonly stateBridge: AppStateCommandSink & StateObserverRegistry<AppStateObserver>;
  readonly viewFactories: WindowViewFactoryRegistry;
  readonly lifecycle: DefaultWindowFrameLifecycleController;
  readonly windowCatalog: WindowWorkspaceViewCatalog;
  readonly windowFrameIntents: WindowFrameIntentSink;
  readonly workspacePresentation: WindowWorkspacePresentationController;
  readonly debugLogSink: WallpaperDebugLogSink;
}

export interface InstalledWallpaperProductFeatures {
  readonly workspaceModeController: WorkspaceModeController;
  measureSceneViewport(): void;
  renderFrameSources(): void;
  dispose(): void;
}

export function installWallpaperProductStateDefaults(store: AppStateParameterStore): WallpaperProductWindowPolicy {
  const sceneWindowState = createDefaultSceneWindowState();
  const debugWindowState = createDefaultDebugWindowState();
  const hierarchyPanelState = createDefaultHierarchyPanelState();
  registerSceneWindowParameters(store, sceneWindowState);
  registerDebugWindowParameters(store, debugWindowState);
  registerHierarchyPanelParameters(store, hierarchyPanelState);
  registerWorkspaceModeParameters(store);

  return {
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
    ]
  };
}

export function installWallpaperProductFeatures(
  options: InstallWallpaperProductFeaturesOptions
): InstalledWallpaperProductFeatures {
  const hierarchyObjectSource = createActorHierarchyObjectSource({
    actorSystem: options.context.actorSystem,
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

  const sceneFeature = installSceneViewFeature({
    context: options.context,
    mount: options.mount,
    actorIds: {
      sceneWindowActorId: SCENE_WINDOW_ACTOR_ID,
      sceneWindowActorName: SCENE_WINDOW_ACTOR_NAME,
      camera3GizmoActorId: CAMERA3_GIZMO_ACTOR_ID,
      camera3GizmoActorName: CAMERA3_GIZMO_ACTOR_NAME,
      tesseract4ActorId: TESSERACT4_ACTOR_ID,
      tesseract4ActorName: TESSERACT4_ACTOR_NAME
    },
    viewFactories: options.viewFactories,
    locations: options.lifecycle
  });
  installInspectorFeature({
    context: options.context,
    viewFactories: options.viewFactories
  });
  installToolWindowFeatures({
    context: options.context,
    viewFactories: options.viewFactories,
    hierarchyObjectSource,
    debugLogLabel: DEBUG_LOG_WINDOW_ACTOR_NAME,
    hierarchyLabel: HIERARCHY_PANEL_ACTOR_NAME,
    actorIds: {
      debugLogViewActorId: `${DEBUG_LOG_WINDOW_ACTOR_ID}:view`,
      debugLogViewActorName: `${DEBUG_LOG_WINDOW_ACTOR_NAME} View`,
      hierarchyPanelViewActorId: `${HIERARCHY_PANEL_ACTOR_ID}:view`,
      hierarchyPanelViewActorName: `${HIERARCHY_PANEL_ACTOR_NAME} View`
    },
    onDebugLogContentChanged: (component) => options.debugLogSink.bind(component)
  });
  installAppMenuFeature({
    context: options.context,
    actorId: APP_MENU_BAR_ACTOR_ID,
    actorName: APP_MENU_BAR_ACTOR_NAME,
    parent: options.menuParent,
    windowCatalog: options.windowCatalog,
    windowFrameIntents: options.windowFrameIntents,
    workspaceModePath: editorStatePaths.workspace.mode
  });
  const workspaceModeController = new WorkspaceModeController({
    commandSink: createEditorBackedWorkspaceCommandSink(options.stateBridge),
    getValue: (path) => options.stateStore.get(path),
    sceneView: {
      viewKey: "scene",
      locations: options.lifecycle,
      commands: options.lifecycle,
      presentation: options.lifecycle,
      open: () => options.lifecycle.openView("scene", "programmatic")
    },
    workspacePresentation: options.workspacePresentation,
    toolWindows: [],
    onScenePresentationChanged: () => sceneFeature.renderableSceneViews.current?.measureNow()
  });
  const workspaceModeRegistration = options.stateBridge.subscribe(workspaceModeController);

  return {
    workspaceModeController,
    measureSceneViewport() {
      sceneFeature.renderableSceneViews.current?.measureNow();
    },
    renderFrameSources() {
      sceneFeature.renderableSceneViews.current?.render();
    },
    dispose() {
      workspaceModeRegistration.dispose();
      workspaceModeController.dispose();
    }
  };
}
