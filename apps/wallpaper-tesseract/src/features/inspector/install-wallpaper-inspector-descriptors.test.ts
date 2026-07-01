import { describe, expect, it } from "vitest";
import { ActorSystem } from "actor-system/core";
import { createInspectorComponentDescriptorRegistry } from "editor";
import { runtimeCameraProjectionFovConstraints } from "runtime-core";
import { Camera3MotionComponent, camera3MotionComponentType } from "wallpaper-runtime";
import { installWallpaperInspectorDescriptors } from "./install-wallpaper-inspector-descriptors";

describe("installWallpaperInspectorDescriptors", () => {
  it("exposes Camera3 FOV as an editable number using runtime-owned constraints", () => {
    const registry = createInspectorComponentDescriptorRegistry();
    installWallpaperInspectorDescriptors(registry);
    const descriptor = registry.get(camera3MotionComponentType)!;
    const motion = createCamera3MotionComponent();

    const fov = descriptor.readProperties?.(motion, {
      actorId: "camera",
      componentId: motion.id,
      componentType: motion.type
    }).find((property) => property.id === "fov");

    expect(fov?.edit).toEqual({
      control: "number",
      value: 45,
      min: runtimeCameraProjectionFovConstraints.min,
      max: runtimeCameraProjectionFovConstraints.max,
      step: runtimeCameraProjectionFovConstraints.step,
      disabled: undefined
    });
  });

  it("applies valid FOV edits through Camera3 runtime commands and rejects invalid values", () => {
    const registry = createInspectorComponentDescriptorRegistry();
    installWallpaperInspectorDescriptors(registry);
    const descriptor = registry.get(camera3MotionComponentType)!;
    const motion = createCamera3MotionComponent();

    const accepted = descriptor.applyEdit?.(motion, {
      actorId: "camera",
      componentId: motion.id,
      componentType: motion.type,
      propertyId: "fov",
      value: 72,
      timeStamp: 1,
      source: "test"
    }, {
      actorId: "camera",
      componentId: motion.id,
      componentType: motion.type
    });
    motion.update({ timeMs: 16, deltaMs: 16, frameIndex: 1 });

    expect(accepted).toEqual({ accepted: true });
    expect(motion.readViewState().cameraState.projection?.fov).toBe(72);

    const rejected = descriptor.applyEdit?.(motion, {
      actorId: "camera",
      componentId: motion.id,
      componentType: motion.type,
      propertyId: "fov",
      value: runtimeCameraProjectionFovConstraints.max + 1,
      timeStamp: 2,
      source: "test"
    }, {
      actorId: "camera",
      componentId: motion.id,
      componentType: motion.type
    });
    motion.update({ timeMs: 32, deltaMs: 16, frameIndex: 2 });

    expect(rejected?.accepted).toBe(false);
    if (rejected?.accepted === false) {
      expect(rejected.reason).toContain(
        `between ${runtimeCameraProjectionFovConstraints.min} and ${runtimeCameraProjectionFovConstraints.max}`
      );
    }
    expect(motion.readViewState().cameraState.projection?.fov).toBe(72);
  });
});

function createCamera3MotionComponent(): Camera3MotionComponent {
  const actor = new ActorSystem().createActor({ id: "camera" });
  return new Camera3MotionComponent(actor);
}
