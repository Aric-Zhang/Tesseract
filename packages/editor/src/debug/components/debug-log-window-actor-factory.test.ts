import { describe, expect, it } from "vitest";
import {
  ActorSystem,
  ComponentRegistry,
  createActorCreationScope
} from "actor-core";
import {
  installUiComponentDefinitions,
  type WindowContentLayoutCommit,
  type WindowContentLayoutCommitRegistration,
  type WindowContentRegistrationPort,
  type WindowRegisteredContent
} from "ui-framework";
import { installDebugLogComponentDefinitions } from "../install-component-definitions";
import { createDebugLogViewActor } from "./debug-log-window-actor-factory";
import { isDebugLogEntryActorId } from "./debug-log-entry-actor-reconciler";

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
  scrollLeft = 0;
  scrollTop = 0;
  clientWidth = 100;
  clientHeight = 40;
  scrollWidth = 100;
  scrollHeight = 40;

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

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }

  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
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

describe("createDebugLogViewActor", () => {
  it("registers the same actor UI element as content and reconciles log item actors", () => {
    const fixture = createFixture();
    const handle = fixture.createDebugView({ maxLines: 2 });

    expect(fixture.contentRegistration.registered?.element).toBe(handle.component.element);
    expect(handle.component.element.children.map((child) => child.dataset.uiListItemId))
      .toEqual(["debug-log-placeholder"]);

    handle.component.append({ type: "move", message: "first", timeStamp: 1 });
    handle.component.append({ type: "move", message: "second", timeStamp: 2 });
    handle.component.updateFrame({} as never);
    const retainedEntryActorId = fixture.actorSystem.listChildren(handle.actor)
      .find((actor) => actor.id.endsWith(":log-entry:2"))?.id;

    handle.component.append({ type: "move", message: "third", timeStamp: 3 });
    handle.component.updateFrame({} as never);

    expect(handle.component.element.children.map((child) => child.textContent)).toEqual([
      "    2 second",
      "    3 third"
    ]);
    expect(fixture.actorSystem.listChildren(handle.actor)
      .filter((actor) => isDebugLogEntryActorId(actor.id))).toHaveLength(2);
    expect(retainedEntryActorId).toBeDefined();
    expect(fixture.actorSystem.getActor(retainedEntryActorId!)).not.toBeNull();
  });

  it("destroys log item actors on dispose", () => {
    const fixture = createFixture();
    const handle = fixture.createDebugView();
    handle.component.append({ type: "move", message: "entry", timeStamp: 1 });
    handle.component.updateFrame({} as never);
    const itemActorIds = fixture.actorSystem.listChildren(handle.actor)
      .filter((actor) => isDebugLogEntryActorId(actor.id))
      .map((actor) => actor.id);

    handle.dispose();

    expect(itemActorIds).toHaveLength(1);
    expect(itemActorIds.every((actorId) => fixture.actorSystem.getActor(actorId) === null)).toBe(true);
    expect(fixture.contentRegistration.registered).toBeNull();
  });
});

function createFixture(): {
  readonly actorSystem: ActorSystem;
  readonly componentRegistry: ComponentRegistry;
  readonly document: FakeDocument;
  readonly contentRegistration: FakeWindowContentRegistry;
  readonly createDebugView: (options?: { readonly maxLines?: number }) => ReturnType<typeof createDebugLogViewActor>;
} {
  const actorSystem = new ActorSystem();
  const componentRegistry = new ComponentRegistry({ actorSystem });
  installUiComponentDefinitions(componentRegistry);
  installDebugLogComponentDefinitions(componentRegistry);
  const context = createActorCreationScope({ actorSystem, componentRegistry });
  const parent = actorSystem.createActor({ id: "frame" });
  const document = new FakeDocument();
  const contentRegistration = new FakeWindowContentRegistry();
  return {
    actorSystem,
    componentRegistry,
    document,
    contentRegistration,
    createDebugView(options) {
      return createDebugLogViewActor(context, {
        actorId: "debug:view",
        parentActor: parent,
        maxLines: options?.maxLines,
        document: document as unknown as Document,
        contentId: "content:debug",
        contentRegistration
      });
    }
  };
}
