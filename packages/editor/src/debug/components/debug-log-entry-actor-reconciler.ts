import type { Actor, ActorCreationContext } from "actor-core";
import {
  listViewItemComponentType,
  type ListViewItemDescriptor
} from "ui-framework";

const DEBUG_LOG_ENTRY_ACTOR_SEGMENT = ":log-entry:";
const DEBUG_LOG_PLACEHOLDER_ACTOR_SEGMENT = ":log-placeholder";

export interface DebugLogListItem {
  readonly key: string;
  readonly descriptor: ListViewItemDescriptor;
}

export class DebugLogEntryActorReconciler {
  readonly #context: ActorCreationContext;
  readonly #parentActor: Actor;
  readonly #actorIdsByItemKey = new Map<string, string>();

  constructor(context: ActorCreationContext, parentActor: Actor) {
    this.#context = context;
    this.#parentActor = parentActor;
  }

  reconcile(items: readonly DebugLogListItem[]): void {
    const nextItemKeys = new Set(items.map((item) => item.key));
    for (const [itemKey, actorId] of [...this.#actorIdsByItemKey]) {
      if (nextItemKeys.has(itemKey)) continue;
      const actor = this.#context.actorSystem.getActor(actorId);
      if (actor) {
        this.#context.actorSystem.destroyActor(actor);
      }
      this.#actorIdsByItemKey.delete(itemKey);
    }

    for (const item of items) {
      const actorId = this.actorIdForItemKey(item.key);
      const actor = this.getOrCreateActor(actorId, item);
      const component = this.#context.componentRegistry.getComponent(actor, listViewItemComponentType);
      if (component) {
        component.setDescriptor(item.descriptor);
      } else {
        this.#context.componentRegistry.addComponent(actor, listViewItemComponentType, {
          descriptor: item.descriptor
        });
      }
    }
  }

  dispose(): void {
    for (const actorId of [...this.#actorIdsByItemKey.values()]) {
      const actor = this.#context.actorSystem.getActor(actorId);
      if (actor) {
        this.#context.actorSystem.destroyActor(actor);
      }
    }
    this.#actorIdsByItemKey.clear();
  }

  private actorIdForItemKey(itemKey: string): string {
    const existing = this.#actorIdsByItemKey.get(itemKey);
    if (existing) return existing;
    const actorId = createDebugLogEntryActorId(this.#parentActor.id, itemKey);
    this.#actorIdsByItemKey.set(itemKey, actorId);
    return actorId;
  }

  private getOrCreateActor(actorId: string, item: DebugLogListItem): Actor {
    const existing = this.#context.actorSystem.getActor(actorId);
    if (existing) return existing;
    return this.#context.actorSystem.createActor({
      id: actorId,
      name: item.descriptor.text,
      parent: this.#parentActor
    });
  }
}

export function createDebugLogEntryActorId(parentActorId: string, itemKey: string): string {
  if (itemKey === "placeholder") {
    return `${parentActorId}${DEBUG_LOG_PLACEHOLDER_ACTOR_SEGMENT}`;
  }
  return `${parentActorId}${DEBUG_LOG_ENTRY_ACTOR_SEGMENT}${itemKey}`;
}

export function isDebugLogEntryActorId(actorId: string): boolean {
  return actorId.includes(DEBUG_LOG_ENTRY_ACTOR_SEGMENT) ||
    actorId.endsWith(DEBUG_LOG_PLACEHOLDER_ACTOR_SEGMENT);
}
