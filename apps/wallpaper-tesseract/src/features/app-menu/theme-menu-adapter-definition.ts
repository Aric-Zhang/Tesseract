import type { ComponentDefinition } from "../../actor-runtime";
import {
  ThemeMenuAdapterComponent,
  themeMenuAdapterComponentType,
  type ThemeMenuAdapterComponentOptions
} from "./theme-menu-adapter-component";

export const themeMenuAdapterComponentDefinition:
  ComponentDefinition<ThemeMenuAdapterComponent, ThemeMenuAdapterComponentOptions> = {
    type: themeMenuAdapterComponentType,
    singleton: true,
    createId(_actor, options) {
      return options?.id ?? "theme-menu-adapter";
    },
    create(actor, _context, options) {
      if (!options) throw new Error("ThemeMenuAdapterComponent requires options.");
      return new ThemeMenuAdapterComponent(actor, options);
    }
  };
