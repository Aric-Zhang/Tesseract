import { describe, expect, it } from "vitest";
import {
  ActorSystem,
  ComponentRegistry,
  CompositeComponentAttachmentRuntime,
  createActorCreationScope,
  installComponentDefinition
} from "actor-core";
import type { RuntimeThreeSceneRenderer } from "runtime-three";
import { RuntimeWorkAttachmentRuntime } from "./runtime-work-attachment-runtime";
import { ProductionRuntimeSchedulerService } from "./runtime-scheduler-service";
import { camera3MotionComponentDefinition } from "./camera3/camera3-motion-definition";
import { createRuntimeSceneTesseract4ActorId } from "./runtime-scene-content";
import { RuntimeSceneViewRuntimeRegistry } from "./runtime-scene-view-runtime";
import { installTesseract4ComponentDefinitions } from "./tesseract4";

describe("RuntimeSceneViewRuntimeRegistry", () => {
  it("removes stale frame sources when a scene view runtime is disposed", () => {
    const calls: string[] = [];
    const { actorSystem, context } = createContext();
    const registry = new RuntimeSceneViewRuntimeRegistry();
    const firstSceneActor = actorSystem.createActor({ id: "scene-window:view" });
    const firstRuntime = registry.createRuntime({
      id: "scene-a",
      createRenderer: () => createRenderer(calls, "a")
    });

    firstRuntime.attachSceneView({
      context,
      sceneActor: firstSceneActor,
      presentation: createPresentation("scene-window:view", calls)
    });
    registry.renderCurrentFrameSource();
    expect(calls).toContain("render:a");
    expect(actorSystem.getActor(createRuntimeSceneTesseract4ActorId(firstSceneActor.id))).not.toBeNull();

    calls.length = 0;
    firstRuntime.dispose();
    actorSystem.destroyActor(firstSceneActor);
    registry.renderCurrentFrameSource();
    expect(calls).toEqual(["dispose:a"]);
    expect(actorSystem.getActor(createRuntimeSceneTesseract4ActorId(firstSceneActor.id))).toBeNull();

    const secondSceneActor = actorSystem.createActor({ id: "scene-window:view" });
    const secondRuntime = registry.createRuntime({
      id: "scene-b",
      createRenderer: () => createRenderer(calls, "b")
    });
    secondRuntime.attachSceneView({
      context,
      sceneActor: secondSceneActor,
      presentation: createPresentation("scene-window:view", calls)
    });

    calls.length = 0;
    registry.measureCurrentView();
    registry.renderCurrentFrameSource();

    expect(calls).toEqual(["measure:scene-window:view", "render:b"]);
  });
});

function createContext() {
  const actorSystem = new ActorSystem();
  const runtimeScheduler = new ProductionRuntimeSchedulerService();
  const componentRegistry = new ComponentRegistry({
    actorSystem,
    attachmentRuntime: new CompositeComponentAttachmentRuntime([
      new RuntimeWorkAttachmentRuntime({ actorSystem, scheduler: runtimeScheduler })
    ])
  });
  installComponentDefinition(componentRegistry, camera3MotionComponentDefinition);
  installTesseract4ComponentDefinitions(componentRegistry);
  return {
    actorSystem,
    context: createActorCreationScope({ actorSystem, componentRegistry })
  };
}

function createPresentation(viewActorId: string, calls: string[]) {
  return {
    viewActorId,
    measureNow() {
      calls.push(`measure:${viewActorId}`);
    },
    isVisibleInCurrentLocation() {
      return true;
    }
  };
}

function createRenderer(calls: string[], id: string): RuntimeThreeSceneRenderer {
  return {
    domElement: {} as HTMLElement,
    setClearColor() {},
    setPixelRatio() {},
    setSize() {},
    render() {
      calls.push(`render:${id}`);
    },
    dispose() {
      calls.push(`dispose:${id}`);
    }
  };
}
