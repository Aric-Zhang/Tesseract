import { describe, expect, it } from "vitest";
import { ActorSystem, ComponentRegistry, type RegisteredActor } from "../../actor-runtime";
import { installCoreComponentDefinitions } from "../../component-definitions";
import { actorInputScopeRoutePriority } from "../../gizmo-runtime";
import { sceneParameterPaths, type SceneUpdateCommand } from "../../scene-runtime";
import { floatingWindowComponentType } from "../../window-runtime";
import { installWindowComponentDefinitions } from "../../window-runtime";
import { createActorInputEndEvent } from "../../test-support";
import {
  createDefaultSceneWindowState,
  createSceneWindowActor,
  SCENE_WINDOW_PRIORITY_DEVELOP
} from ".";
import {
  installSceneComponentDefinitions,
  sceneModeToggleComponentType,
  SCENE_MODE_TOGGLE_SOURCE,
  type SceneViewportRenderer,
  sceneViewportComponentType
} from "./components";

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

function findChildByClass(element: FakeElement, className: string): FakeElement {
  const child = element.children.find((candidate) => candidate.className.split(" ").includes(className));
  if (!child) {
    throw new Error(`Missing child with class: ${className}`);
  }
  return child;
}

function createContext(commands: SceneUpdateCommand[] = []) {
  const actorSystem = new ActorSystem();
  const componentRegistry = new ComponentRegistry({
    actorSystem,
    commandSink: { submit: (command) => commands.push(command) }
  });
  installCoreComponentDefinitions(componentRegistry);
  installWindowComponentDefinitions(componentRegistry);
  installSceneComponentDefinitions(componentRegistry);
  return {
    actorSystem,
    componentRegistry,
    trackRegisteredActor(_actor: RegisteredActor) {
      return { dispose() {} };
    }
  };
}

function createFakeRenderer(document: FakeDocument, calls: string[] = []): SceneViewportRenderer {
  return {
    domElement: document.createElement("canvas") as unknown as HTMLElement,
    setClearColor(color, alpha): void {
      calls.push(`setClearColor:${color}:${alpha}`);
    },
    setPixelRatio(pixelRatio): void {
      calls.push(`setPixelRatio:${pixelRatio}`);
    },
    setSize(width, height, updateStyle): void {
      calls.push(`setSize:${width}:${height}:${updateStyle}`);
    },
    render(): void {
      calls.push("render");
    },
    dispose(): void {
      calls.push("dispose");
    }
  };
}

describe("createSceneWindowActor", () => {
  it("creates a Scene actor with a floating window and viewport component", () => {
    const context = createContext();
    const document = new FakeDocument();
    const parent = document.createElement("div");
    const rendererCalls: string[] = [];

    const handle = createSceneWindowActor(context, {
      actorId: "scene-actor",
      parent: parent as unknown as HTMLElement,
      document: document as unknown as Document,
      initialState: createDefaultSceneWindowState({ viewportWidth: 1000, viewportHeight: 800 }),
      createRenderer: () => createFakeRenderer(document, rendererCalls)
    });

    const viewActor = handle.viewport.actor;
    expect(handle.actor.id).toBe("scene-actor");
    expect(viewActor.id).toBe("scene-actor:view");
    expect(context.actorSystem.getParentId(viewActor)).toBe("scene-actor");
    expect(handle.component).toBe(handle.viewport);
    expect(handle.actor.getComponent(floatingWindowComponentType)).toBe(handle.window);
    expect(handle.actor.getComponent(sceneViewportComponentType)).toBeNull();
    expect(handle.actor.getComponent(sceneModeToggleComponentType)).toBeNull();
    expect(viewActor.getComponent(sceneViewportComponentType)).toBe(handle.viewport);
    expect(viewActor.getComponent(sceneModeToggleComponentType)).toBe(handle.modeToggle);
    expect(handle.window.inputStackPriority).toBe(SCENE_WINDOW_PRIORITY_DEVELOP);
    expect(handle.window.menuDescriptor).toEqual({
      include: true,
      viewKey: "scene",
      label: "Scene",
      order: 0,
      group: null,
      activationMode: "visible"
    });
    expect(handle.viewport.scene).toBeDefined();
    expect(handle.viewport.viewportElement.className).toBe("scene-window__viewport");
    expect(handle.viewport.canvasHostElement.className).toBe("scene-window__canvas-host");
    expect(handle.viewport.overlayElement.className).toBe("scene-window__overlay");
    expect(handle.modeToggle.controlsElement.className).toBe("scene-window__view-controls");
    expect(handle.modeToggle.zoneElement).toBe(handle.modeToggle.controlsElement);
    expect(rendererCalls).toEqual(["setClearColor:461069:1"]);

    const root = parent.children[0];
    const content = findChildByClass(root, "floating-gizmo-window__content");
    expect(content.children).toEqual([handle.viewport.viewportElement as unknown as FakeElement]);
    expect((handle.viewport.canvasHostElement as unknown as FakeElement).children).toHaveLength(1);
    expect((handle.viewport.overlayElement as unknown as FakeElement).children).toEqual([
      handle.modeToggle.controlsElement as unknown as FakeElement
    ]);
  });

  it("requires an owning FloatingWindowComponent", () => {
    const context = createContext();
    const document = new FakeDocument();
    const actor = context.actorSystem.createActor({ id: "scene-actor" });

    expect(() => context.componentRegistry.addComponent(actor, sceneViewportComponentType, {
      document: document as unknown as Document,
      createRenderer: () => createFakeRenderer(document)
    })).toThrow(/requires an owning FloatingWindowComponent/);
  });

  it("measures, renders, and disposes the viewport renderer", () => {
    const context = createContext();
    const document = new FakeDocument();
    const parent = document.createElement("div");
    const rendererCalls: string[] = [];
    const resizeCallbacks: Array<() => void> = [];
    const observerCalls: string[] = [];
    const handle = createSceneWindowActor(context, {
      actorId: "scene-actor",
      parent: parent as unknown as HTMLElement,
      document: document as unknown as Document,
      initialState: createDefaultSceneWindowState({ viewportWidth: 1000, viewportHeight: 800 }),
      createRenderer: () => createFakeRenderer(document, rendererCalls),
      createResizeObserver: (callback) => {
        resizeCallbacks.push(callback);
        return {
          observe(target): void {
            observerCalls.push(`observe:${(target as unknown as FakeElement).className}`);
          },
          disconnect(): void {
            observerCalls.push("disconnect");
          }
        };
      },
      devicePixelRatio: () => 3
    });
    const sizes: Array<{ width: number; height: number }> = [];
    const unregister = handle.viewport.subscribeResize((size) => sizes.push(size));
    (handle.viewport.viewportElement as unknown as FakeElement).rect = createRect(0, 0, 640, 360);

    handle.viewport.measureNow();
    const resizeCallback = resizeCallbacks[0];
    if (!resizeCallback) throw new Error("Expected resize callback.");
    resizeCallback();
    handle.viewport.render({} as never);
    unregister.dispose();
    (handle.viewport.viewportElement as unknown as FakeElement).rect = createRect(0, 0, 800, 450);
    handle.viewport.measureNow();
    handle.dispose();

    expect(observerCalls).toEqual(["observe:scene-window__viewport", "disconnect"]);
    expect(rendererCalls).toEqual([
      "setClearColor:461069:1",
      "setPixelRatio:2",
      "setSize:640:360:false",
      "render",
      "setPixelRatio:2",
      "setSize:800:450:false",
      "dispose"
    ]);
    expect(sizes).toEqual([{ width: 640, height: 360 }]);
  });

  it("submits workspace mode commands from the Scene mode toggle", () => {
    const commands: SceneUpdateCommand[] = [];
    const context = createContext(commands);
    const document = new FakeDocument();
    const parent = document.createElement("div");
    const handle = createSceneWindowActor(context, {
      actorId: "scene-actor",
      parent: parent as unknown as HTMLElement,
      document: document as unknown as Document,
      initialState: createDefaultSceneWindowState({ viewportWidth: 1000, viewportHeight: 800 }),
      createRenderer: () => createFakeRenderer(document)
    });
    (handle.modeToggle.buttonElement as unknown as FakeElement).rect = createRect(700, 500, 40, 40);

    const enterRunHit = handle.modeToggle.hitTestInput({ x: 720, y: 520 });
    if (!enterRunHit) throw new Error("Expected mode toggle hit.");
    handle.modeToggle.onInputEnd(createActorInputEndEvent(enterRunHit, { wasClick: true }));
    handle.modeToggle.onSceneStateChanged({
      frame: { timeMs: 0, deltaMs: 0, frameIndex: 0 },
      changes: [{
        path: sceneParameterPaths.workspace.mode,
        previousValue: "develop",
        nextValue: "run",
        sources: [{ id: "test", kind: "script" }],
        commands: []
      }]
    });
    handle.modeToggle.onInputEnd(createActorInputEndEvent(enterRunHit, { wasClick: true }));

    expect(enterRunHit).toMatchObject({
      componentId: "scene-mode-toggle",
      partId: "scene-mode-toggle",
      kind: "chrome",
      region: "actor-overlay",
      scopeRoutePriority: actorInputScopeRoutePriority.actorOverlay
    });
    expect(handle.modeToggle.buttonElement.className).toContain("scene-window__mode-toggle-button--windowed");
    expect(commands).toEqual([
      {
        source: SCENE_MODE_TOGGLE_SOURCE,
        target: sceneParameterPaths.workspace.mode,
        operation: "set",
        value: "run",
        timeStamp: 30
      },
      {
        source: SCENE_MODE_TOGGLE_SOURCE,
        target: sceneParameterPaths.workspace.mode,
        operation: "set",
        value: "develop",
        timeStamp: 30
      }
    ]);
    expect(handle.modeToggle.hitTestInput({ x: 650, y: 520 })).toBeNull();
  });
});
