import type { Actor } from "./actor";
import type { Component } from "./component";
import type {
  ComponentAttachmentDescriptor,
  ComponentAttachmentRegistration,
  ComponentAttachmentRuntime
} from "./component-attachment-runtime";

export class CompositeComponentAttachmentRuntime implements ComponentAttachmentRuntime {
  readonly #runtimes: readonly ComponentAttachmentRuntime[];

  constructor(runtimes: readonly ComponentAttachmentRuntime[]) {
    this.#runtimes = [...runtimes];
  }

  attach(
    actor: Actor,
    component: Component,
    attachments: readonly ComponentAttachmentDescriptor[]
  ): ComponentAttachmentRegistration {
    const registrations: ComponentAttachmentRegistration[] = [];
    try {
      for (const runtime of this.#runtimes) {
        registrations.push(runtime.attach(actor, component, attachments));
      }
    } catch (error) {
      disposeRegistrationsReverse(registrations);
      throw error;
    }
    return {
      dispose: () => disposeRegistrationsReverse(registrations)
    };
  }
}

function disposeRegistrationsReverse(registrations: ComponentAttachmentRegistration[]): void {
  const errors: unknown[] = [];
  for (let i = registrations.length - 1; i >= 0; i -= 1) {
    try {
      registrations[i].dispose();
    } catch (error) {
      errors.push(error);
    }
  }
  registrations.length = 0;
  if (errors.length === 1) {
    throw errors[0];
  }
  if (errors.length > 1) {
    throw new AggregateError(errors, "Multiple component attachment registrations failed to dispose.");
  }
}
