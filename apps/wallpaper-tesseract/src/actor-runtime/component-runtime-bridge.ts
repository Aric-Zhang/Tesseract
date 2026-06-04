import type {
  GizmoCancelEvent,
  GizmoClickEvent,
  GizmoController,
  GizmoEndEvent,
  GizmoHit,
  GizmoMoveEvent,
  GizmoStartEvent,
  ScreenPoint
} from "gizmo-core";
import type {
  RuntimeRegistration,
  SceneStateChangedEvent,
  SceneStateObserver
} from "../scene-runtime";
import type { GizmoControllerRegistry, SceneStateObserverRegistry } from "../runtime/ports";
import type { Actor } from "./actor";
import type { Component, ComponentDefinition } from "./component";

export interface ComponentRuntimeBridgeOptions {
  gizmoEventSystem: GizmoControllerRegistry;
  frameStateController: SceneStateObserverRegistry;
  isActorActive?: (actor: Actor) => boolean;
}

export class ComponentRuntimeBridge {
  private readonly gizmoEventSystem: GizmoControllerRegistry;
  private readonly frameStateController: SceneStateObserverRegistry;
  private readonly isActorActive: (actor: Actor) => boolean;

  constructor(options: ComponentRuntimeBridgeOptions) {
    this.gizmoEventSystem = options.gizmoEventSystem;
    this.frameStateController = options.frameStateController;
    this.isActorActive = options.isActorActive ?? ((actor) => actor.enabled);
  }

  attach(actor: Actor, component: Component, definition: ComponentDefinition): RuntimeRegistration {
    const registrations: RuntimeRegistration[] = [];
    try {
      const capabilities = definition.capabilities ?? [];
      if (capabilities.includes("gizmo-controller-binding")) {
        registrations.push(this.gizmoEventSystem.register(assertGizmoController(component)));
      } else if (capabilities.includes("gizmo")) {
        registrations.push(this.gizmoEventSystem.register(createGizmoAdapter(actor, component, this.isActorActive)));
      }
      if (capabilities.includes("state-observer-binding")) {
        registrations.push(this.frameStateController.subscribe(assertStateObserverComponent(component)));
      } else if (capabilities.includes("state-observer")) {
        registrations.push(this.frameStateController.subscribe(createStateObserverAdapter(component)));
      }
    } catch (error) {
      disposeRegistrations(registrations);
      throw error;
    }
    return createBridgeRegistration(() => {
      disposeRegistrations(registrations);
    });
  }
}

function createBridgeRegistration(dispose: () => void): RuntimeRegistration {
  let disposed = false;
  return {
    dispose() {
      if (disposed) return;
      disposed = true;
      dispose();
    }
  };
}

function disposeRegistrations(registrations: RuntimeRegistration[]): void {
  for (let i = registrations.length - 1; i >= 0; i -= 1) {
    registrations[i].dispose();
  }
  registrations.length = 0;
}

function createGizmoAdapter(
  actor: Actor,
  component: Component,
  isActorActive: (actor: Actor) => boolean
): GizmoController {
  const gizmo = assertGizmoComponent(component);
  const adapter: GizmoController = {
    id: gizmo.id,
    priority: gizmo.priority,
    get enabled() {
      return isActorActive(actor) && component.enabled && gizmo.enabled !== false;
    },
    hitTest(point: ScreenPoint): GizmoHit | null {
      if (adapter.enabled === false) return null;
      return gizmo.hitTest(point);
    },
    onGizmoStart(event: GizmoStartEvent): void {
      if (adapter.enabled === false) return;
      gizmo.onGizmoStart?.({ ...event, gizmo: adapter });
    },
    onGizmoMove(event: GizmoMoveEvent): void {
      if (adapter.enabled === false) return;
      gizmo.onGizmoMove?.({ ...event, gizmo: adapter });
    },
    onGizmoEnd(event: GizmoEndEvent): void {
      if (adapter.enabled === false) return;
      gizmo.onGizmoEnd?.({ ...event, gizmo: adapter });
    },
    onGizmoCancel(event: GizmoCancelEvent): void {
      gizmo.onGizmoCancel?.({ ...event, gizmo: adapter });
    },
    onGizmoClick(event: GizmoClickEvent): void {
      if (adapter.enabled === false) return;
      gizmo.onGizmoClick?.({ ...event, gizmo: adapter });
    },
    onGizmoDoubleClick(event: GizmoClickEvent): void {
      if (adapter.enabled === false) return;
      gizmo.onGizmoDoubleClick?.({ ...event, gizmo: adapter });
    }
  };
  return adapter;
}

function createStateObserverAdapter(component: Component): SceneStateObserver {
  const observer = assertStateObserverComponent(component);
  return {
    onSceneStateChanged(event: SceneStateChangedEvent): void {
      if (!component.enabled) return;
      observer.onSceneStateChanged(event);
    }
  };
}

function assertGizmoComponent(component: Component): Component & GizmoController {
  const candidate = component as Partial<GizmoController>;
  if (
    typeof candidate.id !== "string" ||
    typeof candidate.priority !== "number" ||
    typeof candidate.hitTest !== "function"
  ) {
    throw new Error(`Component ${component.type} declares gizmo capability but does not implement GizmoController.`);
  }
  return component as Component & GizmoController;
}

function assertGizmoController(component: Component): Component & GizmoController {
  const candidate = component as Partial<GizmoController>;
  if (
    typeof candidate.id !== "string" ||
    typeof candidate.priority !== "number" ||
    typeof candidate.hitTest !== "function"
  ) {
    throw new Error(
      `Component ${component.type} declares gizmo-controller-binding capability but does not implement GizmoController.`
    );
  }
  return component as Component & GizmoController;
}

function assertStateObserverComponent(component: Component): Component & SceneStateObserver {
  const candidate = component as Partial<SceneStateObserver>;
  if (typeof candidate.onSceneStateChanged !== "function") {
    throw new Error(
      `Component ${component.type} declares state-observer capability but does not implement SceneStateObserver.`
    );
  }
  return component as Component & SceneStateObserver;
}
