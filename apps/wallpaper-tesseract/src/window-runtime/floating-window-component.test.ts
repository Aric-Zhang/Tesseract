import { GizmoEventSystem, type GizmoController, type GizmoHit, type ScreenPoint } from "gizmo-core";
import { describe, expect, it } from "vitest";
import { ActorSystem } from "../actor-runtime";
import { installGizmoRuntimeComponentDefinitions } from "../gizmo-runtime";
import { installStateRuntimeComponentDefinitions } from "../state-runtime";
import { installWindowComponentDefinitions } from "./install-component-definitions";
import {
  actorInputScopeRoutePriority,
  gizmoEventBindingComponentType,
  type GizmoEventBindingComponent
} from "../gizmo-runtime";
import { stateObserverBindingComponentType } from "../state-runtime";
import {
  createActorInputEndEvent,
  createActorInputHit,
  createActorInputMoveEvent,
  createActorInputStartEvent,
  createTestComponentRegistry
} from "../test-support";
import {
  FloatingWindowComponent,
  floatingWindowComponentType,
  type FloatingWindowMenuOptions
} from "./floating-window-component";
import { WindowFrameSurfaceComponent } from "ui-framework";
import {
  uiLayoutPath,
  uiVec2,
  type FloatingWindowParameterPaths,
  type UiLayoutCommand,
  type UiLayoutStateChangedEvent,
  type UiVec2
} from "ui-framework";
import type { WindowFrameIntentSink } from "./window-frame-lifecycle";
import type {
  WindowFrameRuntimeDockNode,
  WindowFrameRuntimeTabsetNode,
  WindowFrameTab
} from "./window-frame-port";
import { createWindowTabCloseAction } from "ui-framework";
import type { WindowTabDragSink } from "./window-dock-preview-component";

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
  rect: DOMRectReadOnly = createRect(0, 0, 0, 0);

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
    if (index >= 0) {
      this.parentElement.children.splice(index, 1);
    }
    this.parentElement = null;
  }

  getBoundingClientRect(): DOMRectReadOnly {
    return this.rect;
  }
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

function createPaths(prefix: string): FloatingWindowParameterPaths {
  return {
    position: uiLayoutPath(`${prefix}.position`),
    size: uiLayoutPath(`${prefix}.size`),
    visible: uiLayoutPath(`${prefix}.visible`)
  };
}

interface CreateSubjectOptions {
  commands?: UiLayoutCommand[];
  initialState?: {
    position: UiVec2;
    size: UiVec2;
    visible: boolean;
  };
  minSize?: UiVec2;
  priority?: number;
  windowMenu?: FloatingWindowMenuOptions;
  frameId?: string;
  tabs?: readonly WindowFrameTab[];
  activeViewActorId?: string;
  presentation?: "windowed" | "fullscreen";
  frameIntentSink?: WindowFrameIntentSink;
  tabDragSink?: WindowTabDragSink;
  runtimeState?: boolean;
}

function createSubject(options: CreateSubjectOptions = {}) {
  const actorSystem = new ActorSystem();
  const actor = actorSystem.createActor({ id: "actor" });
  const document = new FakeDocument();
  const parent = document.createElement("div");
  const paths = createPaths("testWindow");
  const commandSink = options.commands
    ? {
        submit(command: UiLayoutCommand): void {
          options.commands?.push(command);
        }
      }
    : undefined;
  const surface = new WindowFrameSurfaceComponent(actor, { id: "window-frame-surface:test" });
  const component = new FloatingWindowComponent(actor, {
    id: "floating-window:test",
    parent: parent as unknown as HTMLElement,
    document: document as unknown as Document,
    title: "Test Window",
    paths: options.runtimeState ? undefined : paths,
    stateBinding: options.runtimeState ? { kind: "runtime" } : undefined,
    initialState: options.initialState ?? {
      position: uiVec2(12, 24),
      size: uiVec2(320, 180),
      visible: true
    },
    minSize: options.minSize,
    className: "test-window",
    contentClassName: "test-window__content",
    priority: options.priority ?? 1200,
    frameId: options.frameId,
    presentation: options.presentation,
    tabs: options.tabs,
    activeViewActorId: options.activeViewActorId,
    frameIntentSink: options.frameIntentSink,
    tabDragSink: options.tabDragSink,
    windowMenu: options.windowMenu
  }, { commandSink, surface });
  const root = parent.children[0];
  if (!root) throw new Error("Expected window root.");
  return { actor, actorSystem, component, document, parent, paths, root, surface };
}

function createComponentOptions(document: FakeDocument, parent: FakeElement) {
  return {
    id: "floating-window:test",
    parent: parent as unknown as HTMLElement,
    document: document as unknown as Document,
    title: "Test Window",
    paths: createPaths("testWindow"),
    initialState: {
      position: uiVec2(12, 24),
      size: uiVec2(320, 180),
      visible: true
    }
  };
}

function findChildByClass(element: FakeElement, className: string): FakeElement {
  const child = element.children.find((candidate) => candidate.className.split(" ").includes(className));
  if (!child) {
    throw new Error(`Missing child with class: ${className}`);
  }
  return child;
}

function expectRuntimeTabsetContaining(
  node: WindowFrameRuntimeDockNode,
  viewActorId: string
): WindowFrameRuntimeTabsetNode {
  const tabset = findRuntimeTabsetContaining(node, viewActorId);
  if (!tabset) {
    throw new Error(`Runtime tabset containing ${viewActorId} not found.`);
  }
  return tabset;
}

function findRuntimeTabsetContaining(
  node: WindowFrameRuntimeDockNode,
  viewActorId: string
): WindowFrameRuntimeTabsetNode | null {
  if (node.kind === "tabset") {
    return node.tabs.includes(viewActorId) ? node : null;
  }
  return findRuntimeTabsetContaining(node.first, viewActorId) ??
    findRuntimeTabsetContaining(node.second, viewActorId);
}

function findDescendantsByClass(element: FakeElement, className: string): FakeElement[] {
  const matches: FakeElement[] = [];
  for (const child of element.children) {
    if (child.className.split(" ").includes(className)) {
      matches.push(child);
    }
    matches.push(...findDescendantsByClass(child, className));
  }
  return matches;
}

function setWindowRects(root: FakeElement): void {
  root.rect = createRect(10, 20, 320, 180);
  const titlebar = findChildByClass(root, "floating-gizmo-window__titlebar");
  titlebar.rect = createRect(10, 20, 320, 32);
  findChildByClass(titlebar, "floating-gizmo-window__tab").rect = createRect(18, 24, 110, 24);
  findChildByClass(titlebar, "floating-gizmo-window__close").rect = createRect(294, 24, 28, 24);
  findChildByClass(root, "floating-gizmo-window__resize--left").rect = createRect(10, 20, 6, 180);
  findChildByClass(root, "floating-gizmo-window__resize--right").rect = createRect(324, 20, 6, 180);
  findChildByClass(root, "floating-gizmo-window__resize--top").rect = createRect(10, 20, 320, 6);
  findChildByClass(root, "floating-gizmo-window__resize--bottom").rect = createRect(10, 194, 320, 6);
  findChildByClass(root, "floating-gizmo-window__resize--top-left").rect = createRect(10, 20, 10, 10);
  findChildByClass(root, "floating-gizmo-window__resize--top-right").rect = createRect(320, 20, 10, 10);
  findChildByClass(root, "floating-gizmo-window__resize--bottom-left").rect = createRect(10, 190, 10, 10);
  findChildByClass(root, "floating-gizmo-window__resize--bottom-right").rect = createRect(320, 190, 10, 10);
  findChildByClass(root, "floating-gizmo-window__content").rect = createRect(10, 52, 320, 148);
}

function createChangedEvent(changes: UiLayoutStateChangedEvent["changes"]): UiLayoutStateChangedEvent {
  return {
    frame: {
      timeMs: 0,
      deltaMs: 0,
      frameIndex: 0
    },
    changes
  };
}

class FakeEventTarget {
  addEventListener(): void {}
  removeEventListener(): void {}
}

function selectBestHit(system: GizmoEventSystem, point: ScreenPoint) {
  return (
    system as unknown as {
      findBestHit(point: ScreenPoint): { gizmo: GizmoController; hit: GizmoHit } | null;
    }
  ).findBestHit(point);
}

describe("FloatingWindowComponent DOM shell", () => {
  it("creates the floating window chrome and applies initial state", () => {
    const { component, root } = createSubject();

    expect(root.className).toContain("floating-gizmo-window");
    expect(root.className).toContain("test-window");
    expect(root.hidden).toBe(false);
    expect(root.style.left).toBe("12px");
    expect(root.style.top).toBe("24px");
    expect(root.style.width).toBe("320px");
    expect(root.style.height).toBe("180px");
    expect(root.style.zIndex).toBe("1200");
    expect(component.inputStackPriority).toBe(1200);
    expect(findChildByClass(root, "floating-gizmo-window__titlebar")).toBeDefined();
    expect(findChildByClass(root, "floating-gizmo-window__content").className).toContain("test-window__content");
    expect(root.children.filter((child) => child.className.includes("floating-gizmo-window__resize"))).toHaveLength(8);
  });

  it("exposes default window menu metadata and parameter paths", () => {
    const { component, paths } = createSubject();

    expect(component.parameterPaths).toBe(paths);
    expect(component.basePriority).toBe(1200);
    expect(component.visiblePath).toBe(paths.visible);
    expect(component.menuDescriptor).toEqual({
      include: true,
      viewKey: null,
      label: "Test Window",
      order: 1200,
      group: null,
      activationMode: "visible"
    });
  });

  it("supports runtime-only state without parameter paths or scene visible commands", () => {
    const commands: UiLayoutCommand[] = [];
    const { component, root } = createSubject({ commands, runtimeState: true });

    expect(component.parameterPaths).toBeNull();
    expect(component.visiblePath).toBeNull();

    component.requestVisible(false, 123);

    expect(commands).toEqual([]);
    expect(component.state.visible).toBe(false);
    expect(root.hidden).toBe(true);
  });

  it("suppresses presentation without mutating persistent visibility", () => {
    const { component, document, root } = createSubject({
      tabs: [{ viewActorId: "scene-view", viewKey: "scene", title: "Scene" }],
      activeViewActorId: "scene-view"
    });
    const content = document.createElement("pre");
    root.rect = createRect(12, 24, 320, 180);
    const attachment = component.getContentHost("scene-view").mountContent(content as unknown as HTMLElement);

    component.setPresentationSuppressed("workspace-run", true);

    expect(component.state.visible).toBe(true);
    expect(component.visible).toBe(true);
    expect(component.presentationSuppressed).toBe(true);
    expect(component.effectiveVisible).toBe(false);
    expect(root.hidden).toBe(true);
    expect(attachment.interactable).toBe(false);
    expect(component.isContentInteractable(content as unknown as HTMLElement)).toBe(false);
    expect(component.hitTestInput({ x: 20, y: 30 })).toBeNull();

    component.setPresentationSuppressed("workspace-run", false);

    expect(component.presentationSuppressed).toBe(false);
    expect(component.effectiveVisible).toBe(true);
    expect(root.hidden).toBe(false);
    expect(attachment.interactable).toBe(true);
  });

  it("ignores scene state changes for runtime-only state bindings", () => {
    const { component, paths, root } = createSubject({ runtimeState: true });

    component.onStateChanged(createChangedEvent([
      {
        path: paths.position,
        previousValue: uiVec2(12, 24),
        nextValue: uiVec2(40, 50),
        sources: [],
        commands: []
      },
      {
        path: paths.visible,
        previousValue: true,
        nextValue: false,
        sources: [],
        commands: []
      }
    ]));

    expect(component.state).toEqual({
      position: uiVec2(12, 24),
      size: uiVec2(320, 180),
      visible: true
    });
    expect(root.style.left).toBe("12px");
    expect(root.hidden).toBe(false);
  });

  it("keeps base priority stable while effective priority updates input and z-index", () => {
    const { component, paths, root } = createSubject();

    component.setEffectivePriority(2400);

    expect(component.basePriority).toBe(1200);
    expect(component.inputStackPriority).toBe(2400);
    expect(root.style.zIndex).toBe("2400");
    expect(component.menuDescriptor.order).toBe(1200);

    component.onStateChanged(createChangedEvent([{
      path: paths.position,
      previousValue: uiVec2(12, 24),
      nextValue: uiVec2(40, 50),
      sources: [],
      commands: []
    }]));

    expect(root.style.left).toBe("40px");
    expect(root.style.top).toBe("50px");
    expect(component.inputStackPriority).toBe(2400);
    expect(root.style.zIndex).toBe("2400");
  });

  it("exposes explicit window menu metadata for source discovery", () => {
    const { component } = createSubject({
      windowMenu: {
        include: false,
        viewKey: "scene",
        label: "Internal Scene",
        order: 10,
        group: "scene",
        activationMode: "none"
      }
    });

    expect(component.menuDescriptor).toEqual({
      include: false,
      viewKey: "scene",
      label: "Internal Scene",
      order: 10,
      group: "scene",
      activationMode: "none"
    });
  });

  it("applies state observer changes without depending on actor enabled", () => {
    const { actor, component, paths, root } = createSubject();
    actor.enabled = false;

    component.onStateChanged(createChangedEvent([
      {
        path: paths.position,
        previousValue: uiVec2(12, 24),
        nextValue: uiVec2(40, 50),
        sources: [],
        commands: []
      },
      {
        path: paths.size,
        previousValue: uiVec2(320, 180),
        nextValue: uiVec2(360, 220),
        sources: [],
        commands: []
      },
      {
        path: paths.visible,
        previousValue: true,
        nextValue: false,
        sources: [],
        commands: []
      }
    ]));

    expect(component.state).toEqual({
      position: uiVec2(40, 50),
      size: uiVec2(360, 220),
      visible: false
    });
    expect(root.style.left).toBe("40px");
    expect(root.style.top).toBe("50px");
    expect(root.style.width).toBe("360px");
    expect(root.style.height).toBe("220px");
    expect(root.hidden).toBe(true);
  });

  it("keeps hidden window actors registered and leaves enabled ownership outside the component", () => {
    const { actor, actorSystem, component, paths, root } = createSubject();

    component.onStateChanged(createChangedEvent([
      {
        path: paths.visible,
        previousValue: true,
        nextValue: false,
        sources: [],
        commands: []
      }
    ]));

    expect(component.state.visible).toBe(false);
    expect(root.hidden).toBe(true);
    expect(actorSystem.getActor("actor")).toBe(actor);
    expect(actor.enabled).toBe(true);
  });

  it("applies fullscreen presentation from the parent rect without overwriting windowed bounds", () => {
    const { component, parent, root } = createSubject();
    parent.rect = createRect(40, 50, 640, 360);

    component.setPresentation("fullscreen");

    expect(component.presentation).toBe("fullscreen");
    expect(root.className).toContain("floating-gizmo-window--fullscreen");
    expect(root.style.left).toBe("40px");
    expect(root.style.top).toBe("50px");
    expect(root.style.width).toBe("640px");
    expect(root.style.height).toBe("360px");
    expect(component.state.position).toEqual(uiVec2(12, 24));
    expect(component.state.size).toEqual(uiVec2(320, 180));

    component.setPresentation("windowed");

    expect(root.className).not.toContain("floating-gizmo-window--fullscreen");
    expect(root.style.left).toBe("12px");
    expect(root.style.top).toBe("24px");
    expect(root.style.width).toBe("320px");
    expect(root.style.height).toBe("180px");
  });

  it("keeps fullscreen layout active while state changes and restores new bounds when windowed", () => {
    const { component, parent, paths, root } = createSubject();
    parent.rect = createRect(40, 50, 640, 360);

    component.setPresentation("fullscreen");
    component.onStateChanged(createChangedEvent([
      {
        path: paths.position,
        previousValue: uiVec2(12, 24),
        nextValue: uiVec2(80, 90),
        sources: [],
        commands: []
      },
      {
        path: paths.size,
        previousValue: uiVec2(320, 180),
        nextValue: uiVec2(420, 260),
        sources: [],
        commands: []
      }
    ]));

    expect(root.style.left).toBe("40px");
    expect(root.style.top).toBe("50px");
    expect(root.style.width).toBe("640px");
    expect(root.style.height).toBe("360px");
    expect(component.state.position).toEqual(uiVec2(80, 90));
    expect(component.state.size).toEqual(uiVec2(420, 260));

    component.setPresentation("windowed");

    expect(root.style.left).toBe("80px");
    expect(root.style.top).toBe("90px");
    expect(root.style.width).toBe("420px");
    expect(root.style.height).toBe("260px");
  });

  it("hit-tests chrome parts and exposes a low-priority content focus surface", () => {
    const { component, root } = createSubject();
    setWindowRects(root);

    expect(component.hitTestInput({ x: 300, y: 30 })).toMatchObject({
      componentId: "floating-window:test",
      partId: "close",
      kind: "chrome",
      region: "window-frame",
      scopeRoutePriority: actorInputScopeRoutePriority.windowChrome,
      localRoutePriority: 3000,
      hitPriority: 50,
      path: [{ componentId: "floating-window:test", role: "surface", partId: "close" }]
    });
    expect(component.hitTestInput({ x: 12, y: 22 })).toMatchObject({
      partId: "resize-top-left",
      hitPriority: 40
    });
    expect(component.hitTestInput({ x: 20, y: 36 })).toMatchObject({
      partId: "window-tab",
      hitPriority: 20
    });
    expect(component.hitTestInput({ x: 150, y: 36 })).toMatchObject({
      partId: "titlebar-empty",
      hitPriority: 20
    });
    expect(component.hitTestInput({ x: 40, y: 90 })).toMatchObject({
      componentId: "floating-window:test",
      partId: "window-content",
      kind: "content",
      region: "window-content",
      scopeRoutePriority: actorInputScopeRoutePriority.windowContent,
      localRoutePriority: 100,
      hitPriority: 1,
      path: [{ componentId: "floating-window:test", role: "surface", partId: "window-content" }]
    });
  });

  it("hit-tests a rendered tab close control above the tab body", () => {
    const frameIntents: string[] = [];
    const { component, root } = createSubject({
      frameId: "frame:test",
      tabs: [
        { viewActorId: "debug-view", viewKey: "debug", title: "Debug" }
      ],
      frameIntentSink: {
        requestOpenView: (viewKey, reason) => frameIntents.push(`open:${viewKey}:${reason}`),
        requestCloseFrame: (frameId, reason) => frameIntents.push(`frame-close:${frameId}:${reason}`),
        requestCloseView: (viewActorId, reason, options) => (
          frameIntents.push(`view-close:${viewActorId}:${reason}:${options?.viewKey}:${options?.ownerFrameId}`)
        )
      }
    });
    setWindowRects(root);
    const titlebar = findChildByClass(root, "floating-gizmo-window__titlebar");
    const tab = findChildByClass(titlebar, "floating-gizmo-window__tab");
    const tabClose = findChildByClass(tab, "floating-gizmo-window__tab-close");
    tab.rect = createRect(18, 24, 110, 24);
    tabClose.rect = createRect(106, 28, 16, 16);

    const actionHit = component.hitTestInput({ x: 112, y: 36 });
    const tabHit = component.hitTestInput({ x: 40, y: 36 });
    if (!actionHit) throw new Error("Expected tab action hit.");

    component.onInputEnd(createActorInputEndEvent(actionHit, { wasClick: true }));

    expect(actionHit).toMatchObject({
      partId: "window-tab-action",
      hitPriority: 25,
      data: {
        kind: "close-view",
        viewActorId: "debug-view",
        viewKey: "debug"
      }
    });
    expect(tabHit).toMatchObject({ partId: "window-tab" });
    expect(frameIntents).toEqual(["view-close:debug-view:tab-action:debug:frame:test"]);
  });

  it("does not hit-test window chrome while fullscreen", () => {
    const { component, parent, root } = createSubject();
    parent.rect = createRect(0, 0, 800, 600);
    setWindowRects(root);

    component.setPresentation("fullscreen");

    expect(component.hitTestInput({ x: 300, y: 30 })).toBeNull();
    expect(component.hitTestInput({ x: 20, y: 36 })).toBeNull();
    expect(component.hitTestInput({ x: 12, y: 22 })).toBeNull();
  });

  it("submits position commands while dragging the empty titlebar area", () => {
    const commands: UiLayoutCommand[] = [];
    const { component, paths, root } = createSubject({ commands });
    setWindowRects(root);
    const hit = component.hitTestInput({ x: 150, y: 36 });
    if (!hit) throw new Error("Expected titlebar empty hit.");

    component.onInputStart(createActorInputStartEvent(hit));
    component.onInputMove(createActorInputMoveEvent(hit, { totalDelta: { dx: 10, dy: -5 } }));

    expect(commands).toEqual([
      {
        source: { id: "floating-window:test", kind: "pointer" },
        target: paths.position,
        operation: "set",
        value: uiVec2(22, 19),
        timeStamp: 20
      }
    ]);
  });

  it("does not move the frame while dragging the tab itself", () => {
    const commands: UiLayoutCommand[] = [];
    const { component, root } = createSubject({ commands });
    setWindowRects(root);
    const hit = component.hitTestInput({ x: 20, y: 36 });
    if (!hit) throw new Error("Expected tab hit.");

    component.onInputStart(createActorInputStartEvent(hit));
    component.onInputMove(createActorInputMoveEvent(hit, { totalDelta: { dx: 10, dy: -5 } }));

    expect(hit.partId).toBe("window-tab");
    expect(commands).toEqual([]);
  });

  it("submits constrained position and size commands while resizing from the top-left handle", () => {
    const commands: UiLayoutCommand[] = [];
    const { component, paths, root } = createSubject({
      commands,
      minSize: uiVec2(300, 120)
    });
    setWindowRects(root);
    const hit = component.hitTestInput({ x: 12, y: 22 });
    if (!hit) throw new Error("Expected resize hit.");

    component.onInputStart(createActorInputStartEvent(hit));
    component.onInputMove(createActorInputMoveEvent(hit, { totalDelta: { dx: 250, dy: 100 } }));

    expect(commands).toEqual([
      {
        source: { id: "floating-window:test", kind: "pointer" },
        target: paths.position,
        operation: "set",
        value: uiVec2(32, 84),
        timeStamp: 20
      },
      {
        source: { id: "floating-window:test", kind: "pointer" },
        target: paths.size,
        operation: "set",
        value: uiVec2(300, 120),
        timeStamp: 20
      }
    ]);
  });

  it("submits a visibility command when the close button is clicked without a frame intent sink", () => {
    const commands: UiLayoutCommand[] = [];
    const { component, paths, root } = createSubject({ commands });
    setWindowRects(root);
    const hit = component.hitTestInput({ x: 300, y: 30 });
    if (!hit) throw new Error("Expected close hit.");

    component.onInputEnd(createActorInputEndEvent(hit, { wasClick: true }));

    expect(commands).toEqual([
      {
        source: { id: "floating-window:test", kind: "pointer" },
        target: paths.visible,
        operation: "set",
        value: false,
        timeStamp: 30
      }
    ]);
  });

  it("submits a close-frame intent when a frame intent sink is configured", () => {
    const commands: UiLayoutCommand[] = [];
    const frameIntents: string[] = [];
    const { component, root } = createSubject({
      commands,
      frameId: "frame:test",
      frameIntentSink: {
        requestOpenView: (viewKey, reason) => frameIntents.push(`open:${viewKey}:${reason}`),
        requestCloseFrame: (frameId, reason) => frameIntents.push(`close:${frameId}:${reason}`)
      }
    });
    setWindowRects(root);
    const hit = component.hitTestInput({ x: 300, y: 30 });
    if (!hit) throw new Error("Expected close hit.");

    component.onInputEnd(createActorInputEndEvent(hit, { wasClick: true }));

    expect(frameIntents).toEqual(["close:frame:test:close-button"]);
    expect(commands).toEqual([]);
  });

  it("routes tab drags to the tab drag sink without moving the window", () => {
    const commands: UiLayoutCommand[] = [];
    const tabDragCalls: string[] = [];
    const { component, root } = createSubject({
      commands,
      frameId: "frame:test",
      activeViewActorId: "view:test",
      windowMenu: { viewKey: "test-view" },
      tabDragSink: {
        beginTabDrag: (source, point) => {
          tabDragCalls.push(`begin:${source.frameId}:${source.viewActorId}:${source.viewKey}:${point.x}:${point.y}`);
        },
        moveTabDrag: (point) => tabDragCalls.push(`move:${point.x}:${point.y}`),
        endTabDrag: () => {
          tabDragCalls.push("end");
          return null;
        },
        cancelTabDrag: () => tabDragCalls.push("cancel")
      }
    });
    setWindowRects(root);
    const hit = component.hitTestInput({ x: 30, y: 36 });
    if (!hit) throw new Error("Expected tab hit.");

    component.onInputStart(createActorInputStartEvent(hit, { point: { x: 30, y: 36 } }));
    component.onInputMove(createActorInputMoveEvent(hit, {
      point: { x: 80, y: 70 },
      totalDelta: { dx: 50, dy: 34 }
    }));
    component.onInputEnd(createActorInputEndEvent(hit, { wasClick: false }));

    expect(hit.partId).toBe("window-tab");
    expect(tabDragCalls).toEqual([
      "begin:frame:test:view:test:test-view:30:36",
      "move:80:70",
      "end"
    ]);
    expect(commands).toEqual([]);
  });

  it("does not start tab drag preview from the titlebar empty drag path", () => {
    const commands: UiLayoutCommand[] = [];
    const tabDragCalls: string[] = [];
    const { component, paths, root } = createSubject({
      commands,
      tabDragSink: {
        beginTabDrag: () => tabDragCalls.push("begin"),
        moveTabDrag: () => tabDragCalls.push("move"),
        endTabDrag: () => {
          tabDragCalls.push("end");
          return null;
        },
        cancelTabDrag: () => tabDragCalls.push("cancel")
      }
    });
    setWindowRects(root);
    const hit = component.hitTestInput({ x: 150, y: 36 });
    if (!hit) throw new Error("Expected titlebar hit.");

    component.onInputStart(createActorInputStartEvent(hit));
    component.onInputMove(createActorInputMoveEvent(hit, { totalDelta: { dx: 15, dy: 20 } }));

    expect(hit.partId).toBe("titlebar-empty");
    expect(tabDragCalls).toEqual([]);
    expect(commands).toEqual([{
      source: { id: "floating-window:test", kind: "pointer" },
      target: paths.position,
      operation: "set",
      value: uiVec2(27, 44),
      timeStamp: 20
    }]);
  });

  it("does not submit window state commands for content focus surface input", () => {
    const commands: UiLayoutCommand[] = [];
    const { component, root } = createSubject({ commands });
    setWindowRects(root);
    const hit = component.hitTestInput({ x: 40, y: 90 });
    if (!hit) throw new Error("Expected content hit.");

    component.onInputStart(createActorInputStartEvent(hit));
    component.onInputMove(createActorInputMoveEvent(hit, { totalDelta: { dx: 10, dy: 20 } }));
    component.onInputEnd(createActorInputEndEvent(hit, { wasClick: true }));

    expect(commands).toEqual([]);
  });

  it("keeps chrome input paths stable for tab, titlebar, resize, and close interactions", () => {
    const { component, root } = createSubject();
    setWindowRects(root);

    expect(component.hitTestInput({ x: 20, y: 36 })?.path).toEqual([
      { componentId: "floating-window:test", role: "surface", partId: "window-tab" }
    ]);
    expect(component.hitTestInput({ x: 150, y: 36 })?.path).toEqual([
      { componentId: "floating-window:test", role: "surface", partId: "titlebar-empty" }
    ]);
    expect(component.hitTestInput({ x: 12, y: 22 })?.path).toEqual([
      { componentId: "floating-window:test", role: "surface", partId: "resize-top-left" }
    ]);
    expect(component.hitTestInput({ x: 300, y: 30 })?.path).toEqual([
      { componentId: "floating-window:test", role: "surface", partId: "close" }
    ]);
  });

  it("updates the title", () => {
    const { component, root } = createSubject();
    const titlebar = findChildByClass(root, "floating-gizmo-window__titlebar");

    component.setTitle("Hierarchy");

    const title = findChildByClass(titlebar, "floating-gizmo-window__title");
    expect(title.textContent).toBe("Hierarchy");
  });

  it("renders multiple tabs and maintains frame port tab state", () => {
    const { component, root } = createSubject({
      activeViewActorId: "debug-view",
      tabs: [
        { viewActorId: "debug-view", viewKey: "debug", title: "Debug" },
        { viewActorId: "hierarchy-view", viewKey: "hierarchy", title: "Hierarchy" }
      ]
    });
    const titlebar = findChildByClass(root, "floating-gizmo-window__titlebar");
    const tabElements = titlebar.children.filter((child) => (
      child.className.split(" ").includes("floating-gizmo-window__tab")
    ));

    expect(component.listTabs()).toEqual([
      { viewActorId: "debug-view", viewKey: "debug", title: "Debug" },
      { viewActorId: "hierarchy-view", viewKey: "hierarchy", title: "Hierarchy" }
    ]);
    expect(component.getFocusedViewActorId()).toBe("debug-view");
    const initialTabsetId = expectRuntimeTabsetContaining(
      component.getRuntimeDockRoot(),
      "debug-view"
    ).id;
    expect(component.hasTab("hierarchy-view")).toBe(true);
    expect(tabElements.map((tab) => tab.textContent)).toEqual(["Debug", "Hierarchy"]);
    expect(tabElements.map((tab) => tab.className.includes("is-active"))).toEqual([true, false]);

    component.activateTab("hierarchy-view");

    expect(component.getFocusedViewActorId()).toBe("hierarchy-view");
    expect(expectRuntimeTabsetContaining(component.getRuntimeDockRoot(), "hierarchy-view").id)
      .toBe(initialTabsetId);
    const nextTabElements = titlebar.children.filter((child) => (
      child.className.split(" ").includes("floating-gizmo-window__tab")
    ));
    expect(nextTabElements.map((tab) => tab.className.includes("is-active"))).toEqual([false, true]);

    component.removeTab("hierarchy-view");

    expect(component.listTabs()).toEqual([
      { viewActorId: "debug-view", viewKey: "debug", title: "Debug" }
    ]);
    expect(component.getFocusedViewActorId()).toBe("debug-view");
    expect(expectRuntimeTabsetContaining(component.getRuntimeDockRoot(), "debug-view").id)
      .toBe(initialTabsetId);
  });

  it("keeps the frame close button owned by the outer titlebar for merged tabs", () => {
    const { component, root } = createSubject({
      activeViewActorId: "debug-view",
      tabs: [
        { viewActorId: "debug-view", viewKey: "debug", title: "Debug" }
      ]
    });
    const titlebar = findChildByClass(root, "floating-gizmo-window__titlebar");

    component.addTab(
      { viewActorId: "hierarchy-view", viewKey: "hierarchy", title: "Hierarchy" },
      { active: true }
    );
    component.activateTab("debug-view");

    const closeButtons = findDescendantsByClass(root, "floating-gizmo-window__close");

    expect(closeButtons).toHaveLength(1);
    expect(closeButtons[0].parentElement).toBe(titlebar);
    expect(titlebar.children.filter((child) => (
      child.className.split(" ").includes("floating-gizmo-window__tab")
    )).map((tab) => tab.textContent)).toEqual(["Debug", "Hierarchy"]);
  });

  it("provides per-view content hosts that follow the active tab", () => {
    const { component, document } = createSubject({
      activeViewActorId: "debug-view",
      tabs: [
        { viewActorId: "debug-view", viewKey: "debug", title: "Debug" },
        { viewActorId: "hierarchy-view", viewKey: "hierarchy", title: "Hierarchy" }
      ]
    });
    const debugContent = document.createElement("pre");
    const hierarchyContent = document.createElement("div");
    const debugHost = component.getContentHost("debug-view");
    const hierarchyHost = component.getContentHost("hierarchy-view");

    expect(debugHost.inputStackPriority).toBe(component.inputStackPriority);
    expect(hierarchyHost.inputStackPriority).toBe(component.inputStackPriority);

    debugHost.mountContent(debugContent as unknown as HTMLElement);
    hierarchyHost.mountContent(hierarchyContent as unknown as HTMLElement);

    expect(debugContent.hidden).toBe(false);
    expect(hierarchyContent.hidden).toBe(true);
    expect(debugHost.isContentInteractable(debugContent as unknown as HTMLElement)).toBe(true);
    expect(hierarchyHost.isContentInteractable(hierarchyContent as unknown as HTMLElement)).toBe(false);

    component.activateTab("hierarchy-view");

    expect(debugContent.hidden).toBe(true);
    expect(hierarchyContent.hidden).toBe(false);
    expect(debugHost.isContentInteractable(debugContent as unknown as HTMLElement)).toBe(false);
    expect(hierarchyHost.isContentInteractable(hierarchyContent as unknown as HTMLElement)).toBe(true);
  });

  it("renders split panes with independent tabsets and content hosts", () => {
    const { component, document, root } = createSubject({
      activeViewActorId: "hierarchy-view",
      tabs: [
        { viewActorId: "hierarchy-view", viewKey: "hierarchy", title: "Hierarchy" }
      ]
    });
    const hierarchyContent = document.createElement("div");
    const debugContent = document.createElement("pre");
    component.getContentHost("hierarchy-view").mountContent(hierarchyContent as unknown as HTMLElement);
    const targetTabsetId = component.listDockTargetTabsets()[0]?.targetTabsetId;
    if (!targetTabsetId) throw new Error("Expected target tabset.");

    component.splitTab(
      { viewActorId: "debug-view", viewKey: "debug", title: "Debug" },
      { targetTabsetId, placement: "left", active: true }
    );
    expect(expectRuntimeTabsetContaining(component.getRuntimeDockRoot(), "hierarchy-view").id)
      .toBe(targetTabsetId);
    expect(expectRuntimeTabsetContaining(component.getRuntimeDockRoot(), "debug-view").id)
      .not.toBe(targetTabsetId);
    component.getContentHost("debug-view").mountContent(debugContent as unknown as HTMLElement);

    const panes = findDescendantsByClass(root, "floating-gizmo-window__pane");
    const paneTabs = findDescendantsByClass(root, "floating-gizmo-window__pane-tabs");
    const splitters = findDescendantsByClass(root, "floating-gizmo-window__splitter");
    expect(panes).toHaveLength(2);
    expect(paneTabs).toHaveLength(2);
    expect(splitters).toHaveLength(1);
    expect(splitters[0].className).toContain("floating-gizmo-window__splitter--horizontal");
    expect(findDescendantsByClass(panes[0], "floating-gizmo-window__tab").map((tab) => tab.textContent))
      .toEqual(["Debug"]);
    expect(findDescendantsByClass(panes[1], "floating-gizmo-window__tab").map((tab) => tab.textContent))
      .toEqual(["Hierarchy"]);
    expect(debugContent.hidden).toBe(false);
    expect(hierarchyContent.hidden).toBe(false);
    expect(component.getContentHost("debug-view").isContentInteractable(debugContent as unknown as HTMLElement))
      .toBe(true);
    expect(component.getContentHost("hierarchy-view").isContentInteractable(hierarchyContent as unknown as HTMLElement))
      .toBe(true);
  });

  it("keeps one frame close button in the outer titlebar after split render cycles", () => {
    const { component, root } = createSubject({
      activeViewActorId: "hierarchy-view",
      tabs: [
        { viewActorId: "hierarchy-view", viewKey: "hierarchy", title: "Hierarchy" }
      ]
    });
    const titlebar = findChildByClass(root, "floating-gizmo-window__titlebar");
    const targetTabsetId = component.listDockTargetTabsets()[0]?.targetTabsetId;
    if (!targetTabsetId) throw new Error("Expected target tabset.");

    component.splitTab(
      { viewActorId: "debug-view", viewKey: "debug", title: "Debug" },
      { targetTabsetId, placement: "left", active: true }
    );
    const debugTabsetId = expectRuntimeTabsetContaining(component.getRuntimeDockRoot(), "debug-view").id;
    component.addTab(
      { viewActorId: "inspector-view", viewKey: "inspector", title: "Inspector" },
      { targetTabsetId: debugTabsetId, active: false }
    );
    component.activateTab("inspector-view");
    expect(expectRuntimeTabsetContaining(component.getRuntimeDockRoot(), "inspector-view").id)
      .toBe(debugTabsetId);
    component.activateTab("debug-view");
    expect(expectRuntimeTabsetContaining(component.getRuntimeDockRoot(), "debug-view").id)
      .toBe(debugTabsetId);

    const closeButtons = findDescendantsByClass(root, "floating-gizmo-window__close");
    const paneTabbars = findDescendantsByClass(root, "floating-gizmo-window__pane-tabs");

    expect(closeButtons).toHaveLength(1);
    expect(closeButtons[0].parentElement).toBe(titlebar);
    for (const tabbar of paneTabbars) {
      expect(findDescendantsByClass(tabbar, "floating-gizmo-window__close")).toHaveLength(0);
    }
  });

  it("hit-tests the frame close button after split docking", () => {
    const { component, root } = createSubject({
      activeViewActorId: "hierarchy-view",
      tabs: [
        { viewActorId: "hierarchy-view", viewKey: "hierarchy", title: "Hierarchy" }
      ]
    });
    const targetTabsetId = component.listDockTargetTabsets()[0]?.targetTabsetId;
    if (!targetTabsetId) throw new Error("Expected target tabset.");
    component.splitTab(
      { viewActorId: "debug-view", viewKey: "debug", title: "Debug" },
      { targetTabsetId, placement: "left", active: true }
    );
    const titlebar = findChildByClass(root, "floating-gizmo-window__titlebar");
    const closeButton = findChildByClass(titlebar, "floating-gizmo-window__close");
    root.rect = createRect(10, 20, 320, 180);
    titlebar.rect = createRect(10, 20, 320, 32);
    closeButton.rect = createRect(294, 24, 28, 24);

    const hit = component.hitTestInput({ x: 300, y: 30 });

    expect(hit).toMatchObject({
      partId: "close",
      kind: "chrome",
      region: "window-frame"
    });
  });

  it("hit-tests splitters above the content focus surface", () => {
    const { component, root } = createSubject({
      activeViewActorId: "hierarchy-view",
      tabs: [
        { viewActorId: "hierarchy-view", viewKey: "hierarchy", title: "Hierarchy" }
      ]
    });
    const targetTabsetId = component.listDockTargetTabsets()[0]?.targetTabsetId;
    if (!targetTabsetId) throw new Error("Expected target tabset.");
    component.splitTab(
      { viewActorId: "debug-view", viewKey: "debug", title: "Debug" },
      { targetTabsetId, placement: "left", active: true }
    );
    root.rect = createRect(10, 20, 320, 180);
    findChildByClass(root, "floating-gizmo-window__content").rect = createRect(10, 52, 320, 148);
    const splitter = findDescendantsByClass(root, "floating-gizmo-window__splitter")[0];
    splitter.rect = createRect(110, 52, 7, 148);

    const hit = component.hitTestInput({ x: 113, y: 90 });

    expect(hit).toMatchObject({
      partId: "splitter",
      kind: "chrome",
      region: "window-frame",
      hitPriority: 15
    });
    expect(hit?.data).toMatchObject({
      direction: "horizontal"
    });
  });

  it("updates split ratio while dragging the splitter", () => {
    const { component, root } = createSubject({
      activeViewActorId: "hierarchy-view",
      tabs: [
        { viewActorId: "hierarchy-view", viewKey: "hierarchy", title: "Hierarchy" }
      ]
    });
    const targetTabsetId = component.listDockTargetTabsets()[0]?.targetTabsetId;
    if (!targetTabsetId) throw new Error("Expected target tabset.");
    component.splitTab(
      { viewActorId: "debug-view", viewKey: "debug", title: "Debug" },
      { targetTabsetId, placement: "left", active: true }
    );
    root.rect = createRect(10, 20, 320, 180);
    findChildByClass(root, "floating-gizmo-window__content").rect = createRect(10, 52, 320, 148);
    const split = findDescendantsByClass(root, "floating-gizmo-window__split")[0];
    const splitter = findDescendantsByClass(root, "floating-gizmo-window__splitter")[0];
    split.rect = createRect(10, 52, 300, 148);
    splitter.rect = createRect(112, 52, 7, 148);
    const hit = component.hitTestInput({ x: 115, y: 90 });
    if (!hit) throw new Error("Expected splitter hit.");

    component.onInputStart(createActorInputStartEvent(hit, { point: { x: 115, y: 90 } }));
    component.onInputMove(createActorInputMoveEvent(hit, {
      point: { x: 175, y: 90 },
      totalDelta: { dx: 60, dy: 0 }
    }));

    const panes = findDescendantsByClass(root, "floating-gizmo-window__pane");
    expect(Number.parseFloat(panes[0].style.flex)).toBeCloseTo(0.54);
    expect(Number.parseFloat(panes[1].style.flex)).toBeCloseTo(0.46);
  });

  it("clamps splitter drag to the minimum pane size", () => {
    const { component, root } = createSubject({
      activeViewActorId: "hierarchy-view",
      tabs: [
        { viewActorId: "hierarchy-view", viewKey: "hierarchy", title: "Hierarchy" }
      ]
    });
    const targetTabsetId = component.listDockTargetTabsets()[0]?.targetTabsetId;
    if (!targetTabsetId) throw new Error("Expected target tabset.");
    component.splitTab(
      { viewActorId: "debug-view", viewKey: "debug", title: "Debug" },
      { targetTabsetId, placement: "left", active: true }
    );
    root.rect = createRect(10, 20, 320, 180);
    findChildByClass(root, "floating-gizmo-window__content").rect = createRect(10, 52, 320, 148);
    const split = findDescendantsByClass(root, "floating-gizmo-window__split")[0];
    const splitter = findDescendantsByClass(root, "floating-gizmo-window__splitter")[0];
    split.rect = createRect(10, 52, 200, 148);
    splitter.rect = createRect(78, 52, 7, 148);
    const hit = component.hitTestInput({ x: 80, y: 90 });
    if (!hit) throw new Error("Expected splitter hit.");

    component.onInputStart(createActorInputStartEvent(hit, { point: { x: 80, y: 90 } }));
    component.onInputMove(createActorInputMoveEvent(hit, {
      point: { x: -20, y: 90 },
      totalDelta: { dx: -100, dy: 0 }
    }));

    const panes = findDescendantsByClass(root, "floating-gizmo-window__pane");
    expect(panes[0].style.flex).toBe("0.4 1 0");
    expect(panes[1].style.flex).toBe("0.6 1 0");
  });

  it("keeps inactive split-pane tabs hidden and non-interactable", () => {
    const { component, document } = createSubject({
      activeViewActorId: "hierarchy-view",
      tabs: [
        { viewActorId: "hierarchy-view", viewKey: "hierarchy", title: "Hierarchy" }
      ]
    });
    const targetTabsetId = component.listDockTargetTabsets()[0]?.targetTabsetId;
    if (!targetTabsetId) throw new Error("Expected target tabset.");
    component.splitTab(
      { viewActorId: "debug-view", viewKey: "debug", title: "Debug" },
      { targetTabsetId, placement: "left", active: true }
    );
    const debugTabsetId = expectRuntimeTabsetContaining(component.getRuntimeDockRoot(), "debug-view").id;
    component.addTab(
      { viewActorId: "inspector-view", viewKey: "inspector", title: "Inspector" },
      { targetTabsetId: debugTabsetId, active: false }
    );
    const debugContent = document.createElement("pre");
    const inspectorContent = document.createElement("section");

    component.getContentHost("debug-view").mountContent(debugContent as unknown as HTMLElement);
    component.getContentHost("inspector-view").mountContent(inspectorContent as unknown as HTMLElement);

    expect(debugContent.hidden).toBe(false);
    expect(inspectorContent.hidden).toBe(true);
    expect(component.getContentHost("debug-view").isContentInteractable(debugContent as unknown as HTMLElement))
      .toBe(true);
    expect(component.getContentHost("inspector-view").isContentInteractable(inspectorContent as unknown as HTMLElement))
      .toBe(false);
  });

  it("preserves runtime tabset ids across add, activate, remove, and split collapse", () => {
    const { component } = createSubject({
      activeViewActorId: "hierarchy-view",
      tabs: [
        { viewActorId: "hierarchy-view", viewKey: "hierarchy", title: "Hierarchy" }
      ]
    });
    const originalTabsetId = expectRuntimeTabsetContaining(component.getRuntimeDockRoot(), "hierarchy-view").id;

    component.addTab(
      { viewActorId: "debug-view", viewKey: "debug", title: "Debug" },
      { active: true }
    );
    expect(expectRuntimeTabsetContaining(component.getRuntimeDockRoot(), "debug-view").id)
      .toBe(originalTabsetId);
    component.activateTab("hierarchy-view");
    expect(expectRuntimeTabsetContaining(component.getRuntimeDockRoot(), "hierarchy-view").id)
      .toBe(originalTabsetId);

    component.splitTab(
      { viewActorId: "debug-view", viewKey: "debug", title: "Debug" },
      { targetTabsetId: originalTabsetId, placement: "left", active: true }
    );
    const splitRoot = component.getRuntimeDockRoot();
    expect(splitRoot.kind).toBe("split");
    expect(expectRuntimeTabsetContaining(splitRoot, "debug-view").id).not.toBe(originalTabsetId);
    expect(expectRuntimeTabsetContaining(splitRoot, "hierarchy-view").id).toBe(originalTabsetId);

    component.removeTab("debug-view");

    expect(expectRuntimeTabsetContaining(component.getRuntimeDockRoot(), "hierarchy-view").id)
      .toBe(originalTabsetId);
  });

  it("restores a runtime dock root with split panes, tab order, and active view", () => {
    const sceneTab: WindowFrameTab = { viewActorId: "scene-view", viewKey: "scene", title: "Scene" };
    const debugTab: WindowFrameTab = { viewActorId: "debug-view", viewKey: "debug", title: "Debug" };
    const hierarchyTab: WindowFrameTab = {
      viewActorId: "hierarchy-view",
      viewKey: "hierarchy",
      title: "Hierarchy"
    };
    const { component } = createSubject({
      tabs: [sceneTab],
      activeViewActorId: "scene-view"
    });
    const targetTabsetId = component.listDockTargetTabsets()[0]?.targetTabsetId;
    if (!targetTabsetId) throw new Error("Expected target tabset.");
    component.splitTab(debugTab, {
      targetTabsetId,
      placement: "left",
      active: true
    });
    const sceneTabsetId = expectRuntimeTabsetContaining(component.getRuntimeDockRoot(), "scene-view").id;
    component.addTab(hierarchyTab, {
      targetTabsetId: sceneTabsetId,
      active: true
    });
    component.activateTab("hierarchy-view");
    const splitRoot = component.getRuntimeDockRoot();

    component.removeTab("debug-view");
    component.restoreRuntimeDockRoot(splitRoot, {
      tabs: [sceneTab, debugTab, hierarchyTab],
      activeViewActorId: "debug-view"
    });

    expect(component.getRuntimeDockRoot()).toEqual(splitRoot);
    expect(component.getFocusedViewActorId()).toBe("debug-view");
    expect(component.listTabs()).toEqual([debugTab, sceneTab, hierarchyTab]);
  });

  it("returns a fullscreen frame to windowed presentation when adding a different active tab", () => {
    const { component, root } = createSubject({
      presentation: "fullscreen",
      activeViewActorId: "scene-view",
      tabs: [
        { viewActorId: "scene-view", viewKey: "scene", title: "Scene" }
      ]
    });

    component.addTab({ viewActorId: "debug-view", viewKey: "debug", title: "Debug" }, { active: true });

    expect(component.presentation).toBe("windowed");
    expect(root.className).not.toContain("floating-gizmo-window--fullscreen");
    expect(component.getFocusedViewActorId()).toBe("debug-view");
  });

  it("sends tab activation intent when clicking an inactive tab", () => {
    const frameIntents: string[] = [];
    const { component, root } = createSubject({
      frameId: "frame:test",
      activeViewActorId: "debug-view",
      tabs: [
        { viewActorId: "debug-view", viewKey: "debug", title: "Debug" },
        { viewActorId: "hierarchy-view", viewKey: "hierarchy", title: "Hierarchy" }
      ],
      frameIntentSink: {
        requestOpenView: (viewKey, reason) => frameIntents.push(`open:${viewKey}:${reason}`),
        requestCloseFrame: (frameId, reason) => frameIntents.push(`close:${frameId}:${reason}`),
        requestActivateFrameTab: (frameId, viewActorId, reason) => (
          frameIntents.push(`activate:${frameId}:${viewActorId}:${reason}`)
        )
      }
    });
    const titlebar = findChildByClass(root, "floating-gizmo-window__titlebar");
    const [debugTab, hierarchyTab] = titlebar.children.filter((child) => (
      child.className.split(" ").includes("floating-gizmo-window__tab")
    ));
    debugTab.rect = createRect(18, 24, 80, 24);
    hierarchyTab.rect = createRect(104, 24, 120, 24);
    findChildByClass(titlebar, "floating-gizmo-window__close").rect = createRect(294, 24, 28, 24);
    root.rect = createRect(10, 20, 320, 180);
    titlebar.rect = createRect(10, 20, 320, 32);
    const hit = component.hitTestInput({ x: 120, y: 36 });
    if (!hit) throw new Error("Expected hierarchy tab hit.");

    component.onInputEnd(createActorInputEndEvent(hit, { wasClick: true }));

    expect(hit.partId).toBe("window-tab");
    expect(frameIntents).toEqual(["activate:frame:test:hierarchy-view:tab-click"]);
    expect(component.getFocusedViewActorId()).toBe("debug-view");
  });

  it("routes tab action hits to close-view intent without using frame close or tab drag", () => {
    const frameIntents: string[] = [];
    const tabDragCalls: string[] = [];
    const { component } = createSubject({
      frameId: "frame:test",
      activeViewActorId: "debug-view",
      tabs: [
        { viewActorId: "debug-view", viewKey: "debug", title: "Debug" },
        { viewActorId: "hierarchy-view", viewKey: "hierarchy", title: "Hierarchy" }
      ],
      frameIntentSink: {
        requestOpenView: (viewKey, reason) => frameIntents.push(`open:${viewKey}:${reason}`),
        requestCloseFrame: (frameId, reason) => frameIntents.push(`frame-close:${frameId}:${reason}`),
        requestCloseView: (viewActorId, reason, options) => (
          frameIntents.push(`view-close:${viewActorId}:${reason}:${options?.viewKey}:${options?.ownerFrameId}`)
        ),
        requestActivateFrameTab: (frameId, viewActorId, reason) => (
          frameIntents.push(`activate:${frameId}:${viewActorId}:${reason}`)
        )
      },
      tabDragSink: {
        beginTabDrag: () => tabDragCalls.push("begin"),
        moveTabDrag: () => tabDragCalls.push("move"),
        endTabDrag: () => {
          tabDragCalls.push("end");
          return null;
        },
        cancelTabDrag: () => tabDragCalls.push("cancel")
      }
    });
    const hit = createActorInputHit(component.id, {
      partId: "window-tab-action",
      data: createWindowTabCloseAction({
        viewActorId: "hierarchy-view",
        viewKey: "hierarchy",
        title: "Hierarchy"
      })
    });

    component.onInputStart(createActorInputStartEvent(hit));
    component.onInputEnd(createActorInputEndEvent(hit, { wasClick: true }));

    expect(frameIntents).toEqual(["view-close:hierarchy-view:tab-action:hierarchy:frame:test"]);
    expect(tabDragCalls).toEqual([]);
  });

  it("ignores disabled or malformed tab action hits", () => {
    const frameIntents: string[] = [];
    const { component } = createSubject({
      frameId: "frame:test",
      tabs: [
        { viewActorId: "debug-view", viewKey: "debug", title: "Debug" }
      ],
      frameIntentSink: {
        requestOpenView: (viewKey, reason) => frameIntents.push(`open:${viewKey}:${reason}`),
        requestCloseFrame: (frameId, reason) => frameIntents.push(`frame-close:${frameId}:${reason}`),
        requestCloseView: (viewActorId, reason) => frameIntents.push(`view-close:${viewActorId}:${reason}`)
      }
    });
    const malformedHit = createActorInputHit(component.id, {
      partId: "window-tab-action",
      data: { kind: "close-view", viewActorId: 42, viewKey: "debug" }
    });

    component.onInputEnd(createActorInputEndEvent(malformedHit, { wasClick: true }));

    expect(frameIntents).toEqual([]);
  });

  it("starts tab drag with the concrete dragged tab identity", () => {
    const tabDragCalls: string[] = [];
    const { component, root } = createSubject({
      frameId: "frame:test",
      activeViewActorId: "debug-view",
      tabs: [
        { viewActorId: "debug-view", viewKey: "debug", title: "Debug" },
        { viewActorId: "hierarchy-view", viewKey: "hierarchy", title: "Hierarchy" }
      ],
      tabDragSink: {
        beginTabDrag: (source, point) => {
          tabDragCalls.push(`begin:${source.frameId}:${source.viewActorId}:${source.viewKey}:${point.x}:${point.y}`);
        },
        moveTabDrag: (point) => tabDragCalls.push(`move:${point.x}:${point.y}`),
        endTabDrag: () => {
          tabDragCalls.push("end");
          return null;
        },
        cancelTabDrag: () => tabDragCalls.push("cancel")
      }
    });
    const titlebar = findChildByClass(root, "floating-gizmo-window__titlebar");
    const [debugTab, hierarchyTab] = titlebar.children.filter((child) => (
      child.className.split(" ").includes("floating-gizmo-window__tab")
    ));
    debugTab.rect = createRect(18, 24, 80, 24);
    hierarchyTab.rect = createRect(104, 24, 120, 24);
    findChildByClass(titlebar, "floating-gizmo-window__close").rect = createRect(294, 24, 28, 24);
    root.rect = createRect(10, 20, 320, 180);
    titlebar.rect = createRect(10, 20, 320, 32);
    const hit = component.hitTestInput({ x: 120, y: 36 });
    if (!hit) throw new Error("Expected hierarchy tab hit.");

    component.onInputStart(createActorInputStartEvent(hit, { point: { x: 120, y: 36 } }));
    component.onInputMove(createActorInputMoveEvent(hit, {
      point: { x: 180, y: 80 },
      totalDelta: { dx: 60, dy: 44 }
    }));
    component.onInputEnd(createActorInputEndEvent(hit));

    expect(tabDragCalls).toEqual([
      "begin:frame:test:hierarchy-view:hierarchy:120:36",
      "move:180:80",
      "end"
    ]);
  });

  it("submits a merge dock intent after a completed tab drag over another frame tab area", () => {
    const frameIntents: string[] = [];
    const { component, root } = createSubject({
      frameId: "frame:test",
      activeViewActorId: "debug-view",
      tabs: [
        { viewActorId: "debug-view", viewKey: "debug", title: "Debug" },
        { viewActorId: "hierarchy-view", viewKey: "hierarchy", title: "Hierarchy" }
      ],
      frameIntentSink: {
        requestOpenView: (viewKey, reason) => frameIntents.push(`open:${viewKey}:${reason}`),
        requestCloseFrame: (frameId, reason) => frameIntents.push(`close:${frameId}:${reason}`),
        requestCommitDock: (intent) => {
          if (intent.kind === "merge-tabs") {
            frameIntents.push(
              `merge:${intent.source.frameId}:${intent.source.viewActorId}:${intent.targetFrameId}:${intent.reason}`
            );
          }
        }
      },
      tabDragSink: {
        beginTabDrag: () => {},
        moveTabDrag: () => {},
        endTabDrag: () => ({
          source: {
            frameId: "frame:test",
            viewActorId: "hierarchy-view",
            viewKey: "hierarchy"
          },
          preview: {
            kind: "merge-tabs",
            operation: "cross-frame-merge",
            targetFrameId: "target-frame",
            targetTabsetId: "frame-tabset:target",
            rect: createRect(400, 20, 160, 32)
          }
        }),
        cancelTabDrag: () => {}
      }
    });
    const titlebar = findChildByClass(root, "floating-gizmo-window__titlebar");
    const [, hierarchyTab] = titlebar.children.filter((child) => (
      child.className.split(" ").includes("floating-gizmo-window__tab")
    ));
    hierarchyTab.rect = createRect(104, 24, 120, 24);
    findChildByClass(titlebar, "floating-gizmo-window__close").rect = createRect(294, 24, 28, 24);
    root.rect = createRect(10, 20, 320, 180);
    titlebar.rect = createRect(10, 20, 320, 32);
    const hit = component.hitTestInput({ x: 120, y: 36 });
    if (!hit) throw new Error("Expected hierarchy tab hit.");

    component.onInputEnd(createActorInputEndEvent(hit, { wasClick: false }));

    expect(frameIntents).toEqual([
      "merge:frame:test:hierarchy-view:target-frame:dock-drop"
    ]);
  });

  it("submits a split dock intent after a completed tab drag over another frame content edge", () => {
    const frameIntents: string[] = [];
    const { component, root } = createSubject({
      frameId: "frame:test",
      activeViewActorId: "debug-view",
      tabs: [
        { viewActorId: "debug-view", viewKey: "debug", title: "Debug" }
      ],
      frameIntentSink: {
        requestOpenView: (viewKey, reason) => frameIntents.push(`open:${viewKey}:${reason}`),
        requestCloseFrame: (frameId, reason) => frameIntents.push(`close:${frameId}:${reason}`),
        requestCommitDock: (intent) => {
          if (intent.kind === "split-tab") {
            frameIntents.push(
              `split:${intent.source.frameId}:${intent.source.viewActorId}:` +
              `${intent.targetFrameId}:${intent.targetTabsetId}:${intent.placement}:${intent.reason}`
            );
          }
        }
      },
      tabDragSink: {
        beginTabDrag: () => {},
        moveTabDrag: () => {},
        endTabDrag: () => ({
          source: {
            frameId: "frame:test",
            viewActorId: "debug-view",
            viewKey: "debug"
          },
          preview: {
            kind: "split",
            operation: "cross-frame-split",
            targetFrameId: "target-frame",
            targetTabsetId: "frame-tabset:target",
            placement: "left",
            rect: createRect(400, 52, 120, 200)
          }
        }),
        cancelTabDrag: () => {}
      }
    });
    setWindowRects(root);
    const hit = component.hitTestInput({ x: 30, y: 36 });
    if (!hit) throw new Error("Expected tab hit.");

    component.onInputEnd(createActorInputEndEvent(hit, { wasClick: false }));

    expect(frameIntents).toEqual([
      "split:frame:test:debug-view:target-frame:frame-tabset:target:left:dock-drop"
    ]);
  });

  it("submits a floating dock intent after a completed tab drag over empty space", () => {
    const frameIntents: string[] = [];
    const { component, root } = createSubject({
      frameId: "frame:test",
      activeViewActorId: "debug-view",
      tabs: [
        { viewActorId: "debug-view", viewKey: "debug", title: "Debug" }
      ],
      frameIntentSink: {
        requestOpenView: (viewKey, reason) => frameIntents.push(`open:${viewKey}:${reason}`),
        requestCloseFrame: (frameId, reason) => frameIntents.push(`close:${frameId}:${reason}`),
        requestCommitDock: (intent) => {
          if (intent.kind === "float-tab") {
            frameIntents.push(
              `float:${intent.source.frameId}:${intent.source.viewActorId}:` +
              `${intent.bounds.left}:${intent.bounds.top}:${intent.bounds.width}:${intent.bounds.height}:${intent.reason}`
            );
          }
        }
      },
      tabDragSink: {
        beginTabDrag: () => {},
        moveTabDrag: () => {},
        endTabDrag: () => ({
          source: {
            frameId: "frame:test",
            viewActorId: "debug-view",
            viewKey: "debug"
          },
          preview: {
            kind: "floating",
            operation: "cross-frame-float",
            rect: createRect(440, 80, 260, 180)
          }
        }),
        cancelTabDrag: () => {}
      }
    });
    setWindowRects(root);
    const hit = component.hitTestInput({ x: 30, y: 36 });
    if (!hit) throw new Error("Expected tab hit.");

    component.onInputEnd(createActorInputEndEvent(hit, { wasClick: false }));

    expect(frameIntents).toEqual([
      "float:frame:test:debug-view:440:80:260:180:dock-drop"
    ]);
  });

  it("returns the window bounds without exposing the root element", () => {
    const { component, root } = createSubject();
    root.rect = createRect(20, 30, 400, 260);

    expect(component.getBounds()).toEqual(root.rect);
    expect("rootElement" in (component as unknown as Record<string, unknown>)).toBe(false);
    expect("contentElement" in (component as unknown as Record<string, unknown>)).toBe(false);
  });

  it("mounts one content element and disposes the attachment", () => {
    const { component, document, root } = createSubject();
    const contentSlot = findChildByClass(root, "floating-gizmo-window__content");
    const content = document.createElement("pre");

    const attachment = component.mountContent(content as unknown as HTMLElement);

    expect(attachment.element).toBe(content);
    expect(attachment.host).toBe(component);
    expect(attachment.interactable).toBe(true);
    expect(component.isContentInteractable(content as unknown as HTMLElement)).toBe(true);
    expect(contentSlot.children).toEqual([content]);

    attachment.dispose();
    attachment.dispose();

    expect(attachment.interactable).toBe(false);
    expect(component.isContentInteractable(content as unknown as HTMLElement)).toBe(false);
    expect(contentSlot.children).toEqual([]);
  });

  it("reparents one content element between hosts without resetting element state", () => {
    const first = createSubject();
    const second = createSubject();
    const firstSlot = findChildByClass(first.root, "floating-gizmo-window__content");
    const secondSlot = findChildByClass(second.root, "floating-gizmo-window__content");
    const content = first.document.createElement("pre");
    content.textContent = "preserved state";
    const firstAttachment = first.component.mountContent(content as unknown as HTMLElement);

    const secondAttachment = second.component.mountContent(content as unknown as HTMLElement);

    expect(firstAttachment.interactable).toBe(false);
    expect(secondAttachment.interactable).toBe(true);
    expect(content.textContent).toBe("preserved state");
    expect(firstSlot.children).toEqual([]);
    expect(secondSlot.children).toEqual([content]);
    expect(first.component.isContentInteractable(content as unknown as HTMLElement)).toBe(false);
    expect(second.component.isContentInteractable(content as unknown as HTMLElement)).toBe(true);
  });

  it("mounts multiple content roots in one window content deck", () => {
    const { component, document, root } = createSubject({
      activeViewActorId: "debug-view",
      tabs: [
        { viewActorId: "debug-view", viewKey: "debug", title: "Debug" },
        { viewActorId: "hierarchy-view", viewKey: "hierarchy", title: "Hierarchy" }
      ]
    });
    const contentSlot = findChildByClass(root, "floating-gizmo-window__content");
    const first = document.createElement("pre");
    const second = document.createElement("div");

    const firstAttachment = component.mountContent({
      element: first as unknown as HTMLElement,
      viewActorId: "debug-view"
    });
    const secondAttachment = component.mountContent({
      element: second as unknown as HTMLElement,
      viewActorId: "hierarchy-view",
      interactable: false
    });

    expect(contentSlot.children).toEqual([first, second]);
    expect(component.isContentInteractable(first as unknown as HTMLElement)).toBe(true);
    expect(component.isContentInteractable(second as unknown as HTMLElement)).toBe(false);

    firstAttachment.setInteractable(false);
    secondAttachment.setInteractable(true);

    expect(component.isContentInteractable(first as unknown as HTMLElement)).toBe(false);
    expect(component.isContentInteractable(second as unknown as HTMLElement)).toBe(false);

    component.activateTab("hierarchy-view");

    expect(component.isContentInteractable(first as unknown as HTMLElement)).toBe(false);
    expect(component.isContentInteractable(second as unknown as HTMLElement)).toBe(true);
  });

  it("replaces content for the same view without disposing other deck entries", () => {
    const { component, document, root } = createSubject({
      activeViewActorId: "debug-view",
      tabs: [
        { viewActorId: "debug-view", viewKey: "debug", title: "Debug" },
        { viewActorId: "hierarchy-view", viewKey: "hierarchy", title: "Hierarchy" }
      ]
    });
    const contentSlot = findChildByClass(root, "floating-gizmo-window__content");
    const oldDebugContent = document.createElement("pre");
    const hierarchyContent = document.createElement("div");
    const newDebugContent = document.createElement("section");
    const oldDebugAttachment = component.mountContent({
      element: oldDebugContent as unknown as HTMLElement,
      viewActorId: "debug-view"
    });
    const hierarchyAttachment = component.mountContent({
      element: hierarchyContent as unknown as HTMLElement,
      viewActorId: "hierarchy-view"
    });

    const newDebugAttachment = component.mountContent({
      element: newDebugContent as unknown as HTMLElement,
      viewActorId: "debug-view"
    });

    expect(oldDebugAttachment.interactable).toBe(false);
    expect(hierarchyAttachment.interactable).toBe(false);
    expect(newDebugAttachment.interactable).toBe(true);
    expect(contentSlot.children).toEqual([hierarchyContent, newDebugContent]);
    expect(component.isContentInteractable(oldDebugContent as unknown as HTMLElement)).toBe(false);
    expect(component.isContentInteractable(hierarchyContent as unknown as HTMLElement)).toBe(false);
    expect(component.isContentInteractable(newDebugContent as unknown as HTMLElement)).toBe(true);
  });

  it("does not hit-test inactive mounted content", () => {
    const { component, document, root } = createSubject();
    setWindowRects(root);
    const attachment = component.mountContent(document.createElement("pre") as unknown as HTMLElement);

    expect(component.hitTestInput({ x: 40, y: 90 })?.partId).toBe("window-content");

    attachment.setInteractable(false);

    expect(component.hitTestInput({ x: 40, y: 90 })).toBeNull();
  });

  it("detaches its surface host and root on dispose while surface lifetime stays component-owned", () => {
    const { component, document, parent, root, surface } = createSubject();
    const content = document.createElement("pre");
    component.mountContent(content as unknown as HTMLElement);

    component.dispose();

    expect(component.enabled).toBe(false);
    expect(parent.children).toEqual([]);
    expect(content.parentElement).not.toBeNull();
    expect(root.parentElement).toBeNull();

    surface.dispose();

    expect(content.parentElement).toBeNull();
  });
});

describe("FloatingWindowComponent definition", () => {
  it("adds required binding components when added through the registry", () => {
    const actorSystem = new ActorSystem();
    const { registry } = createTestComponentRegistry({ actorSystem });
    installGizmoRuntimeComponentDefinitions(registry);
    installStateRuntimeComponentDefinitions(registry);
    installWindowComponentDefinitions(registry);
    const document = new FakeDocument();
    const parent = document.createElement("div");
    const actor = actorSystem.createActor({ id: "actor" });

    const component = registry.addComponent(
      actor,
      floatingWindowComponentType,
      createComponentOptions(document, parent)
    );

    expect(component).toBe(actor.getComponent(floatingWindowComponentType));
    expect(actor.getComponent(gizmoEventBindingComponentType)).not.toBeNull();
    expect(actor.getComponent(stateObserverBindingComponentType)).not.toBeNull();
  });

  it("keeps binding priority and z-index aligned for overlapping windows", () => {
    const actorSystem = new ActorSystem();
    const { registry } = createTestComponentRegistry({ actorSystem });
    installGizmoRuntimeComponentDefinitions(registry);
    installStateRuntimeComponentDefinitions(registry);
    installWindowComponentDefinitions(registry);
    const document = new FakeDocument();
    const lowParent = document.createElement("div");
    const highParent = document.createElement("div");
    const lowActor = actorSystem.createActor({ id: "low" });
    const highActor = actorSystem.createActor({ id: "high" });
    const system = new GizmoEventSystem({ target: new FakeEventTarget() as unknown as EventTarget });

    registry.addComponent(lowActor, floatingWindowComponentType, {
      ...createComponentOptions(document, lowParent),
      id: "floating-window:low",
      priority: 100
    });
    registry.addComponent(highActor, floatingWindowComponentType, {
      ...createComponentOptions(document, highParent),
      id: "floating-window:high",
      priority: 900
    });
    const lowRoot = lowParent.children[0];
    const highRoot = highParent.children[0];
    if (!lowRoot || !highRoot) throw new Error("Expected window roots.");
    setWindowRects(lowRoot);
    setWindowRects(highRoot);
    const lowBinding = lowActor.getComponent(gizmoEventBindingComponentType) as GizmoEventBindingComponent;
    const highBinding = highActor.getComponent(gizmoEventBindingComponentType) as GizmoEventBindingComponent;
    system.register(lowBinding);
    system.register(highBinding);

    const selected = selectBestHit(system, { x: 150, y: 36 });

    expect(lowRoot.style.zIndex).toBe("100");
    expect(highRoot.style.zIndex).toBe("900");
    expect(lowBinding.priority).toBe(100);
    expect(highBinding.priority).toBe(900);
    expect(selected?.gizmo).toBe(highBinding);
    expect(selected?.hit.partId).toBe("titlebar-empty");

    system.dispose();
  });

  it("rejects duplicate floating window components on one actor", () => {
    const actorSystem = new ActorSystem();
    const { registry } = createTestComponentRegistry({ actorSystem });
    installGizmoRuntimeComponentDefinitions(registry);
    installStateRuntimeComponentDefinitions(registry);
    installWindowComponentDefinitions(registry);
    const document = new FakeDocument();
    const parent = document.createElement("div");
    const actor = actorSystem.createActor({ id: "actor" });

    registry.addComponent(actor, floatingWindowComponentType, createComponentOptions(document, parent));

    expect(() => registry.addComponent(actor, floatingWindowComponentType, {
      ...createComponentOptions(document, parent),
      id: "floating-window:other"
    })).toThrow(/Singleton component already exists/);
  });

  it("requires options.id", () => {
    const actorSystem = new ActorSystem();
    const { registry } = createTestComponentRegistry({ actorSystem });
    installGizmoRuntimeComponentDefinitions(registry);
    installStateRuntimeComponentDefinitions(registry);
    installWindowComponentDefinitions(registry);
    const actor = actorSystem.createActor({ id: "actor" });

    expect(() => registry.addComponent(actor, floatingWindowComponentType, {} as never)).toThrow(
      /options.id is required/
    );
  });
});



