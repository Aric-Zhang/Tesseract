import { describe, expect, it } from "vitest";
import {
  ActorSystem,
  ComponentRegistry,
  componentType,
  installComponentDefinition,
  type Component,
  type ComponentAttachmentDescriptor,
  type ComponentAttachmentRegistration,
  type ComponentAttachmentRuntime,
  type ComponentDefinition
} from "actor-system/core";
import { gizmoEventBindingComponentDefinition } from "actor-system/input";
import type { AppStateChangedEvent, AppStateObserver } from "../app-state";
import {
  FrameUpdateAttachmentRuntime,
  frameUpdateAttachment,
  type FrameUpdateParticipant
} from "ui-framework";
import { installEditorStateObserverComponentDefinitions } from "./install-component-definitions";
import {
  stateObserverBindingComponentType
} from "./state-observer-binding-component";
import { StateObserverAttachmentRuntime } from "./state-observer-attachment-runtime";
import type { StateObserverResponder } from "./state-observer-responder";

interface TestStateObserverResponder extends StateObserverResponder, FrameUpdateParticipant {}

interface TestRegistration {
  dispose(): void;
}

class TestCompositeAttachmentRuntime implements ComponentAttachmentRuntime {
  constructor(private readonly runtimes: readonly ComponentAttachmentRuntime[]) {}

  attach(
    actor: Component["actor"],
    component: Component,
    attachments: readonly ComponentAttachmentDescriptor[]
  ): ComponentAttachmentRegistration {
    const registrations = this.runtimes.map((runtime) => runtime.attach(actor, component, attachments));
    return {
      dispose() {
        for (const registration of registrations.slice().reverse()) {
          registration.dispose();
        }
      }
    };
  }
}

function createRecordingRegistration(label: string, calls: string[]): TestRegistration {
  return {
    dispose() {
      calls.push(label);
    }
  };
}

function createRegistry() {
  const calls: string[] = [];
  const observers: AppStateObserver[] = [];
  const stateAttachmentRuntime = new StateObserverAttachmentRuntime<AppStateObserver>({
    registry: {
      subscribe(observer: AppStateObserver): TestRegistration {
        calls.push("observer-subscribe");
        observers.push(observer);
        return createRecordingRegistration("observer-dispose", calls);
      },
      dispose(): void {
        calls.push("frame-system-dispose");
      }
    },
    getObserver(component) {
      const observer = component as Partial<AppStateObserver>;
      if (typeof observer.onStateChanged !== "function") {
        throw new Error("Expected AppStateObserver.");
      }
      return observer as AppStateObserver;
    }
  });
  const actorSystem = new ActorSystem();
  const updateRuntime = new FrameUpdateAttachmentRuntime({ actorSystem });
  const attachmentRuntime = new TestCompositeAttachmentRuntime([
    stateAttachmentRuntime,
    updateRuntime
  ]);
  const registry = new ComponentRegistry({ actorSystem, attachmentRuntime });
  installComponentDefinition(registry, gizmoEventBindingComponentDefinition);
  installEditorStateObserverComponentDefinitions(registry);
  return { actorSystem, calls, observers, registry, updateRuntime };
}

function createResponderDefinition(
  calls: string[],
  label: string
): ComponentDefinition<TestStateObserverResponder> {
  const type = componentType<TestStateObserverResponder>(`state-responder-${label}`);
  return {
    type,
    attachments: [frameUpdateAttachment],
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
        onStateChanged(): void {
          calls.push(`state:${label}`);
        },
        updateFrame(): void {
          calls.push(`update:${label}`);
        }
      };
    }
  };
}

function createStateEvent(): AppStateChangedEvent {
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

    observers[0]?.onStateChanged(createStateEvent());

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

    observers[0]?.onStateChanged(createStateEvent());

    expect(calls).toEqual([]);
  });

  it("does not run frame updates for disabled actors while state observers still receive events", () => {
    const { actorSystem, calls, observers, registry, updateRuntime } = createRegistry();
    registry.registerDefinition(createResponderDefinition(calls, "debug"));
    const actor = actorSystem.createActor({ id: "actor" });
    registry.addComponent(actor, componentType<StateObserverResponder>("state-responder-debug"));
    actor.enabled = false;
    calls.length = 0;

    updateRuntime.updateFrame({ timeMs: 0, deltaMs: 0, frameIndex: 0 });
    observers[0]?.onStateChanged(createStateEvent());

    expect(calls).toEqual(["state:debug"]);
  });
});



