import type { SceneFrame } from "./scene-frame";

export interface RuntimeDisposable {
  dispose(): void;
}

export interface FrameUpdatable {
  updateFrame(frame: SceneFrame): void;
}

export interface RuntimeObject {
  readonly id: string;
  readonly priority?: number;
  enabled?: boolean;
  updateFrame?(frame: SceneFrame): void;
  dispose?(): void;
}

export interface RuntimeRegistration extends RuntimeDisposable {}
