import * as THREE from "three";
import type { Actor, Component, ComponentType } from "../../../actor-runtime";
import {
  Camera3ProjectionModeController,
  Camera3Rig
} from "../model";

export const camera3RigComponentType =
  "camera3-rig-component" as ComponentType<Camera3RigComponent>;

export interface Camera3RigComponentOptions {
  readonly id?: string;
  readonly target?: THREE.Vector3;
  readonly distance?: number;
}

export class Camera3RigComponent implements Component {
  readonly type = camera3RigComponentType;
  readonly actor: Actor;
  readonly id: string;
  enabled = true;
  readonly projectionMode: Camera3ProjectionModeController;
  readonly rig: Camera3Rig;

  constructor(actor: Actor, options: Camera3RigComponentOptions = {}) {
    this.actor = actor;
    this.id = options.id ?? "camera3-rig";
    this.projectionMode = new Camera3ProjectionModeController();
    this.rig = new Camera3Rig({
      target: options.target?.clone() ?? new THREE.Vector3(0, 0, 0),
      distance: options.distance ?? 6
    });
  }

  resizeProjection(width: number, height: number, distance = this.rig.distance): void {
    this.projectionMode.resize(width, height, distance);
  }

  dispose(): void {
    this.enabled = false;
  }
}
