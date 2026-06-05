import {
  resolveWindowDockPreview,
  type WindowDockPreview,
  type WindowDockPoint,
  type WindowDockTargetFrame
} from "./window-dock-targets";
import type { WindowViewKey } from "./window-view-key";

export type WindowTabDragSessionState = "idle" | "pending" | "dragging";

export interface WindowTabDragSessionStart {
  readonly source: WindowTabDragSource;
  readonly startPoint: WindowDockPoint;
}

export interface WindowTabDragSource {
  readonly frameId: string;
  readonly viewActorId: string;
  readonly viewKey: WindowViewKey;
}

export interface WindowTabDragSessionMoveResult {
  readonly state: WindowTabDragSessionState;
  readonly preview: WindowDockPreview | null;
  readonly source: WindowTabDragSource | null;
}

export interface WindowTabDragSessionEndResult {
  readonly source: WindowTabDragSource;
  readonly preview: WindowDockPreview;
}

export interface WindowTabDragSessionOptions {
  readonly thresholdPx?: number;
}

export class WindowTabDragSession {
  readonly #thresholdPx: number;
  #state: WindowTabDragSessionState = "idle";
  #source: WindowTabDragSource | null = null;
  #startPoint: WindowDockPoint | null = null;
  #preview: WindowDockPreview | null = null;

  constructor(options: WindowTabDragSessionOptions = {}) {
    this.#thresholdPx = options.thresholdPx ?? 8;
  }

  get state(): WindowTabDragSessionState {
    return this.#state;
  }

  get preview(): WindowDockPreview | null {
    return this.#preview;
  }

  get source(): WindowTabDragSource | null {
    return this.#source;
  }

  start(options: WindowTabDragSessionStart): void {
    this.#state = "pending";
    this.#source = options.source;
    this.#startPoint = options.startPoint;
    this.#preview = null;
  }

  move(
    point: WindowDockPoint,
    frames: readonly WindowDockTargetFrame[]
  ): WindowTabDragSessionMoveResult {
    if (!this.#startPoint || !this.#source || this.#state === "idle") {
      return { state: "idle", preview: null, source: null };
    }
    if (this.#state === "pending" && distance(this.#startPoint, point) < this.#thresholdPx) {
      return { state: "pending", preview: null, source: this.#source };
    }
    this.#state = "dragging";
    this.#preview = resolveWindowDockPreview(point, frames, {
      sourceFrameId: this.#source.frameId
    });
    return { state: this.#state, preview: this.#preview, source: this.#source };
  }

  end(): WindowTabDragSessionEndResult | null {
    const result = this.#state === "dragging" && this.#preview && this.#source
      ? { source: this.#source, preview: this.#preview }
      : null;
    this.reset();
    return result;
  }

  cancel(): void {
    this.reset();
  }

  private reset(): void {
    this.#state = "idle";
    this.#source = null;
    this.#startPoint = null;
    this.#preview = null;
  }
}

function distance(a: WindowDockPoint, b: WindowDockPoint): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}
