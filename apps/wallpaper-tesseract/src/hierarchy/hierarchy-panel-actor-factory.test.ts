import { describe, expect, it } from "vitest";
import { AppRuntimeContext } from "../app-runtime";
import { installGizmoRuntimeComponentDefinitions } from "../gizmo-runtime";
import type { RuntimeRegistration } from "../runtime/ports";
import { installStateRuntimeComponentDefinitions } from "../state-runtime";
import type {
  WindowContentRegistrationPort,
  WindowRegisteredContent
} from "../window-runtime";
import {
  createHierarchyPanelViewActor,
  createStaticHierarchyObjectSource,
  hierarchyPanelComponentType,
  installHierarchyComponentDefinitions
} from "./index";

class FakeDocument {
  createElement(tagName: string): FakeElement {
    return new FakeElement(this, tagName);
  }
}

class FakeClassList {
  constructor(private readonly element: FakeElement) {}

  toggle(className: string, enabled: boolean): void {
    const classes = new Set(this.element.className.split(" ").filter(Boolean));
    if (enabled) {
      classes.add(className);
    } else {
      classes.delete(className);
    }
    this.element.className = [...classes].join(" ");
  }
}

class FakeElement {
  readonly ownerDocument: FakeDocument;
  readonly tagName: string;
  readonly children: FakeElement[] = [];
  readonly dataset: Record<string, string> = {};
  readonly style = {
    setProperty(name: string, value: string): void {
      Object.assign(this, { [name]: value });
    }
  } as CSSStyleDeclaration;
  readonly classList = new FakeClassList(this);
  readonly attributes = new Map<string, string>();
  readonly listeners = new Map<string, Array<(event: Event) => void>>();
  className = "";
  textContent = "";
  type = "";
  tabIndex = 0;
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

  replaceChildren(...children: FakeElement[]): void {
    for (const child of this.children) {
      child.parentElement = null;
    }
    this.children.length = 0;
    this.append(...children);
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }

  addEventListener(type: string, listener: (event: Event) => void): void {
    const listeners = this.listeners.get(type) ?? [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
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

function createRegistration(label: string, calls: string[]): RuntimeRegistration {
  return {
    dispose() {
      calls.push(label);
    }
  };
}

function createContext() {
  const calls: string[] = [];
  const context = new AppRuntimeContext({
    gizmoEventSystem: {
      register(object) {
        calls.push(`gizmo-register:${object.id}`);
        return createRegistration(`gizmo-dispose:${object.id}`, calls);
      },
      dispose() {
        calls.push("gizmo-system-dispose");
      }
    },
    frameStateController: {
      submit(command) {
        calls.push(`state-submit:${command.target}`);
      },
      subscribe(_observer) {
        calls.push("observer-subscribe");
        return createRegistration("observer-dispose", calls);
      },
      dispose() {
        calls.push("frame-system-dispose");
      }
    }
  });
  installGizmoRuntimeComponentDefinitions(context.componentRegistry);
  installStateRuntimeComponentDefinitions(context.componentRegistry);
  installHierarchyComponentDefinitions(context.componentRegistry);
  return { calls, context };
}

function createContentRegistration(calls: string[]): WindowContentRegistrationPort {
  const registered = new Map<string, WindowRegisteredContent>();
  return {
    getRegisteredContent(contentId): WindowRegisteredContent | null {
      return registered.get(contentId) ?? null;
    },
    registerContent(request): WindowRegisteredContent {
      calls.push(`register:${request.contentId}`);
      const content: WindowRegisteredContent = {
        contentId: request.contentId,
        element: request.element,
        interactable: request.interactable ?? true,
        inputStackPriority: 42,
        setInteractable() {},
        subscribeLayoutCommit() {
          return createRegistration("layout-dispose", calls);
        },
        dispose() {
          calls.push(`content-dispose:${request.contentId}`);
        }
      };
      registered.set(request.contentId, content);
      return content;
    }
  };
}

function rowLabels(root: HTMLElement): readonly string[] {
  return [...(root as unknown as FakeElement).children]
    .filter((child) => child.className.includes("hierarchy-panel__row"))
    .map((child) => child.textContent);
}

describe("createHierarchyPanelViewActor", () => {
  it("creates a registered hierarchy content view under the supplied frame actor", () => {
    const { calls, context } = createContext();
    const parentActor = context.actorSystem.createActor({ id: "hierarchy-frame" });

    const handle = createHierarchyPanelViewActor(context, {
      actorId: "hierarchy-view",
      parentActor,
      document: new FakeDocument() as unknown as Document,
      contentId: "content:hierarchy",
      contentRegistration: createContentRegistration(calls),
      objectSource: createStaticHierarchyObjectSource([
        { id: "scene", label: "Scene" },
        { id: "camera", label: "Camera", parentId: "scene" }
      ])
    });

    expect(handle.actor.id).toBe("hierarchy-view");
    expect(context.actorSystem.getParent(handle.actor)).toBe(parentActor);
    expect(handle.component.type).toBe(hierarchyPanelComponentType);
    expect(handle.component.contentId).toBe("content:hierarchy");
    expect(rowLabels(handle.component.element)).toEqual(["Scene", "Camera"]);
    expect(calls).toEqual([
      "gizmo-register:hierarchy-view:gizmo-event-binding",
      "observer-subscribe",
      "register:content:hierarchy"
    ]);
  });

  it("disposes runtime tracking independently from the view actor tree", () => {
    const { calls, context } = createContext();
    const parentActor = context.actorSystem.createActor({ id: "hierarchy-frame" });
    const handle = createHierarchyPanelViewActor(context, {
      actorId: "hierarchy-view",
      parentActor,
      document: new FakeDocument() as unknown as Document,
      contentId: "content:hierarchy",
      contentRegistration: createContentRegistration(calls),
      objectSource: createStaticHierarchyObjectSource([])
    });

    handle.disposeRuntimeTracking?.();
    handle.disposeRuntimeTracking?.();

    expect(context.actorSystem.getActor("hierarchy-view")).toBe(handle.actor);
    expect(calls).toEqual([
      "gizmo-register:hierarchy-view:gizmo-event-binding",
      "observer-subscribe",
      "register:content:hierarchy"
    ]);
  });

  it("disposes the view actor and registered content through the handle", () => {
    const { calls, context } = createContext();
    const parentActor = context.actorSystem.createActor({ id: "hierarchy-frame" });
    const handle = createHierarchyPanelViewActor(context, {
      actorId: "hierarchy-view",
      parentActor,
      document: new FakeDocument() as unknown as Document,
      contentId: "content:hierarchy",
      contentRegistration: createContentRegistration(calls),
      objectSource: createStaticHierarchyObjectSource([])
    });
    calls.length = 0;

    handle.dispose();
    handle.dispose();

    expect(context.actorSystem.getActor("hierarchy-view")).toBeNull();
    expect(calls).toEqual([
      "content-dispose:content:hierarchy",
      "observer-dispose",
      "gizmo-dispose:hierarchy-view:gizmo-event-binding"
    ]);
  });
});
