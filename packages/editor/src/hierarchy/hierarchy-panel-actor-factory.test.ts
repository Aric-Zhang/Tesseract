import { describe, expect, it } from "vitest";
import {
  ActorSystem,
  ComponentRegistry,
  createActorCreationScope
} from "actor-core";
import { installActorInputComponentDefinitions } from "actor-input";
import {
  installUiComponentDefinitions,
  type WindowContentLayoutCommit,
  type WindowContentLayoutCommitRegistration,
  type WindowContentRegistrationPort,
  type WindowRegisteredContent
} from "ui-framework";
import { installEditorStateObserverComponentDefinitions } from "../state-observer";
import { installHierarchyComponentDefinitions } from "./install-component-definitions";
import { createHierarchyPanelViewActor } from "./hierarchy-panel-actor-factory";
import { isHierarchyTreeItemActorId } from "./hierarchy-tree-item-actor-reconciler";

class FakeDocument {
  createElement(tagName: string): FakeElement {
    return new FakeElement(this, tagName);
  }
}

class FakeElement {
  readonly ownerDocument: FakeDocument;
  readonly tagName: string;
  readonly dataset: Record<string, string | undefined> = {};
  readonly style: Record<string, string> & { setProperty: (name: string, value: string) => void };
  readonly children: FakeElement[] = [];
  readonly attributes = new Map<string, string>();
  parentElement: FakeElement | null = null;
  className = "";
  textContent = "";
  hidden = false;
  tabIndex = -1;
  scrollLeft = 0;
  scrollTop = 0;
  clientWidth = 100;
  clientHeight = 100;
  scrollWidth = 100;
  scrollHeight = 100;

  constructor(ownerDocument: FakeDocument, tagName: string) {
    this.ownerDocument = ownerDocument;
    this.tagName = tagName;
    this.style = {
      setProperty: (name: string, value: string) => {
        this.style[name] = value;
      }
    } as Record<string, string> & { setProperty: (name: string, value: string) => void };
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
    return {
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      left: 0,
      top: 0,
      right: 100,
      bottom: 100,
      toJSON() {
        return this;
      }
    };
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }

  addEventListener(): void {}
}

class FakeWindowContentRegistry implements WindowContentRegistrationPort {
  registered: { readonly contentId: string; readonly element: HTMLElement } | null = null;

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
        if (this.registered?.contentId === request.contentId) {
          this.registered = null;
        }
      }
    };
  }

  getRegisteredContent(contentId: string): WindowRegisteredContent | null {
    if (this.registered?.contentId !== contentId) return null;
    return {
      contentId: this.registered.contentId,
      element: this.registered.element,
      interactable: true,
      setInteractable() {},
      subscribeLayoutCommit(): WindowContentLayoutCommitRegistration {
        return { dispose() {} };
      },
      dispose() {}
    };
  }
}

describe("createHierarchyPanelViewActor", () => {
  it("registers the same actor UI element as content and reconciles stable item actors", () => {
    const actorSystem = new ActorSystem();
    const componentRegistry = new ComponentRegistry({ actorSystem });
    installActorInputComponentDefinitions(componentRegistry);
    installUiComponentDefinitions(componentRegistry);
    installEditorStateObserverComponentDefinitions(componentRegistry);
    installHierarchyComponentDefinitions(componentRegistry);
    const context = createActorCreationScope({ actorSystem, componentRegistry });
    const parent = actorSystem.createActor({ id: "frame" });
    const document = new FakeDocument();
    const contentRegistration = new FakeWindowContentRegistry();
    const handle = createHierarchyPanelViewActor(context, {
      actorId: "hierarchy:view",
      parentActor: parent,
      objectSource: {
        listObjects: () => [
          { id: "scene", label: "Scene", parentId: null },
          { id: "camera", label: "Camera", parentId: "scene" }
        ]
      },
      document: document as unknown as Document,
      contentId: "content:hierarchy",
      contentRegistration
    });

    handle.component.updateFrame();
    handle.component.updateFrame();

    expect(contentRegistration.registered?.element).toBe(handle.component.element);
    expect(actorSystem.listChildren(handle.actor).filter((actor) => isHierarchyTreeItemActorId(actor.id))).toHaveLength(2);
    expect(handle.component.element.children.map((child) => child.dataset.uiTreeItemId)).toEqual(["scene", "camera"]);
  });
});
