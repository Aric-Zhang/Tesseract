import { describe, expect, it } from "vitest";
import type { GizmoController, GizmoEndEvent, GizmoHit, GizmoStartEvent } from "gizmo-core";
import { AppRuntimeContext } from "../../app-runtime";
import { installCoreComponentDefinitions } from "../../component-definitions";
import { installDebugLogComponentDefinitions } from "../../debug";
import { installWindowComponentDefinitions } from "../../window-runtime";
import {
  sceneParameterPaths,
  type RuntimeObject,
  type RuntimeRegistration,
  type SceneStateObserver,
  type SceneUpdateCommand
} from "../../scene-runtime";
import { gizmoEventBindingComponentType } from "../../gizmo-runtime";
import { stateObserverBindingComponentType } from "../../state-runtime";
import { floatingWindowComponentType } from "../../window-runtime";
import { createDefaultDebugWindowState } from "../debug-window-parameters";
import { debugLogContentComponentType } from "./debug-log-content-component";
import { createDebugLogWindowActor } from "./debug-log-window-actor-factory";

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
    return {
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      toJSON() {
        return this;
      }
    };
  }
}

function findChildByClass(element: FakeElement, className: string): FakeElement {
  const child = element.children.find((candidate) => candidate.className.split(" ").includes(className));
  if (!child) {
    throw new Error(`Missing child with class: ${className}`);
  }
  return child;
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

function setWindowRects(root: FakeElement): void {
  root.getBoundingClientRect = () => createRect(10, 20, 320, 180);
  const titlebar = findChildByClass(root, "floating-gizmo-window__titlebar");
  titlebar.getBoundingClientRect = () => createRect(10, 20, 320, 32);
  findChildByClass(titlebar, "floating-gizmo-window__close").getBoundingClientRect = () => createRect(294, 24, 28, 24);
  findChildByClass(root, "floating-gizmo-window__resize--top-left").getBoundingClientRect = () => createRect(10, 20, 10, 10);
  findChildByClass(root, "floating-gizmo-window__resize--top-right").getBoundingClientRect = () => createRect(320, 20, 10, 10);
  findChildByClass(root, "floating-gizmo-window__resize--bottom-left").getBoundingClientRect = () => createRect(10, 190, 10, 10);
  findChildByClass(root, "floating-gizmo-window__resize--bottom-right").getBoundingClientRect = () => createRect(320, 190, 10, 10);
  findChildByClass(root, "floating-gizmo-window__resize--left").getBoundingClientRect = () => createRect(10, 20, 6, 180);
  findChildByClass(root, "floating-gizmo-window__resize--right").getBoundingClientRect = () => createRect(324, 20, 6, 180);
  findChildByClass(root, "floating-gizmo-window__resize--top").getBoundingClientRect = () => createRect(10, 20, 320, 6);
  findChildByClass(root, "floating-gizmo-window__resize--bottom").getBoundingClientRect = () => createRect(10, 194, 320, 6);
}

function createStartEvent(gizmo: GizmoController, hit: GizmoHit): GizmoStartEvent {
  return {
    gizmo,
    hit,
    pointerId: 1,
    pointerType: "mouse",
    timeStamp: 10,
    point: { x: 300, y: 30 },
    startPoint: { x: 300, y: 30 },
    buttons: 1
  };
}

function createEndEvent(gizmo: GizmoController, hit: GizmoHit): GizmoEndEvent {
  return {
    ...createStartEvent(gizmo, hit),
    timeStamp: 11,
    totalDelta: { dx: 0, dy: 0 },
    wasClick: true
  };
}

function createRegistration(label: string, calls: string[]): RuntimeRegistration {
  return {
    dispose() {
      calls.push(label);
    }
  };
}

function createContext() {
  const calls: string[] = [];
  const registeredGizmos: GizmoController[] = [];
  const observers: SceneStateObserver[] = [];
  const frameStateController = {
    submit(command: SceneUpdateCommand): void {
      calls.push(`frame-submit:${command.target}`);
    },
    subscribe(observer: SceneStateObserver): RuntimeRegistration {
      calls.push("observer-subscribe");
      observers.push(observer);
      return createRegistration("observer-dispose", calls);
    },
    dispose(): void {
      calls.push("frame-system-dispose");
    }
  };
  const context = new AppRuntimeContext({
    sceneRuntime: {
      register(object: RuntimeObject): RuntimeRegistration {
        calls.push(`scene-register:${object.id}`);
        return createRegistration(`scene-dispose:${object.id}`, calls);
      },
      dispose(): void {
        calls.push("scene-system-dispose");
      }
    },
    gizmoEventSystem: {
      register(object: GizmoController): RuntimeRegistration {
        calls.push(`gizmo-register:${object.id}`);
        registeredGizmos.push(object);
        return createRegistration(`gizmo-dispose:${object.id}`, calls);
      },
      dispose(): void {
        calls.push("gizmo-system-dispose");
      }
    },
    frameStateController
  });
  installCoreComponentDefinitions(context.componentRegistry);
  installWindowComponentDefinitions(context.componentRegistry);
  installDebugLogComponentDefinitions(context.componentRegistry);
  return { calls, context, frameStateController, observers, registeredGizmos };
}

describe("createDebugLogWindowActor", () => {
  it("creates a window actor and returns a RegisteredWindowActor handle", () => {
    const { context } = createContext();
    const document = new FakeDocument();
    const parent = document.createElement("div");

    const handle = createDebugLogWindowActor(context, {
      actorId: "debug-actor",
      parent: parent as unknown as HTMLElement,
      document: document as unknown as Document,
      initialState: createDefaultDebugWindowState()
    });

    expect(handle.actor.id).toBe("debug-actor");
    expect(handle.component.actor.id).toBe("debug-actor:view");
    expect(context.actorSystem.getParent(handle.component.actor)).toBe(handle.actor);
    expect(handle.window.type).toBe(floatingWindowComponentType);
    expect(handle.component.type).toBe(debugLogContentComponentType);
    expect(context.actorSystem.getActor("debug-actor")).toBe(handle.actor);
  });

  it("auto-adds gizmo and state observer bindings once", () => {
    const { calls, context, registeredGizmos, observers } = createContext();
    const document = new FakeDocument();
    const parent = document.createElement("div");

    const handle = createDebugLogWindowActor(context, {
      actorId: "debug-actor",
      parent: parent as unknown as HTMLElement,
      document: document as unknown as Document,
      initialState: createDefaultDebugWindowState()
    });

    expect(handle.actor.hasComponent(gizmoEventBindingComponentType)).toBe(true);
    expect(handle.actor.hasComponent(stateObserverBindingComponentType)).toBe(true);
    expect(registeredGizmos).toHaveLength(1);
    expect(observers).toHaveLength(1);
    expect(calls.filter((call) => call.startsWith("gizmo-register:"))).toEqual([
      "gizmo-register:debug-actor:gizmo-event-binding"
    ]);
    expect(calls.filter((call) => call === "observer-subscribe")).toHaveLength(1);
  });

  it("mounts debug content into the floating window and preserves append/updateFrame behavior", () => {
    const { context } = createContext();
    const document = new FakeDocument();
    const parent = document.createElement("div");

    const handle = createDebugLogWindowActor(context, {
      parent: parent as unknown as HTMLElement,
      document: document as unknown as Document,
      initialState: createDefaultDebugWindowState(),
      maxLines: 1
    });
    handle.component.append({ type: "hit", message: "first", timeStamp: 1 });
    handle.component.append({ type: "move", message: "second", timeStamp: 2 });
    context.actorSystem.updateFrame({ timeMs: 0, deltaMs: 0, frameIndex: 0 });

    expect(handle.component.content.textContent).toBe("    2 second");
  });

  it("routes state and gizmo events through bindings to the floating window", () => {
    const { calls, context, observers, registeredGizmos } = createContext();
    const document = new FakeDocument();
    const parent = document.createElement("div");
    const handle = createDebugLogWindowActor(context, {
      actorId: "debug-actor",
      parent: parent as unknown as HTMLElement,
      document: document as unknown as Document,
      initialState: createDefaultDebugWindowState()
    });
    const root = parent.children[0];
    if (!root) throw new Error("Expected window root.");
    setWindowRects(root);
    const binding = registeredGizmos[0];
    if (!binding) throw new Error("Expected registered binding.");
    observers[0]?.onSceneStateChanged({
      frame: { timeMs: 0, deltaMs: 0, frameIndex: 0 },
      changes: [{
        path: sceneParameterPaths.debugWindow.visible,
        previousValue: true,
        nextValue: false,
        sources: [],
        commands: []
      }]
    });

    expect(handle.window.state.visible).toBe(false);
    expect(root.hidden).toBe(true);

    observers[0]?.onSceneStateChanged({
      frame: { timeMs: 1, deltaMs: 1, frameIndex: 1 },
      changes: [{
        path: sceneParameterPaths.debugWindow.visible,
        previousValue: false,
        nextValue: true,
        sources: [],
        commands: []
      }]
    });
    calls.length = 0;
    const hit = binding.hitTest({ x: 300, y: 30 });
    if (!hit) throw new Error("Expected close hit.");
    binding.onGizmoStart?.(createStartEvent(binding, hit));
    binding.onGizmoEnd?.(createEndEvent(binding, hit));

    expect(calls).toEqual([`frame-submit:${sceneParameterPaths.debugWindow.visible}`]);
  });

  it("disposes the actor handle, window, content, and bridge registrations idempotently", () => {
    const { calls, context } = createContext();
    const document = new FakeDocument();
    const parent = document.createElement("div");
    const handle = createDebugLogWindowActor(context, {
      actorId: "debug-actor",
      parent: parent as unknown as HTMLElement,
      document: document as unknown as Document,
      initialState: createDefaultDebugWindowState()
    });
    calls.length = 0;

    handle.dispose();
    handle.dispose();

    expect(context.actorSystem.getActor("debug-actor")).toBeNull();
    expect(parent.children).toEqual([]);
    expect(calls).toEqual([
      "observer-dispose",
      "gizmo-dispose:debug-actor:gizmo-event-binding"
    ]);
  });

  it("context.dispose releases a still-live debug window actor handle", () => {
    const { context } = createContext();
    const document = new FakeDocument();
    const parent = document.createElement("div");

    createDebugLogWindowActor(context, {
      actorId: "debug-actor",
      parent: parent as unknown as HTMLElement,
      document: document as unknown as Document,
      initialState: createDefaultDebugWindowState()
    });

    context.dispose();

    expect(context.actorSystem.getActor("debug-actor")).toBeNull();
    expect(parent.children).toEqual([]);
  });
});
