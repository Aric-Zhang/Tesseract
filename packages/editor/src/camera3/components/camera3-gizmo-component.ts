import type {
  GizmoCancelEvent,
  GizmoHit,
  ScreenPoint
} from "actor-system/gizmo";
import type { Actor, ComponentType } from "actor-system/core";
import type { UiElementComponent } from "ui-framework";
import { actorInputScopeRoutePriority } from "actor-system/input";
import type {
  ActorInputCancelEvent,
  ActorInputClickEvent,
  ActorInputEndEvent,
  ActorInputHit,
  ActorInputMoveEvent,
  ActorInputParticipant,
  ActorInputStartEvent
} from "actor-system/input";
import { Camera3Gizmo, type Camera3GizmoOptions } from "../camera3-gizmo";
import type { RuntimeCameraViewState } from "runtime-core";

export const camera3GizmoComponentType =
  "camera3-gizmo-component" as ComponentType<Camera3GizmoComponent>;

export type Camera3GizmoViewFactory = (options: Camera3GizmoOptions) => Camera3Gizmo;

export interface Camera3GizmoComponentOptions extends Camera3GizmoOptions {
  createGizmo?: Camera3GizmoViewFactory;
}

interface Camera3ActorInputHitData {
  readonly gizmoHit: GizmoHit;
  readonly data: unknown;
}

export class Camera3GizmoComponent implements ActorInputParticipant {
  readonly id = "camera3-view-gizmo";
  readonly type = camera3GizmoComponentType;
  readonly actor: Actor;
  enabled = true;
  readonly gizmo: Camera3Gizmo;

  constructor(actor: Actor, uiElement: UiElementComponent, options: Camera3GizmoComponentOptions) {
    this.actor = actor;
    this.gizmo = (options.createGizmo ?? ((gizmoOptions) => new Camera3Gizmo(gizmoOptions)))(options);
    uiElement.element.append(this.gizmo.element);
  }

  get inputStackPriority(): number {
    return this.gizmo.priority;
  }

  get inputPriority(): number {
    return this.gizmo.priority;
  }

  update(viewState?: RuntimeCameraViewState): void {
    this.gizmo.update(viewState);
  }

  hitTestInput(point: ScreenPoint): ActorInputHit | null {
    const gizmoHit = this.gizmo.hitTest(point);
    if (!gizmoHit) return null;
    return {
      componentId: this.id,
      partId: gizmoHit.partId,
      kind: "custom",
      region: "actor-overlay",
      scopeRoutePriority: actorInputScopeRoutePriority.actorOverlay,
      localRoutePriority: 0,
      hitPriority: gizmoHit.priority ?? 0,
      path: [{
        componentId: this.id,
        role: "control",
        partId: gizmoHit.partId
      }],
      data: {
        gizmoHit,
        data: gizmoHit.data
      } satisfies Camera3ActorInputHitData
    };
  }

  onInputMove(event: ActorInputMoveEvent): void {
    this.gizmo.onGizmoMove?.(toCamera3GizmoEvent(event));
  }

  onInputStart(event: ActorInputStartEvent): void {
    this.gizmo.onGizmoStart?.(toCamera3GizmoEvent(event));
  }

  onInputEnd(event: ActorInputEndEvent): void {
    this.gizmo.onGizmoEnd?.(toCamera3GizmoEvent(event));
  }

  onInputCancel(event: ActorInputCancelEvent): void {
    (this.gizmo as { onGizmoCancel?(cancelEvent: GizmoCancelEvent): void }).onGizmoCancel?.(
      toCamera3GizmoEvent(event)
    );
  }

  onInputClick(event: ActorInputClickEvent): void {
    this.gizmo.onGizmoClick?.(toCamera3GizmoEvent(event));
  }

  onInputDoubleClick(event: ActorInputClickEvent): void {
    this.gizmo.onGizmoDoubleClick?.(toCamera3GizmoEvent(event));
  }

  dispose(): void {
    this.enabled = false;
    this.gizmo.dispose();
  }
}

function toCamera3GizmoEvent<TEvent extends { readonly hit: ActorInputHit }>(
  event: TEvent
): Omit<TEvent, "hit"> & { readonly hit: GizmoHit } {
  return {
    ...event,
    hit: readCamera3GizmoHit(event.hit)
  };
}

function readCamera3GizmoHit(hit: ActorInputHit): GizmoHit {
  const data = hit.data;
  if (
    typeof data === "object" &&
    data !== null &&
    "gizmoHit" in data
  ) {
    return (data as Camera3ActorInputHitData).gizmoHit;
  }
  return {
    gizmoId: hit.componentId,
    partId: hit.partId,
    kind: "custom",
    priority: hit.hitPriority,
    data: hit.data
  };
}
