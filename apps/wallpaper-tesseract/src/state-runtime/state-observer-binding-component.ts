import type { Actor, Component, ComponentType } from "../actor-runtime";
import type { StateChangedEvent, StateObserver } from "../runtime/ports";
import { isStateObserverResponder } from "./state-observer-responder";

export const stateObserverBindingComponentType =
  "state-observer-binding" as ComponentType<StateObserverBindingComponent>;

interface StateObserverBindingComponentOptions {
  actor: Actor;
  id: string;
}

export class StateObserverBindingComponent implements Component, StateObserver {
  readonly id: string;
  readonly type = stateObserverBindingComponentType;
  readonly actor: Actor;
  enabled = true;

  constructor(options: StateObserverBindingComponentOptions) {
    this.actor = options.actor;
    this.id = options.id;
  }

  onStateChanged(event: StateChangedEvent): void {
    if (!this.enabled) return;
    for (const component of this.actor.listComponents()) {
      if (component === this || !component.enabled || !isStateObserverResponder(component)) continue;
      component.onStateChanged(event);
    }
  }
}
