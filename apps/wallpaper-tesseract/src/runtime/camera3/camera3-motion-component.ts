import type * as THREE from "three";
import type {
  RuntimeCameraCommandSink,
  RuntimeCameraControlCommand,
  RuntimeCameraProjectionMode,
  RuntimeCameraViewState,
  RuntimeFrame,
  RuntimeRegistration,
  RuntimeWork
} from "runtime-core";
import type { Actor, Component, ComponentType } from "../../actor-runtime";
import {
  RuntimeThreeCameraMotionController,
  type RuntimeThreeCameraMotionObserver,
  type RuntimeThreeCameraMotionUpdateResult
} from "runtime-three";

export const camera3MotionComponentType =
  "camera3-motion-component" as ComponentType<Camera3MotionComponent>;

export interface Camera3MotionComponentOptions {
  readonly id?: string;
  readonly target?: readonly [number, number, number];
  readonly distance?: number;
  readonly yaw?: number;
  readonly pitch?: number;
  readonly roll?: number;
  readonly locked?: boolean;
  readonly orbitSensitivity?: number;
  readonly projectionMode?: RuntimeCameraProjectionMode;
}

export class Camera3MotionComponent implements Component, RuntimeCameraCommandSink, RuntimeWork {
  readonly type = camera3MotionComponentType;
  readonly actor: Actor;
  readonly id: string;
  readonly priority = -100;
  enabled = true;
  readonly #controller: RuntimeThreeCameraMotionController;

  constructor(actor: Actor, options: Camera3MotionComponentOptions = {}) {
    this.actor = actor;
    this.id = options.id ?? "camera3-motion-controller";
    this.#controller = new RuntimeThreeCameraMotionController(options);
  }

  getRuntimeThreeCameraForRender(): THREE.PerspectiveCamera | THREE.OrthographicCamera {
    return this.#controller.getRuntimeThreeCameraForRender();
  }

  get distance(): number {
    return this.#controller.distance;
  }

  readViewState(): RuntimeCameraViewState {
    return this.#controller.readViewState();
  }

  submit(command: RuntimeCameraControlCommand): void {
    this.#controller.submit(command);
  }

  subscribe(observer: RuntimeThreeCameraMotionObserver): RuntimeRegistration {
    return this.#controller.subscribe(observer);
  }

  updateFrame(frame: RuntimeFrame): void {
    this.#controller.updateFrame(frame);
  }

  resizeProjection(width: number, height: number): void {
    this.#controller.resizeProjection(width, height);
  }

  updateRuntimeFrame(frame: RuntimeFrame): void {
    this.#controller.updateFrame(frame);
  }

  update(frame: RuntimeFrame): RuntimeThreeCameraMotionUpdateResult {
    return this.#controller.update(frame);
  }

  dispose(): void {
    if (!this.enabled) return;
    this.enabled = false;
    this.#controller.dispose();
  }
}
