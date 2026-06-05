import { describe, expect, it } from "vitest";
import type { GizmoController, GizmoHit, ScreenPoint } from "gizmo-core";
import type { RuntimeRegistration, SceneStateObserver } from "../scene-runtime";
import { createRecordingRuntimeRegistration } from "../test-support";
import { ActorSystem } from "./actor-system";
import type { Actor } from "./actor";
import type { Component, ComponentDefinition } from "./component";
import { componentType } from "./component";
import { ComponentRuntimeBridge } from "./component-runtime-bridge";

type BridgeComponent = Component & GizmoController & SceneStateObserver;

function createBridge(
  calls: string[],
  failAt?: "gizmo" | "observer",
  isActorActive?: (actor: Actor) => boolean
) {
  const registered: { gizmo?: GizmoController; observer?: SceneStateObserver } = {};
  const bridge = new ComponentRuntimeBridge({
    gizmoEventSystem: {
      register(controller: GizmoController): RuntimeRegistration {
        calls.push(`gizmo-register:${controller.id}`);
        if (failAt === "gizmo") throw new Error("gizmo failed");
        registered.gizmo = controller;
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
        if (failAt === "observer") throw new Error("observer failed");
        registered.observer = observer;
        return createRecordingRuntimeRegistration("observer-dispose", calls);
      },
      dispose(): void {
        calls.push("frame-system-dispose");
      }
    },
    isActorActive
  });
  return { bridge, registered };
}

function createBridgeComponent(actor: Actor, calls: string[]): BridgeComponent {
  return {
    id: "bridge-component",
    type: "bridge-component",
    actor,
    enabled: true,
    priority: 10,
    hitTest(_point: ScreenPoint): GizmoHit | null {
      calls.push("hit-test");
      return { gizmoId: this.id, partId: "body", kind: "custom", priority: 0 };
    },
    onGizmoMove() {
      calls.push("move");
    },
    onSceneStateChanged() {
      calls.push("state");
    }
  };
}

describe("ComponentRuntimeBridge", () => {
  it("registers declared external capabilities", () => {
    const actorSystem = new ActorSystem();
    const calls: string[] = [];
    const actor = actorSystem.createActor({ id: "actor" });
    const component = createBridgeComponent(actor, calls);
    const definition: ComponentDefinition = {
      type: componentType("bridge-component"),
      capabilities: ["gizmo", "state-observer"],
      create: () => component
    };
    const { bridge } = createBridge(calls);

    bridge.attach(actor, component, definition);

    expect(calls).toEqual(["gizmo-register:bridge-component", "observer-subscribe"]);
  });

  it("rolls back earlier external registrations when a later registration fails", () => {
    const actorSystem = new ActorSystem();
    const calls: string[] = [];
    const actor = actorSystem.createActor({ id: "actor" });
    const component = createBridgeComponent(actor, calls);
    const definition: ComponentDefinition = {
      type: componentType("bridge-component"),
      capabilities: ["gizmo", "state-observer"],
      create: () => component
    };
    const { bridge } = createBridge(calls, "observer");

    expect(() => bridge.attach(actor, component, definition)).toThrow("observer failed");

    expect(calls).toEqual([
      "gizmo-register:bridge-component",
      "observer-subscribe",
      "gizmo-dispose"
    ]);
  });

  it("does not deliver gizmo input to disabled actors or components", () => {
    const actorSystem = new ActorSystem();
    const calls: string[] = [];
    const actor = actorSystem.createActor({ id: "actor" });
    const component = createBridgeComponent(actor, calls);
    const definition: ComponentDefinition = {
      type: componentType("bridge-component"),
      capabilities: ["gizmo"],
      create: () => component
    };
    const { bridge, registered } = createBridge(calls);
    bridge.attach(actor, component, definition);
    calls.length = 0;

    component.enabled = false;
    expect(registered.gizmo?.hitTest({ x: 0, y: 0 })).toBeNull();
    registered.gizmo?.onGizmoMove?.({
      gizmo: registered.gizmo,
      hit: { gizmoId: registered.gizmo.id, partId: "body", kind: "custom" },
      pointerId: 1,
      pointerType: "mouse",
      timeStamp: 0,
      point: { x: 0, y: 0 },
      startPoint: { x: 0, y: 0 },
      buttons: 1,
      delta: { dx: 1, dy: 1 },
      totalDelta: { dx: 1, dy: 1 },
      isDragging: true
    });

    component.enabled = true;
    actor.enabled = false;
    expect(registered.gizmo?.hitTest({ x: 0, y: 0 })).toBeNull();

    expect(calls).toEqual([]);
  });

  it("broadcasts active actor input cancellation to registered binding components", () => {
    const actorSystem = new ActorSystem();
    const calls: string[] = [];
    const actor = actorSystem.createActor({ id: "actor" });
    const component = {
      ...createBridgeComponent(actor, calls),
      cancelActiveInput(reason = "gizmo-disabled") {
        calls.push(`cancel:${reason}`);
      }
    };
    const definition: ComponentDefinition = {
      type: componentType("bridge-component"),
      capabilities: ["gizmo-controller-binding"],
      create: () => component
    };
    const { bridge } = createBridge(calls);
    const registration = bridge.attach(actor, component, definition);
    calls.length = 0;

    bridge.cancelActiveActorInput("system-dispose");
    registration.dispose();
    bridge.cancelActiveActorInput("gizmo-disabled");

    expect(calls).toEqual([
      "cancel:system-dispose",
      "gizmo-dispose"
    ]);
  });

  it("uses injected actor active state for legacy gizmo adapters", () => {
    const actorSystem = new ActorSystem();
    const calls: string[] = [];
    const parent = actorSystem.createActor({ id: "parent" });
    const child = actorSystem.createActor({ id: "child", parent });
    const component = createBridgeComponent(child, calls);
    const definition: ComponentDefinition = {
      type: componentType("bridge-component"),
      capabilities: ["gizmo"],
      create: () => component
    };
    const { bridge, registered } = createBridge(
      calls,
      undefined,
      (actor) => actorSystem.isActorActive(actor)
    );
    bridge.attach(child, component, definition);
    calls.length = 0;

    parent.enabled = false;
    expect(registered.gizmo?.hitTest({ x: 0, y: 0 })).toBeNull();
    expect(calls).toEqual([]);

    parent.enabled = true;
    expect(registered.gizmo?.hitTest({ x: 0, y: 0 })).toMatchObject({ partId: "body" });
    expect(calls).toEqual(["hit-test"]);
  });

  it("does not deliver state observer events to disabled components", () => {
    const actorSystem = new ActorSystem();
    const calls: string[] = [];
    const actor = actorSystem.createActor({ id: "actor" });
    const component = createBridgeComponent(actor, calls);
    const definition: ComponentDefinition = {
      type: componentType("bridge-component"),
      capabilities: ["state-observer"],
      create: () => component
    };
    const { bridge, registered } = createBridge(calls);
    bridge.attach(actor, component, definition);

    component.enabled = false;
    registered.observer?.onSceneStateChanged({ frame: { timeMs: 0, deltaMs: 0, frameIndex: 0 }, changes: [] });

    expect(calls).toEqual(["observer-subscribe"]);
  });
});
