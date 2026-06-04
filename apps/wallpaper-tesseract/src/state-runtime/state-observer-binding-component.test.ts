import { describe, expect, it } from "vitest";
import { ComponentRuntimeBridge, componentType } from "../actor-runtime";
import type { ComponentDefinition } from "../actor-runtime";
import { installCoreComponentDefinitions } from "../component-definitions";
import type {
  RuntimeRegistration,
  SceneStateChangedEvent,
  SceneStateObserver
} from "../scene-runtime";
import {
  createRecordingRuntimeRegistration,
  createTestComponentRegistry
} from "../test-support";
import {
  stateObserverBindingComponentType
} from "./state-observer-binding-component";
import type { StateObserverResponder } from "./state-observer-responder";

function createRegistry() {
  const calls: string[] = [];
  const observers: SceneStateObserver[] = [];
  const bridge = new ComponentRuntimeBridge({
    gizmoEventSystem: {
      register(): RuntimeRegistration {
        calls.push("gizmo-register");
        return createRecordingRuntimeRegistration("gizmo-dispose", calls);
      },
      dispose(): void {
        calls.push("gizmo-system-dispose");
      }
    },
    frameStateController: {
      submit(): void {
        calls.push("frame-submit");
      },
      subscribe(observer: SceneStateObserver): RuntimeRegistration {
        calls.push("observer-subscribe");
        observers.push(observer);
        return createRecordingRuntimeRegistration("observer-dispose", calls);
      },
      dispose(): void {
        calls.push("frame-system-dispose");
      }
    }
  });
  const { actorSystem, registry } = createTestComponentRegistry({ bridge });
  installCoreComponentDefinitions(registry);
  return { actorSystem, calls, observers, registry };
}

function createResponderDefinition(
  calls: string[],
  label: string
): ComponentDefinition<StateObserverResponder> {
  const type = componentType<StateObserverResponder>(`state-responder-${label}`);
  return {
    type,
    requires: [{ type: stateObserverBindingComponentType }],
    createId() {
      return `${label}-state-responder`;
    },
    create(actor) {
      return {
        id: `${label}-state-responder`,
        type,
        actor,
        enabled: true,
        onSceneStateChanged(): void {
          calls.push(`state:${label}`);
        },
        updateFrame(): void {
          calls.push(`update:${label}`);
        }
      };
    }
  };
}

function createStateEvent(): SceneStateChangedEvent {
  return {
    frame: { timeMs: 0, deltaMs: 0, frameIndex: 0 },
    changes: []
  };
}

describe("StateObserverBindingComponent", () => {
  it("auto-adds StateObserverBindingComponent for observer responders", () => {
    const { actorSystem, calls, observers, registry } = createRegistry();
    registry.registerDefinition(createResponderDefinition(calls, "debug"));
    const actor = actorSystem.createActor({ id: "actor" });

    registry.addComponent(actor, componentType<StateObserverResponder>("state-responder-debug"));

    expect(actor.hasComponent(stateObserverBindingComponentType)).toBe(true);
    expect(observers).toHaveLength(1);
    expect(calls).toEqual(["observer-subscribe"]);
  });

  it("registers the binding only once for multiple responders", () => {
    const { actorSystem, calls, observers, registry } = createRegistry();
    registry.registerDefinition(createResponderDefinition(calls, "a"));
    registry.registerDefinition(createResponderDefinition(calls, "b"));
    const actor = actorSystem.createActor({ id: "actor" });

    registry.addComponent(actor, componentType<StateObserverResponder>("state-responder-a"));
    registry.addComponent(actor, componentType<StateObserverResponder>("state-responder-b"));

    expect(observers).toHaveLength(1);
    expect(calls.filter((call) => call === "observer-subscribe")).toHaveLength(1);
  });

  it("delivers state events even when the actor is disabled", () => {
    const { actorSystem, calls, observers, registry } = createRegistry();
    registry.registerDefinition(createResponderDefinition(calls, "debug"));
    const actor = actorSystem.createActor({ id: "actor" });
    registry.addComponent(actor, componentType<StateObserverResponder>("state-responder-debug"));
    actor.enabled = false;
    calls.length = 0;

    observers[0]?.onSceneStateChanged(createStateEvent());

    expect(calls).toEqual(["state:debug"]);
  });

  it("does not deliver state events to disabled responder components", () => {
    const { actorSystem, calls, observers, registry } = createRegistry();
    registry.registerDefinition(createResponderDefinition(calls, "debug"));
    const actor = actorSystem.createActor({ id: "actor" });
    const responder = registry.addComponent(
      actor,
      componentType<StateObserverResponder>("state-responder-debug")
    );
    responder.enabled = false;
    calls.length = 0;

    observers[0]?.onSceneStateChanged(createStateEvent());

    expect(calls).toEqual([]);
  });

  it("does not run frame updates for disabled actors while state observers still receive events", () => {
    const { actorSystem, calls, observers, registry } = createRegistry();
    registry.registerDefinition(createResponderDefinition(calls, "debug"));
    const actor = actorSystem.createActor({ id: "actor" });
    registry.addComponent(actor, componentType<StateObserverResponder>("state-responder-debug"));
    actor.enabled = false;
    calls.length = 0;

    actorSystem.updateFrame({ timeMs: 0, deltaMs: 0, frameIndex: 0 });
    observers[0]?.onSceneStateChanged(createStateEvent());

    expect(calls).toEqual(["state:debug"]);
  });
});
