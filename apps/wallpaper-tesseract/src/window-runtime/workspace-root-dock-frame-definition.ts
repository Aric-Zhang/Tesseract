import type { ComponentDefinition } from "../actor-runtime";
import { gizmoEventBindingComponentType } from "../gizmo-runtime";
import {
  WorkspaceRootDockFrameComponent,
  workspaceRootDockFrameComponentType,
  type WorkspaceRootDockFrameComponentOptions
} from "./workspace-root-dock-frame-component";
import { windowFrameSurfaceComponentType } from "ui-framework";

export const workspaceRootDockFrameComponentDefinition:
  ComponentDefinition<WorkspaceRootDockFrameComponent, WorkspaceRootDockFrameComponentOptions> = {
    type: workspaceRootDockFrameComponentType,
    singleton: true,
    requires: [
      { type: gizmoEventBindingComponentType },
      { type: windowFrameSurfaceComponentType }
    ],
    createId(_actor, options) {
      if (!options?.id) {
        throw new Error("WorkspaceRootDockFrameComponent options.id is required.");
      }
      return options.id;
    },
    create(actor, _context, options) {
      if (!options) {
        throw new Error("WorkspaceRootDockFrameComponent options are required.");
      }
      const surface = _context.componentRegistry.getComponent(actor, windowFrameSurfaceComponentType);
      if (!surface) {
        throw new Error("WorkspaceRootDockFrameComponent requires WindowFrameSurfaceComponent.");
      }
      return new WorkspaceRootDockFrameComponent(actor, options, { surface });
    }
  };
