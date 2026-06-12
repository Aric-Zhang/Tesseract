import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { AppRuntimeContext } from "../../app-runtime";
import type { GizmoController } from "gizmo-core";
import type { AppStateCommand } from "editor";
import type { AppStateObserver } from "editor";
import type { RuntimeRegistration } from "../../runtime/ports";
import { createRuntimeSceneRenderOutput, type RuntimeSceneRenderOutput } from "../../runtime/scene-render-output";
import type { Tesseract4RuntimeRenderable } from "../tesseract4-runtime-renderable";
import { installTesseract4ComponentDefinitions } from "./install-component-definitions";
import { createTesseract4Actor } from "./tesseract4-actor-factory";
import { tesseract4ComponentType } from "./tesseract4-component";

function createRegistration(label: string, calls: string[]): RuntimeRegistration {
  return {
    dispose() {
      calls.push(label);
    }
  };
}

function createContext() {
  const calls: string[] = [];
  const context = new AppRuntimeContext({
    gizmoEventSystem: {
      register(_object: GizmoController): RuntimeRegistration {
        calls.push("gizmo-register");
        return createRegistration("gizmo-dispose", calls);
      },
      dispose(): void {
        calls.push("gizmo-system-dispose");
      }
    },
    frameStateController: {
      submit(_command: AppStateCommand): void {
        calls.push("frame-submit");
      },
      subscribe(_observer: AppStateObserver): RuntimeRegistration {
        calls.push("observer-subscribe");
        return createRegistration("observer-dispose", calls);
      },
      dispose(): void {
        calls.push("frame-system-dispose");
      }
    }
  });
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
    attachToOutput(output: RuntimeSceneRenderOutput) {
      const registration = output.attachObject(object);
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
    const { output, renderedScene } = createInspectableOutput();
    const { createRenderable, object } = createFakeRenderableFactory(calls);
    const handle = createTesseract4Actor(context, {
      actorId: "tesseract-actor"
    }, createRenderable);
    handle.component.attachToOutput(output);

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
    const { output, renderedScene } = createInspectableOutput();
    const { createRenderable, object } = createFakeRenderableFactory(calls);
    const handle = createTesseract4Actor(context, {
      actorId: "tesseract-actor"
    }, createRenderable);
    handle.component.attachToOutput(output);

    expect(renderedScene()?.children).toContain(object);
    calls.length = 0;

    context.actorSystem.destroyActor(handle.actor);

    expect(renderedScene()?.children).not.toContain(object);
    expect(context.actorSystem.getActor("tesseract-actor")).toBeNull();
    expect(calls).toEqual(["tesseract-detach", "tesseract-dispose"]);
  });
});

function createInspectableOutput() {
  const renderer = createFakeRenderer();
  const output = createRuntimeSceneRenderOutput({
    createRenderer: () => renderer
  });
  return {
    output,
    renderedScene() {
      output.render(new THREE.PerspectiveCamera());
      return renderer.lastScene;
    }
  };
}

function createFakeRenderer() {
  let lastScene: THREE.Scene | null = null;
  return {
    domElement: {} as HTMLElement,
    setClearColor() {},
    setPixelRatio() {},
    setSize() {},
    render(scene: THREE.Scene) {
      lastScene = scene;
    },
    dispose() {},
    get lastScene() {
      return lastScene;
    }
  };
}
