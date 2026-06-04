import type {
  GizmoCancelEvent,
  GizmoClickEvent,
  GizmoEndEvent,
  GizmoHit,
  GizmoMoveEvent,
  GizmoStartEvent,
  ScreenPoint
} from "gizmo-core";
import type { Actor, Component } from "../actor-runtime";
import type { ActorInputHit, ActorInputSelection } from "./actor-input-hit";
import {
  isActorInputParticipant,
  type ActorInputCancelEvent,
  type ActorInputClickEvent,
  type ActorInputEndEvent,
  type ActorInputMoveEvent,
  type ActorInputParticipant,
  type ActorInputStartEvent
} from "./actor-input-participant";
import { isGizmoResponder, type GizmoResponder } from "./gizmo-responder";

export interface ActorInputRouterOptions {
  readonly actor: Actor;
  readonly isActorActive?: () => boolean;
  readonly isEnabled?: () => boolean;
}

interface ResolvedActorInputParticipant {
  readonly component: Component;
  readonly participant: ActorInputParticipant;
  readonly order: number;
}

interface CandidateSelection extends ActorInputSelection {
  readonly participantInputPriority: number;
  readonly hitPriority: number;
  readonly pathDepth: number;
  readonly order: number;
}

interface ActiveActorInputInteraction {
  readonly selection: ActorInputSelection;
  readonly gizmo: GizmoStartEvent["gizmo"];
  pointerId: number;
  pointerType: string;
  timeStamp: number;
  point: ScreenPoint;
  startPoint: ScreenPoint;
  buttons: number;
}

interface LegacyActorInputHitData {
  readonly responderHit: GizmoHit;
  readonly data: unknown;
}

const routeScoreLocalRouteFactor = 1_000_000_000_000;
const routeScoreInputFactor = 100_000_000;
const routeScoreHitFactor = 10_000;
const routeScorePathFactor = 100;

export class ActorInputRouter {
  private readonly actor: Actor;
  private readonly isActorActive: () => boolean;
  private readonly isEnabled: () => boolean;
  private active: ActiveActorInputInteraction | null = null;

  constructor(options: ActorInputRouterOptions) {
    this.actor = options.actor;
    this.isActorActive = options.isActorActive ?? (() => this.actor.enabled);
    this.isEnabled = options.isEnabled ?? (() => true);
  }

  getStackPriority(): number {
    const priorities = this.getEnabledParticipants().map(({ participant }) => participant.inputStackPriority ?? 0);
    return priorities.length > 0 ? Math.max(...priorities) : 0;
  }

  hitTest(point: ScreenPoint): ActorInputSelection | null {
    if (!this.canRoute()) return null;
    let best: CandidateSelection | null = null;
    const components = this.actor.listComponents();
    for (const entry of this.getEnabledParticipants(components)) {
      const hit = entry.participant.hitTestInput(point, {
        actor: this.actor,
        component: entry.component,
        components
      });
      if (!hit) continue;
      const candidate = this.createCandidateSelection(entry, hit, components);
      if (!best || compareCandidateSelection(candidate, best) > 0) {
        best = candidate;
      }
    }
    return best;
  }

  start(selection: ActorInputSelection, event: GizmoStartEvent): void {
    this.active = {
      selection,
      gizmo: event.gizmo,
      pointerId: event.pointerId,
      pointerType: event.pointerType,
      timeStamp: event.timeStamp,
      point: event.point,
      startPoint: event.startPoint,
      buttons: event.buttons
    };
    selection.target.onInputStart?.(toActorInputStartEvent(event, selection.hit));
  }

  move(event: GizmoMoveEvent): void {
    if (!this.ensureActiveCanReceive(event)) return;
    this.updateActivePointer(event);
    const active = this.active;
    active?.selection.target.onInputMove?.(toActorInputMoveEvent(event, active.selection.hit));
  }

  end(event: GizmoEndEvent): void {
    if (!this.ensureActiveCanReceive(event)) return;
    this.updateActivePointer(event);
    const active = this.active;
    active?.selection.target.onInputEnd?.(toActorInputEndEvent(event, active.selection.hit));
    this.active = null;
  }

  cancel(event: GizmoCancelEvent): void {
    if (!this.active) return;
    this.updateActivePointer(event);
    const active = this.active;
    this.active = null;
    active.selection.target.onInputCancel?.(toActorInputCancelEvent(event, active.selection.hit));
  }

  click(selection: ActorInputSelection, event: GizmoClickEvent): void {
    selection.target.onInputClick?.(toActorInputClickEvent(event, selection.hit));
  }

  doubleClick(selection: ActorInputSelection, event: GizmoClickEvent): void {
    selection.target.onInputDoubleClick?.(toActorInputClickEvent(event, selection.hit));
  }

  beforeComponentDetach(component: Component): void {
    if (this.active?.selection.pathComponents.includes(component)) {
      this.cancelActive("gizmo-disabled");
    }
  }

  dispose(): void {
    this.cancelActive("system-dispose");
  }

  private canRoute(): boolean {
    return this.isActorActive() && this.isEnabled();
  }

  private getEnabledParticipants(components = this.actor.listComponents()): ResolvedActorInputParticipant[] {
    const participants: ResolvedActorInputParticipant[] = [];
    components.forEach((component, order) => {
      if (!component.enabled) return;
      if (isActorInputParticipant(component)) {
        participants.push({ component, participant: component, order });
        return;
      }
      if (isGizmoResponder(component)) {
        participants.push({ component, participant: createLegacyActorInputParticipant(component), order });
      }
    });
    return participants;
  }

  private createCandidateSelection(
    entry: ResolvedActorInputParticipant,
    hit: ActorInputHit,
    components: readonly Component[]
  ): CandidateSelection {
    const pathComponents = resolvePathComponents(components, entry.component, hit);
    const participantInputPriority = entry.participant.inputPriority ?? 0;
    const hitPriority = hit.hitPriority ?? 0;
    const pathDepth = hit.path.length;
    return {
      target: entry.participant,
      hit,
      pathComponents,
      stackPriority: entry.participant.inputStackPriority ?? 0,
      routeScore: createRouteScore({
        localRoutePriority: hit.localRoutePriority,
        participantInputPriority,
        hitPriority,
        pathDepth,
        order: entry.order
      }),
      participantInputPriority,
      hitPriority,
      pathDepth,
      order: entry.order
    };
  }

  private ensureActiveCanReceive(event: GizmoMoveEvent | GizmoEndEvent): boolean {
    const active = this.active;
    if (!active) return false;
    if (!this.canRoute() || active.selection.pathComponents.some((component) => !component.enabled)) {
      this.updateActivePointer(event);
      this.cancelActive("gizmo-disabled");
      return false;
    }
    return true;
  }

  private updateActivePointer(event: {
    pointerId: number;
    pointerType: string;
    timeStamp: number;
    point: ScreenPoint;
    startPoint: ScreenPoint;
    buttons: number;
  }): void {
    if (!this.active) return;
    this.active.pointerId = event.pointerId;
    this.active.pointerType = event.pointerType;
    this.active.timeStamp = event.timeStamp;
    this.active.point = event.point;
    this.active.startPoint = event.startPoint;
    this.active.buttons = event.buttons;
  }

  private cancelActive(reason: GizmoCancelEvent["reason"]): void {
    const active = this.active;
    if (!active) return;
    this.active = null;
    active.selection.target.onInputCancel?.({
      gizmo: active.gizmo,
      hit: active.selection.hit,
      pointerId: active.pointerId,
      pointerType: active.pointerType,
      timeStamp: active.timeStamp,
      point: active.point,
      startPoint: active.startPoint,
      buttons: active.buttons,
      reason
    } as ActorInputCancelEvent);
  }
}

function createLegacyActorInputParticipant(responder: GizmoResponder): ActorInputParticipant {
  return {
    get id() {
      return responder.id;
    },
    get type() {
      return responder.type;
    },
    get actor() {
      return responder.actor;
    },
    get enabled() {
      return responder.enabled;
    },
    set enabled(value: boolean) {
      responder.enabled = value;
    },
    get inputStackPriority() {
      return responder.gizmoPriority;
    },
    get inputPriority() {
      return responder.gizmoPriority;
    },
    hitTestInput(point: ScreenPoint): ActorInputHit | null {
      const responderHit = responder.hitTestGizmo(point);
      if (!responderHit) return null;
      return {
        componentId: responder.id,
        partId: responderHit.partId,
        kind: "custom",
        region: "custom",
        localRoutePriority: 0,
        hitPriority: responderHit.priority ?? 0,
        path: [{
          componentId: responder.id,
          role: "control",
          partId: responderHit.partId
        }],
        data: {
          responderHit,
          data: responderHit.data
        } satisfies LegacyActorInputHitData
      };
    },
    onInputStart(event: ActorInputStartEvent): void {
      responder.onGizmoStart?.(toLegacyGizmoEvent(event));
    },
    onInputMove(event: ActorInputMoveEvent): void {
      responder.onGizmoMove?.(toLegacyGizmoEvent(event));
    },
    onInputEnd(event: ActorInputEndEvent): void {
      responder.onGizmoEnd?.(toLegacyGizmoEvent(event));
    },
    onInputCancel(event: ActorInputCancelEvent): void {
      responder.onGizmoCancel?.(toLegacyGizmoEvent(event));
    },
    onInputClick(event: ActorInputClickEvent): void {
      responder.onGizmoClick?.(toLegacyGizmoEvent(event));
    },
    onInputDoubleClick(event: ActorInputClickEvent): void {
      responder.onGizmoDoubleClick?.(toLegacyGizmoEvent(event));
    }
  };
}

function resolvePathComponents(
  components: readonly Component[],
  targetComponent: Component,
  hit: ActorInputHit
): readonly Component[] {
  const componentsById = new Map(components.map((component) => [component.id, component]));
  const pathComponents: Component[] = [];
  for (const node of hit.path) {
    const component = componentsById.get(node.componentId);
    if (component && !pathComponents.includes(component)) {
      pathComponents.push(component);
    }
  }
  if (!pathComponents.includes(targetComponent)) {
    pathComponents.push(targetComponent);
  }
  return pathComponents;
}

function compareCandidateSelection(a: CandidateSelection, b: CandidateSelection): number {
  const routePriorityDelta = a.hit.localRoutePriority - b.hit.localRoutePriority;
  if (routePriorityDelta !== 0) return routePriorityDelta;
  const participantPriorityDelta = a.participantInputPriority - b.participantInputPriority;
  if (participantPriorityDelta !== 0) return participantPriorityDelta;
  const hitPriorityDelta = a.hitPriority - b.hitPriority;
  if (hitPriorityDelta !== 0) return hitPriorityDelta;
  const pathDepthDelta = a.pathDepth - b.pathDepth;
  if (pathDepthDelta !== 0) return pathDepthDelta;
  return a.order - b.order;
}

function createRouteScore(options: {
  readonly localRoutePriority: number;
  readonly participantInputPriority: number;
  readonly hitPriority: number;
  readonly pathDepth: number;
  readonly order: number;
}): number {
  return (
    options.localRoutePriority * routeScoreLocalRouteFactor +
    options.participantInputPriority * routeScoreInputFactor +
    options.hitPriority * routeScoreHitFactor +
    options.pathDepth * routeScorePathFactor +
    options.order
  );
}

function toActorInputStartEvent(event: GizmoStartEvent, hit: ActorInputHit): ActorInputStartEvent {
  return { ...event, hit };
}

function toActorInputMoveEvent(event: GizmoMoveEvent, hit: ActorInputHit): ActorInputMoveEvent {
  return { ...event, hit };
}

function toActorInputEndEvent(event: GizmoEndEvent, hit: ActorInputHit): ActorInputEndEvent {
  return { ...event, hit };
}

function toActorInputCancelEvent(event: GizmoCancelEvent, hit: ActorInputHit): ActorInputCancelEvent {
  return { ...event, hit };
}

function toActorInputClickEvent(event: GizmoClickEvent, hit: ActorInputHit): ActorInputClickEvent {
  return { ...event, hit };
}

function toLegacyGizmoEvent<TEvent extends { readonly hit: ActorInputHit }>(
  event: TEvent
): Omit<TEvent, "hit"> & { readonly hit: GizmoHit } {
  return {
    ...event,
    hit: readLegacyResponderHit(event.hit)
  };
}

function readLegacyResponderHit(hit: ActorInputHit): GizmoHit {
  const data = hit.data;
  if (
    typeof data === "object" &&
    data !== null &&
    "responderHit" in data
  ) {
    return (data as LegacyActorInputHitData).responderHit;
  }
  return {
    gizmoId: hit.componentId,
    partId: hit.partId,
    kind: "custom",
    priority: hit.hitPriority,
    data: hit.data
  };
}
