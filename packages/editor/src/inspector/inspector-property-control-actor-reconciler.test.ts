import { describe, expect, it } from "vitest";
import { ActorSystem, ComponentRegistry, componentType, createActorCreationScope, type Component } from "actor-system/core";
import { installActorInputComponentDefinitions } from "actor-system/input";
import { installActorUiComponentDefinitions, uiElementComponentType } from "ui-framework/actor-ui";
import { installControlComponentDefinitions, numberFieldComponentType } from "ui-framework/controls";
import { createInspectorComponentDescriptorRegistry } from "./inspector-component-descriptor-registry";
import { InspectorPropertyEditController } from "./inspector-property-edit-controller";
import {
  createPropertyControlKey,
  InspectorPropertyControlActorReconciler,
  isInspectorPropertyControlActorId,
  type InspectorEditablePropertyControlSpec
} from "./inspector-property-control-actor-reconciler";

interface EditableTestComponent extends Component {
  value: number;
}

const editableTestComponentType = componentType<EditableTestComponent>("editable-test-component");

describe("InspectorPropertyControlActorReconciler", () => {
  it("owns property control actors and routes NumberField commits through the edit controller", () => {
    const fixture = createFixture();
    const parent = fixture.actorSystem.createActor({ id: "inspector:body" });
    const targetActor = fixture.actorSystem.createActor({ id: "camera" });
    fixture.componentRegistry.addComponent(targetActor, editableTestComponentType, {
      id: "camera-motion",
      value: 45
    });
    const controller = new InspectorPropertyEditController({
      descriptorRegistry: fixture.descriptorRegistry,
      targetSource: {
        getEditableComponent(actorId, componentId) {
          const actor = fixture.actorSystem.getActor(actorId);
          const component = actor?.listComponents().find((candidate) => candidate.id === componentId) ?? null;
          return component ? { component, componentType: component.type } : null;
        }
      }
    });
    fixture.descriptorRegistry.register({
      componentType: editableTestComponentType,
      applyEdit(component, request) {
        (component as EditableTestComponent).value = request.value;
        return { accepted: true };
      }
    });
    const reconciler = new InspectorPropertyControlActorReconciler({
      context: fixture.context,
      parentActor: parent,
      editController: controller,
      document: fixture.document as unknown as Document
    });
    const spec = createEditableSpec();

    const elements = reconciler.reconcile([spec]);
    const key = createPropertyControlKey(spec);
    const controlActor = fixture.actorSystem.listChildren(parent).find(isInspectorPropertyControlActor);
    const numberField = controlActor
      ? fixture.componentRegistry.getComponent(controlActor, numberFieldComponentType)
      : null;

    expect(elements.get(key)).toBe(numberField?.element);
    expect(controlActor).not.toBeNull();
    expect(controlActor?.id).toContain(":property-control:");
    expect(fixture.componentRegistry.getComponent(controlActor!, uiElementComponentType)?.element.className)
      .toBe("inspector-window__property-control");

    (numberField!.inputElement as unknown as FakeInputElement).value = "72";
    (numberField!.inputElement as unknown as FakeInputElement).dispatch("change", { timeStamp: 10 });
    controller.updateFrame({} as never);

    expect(controller.lastApplied.map((record) => record.result.accepted)).toEqual([true]);
    expect(fixture.componentRegistry.getComponent(targetActor, editableTestComponentType)?.value).toBe(72);

    reconciler.reconcile([]);

    expect(fixture.actorSystem.listChildren(parent).some(isInspectorPropertyControlActor)).toBe(false);
  });

  it("updates existing NumberField descriptors without recreating the actor", () => {
    const fixture = createFixture();
    const parent = fixture.actorSystem.createActor({ id: "inspector:body" });
    const controller = new InspectorPropertyEditController({
      descriptorRegistry: fixture.descriptorRegistry,
      targetSource: { getEditableComponent: () => null }
    });
    const reconciler = new InspectorPropertyControlActorReconciler({
      context: fixture.context,
      parentActor: parent,
      editController: controller,
      document: fixture.document as unknown as Document
    });

    reconciler.reconcile([createEditableSpec(45)]);
    const actorId = fixture.actorSystem.listChildren(parent).find(isInspectorPropertyControlActor)?.id;
    reconciler.reconcile([createEditableSpec(80)]);
    const actor = actorId ? fixture.actorSystem.getActor(actorId) : null;
    const numberField = actor ? fixture.componentRegistry.getComponent(actor, numberFieldComponentType) : null;

    expect(fixture.actorSystem.listChildren(parent).filter(isInspectorPropertyControlActor)).toHaveLength(1);
    expect(numberField?.value).toBe(80);
  });

  it("destroys stale control actors and prevents disposed controls from submitting edits", () => {
    const fixture = createFixture();
    const parent = fixture.actorSystem.createActor({ id: "inspector:body" });
    const targetActor = fixture.actorSystem.createActor({ id: "camera" });
    const target = fixture.componentRegistry.addComponent(targetActor, editableTestComponentType, {
      id: "camera-motion",
      value: 45
    });
    const controller = new InspectorPropertyEditController({
      descriptorRegistry: fixture.descriptorRegistry,
      targetSource: {
        getEditableComponent(actorId, componentId) {
          const actor = fixture.actorSystem.getActor(actorId);
          const component = actor?.listComponents().find((candidate) => candidate.id === componentId) ?? null;
          return component ? { component, componentType: component.type } : null;
        }
      }
    });
    fixture.descriptorRegistry.register({
      componentType: editableTestComponentType,
      applyEdit(component, request) {
        (component as EditableTestComponent).value = request.value;
        return { accepted: true };
      }
    });
    const reconciler = new InspectorPropertyControlActorReconciler({
      context: fixture.context,
      parentActor: parent,
      editController: controller,
      document: fixture.document as unknown as Document
    });

    reconciler.reconcile([createEditableSpec(45)]);
    const controlActor = fixture.actorSystem.listChildren(parent).find(isInspectorPropertyControlActor)!;
    const numberField = fixture.componentRegistry.getComponent(controlActor, numberFieldComponentType)!;
    const staleInput = numberField.inputElement as unknown as FakeInputElement;

    reconciler.reconcile([]);
    staleInput.value = "88";
    staleInput.dispatch("input");
    staleInput.dispatch("change", { timeStamp: 12 });
    controller.updateFrame({} as never);

    expect(fixture.actorSystem.listChildren(parent).filter(isInspectorPropertyControlActor)).toEqual([]);
    expect(fixture.componentRegistry.getComponent(targetActor, editableTestComponentType)).toBe(target);
    expect(target.value).toBe(45);
    expect(controller.pendingCount).toBe(0);
    expect(controller.lastApplied).toEqual([]);
  });
});

function createFixture(): {
  readonly actorSystem: ActorSystem;
  readonly componentRegistry: ComponentRegistry;
  readonly context: ReturnType<typeof createActorCreationScope>;
  readonly descriptorRegistry: ReturnType<typeof createInspectorComponentDescriptorRegistry>;
  readonly document: FakeDocument;
} {
  const actorSystem = new ActorSystem();
  const componentRegistry = new ComponentRegistry({ actorSystem });
  installActorInputComponentDefinitions(componentRegistry);
  installActorUiComponentDefinitions(componentRegistry);
  installControlComponentDefinitions(componentRegistry);
  componentRegistry.registerDefinition({
    type: editableTestComponentType,
    createId(_actor, options) {
      if (!options?.id) throw new Error("id is required");
      return options.id;
    },
    create(actor, _context, options) {
      if (!options?.id) throw new Error("id is required");
      return {
        actor,
        id: options.id,
        type: editableTestComponentType,
        enabled: true,
        value: options.value
      };
    }
  });
  return {
    actorSystem,
    componentRegistry,
    context: createActorCreationScope({ actorSystem, componentRegistry }),
    descriptorRegistry: createInspectorComponentDescriptorRegistry(),
    document: new FakeDocument()
  };
}

function createEditableSpec(value = 45): InspectorEditablePropertyControlSpec {
  return {
    actorId: "camera",
    componentId: "camera-motion",
    componentType: editableTestComponentType,
    property: {
      id: "fov",
      label: "FOV",
      kind: "number",
      value: `${value.toFixed(2)} deg`,
      edit: {
        control: "number",
        value,
        min: 1,
        max: 120,
        step: 0.1
      }
    }
  };
}

function isInspectorPropertyControlActor(actor: { readonly id: string }): boolean {
  return isInspectorPropertyControlActorId(actor.id);
}

type FakeListener = (event: FakeEvent) => void;

interface FakeEvent {
  readonly key?: string;
  readonly timeStamp?: number;
  preventDefault?(): void;
}

class FakeDocument {
  createElement(tagName: string): FakeElement {
    return tagName === "input"
      ? new FakeInputElement(this)
      : new FakeElement(this, tagName);
  }
}

class FakeClassList {
  readonly #classes = new Set<string>();

  add(className: string): void {
    this.#classes.add(className);
  }

  remove(className: string): void {
    this.#classes.delete(className);
  }
}

class FakeElement {
  readonly ownerDocument: FakeDocument;
  readonly tagName: string;
  readonly dataset: Record<string, string | undefined> = {};
  readonly children: FakeElement[] = [];
  readonly classList = new FakeClassList();
  readonly attributes = new Map<string, string>();
  readonly listeners = new Map<string, Set<FakeListener>>();
  className = "";
  hidden = false;
  parentElement: FakeElement | null = null;

  constructor(ownerDocument: FakeDocument, tagName: string) {
    this.ownerDocument = ownerDocument;
    this.tagName = tagName;
  }

  append(child: FakeElement): void {
    child.parentElement = this;
    this.children.push(child);
  }

  remove(): void {
    if (!this.parentElement) return;
    const index = this.parentElement.children.indexOf(this);
    if (index >= 0) this.parentElement.children.splice(index, 1);
    this.parentElement = null;
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }

  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }

  removeAttribute(name: string): void {
    this.attributes.delete(name);
  }

  addEventListener(type: string, listener: FakeListener): void {
    const listeners = this.listeners.get(type) ?? new Set<FakeListener>();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type: string, listener: FakeListener): void {
    this.listeners.get(type)?.delete(listener);
  }

  dispatch(type: string, event: FakeEvent = {}): void {
    for (const listener of [...this.listeners.get(type) ?? []]) {
      listener(event);
    }
  }

  getBoundingClientRect(): DOMRectReadOnly {
    return {
      left: 0,
      top: 0,
      right: 100,
      bottom: 24,
      width: 100,
      height: 24,
      x: 0,
      y: 0,
      toJSON() {}
    };
  }
}

class FakeInputElement extends FakeElement {
  type = "";
  value = "";
  disabled = false;
  readOnly = false;

  constructor(ownerDocument: FakeDocument) {
    super(ownerDocument, "input");
  }
}
