import type { ComponentDefinition } from "../../actor-runtime";
import { gizmoEventBindingComponentType } from "../../gizmo-runtime";
import { stateObserverBindingComponentType } from "../../state-runtime";
import {
  AppMenuBarComponent,
  appMenuBarComponentType,
  type AppMenuBarComponentOptions
} from "./app-menu-bar-component";

export const appMenuBarComponentDefinition:
  ComponentDefinition<AppMenuBarComponent, AppMenuBarComponentOptions> = {
    type: appMenuBarComponentType,
    singleton: true,
    requires: [
      { type: gizmoEventBindingComponentType },
      { type: stateObserverBindingComponentType }
    ],
    createId(_actor, options) {
      return options?.id ?? "app-menu-bar";
    },
    create(actor, context, options) {
      if (!options?.parent) {
        throw new Error("AppMenuBarComponent requires options.parent.");
      }
      if (!options.windowSource) {
        throw new Error("AppMenuBarComponent requires options.windowSource.");
      }
      return new AppMenuBarComponent(actor, options, {
        commandSink: context.services.commandSink,
        actorWindowFocus: context.services.actorWindowFocus
      });
    }
  };
