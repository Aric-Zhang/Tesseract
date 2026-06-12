import { describe, expect, it } from "vitest";
import type { GizmoController } from "gizmo-core";
import type { AppStateCommand } from "editor";
import type { AppStateObserver } from "editor";
import type { RuntimeRegistration, UpdateFrame } from "../runtime/ports";
import {
  componentType,
  createRegisteredActor,
  type Component
} from "../actor-runtime";
import { frameUpdateAttachment } from "ui-framework";
import { AppRuntimeContext, createRegisteredObject } from "./app-runtime-context";

interface TestActorComponent extends Component {
  updateFrame?(frame: UpdateFrame): void;
}

type DisposeFailurePoint = "gizmo-dispose" | "frame-system-dispose";

const testActorComponentType = componentType<TestActorComponent>("test-actor-component");

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
  failDisposeAt?: DisposeFailurePoint;
  rollbackErrors?: unknown[][];
} = {}) {
  const calls: string[] = [];
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
    submit(_command: AppStateCommand): void {
      calls.push("frame-submit");
    },
    subscribe(observer: AppStateObserver): RuntimeRegistration {
      calls.push(`observer-subscribe:${String((observer as { id?: string }).id ?? "observer")}`);
      return createRegistration("observer-dispose", calls, options.failDisposeAt);
    },
    dispose() {
      calls.push("frame-system-dispose");
    }
  };
  const context = new AppRuntimeContext({
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
  it("ticks frame-update components through the explicit component frame lane", () => {
    const { calls, context } = createSystems();
    context.componentRegistry.registerDefinition({
      type: testActorComponentType,
      singleton: true,
      attachments: [frameUpdateAttachment],
      createId: () => "test-actor-component",
      create(actor) {
        return {
          id: "test-actor-component",
          type: testActorComponentType,
          actor,
          enabled: true,
          updateFrame(frame: UpdateFrame) {
            calls.push(`component-frame:${frame.frameIndex}`);
          }
        };
      }
    });
    const actor = context.actorSystem.createActor({ id: "actor" });
    context.componentRegistry.addComponent(actor, testActorComponentType);

    context.updateComponentFrame({ timeMs: 10, deltaMs: 0, frameIndex: 1 });

    expect(calls).toEqual(["component-frame:1"]);
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

  it("does not inject app services into component contexts", () => {
    const calls: string[] = [];
    const { context } = createSystems();
    context.componentRegistry.registerDefinition({
      type: testActorComponentType,
      singleton: true,
      createId: () => "test-actor-component",
      create(actor, componentContext) {
        expect("services" in (componentContext as unknown as Record<string, unknown>)).toBe(false);
        calls.push(`create:${actor.id}`);
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

    expect(calls).toEqual(["create:actor"]);
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
      "gizmo-system-dispose",
      "frame-system-dispose"
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
      "gizmo-system-dispose",
      "frame-system-dispose"
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
      "gizmo-system-dispose",
      "frame-system-dispose"
    ]);
  });
});
