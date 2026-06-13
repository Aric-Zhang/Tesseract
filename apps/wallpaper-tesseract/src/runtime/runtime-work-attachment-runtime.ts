import type {
  Actor,
  ActorSystemView,
  Component,
  ComponentAttachmentDescriptor,
  ComponentAttachmentRegistration,
  ComponentAttachmentRuntime
} from "../actor-runtime";
import { componentAttachmentKind } from "../actor-runtime";
import type { RuntimeFrame, RuntimeWork } from "runtime-core";
import type { ProductionRuntimeSchedulerService } from "./runtime-scheduler-service";

export const runtimeWorkAttachmentKind = componentAttachmentKind("runtime-work");

export const runtimeWorkAttachment: ComponentAttachmentDescriptor = {
  kind: runtimeWorkAttachmentKind
};

export interface RuntimeWorkParticipant {
  updateRuntimeFrame(frame: RuntimeFrame): void;
}

export interface RuntimeWorkAttachmentRuntimeOptions {
  readonly actorSystem: ActorSystemView;
  readonly scheduler: ProductionRuntimeSchedulerService;
}

export class RuntimeWorkAttachmentRuntime implements ComponentAttachmentRuntime {
  readonly #actorSystem: ActorSystemView;
  readonly #scheduler: ProductionRuntimeSchedulerService;

  constructor(options: RuntimeWorkAttachmentRuntimeOptions) {
    this.#actorSystem = options.actorSystem;
    this.#scheduler = options.scheduler;
  }

  attach(
    actor: Actor,
    component: Component,
    attachments: readonly ComponentAttachmentDescriptor[]
  ): ComponentAttachmentRegistration {
    if (!attachments.some((attachment) => attachment.kind === runtimeWorkAttachmentKind)) {
      return noopAttachmentRegistration;
    }
    const participant = assertRuntimeWorkParticipant(component);
    const work: RuntimeWork = {
      updateRuntimeFrame: (frame) => {
        if (!this.#actorSystem.hasActor(actor) || !this.#actorSystem.isActorActive(actor)) return;
        if (!component.enabled) return;
        participant.updateRuntimeFrame(frame);
      }
    };
    return this.#scheduler.registerRuntimeWork(work, {
      priority: getRuntimeWorkPriority(component)
    });
  }
}

function assertRuntimeWorkParticipant(component: Component): Component & RuntimeWorkParticipant {
  if (typeof (component as Partial<RuntimeWorkParticipant>).updateRuntimeFrame !== "function") {
    throw new Error(
      `Component ${component.type} declares runtime-work attachment but cannot update runtime frames.`
    );
  }
  return component as Component & RuntimeWorkParticipant;
}

function getRuntimeWorkPriority(component: Component): number {
  const candidate = component as Partial<{ runtimePriority: number; priority: number }>;
  return candidate.runtimePriority ?? candidate.priority ?? 0;
}

const noopAttachmentRegistration: ComponentAttachmentRegistration = {
  dispose(): void {}
};
