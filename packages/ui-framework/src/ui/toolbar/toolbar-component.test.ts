import { describe, expect, it } from "vitest";
import { ActorSystem, ComponentRegistry } from "actor-system/core";
import { installActorInputComponentDefinitions } from "actor-system/input";
import { installActorUiComponentDefinitions } from "../../actor-ui";
import { installControlComponentDefinitions } from "../../controls";
import { uiElementComponentType } from "../element";
import { buttonComponentType } from "../button";
import { toolbarComponentType } from "./toolbar-component";

describe("ToolbarComponent", () => {
  it("realizes direct button child actors in actor order through refresh", () => {
    const fixture = createFixture();
    const first = fixture.addButton("first");
    const second = fixture.addButton("second");

    fixture.toolbar.refreshToolbar();

    expect(fixture.toolbarElement.children).toEqual([first.element, second.element]);
    expect(fixture.toolbarElement.dataset.uiToolbarItemCount).toBe("2");
    expect(first.element.children[0].textContent).toBe("First");
  });

  it("does not mutate DOM when the toolbar signature is unchanged", () => {
    const fixture = createFixture();
    fixture.addButton("first");
    fixture.toolbar.refreshToolbar();
    const appendCount = fixture.toolbarElement.appendCount;

    fixture.toolbar.refreshToolbar();

    expect(fixture.toolbarElement.appendCount).toBe(appendCount);
  });

  it("removes stale child elements after reparenting and detaches on dispose", () => {
    const fixture = createFixture();
    const first = fixture.addButton("first");
    const otherParent = fixture.actorSystem.createActor({ id: "other-parent" });

    fixture.toolbar.refreshToolbar();
    expect(fixture.toolbarElement.children).toEqual([first.element]);

    fixture.actorSystem.setParent(first.actor, otherParent);
    fixture.toolbar.refreshToolbar();
    expect(fixture.toolbarElement.children).toEqual([]);
    expect(first.element.parentElement).toBeNull();

    fixture.actorSystem.setParent(first.actor, fixture.toolbarActor);
    fixture.toolbar.refreshToolbar();
    fixture.toolbar.dispose();

    expect(fixture.toolbarElement.children).toEqual([]);
    expect(first.element.children[0].textContent).toBe("First");
  });
});

function createFixture() {
  const actorSystem = new ActorSystem();
  const registry = new ComponentRegistry({ actorSystem });
  installActorInputComponentDefinitions(registry);
  installActorUiComponentDefinitions(registry);
  installControlComponentDefinitions(registry);
  const document = new FakeDocument();
  const toolbarActor = actorSystem.createActor({ id: "toolbar" });
  const toolbarElement = document.createElement("div");
  registry.addComponent(toolbarActor, uiElementComponentType, {
    element: toolbarElement as unknown as HTMLElement
  });
  const toolbar = registry.addComponent(toolbarActor, toolbarComponentType);

  function addButton(id: string) {
    const actor = actorSystem.createActor({ id, parent: toolbarActor });
    const element = document.createElement("button");
    registry.addComponent(actor, uiElementComponentType, {
      element: element as unknown as HTMLElement
    });
    registry.addComponent(actor, buttonComponentType, {
      descriptor: { id, label: titleCase(id) },
      activationSink: { activateButton() {} },
      document: document as unknown as Document
    });
    return { actor, element };
  }

  return {
    actorSystem,
    registry,
    document,
    toolbarActor,
    toolbarElement,
    toolbar,
    addButton
  };
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
  readonly listeners = new Map<string, Set<(event: unknown) => void>>();
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
  appendCount = 0;

  constructor(ownerDocument: FakeDocument, tagName: string) {
    this.ownerDocument = ownerDocument;
    this.tagName = tagName;
  }

  append(...children: FakeElement[]): void {
    this.appendCount += 1;
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

  addEventListener(type: string, listener: (event: unknown) => void): void {
    const listeners = this.listeners.get(type) ?? new Set();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type: string, listener: (event: unknown) => void): void {
    this.listeners.get(type)?.delete(listener);
  }

  getBoundingClientRect(): DOMRectReadOnly {
    return createRect(0, 0, 20, 20);
  }
}

function titleCase(value: string): string {
  return `${value.slice(0, 1).toUpperCase()}${value.slice(1)}`;
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
