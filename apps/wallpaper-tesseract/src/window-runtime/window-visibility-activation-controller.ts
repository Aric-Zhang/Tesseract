import type {
  ParameterPath,
  RuntimeObject,
  SceneFrame,
  SceneStateChangedEvent,
  SceneStateObserver
} from "../scene-runtime";
import type { WindowControlItem, WindowControlSource } from "./window-control-source";

export const WINDOW_VISIBILITY_ACTIVATION_CONTROLLER_ID =
  "window-visibility-activation-controller";
export const WINDOW_VISIBILITY_ACTIVATION_CONTROLLER_PRIORITY = -950;

export interface WindowVisibilityActivationControllerOptions {
  readonly source: WindowControlSource;
}

export class WindowVisibilityActivationController implements RuntimeObject, SceneStateObserver {
  readonly id = WINDOW_VISIBILITY_ACTIVATION_CONTROLLER_ID;
  readonly priority = WINDOW_VISIBILITY_ACTIVATION_CONTROLLER_PRIORITY;
  enabled = true;

  readonly #source: WindowControlSource;

  constructor(options: WindowVisibilityActivationControllerOptions) {
    this.#source = options.source;
    this.reconcileAll();
  }

  updateFrame(_frame: SceneFrame): void {
    if (!this.enabled) return;
    this.reconcileAll();
  }

  onSceneStateChanged(event: SceneStateChangedEvent): void {
    if (!this.enabled) return;
    let matched = false;
    for (const change of event.changes) {
      if (this.#source.findWindowByVisiblePath(change.path as ParameterPath<boolean>)) {
        matched = true;
        break;
      }
    }
    if (matched) {
      this.reconcileAll();
    }
  }

  reconcileAll(): void {
    for (const item of this.#source.listWindows()) {
      reconcileWindow(item);
    }
  }

  dispose(): void {
    this.enabled = false;
  }
}

function reconcileWindow(item: WindowControlItem): void {
  if (item.activationMode !== "visible") return;
  if (item.actor.enabled === item.visible) return;
  item.actor.enabled = item.visible;
}
