import type { ComponentDefinition } from "../actor-runtime";
import type { SceneCommandSink } from "../scene-runtime";
import { gizmoEventBindingComponentType } from "../gizmo-runtime";
import { frameUpdateAttachment } from "../update-runtime";
import { findOwningWindowContentHost } from "../window-runtime";
import {
  HierarchyPanelComponent,
  hierarchyPanelComponentType,
  type HierarchyPanelComponentOptions
} from "./hierarchy-panel-component";

export interface HierarchyPanelComponentDefinitionOptions {
  readonly commandSink?: SceneCommandSink;
}

export function createHierarchyPanelComponentDefinition(
  services: HierarchyPanelComponentDefinitionOptions = {}
): ComponentDefinition<HierarchyPanelComponent, HierarchyPanelComponentOptions> {
  return {
    type: hierarchyPanelComponentType,
    singleton: true,
    attachments: [frameUpdateAttachment],
    requires: [
      { type: gizmoEventBindingComponentType }
    ],
    createId(_actor, options) {
      return options?.id ?? "hierarchy-panel";
    },
    create(actor, context, options) {
      if (!options) {
        throw new Error("HierarchyPanelComponent options are required.");
      }
      const host = findOwningWindowContentHost(context.actorSystem, context.componentRegistry, actor);
      if (!host) {
        throw new Error("HierarchyPanelComponent requires an owning FloatingWindowComponent.");
      }
      return new HierarchyPanelComponent(actor, options, {
        host,
        commandSink: services.commandSink ?? noopSceneCommandSink
      });
    }
  };
}

export const hierarchyPanelComponentDefinition = createHierarchyPanelComponentDefinition();

const noopSceneCommandSink: SceneCommandSink = {
  submit(): void {}
};
