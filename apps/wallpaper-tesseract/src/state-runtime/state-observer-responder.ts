import type { Component } from "../actor-runtime";
import type { StateChangedEvent } from "../runtime/ports";

export interface StateObserverResponder extends Component {
  onStateChanged(event: StateChangedEvent): void;
}

export function isStateObserverResponder(component: Component): component is StateObserverResponder {
  return typeof (component as Partial<StateObserverResponder>).onStateChanged === "function";
}
