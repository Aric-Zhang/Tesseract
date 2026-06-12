import { describe, expect, it } from "vitest";
import { ActorSystem } from "../../actor-runtime";
import { installGizmoRuntimeComponentDefinitions } from "../../gizmo-runtime";
import { installEditorStateObserverComponentDefinitions } from "editor";
import { installDebugLogComponentDefinitions } from "../../debug";
import { createTestComponentRegistry } from "../../test-support";
import {
  WindowContentRegistry
} from "../../window-runtime";
import {
  DebugLogContentComponent,
  debugLogContentComponentType
} from "./debug-log-content-component";

class FakeDocument {
  createElement(tagName: string): FakeElement {
    return new FakeElement(this, tagName);
  }
}

class FakeElement {
  readonly ownerDocument: FakeDocument;
  readonly tagName: string;
  className = "";
  textContent = "";
  hidden = false;
  type = "";
  tabIndex = 0;
  ariaLabel = "";
  readonly style: Record<string, string> = {};
  readonly children: FakeElement[] = [];
  parentElement: FakeElement | null = null;

  constructor(ownerDocument: FakeDocument, tagName: string) {
    this.ownerDocument = ownerDocument;
    this.tagName = tagName;
  }

  append(...children: FakeElement[]): void {
    for (const child of children) {
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

  getBoundingClientRect(): DOMRectReadOnly {
    return {
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      toJSON() {
        return this;
      }
    };
  }
}

function createRegistry() {
  const setup = createTestComponentRegistry();
  const registry = setup.registry;
  installGizmoRuntimeComponentDefinitions(registry);
  installEditorStateObserverComponentDefinitions(registry);
  installDebugLogComponentDefinitions(registry);
  return setup;
}

describe("DebugLogContentComponent", () => {
  it("registers log content and updates text on frame", () => {
    const actor = new ActorSystem().createActor({ id: "debug-actor" });
    const document = new FakeDocument();
    const contentRegistration = new WindowContentRegistry();
    const component = new DebugLogContentComponent(actor, {
      document: document as unknown as Document,
      maxLines: 2,
      contentId: "content:debug",
      contentRegistration
    });

    expect(contentRegistration.getRegisteredContent("content:debug")?.element).toBe(component.content);
    expect(component.content.className).toBe("debug-log-window__content");
    expect(component.content.textContent).toBe("Gizmo debug log enabled");

    component.append({ type: "hit", message: "first", timeStamp: 1 });
    component.append({ type: "move", message: "second", timeStamp: 2 });
    component.append({ type: "end", message: "third" });
    component.updateFrame({ timeMs: 0, deltaMs: 0, frameIndex: 0 });

    expect(component.content.textContent).toBe("    2 second\n---- third");
  });

  it("disposes its content attachment idempotently through the component lifecycle", () => {
    const actor = new ActorSystem().createActor({ id: "debug-actor" });
    const document = new FakeDocument();
    const contentRegistration = new WindowContentRegistry();
    const component = new DebugLogContentComponent(actor, {
      document: document as unknown as Document,
      contentId: "content:debug",
      contentRegistration
    });

    component.dispose();
    component.dispose();

    expect(component.enabled).toBe(false);
    expect(contentRegistration.getRegisteredContent("content:debug")).toBeNull();
  });

  it("requires content registration options when added through the registry", () => {
    const { actorSystem, registry } = createRegistry();
    const actor = actorSystem.createActor({ id: "debug-actor" });

    expect(() => registry.addComponent(actor, debugLogContentComponentType, {
      document: new FakeDocument() as unknown as Document
    })).toThrow(/content registration/);
  });

  it("registers content through its definition", () => {
    const { actorSystem, registry } = createRegistry();
    const document = new FakeDocument();
    const actor = actorSystem.createActor({ id: "debug-actor" });
    const contentRegistration = new WindowContentRegistry();
    const component = registry.addComponent(actor, debugLogContentComponentType, {
      document: document as unknown as Document,
      contentId: "content:debug",
      contentRegistration
    });

    expect(contentRegistration.getRegisteredContent("content:debug")?.element).toBe(component.content);
  });
});



