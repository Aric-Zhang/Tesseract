import { describe, expect, it } from "vitest";
import {
  ActorSystem,
  ComponentRegistry,
  createActorCreationScope
} from "actor-system/core";
import { installActorInputComponentDefinitions } from "actor-system/input";
import {
  installActorUiComponentDefinitions,
  uiElementComponentType
} from "ui-framework/actor-ui";
import {
  installControlComponentDefinitions,
  toggleButtonComponentType,
  toolbarComponentType
} from "ui-framework/controls";
import type {
  WindowContentLayoutCommit,
  WindowContentLayoutCommitRegistration,
  WindowContentRegistrationPort,
  WindowRegisteredContent
} from "ui-framework/window";

import { editorStatePaths } from "../editor-state";
import { installEditorStateObserverComponentDefinitions } from "../state-observer";
import { stateObserverBindingComponentType } from "../state-observer/state-observer-binding-component";
import { installInspectorComponentDefinitions } from "./install-component-definitions";
import { inspectorContentComponentType } from "./inspector-content-component";
import { createInspectorViewActor } from "./inspector-view-actor-factory";

class FakeWindowContentRegistry implements WindowContentRegistrationPort {
  registered: { readonly contentId: string; readonly element: HTMLElement } | null = null;
  disposeCount = 0;

  registerContent(request: { readonly contentId: string; readonly element: HTMLElement }): WindowRegisteredContent {
    this.registered = request;
    return {
      contentId: request.contentId,
      element: request.element,
      interactable: true,
      setInteractable() {},
      subscribeLayoutCommit(_callback: (commit: WindowContentLayoutCommit) => void): WindowContentLayoutCommitRegistration {
        return { dispose() {} };
      },
      dispose: () => {
        this.disposeCount += 1;
        if (this.registered?.contentId === request.contentId) {
          this.registered = null;
        }
      }
    };
  }
}

describe("createInspectorViewActor", () => {
  it("builds an Inspector root, toolbar, lock button, and body actor subtree", () => {
    const fixture = createFixture();
    fixture.actorSystem.createActor({ id: "scene", name: "Scene View" });

    const handle = createInspectorViewActor(fixture.context, {
      actorId: "inspector:view",
      actorName: "Inspector View",
      parentActor: fixture.parent,
      document: fixture.document as unknown as Document,
      contentId: "content:inspector",
      contentRegistration: fixture.contentRegistration,
      selectionSource: {
        getSelectionSnapshot: () => ({
          selectedActorIds: ["scene"],
          activeActorId: "scene"
        })
      }
    });

    const toolbarActor = fixture.actorSystem.getActor("inspector:view:toolbar");
    const bodyActor = fixture.actorSystem.getActor("inspector:view:body");
    const lockActor = fixture.actorSystem.getActor("inspector:view:toolbar:lock");

    expect(fixture.contentRegistration.registered?.element).toBe(handle.component.element);
    expect(handle.component.element.className).toBe("inspector-window__content");
    expect(handle.inspectorContent.element.className).toBe("inspector-window__body");
    expect(handle.inspectorContent.element.textContent).toBe("Inspecting: Scene View");
    expect(toolbarActor).not.toBeNull();
    expect(bodyActor).not.toBeNull();
    expect(lockActor).not.toBeNull();
    expect(fixture.actorSystem.listChildren(handle.actor).map((actor) => actor.id)).toEqual([
      "inspector:view:toolbar",
      "inspector:view:body"
    ]);
    expect(fixture.actorSystem.listChildren(toolbarActor!).map((actor) => actor.id)).toEqual([
      "inspector:view:toolbar:lock"
    ]);
    expect(fixture.componentRegistry.getComponent(toolbarActor!, toolbarComponentType)).not.toBeNull();
    expect(fixture.componentRegistry.getComponent(lockActor!, toggleButtonComponentType)).toBe(handle.lockToggle);
  });

  it("delivers selection snapshots to the body actor through state observer binding", () => {
    const fixture = createFixture();
    fixture.actorSystem.createActor({ id: "scene", name: "Scene View" });
    fixture.actorSystem.createActor({ id: "camera", name: "Camera3" });
    let activeActorId = "scene";
    const handle = createInspectorViewActor(fixture.context, {
      actorId: "inspector:view",
      actorName: "Inspector View",
      parentActor: fixture.parent,
      document: fixture.document as unknown as Document,
      contentId: "content:inspector",
      contentRegistration: fixture.contentRegistration,
      selectionSource: {
        getSelectionSnapshot: () => ({
          selectedActorIds: [activeActorId],
          activeActorId
        })
      }
    });
    const bodyActor = fixture.actorSystem.getActor("inspector:view:body")!;
    const stateObserver = fixture.componentRegistry.getComponent(bodyActor, stateObserverBindingComponentType);

    activeActorId = "camera";
    stateObserver?.onStateChanged({
      frame: {} as never,
      changes: [{
        path: editorStatePaths.selection.snapshot,
        previousValue: { selectedActorIds: ["scene"], activeActorId: "scene" },
        nextValue: { selectedActorIds: ["camera"], activeActorId: "camera" },
        sources: [],
        commands: []
      }]
    });

    expect(stateObserver).not.toBeNull();
    expect(handle.inspectorContent.element.textContent).toBe("Inspecting: Camera3");
  });

  it("keeps toolbar toggle synchronized with direct body lock mutations and toggle activations", () => {
    const fixture = createFixture();
    fixture.actorSystem.createActor({ id: "scene", name: "Scene View" });
    fixture.actorSystem.createActor({ id: "camera", name: "Camera3" });
    const handle = createInspectorViewActor(fixture.context, {
      actorId: "inspector:view",
      actorName: "Inspector View",
      parentActor: fixture.parent,
      document: fixture.document as unknown as Document,
      contentId: "content:inspector",
      contentRegistration: fixture.contentRegistration,
      selectionSource: {
        getSelectionSnapshot: () => ({
          selectedActorIds: ["scene"],
          activeActorId: "scene"
        })
      }
    });

    handle.inspectorContent.setLocked(true);

    expect(handle.inspectorContent.locked).toBe(true);
    expect(handle.lockToggle.pressed).toBe(true);
    expect(handle.lockToggle.element.getAttribute("aria-label")).toBe("Unlock Inspector");
    expect(handle.lockToggle.element.title).toBe("Unlock Inspector");

    handle.lockToggle.onInputEnd({
      hit: {
        componentId: handle.lockToggle.id,
        partId: "toggle-button",
        kind: "control",
        region: "content-control",
        localRoutePriority: 0,
        hitPriority: 0,
        path: []
      },
      wasClick: true,
      timeStamp: 10
    } as never);

    expect(handle.inspectorContent.locked).toBe(false);
    expect(handle.lockToggle.pressed).toBe(false);
    expect(handle.lockToggle.element.getAttribute("aria-label")).toBe("Lock Inspector");
  });

  it("disposes root content registration when handle is disposed", () => {
    const fixture = createFixture();
    const handle = createInspectorViewActor(fixture.context, {
      actorId: "inspector:view",
      actorName: "Inspector View",
      parentActor: fixture.parent,
      document: fixture.document as unknown as Document,
      contentId: "content:inspector",
      contentRegistration: fixture.contentRegistration,
      selectionSource: {
        getSelectionSnapshot: () => null
      }
    });

    handle.dispose();

    expect(fixture.contentRegistration.registered).toBeNull();
    expect(fixture.contentRegistration.disposeCount).toBe(1);
    expect(fixture.actorSystem.hasActor(handle.actor)).toBe(false);
  });

  it("cleans up registration and created child actors if lock button creation fails", () => {
    const fixture = createFixture();

    expect(() => createInspectorViewActor(fixture.context, {
      actorId: "inspector:view",
      actorName: "Inspector View",
      parentActor: fixture.parent,
      contentId: "content:inspector",
      contentRegistration: fixture.contentRegistration,
      selectionSource: {
        getSelectionSnapshot: () => null
      },
      document: {
        createElement(tagName: string) {
          if (tagName === "button") {
            throw new Error("button creation failed");
          }
          return fixture.document.createElement(tagName) as unknown as HTMLElement;
        }
      } as Pick<Document, "createElement">
    })).toThrow("button creation failed");

    expect(fixture.contentRegistration.registered).toBeNull();
    expect(fixture.actorSystem.getActor("inspector:view")).toBeNull();
    expect(fixture.actorSystem.getActor("inspector:view:toolbar")).toBeNull();
    expect(fixture.actorSystem.getActor("inspector:view:body")).toBeNull();
  });
});

function createFixture(): {
  readonly actorSystem: ActorSystem;
  readonly componentRegistry: ComponentRegistry;
  readonly context: ReturnType<typeof createActorCreationScope>;
  readonly parent: ReturnType<ActorSystem["createActor"]>;
  readonly document: FakeDocument;
  readonly contentRegistration: FakeWindowContentRegistry;
} {
  const actorSystem = new ActorSystem();
  const componentRegistry = new ComponentRegistry({ actorSystem });
  installActorInputComponentDefinitions(componentRegistry);
  installActorUiComponentDefinitions(componentRegistry);
  installControlComponentDefinitions(componentRegistry);
  installEditorStateObserverComponentDefinitions(componentRegistry);
  installInspectorComponentDefinitions(componentRegistry);
  const context = createActorCreationScope({ actorSystem, componentRegistry });
  const parent = actorSystem.createActor({ id: "frame" });
  const document = new FakeDocument();
  const contentRegistration = new FakeWindowContentRegistry();
  return {
    actorSystem,
    componentRegistry,
    context,
    parent,
    document,
    contentRegistration
  };
}

class FakeDocument {
  createElement(tagName: string): FakeElement {
    return new FakeElement(this, tagName);
  }

  createElementNS(_namespace: string, tagName: string): FakeElement {
    return new FakeElement(this, tagName);
  }
}

class FakeElement {
  readonly ownerDocument: FakeDocument;
  readonly tagName: string;
  readonly dataset: Record<string, string | undefined> = {};
  readonly style: Record<string, string> = {};
  readonly children: FakeElement[] = [];
  readonly attributes = new Map<string, string>();
  className = "";
  textContent = "";
  ariaLabel = "";
  hidden = false;
  title = "";
  parentElement: FakeElement | null = null;

  constructor(ownerDocument: FakeDocument, tagName: string) {
    this.ownerDocument = ownerDocument;
    this.tagName = tagName;
  }

  append(...children: FakeElement[]): void {
    for (const child of children) {
      if (child.parentElement) {
        const index = child.parentElement.children.indexOf(child);
        if (index >= 0) child.parentElement.children.splice(index, 1);
      }
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

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }

  getAttribute(name: string): string | null {
    if (name === "aria-label") return this.ariaLabel || null;
    return this.attributes.get(name) ?? null;
  }

  removeAttribute(name: string): void {
    this.attributes.delete(name);
  }

  addEventListener(_type: string, _listener: (event: unknown) => void): void {}

  removeEventListener(_type: string, _listener: (event: unknown) => void): void {}
}
