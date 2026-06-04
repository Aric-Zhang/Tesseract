import type { RuntimeObject, SceneFrame } from "../scene-runtime";
import { ActorImpl, isActorImpl, type Actor, type ActorOptions } from "./actor";
import type { Component } from "./component";

export type ActorComponentDisposer = (actor: ActorImpl) => void;
export const actorComponentMutationToken: unique symbol = Symbol("actorComponentMutationToken");
export type ActorComponentMutationToken = typeof actorComponentMutationToken;

interface ActorEntry {
  actor: ActorImpl;
  order: number;
  parentId: string | null;
  childIds: Set<string>;
  destroying: boolean;
}

export class ActorSystem implements RuntimeObject {
  readonly id = "actor-system";
  readonly priority = -900;
  enabled = true;
  private readonly actors = new Map<string, ActorEntry>();
  private nextActorId = 0;
  private nextOrder = 0;
  private disposed = false;
  private componentDisposer: ActorComponentDisposer | null = null;

  setComponentDisposer(disposer: ActorComponentDisposer): void {
    this.componentDisposer = disposer;
  }

  createActor(options: ActorOptions = {}): Actor {
    this.assertNotDisposed();
    const id = options.id ?? `actor-${this.nextActorId}`;
    if (this.actors.has(id)) {
      throw new Error(`Actor id is already registered: ${id}`);
    }
    const parentEntry = options.parent === undefined || options.parent === null
      ? null
      : this.resolveActorEntry(options.parent, "parent");
    const actor = new ActorImpl({
      id,
      name: options.name ?? id,
      enabled: options.enabled ?? true
    });
    this.actors.set(id, {
      actor,
      order: this.nextOrder++,
      parentId: parentEntry?.actor.id ?? null,
      childIds: new Set(),
      destroying: false
    });
    parentEntry?.childIds.add(id);
    if (options.id === undefined) {
      this.nextActorId += 1;
    }
    return actor;
  }

  destroyActor(actor: Actor): void {
    const entry = this.assertOwnActorEntry(actor);
    if (entry.destroying) return;
    entry.destroying = true;
    this.destroyChildActors(entry);
    const actorImpl = entry.actor;
    if (this.componentDisposer) {
      this.componentDisposer(actorImpl);
    } else {
      disposeActorComponents(actorImpl);
    }
    this.destroyChildActors(entry);
    this.detachFromParent(actorImpl.id);
    this.actors.delete(actorImpl.id);
  }

  getActor(id: string): Actor | null {
    return this.actors.get(id)?.actor ?? null;
  }

  listActors(): readonly Actor[] {
    return [...this.actors.values()].sort(compareActorEntries).map((entry) => entry.actor);
  }

  listActorsInTreeOrder(): readonly Actor[] {
    const result: Actor[] = [];
    for (const root of this.listRootActors()) {
      this.appendActorSubtree(root, result);
    }
    return result;
  }

  listRootActors(): readonly Actor[] {
    return [...this.actors.values()]
      .filter((entry) => entry.parentId === null)
      .sort(compareActorEntries)
      .map((entry) => entry.actor);
  }

  listChildren(actor: Actor): readonly Actor[] {
    const entry = this.assertOwnActorEntry(actor);
    return this.listChildEntries(entry).map((childEntry) => childEntry.actor);
  }

  getParentId(actor: Actor): string | null {
    return this.assertOwnActorEntry(actor).parentId;
  }

  getParent(actor: Actor): Actor | null {
    const parentId = this.getParentId(actor);
    return parentId ? this.actors.get(parentId)?.actor ?? null : null;
  }

  setParent(actor: Actor, parent: Actor | string | null): void {
    const entry = this.assertOwnActorEntry(actor);
    const parentEntry = parent === null ? null : this.resolveActorEntry(parent, "parent");
    if (parentEntry?.actor === entry.actor) {
      throw new Error(`Actor cannot be parented to itself: ${entry.actor.id}`);
    }
    if (parentEntry && this.isDescendantOf(parentEntry.actor, entry.actor)) {
      throw new Error(`Actor parent cycle detected: ${entry.actor.id} -> ${parentEntry.actor.id}`);
    }
    const nextParentId = parentEntry?.actor.id ?? null;
    if (entry.parentId === nextParentId) return;
    this.detachFromParent(entry.actor.id);
    entry.parentId = nextParentId;
    parentEntry?.childIds.add(entry.actor.id);
  }

  isDescendantOf(actor: Actor, possibleAncestor: Actor): boolean {
    let currentEntry: ActorEntry | undefined = this.assertOwnActorEntry(actor);
    const ancestorEntry = this.assertOwnActorEntry(possibleAncestor);
    while (currentEntry.parentId !== null) {
      if (currentEntry.parentId === ancestorEntry.actor.id) return true;
      currentEntry = this.actors.get(currentEntry.parentId);
      if (!currentEntry) return false;
    }
    return false;
  }

  isActorActive(actor: Actor): boolean {
    let currentEntry: ActorEntry | undefined = this.assertOwnActorEntry(actor);
    while (currentEntry) {
      if (!currentEntry.actor.enabled) return false;
      if (currentEntry.parentId === null) return true;
      currentEntry = this.actors.get(currentEntry.parentId);
    }
    return false;
  }

  updateFrame(frame: SceneFrame): void {
    const actors = this.listActorsInTreeOrder();
    for (const actor of actors) {
      const actorImpl = this.actors.get(actor.id)?.actor;
      if (actorImpl !== actor || !this.isActorActive(actorImpl)) continue;
      const components = actorImpl.listComponents();
      for (const component of components) {
        if (this.actors.get(actorImpl.id)?.actor !== actorImpl || !this.isActorActive(actorImpl)) break;
        if (!actorImpl.hasComponentInstance(component) || !component.enabled) continue;
        component.updateFrame?.(frame);
      }
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    const entries = [...this.actors.values()].sort((a, b) => b.order - a.order);
    for (const entry of entries) {
      if (this.actors.get(entry.actor.id)?.actor === entry.actor) {
        this.destroyActor(entry.actor);
      }
    }
    this.actors.clear();
  }

  attachComponent(
    token: ActorComponentMutationToken,
    actor: Actor,
    component: Component
  ): void {
    assertActorComponentMutationToken(token);
    const actorImpl = this.assertOwnActor(actor);
    actorImpl.attachComponent(component);
  }

  detachComponent(
    token: ActorComponentMutationToken,
    actor: Actor,
    component: Component
  ): void {
    assertActorComponentMutationToken(token);
    const actorImpl = this.assertOwnActor(actor);
    actorImpl.detachComponent(component);
  }

  hasActor(actor: Actor): boolean {
    return isActorImpl(actor) && this.actors.get(actor.id)?.actor === actor;
  }

  assertOwnActor(actor: Actor): ActorImpl {
    return this.assertOwnActorEntry(actor).actor;
  }

  private assertNotDisposed(): void {
    if (this.disposed) {
      throw new Error("Cannot use ActorSystem after dispose().");
    }
  }

  private assertOwnActorEntry(actor: Actor): ActorEntry {
    if (!isActorImpl(actor) || this.actors.get(actor.id)?.actor !== actor) {
      throw new Error(`Actor does not belong to this ActorSystem: ${actor.id}`);
    }
    return this.actors.get(actor.id)!;
  }

  private resolveActorEntry(actorOrId: Actor | string, role: string): ActorEntry {
    if (typeof actorOrId === "string") {
      const entry = this.actors.get(actorOrId);
      if (!entry) {
        throw new Error(`Actor ${role} does not exist: ${actorOrId}`);
      }
      return entry;
    }
    try {
      return this.assertOwnActorEntry(actorOrId);
    } catch {
      throw new Error(`Actor ${role} does not belong to this ActorSystem: ${actorOrId.id}`);
    }
  }

  private detachFromParent(actorId: string): void {
    const entry = this.actors.get(actorId);
    if (!entry?.parentId) return;
    this.actors.get(entry.parentId)?.childIds.delete(actorId);
    entry.parentId = null;
  }

  private destroyChildActors(entry: ActorEntry): void {
    const children = this.listChildEntries(entry).slice().reverse();
    for (const childEntry of children) {
      if (this.actors.get(childEntry.actor.id)?.actor === childEntry.actor) {
        this.destroyActor(childEntry.actor);
      }
    }
  }

  private listChildEntries(entry: ActorEntry): readonly ActorEntry[] {
    return [...entry.childIds]
      .map((childId) => this.actors.get(childId))
      .filter((childEntry): childEntry is ActorEntry => Boolean(childEntry))
      .sort(compareActorEntries);
  }

  private appendActorSubtree(actor: Actor, result: Actor[]): void {
    const entry = this.assertOwnActorEntry(actor);
    result.push(entry.actor);
    for (const childEntry of this.listChildEntries(entry)) {
      this.appendActorSubtree(childEntry.actor, result);
    }
  }
}

function compareActorEntries(a: ActorEntry, b: ActorEntry): number {
  return a.order - b.order;
}

function assertActorComponentMutationToken(token: ActorComponentMutationToken): void {
  if (token !== actorComponentMutationToken) {
    throw new Error("Actor component mutation requires the internal mutation token.");
  }
}

function disposeActorComponents(actor: ActorImpl): void {
  const components = [...actor.listComponents()].reverse();
  for (const component of components) {
    actor.detachComponent(component);
    component.onDetach?.();
    component.dispose?.();
  }
}
