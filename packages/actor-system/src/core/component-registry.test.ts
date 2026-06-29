import { describe, expect, it } from "vitest";
import { ActorSystem } from "./actor-system";
import type { Actor } from "./actor";
import type {
  ComponentAttachmentRegistration,
  ComponentAttachmentRuntime
} from "./component-attachment-runtime";
import type {
  Component,
  ComponentContext,
  ComponentDefinition,
  ComponentLifecycleObserver,
  ComponentRequirement,
  ComponentType
} from "./component";
import { componentType } from "./component";
import { ComponentRegistry } from "./component-registry";

interface TestComponent extends Component {
  marker: string;
}

const testComponentType = componentType<TestComponent>("test-component");

interface TestComponentCreateOptions {
  id?: string;
  type?: ComponentType<TestComponent>;
  label?: string;
  attachFails?: boolean;
  detachFails?: boolean;
}

function createComponent(
  actor: Actor,
  calls: string[],
  options?: TestComponentCreateOptions
): TestComponent {
  return {
    id: options?.id ?? "test-component",
    type: options?.type ?? testComponentType,
    actor,
    enabled: true,
    marker: "created",
    onAttach() {
      calls.push(options?.label ? `attach:${options.label}` : "attach");
      if (options?.attachFails) throw new Error("attach failed");
    },
    onDetach() {
      calls.push(options?.label ? `detach:${options.label}` : "detach");
      if (options?.detachFails) throw new Error("detach failed");
    },
    dispose() {
      calls.push(options?.label ? `dispose:${options.label}` : "dispose");
    }
  };
}

function createDefinition(
  calls: string[],
  options?: TestComponentCreateOptions
): ComponentDefinition<TestComponent> {
  const id = options?.id ?? "test-component";
  return {
    type: testComponentType,
    singleton: true,
    createId() {
      return id;
    },
    create(actor) {
      calls.push("create");
      return createComponent(actor, calls, options);
    }
  };
}

function createLabeledDefinition(
  calls: string[],
  type: ComponentType<TestComponent>,
  label: string,
  options: {
    singleton?: boolean;
    requires?: readonly ComponentRequirement[];
    attachFails?: boolean;
  } = {}
): ComponentDefinition<TestComponent> {
  return {
    type,
    singleton: options.singleton ?? true,
    requires: options.requires,
    createId() {
      return `${label}-id`;
    },
    create(actor) {
      calls.push(`create:${label}`);
      return createComponent(actor, calls, {
        id: `${label}-id`,
        type,
        label,
        attachFails: options.attachFails
      });
    }
  };
}

function createLifecycleObserverDefinition(
  calls: string[],
  type: ComponentType<ComponentLifecycleObserver>,
  options: {
    canDetach?: (component: Component) => boolean;
    beforeComponentDetach?: (component: Component) => void;
  } = {}
): ComponentDefinition<ComponentLifecycleObserver> {
  return {
    type,
    singleton: true,
    createId() {
      return "observer-id";
    },
    create(actor) {
      return {
        id: "observer-id",
        type,
        actor,
        enabled: true,
        canDetach: options.canDetach,
        beforeComponentDetach: options.beforeComponentDetach,
        onDetach() {
          calls.push("detach:observer");
        },
        dispose() {
          calls.push("dispose:observer");
        }
      };
    }
  };
}

function createAttachmentRuntime(calls: string[], fail = false): ComponentAttachmentRuntime {
  return {
    attach(_actor: Actor, component: Component): ComponentAttachmentRegistration {
      calls.push(`bridge-attach:${component.id}`);
      if (fail) throw new Error("bridge failed");
      return {
        dispose() {
          calls.push(`bridge-dispose:${component.id}`);
        }
      };
    }
  };
}

function assertNoExternalSystemAccess(context: ComponentContext): void {
  // @ts-expect-error Component contexts must not expose GizmoEventSystem.
  void context.gizmoEventSystem;
  // @ts-expect-error Component contexts must not expose FrameStateController.
  void context.frameStateController;
}

function assertReadonlyComponentRegistryView(context: ComponentContext): void {
  // @ts-expect-error ComponentRegistryView must not allow component mutation.
  void context.componentRegistry.addComponent;
  // @ts-expect-error ComponentRegistryView must not allow component mutation.
  void context.componentRegistry.removeComponent;
}

function assertReadonlyActorSystemView(context: ComponentContext): void {
  // @ts-expect-error ActorSystemView must not allow actor destruction.
  void context.actorSystem.destroyActor;
}

function expectComponentContext(context: ComponentContext | null): ComponentContext {
  if (!context) throw new Error("Expected component context.");
  return context;
}

describe("ComponentRegistry", () => {
  it("normalizes missing definition metadata", () => {
    const actorSystem = new ActorSystem();
    const calls: string[] = [];
    const registry = new ComponentRegistry({ actorSystem });

    registry.registerDefinition(createDefinition(calls));

    const definition = registry.getDefinition(testComponentType);
    expect(definition.kind).toBe("business");
    expect(definition.singleton).toBe(true);
    expect(definition.requires).toEqual([]);
    expect(definition.attachments).toEqual([]);
  });

  it("normalizes default singleton state when it is omitted", () => {
    const actorSystem = new ActorSystem();
    const registry = new ComponentRegistry({ actorSystem });
    registry.registerDefinition({
      type: testComponentType,
      create(actor) {
        return createComponent(actor, []);
      }
    });

    expect(registry.getDefinition(testComponentType).singleton).toBe(false);
  });

  it("throws when the same component definition is registered twice", () => {
    const actorSystem = new ActorSystem();
    const calls: string[] = [];
    const registry = new ComponentRegistry({ actorSystem });

    registry.registerDefinition(createDefinition(calls));

    expect(() => registry.registerDefinition(createDefinition(calls))).toThrow(
      /Component definition is already registered/
    );
  });

  it("passes a narrow business component context with query-only registry access", () => {
    const actorSystem = new ActorSystem();
    const calls: string[] = [];
    const registry = new ComponentRegistry({ actorSystem });
    let receivedContext: ComponentContext | null = null;
    registry.registerDefinition({
      type: testComponentType,
      createId: () => "context-component",
      create(actor, context) {
        receivedContext = context;
        calls.push("create");
        return createComponent(actor, calls, { id: "context-component" });
      }
    });
    const actor = actorSystem.createActor({ id: "actor" });

    const component = registry.addComponent(actor, testComponentType);

    const context = expectComponentContext(receivedContext);
    assertNoExternalSystemAccess(context);
    assertReadonlyComponentRegistryView(context);
    assertReadonlyActorSystemView(context);
    expect("services" in (context as unknown as Record<string, unknown>)).toBe(false);
    expect(context.componentRegistry.getComponent(actor, testComponentType)).toBe(component);
    expect(context.componentRegistry.getComponents(actor, testComponentType)).toEqual([component]);
    expect(context.componentRegistry.hasComponent(actor, testComponentType)).toBe(true);
    expect("addComponent" in (context.componentRegistry as unknown as Record<string, unknown>)).toBe(false);
    expect("removeComponent" in (context.componentRegistry as unknown as Record<string, unknown>)).toBe(false);
    expect("destroyActor" in (context.actorSystem as unknown as Record<string, unknown>)).toBe(false);
    expect(calls).toEqual(["create", "attach"]);
  });

  it("does not expose external systems to binding component context", () => {
    const actorSystem = new ActorSystem();
    const calls: string[] = [];
    const registry = new ComponentRegistry({ actorSystem });
    let receivedContext: ComponentContext | null = null;
    registry.registerDefinition({
      type: testComponentType,
      kind: "binding",
      createId: () => "binding-component",
      create(actor, context) {
        receivedContext = context;
        return createComponent(actor, calls, { id: "binding-component" });
      }
    });
    const actor = actorSystem.createActor({ id: "actor" });

    registry.addComponent(actor, testComponentType);

    const context = expectComponentContext(receivedContext);
    assertNoExternalSystemAccess(context);
    expect("gizmoEventSystem" in (context as unknown as Record<string, unknown>)).toBe(false);
    expect("frameStateController" in (context as unknown as Record<string, unknown>)).toBe(false);
    expect("bindingServices" in (context as unknown as Record<string, unknown>)).toBe(false);
  });

  it("adds and removes a component through its lifecycle hooks", () => {
    const actorSystem = new ActorSystem();
    const calls: string[] = [];
    const registry = new ComponentRegistry({ actorSystem });
    registry.registerDefinition(createDefinition(calls));
    const actor = actorSystem.createActor({ id: "actor" });

    const component = registry.addComponent(actor, testComponentType);
    registry.removeComponent(actor, component);

    expect(calls).toEqual(["create", "attach", "detach", "dispose"]);
    expect(actor.hasComponent(testComponentType)).toBe(false);
  });

  it("notifies lifecycle observers before external dispose and component detach", () => {
    const actorSystem = new ActorSystem();
    const calls: string[] = [];
    const observerType = componentType<ComponentLifecycleObserver>("observer");
    const targetType = componentType<TestComponent>("target");
    const registry = new ComponentRegistry({ actorSystem, attachmentRuntime: createAttachmentRuntime(calls) });
    registry.registerDefinition(createLifecycleObserverDefinition(calls, observerType, {
      beforeComponentDetach(component) {
        calls.push(`before:${component.id}`);
      }
    }));
    registry.registerDefinition(createLabeledDefinition(calls, targetType, "target"));
    const actor = actorSystem.createActor({ id: "actor" });
    registry.addComponent(actor, observerType);
    const target = registry.addComponent(actor, targetType);
    calls.length = 0;

    registry.removeComponent(actor, target);

    expect(calls).toEqual([
      "before:target-id",
      "bridge-dispose:target-id",
      "detach:target",
      "dispose:target"
    ]);
  });

  it("lets lifecycle observers veto explicit component removal", () => {
    const actorSystem = new ActorSystem();
    const calls: string[] = [];
    const observerType = componentType<ComponentLifecycleObserver>("observer");
    const targetType = componentType<TestComponent>("target");
    const registry = new ComponentRegistry({ actorSystem });
    registry.registerDefinition(createLifecycleObserverDefinition(calls, observerType, {
      canDetach(component) {
        calls.push(`can-detach:${component.id}`);
        return false;
      }
    }));
    registry.registerDefinition(createLabeledDefinition(calls, targetType, "target"));
    const actor = actorSystem.createActor({ id: "actor" });
    registry.addComponent(actor, observerType);
    const target = registry.addComponent(actor, targetType);
    calls.length = 0;

    expect(() => registry.removeComponent(actor, target)).toThrow(/Component detach was vetoed/);

    expect(actor.getComponent(targetType)).toBe(target);
    expect(calls).toEqual(["can-detach:target-id"]);
  });

  it("rejects explicit removal of a component that is still required by another component", () => {
    const actorSystem = new ActorSystem();
    const calls: string[] = [];
    const dependencyType = componentType<TestComponent>("dependency");
    const rootType = componentType<TestComponent>("root");
    const registry = new ComponentRegistry({ actorSystem });
    registry.registerDefinition(createLabeledDefinition(calls, dependencyType, "dependency"));
    registry.registerDefinition(createLabeledDefinition(calls, rootType, "root", {
      requires: [{ type: dependencyType }]
    }));
    const actor = actorSystem.createActor({ id: "actor" });
    registry.addComponent(actor, rootType);
    const dependency = actor.getComponent(dependencyType);

    expect(() => registry.removeComponent(actor, dependency!)).toThrow(
      /Cannot remove component dependency-id \(dependency\) because it is required by root-id \(root\)/
    );

    expect(actor.getComponent(dependencyType)).toBe(dependency);
    expect(actor.getComponent(rootType)).not.toBeNull();
  });

  it("allows required dependencies to be removed after dependents are removed", () => {
    const actorSystem = new ActorSystem();
    const calls: string[] = [];
    const dependencyType = componentType<TestComponent>("dependency");
    const rootType = componentType<TestComponent>("root");
    const registry = new ComponentRegistry({ actorSystem });
    registry.registerDefinition(createLabeledDefinition(calls, dependencyType, "dependency"));
    registry.registerDefinition(createLabeledDefinition(calls, rootType, "root", {
      requires: [{ type: dependencyType }]
    }));
    const actor = actorSystem.createActor({ id: "actor" });
    const root = registry.addComponent(actor, rootType);
    const dependency = actor.getComponent(dependencyType);

    registry.removeComponent(actor, root);
    registry.removeComponent(actor, dependency!);

    expect(actor.getComponent(rootType)).toBeNull();
    expect(actor.getComponent(dependencyType)).toBeNull();
  });

  it("does not let required dependency remove guard block actor destroy", () => {
    const actorSystem = new ActorSystem();
    const calls: string[] = [];
    const dependencyType = componentType<TestComponent>("dependency");
    const rootType = componentType<TestComponent>("root");
    const registry = new ComponentRegistry({ actorSystem });
    registry.registerDefinition(createLabeledDefinition(calls, dependencyType, "dependency"));
    registry.registerDefinition(createLabeledDefinition(calls, rootType, "root", {
      requires: [{ type: dependencyType }]
    }));
    const actor = actorSystem.createActor({ id: "actor" });
    registry.addComponent(actor, rootType);

    actorSystem.destroyActor(actor);

    expect(actorSystem.getActor("actor")).toBeNull();
    expect(calls).toContain("dispose:root");
    expect(calls).toContain("dispose:dependency");
  });

  it("runs required dependency remove guard before lifecycle canDetach observers", () => {
    const actorSystem = new ActorSystem();
    const calls: string[] = [];
    const observerType = componentType<ComponentLifecycleObserver>("observer");
    const dependencyType = componentType<TestComponent>("dependency");
    const rootType = componentType<TestComponent>("root");
    const registry = new ComponentRegistry({ actorSystem });
    registry.registerDefinition(createLifecycleObserverDefinition(calls, observerType, {
      canDetach(component) {
        calls.push(`can-detach:${component.id}`);
        return false;
      }
    }));
    registry.registerDefinition(createLabeledDefinition(calls, dependencyType, "dependency"));
    registry.registerDefinition(createLabeledDefinition(calls, rootType, "root", {
      requires: [{ type: dependencyType }]
    }));
    const actor = actorSystem.createActor({ id: "actor" });
    registry.addComponent(actor, observerType);
    registry.addComponent(actor, rootType);
    const dependency = actor.getComponent(dependencyType);
    calls.length = 0;

    expect(() => registry.removeComponent(actor, dependency!)).toThrow(/Cannot remove component dependency-id/);

    expect(calls).toEqual([]);
  });

  it("does not let canDetach veto block actor destroy", () => {
    const actorSystem = new ActorSystem();
    const calls: string[] = [];
    const observerType = componentType<ComponentLifecycleObserver>("observer");
    const targetType = componentType<TestComponent>("target");
    const registry = new ComponentRegistry({ actorSystem });
    registry.registerDefinition(createLifecycleObserverDefinition(calls, observerType, {
      canDetach(component) {
        calls.push(`can-detach:${component.id}`);
        return false;
      },
      beforeComponentDetach(component) {
        calls.push(`before:${component.id}`);
      }
    }));
    registry.registerDefinition(createLabeledDefinition(calls, targetType, "target"));
    const actor = actorSystem.createActor({ id: "actor" });
    registry.addComponent(actor, observerType);
    registry.addComponent(actor, targetType);
    calls.length = 0;

    actorSystem.destroyActor(actor);

    expect(actorSystem.getActor("actor")).toBeNull();
    expect(calls).toEqual([
      "before:target-id",
      "detach:target",
      "dispose:target",
      "detach:observer",
      "dispose:observer"
    ]);
  });

  it("collects beforeComponentDetach errors but still disposes the target", () => {
    const actorSystem = new ActorSystem();
    const calls: string[] = [];
    const rollbackErrors: unknown[][] = [];
    const observerType = componentType<ComponentLifecycleObserver>("observer");
    const targetType = componentType<TestComponent>("target");
    const registry = new ComponentRegistry({
      actorSystem,
      onRollbackError: (errors) => rollbackErrors.push([...errors])
    });
    registry.registerDefinition(createLifecycleObserverDefinition(calls, observerType, {
      beforeComponentDetach(component) {
        calls.push(`before:${component.id}`);
        throw new Error("before failed");
      }
    }));
    registry.registerDefinition(createLabeledDefinition(calls, targetType, "target"));
    const actor = actorSystem.createActor({ id: "actor" });
    registry.addComponent(actor, observerType);
    const target = registry.addComponent(actor, targetType);
    calls.length = 0;

    registry.removeComponent(actor, target);

    expect(calls).toEqual(["before:target-id", "detach:target", "dispose:target"]);
    expect(rollbackErrors).toHaveLength(1);
    expect(rollbackErrors[0]).toHaveLength(1);
    expect(actor.hasComponent(targetType)).toBe(false);
  });

  it("does not notify the removed component as its own lifecycle observer", () => {
    const actorSystem = new ActorSystem();
    const calls: string[] = [];
    const observerType = componentType<ComponentLifecycleObserver>("observer");
    const registry = new ComponentRegistry({ actorSystem });
    registry.registerDefinition(createLifecycleObserverDefinition(calls, observerType, {
      beforeComponentDetach(component) {
        calls.push(`before:${component.id}`);
      }
    }));
    const actor = actorSystem.createActor({ id: "actor" });
    const observer = registry.addComponent(actor, observerType);
    calls.length = 0;

    registry.removeComponent(actor, observer);

    expect(calls).toEqual(["detach:observer", "dispose:observer"]);
  });

  it("creates the root component through a root-only add plan", () => {
    const actorSystem = new ActorSystem();
    const calls: string[] = [];
    const registry = new ComponentRegistry({ actorSystem });
    registry.registerDefinition(createDefinition(calls));
    const actor = actorSystem.createActor({ id: "actor" });

    const component = registry.addComponent(actor, testComponentType);

    expect(component.id).toBe("test-component");
    expect(actor.getComponent(testComponentType)).toBe(component);
    expect(calls).toEqual(["create", "attach"]);
  });

  it("auto-adds a missing required dependency before the root component", () => {
    const actorSystem = new ActorSystem();
    const calls: string[] = [];
    const dependencyType = componentType<TestComponent>("dependency");
    const rootType = componentType<TestComponent>("root");
    const registry = new ComponentRegistry({ actorSystem });
    registry.registerDefinition(createLabeledDefinition(calls, dependencyType, "dependency"));
    registry.registerDefinition(createLabeledDefinition(calls, rootType, "root", {
      requires: [{ type: dependencyType }]
    }));
    const actor = actorSystem.createActor({ id: "actor" });

    registry.addComponent(actor, rootType);

    expect(actor.hasComponent(dependencyType)).toBe(true);
    expect(actor.hasComponent(rootType)).toBe(true);
    expect(calls).toEqual([
      "create:dependency",
      "attach:dependency",
      "create:root",
      "attach:root"
    ]);
  });

  it("auto-adds multi-level dependencies in topological order", () => {
    const actorSystem = new ActorSystem();
    const calls: string[] = [];
    const leafType = componentType<TestComponent>("leaf");
    const middleType = componentType<TestComponent>("middle");
    const rootType = componentType<TestComponent>("root");
    const registry = new ComponentRegistry({ actorSystem });
    registry.registerDefinition(createLabeledDefinition(calls, leafType, "leaf"));
    registry.registerDefinition(createLabeledDefinition(calls, middleType, "middle", {
      requires: [{ type: leafType }]
    }));
    registry.registerDefinition(createLabeledDefinition(calls, rootType, "root", {
      requires: [{ type: middleType }]
    }));
    const actor = actorSystem.createActor({ id: "actor" });

    registry.addComponent(actor, rootType);

    expect(calls).toEqual([
      "create:leaf",
      "attach:leaf",
      "create:middle",
      "attach:middle",
      "create:root",
      "attach:root"
    ]);
  });

  it("reuses an existing singleton dependency by default", () => {
    const actorSystem = new ActorSystem();
    const calls: string[] = [];
    const dependencyType = componentType<TestComponent>("dependency");
    const rootType = componentType<TestComponent>("root");
    const registry = new ComponentRegistry({ actorSystem });
    registry.registerDefinition(createLabeledDefinition(calls, dependencyType, "dependency"));
    registry.registerDefinition(createLabeledDefinition(calls, rootType, "root", {
      requires: [{ type: dependencyType }]
    }));
    const actor = actorSystem.createActor({ id: "actor" });
    const dependency = registry.addComponent(actor, dependencyType);
    calls.length = 0;

    registry.addComponent(actor, rootType);

    expect(actor.getComponent(dependencyType)).toBe(dependency);
    expect(calls).toEqual(["create:root", "attach:root"]);
  });

  it("does not roll back an existing dependency when root creation fails", () => {
    const actorSystem = new ActorSystem();
    const calls: string[] = [];
    const dependencyType = componentType<TestComponent>("dependency");
    const rootType = componentType<TestComponent>("root");
    const registry = new ComponentRegistry({ actorSystem });
    registry.registerDefinition(createLabeledDefinition(calls, dependencyType, "dependency"));
    registry.registerDefinition(createLabeledDefinition(calls, rootType, "root", {
      attachFails: true,
      requires: [{ type: dependencyType }]
    }));
    const actor = actorSystem.createActor({ id: "actor" });
    const dependency = registry.addComponent(actor, dependencyType);
    calls.length = 0;

    expect(() => registry.addComponent(actor, rootType)).toThrow("attach failed");

    expect(actor.getComponent(dependencyType)).toBe(dependency);
    expect(actor.hasComponent(rootType)).toBe(false);
    expect(calls).toEqual([
      "create:root",
      "attach:root",
      "detach:root",
      "dispose:root"
    ]);
  });

  it("throws when a missing required dependency is not auto-addable", () => {
    const actorSystem = new ActorSystem();
    const calls: string[] = [];
    const dependencyType = componentType<TestComponent>("dependency");
    const rootType = componentType<TestComponent>("root");
    const registry = new ComponentRegistry({ actorSystem });
    registry.registerDefinition(createLabeledDefinition(calls, dependencyType, "dependency"));
    registry.registerDefinition(createLabeledDefinition(calls, rootType, "root", {
      requires: [{ type: dependencyType, autoAdd: false }]
    }));
    const actor = actorSystem.createActor({ id: "actor" });

    expect(() => registry.addComponent(actor, rootType)).toThrow(/Required component is missing/);
    expect(calls).toEqual([]);
  });

  it("only evaluates requirement options factories when auto-add is needed", () => {
    const actorSystem = new ActorSystem();
    const calls: string[] = [];
    const dependencyType = componentType<TestComponent>("dependency");
    const rootType = componentType<TestComponent>("root");
    const registry = new ComponentRegistry({ actorSystem });
    registry.registerDefinition(createLabeledDefinition(calls, dependencyType, "dependency"));
    let optionsFactoryCalls = 0;
    registry.registerDefinition(createLabeledDefinition(calls, rootType, "root", {
      requires: [{
        type: dependencyType,
        options: () => {
          optionsFactoryCalls += 1;
          return undefined;
        }
      }]
    }));
    const actorWithExistingDependency = actorSystem.createActor({ id: "existing" });
    registry.addComponent(actorWithExistingDependency, dependencyType);
    calls.length = 0;

    registry.addComponent(actorWithExistingDependency, rootType);

    expect(optionsFactoryCalls).toBe(0);

    const actorWithoutDependency = actorSystem.createActor({ id: "missing" });
    registry.addComponent(actorWithoutDependency, rootType);

    expect(optionsFactoryCalls).toBe(1);
  });

  it("rolls back auto-added dependencies when root attach fails", () => {
    const actorSystem = new ActorSystem();
    const calls: string[] = [];
    const dependencyType = componentType<TestComponent>("dependency");
    const rootType = componentType<TestComponent>("root");
    const registry = new ComponentRegistry({ actorSystem });
    registry.registerDefinition(createLabeledDefinition(calls, dependencyType, "dependency"));
    registry.registerDefinition(createLabeledDefinition(calls, rootType, "root", {
      attachFails: true,
      requires: [{ type: dependencyType }]
    }));
    const actor = actorSystem.createActor({ id: "actor" });

    expect(() => registry.addComponent(actor, rootType)).toThrow("attach failed");

    expect(actor.hasComponent(dependencyType)).toBe(false);
    expect(actor.hasComponent(rootType)).toBe(false);
    expect(calls).toEqual([
      "create:dependency",
      "attach:dependency",
      "create:root",
      "attach:root",
      "detach:root",
      "dispose:root",
      "detach:dependency",
      "dispose:dependency"
    ]);
  });

  it("does not create later plan items when dependency bridge attach fails", () => {
    const actorSystem = new ActorSystem();
    const calls: string[] = [];
    const dependencyType = componentType<TestComponent>("dependency");
    const rootType = componentType<TestComponent>("root");
    const registry = new ComponentRegistry({ actorSystem, attachmentRuntime: createAttachmentRuntime(calls, true) });
    registry.registerDefinition(createLabeledDefinition(calls, dependencyType, "dependency"));
    registry.registerDefinition(createLabeledDefinition(calls, rootType, "root", {
      requires: [{ type: dependencyType }]
    }));
    const actor = actorSystem.createActor({ id: "actor" });

    expect(() => registry.addComponent(actor, rootType)).toThrow("bridge failed");

    expect(actor.hasComponent(dependencyType)).toBe(false);
    expect(actor.hasComponent(rootType)).toBe(false);
    expect(calls).toEqual([
      "create:dependency",
      "attach:dependency",
      "bridge-attach:dependency-id",
      "detach:dependency",
      "dispose:dependency"
    ]);
  });

  it("does not reuse an existing non-singleton dependency by default", () => {
    const actorSystem = new ActorSystem();
    const calls: string[] = [];
    const dependencyType = componentType<TestComponent>("dependency");
    const rootType = componentType<TestComponent>("root");
    const registry = new ComponentRegistry({ actorSystem });
    registry.registerDefinition({
      type: dependencyType,
      create(actor, _context, options?: unknown) {
        const id = (options as { id: string }).id;
        calls.push(`create:${id}`);
        return createComponent(actor, calls, { id, type: dependencyType, label: id });
      }
    });
    registry.registerDefinition(createLabeledDefinition(calls, rootType, "root", {
      requires: [{ type: dependencyType, options: { id: "required-dependency" } }]
    }));
    const actor = actorSystem.createActor({ id: "actor" });
    registry.addComponent(actor, dependencyType, { id: "existing-dependency" });
    calls.length = 0;

    registry.addComponent(actor, rootType);

    expect(actor.getComponents(dependencyType).map((component) => component.id)).toEqual([
      "existing-dependency",
      "required-dependency"
    ]);
    expect(calls).toEqual([
      "create:required-dependency",
      "attach:required-dependency",
      "create:root",
      "attach:root"
    ]);
  });

  it("rejects a two-component dependency cycle before create", () => {
    const actorSystem = new ActorSystem();
    const calls: string[] = [];
    const typeA = componentType<TestComponent>("cycle-a");
    const typeB = componentType<TestComponent>("cycle-b");
    const registry = new ComponentRegistry({ actorSystem });
    registry.registerDefinition(createLabeledDefinition(calls, typeA, "a", {
      requires: [{ type: typeB }]
    }));
    registry.registerDefinition(createLabeledDefinition(calls, typeB, "b", {
      requires: [{ type: typeA }]
    }));
    const actor = actorSystem.createActor({ id: "actor" });

    expect(() => registry.addComponent(actor, typeA)).toThrow(
      "Component dependency cycle detected: cycle-a -> cycle-b -> cycle-a"
    );
    expect(calls).toEqual([]);
    expect(actor.hasComponent(typeA)).toBe(false);
    expect(actor.hasComponent(typeB)).toBe(false);
  });

  it("reports the full path for a longer dependency cycle", () => {
    const actorSystem = new ActorSystem();
    const calls: string[] = [];
    const typeA = componentType<TestComponent>("cycle-a");
    const typeB = componentType<TestComponent>("cycle-b");
    const typeC = componentType<TestComponent>("cycle-c");
    const registry = new ComponentRegistry({ actorSystem });
    registry.registerDefinition(createLabeledDefinition(calls, typeA, "a", {
      requires: [{ type: typeB }]
    }));
    registry.registerDefinition(createLabeledDefinition(calls, typeB, "b", {
      requires: [{ type: typeC }]
    }));
    registry.registerDefinition(createLabeledDefinition(calls, typeC, "c", {
      requires: [{ type: typeA }]
    }));
    const actor = actorSystem.createActor({ id: "actor" });

    expect(() => registry.addComponent(actor, typeA)).toThrow(
      "Component dependency cycle detected: cycle-a -> cycle-b -> cycle-c -> cycle-a"
    );
    expect(calls).toEqual([]);
  });

  it("does not treat diamond dependencies as cycles", () => {
    const actorSystem = new ActorSystem();
    const calls: string[] = [];
    const typeA = componentType<TestComponent>("diamond-a");
    const typeB = componentType<TestComponent>("diamond-b");
    const typeC = componentType<TestComponent>("diamond-c");
    const typeD = componentType<TestComponent>("diamond-d");
    const registry = new ComponentRegistry({ actorSystem });
    registry.registerDefinition(createLabeledDefinition(calls, typeD, "d"));
    registry.registerDefinition(createLabeledDefinition(calls, typeB, "b", {
      requires: [{ type: typeD }]
    }));
    registry.registerDefinition(createLabeledDefinition(calls, typeC, "c", {
      requires: [{ type: typeD }]
    }));
    registry.registerDefinition(createLabeledDefinition(calls, typeA, "a", {
      requires: [{ type: typeB }, { type: typeC }]
    }));
    const actor = actorSystem.createActor({ id: "actor" });

    registry.addComponent(actor, typeA);

    expect(actor.hasComponent(typeD)).toBe(true);
    expect(calls).toEqual([
      "create:d",
      "attach:d",
      "create:b",
      "attach:b",
      "create:c",
      "attach:c",
      "create:a",
      "attach:a"
    ]);
  });

  it("enforces singleton components per actor", () => {
    const actorSystem = new ActorSystem();
    const calls: string[] = [];
    const registry = new ComponentRegistry({ actorSystem });
    registry.registerDefinition(createDefinition(calls));
    const actor = actorSystem.createActor({ id: "actor" });

    registry.addComponent(actor, testComponentType);

    expect(() => registry.addComponent(actor, testComponentType)).toThrow(/Singleton component already exists/);
  });

  it("allows a singleton component to be added again after removal", () => {
    const actorSystem = new ActorSystem();
    const calls: string[] = [];
    const registry = new ComponentRegistry({ actorSystem });
    registry.registerDefinition(createDefinition(calls));
    const actor = actorSystem.createActor({ id: "actor" });

    const component = registry.addComponent(actor, testComponentType);
    registry.removeComponent(actor, component);
    const replacement = registry.addComponent(actor, testComponentType);

    expect(replacement.id).toBe("test-component");
    expect(actor.hasComponent(testComponentType)).toBe(true);
  });

  it("rejects duplicate component ids on the same actor before creating the second component", () => {
    const actorSystem = new ActorSystem();
    const calls: string[] = [];
    const registry = new ComponentRegistry({ actorSystem });
    registry.registerDefinition({
      type: testComponentType,
      create(actor, _context, options?: unknown) {
        calls.push("create");
        return createComponent(actor, calls, { id: (options as { id: string }).id });
      }
    });
    const actor = actorSystem.createActor({ id: "actor" });

    registry.addComponent(actor, testComponentType, { id: "duplicate" });

    expect(() => registry.addComponent(actor, testComponentType, { id: "duplicate" })).toThrow(
      /Component id already exists/
    );
    expect(calls).toEqual(["create", "attach"]);
  });

  it("allows the same component id on different actors", () => {
    const actorSystem = new ActorSystem();
    const calls: string[] = [];
    const registry = new ComponentRegistry({ actorSystem });
    registry.registerDefinition({
      type: testComponentType,
      create(actor, _context, options?: unknown) {
        return createComponent(actor, calls, { id: (options as { id: string }).id });
      }
    });
    const actorA = actorSystem.createActor({ id: "a" });
    const actorB = actorSystem.createActor({ id: "b" });

    const componentA = registry.addComponent(actorA, testComponentType, { id: "shared" });
    const componentB = registry.addComponent(actorB, testComponentType, { id: "shared" });

    expect(componentA.id).toBe("shared");
    expect(componentB.id).toBe("shared");
  });

  it("uses the default singleton id when no id override is provided", () => {
    const actorSystem = new ActorSystem();
    const calls: string[] = [];
    const registry = new ComponentRegistry({ actorSystem });
    const defaultIdType = componentType<TestComponent>("default-id-component");
    registry.registerDefinition({
      type: defaultIdType,
      singleton: true,
      create(actor) {
        return createComponent(actor, calls, {
          id: `${actor.id}:${defaultIdType}`,
          type: defaultIdType
        });
      }
    });
    const actor = actorSystem.createActor({ id: "actor" });

    const component = registry.addComponent(actor, defaultIdType);

    expect(component.id).toBe("actor:default-id-component");
  });

  it("rejects non-singleton components without options.id or createId before create", () => {
    const actorSystem = new ActorSystem();
    const calls: string[] = [];
    const registry = new ComponentRegistry({ actorSystem });
    registry.registerDefinition({
      type: testComponentType,
      create(actor) {
        calls.push("create");
        return createComponent(actor, calls);
      }
    });
    const actor = actorSystem.createActor({ id: "actor" });

    expect(() => registry.addComponent(actor, testComponentType)).toThrow(/Non-singleton component requires an id/);
    expect(calls).toEqual([]);
  });

  it("does not treat nested unknown options as component id options", () => {
    const actorSystem = new ActorSystem();
    const calls: string[] = [];
    const registry = new ComponentRegistry({ actorSystem });
    registry.registerDefinition({
      type: testComponentType,
      create(actor) {
        calls.push("create");
        return createComponent(actor, calls);
      }
    });
    const actor = actorSystem.createActor({ id: "actor" });

    expect(() => registry.addComponent(actor, testComponentType, { nested: { id: "not-a-component-id" } })).toThrow(
      /Non-singleton component requires an id/
    );
    expect(calls).toEqual([]);
  });

  it("rolls back when create returns an id that differs from the prechecked id", () => {
    const actorSystem = new ActorSystem();
    const calls: string[] = [];
    const registry = new ComponentRegistry({ actorSystem });
    registry.registerDefinition({
      type: testComponentType,
      createId() {
        return "expected-id";
      },
      create(actor) {
        calls.push("create");
        return createComponent(actor, calls, { id: "actual-id" });
      }
    });
    const actor = actorSystem.createActor({ id: "actor" });

    expect(() => registry.addComponent(actor, testComponentType)).toThrow(
      /Component id mismatch. Expected expected-id, received actual-id/
    );
    expect(calls).toEqual(["create", "dispose"]);
    expect(actor.hasComponent(testComponentType)).toBe(false);
  });

  it("rolls back when create returns an id that conflicts after precheck", () => {
    const actorSystem = new ActorSystem();
    const calls: string[] = [];
    const registry = new ComponentRegistry({ actorSystem });
    registry.registerDefinition({
      type: testComponentType,
      create(actor, _context, options?: unknown) {
        return createComponent(actor, calls, { id: (options as { id: string }).id });
      }
    });
    const collidingType = componentType<TestComponent>("colliding-component");
    registry.registerDefinition({
      type: collidingType,
      createId() {
        return "planned-id";
      },
      create(actor) {
        calls.push("colliding-create");
        return createComponent(actor, calls, {
          id: "existing-id",
          type: collidingType
        });
      }
    });
    const actor = actorSystem.createActor({ id: "actor" });
    registry.addComponent(actor, testComponentType, { id: "existing-id" });

    expect(() => registry.addComponent(actor, collidingType)).toThrow(/Component id already exists/);
    expect(calls).toEqual(["attach", "colliding-create", "dispose"]);
    expect(actor.getComponent(collidingType)).toBeNull();
  });

  it("calls createId before create", () => {
    const actorSystem = new ActorSystem();
    const calls: string[] = [];
    const registry = new ComponentRegistry({ actorSystem });
    registry.registerDefinition({
      type: testComponentType,
      createId() {
        calls.push("create-id");
        return "ordered-id";
      },
      create(actor) {
        calls.push("create");
        return createComponent(actor, calls, { id: "ordered-id" });
      }
    });
    const actor = actorSystem.createActor({ id: "actor" });

    registry.addComponent(actor, testComponentType);

    expect(calls).toEqual(["create-id", "create", "attach"]);
  });

  it("rolls back an attached component when onAttach fails", () => {
    const actorSystem = new ActorSystem();
    const calls: string[] = [];
    const registry = new ComponentRegistry({ actorSystem });
    registry.registerDefinition(createDefinition(calls, { attachFails: true }));
    const actor = actorSystem.createActor({ id: "actor" });

    expect(() => registry.addComponent(actor, testComponentType)).toThrow("attach failed");

    expect(calls).toEqual(["create", "attach", "detach", "dispose"]);
    expect(actor.hasComponent(testComponentType)).toBe(false);
  });

  it("rolls back a component when bridge registration fails", () => {
    const actorSystem = new ActorSystem();
    const calls: string[] = [];
    const registry = new ComponentRegistry({ actorSystem, attachmentRuntime: createAttachmentRuntime(calls, true) });
    registry.registerDefinition(createDefinition(calls));
    const actor = actorSystem.createActor({ id: "actor" });

    expect(() => registry.addComponent(actor, testComponentType)).toThrow("bridge failed");

    expect(calls).toEqual(["create", "attach", "bridge-attach:test-component", "detach", "dispose"]);
    expect(actor.hasComponent(testComponentType)).toBe(false);
  });

  it("disposes external registrations before component detach and dispose", () => {
    const actorSystem = new ActorSystem();
    const calls: string[] = [];
    const registry = new ComponentRegistry({ actorSystem, attachmentRuntime: createAttachmentRuntime(calls) });
    registry.registerDefinition(createDefinition(calls));
    const actor = actorSystem.createActor({ id: "actor" });

    const component = registry.addComponent(actor, testComponentType);
    calls.length = 0;
    registry.removeComponent(actor, component);

    expect(calls).toEqual(["bridge-dispose:test-component", "detach", "dispose"]);
  });

  it("lets ActorSystem dispose registered components before removing an actor", () => {
    const actorSystem = new ActorSystem();
    const calls: string[] = [];
    const registry = new ComponentRegistry({ actorSystem });
    registry.registerDefinition(createDefinition(calls));
    const actor = actorSystem.createActor({ id: "actor" });
    registry.addComponent(actor, testComponentType);
    calls.length = 0;

    actorSystem.destroyActor(actor);

    expect(calls).toEqual(["detach", "dispose"]);
    expect(actorSystem.getActor("actor")).toBeNull();
  });
});
