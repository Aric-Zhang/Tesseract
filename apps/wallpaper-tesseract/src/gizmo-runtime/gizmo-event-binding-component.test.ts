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
import type { ActorWindowFocusService, Component, ComponentDefinition } from "../actor-runtime";
import type { RuntimeRegistration, SceneStateObserver } from "../scene-runtime";
import {
  createRecordingRuntimeRegistration,
  createTestComponentRegistry
} from "../test-support";
import { actorInputScopeRoutePriority, type ActorInputHit, type ActorInputHitRegion } from "./actor-input-hit";
import type { ActorInputParticipant } from "./actor-input-participant";
import { gizmoEventBindingComponentType } from "./gizmo-event-binding-component";
import { gizmoEventBindingComponentDefinition } from "./gizmo-event-binding-definition";

function createRegistry(options: { actorWindowFocus?: ActorWindowFocusService } = {}) {
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
  const { actorSystem, registry } = createTestComponentRegistry({
    bridge,
    actorWindowFocus: options.actorWindowFocus
  });
  registry.registerDefinition(gizmoEventBindingComponentDefinition);
  return { actorSystem, calls, registered, registry };
}

function createActorInputHit(componentId: string, label: string, options: {
  region?: ActorInputHitRegion;
  scopeRoutePriority?: number;
  localRoutePriority?: number;
  hitPriority?: number;
  path?: ActorInputHit["path"];
} = {}): ActorInputHit {
  return {
    componentId,
    partId: label,
    kind: "control",
    region: options.region ?? "content-control",
    scopeRoutePriority: options.scopeRoutePriority,
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
    region?: ActorInputHitRegion;
    scopeRoutePriority?: number;
    localRoutePriority?: number;
    hitPriority?: number;
    path?: ActorInputHit["path"];
    enabled?: boolean;
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
        region: options.region,
        scopeRoutePriority: options.scopeRoutePriority,
        localRoutePriority: options.localRoutePriority,
        hitPriority: options.hitPriority,
        path: options.path
      });
      return {
        id: `${label}-participant`,
        type,
        actor,
        enabled: options.enabled ?? true,
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
        onInputEnd(event): void {
          calls.push(`input-end:${label}:${event.hit.componentId}:${event.hit.partId}:${event.wasClick}`);
        },
        onInputCancel(event): void {
          calls.push(`input-cancel:${label}:${event.reason}`);
        },
        onInputClick(event): void {
          calls.push(`input-click:${label}:${event.hit.componentId}:${event.hit.partId}:${event.clickCount}`);
        },
        onInputDoubleClick(event): void {
          calls.push(`input-double-click:${label}:${event.hit.componentId}:${event.hit.partId}:${event.clickCount}`);
        },
        onDetach(): void {
          calls.push(`input-detach:${label}`);
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

  it("exposes actor input participant hits through the actor-level binding controller", () => {
    const { actorSystem, calls, registered, registry } = createRegistry();
    registry.registerDefinition(createActorInputParticipantDefinition(calls, "body", {
      inputStackPriority: 10,
      inputPriority: 10,
      hitPriority: 2
    }));
    const actor = actorSystem.createActor({ id: "actor" });
    registry.addComponent(actor, gizmoEventBindingComponentType);
    registry.addComponent(actor, componentType<ActorInputParticipant>("input-participant-body"));
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
      targetComponentId: "body-participant",
      actorInputHit: {
        componentId: "body-participant",
        partId: "body",
        hitPriority: 2
      }
    });
    binding.onGizmoStart?.(createStartEvent(binding, hit));
    expect(calls).toEqual(["input-hit:body", "input-start:body:body-participant:body"]);
  });

  it("does not hit test when the actor is inactive through its parent", () => {
    const { actorSystem, calls, registered, registry } = createRegistry();
    registry.registerDefinition(createActorInputParticipantDefinition(calls, "body", {
      inputStackPriority: 10,
      inputPriority: 10,
      hitPriority: 2
    }));
    const parent = actorSystem.createActor({ id: "parent" });
    const actor = actorSystem.createActor({ id: "actor", parent });
    registry.addComponent(actor, gizmoEventBindingComponentType);
    registry.addComponent(actor, componentType<ActorInputParticipant>("input-participant-body"));
    const binding = getRegisteredBinding(registered);
    calls.length = 0;

    parent.enabled = false;
    expect(binding.hitTest({ x: 0, y: 0 })).toBeNull();
    expect(binding.enabled).toBe(false);

    parent.enabled = true;
    expect(binding.enabled).toBe(true);
    expect(binding.hitTest({ x: 0, y: 0 })?.partId).toBe("body");
    expect(calls).toEqual(["input-hit:body"]);
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

  it("selects the participant with the highest actor-local input priority", () => {
    const { actorSystem, registered, registry } = createRegistry();
    registry.registerDefinition(createActorInputParticipantDefinition([], "low", { inputPriority: 1 }));
    registry.registerDefinition(createActorInputParticipantDefinition([], "high", { inputPriority: 10 }));
    const actor = actorSystem.createActor({ id: "actor" });
    registry.addComponent(actor, gizmoEventBindingComponentType);
    registry.addComponent(actor, componentType<ActorInputParticipant>("input-participant-low"));
    registry.addComponent(actor, componentType<ActorInputParticipant>("input-participant-high"));

    const hit = getRegisteredBinding(registered).hitTest({ x: 0, y: 0 });

    expect(hit?.partId).toBe("high");
  });

  it("uses hit priority when actor-local participant priorities match", () => {
    const { actorSystem, registered, registry } = createRegistry();
    registry.registerDefinition(createActorInputParticipantDefinition([], "low-hit", {
      inputPriority: 10,
      hitPriority: 1
    }));
    registry.registerDefinition(createActorInputParticipantDefinition([], "high-hit", {
      inputPriority: 10,
      hitPriority: 5
    }));
    const actor = actorSystem.createActor({ id: "actor" });
    registry.addComponent(actor, gizmoEventBindingComponentType);
    registry.addComponent(actor, componentType<ActorInputParticipant>("input-participant-low-hit"));
    registry.addComponent(actor, componentType<ActorInputParticipant>("input-participant-high-hit"));

    const hit = getRegisteredBinding(registered).hitTest({ x: 0, y: 0 });

    expect(hit?.partId).toBe("high-hit");
  });

  it("uses participant attach order as the final actor-local tie breaker", () => {
    const { actorSystem, registered, registry } = createRegistry();
    registry.registerDefinition(createActorInputParticipantDefinition([], "first", { inputPriority: 10 }));
    registry.registerDefinition(createActorInputParticipantDefinition([], "second", { inputPriority: 10 }));
    const actor = actorSystem.createActor({ id: "actor" });
    registry.addComponent(actor, gizmoEventBindingComponentType);
    registry.addComponent(actor, componentType<ActorInputParticipant>("input-participant-first"));
    registry.addComponent(actor, componentType<ActorInputParticipant>("input-participant-second"));

    const hit = getRegisteredBinding(registered).hitTest({ x: 0, y: 0 });

    expect(hit?.partId).toBe("second");
  });

  it("keeps binding priority equal to the highest enabled participant stack priority", () => {
    const { actorSystem, registered, registry } = createRegistry();
    registry.registerDefinition(createActorInputParticipantDefinition([], "low", { inputStackPriority: 3 }));
    registry.registerDefinition(createActorInputParticipantDefinition([], "high", { inputStackPriority: 12 }));
    const actor = actorSystem.createActor({ id: "actor" });
    registry.addComponent(actor, gizmoEventBindingComponentType);
    registry.addComponent(actor, componentType<ActorInputParticipant>("input-participant-low"));
    const high = registry.addComponent(actor, componentType<ActorInputParticipant>("input-participant-high"));
    const binding = getRegisteredBinding(registered);

    expect(binding.priority).toBe(12);
    high.enabled = false;
    expect(binding.priority).toBe(3);
  });

  it("exposes stack priority on the binding and scope route score on the hit", () => {
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
    expect(hit?.priority).toBeGreaterThan(actorInputScopeRoutePriority.contentControl);
    expect(hit?.priority).toBeLessThan(actorInputScopeRoutePriority.actorOverlay * 1_000_000);
    expect(hit?.data).toMatchObject({
      targetComponentId: "route-participant",
      actorInputHit: {
        componentId: "route-participant",
        localRoutePriority: 2000
      }
    });
  });

  it("uses inherited owning window priority instead of local actor stack priority", () => {
    const { actorSystem, calls, registered, registry } = createRegistry({
      actorWindowFocus: {
        getEffectiveStackPriorityForActor(actor) {
          return actor.id === "scene-child" ? 300 : null;
        },
        focusActorWindow(): void {},
        requestFocusOnVisible(): void {}
      }
    });
    registry.registerDefinition(createActorInputParticipantDefinition(calls, "camera3", {
      inputStackPriority: 5000,
      inputPriority: 0,
      localRoutePriority: 2000
    }));
    const actor = actorSystem.createActor({ id: "scene-child" });
    registry.addComponent(actor, gizmoEventBindingComponentType);
    registry.addComponent(actor, componentType<ActorInputParticipant>("input-participant-camera3"));
    const binding = getRegisteredBinding(registered);

    const hit = binding.hitTest({ x: 0, y: 0 });

    expect(binding.priority).toBe(300);
    expect(hit?.partId).toBe("camera3");
    expect(hit?.priority).toBeGreaterThan(5000);
  });

  it("does not let a high local-priority child actor beat a foreground window", () => {
    const { actorSystem, calls, registered, registry } = createRegistry({
      actorWindowFocus: {
        getEffectiveStackPriorityForActor(actor) {
          if (actor.id === "scene-child") return 300;
          if (actor.id === "foreground-window") return 900;
          return null;
        },
        focusActorWindow(): void {},
        requestFocusOnVisible(): void {}
      }
    });
    registry.registerDefinition(createActorInputParticipantDefinition(calls, "camera3", {
      inputStackPriority: 5000,
      localRoutePriority: 5000,
      hitPriority: 1000
    }));
    registry.registerDefinition(createActorInputParticipantDefinition(calls, "foreground-titlebar", {
      inputStackPriority: 10,
      localRoutePriority: 100,
      hitPriority: 1
    }));
    const sceneChild = actorSystem.createActor({ id: "scene-child" });
    const foregroundWindow = actorSystem.createActor({ id: "foreground-window" });
    registry.addComponent(sceneChild, gizmoEventBindingComponentType);
    registry.addComponent(sceneChild, componentType<ActorInputParticipant>("input-participant-camera3"));
    registry.addComponent(foregroundWindow, gizmoEventBindingComponentType);
    registry.addComponent(
      foregroundWindow,
      componentType<ActorInputParticipant>("input-participant-foreground-titlebar")
    );
    const system = new RuntimeGizmoEventSystem({ target: new FakeEventTarget() as unknown as EventTarget });
    const childBinding = findRegisteredBinding(registered, "scene-child:gizmo-event-binding");
    const foregroundBinding = findRegisteredBinding(registered, "foreground-window:gizmo-event-binding");
    system.register(childBinding);
    system.register(foregroundBinding);

    const selected = selectBestHit(system, { x: 0, y: 0 });

    expect(childBinding.priority).toBe(300);
    expect(foregroundBinding.priority).toBe(900);
    expect(selected?.gizmo).toBe(foregroundBinding);
    expect(selected?.hit.partId).toBe("foreground-titlebar");

    system.dispose();
  });

  it("keeps non-window actors such as App Menu on their own stack priority", () => {
    const { actorSystem, calls, registered, registry } = createRegistry({
      actorWindowFocus: {
        getEffectiveStackPriorityForActor(actor) {
          return actor.id === "scene-child" ? 900 : null;
        },
        focusActorWindow(): void {},
        requestFocusOnVisible(): void {}
      }
    });
    registry.registerDefinition(createActorInputParticipantDefinition(calls, "camera3", {
      inputStackPriority: 5000,
      localRoutePriority: 5000,
      hitPriority: 1000
    }));
    registry.registerDefinition(createActorInputParticipantDefinition(calls, "app-menu", {
      inputStackPriority: 10_000,
      localRoutePriority: 100,
      hitPriority: 1
    }));
    const sceneChild = actorSystem.createActor({ id: "scene-child" });
    const appMenu = actorSystem.createActor({ id: "app-menu" });
    registry.addComponent(sceneChild, gizmoEventBindingComponentType);
    registry.addComponent(sceneChild, componentType<ActorInputParticipant>("input-participant-camera3"));
    registry.addComponent(appMenu, gizmoEventBindingComponentType);
    registry.addComponent(appMenu, componentType<ActorInputParticipant>("input-participant-app-menu"));
    const system = new RuntimeGizmoEventSystem({ target: new FakeEventTarget() as unknown as EventTarget });
    const childBinding = findRegisteredBinding(registered, "scene-child:gizmo-event-binding");
    const appMenuBinding = findRegisteredBinding(registered, "app-menu:gizmo-event-binding");
    system.register(childBinding);
    system.register(appMenuBinding);

    const selected = selectBestHit(system, { x: 0, y: 0 });

    expect(childBinding.priority).toBe(900);
    expect(appMenuBinding.priority).toBe(10_000);
    expect(selected?.gizmo).toBe(appMenuBinding);
    expect(selected?.hit.partId).toBe("app-menu");

    system.dispose();
  });

  it("returns null for disabled actors and ignores disabled participants", () => {
    const { actorSystem, registered, registry } = createRegistry();
    registry.registerDefinition(createActorInputParticipantDefinition([], "disabled", {
      enabled: false,
      inputStackPriority: 100,
      inputPriority: 100
    }));
    registry.registerDefinition(createActorInputParticipantDefinition([], "enabled", {
      inputStackPriority: 1,
      inputPriority: 1
    }));
    const actor = actorSystem.createActor({ id: "actor" });
    registry.addComponent(actor, gizmoEventBindingComponentType);
    registry.addComponent(actor, componentType<ActorInputParticipant>("input-participant-disabled"));
    registry.addComponent(actor, componentType<ActorInputParticipant>("input-participant-enabled"));
    const binding = getRegisteredBinding(registered);

    expect(binding.hitTest({ x: 0, y: 0 })?.partId).toBe("enabled");
    actor.enabled = false;
    expect(binding.hitTest({ x: 0, y: 0 })).toBeNull();
  });

  it("focuses the owning window once when input starts", () => {
    const focusCalls: string[] = [];
    const { actorSystem, calls, registered, registry } = createRegistry({
      actorWindowFocus: {
        getEffectiveStackPriorityForActor() {
          return null;
        },
        focusActorWindow(actor, reason): void {
          focusCalls.push(`${actor.id}:${reason}`);
        },
        requestFocusOnVisible(): void {}
      }
    });
    registry.registerDefinition(createActorInputParticipantDefinition(calls, "row"));
    const actor = actorSystem.createActor({ id: "hierarchy-window" });
    registry.addComponent(actor, gizmoEventBindingComponentType);
    registry.addComponent(actor, componentType<ActorInputParticipant>("input-participant-row"));
    const binding = getRegisteredBinding(registered);
    const hit = binding.hitTest({ x: 0, y: 0 });
    if (!hit) throw new Error("Expected hit.");

    binding.onGizmoStart?.(createStartEvent(binding, hit));
    binding.onGizmoMove?.(createMoveEvent(binding, hit));
    binding.onGizmoClick?.(createClickEvent(binding, hit, 1));
    binding.onGizmoEnd?.({ ...createMoveEvent(binding, hit), wasClick: false });

    expect(focusCalls).toEqual(["hierarchy-window:pointer-down"]);
  });

  it("does not focus or start input when actor becomes inactive before start", () => {
    const focusCalls: string[] = [];
    const { actorSystem, calls, registered, registry } = createRegistry({
      actorWindowFocus: {
        getEffectiveStackPriorityForActor() {
          return null;
        },
        focusActorWindow(actor, reason): void {
          focusCalls.push(`${actor.id}:${reason}`);
        },
        requestFocusOnVisible(): void {}
      }
    });
    registry.registerDefinition(createActorInputParticipantDefinition(calls, "row"));
    const actor = actorSystem.createActor({ id: "hierarchy-window" });
    registry.addComponent(actor, gizmoEventBindingComponentType);
    registry.addComponent(actor, componentType<ActorInputParticipant>("input-participant-row"));
    const binding = getRegisteredBinding(registered);
    const hit = binding.hitTest({ x: 0, y: 0 });
    if (!hit) throw new Error("Expected hit.");
    calls.length = 0;
    actor.enabled = false;

    binding.onGizmoStart?.(createStartEvent(binding, hit));

    expect(focusCalls).toEqual([]);
    expect(calls).toEqual([]);
  });

  it("cancels the active participant before it is detached", () => {
    const { actorSystem, calls, registered, registry } = createRegistry();
    registry.registerDefinition(createActorInputParticipantDefinition(calls, "active", { inputStackPriority: 10 }));
    const actor = actorSystem.createActor({ id: "actor" });
    registry.addComponent(actor, gizmoEventBindingComponentType);
    const participant = registry.addComponent(actor, componentType<ActorInputParticipant>("input-participant-active"));
    const binding = getRegisteredBinding(registered);
    const hit = binding.hitTest({ x: 0, y: 0 });
    if (!hit) throw new Error("Expected hit.");
    binding.onGizmoStart?.(createStartEvent(binding, hit));
    calls.length = 0;

    registry.removeComponent(actor, participant);

    expect(calls).toEqual([
      "input-cancel:active:gizmo-disabled",
      "input-detach:active",
      "input-dispose:active"
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

  it("cancels the active participant when the actor is destroyed", () => {
    const { actorSystem, calls, registered, registry } = createRegistry();
    registry.registerDefinition(createActorInputParticipantDefinition(calls, "active", { inputStackPriority: 10 }));
    const actor = actorSystem.createActor({ id: "actor" });
    registry.addComponent(actor, gizmoEventBindingComponentType);
    registry.addComponent(actor, componentType<ActorInputParticipant>("input-participant-active"));
    const binding = getRegisteredBinding(registered);
    const hit = binding.hitTest({ x: 0, y: 0 });
    if (!hit) throw new Error("Expected hit.");
    binding.onGizmoStart?.(createStartEvent(binding, hit));
    calls.length = 0;

    actorSystem.destroyActor(actor);

    expect(calls).toEqual([
      "input-cancel:active:gizmo-disabled",
      "input-detach:active",
      "input-dispose:active",
      "gizmo-dispose:actor:gizmo-event-binding"
    ]);
  });

  it("cancels the active participant when the binding is disposed", () => {
    const { actorSystem, calls, registered, registry } = createRegistry();
    registry.registerDefinition(createActorInputParticipantDefinition(calls, "active", { inputStackPriority: 10 }));
    const actor = actorSystem.createActor({ id: "actor" });
    const bindingComponent = registry.addComponent(actor, gizmoEventBindingComponentType);
    registry.addComponent(actor, componentType<ActorInputParticipant>("input-participant-active"));
    const binding = getRegisteredBinding(registered);
    const hit = binding.hitTest({ x: 0, y: 0 });
    if (!hit) throw new Error("Expected hit.");
    binding.onGizmoStart?.(createStartEvent(binding, hit));
    calls.length = 0;

    registry.removeComponent(actor, bindingComponent);

    expect(calls).toEqual([
      "gizmo-dispose:actor:gizmo-event-binding",
      "input-cancel:active:system-dispose"
    ]);
  });

  it("forwards click and double-click to the selected participant hit", () => {
    const { actorSystem, calls, registered, registry } = createRegistry();
    registry.registerDefinition(createActorInputParticipantDefinition(calls, "active", { inputStackPriority: 10 }));
    const actor = actorSystem.createActor({ id: "actor" });
    registry.addComponent(actor, gizmoEventBindingComponentType);
    registry.addComponent(actor, componentType<ActorInputParticipant>("input-participant-active"));
    const binding = getRegisteredBinding(registered);
    const hit = binding.hitTest({ x: 0, y: 0 });
    if (!hit) throw new Error("Expected hit.");
    calls.length = 0;

    binding.onGizmoClick?.(createClickEvent(binding, hit, 1));
    binding.onGizmoDoubleClick?.(createClickEvent(binding, hit, 2));

    expect(calls).toEqual([
      "input-click:active:active-participant:active:1",
      "input-double-click:active:active-participant:active:2"
    ]);
  });

  it("does not forward move after the active participant has been removed", () => {
    const { actorSystem, calls, registered, registry } = createRegistry();
    registry.registerDefinition(createActorInputParticipantDefinition(calls, "active", { inputStackPriority: 10 }));
    const actor = actorSystem.createActor({ id: "actor" });
    registry.addComponent(actor, gizmoEventBindingComponentType);
    const participant = registry.addComponent(actor, componentType<ActorInputParticipant>("input-participant-active"));
    const binding = getRegisteredBinding(registered);
    const hit = binding.hitTest({ x: 0, y: 0 });
    if (!hit) throw new Error("Expected hit.");
    binding.onGizmoStart?.(createStartEvent(binding, hit));
    registry.removeComponent(actor, participant);
    calls.length = 0;

    binding.onGizmoMove?.(createMoveEvent(binding, hit));

    expect(calls).toEqual([]);
  });

  it("does not cancel active interaction when a non-active participant is removed", () => {
    const { actorSystem, calls, registered, registry } = createRegistry();
    registry.registerDefinition(createActorInputParticipantDefinition(calls, "inactive", { inputStackPriority: 1 }));
    registry.registerDefinition(createActorInputParticipantDefinition(calls, "active", { inputStackPriority: 10 }));
    const actor = actorSystem.createActor({ id: "actor" });
    registry.addComponent(actor, gizmoEventBindingComponentType);
    const inactive = registry.addComponent(actor, componentType<ActorInputParticipant>("input-participant-inactive"));
    registry.addComponent(actor, componentType<ActorInputParticipant>("input-participant-active"));
    const binding = getRegisteredBinding(registered);
    const hit = binding.hitTest({ x: 0, y: 0 });
    if (!hit) throw new Error("Expected hit.");
    binding.onGizmoStart?.(createStartEvent(binding, hit));
    calls.length = 0;

    registry.removeComponent(actor, inactive);

    expect(calls).toEqual(["input-detach:inactive", "input-dispose:inactive"]);
  });

  it("keeps cross-actor hit selection ordered by binding priority before hit priority", () => {
    const { actorSystem, registered, registry } = createRegistry();
    registry.registerDefinition(createActorInputParticipantDefinition([], "low", {
      inputStackPriority: 100,
      hitPriority: 1000
    }));
    registry.registerDefinition(createActorInputParticipantDefinition([], "high", {
      inputStackPriority: 900,
      hitPriority: 1
    }));
    const lowActor = actorSystem.createActor({ id: "low" });
    const highActor = actorSystem.createActor({ id: "high" });
    registry.addComponent(lowActor, gizmoEventBindingComponentType);
    registry.addComponent(lowActor, componentType<ActorInputParticipant>("input-participant-low"));
    registry.addComponent(highActor, gizmoEventBindingComponentType);
    registry.addComponent(highActor, componentType<ActorInputParticipant>("input-participant-high"));
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

  it("does not let actor-local route score escape same-stack cross-actor selection", () => {
    const { actorSystem, calls, registered, registry } = createRegistry();
    registry.registerDefinition(createActorInputParticipantDefinition(calls, "content-fallback", {
      inputStackPriority: 500,
      region: "window-content",
      scopeRoutePriority: actorInputScopeRoutePriority.windowContent,
      localRoutePriority: 5000,
      hitPriority: 100
    }));
    registry.registerDefinition(createActorInputParticipantDefinition(calls, "overlay-control", {
      inputStackPriority: 500,
      region: "actor-overlay",
      scopeRoutePriority: actorInputScopeRoutePriority.actorOverlay,
      localRoutePriority: 0,
      hitPriority: 1
    }));
    const overlayActor = actorSystem.createActor({ id: "overlay-actor" });
    const contentActor = actorSystem.createActor({ id: "content-actor" });
    registry.addComponent(overlayActor, gizmoEventBindingComponentType);
    registry.addComponent(overlayActor, componentType<ActorInputParticipant>("input-participant-overlay-control"));
    registry.addComponent(contentActor, gizmoEventBindingComponentType);
    registry.addComponent(contentActor, componentType<ActorInputParticipant>("input-participant-content-fallback"));
    const system = new RuntimeGizmoEventSystem({ target: new FakeEventTarget() as unknown as EventTarget });
    const overlayBinding = findRegisteredBinding(registered, "overlay-actor:gizmo-event-binding");
    const contentBinding = findRegisteredBinding(registered, "content-actor:gizmo-event-binding");
    system.register(overlayBinding);
    system.register(contentBinding);

    const selected = selectBestHit(system, { x: 0, y: 0 });

    expect(contentBinding.priority).toBe(500);
    expect(overlayBinding.priority).toBe(500);
    expect((contentBinding.hitTest({ x: 0, y: 0 })?.priority ?? 0)).toBeLessThan(
      overlayBinding.hitTest({ x: 0, y: 0 })?.priority ?? 0
    );
    expect(selected?.gizmo).toBe(overlayBinding);
    expect(selected?.hit.partId).toBe("overlay-control");

    system.dispose();
  });

  it("routes Scene-window Camera3 overlay ahead of the Scene window content fallback", () => {
    const { actorSystem, calls, registered, registry } = createRegistry({
      actorWindowFocus: {
        getEffectiveStackPriorityForActor(actor) {
          return actor.id === "scene-window" || actor.id === "camera3" ? 2000 : null;
        },
        focusActorWindow(): void {},
        requestFocusOnVisible(): void {}
      }
    });
    registry.registerDefinition(createActorInputParticipantDefinition(calls, "camera3-orbit", {
      inputStackPriority: 100,
      region: "actor-overlay",
      scopeRoutePriority: actorInputScopeRoutePriority.actorOverlay,
      localRoutePriority: 0,
      hitPriority: 0
    }));
    registry.registerDefinition(createActorInputParticipantDefinition(calls, "window-content", {
      inputStackPriority: 2000,
      region: "window-content",
      scopeRoutePriority: actorInputScopeRoutePriority.windowContent,
      localRoutePriority: 5000,
      hitPriority: 100
    }));
    const sceneWindow = actorSystem.createActor({ id: "scene-window" });
    const camera3 = actorSystem.createActor({ id: "camera3", parent: sceneWindow });
    registry.addComponent(sceneWindow, gizmoEventBindingComponentType);
    registry.addComponent(sceneWindow, componentType<ActorInputParticipant>("input-participant-window-content"));
    registry.addComponent(camera3, gizmoEventBindingComponentType);
    registry.addComponent(camera3, componentType<ActorInputParticipant>("input-participant-camera3-orbit"));
    const system = new RuntimeGizmoEventSystem({ target: new FakeEventTarget() as unknown as EventTarget });
    const sceneBinding = findRegisteredBinding(registered, "scene-window:gizmo-event-binding");
    const cameraBinding = findRegisteredBinding(registered, "camera3:gizmo-event-binding");
    system.register(sceneBinding);
    system.register(cameraBinding);

    const selected = selectBestHit(system, { x: 0, y: 0 });

    expect(sceneBinding.priority).toBe(2000);
    expect(cameraBinding.priority).toBe(2000);
    expect((sceneBinding.hitTest({ x: 0, y: 0 })?.priority ?? 0)).toBeLessThan(
      cameraBinding.hitTest({ x: 0, y: 0 })?.priority ?? 0
    );
    expect(selected?.gizmo).toBe(cameraBinding);
    expect(selected?.hit.partId).toBe("camera3-orbit");

    system.dispose();
  });

  it("keeps Camera3 participant stack priority above lower-stack actor-local content priority", () => {
    const { actorSystem, calls, registered, registry } = createRegistry();
    registry.registerDefinition(createActorInputParticipantDefinition(calls, "camera3", {
      inputStackPriority: 100,
      inputPriority: 100,
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
    registry.addComponent(cameraActor, componentType<ActorInputParticipant>("input-participant-camera3"));
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
