import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { AppRuntimeContext } from "../../app-runtime";
import type { GizmoController } from "gizmo-core";
import type { AppStateCommand } from "../../editor/app-state";
import type { AppStateObserver } from "../../editor/app-state-controller";
import type { RuntimeObject, RuntimeRegistration } from "../../runtime/ports";
import type { Tesseract4RuntimeObject } from "../tesseract4-runtime-object";
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
  const runtimeObjects: RuntimeObject[] = [];
  const context = new AppRuntimeContext({
    sceneRuntime: {
      register(object: RuntimeObject): RuntimeRegistration {
        calls.push(`scene-register:${object.id}`);
        runtimeObjects.push(object);
        return createRegistration(`scene-dispose:${object.id}`, calls);
      },
      dispose(): void {
        calls.push("scene-system-dispose");
      }
    },
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
  return { calls, context, runtimeObjects };
}

function createFakeObjectFactory(calls: string[]) {
  const object = new THREE.LineSegments();
  const createObject = (): Tesseract4RuntimeObject => ({
    id: "tesseract4",
    priority: 0,
    enabled: true,
    object,
    updateFrame() {
      calls.push("tesseract-update");
    },
    dispose() {
      calls.push("tesseract-dispose");
    }
  }) as unknown as Tesseract4RuntimeObject;
  return { createObject, object };
}

describe("createTesseract4Actor", () => {
  it("creates an actor and returns a RegisteredActor handle", () => {
    const { calls, context } = createContext();
    const { createObject } = createFakeObjectFactory(calls);

    const handle = createTesseract4Actor(context, { actorId: "tesseract-actor" }, createObject);

    expect(handle.actor.id).toBe("tesseract-actor");
    expect(handle.component.type).toBe(tesseract4ComponentType);
    expect(context.actorSystem.getActor("tesseract-actor")).toBe(handle.actor);
  });

  it("parents the actor when parentActor is provided", () => {
    const { calls, context } = createContext();
    const sceneActor = context.actorSystem.createActor({ id: "scene-window" });
    const { createObject } = createFakeObjectFactory(calls);

    const handle = createTesseract4Actor(context, {
      actorId: "tesseract-actor",
      parentActor: sceneActor
    }, createObject);

    expect(context.actorSystem.getParent(handle.actor)).toBe(sceneActor);
  });

  it("delegates frame updates to the wrapped runtime object", () => {
    const { calls, context } = createContext();
    const { createObject } = createFakeObjectFactory(calls);
    createTesseract4Actor(context, { actorId: "tesseract-actor" }, createObject);
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
    const scene = new THREE.Scene();
    const { createObject, object } = createFakeObjectFactory(calls);
    const handle = createTesseract4Actor(context, {
      actorId: "tesseract-actor",
      scene
    }, createObject);

    expect(scene.children).toContain(object);
    calls.length = 0;

    handle.dispose();
    handle.dispose();

    expect(scene.children).not.toContain(object);
    expect(context.actorSystem.getActor("tesseract-actor")).toBeNull();
    expect(calls).toEqual(["tesseract-dispose"]);
  });

  it("removes the object from scene when the actor is destroyed directly", () => {
    const { calls, context } = createContext();
    const scene = new THREE.Scene();
    const { createObject, object } = createFakeObjectFactory(calls);
    const handle = createTesseract4Actor(context, {
      actorId: "tesseract-actor",
      scene
    }, createObject);

    expect(scene.children).toContain(object);
    calls.length = 0;

    context.actorSystem.destroyActor(handle.actor);

    expect(scene.children).not.toContain(object);
    expect(context.actorSystem.getActor("tesseract-actor")).toBeNull();
    expect(calls).toEqual(["tesseract-dispose"]);
  });
});
