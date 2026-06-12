import { describe, expect, it } from "vitest";
import { ActorSystem, ComponentRegistry, type Actor, type RegisteredActor } from "../../actor-runtime";
import { installGizmoRuntimeComponentDefinitions } from "../../gizmo-runtime";
import { installStateRuntimeComponentDefinitions } from "../../state-runtime";
import { actorInputScopeRoutePriority } from "../../gizmo-runtime";
import type { AppStateCommand } from "editor";
import { editorStatePaths } from "editor";
import { editorWindowLayoutPaths } from "editor";
import {
  createSingletonWindowViewIdentity,
  floatingWindowComponentType,
  WindowContentRegistry,
  workspaceRootDockFrameComponentType
} from "../../window-runtime";
import { installWindowComponentDefinitions } from "../../window-runtime";
import { createActorInputEndEvent } from "../../test-support";
import { createDefaultSceneWindowState, createSceneViewActor } from ".";
import {
  windowWorkspaceContentId,
  windowWorkspaceFrameId,
  windowWorkspaceTabsetId
} from "ui-framework";
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

function findChildByClass(element: FakeElement, className: string): FakeElement {
  const child = element.children.find((candidate) => candidate.className.split(" ").includes(className));
  if (!child) {
    throw new Error(`Missing child with class: ${className}`);
  }
  return child;
}

function createContext(commands: AppStateCommand[] = []) {
  const actorSystem = new ActorSystem();
  const componentRegistry = new ComponentRegistry({ actorSystem });
  installGizmoRuntimeComponentDefinitions(componentRegistry);
  installStateRuntimeComponentDefinitions(componentRegistry);
  installWindowComponentDefinitions(componentRegistry, {
    commandSink: { submit: (command) => commands.push(command as AppStateCommand) }
  });
  installSceneComponentDefinitions(componentRegistry, {
    commandSink: { submit: (command) => commands.push(command) }
  });
  return {
    actorSystem,
    componentRegistry,
    trackRegisteredActor(_actor: RegisteredActor) {
      return { dispose() {} };
    }
  };
}

function createWorkspaceRootFrame(
  context: ReturnType<typeof createContext>,
  parent: FakeElement,
  document: FakeDocument,
  actorId = "workspace-root-frame"
): Actor {
  const actor = context.actorSystem.createActor({ id: actorId });
  context.componentRegistry.addComponent(actor, workspaceRootDockFrameComponentType, {
    id: `workspace-root:${actorId}`,
    parent: parent as unknown as HTMLElement,
    document: document as unknown as Document
  });
  return actor;
}

function addSceneTab(
  context: ReturnType<typeof createContext>,
  ownerFrame: Actor,
  viewActorId = "scene-actor:view"
): void {
  const frame = context.componentRegistry.getComponent(ownerFrame, workspaceRootDockFrameComponentType);
  if (!frame) throw new Error("Expected workspace root frame component.");
  const identity = createSingletonWindowViewIdentity("scene");
  const contentId = windowWorkspaceContentId("content:scene");
  const tabsetId = windowWorkspaceTabsetId("frame-tabset:target");
  frame.renderFrameSurface({
    frameId: windowWorkspaceFrameId(frame.frameId),
    revision: 1,
    kind: "persistent",
    presentation: "windowed",
    visible: true,
    stackPriority: 0,
    root: {
      kind: "tabset",
      id: tabsetId,
      activeContentId: contentId,
      tabs: [{
        contentId,
        identity,
        viewActorId,
        title: "Scene",
        active: true
      }]
    }
  });
}

function attachSceneViewportToFrame(
  context: ReturnType<typeof createContext>,
  ownerFrame: Actor,
  handle: ReturnType<typeof createSceneViewActor>
): void {
  const frame = context.componentRegistry.getComponent(ownerFrame, workspaceRootDockFrameComponentType);
  if (!frame) throw new Error("Expected workspace root frame component.");
  frame.placeContent({
    content: handle.viewport,
    placement: {
      contentId: windowWorkspaceContentId(handle.viewport.contentId),
      identity: createSingletonWindowViewIdentity("scene"),
      frameId: windowWorkspaceFrameId(frame.frameId),
      tabsetId: windowWorkspaceTabsetId("frame-tabset:target"),
      active: true,
      interactable: true
    }
  });
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

describe("createSceneViewActor", () => {
  it("creates a Scene view actor under an owning frame actor", () => {
    const context = createContext();
    const document = new FakeDocument();
    const parent = document.createElement("div");
    const ownerFrame = createWorkspaceRootFrame(context, parent, document);
    addSceneTab(context, ownerFrame);
    const rendererCalls: string[] = [];

    const handle = createSceneViewActor(context, {
      actorId: "scene-actor:view",
      actorName: "Scene View",
      parentActor: ownerFrame,
      contentId: "content:scene",
      contentRegistration: new WindowContentRegistry(),
      document: document as unknown as Document,
      createRenderer: () => createFakeRenderer(document, rendererCalls)
    });
    attachSceneViewportToFrame(context, ownerFrame, handle);

    expect(handle.actor.id).toBe("scene-actor:view");
    expect(context.actorSystem.getParentId(handle.actor)).toBe("workspace-root-frame");
    expect(handle.component).toBe(handle.viewport);
    expect(handle.actor.getComponent(sceneViewportComponentType)).toBe(handle.viewport);
    expect(handle.actor.getComponent(sceneModeToggleComponentType)).toBe(handle.modeToggle);
    expect(handle.renderOutput.id).toBe("scene-actor:view:render-output");
    expect(handle.viewport.viewportElement.className).toBe("scene-window__viewport");
    expect(handle.viewport.canvasHostElement.className).toBe("scene-window__canvas-host");
    expect(handle.viewport.overlayElement.className).toBe("scene-window__overlay");
    expect(handle.modeToggle.controlsElement.className).toBe("scene-window__view-controls");
    expect(handle.modeToggle.zoneElement).toBe(handle.modeToggle.controlsElement);
    expect(rendererCalls).toEqual(["setClearColor:461069:1"]);

    const root = parent.children[0];
    const content = findChildByClass(root, "workspace-root-dock-frame__content");
    expect(content.children).toEqual([handle.viewport.viewportElement as unknown as FakeElement]);
    expect((handle.viewport.canvasHostElement as unknown as FakeElement).children).toHaveLength(1);
    expect((handle.viewport.overlayElement as unknown as FakeElement).children).toEqual([
      handle.modeToggle.controlsElement as unknown as FakeElement
    ]);
  });

  it("can untrack runtime ownership without destroying the Scene view actor tree", () => {
    const context = createContext();
    const untrackCalls: string[] = [];
    context.trackRegisteredActor = () => ({
      dispose: () => untrackCalls.push("untrack")
    });
    const document = new FakeDocument();
    const parent = document.createElement("div");
    const ownerFrame = createWorkspaceRootFrame(context, parent, document);
    addSceneTab(context, ownerFrame);
    const handle = createSceneViewActor(context, {
      actorId: "scene-actor:view",
      actorName: "Scene View",
      parentActor: ownerFrame,
      contentId: "content:scene",
      contentRegistration: new WindowContentRegistry(),
      document: document as unknown as Document,
      createRenderer: () => createFakeRenderer(document)
    });

    handle.disposeRuntimeTracking?.();
    handle.disposeRuntimeTracking?.();

    expect(untrackCalls).toEqual(["untrack"]);
    expect(context.actorSystem.getActor("scene-actor:view")).toBe(handle.actor);
    expect(parent.children).toHaveLength(1);
  });

  it("measures, renders, and disposes the viewport renderer", () => {
    const context = createContext();
    const document = new FakeDocument();
    const parent = document.createElement("div");
    const ownerFrame = createWorkspaceRootFrame(context, parent, document);
    addSceneTab(context, ownerFrame);
    const rendererCalls: string[] = [];
    const resizeCallbacks: Array<() => void> = [];
    const observerCalls: string[] = [];
    const handle = createSceneViewActor(context, {
      actorId: "scene-actor:view",
      actorName: "Scene View",
      parentActor: ownerFrame,
      contentId: "content:scene",
      contentRegistration: new WindowContentRegistry(),
      document: document as unknown as Document,
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

  it("moves the Scene viewport through registered frame content placement and measures the new frame", () => {
    const context = createContext();
    const document = new FakeDocument();
    const parent = document.createElement("div");
    const ownerFrame = createWorkspaceRootFrame(context, parent, document);
    addSceneTab(context, ownerFrame);
    const rendererCalls: string[] = [];
    const handle = createSceneViewActor(context, {
      actorId: "scene-actor:view",
      actorName: "Scene View",
      parentActor: ownerFrame,
      contentId: "content:scene",
      contentRegistration: new WindowContentRegistry(),
      document: document as unknown as Document,
      createRenderer: () => createFakeRenderer(document, rendererCalls),
      devicePixelRatio: () => 1
    });
    attachSceneViewportToFrame(context, ownerFrame, handle);
    const targetFrame = context.actorSystem.createActor({ id: "target-frame" });
    const targetWindow = context.componentRegistry.addComponent(targetFrame, floatingWindowComponentType, {
      id: "floating-window:target",
      parent: parent as unknown as HTMLElement,
      document: document as unknown as Document,
      title: "Target",
      paths: editorWindowLayoutPaths.debugWindow,
      initialState: createDefaultSceneWindowState({ viewportWidth: 500, viewportHeight: 280 })
    });
    const sourceRoot = parent.children[0];
    const targetRoot = parent.children[1];
    const sourceContent = findChildByClass(sourceRoot, "workspace-root-dock-frame__content");
    const targetContent = findChildByClass(targetRoot, "floating-gizmo-window__content");
    (handle.viewport.viewportElement as unknown as FakeElement).rect = createRect(0, 0, 500, 280);

    const targetTabsetId = windowWorkspaceTabsetId("frame-tabset:target");
    targetWindow.renderFrameSurface({
      frameId: windowWorkspaceFrameId(targetWindow.frameId),
      revision: 1,
      kind: "persistent",
      presentation: "windowed",
      visible: true,
      stackPriority: 0,
      root: {
        kind: "tabset",
        id: targetTabsetId,
        activeContentId: windowWorkspaceContentId(handle.viewport.contentId),
        tabs: [{
          contentId: windowWorkspaceContentId(handle.viewport.contentId),
          identity: createSingletonWindowViewIdentity("scene"),
          viewActorId: handle.viewport.actor.id,
          title: "Scene",
          active: true
        }]
      }
    });
    targetWindow.placeContent({
      content: handle.viewport,
      placement: {
        contentId: windowWorkspaceContentId(handle.viewport.contentId),
        identity: createSingletonWindowViewIdentity("scene"),
        frameId: windowWorkspaceFrameId(targetWindow.frameId),
        tabsetId: targetTabsetId,
        active: true,
        interactable: true
      }
    });
    handle.viewport.measureNow();

    expect(sourceContent.children).toEqual([]);
    expect(targetContent.children).toEqual([handle.viewport.viewportElement as unknown as FakeElement]);
    expect(rendererCalls).toEqual([
      "setClearColor:461069:1",
      "setPixelRatio:1",
      "setSize:500:280:false"
    ]);
  });

  it("submits workspace mode commands from the Scene mode toggle", () => {
    const commands: AppStateCommand[] = [];
    const context = createContext(commands);
    const document = new FakeDocument();
    const parent = document.createElement("div");
    const ownerFrame = createWorkspaceRootFrame(context, parent, document);
    addSceneTab(context, ownerFrame);
    const handle = createSceneViewActor(context, {
      actorId: "scene-actor:view",
      actorName: "Scene View",
      parentActor: ownerFrame,
      contentId: "content:scene",
      contentRegistration: new WindowContentRegistry(),
      document: document as unknown as Document,
      createRenderer: () => createFakeRenderer(document)
    });
    (handle.modeToggle.buttonElement as unknown as FakeElement).rect = createRect(700, 500, 40, 40);

    const enterRunHit = handle.modeToggle.hitTestInput({ x: 720, y: 520 });
    if (!enterRunHit) throw new Error("Expected mode toggle hit.");
    handle.modeToggle.onInputEnd(createActorInputEndEvent(enterRunHit, { wasClick: true }));
    handle.modeToggle.onStateChanged({
      frame: { timeMs: 0, deltaMs: 0, frameIndex: 0 },
      changes: [{
        path: editorStatePaths.workspace.mode,
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
        target: editorStatePaths.workspace.mode,
        operation: "set",
        value: "run",
        timeStamp: 30
      },
      {
        source: SCENE_MODE_TOGGLE_SOURCE,
        target: editorStatePaths.workspace.mode,
        operation: "set",
        value: "develop",
        timeStamp: 30
      }
    ]);
    expect(handle.modeToggle.hitTestInput({ x: 650, y: 520 })).toBeNull();
  });
});



