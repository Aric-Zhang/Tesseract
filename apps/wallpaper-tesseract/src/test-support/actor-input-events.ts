import type { GizmoController, ScreenPoint } from "actor-system/gizmo";
import type {
  ActorInputEndEvent,
  ActorInputHit,
  ActorInputMoveEvent,
  ActorInputStartEvent
} from "../gizmo-runtime";

export interface ActorInputHitBuilderOptions {
  readonly kind?: ActorInputHit["kind"];
  readonly region?: ActorInputHit["region"];
  readonly partId?: string;
  readonly localRoutePriority?: number;
  readonly hitPriority?: number;
  readonly path?: ActorInputHit["path"];
  readonly data?: unknown;
}

export function createActorInputHit(
  componentId: string,
  options: ActorInputHitBuilderOptions = {}
): ActorInputHit {
  const partId = options.partId ?? componentId;
  return {
    componentId,
    partId,
    kind: options.kind ?? "control",
    region: options.region ?? "content-control",
    localRoutePriority: options.localRoutePriority ?? 0,
    hitPriority: options.hitPriority,
    path: options.path ?? [{ componentId, role: "control", partId }],
    data: options.data
  };
}

export interface ActorInputStartEventBuilderOptions {
  readonly point?: ScreenPoint;
  readonly startPoint?: ScreenPoint;
  readonly timeStamp?: number;
  readonly buttons?: number;
  readonly pointerId?: number;
  readonly pointerType?: ActorInputStartEvent["pointerType"];
  readonly gizmo?: GizmoController;
}

export function createActorInputStartEvent(
  hit: ActorInputHit,
  options: ActorInputStartEventBuilderOptions = {}
): ActorInputStartEvent {
  const point = options.point ?? { x: 20, y: 36 };
  return {
    gizmo: options.gizmo ?? createActorInputGizmo(hit),
    hit,
    pointerId: options.pointerId ?? 1,
    pointerType: options.pointerType ?? "mouse",
    timeStamp: options.timeStamp ?? 10,
    point,
    startPoint: options.startPoint ?? point,
    buttons: options.buttons ?? 1
  };
}

export interface ActorInputMoveEventBuilderOptions extends ActorInputStartEventBuilderOptions {
  readonly delta?: { dx: number; dy: number };
  readonly totalDelta?: { dx: number; dy: number };
  readonly isDragging?: boolean;
}

export function createActorInputMoveEvent(
  hit: ActorInputHit,
  options: ActorInputMoveEventBuilderOptions = {}
): ActorInputMoveEvent {
  const totalDelta = options.totalDelta ?? options.delta ?? { dx: 0, dy: 0 };
  return {
    ...createActorInputStartEvent(hit, {
      ...options,
      timeStamp: options.timeStamp ?? 20,
      point: options.point ?? { x: 20 + totalDelta.dx, y: 36 + totalDelta.dy }
    }),
    delta: options.delta ?? totalDelta,
    totalDelta,
    isDragging: options.isDragging ?? true
  };
}

export interface ActorInputEndEventBuilderOptions extends ActorInputStartEventBuilderOptions {
  readonly totalDelta?: { dx: number; dy: number };
  readonly wasClick?: boolean;
}

export function createActorInputEndEvent(
  hit: ActorInputHit,
  options: ActorInputEndEventBuilderOptions = {}
): ActorInputEndEvent {
  return {
    ...createActorInputStartEvent(hit, {
      ...options,
      timeStamp: options.timeStamp ?? 30,
      buttons: options.buttons ?? 0
    }),
    totalDelta: options.totalDelta ?? { dx: 0, dy: 0 },
    wasClick: options.wasClick ?? true
  };
}

export function createActorInputGizmo(hit: ActorInputHit): GizmoController {
  return {
    id: hit.componentId,
    priority: 0,
    hitTest() {
      return {
        gizmoId: hit.componentId,
        partId: hit.partId,
        kind: "custom"
      };
    }
  };
}
