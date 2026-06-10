import { describe, expect, it } from "vitest";
import type {
  GizmoCancelEvent,
  GizmoClickEvent,
  GizmoController,
  GizmoHit,
  GizmoMoveEvent,
  ScreenPoint
} from "gizmo-core";
import { AppRuntimeContext } from "../../../app-runtime";
import type { Camera3CommandSink, Camera3ControlCommand } from "../../../camera3-control";
import { installGizmoRuntimeComponentDefinitions } from "../../../gizmo-runtime";
import { installStateRuntimeComponentDefinitions } from "../../../state-runtime";
import type { AppStateCommand } from "../../../editor/app-state";
import type { AppStateObserver } from "../../../editor/app-state-controller";
import type { RuntimeObject, RuntimeRegistration } from "../../../runtime/ports";
import {
  actorInputScopeRoutePriority,
  gizmoEventBindingComponentType,
  isActorInputParticipant
} from "../../../gizmo-runtime";
import { Camera3ProjectionModeController } from "../../../features/camera3/model";
import type { Camera3Gizmo, Camera3GizmoOptions } from "../camera3-gizmo";
import { camera3GizmoComponentType } from "./camera3-gizmo-component";
import { createCamera3GizmoActor } from "./camera3-gizmo-actor-factory";
import { installCamera3ComponentDefinitions } from "./install-component-definitions";

type FakeCamera3Gizmo = Camera3Gizmo & {
  cancelEvents: GizmoCancelEvent[];
};

function createRegistration(label: string, calls: string[]): RuntimeRegistration {
  return {
    dispose() {
      calls.push(label);
    }
  };
}

function createContext() {
  const calls: string[] = [];
  const registeredGizmos: GizmoController[] = [];
  const context = new AppRuntimeContext({
    sceneRuntime: {
      register(object: RuntimeObject): RuntimeRegistration {
        calls.push(`scene-register:${object.id}`);
        return createRegistration(`scene-dispose:${object.id}`, calls);
      },
      dispose(): void {
        calls.push("scene-system-dispose");
      }
    },
    gizmoEventSystem: {
      register(object: GizmoController): RuntimeRegistration {
        calls.push(`gizmo-register:${object.id}`);
        registeredGizmos.push(object);
        return createRegistration(`gizmo-dispose:${object.id}`, calls);
      },
      dispose(): void {
        calls.push("gizmo-system-dispose");
      }
    },
    frameStateController: {
      submit(_command: AppStateCommand): void {
        calls.push("frame-submit");
      },
      subscribe(_observer: AppStateObserver): RuntimeRegistration {
        calls.push("observer-subscribe");
        return createRegistration("observer-dispose", calls);
      },
      dispose(): void {
        calls.push("frame-system-dispose");
      }
    }
  });
  installGizmoRuntimeComponentDefinitions(context.componentRegistry);
  installStateRuntimeComponentDefinitions(context.componentRegistry);
  installCamera3ComponentDefinitions(context.componentRegistry);
  return { calls, context, registeredGizmos };
}

function createCommandSink(commands: Camera3ControlCommand[]): Camera3CommandSink {
  return {
    submit(command) {
      commands.push(command);
    }
  };
}

function createFakeGizmoFactory(
  calls: string[],
  commands: Camera3ControlCommand[] = [],
  hit: GizmoHit = {
    gizmoId: "camera3-view-gizmo",
    partId: "axis-x",
    kind: "axis",
    priority: 1,
    data: { axis: "+x" }
  }
) {
  const receivedOptions: Camera3GizmoOptions[] = [];
  const created: FakeCamera3Gizmo[] = [];
  const createGizmo = (options: Camera3GizmoOptions): Camera3Gizmo => {
    receivedOptions.push(options);
    const fake = {
      id: "camera3-view-gizmo",
      priority: 100,
      enabled: true,
      element: { remove: () => calls.push("element-remove") } as unknown as HTMLDivElement,
      cancelEvents: [],
      update(): void {
        calls.push("gizmo-update");
      },
      hitTest(_point: ScreenPoint): GizmoHit | null {
        return hit;
      },
      onGizmoMove(event: GizmoMoveEvent): void {
        options.commandSink.submit({
          type: "orbit-delta",
          source: "camera3-gizmo",
          dx: event.delta.dx,
          dy: event.delta.dy
        });
      },
      onGizmoDoubleClick(): void {
        options.commandSink.submit({
          type: "snap-axis",
          source: "camera3-gizmo",
          axis: "+x"
        });
      },
      onGizmoClick(event: GizmoClickEvent): void {
        if (event.hit.partId !== "projection-mode") return;
        options.commandSink.submit({
          type: "toggle-projection",
          source: "camera3-gizmo"
        });
      },
      onGizmoCancel(event: GizmoCancelEvent): void {
        fake.cancelEvents.push(event);
        calls.push(`gizmo-cancel:${event.reason}`);
      },
      dispose(): void {
        calls.push("gizmo-dispose");
        fake.element.remove();
      }
    } as unknown as FakeCamera3Gizmo;
    created.push(fake);
    return fake;
  };
  return { createGizmo, created, receivedOptions, commands };
}

function createMoveEvent(gizmo: GizmoController, hit: GizmoHit): GizmoMoveEvent {
  return {
    gizmo,
    hit,
    pointerId: 1,
    pointerType: "mouse",
    timeStamp: 0,
    point: { x: 0, y: 0 },
    startPoint: { x: 0, y: 0 },
    buttons: 1,
    delta: { dx: 3, dy: 4 },
    totalDelta: { dx: 3, dy: 4 },
    isDragging: true
  };
}

function createClickEvent(gizmo: GizmoController, hit: GizmoHit): GizmoClickEvent {
  return {
    gizmo,
    hit,
    pointerId: 1,
    pointerType: "mouse",
    timeStamp: 0,
    point: { x: 0, y: 0 },
    startPoint: { x: 0, y: 0 },
    buttons: 0,
    clickCount: 1
  };
}

describe("createCamera3GizmoActor", () => {
  it("creates an actor and returns a RegisteredActor handle", () => {
    const { context } = createContext();
    const commands: Camera3ControlCommand[] = [];
    const { createGizmo } = createFakeGizmoFactory([], commands);

    const handle = createCamera3GizmoActor(context, {
      actorId: "camera-actor",
      projectionMode: new Camera3ProjectionModeController(),
      commandSink: createCommandSink(commands)
    }, createGizmo);

    expect(handle.actor.id).toBe("camera-actor");
    expect(handle.component.type).toBe(camera3GizmoComponentType);
    expect(isActorInputParticipant(handle.component)).toBe(true);
    expect(context.actorSystem.getActor("camera-actor")).toBe(handle.actor);
  });

  it("parents the actor when parentActor is provided", () => {
    const { context } = createContext();
    const sceneActor = context.actorSystem.createActor({ id: "scene-window" });
    const commands: Camera3ControlCommand[] = [];
    const { createGizmo } = createFakeGizmoFactory([], commands);

    const handle = createCamera3GizmoActor(context, {
      actorId: "camera-actor",
      parentActor: sceneActor,
      projectionMode: new Camera3ProjectionModeController(),
      commandSink: createCommandSink(commands)
    }, createGizmo);

    expect(context.actorSystem.getParent(handle.actor)).toBe(sceneActor);
  });

  it("auto-adds GizmoEventBindingComponent and registers the binding only once", () => {
    const { calls, context, registeredGizmos } = createContext();
    const { createGizmo } = createFakeGizmoFactory(calls);

    const handle = createCamera3GizmoActor(context, {
      actorId: "camera-actor",
      projectionMode: new Camera3ProjectionModeController(),
      commandSink: createCommandSink([])
    }, createGizmo);

    expect(handle.actor.hasComponent(gizmoEventBindingComponentType)).toBe(true);
    expect(registeredGizmos).toHaveLength(1);
    expect(calls.filter((call) => call.startsWith("gizmo-register:"))).toEqual([
      "gizmo-register:camera-actor:gizmo-event-binding"
    ]);
  });

  it("passes the configured parent element to the wrapped gizmo", () => {
    const { context } = createContext();
    const parent = { id: "scene-overlay" } as unknown as HTMLElement;
    const { createGizmo, receivedOptions } = createFakeGizmoFactory([]);

    createCamera3GizmoActor(context, {
      actorId: "camera-actor",
      projectionMode: new Camera3ProjectionModeController(),
      commandSink: createCommandSink([]),
      parent
    }, createGizmo);

    expect(receivedOptions).toHaveLength(1);
    expect(receivedOptions[0]?.parent).toBe(parent);
  });

  it("routes move and double-click events through the binding to the wrapped gizmo", () => {
    const { context, registeredGizmos } = createContext();
    const commands: Camera3ControlCommand[] = [];
    const { createGizmo } = createFakeGizmoFactory([], commands);
    createCamera3GizmoActor(context, {
      actorId: "camera-actor",
      projectionMode: new Camera3ProjectionModeController(),
      commandSink: createCommandSink(commands)
    }, createGizmo);
    const binding = registeredGizmos[0];
    if (!binding) throw new Error("Expected registered binding.");
    const hit = binding.hitTest({ x: 0, y: 0 });
    if (!hit) throw new Error("Expected binding hit.");
    const actorInputHit = (hit.data as { actorInputHit?: { region?: string; data?: { gizmoHit?: GizmoHit } } })
      .actorInputHit;
    expect(actorInputHit?.region).toBe("actor-overlay");
    expect((actorInputHit as { scopeRoutePriority?: number } | undefined)?.scopeRoutePriority).toBe(
      actorInputScopeRoutePriority.actorOverlay
    );
    expect(actorInputHit?.data?.gizmoHit?.kind).toBe("axis");

    binding.onGizmoStart?.(createMoveEvent(binding, hit));
    binding.onGizmoMove?.(createMoveEvent(binding, hit));
    binding.onGizmoDoubleClick?.({
      ...createMoveEvent(binding, hit),
      clickCount: 2
    });

    expect(commands).toEqual([
      { type: "orbit-delta", source: "camera3-gizmo", dx: 3, dy: 4 },
      { type: "snap-axis", source: "camera3-gizmo", axis: "+x" }
    ]);
  });

  it("routes projection mode clicks through actor input instead of DOM click handlers", () => {
    const { context, registeredGizmos } = createContext();
    const commands: Camera3ControlCommand[] = [];
    const { createGizmo } = createFakeGizmoFactory([], commands, {
      gizmoId: "camera3-view-gizmo",
      partId: "projection-mode",
      kind: "custom",
      priority: 20
    });
    createCamera3GizmoActor(context, {
      actorId: "camera-actor",
      projectionMode: new Camera3ProjectionModeController(),
      commandSink: createCommandSink(commands)
    }, createGizmo);
    const binding = registeredGizmos[0];
    if (!binding) throw new Error("Expected registered binding.");
    const hit = binding.hitTest({ x: 0, y: 0 });
    if (!hit) throw new Error("Expected binding hit.");

    binding.onGizmoClick?.(createClickEvent(binding, hit));

    expect(commands).toEqual([
      { type: "toggle-projection", source: "camera3-gizmo" }
    ]);
  });

  it("disposes the actor handle and wrapped gizmo", () => {
    const { calls, context } = createContext();
    const { createGizmo } = createFakeGizmoFactory(calls);
    const handle = createCamera3GizmoActor(context, {
      actorId: "camera-actor",
      projectionMode: new Camera3ProjectionModeController(),
      commandSink: createCommandSink([])
    }, createGizmo);
    calls.length = 0;

    handle.dispose();
    handle.dispose();

    expect(context.actorSystem.getActor("camera-actor")).toBeNull();
    expect(calls).toEqual([
      "gizmo-dispose",
      "element-remove",
      "gizmo-dispose:camera-actor:gizmo-event-binding"
    ]);
  });

  it("cancels active drag when the actor is destroyed", () => {
    const { calls, context, registeredGizmos } = createContext();
    const { createGizmo } = createFakeGizmoFactory(calls);
    const handle = createCamera3GizmoActor(context, {
      actorId: "camera-actor",
      projectionMode: new Camera3ProjectionModeController(),
      commandSink: createCommandSink([])
    }, createGizmo);
    const binding = registeredGizmos[0];
    if (!binding) throw new Error("Expected registered binding.");
    const hit = binding.hitTest({ x: 0, y: 0 });
    if (!hit) throw new Error("Expected binding hit.");
    binding.onGizmoStart?.({
      ...createMoveEvent(binding, hit)
    });
    calls.length = 0;

    handle.dispose();

    expect(calls).toEqual([
      "gizmo-cancel:gizmo-disabled",
      "gizmo-dispose",
      "element-remove",
      "gizmo-dispose:camera-actor:gizmo-event-binding"
    ]);
  });
});



