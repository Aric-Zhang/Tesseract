import { describe, expect, it } from "vitest";
import { createInspectorComponentDescriptorRegistry } from "./inspector-component-descriptor-registry";
import type { InspectorComponentDescriptor } from "./inspector-component-descriptor";

describe("InspectorComponentDescriptorRegistry", () => {
  it("registers and looks up descriptors by component type", () => {
    const registry = createInspectorComponentDescriptorRegistry();
    const descriptor = createDescriptor("camera3-motion-component");

    registry.register(descriptor);

    expect(registry.get("camera3-motion-component")).toEqual(descriptor);
    expect(registry.get("missing")).toBeNull();
  });

  it("rejects duplicate descriptor registrations", () => {
    const registry = createInspectorComponentDescriptorRegistry();
    registry.register(createDescriptor("duplicate"));

    expect(() => registry.register(createDescriptor("duplicate"))).toThrow(
      /already registered/
    );
  });

  it("returns immutable descriptor list snapshots", () => {
    const registry = createInspectorComponentDescriptorRegistry();
    registry.register(createDescriptor("a"));
    const list = registry.list();

    expect(Object.isFrozen(list)).toBe(true);
    expect(() => (list as InspectorComponentDescriptor[]).push(createDescriptor("b"))).toThrow();
    expect(registry.list().map((descriptor) => descriptor.componentType)).toEqual(["a"]);
  });

});

function createDescriptor(componentType: string): InspectorComponentDescriptor {
  return {
    componentType,
    displayName: componentType,
    readProperties() {
      return Object.freeze([{
        id: "label",
        label: "Label",
        value: componentType,
        kind: "text" as const
      }]);
    }
  };
}
