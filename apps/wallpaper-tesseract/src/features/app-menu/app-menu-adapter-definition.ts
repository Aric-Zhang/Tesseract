import type { ComponentDefinition } from "../../actor-runtime";
import { stateObserverBindingComponentType } from "editor";
import { frameUpdateAttachment } from "ui-framework";
import {
  AppMenuAdapterComponent,
  appMenuAdapterComponentType,
  type AppMenuAdapterComponentOptions
} from "./app-menu-adapter-component";

export const appMenuAdapterComponentDefinition:
  ComponentDefinition<AppMenuAdapterComponent, AppMenuAdapterComponentOptions> = {
    type: appMenuAdapterComponentType,
    singleton: true,
    attachments: [frameUpdateAttachment],
    requires: [
      { type: stateObserverBindingComponentType }
    ],
    createId(_actor, options) {
      return options?.id ?? "app-menu-adapter";
    },
    create(actor, _context, options) {
      if (!options) {
        throw new Error("AppMenuAdapterComponent requires options.");
      }
      return new AppMenuAdapterComponent(actor, options);
    }
  };
