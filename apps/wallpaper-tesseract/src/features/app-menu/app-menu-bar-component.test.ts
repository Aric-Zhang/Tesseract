import { describe, expect, it } from "vitest";
import { ActorSystem } from "../../actor-runtime";
import { actorInputScopeRoutePriority } from "../../gizmo-runtime";
import {
  sceneParameterPaths,
  type SceneStateChangedEvent
} from "../../scene-runtime";
import { createActorInputEndEvent } from "../../test-support";
import {
  createWindowViewIdentity,
  createSingletonWindowViewIdentity,
  windowViewInstanceId,
  windowViewTypeKey,
  type WindowFrameIntentSink,
  type WindowViewMultiplicity,
  type WindowViewKey,
  type WindowViewTypeKey,
  type WindowWorkspaceViewCatalog,
  type WindowWorkspaceViewEntry
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
  readonly listeners = new Map<string, Array<(event: FakeKeyboardEvent) => void>>();
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

  addEventListener(type: string, listener: (event: FakeKeyboardEvent) => void): void {
    const listeners = this.listeners.get(type) ?? [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type: string, listener: (event: FakeKeyboardEvent) => void): void {
    const listeners = this.listeners.get(type) ?? [];
    this.listeners.set(type, listeners.filter((candidate) => candidate !== listener));
  }

  dispatchKeyDown(key: string, timeStamp = 0): FakeKeyboardEvent {
    const event = new FakeKeyboardEvent(key, timeStamp);
    for (const listener of this.listeners.get("keydown") ?? []) {
      listener(event);
    }
    return event;
  }
}

class FakeKeyboardEvent {
  defaultPrevented = false;

  constructor(
    readonly key: string,
    readonly timeStamp: number
  ) {}

  preventDefault(): void {
    this.defaultPrevented = true;
  }
}

interface Subject {
  readonly component: AppMenuBarComponent;
  readonly entries: WindowWorkspaceViewEntry[];
  readonly frameIntents: string[];
  readonly root: FakeElement;
}

interface CreateSubjectOptions {
  readonly initialMode?: "develop" | "run";
  readonly entries?: readonly WindowWorkspaceViewEntry[];
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
  const entries = [...(options.entries ?? [
    createViewEntry({ viewKey: "scene", viewActorId: "scene-view", label: "Scene", order: 0 }),
    createViewEntry({ viewKey: "debug", viewActorId: "debug-view", label: "Debug Log", order: 10 }),
    createViewEntry({ viewKey: "hierarchy", viewActorId: null, label: "Hierarchy", order: 20, live: false })
  ])];
  const catalog = createFakeCatalog(entries);
  const document = new FakeDocument();
  const parent = document.createElement("div");
  const frameIntents: string[] = [];
  const windowFrameIntents: WindowFrameIntentSink = {
    requestOpenView: (viewKey, reason) => frameIntents.push(`open:${viewKey}:${reason}`),
    requestCloseFrame: (frameId, reason) => frameIntents.push(`close-frame:${frameId}:${reason}`),
    requestCloseView: (viewActorId, reason) => frameIntents.push(`close-view:${viewActorId}:${reason}`),
    requestActivateFrameTab: (frameId, viewActorId, reason) => (
      frameIntents.push(`activate:${frameId}:${viewActorId}:${reason}`)
    ),
    requestCommitDock: () => frameIntents.push("commit-dock"),
    requestOpenOrFocusViewType: (typeKey, reason) => frameIntents.push(`open-type:${typeKey}:${reason}`),
    requestCreateViewInstance: (typeKey, reason) => frameIntents.push(`new-instance:${typeKey}:${reason}`),
    requestFocusViewInstance: (identity, reason) => frameIntents.push(`focus-instance:${identity.instanceId}:${reason}`)
  };

  const component = new AppMenuBarComponent(menuActor, {
    parent: parent as unknown as HTMLElement,
    document: document as unknown as Document,
    windowCatalog: catalog,
    windowFrameIntents,
    workspaceModePath: sceneParameterPaths.workspace.mode,
    initialMode: options.initialMode
  }, {});
  const root = parent.children[0];
  if (!root) throw new Error("Expected menu root.");
  return { component, entries, frameIntents, root };
}

function createFakeCatalog(entries: readonly WindowWorkspaceViewEntry[]): WindowWorkspaceViewCatalog {
  return {
    listViewEntries: () => entries.map((entry) => ({ ...entry })),
    getViewEntryByIdentity: (identity) => (
      entries.find((entry) => entry.identity.viewKey === identity.viewKey) ?? null
    ),
    getViewEntryByActorId: (viewActorId) => (
      entries.find((entry) => entry.viewActorId === viewActorId) ?? null
    ),
    listFrameEntries: () => []
  };
}

function createViewEntry(options: {
  readonly viewKey: WindowViewKey;
  readonly viewActorId: string | null;
  readonly label: string;
  readonly order: number;
  readonly sourceIndex?: number;
  readonly enabled?: boolean;
  readonly live?: boolean;
  readonly typeKey?: WindowViewTypeKey;
  readonly instanceId?: string;
  readonly multiplicity?: WindowViewMultiplicity;
  readonly activationSequence?: number;
}): WindowWorkspaceViewEntry {
  const typeKey = options.typeKey ?? windowViewTypeKey(options.viewKey);
  const instanceId = options.instanceId ? windowViewInstanceId(options.instanceId) : undefined;
  return {
    identity: options.typeKey || instanceId || options.multiplicity
      ? createWindowViewIdentity({
          viewKey: options.viewKey,
          typeKey,
          instanceId,
          multiplicity: options.multiplicity
        })
      : createSingletonWindowViewIdentity(options.viewKey),
    viewKey: options.viewKey,
    viewActorId: options.viewActorId,
    ownerFrameActorId: options.viewActorId ? `${options.viewKey}-frame` : null,
    label: options.label,
    order: options.order,
    sourceIndex: options.sourceIndex ?? options.order,
    group: null,
    enabled: options.enabled ?? true,
    live: options.live ?? true,
    activeInFrame: true,
    visibleInFrame: true,
    ownerFrameVisible: true,
    ownerFrameActiveInHierarchy: true,
    presentation: options.live === false ? null : "windowed",
    activationSequence: options.activationSequence ?? 0
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
  it("renders catalog view rows as open-view commands with high input priority", () => {
    const { component, root } = createSubject();

    expect(root.className).toBe("app-menu-bar");
    expect(root.hidden).toBe(false);
    expect(root.style.zIndex).toBe(String(APP_MENU_PRIORITY));
    expect(root.getAttribute("role")).toBe("menubar");
    expect(menuButton(root).textContent).toBe("Window");
    expect(menu(root).hidden).toBe(true);
    expect(rows(root).map(labelText)).toEqual(["Scene", "Debug Log", "Hierarchy"]);
    expect(rows(root)[0].dataset).toMatchObject({
      menuItemId: "type:scene",
      itemKind: "window-command",
      actionKind: "open-or-focus-type",
      typeKey: "scene",
      viewKey: "scene",
      actorId: "scene-view",
      live: "true",
      enabled: "true"
    });
    expect(rows(root)[0].getAttribute("role")).toBe("menuitem");
    expect(rows(root)[0].getAttribute("aria-checked")).toBeNull();
    expect(childByClass(rows(root)[0], "app-menu-bar__menu-item-leading").children).toEqual([]);
    expect(rows(root)[2].dataset).toMatchObject({
      menuItemId: "type:hierarchy",
      itemKind: "window-command",
      actionKind: "open-or-focus-type",
      typeKey: "hierarchy",
      viewKey: "hierarchy",
      live: "false",
      enabled: "true"
    });
    expect(rows(root)[2].dataset.actorId).toBeUndefined();
    expect(component.inputStackPriority).toBe(APP_MENU_PRIORITY);
  });

  it("routes actor input to open-or-focus type intent", () => {
    const { component, frameIntents, root } = createSubject();
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
      kind: "window-command",
      action: { kind: "open-or-focus-type", typeKey: "scene" }
    });

    component.onInputEnd(createActorInputEndEvent(sceneHit, { wasClick: true, timeStamp: 20 }));

    expect(frameIntents).toEqual(["open-type:scene:menu"]);
    expect(menu(root).hidden).toBe(true);
  });

  it("does not submit intents for disabled view rows", () => {
    const { component, entries, frameIntents, root } = createSubject();
    entries[1] = {
      ...entries[1],
      enabled: false
    };
    component.updateFrame();
    expect(rows(root)[1].getAttribute("aria-disabled")).toBe("true");
    expect(rows(root)[1].dataset.enabled).toBe("false");
    expect(hasClass(rows(root)[1], "is-disabled")).toBe(true);
    setMenuRects(root);
    const buttonHit = component.hitTestInput({ x: 735, y: 18 });
    if (!buttonHit) throw new Error("Expected menu button hit.");
    component.onInputEnd(createActorInputEndEvent(buttonHit, { wasClick: true }));
    const debugHit = component.hitTestInput(centerOf(rowByViewKey(root, "debug")));
    if (!debugHit) throw new Error("Expected debug row hit.");

    component.onInputEnd(createActorInputEndEvent(debugHit, { wasClick: true, timeStamp: 36 }));

    expect(frameIntents).toEqual([]);
    expect(menu(root).hidden).toBe(false);
    expect(menuButton(root).getAttribute("aria-expanded")).toBe("true");
  });

  it("closes the menu through an actor-input dismiss hit outside the menu", () => {
    const { component, frameIntents, root } = createSubject();
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
    expect(frameIntents).toEqual([]);
    expect(component.hitTestInput({ x: 120, y: 150 })).toBeNull();
  });

  it("rerenders when the representative live instance changes for a type row", () => {
    const inspectorType = windowViewTypeKey("inspector");
    const entries = [
      createViewEntry({
        viewKey: "inspector:a",
        typeKey: inspectorType,
        instanceId: "inspector:a",
        multiplicity: "multi-instance",
        viewActorId: "inspector-a-view",
        label: "Inspector",
        order: 30,
        activationSequence: 1
      }),
      createViewEntry({
        viewKey: "inspector:b",
        typeKey: inspectorType,
        instanceId: "inspector:b",
        multiplicity: "multi-instance",
        viewActorId: "inspector-b-view",
        label: "Inspector",
        order: 30,
        activationSequence: 0
      })
    ];
    const { component, entries: subjectEntries, root } = createSubject({ entries });

    expect(rows(root)[0].dataset).toMatchObject({
      actorId: "inspector-a-view",
      viewKey: "inspector:a"
    });

    subjectEntries[1] = {
      ...subjectEntries[1],
      activationSequence: 4
    };
    component.updateFrame();

    expect(rows(root)[0].dataset).toMatchObject({
      actorId: "inspector-b-view",
      viewKey: "inspector:b"
    });
  });

  it("opens, navigates, and activates menu rows from the keyboard", () => {
    const { frameIntents, root } = createSubject();

    expect(root.dispatchKeyDown("ArrowDown", 10).defaultPrevented).toBe(true);
    expect(menu(root).hidden).toBe(false);
    expect(rows(root).map((row) => row.dataset.keyboardActive)).toEqual(["true", "false", "false"]);

    root.dispatchKeyDown("ArrowDown", 11);
    root.dispatchKeyDown("ArrowDown", 12);
    expect(rows(root).map((row) => row.dataset.keyboardActive)).toEqual(["false", "false", "true"]);

    expect(root.dispatchKeyDown("Enter", 13).defaultPrevented).toBe(true);

    expect(frameIntents).toEqual(["open-type:hierarchy:menu"]);
    expect(menu(root).hidden).toBe(true);
    expect(menuButton(root).getAttribute("aria-expanded")).toBe("false");
  });

  it("skips disabled rows during keyboard navigation", () => {
    const { component, entries, frameIntents, root } = createSubject();
    entries[1] = {
      ...entries[1],
      enabled: false
    };
    component.updateFrame();
    root.dispatchKeyDown("ArrowDown", 20);
    expect(rows(root).map((row) => row.dataset.keyboardActive)).toEqual(["true", "false", "false"]);

    root.dispatchKeyDown("ArrowDown", 21);
    expect(rows(root).map((row) => row.dataset.keyboardActive)).toEqual(["false", "false", "true"]);

    root.dispatchKeyDown("Enter", 22);

    expect(frameIntents).toEqual(["open-type:hierarchy:menu"]);
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

    expect(rowHit.partId).toBe("window-command-item");
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

    component.onStateChanged(createWorkspaceModeEvent("run"));

    expect(root.hidden).toBe(true);
    expect(component.hitTestInput({ x: 735, y: 18 })).toBeNull();
    expect(component.hitTestInput({ x: 120, y: 150 })).toBeNull();

    component.onStateChanged(createWorkspaceModeEvent("develop"));
    expect(root.hidden).toBe(false);
    expect(menu(root).hidden).toBe(true);
    expect(menuButton(root).getAttribute("aria-expanded")).toBe("false");
  });
});
