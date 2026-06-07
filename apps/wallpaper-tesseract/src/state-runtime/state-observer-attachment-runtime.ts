import type {
  Actor,
  Component,
  ComponentAttachmentDescriptor,
  ComponentAttachmentRegistration,
  ComponentAttachmentRuntime
} from "../actor-runtime";
import { componentAttachmentKind } from "../actor-runtime";
import type { StateObserverRegistry } from "./state-observer-registry";

export const stateObserverAttachmentKind = componentAttachmentKind("state-observer-binding");

export const stateObserverAttachment: ComponentAttachmentDescriptor = {
  kind: stateObserverAttachmentKind
};

export interface StateObserverAttachmentRuntimeOptions<TObserver> {
  readonly registry: StateObserverRegistry<TObserver>;
  readonly getObserver: (component: Component) => TObserver;
}

export class StateObserverAttachmentRuntime<TObserver> implements ComponentAttachmentRuntime {
  readonly #registry: StateObserverRegistry<TObserver>;
  readonly #getObserver: (component: Component) => TObserver;

  constructor(options: StateObserverAttachmentRuntimeOptions<TObserver>) {
    this.#registry = options.registry;
    this.#getObserver = options.getObserver;
  }

  attach(
    _actor: Actor,
    component: Component,
    attachments: readonly ComponentAttachmentDescriptor[]
  ): ComponentAttachmentRegistration {
    if (!attachments.some((attachment) => attachment.kind === stateObserverAttachmentKind)) {
      return noopAttachmentRegistration;
    }
    return this.#registry.subscribe(this.#getObserver(component));
  }
}

const noopAttachmentRegistration: ComponentAttachmentRegistration = {
  dispose(): void {}
};

