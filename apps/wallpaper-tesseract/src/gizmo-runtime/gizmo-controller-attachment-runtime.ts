import type { GizmoController } from "gizmo-core";
import type {
  Actor,
  Component,
  ComponentAttachmentDescriptor,
  ComponentAttachmentRegistration,
  ComponentAttachmentRuntime
} from "../actor-runtime";
import { componentAttachmentKind } from "../actor-runtime";
import type { GizmoControllerRegistry } from "./gizmo-controller-registry";

export const gizmoControllerAttachmentKind = componentAttachmentKind("gizmo-controller-binding");

export const gizmoControllerAttachment: ComponentAttachmentDescriptor = {
  kind: gizmoControllerAttachmentKind
};

export interface GizmoControllerAttachmentRuntimeOptions {
  readonly registry: GizmoControllerRegistry;
}

export class GizmoControllerAttachmentRuntime implements ComponentAttachmentRuntime {
  readonly #registry: GizmoControllerRegistry;

  constructor(options: GizmoControllerAttachmentRuntimeOptions) {
    this.#registry = options.registry;
  }

  attach(
    _actor: Actor,
    component: Component,
    attachments: readonly ComponentAttachmentDescriptor[]
  ): ComponentAttachmentRegistration {
    if (!attachments.some((attachment) => attachment.kind === gizmoControllerAttachmentKind)) {
      return noopAttachmentRegistration;
    }
    return this.#registry.register(assertGizmoController(component));
  }
}

function assertGizmoController(component: Component): Component & GizmoController {
  const candidate = component as Partial<GizmoController>;
  if (
    typeof candidate.id !== "string" ||
    typeof candidate.priority !== "number" ||
    typeof candidate.hitTest !== "function"
  ) {
    throw new Error(
      `Component ${component.type} declares gizmo-controller attachment but does not implement GizmoController.`
    );
  }
  return component as Component & GizmoController;
}

const noopAttachmentRegistration: ComponentAttachmentRegistration = {
  dispose(): void {}
};

