import { describe, expect, it, vi } from "vitest";
import { GizmoEventSystem } from "../src/gizmo-event-system";
import type { GizmoController, GizmoHit, GizmoMoveEvent, ScreenPoint } from "../src/types";

interface ListenerRecord {
  type: string;
  listener: EventListenerOrEventListenerObject;
  options?: boolean | AddEventListenerOptions;
}

class FakeEventTarget {
  readonly added: ListenerRecord[] = [];
  readonly removed: ListenerRecord[] = [];

  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions
  ): void {
    this.added.push({ type, listener, options });
  }

  removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | EventListenerOptions
  ): void {
    this.removed.push({ type, listener, options });
  }

  dispatch(type: string, event: FakePointerEvent | FakeMouseEvent): void {
    for (const record of this.added) {
      if (record.type !== type) continue;
      if (typeof record.listener === "function") {
        record.listener(event as unknown as Event);
      } else {
        record.listener.handleEvent(event as unknown as Event);
      }
    }
  }

  dispatchPointer(type: string, event: FakePointerEvent): void {
    this.dispatch(type, event);
  }

  dispatchMouse(type: string, event: FakeMouseEvent): void {
    this.dispatch(type, event);
  }
}

interface FakePointerEvent {
  pointerId: number;
  pointerType: string;
  isPrimary: boolean;
  button: number;
  buttons: number;
  clientX: number;
  clientY: number;
  timeStamp: number;
  defaultPrevented: boolean;
  target?: unknown;
  preventDefault(): void;
}

interface FakeMouseEvent {
  type?: string;
  button: number;
  buttons: number;
  clientX: number;
  clientY: number;
  timeStamp: number;
  defaultPrevented: boolean;
  target?: unknown;
  preventDefault(): void;
}

class FakePointerCaptureHost {
  readonly setCalls: number[] = [];
  readonly releaseCalls: number[] = [];
  private readonly captured = new Set<number>();

  setPointerCapture(pointerId: number): void {
    this.setCalls.push(pointerId);
    this.captured.add(pointerId);
  }

  releasePointerCapture(pointerId: number): void {
    this.releaseCalls.push(pointerId);
    this.captured.delete(pointerId);
  }

  hasPointerCapture(pointerId: number): boolean {
    return this.captured.has(pointerId);
  }
}

function createPointerEvent(overrides: Partial<FakePointerEvent> = {}): FakePointerEvent {
  const event = {
    pointerId: 1,
    pointerType: "mouse",
    isPrimary: true,
    button: 0,
    buttons: 1,
    clientX: 0,
    clientY: 0,
    timeStamp: 0,
    defaultPrevented: false,
    preventDefault() {
      this.defaultPrevented = true;
    }
  };
  return { ...event, ...overrides };
}

function createMouseEvent(overrides: Partial<FakeMouseEvent> = {}): FakeMouseEvent {
  const event = {
    button: 0,
    buttons: 1,
    clientX: 0,
    clientY: 0,
    timeStamp: 0,
    defaultPrevented: false,
    preventDefault() {
      this.defaultPrevented = true;
    }
  };
  return { ...event, ...overrides };
}

function createGizmo(
  id: string,
  options: {
    priority?: number;
    enabled?: boolean;
    hit?: GizmoHit | null;
  } = {}
): GizmoController {
  return {
    id,
    priority: options.priority ?? 0,
    enabled: options.enabled,
    hitTest(_point: ScreenPoint) {
      return options.hit ?? null;
    }
  };
}

function selectBestHit(system: GizmoEventSystem, point: ScreenPoint) {
  return (
    system as unknown as {
      findBestHit(point: ScreenPoint): { gizmo: GizmoController; hit: GizmoHit } | null;
    }
  ).findBestHit(point);
}

function createHit(gizmoId: string, partId: string, priority?: number): GizmoHit {
  return {
    gizmoId,
    partId,
    kind: "custom",
    priority
  };
}

const globalListenerTypes = [
  "pointerdown",
  "pointermove",
  "pointerup",
  "pointercancel",
  "mousedown",
  "mousemove",
  "mouseup"
];

function dispatchClick(
  target: FakeEventTarget,
  options: {
    x?: number;
    y?: number;
    timeStamp?: number;
    pointerId?: number;
  } = {}
): void {
  const x = options.x ?? 0;
  const y = options.y ?? 0;
  const timeStamp = options.timeStamp ?? 0;
  const pointerId = options.pointerId ?? 1;
  target.dispatchPointer("pointerdown", createPointerEvent({ pointerId, clientX: x, clientY: y, timeStamp }));
  target.dispatchPointer(
    "pointerup",
    createPointerEvent({ pointerId, clientX: x, clientY: y, timeStamp: timeStamp + 1, buttons: 0 })
  );
}

describe("GizmoEventSystem listener lifecycle", () => {
  it("registers the global pointer listeners and mouse fallback with capture and passive=false", () => {
    const target = new FakeEventTarget();

    const system = new GizmoEventSystem({ target: target as unknown as EventTarget });

    expect(target.added.map((record) => record.type)).toEqual(globalListenerTypes);
    for (const record of target.added) {
      expect(record.options).toMatchObject({ capture: true, passive: false });
    }

    system.dispose();
  });

  it("removes the global pointer and mouse fallback listeners on dispose", () => {
    const target = new FakeEventTarget();
    const system = new GizmoEventSystem({ target: target as unknown as EventTarget });

    system.dispose();

    expect(target.removed.map((record) => record.type)).toEqual(globalListenerTypes);
    expect(target.removed.map((record) => record.listener)).toEqual(
      target.added.map((record) => record.listener)
    );
  });

  it("can be disposed more than once", () => {
    const target = new FakeEventTarget();
    const system = new GizmoEventSystem({ target: target as unknown as EventTarget });

    system.dispose();
    system.dispose();

    expect(target.removed).toHaveLength(globalListenerTypes.length);
  });

  it("returns a disposable for individual gizmo unregister", () => {
    const target = new FakeEventTarget();
    const system = new GizmoEventSystem({ target: target as unknown as EventTarget });
    const disposable = system.register(createGizmo("a"));

    expect(() => disposable.dispose()).not.toThrow();

    system.dispose();
  });

  it("does not throw when unregistering an unknown gizmo", () => {
    const target = new FakeEventTarget();
    const system = new GizmoEventSystem({ target: target as unknown as EventTarget });

    expect(() => system.unregister(createGizmo("missing"))).not.toThrow();

    system.dispose();
  });
});

describe("GizmoEventSystem debug logging", () => {
  it("does not emit debug logs when debug is disabled", () => {
    const target = new FakeEventTarget();
    const onDebugLog = vi.fn();
    const system = new GizmoEventSystem({
      target: target as unknown as EventTarget,
      onDebugLog
    });
    system.register(createGizmo("a", { hit: createHit("a", "body") }));

    target.dispatchPointer("pointerdown", createPointerEvent());

    expect(onDebugLog).not.toHaveBeenCalled();

    system.dispose();
  });

  it("emits debug logs when debug is enabled", () => {
    const target = new FakeEventTarget();
    const onDebugLog = vi.fn();
    const system = new GizmoEventSystem({
      target: target as unknown as EventTarget,
      debug: true,
      debugConsole: false,
      onDebugLog
    });
    system.register(createGizmo("a", { hit: createHit("a", "body") }));

    target.dispatchPointer("pointerdown", createPointerEvent({ clientX: 12, clientY: 34 }));

    expect(onDebugLog.mock.calls.map((call) => call[0].type)).toEqual(["pointerdown", "hit", "start"]);
    expect(onDebugLog.mock.calls[0]?.[0].message).toContain("pointerdown");
    expect(onDebugLog.mock.calls[1]?.[0]).toMatchObject({
      type: "hit",
      gizmoId: "a",
      partId: "body",
      point: { x: 12, y: 34 }
    });

    system.dispose();
  });
});

describe("GizmoEventSystem hit priority", () => {
  it("returns null when no registered gizmo is hit", () => {
    const target = new FakeEventTarget();
    const system = new GizmoEventSystem({ target: target as unknown as EventTarget });
    system.register(createGizmo("a"));

    expect(selectBestHit(system, { x: 10, y: 20 })).toBeNull();

    system.dispose();
  });

  it("skips disabled gizmos", () => {
    const target = new FakeEventTarget();
    const system = new GizmoEventSystem({ target: target as unknown as EventTarget });
    system.register(createGizmo("disabled", { enabled: false, priority: 10, hit: createHit("disabled", "a") }));
    system.register(createGizmo("enabled", { priority: 1, hit: createHit("enabled", "b") }));

    expect(selectBestHit(system, { x: 0, y: 0 })?.gizmo.id).toBe("enabled");

    system.dispose();
  });

  it("prefers the higher controller priority", () => {
    const target = new FakeEventTarget();
    const system = new GizmoEventSystem({ target: target as unknown as EventTarget });
    system.register(createGizmo("low", { priority: 1, hit: createHit("low", "a", 100) }));
    system.register(createGizmo("high", { priority: 2, hit: createHit("high", "b", 0) }));

    expect(selectBestHit(system, { x: 0, y: 0 })?.gizmo.id).toBe("high");

    system.dispose();
  });

  it("prefers the higher hit priority when controller priority matches", () => {
    const target = new FakeEventTarget();
    const system = new GizmoEventSystem({ target: target as unknown as EventTarget });
    system.register(createGizmo("low-hit", { priority: 1, hit: createHit("low-hit", "a", 1) }));
    system.register(createGizmo("high-hit", { priority: 1, hit: createHit("high-hit", "b", 2) }));

    expect(selectBestHit(system, { x: 0, y: 0 })?.gizmo.id).toBe("high-hit");

    system.dispose();
  });

  it("uses hit priority 0 when it is omitted", () => {
    const target = new FakeEventTarget();
    const system = new GizmoEventSystem({ target: target as unknown as EventTarget });
    system.register(createGizmo("implicit-zero", { priority: 1, hit: createHit("implicit-zero", "a") }));
    system.register(createGizmo("negative", { priority: 1, hit: createHit("negative", "b", -1) }));

    expect(selectBestHit(system, { x: 0, y: 0 })?.gizmo.id).toBe("implicit-zero");

    system.dispose();
  });

  it("prefers the later registered gizmo when controller and hit priority match", () => {
    const target = new FakeEventTarget();
    const system = new GizmoEventSystem({ target: target as unknown as EventTarget });
    system.register(createGizmo("first", { priority: 1, hit: createHit("first", "a", 1) }));
    system.register(createGizmo("second", { priority: 1, hit: createHit("second", "b", 1) }));

    expect(selectBestHit(system, { x: 0, y: 0 })?.gizmo.id).toBe("second");

    system.dispose();
  });
});

describe("GizmoEventSystem active interaction lifecycle", () => {
  it("dispatches onGizmoStart and prevents default when pointerdown hits", () => {
    const target = new FakeEventTarget();
    const system = new GizmoEventSystem({ target: target as unknown as EventTarget });
    const onGizmoStart = vi.fn();
    system.register({ ...createGizmo("a", { hit: createHit("a", "body") }), onGizmoStart });
    const down = createPointerEvent({ clientX: 20, clientY: 30, timeStamp: 10 });

    target.dispatchPointer("pointerdown", down);

    expect(onGizmoStart).toHaveBeenCalledOnce();
    expect(onGizmoStart.mock.calls[0]?.[0]).toMatchObject({
      pointerId: 1,
      pointerType: "mouse",
      point: { x: 20, y: 30 },
      startPoint: { x: 20, y: 30 }
    });
    expect(down.defaultPrevented).toBe(true);

    system.dispose();
  });

  it("dispatches start, move, and end from the mouse fallback path", () => {
    const target = new FakeEventTarget();
    const system = new GizmoEventSystem({
      target: target as unknown as EventTarget,
      clickMoveThreshold: 6
    });
    const onGizmoStart = vi.fn();
    const onGizmoMove = vi.fn();
    const onGizmoEnd = vi.fn();
    system.register({
      ...createGizmo("a", { hit: createHit("a", "body") }),
      onGizmoStart,
      onGizmoMove,
      onGizmoEnd
    });
    const down = createMouseEvent({ clientX: 10, clientY: 20, timeStamp: 1 });
    const move = createMouseEvent({ clientX: 18, clientY: 24, timeStamp: 2, buttons: 1 });
    const up = createMouseEvent({ clientX: 18, clientY: 24, timeStamp: 3, buttons: 0 });

    target.dispatchMouse("mousedown", down);
    target.dispatchMouse("mousemove", move);
    target.dispatchMouse("mouseup", up);

    expect(onGizmoStart).toHaveBeenCalledOnce();
    expect(onGizmoStart.mock.calls[0]?.[0]).toMatchObject({
      pointerId: 1,
      pointerType: "mouse",
      point: { x: 10, y: 20 },
      startPoint: { x: 10, y: 20 }
    });
    expect(onGizmoMove).toHaveBeenCalledOnce();
    expect(onGizmoMove.mock.calls[0]?.[0]).toMatchObject({
      delta: { dx: 8, dy: 4 },
      totalDelta: { dx: 8, dy: 4 },
      isDragging: true
    });
    expect(onGizmoEnd).toHaveBeenCalledOnce();
    expect(onGizmoEnd.mock.calls[0]?.[0]).toMatchObject({
      totalDelta: { dx: 8, dy: 4 },
      wasClick: false
    });
    expect(down.defaultPrevented).toBe(true);
    expect(move.defaultPrevented).toBe(true);
    expect(up.defaultPrevented).toBe(true);

    system.dispose();
  });

  it("does not double-dispatch mouse fallback events after receiving pointer events", () => {
    const target = new FakeEventTarget();
    const system = new GizmoEventSystem({ target: target as unknown as EventTarget });
    const onGizmoStart = vi.fn();
    const onGizmoEnd = vi.fn();
    system.register({
      ...createGizmo("a", { hit: createHit("a", "body") }),
      onGizmoStart,
      onGizmoEnd
    });

    target.dispatchPointer("pointerdown", createPointerEvent({ clientX: 10, clientY: 20 }));
    target.dispatchMouse("mousedown", createMouseEvent({ clientX: 10, clientY: 20 }));
    target.dispatchPointer("pointerup", createPointerEvent({ clientX: 10, clientY: 20, buttons: 0 }));
    target.dispatchMouse("mouseup", createMouseEvent({ clientX: 10, clientY: 20, buttons: 0 }));

    expect(onGizmoStart).toHaveBeenCalledOnce();
    expect(onGizmoEnd).toHaveBeenCalledOnce();

    system.dispose();
  });

  it("uses pointer capture as an auxiliary stabilizer when the event target supports it", () => {
    const target = new FakeEventTarget();
    const captureHost = new FakePointerCaptureHost();
    const system = new GizmoEventSystem({ target: target as unknown as EventTarget });
    system.register(createGizmo("a", { hit: createHit("a", "body") }));

    target.dispatchPointer("pointerdown", createPointerEvent({ pointerId: 5, target: captureHost }));
    target.dispatchPointer("pointerup", createPointerEvent({ pointerId: 5, buttons: 0 }));

    expect(captureHost.setCalls).toEqual([5]);
    expect(captureHost.releaseCalls).toEqual([5]);

    system.dispose();
  });

  it("does not prevent default or create active state when pointerdown misses", () => {
    const target = new FakeEventTarget();
    const system = new GizmoEventSystem({ target: target as unknown as EventTarget });
    const onGizmoMove = vi.fn();
    system.register({ ...createGizmo("a"), onGizmoMove });
    const down = createPointerEvent();

    target.dispatchPointer("pointerdown", down);
    target.dispatchPointer("pointermove", createPointerEvent({ clientX: 10, clientY: 10 }));

    expect(down.defaultPrevented).toBe(false);
    expect(onGizmoMove).not.toHaveBeenCalled();

    system.dispose();
  });

  it("ignores mouse pointerdown when the button is not left click", () => {
    const target = new FakeEventTarget();
    const system = new GizmoEventSystem({ target: target as unknown as EventTarget });
    const onGizmoStart = vi.fn();
    system.register({ ...createGizmo("a", { hit: createHit("a", "body") }), onGizmoStart });
    const down = createPointerEvent({ button: 2 });

    target.dispatchPointer("pointerdown", down);

    expect(down.defaultPrevented).toBe(false);
    expect(onGizmoStart).not.toHaveBeenCalled();

    system.dispose();
  });

  it("ignores non-primary pointerdown", () => {
    const target = new FakeEventTarget();
    const system = new GizmoEventSystem({ target: target as unknown as EventTarget });
    const onGizmoStart = vi.fn();
    system.register({ ...createGizmo("a", { hit: createHit("a", "body") }), onGizmoStart });
    const down = createPointerEvent({ isPrimary: false });

    target.dispatchPointer("pointerdown", down);

    expect(down.defaultPrevented).toBe(false);
    expect(onGizmoStart).not.toHaveBeenCalled();

    system.dispose();
  });

  it("keeps dispatching moves to the original active gizmo at any coordinate", () => {
    const target = new FakeEventTarget();
    const system = new GizmoEventSystem({ target: target as unknown as EventTarget });
    const firstMove = vi.fn();
    const secondMove = vi.fn();
    system.register({ ...createGizmo("first", { priority: 1, hit: createHit("first", "body") }), onGizmoMove: firstMove });
    system.register({ ...createGizmo("second", { priority: 0, hit: createHit("second", "body") }), onGizmoMove: secondMove });

    target.dispatchPointer("pointerdown", createPointerEvent({ clientX: 5, clientY: 5 }));
    target.dispatchPointer("pointermove", createPointerEvent({ clientX: 500, clientY: 600 }));

    expect(firstMove).toHaveBeenCalledOnce();
    expect(secondMove).not.toHaveBeenCalled();

    system.dispose();
  });

  it("reports delta and totalDelta", () => {
    const target = new FakeEventTarget();
    const system = new GizmoEventSystem({ target: target as unknown as EventTarget });
    const moves: GizmoMoveEvent[] = [];
    system.register({
      ...createGizmo("a", { hit: createHit("a", "body") }),
      onGizmoMove: (event) => moves.push(event)
    });

    target.dispatchPointer("pointerdown", createPointerEvent({ clientX: 10, clientY: 20 }));
    target.dispatchPointer("pointermove", createPointerEvent({ clientX: 13, clientY: 24, timeStamp: 1 }));
    target.dispatchPointer("pointermove", createPointerEvent({ clientX: 18, clientY: 30, timeStamp: 2 }));

    expect(moves).toHaveLength(2);
    expect(moves[0]?.delta).toEqual({ dx: 3, dy: 4 });
    expect(moves[0]?.totalDelta).toEqual({ dx: 3, dy: 4 });
    expect(moves[1]?.delta).toEqual({ dx: 5, dy: 6 });
    expect(moves[1]?.totalDelta).toEqual({ dx: 8, dy: 10 });

    system.dispose();
  });

  it("sets isDragging only after the click move threshold and keeps it true", () => {
    const target = new FakeEventTarget();
    const system = new GizmoEventSystem({
      target: target as unknown as EventTarget,
      clickMoveThreshold: 6
    });
    const moves: GizmoMoveEvent[] = [];
    system.register({
      ...createGizmo("a", { hit: createHit("a", "body") }),
      onGizmoMove: (event) => moves.push(event)
    });

    target.dispatchPointer("pointerdown", createPointerEvent({ clientX: 0, clientY: 0 }));
    target.dispatchPointer("pointermove", createPointerEvent({ clientX: 3, clientY: 4 }));
    target.dispatchPointer("pointermove", createPointerEvent({ clientX: 7, clientY: 0 }));
    target.dispatchPointer("pointermove", createPointerEvent({ clientX: 5, clientY: 0 }));

    expect(moves.map((event) => event.isDragging)).toEqual([false, true, true]);

    system.dispose();
  });

  it("dispatches onGizmoEnd, clears active state, and ignores later moves after pointerup", () => {
    const target = new FakeEventTarget();
    const system = new GizmoEventSystem({ target: target as unknown as EventTarget });
    const onGizmoEnd = vi.fn();
    const onGizmoMove = vi.fn();
    system.register({
      ...createGizmo("a", { hit: createHit("a", "body") }),
      onGizmoEnd,
      onGizmoMove
    });

    target.dispatchPointer("pointerdown", createPointerEvent({ clientX: 0, clientY: 0 }));
    const up = createPointerEvent({ clientX: 7, clientY: 0, buttons: 0 });
    target.dispatchPointer("pointerup", up);
    target.dispatchPointer("pointermove", createPointerEvent({ clientX: 20, clientY: 0 }));

    expect(onGizmoEnd).toHaveBeenCalledOnce();
    expect(onGizmoEnd.mock.calls[0]?.[0]).toMatchObject({
      totalDelta: { dx: 7, dy: 0 },
      wasClick: false
    });
    expect(up.defaultPrevented).toBe(true);
    expect(onGizmoMove).not.toHaveBeenCalled();

    system.dispose();
  });

  it("ignores events from a different pointerId while active", () => {
    const target = new FakeEventTarget();
    const system = new GizmoEventSystem({ target: target as unknown as EventTarget });
    const onGizmoMove = vi.fn();
    const onGizmoEnd = vi.fn();
    system.register({
      ...createGizmo("a", { hit: createHit("a", "body") }),
      onGizmoMove,
      onGizmoEnd
    });

    target.dispatchPointer("pointerdown", createPointerEvent({ pointerId: 1 }));
    const move = createPointerEvent({ pointerId: 2, clientX: 20, clientY: 20 });
    const up = createPointerEvent({ pointerId: 2, buttons: 0 });
    target.dispatchPointer("pointermove", move);
    target.dispatchPointer("pointerup", up);

    expect(move.defaultPrevented).toBe(false);
    expect(up.defaultPrevented).toBe(false);
    expect(onGizmoMove).not.toHaveBeenCalled();
    expect(onGizmoEnd).not.toHaveBeenCalled();

    system.dispose();
  });
});

describe("GizmoEventSystem cancellation lifecycle", () => {
  it("dispatches onGizmoCancel for pointercancel and clears active state", () => {
    const target = new FakeEventTarget();
    const system = new GizmoEventSystem({ target: target as unknown as EventTarget });
    const onGizmoCancel = vi.fn();
    const onGizmoMove = vi.fn();
    system.register({
      ...createGizmo("a", { hit: createHit("a", "body") }),
      onGizmoCancel,
      onGizmoMove
    });

    target.dispatchPointer("pointerdown", createPointerEvent());
    target.dispatchPointer("pointercancel", createPointerEvent({ buttons: 0 }));
    target.dispatchPointer("pointermove", createPointerEvent({ clientX: 10, clientY: 10 }));

    expect(onGizmoCancel).toHaveBeenCalledOnce();
    expect(onGizmoCancel.mock.calls[0]?.[0]).toMatchObject({ reason: "pointercancel" });
    expect(onGizmoMove).not.toHaveBeenCalled();

    system.dispose();
  });

  it("cancels mouse interaction on buttons=0 move without dispatching move", () => {
    const target = new FakeEventTarget();
    const system = new GizmoEventSystem({ target: target as unknown as EventTarget });
    const onGizmoCancel = vi.fn();
    const onGizmoMove = vi.fn();
    system.register({
      ...createGizmo("a", { hit: createHit("a", "body") }),
      onGizmoCancel,
      onGizmoMove
    });

    target.dispatchPointer("pointerdown", createPointerEvent());
    target.dispatchPointer("pointermove", createPointerEvent({ buttons: 0, clientX: 10, clientY: 10 }));
    target.dispatchPointer("pointermove", createPointerEvent({ buttons: 1, clientX: 20, clientY: 20 }));

    expect(onGizmoCancel).toHaveBeenCalledOnce();
    expect(onGizmoCancel.mock.calls[0]?.[0]).toMatchObject({ reason: "buttons-released" });
    expect(onGizmoMove).not.toHaveBeenCalled();

    system.dispose();
  });

  it("does not cancel a mouse move with buttons=0 while pointer capture is still active", () => {
    const target = new FakeEventTarget();
    const captureHost = new FakePointerCaptureHost();
    const system = new GizmoEventSystem({
      target: target as unknown as EventTarget,
      clickMoveThreshold: 6
    });
    const onGizmoCancel = vi.fn();
    const onGizmoMove = vi.fn();
    system.register({
      ...createGizmo("a", { hit: createHit("a", "body") }),
      onGizmoCancel,
      onGizmoMove
    });

    target.dispatchPointer("pointerdown", createPointerEvent({ target: captureHost }));
    target.dispatchPointer("pointermove", createPointerEvent({ buttons: 0, clientX: 10, clientY: 0 }));

    expect(onGizmoCancel).not.toHaveBeenCalled();
    expect(onGizmoMove).toHaveBeenCalledOnce();
    expect(onGizmoMove.mock.calls[0]?.[0]).toMatchObject({ isDragging: true });

    system.dispose();
  });

  it("does not cancel a mouse move with buttons=0 when the release fallback is disabled", () => {
    const target = new FakeEventTarget();
    const system = new GizmoEventSystem({
      target: target as unknown as EventTarget,
      buttonsReleasedFallback: false,
      clickMoveThreshold: 6
    });
    const onGizmoCancel = vi.fn();
    const onGizmoMove = vi.fn();
    system.register({
      ...createGizmo("a", { hit: createHit("a", "body") }),
      onGizmoCancel,
      onGizmoMove
    });

    target.dispatchPointer("pointerdown", createPointerEvent());
    target.dispatchPointer("pointermove", createPointerEvent({ buttons: 0, clientX: 10, clientY: 0 }));
    target.dispatchPointer("pointerup", createPointerEvent({ buttons: 0, clientX: 10, clientY: 0 }));

    expect(onGizmoCancel).not.toHaveBeenCalled();
    expect(onGizmoMove).toHaveBeenCalledOnce();

    system.dispose();
  });

  it("does not use buttons=0 as a release fallback for touch pointers", () => {
    const target = new FakeEventTarget();
    const system = new GizmoEventSystem({ target: target as unknown as EventTarget });
    const onGizmoCancel = vi.fn();
    const onGizmoMove = vi.fn();
    system.register({
      ...createGizmo("a", { hit: createHit("a", "body") }),
      onGizmoCancel,
      onGizmoMove
    });

    target.dispatchPointer("pointerdown", createPointerEvent({ pointerType: "touch", buttons: 0 }));
    target.dispatchPointer(
      "pointermove",
      createPointerEvent({ pointerType: "touch", buttons: 0, clientX: 10, clientY: 10 })
    );

    expect(onGizmoCancel).not.toHaveBeenCalled();
    expect(onGizmoMove).toHaveBeenCalledOnce();

    system.dispose();
  });

  it("cancels an active interaction during dispose", () => {
    const target = new FakeEventTarget();
    const system = new GizmoEventSystem({ target: target as unknown as EventTarget });
    const onGizmoCancel = vi.fn();
    system.register({ ...createGizmo("a", { hit: createHit("a", "body") }), onGizmoCancel });

    target.dispatchPointer("pointerdown", createPointerEvent({ timeStamp: 11 }));
    system.dispose();

    expect(onGizmoCancel).toHaveBeenCalledOnce();
    expect(onGizmoCancel.mock.calls[0]?.[0]).toMatchObject({ reason: "system-dispose" });
    expect(target.removed).toHaveLength(globalListenerTypes.length);
  });

  it("cancels an active interaction when its gizmo is unregistered", () => {
    const target = new FakeEventTarget();
    const system = new GizmoEventSystem({ target: target as unknown as EventTarget });
    const onGizmoCancel = vi.fn();
    const gizmo = { ...createGizmo("a", { hit: createHit("a", "body") }), onGizmoCancel };
    system.register(gizmo);

    target.dispatchPointer("pointerdown", createPointerEvent());
    system.unregister(gizmo);

    expect(onGizmoCancel).toHaveBeenCalledOnce();
    expect(onGizmoCancel.mock.calls[0]?.[0]).toMatchObject({ reason: "gizmo-disabled" });

    system.dispose();
  });

  it("cancels when an active gizmo becomes disabled", () => {
    const target = new FakeEventTarget();
    const system = new GizmoEventSystem({ target: target as unknown as EventTarget });
    const onGizmoCancel = vi.fn();
    const onGizmoMove = vi.fn();
    const onGizmoEnd = vi.fn();
    const gizmo = {
      ...createGizmo("a", { hit: createHit("a", "body") }),
      onGizmoCancel,
      onGizmoMove,
      onGizmoEnd
    };
    system.register(gizmo);

    target.dispatchPointer("pointerdown", createPointerEvent());
    gizmo.enabled = false;
    target.dispatchPointer("pointermove", createPointerEvent({ clientX: 10, clientY: 10 }));
    target.dispatchPointer("pointerup", createPointerEvent({ buttons: 0 }));

    expect(onGizmoCancel).toHaveBeenCalledOnce();
    expect(onGizmoCancel.mock.calls[0]?.[0]).toMatchObject({ reason: "gizmo-disabled" });
    expect(onGizmoMove).not.toHaveBeenCalled();
    expect(onGizmoEnd).not.toHaveBeenCalled();

    system.dispose();
  });
});

describe("GizmoEventSystem double-click detection", () => {
  it("does not dispatch doubleClick for the first click", () => {
    const target = new FakeEventTarget();
    const system = new GizmoEventSystem({ target: target as unknown as EventTarget });
    const onGizmoDoubleClick = vi.fn();
    system.register({
      ...createGizmo("a", { hit: createHit("a", "axis") }),
      onGizmoDoubleClick
    });

    dispatchClick(target, { timeStamp: 10 });

    expect(onGizmoDoubleClick).not.toHaveBeenCalled();

    system.dispose();
  });

  it("dispatches doubleClick for two quick clicks on the same part", () => {
    const target = new FakeEventTarget();
    const system = new GizmoEventSystem({ target: target as unknown as EventTarget });
    const onGizmoDoubleClick = vi.fn();
    system.register({
      ...createGizmo("a", { hit: createHit("a", "axis") }),
      onGizmoDoubleClick
    });

    dispatchClick(target, { timeStamp: 10 });
    dispatchClick(target, { timeStamp: 100 });

    expect(onGizmoDoubleClick).toHaveBeenCalledOnce();
    expect(onGizmoDoubleClick.mock.calls[0]?.[0]).toMatchObject({
      hit: { partId: "axis" },
      clickCount: 2
    });

    system.dispose();
  });

  it("does not dispatch doubleClick for different parts", () => {
    const target = new FakeEventTarget();
    const system = new GizmoEventSystem({ target: target as unknown as EventTarget });
    const onGizmoDoubleClick = vi.fn();
    let partId = "x";
    system.register({
      id: "a",
      priority: 0,
      hitTest: () => createHit("a", partId),
      onGizmoDoubleClick
    });

    dispatchClick(target, { timeStamp: 10 });
    partId = "y";
    dispatchClick(target, { timeStamp: 100 });

    expect(onGizmoDoubleClick).not.toHaveBeenCalled();

    system.dispose();
  });

  it("does not dispatch doubleClick for different gizmos", () => {
    const target = new FakeEventTarget();
    const system = new GizmoEventSystem({ target: target as unknown as EventTarget });
    const onGizmoDoubleClick = vi.fn();
    system.register({
      ...createGizmo("a", { priority: 0, hit: createHit("a", "axis") }),
      onGizmoDoubleClick
    });

    dispatchClick(target, { timeStamp: 10 });
    system.register({
      ...createGizmo("b", { priority: 1, hit: createHit("b", "axis") }),
      onGizmoDoubleClick
    });
    dispatchClick(target, { timeStamp: 100 });

    expect(onGizmoDoubleClick).not.toHaveBeenCalled();

    system.dispose();
  });

  it("does not dispatch doubleClick after the time window", () => {
    const target = new FakeEventTarget();
    const system = new GizmoEventSystem({
      target: target as unknown as EventTarget,
      doubleClickWindowMs: 100
    });
    const onGizmoDoubleClick = vi.fn();
    system.register({
      ...createGizmo("a", { hit: createHit("a", "axis") }),
      onGizmoDoubleClick
    });

    dispatchClick(target, { timeStamp: 10 });
    dispatchClick(target, { timeStamp: 200 });

    expect(onGizmoDoubleClick).not.toHaveBeenCalled();

    system.dispose();
  });

  it("does not dispatch doubleClick when click positions are too far apart", () => {
    const target = new FakeEventTarget();
    const system = new GizmoEventSystem({
      target: target as unknown as EventTarget,
      doubleClickDistance: 5
    });
    const onGizmoDoubleClick = vi.fn();
    system.register({
      ...createGizmo("a", { hit: createHit("a", "axis") }),
      onGizmoDoubleClick
    });

    dispatchClick(target, { x: 0, y: 0, timeStamp: 10 });
    dispatchClick(target, { x: 10, y: 0, timeStamp: 100 });

    expect(onGizmoDoubleClick).not.toHaveBeenCalled();

    system.dispose();
  });

  it("does not dispatch doubleClick when the second interaction drags past threshold", () => {
    const target = new FakeEventTarget();
    const system = new GizmoEventSystem({
      target: target as unknown as EventTarget,
      clickMoveThreshold: 6
    });
    const onGizmoDoubleClick = vi.fn();
    system.register({
      ...createGizmo("a", { hit: createHit("a", "axis") }),
      onGizmoDoubleClick
    });

    dispatchClick(target, { timeStamp: 10 });
    target.dispatchPointer("pointerdown", createPointerEvent({ clientX: 0, clientY: 0, timeStamp: 100 }));
    target.dispatchPointer("pointermove", createPointerEvent({ clientX: 7, clientY: 0, timeStamp: 101 }));
    target.dispatchPointer("pointerup", createPointerEvent({ clientX: 7, clientY: 0, timeStamp: 102, buttons: 0 }));

    expect(onGizmoDoubleClick).not.toHaveBeenCalled();

    system.dispose();
  });

  it("clears last click after a successful doubleClick so triple click does not create two doubleClicks", () => {
    const target = new FakeEventTarget();
    const system = new GizmoEventSystem({ target: target as unknown as EventTarget });
    const onGizmoDoubleClick = vi.fn();
    system.register({
      ...createGizmo("a", { hit: createHit("a", "axis") }),
      onGizmoDoubleClick
    });

    dispatchClick(target, { timeStamp: 10 });
    dispatchClick(target, { timeStamp: 100 });
    dispatchClick(target, { timeStamp: 180 });

    expect(onGizmoDoubleClick).toHaveBeenCalledOnce();

    system.dispose();
  });
});
