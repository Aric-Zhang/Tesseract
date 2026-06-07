import type { GizmoCancelEvent } from "gizmo-core";
import type {
  Actor,
  Component,
  ComponentAttachmentDescriptor,
  ComponentAttachmentRegistration,
  ComponentAttachmentRuntime
} from "../actor-runtime";
import { componentAttachmentKind } from "../actor-runtime";

export const activeInputCancellationAttachmentKind = componentAttachmentKind("active-input-cancellation");

export const activeInputCancellationAttachment: ComponentAttachmentDescriptor = {
  kind: activeInputCancellationAttachmentKind
};

export class ActiveInputCancellationRuntime implements ComponentAttachmentRuntime {
  readonly #activeInputCancellers = new Set<ActorInputCanceller>();

  attach(
    _actor: Actor,
    component: Component,
    attachments: readonly ComponentAttachmentDescriptor[]
  ): ComponentAttachmentRegistration {
    if (!attachments.some((attachment) => attachment.kind === activeInputCancellationAttachmentKind)) {
      return noopAttachmentRegistration;
    }
    const activeInputCanceller = assertActorInputCanceller(component);
    this.#activeInputCancellers.add(activeInputCanceller);
    return {
      dispose: () => {
        this.#activeInputCancellers.delete(activeInputCanceller);
      }
    };
  }

  cancelActiveActorInput(reason: GizmoCancelEvent["reason"] = "gizmo-disabled"): void {
    for (const canceller of [...this.#activeInputCancellers]) {
      canceller.cancelActiveInput(reason);
    }
  }
}

interface ActorInputCanceller {
  cancelActiveInput(reason?: GizmoCancelEvent["reason"]): void;
}

function assertActorInputCanceller(component: Component): Component & ActorInputCanceller {
  if (typeof (component as Partial<ActorInputCanceller>).cancelActiveInput !== "function") {
    throw new Error(
      `Component ${component.type} declares active-input-cancellation attachment but cannot cancel active input.`
    );
  }
  return component as Component & ActorInputCanceller;
}

const noopAttachmentRegistration: ComponentAttachmentRegistration = {
  dispose(): void {}
};
