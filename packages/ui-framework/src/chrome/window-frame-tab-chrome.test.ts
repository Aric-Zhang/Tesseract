import { describe, expect, it } from "vitest";
import { renderWindowFrameTabsetTabs } from "./window-frame-tab-chrome";
import type { WindowFrameDockTreeTabsetNode } from "../model/window-frame-dock-tree";
import type { WindowFrameTab } from "../model/window-frame-tab";

describe("renderWindowFrameTabsetTabs", () => {
  it("renders shared tab chrome with stable accessibility state", () => {
    const document = new FakeDocument();
    const target = document.createElement("div");
    const tabs: WindowFrameTab[] = [
      { viewActorId: "scene-view", viewKey: "scene", title: "Scene" },
      { viewActorId: "debug-view", viewKey: "debug", title: "Debug" }
    ];
    const tabset: WindowFrameDockTreeTabsetNode = {
      kind: "tabset",
      id: "tabset",
      tabs: ["scene-view", "debug-view"],
      activeViewActorId: "debug-view"
    };

    renderWindowFrameTabsetTabs({
      document: document as unknown as Pick<Document, "createElement">,
      maps: {
        tabsByViewActorId: new Map(),
        actionsByViewActorId: new Map()
      },
      tabs,
      tabset,
      target: target as unknown as HTMLElement
    });

    expect(target.getAttribute("role")).toBe("tablist");
    expect(target.children).toHaveLength(2);
    expect(target.children[0].getAttribute("role")).toBe("tab");
    expect(target.children[0].getAttribute("aria-selected")).toBe("false");
    expect(target.children[1].getAttribute("aria-selected")).toBe("true");
    expect(target.children[1].tabIndex).toBe(-1);
    expect(target.children[1].children[0].ariaLabel).toBe("Close Debug");
  });
});

class FakeDocument {
  createElement(tagName: string): FakeElement {
    return new FakeElement(tagName);
  }
}

class FakeElement {
  readonly children: FakeElement[] = [];
  readonly attributes = new Map<string, string>();
  className = "";
  textContent = "";
  type = "";
  tabIndex = 0;
  ariaLabel = "";

  constructor(readonly tagName: string) {}

  append(...children: FakeElement[]): void {
    this.children.push(...children);
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }

  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }
}
