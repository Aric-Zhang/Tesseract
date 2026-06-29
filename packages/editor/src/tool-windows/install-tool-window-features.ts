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
  createActorHierarchyObjectSource,
  createHierarchyPanelViewActor,
  isHierarchyTreeItemActorId,
  HIERARCHY_WINDOW_MIN_HEIGHT,
  HIERARCHY_WINDOW_MIN_WIDTH,
  registerHierarchyPanelParameters,
  type HierarchyPanelInitialState
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

const DEBUG_LOG_WINDOW_ACTOR_ID = "debug-log-window";
const DEBUG_LOG_WINDOW_ACTOR_NAME = "Debug Log Window";
const HIERARCHY_PANEL_ACTOR_ID = "hierarchy-panel";
const HIERARCHY_PANEL_ACTOR_NAME = "Hierarchy Panel";

const DEBUG_LOG_VIEW_ACTOR_ID = `${DEBUG_LOG_WINDOW_ACTOR_ID}:view`;
const DEBUG_LOG_VIEW_ACTOR_NAME = `${DEBUG_LOG_WINDOW_ACTOR_NAME} View`;
const HIERARCHY_PANEL_VIEW_ACTOR_ID = `${HIERARCHY_PANEL_ACTOR_ID}:view`;
const HIERARCHY_PANEL_VIEW_ACTOR_NAME = `${HIERARCHY_PANEL_ACTOR_NAME} View`;

export interface InstallToolWindowFeaturesOptions {
  readonly context: ActorCreationContext;
  readonly viewFactories: WindowViewFactoryRegistry;
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
  const hierarchyObjectSource = createActorHierarchyObjectSource({
    actorSystem: options.context.actorSystem,
    includeActor: (actor) => (
      actor.id !== HIERARCHY_PANEL_ACTOR_ID &&
      actor.id !== HIERARCHY_PANEL_VIEW_ACTOR_ID &&
      !isHierarchyTreeItemActorId(actor.id)
    )
  });
  options.viewFactories.register({
    viewKey: "debug",
    label: DEBUG_LOG_WINDOW_ACTOR_NAME,
    order: 1000,
    createViewRuntime: (createOptions) => {
      const handle = createDebugLogViewActor(options.context, {
        actorId: DEBUG_LOG_VIEW_ACTOR_ID,
        actorName: DEBUG_LOG_VIEW_ACTOR_NAME,
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
    label: HIERARCHY_PANEL_ACTOR_NAME,
    order: 1010,
    createViewRuntime: (createOptions) => {
      const handle = createHierarchyPanelViewActor(options.context, {
        actorId: HIERARCHY_PANEL_VIEW_ACTOR_ID,
        actorName: HIERARCHY_PANEL_VIEW_ACTOR_NAME,
        parentActor: createOptions.parentFrameActor,
        objectSource: hierarchyObjectSource,
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
