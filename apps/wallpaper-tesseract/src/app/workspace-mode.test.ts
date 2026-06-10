import { describe, expect, it } from "vitest";
import {
  FrameStateController,
  parameterPath,
  SceneParameterStore,
  sceneParameterPaths,
  type ParameterPath,
  type SceneStateChangedEvent
} from "../scene-runtime";
import {
  WORKSPACE_MODE_COMMAND_PRIORITY,
  WORKSPACE_MODE_SOURCE,
  WorkspaceModeController,
  type WorkspaceSceneViewPort,
  type WorkspaceMode,
  type WorkspaceModeCommand
} from "./workspace-mode";
import { registerWorkspaceModeParameters } from "../editor/adapters/workspace-mode-scene-state-adapter";
import {
  createSingletonWindowViewIdentity,
  type WindowFramePresentation,
  type WindowViewLocation
} from "../window-runtime";

function createChangedEvent(changes: SceneStateChangedEvent["changes"]): SceneStateChangedEvent {
  return {
    frame: { timeMs: 100, deltaMs: 16, frameIndex: 1 },
    changes
  };
}

function createSceneViewPort(options: {
  readonly visiblePath?: ParameterPath<boolean>;
  readonly ownerFrameActorId?: string;
  readonly viewActorId?: string;
  readonly live?: boolean;
} = {}) {
  const presentations: string[] = [];
  const activations: string[] = [];
  const opens: string[] = [];
  const presentationCalls: string[] = [];
  const rawOwnerPresentationCalls: string[] = [];
  const viewActorId = options.viewActorId ?? "scene-view";
  const location = (): WindowViewLocation | null => options.live === false
    ? null
    : {
        viewKey: "scene",
        identity: createSingletonWindowViewIdentity("scene"),
        viewActorId,
        ownerFrameActorId: options.ownerFrameActorId ?? "scene-frame",
        ownerFrameVisiblePath: options.visiblePath ?? sceneParameterPaths.sceneWindow.visible,
        ownerFrameVisible: true,
        ownerFrameActiveInHierarchy: true,
        activeInFrame: true,
        visibleInFrame: true,
        presentation: (presentations.at(-1)?.split(":").at(-1) as WindowFramePresentation | undefined) ?? "windowed",
        activationSequence: 0
      };
  const sceneView: WorkspaceSceneViewPort = {
    viewKey: "scene",
    locations: {
      getLocationByViewKey: (viewKey) => viewKey === "scene" ? location() : null,
      getLocationByViewActorId: (candidateViewActorId) => candidateViewActorId === viewActorId ? location() : null,
      listLocations: () => {
        const current = location();
        return current ? [current] : [];
      }
    },
    commands: {
      activateView(candidateViewActorId, reason): void {
        activations.push(`activate:${candidateViewActorId}:${reason}`);
      },
      focusOwner(candidateViewActorId, reason): void {
        activations.push(`focus:${candidateViewActorId}:${reason}`);
      },
      setOwnerPresentation(candidateViewActorId, presentation): void {
        rawOwnerPresentationCalls.push(`${candidateViewActorId}:${presentation}`);
        presentations.push(`${candidateViewActorId}:${presentation}`);
      },
      requestOwnerVisible(candidateViewActorId, visible): void {
        activations.push(`visible:${candidateViewActorId}:${visible}`);
      }
    },
    presentation: {
      enterViewFullscreen(candidateViewActorId, reason): void {
        presentationCalls.push(`enter:${candidateViewActorId}:${reason}`);
        presentations.push(`${candidateViewActorId}:fullscreen`);
      },
      enterViewWorkspaceFullscreen(candidateViewActorId, reason): void {
        presentationCalls.push(`workspace-enter:${candidateViewActorId}:${reason}`);
        presentations.push(`${candidateViewActorId}:workspace-fullscreen`);
      },
      exitViewFullscreen(candidateViewActorId, reason): void {
        presentationCalls.push(`exit:${candidateViewActorId}:${reason}`);
        presentations.push(`${candidateViewActorId}:windowed`);
      },
      getViewFullscreenSession: () => null,
      isViewFullscreenIsolated: () => false
    },
    open(reason): void {
      opens.push(`open:${reason}`);
    }
  };
  return {
    activations,
    opens,
    presentationCalls,
    rawOwnerPresentationCalls,
    presentations,
    sceneView
  };
}

function presentationValues(presentations: readonly string[]): readonly string[] {
  return presentations.map((entry) => entry.split(":").at(-1) ?? entry);
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
    const commands: WorkspaceModeCommand[] = [];
    const { presentations, sceneView } = createSceneViewPort();
    const presentationMeasurements: string[] = [];
    const controller = new WorkspaceModeController({
      commandSink: { submit: (command) => commands.push(command) },
      getValue: (path) => values.get(path) as never,
      sceneView,
      toolWindows: [
        { id: "debug", paths: sceneParameterPaths.debugWindow },
        { id: "hierarchy", paths: sceneParameterPaths.hierarchyWindow }
      ],
      onScenePresentationChanged: () => presentationMeasurements.push("measure")
    });
    values.set(sceneParameterPaths.workspace.mode, "run");
    controller.onStateChanged(createChangedEvent([{
      path: sceneParameterPaths.workspace.mode,
      previousValue: "develop",
      nextValue: "run",
      sources: [{ id: "shortcut", kind: "keyboard" }],
      commands: []
    }]));

    expect(presentationValues(presentations)).toEqual(["windowed", "fullscreen"]);
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
    controller.onStateChanged(createChangedEvent([{
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
    controller.onStateChanged(createChangedEvent([{
      path: sceneParameterPaths.workspace.mode,
      previousValue: "run",
      nextValue: "develop",
      sources: [{ id: "scene-mode-toggle", kind: "gizmo" }],
      commands: []
    }]));

    expect(presentationValues(presentations)).toEqual(["windowed", "fullscreen", "windowed"]);
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

  it("delegates run mode to the workspace presentation port without mutating tool visibility", () => {
    const values = new Map<ParameterPath, unknown>([
      [sceneParameterPaths.workspace.mode, "develop"],
      [sceneParameterPaths.sceneWindow.visible, true],
      [sceneParameterPaths.debugWindow.visible, true],
      [sceneParameterPaths.hierarchyWindow.visible, true]
    ]);
    const commands: WorkspaceModeCommand[] = [];
    const { sceneView, activations } = createSceneViewPort();
    const presentationCalls: string[] = [];
    const controller = new WorkspaceModeController({
      commandSink: { submit: (command) => commands.push(command) },
      getValue: (path) => values.get(path) as never,
      sceneView,
      workspacePresentation: {
        enterRunFullscreenForView(viewActorId, reason) {
          presentationCalls.push(`enter:${viewActorId}:${reason}`);
        },
        exitRunFullscreen(reason) {
          presentationCalls.push(`exit:${reason}`);
        }
      },
      toolWindows: [
        { id: "debug", paths: sceneParameterPaths.debugWindow },
        { id: "hierarchy", paths: sceneParameterPaths.hierarchyWindow }
      ]
    });
    presentationCalls.length = 0;

    values.set(sceneParameterPaths.workspace.mode, "run");
    controller.onStateChanged(createChangedEvent([{
      path: sceneParameterPaths.workspace.mode,
      previousValue: "develop",
      nextValue: "run",
      sources: [{ id: "shortcut", kind: "keyboard" }],
      commands: []
    }]));

    expect(activations).toEqual(["activate:scene-view:programmatic"]);
    expect(presentationCalls).toEqual(["enter:scene-view:programmatic"]);
    expect(commands).toEqual([]);

    values.set(sceneParameterPaths.workspace.mode, "develop");
    controller.onStateChanged(createChangedEvent([{
      path: sceneParameterPaths.workspace.mode,
      previousValue: "run",
      nextValue: "develop",
      sources: [{ id: "shortcut", kind: "keyboard" }],
      commands: []
    }]));

    expect(presentationCalls).toEqual([
      "enter:scene-view:programmatic",
      "exit:programmatic"
    ]);
    expect(commands).toEqual([]);
  });

  it("does not refresh the snapshot for repeated run mode events", () => {
    const values = new Map<ParameterPath, unknown>([
      [sceneParameterPaths.workspace.mode, "develop"],
      [sceneParameterPaths.sceneWindow.visible, true],
      [sceneParameterPaths.debugWindow.visible, true]
    ]);
    const commands: WorkspaceModeCommand[] = [];
    const { sceneView } = createSceneViewPort();
    const controller = new WorkspaceModeController({
      commandSink: { submit: (command) => commands.push(command) },
      getValue: (path) => values.get(path) as never,
      sceneView,
      toolWindows: [{ id: "debug", paths: sceneParameterPaths.debugWindow }]
    });

    values.set(sceneParameterPaths.workspace.mode, "run");
    controller.onStateChanged(createChangedEvent([{
      path: sceneParameterPaths.workspace.mode,
      previousValue: "develop",
      nextValue: "run",
      sources: [{ id: "shortcut", kind: "keyboard" }],
      commands: []
    }]));
    values.set(sceneParameterPaths.debugWindow.visible, false);
    controller.onStateChanged(createChangedEvent([{
      path: sceneParameterPaths.workspace.mode,
      previousValue: "run",
      nextValue: "run",
      sources: [{ id: "shortcut", kind: "keyboard" }],
      commands: []
    }]));

    commands.length = 0;
    values.set(sceneParameterPaths.workspace.mode, "develop");
    controller.onStateChanged(createChangedEvent([{
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
    const commands: WorkspaceModeCommand[] = [];
    const { presentations, sceneView } = createSceneViewPort();
    const controller = new WorkspaceModeController({
      commandSink: { submit: (command) => commands.push(command) },
      getValue: (path) => values.get(path) as never,
      sceneView,
      toolWindows: []
    });

    values.set(sceneParameterPaths.workspace.mode, "run");
    controller.onStateChanged(createChangedEvent([{
      path: sceneParameterPaths.workspace.mode,
      previousValue: "develop",
      nextValue: "run",
      sources: [{ id: "shortcut", kind: "keyboard" }],
      commands: []
    }]));

    expect(presentationValues(presentations)).toEqual(["windowed", "fullscreen"]);
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
    controller.onStateChanged(createChangedEvent([{
      path: sceneParameterPaths.workspace.mode,
      previousValue: "run",
      nextValue: "develop",
      sources: [{ id: "scene-mode-toggle", kind: "gizmo" }],
      commands: []
    }]));

    expect(presentationValues(presentations)).toEqual(["windowed", "fullscreen", "windowed"]);
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
    const commands: WorkspaceModeCommand[] = [];
    const { sceneView } = createSceneViewPort();
    const controller = new WorkspaceModeController({
      commandSink: { submit: (command) => commands.push(command) },
      getValue: (path) => values.get(path) as never,
      sceneView,
      toolWindows: []
    });

    values.set(sceneParameterPaths.sceneWindow.visible, false);
    controller.onStateChanged(createChangedEvent([{
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

  it("does not hide the tool frame that currently owns the Scene view in run mode", () => {
    const values = new Map<ParameterPath, unknown>([
      [sceneParameterPaths.workspace.mode, "develop"],
      [sceneParameterPaths.debugWindow.visible, true],
      [sceneParameterPaths.hierarchyWindow.visible, true]
    ]);
    const commands: WorkspaceModeCommand[] = [];
    const { presentations, sceneView } = createSceneViewPort({
      visiblePath: sceneParameterPaths.debugWindow.visible,
      ownerFrameActorId: "debug-frame"
    });
    const controller = new WorkspaceModeController({
      commandSink: { submit: (command) => commands.push(command) },
      getValue: (path) => values.get(path) as never,
      sceneView,
      toolWindows: [
        { id: "debug", paths: sceneParameterPaths.debugWindow },
        { id: "hierarchy", paths: sceneParameterPaths.hierarchyWindow }
      ]
    });

    values.set(sceneParameterPaths.workspace.mode, "run");
    controller.onStateChanged(createChangedEvent([{
      path: sceneParameterPaths.workspace.mode,
      previousValue: "develop",
      nextValue: "run",
      sources: [{ id: "shortcut", kind: "keyboard" }],
      commands: []
    }]));

    expect(presentationValues(presentations)).toEqual(["windowed", "fullscreen"]);
    expect(commands).toEqual([{
      source: WORKSPACE_MODE_SOURCE,
      target: sceneParameterPaths.hierarchyWindow.visible,
      operation: "set",
      value: false,
      priority: WORKSPACE_MODE_COMMAND_PRIORITY,
      timeStamp: undefined
    }]);
  });

  it("hides the old Scene source frame after isolation moves fullscreen ownership to a runtime frame", () => {
    const values = new Map<ParameterPath, unknown>([
      [sceneParameterPaths.workspace.mode, "develop"],
      [sceneParameterPaths.sceneWindow.visible, true],
      [sceneParameterPaths.debugWindow.visible, true]
    ]);
    const commands: WorkspaceModeCommand[] = [];
    let isolated = false;
    const sceneView: WorkspaceSceneViewPort = {
      viewKey: "scene",
      locations: {
        getLocationByViewKey: (viewKey) => viewKey === "scene"
          ? {
              viewKey: "scene",
              identity: createSingletonWindowViewIdentity("scene"),
              viewActorId: "scene-view",
              ownerFrameActorId: isolated ? "floating-scene-view" : "scene-frame",
              ownerFrameVisiblePath: isolated ? null : sceneParameterPaths.sceneWindow.visible,
              ownerFrameVisible: true,
              ownerFrameActiveInHierarchy: true,
              activeInFrame: true,
              visibleInFrame: true,
              presentation: isolated ? "fullscreen" : "windowed",
              activationSequence: 0
            }
          : null,
        getLocationByViewActorId: () => null,
        listLocations: () => []
      },
      commands: {
        activateView: () => undefined,
        focusOwner: () => undefined,
        setOwnerPresentation: () => undefined,
        requestOwnerVisible: () => undefined
      },
      presentation: {
        enterViewFullscreen: () => {
          isolated = true;
        },
        enterViewWorkspaceFullscreen: () => {
          isolated = true;
        },
        exitViewFullscreen: () => {
          isolated = false;
        },
        getViewFullscreenSession: () => isolated
          ? {
              viewActorId: "scene-view",
              viewKey: "scene",
              mode: "isolated-frame",
              fullscreenFrameId: "floating-scene-view"
            }
          : null,
        isViewFullscreenIsolated: () => isolated
      },
      open: () => undefined
    };
    const controller = new WorkspaceModeController({
      commandSink: { submit: (command) => commands.push(command) },
      getValue: (path) => values.get(path) as never,
      sceneView,
      toolWindows: [
        { id: "debug", paths: sceneParameterPaths.debugWindow }
      ]
    });

    values.set(sceneParameterPaths.workspace.mode, "run");
    controller.onStateChanged(createChangedEvent([{
      path: sceneParameterPaths.workspace.mode,
      previousValue: "develop",
      nextValue: "run",
      sources: [{ id: "shortcut", kind: "keyboard" }],
      commands: []
    }]));

    expect(commands).toEqual([
      {
        source: WORKSPACE_MODE_SOURCE,
        target: sceneParameterPaths.sceneWindow.visible,
        operation: "set",
        value: false,
        priority: WORKSPACE_MODE_COMMAND_PRIORITY,
        timeStamp: undefined
      },
      {
        source: WORKSPACE_MODE_SOURCE,
        target: sceneParameterPaths.debugWindow.visible,
        operation: "set",
        value: false,
        priority: WORKSPACE_MODE_COMMAND_PRIORITY,
        timeStamp: undefined
      }
    ]);

    commands.length = 0;
    values.set(sceneParameterPaths.sceneWindow.visible, true);
    controller.onStateChanged(createChangedEvent([{
      path: sceneParameterPaths.sceneWindow.visible,
      previousValue: false,
      nextValue: true,
      sources: [{ id: "menu", kind: "gizmo" }],
      commands: []
    }]));

    expect(commands).toEqual([{
      source: WORKSPACE_MODE_SOURCE,
      target: sceneParameterPaths.sceneWindow.visible,
      operation: "set",
      value: false,
      priority: WORKSPACE_MODE_COMMAND_PRIORITY,
      timeStamp: 100
    }]);
  });

  it("uses the Scene view fullscreen presentation port instead of raw owner presentation", () => {
    const values = new Map<ParameterPath, unknown>([
      [sceneParameterPaths.workspace.mode, "develop"],
      [sceneParameterPaths.sceneWindow.visible, true]
    ]);
    const commands: WorkspaceModeCommand[] = [];
    const { presentationCalls, rawOwnerPresentationCalls, sceneView } = createSceneViewPort();
    const controller = new WorkspaceModeController({
      commandSink: { submit: (command) => commands.push(command) },
      getValue: (path) => values.get(path) as never,
      sceneView,
      toolWindows: []
    });

    values.set(sceneParameterPaths.workspace.mode, "run");
    controller.onStateChanged(createChangedEvent([{
      path: sceneParameterPaths.workspace.mode,
      previousValue: "develop",
      nextValue: "run",
      sources: [{ id: "shortcut", kind: "keyboard" }],
      commands: []
    }]));
    values.set(sceneParameterPaths.workspace.mode, "develop");
    controller.onStateChanged(createChangedEvent([{
      path: sceneParameterPaths.workspace.mode,
      previousValue: "run",
      nextValue: "develop",
      sources: [{ id: "scene-mode-toggle", kind: "gizmo" }],
      commands: []
    }]));

    expect(presentationCalls).toEqual([
      "exit:scene-view:programmatic",
      "enter:scene-view:programmatic",
      "exit:scene-view:programmatic"
    ]);
    expect(rawOwnerPresentationCalls).toEqual([]);
  });

  it("allows workspace mode changes while the Scene view is not live", () => {
    const values = new Map<ParameterPath, unknown>([
      [sceneParameterPaths.workspace.mode, "develop"],
      [sceneParameterPaths.debugWindow.visible, true]
    ]);
    const commands: WorkspaceModeCommand[] = [];
    const controller = new WorkspaceModeController({
      commandSink: { submit: (command) => commands.push(command) },
      getValue: (path) => values.get(path) as never,
      sceneView: createSceneViewPort({ live: false }).sceneView,
      toolWindows: [{ id: "debug", paths: sceneParameterPaths.debugWindow }]
    });

    values.set(sceneParameterPaths.workspace.mode, "run");
    controller.onStateChanged(createChangedEvent([{
      path: sceneParameterPaths.workspace.mode,
      previousValue: "develop",
      nextValue: "run",
      sources: [{ id: "shortcut", kind: "keyboard" }],
      commands: []
    }]));
    values.set(sceneParameterPaths.workspace.mode, "develop");
    controller.onStateChanged(createChangedEvent([{
      path: sceneParameterPaths.workspace.mode,
      previousValue: "run",
      nextValue: "develop",
      sources: [{ id: "shortcut", kind: "keyboard" }],
      commands: []
    }]));

    expect(commands).toEqual([
      {
        source: WORKSPACE_MODE_SOURCE,
        target: sceneParameterPaths.debugWindow.visible,
        operation: "set",
        value: false,
        priority: WORKSPACE_MODE_COMMAND_PRIORITY,
        timeStamp: undefined
      },
      {
        source: WORKSPACE_MODE_SOURCE,
        target: sceneParameterPaths.debugWindow.visible,
        operation: "set",
        value: true,
        priority: WORKSPACE_MODE_COMMAND_PRIORITY,
        timeStamp: undefined
      }
    ]);
  });
});
