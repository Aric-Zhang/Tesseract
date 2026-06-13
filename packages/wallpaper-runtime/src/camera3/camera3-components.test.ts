import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { ActorSystem, ComponentRegistry, installComponentDefinition } from "actor-core";
import {
  ProductionRuntimeSchedulerService,
  RuntimeWorkAttachmentRuntime
} from "wallpaper-runtime";
import {
  Camera3MotionComponent,
  camera3MotionComponentType
} from "./camera3-motion-component";
import { camera3MotionComponentDefinition } from "./camera3-motion-definition";

const frame = { timeMs: 16, deltaMs: 16, frameIndex: 1 };
const orbitSensitivity = 0.008;

function createSubject() {
  const actorSystem = new ActorSystem();
  const scheduler = new ProductionRuntimeSchedulerService();
  const updateRuntime = new RuntimeWorkAttachmentRuntime({ actorSystem, scheduler });
  const registry = new ComponentRegistry({
    actorSystem,
    attachmentRuntime: updateRuntime
  });
  installComponentDefinition(registry, camera3MotionComponentDefinition);
  const actor = actorSystem.createActor({ id: "scene-view" });
  const motion = registry.addComponent(actor, camera3MotionComponentType);
  return { actor, actorSystem, motion, registry, scheduler };
}

describe("Camera3 feature components", () => {
  it("creates motion as the camera runtime owner", () => {
    const { actor, motion } = createSubject();

    expect(motion).toBeInstanceOf(Camera3MotionComponent);
    expect(motion.actor).toBe(actor);
  });

  it("applies camera motion commands through component-owned runtime state", () => {
    const { motion } = createSubject();

    motion.submit({ type: "orbit-delta", source: "camera3-gizmo", dx: 10, dy: 5 });
    const result = motion.update(frame);

    expect(result).toEqual({ changed: true, commandCount: 1 });
    expect(motion.readViewState().cameraState.orbit?.yaw).toBeCloseTo(-10 * orbitSensitivity);
    expect(motion.readViewState().cameraState.orbit?.pitch).toBeCloseTo(5 * orbitSensitivity);
  });

  it("updates motion components through the actor system frame pass", () => {
    const { motion, scheduler } = createSubject();

    motion.submit({ type: "orbit-delta", source: "camera3-gizmo", dx: 8, dy: 4 });
    scheduler.updateRuntimeFrame(frame);

    expect(motion.readViewState().cameraState.orbit?.yaw).toBeCloseTo(-8 * orbitSensitivity);
    expect(motion.readViewState().cameraState.orbit?.pitch).toBeCloseTo(4 * orbitSensitivity);
  });

  it("updates active projection camera and projection size through components", () => {
    const { motion } = createSubject();

    motion.resizeProjection(640, 320);
    motion.submit({ type: "toggle-projection", source: "camera3-gizmo" });
    motion.update(frame);

    expect(motion.readViewState().cameraState.projection?.viewport).toEqual({ width: 640, height: 320 });
    expect(motion.readViewState().projectionMode).toBe("orthographic");
    expect(motion.getRuntimeThreeCameraForRender()).toBeInstanceOf(THREE.OrthographicCamera);
  });

  it("exposes renderer-agnostic runtime camera state as the Camera3 view state", () => {
    const { motion } = createSubject();

    motion.submit({ type: "orbit-delta", source: "camera3-gizmo", dx: 12, dy: 6 });
    motion.update(frame);
    const viewState = motion.readViewState();

    expect(viewState.cameraState.orbit?.yaw).toBeCloseTo(-12 * orbitSensitivity);
    expect(viewState.cameraState.orbit?.pitch).toBeCloseTo(6 * orbitSensitivity);
    expect(viewState.projectionMode).toBe("perspective");

    motion.submit({ type: "toggle-projection", source: "camera3-gizmo" });
    motion.update({ ...frame, frameIndex: 2 });

    expect(motion.readViewState().projectionMode).toBe("orthographic");
    expect(motion.readViewState().cameraState.projection?.mode).toBe("orthographic");
  });

  it("disposes motion idempotently", () => {
    const { motion } = createSubject();

    motion.dispose();
    motion.dispose();

    expect(motion.enabled).toBe(false);
  });
});
