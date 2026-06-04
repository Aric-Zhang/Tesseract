import { describe, expect, it } from "vitest";
import { ActorSystem } from "./actor-system";
import type { Actor } from "./actor";
import type { Component } from "./component";
import { componentType } from "./component";
import { ComponentRegistry } from "./component-registry";

interface TestComponent extends Component {}

interface TestComponentOptions {
  id: string;
  enabled?: boolean;
  updateFrame?: () => void;
  dispose?: () => void;
}

const testComponentType = componentType<TestComponent>("test-component");

function createComponent(actor: Actor, options: TestComponentOptions): TestComponent {
  return {
    id: options.id,
    type: testComponentType,
    actor,
    enabled: options.enabled ?? true,
    updateFrame: options.updateFrame,
    dispose: options.dispose
  };
}

function createRegistry(actorSystem: ActorSystem): ComponentRegistry {
  const registry = new ComponentRegistry({ actorSystem });
  registry.registerDefinition({
    type: testComponentType,
    create(actor, _context, options?: TestComponentOptions) {
      if (!options) throw new Error("Test component options are required.");
      return createComponent(actor, options);
    }
  });
  return registry;
}

function addComponent(
  registry: ComponentRegistry,
  actor: Actor,
  options: TestComponentOptions
): TestComponent {
  return registry.addComponent(actor, testComponentType, options);
}

describe("ActorSystem", () => {
  it("lists actors in registration order", () => {
    const actorSystem = new ActorSystem();
    actorSystem.createActor({ id: "a" });
    actorSystem.createActor({ id: "b" });
    actorSystem.createActor({ id: "c" });

    expect(actorSystem.listActors().map((actor) => actor.id)).toEqual(["a", "b", "c"]);
  });

  it("tracks parent and child actor relationships", () => {
    const actorSystem = new ActorSystem();
    const parent = actorSystem.createActor({ id: "parent" });
    const child = actorSystem.createActor({ id: "child", parent });

    expect(actorSystem.getParent(child)).toBe(parent);
    expect(actorSystem.getParentId(child)).toBe("parent");
    expect(actorSystem.listChildren(parent)).toEqual([child]);
    expect(actorSystem.listRootActors()).toEqual([parent]);
  });

  it("can create an actor using a parent id", () => {
    const actorSystem = new ActorSystem();
    const parent = actorSystem.createActor({ id: "parent" });
    const child = actorSystem.createActor({ id: "child", parent: "parent" });

    expect(actorSystem.getParent(child)).toBe(parent);
  });

  it("can reparent actors and detach them back to roots", () => {
    const actorSystem = new ActorSystem();
    const parentA = actorSystem.createActor({ id: "parent-a" });
    const parentB = actorSystem.createActor({ id: "parent-b" });
    const child = actorSystem.createActor({ id: "child", parent: parentA });

    actorSystem.setParent(child, parentB);
    expect(actorSystem.listChildren(parentA)).toEqual([]);
    expect(actorSystem.listChildren(parentB)).toEqual([child]);
    expect(actorSystem.getParentId(child)).toBe("parent-b");

    actorSystem.setParent(child, null);
    expect(actorSystem.listChildren(parentB)).toEqual([]);
    expect(actorSystem.getParent(child)).toBeNull();
    expect(actorSystem.listRootActors()).toEqual([parentA, parentB, child]);
  });

  it("lists actors in tree order without changing flat creation order", () => {
    const actorSystem = new ActorSystem();
    const rootA = actorSystem.createActor({ id: "root-a" });
    const rootB = actorSystem.createActor({ id: "root-b" });
    const childA = actorSystem.createActor({ id: "child-a", parent: rootA });
    actorSystem.createActor({ id: "grandchild-a", parent: childA });
    actorSystem.createActor({ id: "child-b", parent: rootB });

    expect(actorSystem.listActors().map((actor) => actor.id)).toEqual([
      "root-a",
      "root-b",
      "child-a",
      "grandchild-a",
      "child-b"
    ]);
    expect(actorSystem.listActorsInTreeOrder().map((actor) => actor.id)).toEqual([
      "root-a",
      "child-a",
      "grandchild-a",
      "root-b",
      "child-b"
    ]);
  });

  it("rejects invalid parent relationships", () => {
    const actorSystem = new ActorSystem();
    const parent = actorSystem.createActor({ id: "parent" });
    const child = actorSystem.createActor({ id: "child", parent });

    expect(() => actorSystem.setParent(parent, parent)).toThrow(/parented to itself/);
    expect(() => actorSystem.setParent(parent, child)).toThrow(/cycle/);
    expect(() => actorSystem.setParent(parent, "missing")).toThrow(/does not exist/);
  });

  it("does not register an actor when createActor parent validation fails", () => {
    const actorSystem = new ActorSystem();

    expect(() => actorSystem.createActor({ id: "child", parent: "missing" })).toThrow(/does not exist/);
    expect(actorSystem.getActor("child")).toBeNull();
    expect(actorSystem.listActors()).toEqual([]);
  });

  it("updates enabled actors and components in actor registration order", () => {
    const actorSystem = new ActorSystem();
    const registry = createRegistry(actorSystem);
    const calls: string[] = [];
    const actorA = actorSystem.createActor({ id: "a" });
    const actorB = actorSystem.createActor({ id: "b" });
    const disabledActor = actorSystem.createActor({ id: "disabled-actor", enabled: false });

    addComponent(registry, actorA, { id: "a-1", updateFrame: () => calls.push("a-1") });
    addComponent(registry, actorA, {
      id: "disabled-component",
      enabled: false,
      updateFrame: () => calls.push("disabled-component")
    });
    addComponent(registry, actorB, { id: "b-1", updateFrame: () => calls.push("b-1") });
    addComponent(registry, disabledActor, {
      id: "disabled-actor-1",
      updateFrame: () => calls.push("disabled-actor-1")
    });

    actorSystem.updateFrame({ timeMs: 0, deltaMs: 0, frameIndex: 0 });

    expect(calls).toEqual(["a-1", "b-1"]);
  });

  it("does not update children while an ancestor is inactive", () => {
    const actorSystem = new ActorSystem();
    const registry = createRegistry(actorSystem);
    const calls: string[] = [];
    const grandparent = actorSystem.createActor({ id: "grandparent" });
    const parent = actorSystem.createActor({ id: "parent", parent: grandparent });
    const child = actorSystem.createActor({ id: "child", parent });
    addComponent(registry, child, { id: "child-component", updateFrame: () => calls.push("child") });

    grandparent.enabled = false;
    expect(actorSystem.isActorActive(child)).toBe(false);
    actorSystem.updateFrame({ timeMs: 0, deltaMs: 0, frameIndex: 0 });
    expect(calls).toEqual([]);

    grandparent.enabled = true;
    expect(actorSystem.isActorActive(child)).toBe(true);
    actorSystem.updateFrame({ timeMs: 16, deltaMs: 16, frameIndex: 1 });
    expect(calls).toEqual(["child"]);
  });

  it("does not update a child after the parent disables it in the same frame", () => {
    const actorSystem = new ActorSystem();
    const registry = createRegistry(actorSystem);
    const calls: string[] = [];
    const parent = actorSystem.createActor({ id: "parent" });
    const child = actorSystem.createActor({ id: "child", parent });
    addComponent(registry, parent, {
      id: "parent-component",
      updateFrame: () => {
        calls.push("parent");
        child.enabled = false;
      }
    });
    addComponent(registry, child, { id: "child-component", updateFrame: () => calls.push("child") });

    actorSystem.updateFrame({ timeMs: 0, deltaMs: 0, frameIndex: 0 });

    expect(calls).toEqual(["parent"]);
  });

  it("does not update a child after the parent destroys it in the same frame", () => {
    const actorSystem = new ActorSystem();
    const registry = createRegistry(actorSystem);
    const calls: string[] = [];
    const parent = actorSystem.createActor({ id: "parent" });
    const child = actorSystem.createActor({ id: "child", parent });
    addComponent(registry, parent, {
      id: "parent-component",
      updateFrame: () => {
        calls.push("parent");
        actorSystem.destroyActor(child);
      }
    });
    addComponent(registry, child, { id: "child-component", updateFrame: () => calls.push("child") });

    actorSystem.updateFrame({ timeMs: 0, deltaMs: 0, frameIndex: 0 });

    expect(calls).toEqual(["parent"]);
    expect(actorSystem.getActor("child")).toBeNull();
  });

  it("can destroy an actor during update without updating remaining components on that actor", () => {
    const actorSystem = new ActorSystem();
    const registry = createRegistry(actorSystem);
    const calls: string[] = [];
    const actorA = actorSystem.createActor({ id: "a" });
    const actorB = actorSystem.createActor({ id: "b" });

    addComponent(registry, actorA, { id: "destroyer", updateFrame: () => {
      calls.push("destroyer");
      actorSystem.destroyActor(actorA);
    } });
    addComponent(registry, actorA, {
      id: "after-destroy",
      updateFrame: () => calls.push("after-destroy")
    });
    addComponent(registry, actorB, { id: "b-1", updateFrame: () => calls.push("b-1") });

    actorSystem.updateFrame({ timeMs: 0, deltaMs: 0, frameIndex: 0 });

    expect(calls).toEqual(["destroyer", "b-1"]);
    expect(actorSystem.getActor("a")).toBeNull();
  });

  it("destroys an actor and disposes its components in reverse attach order", () => {
    const actorSystem = new ActorSystem();
    const registry = createRegistry(actorSystem);
    const calls: string[] = [];
    const actor = actorSystem.createActor({ id: "a" });
    addComponent(registry, actor, { id: "first", dispose: () => calls.push("first") });
    addComponent(registry, actor, { id: "second", dispose: () => calls.push("second") });

    actorSystem.destroyActor(actor);

    expect(calls).toEqual(["second", "first"]);
    expect(actorSystem.getActor("a")).toBeNull();
  });

  it("destroys child actors before parent actor components", () => {
    const actorSystem = new ActorSystem();
    const registry = createRegistry(actorSystem);
    const calls: string[] = [];
    const parent = actorSystem.createActor({ id: "parent" });
    const child = actorSystem.createActor({ id: "child", parent });
    const grandchild = actorSystem.createActor({ id: "grandchild", parent: child });

    addComponent(registry, parent, { id: "parent-component", dispose: () => calls.push("parent") });
    addComponent(registry, child, { id: "child-component", dispose: () => calls.push("child") });
    addComponent(registry, grandchild, { id: "grandchild-component", dispose: () => calls.push("grandchild") });

    actorSystem.destroyActor(parent);

    expect(calls).toEqual(["grandchild", "child", "parent"]);
    expect(actorSystem.getActor("parent")).toBeNull();
    expect(actorSystem.getActor("child")).toBeNull();
    expect(actorSystem.getActor("grandchild")).toBeNull();
  });

  it("removes a directly destroyed child from its parent", () => {
    const actorSystem = new ActorSystem();
    const parent = actorSystem.createActor({ id: "parent" });
    const child = actorSystem.createActor({ id: "child", parent });

    actorSystem.destroyActor(child);

    expect(actorSystem.listChildren(parent)).toEqual([]);
    expect(actorSystem.getActor("child")).toBeNull();
  });

  it("does not dispose actors twice when recursive destroy re-enters the parent", () => {
    const actorSystem = new ActorSystem();
    const registry = createRegistry(actorSystem);
    const calls: string[] = [];
    const parent = actorSystem.createActor({ id: "parent" });
    const child = actorSystem.createActor({ id: "child", parent });

    addComponent(registry, parent, { id: "parent-component", dispose: () => calls.push("parent") });
    addComponent(registry, child, {
      id: "child-component",
      dispose: () => {
        calls.push("child");
        actorSystem.destroyActor(parent);
      }
    });

    actorSystem.destroyActor(parent);

    expect(calls).toEqual(["child", "parent"]);
    expect(actorSystem.getActor("parent")).toBeNull();
    expect(actorSystem.getActor("child")).toBeNull();
  });

  it("disposes actor components in reverse order and is idempotent", () => {
    const actorSystem = new ActorSystem();
    const registry = createRegistry(actorSystem);
    const calls: string[] = [];
    const actor = actorSystem.createActor({ id: "a" });
    addComponent(registry, actor, { id: "first", dispose: () => calls.push("first") });
    addComponent(registry, actor, { id: "second", dispose: () => calls.push("second") });

    actorSystem.dispose();
    actorSystem.dispose();

    expect(calls).toEqual(["second", "first"]);
  });

  it("disposes actors in reverse registration order", () => {
    const actorSystem = new ActorSystem();
    const registry = createRegistry(actorSystem);
    const calls: string[] = [];
    const actorA = actorSystem.createActor({ id: "a" });
    const actorB = actorSystem.createActor({ id: "b" });

    addComponent(registry, actorA, { id: "a-component", dispose: () => calls.push("a") });
    addComponent(registry, actorB, { id: "b-component", dispose: () => calls.push("b") });

    actorSystem.dispose();

    expect(calls).toEqual(["b", "a"]);
  });

  it("throws when used after dispose", () => {
    const actorSystem = new ActorSystem();
    actorSystem.dispose();

    expect(() => actorSystem.createActor()).toThrow(/after dispose/);
  });

  it("exposes actor component lookup helpers", () => {
    const actorSystem = new ActorSystem();
    const registry = createRegistry(actorSystem);
    const actor = actorSystem.createActor({ id: "a" });
    const component = addComponent(registry, actor, { id: "component" });

    expect(actor.getComponent(testComponentType)).toBe(component);
    expect(actor.getComponents(testComponentType)).toEqual([component]);
    expect(actor.hasComponent(testComponentType)).toBe(true);
  });

  it("returns component lookup arrays that cannot mutate actor internals", () => {
    const actorSystem = new ActorSystem();
    const registry = createRegistry(actorSystem);
    const actor = actorSystem.createActor({ id: "a" });
    const component = addComponent(registry, actor, { id: "component" });

    const components = actor.getComponents(testComponentType) as TestComponent[];
    components.length = 0;

    expect(actor.getComponent(testComponentType)).toBe(component);
    expect(actor.hasComponent(testComponentType)).toBe(true);
  });
});
