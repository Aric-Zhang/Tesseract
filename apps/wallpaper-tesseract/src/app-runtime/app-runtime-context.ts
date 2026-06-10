import type { AppStateCommandSink } from "../editor/app-state";
import type { AppStateObserver } from "../editor/app-state-controller";
import type { RuntimeFrame } from "runtime-core";
import type { RuntimeObject, RuntimeObjectRegistry, RuntimeRegistration } from "../runtime/ports";
import { ProductionRuntimeSchedulerService } from "../runtime/runtime-scheduler-service";
import {
  ActiveInputCancellationRuntime,
  GizmoControllerAttachmentRuntime,
  type GizmoControllerRegistry
} from "../gizmo-runtime";
import {
  StateObserverAttachmentRuntime,
  type StateObserverRegistry
} from "../state-runtime";
import { FrameUpdateAttachmentRuntime, RuntimeWorkAttachmentRuntime } from "../update-runtime";
import {
  ActorSystem,
  ComponentRegistry,
  type Component,
  type RegisteredActor
} from "../actor-runtime";
import { CompositeComponentAttachmentRuntime } from "./composite-component-attachment-runtime";

export interface RegisteredObject<T> {
  readonly object: T;
  dispose(): void;
}

interface TrackedDisposable {
  dispose(): void;
}

export interface AppRuntimeContextOptions {
  sceneRuntime: RuntimeObjectRegistry;
  frameStateController: StateObserverRegistry<AppStateObserver> & AppStateCommandSink;
  gizmoEventSystem: GizmoControllerRegistry;
  onRollbackError?: (errors: readonly unknown[]) => void;
}

type RegisterableObject = RuntimeObject;

export class AppRuntimeContext {
  readonly sceneRuntime: RuntimeObjectRegistry;
  readonly frameStateController: StateObserverRegistry<AppStateObserver> & AppStateCommandSink;
  readonly gizmoEventSystem: GizmoControllerRegistry;
  readonly actorSystem: ActorSystem;
  readonly componentRegistry: ComponentRegistry;
  private readonly onRollbackError?: (errors: readonly unknown[]) => void;
  private readonly runtimeScheduler: ProductionRuntimeSchedulerService;
  private readonly frameUpdateRuntime: FrameUpdateAttachmentRuntime;
  private readonly activeInputCancellationRuntime: ActiveInputCancellationRuntime;
  private readonly frameUpdateRuntimeRegistration: RuntimeRegistration;
  private readonly registeredObjects = new Set<object>();
  private readonly registeredIds = new Map<string, object>();
  private readonly trackedDisposables: TrackedDisposable[] = [];
  private disposed = false;

  constructor(options: AppRuntimeContextOptions) {
    this.sceneRuntime = options.sceneRuntime;
    this.frameStateController = options.frameStateController;
    this.gizmoEventSystem = options.gizmoEventSystem;
    this.onRollbackError = options.onRollbackError;
    this.actorSystem = new ActorSystem();
    this.runtimeScheduler = new ProductionRuntimeSchedulerService();
    this.frameUpdateRuntime = new FrameUpdateAttachmentRuntime({
      actorSystem: this.actorSystem
    });
    this.activeInputCancellationRuntime = new ActiveInputCancellationRuntime();
    const componentAttachmentRuntime = new CompositeComponentAttachmentRuntime([
      new RuntimeWorkAttachmentRuntime({
        actorSystem: this.actorSystem,
        scheduler: this.runtimeScheduler
      }),
      this.frameUpdateRuntime,
      new GizmoControllerAttachmentRuntime({ registry: this.gizmoEventSystem }),
      new StateObserverAttachmentRuntime({
        registry: this.frameStateController,
        getObserver: assertAppStateObserverBinding
      }),
      this.activeInputCancellationRuntime
    ]);
    this.componentRegistry = new ComponentRegistry({
      actorSystem: this.actorSystem,
      attachmentRuntime: componentAttachmentRuntime,
      onRollbackError: this.onRollbackError
    });
    this.frameUpdateRuntimeRegistration = this.sceneRuntime.register(this.frameUpdateRuntime);
  }

  cancelActiveActorInput(): void {
    this.activeInputCancellationRuntime.cancelActiveActorInput();
  }

  updateRuntimeFrame(frame: RuntimeFrame): void {
    this.runtimeScheduler.updateRuntimeFrame(frame);
  }

  registerRuntimeService(object: RuntimeObject): RuntimeRegistration {
    return this.registerObject(object, [
      () => this.sceneRuntime.register(object)
    ]);
  }

  trackRegisteredObject<T>(object: RegisteredObject<T>): RuntimeRegistration {
    return this.trackDisposable(object);
  }

  trackRegisteredActor(actor: RegisteredActor): RuntimeRegistration {
    return this.trackDisposable(actor);
  }

  private trackDisposable(disposable: TrackedDisposable): RuntimeRegistration {
    this.assertNotDisposed();
    if (!this.trackedDisposables.includes(disposable)) {
      this.trackedDisposables.push(disposable);
    }
    return createRuntimeRegistration(() => {
      const index = this.trackedDisposables.indexOf(disposable);
      if (index >= 0) {
        this.trackedDisposables.splice(index, 1);
      }
    });
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;

    for (let i = this.trackedDisposables.length - 1; i >= 0; i -= 1) {
      safeDispose(this.trackedDisposables[i]);
    }
    this.trackedDisposables.length = 0;

    safeDispose(this.actorSystem);
    safeDispose(this.runtimeScheduler);
    safeDispose(this.frameUpdateRuntimeRegistration);
    safeDispose(this.frameUpdateRuntime);
    safeDispose(this.gizmoEventSystem);
    safeDispose(this.frameStateController);
    safeDispose(this.sceneRuntime);
    this.registeredIds.clear();
  }

  private registerObject(
    object: RegisterableObject,
    registerSteps: Array<() => RuntimeRegistration>
  ): RuntimeRegistration {
    this.assertNotDisposed();
    this.assertCanRegister(object);
    const registrations: RuntimeRegistration[] = [];

    try {
      for (const register of registerSteps) {
        registrations.push(register());
      }
      this.markRegistered(object);
      return createRuntimeRegistration(() => {
        disposeRegistrationsReverse(registrations, this.onRollbackError);
        this.unmarkRegistered(object);
      });
    } catch (error) {
      disposeRegistrationsReverse(registrations, this.onRollbackError);
      throw error;
    }
  }

  private assertCanRegister(object: RegisterableObject): void {
    const identity = object as object;
    if (this.registeredObjects.has(identity)) {
      throw new Error(`AppRuntimeContext object is already registered: ${object.id}`);
    }
    const existing = this.registeredIds.get(object.id);
    if (existing) {
      throw new Error(`AppRuntimeContext id is already registered: ${object.id}`);
    }
  }

  private markRegistered(object: RegisterableObject): void {
    this.registeredObjects.add(object as object);
    this.registeredIds.set(object.id, object as object);
  }

  private unmarkRegistered(object: RegisterableObject): void {
    this.registeredObjects.delete(object as object);
    this.registeredIds.delete(object.id);
  }

  private assertNotDisposed(): void {
    if (this.disposed) {
      throw new Error("Cannot use AppRuntimeContext after dispose().");
    }
  }
}

function assertAppStateObserverBinding(component: Component): AppStateObserver {
  const candidate = component as Partial<AppStateObserver>;
  if (typeof candidate.onStateChanged !== "function") {
    throw new Error(
      `Component ${component.type} declares state-observer attachment but does not implement StateObserver.`
    );
  }
  return candidate as AppStateObserver;
}

export function createRuntimeRegistration(dispose: () => void): RuntimeRegistration {
  let disposed = false;
  return {
    dispose() {
      if (disposed) return;
      disposed = true;
      dispose();
    }
  };
}

export function createRegisteredObject<T extends { dispose?(): void }>(
  object: T,
  registration: RuntimeRegistration,
  beforeDispose?: () => void
): RegisteredObject<T> {
  let disposed = false;
  return {
    object,
    dispose() {
      if (disposed) return;
      disposed = true;
      try {
        beforeDispose?.();
      } finally {
        try {
          registration.dispose();
        } finally {
          object.dispose?.();
        }
      }
    }
  };
}

function disposeRegistrationsReverse(
  registrations: readonly RuntimeRegistration[],
  onRollbackError?: (errors: readonly unknown[]) => void
): void {
  const errors: unknown[] = [];
  for (let i = registrations.length - 1; i >= 0; i -= 1) {
    try {
      registrations[i].dispose();
    } catch (error) {
      errors.push(error);
    }
  }
  if (errors.length > 0) {
    onRollbackError?.(errors);
  }
}

function safeDispose(disposable: { dispose(): void }): void {
  try {
    disposable.dispose();
  } catch {
    // App shutdown should continue even when one object is already partially disposed.
  }
}
