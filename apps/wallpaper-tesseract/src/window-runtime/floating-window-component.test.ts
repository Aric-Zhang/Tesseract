import { GizmoEventSystem, type GizmoController, type GizmoHit, type ScreenPoint } from "gizmo-core";
import { describe, expect, it } from "vitest";
import { ActorSystem } from "../actor-runtime";
import { installCoreComponentDefinitions } from "../component-definitions";
import { installWindowComponentDefinitions } from "./install-component-definitions";
import {
  gizmoEventBindingComponentType,
  type GizmoEventBindingComponent
} from "../gizmo-runtime";
import { parameterPath, vec2, type SceneStateChangedEvent, type SceneUpdateCommand, type Vec2 } from "../scene-runtime";
import { stateObserverBindingComponentType } from "../state-runtime";
import {
  createActorInputEndEvent,
  createActorInputMoveEvent,
  createActorInputStartEvent,
  createTestComponentRegistry
} from "../test-support";
import {
  FloatingWindowComponent,
  floatingWindowComponentType,
  type FloatingWindowMenuOptions
} from "./floating-window-component";
import type { FloatingWindowParameterPaths } from "./floating-window-state";

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
    position: parameterPath(`${prefix}.position`),
    size: parameterPath(`${prefix}.size`),
    visible: parameterPath(`${prefix}.visible`)
  };
}

interface CreateSubjectOptions {
  commands?: SceneUpdateCommand[];
  initialState?: {
    position: Vec2;
    size: Vec2;
    visible: boolean;
  };
  minSize?: Vec2;
  priority?: number;
  windowMenu?: FloatingWindowMenuOptions;
}

function createSubject(options: CreateSubjectOptions = {}) {
  const actorSystem = new ActorSystem();
  const actor = actorSystem.createActor({ id: "actor" });
  const document = new FakeDocument();
  const parent = document.createElement("div");
  const paths = createPaths("testWindow");
  const commandSink = options.commands
    ? {
        submit(command: SceneUpdateCommand): void {
          options.commands?.push(command);
        }
      }
    : undefined;
  const component = new FloatingWindowComponent(actor, {
    id: "floating-window:test",
    parent: parent as unknown as HTMLElement,
    document: document as unknown as Document,
    title: "Test Window",
    paths,
    initialState: options.initialState ?? {
      position: vec2(12, 24),
      size: vec2(320, 180),
      visible: true
    },
    minSize: options.minSize,
    className: "test-window",
    contentClassName: "test-window__content",
    priority: options.priority ?? 1200,
    windowMenu: options.windowMenu
  }, commandSink ? { commandSink } : undefined);
  const root = parent.children[0];
  if (!root) throw new Error("Expected window root.");
  return { actor, actorSystem, component, document, parent, paths, root };
}

function createComponentOptions(document: FakeDocument, parent: FakeElement) {
  return {
    id: "floating-window:test",
    parent: parent as unknown as HTMLElement,
    document: document as unknown as Document,
    title: "Test Window",
    paths: createPaths("testWindow"),
    initialState: {
      position: vec2(12, 24),
      size: vec2(320, 180),
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

function setWindowRects(root: FakeElement): void {
  root.rect = createRect(10, 20, 320, 180);
  const titlebar = findChildByClass(root, "floating-gizmo-window__titlebar");
  titlebar.rect = createRect(10, 20, 320, 32);
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

function createChangedEvent(changes: SceneStateChangedEvent["changes"]): SceneStateChangedEvent {
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
      label: "Test Window",
      order: 1200,
      group: null,
      activationMode: "visible"
    });
  });

  it("keeps base priority stable while effective priority updates input and z-index", () => {
    const { component, paths, root } = createSubject();

    component.setEffectivePriority(2400);

    expect(component.basePriority).toBe(1200);
    expect(component.inputStackPriority).toBe(2400);
    expect(root.style.zIndex).toBe("2400");
    expect(component.menuDescriptor.order).toBe(1200);

    component.onSceneStateChanged(createChangedEvent([{
      path: paths.position,
      previousValue: vec2(12, 24),
      nextValue: vec2(40, 50),
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
        label: "Internal Scene",
        order: 10,
        group: "scene",
        activationMode: "none"
      }
    });

    expect(component.menuDescriptor).toEqual({
      include: false,
      label: "Internal Scene",
      order: 10,
      group: "scene",
      activationMode: "none"
    });
  });

  it("applies state observer changes without depending on actor enabled", () => {
    const { actor, component, paths, root } = createSubject();
    actor.enabled = false;

    component.onSceneStateChanged(createChangedEvent([
      {
        path: paths.position,
        previousValue: vec2(12, 24),
        nextValue: vec2(40, 50),
        sources: [],
        commands: []
      },
      {
        path: paths.size,
        previousValue: vec2(320, 180),
        nextValue: vec2(360, 220),
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
      position: vec2(40, 50),
      size: vec2(360, 220),
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

    component.onSceneStateChanged(createChangedEvent([
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
    expect(component.state.position).toEqual(vec2(12, 24));
    expect(component.state.size).toEqual(vec2(320, 180));

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
    component.onSceneStateChanged(createChangedEvent([
      {
        path: paths.position,
        previousValue: vec2(12, 24),
        nextValue: vec2(80, 90),
        sources: [],
        commands: []
      },
      {
        path: paths.size,
        previousValue: vec2(320, 180),
        nextValue: vec2(420, 260),
        sources: [],
        commands: []
      }
    ]));

    expect(root.style.left).toBe("40px");
    expect(root.style.top).toBe("50px");
    expect(root.style.width).toBe("640px");
    expect(root.style.height).toBe("360px");
    expect(component.state.position).toEqual(vec2(80, 90));
    expect(component.state.size).toEqual(vec2(420, 260));

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
      localRoutePriority: 3000,
      hitPriority: 50,
      path: [{ componentId: "floating-window:test", role: "surface", partId: "close" }]
    });
    expect(component.hitTestInput({ x: 12, y: 22 })).toMatchObject({
      partId: "resize-top-left",
      hitPriority: 40
    });
    expect(component.hitTestInput({ x: 20, y: 36 })).toMatchObject({
      partId: "titlebar",
      hitPriority: 20
    });
    expect(component.hitTestInput({ x: 40, y: 90 })).toMatchObject({
      componentId: "floating-window:test",
      partId: "window-content",
      kind: "content",
      region: "window-content",
      localRoutePriority: 100,
      hitPriority: 1,
      path: [{ componentId: "floating-window:test", role: "surface", partId: "window-content" }]
    });
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

  it("submits position commands while dragging the titlebar", () => {
    const commands: SceneUpdateCommand[] = [];
    const { component, paths, root } = createSubject({ commands });
    setWindowRects(root);
    const hit = component.hitTestInput({ x: 20, y: 36 });
    if (!hit) throw new Error("Expected titlebar hit.");

    component.onInputStart(createActorInputStartEvent(hit));
    component.onInputMove(createActorInputMoveEvent(hit, { totalDelta: { dx: 10, dy: -5 } }));

    expect(commands).toEqual([
      {
        source: { id: "floating-window:test", kind: "gizmo" },
        target: paths.position,
        operation: "set",
        value: vec2(22, 19),
        timeStamp: 20
      }
    ]);
  });

  it("submits constrained position and size commands while resizing from the top-left handle", () => {
    const commands: SceneUpdateCommand[] = [];
    const { component, paths, root } = createSubject({
      commands,
      minSize: vec2(300, 120)
    });
    setWindowRects(root);
    const hit = component.hitTestInput({ x: 12, y: 22 });
    if (!hit) throw new Error("Expected resize hit.");

    component.onInputStart(createActorInputStartEvent(hit));
    component.onInputMove(createActorInputMoveEvent(hit, { totalDelta: { dx: 250, dy: 100 } }));

    expect(commands).toEqual([
      {
        source: { id: "floating-window:test", kind: "gizmo" },
        target: paths.position,
        operation: "set",
        value: vec2(32, 84),
        timeStamp: 20
      },
      {
        source: { id: "floating-window:test", kind: "gizmo" },
        target: paths.size,
        operation: "set",
        value: vec2(300, 120),
        timeStamp: 20
      }
    ]);
  });

  it("submits a visibility command when the close button is clicked", () => {
    const commands: SceneUpdateCommand[] = [];
    const { component, paths, root } = createSubject({ commands });
    setWindowRects(root);
    const hit = component.hitTestInput({ x: 300, y: 30 });
    if (!hit) throw new Error("Expected close hit.");

    component.onInputEnd(createActorInputEndEvent(hit, { wasClick: true }));

    expect(commands).toEqual([
      {
        source: { id: "floating-window:test", kind: "gizmo" },
        target: paths.visible,
        operation: "set",
        value: false,
        timeStamp: 30
      }
    ]);
  });

  it("does not submit window state commands for content focus surface input", () => {
    const commands: SceneUpdateCommand[] = [];
    const { component, root } = createSubject({ commands });
    setWindowRects(root);
    const hit = component.hitTestInput({ x: 40, y: 90 });
    if (!hit) throw new Error("Expected content hit.");

    component.onInputStart(createActorInputStartEvent(hit));
    component.onInputMove(createActorInputMoveEvent(hit, { totalDelta: { dx: 10, dy: 20 } }));
    component.onInputEnd(createActorInputEndEvent(hit, { wasClick: true }));

    expect(commands).toEqual([]);
  });

  it("keeps chrome input paths stable for titlebar, resize, and close interactions", () => {
    const { component, root } = createSubject();
    setWindowRects(root);

    expect(component.hitTestInput({ x: 20, y: 36 })?.path).toEqual([
      { componentId: "floating-window:test", role: "surface", partId: "titlebar" }
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
    const title = findChildByClass(titlebar, "floating-gizmo-window__title");

    component.setTitle("Hierarchy");

    expect(title.textContent).toBe("Hierarchy");
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
    expect(contentSlot.children).toEqual([content]);

    attachment.dispose();
    attachment.dispose();

    expect(contentSlot.children).toEqual([]);
  });

  it("rejects duplicate mounted content", () => {
    const { component, document } = createSubject();
    component.mountContent(document.createElement("pre") as unknown as HTMLElement);

    expect(() => component.mountContent(document.createElement("div") as unknown as HTMLElement)).toThrow(
      /already has mounted content/
    );
  });

  it("removes mounted content and root on dispose", () => {
    const { component, document, parent, root } = createSubject();
    const content = document.createElement("pre");
    component.mountContent(content as unknown as HTMLElement);

    component.dispose();

    expect(component.enabled).toBe(false);
    expect(parent.children).toEqual([]);
    expect(content.parentElement).toBeNull();
    expect(root.parentElement).toBeNull();
  });
});

describe("FloatingWindowComponent definition", () => {
  it("adds required binding components when added through the registry", () => {
    const actorSystem = new ActorSystem();
    const { registry } = createTestComponentRegistry({ actorSystem });
    installCoreComponentDefinitions(registry);
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
    installCoreComponentDefinitions(registry);
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

    const selected = selectBestHit(system, { x: 20, y: 36 });

    expect(lowRoot.style.zIndex).toBe("100");
    expect(highRoot.style.zIndex).toBe("900");
    expect(lowBinding.priority).toBe(100);
    expect(highBinding.priority).toBe(900);
    expect(selected?.gizmo).toBe(highBinding);
    expect(selected?.hit.partId).toBe("titlebar");

    system.dispose();
  });

  it("rejects duplicate floating window components on one actor", () => {
    const actorSystem = new ActorSystem();
    const { registry } = createTestComponentRegistry({ actorSystem });
    installCoreComponentDefinitions(registry);
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
    installCoreComponentDefinitions(registry);
    installWindowComponentDefinitions(registry);
    const actor = actorSystem.createActor({ id: "actor" });

    expect(() => registry.addComponent(actor, floatingWindowComponentType, {} as never)).toThrow(
      /options.id is required/
    );
  });
});
