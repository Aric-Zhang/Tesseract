import {
  areActorSelectionSnapshotsEqual,
  assertActorSelectionSnapshot,
  cloneActorSelectionSnapshot,
  normalizeActorSelectionSnapshot,
  type ActorSelectionSnapshot
} from "actor-system/core";

import type { AppStateParameterStore } from "../app-state-store";
import { editorStatePaths } from "../editor-state";

export interface EditorSelectionStateOptions {
  readonly snapshot?: Partial<ActorSelectionSnapshot> | null;
}

export interface EditorSelectionInitialState {
  readonly snapshot: ActorSelectionSnapshot;
}

const registeredEditorSelectionStores = new WeakSet<AppStateParameterStore>();

export function createDefaultEditorSelectionState(
  options: EditorSelectionStateOptions = {}
): EditorSelectionInitialState {
  return {
    snapshot: normalizeActorSelectionSnapshot(options.snapshot)
  };
}

export function registerEditorSelectionParameters(
  store: AppStateParameterStore,
  initialState: EditorSelectionInitialState = createDefaultEditorSelectionState()
): void {
  const path = editorStatePaths.selection.snapshot;
  if (store.has(path)) {
    if (registeredEditorSelectionStores.has(store)) return;
    throw new Error(`Editor selection parameter path is already registered outside editor selection: ${path}`);
  }
  const initialValue = normalizeActorSelectionSnapshot(initialState.snapshot);
  store.register({
    path,
    initialValue,
    allowedOperations: ["set", "reset"],
    merge: "last-write-wins",
    validateValue: assertActorSelectionSnapshot,
    constrain: normalizeActorSelectionSnapshot,
    equals: areActorSelectionSnapshotsEqual,
    clone: cloneActorSelectionSnapshot
  });
  registeredEditorSelectionStores.add(store);
}
