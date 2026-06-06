import { describe, expect, it } from "vitest";
import type { DockTargetRegionSource } from "./dock-target-region-source";
import {
  WindowDockPreviewComponent,
  WindowDockPreviewController
} from "./window-dock-preview-component";
import type { WindowDockTargetRegion } from "./window-dock-targets";

class FakeDocument {
  createElement(tagName: string): FakeElement {
    return new FakeElement(this, tagName);
  }
}

class FakeElement {
  readonly ownerDocument: FakeDocument;
  readonly tagName: string;
  readonly style: Record<string, string> = {};
  readonly dataset: Record<string, string> = {};
  readonly attributes = new Map<string, string>();
  readonly children: FakeElement[] = [];
  className = "";
  hidden = false;
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
    if (index >= 0) this.parentElement.children.splice(index, 1);
    this.parentElement = null;
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }
}

function rect(left: number, top: number, width: number, height: number): DOMRectReadOnly {
  return {
    x: left,
    y: top,
    left,
    top,
    right: left + width,
    bottom: top + height,
    width,
    height,
    toJSON() {
      return this;
    }
  };
}

function createTargetFrame(
  actorId: string,
  priority: number,
  left: number
): WindowDockTargetRegion {
  return {
    frameId: actorId,
    targetTabsetId: `frame-tabset:${actorId}`,
    stackPriority: priority,
    bounds: rect(left, 100, 300, 220),
    tabBounds: rect(left + 10, 106, 80, 24),
    contentBounds: rect(left, 132, 300, 188)
  };
}

function createSource(items: readonly WindowDockTargetRegion[]): DockTargetRegionSource {
  return {
    listDockTargetRegions: () => items
  };
}

describe("WindowDockPreviewComponent", () => {
  it("renders and clears a non-interactive preview rectangle", () => {
    const document = new FakeDocument();
    const parent = document.createElement("div");
    const component = new WindowDockPreviewComponent({
      parent: parent as unknown as HTMLElement,
      document: document as unknown as Document
    });

    component.show({
      kind: "split",
      targetFrameId: "target",
      targetTabsetId: "frame-tabset:target",
      placement: "left",
      rect: { left: 10, top: 20, right: 110, bottom: 220, width: 100, height: 200 }
    });

    expect(parent.children).toEqual([component.element as unknown as FakeElement]);
    expect(component.element.hidden).toBe(false);
    expect(component.element.className).toContain("window-dock-preview--split");
    expect(component.element.className).toContain("window-dock-preview--left");
    expect(component.element.dataset).toMatchObject({
      dockKind: "split",
      dockPlacement: "left",
      targetFrameId: "target",
      targetTabsetId: "frame-tabset:target"
    });
    expect(component.element.style).toMatchObject({
      left: "10px",
      top: "20px",
      width: "100px",
      height: "200px"
    });
    expect((component.element as unknown as FakeElement).attributes.get("aria-hidden")).toBe("true");

    component.clear();
    expect(component.element.hidden).toBe(true);
    expect(component.preview).toBeNull();
    expect(component.element.dataset).toEqual({});
  });
});

describe("WindowDockPreviewController", () => {
  it("shows a target preview after tab drag threshold and clears on end", () => {
    const document = new FakeDocument();
    const parent = document.createElement("div");
    const controller = new WindowDockPreviewController({
      parent: parent as unknown as HTMLElement,
      document: document as unknown as Document,
      source: createSource([
        createTargetFrame("source", 10, 10),
        createTargetFrame("target", 20, 100)
      ])
    });

    const source = {
      frameId: "source",
      viewActorId: "source:view",
      viewKey: "source-view"
    } as const;

    controller.beginTabDrag(source, { x: 20, y: 20 });
    controller.moveTabDrag({ x: 24, y: 24 });
    expect(controller.preview).toBeNull();
    expect(controller.state).toMatchObject({
      sessionState: "pending",
      source,
      preview: null,
      lastCompletedDrag: null
    });
    controller.moveTabDrag({ x: 130, y: 116 });

    expect(controller.preview).toMatchObject({
      kind: "merge-tabs",
      targetFrameId: "target",
      targetTabsetId: "frame-tabset:target"
    });
    expect(controller.state).toMatchObject({
      sessionState: "dragging",
      source,
      preview: {
        kind: "merge-tabs",
        targetFrameId: "target",
        targetTabsetId: "frame-tabset:target"
      }
    });
    expect(parent.children[0].hidden).toBe(false);

    const result = controller.endTabDrag();
    expect(result).toMatchObject({
      source,
      preview: { kind: "merge-tabs", targetFrameId: "target", targetTabsetId: "frame-tabset:target" }
    });
    expect(controller.preview).toBeNull();
    expect(controller.state.lastCompletedDrag).toMatchObject({
      source,
      preview: { kind: "merge-tabs", targetFrameId: "target", targetTabsetId: "frame-tabset:target" }
    });
    expect(parent.children[0].hidden).toBe(true);
  });
});
