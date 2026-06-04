import { describe, expect, it } from "vitest";
import type { GizmoController } from "gizmo-core";
import { AppRuntimeContext } from "../app-runtime";
import { installCoreComponentDefinitions } from "../component-definitions";
import { installWindowComponentDefinitions } from "../window-runtime";
import { installHierarchyComponentDefinitions } from "./install-component-definitions";
import type {
  RuntimeObject,
  RuntimeRegistration,
  SceneStateObserver,
  SceneUpdateCommand
} from "../scene-runtime";
import { gizmoEventBindingComponentType } from "../gizmo-runtime";
import { stateObserverBindingComponentType } from "../state-runtime";
import { floatingWindowComponentType } from "../window-runtime";
import {
  createActorHierarchyObjectSource,
  createDefaultHierarchyPanelState,
  createHierarchyPanelActor,
  createStaticHierarchyObjectSource,
  hierarchyPanelComponentType
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
  readonly style: Record<string, string> = {};
  readonly children: FakeElement[] = [];
  readonly dataset: Record<string, string> = {};
  readonly classList = new FakeClassList(this);
  readonly attributes = new Map<string, string>();
  readonly listeners = new Map<string, Array<(event: any) => void>>();
  className = "";
  textContent = "";
  hidden = false;
  type = "";
  tabIndex = 0;
  ariaLabel = "";
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

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }

  addEventListener(type: string, listener: (event: any) => void): void {
    const listeners = this.listeners.get(type) ?? [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
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
  const registeredGizmos: GizmoController[] = [];
  const observers: SceneStateObserver[] = [];
  const context = new AppRuntimeContext({
    sceneRuntime: {
      register(object: RuntimeObject): RuntimeRegistration {
        calls.push(`scene-register:${object.id}`);
        return createRegistration(`scene-dispose:${object.id}`, calls);
      },
      dispose(): void {
        calls.push("scene-system-dispose");
      }
    },
    gizmoEventSystem: {
      register(object: GizmoController): RuntimeRegistration {
        calls.push(`gizmo-register:${object.id}`);
        registeredGizmos.push(object);
        return createRegistration(`gizmo-dispose:${object.id}`, calls);
      },
      dispose(): void {
        calls.push("gizmo-system-dispose");
      }
    },
    frameStateController: {
      submit(command: SceneUpdateCommand): void {
        calls.push(`frame-submit:${command.target}`);
      },
      subscribe(observer: SceneStateObserver): RuntimeRegistration {
        calls.push("observer-subscribe");
        observers.push(observer);
        return createRegistration("observer-dispose", calls);
      },
      dispose(): void {
        calls.push("frame-system-dispose");
      }
    }
  });
  installCoreComponentDefinitions(context.componentRegistry);
  installWindowComponentDefinitions(context.componentRegistry);
  installHierarchyComponentDefinitions(context.componentRegistry);
  return { calls, context, observers, registeredGizmos };
}

function createParent() {
  const document = new FakeDocument();
  return {
    document,
    parent: document.createElement("div")
  };
}

function findDescendantByClass(element: FakeElement, className: string): FakeElement | null {
  if (element.className.split(" ").includes(className)) return element;
  for (const child of element.children) {
    const result = findDescendantByClass(child, className);
    if (result) return result;
  }
  return null;
}

function hierarchyRows(parent: FakeElement): FakeElement[] {
  const root = findDescendantByClass(parent, "hierarchy-panel");
  if (!root) throw new Error("Expected hierarchy panel root.");
  return root.children.filter((child) => child.className.includes("hierarchy-panel__row"));
}

describe("createHierarchyPanelActor", () => {
  it("creates a window actor and returns a RegisteredWindowActor handle", () => {
    const { context } = createContext();
    const { document, parent } = createParent();
    const initial = createDefaultHierarchyPanelState();

    const handle = createHierarchyPanelActor(context, {
      actorId: "hierarchy-actor",
      parent: parent as unknown as HTMLElement,
      document: document as unknown as Document,
      initialWindowState: initial.window,
      objectSource: createStaticHierarchyObjectSource([{ id: "camera", label: "Camera3" }])
    });

    expect(handle.actor.id).toBe("hierarchy-actor");
    expect(handle.window.type).toBe(floatingWindowComponentType);
    expect(handle.component.type).toBe(hierarchyPanelComponentType);
    expect(context.actorSystem.getActor("hierarchy-actor")).toBe(handle.actor);
  });

  it("auto-adds actor-level gizmo and state observer bindings once", () => {
    const { calls, context, observers, registeredGizmos } = createContext();
    const { document, parent } = createParent();
    const initial = createDefaultHierarchyPanelState();

    const handle = createHierarchyPanelActor(context, {
      actorId: "hierarchy-actor",
      parent: parent as unknown as HTMLElement,
      document: document as unknown as Document,
      initialWindowState: initial.window,
      objectSource: createStaticHierarchyObjectSource([])
    });

    expect(handle.actor.hasComponent(gizmoEventBindingComponentType)).toBe(true);
    expect(handle.actor.hasComponent(stateObserverBindingComponentType)).toBe(true);
    expect(registeredGizmos).toHaveLength(1);
    expect(observers).toHaveLength(1);
    expect(calls.filter((call) => call.startsWith("gizmo-register:"))).toEqual([
      "gizmo-register:hierarchy-actor:gizmo-event-binding"
    ]);
    expect(calls.filter((call) => call === "observer-subscribe")).toHaveLength(1);
  });

  it("propagates priority to the floating window z-index", () => {
    const { context } = createContext();
    const { document, parent } = createParent();
    const initial = createDefaultHierarchyPanelState();

    const handle = createHierarchyPanelActor(context, {
      parent: parent as unknown as HTMLElement,
      document: document as unknown as Document,
      initialWindowState: initial.window,
      objectSource: createStaticHierarchyObjectSource([]),
      priority: 1234
    });

    expect(handle.window.inputStackPriority).toBe(1234);
    expect(parent.children[0]?.style.zIndex).toBe("1234");
  });

  it("uses a default hierarchy window priority above the debug window layer", () => {
    const { context } = createContext();
    const { document, parent } = createParent();
    const initial = createDefaultHierarchyPanelState();

    const handle = createHierarchyPanelActor(context, {
      parent: parent as unknown as HTMLElement,
      document: document as unknown as Document,
      initialWindowState: initial.window,
      objectSource: createStaticHierarchyObjectSource([])
    });

    expect(handle.window.inputStackPriority).toBe(1100);
    expect(parent.children[0]?.style.zIndex).toBe("1100");
  });

  it("renders the hierarchy actor itself during the initial actor-backed render", () => {
    const { context } = createContext();
    const { document, parent } = createParent();
    const initial = createDefaultHierarchyPanelState();
    context.actorSystem.createActor({ id: "scene-window", name: "Scene" });
    context.actorSystem.createActor({ id: "camera-3", name: "Camera3" });
    context.actorSystem.createActor({ id: "tesseract-4", name: "Tesseract4" });
    context.actorSystem.createActor({ id: "debug-log-window", name: "Debug Log Window" });
    const objectSource = createActorHierarchyObjectSource({
      actorSystem: context.actorSystem,
      metadataByActorId: {
        "scene-window": { order: 0 },
        "tesseract-4": { order: 10 },
        "camera-3": { order: 20 },
        "debug-log-window": { order: 1000 },
        "hierarchy-panel": { order: 1010 }
      }
    });

    createHierarchyPanelActor(context, {
      actorId: "hierarchy-panel",
      actorName: "Hierarchy Panel",
      parent: parent as unknown as HTMLElement,
      document: document as unknown as Document,
      initialWindowState: initial.window,
      objectSource
    });

    expect(hierarchyRows(parent).map((row) => row.textContent)).toEqual([
      "Scene",
      "Tesseract4",
      "Camera3",
      "Debug Log Window",
      "Hierarchy Panel"
    ]);
  });

  it("disposes handle and context-owned actor safely", () => {
    const { calls, context } = createContext();
    const { document, parent } = createParent();
    const initial = createDefaultHierarchyPanelState();
    const handle = createHierarchyPanelActor(context, {
      actorId: "hierarchy-actor",
      parent: parent as unknown as HTMLElement,
      document: document as unknown as Document,
      initialWindowState: initial.window,
      objectSource: createStaticHierarchyObjectSource([])
    });
    calls.length = 0;

    handle.dispose();
    handle.dispose();

    expect(context.actorSystem.getActor("hierarchy-actor")).toBeNull();
    expect(parent.children).toEqual([]);
    expect(calls).toEqual([
      "observer-dispose",
      "gizmo-dispose:hierarchy-actor:gizmo-event-binding"
    ]);
  });

  it("runtime context disposal releases still-live hierarchy panel actor handles", () => {
    const { context } = createContext();
    const { document, parent } = createParent();
    const initial = createDefaultHierarchyPanelState();

    createHierarchyPanelActor(context, {
      actorId: "hierarchy-actor",
      parent: parent as unknown as HTMLElement,
      document: document as unknown as Document,
      initialWindowState: initial.window,
      objectSource: createStaticHierarchyObjectSource([])
    });

    context.dispose();

    expect(context.actorSystem.getActor("hierarchy-actor")).toBeNull();
    expect(parent.children).toEqual([]);
  });

  it("rolls back the actor if the content component cannot be created", () => {
    const { context } = createContext();
    const { document, parent } = createParent();
    const initial = createDefaultHierarchyPanelState();

    expect(() => createHierarchyPanelActor(context, {
      actorId: "hierarchy-actor",
      parent: parent as unknown as HTMLElement,
      document: document as unknown as Document,
      initialWindowState: initial.window,
      objectSource: {
        listObjects() {
          throw new Error("source unavailable");
        }
      }
    })).toThrow(/source unavailable/);

    expect(context.actorSystem.getActor("hierarchy-actor")).toBeNull();
    expect(parent.children).toEqual([]);
  });
});
