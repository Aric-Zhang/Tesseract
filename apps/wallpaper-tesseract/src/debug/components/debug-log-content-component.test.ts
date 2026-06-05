import { describe, expect, it } from "vitest";
import { ActorSystem } from "../../actor-runtime";
import { installCoreComponentDefinitions } from "../../component-definitions";
import { installDebugLogComponentDefinitions } from "../../debug";
import { sceneParameterPaths, vec2 } from "../../scene-runtime";
import { createTestComponentRegistry } from "../../test-support";
import {
  floatingWindowComponentType,
  installWindowComponentDefinitions,
  type FloatingWindowState,
  type WindowContentAttachment,
  type WindowContentAttachmentRequest,
  type WindowContentHost
} from "../../window-runtime";
import { createDefaultDebugWindowState } from "../debug-window-parameters";
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

class FakeWindowHost implements WindowContentHost {
  readonly id = "floating-window:test";
  readonly state: FloatingWindowState = {
    position: vec2(0, 0),
    size: vec2(320, 180),
    visible: true
  };
  title = "";
  visibleRequests: boolean[] = [];
  mounted: HTMLElement[] = [];

  setTitle(title: string): void {
    this.title = title;
  }

  getBounds(): DOMRectReadOnly {
    return {
      x: 0,
      y: 0,
      width: this.state.size.x,
      height: this.state.size.y,
      top: 0,
      left: 0,
      right: this.state.size.x,
      bottom: this.state.size.y,
      toJSON() {
        return this;
      }
    };
  }

  isContentInteractable(element: HTMLElement): boolean {
    return this.mounted.includes(element);
  }

  mountContent(request: HTMLElement | WindowContentAttachmentRequest): WindowContentAttachment {
    const element = isWindowContentAttachmentRequest(request) ? request.element : request;
    this.mounted.push(element);
    let disposed = false;
    let interactable = true;
    return {
      element,
      host: this,
      get interactable() {
        return !disposed && interactable;
      },
      setInteractable(nextInteractable: boolean): void {
        interactable = nextInteractable;
      },
      dispose: () => {
        if (disposed) return;
        disposed = true;
        const index = this.mounted.indexOf(element);
        if (index >= 0) {
          this.mounted.splice(index, 1);
        }
      }
    };
  }

  requestVisible(visible: boolean): void {
    this.visibleRequests.push(visible);
  }
}

function isWindowContentAttachmentRequest(
  request: HTMLElement | WindowContentAttachmentRequest
): request is WindowContentAttachmentRequest {
  return typeof request === "object" && request !== null && "element" in request;
}

function createRegistry() {
  const setup = createTestComponentRegistry();
  const registry = setup.registry;
  installCoreComponentDefinitions(registry);
  installWindowComponentDefinitions(registry);
  installDebugLogComponentDefinitions(registry);
  return setup;
}

describe("DebugLogContentComponent", () => {
  it("mounts log content through the floating window host and updates text on frame", () => {
    const actor = new ActorSystem().createActor({ id: "debug-actor" });
    const document = new FakeDocument();
    const host = new FakeWindowHost();
    const component = new DebugLogContentComponent(actor, {
      document: document as unknown as Document,
      maxLines: 2
    }, { host });

    expect(host.mounted).toEqual([component.content]);
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
    const host = new FakeWindowHost();
    const component = new DebugLogContentComponent(actor, {
      document: document as unknown as Document
    }, { host });

    component.dispose();
    component.dispose();

    expect(component.enabled).toBe(false);
    expect(host.mounted).toEqual([]);
  });

  it("rehosts existing log content without recreating the element or losing text", () => {
    const actor = new ActorSystem().createActor({ id: "debug-actor" });
    const document = new FakeDocument();
    const firstHost = new FakeWindowHost();
    const secondHost = new FakeWindowHost();
    const component = new DebugLogContentComponent(actor, {
      document: document as unknown as Document
    }, { host: firstHost });
    component.append({ type: "hit", message: "preserved", timeStamp: 7 });
    component.updateFrame({ timeMs: 0, deltaMs: 0, frameIndex: 0 });
    const content = component.content;

    component.rehostWindowContent(secondHost);

    expect(component.content).toBe(content);
    expect(component.currentWindowContentHost).toBe(secondHost);
    expect(component.content.textContent).toBe("    7 preserved");
    expect(firstHost.mounted).toEqual([]);
    expect(secondHost.mounted).toEqual([content]);
  });

  it("requires an owning FloatingWindowComponent when added through the registry", () => {
    const { actorSystem, registry } = createRegistry();
    const actor = actorSystem.createActor({ id: "debug-actor" });

    expect(() => registry.addComponent(actor, debugLogContentComponentType, {
      document: new FakeDocument() as unknown as Document
    })).toThrow(/owning FloatingWindowComponent/);
  });

  it("mounts content into the actor-local FloatingWindowComponent through its definition", () => {
    const { actorSystem, registry } = createRegistry();
    const document = new FakeDocument();
    const parent = document.createElement("div");
    const actor = actorSystem.createActor({ id: "debug-actor" });

    registry.addComponent(actor, floatingWindowComponentType, {
      id: "floating-window:debug-log",
      parent: parent as unknown as HTMLElement,
      document: document as unknown as Document,
      title: "Debug Log",
      paths: sceneParameterPaths.debugWindow,
      initialState: createDefaultDebugWindowState()
    });
    const component = registry.addComponent(actor, debugLogContentComponentType, {
      document: document as unknown as Document
    });

    const windowRoot = parent.children[0];
    const contentSlot = windowRoot?.children.find((child) => (
      child.className.split(" ").includes("floating-gizmo-window__content")
    ));

    expect(contentSlot?.children).toEqual([component.content]);
  });
});
