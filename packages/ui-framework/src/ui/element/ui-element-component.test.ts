import { describe, expect, it } from "vitest";
import { ActorSystem, ComponentRegistry } from "actor-system/core";
import {
  UiElementComponent,
  uiElementComponentDefinition,
  uiElementComponentType
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

describe("UiElementComponent", () => {
  it("creates an owned div by default", () => {
    const actor = new ActorSystem().createActor({ id: "actor" });
    const document = new FakeDocument();

    const component = new UiElementComponent(actor, {
      document: document as unknown as Document
    });

    expect(component.id).toBe("ui-element");
    expect(component.type).toBe(uiElementComponentType);
    expect(component.actor).toBe(actor);
    expect(component.ownership).toBe("owned");
    expect((component.element as unknown as FakeElement).tagName).toBe("div");
  });

  it("creates an owned custom tag when tagName is supplied", () => {
    const actor = new ActorSystem().createActor({ id: "actor" });
    const document = new FakeDocument();

    const component = new UiElementComponent(actor, {
      tagName: "section",
      document: document as unknown as Document
    });

    expect((component.element as unknown as FakeElement).tagName).toBe("section");
    expect(component.ownership).toBe("owned");
  });

  it("defaults supplied elements to borrowed ownership", () => {
    const actor = new ActorSystem().createActor({ id: "actor" });
    const element = new FakeDocument().createElement("aside");

    const component = new UiElementComponent(actor, {
      element: element as unknown as HTMLElement
    });

    expect(component.element).toBe(element as unknown as HTMLElement);
    expect(component.ownership).toBe("borrowed");
  });

  it("rejects element and tagName together", () => {
    const actor = new ActorSystem().createActor({ id: "actor" });
    const element = new FakeDocument().createElement("aside");

    expect(() => new UiElementComponent(actor, {
      element: element as unknown as HTMLElement,
      tagName: "section"
    })).toThrow(/cannot be combined/);
  });

  it("does not create or replace a borrowed element when document is supplied", () => {
    const actor = new ActorSystem().createActor({ id: "actor" });
    const element = new FakeDocument().createElement("aside");
    const otherDocument = new FakeDocument();

    const component = new UiElementComponent(actor, {
      element: element as unknown as HTMLElement,
      document: otherDocument as unknown as Document
    });

    expect(component.element).toBe(element as unknown as HTMLElement);
    expect((component.element as unknown as FakeElement).tagName).toBe("aside");
  });

  it("applies class, hidden, and interactable state", () => {
    const actor = new ActorSystem().createActor({ id: "actor" });
    const document = new FakeDocument();

    const component = new UiElementComponent(actor, {
      document: document as unknown as Document,
      className: "ui-test",
      hidden: true,
      interactable: false
    });

    expect(component.element.className).toBe("ui-test");
    expect(component.element.hidden).toBe(true);
    expect(component.element.dataset.uiInteractable).toBe("false");
  });

  it("updates hidden and interactable state through narrow setters", () => {
    const actor = new ActorSystem().createActor({ id: "actor" });
    const document = new FakeDocument();
    const component = new UiElementComponent(actor, {
      document: document as unknown as Document
    });

    component.setHidden(true);
    component.setHidden(true);
    component.setInteractable(false);
    component.setInteractable(false);
    component.setInteractable(true);

    expect(component.element.hidden).toBe(true);
    expect(component.element.dataset).toEqual({ uiInteractable: "true" });
  });

  it("removes an owned created element on dispose", () => {
    const actor = new ActorSystem().createActor({ id: "actor" });
    const document = new FakeDocument();
    const parent = document.createElement("parent");
    const component = new UiElementComponent(actor, {
      document: document as unknown as Document
    });
    parent.append(component.element as unknown as FakeElement);

    component.dispose();

    expect(parent.children).toEqual([]);
    expect((component.element as unknown as FakeElement).parentElement).toBeNull();
    expect(component.enabled).toBe(false);
  });

  it("removes an owned transferred element on dispose", () => {
    const actor = new ActorSystem().createActor({ id: "actor" });
    const document = new FakeDocument();
    const parent = document.createElement("parent");
    const element = document.createElement("section");
    parent.append(element);
    const component = new UiElementComponent(actor, {
      element: element as unknown as HTMLElement,
      ownership: "owned"
    });

    component.dispose();

    expect(parent.children).toEqual([]);
    expect(element.parentElement).toBeNull();
  });

  it("does not remove a borrowed element on dispose and restores generic state", () => {
    const actor = new ActorSystem().createActor({ id: "actor" });
    const document = new FakeDocument();
    const parent = document.createElement("parent");
    const child = document.createElement("child");
    const element = document.createElement("section");
    element.className = "before";
    element.hidden = true;
    element.dataset.uiInteractable = "before";
    element.append(child);
    parent.append(element);

    const component = new UiElementComponent(actor, {
      element: element as unknown as HTMLElement,
      className: "after",
      hidden: false,
      interactable: false
    });
    component.setHidden(false);
    component.setInteractable(true);

    component.dispose();
    component.dispose();

    expect(parent.children).toEqual([element]);
    expect(element.children).toEqual([child]);
    expect(element.parentElement).toBe(parent);
    expect(element.className).toBe("before");
    expect(element.hidden).toBe(true);
    expect(element.dataset.uiInteractable).toBe("before");
    expect(component.enabled).toBe(false);
  });

  it("does not restore borrowed element state that the component never changed", () => {
    const actor = new ActorSystem().createActor({ id: "actor" });
    const document = new FakeDocument();
    const parent = document.createElement("parent");
    const element = document.createElement("section");
    parent.append(element);

    const component = new UiElementComponent(actor, {
      element: element as unknown as HTMLElement
    });
    element.className = "external-class";
    element.hidden = true;
    element.dataset.uiInteractable = "external";

    component.dispose();

    expect(parent.children).toEqual([element]);
    expect(element.className).toBe("external-class");
    expect(element.hidden).toBe(true);
    expect(element.dataset.uiInteractable).toBe("external");
  });

  it("removes component-created interactable data from borrowed elements when absent before construction", () => {
    const actor = new ActorSystem().createActor({ id: "actor" });
    const element = new FakeDocument().createElement("section");

    const component = new UiElementComponent(actor, {
      element: element as unknown as HTMLElement,
      interactable: true
    });

    component.dispose();

    expect(Object.hasOwn(element.dataset, "uiInteractable")).toBe(false);
  });

  it("requires an element when borrowed ownership is requested", () => {
    const actor = new ActorSystem().createActor({ id: "actor" });
    const document = new FakeDocument();

    expect(() => new UiElementComponent(actor, {
      ownership: "borrowed",
      document: document as unknown as Document
    })).toThrow(/cannot borrow/);
  });

  it("requires a document when creating an element without a global document", () => {
    const actor = new ActorSystem().createActor({ id: "actor" });

    expect(() => new UiElementComponent(actor)).toThrow(/requires options\.document/);
  });
});

describe("uiElementComponentDefinition", () => {
  it("creates a singleton component through ComponentRegistry", () => {
    const actorSystem = new ActorSystem();
    const registry = new ComponentRegistry({ actorSystem });
    registry.registerDefinition(uiElementComponentDefinition);
    const actor = actorSystem.createActor({ id: "actor" });
    const document = new FakeDocument();

    const component = registry.addComponent(actor, uiElementComponentType, {
      document: document as unknown as Document
    });

    expect(uiElementComponentDefinition.singleton).toBe(true);
    expect(component.id).toBe("ui-element");
    expect(registry.getComponent(actor, uiElementComponentType)).toBe(component);
    expect(() => registry.addComponent(actor, uiElementComponentType, {
      document: document as unknown as Document
    })).toThrow(/Singleton component already exists/);
  });

  it("respects supplied component ids through ComponentRegistry", () => {
    const actorSystem = new ActorSystem();
    const registry = new ComponentRegistry({ actorSystem });
    registry.registerDefinition(uiElementComponentDefinition);
    const actor = actorSystem.createActor({ id: "actor" });
    const document = new FakeDocument();

    const component = registry.addComponent(actor, uiElementComponentType, {
      id: "custom-element",
      document: document as unknown as Document
    });

    expect(component.id).toBe("custom-element");
  });
});
