import { describe, expect, it } from "vitest";
import {
  FrameStateController,
  parameterPath,
  SceneParameterStore,
  sceneParameterPaths,
  type ParameterPath,
  type SceneStateChangedEvent,
  type SceneUpdateCommand
} from "../scene-runtime";
import type { FloatingWindowComponent } from "../window-runtime";
import {
  registerWorkspaceModeParameters,
  WORKSPACE_MODE_COMMAND_PRIORITY,
  WORKSPACE_MODE_SOURCE,
  WorkspaceModeController,
  type WorkspaceMode
} from "./workspace-mode";

function createChangedEvent(changes: SceneStateChangedEvent["changes"]): SceneStateChangedEvent {
  return {
    frame: { timeMs: 100, deltaMs: 16, frameIndex: 1 },
    changes
  };
}

function createWindow() {
  const presentations: string[] = [];
  const window = {
    visiblePath: sceneParameterPaths.sceneWindow.visible,
    setPresentation(presentation: string): void {
      presentations.push(presentation);
    }
  } as unknown as FloatingWindowComponent;
  return { presentations, window };
}

describe("workspace mode parameters", () => {
  it("registers workspace.mode with a develop default", () => {
    const store = new SceneParameterStore();

    registerWorkspaceModeParameters(store);
    registerWorkspaceModeParameters(store);

    expect(sceneParameterPaths.workspace.mode).toBe(parameterPath<WorkspaceMode>("workspace.mode"));
    expect(store.get(sceneParameterPaths.workspace.mode)).toBe("develop");
  });

  it("rejects invalid workspace modes", () => {
    const store = new SceneParameterStore();
    registerWorkspaceModeParameters(store);
    const controller = new FrameStateController({ store });

    expect(() => controller.submit({
      source: { id: "test", kind: "script" },
      target: sceneParameterPaths.workspace.mode,
      operation: "set",
      value: "preview"
    })).toThrow(/workspace mode/);
  });

  it("rejects conflicting registration on the workspace mode path", () => {
    const store = new SceneParameterStore();
    store.register({
      path: sceneParameterPaths.workspace.mode,
      initialValue: "other",
      allowedOperations: ["set"],
      merge: "last-write-wins"
    });

    expect(() => registerWorkspaceModeParameters(store)).toThrow(/outside workspace mode/);
  });
});

describe("WorkspaceModeController", () => {
  it("hides tool windows in run mode and restores the develop snapshot", () => {
    const values = new Map<ParameterPath, unknown>([
      [sceneParameterPaths.workspace.mode, "develop"],
      [sceneParameterPaths.sceneWindow.visible, true],
      [sceneParameterPaths.debugWindow.visible, true],
      [sceneParameterPaths.hierarchyWindow.visible, false]
    ]);
    const commands: SceneUpdateCommand[] = [];
    const { presentations, window } = createWindow();
    const presentationMeasurements: string[] = [];
    const controller = new WorkspaceModeController({
      commandSink: { submit: (command) => commands.push(command) },
      getValue: (path) => values.get(path) as never,
      sceneWindow: window,
      toolWindows: [
        { id: "debug", paths: sceneParameterPaths.debugWindow },
        { id: "hierarchy", paths: sceneParameterPaths.hierarchyWindow }
      ],
      onScenePresentationChanged: () => presentationMeasurements.push("measure")
    });

    values.set(sceneParameterPaths.workspace.mode, "run");
    controller.onSceneStateChanged(createChangedEvent([{
      path: sceneParameterPaths.workspace.mode,
      previousValue: "develop",
      nextValue: "run",
      sources: [{ id: "shortcut", kind: "keyboard" }],
      commands: []
    }]));

    expect(presentations).toEqual(["windowed", "fullscreen"]);
    expect(presentationMeasurements).toEqual(["measure", "measure"]);
    expect(commands).toEqual([{
      source: WORKSPACE_MODE_SOURCE,
      target: sceneParameterPaths.debugWindow.visible,
      operation: "set",
      value: false,
      priority: WORKSPACE_MODE_COMMAND_PRIORITY,
      timeStamp: undefined
    }]);

    commands.length = 0;
    values.set(sceneParameterPaths.debugWindow.visible, true);
    controller.onSceneStateChanged(createChangedEvent([{
      path: sceneParameterPaths.debugWindow.visible,
      previousValue: false,
      nextValue: true,
      sources: [{ id: "debug-close", kind: "gizmo" }],
      commands: []
    }]));

    expect(commands).toEqual([{
      source: WORKSPACE_MODE_SOURCE,
      target: sceneParameterPaths.debugWindow.visible,
      operation: "set",
      value: false,
      priority: WORKSPACE_MODE_COMMAND_PRIORITY,
      timeStamp: 100
    }]);

    commands.length = 0;
    values.set(sceneParameterPaths.workspace.mode, "develop");
    controller.onSceneStateChanged(createChangedEvent([{
      path: sceneParameterPaths.workspace.mode,
      previousValue: "run",
      nextValue: "develop",
      sources: [{ id: "scene-mode-toggle", kind: "gizmo" }],
      commands: []
    }]));

    expect(presentations).toEqual(["windowed", "fullscreen", "windowed"]);
    expect(commands).toEqual([
      {
        source: WORKSPACE_MODE_SOURCE,
        target: sceneParameterPaths.debugWindow.visible,
        operation: "set",
        value: true,
        priority: WORKSPACE_MODE_COMMAND_PRIORITY,
        timeStamp: undefined
      },
      {
        source: WORKSPACE_MODE_SOURCE,
        target: sceneParameterPaths.hierarchyWindow.visible,
        operation: "set",
        value: false,
        priority: WORKSPACE_MODE_COMMAND_PRIORITY,
        timeStamp: undefined
      }
    ]);
  });

  it("does not refresh the snapshot for repeated run mode events", () => {
    const values = new Map<ParameterPath, unknown>([
      [sceneParameterPaths.workspace.mode, "develop"],
      [sceneParameterPaths.sceneWindow.visible, true],
      [sceneParameterPaths.debugWindow.visible, true]
    ]);
    const commands: SceneUpdateCommand[] = [];
    const { window } = createWindow();
    const controller = new WorkspaceModeController({
      commandSink: { submit: (command) => commands.push(command) },
      getValue: (path) => values.get(path) as never,
      sceneWindow: window,
      toolWindows: [{ id: "debug", paths: sceneParameterPaths.debugWindow }]
    });

    values.set(sceneParameterPaths.workspace.mode, "run");
    controller.onSceneStateChanged(createChangedEvent([{
      path: sceneParameterPaths.workspace.mode,
      previousValue: "develop",
      nextValue: "run",
      sources: [{ id: "shortcut", kind: "keyboard" }],
      commands: []
    }]));
    values.set(sceneParameterPaths.debugWindow.visible, false);
    controller.onSceneStateChanged(createChangedEvent([{
      path: sceneParameterPaths.workspace.mode,
      previousValue: "run",
      nextValue: "run",
      sources: [{ id: "shortcut", kind: "keyboard" }],
      commands: []
    }]));

    commands.length = 0;
    values.set(sceneParameterPaths.workspace.mode, "develop");
    controller.onSceneStateChanged(createChangedEvent([{
      path: sceneParameterPaths.workspace.mode,
      previousValue: "run",
      nextValue: "develop",
      sources: [{ id: "shortcut", kind: "keyboard" }],
      commands: []
    }]));

    expect(commands).toEqual([{
      source: WORKSPACE_MODE_SOURCE,
      target: sceneParameterPaths.debugWindow.visible,
      operation: "set",
      value: true,
      priority: WORKSPACE_MODE_COMMAND_PRIORITY,
      timeStamp: undefined
    }]);
  });

  it("forces a hidden Scene window visible in run mode and restores the hidden develop snapshot", () => {
    const values = new Map<ParameterPath, unknown>([
      [sceneParameterPaths.workspace.mode, "develop"],
      [sceneParameterPaths.sceneWindow.visible, false]
    ]);
    const commands: SceneUpdateCommand[] = [];
    const { presentations, window } = createWindow();
    const controller = new WorkspaceModeController({
      commandSink: { submit: (command) => commands.push(command) },
      getValue: (path) => values.get(path) as never,
      sceneWindow: window,
      toolWindows: []
    });

    values.set(sceneParameterPaths.workspace.mode, "run");
    controller.onSceneStateChanged(createChangedEvent([{
      path: sceneParameterPaths.workspace.mode,
      previousValue: "develop",
      nextValue: "run",
      sources: [{ id: "shortcut", kind: "keyboard" }],
      commands: []
    }]));

    expect(presentations).toEqual(["windowed", "fullscreen"]);
    expect(commands).toEqual([{
      source: WORKSPACE_MODE_SOURCE,
      target: sceneParameterPaths.sceneWindow.visible,
      operation: "set",
      value: true,
      priority: WORKSPACE_MODE_COMMAND_PRIORITY,
      timeStamp: undefined
    }]);

    commands.length = 0;
    values.set(sceneParameterPaths.sceneWindow.visible, true);
    values.set(sceneParameterPaths.workspace.mode, "develop");
    controller.onSceneStateChanged(createChangedEvent([{
      path: sceneParameterPaths.workspace.mode,
      previousValue: "run",
      nextValue: "develop",
      sources: [{ id: "scene-mode-toggle", kind: "gizmo" }],
      commands: []
    }]));

    expect(presentations).toEqual(["windowed", "fullscreen", "windowed"]);
    expect(commands).toEqual([{
      source: WORKSPACE_MODE_SOURCE,
      target: sceneParameterPaths.sceneWindow.visible,
      operation: "set",
      value: false,
      priority: WORKSPACE_MODE_COMMAND_PRIORITY,
      timeStamp: undefined
    }]);
  });

  it("keeps the Scene window visible if an external source hides it during run mode", () => {
    const values = new Map<ParameterPath, unknown>([
      [sceneParameterPaths.workspace.mode, "run"],
      [sceneParameterPaths.sceneWindow.visible, true]
    ]);
    const commands: SceneUpdateCommand[] = [];
    const { window } = createWindow();
    const controller = new WorkspaceModeController({
      commandSink: { submit: (command) => commands.push(command) },
      getValue: (path) => values.get(path) as never,
      sceneWindow: window,
      toolWindows: []
    });

    values.set(sceneParameterPaths.sceneWindow.visible, false);
    controller.onSceneStateChanged(createChangedEvent([{
      path: sceneParameterPaths.sceneWindow.visible,
      previousValue: true,
      nextValue: false,
      sources: [{ id: "scene-close-button", kind: "gizmo" }],
      commands: []
    }]));

    expect(commands).toEqual([{
      source: WORKSPACE_MODE_SOURCE,
      target: sceneParameterPaths.sceneWindow.visible,
      operation: "set",
      value: true,
      priority: WORKSPACE_MODE_COMMAND_PRIORITY,
      timeStamp: 100
    }]);
  });
});
