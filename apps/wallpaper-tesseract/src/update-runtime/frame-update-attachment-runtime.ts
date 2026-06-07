import type {
  Actor,
  ActorSystemView,
  Component,
  ComponentAttachmentDescriptor,
  ComponentAttachmentRegistration,
  ComponentAttachmentRuntime
} from "../actor-runtime";
import { componentAttachmentKind } from "../actor-runtime";
import type { RuntimeObject, UpdateFrame } from "../runtime/ports";

export const frameUpdateAttachmentKind = componentAttachmentKind("frame-update");

export const frameUpdateAttachment: ComponentAttachmentDescriptor = {
  kind: frameUpdateAttachmentKind
};

export interface FrameUpdateParticipant {
  updateFrame(frame: UpdateFrame): void;
}

export interface FrameUpdateAttachmentRuntimeOptions {
  readonly actorSystem: ActorSystemView;
}

interface FrameUpdateRecord {
  readonly actor: Actor;
  readonly component: Component;
  readonly participant: FrameUpdateParticipant;
}

export class FrameUpdateAttachmentRuntime implements ComponentAttachmentRuntime, RuntimeObject {
  readonly id = "frame-update-attachment-runtime";
  readonly priority = -900;
  enabled = true;
  readonly #actorSystem: ActorSystemView;
  readonly #recordsByActorId = new Map<string, FrameUpdateRecord[]>();
  readonly #records = new Set<FrameUpdateRecord>();

  constructor(options: FrameUpdateAttachmentRuntimeOptions) {
    this.#actorSystem = options.actorSystem;
  }

  attach(
    actor: Actor,
    component: Component,
    attachments: readonly ComponentAttachmentDescriptor[]
  ): ComponentAttachmentRegistration {
    if (!attachments.some((attachment) => attachment.kind === frameUpdateAttachmentKind)) {
      return noopAttachmentRegistration;
    }
    const record: FrameUpdateRecord = {
      actor,
      component,
      participant: assertFrameUpdateParticipant(component)
    };
    this.#records.add(record);
    const actorRecords = this.#recordsByActorId.get(actor.id) ?? [];
    actorRecords.push(record);
    this.#recordsByActorId.set(actor.id, actorRecords);
    return {
      dispose: () => {
        this.#records.delete(record);
        const records = this.#recordsByActorId.get(actor.id);
        if (!records) return;
        const index = records.indexOf(record);
        if (index >= 0) records.splice(index, 1);
        if (records.length === 0) {
          this.#recordsByActorId.delete(actor.id);
        }
      }
    };
  }

  updateFrame(frame: UpdateFrame): void {
    const actors = this.#actorSystem.listActorsInTreeOrder();
    for (const actor of actors) {
      if (!this.#actorSystem.hasActor(actor) || !this.#actorSystem.isActorActive(actor)) continue;
      const records = [...(this.#recordsByActorId.get(actor.id) ?? [])];
      for (const record of records) {
        if (!this.#actorSystem.hasActor(actor) || !this.#actorSystem.isActorActive(actor)) break;
        if (!this.#records.has(record) || record.actor !== actor) continue;
        if (!record.component.enabled) continue;
        record.participant.updateFrame(frame);
      }
    }
  }

  dispose(): void {
    this.#records.clear();
    this.#recordsByActorId.clear();
  }
}

function assertFrameUpdateParticipant(component: Component): Component & FrameUpdateParticipant {
  if (typeof (component as Partial<FrameUpdateParticipant>).updateFrame !== "function") {
    throw new Error(
      `Component ${component.type} declares frame-update attachment but cannot update frames.`
    );
  }
  return component as Component & FrameUpdateParticipant;
}

const noopAttachmentRegistration: ComponentAttachmentRegistration = {
  dispose(): void {}
};
