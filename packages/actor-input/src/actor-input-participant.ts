import type {
  GizmoCancelEvent,
  GizmoClickEvent,
  GizmoEndEvent,
  GizmoMoveEvent,
  GizmoStartEvent,
  ScreenPoint
} from "gizmo-core";
import type { Actor, Component } from "actor-core";
import type { ActorInputHit } from "./actor-input-hit";

export interface ActorInputHitContext {
  readonly actor: Actor;
  readonly component: Component;
  readonly components: readonly Component[];
}

export type ActorInputStartEvent = Omit<GizmoStartEvent, "hit"> & { readonly hit: ActorInputHit };
export type ActorInputMoveEvent = Omit<GizmoMoveEvent, "hit"> & { readonly hit: ActorInputHit };
export type ActorInputEndEvent = Omit<GizmoEndEvent, "hit"> & { readonly hit: ActorInputHit };
export type ActorInputCancelEvent = Omit<GizmoCancelEvent, "hit"> & { readonly hit: ActorInputHit };
export type ActorInputClickEvent = Omit<GizmoClickEvent, "hit"> & { readonly hit: ActorInputHit };

export interface ActorInputParticipant extends Component {
  readonly inputStackPriority?: number;
  readonly inputPriority?: number;

  hitTestInput(point: ScreenPoint, context: ActorInputHitContext): ActorInputHit | null;

  onInputStart?(event: ActorInputStartEvent): void;
  onInputMove?(event: ActorInputMoveEvent): void;
  onInputEnd?(event: ActorInputEndEvent): void;
  onInputCancel?(event: ActorInputCancelEvent): void;
  onInputClick?(event: ActorInputClickEvent): void;
  onInputDoubleClick?(event: ActorInputClickEvent): void;
}

export function isActorInputParticipant(component: Component): component is ActorInputParticipant {
  const candidate = component as Partial<ActorInputParticipant>;
  return (
    typeof component.enabled === "boolean" &&
    typeof candidate.hitTestInput === "function"
  );
}

