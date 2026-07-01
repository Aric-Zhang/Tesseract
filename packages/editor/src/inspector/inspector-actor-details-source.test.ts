import { describe, expect, it } from "vitest";
import {
  ActorSystem,
  ComponentRegistry,
  componentType,
  type Component,
  type ComponentDefinition
} from "actor-system/core";

import {
  createActorSystemInspectorActorDetailsSource,
  formatInspectorComponentDisplayName
} from "./inspector-actor-details-source";
import { createInspectorComponentDescriptorRegistry } from "./inspector-component-descriptor-registry";

interface TestComponent extends Component {
  readonly label: string;
}

const duplicateType = componentType<TestComponent>("duplicate-component");
const secondaryType = componentType<TestComponent>("secondary-component");

describe("createActorSystemInspectorActorDetailsSource", () => {
  it("returns actor and component summaries in actor attachment order", () => {
    const { actorSystem, registry, descriptorRegistry } = createRegistryFixture();
    const actor = actorSystem.createActor({ id: "camera", name: "Camera3", enabled: false });
    registry.addComponent(actor, duplicateType, { id: "first", label: "first", enabled: true });
    registry.addComponent(actor, duplicateType, { id: "second", label: "second", enabled: false });
    registry.addComponent(actor, secondaryType, { id: "third", label: "third", enabled: true });
    const source = createActorSystemInspectorActorDetailsSource(actorSystem, { descriptorRegistry });

    const details = source.getActorDetails("camera");

    expect(details).toEqual({
      actorId: "camera",
      actorName: "Camera3",
      actorEnabled: false,
      components: [
        {
          id: "first",
          type: "duplicate-component",
          displayName: "duplicate-component",
          enabled: true,
          properties: []
        },
        {
          id: "second",
          type: "duplicate-component",
          displayName: "duplicate-component",
          enabled: false,
          properties: []
        },
        {
          id: "third",
          type: "secondary-component",
          displayName: "secondary-component",
          enabled: true,
          properties: []
        }
      ]
    });
  });

  it("returns null for a missing actor", () => {
    const { actorSystem, descriptorRegistry } = createRegistryFixture();
    const source = createActorSystemInspectorActorDetailsSource(actorSystem, { descriptorRegistry });

    expect(source.getActorDetails("missing")).toBeNull();
  });

  it("returns immutable snapshots without live component references", () => {
    const { actorSystem, registry, descriptorRegistry } = createRegistryFixture();
    const actor = actorSystem.createActor({ id: "scene", name: "Scene View" });
    const component = registry.addComponent(actor, duplicateType, {
      id: "component",
      label: "component",
      enabled: true
    });
    const source = createActorSystemInspectorActorDetailsSource(actorSystem, { descriptorRegistry });
    const details = source.getActorDetails("scene")!;

    component.enabled = false;

    expect(details.components[0]).toEqual({
      id: "component",
      type: "duplicate-component",
      displayName: "duplicate-component",
      enabled: true,
      properties: []
    });
    expect(details.components[0]).not.toBe(component);
    expect(Object.isFrozen(details)).toBe(true);
    expect(Object.isFrozen(details.components)).toBe(true);
    expect(Object.isFrozen(details.components[0])).toBe(true);
    expect(Object.isFrozen(details.components[0].properties)).toBe(true);
    expect(source.getActorDetails("scene")!.components[0].enabled).toBe(false);
  });

  it("reads descriptor properties as immutable summary rows", () => {
    const { actorSystem, registry, descriptorRegistry } = createRegistryFixture();
    const actor = actorSystem.createActor({ id: "camera", name: "Camera3" });
    const component = registry.addComponent(actor, duplicateType, {
      id: "component",
      label: "readable",
      enabled: true
    });
    descriptorRegistry.register({
      componentType: "duplicate-component",
      displayName: "Readable Component",
      readProperties(readComponent, context) {
        expect(readComponent).toBe(component);
        expect(context).toEqual({
          actorId: "camera",
          componentId: "component",
          componentType: "duplicate-component"
        });
        return [{
          id: "label",
          label: "Label",
          value: (readComponent as TestComponent).label,
          kind: "text"
        }];
      }
    });
    const source = createActorSystemInspectorActorDetailsSource(actorSystem, { descriptorRegistry });

    const details = source.getActorDetails("camera")!;

    expect(details.components[0].displayName).toBe("Readable Component");
    expect(details.components[0].properties).toEqual([{
      id: "label",
      label: "Label",
      value: "readable",
      kind: "text"
    }]);
    expect(Object.isFrozen(details.components[0].properties[0])).toBe(true);
  });

  it("clones editable property metadata into immutable summaries", () => {
    const { actorSystem, registry, descriptorRegistry } = createRegistryFixture();
    const actor = actorSystem.createActor({ id: "camera", name: "Camera3" });
    registry.addComponent(actor, duplicateType, {
      id: "component",
      label: "readable",
      enabled: true
    });
    const edit = {
      control: "number" as const,
      value: 45,
      min: 1,
      max: 120,
      step: 0.1
    };
    descriptorRegistry.register({
      componentType: "duplicate-component",
      readProperties() {
        return [{
          id: "fov",
          label: "FOV",
          value: "45",
          kind: "number",
          edit
        }];
      }
    });
    const source = createActorSystemInspectorActorDetailsSource(actorSystem, { descriptorRegistry });

    const property = source.getActorDetails("camera")!.components[0]!.properties[0]!;
    edit.value = 70;

    expect(property.edit).toEqual({
      control: "number",
      value: 45,
      min: 1,
      max: 120,
      step: 0.1,
      disabled: undefined
    });
    expect(Object.isFrozen(property.edit)).toBe(true);
  });

  it("renders descriptor errors as deterministic read-only error rows", () => {
    const { actorSystem, registry, descriptorRegistry } = createRegistryFixture();
    const actor = actorSystem.createActor({ id: "camera", name: "Camera3" });
    registry.addComponent(actor, duplicateType, {
      id: "component",
      label: "readable",
      enabled: true
    });
    descriptorRegistry.register({
      componentType: "duplicate-component",
      readProperties() {
        throw new Error("descriptor failed");
      }
    });
    const source = createActorSystemInspectorActorDetailsSource(actorSystem, { descriptorRegistry });

    expect(source.getActorDetails("camera")!.components[0].properties).toEqual([{
      id: "descriptor-error",
      label: "Descriptor error",
      value: "descriptor failed",
      kind: "error"
    }]);
  });
});

describe("formatInspectorComponentDisplayName", () => {
  it("uses the component type as the deterministic Gate 1 fallback", () => {
    expect(formatInspectorComponentDisplayName("camera3-motion-component")).toBe("camera3-motion-component");
  });
});

function createRegistryFixture(): {
  readonly actorSystem: ActorSystem;
  readonly registry: ComponentRegistry;
  readonly descriptorRegistry: ReturnType<typeof createInspectorComponentDescriptorRegistry>;
} {
  const actorSystem = new ActorSystem();
  const registry = new ComponentRegistry({ actorSystem });
  const descriptorRegistry = createInspectorComponentDescriptorRegistry();
  registry.registerDefinition(createTestDefinition(duplicateType));
  registry.registerDefinition(createTestDefinition(secondaryType));
  return { actorSystem, registry, descriptorRegistry };
}

function createTestDefinition(type: typeof duplicateType): ComponentDefinition<TestComponent, {
  readonly id: string;
  readonly label: string;
  readonly enabled?: boolean;
}>;
function createTestDefinition(type: typeof secondaryType): ComponentDefinition<TestComponent, {
  readonly id: string;
  readonly label: string;
  readonly enabled?: boolean;
}>;
function createTestDefinition(type: typeof duplicateType | typeof secondaryType): ComponentDefinition<TestComponent, {
  readonly id: string;
  readonly label: string;
  readonly enabled?: boolean;
}> {
  return {
    type,
    createId(_actor, options) {
      if (!options?.id) throw new Error("id is required");
      return options.id;
    },
    create(actor, _context, options) {
      if (!options?.id) throw new Error("id is required");
      return {
        actor,
        id: options.id,
        type,
        label: options.label,
        enabled: options.enabled ?? true
      };
    }
  };
}
