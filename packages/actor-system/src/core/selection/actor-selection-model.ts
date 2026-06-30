export interface ActorSelectionSnapshot {
  readonly selectedActorIds: readonly string[];
  readonly activeActorId: string | null;
}

export type ActorSelectionInput = Partial<ActorSelectionSnapshot> | null | undefined;

const EMPTY_SELECTION_SNAPSHOT: ActorSelectionSnapshot = freezeSnapshot([], null);

export class ActorSelectionModel {
  #snapshot: ActorSelectionSnapshot;

  constructor(initial?: ActorSelectionInput) {
    this.#snapshot = normalizeActorSelectionSnapshot(initial);
  }

  get snapshot(): ActorSelectionSnapshot {
    return cloneActorSelectionSnapshot(this.#snapshot);
  }

  replace(
    selectedActorIds: readonly string[],
    activeActorId?: string | null
  ): ActorSelectionSnapshot {
    this.#snapshot = normalizeActorSelectionSnapshot({
      selectedActorIds,
      activeActorId
    });
    return this.snapshot;
  }

  toggle(actorId: string): ActorSelectionSnapshot {
    assertActorId(actorId);
    const selected = [...this.#snapshot.selectedActorIds];
    const index = selected.indexOf(actorId);
    if (index >= 0) {
      selected.splice(index, 1);
      return this.replace(selected, this.#snapshot.activeActorId === actorId
        ? selected.at(-1) ?? null
        : this.#snapshot.activeActorId);
    }
    selected.push(actorId);
    return this.replace(selected, actorId);
  }

  add(actorIds: readonly string[]): ActorSelectionSnapshot {
    const selected = [...this.#snapshot.selectedActorIds];
    let lastAddedActorId: string | null = null;
    for (const actorId of actorIds) {
      assertActorId(actorId);
      if (!selected.includes(actorId)) {
        selected.push(actorId);
        lastAddedActorId = actorId;
      }
    }
    return this.replace(selected, lastAddedActorId ?? this.#snapshot.activeActorId);
  }

  remove(actorIds: readonly string[]): ActorSelectionSnapshot {
    const removeSet = new Set(actorIds);
    for (const actorId of removeSet) {
      assertActorId(actorId);
    }
    const selected = this.#snapshot.selectedActorIds.filter((actorId) => !removeSet.has(actorId));
    return this.replace(selected, this.#snapshot.activeActorId);
  }

  prune(existingActorIds: ReadonlySet<string>): ActorSelectionSnapshot {
    const selected = this.#snapshot.selectedActorIds.filter((actorId) => existingActorIds.has(actorId));
    return this.replace(selected, this.#snapshot.activeActorId);
  }
}

export function createEmptyActorSelectionSnapshot(): ActorSelectionSnapshot {
  return EMPTY_SELECTION_SNAPSHOT;
}

export function normalizeActorSelectionSnapshot(input?: ActorSelectionInput): ActorSelectionSnapshot {
  if (!input) return EMPTY_SELECTION_SNAPSHOT;
  const selectedActorIds = input.selectedActorIds ?? [];
  const selected = dedupeActorIds(selectedActorIds);
  if (selected.length === 0) return EMPTY_SELECTION_SNAPSHOT;
  const requestedActive = input.activeActorId;
  if (requestedActive !== undefined && requestedActive !== null) {
    assertActorId(requestedActive);
  }
  // Selection snapshots are normalized at the boundary: stale active ids are
  // repaired to the latest selected id instead of rejected as invalid data.
  const activeActorId = requestedActive && selected.includes(requestedActive)
    ? requestedActive
    : selected[selected.length - 1]!;
  return freezeSnapshot(selected, activeActorId);
}

export function cloneActorSelectionSnapshot(input: ActorSelectionSnapshot): ActorSelectionSnapshot {
  return freezeSnapshot([...input.selectedActorIds], input.activeActorId);
}

export function assertActorSelectionSnapshot(value: unknown): asserts value is ActorSelectionSnapshot {
  if (typeof value !== "object" || value === null) {
    throw new Error("Expected actor selection snapshot object.");
  }
  const candidate = value as Partial<ActorSelectionSnapshot>;
  if (!Array.isArray(candidate.selectedActorIds)) {
    throw new Error("Expected actor selection snapshot selectedActorIds array.");
  }
  for (const actorId of candidate.selectedActorIds) {
    assertActorId(actorId);
  }
  if (candidate.activeActorId !== null && typeof candidate.activeActorId !== "string") {
    throw new Error("Expected actor selection snapshot activeActorId to be a string or null.");
  }
  if (typeof candidate.activeActorId === "string") {
    assertActorId(candidate.activeActorId);
  }
}

export function areActorSelectionSnapshotsEqual(
  first: ActorSelectionSnapshot,
  second: ActorSelectionSnapshot
): boolean {
  if (first.activeActorId !== second.activeActorId) return false;
  if (first.selectedActorIds.length !== second.selectedActorIds.length) return false;
  return first.selectedActorIds.every((actorId, index) => actorId === second.selectedActorIds[index]);
}

function dedupeActorIds(actorIds: readonly string[]): string[] {
  const selected: string[] = [];
  for (const actorId of actorIds) {
    assertActorId(actorId);
    if (!selected.includes(actorId)) {
      selected.push(actorId);
    }
  }
  return selected;
}

function assertActorId(value: unknown): asserts value is string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error("Expected a non-empty actor id.");
  }
}

function freezeSnapshot(
  selectedActorIds: readonly string[],
  activeActorId: string | null
): ActorSelectionSnapshot {
  return Object.freeze({
    selectedActorIds: Object.freeze([...selectedActorIds]),
    activeActorId
  });
}
