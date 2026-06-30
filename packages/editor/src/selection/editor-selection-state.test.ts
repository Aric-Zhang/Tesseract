import { describe, expect, it } from "vitest";
import { normalizeActorSelectionSnapshot } from "actor-system/core";

import { AppFrameStateController } from "../app-state-controller";
import { AppStateParameterStore } from "../app-state-store";
import { editorStatePath, editorStatePaths } from "../editor-state";
import {
  createDefaultEditorSelectionState,
  registerEditorSelectionParameters
} from "./editor-selection-state";

describe("editor selection state", () => {
  it("creates an empty default selection snapshot", () => {
    expect(createDefaultEditorSelectionState().snapshot).toEqual({
      selectedActorIds: [],
      activeActorId: null
    });
  });

  it("normalizes initial selection snapshots", () => {
    expect(createDefaultEditorSelectionState({
      snapshot: {
        selectedActorIds: ["scene", "camera", "scene"]
      }
    }).snapshot).toEqual({
      selectedActorIds: ["scene", "camera"],
      activeActorId: "camera"
    });
  });

  it("registers selection snapshot and clones store values", () => {
    const store = new AppStateParameterStore();
    registerEditorSelectionParameters(store, createDefaultEditorSelectionState({
      snapshot: { selectedActorIds: ["scene"] }
    }));

    const first = store.get(editorStatePaths.selection.snapshot);
    expect(() => {
      (first.selectedActorIds as string[]).push("external");
    }).toThrow();

    expect(store.get(editorStatePaths.selection.snapshot)).toEqual({
      selectedActorIds: ["scene"],
      activeActorId: "scene"
    });
  });

  it("normalizes committed selection snapshots", () => {
    const store = new AppStateParameterStore();
    registerEditorSelectionParameters(store);
    const controller = new AppFrameStateController({ store });

    controller.submit({
      source: { id: "test", kind: "script" },
      target: editorStatePaths.selection.snapshot,
      operation: "set",
      value: {
        selectedActorIds: ["scene", "camera", "scene"],
        activeActorId: "missing"
      }
    });
    controller.updateFrame({ timeMs: 16, deltaMs: 16, frameIndex: 1 });

    expect(store.get(editorStatePaths.selection.snapshot)).toEqual({
      selectedActorIds: ["scene", "camera"],
      activeActorId: "camera"
    });
  });

  it("rejects invalid snapshots", () => {
    const store = new AppStateParameterStore();
    registerEditorSelectionParameters(store);
    const controller = new AppFrameStateController({ store });

    expect(() => controller.submit({
      source: { id: "test", kind: "script" },
      target: editorStatePaths.selection.snapshot,
      operation: "set",
      value: { selectedActorIds: [""], activeActorId: null }
    })).toThrow(/non-empty actor id/);
  });

  it("is idempotent for the same store and rejects externally registered selection path", () => {
    const store = new AppStateParameterStore();
    registerEditorSelectionParameters(store);
    registerEditorSelectionParameters(store);

    expect(store.get(editorStatePaths.selection.snapshot)).toEqual(normalizeActorSelectionSnapshot(null));

    const conflictingStore = new AppStateParameterStore();
    conflictingStore.register({
      path: editorStatePaths.selection.snapshot,
      initialValue: normalizeActorSelectionSnapshot({ selectedActorIds: ["external"] }),
      allowedOperations: ["set"],
      merge: "last-write-wins"
    });

    expect(() => registerEditorSelectionParameters(conflictingStore))
      .toThrow(/outside editor selection/);
  });

  it("replaces the old activeObject state path", () => {
    expect(editorStatePaths.selection.snapshot)
      .toBe(editorStatePath("selection.snapshot"));
    expect("activeObject" in editorStatePaths.selection).toBe(false);
  });
});
