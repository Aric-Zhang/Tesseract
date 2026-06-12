import { describe, expect, it } from "vitest";
import { ActorSystem, componentAttachmentKind, type Component } from "actor-core";
import {
  stateObserverAttachment,
  StateObserverAttachmentRuntime
} from "./state-observer-attachment-runtime";

interface TestObserver extends Component {
  onTestStateChanged(): void;
}

function createObserver(): TestObserver {
  const actorSystem = new ActorSystem();
  const actor = actorSystem.createActor({ id: "actor" });
  return {
    id: "observer",
    type: "observer",
    actor,
    enabled: true,
    onTestStateChanged() {}
  };
}

describe("StateObserverAttachmentRuntime", () => {
  it("subscribes components with the state observer attachment", () => {
    const calls: string[] = [];
    const component = createObserver();
    const runtime = new StateObserverAttachmentRuntime<TestObserver>({
      registry: {
        subscribe(observer) {
          calls.push(`subscribe:${observer.id}`);
          return {
            dispose() {
              calls.push(`unsubscribe:${observer.id}`);
            }
          };
        },
        dispose() {
          calls.push("registry-dispose");
        }
      },
      getObserver(component) {
        return component as TestObserver;
      }
    });

    const registration = runtime.attach(component.actor, component, [stateObserverAttachment]);
    registration.dispose();

    expect(calls).toEqual(["subscribe:observer", "unsubscribe:observer"]);
  });

  it("ignores components without the state observer attachment", () => {
    const calls: string[] = [];
    const component = createObserver();
    const runtime = new StateObserverAttachmentRuntime<TestObserver>({
      registry: {
        subscribe() {
          calls.push("subscribe");
          return { dispose() {} };
        },
        dispose() {}
      },
      getObserver(component) {
        return component as TestObserver;
      }
    });

    runtime.attach(component.actor, component, [{
      kind: componentAttachmentKind("other")
    }]);

    expect(calls).toEqual([]);
  });

  it("uses the injected observer assertion", () => {
    const actorSystem = new ActorSystem();
    const actor = actorSystem.createActor({ id: "actor" });
    const component: Component = {
      id: "not-observer",
      type: "not-observer",
      actor,
      enabled: true
    };
    const runtime = new StateObserverAttachmentRuntime<TestObserver>({
      registry: {
        subscribe() {
          throw new Error("should not subscribe");
        },
        dispose() {}
      },
      getObserver() {
        throw new Error("Expected TestObserver.");
      }
    });

    expect(() => runtime.attach(actor, component, [stateObserverAttachment])).toThrow("Expected TestObserver.");
  });
});
