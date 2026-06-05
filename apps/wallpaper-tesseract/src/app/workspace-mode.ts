import {
  sceneParameterPaths,
  type ParameterPath,
  type SceneCommandSink,
  type SceneParameterStore,
  type SceneStateChangedEvent
} from "../scene-runtime";
import type { FloatingWindowComponent, FloatingWindowParameterPaths } from "../window-runtime";

export type WorkspaceMode = "run" | "develop";

export const WORKSPACE_MODE_SOURCE = {
  id: "workspace-mode-controller",
  kind: "script"
} as const;

export const WORKSPACE_MODE_COMMAND_PRIORITY = 1000;

export interface WorkspaceModeControllerOptions {
  commandSink: SceneCommandSink;
  getValue<TValue>(path: ParameterPath<TValue>): TValue;
  getSceneWindow(): FloatingWindowComponent | null;
  toolWindows: readonly WorkspaceToolWindow[];
  onScenePresentationChanged?: () => void;
}

export interface WorkspaceToolWindow {
  readonly id: string;
  readonly paths: FloatingWindowParameterPaths;
}

const registeredWorkspaceModeParameters = new WeakMap<SceneParameterStore, WorkspaceMode>();

export function registerWorkspaceModeParameters(
  store: SceneParameterStore,
  initialMode: WorkspaceMode = "develop"
): void {
  const path = sceneParameterPaths.workspace.mode;
  assertWorkspaceMode(initialMode);
  if (store.has(path)) {
    const existingInitialMode = registeredWorkspaceModeParameters.get(store);
    if (existingInitialMode === initialMode) return;
    throw new Error(`Workspace mode parameter path is already registered outside workspace mode: ${path}`);
  }
  store.register({
    path,
    initialValue: initialMode,
    allowedOperations: ["set", "reset"],
    merge: "last-write-wins",
    validateValue: assertWorkspaceMode
  });
  registeredWorkspaceModeParameters.set(store, initialMode);
}

export class WorkspaceModeController {
  readonly id = "workspace-mode-controller";
  enabled = true;

  readonly #commandSink: SceneCommandSink;
  readonly #getValue: WorkspaceModeControllerOptions["getValue"];
  readonly #getSceneWindow: WorkspaceModeControllerOptions["getSceneWindow"];
  readonly #toolWindows: readonly WorkspaceToolWindow[];
  readonly #onScenePresentationChanged?: () => void;
  #mode: WorkspaceMode;
  #developVisibilitySnapshot: Map<ParameterPath<boolean>, boolean> | null = null;
  #developSceneVisibleSnapshot: boolean | null = null;
  #runModeDesiredVisibility = new Map<ParameterPath<boolean>, boolean>();

  constructor(options: WorkspaceModeControllerOptions) {
    this.#commandSink = options.commandSink;
    this.#getValue = options.getValue;
    this.#getSceneWindow = options.getSceneWindow;
    this.#toolWindows = options.toolWindows;
    this.#onScenePresentationChanged = options.onScenePresentationChanged;
    this.#mode = options.getValue(sceneParameterPaths.workspace.mode);
    this.applyPresentation(this.#mode);
  }

  onSceneStateChanged(event: SceneStateChangedEvent): void {
    const modeChange = event.changes.find((change) => change.path === sceneParameterPaths.workspace.mode);
    if (modeChange) {
      this.applyMode(modeChange.nextValue as WorkspaceMode);
    }
    if (this.#mode !== "run") return;
    for (const change of event.changes) {
      const sceneWindow = this.#getSceneWindow();
      if (sceneWindow && change.path === sceneWindow.visiblePath) {
        if (!isWorkspaceModeSource(change.sources) && change.nextValue === false) {
          this.submitSceneWindowVisible(true, event.frame.timeMs);
        }
        continue;
      }
      const toolWindow = this.findToolWindowByVisiblePath(change.path);
      if (!toolWindow || isWorkspaceModeSource(change.sources)) continue;
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
    this.#developSceneVisibleSnapshot = null;
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
    if (!this.#developVisibilitySnapshot) {
      this.#developVisibilitySnapshot = new Map(
        this.#toolWindows.map((toolWindow) => [
          toolWindow.paths.visible,
          this.#getValue(toolWindow.paths.visible)
        ])
      );
      const sceneWindow = this.#getSceneWindow();
      this.#developSceneVisibleSnapshot = sceneWindow ? this.#getValue(sceneWindow.visiblePath) : null;
    }
    this.applyPresentation("run");
    const sceneWindow = this.#getSceneWindow();
    if (sceneWindow && !this.#getValue(sceneWindow.visiblePath)) {
      this.submitSceneWindowVisible(true);
    }
    for (const toolWindow of this.#toolWindows) {
      if (this.#getValue(toolWindow.paths.visible)) {
        this.submitToolWindowVisible(toolWindow, false);
      }
    }
  }

  private enterDevelopMode(): void {
    this.applyPresentation("develop");
    for (const toolWindow of this.#toolWindows) {
      const visible = this.#runModeDesiredVisibility.get(toolWindow.paths.visible) ??
        this.#developVisibilitySnapshot?.get(toolWindow.paths.visible);
      if (typeof visible === "boolean") {
        this.submitToolWindowVisible(toolWindow, visible);
      }
    }
    const sceneWindow = this.#getSceneWindow();
    if (
      sceneWindow &&
      typeof this.#developSceneVisibleSnapshot === "boolean" &&
      this.#getValue(sceneWindow.visiblePath) !== this.#developSceneVisibleSnapshot
    ) {
      this.submitSceneWindowVisible(this.#developSceneVisibleSnapshot);
    }
    this.#developVisibilitySnapshot = null;
    this.#developSceneVisibleSnapshot = null;
    this.#runModeDesiredVisibility.clear();
  }

  private applyPresentation(mode: WorkspaceMode): void {
    this.#getSceneWindow()?.setPresentation(mode === "run" ? "fullscreen" : "windowed");
    this.#onScenePresentationChanged?.();
  }

  private findToolWindowByVisiblePath(path: ParameterPath): WorkspaceToolWindow | null {
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

  private submitSceneWindowVisible(visible: boolean, timeStamp?: number): void {
    const sceneWindow = this.#getSceneWindow();
    if (!sceneWindow) return;
    this.#commandSink.submit({
      source: WORKSPACE_MODE_SOURCE,
      target: sceneWindow.visiblePath,
      operation: "set",
      value: visible,
      priority: WORKSPACE_MODE_COMMAND_PRIORITY,
      timeStamp
    });
  }
}

function assertWorkspaceMode(value: unknown): asserts value is WorkspaceMode {
  if (value !== "run" && value !== "develop") {
    throw new Error("Expected workspace mode to be \"run\" or \"develop\".");
  }
}

function isWorkspaceModeSource(sources: SceneStateChangedEvent["changes"][number]["sources"]): boolean {
  return sources.some((source) => source.id === WORKSPACE_MODE_SOURCE.id);
}
