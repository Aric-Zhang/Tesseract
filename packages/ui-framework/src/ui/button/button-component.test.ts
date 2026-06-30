import { describe, expect, it } from "vitest";
import { ActorSystem, ComponentRegistry } from "actor-system/core";
import { installActorInputComponentDefinitions } from "actor-system/input";
import { installActorUiComponentDefinitions } from "../../actor-ui";
import { installControlComponentDefinitions } from "../../controls";
import { uiElementComponentType } from "../element";
import {
  type ButtonActivation,
  buttonComponentType
} from "./button-component";

describe("ButtonComponent", () => {
  it("activates once through actor input and keyboard", () => {
    const fixture = createFixture();
    const activations: ButtonActivation[] = [];
    const component = fixture.registry.addComponent(fixture.actor, buttonComponentType, {
      descriptor: { id: "inspect", label: "Inspect" },
      activationSink: {
        activateButton: (activation: ButtonActivation) => activations.push(activation)
      },
      document: fixture.document as unknown as Document
    });
    fixture.element.rect = createRect(0, 0, 40, 20);

    const hit = component.hitTestInput({ x: 10, y: 10 })!;
    expect(fixture.element.getAttribute("aria-pressed")).toBeNull();
    expect(fixture.element.dataset.uiButtonPressed).toBeUndefined();
    component.onInputEnd({ hit, wasClick: true, timeStamp: 11 } as Parameters<typeof component.onInputEnd>[0]);
    fixture.element.dispatchKey("keydown", "Enter", 12);
    fixture.element.dispatchKey("keydown", " ", 13);
    fixture.element.dispatchKey("keyup", " ", 14);

    expect(activations.map((activation) => ({
      descriptorId: activation.descriptorId,
      reason: activation.reason,
      timeStamp: activation.timeStamp
    }))).toEqual([
      { descriptorId: "inspect", reason: "actor-system/input", timeStamp: 11 },
      { descriptorId: "inspect", reason: "keyboard", timeStamp: 12 },
      { descriptorId: "inspect", reason: "keyboard", timeStamp: 14 }
    ]);
  });

  it("blocks disabled activation and removes keyboard listeners on dispose", () => {
    const fixture = createFixture();
    const activations: ButtonActivation[] = [];
    const component = fixture.registry.addComponent(fixture.actor, buttonComponentType, {
      descriptor: { id: "disabled", label: "Disabled", enabled: false },
      activationSink: {
        activateButton: (activation: ButtonActivation) => activations.push(activation)
      },
      document: fixture.document as unknown as Document
    });
    fixture.element.rect = createRect(0, 0, 40, 20);

    expect(component.hitTestInput({ x: 10, y: 10 })).toBeNull();
    fixture.element.dispatchKey("keydown", "Enter", 1);

    component.setDescriptor({ id: "enabled", label: "Enabled" });
    component.dispose();
    fixture.element.dispatchKey("keydown", "Enter", 2);

    expect(activations).toEqual([]);
    expect(fixture.element.listenerCount("keydown")).toBe(0);
  });
});

function createFixture() {
  const actorSystem = new ActorSystem();
  const registry = new ComponentRegistry({ actorSystem });
  installActorInputComponentDefinitions(registry);
  installActorUiComponentDefinitions(registry);
  installControlComponentDefinitions(registry);
  const document = new FakeDocument();
  const actor = actorSystem.createActor({ id: "button" });
  const element = document.createElement("button");
  registry.addComponent(actor, uiElementComponentType, {
    element: element as unknown as HTMLElement
  });
  return { actorSystem, registry, document, actor, element };
}

class FakeDocument {
  createElement(tagName: string): FakeElement {
    return new FakeElement(this, tagName);
  }

  createElementNS(_namespace: string, tagName: string): FakeElement {
    return new FakeElement(this, tagName);
  }
}

class FakeElement {
  readonly ownerDocument: FakeDocument;
  readonly tagName: string;
  readonly dataset: Record<string, string | undefined> = {};
  readonly attributes = new Map<string, string>();
  readonly listeners = new Map<string, Set<(event: FakeKeyboardEvent) => void>>();
  readonly children: FakeElement[] = [];
  parentElement: FakeElement | null = null;
  className = "";
  textContent = "";
  title = "";
  ariaLabel: string | null = null;
  tabIndex = -1;
  disabled = false;
  hidden = false;
  type = "";
  rect = createRect(0, 0, 0, 0);

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

  addEventListener(type: string, listener: (event: FakeKeyboardEvent) => void): void {
    const listeners = this.listeners.get(type) ?? new Set();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type: string, listener: (event: FakeKeyboardEvent) => void): void {
    this.listeners.get(type)?.delete(listener);
  }

  listenerCount(type: string): number {
    return this.listeners.get(type)?.size ?? 0;
  }

  dispatchKey(type: "keydown" | "keyup", key: string, timeStamp: number): void {
    const event = new FakeKeyboardEvent(key, timeStamp);
    for (const listener of this.listeners.get(type) ?? []) {
      listener(event);
    }
  }

  getBoundingClientRect(): DOMRectReadOnly {
    return this.rect;
  }
}

class FakeKeyboardEvent {
  defaultPrevented = false;

  constructor(readonly key: string, readonly timeStamp: number) {}

  preventDefault(): void {
    this.defaultPrevented = true;
  }
}

function createRect(x: number, y: number, width: number, height: number): DOMRectReadOnly {
  return {
    x,
    y,
    width,
    height,
    left: x,
    top: y,
    right: x + width,
    bottom: y + height,
    toJSON() {
      return this;
    }
  };
}
