import { describe, expect, it } from "vitest";
import { ActorSystem, ComponentRegistry, type RegisteredActor } from "../../actor-runtime";
import { installCoreComponentDefinitions } from "../../component-definitions";
import { gizmoEventBindingComponentType } from "../../gizmo-runtime";
import { stateObserverBindingComponentType } from "../../state-runtime";
import type { WindowControlSource } from "../../window-runtime";
import {
  appMenuBarComponentType,
  createAppMenuBarActor,
  installAppMenuComponentDefinitions
} from ".";

class FakeDocument {
  createElement(tagName: string): FakeElement {
    return new FakeElement(this, tagName);
  }
}

class FakeElement {
  readonly ownerDocument: FakeDocument;
  readonly tagName: string;
  readonly style: Record<string, string> = {};
  readonly children: FakeElement[] = [];
  readonly dataset: Record<string, string> = {};
  readonly attributes = new Map<string, string>();
  className = "";
  textContent = "";
  hidden = false;
  type = "";
  tabIndex = 0;
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

  replaceChildren(...children: FakeElement[]): void {
    for (const child of this.children) {
      child.parentElement = null;
    }
    this.children.length = 0;
    this.append(...children);
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
      width: 0,
      height: 0,
      left: 0,
      top: 0,
      right: 0,
      bottom: 0,
      toJSON() {
        return this;
      }
    };
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }
}

function createContext() {
  const actorSystem = new ActorSystem();
  const componentRegistry = new ComponentRegistry({
    actorSystem,
    commandSink: { submit() {} }
  });
  installCoreComponentDefinitions(componentRegistry);
  installAppMenuComponentDefinitions(componentRegistry);
  return {
    actorSystem,
    componentRegistry,
    trackRegisteredActor(_actor: RegisteredActor) {
      return { dispose() {} };
    }
  };
}

function createEmptyWindowSource(): WindowControlSource {
  return {
    listWindows: () => [],
    findWindowByViewKey: () => null,
    findWindowByVisiblePath: () => null
  };
}

describe("createAppMenuBarActor", () => {
  it("creates an actor-backed app menu with gizmo and state observer bindings", () => {
    const context = createContext();
    const document = new FakeDocument();
    const parent = document.createElement("div");

    const handle = createAppMenuBarActor(context, {
      actorId: "app-menu-bar",
      actorName: "App Menu",
      parent: parent as unknown as HTMLElement,
      document: document as unknown as Document,
      windowSource: createEmptyWindowSource()
    });

    expect(handle.actor.id).toBe("app-menu-bar");
    expect(handle.component).toBe(handle.actor.getComponent(appMenuBarComponentType));
    expect(handle.actor.getComponent(gizmoEventBindingComponentType)).not.toBeNull();
    expect(handle.actor.getComponent(stateObserverBindingComponentType)).not.toBeNull();
    expect(parent.children[0].className).toBe("app-menu-bar");
  });
});
