import {
  createDebugLogViewActor,
  createDefaultDebugWindowState,
  DEBUG_WINDOW_MIN_HEIGHT,
  DEBUG_WINDOW_MIN_WIDTH,
  registerDebugWindowParameters,
  type DebugLogContentComponent,
  type DebugWindowState
} from "../debug";
import {
  createDefaultHierarchyPanelState,
  createHierarchyPanelViewActor,
  HIERARCHY_WINDOW_MIN_HEIGHT,
  HIERARCHY_WINDOW_MIN_WIDTH,
  registerHierarchyPanelParameters,
  type ActorHierarchyMetadata,
  type HierarchyPanelInitialState,
  type HierarchyObjectSource
} from "../hierarchy";
import type { AppStateParameterStore } from "../app-state-store";
import { editorWindowLayoutPaths } from "../window-layout-state";
import type { ActorCreationContext } from "actor-core";
import {
  createWindowWorkspaceContentId,
  uiVec2,
  type WindowViewFactoryRegistry
} from "ui-framework";
import type {
  EditorWindowWorkspaceDefaultOpenView,
  EditorWindowWorkspaceFloatingFramePolicy
} from "./editor-window-workspace-policy";

export interface ToolWindowActorIds {
  readonly debugLogViewActorId: string;
  readonly debugLogViewActorName: string;
  readonly hierarchyPanelViewActorId: string;
  readonly hierarchyPanelViewActorName: string;
}

export const DEBUG_LOG_WINDOW_ACTOR_ID = "debug-log-window";
export const DEBUG_LOG_WINDOW_ACTOR_NAME = "Debug Log Window";
export const HIERARCHY_PANEL_ACTOR_ID = "hierarchy-panel";
export const HIERARCHY_PANEL_ACTOR_NAME = "Hierarchy Panel";

const DEFAULT_TOOL_WINDOW_ACTOR_IDS: ToolWindowActorIds = {
  debugLogViewActorId: `${DEBUG_LOG_WINDOW_ACTOR_ID}:view`,
  debugLogViewActorName: `${DEBUG_LOG_WINDOW_ACTOR_NAME} View`,
  hierarchyPanelViewActorId: `${HIERARCHY_PANEL_ACTOR_ID}:view`,
  hierarchyPanelViewActorName: `${HIERARCHY_PANEL_ACTOR_NAME} View`
};

export function createToolWindowActorHierarchyMetadata(): Record<string, ActorHierarchyMetadata> {
  return {
    [DEBUG_LOG_WINDOW_ACTOR_ID]: { label: DEBUG_LOG_WINDOW_ACTOR_NAME, order: 1000 },
    [HIERARCHY_PANEL_ACTOR_ID]: { label: HIERARCHY_PANEL_ACTOR_NAME, order: 1010 }
  };
}

export interface InstallToolWindowFeaturesOptions {
  readonly context: ActorCreationContext;
  readonly viewFactories: WindowViewFactoryRegistry;
  readonly actorIds?: ToolWindowActorIds;
  readonly debugLogLabel?: string;
  readonly hierarchyLabel?: string;
  readonly hierarchyObjectSource: HierarchyObjectSource;
  readonly onDebugLogContentChanged?: (component: DebugLogContentComponent | null) => void;
}

function createToolWindowWorkspaceFloatingFramePolicies(options: {
  readonly debugFallbackState: DebugWindowState;
  readonly hierarchyFallbackState: HierarchyPanelInitialState["window"];
}): ReadonlyArray<readonly [string, EditorWindowWorkspaceFloatingFramePolicy]> {
  return [
    ["debug", {
      preferredActorId: "debug-log-window",
      preferredComponentId: "floating-window:debug-log",
      paths: editorWindowLayoutPaths.debugWindow,
      fallbackState: options.debugFallbackState,
      minSize: uiVec2(DEBUG_WINDOW_MIN_WIDTH, DEBUG_WINDOW_MIN_HEIGHT),
      className: "debug-log-window",
      priority: 1000,
      menuOrder: 1000
    }],
    ["hierarchy", {
      preferredActorId: "hierarchy-panel",
      preferredComponentId: "floating-window:hierarchy",
      paths: editorWindowLayoutPaths.hierarchyWindow,
      fallbackState: options.hierarchyFallbackState,
      minSize: uiVec2(HIERARCHY_WINDOW_MIN_WIDTH, HIERARCHY_WINDOW_MIN_HEIGHT),
      className: "hierarchy-window",
      priority: 1100
    }]
  ];
}

function createToolWindowDefaultOpenViews(): readonly EditorWindowWorkspaceDefaultOpenView[] {
  return [
    { viewKey: "debug" },
    { viewKey: "hierarchy" }
  ];
}

export interface InstalledToolWindowWorkspacePolicy {
  readonly floatingFramePolicies: ReadonlyArray<readonly [string, EditorWindowWorkspaceFloatingFramePolicy]>;
  readonly defaultOpenViews: readonly EditorWindowWorkspaceDefaultOpenView[];
}

export function installToolWindowWorkspacePolicy(
  store: AppStateParameterStore
): InstalledToolWindowWorkspacePolicy {
  const debugWindowState = createDefaultDebugWindowState();
  const hierarchyPanelState = createDefaultHierarchyPanelState();
  registerDebugWindowParameters(store, debugWindowState);
  registerHierarchyPanelParameters(store, hierarchyPanelState);

  return {
    floatingFramePolicies: createToolWindowWorkspaceFloatingFramePolicies({
      debugFallbackState: debugWindowState,
      hierarchyFallbackState: hierarchyPanelState.window
    }),
    defaultOpenViews: createToolWindowDefaultOpenViews()
  };
}

export function installToolWindowFeatures(options: InstallToolWindowFeaturesOptions): void {
  const actorIds = options.actorIds ?? DEFAULT_TOOL_WINDOW_ACTOR_IDS;
  options.viewFactories.register({
    viewKey: "debug",
    label: options.debugLogLabel ?? DEBUG_LOG_WINDOW_ACTOR_NAME,
    order: 1000,
    createViewRuntime: (createOptions) => {
      const handle = createDebugLogViewActor(options.context, {
        actorId: actorIds.debugLogViewActorId,
        actorName: actorIds.debugLogViewActorName,
        parentActor: createOptions.parentFrameActor,
        contentId: createWindowWorkspaceContentId(createOptions.identity),
        contentRegistration: createOptions.contentRegistration
      });
      options.onDebugLogContentChanged?.(handle.component);
      return {
        viewActor: handle.component.actor,
        content: handle.component,
        title: "Debug Log",
        disposeViewRuntime: () => {
          options.onDebugLogContentChanged?.(null);
          handle.disposeRuntimeTracking?.();
        }
      };
    }
  });
  options.viewFactories.register({
    viewKey: "hierarchy",
    label: options.hierarchyLabel ?? HIERARCHY_PANEL_ACTOR_NAME,
    order: 1010,
    createViewRuntime: (createOptions) => {
      const handle = createHierarchyPanelViewActor(options.context, {
        actorId: actorIds.hierarchyPanelViewActorId,
        actorName: actorIds.hierarchyPanelViewActorName,
        parentActor: createOptions.parentFrameActor,
        objectSource: options.hierarchyObjectSource,
        contentId: createWindowWorkspaceContentId(createOptions.identity),
        contentRegistration: createOptions.contentRegistration
      });
      return {
        viewActor: handle.component.actor,
        content: handle.component,
        title: "Hierarchy",
        disposeViewRuntime: () => handle.disposeRuntimeTracking?.()
      };
    }
  });
}
