import type { Component } from "../actor-runtime";
import type { SceneStateChangedEvent } from "../scene-runtime";

export interface StateObserverResponder extends Component {
  onSceneStateChanged(event: SceneStateChangedEvent): void;
}

export function isStateObserverResponder(component: Component): component is StateObserverResponder {
  return typeof (component as Partial<StateObserverResponder>).onSceneStateChanged === "function";
}
