import { describe, expect, it } from "vitest";
import { ActorSystem } from "../actor-runtime";
import { installCoreComponentDefinitions } from "../component-definitions";
import {
  sceneParameterPaths,
  type SceneStateChangedEvent,
  type SceneUpdateCommand,
  vec2
} from "../scene-runtime";
import { createActorInputEndEvent, createTestComponentRegistry } from "../test-support";
import {
  floatingWindowComponentType,
  installWindowComponentDefinitions,
  type FloatingWindowState,
  type WindowContentAttachment,
  type WindowContentAttachmentRequest,
  type WindowContentHost
} from "../window-runtime";
import {
  createStaticHierarchyObjectSource,
  type HierarchyObjectItem,
  type HierarchyObjectSource
} from "./hierarchy-object-source";
import { HierarchyPanelComponent, hierarchyPanelComponentType } from "./hierarchy-panel-component";
import { hierarchyPanelComponentDefinition } from "./hierarchy-panel-definition";

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

  contains(className: string): boolean {
    return this.element.className.split(" ").includes(className);
  }
}

class FakeStyle {
  private readonly values = new Map<string, string>();

  setProperty(name: string, value: string): void {
    this.values.set(name, value);
  }

  getPropertyValue(name: string): string {
    return this.values.get(name) ?? "";
  }
}

class FakeElement {
  readonly ownerDocument: FakeDocument;
  readonly tagName: string;
  readonly style = new FakeStyle();
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
  rect: DOMRectReadOnly = createRect(0, 0, 0, 0);
  replaceChildrenCount = 0;

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
    this.replaceChildrenCount += 1;
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
    return this.rect;
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }

  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }

  addEventListener(type: string, listener: (event: any) => void): void {
    const listeners = this.listeners.get(type) ?? [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  dispatchKey(key: string): { defaultPrevented: boolean } {
    const event = {
      key,
      currentTarget: this,
      timeStamp: 42,
      defaultPrevented: false,
      preventDefault() {
        this.defaultPrevented = true;
      }
    };
    for (const listener of this.listeners.get("keydown") ?? []) {
      listener(event);
    }
    return event;
  }
}

class FakeWindowHost implements WindowContentHost {
  readonly id = "floating-window:hierarchy";
  readonly inputStackPriority = 1100;
  readonly state: FloatingWindowState = {
    position: vec2(0, 0),
    size: vec2(280, 360),
    visible: true
  };
  mounted: HTMLElement[] = [];
  contentInteractable = true;

  setTitle(): void {}

  getBounds(): DOMRectReadOnly {
    return createRect(0, 0, 280, 360);
  }

  isContentInteractable(element: HTMLElement): boolean {
    return this.contentInteractable && this.mounted.includes(element);
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

  requestVisible(): void {}
}

function isWindowContentAttachmentRequest(
  request: HTMLElement | WindowContentAttachmentRequest
): request is WindowContentAttachmentRequest {
  return typeof request === "object" && request !== null && "element" in request;
}

function createRect(x: number, y: number, width: number, height: number): DOMRectReadOnly {
  return {
    x,
    y,
    width,
    height,
    top: y,
    left: x,
    right: x + width,
    bottom: y + height,
    toJSON() {
      return this;
    }
  };
}

function createSubject(options: {
  commands?: SceneUpdateCommand[];
  items?: HierarchyObjectItem[];
  objectSource?: HierarchyObjectSource;
} = {}) {
  const actor = new ActorSystem().createActor({ id: "hierarchy-actor" });
  const document = new FakeDocument();
  const host = new FakeWindowHost();
  const commands = options.commands ?? [];
  const component = new HierarchyPanelComponent(actor, {
    document: document as unknown as Document,
    objectSource: options.objectSource ?? createStaticHierarchyObjectSource(options.items ?? [
      { id: "tesseract", label: "Tesseract4" },
      { id: "camera", label: "Camera3" }
    ])
  }, {
    host,
    commandSink: {
      submit(command) {
        commands.push(command);
      }
    }
  });
  const root = host.mounted[0] as unknown as FakeElement;
  if (!root) throw new Error("Expected mounted hierarchy root.");
  return { actor, commands, component, document, host, root };
}

function createChangedEvent(activeObject: string | null): SceneStateChangedEvent {
  return {
    frame: { timeMs: 0, deltaMs: 0, frameIndex: 0 },
    changes: [{
      path: sceneParameterPaths.selection.activeObject,
      previousValue: null,
      nextValue: activeObject,
      sources: [],
      commands: []
    }]
  };
}

function rows(root: FakeElement): FakeElement[] {
  return root.children.filter((child) => child.className.includes("hierarchy-panel__row"));
}

describe("HierarchyPanelComponent", () => {
  it("renders object rows inside the floating window content host", () => {
    const { root } = createSubject();

    expect(root.className).toBe("hierarchy-panel");
    expect(root.getAttribute("role")).toBe("tree");
    expect(rows(root).map((row) => row.textContent)).toEqual(["Tesseract4", "Camera3"]);
    expect(rows(root).map((row) => row.getAttribute("role"))).toEqual(["treeitem", "treeitem"]);
  });

  it("renders parent metadata for tree verification", () => {
    const { root } = createSubject({
      items: [
        { id: "scene-window", label: "Scene" },
        { id: "camera-3", label: "Camera3", parentId: "scene-window" },
        { id: "axis-x", label: "Axis X", parentId: "camera-3" }
      ]
    });

    const [sceneRow, cameraRow, axisRow] = rows(root);
    expect(sceneRow.dataset.parentId).toBeUndefined();
    expect(sceneRow.getAttribute("aria-level")).toBe("1");
    expect(sceneRow.style.getPropertyValue("--hierarchy-indent")).toBe("0px");
    expect(cameraRow.dataset.parentId).toBe("scene-window");
    expect(cameraRow.getAttribute("aria-level")).toBe("2");
    expect(cameraRow.style.getPropertyValue("--hierarchy-indent")).toBe("14px");
    expect(axisRow.dataset.parentId).toBe("camera-3");
    expect(axisRow.getAttribute("aria-level")).toBe("3");
    expect(axisRow.style.getPropertyValue("--hierarchy-indent")).toBe("28px");
  });

  it("renders inactive object state for hierarchy rows", () => {
    const { root } = createSubject({
      items: [
        { id: "scene-window", label: "Scene", activeSelf: false, activeInHierarchy: false },
        {
          id: "camera-3",
          label: "Camera3",
          parentId: "scene-window",
          activeInHierarchy: false
        }
      ]
    });

    const [sceneRow, cameraRow] = rows(root);
    expect(sceneRow.dataset.activeSelf).toBe("false");
    expect(sceneRow.dataset.activeInHierarchy).toBe("false");
    expect(sceneRow.getAttribute("aria-disabled")).toBe("true");
    expect(sceneRow.classList.contains("is-inactive")).toBe(true);
    expect(cameraRow.dataset.activeSelf).toBe("true");
    expect(cameraRow.dataset.activeInHierarchy).toBe("false");
    expect(cameraRow.getAttribute("aria-disabled")).toBe("true");
    expect(cameraRow.classList.contains("is-inactive")).toBe(true);
  });

  it("renders an empty state when the source has no objects", () => {
    const { root } = createSubject({ items: [] });

    expect(root.children).toHaveLength(1);
    expect(root.children[0].className).toBe("hierarchy-panel__empty");
    expect(root.children[0].textContent).toBe("No objects");
  });

  it("updates row selection from scene state without submitting commands", () => {
    const commands: SceneUpdateCommand[] = [];
    const { component, root } = createSubject({ commands });
    const cameraRow = rows(root)[1];

    component.onStateChanged(createChangedEvent("camera"));

    expect(cameraRow.getAttribute("aria-selected")).toBe("true");
    expect(cameraRow.classList.contains("is-selected")).toBe(true);
    expect(commands).toEqual([]);
  });

  it("does not rebuild rows on update when the source list is unchanged", () => {
    const { component, root } = createSubject();
    const firstRows = rows(root);
    const replaceCount = root.replaceChildrenCount;

    component.updateFrame();

    expect(root.replaceChildrenCount).toBe(replaceCount);
    expect(rows(root)).toEqual(firstRows);
  });

  it("rebuilds rows on update when the source list changes", () => {
    const items = [
      { id: "scene-window", label: "Scene" }
    ];
    const { component, root } = createSubject({
      objectSource: {
        listObjects: () => items.map((item) => ({ ...item }))
      }
    });
    const replaceCount = root.replaceChildrenCount;

    items.push({ id: "camera-3", label: "Camera3" });
    component.updateFrame();

    expect(root.replaceChildrenCount).toBe(replaceCount + 1);
    expect(rows(root).map((row) => row.textContent)).toEqual(["Scene", "Camera3"]);
  });

  it("rebuilds rows when active state changes even if id and label are stable", () => {
    const items: HierarchyObjectItem[] = [
      { id: "debug-log-window", label: "Debug Log Window" }
    ];
    const { component, root } = createSubject({
      objectSource: {
        listObjects: () => items.map((item) => ({ ...item }))
      }
    });
    const replaceCount = root.replaceChildrenCount;

    items[0] = {
      ...items[0],
      activeSelf: false,
      activeInHierarchy: false
    };
    component.updateFrame();

    expect(root.replaceChildrenCount).toBe(replaceCount + 1);
    expect(rows(root)[0].classList.contains("is-inactive")).toBe(true);
  });

  it("leaves all rows unselected when selection points to a missing object", () => {
    const { component, root } = createSubject();

    component.onStateChanged(createChangedEvent("missing-actor"));
    component.updateFrame();

    expect(rows(root).map((row) => row.getAttribute("aria-selected"))).toEqual(["false", "false"]);
    expect(rows(root).some((row) => row.classList.contains("is-selected"))).toBe(false);
  });

  it("hit-tests visible rows using current DOM rects", () => {
    const { component, root } = createSubject();
    const [firstRow, secondRow] = rows(root);
    root.rect = createRect(0, 0, 200, 60);
    firstRow.rect = createRect(0, -30, 200, 24);
    secondRow.rect = createRect(0, 10, 200, 24);

    expect(component.hitTestInput({ x: 10, y: 10 })).toMatchObject({
      componentId: "hierarchy-panel",
      partId: "row",
      kind: "control",
      region: "content-control",
      localRoutePriority: 2000,
      hitPriority: 1,
      path: [
        { componentId: "floating-window:hierarchy", role: "surface" },
        { componentId: "hierarchy-panel", role: "container" },
        { componentId: "hierarchy-panel", role: "control", partId: "row" }
      ],
      data: { objectId: "camera" }
    });
    expect(component.inputStackPriority).toBe(1100);
    expect(component.inputPriority).toBe(900);
    expect(component.hitTestInput({ x: 10, y: -20 })).toBeNull();
  });

  it("does not hit-test rows when hosted content is not interactable", () => {
    const { component, host, root } = createSubject();
    const [firstRow] = rows(root);
    root.rect = createRect(0, 0, 200, 60);
    firstRow.rect = createRect(0, 0, 200, 24);

    expect(component.hitTestInput({ x: 10, y: 10 })?.partId).toBe("row");

    host.contentInteractable = false;

    expect(component.hitTestInput({ x: 10, y: 10 })).toBeNull();
  });

  it("rehosts the hierarchy root and routes hit testing through the new host", () => {
    const { component, host, root } = createSubject();
    const nextHost = new FakeWindowHost();
    const [firstRow] = rows(root);
    root.rect = createRect(0, 0, 200, 60);
    firstRow.rect = createRect(0, 0, 200, 24);

    component.rehostWindowContent(nextHost);

    expect(component.currentWindowContentHost).toBe(nextHost);
    expect(host.mounted).toEqual([]);
    expect(nextHost.mounted).toEqual([root]);
    expect(component.hitTestInput({ x: 10, y: 10 })?.partId).toBe("row");

    nextHost.contentInteractable = false;

    expect(component.hitTestInput({ x: 10, y: 10 })).toBeNull();
  });

  it("submits selection commands through gizmo click and keyboard activation", () => {
    const commands: SceneUpdateCommand[] = [];
    const { component, root } = createSubject({ commands });
    const [firstRow, secondRow] = rows(root);
    root.rect = createRect(0, 0, 200, 80);
    firstRow.rect = createRect(0, 0, 200, 24);
    secondRow.rect = createRect(0, 26, 200, 24);
    const hit = component.hitTestInput({ x: 10, y: 8 });
    if (!hit) throw new Error("Expected row hit.");

    component.onInputEnd(createActorInputEndEvent(hit, { timeStamp: 33 }));
    const keyEvent = secondRow.dispatchKey("Enter");

    expect(keyEvent.defaultPrevented).toBe(true);
    expect(commands).toEqual([
      {
        source: { id: "hierarchy-panel", kind: "gizmo" },
        target: sceneParameterPaths.selection.activeObject,
        operation: "set",
        value: "tesseract",
        timeStamp: 33
      },
      {
        source: { id: "hierarchy-panel", kind: "keyboard" },
        target: sceneParameterPaths.selection.activeObject,
        operation: "set",
        value: "camera",
        timeStamp: 42
      }
    ]);
    expect(secondRow.classList.contains("is-selected")).toBe(false);
  });

  it("selects tool window rows without submitting window state commands", () => {
    const commands: SceneUpdateCommand[] = [];
    const { component, root } = createSubject({
      commands,
      items: [
        { id: "debug-log-window", label: "Debug Log Window" },
        { id: "hierarchy-panel", label: "Hierarchy Panel" }
      ]
    });
    const [debugRow, hierarchyRow] = rows(root);
    root.rect = createRect(0, 0, 240, 80);
    debugRow.rect = createRect(0, 0, 240, 24);
    hierarchyRow.rect = createRect(0, 26, 240, 24);
    const hit = component.hitTestInput({ x: 10, y: 34 });
    if (!hit) throw new Error("Expected tool window row hit.");

    component.onInputEnd(createActorInputEndEvent(hit, { timeStamp: 44 }));

    expect(commands).toEqual([{
      source: { id: "hierarchy-panel", kind: "gizmo" },
      target: sceneParameterPaths.selection.activeObject,
      operation: "set",
      value: "hierarchy-panel",
      timeStamp: 44
    }]);
    expect(commands.some((command) => command.target === sceneParameterPaths.debugWindow.visible)).toBe(false);
    expect(commands.some((command) => command.target === sceneParameterPaths.hierarchyWindow.visible)).toBe(false);
  });

  it("disposes mounted content through the host attachment", () => {
    const { component, host } = createSubject();

    component.dispose();
    component.dispose();

    expect(component.enabled).toBe(false);
    expect(host.mounted).toEqual([]);
  });
});

describe("HierarchyPanelComponent definition", () => {
  it("requires an owning FloatingWindowComponent", () => {
    const actorSystem = new ActorSystem();
    const { registry } = createTestComponentRegistry({ actorSystem });
    installCoreComponentDefinitions(registry);
    installWindowComponentDefinitions(registry);
    registry.registerDefinition(hierarchyPanelComponentDefinition);
    const actor = actorSystem.createActor({ id: "hierarchy-actor" });

    expect(() => registry.addComponent(actor, hierarchyPanelComponentType, {
      document: new FakeDocument() as unknown as Document,
      objectSource: createStaticHierarchyObjectSource([])
    })).toThrow(/owning FloatingWindowComponent/);
  });

  it("creates and mounts when the actor has a FloatingWindowComponent", () => {
    const actorSystem = new ActorSystem();
    const { registry } = createTestComponentRegistry({ actorSystem });
    installCoreComponentDefinitions(registry);
    installWindowComponentDefinitions(registry);
    registry.registerDefinition(hierarchyPanelComponentDefinition);
    const document = new FakeDocument();
    const parent = document.createElement("div");
    const actor = actorSystem.createActor({ id: "hierarchy-actor" });

    registry.addComponent(actor, floatingWindowComponentType, {
      id: "floating-window:hierarchy",
      parent: parent as unknown as HTMLElement,
      document: document as unknown as Document,
      title: "Hierarchy",
      paths: sceneParameterPaths.hierarchyWindow,
      initialState: {
        position: vec2(14, 14),
        size: vec2(280, 360),
        visible: true
      }
    });
    const component = registry.addComponent(actor, hierarchyPanelComponentType, {
      document: document as unknown as Document,
      objectSource: createStaticHierarchyObjectSource([{ id: "camera", label: "Camera3" }])
    });

    expect(component.type).toBe(hierarchyPanelComponentType);
    expect(actor.hasComponent(hierarchyPanelComponentType)).toBe(true);
  });
});
