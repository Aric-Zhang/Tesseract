import { describe, expect, it } from "vitest";
import {
  AppFrameStateController,
  AppStateParameterStore,
  editorStatePath,
  editorStatePaths,
  type AppStateObserver
} from "editor";
import { type EditorWorkspaceMode } from "editor";
import { createSingletonWindowViewIdentity, type WindowViewLocation } from "../window-runtime";
import {
  installSceneRunModeCommand,
  installSceneRunModeState,
  type SceneRunModePresentationPort,
  type SceneRunModeSceneViewPort
} from "./scene-run-mode-command";
import type { AppStateChangedEvent } from "editor";
import type { StateObserverRegistry } from "editor";

function createChangedEvent(changes: AppStateChangedEvent["changes"]): AppStateChangedEvent {
  return {
    frame: { timeMs: 100, deltaMs: 16, frameIndex: 1 },
    changes
  };
}

function createStateBridge(): {
  readonly observers: AppStateObserver[];
  readonly disposals: string[];
  readonly bridge: StateObserverRegistry<AppStateObserver>;
} {
  const observers: AppStateObserver[] = [];
  const disposals: string[] = [];
  return {
    observers,
    disposals,
    bridge: {
      subscribe(observer) {
        observers.push(observer);
        return {
          dispose() {
            disposals.push("observer");
          }
        };
      },
      dispose() {
        disposals.push("registry");
      }
    }
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
  const sceneView: SceneRunModeSceneViewPort = {
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
  readonly port: SceneRunModePresentationPort;
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

describe("scene run mode state", () => {
  it("registers workspace.mode with a develop default", () => {
    const store = new AppStateParameterStore();

    installSceneRunModeState(store);
    installSceneRunModeState(store);

    expect(editorStatePaths.workspace.mode).toBe(editorStatePath<EditorWorkspaceMode>("workspace.mode"));
    expect(store.get(editorStatePaths.workspace.mode)).toBe("develop");
  });

  it("rejects invalid workspace modes", () => {
    const store = new AppStateParameterStore();
    installSceneRunModeState(store);
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

    expect(() => installSceneRunModeState(store)).toThrow(/outside workspace mode/);
  });
});

describe("installSceneRunModeCommand", () => {
  it("delegates run and develop mode to the workspace presentation port", () => {
    const store = new AppStateParameterStore();
    installSceneRunModeState(store);
    const stateBridge = createStateBridge();
    const { sceneView, activations } = createSceneViewPort();
    const workspacePresentation = createWorkspacePresentation();
    const presentationMeasurements: string[] = [];
    installSceneRunModeCommand({
      stateStore: store,
      stateBridge: stateBridge.bridge,
      sceneView,
      workspacePresentation: workspacePresentation.port,
      onScenePresentationChanged: () => presentationMeasurements.push("measure")
    });
    workspacePresentation.calls.length = 0;
    presentationMeasurements.length = 0;

    stateBridge.observers[0]?.onStateChanged(createChangedEvent([{
      path: editorStatePaths.workspace.mode,
      previousValue: "develop",
      nextValue: "run",
      sources: [{ id: "shortcut", kind: "keyboard" }],
      commands: []
    }]));

    expect(activations).toEqual(["activate:scene-view:programmatic"]);
    expect(workspacePresentation.calls).toEqual(["enter:scene-view:programmatic"]);
    expect(presentationMeasurements).toEqual(["measure"]);

    stateBridge.observers[0]?.onStateChanged(createChangedEvent([{
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
    const store = new AppStateParameterStore();
    installSceneRunModeState(store);
    const stateBridge = createStateBridge();
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
    installSceneRunModeCommand({
      stateStore: store,
      stateBridge: stateBridge.bridge,
      sceneView: scene.sceneView,
      workspacePresentation: workspacePresentation.port
    });

    stateBridge.observers[0]?.onStateChanged(createChangedEvent([{
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
    const store = new AppStateParameterStore();
    installSceneRunModeState(store);
    const stateBridge = createStateBridge();
    const { sceneView } = createSceneViewPort();
    const workspacePresentation = createWorkspacePresentation();
    installSceneRunModeCommand({
      stateStore: store,
      stateBridge: stateBridge.bridge,
      sceneView,
      workspacePresentation: workspacePresentation.port
    });
    workspacePresentation.calls.length = 0;

    const runChange = {
      path: editorStatePaths.workspace.mode,
      previousValue: "develop",
      nextValue: "run",
      sources: [{ id: "shortcut", kind: "keyboard" }],
      commands: []
    } as const;
    stateBridge.observers[0]?.onStateChanged(createChangedEvent([runChange]));
    stateBridge.observers[0]?.onStateChanged(createChangedEvent([runChange]));

    expect(workspacePresentation.calls).toEqual(["enter:scene-view:programmatic"]);
  });

  it("disposes the subscribed command without exposing the controller", () => {
    const store = new AppStateParameterStore();
    installSceneRunModeState(store);
    const stateBridge = createStateBridge();
    const { sceneView } = createSceneViewPort();
    const workspacePresentation = createWorkspacePresentation();

    const installed = installSceneRunModeCommand({
      stateStore: store,
      stateBridge: stateBridge.bridge,
      sceneView,
      workspacePresentation: workspacePresentation.port
    });

    expect(Object.keys(installed)).toEqual(["dispose"]);
    installed.dispose();
    expect(stateBridge.disposals).toEqual(["observer"]);
  });
});
