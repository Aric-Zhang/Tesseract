import { describe, expect, it } from "vitest";
import { ActorSystem, ComponentRegistry } from "actor-system/core";
import { installActorInputComponentDefinitions } from "actor-system/input";
import { installActorUiComponentDefinitions } from "../../actor-ui";
import { installControlComponentDefinitions } from "../../controls";
import { uiElementComponentType } from "../element";
import {
  type ToggleButtonActivation,
  toggleButtonComponentType
} from "./toggle-button-component";

describe("ToggleButtonComponent", () => {
  it("emits requested pressed state without mutating owner truth", () => {
    const fixture = createFixture();
    const activations: ToggleButtonActivation[] = [];
    const component = fixture.registry.addComponent(fixture.actor, toggleButtonComponentType, {
      descriptor: { id: "lock", accessibleLabel: "Lock" },
      initialPressed: true,
      activationSink: {
        toggleButton: (activation: ToggleButtonActivation) => activations.push(activation)
      },
      document: fixture.document as unknown as Document
    });
    fixture.element.rect = createRect(0, 0, 40, 20);

    expect(fixture.element.getAttribute("aria-pressed")).toBe("true");
    const hit = component.hitTestInput({ x: 10, y: 10 })!;
    component.onInputEnd({ hit, wasClick: true, timeStamp: 5 } as Parameters<typeof component.onInputEnd>[0]);
    expect(component.pressed).toBe(true);

    component.setPressed(false);
    fixture.element.dispatchKey("keydown", "Enter", 6);

    expect(activations.map((activation) => ({
      pressed: activation.pressed,
      requestedPressed: activation.requestedPressed,
      reason: activation.reason,
      timeStamp: activation.timeStamp
    }))).toEqual([
      { pressed: true, requestedPressed: false, reason: "actor-system/input", timeStamp: 5 },
      { pressed: false, requestedPressed: true, reason: "keyboard", timeStamp: 6 }
    ]);
  });

  it("updates pressed icons and blocks disabled activation", () => {
    const fixture = createFixture();
    const activations: ToggleButtonActivation[] = [];
    const component = fixture.registry.addComponent(fixture.actor, toggleButtonComponentType, {
      descriptor: { id: "mute", accessibleLabel: "Mute", enabled: false },
      icons: {
        pressed: { kind: "text", value: "P" },
        unpressed: { kind: "text", value: "U" }
      },
      activationSink: {
        toggleButton: (activation: ToggleButtonActivation) => activations.push(activation)
      },
      document: fixture.document as unknown as Document
    });

    expect(fixture.element.children[0].textContent).toBe("U");
    component.setPressed(true);
    expect(fixture.element.children[0].textContent).toBe("P");
    fixture.element.dispatchKey("keydown", "Enter", 1);

    expect(activations).toEqual([]);
  });
});

function createFixture() {
  const actorSystem = new ActorSystem();
  const registry = new ComponentRegistry({ actorSystem });
  installActorInputComponentDefinitions(registry);
  installActorUiComponentDefinitions(registry);
  installControlComponentDefinitions(registry);
  const document = new FakeDocument();
  const actor = actorSystem.createActor({ id: "toggle" });
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
  constructor(readonly key: string, readonly timeStamp: number) {}

  preventDefault(): void {}
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
