import { describe, expect, it } from "vitest";
import { ActorSystem, type Actor } from "../../actor-runtime";
import {
  parameterPath,
  sceneParameterPaths,
  type ParameterPath,
  type SceneStateChangedEvent,
  type SceneUpdateCommand
} from "../../scene-runtime";
import { createActorInputEndEvent } from "../../test-support";
import type { WindowControlItem, WindowControlSource } from "../../window-runtime";
import { APP_MENU_PRIORITY, AppMenuBarComponent } from "./app-menu-bar-component";

class FakeDocument {
  createElement(tagName: string): FakeElement {
    return new FakeElement(this, tagName);
  }
}

class FakeElement {
  readonly ownerDocument: FakeDocument;
  readonly tagName: string;
  readonly style: Record<string, string> = {};
  readonly children: FakeElement[] = [];
  readonly dataset: Record<string, string> = {};
  readonly attributes = new Map<string, string>();
  className = "";
  textContent = "";
  hidden = false;
  type = "";
  tabIndex = 0;
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
    if (index >= 0) this.parentElement.children.splice(index, 1);
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
}

interface Subject {
  readonly commands: SceneUpdateCommand[];
  readonly component: AppMenuBarComponent;
  readonly focusCalls: string[];
  readonly sceneActor: Actor;
  readonly debugActor: Actor;
  readonly hierarchyActor: Actor;
  readonly items: WindowControlItem[];
  readonly root: FakeElement;
}

interface CreateSubjectOptions {
  readonly initialMode?: "develop" | "run";
  readonly scene?: Partial<WindowItemFixtureOptions>;
  readonly debug?: Partial<WindowItemFixtureOptions>;
  readonly hierarchy?: Partial<WindowItemFixtureOptions>;
}

interface WindowItemFixtureOptions {
  actorId: string;
  label: string;
  visible: boolean;
  activeSelf: boolean;
  activeInHierarchy: boolean;
  canToggle?: boolean;
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

function createSubject(options: CreateSubjectOptions = {}): Subject {
  const actorSystem = new ActorSystem();
  const menuActor = actorSystem.createActor({ id: "app-menu-bar" });
  const sceneActor = actorSystem.createActor({ id: "scene-window", name: "Scene" });
  const debugActor = actorSystem.createActor({ id: "debug-log-window", name: "Debug Log Window" });
  const hierarchyActor = actorSystem.createActor({ id: "hierarchy-panel", name: "Hierarchy Panel" });
  const debugPath = parameterPath<boolean>("debugWindow.visible");
  const hierarchyPath = parameterPath<boolean>("hierarchyWindow.visible");
  const items: WindowControlItem[] = [
    createWindowItem(sceneActor, sceneParameterPaths.sceneWindow.visible, {
      actorId: "scene-window",
      label: "Scene",
      visible: true,
      activeSelf: true,
      activeInHierarchy: true,
      ...options.scene
    }),
    createWindowItem(debugActor, debugPath, {
      actorId: "debug-log-window",
      label: "Debug Log",
      visible: true,
      activeSelf: true,
      activeInHierarchy: true,
      ...options.debug
    }),
    createWindowItem(hierarchyActor, hierarchyPath, {
      actorId: "hierarchy-panel",
      label: "Hierarchy",
      visible: false,
      activeSelf: false,
      activeInHierarchy: false,
      ...options.hierarchy
    })
  ];
  const source: WindowControlSource = {
    listWindows: () => items.map((item) => ({ ...item })),
    findWindowByVisiblePath: (path) => source.listWindows().find((item) => item.visiblePath === path) ?? null
  };
  const document = new FakeDocument();
  const parent = document.createElement("div");
  const commands: SceneUpdateCommand[] = [];
  const focusCalls: string[] = [];
  const component = new AppMenuBarComponent(menuActor, {
    parent: parent as unknown as HTMLElement,
    document: document as unknown as Document,
    windowSource: source,
    initialMode: options.initialMode
  }, {
    commandSink: {
      submit(command) {
        commands.push(command);
      }
    },
    actorWindowFocus: {
      getEffectiveStackPriorityForActor() {
        return null;
      },
      focusActorWindow(actor, reason) {
        focusCalls.push(`focus:${actor.id}:${reason}`);
      },
      requestFocusOnVisible(actor, reason) {
        focusCalls.push(`pending:${actor.id}:${reason}`);
      }
    }
  });
  const root = parent.children[0];
  if (!root) throw new Error("Expected menu root.");
  return { commands, component, focusCalls, sceneActor, debugActor, hierarchyActor, items, root };
}

function createWindowItem(
  actor: Actor,
  visiblePath: ParameterPath<boolean>,
  options: WindowItemFixtureOptions
): WindowControlItem {
  return {
    actor,
    actorId: options.actorId,
    componentId: `floating-window:${options.actorId}`,
    label: options.label,
    order: 0,
    group: null,
    visible: options.visible,
    activeSelf: options.activeSelf,
    activeInHierarchy: options.activeInHierarchy,
    activationMode: "visible",
    canToggle: options.canToggle ?? true,
    visiblePath
  };
}

function menuButton(root: FakeElement): FakeElement {
  return root.children[0];
}

function menu(root: FakeElement): FakeElement {
  return root.children[1];
}

function rows(root: FakeElement): FakeElement[] {
  return menu(root).children;
}

function hasClass(element: FakeElement, className: string): boolean {
  return element.className.split(" ").includes(className);
}

function childByClass(element: FakeElement, className: string): FakeElement {
  const child = element.children.find((candidate) => hasClass(candidate, className));
  if (!child) {
    throw new Error(`Expected child with class: ${className}`);
  }
  return child;
}

function labelText(row: FakeElement): string {
  return childByClass(row, "app-menu-bar__menu-item-label").textContent;
}

function checkbox(row: FakeElement): FakeElement {
  return childByClass(childByClass(row, "app-menu-bar__menu-item-leading"), "app-menu-bar__checkbox");
}

function setMenuRects(root: FakeElement): void {
  menuButton(root).rect = createRect(720, 10, 70, 26);
  menu(root).rect = createRect(620, 40, 170, 90);
  rows(root)[0].rect = createRect(624, 44, 162, 24);
  rows(root)[1].rect = createRect(624, 70, 162, 24);
  rows(root)[2].rect = createRect(624, 96, 162, 24);
}

function createWorkspaceModeEvent(mode: "develop" | "run"): SceneStateChangedEvent {
  return {
    frame: { timeMs: 0, deltaMs: 0, frameIndex: 0 },
    changes: [{
      path: sceneParameterPaths.workspace.mode,
      previousValue: mode === "run" ? "develop" : "run",
      nextValue: mode,
      sources: [],
      commands: []
    }]
  };
}

describe("AppMenuBarComponent", () => {
  it("renders a develop-mode Window menu with high input priority", () => {
    const { component, root } = createSubject();

    expect(root.className).toBe("app-menu-bar");
    expect(root.hidden).toBe(false);
    expect(root.style.zIndex).toBe(String(APP_MENU_PRIORITY));
    expect(root.getAttribute("role")).toBe("menubar");
    expect(menuButton(root).textContent).toBe("Window");
    expect(menu(root).hidden).toBe(true);
    expect(rows(root).map(labelText)).toEqual(["Scene", "Debug Log", "Hierarchy"]);
    expect(rows(root)[0].dataset).toMatchObject({
      menuItemId: "scene-window",
      itemKind: "window-toggle",
      actorId: "scene-window",
      checked: "true",
      enabled: "true"
    });
    expect(rows(root)[0].getAttribute("aria-checked")).toBe("true");
    expect(hasClass(checkbox(rows(root)[0]), "app-menu-bar__checkbox--checked")).toBe(true);
    expect(rows(root)[1].dataset).toMatchObject({
      menuItemId: "debug-log-window",
      itemKind: "window-toggle",
      actorId: "debug-log-window",
      checked: "true",
      enabled: "true"
    });
    expect(rows(root)[1].getAttribute("aria-checked")).toBe("true");
    expect(hasClass(checkbox(rows(root)[1]), "app-menu-bar__checkbox--checked")).toBe(true);
    expect(rows(root)[2].dataset).toMatchObject({
      menuItemId: "hierarchy-panel",
      itemKind: "window-toggle",
      actorId: "hierarchy-panel",
      checked: "false",
      enabled: "true"
    });
    expect(rows(root)[2].getAttribute("aria-checked")).toBe("false");
    expect(rows(root)[2].getAttribute("aria-disabled")).toBe("false");
    expect(hasClass(rows(root)[2], "is-disabled")).toBe(false);
    expect(hasClass(checkbox(rows(root)[2]), "app-menu-bar__checkbox--checked")).toBe(false);
    expect(component.inputStackPriority).toBe(APP_MENU_PRIORITY);
  });

  it("routes input to the Scene menu row and submits a visibility command", () => {
    const { commands, component, focusCalls, root } = createSubject();
    setMenuRects(root);
    const buttonHit = component.hitTestInput({ x: 735, y: 18 });
    if (!buttonHit) throw new Error("Expected menu button hit.");

    component.onInputEnd(createActorInputEndEvent(buttonHit, { wasClick: true, timeStamp: 10 }));
    expect(menu(root).hidden).toBe(false);
    expect(menuButton(root).getAttribute("aria-expanded")).toBe("true");
    const sceneHit = component.hitTestInput({ x: 640, y: 50 });
    if (!sceneHit) throw new Error("Expected Scene row hit.");
    expect(sceneHit.data).toEqual({ kind: "window-toggle", actorId: "scene-window" });

    component.onInputEnd(createActorInputEndEvent(sceneHit, { wasClick: true, timeStamp: 20 }));

    expect(commands).toMatchObject([{
      source: { id: "app-menu-bar", kind: "gizmo" },
      target: sceneParameterPaths.sceneWindow.visible,
      operation: "set",
      value: false,
      timeStamp: 20
    }]);
    expect(focusCalls).toEqual([]);
    expect(menu(root).hidden).toBe(true);
  });

  it("submits a show command when clicking a hidden window row", () => {
    const { commands, component, focusCalls, root } = createSubject();
    setMenuRects(root);
    const buttonHit = component.hitTestInput({ x: 735, y: 18 });
    if (!buttonHit) throw new Error("Expected menu button hit.");
    component.onInputEnd(createActorInputEndEvent(buttonHit, { wasClick: true }));
    const hierarchyHit = component.hitTestInput({ x: 640, y: 104 });
    if (!hierarchyHit) throw new Error("Expected hierarchy row hit.");

    component.onInputEnd(createActorInputEndEvent(hierarchyHit, { wasClick: true, timeStamp: 24 }));

    expect(focusCalls).toEqual(["pending:hierarchy-panel:menu-restore"]);
    expect(commands).toMatchObject([{
      source: { id: "app-menu-bar", kind: "gizmo" },
      target: parameterPath<boolean>("hierarchyWindow.visible"),
      operation: "set",
      value: true,
      timeStamp: 24
    }]);
  });

  it("treats visible but inactive menu items as activate/show actions", () => {
    const { commands, component, root } = createSubject({
      debug: {
        visible: true,
        activeSelf: false,
        activeInHierarchy: false
      }
    });
    expect(rows(root)[1].getAttribute("aria-checked")).toBe("true");
    expect(rows(root)[1].getAttribute("aria-disabled")).toBe("false");
    expect(hasClass(rows(root)[1], "is-disabled")).toBe(false);
    expect(hasClass(checkbox(rows(root)[1]), "app-menu-bar__checkbox--checked")).toBe(true);
    setMenuRects(root);
    const buttonHit = component.hitTestInput({ x: 735, y: 18 });
    if (!buttonHit) throw new Error("Expected menu button hit.");
    component.onInputEnd(createActorInputEndEvent(buttonHit, { wasClick: true }));
    const debugHit = component.hitTestInput({ x: 640, y: 78 });
    if (!debugHit) throw new Error("Expected debug row hit.");

    component.onInputEnd(createActorInputEndEvent(debugHit, { wasClick: true, timeStamp: 30 }));

    expect(commands[0]).toMatchObject({
      target: parameterPath<boolean>("debugWindow.visible"),
      operation: "set",
      value: true,
      timeStamp: 30
    });
  });

  it("does not submit commands for disabled window menu rows", () => {
    const { commands, component, focusCalls, items, root } = createSubject();
    items[1] = {
      ...items[1],
      canToggle: false
    };
    component.updateFrame();
    expect(rows(root)[1].getAttribute("aria-disabled")).toBe("true");
    expect(rows(root)[1].dataset.enabled).toBe("false");
    expect(hasClass(rows(root)[1], "is-disabled")).toBe(true);
    setMenuRects(root);
    const buttonHit = component.hitTestInput({ x: 735, y: 18 });
    if (!buttonHit) throw new Error("Expected menu button hit.");
    component.onInputEnd(createActorInputEndEvent(buttonHit, { wasClick: true }));
    const debugHit = component.hitTestInput({ x: 640, y: 78 });
    if (!debugHit) throw new Error("Expected debug row hit.");

    component.onInputEnd(createActorInputEndEvent(debugHit, { wasClick: true, timeStamp: 36 }));

    expect(commands).toEqual([]);
    expect(focusCalls).toEqual([]);
    expect(menu(root).hidden).toBe(false);
    expect(menuButton(root).getAttribute("aria-expanded")).toBe("true");
  });

  it("hides and stops hit-testing in run mode", () => {
    const { component, root } = createSubject();
    setMenuRects(root);
    component.onSceneStateChanged(createWorkspaceModeEvent("run"));

    expect(root.hidden).toBe(true);
    expect(component.hitTestInput({ x: 735, y: 18 })).toBeNull();

    component.onSceneStateChanged(createWorkspaceModeEvent("develop"));
    expect(root.hidden).toBe(false);
  });
});
