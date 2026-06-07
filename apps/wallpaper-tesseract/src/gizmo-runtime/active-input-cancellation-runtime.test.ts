import { describe, expect, it } from "vitest";
import { ActorSystem } from "../actor-runtime";
import type { Component } from "../actor-runtime";
import {
  activeInputCancellationAttachment,
  ActiveInputCancellationRuntime
} from "./active-input-cancellation-runtime";

describe("ActiveInputCancellationRuntime", () => {
  it("broadcasts cancellation to attached cancellers and unregisters on dispose", () => {
    const calls: string[] = [];
    const actorSystem = new ActorSystem();
    const actor = actorSystem.createActor({ id: "actor" });
    const component: Component & { cancelActiveInput(reason?: string): void } = {
      id: "canceller",
      type: "canceller",
      actor,
      enabled: true,
      cancelActiveInput(reason = "default") {
        calls.push(`cancel:${reason}`);
      }
    };
    const runtime = new ActiveInputCancellationRuntime();

    const registration = runtime.attach(actor, component, [activeInputCancellationAttachment]);
    runtime.cancelActiveActorInput("system-dispose");
    registration.dispose();
    runtime.cancelActiveActorInput("gizmo-disabled");

    expect(calls).toEqual(["cancel:system-dispose"]);
  });

  it("ignores components that do not declare the cancellation attachment", () => {
    const calls: string[] = [];
    const actorSystem = new ActorSystem();
    const actor = actorSystem.createActor({ id: "actor" });
    const component: Component & { cancelActiveInput(): void } = {
      id: "component",
      type: "component",
      actor,
      enabled: true,
      cancelActiveInput() {
        calls.push("cancel");
      }
    };
    const runtime = new ActiveInputCancellationRuntime();

    const registration = runtime.attach(actor, component, []);
    runtime.cancelActiveActorInput();
    registration.dispose();

    expect(calls).toEqual([]);
  });

  it("rejects attachment declarations on components without a cancellation method", () => {
    const actorSystem = new ActorSystem();
    const actor = actorSystem.createActor({ id: "actor" });
    const component: Component = {
      id: "component",
      type: "component",
      actor,
      enabled: true
    };
    const runtime = new ActiveInputCancellationRuntime();

    expect(() => runtime.attach(actor, component, [activeInputCancellationAttachment])).toThrow(
      /declares active-input-cancellation attachment/
    );
  });
});
