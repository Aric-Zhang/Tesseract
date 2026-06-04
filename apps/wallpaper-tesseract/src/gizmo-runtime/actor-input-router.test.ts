import { describe, expect, it } from "vitest";
import type {
  GizmoController,
  GizmoHit,
  GizmoMoveEvent,
  GizmoStartEvent
} from "gizmo-core";
import { componentType, type Actor, type Component } from "../actor-runtime";
import type { ActorInputHit } from "./actor-input-hit";
import { isActorInputParticipant, type ActorInputParticipant } from "./actor-input-participant";
import { ActorInputRouter } from "./actor-input-router";
import type { GizmoResponder } from "./gizmo-responder";

interface ActorHarness {
  readonly actor: Actor;
  add<T extends Component>(component: T): T;
  remove(component: Component): void;
}

interface TestParticipant extends ActorInputParticipant {
  currentHit: ActorInputHit | null;
}

function createActorHarness(id = "actor"): ActorHarness {
  const entries: Component[] = [];
  const actor: Actor = {
    id,
    name: id,
    enabled: true,
    getComponent(type) {
      return (entries.find((component) => component.type === type) as never) ?? null;
    },
    getComponents(type) {
      return entries.filter((component) => component.type === type) as never;
    },
    listComponents() {
      return entries.slice();
    },
    hasComponent(type) {
      return entries.some((component) => component.type === type);
    }
  };
  return {
    actor,
    add(component) {
      entries.push(component);
      return component;
    },
    remove(component) {
      const index = entries.indexOf(component);
      if (index >= 0) {
        entries.splice(index, 1);
      }
    }
  };
}

function createHit(
  componentId: string,
  options: {
    partId?: string;
    localRoutePriority?: number;
    hitPriority?: number;
    path?: ActorInputHit["path"];
  } = {}
): ActorInputHit {
  const partId = options.partId ?? componentId;
  return {
    componentId,
    partId,
    kind: "control",
    region: "content-control",
    localRoutePriority: options.localRoutePriority ?? 0,
    hitPriority: options.hitPriority,
    path: options.path ?? [{
      componentId,
      role: "control",
      partId
    }]
  };
}

function createParticipant(
  actor: Actor,
  calls: string[],
  id: string,
  options: {
    enabled?: boolean;
    inputStackPriority?: number;
    inputPriority?: number;
    hit?: ActorInputHit | null;
  } = {}
): TestParticipant {
  const participant: TestParticipant = {
    id,
    type: componentType<TestParticipant>(`participant-${id}`),
    actor,
    enabled: options.enabled ?? true,
    inputStackPriority: options.inputStackPriority,
    inputPriority: options.inputPriority,
    currentHit: options.hit === undefined ? createHit(id) : options.hit,
    hitTestInput(_point, context) {
      calls.push(`hit:${id}:${context.component.id}`);
      return participant.currentHit;
    },
    onInputStart(event) {
      calls.push(`start:${id}:${event.hit.partId}`);
    },
    onInputMove(event) {
      calls.push(`move:${id}:${event.hit.partId}`);
    },
    onInputEnd(event) {
      calls.push(`end:${id}:${event.hit.partId}:${event.wasClick}`);
    },
    onInputCancel(event) {
      calls.push(`cancel:${id}:${event.reason}`);
    },
    onInputClick(event) {
      calls.push(`click:${id}:${event.hit.partId}:${event.clickCount}`);
    },
    onInputDoubleClick(event) {
      calls.push(`double:${id}:${event.hit.partId}:${event.clickCount}`);
    }
  };
  return participant;
}

function createPlainComponent(actor: Actor, id: string): Component {
  return {
    id,
    type: componentType<Component>(`plain-${id}`),
    actor,
    enabled: true
  };
}

function createLegacyResponder(
  actor: Actor,
  calls: string[],
  id: string,
  options: {
    enabled?: boolean;
    gizmoPriority?: number;
    hitPriority?: number;
  } = {}
): GizmoResponder {
  const responderHit: GizmoHit = {
    gizmoId: `${id}-gizmo`,
    partId: id,
    kind: "custom",
    priority: options.hitPriority,
    data: { id }
  };
  return {
    id,
    type: componentType<GizmoResponder>(`legacy-${id}`),
    actor,
    enabled: options.enabled ?? true,
    gizmoPriority: options.gizmoPriority ?? 0,
    hitTestGizmo(_point) {
      calls.push(`legacy-hit:${id}`);
      return responderHit;
    },
    onGizmoStart(event) {
      calls.push(`legacy-start:${id}:${event.hit.gizmoId}:${event.hit.partId}`);
    },
    onGizmoMove(event) {
      calls.push(`legacy-move:${id}:${event.hit.gizmoId}:${event.hit.partId}`);
    },
    onGizmoEnd(event) {
      calls.push(`legacy-end:${id}:${event.hit.gizmoId}:${event.hit.partId}:${event.wasClick}`);
    },
    onGizmoCancel(event) {
      calls.push(`legacy-cancel:${id}:${event.reason}`);
    },
    onGizmoClick(event) {
      calls.push(`legacy-click:${id}:${event.hit.gizmoId}:${event.hit.partId}:${event.clickCount}`);
    },
    onGizmoDoubleClick(event) {
      calls.push(`legacy-double:${id}:${event.hit.gizmoId}:${event.hit.partId}:${event.clickCount}`);
    }
  };
}

function createFakeGizmo(): GizmoController {
  return {
    id: "binding",
    priority: 0,
    hitTest(): GizmoHit | null {
      return null;
    }
  };
}

function createBindingHit(partId = "binding-hit"): GizmoHit {
  return {
    gizmoId: "binding",
    partId,
    kind: "custom"
  };
}

function createStartEvent(hit = createBindingHit()): GizmoStartEvent {
  return {
    gizmo: createFakeGizmo(),
    hit,
    pointerId: 1,
    pointerType: "mouse",
    timeStamp: 10,
    point: { x: 1, y: 2 },
    startPoint: { x: 1, y: 2 },
    buttons: 1
  };
}

function createMoveEvent(hit = createBindingHit()): GizmoMoveEvent {
  return {
    ...createStartEvent(hit),
    timeStamp: 20,
    point: { x: 3, y: 4 },
    delta: { dx: 2, dy: 2 },
    totalDelta: { dx: 2, dy: 2 },
    isDragging: true
  };
}

describe("ActorInputRouter", () => {
  it("identifies actor input participants by hitTestInput only", () => {
    const { actor } = createActorHarness();
    const calls: string[] = [];
    const participant = createParticipant(actor, calls, "participant");
    const legacy = createLegacyResponder(actor, calls, "legacy");
    const hybrid = Object.assign(createParticipant(actor, calls, "hybrid"), {
      gizmoPriority: 1,
      hitTestGizmo(): GizmoHit | null {
        return createBindingHit("legacy-hybrid");
      }
    });

    expect(isActorInputParticipant(participant)).toBe(true);
    expect(isActorInputParticipant(hybrid)).toBe(true);
    expect(isActorInputParticipant(legacy)).toBe(false);
  });

  it("selects hits by local route, participant priority, hit priority, path depth, then attach order", () => {
    const { actor, add } = createActorHarness();
    const calls: string[] = [];
    add(createParticipant(actor, calls, "local-low", {
      inputPriority: 100,
      hit: createHit("local-low", { localRoutePriority: 10, hitPriority: 100 })
    }));
    add(createParticipant(actor, calls, "input-low", {
      inputPriority: 1,
      hit: createHit("input-low", { localRoutePriority: 20, hitPriority: 100 })
    }));
    add(createParticipant(actor, calls, "hit-low", {
      inputPriority: 5,
      hit: createHit("hit-low", { localRoutePriority: 20, hitPriority: 1 })
    }));
    add(createParticipant(actor, calls, "path-shallow", {
      inputPriority: 5,
      hit: createHit("path-shallow", { localRoutePriority: 20, hitPriority: 10 })
    }));
    add(createParticipant(actor, calls, "path-deep", {
      inputPriority: 5,
      hit: createHit("path-deep", {
        localRoutePriority: 20,
        hitPriority: 10,
        path: [
          { componentId: "path-deep", role: "container" },
          { componentId: "path-deep", role: "control", partId: "path-deep" }
        ]
      })
    }));
    add(createParticipant(actor, calls, "last", {
      inputPriority: 5,
      hit: createHit("last", {
        localRoutePriority: 20,
        hitPriority: 10,
        path: [
          { componentId: "last", role: "container" },
          { componentId: "last", role: "control", partId: "last" }
        ]
      })
    }));
    const router = new ActorInputRouter({ actor });

    const selected = router.hitTest({ x: 0, y: 0 });

    expect(selected?.target.id).toBe("last");
    expect(selected?.routeScore).toBeGreaterThan(0);
  });

  it("reports the highest enabled participant stack priority and ignores disabled candidates", () => {
    const { actor, add } = createActorHarness();
    const calls: string[] = [];
    add(createParticipant(actor, calls, "disabled", {
      enabled: false,
      inputStackPriority: 900,
      hit: createHit("disabled")
    }));
    add(createParticipant(actor, calls, "enabled", {
      inputStackPriority: 100,
      hit: createHit("enabled")
    }));
    const router = new ActorInputRouter({ actor });

    expect(router.getStackPriority()).toBe(100);
    expect(router.hitTest({ x: 0, y: 0 })?.target.id).toBe("enabled");

    actor.enabled = false;
    expect(router.hitTest({ x: 0, y: 0 })).toBeNull();
  });

  it("uses injected actor active state for hit testing", () => {
    const { actor, add } = createActorHarness();
    const calls: string[] = [];
    let activeInHierarchy = false;
    add(createParticipant(actor, calls, "target"));
    const router = new ActorInputRouter({
      actor,
      isActorActive: () => activeInHierarchy
    });

    expect(router.hitTest({ x: 0, y: 0 })).toBeNull();

    activeInHierarchy = true;
    expect(router.hitTest({ x: 0, y: 0 })?.target.id).toBe("target");
  });

  it("locks move and end routing to the active selection", () => {
    const { actor, add } = createActorHarness();
    const calls: string[] = [];
    const active = add(createParticipant(actor, calls, "active", {
      hit: createHit("active", { localRoutePriority: 10 })
    }));
    const other = add(createParticipant(actor, calls, "other", {
      hit: createHit("other", { localRoutePriority: 1 })
    }));
    const router = new ActorInputRouter({ actor });
    const selection = router.hitTest({ x: 0, y: 0 });
    if (!selection) throw new Error("Expected selection.");
    router.start(selection, createStartEvent());
    active.currentHit = null;
    other.currentHit = createHit("other", { localRoutePriority: 100 });
    calls.length = 0;

    router.move(createMoveEvent());
    router.end({ ...createMoveEvent(), totalDelta: { dx: 0, dy: 0 }, wasClick: true });

    expect(calls).toEqual([
      "move:active:active",
      "end:active:active:true"
    ]);
  });

  it("routes click and double-click to the selected route", () => {
    const { actor, add } = createActorHarness();
    const calls: string[] = [];
    add(createParticipant(actor, calls, "target", {
      hit: createHit("target", { partId: "row" })
    }));
    const router = new ActorInputRouter({ actor });
    const selection = router.hitTest({ x: 0, y: 0 });
    if (!selection) throw new Error("Expected selection.");

    router.click(selection, { ...createStartEvent(), clickCount: 1 });
    router.doubleClick(selection, { ...createStartEvent(), clickCount: 2 });

    expect(calls).toEqual([
      "hit:target:target",
      "click:target:row:1",
      "double:target:row:2"
    ]);
  });

  it("returns null when no participant hits", () => {
    const { actor, add } = createActorHarness();
    const calls: string[] = [];
    add(createParticipant(actor, calls, "target", { hit: null }));
    const router = new ActorInputRouter({ actor });

    expect(router.hitTest({ x: 0, y: 0 })).toBeNull();
  });

  it("cancels active interactions when any active path component is detached", () => {
    const { actor, add, remove } = createActorHarness();
    const calls: string[] = [];
    const container = add(createPlainComponent(actor, "container"));
    add(createParticipant(actor, calls, "target", {
      hit: createHit("target", {
        path: [
          { componentId: "container", role: "container" },
          { componentId: "target", role: "control", partId: "target" }
        ]
      })
    }));
    const router = new ActorInputRouter({ actor });
    const selection = router.hitTest({ x: 0, y: 0 });
    if (!selection) throw new Error("Expected selection.");
    router.start(selection, createStartEvent());
    calls.length = 0;

    router.beforeComponentDetach(container);
    remove(container);
    router.move(createMoveEvent());

    expect(calls).toEqual(["cancel:target:gizmo-disabled"]);
  });

  it("cancels active interactions before move when any active path component is disabled", () => {
    const { actor, add } = createActorHarness();
    const calls: string[] = [];
    const container = add(createPlainComponent(actor, "container"));
    add(createParticipant(actor, calls, "target", {
      hit: createHit("target", {
        path: [
          { componentId: "container", role: "container" },
          { componentId: "target", role: "control", partId: "target" }
        ]
      })
    }));
    const router = new ActorInputRouter({ actor });
    const selection = router.hitTest({ x: 0, y: 0 });
    if (!selection) throw new Error("Expected selection.");
    router.start(selection, createStartEvent());
    calls.length = 0;
    container.enabled = false;

    router.move(createMoveEvent());

    expect(calls).toEqual(["cancel:target:gizmo-disabled"]);
  });

  it("cancels active interactions when injected actor active state becomes false", () => {
    const { actor, add } = createActorHarness();
    const calls: string[] = [];
    let activeInHierarchy = true;
    add(createParticipant(actor, calls, "target"));
    const router = new ActorInputRouter({
      actor,
      isActorActive: () => activeInHierarchy
    });
    const selection = router.hitTest({ x: 0, y: 0 });
    if (!selection) throw new Error("Expected selection.");
    router.start(selection, createStartEvent());
    calls.length = 0;
    activeInHierarchy = false;

    router.move(createMoveEvent());

    expect(calls).toEqual(["cancel:target:gizmo-disabled"]);
  });

  it("adapts legacy GizmoResponder hit tests and events", () => {
    const { actor, add } = createActorHarness();
    const calls: string[] = [];
    add(createLegacyResponder(actor, calls, "legacy", {
      gizmoPriority: 10,
      hitPriority: 3
    }));
    const router = new ActorInputRouter({ actor });
    const selection = router.hitTest({ x: 0, y: 0 });
    if (!selection) throw new Error("Expected selection.");
    calls.length = 0;

    router.start(selection, createStartEvent());
    router.move(createMoveEvent());
    router.end({ ...createMoveEvent(), totalDelta: { dx: 0, dy: 0 }, wasClick: true });
    router.click(selection, { ...createStartEvent(), clickCount: 1 });
    router.doubleClick(selection, { ...createStartEvent(), clickCount: 2 });

    expect(selection.stackPriority).toBe(10);
    expect(selection.hit.hitPriority).toBe(3);
    expect(calls).toEqual([
      "legacy-start:legacy:legacy-gizmo:legacy",
      "legacy-move:legacy:legacy-gizmo:legacy",
      "legacy-end:legacy:legacy-gizmo:legacy:true",
      "legacy-click:legacy:legacy-gizmo:legacy:1",
      "legacy-double:legacy:legacy-gizmo:legacy:2"
    ]);
  });

  it("uses the new participant path when a component also implements legacy GizmoResponder", () => {
    const { actor, add } = createActorHarness();
    const calls: string[] = [];
    const hybrid = Object.assign(createParticipant(actor, calls, "hybrid", {
      inputStackPriority: 20,
      hit: createHit("hybrid", { partId: "new-path" })
    }), {
      gizmoPriority: 100,
      hitTestGizmo(): GizmoHit | null {
        calls.push("legacy-hit:hybrid");
        return createBindingHit("legacy-path");
      },
      onGizmoStart(): void {
        calls.push("legacy-start:hybrid");
      }
    });
    add(hybrid);
    const router = new ActorInputRouter({ actor });
    const selection = router.hitTest({ x: 0, y: 0 });
    if (!selection) throw new Error("Expected selection.");
    router.start(selection, createStartEvent());

    expect(calls).toEqual([
      "hit:hybrid:hybrid",
      "start:hybrid:new-path"
    ]);
  });
});
