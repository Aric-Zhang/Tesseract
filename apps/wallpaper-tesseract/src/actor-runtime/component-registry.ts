import type { RuntimeRegistration, SceneCommandSink } from "../scene-runtime";
import type { Actor, ActorImpl } from "./actor";
import type {
  ActorSystemView,
  Component,
  ComponentContext,
  ComponentDefinition,
  ComponentDefinitionKind,
  ComponentIdOptions,
  ComponentLifecycleObserver,
  ComponentRegistryView,
  ComponentType
} from "./component";
import { ComponentTransaction, type RollbackErrorHandler } from "./component-transaction";
import type { ComponentRuntimeBridge } from "./component-runtime-bridge";
import { ActorSystem, actorComponentMutationToken } from "./actor-system";

export interface ComponentRegistryOptions {
  actorSystem: ActorSystem;
  bridge?: ComponentRuntimeBridge;
  commandSink?: SceneCommandSink;
  onRollbackError?: RollbackErrorHandler;
}

interface DisposeComponentOptions {
  readonly allowDetachVeto?: boolean;
}

type ComponentAddReason = "root" | "required";

interface ComponentAddPlanItem {
  readonly type: ComponentType;
  readonly options?: unknown;
  readonly reason: ComponentAddReason;
  readonly existing: Component | null;
  readonly id: string;
  readonly definition: ComponentDefinition;
}

interface ComponentAddPlan {
  readonly actor: Actor;
  readonly rootType: ComponentType;
  readonly items: readonly ComponentAddPlanItem[];
}

interface ComponentAddPlanBuildState {
  readonly visiting: string[];
  readonly visited: Set<string>;
}

export class ComponentRegistry {
  private readonly actorSystem: ActorSystem;
  private readonly bridge?: ComponentRuntimeBridge;
  private readonly commandSink: SceneCommandSink;
  private readonly onRollbackError?: RollbackErrorHandler;
  private readonly actorSystemView: ActorSystemView;
  private readonly componentRegistryView: ComponentRegistryView;
  private readonly definitions = new Map<string, ComponentDefinition>();
  private readonly externalRegistrations = new WeakMap<Component, RuntimeRegistration>();

  constructor(options: ComponentRegistryOptions) {
    this.actorSystem = options.actorSystem;
    this.bridge = options.bridge;
    this.commandSink = options.commandSink ?? noopCommandSink;
    this.onRollbackError = options.onRollbackError;
    this.actorSystemView = {
      getActor: (id) => this.actorSystem.getActor(id),
      listActors: () => this.actorSystem.listActors(),
      listActorsInTreeOrder: () => this.actorSystem.listActorsInTreeOrder(),
      hasActor: (actor) => this.actorSystem.hasActor(actor),
      isActorActive: (actor) => this.actorSystem.isActorActive(actor),
      getParentId: (actor) => this.actorSystem.getParentId(actor),
      listChildren: (actor) => this.actorSystem.listChildren(actor)
    };
    this.componentRegistryView = {
      getComponent: (actor, type) => this.getComponent(actor, type),
      getComponents: (actor, type) => this.getComponents(actor, type),
      hasComponent: (actor, type) => this.hasComponent(actor, type)
    };
    this.actorSystem.setComponentDisposer((actor) => this.disposeActorComponents(actor));
  }

  registerDefinition(definition: ComponentDefinition): void {
    if (this.definitions.has(definition.type)) {
      throw new Error(`Component definition is already registered: ${definition.type}`);
    }
    this.definitions.set(definition.type, normalizeDefinition(definition));
  }

  addComponent<T extends Component, TOptions = unknown>(
    actor: Actor,
    type: ComponentType<T>,
    options?: TOptions
  ): T {
    const actorImpl = this.actorSystem.assertOwnActor(actor);
    const plan = this.buildAddComponentPlan(actor, type, options);
    this.validateAddComponentPlan(actorImpl, plan);
    return this.executeAddComponentPlan<T>(actorImpl, plan);
  }

  private buildAddComponentPlan<T extends Component, TOptions>(
    actor: Actor,
    type: ComponentType<T>,
    options: TOptions | undefined
  ): ComponentAddPlan {
    const items: ComponentAddPlanItem[] = [];
    this.appendComponentAddPlanItem(actor, type, options, "root", items, {
      visiting: [],
      visited: new Set()
    });
    return {
      actor,
      rootType: type,
      items
    };
  }

  private appendComponentAddPlanItem<T extends Component, TOptions>(
    actor: Actor,
    type: ComponentType<T>,
    options: TOptions | undefined,
    reason: ComponentAddReason,
    items: ComponentAddPlanItem[],
    state: ComponentAddPlanBuildState
  ): void {
    const typeKey = String(type);
    const cycleStart = state.visiting.indexOf(typeKey);
    if (cycleStart >= 0) {
      const cyclePath = [...state.visiting.slice(cycleStart), typeKey].join(" -> ");
      throw new Error(`Component dependency cycle detected: ${cyclePath}`);
    }
    if (state.visited.has(typeKey)) return;
    state.visiting.push(typeKey);
    const definition = this.getDefinition<T, TOptions>(type);
    try {
      for (const requirement of definition.requires ?? []) {
        const requiredDefinition = this.getDefinition(requirement.type);
        const reuseExisting = requirement.reuseExisting ?? requiredDefinition.singleton;
        const existing = reuseExisting ? actor.getComponent(requirement.type) : null;
        if (existing) {
          items.push({
            type: requirement.type,
            reason: "required",
            existing,
            id: existing.id,
            definition: requiredDefinition
          });
          state.visited.add(String(requirement.type));
          continue;
        }
        if (requirement.autoAdd === false) {
          throw new Error(`Required component is missing on actor ${actor.id}: ${requirement.type}`);
        }
        const requirementOptions = resolveRequirementOptions(requirement.options);
        this.appendComponentAddPlanItem(actor, requirement.type, requirementOptions, "required", items, state);
      }
      items.push({
        type,
        options,
        reason,
        existing: null,
        id: resolveComponentId(definition, actor, options),
        definition
      });
      state.visited.add(typeKey);
    } finally {
      state.visiting.pop();
    }
  }

  private validateAddComponentPlan(actor: ActorImpl, plan: ComponentAddPlan): void {
    const plannedIds = new Set<string>();
    for (const item of plan.items) {
      if (item.existing) continue;
      if (item.definition.singleton && actor.hasComponent(item.type)) {
        throw new Error(`Singleton component already exists on actor ${actor.id}: ${item.type}`);
      }
      if (plannedIds.has(item.id)) {
        throw new Error(`Component id appears more than once in add plan for actor ${actor.id}: ${item.id}`);
      }
      assertNoDuplicateComponentId(actor, item.id);
      plannedIds.add(item.id);
    }
  }

  private executeAddComponentPlan<T extends Component>(actor: ActorImpl, plan: ComponentAddPlan): T {
    const transaction = new ComponentTransaction(this.onRollbackError);
    const createdComponents = new Map<ComponentAddPlanItem, Component>();
    try {
      for (const item of plan.items) {
        if (item.existing) continue;
        createdComponents.set(item, this.createAndAttachPlannedComponent(actor, item, transaction));
      }
      const rootItem = plan.items.find((item) => item.reason === "root" && item.type === plan.rootType);
      const rootComponent = rootItem ? createdComponents.get(rootItem) ?? rootItem.existing : null;
      if (!rootComponent) {
        throw new Error(`Component add plan did not produce root component: ${plan.rootType}`);
      }
      transaction.commit();
      return rootComponent as T;
    } catch (error) {
      transaction.rollback();
      throw error;
    }
  }

  private createAndAttachPlannedComponent(
    actor: ActorImpl,
    item: ComponentAddPlanItem,
    transaction: ComponentTransaction
  ): Component {
    const component = item.definition.create(actor, this.createContext(item.definition.kind), item.options);
    let attached = false;
    transaction.addRollback(() => {
      if (attached) {
        this.disposeComponent(actor, component);
      } else {
        component.dispose?.();
      }
    });
    validateComponent(component, item.type, actor);
    assertNoDuplicateComponentId(actor, component.id);
    validateComponentId(component, item.id);
    this.actorSystem.attachComponent(actorComponentMutationToken, actor, component);
    attached = true;
    component.onAttach?.();
    if (this.bridge) {
      const externalRegistration = this.bridge.attach(actor, component, item.definition);
      this.externalRegistrations.set(component, externalRegistration);
      transaction.addRollback(() => {
        externalRegistration.dispose();
        this.externalRegistrations.delete(component);
      });
    }
    return component;
  }

  removeComponent(actor: Actor, component: Component): void {
    const actorImpl = this.actorSystem.assertOwnActor(actor);
    this.assertNoRequiredDependents(actorImpl, component);
    this.disposeComponent(actor, component, { allowDetachVeto: true });
  }

  getDefinition<T extends Component = Component, TOptions = unknown>(
    type: ComponentType<T>
  ): ComponentDefinition<T, TOptions> {
    const definition = this.definitions.get(type);
    if (!definition) {
      throw new Error(`Component definition is not registered: ${type}`);
    }
    return definition as ComponentDefinition<T, TOptions>;
  }

  getComponent<T extends Component>(actor: Actor, type: ComponentType<T>): T | null {
    this.actorSystem.assertOwnActor(actor);
    return actor.getComponent(type);
  }

  getComponents<T extends Component>(actor: Actor, type: ComponentType<T>): readonly T[] {
    this.actorSystem.assertOwnActor(actor);
    return actor.getComponents(type);
  }

  hasComponent(actor: Actor, type: ComponentType): boolean {
    this.actorSystem.assertOwnActor(actor);
    return actor.hasComponent(type);
  }

  disposeActorComponents(actor: Actor): void {
    const actorImpl = this.actorSystem.assertOwnActor(actor);
    const components = [...actorImpl.listComponents()].reverse();
    for (const component of components) {
      this.disposeComponent(actor, component);
    }
  }

  private disposeComponent(
    actor: Actor,
    component: Component,
    options: DisposeComponentOptions = {}
  ): void {
    const actorImpl = this.actorSystem.assertOwnActor(actor);
    if (options.allowDetachVeto) {
      this.assertCanDetach(actorImpl, component);
    }
    this.notifyBeforeComponentDetach(actorImpl, component);
    const externalRegistration = this.externalRegistrations.get(component);
    if (externalRegistration) {
      externalRegistration.dispose();
      this.externalRegistrations.delete(component);
    }
    component.onDetach?.();
    component.dispose?.();
    this.actorSystem.detachComponent(actorComponentMutationToken, actor, component);
  }

  private assertCanDetach(actor: ActorImpl, component: Component): void {
    for (const observer of getLifecycleObservers(actor, component)) {
      if (observer.canDetach?.(component) === false) {
        throw new Error(`Component detach was vetoed by ${observer.id}: ${component.id}`);
      }
    }
  }

  private assertNoRequiredDependents(actor: ActorImpl, target: Component): void {
    for (const dependent of actor.listComponents()) {
      if (dependent === target) continue;
      const definition = this.getDefinition(dependent.type);
      if (!definition.requires?.some((requirement) => requirement.type === target.type)) continue;
      throw new Error(
        `Cannot remove component ${target.id} (${target.type}) because it is required by ` +
          `${dependent.id} (${dependent.type}).`
      );
    }
  }

  private notifyBeforeComponentDetach(actor: ActorImpl, component: Component): void {
    const errors: unknown[] = [];
    for (const observer of getLifecycleObservers(actor, component)) {
      try {
        observer.beforeComponentDetach?.(component);
      } catch (error) {
        errors.push(error);
      }
    }
    if (errors.length > 0) {
      this.onRollbackError?.(errors);
    }
  }

  private createContext(_kind?: ComponentDefinitionKind): ComponentContext {
    return {
      actorSystem: this.actorSystemView,
      componentRegistry: this.componentRegistryView,
      services: {
        commandSink: this.commandSink
      }
    };
  }
}

const noopCommandSink: SceneCommandSink = {
  submit(): void {
    // Optional command sink for isolated component tests.
  }
};

function validateComponent(component: Component, type: string, actor: Actor): void {
  if (component.type !== type) {
    throw new Error(`Component type mismatch. Expected ${type}, received ${component.type}.`);
  }
  if (component.actor !== actor) {
    throw new Error(`Component ${component.id} was created for the wrong actor.`);
  }
  if (typeof component.enabled !== "boolean") {
    throw new Error(`Component ${component.id} must define enabled as a boolean.`);
  }
}

function validateComponentId(component: Component, expectedId: string): void {
  if (component.id !== expectedId) {
    throw new Error(`Component id mismatch. Expected ${expectedId}, received ${component.id}.`);
  }
}

function resolveComponentId<T extends Component, TOptions>(
  definition: ComponentDefinition<T, TOptions>,
  actor: Actor,
  options: TOptions | undefined
): string {
  const definedId = definition.createId?.(actor, options);
  if (definedId !== undefined) return validateResolvedComponentId(definedId, "definition.createId()");
  const optionId = readComponentIdOption(options);
  if (optionId !== undefined) return optionId;
  if (definition.singleton) return `${actor.id}:${definition.type}`;
  throw new Error(
    `Non-singleton component requires an id. Provide options.id or definition.createId(): ${definition.type}`
  );
}

function readComponentIdOption(options: unknown): string | undefined {
  if (!isRecord(options) || !Object.hasOwn(options, "id")) return undefined;
  const id = (options as ComponentIdOptions).id;
  if (id === undefined) return undefined;
  if (typeof id !== "string" || id.length === 0) {
    throw new Error("Component options.id must be a non-empty string.");
  }
  return id;
}

function validateResolvedComponentId(id: string, source: string): string {
  if (typeof id !== "string" || id.length === 0) {
    throw new Error(`Component id from ${source} must be a non-empty string.`);
  }
  return id;
}

function resolveRequirementOptions(options: unknown): unknown {
  return typeof options === "function" ? (options as () => unknown)() : options;
}

function assertNoDuplicateComponentId(actor: ActorImpl, id: string): void {
  if (actor.listComponents().some((component) => component.id === id)) {
    throw new Error(`Component id already exists on actor ${actor.id}: ${id}`);
  }
}

function isRecord(value: unknown): value is Record<PropertyKey, unknown> {
  return typeof value === "object" && value !== null;
}

function getLifecycleObservers(actor: ActorImpl, target: Component): ComponentLifecycleObserver[] {
  return actor
    .listComponents()
    .filter((component): component is ComponentLifecycleObserver => (
      component !== target &&
      (typeof (component as ComponentLifecycleObserver).canDetach === "function" ||
        typeof (component as ComponentLifecycleObserver).beforeComponentDetach === "function")
    ));
}

function normalizeDefinition(definition: ComponentDefinition): ComponentDefinition {
  return {
    ...definition,
    kind: definition.kind ?? "business",
    singleton: definition.singleton ?? false,
    requires: definition.requires ?? [],
    capabilities: definition.capabilities ?? []
  };
}
