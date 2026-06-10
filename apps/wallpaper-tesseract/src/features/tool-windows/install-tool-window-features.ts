import {
  createDebugLogViewActor,
  DEBUG_WINDOW_MIN_HEIGHT,
  DEBUG_WINDOW_MIN_WIDTH,
  type DebugLogContentComponent,
  type DebugWindowState
} from "../../debug";
import {
  createHierarchyPanelViewActor,
  HIERARCHY_WINDOW_MIN_HEIGHT,
  HIERARCHY_WINDOW_MIN_WIDTH,
  type HierarchyPanelInitialState,
  type HierarchyObjectSource
} from "../../hierarchy";
import { editorWindowLayoutPaths } from "../../editor/window-layout-state";
import type { FeatureActorContext } from "../../runtime/ports";
import { uiVec2, type WindowViewFactoryRegistry } from "../../window-runtime";
import type {
  WindowWorkspaceDefaultOpenView,
  WindowWorkspaceFloatingFramePolicy
} from "../window-workspace";

export interface ToolWindowActorIds {
  readonly debugLogViewActorId: string;
  readonly debugLogViewActorName: string;
  readonly hierarchyPanelViewActorId: string;
  readonly hierarchyPanelViewActorName: string;
}

export interface InstallToolWindowFeaturesOptions {
  readonly context: FeatureActorContext;
  readonly viewFactories: WindowViewFactoryRegistry;
  readonly actorIds: ToolWindowActorIds;
  readonly debugLogLabel: string;
  readonly hierarchyLabel: string;
  readonly hierarchyObjectSource: HierarchyObjectSource;
  readonly onDebugLogContentChanged?: (component: DebugLogContentComponent | null) => void;
}

export function createToolWindowWorkspaceFloatingFramePolicies(options: {
  readonly debugFallbackState: DebugWindowState;
  readonly hierarchyFallbackState: HierarchyPanelInitialState["window"];
}): ReadonlyArray<readonly [string, WindowWorkspaceFloatingFramePolicy]> {
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

export function createToolWindowDefaultOpenViews(): readonly WindowWorkspaceDefaultOpenView[] {
  return [
    { viewKey: "debug" },
    { viewKey: "hierarchy" }
  ];
}

export function installToolWindowFeatures(options: InstallToolWindowFeaturesOptions): void {
  options.viewFactories.register({
    viewKey: "debug",
    label: options.debugLogLabel,
    order: 1000,
    createViewRuntime: (createOptions) => {
      const handle = createDebugLogViewActor(options.context, {
        actorId: options.actorIds.debugLogViewActorId,
        actorName: options.actorIds.debugLogViewActorName,
        parentActor: createOptions.parentFrameActor
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
    label: options.hierarchyLabel,
    order: 1010,
    createViewRuntime: (createOptions) => {
      const handle = createHierarchyPanelViewActor(options.context, {
        actorId: options.actorIds.hierarchyPanelViewActorId,
        actorName: options.actorIds.hierarchyPanelViewActorName,
        parentActor: createOptions.parentFrameActor,
        objectSource: options.hierarchyObjectSource
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
