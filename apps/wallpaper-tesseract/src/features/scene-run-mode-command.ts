import {
  editorStatePaths,
  registerWorkspaceModeParameters,
  type AppStateObserver,
  type AppStateParameterStore,
  type EditorWorkspaceMode
} from "editor";
import type { AppStateChangedEvent } from "editor";
import type { StateObserverRegistry } from "editor";
import type {
  WindowViewKey,
  WindowViewLocation,
  WindowViewLocationSource,
  WindowViewOwnerCommandPort
} from "../window-runtime";

type SceneRunMode = EditorWorkspaceMode;
type SceneRunModePath = string;
type SceneRunModeChangedEvent = AppStateChangedEvent;

interface SceneRunModeCommandOptions {
  getValue<TValue>(path: SceneRunModePath): TValue;
  sceneView: SceneRunModeSceneViewPort;
  workspacePresentation: SceneRunModePresentationPort;
  onScenePresentationChanged?: () => void;
}

export interface SceneRunModeSceneViewPort {
  readonly viewKey: WindowViewKey;
  readonly locations: WindowViewLocationSource;
  readonly commands: WindowViewOwnerCommandPort;
  open(reason: "menu" | "programmatic"): void;
}

export interface SceneRunModePresentationPort {
  enterRunFullscreenForView(viewActorId: string, reason: "programmatic"): void;
  exitRunFullscreen(reason: "programmatic"): void;
}

export interface InstallSceneRunModeCommandOptions {
  readonly stateStore: AppStateParameterStore;
  readonly stateBridge: StateObserverRegistry<AppStateObserver>;
  readonly sceneView: SceneRunModeSceneViewPort;
  readonly workspacePresentation: SceneRunModePresentationPort;
  readonly onScenePresentationChanged?: () => void;
}

export interface InstalledSceneRunModeCommand {
  dispose(): void;
}

export function installSceneRunModeState(store: AppStateParameterStore): void {
  registerWorkspaceModeParameters(store);
}

export function installSceneRunModeCommand(
  options: InstallSceneRunModeCommandOptions
): InstalledSceneRunModeCommand {
  const command = new SceneRunModeCommand({
    getValue: (path) => options.stateStore.get(path),
    sceneView: options.sceneView,
    workspacePresentation: options.workspacePresentation,
    onScenePresentationChanged: options.onScenePresentationChanged
  });
  const registration = options.stateBridge.subscribe(command);

  return {
    dispose() {
      registration.dispose();
      command.dispose();
    }
  };
}

class SceneRunModeCommand implements AppStateObserver {
  readonly id = "scene-run-mode-command";
  enabled = true;

  readonly #sceneView: SceneRunModeSceneViewPort;
  readonly #workspacePresentation: SceneRunModePresentationPort;
  readonly #onScenePresentationChanged?: () => void;
  #mode: SceneRunMode;

  constructor(options: SceneRunModeCommandOptions) {
    this.#sceneView = options.sceneView;
    this.#workspacePresentation = options.workspacePresentation;
    this.#onScenePresentationChanged = options.onScenePresentationChanged;
    this.#mode = options.getValue(editorStatePaths.workspace.mode);
    this.applyPresentation(this.#mode);
  }

  onStateChanged(event: SceneRunModeChangedEvent): void {
    const modeChange = event.changes.find((change) => change.path === editorStatePaths.workspace.mode);
    if (modeChange) {
      this.applyMode(modeChange.nextValue as SceneRunMode);
    }
  }

  dispose(): void {
    this.enabled = false;
  }

  private applyMode(nextMode: SceneRunMode): void {
    if (nextMode === this.#mode) return;
    if (nextMode === "run") {
      this.enterRunMode();
    } else {
      this.enterDevelopMode();
    }
    this.#mode = nextMode;
  }

  private enterRunMode(): void {
    const sceneLocation = this.ensureSceneLocation();
    if (sceneLocation) {
      this.enterSceneFullscreen(sceneLocation);
    }
  }

  private enterDevelopMode(): void {
    this.exitSceneFullscreen();
  }

  private applyPresentation(mode: SceneRunMode): void {
    const sceneLocation = mode === "run" ? this.ensureSceneLocation() : this.getSceneLocation();
    if (sceneLocation) {
      if (mode === "run") {
        this.enterSceneFullscreen(sceneLocation);
      } else {
        this.exitSceneFullscreen();
      }
    } else {
      this.#onScenePresentationChanged?.();
    }
  }

  private enterSceneFullscreen(sceneLocation: WindowViewLocation): void {
    this.#sceneView.commands.activateView(sceneLocation.viewActorId, "programmatic");
    this.#workspacePresentation.enterRunFullscreenForView(sceneLocation.viewActorId, "programmatic");
    this.#onScenePresentationChanged?.();
  }

  private exitSceneFullscreen(): void {
    const sceneLocation = this.getSceneLocation();
    if (!sceneLocation) {
      this.#onScenePresentationChanged?.();
      return;
    }
    this.#workspacePresentation.exitRunFullscreen("programmatic");
    this.#onScenePresentationChanged?.();
  }

  private getSceneLocation(): WindowViewLocation | null {
    return this.#sceneView.locations.getLocationByViewKey(this.#sceneView.viewKey);
  }

  private ensureSceneLocation(): WindowViewLocation | null {
    const existing = this.getSceneLocation();
    if (existing) return existing;
    this.#sceneView.open("programmatic");
    return this.getSceneLocation();
  }
}
