import { describe, expect, it } from "vitest";
import type {
  GizmoCancelEvent,
  GizmoClickEvent,
  GizmoController,
  GizmoEndEvent,
  GizmoHit,
  GizmoMoveEvent,
  GizmoStartEvent,
  ScreenPoint
} from "actor-system/gizmo";
import {
  ActorSystem,
  ComponentRegistry,
  installComponentDefinition,
  type ActorCreationContext,
  type Component,
  type ComponentAttachmentDescriptor,
  type ComponentAttachmentRegistration,
  type ComponentAttachmentRuntime,
  type RegisteredActor
} from "actor-system/core";
import {
  ActiveInputCancellationRuntime,
  actorInputScopeRoutePriority,
  gizmoEventBindingComponentDefinition,
  gizmoEventBindingComponentType,
  GizmoControllerAttachmentRuntime,
  isActorInputParticipant
} from "actor-system/input";
import { installActorUiComponentDefinitions } from "ui-framework/actor-ui";
import { installControlComponentDefinitions } from "ui-framework/controls";
import { installMenuComponentDefinitions } from "ui-framework/menu";
import { installThemeComponentDefinitions } from "ui-framework/theme";
import { uiElementComponentType } from "ui-framework/actor-ui";
import type {
  RuntimeCameraCommandSink,
  RuntimeCameraControlCommand,
  RuntimeCameraViewState
} from "runtime-core";
import type { Camera3Gizmo, Camera3GizmoOptions } from "../camera3-gizmo";
import { camera3GizmoComponentType } from "./camera3-gizmo-component";
import { createCamera3GizmoActor } from "./camera3-gizmo-actor-factory";
import { installCamera3ComponentDefinitions } from "./install-component-definitions";

type FakeCamera3Gizmo = Camera3Gizmo & {
  cancelEvents: GizmoCancelEvent[];
  updateStates: RuntimeCameraViewState[];
};

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

class FakeDocument {
  createElement(tagName: string): FakeElement {
    return new FakeElement(this, tagName);
  }
}

class FakeElement {
  readonly ownerDocument: FakeDocument;
  readonly tagName: string;
  readonly dataset: Record<string, string | undefined> = {};
  readonly style: Record<string, string | undefined> = {};
  readonly children: unknown[] = [];
  className = "";
  parentElement: FakeElement | null = null;

  constructor(ownerDocument: FakeDocument, tagName: string) {
    this.ownerDocument = ownerDocument;
    this.tagName = tagName;
  }

  append(...children: Array<{ remove(): void; parentElement?: FakeElement | null }>): void {
    for (const child of children) {
      child.remove();
      child.parentElement = this;
      this.children.push(child);
    }
  }

  remove(): void {
    if (!this.parentElement) return;
    const index = this.parentElement.children.indexOf(this);
    if (index >= 0) {
      this.parentElement.children.splice(index, 1);
    }
    this.parentElement = null;
  }
}

function createRegistration(label: string, calls: string[]): TestRegistration {
  return {
    dispose() {
      calls.push(label);
    }
  };
}

function createContext() {
  const calls: string[] = [];
  const registeredGizmos: GizmoController[] = [];
  const document = new FakeDocument();
  const actorSystem = new ActorSystem();
  const componentRegistry = new ComponentRegistry({
    actorSystem,
    attachmentRuntime: new TestCompositeAttachmentRuntime([
      new GizmoControllerAttachmentRuntime({
        registry: {
          register(object: GizmoController): TestRegistration {
            calls.push(`gizmo-register:${object.id}`);
            registeredGizmos.push(object);
            return createRegistration(`gizmo-dispose:${object.id}`, calls);
          },
          dispose(): void {
            calls.push("gizmo-system-dispose");
          }
        }
      }),
      new ActiveInputCancellationRuntime()
    ])
  });
  const trackedActors: RegisteredActor[] = [];
  const context: ActorCreationContext = {
    actorSystem,
    componentRegistry,
    trackRegisteredActor(actor) {
      trackedActors.push(actor);
      return createRegistration(`actor-untrack:${actor.actor.id}`, calls);
    }
  };
  installComponentDefinition(componentRegistry, gizmoEventBindingComponentDefinition);
  installActorUiComponentDefinitions(componentRegistry);
  installControlComponentDefinitions(componentRegistry);
  installMenuComponentDefinitions(componentRegistry);
  installThemeComponentDefinitions(componentRegistry);
  installCamera3ComponentDefinitions(componentRegistry);
  return { calls, context, document, registeredGizmos, trackedActors };
}

function createCommandSink(commands: RuntimeCameraControlCommand[]): RuntimeCameraCommandSink {
  return {
    submit(command) {
      commands.push(command);
    }
  };
}

function createFakeGizmoFactory(
  calls: string[],
  commands: RuntimeCameraControlCommand[] = [],
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
      updateStates: [],
      update(viewState?: RuntimeCameraViewState): void {
        if (viewState) fake.updateStates.push(viewState);
        calls.push("gizmo-update");
      },
      hitTest(_point: ScreenPoint): GizmoHit | null {
        return hit;
      },
      onGizmoStart(event: GizmoStartEvent): void {
        options.commandSink.submit({
          type: "orbit-drag-start",
          source: "camera3-gizmo",
          sessionId: `test-drag:${event.pointerId}`
        });
      },
      onGizmoMove(event: GizmoMoveEvent): void {
        options.commandSink.submit({
          type: "orbit-drag-delta",
          source: "camera3-gizmo",
          sessionId: `test-drag:${event.pointerId}`,
          dx: event.delta.dx,
          dy: event.delta.dy
        });
      },
      onGizmoEnd(event: GizmoEndEvent): void {
        options.commandSink.submit({
          type: "orbit-drag-end",
          source: "camera3-gizmo",
          sessionId: `test-drag:${event.pointerId}`,
          reason: "pointerup"
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
        options.commandSink.submit({
          type: "orbit-drag-end",
          source: "camera3-gizmo",
          sessionId: `test-drag:${event.pointerId}`,
          reason: "cancel"
        });
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

function createViewState(mode: "perspective" | "orthographic" = "perspective"): RuntimeCameraViewState {
  return {
    cameraState: {
      pose: {
        position: [0, 0, 6],
        target: [0, 0, 0],
        up: [0, 1, 0]
      },
      projectionMode: mode,
      projection: { mode }
    },
    projectionMode: mode
  };
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
    const { context, document } = createContext();
    const commands: RuntimeCameraControlCommand[] = [];
    const { createGizmo } = createFakeGizmoFactory([], commands);

    const handle = createCamera3GizmoActor(context, {
      actorId: "camera-actor",
      initialViewState: createViewState(),
      commandSink: createCommandSink(commands),
      document: document as unknown as Document
    }, createGizmo);

    expect(handle.actor.id).toBe("camera-actor");
    expect(handle.component.type).toBe(camera3GizmoComponentType);
    expect(isActorInputParticipant(handle.component)).toBe(true);
    expect(context.actorSystem.getActor("camera-actor")).toBe(handle.actor);
  });

  it("parents the actor when parentActor is provided", () => {
    const { context, document } = createContext();
    const sceneActor = context.actorSystem.createActor({ id: "scene-window" });
    const commands: RuntimeCameraControlCommand[] = [];
    const { createGizmo } = createFakeGizmoFactory([], commands);

    const handle = createCamera3GizmoActor(context, {
      actorId: "camera-actor",
      parentActor: sceneActor,
      initialViewState: createViewState(),
      commandSink: createCommandSink(commands),
      document: document as unknown as Document
    }, createGizmo);

    expect(context.actorSystem.getParent(handle.actor)).toBe(sceneActor);
  });

  it("auto-adds GizmoEventBindingComponent and registers the binding only once", () => {
    const { calls, context, document, registeredGizmos } = createContext();
    const { createGizmo } = createFakeGizmoFactory(calls);

    const handle = createCamera3GizmoActor(context, {
      actorId: "camera-actor",
      initialViewState: createViewState(),
      commandSink: createCommandSink([]),
      document: document as unknown as Document
    }, createGizmo);

    expect(handle.actor.hasComponent(gizmoEventBindingComponentType)).toBe(true);
    expect(registeredGizmos).toHaveLength(1);
    expect(calls.filter((call) => call.startsWith("gizmo-register:"))).toEqual([
      "gizmo-register:camera-actor:gizmo-event-binding"
    ]);
  });

  it("hosts the wrapped gizmo in the actor UI element", () => {
    const { context, document } = createContext();
    const { createGizmo, created, receivedOptions } = createFakeGizmoFactory([]);

    const handle = createCamera3GizmoActor(context, {
      actorId: "camera-actor",
      initialViewState: createViewState(),
      commandSink: createCommandSink([]),
      document: document as unknown as Document
    }, createGizmo);
    const uiElement = handle.actor.getComponent(uiElementComponentType);

    expect(receivedOptions).toHaveLength(1);
    expect("parent" in receivedOptions[0]!).toBe(false);
    expect((uiElement?.element as unknown as FakeElement).children).toEqual([
      created[0]?.element
    ]);
  });

  it("routes move and double-click events through the binding to the wrapped gizmo", () => {
    const { context, document, registeredGizmos } = createContext();
    const commands: RuntimeCameraControlCommand[] = [];
    const { createGizmo } = createFakeGizmoFactory([], commands);
    createCamera3GizmoActor(context, {
      actorId: "camera-actor",
      initialViewState: createViewState(),
      commandSink: createCommandSink(commands),
      document: document as unknown as Document
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
    binding.onGizmoEnd?.({
      ...createMoveEvent(binding, hit),
      wasClick: false
    });
    binding.onGizmoDoubleClick?.({
      ...createMoveEvent(binding, hit),
      clickCount: 2
    });

    expect(commands).toEqual([
      { type: "orbit-drag-start", source: "camera3-gizmo", sessionId: "test-drag:1" },
      { type: "orbit-drag-delta", source: "camera3-gizmo", sessionId: "test-drag:1", dx: 3, dy: 4 },
      { type: "orbit-drag-end", source: "camera3-gizmo", sessionId: "test-drag:1", reason: "pointerup" },
      { type: "snap-axis", source: "camera3-gizmo", axis: "+x" }
    ]);
  });

  it("routes projection mode clicks through actor input instead of DOM click handlers", () => {
    const { context, document, registeredGizmos } = createContext();
    const commands: RuntimeCameraControlCommand[] = [];
    const { createGizmo } = createFakeGizmoFactory([], commands, {
      gizmoId: "camera3-view-gizmo",
      partId: "projection-mode",
      kind: "custom",
      priority: 20
    });
    createCamera3GizmoActor(context, {
      actorId: "camera-actor",
      initialViewState: createViewState(),
      commandSink: createCommandSink(commands),
      document: document as unknown as Document
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
    const { calls, context, document } = createContext();
    const { createGizmo } = createFakeGizmoFactory(calls);
    const handle = createCamera3GizmoActor(context, {
      actorId: "camera-actor",
      initialViewState: createViewState(),
      commandSink: createCommandSink([]),
      document: document as unknown as Document
    }, createGizmo);
    calls.length = 0;

    handle.dispose();
    handle.dispose();

    expect(context.actorSystem.getActor("camera-actor")).toBeNull();
    expect(calls).toEqual([
      "actor-untrack:camera-actor",
      "gizmo-dispose",
      "element-remove",
      "gizmo-dispose:camera-actor:gizmo-event-binding"
    ]);
  });

  it("cancels active drag when the actor is destroyed", () => {
    const { calls, context, document, registeredGizmos } = createContext();
    const { createGizmo } = createFakeGizmoFactory(calls);
    const handle = createCamera3GizmoActor(context, {
      actorId: "camera-actor",
      initialViewState: createViewState(),
      commandSink: createCommandSink([]),
      document: document as unknown as Document
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
      "actor-untrack:camera-actor",
      "gizmo-cancel:gizmo-disabled",
      "gizmo-dispose",
      "element-remove",
      "gizmo-dispose:camera-actor:gizmo-event-binding"
    ]);
  });
});
