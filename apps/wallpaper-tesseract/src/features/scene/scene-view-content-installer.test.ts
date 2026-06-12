import { describe, expect, it } from "vitest";
import { AppRuntimeContext } from "../../app-runtime";
import { installWallpaperComponentDefinitions } from "../../app/install-component-definitions";
import type { AppStateCommandSink } from "editor";
import type { AppStateObserver } from "editor";
import type { RuntimeRegistration } from "../../runtime/ports";
import type { SceneViewportRenderer } from "./components";
import type { Camera3GizmoViewFactory } from "../../gizmos/camera3/components";
import type { GizmoControllerRegistry } from "../../gizmo-runtime";
import type { StateObserverRegistry } from "editor";
import {
  createEditorSceneViewHost,
  createRenderableSceneView,
  SceneViewFrameSourceRegistry,
  installSceneViewContent,
  type InstalledSceneViewContent,
  type RenderableSceneView,
  type SceneViewContentActorIds
} from "./index";
import {
  createSingletonWindowViewIdentity,
  WindowContentRegistry,
  workspaceRootDockFrameComponentType,
  type WindowViewLocationSource
} from "../../window-runtime";
import {
  windowWorkspaceContentId,
  windowWorkspaceFrameId,
  windowWorkspaceTabsetId
} from "ui-framework";

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

  get firstChild(): FakeElement | null {
    return this.children[0] ?? null;
  }

  append(...children: FakeElement[]): void {
    for (const child of children) {
      child.remove();
      child.parentElement = this;
      this.children.push(child);
    }
  }

  removeChild(child: FakeElement): FakeElement {
    const index = this.children.indexOf(child);
    if (index < 0) throw new Error("Child not found.");
    this.children.splice(index, 1);
    child.parentElement = null;
    return child;
  }

  remove(): void {
    if (!this.parentElement) return;
    this.parentElement.removeChild(this);
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
    throw new Error(`Missing child with class: ${className}.`);
  }
  return child;
}

function createFakeRenderer(document: FakeDocument, calls: string[]): SceneViewportRenderer {
  return {
    domElement: document.createElement("canvas") as unknown as HTMLElement,
    setClearColor(color, alpha): void {
      calls.push(`clear:${color}:${alpha}`);
    },
    setPixelRatio(pixelRatio): void {
      calls.push(`pixel:${pixelRatio}`);
    },
    setSize(width, height, updateStyle): void {
      calls.push(`size:${width}:${height}:${updateStyle}`);
    },
    render(): void {
      calls.push("render");
    },
    dispose(): void {
      calls.push("dispose");
    }
  };
}

function createWorkspaceRootFrame(
  runtimeContext: AppRuntimeContext,
  mount: FakeElement,
  document: FakeDocument,
  actorId = "workspace-root-frame"
) {
  const actor = runtimeContext.actorSystem.createActor({ id: actorId });
  runtimeContext.componentRegistry.addComponent(actor, workspaceRootDockFrameComponentType, {
    id: `workspace-root:${actorId}`,
    parent: mount as unknown as HTMLElement,
    document: document as unknown as Document
  });
  return actor;
}

function addSceneTabToFrame(
  runtimeContext: AppRuntimeContext,
  frameActor: ReturnType<typeof createWorkspaceRootFrame>,
  viewActorId: string
): void {
  const frame = runtimeContext.componentRegistry.getComponent(frameActor, workspaceRootDockFrameComponentType);
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

function placeSceneContentInFrame(
  runtimeContext: AppRuntimeContext,
  frameActor: ReturnType<typeof createWorkspaceRootFrame>,
  content: InstalledSceneViewContent
): void {
  const frame = runtimeContext.componentRegistry.getComponent(frameActor, workspaceRootDockFrameComponentType);
  if (!frame) throw new Error("Expected workspace root frame component.");
  const identity = createSingletonWindowViewIdentity("scene");
  frame.placeContent({
    content: content.sceneView.viewport,
    placement: {
      contentId: windowWorkspaceContentId(content.sceneView.viewport.contentId),
      identity,
      frameId: windowWorkspaceFrameId(frame.frameId),
      tabsetId: windowWorkspaceTabsetId("frame-tabset:target"),
      active: true,
      interactable: true
    }
  });
}

function createFakeCamera3Gizmo(document: FakeDocument, calls: string[]): Camera3GizmoViewFactory {
  return (options) => {
    const element = document.createElement("div");
    element.className = "camera3-gizmo";
    options.parent?.append(element as unknown as HTMLElement);
    return {
      id: "camera3-view-gizmo",
      priority: 100,
      enabled: true,
      element,
      update: () => {
        calls.push("camera3-update");
      },
      dispose: () => {
        calls.push("camera3-dispose");
        element.remove();
      },
      hitTest: () => null
    } as unknown as ReturnType<Camera3GizmoViewFactory>;
  };
}

function createRuntimeContext(calls: string[] = []) {
  const frameStateController: StateObserverRegistry<AppStateObserver> & AppStateCommandSink = {
    submit: () => {},
    subscribe: (observer: AppStateObserver) => {
      calls.push(`state-subscribe:${observer.constructor.name}`);
      return createRegistration(() => calls.push(`state-unsubscribe:${observer.constructor.name}`));
    },
    dispose: () => calls.push("state-dispose")
  };
  const gizmoEventSystem: GizmoControllerRegistry = {
    register: (object) => {
      calls.push(`gizmo-register:${object.id}`);
      return createRegistration(() => calls.push(`gizmo-unregister:${object.id}`));
    },
    dispose: () => calls.push("gizmo-dispose")
  };
  const runtimeContext = new AppRuntimeContext({
    frameStateController,
    gizmoEventSystem
  });
  installWallpaperComponentDefinitions(runtimeContext.componentRegistry);
  return { runtimeContext };
}

function createRegistration(dispose: () => void): RuntimeRegistration {
  let disposed = false;
  return {
    dispose() {
      if (disposed) return;
      disposed = true;
      dispose();
    }
  };
}

interface CreateSubjectOptions {
  readonly actorIds?: Partial<SceneViewContentActorIds>;
  readonly createCamera3GizmoView?: Camera3GizmoViewFactory;
  readonly rootFrameActorId?: string;
  readonly viewLocationSource?: WindowViewLocationSource;
}

function createSubject(options: CreateSubjectOptions = {}) {
  const document = new FakeDocument();
  const mount = document.createElement("div");
  const calls: string[] = [];
  const rendererCalls: string[] = [];
  const resizeObserverCalls: string[] = [];
  const resizeCallbacks: Array<() => void> = [];
  const { runtimeContext } = createRuntimeContext(calls);
  const sceneWindowActorId = options.actorIds?.sceneWindowActorId ?? "scene-window";
  const sceneViewActorId = `${sceneWindowActorId}:view`;
  const rootFrameActor = createWorkspaceRootFrame(
    runtimeContext,
    mount,
    document,
    options.rootFrameActorId ?? "workspace-root-frame"
  );
  addSceneTabToFrame(runtimeContext, rootFrameActor, sceneViewActorId);
  const viewLocationSource = options.viewLocationSource ?? createSceneLocationSource(
    runtimeContext,
    rootFrameActor.id,
    sceneViewActorId
  );
  const content = installSceneViewContent({
    context: runtimeContext,
    mount: mount as unknown as HTMLElement,
    parentFrameActor: rootFrameActor,
    actorIds: {
      sceneWindowActorId: "scene-window",
      sceneWindowActorName: "Scene",
      camera3GizmoActorId: "camera-3",
      camera3GizmoActorName: "Camera3",
      tesseract4ActorId: "tesseract-4",
      tesseract4ActorName: "Tesseract4",
      ...options.actorIds
    },
    contentId: "content:scene",
    contentRegistration: new WindowContentRegistry(),
    createRenderer: () => createFakeRenderer(document, rendererCalls),
    createCamera3GizmoView: options.createCamera3GizmoView ?? createFakeCamera3Gizmo(document, calls),
    createResizeObserver: (callback) => {
      resizeCallbacks.push(callback);
      return {
        observe(target): void {
          resizeObserverCalls.push(`observe:${(target as unknown as FakeElement).className}`);
        },
        disconnect(): void {
          resizeObserverCalls.push("disconnect");
        }
      };
    },
    devicePixelRatio: () => 2,
  });
  placeSceneContentInFrame(runtimeContext, rootFrameActor, content);
  const host = createEditorSceneViewHost({
    actorSystem: runtimeContext.actorSystem,
    locations: viewLocationSource,
    sceneView: content.sceneView
  });
  const renderable = createRenderableSceneView({
    host,
    camera3Motion: content.camera3Motion
  });
  const runtime = createTestSceneViewHandle(content, renderable);
  return {
    calls,
    document,
    mount,
    rendererCalls,
    resizeCallbacks,
    resizeObserverCalls,
    rootFrameActor,
    runtime,
    runtimeContext
  };
}

function createTestSceneViewHandle(
  content: InstalledSceneViewContent,
  renderable: RenderableSceneView
) {
  return {
    sceneView: content.sceneView,
    camera3Motion: content.camera3Motion,
    get actor() {
      return content.sceneView.actor;
    },
    get viewActorId() {
      return renderable.viewActorId;
    },
    measureNow() {
      renderable.measureNow();
    },
    isRenderable() {
      return renderable.isRenderable();
    },
    render() {
      renderable.render();
    },
    dispose(options: { readonly destroyActorTree?: boolean } = {}) {
      content.sceneView.disposeRuntimeTracking?.();
      if (options.destroyActorTree !== false) {
        content.disposeActorTree();
      }
    }
  };
}

function createSceneLocationSource(
  context: AppRuntimeContext,
  ownerFrameActorId: string,
  viewActorId: string,
  options: {
    readonly ownerFrameVisible?: boolean;
    readonly activeInFrame?: boolean;
    readonly visibleInFrame?: boolean;
  } = {}
): WindowViewLocationSource {
  return {
    getLocationByViewKey: (viewKey) => (
      viewKey === "scene"
        ? thisLocation(context, ownerFrameActorId, viewActorId, options)
        : null
    ),
    getLocationByViewActorId: (candidateViewActorId) => (
      candidateViewActorId === viewActorId
        ? thisLocation(context, ownerFrameActorId, viewActorId, options)
        : null
    ),
    listLocations: () => {
      const location = thisLocation(context, ownerFrameActorId, viewActorId, options);
      return location ? [location] : [];
    }
  };
}

function thisLocation(
  context: AppRuntimeContext,
  ownerFrameActorId: string,
  viewActorId: string,
  options: {
    readonly ownerFrameVisible?: boolean;
    readonly activeInFrame?: boolean;
    readonly visibleInFrame?: boolean;
  }
): ReturnType<WindowViewLocationSource["getLocationByViewActorId"]> {
  const ownerFrame = context.actorSystem.getActor(ownerFrameActorId);
  if (!ownerFrame || !context.actorSystem.getActor(viewActorId)) return null;
  const ownerFrameVisible = options.ownerFrameVisible ?? true;
  const activeInFrame = options.activeInFrame ?? true;
  return {
    viewKey: "scene",
    identity: createSingletonWindowViewIdentity("scene"),
    viewActorId,
    ownerFrameActorId,
    ownerFrameVisiblePath: `${ownerFrameActorId}.visible` as never,
    ownerFrameVisible,
    ownerFrameActiveInHierarchy: context.actorSystem.isActorActive(ownerFrame),
    activeInFrame,
    visibleInFrame: options.visibleInFrame ?? (ownerFrameVisible && activeInFrame),
    presentation: "windowed",
    activationSequence: 0
  };
}

describe("Scene view content installer and renderable view", () => {
  it("creates the Scene view, Camera3, and Tesseract actor tree inside an owner frame", () => {
    const subject = createSubject();
    const sceneViewActor = subject.runtime.sceneView.viewport.actor;

    expect(subject.runtimeContext.actorSystem.getActor("scene-window")).toBeNull();
    expect(sceneViewActor.id).toBe("scene-window:view");
    expect(subject.runtimeContext.actorSystem.getParentId(sceneViewActor)).toBe("workspace-root-frame");
    expect(subject.runtimeContext.actorSystem.getParentId(subject.runtimeContext.actorSystem.getActor("camera-3")!))
      .toBe("scene-window:view");
    expect(subject.runtimeContext.actorSystem.getParentId(subject.runtimeContext.actorSystem.getActor("tesseract-4")!))
      .toBe("scene-window:view");
    expect(subject.calls).not.toContain("runtime-register:camera3-motion-controller");
    expect(subject.resizeObserverCalls).toEqual(["observe:scene-window__viewport"]);

    subject.runtime.dispose();
    subject.runtimeContext.dispose();
  });

  it("creates a Scene view runtime directly inside an explicitly named root frame", () => {
    const subject = createSubject({ rootFrameActorId: "workspace-root-frame" });
    const sceneViewActor = subject.runtime.sceneView.viewport.actor;

    expect(subject.runtimeContext.actorSystem.getActor("scene-window")).toBeNull();
    expect(sceneViewActor.id).toBe("scene-window:view");
    expect(subject.runtimeContext.actorSystem.getParentId(sceneViewActor)).toBe("workspace-root-frame");
    expect(subject.runtimeContext.actorSystem.getParentId(subject.runtimeContext.actorSystem.getActor("camera-3")!))
      .toBe("scene-window:view");
    expect(subject.runtimeContext.actorSystem.getParentId(subject.runtimeContext.actorSystem.getActor("tesseract-4")!))
      .toBe("scene-window:view");
    expect(subject.calls).not.toContain("runtime-register:camera3-motion-controller");
    expect(subject.runtime.isRenderable()).toBe(true);

    subject.runtime.dispose();
    subject.runtimeContext.dispose();
  });

  it("measures, renders, and disposes without leaking observers or actors", () => {
    const subject = createSubject();
    const root = subject.mount.children[0];
    const content = findChildByClass(root, "workspace-root-dock-frame__content");
    const viewport = findChildByClass(content, "scene-window__viewport");
    viewport.rect = createRect(0, 0, 640, 360);

    subject.runtime.measureNow();
    subject.resizeCallbacks[0]?.();
    subject.runtime.render();
    subject.runtime.dispose();
    subject.resizeCallbacks[0]?.();

    expect(subject.rendererCalls).toContain("size:640:360:false");
    expect(subject.rendererCalls).toContain("render");
    expect(subject.rendererCalls.at(-1)).toBe("dispose");
    expect(subject.resizeObserverCalls).toEqual(["observe:scene-window__viewport", "disconnect"]);
    expect(subject.runtimeContext.actorSystem.getActor("workspace-root-frame")).toBeTruthy();
    expect(subject.runtimeContext.actorSystem.getActor("scene-window:view")).toBeNull();
    expect(subject.runtimeContext.actorSystem.getActor("camera-3")).toBeNull();
    expect(subject.runtimeContext.actorSystem.getActor("tesseract-4")).toBeNull();
    expect(subject.calls).not.toContain("runtime-unregister:camera3-motion-controller");

    subject.runtimeContext.dispose();
  });

  it("renders through the current owner after the Scene view is reparented", () => {
    let subjectContext!: AppRuntimeContext;
    let ownerFrameActorId = "workspace-root-frame";
    const subject = createSubject({
      viewLocationSource: {
        getLocationByViewKey: (viewKey) => (
          viewKey === "scene"
            ? thisLocation(subjectContext, ownerFrameActorId, "scene-window:view", {})
            : null
        ),
        getLocationByViewActorId: (viewActorId) => (
          viewActorId === "scene-window:view"
            ? thisLocation(subjectContext, ownerFrameActorId, "scene-window:view", {})
            : null
        ),
        listLocations: () => {
          const location = thisLocation(subjectContext, ownerFrameActorId, "scene-window:view", {});
          return location ? [location] : [];
        }
      }
    });
    subjectContext = subject.runtimeContext;
    const newOwner = subject.runtimeContext.actorSystem.createActor({ id: "debug-frame" });
    subject.runtimeContext.actorSystem.setParent(subject.runtime.sceneView.viewport.actor, newOwner);
    subject.runtimeContext.actorSystem.destroyActor(subject.rootFrameActor);
    ownerFrameActorId = "debug-frame";

    subject.runtime.render();

    expect(subject.runtimeContext.actorSystem.getActor("workspace-root-frame")).toBeNull();
    expect(subject.runtimeContext.actorSystem.getActor("scene-window:view")).toBeTruthy();
    expect(subject.rendererCalls).toContain("render");

    subject.runtime.dispose({ destroyActorTree: false });
    subject.runtimeContext.actorSystem.destroyActor(newOwner);
    subject.runtimeContext.dispose();
  });

  it("does not render while the Scene view is hidden in its current frame", () => {
    let activeInFrame = false;
    const document = new FakeDocument();
    const mount = document.createElement("div");
    const calls: string[] = [];
    const rendererCalls: string[] = [];
    const { runtimeContext } = createRuntimeContext(calls);
    const ownerFrame = createWorkspaceRootFrame(runtimeContext, mount, document, "scene-window");
    const viewLocationSource: WindowViewLocationSource = {
      getLocationByViewKey: (viewKey) => (
        viewKey === "scene"
          ? thisLocation(runtimeContext, "scene-window", "scene-window:view", { activeInFrame })
          : null
      ),
      getLocationByViewActorId: (viewActorId) => (
        viewActorId === "scene-window:view"
          ? thisLocation(runtimeContext, "scene-window", "scene-window:view", { activeInFrame })
          : null
      ),
      listLocations: () => {
        const location = thisLocation(runtimeContext, "scene-window", "scene-window:view", { activeInFrame });
        return location ? [location] : [];
      }
    };
    const content = installSceneViewContent({
      context: runtimeContext,
      mount: mount as unknown as HTMLElement,
      parentFrameActor: ownerFrame,
      actorIds: {
        sceneWindowActorId: "scene-window",
        sceneWindowActorName: "Scene",
        camera3GizmoActorId: "camera-3",
        camera3GizmoActorName: "Camera3",
        tesseract4ActorId: "tesseract-4",
        tesseract4ActorName: "Tesseract4"
      },
      contentId: "content:scene",
      contentRegistration: new WindowContentRegistry(),
      createRenderer: () => createFakeRenderer(document, rendererCalls),
      createCamera3GizmoView: createFakeCamera3Gizmo(document, calls),
    });
    const host = createEditorSceneViewHost({
      actorSystem: runtimeContext.actorSystem,
      locations: viewLocationSource,
      sceneView: content.sceneView
    });
    const renderable = createRenderableSceneView({
      host,
      camera3Motion: content.camera3Motion
    });
    const runtime = createTestSceneViewHandle(
      content,
      renderable
    );

    runtime.render();
    activeInFrame = true;
    runtime.render();

    expect(rendererCalls.filter((call) => call === "render")).toHaveLength(1);

    runtime.dispose();
    runtimeContext.dispose();
  });

  it("allows the same scene actor ids to be recreated after dispose", () => {
    const first = createSubject();
    first.runtime.dispose();
    first.runtimeContext.dispose();

    const second = createSubject();

    expect(second.runtimeContext.actorSystem.getActor("scene-window:view")).toBeTruthy();
    expect(second.runtimeContext.actorSystem.getActor("camera-3")).toBeTruthy();
    second.runtime.dispose();
    second.runtimeContext.dispose();
  });

  it("rolls back scene actors and DOM when Camera3 creation fails", () => {
    const document = new FakeDocument();
    const mount = document.createElement("div");
    const calls: string[] = [];
    const rendererCalls: string[] = [];
    const resizeObserverCalls: string[] = [];
    const { runtimeContext } = createRuntimeContext(calls);
    const ownerFrame = createWorkspaceRootFrame(runtimeContext, mount, document);

    expect(() => installSceneViewContent({
      context: runtimeContext,
      mount: mount as unknown as HTMLElement,
      parentFrameActor: ownerFrame,
      actorIds: {
        sceneWindowActorId: "scene-window",
        sceneWindowActorName: "Scene",
        camera3GizmoActorId: "camera-3",
        camera3GizmoActorName: "Camera3",
        tesseract4ActorId: "tesseract-4",
        tesseract4ActorName: "Tesseract4"
      },
      contentId: "content:scene",
      contentRegistration: new WindowContentRegistry(),
      createRenderer: () => createFakeRenderer(document, rendererCalls),
      createCamera3GizmoView: () => {
        throw new Error("camera3 failed");
      },
      createResizeObserver: () => ({
        observe(target): void {
          resizeObserverCalls.push(`observe:${(target as unknown as FakeElement).className}`);
        },
        disconnect(): void {
          resizeObserverCalls.push("disconnect");
        }
      })
    })).toThrow(/camera3 failed/);

    expect(runtimeContext.actorSystem.getActor("scene-window")).toBeNull();
    expect(runtimeContext.actorSystem.getActor("scene-window:view")).toBeNull();
    expect(runtimeContext.actorSystem.getActor("camera-3")).toBeNull();
    expect(runtimeContext.actorSystem.getActor("tesseract-4")).toBeNull();
    expect(mount.children).toHaveLength(1);
    expect(findChildByClass(mount.children[0], "workspace-root-dock-frame__content").children).toEqual([]);
    expect(resizeObserverCalls).toEqual(["observe:scene-window__viewport", "disconnect"]);
    expect(rendererCalls.at(-1)).toBe("dispose");
    expect(calls).not.toContain("runtime-register:camera3-motion-controller");
    expect(calls).not.toContain("runtime-unregister:camera3-motion-controller");

    runtimeContext.dispose();
  });

  it("rolls back installed camera component runtime registration when a later actor fails", () => {
    const document = new FakeDocument();
    const mount = document.createElement("div");
    const calls: string[] = [];
    const rendererCalls: string[] = [];
    const { runtimeContext } = createRuntimeContext(calls);
    const ownerFrame = createWorkspaceRootFrame(runtimeContext, mount, document);

    expect(() => installSceneViewContent({
      context: runtimeContext,
      mount: mount as unknown as HTMLElement,
      parentFrameActor: ownerFrame,
      actorIds: {
        sceneWindowActorId: "scene-window",
        sceneWindowActorName: "Scene",
        camera3GizmoActorId: "camera-3",
        camera3GizmoActorName: "Camera3",
        tesseract4ActorId: "scene-window:view",
        tesseract4ActorName: "Tesseract4"
      },
      contentId: "content:scene",
      contentRegistration: new WindowContentRegistry(),
      createRenderer: () => createFakeRenderer(document, rendererCalls),
      createCamera3GizmoView: createFakeCamera3Gizmo(document, calls)
    })).toThrow(/already exists|already registered/i);

    expect(runtimeContext.actorSystem.getActor("scene-window")).toBeNull();
    expect(runtimeContext.actorSystem.getActor("scene-window:view")).toBeNull();
    expect(runtimeContext.actorSystem.getActor("camera-3")).toBeNull();
    expect(calls).not.toContain("runtime-register:camera3-motion-controller");
    expect(calls).not.toContain("runtime-unregister:camera3-motion-controller");
    expect(calls).toContain("camera3-dispose");
    expect(rendererCalls.at(-1)).toBe("dispose");

    runtimeContext.dispose();
  });
});

describe("SceneViewFrameSourceRegistry", () => {
  it("selects renderable scene views through frame source snapshots", () => {
    const first = createSubject();
    const second = createSubject({
      actorIds: {
        sceneWindowActorId: "scene-window-2",
        camera3GizmoActorId: "camera-3-2",
        tesseract4ActorId: "tesseract-4-2"
      },
      rootFrameActorId: "workspace-root-frame-2"
    });
    const source = new SceneViewFrameSourceRegistry();

    const firstRegistration = source.register(first.runtime);
    const secondRegistration = source.register(second.runtime);
    expect(source.current).toBe(first.runtime);
    expect(source.listFrameSources()).toHaveLength(2);
    expect(source.listFrameSources()[0].getSnapshot()).toMatchObject({
      status: "ready",
      payload: { renderable: true }
    });
    firstRegistration.dispose();
    expect(source.current).toBe(second.runtime);
    secondRegistration.dispose();
    expect(source.current).toBeNull();

    first.runtime.dispose();
    second.runtime.dispose();
    first.runtimeContext.dispose();
    second.runtimeContext.dispose();
  });
});
