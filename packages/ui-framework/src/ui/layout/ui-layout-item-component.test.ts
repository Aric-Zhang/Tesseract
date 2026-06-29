import { describe, expect, it } from "vitest";
import { ActorSystem, ComponentRegistry } from "actor-system/core";
import {
  uiElementComponentDefinition,
  uiElementComponentType
} from "../element";
import {
  UiLayoutItemComponent,
  uiLayoutItemComponentDefinition,
  uiLayoutItemComponentType,
  type UiLayoutItemComponentOptions,
  type UiLayoutItemDescriptor,
  type UiLayoutItemUpdate,
  type UiLayoutSize
} from "./index";

class FakeDocument {
  createElement(tagName: string): FakeElement {
    return new FakeElement(this, tagName);
  }
}

class FakeElement {
  readonly ownerDocument: FakeDocument;
  readonly tagName: string;
  readonly dataset: Record<string, string | undefined> = {};
  readonly children: FakeElement[] = [];
  parentElement: FakeElement | null = null;
  className = "";
  hidden = false;

  constructor(ownerDocument: FakeDocument, tagName: string) {
    this.ownerDocument = ownerDocument;
    this.tagName = tagName;
  }

  append(...children: FakeElement[]): void {
    for (const child of children) {
      child.remove();
      child.parentElement = this;
      this.children.push(child);
    }
  }

  remove(): void {
    if (!this.parentElement) return;
    const index = this.parentElement.children.indexOf(this);
    if (index >= 0) {
      this.parentElement.children.splice(index, 1);
    }
    this.parentElement = null;
  }
}

describe("UiLayoutItemComponent", () => {
  it("adds a layout item through ComponentRegistry when the actor has a UI element", () => {
    const { actor, element, registry } = createActorWithElement();

    const component = registry.addComponent(actor, uiLayoutItemComponentType);

    expect(component).toBeInstanceOf(UiLayoutItemComponent);
    expect(component.id).toBe("ui-layout-item");
    expect(component.type).toBe(uiLayoutItemComponentType);
    expect(component.actor).toBe(actor);
    expect(component.element).toBe(element as unknown as HTMLElement);
    expect(component.descriptor).toEqual({
      slot: "fill",
      order: 0,
      layer: 0,
      stretch: "both"
    });
  });

  it("fails through the required dependency when the actor has no UI element", () => {
    const actorSystem = new ActorSystem();
    const registry = createRegistry(actorSystem);
    const actor = actorSystem.createActor({ id: "actor" });

    expect(() => registry.addComponent(actor, uiLayoutItemComponentType)).toThrow(
      /Required component is missing/
    );
  });

  it("preserves supplied descriptor values", () => {
    const { actor, registry } = createActorWithElement();

    const component = registry.addComponent(actor, uiLayoutItemComponentType, {
      id: "layout",
      slot: "top",
      order: 2,
      layer: 3,
      stretch: "horizontal",
      minSize: { width: 100 },
      preferredSize: { width: 200, height: 32 }
    });

    expect(component.id).toBe("layout");
    expect(component.descriptor).toEqual({
      slot: "top",
      order: 2,
      layer: 3,
      stretch: "horizontal",
      minSize: { width: 100 },
      preferredSize: { width: 200, height: 32 }
    });
  });

  it("updates descriptor fields without changing the UI element", () => {
    const { actor, element, registry } = createActorWithElement();
    const component = registry.addComponent(actor, uiLayoutItemComponentType);

    component.setLayout({
      slot: "overlay",
      order: 5,
      layer: 9,
      stretch: "none"
    });

    expect(component.element).toBe(element as unknown as HTMLElement);
    expect(component.descriptor).toEqual({
      slot: "overlay",
      order: 5,
      layer: 9,
      stretch: "none"
    });
  });

  it("preserves omitted sizes and clears sizes with null", () => {
    const { actor, registry } = createActorWithElement();
    const component = registry.addComponent(actor, uiLayoutItemComponentType, {
      minSize: { width: 10 },
      preferredSize: { height: 20 }
    });

    component.setLayout({ slot: "left" });

    expect(component.descriptor).toMatchObject({
      slot: "left",
      minSize: { width: 10 },
      preferredSize: { height: 20 }
    });

    component.setLayout({ minSize: null });

    expect(component.descriptor.minSize).toBeUndefined();
    expect(component.descriptor.preferredSize).toEqual({ height: 20 });

    component.setLayout({ preferredSize: undefined });

    expect(component.descriptor.preferredSize).toEqual({ height: 20 });

    component.setLayout({ preferredSize: null });

    expect(component.descriptor.preferredSize).toBeUndefined();
  });

  it("does not retain references to constructor options or nested sizes", () => {
    const { actor, registry } = createActorWithElement();
    const minSize: Mutable<UiLayoutSize> = { width: 10 };
    const options: Mutable<UiLayoutItemComponentOptions> = {
      slot: "top",
      minSize
    };

    const component = registry.addComponent(actor, uiLayoutItemComponentType, options);
    options.slot = "bottom";
    minSize.width = 99;

    expect(component.descriptor).toMatchObject({
      slot: "top",
      minSize: { width: 10 }
    });
  });

  it("does not retain references to update objects or nested sizes", () => {
    const { actor, registry } = createActorWithElement();
    const component = registry.addComponent(actor, uiLayoutItemComponentType);
    const preferredSize: Mutable<UiLayoutSize> = { height: 20 };
    const update: Mutable<UiLayoutItemUpdate> = {
      slot: "right",
      preferredSize
    };

    component.setLayout(update);
    update.slot = "overlay";
    preferredSize.height = 88;

    expect(component.descriptor).toMatchObject({
      slot: "right",
      preferredSize: { height: 20 }
    });
  });

  it("does not expose a mutable internal descriptor", () => {
    const { actor, registry } = createActorWithElement();
    const component = registry.addComponent(actor, uiLayoutItemComponentType, {
      order: 1,
      minSize: { width: 10 }
    });
    const descriptor = component.descriptor;

    tryMutateDescriptor(descriptor, {
      order: 99,
      minSize: { width: 99 }
    });

    expect(component.descriptor).toEqual({
      slot: "fill",
      order: 1,
      layer: 0,
      stretch: "both",
      minSize: { width: 10 }
    });
  });

  it("rejects invalid descriptor values and keeps the previous descriptor", () => {
    const { actor, registry } = createActorWithElement();
    const component = registry.addComponent(actor, uiLayoutItemComponentType, {
      slot: "fill",
      minSize: { width: 10 }
    });

    expect(() => component.setLayout({ slot: "middle" as never })).toThrow(/Invalid UI layout slot/);
    expect(() => component.setLayout({ slot: null as never })).toThrow(/Invalid UI layout slot/);
    expect(() => component.setLayout({ stretch: "wide" as never })).toThrow(/Invalid UI layout stretch/);
    expect(() => component.setLayout({ stretch: null as never })).toThrow(/Invalid UI layout stretch/);
    expect(() => component.setLayout({ order: Number.NaN })).toThrow(/order/);
    expect(() => component.setLayout({ order: null as never })).toThrow(/order/);
    expect(() => component.setLayout({ layer: Number.POSITIVE_INFINITY })).toThrow(/layer/);
    expect(() => component.setLayout({ layer: null as never })).toThrow(/layer/);
    expect(() => component.setLayout({ minSize: { width: -1 } })).toThrow(/minSize\.width/);
    expect(() => component.setLayout({ preferredSize: { height: "big" as never } })).toThrow(
      /preferredSize\.height/
    );

    expect(component.descriptor).toEqual({
      slot: "fill",
      order: 0,
      layer: 0,
      stretch: "both",
      minSize: { width: 10 }
    });
  });

  it("does not remove or move the element when layout changes or disposes", () => {
    const { actor, element, registry } = createActorWithElement();
    const document = element.ownerDocument;
    const parent = document.createElement("parent");
    const sibling = document.createElement("sibling");
    parent.append(element, sibling);
    const component = registry.addComponent(actor, uiLayoutItemComponentType);

    component.setLayout({ slot: "overlay", layer: 10 });
    component.dispose();
    component.dispose();

    expect(parent.children).toEqual([element, sibling]);
    expect(element.parentElement).toBe(parent);
    expect(component.enabled).toBe(false);
  });

  it("uses registry singleton behavior for duplicate layout items", () => {
    const { actor, registry } = createActorWithElement();

    registry.addComponent(actor, uiLayoutItemComponentType);

    expect(() => registry.addComponent(actor, uiLayoutItemComponentType)).toThrow(
      /Singleton component already exists/
    );
  });

  it("rejects invalid construction options", () => {
    const actorSystem = new ActorSystem();
    const actor = actorSystem.createActor({ id: "actor" });
    const element = new FakeDocument().createElement("section");
    const uiElement = {
      element: element as unknown as HTMLElement
    } as ConstructorParameters<typeof UiLayoutItemComponent>[1];

    expect(() => new UiLayoutItemComponent(actor, uiElement, {
      slot: "middle" as never
    })).toThrow(/Invalid UI layout slot/);
    expect(() => new UiLayoutItemComponent(actor, uiElement, {
      slot: null as never
    })).toThrow(/Invalid UI layout slot/);
    expect(() => new UiLayoutItemComponent(actor, uiElement, {
      order: null as never
    })).toThrow(/order/);
    expect(() => new UiLayoutItemComponent(actor, uiElement, {
      minSize: { width: -1 }
    })).toThrow(/minSize\.width/);
  });
});

function createActorWithElement(): {
  readonly actor: ReturnType<ActorSystem["createActor"]>;
  readonly element: FakeElement;
  readonly registry: ComponentRegistry;
} {
  const actorSystem = new ActorSystem();
  const registry = createRegistry(actorSystem);
  const actor = actorSystem.createActor({ id: "actor" });
  const document = new FakeDocument();
  const elementComponent = registry.addComponent(actor, uiElementComponentType, {
    element: document.createElement("section") as unknown as HTMLElement
  });
  return {
    actor,
    element: elementComponent.element as unknown as FakeElement,
    registry
  };
}

function createRegistry(actorSystem: ActorSystem): ComponentRegistry {
  const registry = new ComponentRegistry({ actorSystem });
  registry.registerDefinition(uiElementComponentDefinition);
  registry.registerDefinition(uiLayoutItemComponentDefinition);
  return registry;
}

function tryMutateDescriptor(
  descriptor: UiLayoutItemDescriptor,
  mutation: {
    readonly order: number;
    readonly minSize: UiLayoutSize;
  }
): void {
  try {
    (descriptor as { order: number }).order = mutation.order;
  } catch {
    // Frozen descriptors may throw in strict mode; either outcome is fine.
  }
  try {
    (descriptor.minSize as { width: number } | undefined)!.width = mutation.minSize.width!;
  } catch {
    // Frozen nested sizes may throw in strict mode; either outcome is fine.
  }
}

type Mutable<T> = {
  -readonly [K in keyof T]: T[K];
};
