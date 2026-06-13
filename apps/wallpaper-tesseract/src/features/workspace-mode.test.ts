import { describe, expect, it } from "vitest";
import { AppFrameStateController, AppStateParameterStore, editorStatePath, editorStatePaths } from "editor";
import { registerWorkspaceModeParameters, type EditorWorkspaceMode } from "editor";
import { createSingletonWindowViewIdentity, type WindowViewLocation } from "../window-runtime";
import {
  WorkspaceModeController,
  type WorkspacePresentationPort,
  type WorkspaceSceneViewPort
} from "./workspace-mode";
import type { AppStateChangedEvent } from "editor";

function createChangedEvent(changes: AppStateChangedEvent["changes"]): AppStateChangedEvent {
  return {
    frame: { timeMs: 100, deltaMs: 16, frameIndex: 1 },
    changes
  };
}

function createSceneViewPort(options: {
  readonly viewActorId?: string;
  readonly live?: boolean;
} = {}) {
  const activations: string[] = [];
  const opens: string[] = [];
  const viewActorId = options.viewActorId ?? "scene-view";
  const location = (): WindowViewLocation | null => options.live === false
    ? null
    : {
        viewKey: "scene",
        identity: createSingletonWindowViewIdentity("scene"),
        viewActorId,
        ownerFrameActorId: "scene-frame",
        ownerFrameVisiblePath: null,
        ownerFrameVisible: true,
        ownerFrameActiveInHierarchy: true,
        activeInFrame: true,
        visibleInFrame: true,
        presentation: "windowed",
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
      setOwnerPresentation(): void {},
      requestOwnerVisible(): void {}
    },
    open(reason): void {
      opens.push(`open:${reason}`);
    }
  };
  return { activations, opens, sceneView };
}

function createWorkspacePresentation(): {
  readonly calls: string[];
  readonly port: WorkspacePresentationPort;
} {
  const calls: string[] = [];
  return {
    calls,
    port: {
      enterRunFullscreenForView(viewActorId, reason) {
        calls.push(`enter:${viewActorId}:${reason}`);
      },
      exitRunFullscreen(reason) {
        calls.push(`exit:${reason}`);
      }
    }
  };
}

describe("workspace mode parameters", () => {
  it("registers workspace.mode with a develop default", () => {
    const store = new AppStateParameterStore();

    registerWorkspaceModeParameters(store);
    registerWorkspaceModeParameters(store);

    expect(editorStatePaths.workspace.mode).toBe(editorStatePath<EditorWorkspaceMode>("workspace.mode"));
    expect(store.get(editorStatePaths.workspace.mode)).toBe("develop");
  });

  it("rejects invalid workspace modes", () => {
    const store = new AppStateParameterStore();
    registerWorkspaceModeParameters(store);
    const controller = new AppFrameStateController({ store });

    expect(() => controller.submit({
      source: { id: "test", kind: "script" },
      target: editorStatePaths.workspace.mode,
      operation: "set",
      value: "preview"
    })).toThrow(/workspace mode/);
  });

  it("rejects conflicting registration on the workspace mode path", () => {
    const store = new AppStateParameterStore();
    store.register({
      path: editorStatePaths.workspace.mode,
      initialValue: "other",
      allowedOperations: ["set"],
      merge: "last-write-wins"
    });

    expect(() => registerWorkspaceModeParameters(store)).toThrow(/outside workspace mode/);
  });
});

describe("WorkspaceModeController", () => {
  it("delegates run and develop mode to the workspace presentation port", () => {
    const values = new Map<string, unknown>([
      [editorStatePaths.workspace.mode, "develop"]
    ]);
    const { sceneView, activations } = createSceneViewPort();
    const workspacePresentation = createWorkspacePresentation();
    const presentationMeasurements: string[] = [];
    const controller = new WorkspaceModeController({
      getValue: (path) => values.get(path) as never,
      sceneView,
      workspacePresentation: workspacePresentation.port,
      onScenePresentationChanged: () => presentationMeasurements.push("measure")
    });
    workspacePresentation.calls.length = 0;
    presentationMeasurements.length = 0;

    values.set(editorStatePaths.workspace.mode, "run");
    controller.onStateChanged(createChangedEvent([{
      path: editorStatePaths.workspace.mode,
      previousValue: "develop",
      nextValue: "run",
      sources: [{ id: "shortcut", kind: "keyboard" }],
      commands: []
    }]));

    expect(activations).toEqual(["activate:scene-view:programmatic"]);
    expect(workspacePresentation.calls).toEqual(["enter:scene-view:programmatic"]);
    expect(presentationMeasurements).toEqual(["measure"]);

    values.set(editorStatePaths.workspace.mode, "develop");
    controller.onStateChanged(createChangedEvent([{
      path: editorStatePaths.workspace.mode,
      previousValue: "run",
      nextValue: "develop",
      sources: [{ id: "scene-mode-toggle", kind: "gizmo" }],
      commands: []
    }]));

    expect(workspacePresentation.calls).toEqual([
      "enter:scene-view:programmatic",
      "exit:programmatic"
    ]);
    expect(presentationMeasurements).toEqual(["measure", "measure"]);
  });

  it("opens the Scene view before entering run mode when it is not live", () => {
    const values = new Map<string, unknown>([
      [editorStatePaths.workspace.mode, "develop"]
    ]);
    let live = false;
    const scene = createSceneViewPort({ live });
    const workspacePresentation = createWorkspacePresentation();
    scene.sceneView.open = (reason) => {
      scene.opens.push(`open:${reason}`);
      live = true;
    };
    scene.sceneView.locations.getLocationByViewKey = (viewKey) => {
      if (viewKey !== "scene" || !live) return null;
      return createSceneViewPort().sceneView.locations.getLocationByViewKey(viewKey);
    };
    const controller = new WorkspaceModeController({
      getValue: (path) => values.get(path) as never,
      sceneView: scene.sceneView,
      workspacePresentation: workspacePresentation.port
    });

    values.set(editorStatePaths.workspace.mode, "run");
    controller.onStateChanged(createChangedEvent([{
      path: editorStatePaths.workspace.mode,
      previousValue: "develop",
      nextValue: "run",
      sources: [{ id: "shortcut", kind: "keyboard" }],
      commands: []
    }]));

    expect(scene.opens).toEqual(["open:programmatic"]);
    expect(workspacePresentation.calls).toEqual(["enter:scene-view:programmatic"]);
  });

  it("ignores repeated mode notifications after the mode has already been applied", () => {
    const values = new Map<string, unknown>([
      [editorStatePaths.workspace.mode, "develop"]
    ]);
    const { sceneView } = createSceneViewPort();
    const workspacePresentation = createWorkspacePresentation();
    const controller = new WorkspaceModeController({
      getValue: (path) => values.get(path) as never,
      sceneView,
      workspacePresentation: workspacePresentation.port
    });
    workspacePresentation.calls.length = 0;

    values.set(editorStatePaths.workspace.mode, "run");
    const runChange = {
      path: editorStatePaths.workspace.mode,
      previousValue: "develop",
      nextValue: "run",
      sources: [{ id: "shortcut", kind: "keyboard" }],
      commands: []
    } as const;
    controller.onStateChanged(createChangedEvent([runChange]));
    controller.onStateChanged(createChangedEvent([runChange]));

    expect(workspacePresentation.calls).toEqual(["enter:scene-view:programmatic"]);
  });
});
