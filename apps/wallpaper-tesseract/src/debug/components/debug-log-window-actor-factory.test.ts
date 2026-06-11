import { describe, expect, it } from "vitest";
import { AppRuntimeContext } from "../../app-runtime";
import { installDebugLogComponentDefinitions } from "../../debug";
import type { RuntimeRegistration } from "../../runtime/ports";
import type {
  WindowContentRegistrationPort,
  WindowRegisteredContent
} from "../../window-runtime";
import { debugLogContentComponentType } from "./debug-log-content-component";
import { createDebugLogViewActor } from "./debug-log-window-actor-factory";

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

  constructor(ownerDocument: FakeDocument, tagName: string) {
    this.ownerDocument = ownerDocument;
    this.tagName = tagName;
  }
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
  const context = new AppRuntimeContext({
    gizmoEventSystem: {
      register() {
        throw new Error("Debug view actor should not register gizmos.");
      },
      dispose() {
        calls.push("gizmo-system-dispose");
      }
    },
    frameStateController: {
      submit() {
        throw new Error("Debug view actor should not submit frame state.");
      },
      subscribe() {
        throw new Error("Debug view actor should not subscribe to frame state.");
      },
      dispose() {
        calls.push("frame-system-dispose");
      }
    }
  });
  installDebugLogComponentDefinitions(context.componentRegistry);
  return { calls, context };
}

function createContentRegistration(calls: string[]): WindowContentRegistrationPort {
  const registered = new Map<string, WindowRegisteredContent>();
  return {
    getRegisteredContent(contentId): WindowRegisteredContent | null {
      return registered.get(contentId) ?? null;
    },
    registerContent(request): WindowRegisteredContent {
      calls.push(`register:${request.contentId}`);
      const content: WindowRegisteredContent = {
        contentId: request.contentId,
        element: request.element,
        interactable: request.interactable ?? true,
        setInteractable() {},
        subscribeLayoutCommit() {
          return createRegistration("layout-dispose", calls);
        },
        dispose() {
          calls.push(`content-dispose:${request.contentId}`);
        }
      };
      registered.set(request.contentId, content);
      return content;
    }
  };
}

describe("createDebugLogViewActor", () => {
  it("creates a registered debug content view under the supplied frame actor", () => {
    const { calls, context } = createContext();
    const parentActor = context.actorSystem.createActor({ id: "debug-frame" });

    const handle = createDebugLogViewActor(context, {
      actorId: "debug-view",
      parentActor,
      document: new FakeDocument() as unknown as Document,
      contentId: "content:debug",
      contentRegistration: createContentRegistration(calls)
    });

    expect(handle.actor.id).toBe("debug-view");
    expect(handle.component.actor).toBe(handle.actor);
    expect(context.actorSystem.getParent(handle.actor)).toBe(parentActor);
    expect(handle.component.type).toBe(debugLogContentComponentType);
    expect(handle.component.contentId).toBe("content:debug");
    expect(calls).toEqual(["register:content:debug"]);
  });

  it("disposes runtime tracking independently from the view actor tree", () => {
    const { calls, context } = createContext();
    const parentActor = context.actorSystem.createActor({ id: "debug-frame" });
    const handle = createDebugLogViewActor(context, {
      actorId: "debug-view",
      parentActor,
      document: new FakeDocument() as unknown as Document,
      contentId: "content:debug",
      contentRegistration: createContentRegistration(calls)
    });

    handle.disposeRuntimeTracking?.();
    handle.disposeRuntimeTracking?.();

    expect(context.actorSystem.getActor("debug-view")).toBe(handle.actor);
    expect(calls).toEqual(["register:content:debug"]);
  });

  it("disposes the view actor and registered content through the handle", () => {
    const { calls, context } = createContext();
    const parentActor = context.actorSystem.createActor({ id: "debug-frame" });
    const handle = createDebugLogViewActor(context, {
      actorId: "debug-view",
      parentActor,
      document: new FakeDocument() as unknown as Document,
      contentId: "content:debug",
      contentRegistration: createContentRegistration(calls)
    });
    calls.length = 0;

    handle.dispose();
    handle.dispose();

    expect(context.actorSystem.getActor("debug-view")).toBeNull();
    expect(calls).toEqual(["content-dispose:content:debug"]);
  });
});
