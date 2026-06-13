import {
  assertEditorWorkspaceMode,
  editorStatePaths,
  type EditorWorkspaceMode
} from "editor";
import type {
  FloatingWindowParameterPaths,
  UiLayoutPath,
  WindowViewLocation,
  WindowViewLocationSource,
  WindowViewOwnerCommandPort,
  WindowViewPresentationCommandPort,
  WindowViewKey
} from "../window-runtime";
import type { AppStateChangedEvent } from "editor";

export type WorkspaceMode = EditorWorkspaceMode;

type WorkspaceModePath = string;
interface WorkspaceModeCommandSource {
  readonly id: string;
  readonly kind: string;
}
export interface WorkspaceModeCommand {
  readonly source: WorkspaceModeCommandSource;
  readonly target: WorkspaceModePath;
  readonly operation: "set" | "add" | "reset";
  readonly value?: unknown;
  readonly delta?: unknown;
  readonly priority?: number;
  readonly timeStamp?: number;
}
type WorkspaceModeStateChangedEvent = AppStateChangedEvent;

export const WORKSPACE_MODE_SOURCE = {
  id: "workspace-mode-controller",
  kind: "script"
} as const;

export const WORKSPACE_MODE_COMMAND_PRIORITY = 1000;

export interface WorkspaceModeControllerOptions {
  commandSink: WorkspaceModeCommandSink;
  getValue<TValue>(path: WorkspaceModePath): TValue;
  sceneView: WorkspaceSceneViewPort;
  workspacePresentation?: WorkspacePresentationPort;
  toolWindows: readonly WorkspaceToolWindow[];
  onScenePresentationChanged?: () => void;
}

export interface WorkspaceModeCommandSink {
  submit(command: WorkspaceModeCommand): void;
}

export interface WorkspaceSceneViewPort {
  readonly viewKey: WindowViewKey;
  readonly locations: WindowViewLocationSource;
  readonly commands: WindowViewOwnerCommandPort;
  readonly presentation: WindowViewPresentationCommandPort;
  open(reason: "menu" | "programmatic"): void;
}

export interface WorkspaceToolWindow {
  readonly id: string;
  readonly paths: FloatingWindowParameterPaths;
}

export interface WorkspacePresentationPort {
  enterRunFullscreenForView(viewActorId: string, reason: "programmatic"): void;
  exitRunFullscreen(reason: "programmatic"): void;
}

export class WorkspaceModeController {
  readonly id = "workspace-mode-controller";
  enabled = true;

  readonly #commandSink: WorkspaceModeCommandSink;
  readonly #getValue: WorkspaceModeControllerOptions["getValue"];
  readonly #sceneView: WorkspaceSceneViewPort;
  readonly #workspacePresentation?: WorkspacePresentationPort;
  readonly #toolWindows: readonly WorkspaceToolWindow[];
  readonly #onScenePresentationChanged?: () => void;
  #mode: WorkspaceMode;
  #developVisibilitySnapshot: Map<UiLayoutPath<boolean>, boolean> | null = null;
  #developSceneOwnerSnapshot: {
    readonly path: UiLayoutPath<boolean>;
    readonly visible: boolean;
  } | null = null;
  #runModeDesiredVisibility = new Map<UiLayoutPath<boolean>, boolean>();

  constructor(options: WorkspaceModeControllerOptions) {
    this.#commandSink = options.commandSink;
    this.#getValue = options.getValue;
    this.#sceneView = options.sceneView;
    this.#workspacePresentation = options.workspacePresentation;
    this.#toolWindows = options.toolWindows;
    this.#onScenePresentationChanged = options.onScenePresentationChanged;
    this.#mode = options.getValue(editorStatePaths.workspace.mode);
    this.applyPresentation(this.#mode);
  }

  onStateChanged(event: WorkspaceModeStateChangedEvent): void {
    const modeChange = event.changes.find((change) => change.path === editorStatePaths.workspace.mode);
    if (modeChange) {
      this.applyMode(modeChange.nextValue as WorkspaceMode);
    }
    if (this.#workspacePresentation) return;
    if (this.#mode !== "run") return;
    for (const change of event.changes) {
      const sceneLocation = this.getSceneLocation();
      if (sceneLocation?.ownerFrameVisiblePath && change.path === sceneLocation.ownerFrameVisiblePath) {
        if (!isWorkspaceModeSource(change.sources) && change.nextValue === false) {
          this.submitSceneOwnerVisible(sceneLocation, true, event.frame.timeMs);
        }
        continue;
      }
      const toolWindow = this.findToolWindowByVisiblePath(change.path);
      if (!toolWindow) {
        if (
          this.#developSceneOwnerSnapshot?.path === change.path &&
          !isWorkspaceModeSource(change.sources)
        ) {
          const desiredVisible = change.nextValue as boolean;
          this.#developSceneOwnerSnapshot = {
            path: this.#developSceneOwnerSnapshot.path,
            visible: desiredVisible
          };
          if (desiredVisible) {
            this.submitVisiblePath(this.#developSceneOwnerSnapshot.path, false, event.frame.timeMs);
          }
        }
        continue;
      }
      if (isWorkspaceModeSource(change.sources)) continue;
      const desiredVisible = change.nextValue as boolean;
      this.#runModeDesiredVisibility.set(toolWindow.paths.visible, desiredVisible);
      if (desiredVisible) {
        this.submitToolWindowVisible(toolWindow, false, event.frame.timeMs);
      }
    }
  }

  dispose(): void {
    this.enabled = false;
    this.#developVisibilitySnapshot = null;
    this.#developSceneOwnerSnapshot = null;
    this.#runModeDesiredVisibility.clear();
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
    if (this.#workspacePresentation) {
      if (sceneLocation) {
        this.enterSceneFullscreen(sceneLocation);
      }
      return;
    }
    if (!this.#developVisibilitySnapshot) {
      this.#developVisibilitySnapshot = new Map(
        this.#toolWindows.map((toolWindow) => [
          toolWindow.paths.visible,
          this.#getValue(toolWindow.paths.visible)
        ])
      );
      if (sceneLocation?.ownerFrameVisiblePath) {
        this.#developSceneOwnerSnapshot = {
          path: sceneLocation.ownerFrameVisiblePath,
          visible: this.#getValue(sceneLocation.ownerFrameVisiblePath)
        };
      }
    }
    if (sceneLocation) {
      this.enterSceneFullscreen(sceneLocation);
    }
    const currentSceneLocation = this.getSceneLocation();
    if (
      currentSceneLocation?.ownerFrameVisiblePath &&
      !this.#getValue(currentSceneLocation.ownerFrameVisiblePath)
    ) {
      this.submitSceneOwnerVisible(currentSceneLocation, true);
    }
    const protectedVisiblePath = currentSceneLocation?.ownerFrameVisiblePath ?? null;
    const sourceOwnerVisiblePath = sceneLocation?.ownerFrameVisiblePath ?? null;
    if (
      sourceOwnerVisiblePath &&
      sourceOwnerVisiblePath !== protectedVisiblePath &&
      !this.findToolWindowByVisiblePath(sourceOwnerVisiblePath) &&
      this.#getValue(sourceOwnerVisiblePath)
    ) {
      this.submitVisiblePath(sourceOwnerVisiblePath, false);
    }
    for (const toolWindow of this.#toolWindows) {
      if (toolWindow.paths.visible === protectedVisiblePath) continue;
      if (this.#getValue(toolWindow.paths.visible)) {
        this.submitToolWindowVisible(toolWindow, false);
      }
    }
  }

  private enterDevelopMode(): void {
    if (this.#workspacePresentation) {
      this.exitSceneFullscreen();
      return;
    }
    this.exitSceneFullscreen();
    for (const toolWindow of this.#toolWindows) {
      const visible = this.#runModeDesiredVisibility.get(toolWindow.paths.visible) ??
        this.#developVisibilitySnapshot?.get(toolWindow.paths.visible);
      if (typeof visible === "boolean") {
        this.submitToolWindowVisible(toolWindow, visible);
      }
    }
    const sceneLocation = this.getSceneLocation();
    if (
      sceneLocation?.ownerFrameVisiblePath &&
      this.#developSceneOwnerSnapshot &&
      sceneLocation.ownerFrameVisiblePath === this.#developSceneOwnerSnapshot.path &&
      !this.findToolWindowByVisiblePath(sceneLocation.ownerFrameVisiblePath) &&
      this.#getValue(sceneLocation.ownerFrameVisiblePath) !== this.#developSceneOwnerSnapshot.visible
    ) {
      this.submitSceneOwnerVisible(sceneLocation, this.#developSceneOwnerSnapshot.visible);
    }
    this.#developVisibilitySnapshot = null;
    this.#developSceneOwnerSnapshot = null;
    this.#runModeDesiredVisibility.clear();
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
    if (this.#workspacePresentation) {
      this.#workspacePresentation.enterRunFullscreenForView(sceneLocation.viewActorId, "programmatic");
    } else {
      this.#sceneView.presentation.enterViewFullscreen(sceneLocation.viewActorId, "programmatic");
    }
    this.#onScenePresentationChanged?.();
  }

  private exitSceneFullscreen(): void {
    const sceneLocation = this.getSceneLocation();
    if (!sceneLocation) {
      this.#onScenePresentationChanged?.();
      return;
    }
    if (this.#workspacePresentation) {
      this.#workspacePresentation.exitRunFullscreen("programmatic");
    } else {
      this.#sceneView.presentation.exitViewFullscreen(sceneLocation.viewActorId, "programmatic");
    }
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

  private findToolWindowByVisiblePath(path: WorkspaceModePath): WorkspaceToolWindow | null {
    return this.#toolWindows.find((toolWindow) => toolWindow.paths.visible === path) ?? null;
  }

  private submitToolWindowVisible(toolWindow: WorkspaceToolWindow, visible: boolean, timeStamp?: number): void {
    this.#commandSink.submit({
      source: WORKSPACE_MODE_SOURCE,
      target: toolWindow.paths.visible,
      operation: "set",
      value: visible,
      priority: WORKSPACE_MODE_COMMAND_PRIORITY,
      timeStamp
    });
  }

  private submitSceneOwnerVisible(location: WindowViewLocation, visible: boolean, timeStamp?: number): void {
    if (!location.ownerFrameVisiblePath) return;
    this.submitVisiblePath(location.ownerFrameVisiblePath, visible, timeStamp);
  }

  private submitVisiblePath(path: UiLayoutPath<boolean>, visible: boolean, timeStamp?: number): void {
    this.#commandSink.submit({
      source: WORKSPACE_MODE_SOURCE,
      target: path,
      operation: "set",
      value: visible,
      priority: WORKSPACE_MODE_COMMAND_PRIORITY,
      timeStamp
    });
  }

}

export const workspaceModePath = editorStatePaths.workspace.mode;

export function assertWorkspaceMode(value: unknown): asserts value is WorkspaceMode {
  assertEditorWorkspaceMode(value);
}

function isWorkspaceModeSource(sources: WorkspaceModeStateChangedEvent["changes"][number]["sources"]): boolean {
  return sources.some((source) => source.id === WORKSPACE_MODE_SOURCE.id);
}
