import { describe, expect, it } from "vitest";
import { AppRuntimeContext } from "../app-runtime";
import { installWallpaperComponentDefinitions } from "./install-component-definitions";
import type {
  RuntimeObject,
  RuntimeRegistration,
  SceneStateObserver
} from "../scene-runtime";
import { createDefaultSceneWindowState } from "../features/scene";
import type { SceneViewportRenderer } from "../features/scene/components";
import type { Camera3GizmoViewFactory } from "../gizmos/camera3/components";
import type {
  GizmoControllerRegistry,
  RuntimeObjectRegistry,
  SceneStateObserverRegistry
} from "../runtime/ports";
import { CurrentSceneViewSource, SceneViewRuntime } from "./scene-view-runtime";

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
    if (index >= 0) this.parentElement.children.splice(index, 1);
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
  const sceneRuntime = createRuntimeObjectRegistry(calls);
  const frameStateController: SceneStateObserverRegistry = {
    submit: () => {},
    subscribe: (observer: SceneStateObserver) => {
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
    sceneRuntime,
    frameStateController,
    gizmoEventSystem
  });
  installWallpaperComponentDefinitions(runtimeContext.componentRegistry);
  return { runtimeContext, sceneRuntime };
}

function createRuntimeObjectRegistry(calls: string[]): RuntimeObjectRegistry {
  const registrations = new Map<string, RuntimeObject>();
  return {
    register(object) {
      calls.push(`runtime-register:${object.id}`);
      registrations.set(object.id, object);
      return createRegistration(() => {
        calls.push(`runtime-unregister:${object.id}`);
        registrations.delete(object.id);
      });
    },
    dispose() {
      calls.push("runtime-dispose");
      registrations.clear();
    }
  };
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
  readonly actorIds?: Partial<ConstructorParameters<typeof SceneViewRuntime>[0]["actorIds"]>;
  readonly createCamera3Gizmo?: Camera3GizmoViewFactory;
}

function createSubject(options: CreateSubjectOptions = {}) {
  const document = new FakeDocument();
  const mount = document.createElement("div");
  const calls: string[] = [];
  const rendererCalls: string[] = [];
  const resizeObserverCalls: string[] = [];
  const resizeCallbacks: Array<() => void> = [];
  const { runtimeContext } = createRuntimeContext(calls);
  const runtime = new SceneViewRuntime({
    context: runtimeContext,
    mount: mount as unknown as HTMLElement,
    initialState: createDefaultSceneWindowState({ viewportWidth: 800, viewportHeight: 600 }),
    actorIds: {
      sceneWindowActorId: "scene-window",
      sceneWindowActorName: "Scene",
      camera3GizmoActorId: "camera-3",
      camera3GizmoActorName: "Camera3",
      tesseract4ActorId: "tesseract-4",
      tesseract4ActorName: "Tesseract4",
      ...options.actorIds
    },
    createRenderer: () => createFakeRenderer(document, rendererCalls),
    createCamera3Gizmo: options.createCamera3Gizmo ?? createFakeCamera3Gizmo(document, calls),
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
    devicePixelRatio: () => 2
  });
  return {
    calls,
    document,
    mount,
    rendererCalls,
    resizeCallbacks,
    resizeObserverCalls,
    runtime,
    runtimeContext
  };
}

describe("SceneViewRuntime", () => {
  it("creates the Scene frame, Scene view, Camera3, and Tesseract actor tree", () => {
    const subject = createSubject();
    const sceneViewActor = subject.runtime.sceneWindow.viewport.actor;

    expect(subject.runtimeContext.actorSystem.getActor("scene-window")).toBe(subject.runtime.actor);
    expect(sceneViewActor.id).toBe("scene-window:view");
    expect(subject.runtimeContext.actorSystem.getParentId(sceneViewActor)).toBe("scene-window");
    expect(subject.runtimeContext.actorSystem.getParentId(subject.runtimeContext.actorSystem.getActor("camera-3")!))
      .toBe("scene-window:view");
    expect(subject.runtimeContext.actorSystem.getParentId(subject.runtimeContext.actorSystem.getActor("tesseract-4")!))
      .toBe("scene-window:view");
    expect(subject.calls).toContain("runtime-register:camera3-motion-controller");
    expect(subject.resizeObserverCalls).toEqual(["observe:scene-window__viewport"]);

    subject.runtime.dispose();
    subject.runtimeContext.dispose();
  });

  it("measures, renders, and disposes without leaking observers or actors", () => {
    const subject = createSubject();
    const root = subject.mount.children[0];
    const content = findChildByClass(root, "floating-gizmo-window__content");
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
    expect(subject.runtimeContext.actorSystem.getActor("scene-window")).toBeNull();
    expect(subject.runtimeContext.actorSystem.getActor("scene-window:view")).toBeNull();
    expect(subject.runtimeContext.actorSystem.getActor("camera-3")).toBeNull();
    expect(subject.runtimeContext.actorSystem.getActor("tesseract-4")).toBeNull();
    expect(subject.calls).toContain("runtime-unregister:camera3-motion-controller");

    subject.runtimeContext.dispose();
  });

  it("allows the same scene actor ids to be recreated after dispose", () => {
    const first = createSubject();
    first.runtime.dispose();
    first.runtimeContext.dispose();

    const second = createSubject();

    expect(second.runtimeContext.actorSystem.getActor("scene-window")).toBeTruthy();
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

    expect(() => new SceneViewRuntime({
      context: runtimeContext,
      mount: mount as unknown as HTMLElement,
      initialState: createDefaultSceneWindowState({ viewportWidth: 800, viewportHeight: 600 }),
      actorIds: {
        sceneWindowActorId: "scene-window",
        sceneWindowActorName: "Scene",
        camera3GizmoActorId: "camera-3",
        camera3GizmoActorName: "Camera3",
        tesseract4ActorId: "tesseract-4",
        tesseract4ActorName: "Tesseract4"
      },
      createRenderer: () => createFakeRenderer(document, rendererCalls),
      createCamera3Gizmo: () => {
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
    expect(mount.children).toEqual([]);
    expect(resizeObserverCalls).toEqual(["observe:scene-window__viewport", "disconnect"]);
    expect(rendererCalls.at(-1)).toBe("dispose");
    expect(calls).not.toContain("runtime-register:camera3-motion-controller");

    runtimeContext.dispose();
  });

  it("rolls back motion registration when a later actor creation fails", () => {
    const document = new FakeDocument();
    const mount = document.createElement("div");
    const calls: string[] = [];
    const rendererCalls: string[] = [];
    const { runtimeContext } = createRuntimeContext(calls);

    expect(() => new SceneViewRuntime({
      context: runtimeContext,
      mount: mount as unknown as HTMLElement,
      initialState: createDefaultSceneWindowState({ viewportWidth: 800, viewportHeight: 600 }),
      actorIds: {
        sceneWindowActorId: "scene-window",
        sceneWindowActorName: "Scene",
        camera3GizmoActorId: "camera-3",
        camera3GizmoActorName: "Camera3",
        tesseract4ActorId: "scene-window",
        tesseract4ActorName: "Tesseract4"
      },
      createRenderer: () => createFakeRenderer(document, rendererCalls),
      createCamera3Gizmo: createFakeCamera3Gizmo(document, calls)
    })).toThrow(/already exists|already registered/i);

    expect(runtimeContext.actorSystem.getActor("scene-window")).toBeNull();
    expect(runtimeContext.actorSystem.getActor("scene-window:view")).toBeNull();
    expect(runtimeContext.actorSystem.getActor("camera-3")).toBeNull();
    expect(calls).toContain("runtime-register:camera3-motion-controller");
    expect(calls).toContain("runtime-unregister:camera3-motion-controller");
    expect(calls).toContain("camera3-dispose");
    expect(rendererCalls.at(-1)).toBe("dispose");

    runtimeContext.dispose();
  });
});

describe("CurrentSceneViewSource", () => {
  it("clears only the currently registered runtime", () => {
    const first = createSubject();
    const second = createSubject();
    const source = new CurrentSceneViewSource();

    source.setCurrent(first.runtime);
    source.clear(second.runtime);
    expect(source.current).toBe(first.runtime);
    source.clear(first.runtime);
    expect(source.current).toBeNull();

    first.runtime.dispose();
    second.runtime.dispose();
    first.runtimeContext.dispose();
    second.runtimeContext.dispose();
  });
});
