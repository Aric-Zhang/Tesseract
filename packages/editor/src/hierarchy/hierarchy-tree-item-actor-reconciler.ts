import type { Actor, ActorCreationContext } from "actor-system/core";
import { treeViewItemComponentType, type TreeViewItemDescriptor } from "ui-framework/controls";
import type { HierarchyObjectItem } from "./hierarchy-object-source";

export const HIERARCHY_TREE_ITEM_ACTOR_SEGMENT = ":item:";

export class HierarchyTreeItemActorReconciler {
  readonly #context: ActorCreationContext;
  readonly #parentActor: Actor;
  readonly #actorIdsByObjectId = new Map<string, string>();

  constructor(context: ActorCreationContext, parentActor: Actor) {
    this.#context = context;
    this.#parentActor = parentActor;
  }

  reconcile(items: readonly HierarchyObjectItem[], activeObjectId: string | null): void {
    const nextObjectIds = new Set(items.map((item) => item.id));
    for (const [objectId, actorId] of [...this.#actorIdsByObjectId]) {
      if (nextObjectIds.has(objectId)) continue;
      const actor = this.#context.actorSystem.getActor(actorId);
      if (actor) {
        this.#context.actorSystem.destroyActor(actor);
      }
      this.#actorIdsByObjectId.delete(objectId);
    }

    for (const item of items) {
      const actorId = this.actorIdForObjectId(item.id);
      const actor = this.getOrCreateActor(actorId, item);
      const descriptor = descriptorForItem(item, activeObjectId);
      const component = this.#context.componentRegistry.getComponent(actor, treeViewItemComponentType);
      if (component) {
        component.setDescriptor(descriptor);
      } else {
        this.#context.componentRegistry.addComponent(actor, treeViewItemComponentType, {
          descriptor
        });
      }
    }
  }

  dispose(): void {
    for (const actorId of [...this.#actorIdsByObjectId.values()]) {
      const actor = this.#context.actorSystem.getActor(actorId);
      if (actor) {
        this.#context.actorSystem.destroyActor(actor);
      }
    }
    this.#actorIdsByObjectId.clear();
  }

  private actorIdForObjectId(objectId: string): string {
    const existing = this.#actorIdsByObjectId.get(objectId);
    if (existing) return existing;
    const actorId = createHierarchyTreeItemActorId(this.#parentActor.id, objectId);
    this.#actorIdsByObjectId.set(objectId, actorId);
    return actorId;
  }

  private getOrCreateActor(actorId: string, item: HierarchyObjectItem): Actor {
    const existing = this.#context.actorSystem.getActor(actorId);
    if (existing) return existing;
    return this.#context.actorSystem.createActor({
      id: actorId,
      name: item.label,
      parent: this.#parentActor
    });
  }
}

export function createHierarchyTreeItemActorId(parentActorId: string, objectId: string): string {
  return `${parentActorId}${HIERARCHY_TREE_ITEM_ACTOR_SEGMENT}${encodeObjectIdSegment(objectId)}`;
}

export function isHierarchyTreeItemActorId(actorId: string): boolean {
  return actorId.includes(HIERARCHY_TREE_ITEM_ACTOR_SEGMENT);
}

function descriptorForItem(
  item: HierarchyObjectItem,
  activeObjectId: string | null
): TreeViewItemDescriptor {
  const activeSelf = item.activeSelf ?? true;
  const activeInHierarchy = item.activeInHierarchy ?? activeSelf;
  return {
    itemId: item.id,
    label: item.label,
    parentItemId: item.parentId,
    selected: item.id === activeObjectId,
    muted: !activeInHierarchy,
    enabled: true
  };
}

function encodeObjectIdSegment(value: string): string {
  return Array.from(value)
    .map((char) => char.codePointAt(0)?.toString(16).padStart(4, "0") ?? "0000")
    .join("-");
}
