import { describe, expect, it } from "vitest";
import type { Actor, Component, ComponentDefinition } from "actor-system/core";
import { ActorSystem, ComponentRegistry, componentType } from "actor-system/core";
import { ProductionRuntimeSchedulerService } from "./runtime-scheduler-service";
import {
  RuntimeWorkAttachmentRuntime,
  runtimeWorkAttachment,
  type RuntimeWorkParticipant
} from "./runtime-work-attachment-runtime";

interface TestRuntimeWorkComponent extends Component, RuntimeWorkParticipant {
  readonly priority?: number;
}

interface TestRuntimeWorkComponentOptions {
  readonly id: string;
  readonly enabled?: boolean;
  readonly priority?: number;
  readonly updateRuntimeFrame: RuntimeWorkParticipant["updateRuntimeFrame"];
}

const testRuntimeWorkComponentType =
  componentType<TestRuntimeWorkComponent>("test-runtime-work-component");

function createSystems() {
  const actorSystem = new ActorSystem();
  const scheduler = new ProductionRuntimeSchedulerService();
  const runtimeWorkRuntime = new RuntimeWorkAttachmentRuntime({ actorSystem, scheduler });
  const registry = new ComponentRegistry({
    actorSystem,
    attachmentRuntime: runtimeWorkRuntime
  });
  registry.registerDefinition(createRuntimeWorkComponentDefinition());
  return { actorSystem, registry, scheduler };
}

function createRuntimeWorkComponentDefinition():
  ComponentDefinition<TestRuntimeWorkComponent, TestRuntimeWorkComponentOptions> {
  return {
    type: testRuntimeWorkComponentType,
    attachments: [runtimeWorkAttachment],
    createId(_actor, options) {
      if (!options) throw new Error("Test runtime work options are required.");
      return options.id;
    },
    create(actor, _context, options) {
      if (!options) throw new Error("Test runtime work options are required.");
      return {
        id: options.id,
        type: testRuntimeWorkComponentType,
        actor,
        enabled: options.enabled ?? true,
        priority: options.priority,
        updateRuntimeFrame: options.updateRuntimeFrame
      };
    }
  };
}

function addRuntimeWorkComponent(
  registry: ComponentRegistry,
  actor: Actor,
  options: TestRuntimeWorkComponentOptions
): TestRuntimeWorkComponent {
  return registry.addComponent(actor, testRuntimeWorkComponentType, options);
}

describe("RuntimeWorkAttachmentRuntime", () => {
  it("registers runtime work on RuntimeScheduler without using component frame-update tick", () => {
    const { actorSystem, registry, scheduler } = createSystems();
    const calls: string[] = [];
    const root = actorSystem.createActor({ id: "root" });
    const child = actorSystem.createActor({ id: "child", parent: root });

    addRuntimeWorkComponent(registry, root, {
      id: "root-work",
      priority: -1,
      updateRuntimeFrame: (frame) => calls.push(`root:${frame.frameIndex}`)
    });
    addRuntimeWorkComponent(registry, child, {
      id: "child-work",
      priority: 10,
      updateRuntimeFrame: (frame) => calls.push(`child:${frame.frameIndex}`)
    });

    scheduler.updateRuntimeFrame({ timeMs: 16, deltaMs: 16, frameIndex: 1 });

    expect(calls).toEqual(["child:1", "root:1"]);
  });

  it("respects actor active state, component enabled state, and detach disposal", () => {
    const { actorSystem, registry, scheduler } = createSystems();
    const calls: string[] = [];
    const activeActor = actorSystem.createActor({ id: "active" });
    const inactiveActor = actorSystem.createActor({ id: "inactive", enabled: false });
    const activeComponent = addRuntimeWorkComponent(registry, activeActor, {
      id: "active-work",
      updateRuntimeFrame: (frame) => calls.push(`active:${frame.frameIndex}`)
    });
    addRuntimeWorkComponent(registry, inactiveActor, {
      id: "inactive-work",
      updateRuntimeFrame: (frame) => calls.push(`inactive:${frame.frameIndex}`)
    });
    const disabledComponent = addRuntimeWorkComponent(registry, activeActor, {
      id: "disabled-work",
      enabled: false,
      updateRuntimeFrame: (frame) => calls.push(`disabled:${frame.frameIndex}`)
    });

    scheduler.updateRuntimeFrame({ timeMs: 0, deltaMs: 0, frameIndex: 0 });
    activeComponent.enabled = false;
    disabledComponent.enabled = true;
    scheduler.updateRuntimeFrame({ timeMs: 16, deltaMs: 16, frameIndex: 1 });
    registry.removeComponent(activeActor, disabledComponent);
    scheduler.updateRuntimeFrame({ timeMs: 32, deltaMs: 16, frameIndex: 2 });

    expect(calls).toEqual(["active:0", "disabled:1"]);
  });
});
