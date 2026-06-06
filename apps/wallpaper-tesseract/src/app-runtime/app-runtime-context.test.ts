import { describe, expect, it } from "vitest";
import type { GizmoController } from "gizmo-core";
import type { RuntimeObject, RuntimeRegistration, SceneStateObserver, SceneUpdateCommand } from "../scene-runtime";
import { AppRuntimeContext, createRegisteredObject } from "./app-runtime-context";
import {
  componentType,
  createRegisteredActor,
  type ActorWindowFocusService,
  type Component
} from "../actor-runtime";

type TestObject = RuntimeObject;
interface TestActorComponent extends Component {}
type FailurePoint = "scene";
type DisposeFailurePoint = "scene-dispose";

const testActorComponentType = componentType<TestActorComponent>("test-actor-component");

function createTestObject(id = "test-object"): TestObject {
  return {
    id
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
  actorWindowFocus?: ActorWindowFocusService;
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
    actorWindowFocus: options.actorWindowFocus,
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
  it("registers runtime services with the scene runtime only", () => {
    const { calls, context } = createSystems();
    const object = createTestObject();

    context.registerRuntimeService(object);

    expect(calls).toEqual([
      "scene-register:test-object"
    ]);
  });

  it("rejects duplicate object registration before touching lower-level systems", () => {
    const { calls, context } = createSystems();
    const object = createTestObject();
    context.registerRuntimeService(object);
    calls.length = 0;

    expect(() => context.registerRuntimeService(object)).toThrow(/already registered/);
    expect(calls).toEqual([]);
  });

  it("rejects duplicate ids before touching lower-level systems", () => {
    const { calls, context } = createSystems();
    context.registerRuntimeService(createTestObject("same-id"));
    calls.length = 0;

    expect(() => context.registerRuntimeService(createTestObject("same-id"))).toThrow(/id is already registered/);
    expect(calls).toEqual([]);
  });

  it("does not continue registration when scene runtime registration fails", () => {
    const { calls, context } = createSystems({ failAt: "scene" });

    expect(() => context.registerRuntimeService(createTestObject())).toThrow("scene failed");
    expect(calls).toEqual(["scene-register:test-object"]);
  });

  it("unmarks objects when a registration is disposed", () => {
    const { context } = createSystems();
    const object = createTestObject();
    const registration = context.registerRuntimeService(object);

    registration.dispose();

    expect(() => context.registerRuntimeService(object)).not.toThrow();
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

  it("injects actor window focus service into component contexts", () => {
    const calls: string[] = [];
    const actorWindowFocus: ActorWindowFocusService = {
      getEffectiveStackPriorityForActor(actor) {
        calls.push(`priority:${actor.id}`);
        return 700;
      },
      focusActorWindow(actor, reason) {
        calls.push(`focus:${actor.id}:${reason}`);
      },
      requestFocusOnVisible(actor, reason) {
        calls.push(`pending:${actor.id}:${reason}`);
      }
    };
    const { context } = createSystems({ actorWindowFocus });
    context.componentRegistry.registerDefinition({
      type: testActorComponentType,
      singleton: true,
      createId: () => "test-actor-component",
      create(actor, componentContext) {
        expect(componentContext.services.actorWindowFocus).toBe(actorWindowFocus);
        expect(componentContext.services.actorWindowFocus?.getEffectiveStackPriorityForActor(actor)).toBe(700);
        componentContext.services.actorWindowFocus?.focusActorWindow(actor, "pointer-down");
        componentContext.services.actorWindowFocus?.requestFocusOnVisible(actor, "menu-restore");
        return {
          id: "test-actor-component",
          type: testActorComponentType,
          actor,
          enabled: true
        };
      }
    });
    const actor = context.actorSystem.createActor({ id: "actor" });

    context.componentRegistry.addComponent(actor, testActorComponentType);

    expect(calls).toEqual([
      "priority:actor",
      "focus:actor:pointer-down",
      "pending:actor:menu-restore"
    ]);
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
