import type { ComponentDefinition } from "../../actor-runtime";
import { gizmoEventBindingComponentType } from "../../gizmo-runtime";
import { stateObserverBindingComponentType } from "../../state-runtime";
import { frameUpdateAttachment } from "../../update-runtime";
import {
  AppMenuBarComponent,
  appMenuBarComponentType,
  type AppMenuBarComponentOptions
} from "./app-menu-bar-component";

export const appMenuBarComponentDefinition:
  ComponentDefinition<AppMenuBarComponent, AppMenuBarComponentOptions> = {
    type: appMenuBarComponentType,
    singleton: true,
    attachments: [frameUpdateAttachment],
    requires: [
      { type: gizmoEventBindingComponentType },
      { type: stateObserverBindingComponentType }
    ],
    createId(_actor, options) {
      return options?.id ?? "app-menu-bar";
    },
    create(actor, _context, options) {
      if (!options?.parent) {
        throw new Error("AppMenuBarComponent requires options.parent.");
      }
      if (!options.windowCatalog) {
        throw new Error("AppMenuBarComponent requires options.windowCatalog.");
      }
      if (!options.workspaceModePath) {
        throw new Error("AppMenuBarComponent requires options.workspaceModePath.");
      }
      return new AppMenuBarComponent(actor, options, {});
    }
  };
