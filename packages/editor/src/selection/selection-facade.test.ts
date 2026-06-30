import { describe, expect, it } from "vitest";
import { ActorSystem } from "actor-system/core";
import type { AppStateCommand } from "../app-state";
import { AppStateParameterStore } from "../app-state-store";
import { editorStatePaths, type EditorCommandSink } from "../editor-state";
import {
  createDefaultEditorSelectionState,
  registerEditorSelectionParameters
} from "./editor-selection-state";
import {
  createReplaceSelectionSnapshotCommand,
  installEditorSelectionProvider,
  Selection
} from "./selection-facade";

class CapturingCommandSink implements EditorCommandSink {
  readonly commands: AppStateCommand[] = [];

  submit(command: AppStateCommand): void {
    this.commands.push(command);
  }
}

describe("Selection facade", () => {
  it("throws before provider install", () => {
    expect(() => Selection.snapshot).toThrow("Editor selection");
    expect(() => Selection.replace("scene")).toThrow("Editor selection");
  });

  it("reads committed snapshot and resolves actors", () => {
    const fixture = createFixture({
      selectedActorIds: ["scene", "missing", "camera"],
      activeActorId: "scene"
    });
    const registration = installEditorSelectionProvider(fixture);

    expect(Selection.snapshot).toEqual({
      selectedActorIds: ["scene", "missing", "camera"],
      activeActorId: "scene"
    });
    expect(Selection.activeActorId).toBe("scene");
    expect(Selection.activeActor).toBe(fixture.scene);
    expect(Selection.selectedActorIds).toEqual(["scene", "missing", "camera"]);
    expect(Selection.selectedActors).toEqual([fixture.scene, fixture.camera]);

    registration.dispose();
  });

  it("submits replace and clear commands through the editor command sink", () => {
    const fixture = createFixture();
    const registration = installEditorSelectionProvider(fixture);

    Selection.replace(fixture.camera);
    Selection.replace("scene");
    Selection.clear();

    expect(fixture.commandSink.commands.map((command) => command.value)).toEqual([
      { selectedActorIds: ["camera"], activeActorId: "camera" },
      { selectedActorIds: ["scene"], activeActorId: "scene" },
      { selectedActorIds: [], activeActorId: null }
    ]);
    expect(fixture.commandSink.commands.every((command) =>
      command.target === editorStatePaths.selection.snapshot &&
      command.operation === "set"
    )).toBe(true);

    registration.dispose();
  });

  it("creates replace selection commands without installing the facade", () => {
    expect(createReplaceSelectionSnapshotCommand("hierarchy", "scene")).toEqual({
      source: { id: "hierarchy", kind: "script" },
      target: editorStatePaths.selection.snapshot,
      operation: "set",
      value: {
        selectedActorIds: ["scene"],
        activeActorId: "scene"
      }
    });
  });

  it("rejects double install and restores uninstalled state on dispose", () => {
    const fixture = createFixture();
    const registration = installEditorSelectionProvider(fixture);

    expect(() => installEditorSelectionProvider(fixture)).toThrow(/already installed/);

    registration.dispose();
    expect(() => Selection.snapshot).toThrow("Editor selection");
  });
});

function createFixture(snapshot?: {
  readonly selectedActorIds: readonly string[];
  readonly activeActorId?: string | null;
}) {
  const actorSystem = new ActorSystem();
  const scene = actorSystem.createActor({ id: "scene", name: "Scene" });
  const camera = actorSystem.createActor({ id: "camera", name: "Camera" });
  const state = new AppStateParameterStore();
  registerEditorSelectionParameters(state, createDefaultEditorSelectionState({ snapshot }));
  return {
    actorSystem,
    state,
    commandSink: new CapturingCommandSink(),
    scene,
    camera
  };
}
