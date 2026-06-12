import type * as THREE from "three";
import type { RuntimeCameraProjectionMode, RuntimeFrame, RuntimeWork } from "runtime-core";
import type { Actor, Component, ComponentType } from "../../../actor-runtime";
import {
  Camera3MotionController,
  type Camera3MotionChangedEvent,
  type Camera3MotionObserver,
  type Camera3MotionUpdateResult,
  type Camera3ViewState
} from "../../../camera3-control";
import type { Camera3CommandSink, Camera3ControlCommand } from "../../../camera3-control";
import type { RuntimeRegistration, UpdateFrame } from "../../../runtime/ports";

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

export class Camera3MotionComponent implements Component, Camera3CommandSink, RuntimeWork {
  readonly type = camera3MotionComponentType;
  readonly actor: Actor;
  readonly id: string;
  readonly priority = -100;
  enabled = true;
  readonly #controller: Camera3MotionController;

  constructor(actor: Actor, options: Camera3MotionComponentOptions = {}) {
    this.actor = actor;
    this.id = options.id ?? "camera3-motion-controller";
    this.#controller = new Camera3MotionController(options);
  }

  getRuntimeThreeCameraForRender(): THREE.PerspectiveCamera | THREE.OrthographicCamera {
    return this.#controller.getRuntimeThreeCameraForRender();
  }

  get distance(): number {
    return this.#controller.distance;
  }

  readViewState(): Camera3ViewState {
    return this.#controller.readViewState();
  }

  submit(command: Camera3ControlCommand): void {
    this.#controller.submit(command);
  }

  subscribe(observer: Camera3MotionObserver): RuntimeRegistration {
    return this.#controller.subscribe(observer);
  }

  updateFrame(frame: UpdateFrame): void {
    this.#controller.updateFrame(frame);
  }

  resizeProjection(width: number, height: number): void {
    this.#controller.resizeProjection(width, height);
  }

  updateRuntimeFrame(frame: RuntimeFrame): void {
    this.#controller.updateFrame(frame);
  }

  update(frame: UpdateFrame): Camera3MotionUpdateResult {
    return this.#controller.update(frame);
  }

  dispose(): void {
    if (!this.enabled) return;
    this.enabled = false;
    this.#controller.dispose();
  }
}

export type { Camera3MotionChangedEvent, Camera3MotionObserver };
export type { Camera3ViewState };
