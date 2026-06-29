import type {
  GizmoCancelEvent,
  GizmoClickEvent,
  GizmoController,
  GizmoEndEvent,
  GizmoHit,
  GizmoMoveEvent,
  GizmoStartEvent,
  ScreenPoint
} from "../gizmo";
import type {
  Actor,
  Component,
  ComponentLifecycleObserver,
  ComponentType
} from "../core";
import type { ActorInputSelection } from "./actor-input-hit";
import type { ActorInputStackPrioritySource } from "./actor-input-stack-priority-source";
import { ActorInputRouter } from "./actor-input-router";

export interface ActorInputSmokeCaptureEntry {
  readonly actorId: string;
  readonly bindingId: string;
  readonly partId: string;
  readonly targetComponentId: string;
  readonly point: ScreenPoint;
}

interface ActorInputSmokeCaptureGlobal {
  __PROJECT_PRISM_ACTOR_INPUT_CAPTURE__?: (entry: ActorInputSmokeCaptureEntry) => void;
}

export interface GizmoEventBindingComponentOptions {
  actor: Actor;
  id: string;
  isActorActive?: () => boolean;
  actorInputStackPriority?: ActorInputStackPrioritySource;
  requestPointerFocus?: (actor: Actor) => void;
}

export class GizmoEventBindingComponent implements ComponentLifecycleObserver, GizmoController {
  readonly id: string;
  readonly type: ComponentType<GizmoEventBindingComponent> = gizmoEventBindingComponentType;
  readonly actor: Actor;
  #enabled = true;
  readonly #isActorActive: () => boolean;
  readonly #actorInputStackPriority?: ActorInputStackPrioritySource;
  readonly #requestPointerFocus?: (actor: Actor) => void;
  private readonly router: ActorInputRouter;
  private readonly selectedHits = new WeakMap<GizmoHit, ActorInputSelection>();

  constructor(options: GizmoEventBindingComponentOptions) {
    this.actor = options.actor;
    this.id = options.id;
    this.#isActorActive = options.isActorActive ?? (() => this.actor.enabled);
    this.#actorInputStackPriority = options.actorInputStackPriority;
    this.#requestPointerFocus = options.requestPointerFocus;
    this.router = new ActorInputRouter({
      actor: options.actor,
      isActorActive: this.#isActorActive,
      isEnabled: () => this.#enabled
    });
  }

  get enabled(): boolean {
    return this.#enabled && this.#isActorActive();
  }

  set enabled(value: boolean) {
    this.#enabled = value;
  }

  get priority(): number {
    return this.#actorInputStackPriority?.getEffectiveStackPriorityForActor(this.actor) ??
      this.router.getStackPriority();
  }

  hitTest(point: ScreenPoint): GizmoHit | null {
    const selected = this.router.hitTest(point);
    if (!selected) return null;
    captureActorInputSmokeHit({
      actorId: this.actor.id,
      bindingId: this.id,
      partId: selected.hit.partId,
      targetComponentId: selected.target.id,
      point
    });
    const bindingHit = this.createBindingHit(selected);
    this.selectedHits.set(bindingHit, selected);
    return bindingHit;
  }

  onGizmoStart(event: GizmoStartEvent): void {
    const selected = this.getSelectedSelection(event.hit);
    if (!selected) return;
    if (!this.enabled) return;
    this.#requestPointerFocus?.(this.actor);
    this.router.start(selected, event);
  }

  onGizmoMove(event: GizmoMoveEvent): void {
    this.router.move(event);
  }

  onGizmoEnd(event: GizmoEndEvent): void {
    this.router.end(event);
  }

  onGizmoCancel(event: GizmoCancelEvent): void {
    this.router.cancel(event);
  }

  onGizmoClick(event: GizmoClickEvent): void {
    const selected = this.getSelectedSelection(event.hit);
    if (!selected) return;
    this.router.click(selected, event);
  }

  onGizmoDoubleClick(event: GizmoClickEvent): void {
    const selected = this.getSelectedSelection(event.hit);
    if (!selected) return;
    this.router.doubleClick(selected, event);
  }

  beforeComponentDetach(component: Component): void {
    this.router.beforeComponentDetach(component);
  }

  cancelActiveInput(reason: GizmoCancelEvent["reason"] = "gizmo-disabled"): void {
    this.router.cancelActiveInteraction(reason);
  }

  dispose(): void {
    this.router.dispose();
  }

  private createBindingHit(selection: ActorInputSelection): GizmoHit {
    return {
      gizmoId: this.id,
      partId: selection.hit.partId,
      kind: "custom",
      priority: selection.scopeRouteScore,
      data: {
        actorInputHit: selection.hit,
        targetComponentId: selection.target.id
      }
    };
  }

  private getSelectedSelection(hit: GizmoHit): ActorInputSelection | null {
    return this.selectedHits.get(hit) ?? null;
  }
}

export const gizmoEventBindingComponentType: ComponentType<GizmoEventBindingComponent> =
  "gizmo-event-binding" as ComponentType<GizmoEventBindingComponent>;

function captureActorInputSmokeHit(entry: ActorInputSmokeCaptureEntry): void {
  try {
    (globalThis as ActorInputSmokeCaptureGlobal).__PROJECT_PRISM_ACTOR_INPUT_CAPTURE__?.(entry);
  } catch {
    // Smoke capture is an observation-only test hook. It must never affect hit selection or routing.
  }
}

