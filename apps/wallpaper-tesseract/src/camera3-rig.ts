import * as THREE from "three";

export type Camera3Axis = "+x" | "-x" | "+y" | "-y" | "+z" | "-z";

export interface Camera3RigOptions {
  target?: THREE.Vector3;
  distance?: number;
  yaw?: number;
  pitch?: number;
  locked?: boolean;
}

export class Camera3Rig {
  readonly target: THREE.Vector3;
  distance: number;
  yaw: number;
  pitch: number;
  roll = 0;
  mode: "perspective" | "orthographic" = "perspective";
  locked: boolean;
  minPitch = -Math.PI * 0.49;
  maxPitch = Math.PI * 0.49;
  orbitSensitivity = 0.008;
  private readonly direction = new THREE.Vector3();

  constructor(options: Camera3RigOptions = {}) {
    this.target = options.target?.clone() ?? new THREE.Vector3(0, 0, 0);
    this.distance = options.distance ?? 6;
    this.yaw = options.yaw ?? 0;
    this.pitch = options.pitch ?? 0;
    this.locked = options.locked ?? false;
  }

  updateCamera(camera: THREE.PerspectiveCamera | THREE.OrthographicCamera): void {
    this.getDirection(this.direction);
    camera.position.copy(this.target).addScaledVector(this.direction, this.distance);
    chooseStableUp(this.direction, camera.up);
    camera.lookAt(this.target);
    camera.updateMatrixWorld();
  }

  orbit(deltaX: number, deltaY: number): void {
    if (this.locked) return;
    this.yaw -= deltaX * this.orbitSensitivity;
    this.pitch += deltaY * this.orbitSensitivity;
    this.pitch = clamp(this.pitch, this.minPitch, this.maxPitch);
  }

  snapToAxis(axis: Camera3Axis): void {
    if (this.locked) return;
    switch (axis) {
      case "+x":
        this.setDirection(1, 0, 0);
        return;
      case "-x":
        this.setDirection(-1, 0, 0);
        return;
      case "+y":
        this.setDirection(0, 1, 0);
        return;
      case "-y":
        this.setDirection(0, -1, 0);
        return;
      case "+z":
        this.setDirection(0, 0, 1);
        return;
      case "-z":
        this.setDirection(0, 0, -1);
        return;
    }
  }

  getDirection(out: THREE.Vector3): THREE.Vector3 {
    const cosPitch = Math.cos(this.pitch);
    out.set(
      Math.sin(this.yaw) * cosPitch,
      Math.sin(this.pitch),
      Math.cos(this.yaw) * cosPitch
    );
    return out.normalize();
  }

  private setDirection(x: number, y: number, z: number): void {
    this.direction.set(x, y, z).normalize();
    this.yaw = Math.atan2(this.direction.x, this.direction.z);
    this.pitch = Math.asin(clamp(this.direction.y, -1, 1));
  }
}

function chooseStableUp(directionFromTarget: THREE.Vector3, out: THREE.Vector3): void {
  if (Math.abs(directionFromTarget.y) > 0.98) {
    out.set(0, 0, directionFromTarget.y > 0 ? -1 : 1);
    return;
  }
  out.set(0, 1, 0);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
