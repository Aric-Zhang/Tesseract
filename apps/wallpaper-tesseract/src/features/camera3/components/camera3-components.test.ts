import { describe, expect, it } from "vitest";
import { ActorSystem } from "../../../actor-runtime";
import { createTestComponentRegistry } from "../../../test-support";
import {
  Camera3MotionComponent,
  camera3MotionComponentType
} from "./camera3-motion-component";
import {
  Camera3RigComponent,
  camera3RigComponentType
} from "./camera3-rig-component";
import { installCamera3FeatureComponentDefinitions } from "./install-component-definitions";

const frame = { timeMs: 16, deltaMs: 16, frameIndex: 1 };

function createSubject() {
  const actorSystem = new ActorSystem();
  const { registry } = createTestComponentRegistry({ actorSystem });
  installCamera3FeatureComponentDefinitions(registry);
  const actor = actorSystem.createActor({ id: "scene-view" });
  const motion = registry.addComponent(actor, camera3MotionComponentType);
  const rig = registry.getComponent(actor, camera3RigComponentType);
  if (!rig) throw new Error("Expected Camera3RigComponent.");
  return { actor, actorSystem, motion, registry, rig };
}

describe("Camera3 feature components", () => {
  it("auto-adds the rig component before creating motion", () => {
    const { actor, motion, rig } = createSubject();

    expect(motion).toBeInstanceOf(Camera3MotionComponent);
    expect(rig).toBeInstanceOf(Camera3RigComponent);
    expect(motion.actor).toBe(actor);
    expect(rig.actor).toBe(actor);
  });

  it("applies camera motion commands through component-owned rig state", () => {
    const { motion, rig } = createSubject();

    motion.submit({ type: "orbit-delta", source: "camera3-gizmo", dx: 10, dy: 5 });
    const result = motion.update(frame);

    expect(result).toEqual({ changed: true, commandCount: 1 });
    expect(rig.rig.yaw).toBeCloseTo(-10 * rig.rig.orbitSensitivity);
    expect(rig.rig.pitch).toBeCloseTo(5 * rig.rig.orbitSensitivity);
  });

  it("updates motion components through the actor system frame pass", () => {
    const { actorSystem, motion, rig } = createSubject();

    motion.submit({ type: "orbit-delta", source: "camera3-gizmo", dx: 8, dy: 4 });
    actorSystem.updateFrame(frame);

    expect(rig.rig.yaw).toBeCloseTo(-8 * rig.rig.orbitSensitivity);
    expect(rig.rig.pitch).toBeCloseTo(4 * rig.rig.orbitSensitivity);
  });

  it("updates active projection camera and projection size through components", () => {
    const { motion, rig } = createSubject();

    rig.resizeProjection(640, 320, motion.distance);
    motion.submit({ type: "toggle-projection", source: "camera3-gizmo" });
    motion.update(frame);

    expect(rig.projectionMode.perspectiveCamera.aspect).toBe(2);
    expect(rig.projectionMode.mode).toBe("orthographic");
    expect(motion.activeCamera).toBe(rig.projectionMode.orthographicCamera);
  });

  it("disposes motion idempotently", () => {
    const { motion } = createSubject();

    motion.dispose();
    motion.dispose();

    expect(motion.enabled).toBe(false);
  });
});
