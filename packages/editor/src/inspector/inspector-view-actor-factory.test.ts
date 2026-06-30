import { describe, expect, it } from "vitest";
import {
  ActorSystem,
  ComponentRegistry,
  createActorCreationScope
} from "actor-system/core";
import { installActorUiComponentDefinitions } from "ui-framework/actor-ui";
import type {
  WindowContentLayoutCommit,
  WindowContentLayoutCommitRegistration,
  WindowContentRegistrationPort,
  WindowRegisteredContent
} from "ui-framework/window";

import { installEditorStateObserverComponentDefinitions } from "../state-observer";
import { installInspectorComponentDefinitions } from "./install-component-definitions";
import { createInspectorViewActor } from "./inspector-view-actor-factory";

class FakeDocument {
  createElement(tagName: string): FakeElement {
    return new FakeElement(this, tagName);
  }
}

class FakeElement {
  readonly ownerDocument: FakeDocument;
  readonly tagName: string;
  readonly dataset: Record<string, string | undefined> = {};
  className = "";
  textContent = "";
  hidden = false;
  parentElement: FakeElement | null = null;

  constructor(ownerDocument: FakeDocument, tagName: string) {
    this.ownerDocument = ownerDocument;
    this.tagName = tagName;
  }

  remove(): void {
    this.parentElement = null;
  }
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
}

describe("createInspectorViewActor", () => {
  it("registers the same actor UI element as window content and follows initial selection", () => {
    const actorSystem = new ActorSystem();
    const componentRegistry = new ComponentRegistry({ actorSystem });
    installActorUiComponentDefinitions(componentRegistry);
    installEditorStateObserverComponentDefinitions(componentRegistry);
    installInspectorComponentDefinitions(componentRegistry);
    actorSystem.createActor({ id: "scene", name: "Scene View" });
    const context = createActorCreationScope({ actorSystem, componentRegistry });
    const parent = actorSystem.createActor({ id: "frame" });
    const contentRegistration = new FakeWindowContentRegistry();
    const handle = createInspectorViewActor(context, {
      actorId: "inspector:view",
      actorName: "Inspector View",
      parentActor: parent,
      document: new FakeDocument() as unknown as Document,
      contentId: "content:inspector",
      contentRegistration,
      selectionSource: {
        getSelectionSnapshot: () => ({
          selectedActorIds: ["scene"],
          activeActorId: "scene"
        })
      }
    });

    expect(contentRegistration.registered?.element).toBe(handle.component.element);
    expect(handle.component.element.className).toBe("inspector-window__content");
    expect(handle.component.element.textContent).toBe("Inspecting: Scene View");
    expect(actorSystem.listChildren(parent)).toContain(handle.actor);
  });
});
