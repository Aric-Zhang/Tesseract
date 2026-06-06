import type {
  Disposable,
  GizmoBaseEvent,
  GizmoCancelEvent,
  GizmoController,
  GizmoHit,
  ScreenDelta,
  ScreenPoint
} from "./types";
import { formatGizmoDebugLog, type GizmoDebugLogEntry, type GizmoDebugLogType } from "./debug-log";

export type { GizmoDebugLogEntry, GizmoDebugLogType } from "./debug-log";

export interface GizmoEventSystemOptions {
  target?: Window | Document | HTMLElement | EventTarget;
  clickMoveThreshold?: number;
  doubleClickWindowMs?: number;
  doubleClickDistance?: number;
  preventDefaultOnHit?: boolean;
  debug?: boolean;
  debugConsole?: boolean;
  onDebugLog?: (entry: GizmoDebugLogEntry) => void;
}

interface RegisteredGizmo {
  gizmo: GizmoController;
  order: number;
}

interface SelectedGizmoHit {
  gizmo: GizmoController;
  hit: GizmoHit;
  order: number;
}

interface ActiveGizmoInteraction {
  gizmo: GizmoController;
  hit: GizmoHit;
  pointerId: number;
  pointerType: string;
  startPoint: ScreenPoint;
  lastPoint: ScreenPoint;
  currentPoint: ScreenPoint;
  startTime: number;
  lastTime: number;
  buttons: number;
  movedPastClickThreshold: boolean;
  captureElement: PointerCaptureHost | null;
}

interface LastGizmoClick {
  gizmoId: string;
  partId: string;
  point: ScreenPoint;
  timeStamp: number;
}

interface PointerCaptureHost {
  setPointerCapture(pointerId: number): void;
  releasePointerCapture(pointerId: number): void;
  hasPointerCapture(pointerId: number): boolean;
}

type PointerInputSource = "pointer" | "mouse";
type RawPointerInputEvent = PointerEvent | MouseEvent;

interface NormalizedPointerEvent {
  source: PointerInputSource;
  rawEvent: RawPointerInputEvent;
  pointerId: number;
  pointerType: string;
  isPrimary: boolean;
  button: number;
  buttons: number;
  clientX: number;
  clientY: number;
  timeStamp: number;
  target: EventTarget | null;
  preventDefault(): void;
}

const listenerOptions: AddEventListenerOptions = { capture: true, passive: false };

export class GizmoEventSystem {
  private readonly target: Window | Document | HTMLElement | EventTarget;
  private readonly clickMoveThreshold: number;
  private readonly doubleClickWindowMs: number;
  private readonly doubleClickDistance: number;
  private readonly preventDefaultOnHit: boolean;
  private readonly debug: boolean;
  private readonly debugConsole: boolean;
  private readonly onDebugLog?: (entry: GizmoDebugLogEntry) => void;
  private readonly registered: RegisteredGizmo[] = [];
  private nextRegistrationOrder = 0;
  private active: ActiveGizmoInteraction | null = null;
  private lastClick: LastGizmoClick | null = null;
  private disposed = false;
  private receivedPointerEvent = false;

  constructor(options: GizmoEventSystemOptions = {}) {
    this.target = options.target ?? this.getDefaultTarget();
    this.clickMoveThreshold = options.clickMoveThreshold ?? 6;
    this.doubleClickWindowMs = options.doubleClickWindowMs ?? 360;
    this.doubleClickDistance = options.doubleClickDistance ?? 12;
    this.preventDefaultOnHit = options.preventDefaultOnHit ?? true;
    this.debug = options.debug ?? false;
    this.debugConsole = options.debugConsole ?? this.debug;
    this.onDebugLog = options.onDebugLog;
    this.addListeners();
  }

  register(gizmo: GizmoController): Disposable {
    if (this.disposed) {
      throw new Error("Cannot register a gizmo after GizmoEventSystem.dispose().");
    }
    if (!this.registered.some((entry) => entry.gizmo === gizmo)) {
      this.registered.push({ gizmo, order: this.nextRegistrationOrder++ });
    }
    return {
      dispose: () => this.unregister(gizmo)
    };
  }

  unregister(gizmo: GizmoController): void {
    const index = this.registered.findIndex((entry) => entry.gizmo === gizmo);
    if (this.active?.gizmo === gizmo) {
      this.cancelActive("gizmo-disabled");
    }
    if (index >= 0) {
      this.registered.splice(index, 1);
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    if (this.active) {
      this.cancelActive("system-dispose");
    }
    this.registered.length = 0;
    this.removeListeners();
  }

  private getDefaultTarget(): Window {
    if (typeof window === "undefined") {
      throw new Error("GizmoEventSystem requires a target when window is not available.");
    }
    return window;
  }

  private addListeners(): void {
    this.target.addEventListener("pointerdown", this.onPointerDown, listenerOptions);
    this.target.addEventListener("pointermove", this.onPointerMove, listenerOptions);
    this.target.addEventListener("pointerup", this.onPointerUp, listenerOptions);
    this.target.addEventListener("pointercancel", this.onPointerCancel, listenerOptions);
    this.target.addEventListener("mousedown", this.onMouseDown, listenerOptions);
    this.target.addEventListener("mousemove", this.onMouseMove, listenerOptions);
    this.target.addEventListener("mouseup", this.onMouseUp, listenerOptions);
  }

  private removeListeners(): void {
    this.target.removeEventListener("pointerdown", this.onPointerDown, listenerOptions);
    this.target.removeEventListener("pointermove", this.onPointerMove, listenerOptions);
    this.target.removeEventListener("pointerup", this.onPointerUp, listenerOptions);
    this.target.removeEventListener("pointercancel", this.onPointerCancel, listenerOptions);
    this.target.removeEventListener("mousedown", this.onMouseDown, listenerOptions);
    this.target.removeEventListener("mousemove", this.onMouseMove, listenerOptions);
    this.target.removeEventListener("mouseup", this.onMouseUp, listenerOptions);
  }

  private findBestHit(point: ScreenPoint): SelectedGizmoHit | null {
    let best: SelectedGizmoHit | null = null;
    for (const entry of this.registered) {
      if (entry.gizmo.enabled === false) continue;
      const hit = entry.gizmo.hitTest(point);
      if (!hit) continue;
      const candidate = { gizmo: entry.gizmo, hit, order: entry.order };
      if (!best || this.compareHit(candidate, best) > 0) {
        best = candidate;
      }
    }
    return best;
  }

  private compareHit(a: SelectedGizmoHit, b: SelectedGizmoHit): number {
    const controllerPriorityDelta = a.gizmo.priority - b.gizmo.priority;
    if (controllerPriorityDelta !== 0) return controllerPriorityDelta;
    const hitPriorityDelta = (a.hit.priority ?? 0) - (b.hit.priority ?? 0);
    if (hitPriorityDelta !== 0) return hitPriorityDelta;
    return a.order - b.order;
  }

  private createBaseEvent(
    active: ActiveGizmoInteraction,
    event: NormalizedPointerEvent,
    point: ScreenPoint
  ): GizmoBaseEvent {
    return {
      gizmo: active.gizmo,
      hit: active.hit,
      pointerId: active.pointerId,
      pointerType: active.pointerType,
      timeStamp: event.timeStamp,
      point,
      startPoint: active.startPoint,
      buttons: event.buttons,
      rawEvent: event.rawEvent
    };
  }

  private createCancelEvent(
    active: ActiveGizmoInteraction,
    reason: GizmoCancelEvent["reason"],
    event?: NormalizedPointerEvent
  ): GizmoCancelEvent {
    const point = event ? this.createPoint(event) : active.currentPoint;
    return {
      gizmo: active.gizmo,
      hit: active.hit,
      pointerId: active.pointerId,
      pointerType: active.pointerType,
      timeStamp: event?.timeStamp ?? active.lastTime,
      point,
      startPoint: active.startPoint,
      buttons: event?.buttons ?? active.buttons,
      rawEvent: event?.rawEvent,
      reason
    };
  }

  private createPoint(event: NormalizedPointerEvent): ScreenPoint {
    return { x: event.clientX, y: event.clientY };
  }

  private getDelta(from: ScreenPoint, to: ScreenPoint): ScreenDelta {
    return { dx: to.x - from.x, dy: to.y - from.y };
  }

  private exceedsClickMoveThreshold(delta: ScreenDelta): boolean {
    return Math.hypot(delta.dx, delta.dy) > this.clickMoveThreshold;
  }

  private isWithinDoubleClickDistance(a: ScreenPoint, b: ScreenPoint): boolean {
    return Math.hypot(a.x - b.x, a.y - b.y) <= this.doubleClickDistance;
  }

  private maybePreventDefaultInput(event: NormalizedPointerEvent): void {
    if (this.preventDefaultOnHit) {
      event.preventDefault();
    }
  }

  private log(
    type: GizmoDebugLogType,
    event: NormalizedPointerEvent | undefined,
    details: Omit<GizmoDebugLogEntry, "type" | "message"> = {}
  ): void {
    if (!this.debug) return;
    const point = details.point ?? (event ? this.createPoint(event) : undefined);
    const entry: GizmoDebugLogEntry = {
      type,
      timeStamp: details.timeStamp ?? event?.timeStamp,
      pointerId: details.pointerId ?? event?.pointerId,
      pointerType: details.pointerType ?? event?.pointerType,
      button: details.button ?? event?.button,
      buttons: details.buttons ?? event?.buttons,
      point,
      gizmoId: details.gizmoId,
      partId: details.partId,
      reason: details.reason,
      delta: details.delta,
      totalDelta: details.totalDelta,
      isDragging: details.isDragging,
      capture: details.capture,
      message: ""
    };
    entry.message = formatGizmoDebugLog(entry);
    this.onDebugLog?.(entry);
    if (this.debugConsole) {
      console.debug(`[gizmo] ${entry.message}`, entry);
    }
  }

  private cancelActive(reason: GizmoCancelEvent["reason"], event?: NormalizedPointerEvent): void {
    const active = this.active;
    if (!active) return;
    this.log("cancel", event, {
      gizmoId: active.gizmo.id,
      partId: active.hit.partId,
      reason,
      capture: this.hasActivePointerCapture(active)
    });
    active.gizmo.onGizmoCancel?.(this.createCancelEvent(active, reason, event));
    this.releasePointerCapture(active);
    this.active = null;
  }

  private getPointerCaptureHost(event: NormalizedPointerEvent): PointerCaptureHost | null {
    const candidate = this.asPointerCaptureHost(event.target);
    if (candidate) return candidate;
    const rawEvent = event.rawEvent as {
      composedPath?: () => unknown[];
    };
    const path = typeof rawEvent.composedPath === "function" ? rawEvent.composedPath() : [];
    for (const entry of path) {
      const pathCandidate = this.asPointerCaptureHost(entry);
      if (pathCandidate) return pathCandidate;
    }
    return this.getDocumentElementCaptureHost(event.target) ??
      this.getDocumentElementCaptureHost(this.target);
  }

  private asPointerCaptureHost(value: unknown): PointerCaptureHost | null {
    const candidate = value as Partial<PointerCaptureHost> | null;
    if (
      candidate &&
      typeof candidate.setPointerCapture === "function" &&
      typeof candidate.releasePointerCapture === "function" &&
      typeof candidate.hasPointerCapture === "function"
    ) {
      return candidate as PointerCaptureHost;
    }
    return null;
  }

  private getDocumentElementCaptureHost(value: unknown): PointerCaptureHost | null {
    const candidate = value as {
      document?: { documentElement?: unknown };
      documentElement?: unknown;
      ownerDocument?: { documentElement?: unknown };
    } | null;
    return this.asPointerCaptureHost(candidate?.ownerDocument?.documentElement) ??
      this.asPointerCaptureHost(candidate?.documentElement) ??
      this.asPointerCaptureHost(candidate?.document?.documentElement);
  }

  private setPointerCapture(event: NormalizedPointerEvent): PointerCaptureHost | null {
    const host = this.getPointerCaptureHost(event);
    if (!host) return null;
    try {
      host.setPointerCapture(event.pointerId);
      return host;
    } catch {
      return null;
    }
  }

  private releasePointerCapture(active: ActiveGizmoInteraction): void {
    const host = active.captureElement;
    if (!host) return;
    try {
      if (host.hasPointerCapture(active.pointerId)) {
        host.releasePointerCapture(active.pointerId);
      }
    } catch {
      // Pointer capture is an auxiliary stabilizer; never let it break cleanup.
    }
  }

  private hasActivePointerCapture(active: ActiveGizmoInteraction): boolean {
    const host = active.captureElement;
    if (!host) return false;
    try {
      return host.hasPointerCapture(active.pointerId);
    } catch {
      return false;
    }
  }

  private handleClickCandidate(active: ActiveGizmoInteraction, event: NormalizedPointerEvent, point: ScreenPoint): void {
    const current: LastGizmoClick = {
      gizmoId: active.gizmo.id,
      partId: active.hit.partId,
      point,
      timeStamp: event.timeStamp
    };
    const previous = this.lastClick;
    if (
      previous &&
      previous.gizmoId === current.gizmoId &&
      previous.partId === current.partId &&
      current.timeStamp - previous.timeStamp <= this.doubleClickWindowMs &&
      this.isWithinDoubleClickDistance(previous.point, current.point)
    ) {
      this.log("double-click", event, {
        point,
        gizmoId: active.gizmo.id,
        partId: active.hit.partId
      });
      active.gizmo.onGizmoDoubleClick?.({
        ...this.createBaseEvent(active, event, point),
        clickCount: 2
      });
      this.lastClick = null;
      return;
    }

    this.lastClick = current;
    this.log("click", event, {
      point,
      gizmoId: active.gizmo.id,
      partId: active.hit.partId
    });
    active.gizmo.onGizmoClick?.({
      ...this.createBaseEvent(active, event, point),
      clickCount: 1
    });
  }

  private normalizePointerEvent(event: Event, source: PointerInputSource): NormalizedPointerEvent {
    const rawEvent = event as RawPointerInputEvent;
    const candidate = rawEvent as Partial<PointerEvent>;
    return {
      source,
      rawEvent,
      pointerId: source === "pointer" && typeof candidate.pointerId === "number" ? candidate.pointerId : 1,
      pointerType: source === "pointer" && typeof candidate.pointerType === "string" ? candidate.pointerType : "mouse",
      isPrimary: source === "pointer" && typeof candidate.isPrimary === "boolean" ? candidate.isPrimary : true,
      button: typeof rawEvent.button === "number" ? rawEvent.button : 0,
      buttons: typeof rawEvent.buttons === "number" ? rawEvent.buttons : this.getFallbackButtons(event.type),
      clientX: rawEvent.clientX,
      clientY: rawEvent.clientY,
      timeStamp: rawEvent.timeStamp,
      target: rawEvent.target,
      preventDefault: () => rawEvent.preventDefault()
    };
  }

  private getFallbackButtons(type: string): number {
    if (type === "mousedown") return 1;
    if (type === "mouseup") return 0;
    return this.active?.buttons ?? 0;
  }

  private handlePointerDown(pointerEvent: NormalizedPointerEvent): void {
    this.log("pointerdown", pointerEvent);
    if (this.active) {
      this.log("ignore", pointerEvent, { reason: "active-exists", gizmoId: this.active.gizmo.id, partId: this.active.hit.partId });
      return;
    }
    if (pointerEvent.isPrimary === false) {
      this.log("ignore", pointerEvent, { reason: "non-primary" });
      return;
    }
    if (pointerEvent.pointerType === "mouse" && pointerEvent.button !== 0) {
      this.log("ignore", pointerEvent, { reason: "non-left-button" });
      return;
    }

    const point = this.createPoint(pointerEvent);
    const selected = this.findBestHit(point);
    if (!selected) {
      this.log("miss", pointerEvent, { point });
      return;
    }

    this.maybePreventDefaultInput(pointerEvent);
    const captureElement = this.setPointerCapture(pointerEvent);
    this.log("hit", pointerEvent, {
      point,
      gizmoId: selected.gizmo.id,
      partId: selected.hit.partId,
      capture: captureElement !== null
    });
    this.active = {
      gizmo: selected.gizmo,
      hit: selected.hit,
      pointerId: pointerEvent.pointerId,
      pointerType: pointerEvent.pointerType,
      startPoint: point,
      lastPoint: point,
      currentPoint: point,
      startTime: pointerEvent.timeStamp,
      lastTime: pointerEvent.timeStamp,
      buttons: pointerEvent.buttons,
      movedPastClickThreshold: false,
      captureElement
    };
    this.log("start", pointerEvent, {
      point,
      gizmoId: selected.gizmo.id,
      partId: selected.hit.partId,
      capture: captureElement !== null
    });
    selected.gizmo.onGizmoStart?.(this.createBaseEvent(this.active, pointerEvent, point));
  }

  private handlePointerMove(pointerEvent: NormalizedPointerEvent): void {
    const active = this.active;
    if (!active) return;
    if (pointerEvent.pointerId !== active.pointerId) {
      this.log("ignore", pointerEvent, { reason: "pointer-id-mismatch", gizmoId: active.gizmo.id, partId: active.hit.partId });
      return;
    }

    this.maybePreventDefaultInput(pointerEvent);
    if (active.gizmo.enabled === false) {
      this.cancelActive("gizmo-disabled", pointerEvent);
      return;
    }
    if (active.pointerType === "mouse" && pointerEvent.buttons === 0 && !this.hasActivePointerCapture(active)) {
      this.log("ignore", pointerEvent, {
        reason: "buttons-zero-without-capture",
        gizmoId: active.gizmo.id,
        partId: active.hit.partId,
        capture: false
      });
    }
    const point = this.createPoint(pointerEvent);
    const delta = this.getDelta(active.lastPoint, point);
    const totalDelta = this.getDelta(active.startPoint, point);
    active.currentPoint = point;
    active.buttons = pointerEvent.buttons;
    if (this.exceedsClickMoveThreshold(totalDelta)) {
      active.movedPastClickThreshold = true;
    }
    this.log("pointermove", pointerEvent, {
      point,
      gizmoId: active.gizmo.id,
      partId: active.hit.partId,
      delta,
      totalDelta,
      isDragging: active.movedPastClickThreshold,
      capture: this.hasActivePointerCapture(active)
    });

    active.gizmo.onGizmoMove?.({
      ...this.createBaseEvent(active, pointerEvent, point),
      delta,
      totalDelta,
      isDragging: active.movedPastClickThreshold
    });
    this.log("move", pointerEvent, {
      point,
      gizmoId: active.gizmo.id,
      partId: active.hit.partId,
      delta,
      totalDelta,
      isDragging: active.movedPastClickThreshold,
      capture: this.hasActivePointerCapture(active)
    });

    active.lastPoint = point;
    active.lastTime = pointerEvent.timeStamp;
  }

  private handlePointerUp(pointerEvent: NormalizedPointerEvent): void {
    const active = this.active;
    this.log("pointerup", pointerEvent);
    if (!active) return;
    if (pointerEvent.pointerId !== active.pointerId) {
      this.log("ignore", pointerEvent, { reason: "pointer-id-mismatch", gizmoId: active.gizmo.id, partId: active.hit.partId });
      return;
    }

    this.maybePreventDefaultInput(pointerEvent);
    if (active.gizmo.enabled === false) {
      this.cancelActive("gizmo-disabled", pointerEvent);
      return;
    }
    const point = this.createPoint(pointerEvent);
    const totalDelta = this.getDelta(active.startPoint, point);
    if (this.exceedsClickMoveThreshold(totalDelta)) {
      active.movedPastClickThreshold = true;
    }

    active.gizmo.onGizmoEnd?.({
      ...this.createBaseEvent(active, pointerEvent, point),
      totalDelta,
      wasClick: !active.movedPastClickThreshold
    });
    this.log("end", pointerEvent, {
      point,
      gizmoId: active.gizmo.id,
      partId: active.hit.partId,
      totalDelta,
      isDragging: active.movedPastClickThreshold,
      capture: this.hasActivePointerCapture(active)
    });

    if (active.movedPastClickThreshold) {
      this.lastClick = null;
    } else {
      this.handleClickCandidate(active, pointerEvent, point);
    }

    this.releasePointerCapture(active);
    this.active = null;
  }

  private handlePointerCancel(pointerEvent: NormalizedPointerEvent): void {
    const active = this.active;
    this.log("pointercancel", pointerEvent);
    if (!active) return;
    if (pointerEvent.pointerId !== active.pointerId) {
      this.log("ignore", pointerEvent, { reason: "pointer-id-mismatch", gizmoId: active.gizmo.id, partId: active.hit.partId });
      return;
    }

    this.maybePreventDefaultInput(pointerEvent);
    this.cancelActive("pointercancel", pointerEvent);
  }

  private readonly onPointerDown = (event: Event): void => {
    this.receivedPointerEvent = true;
    this.handlePointerDown(this.normalizePointerEvent(event, "pointer"));
  };

  private readonly onPointerMove = (event: Event): void => {
    this.handlePointerMove(this.normalizePointerEvent(event, "pointer"));
  };

  private readonly onPointerUp = (event: Event): void => {
    this.handlePointerUp(this.normalizePointerEvent(event, "pointer"));
  };

  private readonly onPointerCancel = (event: Event): void => {
    this.handlePointerCancel(this.normalizePointerEvent(event, "pointer"));
  };

  private readonly onMouseDown = (event: Event): void => {
    if (this.receivedPointerEvent) return;
    this.handlePointerDown(this.normalizePointerEvent(event, "mouse"));
  };

  private readonly onMouseMove = (event: Event): void => {
    if (this.receivedPointerEvent) return;
    this.handlePointerMove(this.normalizePointerEvent(event, "mouse"));
  };

  private readonly onMouseUp = (event: Event): void => {
    if (this.receivedPointerEvent) return;
    this.handlePointerUp(this.normalizePointerEvent(event, "mouse"));
  };
}
