import type { ComponentDefinition } from "actor-core";
import { uiElementComponentType } from "../element";
import {
  RenderViewportComponent,
  renderViewportComponentType,
  type RenderViewportComponentOptions
} from "./render-viewport-component";

export const renderViewportComponentDefinition:
  ComponentDefinition<RenderViewportComponent, RenderViewportComponentOptions> = {
    type: renderViewportComponentType,
    singleton: true,
    requires: [{
      type: uiElementComponentType,
      autoAdd: false,
      reuseExisting: true
    }],
    createId(_actor, options) {
      return options?.id ?? "ui-render-viewport";
    },
    create(actor, context, options) {
      const uiElement = context.componentRegistry.getComponent(actor, uiElementComponentType);
      if (!uiElement) {
        throw new Error("RenderViewportComponent requires UiElementComponent.");
      }
      if (!options?.target) {
        throw new Error("RenderViewportComponent requires a render target.");
      }
      return new RenderViewportComponent(actor, uiElement, options);
    }
  };
