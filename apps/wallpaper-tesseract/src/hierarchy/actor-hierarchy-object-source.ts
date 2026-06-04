import type { Actor, ActorSystemView } from "../actor-runtime";
import type { HierarchyObjectItem, HierarchyObjectSource } from "./hierarchy-object-source";

export interface ActorHierarchyMetadata {
  readonly label?: string;
  readonly parentId?: string | null;
  readonly order?: number;
}

export interface ActorHierarchyObjectSourceOptions {
  readonly actorSystem: ActorSystemView;
  readonly metadataByActorId?: ReadonlyMap<string, ActorHierarchyMetadata> | Record<string, ActorHierarchyMetadata>;
  readonly includeActor?: (actor: Actor) => boolean;
}

interface IndexedActor {
  readonly actor: Actor;
  readonly index: number;
  readonly metadata: ActorHierarchyMetadata | null;
  readonly parentId: string | null;
  readonly activeSelf: boolean;
  readonly activeInHierarchy: boolean;
}

export function createActorHierarchyObjectSource(
  options: ActorHierarchyObjectSourceOptions
): HierarchyObjectSource {
  return {
    listObjects() {
      return sortActors(options.actorSystem.listActorsInTreeOrder()
        .filter((actor) => options.includeActor?.(actor) ?? true)
        .map((actor, index) => {
          const metadata = readMetadata(options.metadataByActorId, actor.id);
          return {
            actor,
            index,
            metadata,
            parentId: options.actorSystem.getParentId(actor) ?? metadata?.parentId ?? null,
            activeSelf: actor.enabled,
            activeInHierarchy: options.actorSystem.isActorActive(actor)
          };
        }))
        .map(toHierarchyItem);
    }
  };
}

function sortActors(actors: readonly IndexedActor[]): readonly IndexedActor[] {
  const actorsById = new Map(actors.map((entry) => [entry.actor.id, entry]));
  const childrenByParentId = new Map<string | null, IndexedActor[]>();
  for (const entry of actors) {
    const parentKey = entry.parentId && actorsById.has(entry.parentId) ? entry.parentId : null;
    const children = childrenByParentId.get(parentKey) ?? [];
    children.push(entry);
    childrenByParentId.set(parentKey, children);
  }

  const result: IndexedActor[] = [];
  const emitted = new Set<string>();

  const appendChildren = (parentId: string | null, ancestors: ReadonlySet<string>): void => {
    const children = [...childrenByParentId.get(parentId) ?? []].sort(compareSiblingActorEntries);
    for (const child of children) {
      if (emitted.has(child.actor.id) || ancestors.has(child.actor.id)) continue;
      emitted.add(child.actor.id);
      result.push(child);
      appendChildren(child.actor.id, new Set([...ancestors, child.actor.id]));
    }
  };

  appendChildren(null, new Set());

  if (result.length < actors.length) {
    for (const entry of [...actors].sort(compareSiblingActorEntries)) {
      if (emitted.has(entry.actor.id)) continue;
      emitted.add(entry.actor.id);
      result.push(entry);
    }
  }

  return result;
}

function compareSiblingActorEntries(a: IndexedActor, b: IndexedActor): number {
  const aOrder = a.metadata?.order;
  const bOrder = b.metadata?.order;
  if (aOrder !== undefined && bOrder !== undefined) {
    const orderDelta = aOrder - bOrder;
    return orderDelta !== 0 ? orderDelta : compareActorCreationOrder(a, b);
  }
  if (aOrder !== undefined) return -1;
  if (bOrder !== undefined) return 1;
  return compareActorCreationOrder(a, b);
}

function compareActorCreationOrder(a: IndexedActor, b: IndexedActor): number {
  return a.index - b.index;
}

function toHierarchyItem(entry: IndexedActor): HierarchyObjectItem {
  const item: HierarchyObjectItem = {
    id: entry.actor.id,
    label: entry.metadata?.label ?? entry.actor.name,
    parentId: entry.parentId
  };
  if (!entry.activeSelf) {
    return {
      ...item,
      activeSelf: false,
      activeInHierarchy: false
    };
  }
  if (!entry.activeInHierarchy) {
    return {
      ...item,
      activeInHierarchy: false
    };
  }
  return item;
}

function readMetadata(
  metadataByActorId: ActorHierarchyObjectSourceOptions["metadataByActorId"],
  actorId: string
): ActorHierarchyMetadata | null {
  if (!metadataByActorId) return null;
  if (isMetadataMap(metadataByActorId)) {
    return metadataByActorId.get(actorId) ?? null;
  }
  const metadataRecord = metadataByActorId;
  return Object.prototype.hasOwnProperty.call(metadataRecord, actorId)
    ? metadataRecord[actorId]
    : null;
}

function isMetadataMap(
  metadataByActorId: NonNullable<ActorHierarchyObjectSourceOptions["metadataByActorId"]>
): metadataByActorId is ReadonlyMap<string, ActorHierarchyMetadata> {
  return "get" in metadataByActorId && typeof metadataByActorId.get === "function";
}
