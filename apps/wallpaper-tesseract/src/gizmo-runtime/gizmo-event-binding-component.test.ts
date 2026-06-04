import { describe, expect, it } from "vitest";
import type {
  GizmoClickEvent,
  GizmoController,
  GizmoEventSystem,
  GizmoMoveEvent,
  GizmoHit,
  GizmoStartEvent,
  ScreenPoint
} from "gizmo-core";
import { GizmoEventSystem as RuntimeGizmoEventSystem } from "gizmo-core";
import { ComponentRuntimeBridge, componentType } from "../actor-runtime";
import type { Component, ComponentDefinition } from "../actor-runtime";
import type { RuntimeRegistration, SceneStateObserver } from "../scene-runtime";
import {
  createRecordingRuntimeRegistration,
  createTestComponentRegistry
} from "../test-support";
import type { ActorInputHit } from "./actor-input-hit";
import type { ActorInputParticipant } from "./actor-input-participant";
import { gizmoEventBindingComponentType } from "./gizmo-event-binding-component";
import { gizmoEventBindingComponentDefinition } from "./gizmo-event-binding-definition";
import type { GizmoResponder } from "./gizmo-responder";

function createRegistry() {
  const calls: string[] = [];
  const registered: GizmoController[] = [];
  const bridge = new ComponentRuntimeBridge({
    gizmoEventSystem: {
      register(controller: GizmoController): RuntimeRegistration {
        calls.push(`gizmo-register:${controller.id}`);
        registered.push(controller);
        return createRecordingRuntimeRegistration(`gizmo-dispose:${controller.id}`, calls);
      },
      dispose(): void {
        calls.push("gizmo-system-dispose");
      }
    },
    frameStateController: {
      submit(): void {
        calls.push("frame-submit");
      },
      subscribe(_observer: SceneStateObserver): RuntimeRegistration {
        calls.push("observer-subscribe");
        return createRecordingRuntimeRegistration("observer-dispose", calls);
      },
      dispose(): void {
        calls.push("frame-system-dispose");
      }
    }
  });
  const { actorSystem, registry } = createTestComponentRegistry({ bridge });
  registry.registerDefinition(gizmoEventBindingComponentDefinition);
  return { actorSystem, calls, registered, registry };
}

function createResponderDefinition(
  calls: string[],
  label: string,
  options: {
    gizmoPriority: number;
    hitPriority?: number;
    enabled?: boolean;
  }
): ComponentDefinition<GizmoResponder> {
  const type = componentType<GizmoResponder>(`responder-${label}`);
  return {
    type,
    singleton: true,
    createId() {
      return `${label}-responder`;
    },
    create(actor) {
      const responderHit: GizmoHit = {
        gizmoId: `${label}-responder`,
        partId: label,
        kind: "custom",
        priority: options.hitPriority
      };
      return {
        id: `${label}-responder`,
        type,
        actor,
        enabled: options.enabled ?? true,
        gizmoPriority: options.gizmoPriority,
        hitTestGizmo(_point: ScreenPoint): GizmoHit | null {
          calls.push(`hit:${label}`);
          return responderHit;
        },
        onGizmoStart(event: GizmoStartEvent): void {
          calls.push(`start:${label}:${event.hit.gizmoId}:${event.hit.partId}`);
        },
        onGizmoMove(): void {
          calls.push(`move:${label}`);
        },
        onGizmoEnd(event): void {
          calls.push(`end:${label}:${event.hit.gizmoId}:${event.hit.partId}:${event.wasClick}`);
        },
        onGizmoCancel(event): void {
          calls.push(`cancel:${label}:${event.reason}`);
        },
        onGizmoClick(event): void {
          calls.push(`click:${label}:${event.hit.gizmoId}:${event.hit.partId}:${event.clickCount}`);
        },
        onGizmoDoubleClick(event): void {
          calls.push(`double-click:${label}:${event.hit.gizmoId}:${event.hit.partId}:${event.clickCount}`);
        },
        onDetach(): void {
          calls.push(`detach:${label}`);
        },
        dispose(): void {
          calls.push(`dispose:${label}`);
        }
      };
    }
  };
}

function createActorInputHit(componentId: string, label: string, options: {
  localRoutePriority?: number;
  hitPriority?: number;
  path?: ActorInputHit["path"];
} = {}): ActorInputHit {
  return {
    componentId,
    partId: label,
    kind: "control",
    region: "content-control",
    localRoutePriority: options.localRoutePriority ?? 0,
    hitPriority: options.hitPriority,
    path: options.path ?? [{
      componentId,
      role: "control",
      partId: label
    }]
  };
}

function createActorInputParticipantDefinition(
  calls: string[],
  label: string,
  options: {
    inputStackPriority?: number;
    inputPriority?: number;
    localRoutePriority?: number;
    hitPriority?: number;
    path?: ActorInputHit["path"];
  } = {}
): ComponentDefinition<ActorInputParticipant> {
  const type = componentType<ActorInputParticipant>(`input-participant-${label}`);
  return {
    type,
    singleton: true,
    createId() {
      return `${label}-participant`;
    },
    create(actor) {
      const hit = createActorInputHit(`${label}-participant`, label, {
        localRoutePriority: options.localRoutePriority,
        hitPriority: options.hitPriority,
        path: options.path
      });
      return {
        id: `${label}-participant`,
        type,
        actor,
        enabled: true,
        inputStackPriority: options.inputStackPriority,
        inputPriority: options.inputPriority,
        hitTestInput(): ActorInputHit | null {
          calls.push(`input-hit:${label}`);
          return hit;
        },
        onInputStart(event): void {
          calls.push(`input-start:${label}:${event.hit.componentId}:${event.hit.partId}`);
        },
        onInputMove(): void {
          calls.push(`input-move:${label}`);
        },
        onInputCancel(event): void {
          calls.push(`input-cancel:${label}:${event.reason}`);
        },
        dispose(): void {
          calls.push(`input-dispose:${label}`);
        }
      };
    }
  };
}

function createPlainComponentDefinition(calls: string[], label: string): ComponentDefinition<Component> {
  const type = componentType<Component>(`plain-${label}`);
  return {
    type,
    singleton: true,
    createId() {
      return `${label}-plain`;
    },
    create(actor) {
      return {
        id: `${label}-plain`,
        type,
        actor,
        enabled: true,
        onDetach(): void {
          calls.push(`plain-detach:${label}`);
        },
        dispose(): void {
          calls.push(`plain-dispose:${label}`);
        }
      };
    }
  };
}

function getRegisteredBinding(registered: readonly GizmoController[]): GizmoController {
  const binding = registered[0];
  if (!binding) throw new Error("Expected registered binding.");
  return binding;
}

function findRegisteredBinding(registered: readonly GizmoController[], id: string): GizmoController {
  const binding = registered.find((candidate) => candidate.id === id);
  if (!binding) throw new Error(`Expected registered binding: ${id}`);
  return binding;
}

function createStartEvent(gizmo: GizmoController, hit: GizmoHit): GizmoStartEvent {
  return {
    gizmo,
    hit,
    pointerId: 1,
    pointerType: "mouse",
    timeStamp: 0,
    point: { x: 1, y: 2 },
    startPoint: { x: 1, y: 2 },
    buttons: 1
  };
}

function createMoveEvent(gizmo: GizmoController, hit: GizmoHit): GizmoMoveEvent {
  return {
    ...createStartEvent(gizmo, hit),
    delta: { dx: 1, dy: 1 },
    totalDelta: { dx: 1, dy: 1 },
    isDragging: true
  };
}

function createClickEvent(gizmo: GizmoController, hit: GizmoHit, clickCount: 1 | 2): GizmoClickEvent {
  return {
    ...createStartEvent(gizmo, hit),
    clickCount
  };
}

class FakeEventTarget {
  addEventListener(): void {}
  removeEventListener(): void {}
}

function selectBestHit(system: GizmoEventSystem, point: ScreenPoint) {
  return (
    system as unknown as {
      findBestHit(point: ScreenPoint): { gizmo: GizmoController; hit: GizmoHit } | null;
    }
  ).findBestHit(point);
}

describe("GizmoEventBindingComponent", () => {
  it("registers the binding component to GizmoEventSystem through ComponentRuntimeBridge", () => {
    const { actorSystem, calls, registered, registry } = createRegistry();
    const actor = actorSystem.createActor({ id: "actor" });

    const binding = registry.addComponent(actor, gizmoEventBindingComponentType);

    expect(registered).toEqual([binding]);
    expect(calls).toEqual(["gizmo-register:actor:gizmo-event-binding"]);
  });

  it("exposes responder hits through the actor-level binding controller", () => {
    const { actorSystem, calls, registered, registry } = createRegistry();
    registry.registerDefinition(createResponderDefinition(calls, "body", {
      gizmoPriority: 10,
      hitPriority: 2
    }));
    const actor = actorSystem.createActor({ id: "actor" });
    registry.addComponent(actor, gizmoEventBindingComponentType);
    registry.addComponent(actor, componentType<GizmoResponder>("responder-body"));
    calls.length = 0;
    const binding = getRegisteredBinding(registered);

    const hit = binding.hitTest({ x: 0, y: 0 });

    expect(hit).toMatchObject({
      gizmoId: "actor:gizmo-event-binding",
      partId: "body"
    });
    if (!hit) throw new Error("Expected hit.");
    expect(hit.priority).toBeGreaterThan(0);
    expect(hit.data).toMatchObject({
      targetComponentId: "body-responder",
      actorInputHit: {
        componentId: "body-responder",
        partId: "body",
        hitPriority: 2
      }
    });
    binding.onGizmoStart?.(createStartEvent(binding, hit));
    expect(calls).toEqual(["hit:body", "start:body:body-responder:body"]);
  });

  it("does not hit test when the actor is inactive through its parent", () => {
    const { actorSystem, calls, registered, registry } = createRegistry();
    registry.registerDefinition(createResponderDefinition(calls, "body", {
      gizmoPriority: 10,
      hitPriority: 2
    }));
    const parent = actorSystem.createActor({ id: "parent" });
    const actor = actorSystem.createActor({ id: "actor", parent });
    registry.addComponent(actor, gizmoEventBindingComponentType);
    registry.addComponent(actor, componentType<GizmoResponder>("responder-body"));
    const binding = getRegisteredBinding(registered);
    calls.length = 0;

    parent.enabled = false;
    expect(binding.hitTest({ x: 0, y: 0 })).toBeNull();
    expect(binding.enabled).toBe(false);

    parent.enabled = true;
    expect(binding.enabled).toBe(true);
    expect(binding.hitTest({ x: 0, y: 0 })?.partId).toBe("body");
    expect(calls).toEqual(["hit:body"]);
  });

  it("keeps local binding enabled independent from actor active state", () => {
    const { actorSystem, registered, registry } = createRegistry();
    const parent = actorSystem.createActor({ id: "parent" });
    const actor = actorSystem.createActor({ id: "actor", parent });
    const bindingComponent = registry.addComponent(actor, gizmoEventBindingComponentType);
    const binding = getRegisteredBinding(registered);

    expect(binding.enabled).toBe(true);

    bindingComponent.enabled = false;
    expect(binding.enabled).toBe(false);

    parent.enabled = false;
    bindingComponent.enabled = true;
    expect(binding.enabled).toBe(false);

    parent.enabled = true;
    expect(binding.enabled).toBe(true);
  });

  it("selects the responder with the highest gizmoPriority", () => {
    const { actorSystem, registered, registry } = createRegistry();
    registry.registerDefinition(createResponderDefinition([], "low", { gizmoPriority: 1 }));
    registry.registerDefinition(createResponderDefinition([], "high", { gizmoPriority: 10 }));
    const actor = actorSystem.createActor({ id: "actor" });
    registry.addComponent(actor, gizmoEventBindingComponentType);
    registry.addComponent(actor, componentType<GizmoResponder>("responder-low"));
    registry.addComponent(actor, componentType<GizmoResponder>("responder-high"));

    const hit = getRegisteredBinding(registered).hitTest({ x: 0, y: 0 });

    expect(hit?.partId).toBe("high");
  });

  it("uses hit.priority when responder priorities match", () => {
    const { actorSystem, registered, registry } = createRegistry();
    registry.registerDefinition(createResponderDefinition([], "low-hit", {
      gizmoPriority: 10,
      hitPriority: 1
    }));
    registry.registerDefinition(createResponderDefinition([], "high-hit", {
      gizmoPriority: 10,
      hitPriority: 5
    }));
    const actor = actorSystem.createActor({ id: "actor" });
    registry.addComponent(actor, gizmoEventBindingComponentType);
    registry.addComponent(actor, componentType<GizmoResponder>("responder-low-hit"));
    registry.addComponent(actor, componentType<GizmoResponder>("responder-high-hit"));

    const hit = getRegisteredBinding(registered).hitTest({ x: 0, y: 0 });

    expect(hit?.partId).toBe("high-hit");
  });

  it("uses responder attach order as the final actor-local tie breaker", () => {
    const { actorSystem, registered, registry } = createRegistry();
    registry.registerDefinition(createResponderDefinition([], "first", { gizmoPriority: 10 }));
    registry.registerDefinition(createResponderDefinition([], "second", { gizmoPriority: 10 }));
    const actor = actorSystem.createActor({ id: "actor" });
    registry.addComponent(actor, gizmoEventBindingComponentType);
    registry.addComponent(actor, componentType<GizmoResponder>("responder-first"));
    registry.addComponent(actor, componentType<GizmoResponder>("responder-second"));

    const hit = getRegisteredBinding(registered).hitTest({ x: 0, y: 0 });

    expect(hit?.partId).toBe("second");
  });

  it("keeps binding priority equal to the highest enabled responder priority", () => {
    const { actorSystem, registered, registry } = createRegistry();
    registry.registerDefinition(createResponderDefinition([], "low", { gizmoPriority: 3 }));
    registry.registerDefinition(createResponderDefinition([], "high", { gizmoPriority: 12 }));
    const actor = actorSystem.createActor({ id: "actor" });
    registry.addComponent(actor, gizmoEventBindingComponentType);
    registry.addComponent(actor, componentType<GizmoResponder>("responder-low"));
    const high = registry.addComponent(actor, componentType<GizmoResponder>("responder-high"));
    const binding = getRegisteredBinding(registered);

    expect(binding.priority).toBe(12);
    high.enabled = false;
    expect(binding.priority).toBe(3);
  });

  it("exposes stack priority on the binding and actor-local route score on the hit", () => {
    const { actorSystem, calls, registered, registry } = createRegistry();
    registry.registerDefinition(createActorInputParticipantDefinition(calls, "stack", {
      inputStackPriority: 900,
      inputPriority: 0,
      localRoutePriority: 0
    }));
    registry.registerDefinition(createActorInputParticipantDefinition(calls, "route", {
      inputStackPriority: 100,
      inputPriority: 0,
      localRoutePriority: 2000
    }));
    const actor = actorSystem.createActor({ id: "actor" });
    registry.addComponent(actor, gizmoEventBindingComponentType);
    registry.addComponent(actor, componentType<ActorInputParticipant>("input-participant-stack"));
    registry.addComponent(actor, componentType<ActorInputParticipant>("input-participant-route"));
    const binding = getRegisteredBinding(registered);

    const hit = binding.hitTest({ x: 0, y: 0 });

    expect(binding.priority).toBe(900);
    expect(hit?.partId).toBe("route");
    expect(hit?.priority).toBeGreaterThan(900);
    expect(hit?.data).toMatchObject({
      targetComponentId: "route-participant",
      actorInputHit: {
        componentId: "route-participant",
        localRoutePriority: 2000
      }
    });
  });

  it("returns null for disabled actors and ignores disabled responders", () => {
    const { actorSystem, registered, registry } = createRegistry();
    registry.registerDefinition(createResponderDefinition([], "disabled", {
      enabled: false,
      gizmoPriority: 100
    }));
    registry.registerDefinition(createResponderDefinition([], "enabled", {
      gizmoPriority: 1
    }));
    const actor = actorSystem.createActor({ id: "actor" });
    registry.addComponent(actor, gizmoEventBindingComponentType);
    registry.addComponent(actor, componentType<GizmoResponder>("responder-disabled"));
    registry.addComponent(actor, componentType<GizmoResponder>("responder-enabled"));
    const binding = getRegisteredBinding(registered);

    expect(binding.hitTest({ x: 0, y: 0 })?.partId).toBe("enabled");
    actor.enabled = false;
    expect(binding.hitTest({ x: 0, y: 0 })).toBeNull();
  });

  it("cancels the active responder before it is detached", () => {
    const { actorSystem, calls, registered, registry } = createRegistry();
    registry.registerDefinition(createResponderDefinition(calls, "active", { gizmoPriority: 10 }));
    const actor = actorSystem.createActor({ id: "actor" });
    registry.addComponent(actor, gizmoEventBindingComponentType);
    const responder = registry.addComponent(actor, componentType<GizmoResponder>("responder-active"));
    const binding = getRegisteredBinding(registered);
    const hit = binding.hitTest({ x: 0, y: 0 });
    if (!hit) throw new Error("Expected hit.");
    binding.onGizmoStart?.(createStartEvent(binding, hit));
    calls.length = 0;

    registry.removeComponent(actor, responder);

    expect(calls).toEqual([
      "cancel:active:gizmo-disabled",
      "detach:active",
      "dispose:active"
    ]);
  });

  it("cancels active input when any component in the selected path is detached", () => {
    const { actorSystem, calls, registered, registry } = createRegistry();
    registry.registerDefinition(createPlainComponentDefinition(calls, "path"));
    registry.registerDefinition(createActorInputParticipantDefinition(calls, "path", {
      inputStackPriority: 10,
      path: [
        { componentId: "path-plain", role: "container" },
        { componentId: "path-participant", role: "control", partId: "path" }
      ]
    }));
    const actor = actorSystem.createActor({ id: "actor" });
    registry.addComponent(actor, gizmoEventBindingComponentType);
    const pathComponent = registry.addComponent(actor, componentType<Component>("plain-path"));
    registry.addComponent(actor, componentType<ActorInputParticipant>("input-participant-path"));
    const binding = getRegisteredBinding(registered);
    const hit = binding.hitTest({ x: 0, y: 0 });
    if (!hit) throw new Error("Expected hit.");
    binding.onGizmoStart?.(createStartEvent(binding, hit));
    calls.length = 0;

    registry.removeComponent(actor, pathComponent);

    expect(calls).toEqual([
      "input-cancel:path:gizmo-disabled",
      "plain-detach:path",
      "plain-dispose:path"
    ]);
  });

  it("cancels the active responder when the actor is destroyed", () => {
    const { actorSystem, calls, registered, registry } = createRegistry();
    registry.registerDefinition(createResponderDefinition(calls, "active", { gizmoPriority: 10 }));
    const actor = actorSystem.createActor({ id: "actor" });
    registry.addComponent(actor, gizmoEventBindingComponentType);
    registry.addComponent(actor, componentType<GizmoResponder>("responder-active"));
    const binding = getRegisteredBinding(registered);
    const hit = binding.hitTest({ x: 0, y: 0 });
    if (!hit) throw new Error("Expected hit.");
    binding.onGizmoStart?.(createStartEvent(binding, hit));
    calls.length = 0;

    actorSystem.destroyActor(actor);

    expect(calls).toEqual([
      "cancel:active:gizmo-disabled",
      "detach:active",
      "dispose:active",
      "gizmo-dispose:actor:gizmo-event-binding"
    ]);
  });

  it("cancels the active responder when the binding is disposed", () => {
    const { actorSystem, calls, registered, registry } = createRegistry();
    registry.registerDefinition(createResponderDefinition(calls, "active", { gizmoPriority: 10 }));
    const actor = actorSystem.createActor({ id: "actor" });
    const bindingComponent = registry.addComponent(actor, gizmoEventBindingComponentType);
    registry.addComponent(actor, componentType<GizmoResponder>("responder-active"));
    const binding = getRegisteredBinding(registered);
    const hit = binding.hitTest({ x: 0, y: 0 });
    if (!hit) throw new Error("Expected hit.");
    binding.onGizmoStart?.(createStartEvent(binding, hit));
    calls.length = 0;

    registry.removeComponent(actor, bindingComponent);

    expect(calls).toEqual([
      "gizmo-dispose:actor:gizmo-event-binding",
      "cancel:active:system-dispose"
    ]);
  });

  it("forwards click and double-click to the selected responder hit", () => {
    const { actorSystem, calls, registered, registry } = createRegistry();
    registry.registerDefinition(createResponderDefinition(calls, "active", { gizmoPriority: 10 }));
    const actor = actorSystem.createActor({ id: "actor" });
    registry.addComponent(actor, gizmoEventBindingComponentType);
    registry.addComponent(actor, componentType<GizmoResponder>("responder-active"));
    const binding = getRegisteredBinding(registered);
    const hit = binding.hitTest({ x: 0, y: 0 });
    if (!hit) throw new Error("Expected hit.");
    calls.length = 0;

    binding.onGizmoClick?.(createClickEvent(binding, hit, 1));
    binding.onGizmoDoubleClick?.(createClickEvent(binding, hit, 2));

    expect(calls).toEqual([
      "click:active:active-responder:active:1",
      "double-click:active:active-responder:active:2"
    ]);
  });

  it("does not forward move after the active responder has been removed", () => {
    const { actorSystem, calls, registered, registry } = createRegistry();
    registry.registerDefinition(createResponderDefinition(calls, "active", { gizmoPriority: 10 }));
    const actor = actorSystem.createActor({ id: "actor" });
    registry.addComponent(actor, gizmoEventBindingComponentType);
    const responder = registry.addComponent(actor, componentType<GizmoResponder>("responder-active"));
    const binding = getRegisteredBinding(registered);
    const hit = binding.hitTest({ x: 0, y: 0 });
    if (!hit) throw new Error("Expected hit.");
    binding.onGizmoStart?.(createStartEvent(binding, hit));
    registry.removeComponent(actor, responder);
    calls.length = 0;

    binding.onGizmoMove?.(createMoveEvent(binding, hit));

    expect(calls).toEqual([]);
  });

  it("does not cancel active interaction when a non-active responder is removed", () => {
    const { actorSystem, calls, registered, registry } = createRegistry();
    registry.registerDefinition(createResponderDefinition(calls, "inactive", { gizmoPriority: 1 }));
    registry.registerDefinition(createResponderDefinition(calls, "active", { gizmoPriority: 10 }));
    const actor = actorSystem.createActor({ id: "actor" });
    registry.addComponent(actor, gizmoEventBindingComponentType);
    const inactive = registry.addComponent(actor, componentType<GizmoResponder>("responder-inactive"));
    registry.addComponent(actor, componentType<GizmoResponder>("responder-active"));
    const binding = getRegisteredBinding(registered);
    const hit = binding.hitTest({ x: 0, y: 0 });
    if (!hit) throw new Error("Expected hit.");
    binding.onGizmoStart?.(createStartEvent(binding, hit));
    calls.length = 0;

    registry.removeComponent(actor, inactive);

    expect(calls).toEqual(["detach:inactive", "dispose:inactive"]);
  });

  it("keeps cross-actor hit selection ordered by binding priority before hit priority", () => {
    const { actorSystem, registered, registry } = createRegistry();
    registry.registerDefinition(createResponderDefinition([], "low", {
      gizmoPriority: 100,
      hitPriority: 1000
    }));
    registry.registerDefinition(createResponderDefinition([], "high", {
      gizmoPriority: 900,
      hitPriority: 1
    }));
    const lowActor = actorSystem.createActor({ id: "low" });
    const highActor = actorSystem.createActor({ id: "high" });
    registry.addComponent(lowActor, gizmoEventBindingComponentType);
    registry.addComponent(lowActor, componentType<GizmoResponder>("responder-low"));
    registry.addComponent(highActor, gizmoEventBindingComponentType);
    registry.addComponent(highActor, componentType<GizmoResponder>("responder-high"));
    const system = new RuntimeGizmoEventSystem({ target: new FakeEventTarget() as unknown as EventTarget });
    const lowBinding = registered.find((binding) => binding.id === "low:gizmo-event-binding");
    const highBinding = registered.find((binding) => binding.id === "high:gizmo-event-binding");
    if (!lowBinding || !highBinding) throw new Error("Expected both bindings.");
    system.register(lowBinding);
    system.register(highBinding);

    const selected = selectBestHit(system, { x: 0, y: 0 });

    expect(selected?.gizmo).toBe(highBinding);
    expect(selected?.hit.partId).toBe("high");

    system.dispose();
  });

  it("lets a higher stack actor content route beat a lower stack actor chrome route", () => {
    const { actorSystem, calls, registered, registry } = createRegistry();
    registry.registerDefinition(createActorInputParticipantDefinition(calls, "low-titlebar", {
      inputStackPriority: 100,
      localRoutePriority: 3000,
      hitPriority: 20
    }));
    registry.registerDefinition(createActorInputParticipantDefinition(calls, "high-row", {
      inputStackPriority: 900,
      localRoutePriority: 2000,
      hitPriority: 1
    }));
    const lowActor = actorSystem.createActor({ id: "low-window" });
    const highActor = actorSystem.createActor({ id: "high-window" });
    registry.addComponent(lowActor, gizmoEventBindingComponentType);
    registry.addComponent(lowActor, componentType<ActorInputParticipant>("input-participant-low-titlebar"));
    registry.addComponent(highActor, gizmoEventBindingComponentType);
    registry.addComponent(highActor, componentType<ActorInputParticipant>("input-participant-high-row"));
    const system = new RuntimeGizmoEventSystem({ target: new FakeEventTarget() as unknown as EventTarget });
    const lowBinding = findRegisteredBinding(registered, "low-window:gizmo-event-binding");
    const highBinding = findRegisteredBinding(registered, "high-window:gizmo-event-binding");
    system.register(lowBinding);
    system.register(highBinding);

    const selected = selectBestHit(system, { x: 0, y: 0 });

    expect(lowBinding.priority).toBe(100);
    expect(highBinding.priority).toBe(900);
    expect(selected?.gizmo).toBe(highBinding);
    expect(selected?.hit.partId).toBe("high-row");

    system.dispose();
  });

  it("compares actor-local route score when stack priority matches", () => {
    const { actorSystem, calls, registered, registry } = createRegistry();
    registry.registerDefinition(createActorInputParticipantDefinition(calls, "low-route", {
      inputStackPriority: 500,
      localRoutePriority: 1000,
      hitPriority: 1
    }));
    registry.registerDefinition(createActorInputParticipantDefinition(calls, "high-route", {
      inputStackPriority: 500,
      localRoutePriority: 2000,
      hitPriority: 1
    }));
    const lowActor = actorSystem.createActor({ id: "low-route-actor" });
    const highActor = actorSystem.createActor({ id: "high-route-actor" });
    registry.addComponent(lowActor, gizmoEventBindingComponentType);
    registry.addComponent(lowActor, componentType<ActorInputParticipant>("input-participant-low-route"));
    registry.addComponent(highActor, gizmoEventBindingComponentType);
    registry.addComponent(highActor, componentType<ActorInputParticipant>("input-participant-high-route"));
    const system = new RuntimeGizmoEventSystem({ target: new FakeEventTarget() as unknown as EventTarget });
    const lowBinding = findRegisteredBinding(registered, "low-route-actor:gizmo-event-binding");
    const highBinding = findRegisteredBinding(registered, "high-route-actor:gizmo-event-binding");
    system.register(lowBinding);
    system.register(highBinding);

    const selected = selectBestHit(system, { x: 0, y: 0 });

    expect(lowBinding.priority).toBe(500);
    expect(highBinding.priority).toBe(500);
    expect((highBinding.hitTest({ x: 0, y: 0 })?.priority ?? 0)).toBeGreaterThan(
      lowBinding.hitTest({ x: 0, y: 0 })?.priority ?? 0
    );
    expect(selected?.gizmo).toBe(highBinding);
    expect(selected?.hit.partId).toBe("high-route");

    system.dispose();
  });

  it("keeps legacy Camera3 stack priority above lower-stack actor-local content priority", () => {
    const { actorSystem, calls, registered, registry } = createRegistry();
    registry.registerDefinition(createResponderDefinition(calls, "camera3", {
      gizmoPriority: 100,
      hitPriority: 1
    }));
    registry.registerDefinition(createActorInputParticipantDefinition(calls, "window-content", {
      inputStackPriority: 50,
      localRoutePriority: 4000,
      hitPriority: 100
    }));
    const cameraActor = actorSystem.createActor({ id: "camera" });
    const windowActor = actorSystem.createActor({ id: "window" });
    registry.addComponent(cameraActor, gizmoEventBindingComponentType);
    registry.addComponent(cameraActor, componentType<GizmoResponder>("responder-camera3"));
    registry.addComponent(windowActor, gizmoEventBindingComponentType);
    registry.addComponent(windowActor, componentType<ActorInputParticipant>("input-participant-window-content"));
    const system = new RuntimeGizmoEventSystem({ target: new FakeEventTarget() as unknown as EventTarget });
    const cameraBinding = findRegisteredBinding(registered, "camera:gizmo-event-binding");
    const windowBinding = findRegisteredBinding(registered, "window:gizmo-event-binding");
    system.register(windowBinding);
    system.register(cameraBinding);

    const selected = selectBestHit(system, { x: 0, y: 0 });

    expect(cameraBinding.priority).toBe(100);
    expect(windowBinding.priority).toBe(50);
    expect((windowBinding.hitTest({ x: 0, y: 0 })?.priority ?? 0)).toBeGreaterThan(
      cameraBinding.hitTest({ x: 0, y: 0 })?.priority ?? 0
    );
    expect(selected?.gizmo).toBe(cameraBinding);
    expect(selected?.hit.partId).toBe("camera3");

    system.dispose();
  });
});
