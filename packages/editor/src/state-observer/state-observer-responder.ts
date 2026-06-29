import type { Component } from "actor-system/core";
import type { AppStateChangedEvent } from "../app-state";

export interface StateObserverResponder extends Component {
  onStateChanged(event: AppStateChangedEvent): void;
}

export function isStateObserverResponder(component: Component): component is StateObserverResponder {
  return typeof (component as Partial<StateObserverResponder>).onStateChanged === "function";
}
