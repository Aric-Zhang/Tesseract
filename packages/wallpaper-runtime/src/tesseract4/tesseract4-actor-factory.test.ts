import { describe, expect, it } from "vitest";
import * as THREE from "three";
import {
  ActorSystem,
  ComponentRegistry,
  CompositeComponentAttachmentRuntime,
  createActorCreationScope,
  type ActorCreationScope
} from "actor-system/core";
import type { RuntimeFrame } from "runtime-core";
import type {
  RuntimeSceneObjectHost,
  Tesseract4RuntimeRenderable
} from "./tesseract4-runtime-renderable";
import {
  ProductionRuntimeSchedulerService,
  RuntimeWorkAttachmentRuntime
} from "wallpaper-runtime";
import { installTesseract4ComponentDefinitions } from "./install-component-definitions";
import { createTesseract4Actor } from "./tesseract4-actor-factory";
import { tesseract4ComponentType } from "./tesseract4-component";

function createContext() {
  const calls: string[] = [];
  const actorSystem = new ActorSystem();
  const runtimeScheduler = new ProductionRuntimeSchedulerService();
  const componentRegistry = new ComponentRegistry({
    actorSystem,
    attachmentRuntime: new CompositeComponentAttachmentRuntime([
      new RuntimeWorkAttachmentRuntime({ actorSystem, scheduler: runtimeScheduler })
    ])
  });
  const context = createActorCreationScope({ actorSystem, componentRegistry }) as ActorCreationScope & {
    updateRuntimeFrame(frame: RuntimeFrame): void;
  };
  context.updateRuntimeFrame = (frame) => runtimeScheduler.updateRuntimeFrame(frame);
  installTesseract4ComponentDefinitions(context.componentRegistry);
  return { calls, context };
}

function createFakeRenderableFactory(calls: string[]) {
  const object = new THREE.LineSegments();
  const createRenderable = (): Tesseract4RuntimeRenderable => ({
    id: "tesseract4",
    worldDescriptor: {
      id: "tesseract4-world",
      kind: "world-4d",
      label: "Tesseract4"
    },
    world: {} as Tesseract4RuntimeRenderable["world"],
    updateRuntimeFrame() {
      calls.push("tesseract-update");
    },
    attachToScene(scene: RuntimeSceneObjectHost) {
      const registration = scene.attachObject(object);
      return {
        dispose() {
          registration.dispose();
          calls.push("tesseract-detach");
        }
      };
    },
    dispose() {
      calls.push("tesseract-dispose");
    }
  }) as unknown as Tesseract4RuntimeRenderable;
  return { createRenderable, object };
}

describe("createTesseract4Actor", () => {
  it("creates an actor and returns a RegisteredActor handle", () => {
    const { calls, context } = createContext();
    const { createRenderable } = createFakeRenderableFactory(calls);

    const handle = createTesseract4Actor(context, { actorId: "tesseract-actor" }, createRenderable);

    expect(handle.actor.id).toBe("tesseract-actor");
    expect(handle.component.type).toBe(tesseract4ComponentType);
    expect(context.actorSystem.getActor("tesseract-actor")).toBe(handle.actor);
  });

  it("parents the actor when parentActor is provided", () => {
    const { calls, context } = createContext();
    const sceneActor = context.actorSystem.createActor({ id: "scene-window" });
    const { createRenderable } = createFakeRenderableFactory(calls);

    const handle = createTesseract4Actor(context, {
      actorId: "tesseract-actor",
      parentActor: sceneActor
    }, createRenderable);

    expect(context.actorSystem.getParent(handle.actor)).toBe(sceneActor);
  });

  it("delegates frame updates to the wrapped runtime object", () => {
    const { calls, context } = createContext();
    const { createRenderable } = createFakeRenderableFactory(calls);
    createTesseract4Actor(context, { actorId: "tesseract-actor" }, createRenderable);
    calls.length = 0;

    context.updateRuntimeFrame({
      timeMs: 1000,
      deltaMs: 16,
      frameIndex: 1
    });

    expect(calls).toEqual(["tesseract-update"]);
  });

  it("adds the object to scene and removes it on dispose", () => {
    const { calls, context } = createContext();
    const { host, renderedScene } = createInspectableSceneHost();
    const { createRenderable, object } = createFakeRenderableFactory(calls);
    const handle = createTesseract4Actor(context, {
      actorId: "tesseract-actor"
    }, createRenderable);
    handle.component.attachToScene(host);

    expect(renderedScene()?.children).toContain(object);
    calls.length = 0;

    handle.dispose();
    handle.dispose();

    expect(renderedScene()?.children).not.toContain(object);
    expect(context.actorSystem.getActor("tesseract-actor")).toBeNull();
    expect(calls).toEqual(["tesseract-detach", "tesseract-dispose"]);
  });

  it("removes the object from scene when the actor is destroyed directly", () => {
    const { calls, context } = createContext();
    const { host, renderedScene } = createInspectableSceneHost();
    const { createRenderable, object } = createFakeRenderableFactory(calls);
    const handle = createTesseract4Actor(context, {
      actorId: "tesseract-actor"
    }, createRenderable);
    handle.component.attachToScene(host);

    expect(renderedScene()?.children).toContain(object);
    calls.length = 0;

    context.actorSystem.destroyActor(handle.actor);

    expect(renderedScene()?.children).not.toContain(object);
    expect(context.actorSystem.getActor("tesseract-actor")).toBeNull();
    expect(calls).toEqual(["tesseract-detach", "tesseract-dispose"]);
  });
});

function createInspectableSceneHost() {
  const scene = new THREE.Scene();
  const host: RuntimeSceneObjectHost = {
    attachObject(object) {
      scene.add(object);
      return {
        dispose() {
          scene.remove(object);
        }
      };
    }
  };
  return {
    host,
    renderedScene: () => scene
  };
}
