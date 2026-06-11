import type { FeatureActorContext } from "../../runtime/ports";
import {
  createWindowWorkspaceContentId,
  uiVec2,
  windowViewInstanceId,
  windowViewKey,
  windowViewTypeKey,
  type WindowViewFactoryRegistry
} from "../../window-runtime";
import type {
  WindowWorkspaceFloatingFramePolicy
} from "../window-workspace";
import { createInspectorViewActor } from "./inspector-view-actor-factory";

export const INSPECTOR_VIEW_TYPE = windowViewTypeKey("inspector");

const INSPECTOR_INSTANCE_DEFINITIONS = [
  {
    viewKey: windowViewKey("inspector:a"),
    instanceId: windowViewInstanceId("inspector:a"),
    title: "Inspector 1",
    actorId: "inspector-a-view",
    actorName: "Inspector 1 View",
    offset: 0
  },
  {
    viewKey: windowViewKey("inspector:b"),
    instanceId: windowViewInstanceId("inspector:b"),
    title: "Inspector 2",
    actorId: "inspector-b-view",
    actorName: "Inspector 2 View",
    offset: 28
  }
] as const;

export interface InstallInspectorFeatureOptions {
  readonly context: FeatureActorContext;
  readonly viewFactories: WindowViewFactoryRegistry;
}

export function createInspectorWindowWorkspaceFloatingFramePolicies(): ReadonlyArray<
  readonly [string, WindowWorkspaceFloatingFramePolicy]
> {
  return INSPECTOR_INSTANCE_DEFINITIONS.map((definition) => [
    definition.viewKey,
    {
      preferredActorId: `${definition.viewKey}-window`,
      preferredComponentId: `floating-window:${definition.viewKey}`,
      fallbackState: {
        position: uiVec2(360 + definition.offset, 110 + definition.offset),
        size: uiVec2(300, 220),
        visible: true
      },
      minSize: uiVec2(220, 150),
      className: "inspector-window",
      priority: 1050,
      menuOrder: 1050
    }
  ]);
}

export function installInspectorFeature(options: InstallInspectorFeatureOptions): void {
  for (const definition of INSPECTOR_INSTANCE_DEFINITIONS) {
    options.viewFactories.register({
      viewKey: definition.viewKey,
      typeKey: INSPECTOR_VIEW_TYPE,
      instanceId: definition.instanceId,
      multiplicity: "multi-instance",
      label: "Inspector",
      order: 1050,
      createViewRuntime: (createOptions) => {
        const handle = createInspectorViewActor(options.context, {
          actorId: definition.actorId,
          actorName: definition.actorName,
          parentActor: createOptions.parentFrameActor,
          label: definition.title,
          contentId: createWindowWorkspaceContentId(createOptions.identity),
          contentRegistration: createOptions.contentRegistration
        });
        return {
          viewActor: handle.component.actor,
          content: handle.component,
          title: definition.title,
          disposeViewRuntime: () => handle.disposeRuntimeTracking?.()
        };
      }
    });
  }
}
