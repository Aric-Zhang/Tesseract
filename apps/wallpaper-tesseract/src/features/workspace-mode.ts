import {
  editorStatePaths,
  registerWorkspaceModeParameters,
  type AppStateObserver,
  type AppStateParameterStore,
  type EditorWorkspaceMode
} from "editor";
import type {
  WindowViewLocation,
  WindowViewLocationSource,
  WindowViewOwnerCommandPort,
  WindowViewKey
} from "../window-runtime";
import type { AppStateChangedEvent } from "editor";
import type { StateObserverRegistry } from "editor";

type WorkspaceMode = EditorWorkspaceMode;

type WorkspaceModePath = string;
type WorkspaceModeStateChangedEvent = AppStateChangedEvent;

export interface WorkspaceModeControllerOptions {
  getValue<TValue>(path: WorkspaceModePath): TValue;
  sceneView: WorkspaceSceneViewPort;
  workspacePresentation: WorkspacePresentationPort;
  onScenePresentationChanged?: () => void;
}

export interface WorkspaceSceneViewPort {
  readonly viewKey: WindowViewKey;
  readonly locations: WindowViewLocationSource;
  readonly commands: WindowViewOwnerCommandPort;
  open(reason: "menu" | "programmatic"): void;
}

export interface WorkspacePresentationPort {
  enterRunFullscreenForView(viewActorId: string, reason: "programmatic"): void;
  exitRunFullscreen(reason: "programmatic"): void;
}

export interface InstallWorkspaceModeControllerOptions {
  readonly stateStore: AppStateParameterStore;
  readonly stateBridge: StateObserverRegistry<AppStateObserver>;
  readonly sceneView: WorkspaceSceneViewPort;
  readonly workspacePresentation: WorkspacePresentationPort;
  readonly onScenePresentationChanged?: () => void;
}

export interface InstalledWorkspaceModeController {
  readonly workspaceModeController: WorkspaceModeController;
  dispose(): void;
}

export function installWorkspaceModeState(store: AppStateParameterStore): void {
  registerWorkspaceModeParameters(store);
}

export function installWorkspaceModeController(
  options: InstallWorkspaceModeControllerOptions
): InstalledWorkspaceModeController {
  const workspaceModeController = new WorkspaceModeController({
    getValue: (path) => options.stateStore.get(path),
    sceneView: options.sceneView,
    workspacePresentation: options.workspacePresentation,
    onScenePresentationChanged: options.onScenePresentationChanged
  });
  const workspaceModeRegistration = options.stateBridge.subscribe(workspaceModeController);

  return {
    workspaceModeController,
    dispose() {
      workspaceModeRegistration.dispose();
      workspaceModeController.dispose();
    }
  };
}

export class WorkspaceModeController {
  readonly id = "workspace-mode-controller";
  enabled = true;

  readonly #sceneView: WorkspaceSceneViewPort;
  readonly #workspacePresentation: WorkspacePresentationPort;
  readonly #onScenePresentationChanged?: () => void;
  #mode: WorkspaceMode;

  constructor(options: WorkspaceModeControllerOptions) {
    this.#sceneView = options.sceneView;
    this.#workspacePresentation = options.workspacePresentation;
    this.#onScenePresentationChanged = options.onScenePresentationChanged;
    this.#mode = options.getValue(editorStatePaths.workspace.mode);
    this.applyPresentation(this.#mode);
  }

  onStateChanged(event: WorkspaceModeStateChangedEvent): void {
    const modeChange = event.changes.find((change) => change.path === editorStatePaths.workspace.mode);
    if (modeChange) {
      this.applyMode(modeChange.nextValue as WorkspaceMode);
    }
  }

  dispose(): void {
    this.enabled = false;
  }

  private applyMode(nextMode: WorkspaceMode): void {
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

  private applyPresentation(mode: WorkspaceMode): void {
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
