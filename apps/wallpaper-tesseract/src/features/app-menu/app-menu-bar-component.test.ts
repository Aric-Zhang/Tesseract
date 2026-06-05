import { describe, expect, it } from "vitest";
import { ActorSystem, type Actor } from "../../actor-runtime";
import { actorInputScopeRoutePriority } from "../../gizmo-runtime";
import {
  parameterPath,
  sceneParameterPaths,
  type ParameterPath,
  type SceneStateChangedEvent,
  type SceneUpdateCommand
} from "../../scene-runtime";
import { createActorInputEndEvent } from "../../test-support";
import {
  WindowViewFactoryRegistry,
  type WindowControlItem,
  type WindowControlSource,
  type WindowFrameIntentSink,
  type WindowViewFactory
} from "../../window-runtime";
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
  readonly frameIntents: string[];
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
  readonly factories?: readonly WindowViewFactory[];
  readonly includeHierarchy?: boolean;
  readonly lifecycleMode?: boolean;
}

interface WindowItemFixtureOptions {
  viewKey?: string;
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
    ...(options.includeHierarchy === false ? [] : [createWindowItem(hierarchyActor, hierarchyPath, {
      actorId: "hierarchy-panel",
      label: "Hierarchy",
      visible: false,
      activeSelf: false,
      activeInHierarchy: false,
      ...options.hierarchy
    })])
  ];
  const source: WindowControlSource = {
    listWindows: () => items.map((item) => ({ ...item })),
    findWindowByViewKey: (viewKey) => source.listWindows().find((item) => item.viewKey === viewKey) ?? null,
    findWindowByVisiblePath: (path) => source.listWindows().find((item) => item.visiblePath === path) ?? null
  };
  const document = new FakeDocument();
  const parent = document.createElement("div");
  const commands: SceneUpdateCommand[] = [];
  const focusCalls: string[] = [];
  const frameIntents: string[] = [];
  const windowViewFactories = options.factories ? new WindowViewFactoryRegistry() : undefined;
  for (const factory of options.factories ?? []) {
    windowViewFactories?.register(factory);
  }
  const windowFrameIntents: WindowFrameIntentSink | undefined = options.lifecycleMode
    ? {
        requestOpenView: (viewKey, reason) => frameIntents.push(`open:${viewKey}:${reason}`),
        requestCloseFrame: (frameId, reason) => frameIntents.push(`close:${frameId}:${reason}`)
      }
    : undefined;
  const component = new AppMenuBarComponent(menuActor, {
    parent: parent as unknown as HTMLElement,
    document: document as unknown as Document,
    windowSource: source,
    windowViewFactories,
    windowFrameIntents,
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
  return { commands, component, focusCalls, frameIntents, sceneActor, debugActor, hierarchyActor, items, root };
}

function createWindowItem(
  actor: Actor,
  visiblePath: ParameterPath<boolean>,
  options: WindowItemFixtureOptions
): WindowControlItem {
  return {
    actor,
    viewKey: options.viewKey ?? options.actorId,
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

function rowByViewKey(root: FakeElement, viewKey: string): FakeElement {
  const row = rows(root).find((candidate) => candidate.dataset.viewKey === viewKey);
  if (!row) {
    throw new Error(`Expected menu row for view key: ${viewKey}`);
  }
  return row;
}

function centerOf(element: FakeElement): { x: number; y: number } {
  const rect = element.getBoundingClientRect();
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2
  };
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
  it("renders ordinary window menu rows as open-view commands with high input priority", () => {
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
      itemKind: "open-view",
      viewKey: "scene-window",
      actorId: "scene-window",
      live: "true",
      enabled: "true"
    });
    expect(rows(root)[0].getAttribute("role")).toBe("menuitem");
    expect(rows(root)[0].getAttribute("aria-checked")).toBeNull();
    expect(childByClass(rows(root)[0], "app-menu-bar__menu-item-leading").children).toEqual([]);
    expect(rows(root)[1].dataset).toMatchObject({
      menuItemId: "debug-log-window",
      itemKind: "open-view",
      viewKey: "debug-log-window",
      actorId: "debug-log-window",
      live: "true",
      enabled: "true"
    });
    expect(rows(root)[1].getAttribute("role")).toBe("menuitem");
    expect(rows(root)[1].getAttribute("aria-checked")).toBeNull();
    expect(rows(root)[2].dataset).toMatchObject({
      menuItemId: "hierarchy-panel",
      itemKind: "open-view",
      viewKey: "hierarchy-panel",
      actorId: "hierarchy-panel",
      live: "true",
      enabled: "true"
    });
    expect(rows(root)[2].getAttribute("role")).toBe("menuitem");
    expect(rows(root)[2].getAttribute("aria-checked")).toBeNull();
    expect(rows(root)[2].getAttribute("aria-disabled")).toBe("false");
    expect(hasClass(rows(root)[2], "is-disabled")).toBe(false);
    expect(component.inputStackPriority).toBe(APP_MENU_PRIORITY);
  });

  it("routes input to a visible Scene menu row and focuses it without hiding", () => {
    const { commands, component, focusCalls, root } = createSubject();
    setMenuRects(root);
    const buttonHit = component.hitTestInput({ x: 735, y: 18 });
    if (!buttonHit) throw new Error("Expected menu button hit.");

    component.onInputEnd(createActorInputEndEvent(buttonHit, { wasClick: true, timeStamp: 10 }));
    expect(menu(root).hidden).toBe(false);
    expect(menuButton(root).getAttribute("aria-expanded")).toBe("true");
    const sceneHit = component.hitTestInput({ x: 640, y: 50 });
    if (!sceneHit) throw new Error("Expected Scene row hit.");
    expect(buttonHit.scopeRoutePriority).toBe(actorInputScopeRoutePriority.appOverlay);
    expect(sceneHit.scopeRoutePriority).toBe(actorInputScopeRoutePriority.appOverlay);
    expect(sceneHit.data).toEqual({
      kind: "open-view",
      viewKey: "scene-window"
    });

    component.onInputEnd(createActorInputEndEvent(sceneHit, { wasClick: true, timeStamp: 20 }));

    expect(commands).toEqual([]);
    expect(focusCalls).toEqual(["focus:scene-window:menu-restore"]);
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
    expect(rows(root)[1].getAttribute("role")).toBe("menuitem");
    expect(rows(root)[1].getAttribute("aria-checked")).toBeNull();
    expect(rows(root)[1].getAttribute("aria-disabled")).toBe("false");
    expect(hasClass(rows(root)[1], "is-disabled")).toBe(false);
    setMenuRects(root);
    const buttonHit = component.hitTestInput({ x: 735, y: 18 });
    if (!buttonHit) throw new Error("Expected menu button hit.");
    component.onInputEnd(createActorInputEndEvent(buttonHit, { wasClick: true }));
    const debugHit = component.hitTestInput(centerOf(rowByViewKey(root, "debug-log-window")));
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
    const debugHit = component.hitTestInput(centerOf(rowByViewKey(root, "debug-log-window")));
    if (!debugHit) throw new Error("Expected debug row hit.");

    component.onInputEnd(createActorInputEndEvent(debugHit, { wasClick: true, timeStamp: 36 }));

    expect(commands).toEqual([]);
    expect(focusCalls).toEqual([]);
    expect(menu(root).hidden).toBe(false);
    expect(menuButton(root).getAttribute("aria-expanded")).toBe("true");
  });

  it("renders missing registered factories as not-live lifecycle open-view rows", () => {
    const { root } = createSubject({
      includeHierarchy: false,
      lifecycleMode: true,
      factories: [
        createWindowFactory("scene-window", "Scene", 0),
        createWindowFactory("debug-log-window", "Debug Log", 10),
        createWindowFactory("hierarchy-panel", "Hierarchy", 20)
      ]
    });

    expect(rows(root).map(labelText)).toEqual(["Scene", "Debug Log", "Hierarchy"]);
    expect(rows(root)[2].dataset).toMatchObject({
      menuItemId: "hierarchy-panel",
      itemKind: "open-view",
      viewKey: "hierarchy-panel",
      live: "false",
      enabled: "true"
    });
    expect(rows(root)[2].dataset.actorId).toBeUndefined();
    expect(rows(root)[2].getAttribute("role")).toBe("menuitem");
    expect(rows(root)[2].getAttribute("aria-checked")).toBeNull();
  });

  it("dispatches lifecycle open intents by view key without submitting visible commands", () => {
    const { commands, component, frameIntents, focusCalls, root } = createSubject({
      includeHierarchy: false,
      lifecycleMode: true,
      factories: [
        createWindowFactory("scene-window", "Scene", 0),
        createWindowFactory("debug-log-window", "Debug Log", 10),
        createWindowFactory("hierarchy-panel", "Hierarchy", 20)
      ]
    });
    setMenuRects(root);
    const buttonHit = component.hitTestInput({ x: 735, y: 18 });
    if (!buttonHit) throw new Error("Expected menu button hit.");
    component.onInputEnd(createActorInputEndEvent(buttonHit, { wasClick: true }));
    const hierarchyHit = component.hitTestInput({ x: 640, y: 104 });
    if (!hierarchyHit) throw new Error("Expected hierarchy row hit.");

    expect(hierarchyHit.data).toEqual({
      kind: "open-view",
      viewKey: "hierarchy-panel"
    });

    component.onInputEnd(createActorInputEndEvent(hierarchyHit, { wasClick: true, timeStamp: 42 }));

    expect(frameIntents).toEqual(["open:hierarchy-panel:menu"]);
    expect(commands).toEqual([]);
    expect(focusCalls).toEqual([]);
    expect(menu(root).hidden).toBe(true);
  });

  it("focuses live lifecycle rows without closing or recreating them", () => {
    const { commands, component, frameIntents, root } = createSubject({
      lifecycleMode: true,
      factories: [
        createWindowFactory("debug-log-window", "Debug Log", 10)
      ]
    });
    setMenuRects(root);
    const buttonHit = component.hitTestInput({ x: 735, y: 18 });
    if (!buttonHit) throw new Error("Expected menu button hit.");
    component.onInputEnd(createActorInputEndEvent(buttonHit, { wasClick: true }));
    const debugHit = component.hitTestInput(centerOf(rowByViewKey(root, "debug-log-window")));
    if (!debugHit) throw new Error("Expected debug row hit.");

    component.onInputEnd(createActorInputEndEvent(debugHit, { wasClick: true, timeStamp: 46 }));

    expect(frameIntents).toEqual(["open:debug-log-window:menu"]);
    expect(commands).toEqual([]);
    expect(menu(root).hidden).toBe(true);
  });

  it("uses live open-view semantics in lifecycle mode without checkbox aria", () => {
    const { root } = createSubject({
      lifecycleMode: true,
      debug: {
        visible: false,
        activeSelf: true,
        activeInHierarchy: true
      },
      factories: [
        createWindowFactory("debug-log-window", "Debug Log", 10)
      ]
    });

    const debugRow = rowByViewKey(root, "debug-log-window");
    expect(debugRow.dataset.live).toBe("true");
    expect(debugRow.dataset.checked).toBeUndefined();
    expect(debugRow.getAttribute("role")).toBe("menuitem");
    expect(debugRow.getAttribute("aria-checked")).toBeNull();
  });

  it("closes the menu through an actor-input dismiss hit outside the menu", () => {
    const { commands, component, frameIntents, root } = createSubject({
      lifecycleMode: true,
      factories: [
        createWindowFactory("debug-log-window", "Debug Log", 10)
      ]
    });
    setMenuRects(root);
    const buttonHit = component.hitTestInput({ x: 735, y: 18 });
    if (!buttonHit) throw new Error("Expected menu button hit.");
    component.onInputEnd(createActorInputEndEvent(buttonHit, { wasClick: true }));

    const dismissHit = component.hitTestInput({ x: 120, y: 150 });
    if (!dismissHit) throw new Error("Expected menu dismiss hit.");

    expect(dismissHit.partId).toBe("menu-dismiss");
    expect(dismissHit.hitPriority).toBeLessThan(60);

    component.onInputEnd(createActorInputEndEvent(dismissHit, { wasClick: true, timeStamp: 50 }));

    expect(menu(root).hidden).toBe(true);
    expect(menuButton(root).getAttribute("aria-expanded")).toBe("false");
    expect(commands).toEqual([]);
    expect(frameIntents).toEqual([]);
    expect(component.hitTestInput({ x: 120, y: 150 })).toBeNull();
  });

  it("keeps the menu open for menu-surface hits and prioritizes rows over dismiss", () => {
    const { component, root } = createSubject();
    setMenuRects(root);
    const buttonHit = component.hitTestInput({ x: 735, y: 18 });
    if (!buttonHit) throw new Error("Expected menu button hit.");
    component.onInputEnd(createActorInputEndEvent(buttonHit, { wasClick: true }));

    const rowHit = component.hitTestInput({ x: 640, y: 78 });
    const surfaceHit = component.hitTestInput({ x: 784, y: 128 });
    if (!rowHit || !surfaceHit) throw new Error("Expected menu row and surface hits.");
    if (rowHit.hitPriority === undefined || surfaceHit.hitPriority === undefined) {
      throw new Error("Expected menu hit priorities.");
    }

    expect(rowHit.partId).toBe("open-view-item");
    expect(rowHit.hitPriority).toBeGreaterThan(surfaceHit.hitPriority);
    expect(surfaceHit.partId).toBe("menu-surface");

    component.onInputEnd(createActorInputEndEvent(surfaceHit, { wasClick: true, timeStamp: 54 }));

    expect(menu(root).hidden).toBe(false);
    expect(menuButton(root).getAttribute("aria-expanded")).toBe("true");
  });

  it("hides and stops hit-testing in run mode", () => {
    const { component, root } = createSubject();
    setMenuRects(root);
    const buttonHit = component.hitTestInput({ x: 735, y: 18 });
    if (!buttonHit) throw new Error("Expected menu button hit.");
    component.onInputEnd(createActorInputEndEvent(buttonHit, { wasClick: true }));
    expect(menu(root).hidden).toBe(false);

    component.onSceneStateChanged(createWorkspaceModeEvent("run"));

    expect(root.hidden).toBe(true);
    expect(component.hitTestInput({ x: 735, y: 18 })).toBeNull();
    expect(component.hitTestInput({ x: 120, y: 150 })).toBeNull();

    component.onSceneStateChanged(createWorkspaceModeEvent("develop"));
    expect(root.hidden).toBe(false);
    expect(menu(root).hidden).toBe(true);
    expect(menuButton(root).getAttribute("aria-expanded")).toBe("false");
  });
});

function createWindowFactory(viewKey: string, label: string, order: number): WindowViewFactory {
  return {
    viewKey,
    label,
    order,
    create: () => {
      throw new Error("not used");
    }
  };
}
