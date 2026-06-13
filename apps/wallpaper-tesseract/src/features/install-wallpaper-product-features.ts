import type { GizmoDebugLogEntry } from "gizmo-core";
import type { ActorCreationContext } from "actor-core";
import {
  AppStateParameterStore,
  createActorHierarchyObjectSource,
  createToolWindowActorHierarchyMetadata,
  installInspectorWorkspacePolicy,
  installToolWindowWorkspacePolicy,
  editorStatePaths,
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
import {
  createAppMenuActorHierarchyMetadata,
  installAppMenuFeature
} from "./app-menu";
import {
  createSceneActorHierarchyMetadata,
  installSceneWorkspacePolicy,
  installSceneViewFeature
} from "./scene";
import { installInspectorFeature } from "editor";
import { installToolWindowFeatures } from "editor";
import {
  installWorkspaceModeController,
  installWorkspaceModeState,
  type InstalledWorkspaceModeController
} from "./workspace-mode";
import type { RuntimeSceneViewRuntimeRegistry } from "../runtime/runtime-scene-view-runtime";

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
  readonly stateBridge: StateObserverRegistry<AppStateObserver>;
  readonly viewFactories: WindowViewFactoryRegistry;
  readonly lifecycle: DefaultWindowFrameLifecycleController;
  readonly windowCatalog: WindowWorkspaceViewCatalog;
  readonly windowFrameIntents: WindowFrameIntentSink;
  readonly workspacePresentation: WindowWorkspacePresentationController;
  readonly debugLogSink: WallpaperDebugLogSink;
  readonly runtimeSceneViews: RuntimeSceneViewRuntimeRegistry;
}

export interface InstalledWallpaperProductFeatures {
  readonly workspaceModeController: InstalledWorkspaceModeController["workspaceModeController"];
  dispose(): void;
}

export function installWallpaperProductStateDefaults(store: AppStateParameterStore): WallpaperProductWindowPolicy {
  const scenePolicy = installSceneWorkspacePolicy(store);
  const inspectorPolicy = installInspectorWorkspacePolicy();
  const toolWindowPolicy = installToolWindowWorkspacePolicy(store);
  installWorkspaceModeState(store);

  return {
    floatingFramePolicies: new Map([
      scenePolicy.floatingFramePolicy,
      ...inspectorPolicy.floatingFramePolicies,
      ...toolWindowPolicy.floatingFramePolicies
    ]),
    defaultOpenViews: [
      scenePolicy.defaultOpenView,
      ...toolWindowPolicy.defaultOpenViews
    ]
  };
}

export function installWallpaperProductFeatures(
  options: InstallWallpaperProductFeaturesOptions
): InstalledWallpaperProductFeatures {
  const hierarchyObjectSource = createActorHierarchyObjectSource({
    actorSystem: options.context.actorSystem,
    metadataByActorId: {
      ...createSceneActorHierarchyMetadata(),
      ...createToolWindowActorHierarchyMetadata(),
      ...createAppMenuActorHierarchyMetadata(),
      [WORKSPACE_ROOT_FRAME_ID]: { label: "Workspace Root", order: 1030 }
    }
  });

  installSceneViewFeature({
    context: options.context,
    mount: options.mount,
    runtimeSceneViews: options.runtimeSceneViews,
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
    onDebugLogContentChanged: (component) => options.debugLogSink.bind(component)
  });
  installAppMenuFeature({
    context: options.context,
    parent: options.menuParent,
    windowCatalog: options.windowCatalog,
    windowFrameIntents: options.windowFrameIntents,
    workspaceModePath: editorStatePaths.workspace.mode
  });
  const workspaceMode = installWorkspaceModeController({
    stateStore: options.stateStore,
    stateBridge: options.stateBridge,
    sceneView: {
      viewKey: "scene",
      locations: options.lifecycle,
      commands: options.lifecycle,
      open: () => options.lifecycle.openView("scene", "programmatic")
    },
    workspacePresentation: options.workspacePresentation,
    onScenePresentationChanged: () => options.runtimeSceneViews.measureCurrentView()
  });

  return {
    workspaceModeController: workspaceMode.workspaceModeController,
    dispose() {
      workspaceMode.dispose();
    }
  };
}
