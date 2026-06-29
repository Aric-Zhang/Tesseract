import { describe, expect, it } from "vitest";
import type { Actor, Component, ComponentDefinition } from "actor-system/core";
import { ActorSystem, ComponentRegistry, componentType } from "actor-system/core";
import type { UiFrame } from "./ui-scheduler";
import {
  FrameUpdateAttachmentRuntime,
  frameUpdateAttachment,
  type FrameUpdateParticipant
} from "./ui-frame-update-attachment-runtime";

interface TestUpdateComponent extends Component, FrameUpdateParticipant {}

interface TestUpdateComponentOptions {
  id: string;
  enabled?: boolean;
  updateFrame: (frame: UiFrame) => void;
}

const testUpdateComponentType = componentType<TestUpdateComponent>("test-update-component");

function createSystems() {
  const actorSystem = new ActorSystem();
  const updateRuntime = new FrameUpdateAttachmentRuntime({ actorSystem });
  const registry = new ComponentRegistry({
    actorSystem,
    attachmentRuntime: updateRuntime
  });
  registry.registerDefinition(createUpdateComponentDefinition());
  return { actorSystem, registry, updateRuntime };
}

function createUpdateComponentDefinition():
  ComponentDefinition<TestUpdateComponent, TestUpdateComponentOptions> {
  return {
    type: testUpdateComponentType,
    attachments: [frameUpdateAttachment],
    createId(_actor, options) {
      if (!options) throw new Error("Test update component options are required.");
      return options.id;
    },
    create(actor, _context, options) {
      if (!options) throw new Error("Test update component options are required.");
      return {
        id: options.id,
        type: testUpdateComponentType,
        actor,
        enabled: options.enabled ?? true,
        updateFrame: options.updateFrame
      };
    }
  };
}

function addUpdateComponent(
  registry: ComponentRegistry,
  actor: Actor,
  options: TestUpdateComponentOptions
): TestUpdateComponent {
  return registry.addComponent(actor, testUpdateComponentType, options);
}

function frame(frameIndex = 0): UiFrame {
  return {
    timeMs: frameIndex * 16,
    deltaMs: frameIndex === 0 ? 0 : 16,
    frameIndex
  };
}

describe("FrameUpdateAttachmentRuntime", () => {
  it("updates enabled actors and components in actor tree order", () => {
    const { actorSystem, registry, updateRuntime } = createSystems();
    const calls: string[] = [];
    const root = actorSystem.createActor({ id: "root" });
    const child = actorSystem.createActor({ id: "child", parent: root });
    const sibling = actorSystem.createActor({ id: "sibling" });
    const disabledActor = actorSystem.createActor({ id: "disabled-actor", enabled: false });

    addUpdateComponent(registry, root, { id: "root-1", updateFrame: () => calls.push("root-1") });
    addUpdateComponent(registry, child, { id: "child-1", updateFrame: () => calls.push("child-1") });
    addUpdateComponent(registry, root, {
      id: "disabled-component",
      enabled: false,
      updateFrame: () => calls.push("disabled-component")
    });
    addUpdateComponent(registry, sibling, { id: "sibling-1", updateFrame: () => calls.push("sibling-1") });
    addUpdateComponent(registry, disabledActor, {
      id: "disabled-actor-1",
      updateFrame: () => calls.push("disabled-actor-1")
    });

    updateRuntime.updateFrame(frame());

    expect(calls).toEqual(["root-1", "child-1", "sibling-1"]);
  });

  it("does not update children while an ancestor is inactive", () => {
    const { actorSystem, registry, updateRuntime } = createSystems();
    const calls: string[] = [];
    const grandparent = actorSystem.createActor({ id: "grandparent" });
    const parent = actorSystem.createActor({ id: "parent", parent: grandparent });
    const child = actorSystem.createActor({ id: "child", parent });
    addUpdateComponent(registry, child, { id: "child-component", updateFrame: () => calls.push("child") });

    grandparent.enabled = false;
    expect(actorSystem.isActorActive(child)).toBe(false);
    updateRuntime.updateFrame(frame(0));
    expect(calls).toEqual([]);

    grandparent.enabled = true;
    expect(actorSystem.isActorActive(child)).toBe(true);
    updateRuntime.updateFrame(frame(1));
    expect(calls).toEqual(["child"]);
  });

  it("does not update a child after the parent disables it in the same frame", () => {
    const { actorSystem, registry, updateRuntime } = createSystems();
    const calls: string[] = [];
    const parent = actorSystem.createActor({ id: "parent" });
    const child = actorSystem.createActor({ id: "child", parent });
    addUpdateComponent(registry, parent, {
      id: "parent-component",
      updateFrame: () => {
        calls.push("parent");
        child.enabled = false;
      }
    });
    addUpdateComponent(registry, child, { id: "child-component", updateFrame: () => calls.push("child") });

    updateRuntime.updateFrame(frame());

    expect(calls).toEqual(["parent"]);
  });

  it("does not update a child after the parent destroys it in the same frame", () => {
    const { actorSystem, registry, updateRuntime } = createSystems();
    const calls: string[] = [];
    const parent = actorSystem.createActor({ id: "parent" });
    const child = actorSystem.createActor({ id: "child", parent });
    addUpdateComponent(registry, parent, {
      id: "parent-component",
      updateFrame: () => {
        calls.push("parent");
        actorSystem.destroyActor(child);
      }
    });
    addUpdateComponent(registry, child, { id: "child-component", updateFrame: () => calls.push("child") });

    updateRuntime.updateFrame(frame());

    expect(calls).toEqual(["parent"]);
    expect(actorSystem.getActor("child")).toBeNull();
  });

  it("can destroy an actor during update without updating remaining components on that actor", () => {
    const { actorSystem, registry, updateRuntime } = createSystems();
    const calls: string[] = [];
    const actorA = actorSystem.createActor({ id: "a" });
    const actorB = actorSystem.createActor({ id: "b" });

    addUpdateComponent(registry, actorA, {
      id: "destroyer",
      updateFrame: () => {
        calls.push("destroyer");
        actorSystem.destroyActor(actorA);
      }
    });
    addUpdateComponent(registry, actorA, {
      id: "after-destroy",
      updateFrame: () => calls.push("after-destroy")
    });
    addUpdateComponent(registry, actorB, { id: "b-1", updateFrame: () => calls.push("b-1") });

    updateRuntime.updateFrame(frame());

    expect(calls).toEqual(["destroyer", "b-1"]);
    expect(actorSystem.getActor("a")).toBeNull();
  });

  it("does not update a component created on the same actor until the next frame", () => {
    const { actorSystem, registry, updateRuntime } = createSystems();
    const calls: string[] = [];
    const actor = actorSystem.createActor({ id: "a" });
    addUpdateComponent(registry, actor, {
      id: "creator",
      updateFrame: () => {
        calls.push("creator");
        if (!registry.hasComponent(actor, testUpdateComponentType)) return;
        if (actor.listComponents().some((component) => component.id === "created")) return;
        addUpdateComponent(registry, actor, {
          id: "created",
          updateFrame: () => calls.push("created")
        });
      }
    });

    updateRuntime.updateFrame(frame(0));
    updateRuntime.updateFrame(frame(1));

    expect(calls).toEqual(["creator", "creator", "created"]);
  });

  it("rejects components that declare frame updates but do not implement updateFrame", () => {
    const actorSystem = new ActorSystem();
    const updateRuntime = new FrameUpdateAttachmentRuntime({ actorSystem });
    const registry = new ComponentRegistry({ actorSystem, attachmentRuntime: updateRuntime });
    const plainType = componentType<Component>("plain-component");
    registry.registerDefinition({
      type: plainType,
      attachments: [frameUpdateAttachment],
      createId() {
        return "plain";
      },
      create(actor) {
        return {
          id: "plain",
          type: plainType,
          actor,
          enabled: true
        };
      }
    });
    const actor = actorSystem.createActor({ id: "a" });

    expect(() => registry.addComponent(actor, plainType)).toThrow(/cannot update frames/);
  });
});
