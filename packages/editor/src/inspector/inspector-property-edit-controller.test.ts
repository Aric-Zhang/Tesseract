import { describe, expect, it } from "vitest";
import { createInspectorComponentDescriptorRegistry } from "./inspector-component-descriptor-registry";
import { InspectorPropertyEditController, type InspectorPropertyEditTargetSource } from "./inspector-property-edit-controller";

describe("InspectorPropertyEditController", () => {
  it("merges same-frame edits by key and applies the last value through the descriptor registry", () => {
    const fixture = createFixture();
    const applied: number[] = [];
    fixture.registry.register({
      componentType: "camera",
      readProperties: () => [],
      applyEdit(_component, request) {
        applied.push(request.value);
        return { accepted: true };
      }
    });

    fixture.controller.commit(createCommit({ value: 50 }));
    fixture.controller.commit(createCommit({ value: 70 }));
    fixture.controller.updateFrame({ timeMs: 16, deltaMs: 16, frameIndex: 1 });

    expect(applied).toEqual([70]);
    expect(fixture.controller.revision).toBe(1);
    expect(fixture.controller.lastApplied[0]?.result).toEqual({ accepted: true });
  });

  it("applies different keys during the same frame", () => {
    const fixture = createFixture();
    const applied: string[] = [];
    fixture.registry.register({
      componentType: "camera",
      readProperties: () => [],
      applyEdit(_component, request) {
        applied.push(`${request.propertyId}:${request.value}`);
        return { accepted: true };
      }
    });

    fixture.controller.commit(createCommit({ propertyId: "fov", value: 60 }));
    fixture.controller.commit(createCommit({ propertyId: "near", value: 0.5 }));
    fixture.controller.updateFrame({ timeMs: 16, deltaMs: 16, frameIndex: 1 });

    expect(applied).toEqual(["fov:60", "near:0.5"]);
  });

  it("records deterministic failures for missing targets and descriptor errors", () => {
    const fixture = createFixture();
    fixture.registry.register({
      componentType: "camera",
      readProperties: () => [],
      applyEdit() {
        throw new Error("descriptor failed");
      }
    });

    fixture.controller.commit(createCommit({ propertyId: "fov", value: 60 }));
    fixture.controller.commit(createCommit({ componentId: "missing", propertyId: "near", value: 0.5 }));
    fixture.controller.updateFrame({ timeMs: 16, deltaMs: 16, frameIndex: 1 });

    expect(fixture.controller.lastApplied.map((record) => record.result)).toEqual([
      { accepted: false, reason: "descriptor failed" },
      { accepted: false, reason: "Editable component not found." }
    ]);
  });

  it("rejects stale property commits through the descriptor apply path", () => {
    const fixture = createFixture();
    fixture.registry.register({
      componentType: "camera",
      readProperties: () => [{
        id: "fov",
        label: "FOV",
        value: "45.00 deg",
        kind: "number"
      }],
      applyEdit(_component, request) {
        if (request.propertyId !== "fov") {
          return { accepted: false, reason: `Unknown property ${request.propertyId}.` };
        }
        return { accepted: true };
      }
    });

    fixture.controller.commit(createCommit({ propertyId: "stale-property", value: 60 }));
    fixture.controller.updateFrame({ timeMs: 16, deltaMs: 16, frameIndex: 1 });

    expect(fixture.controller.lastApplied).toHaveLength(1);
    expect(fixture.controller.lastApplied[0]?.result).toEqual({
      accepted: false,
      reason: "Unknown property stale-property."
    });
  });

  it("lets the descriptor/runtime path remain authoritative when invalid values bypass UI controls", () => {
    const fixture = createFixture();
    const applied: number[] = [];
    fixture.registry.register({
      componentType: "camera",
      readProperties: () => [{
        id: "fov",
        label: "FOV",
        value: "45.00 deg",
        kind: "number",
        edit: {
          control: "number",
          value: 45,
          min: 1,
          max: 120,
          step: 0.1
        }
      }],
      applyEdit(_component, request) {
        if (request.value < 1 || request.value > 120) {
          return { accepted: false, reason: "FOV outside runtime command constraints." };
        }
        applied.push(request.value);
        return { accepted: true };
      }
    });

    fixture.controller.commit(createCommit({ value: 999 }));
    fixture.controller.updateFrame({ timeMs: 16, deltaMs: 16, frameIndex: 1 });

    expect(applied).toEqual([]);
    expect(fixture.controller.lastApplied[0]?.result).toEqual({
      accepted: false,
      reason: "FOV outside runtime command constraints."
    });
  });

  it("rejects commits whose component type no longer matches the target", () => {
    const fixture = createFixture();
    fixture.registry.register({
      componentType: "camera",
      readProperties: () => [],
      applyEdit() {
        return { accepted: true };
      }
    });

    fixture.controller.commit(createCommit({ componentType: "stale-camera" }));
    fixture.controller.updateFrame({ timeMs: 16, deltaMs: 16, frameIndex: 1 });

    expect(fixture.controller.lastApplied[0]?.result).toEqual({
      accepted: false,
      reason: "Editable component not found."
    });
  });

  it("ignores commits after dispose", () => {
    const fixture = createFixture();
    fixture.registry.register({
      componentType: "camera",
      readProperties: () => [],
      applyEdit() {
        return { accepted: true };
      }
    });

    fixture.controller.dispose();
    fixture.controller.commit(createCommit({ value: 55 }));
    fixture.controller.updateFrame({ timeMs: 16, deltaMs: 16, frameIndex: 1 });

    expect(fixture.controller.revision).toBe(0);
    expect(fixture.controller.lastApplied).toEqual([]);
  });
});

function createFixture(): {
  readonly registry: ReturnType<typeof createInspectorComponentDescriptorRegistry>;
  readonly targetSource: MutableTargetSource;
  readonly controller: InspectorPropertyEditController;
} {
  const registry = createInspectorComponentDescriptorRegistry();
  const targetSource = new MutableTargetSource();
  const controller = new InspectorPropertyEditController({
    descriptorRegistry: registry,
    targetSource
  });
  return { registry, targetSource, controller };
}

class MutableTargetSource implements InspectorPropertyEditTargetSource {
  readonly target: { readonly component: unknown; readonly componentType: string } = {
    component: {},
    componentType: "camera"
  };

  getEditableComponent(_actorId: string, componentId: string): { readonly component: unknown; readonly componentType: string } | null {
    if (componentId === "missing") return null;
    return this.target;
  }
}

function createCommit(overrides: Partial<Parameters<InspectorPropertyEditController["commit"]>[0]> = {}) {
  return {
    actorId: "camera-actor",
    componentId: "camera-motion",
    componentType: "camera",
    propertyId: "fov",
    value: 45,
    timeStamp: 1,
    source: "test",
    ...overrides
  };
}
