import { describe, expect, it } from "vitest";
import { ActorSystem, ComponentRegistry } from "../actor-runtime";
import { installCoreComponentDefinitions } from "../component-definitions";
import { parameterPath, vec2 } from "../scene-runtime";
import { floatingWindowComponentType } from "./floating-window-component";
import { installWindowComponentDefinitions } from "./install-component-definitions";
import { createWindowMenuViewSource } from "./window-menu-view-source";

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
  rect: DOMRectReadOnly = createRect(0, 0, 320, 180);

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
    left: x,
    top: y,
    right: x + width,
    bottom: y + height,
    toJSON() {
      return this;
    }
  };
}

describe("WindowMenuViewSource", () => {
  it("lists one menu view per frame tab", () => {
    const actorSystem = new ActorSystem();
    const document = new FakeDocument();
    const parent = document.createElement("div");
    const registry = new ComponentRegistry({
      actorSystem,
      commandSink: { submit() {} }
    });
    installCoreComponentDefinitions(registry);
    installWindowComponentDefinitions(registry);
    const frameActor = actorSystem.createActor({ id: "debug-frame" });
    registry.addComponent(frameActor, floatingWindowComponentType, {
      id: "floating-window:debug",
      parent: parent as unknown as HTMLElement,
      document: document as unknown as Document,
      title: "Debug",
      paths: {
        position: parameterPath("debug.position"),
        size: parameterPath("debug.size"),
        visible: parameterPath("debug.visible")
      },
      initialState: {
        position: vec2(0, 0),
        size: vec2(320, 180),
        visible: true
      },
      tabs: [
        { viewActorId: "debug-view", viewKey: "debug", title: "Debug" },
        { viewActorId: "hierarchy-view", viewKey: "hierarchy", title: "Hierarchy" }
      ],
      activeViewActorId: "debug-view",
      windowMenu: {
        viewKey: "debug",
        label: "Debug",
        order: 100
      }
    });
    const source = createWindowMenuViewSource({ actorSystem });

    expect(source.listMenuViews().map((item) => ({
      frameActorId: item.frameActorId,
      viewActorId: item.viewActorId,
      viewKey: item.viewKey,
      label: item.label,
      activeTab: item.activeTab
    }))).toEqual([
      {
        frameActorId: "debug-frame",
        viewActorId: "debug-view",
        viewKey: "debug",
        label: "Debug",
        activeTab: true
      },
      {
        frameActorId: "debug-frame",
        viewActorId: "hierarchy-view",
        viewKey: "hierarchy",
        label: "Hierarchy",
        activeTab: false
      }
    ]);
    expect(source.findMenuViewByViewKey("hierarchy")?.viewActorId).toBe("hierarchy-view");
  });
});
