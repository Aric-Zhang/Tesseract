import { describe, expect, it } from "vitest";
import type { GizmoController, GizmoHit, ScreenPoint } from "gizmo-core";
import type { RuntimeObject, RuntimeRegistration, SceneStateObserver, SceneUpdateCommand } from "../scene-runtime";
import { AppRuntimeContext, createRegisteredObject } from "./app-runtime-context";
import { componentType, createRegisteredActor, type Component } from "../actor-runtime";

type TestObject = RuntimeObject & GizmoController & SceneStateObserver;
interface TestActorComponent extends Component {}
type FailurePoint = "scene" | "gizmo" | "observer";
type DisposeFailurePoint = "scene-dispose" | "gizmo-dispose" | "observer-dispose";

const testActorComponentType = componentType<TestActorComponent>("test-actor-component");

function createTestObject(id = "test-object"): TestObject {
  return {
    id,
    priority: 0,
    hitTest(_point: ScreenPoint): GizmoHit | null {
      return null;
    },
    onSceneStateChanged() {
      // Test observer.
    }
  };
}

function createRegistration(label: string, calls: string[], failDispose?: DisposeFailurePoint): RuntimeRegistration {
  return {
    dispose() {
      calls.push(label);
      if (failDispose === label) {
        throw new Error(`${label} failed`);
      }
    }
  };
}

function createSystems(options: {
  failAt?: FailurePoint;
  failDisposeAt?: DisposeFailurePoint;
  rollbackErrors?: unknown[][];
} = {}) {
  const calls: string[] = [];
  const sceneRuntime = {
    register(object: RuntimeObject): RuntimeRegistration {
      calls.push(`scene-register:${object.id}`);
      if (options.failAt === "scene" && object.id !== "actor-system") throw new Error("scene failed");
      return createRegistration("scene-dispose", calls, options.failDisposeAt);
    },
    dispose() {
      calls.push("scene-runtime-dispose");
    }
  };
  const gizmoEventSystem = {
    register(object: GizmoController): RuntimeRegistration {
      calls.push(`gizmo-register:${object.id}`);
      if (options.failAt === "gizmo") throw new Error("gizmo failed");
      return createRegistration("gizmo-dispose", calls, options.failDisposeAt);
    },
    dispose() {
      calls.push("gizmo-system-dispose");
    }
  };
  const frameStateController = {
    submit(_command: SceneUpdateCommand): void {
      calls.push("frame-submit");
    },
    subscribe(observer: SceneStateObserver): RuntimeRegistration {
      calls.push(`observer-subscribe:${(observer as unknown as RuntimeObject).id}`);
      if (options.failAt === "observer") throw new Error("observer failed");
      return createRegistration("observer-dispose", calls, options.failDisposeAt);
    },
    dispose() {
      calls.push("frame-system-dispose");
    }
  };
  const context = new AppRuntimeContext({
    sceneRuntime,
    gizmoEventSystem,
    frameStateController,
    onRollbackError: (errors) => options.rollbackErrors?.push([...errors])
  });
  calls.length = 0;
  return { calls, context };
}

function registerActorComponentDefinition(context: AppRuntimeContext, calls: string[]): void {
  context.componentRegistry.registerDefinition({
    type: testActorComponentType,
    singleton: true,
    createId() {
      return "test-actor-component";
    },
    create(actor) {
      return {
        id: "test-actor-component",
        type: testActorComponentType,
        actor,
        enabled: true,
        dispose() {
          calls.push("actor-component-dispose");
        }
      };
    }
  });
}

describe("AppRuntimeContext", () => {
  it("registers stateful gizmo objects across all required systems", () => {
    const { calls, context } = createSystems();
    const object = createTestObject();

    context.registerLegacyStatefulGizmoObject(object);

    expect(calls).toEqual([
      "scene-register:test-object",
      "gizmo-register:test-object",
      "observer-subscribe:test-object"
    ]);
  });

  it("rejects duplicate object registration before touching lower-level systems", () => {
    const { calls, context } = createSystems();
    const object = createTestObject();
    context.registerLegacyRuntimeObject(object);
    calls.length = 0;

    expect(() => context.registerLegacyRuntimeObject(object)).toThrow(/already registered/);
    expect(calls).toEqual([]);
  });

  it("rejects duplicate ids before touching lower-level systems", () => {
    const { calls, context } = createSystems();
    context.registerLegacyRuntimeObject(createTestObject("same-id"));
    calls.length = 0;

    expect(() => context.registerLegacyRuntimeObject(createTestObject("same-id"))).toThrow(/id is already registered/);
    expect(calls).toEqual([]);
  });

  it("does not continue registration when scene runtime registration fails", () => {
    const { calls, context } = createSystems({ failAt: "scene" });

    expect(() => context.registerLegacyStatefulGizmoObject(createTestObject())).toThrow("scene failed");
    expect(calls).toEqual(["scene-register:test-object"]);
  });

  it("rolls back scene registration when gizmo registration fails", () => {
    const { calls, context } = createSystems({ failAt: "gizmo" });

    expect(() => context.registerLegacyStatefulGizmoObject(createTestObject())).toThrow("gizmo failed");
    expect(calls).toEqual([
      "scene-register:test-object",
      "gizmo-register:test-object",
      "scene-dispose"
    ]);
  });

  it("rolls back in reverse order when observer registration fails", () => {
    const { calls, context } = createSystems({ failAt: "observer" });

    expect(() => context.registerLegacyStatefulGizmoObject(createTestObject())).toThrow("observer failed");
    expect(calls).toEqual([
      "scene-register:test-object",
      "gizmo-register:test-object",
      "observer-subscribe:test-object",
      "gizmo-dispose",
      "scene-dispose"
    ]);
  });

  it("continues rollback when one dispose throws", () => {
    const rollbackErrors: unknown[][] = [];
    const { calls, context } = createSystems({
      failAt: "observer",
      failDisposeAt: "gizmo-dispose",
      rollbackErrors
    });

    expect(() => context.registerLegacyStatefulGizmoObject(createTestObject())).toThrow("observer failed");
    expect(calls).toEqual([
      "scene-register:test-object",
      "gizmo-register:test-object",
      "observer-subscribe:test-object",
      "gizmo-dispose",
      "scene-dispose"
    ]);
    expect(rollbackErrors).toHaveLength(1);
    expect(rollbackErrors[0]).toHaveLength(1);
  });

  it("unmarks objects when a registration is disposed", () => {
    const { context } = createSystems();
    const object = createTestObject();
    const registration = context.registerLegacyRuntimeObject(object);

    registration.dispose();

    expect(() => context.registerLegacyRuntimeObject(object)).not.toThrow();
  });

  it("creates idempotent registered object handles", () => {
    const calls: string[] = [];
    const object = {
      dispose() {
        calls.push("object-dispose");
      }
    };
    const handle = createRegisteredObject(object, {
      dispose() {
        calls.push("registration-dispose");
      }
    });

    handle.dispose();
    handle.dispose();

    expect(calls).toEqual(["registration-dispose", "object-dispose"]);
  });

  it("creates idempotent registered actor handles that destroy their actor", () => {
    const { calls, context } = createSystems();
    registerActorComponentDefinition(context, calls);
    const actor = context.actorSystem.createActor({ id: "actor" });
    const component = context.componentRegistry.addComponent(actor, testActorComponentType);
    const handle = createRegisteredActor({
      actorSystem: context.actorSystem,
      actor,
      component
    });

    handle.dispose();
    handle.dispose();

    expect(context.actorSystem.getActor("actor")).toBeNull();
    expect(calls).toEqual(["actor-component-dispose"]);
  });

  it("disposes tracked objects before runtime systems", () => {
    const { calls, context } = createSystems();
    const handle = {
      object: { id: "tracked" },
      dispose() {
        calls.push("tracked-object-dispose");
      }
    };
    context.trackRegisteredObject(handle);

    context.dispose();
    context.dispose();

    expect(calls).toEqual([
      "tracked-object-dispose",
      "scene-dispose",
      "gizmo-system-dispose",
      "frame-system-dispose",
      "scene-runtime-dispose"
    ]);
  });

  it("disposes tracked actor handles before runtime systems", () => {
    const { calls, context } = createSystems();
    registerActorComponentDefinition(context, calls);
    const actor = context.actorSystem.createActor({ id: "actor" });
    const component = context.componentRegistry.addComponent(actor, testActorComponentType);
    const handle = createRegisteredActor({
      actorSystem: context.actorSystem,
      actor,
      component
    });
    context.trackRegisteredActor(handle);

    context.dispose();

    expect(calls).toEqual([
      "actor-component-dispose",
      "scene-dispose",
      "gizmo-system-dispose",
      "frame-system-dispose",
      "scene-runtime-dispose"
    ]);
  });

  it("safely handles actor handle dispose before context dispose", () => {
    const { calls, context } = createSystems();
    registerActorComponentDefinition(context, calls);
    const actor = context.actorSystem.createActor({ id: "actor" });
    const component = context.componentRegistry.addComponent(actor, testActorComponentType);
    const handle = createRegisteredActor({
      actorSystem: context.actorSystem,
      actor,
      component
    });
    context.trackRegisteredActor(handle);

    handle.dispose();
    context.dispose();

    expect(calls).toEqual([
      "actor-component-dispose",
      "scene-dispose",
      "gizmo-system-dispose",
      "frame-system-dispose",
      "scene-runtime-dispose"
    ]);
  });
});
