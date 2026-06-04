import type { Component, RegisteredActor } from "../actor-runtime";
import type { FloatingWindowComponent } from "./floating-window-component";

export interface RegisteredWindowActor<TContent extends Component = Component> extends RegisteredActor<TContent> {
  readonly window: FloatingWindowComponent;
}
