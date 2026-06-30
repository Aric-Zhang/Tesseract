import type {
  Actor,
  ActorSelectionSnapshot,
  ActorSystemView
} from "actor-system/core";
import {
  cloneActorSelectionSnapshot,
  normalizeActorSelectionSnapshot
} from "actor-system/core";
import { createFacadeSlot, type FacadeProviderRegistration } from "foundation/facade";

import type { AppStateParameterStore } from "../app-state-store";
import type { EditorCommandSink } from "../editor-state";
import { editorStatePaths } from "../editor-state";

type ActorSelectionTarget = Actor | string | null;

interface EditorSelectionProvider {
  readonly snapshot: ActorSelectionSnapshot;
  readonly activeActorId: string | null;
  readonly activeActor: Actor | null;
  readonly selectedActorIds: readonly string[];
  readonly selectedActors: readonly Actor[];
  replace(target: ActorSelectionTarget): void;
  clear(): void;
}

export interface InstallEditorSelectionProviderOptions {
  readonly actorSystem: ActorSystemView;
  readonly state: AppStateParameterStore;
  readonly commandSink: EditorCommandSink;
  readonly sourceId?: string;
}

export const Selection: EditorSelectionProvider = Object.freeze({
  get snapshot(): ActorSelectionSnapshot {
    return editorSelectionProviderSlot.current().snapshot;
  },

  get activeActorId(): string | null {
    return editorSelectionProviderSlot.current().activeActorId;
  },

  get activeActor(): Actor | null {
    return editorSelectionProviderSlot.current().activeActor;
  },

  get selectedActorIds(): readonly string[] {
    return editorSelectionProviderSlot.current().selectedActorIds;
  },

  get selectedActors(): readonly Actor[] {
    return editorSelectionProviderSlot.current().selectedActors;
  },

  replace(target: ActorSelectionTarget): void {
    editorSelectionProviderSlot.current().replace(target);
  },

  clear(): void {
    editorSelectionProviderSlot.current().clear();
  }
});

const editorSelectionProviderSlot = createFacadeSlot<EditorSelectionProvider>("Editor selection");

export function installEditorSelectionProvider(
  options: InstallEditorSelectionProviderOptions
): FacadeProviderRegistration {
  return editorSelectionProviderSlot.install(createEditorSelectionProvider(options));
}

function createEditorSelectionProvider(
  options: InstallEditorSelectionProviderOptions
): EditorSelectionProvider {
  const sourceId = options.sourceId ?? "editor-selection";
  return {
    get snapshot(): ActorSelectionSnapshot {
      return readSnapshot(options.state);
    },

    get activeActorId(): string | null {
      return readSnapshot(options.state).activeActorId;
    },

    get activeActor(): Actor | null {
      const activeActorId = readSnapshot(options.state).activeActorId;
      return activeActorId ? options.actorSystem.getActor(activeActorId) : null;
    },

    get selectedActorIds(): readonly string[] {
      return readSnapshot(options.state).selectedActorIds;
    },

    get selectedActors(): readonly Actor[] {
      return readSnapshot(options.state).selectedActorIds
        .map((actorId) => options.actorSystem.getActor(actorId))
        .filter((actor): actor is Actor => actor !== null);
    },

    replace(target: ActorSelectionTarget): void {
      const actorId = resolveActorSelectionTarget(target);
      submitSelectionSnapshot(options.commandSink, sourceId, actorId
        ? normalizeActorSelectionSnapshot({
          selectedActorIds: [actorId],
          activeActorId: actorId
        })
        : normalizeActorSelectionSnapshot(null));
    },

    clear(): void {
      submitSelectionSnapshot(options.commandSink, sourceId, normalizeActorSelectionSnapshot(null));
    }
  };
}

export function createReplaceSelectionSnapshotCommand(
  sourceId: string,
  target: ActorSelectionTarget,
  sourceKind: "gizmo" | "keyboard" | "pointer" | "script" | "debug" = "script"
) {
  const actorId = resolveActorSelectionTarget(target);
  return {
    source: { id: sourceId, kind: sourceKind },
    target: editorStatePaths.selection.snapshot,
    operation: "set" as const,
    value: actorId
      ? normalizeActorSelectionSnapshot({
        selectedActorIds: [actorId],
        activeActorId: actorId
      })
      : normalizeActorSelectionSnapshot(null)
  };
}

function readSnapshot(state: AppStateParameterStore): ActorSelectionSnapshot {
  return cloneActorSelectionSnapshot(state.get(editorStatePaths.selection.snapshot));
}

function submitSelectionSnapshot(
  commandSink: EditorCommandSink,
  sourceId: string,
  snapshot: ActorSelectionSnapshot
): void {
  commandSink.submit({
    source: { id: sourceId, kind: "script" },
    target: editorStatePaths.selection.snapshot,
    operation: "set",
    value: snapshot
  });
}

function resolveActorSelectionTarget(target: ActorSelectionTarget): string | null {
  if (target === null) return null;
  if (typeof target === "string") return target;
  return target.id;
}
