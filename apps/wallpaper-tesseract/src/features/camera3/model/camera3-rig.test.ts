import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { Camera3Rig } from "./camera3-rig";

describe("Camera3Rig stable orbit basis", () => {
  it("preserves yaw when snapping to the vertical view direction", () => {
    const rig = new Camera3Rig({ yaw: 1.25, pitch: 0.4 });

    rig.snapToAxis("+y");

    expect(rig.yaw).toBeCloseTo(1.25);
    expect(rig.pitch).toBeCloseTo(Math.PI * 0.5);
  });

  it("uses horizontal drag at the vertical view as a roll-like scene rotation", () => {
    const rig = new Camera3Rig({ yaw: 0.75 });
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    rig.snapToAxis("+y");
    rig.updateCamera(camera);
    const beforePosition = camera.position.clone();
    const beforeQuaternion = camera.quaternion.clone();

    rig.orbit(32, 0);
    rig.updateCamera(camera);

    expect(camera.position.distanceTo(beforePosition)).toBeLessThan(1e-6);
    expect(Math.abs(camera.quaternion.dot(beforeQuaternion))).toBeLessThan(0.99999);
    expect(Number.isFinite(camera.quaternion.x)).toBe(true);
    expect(Number.isFinite(camera.quaternion.y)).toBe(true);
    expect(Number.isFinite(camera.quaternion.z)).toBe(true);
    expect(Number.isFinite(camera.quaternion.w)).toBe(true);
  });

  it("does not hard-switch camera.up near the top-view threshold", () => {
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    const rig = new Camera3Rig({ yaw: 0, pitch: Math.asin(0.979) });
    rig.updateCamera(camera);
    const upBefore = camera.up.clone();

    rig.pitch = Math.asin(0.981);
    rig.updateCamera(camera);

    expect(upBefore.dot(camera.up)).toBeGreaterThan(0.999);
  });

  it("allows vertical orbit to pass beyond the former top pitch clamp", () => {
    const rig = new Camera3Rig({ pitch: 0 });
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);

    rig.orbit(0, 260);
    rig.updateCamera(camera);

    expect(rig.pitch).toBeGreaterThan(Math.PI * 0.5);
    expect(Number.isFinite(camera.position.x)).toBe(true);
    expect(Number.isFinite(camera.position.y)).toBe(true);
    expect(Number.isFinite(camera.position.z)).toBe(true);
    expect(Number.isFinite(camera.quaternion.x)).toBe(true);
    expect(Number.isFinite(camera.quaternion.y)).toBe(true);
    expect(Number.isFinite(camera.quaternion.z)).toBe(true);
    expect(Number.isFinite(camera.quaternion.w)).toBe(true);
  });

  it("can orbit to an upside-down bottom view without clamping the y axis", () => {
    const rig = new Camera3Rig({ pitch: 0 });
    const direction = new THREE.Vector3();

    rig.orbit(0, (Math.PI * 1.5) / rig.orbitSensitivity);
    rig.getDirection(direction);

    expect(direction.y).toBeCloseTo(-1);
    expect(rig.pitch).toBeCloseTo(Math.PI * 1.5);
  });
});
