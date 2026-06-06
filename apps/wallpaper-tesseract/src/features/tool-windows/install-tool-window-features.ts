import {
  createDebugLogViewActor,
  type DebugLogContentComponent
} from "../../debug";
import {
  createHierarchyPanelViewActor,
  type HierarchyObjectSource
} from "../../hierarchy";
import type { FeatureActorContext } from "../../runtime/ports";
import type { WindowViewFactoryRegistry } from "../../window-runtime";

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
