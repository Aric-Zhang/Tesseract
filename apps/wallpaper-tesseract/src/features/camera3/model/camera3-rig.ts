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
  locked: boolean;
  orbitSensitivity = 0.008;
  private readonly direction = new THREE.Vector3();
  private readonly cameraRight = new THREE.Vector3();
  private readonly cameraUp = new THREE.Vector3();

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
    this.getStableScreenBasis(this.direction, this.cameraRight, this.cameraUp);
    camera.up.copy(this.cameraUp);
    camera.lookAt(this.target);
    camera.updateMatrixWorld();
  }

  orbit(deltaX: number, deltaY: number): void {
    if (this.locked) return;
    this.yaw -= deltaX * this.orbitSensitivity;
    this.pitch += deltaY * this.orbitSensitivity;
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
    const horizontalLength = Math.hypot(this.direction.x, this.direction.z);
    if (horizontalLength > 1e-6) {
      this.yaw = Math.atan2(this.direction.x, this.direction.z);
    }
    this.pitch = Math.asin(clamp(this.direction.y, -1, 1));
  }

  private getStableScreenBasis(directionFromTarget: THREE.Vector3, outRight: THREE.Vector3, outUp: THREE.Vector3): void {
    outRight.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw)).normalize();
    outUp.crossVectors(directionFromTarget, outRight).normalize();
    if (outUp.lengthSq() < 1e-12) {
      outRight.set(1, 0, 0);
      outUp.crossVectors(directionFromTarget, outRight).normalize();
    }
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
