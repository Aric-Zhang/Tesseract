import { describe, expect, it } from "vitest";
import { ActorSystem } from "actor-core";
import type { ActorInputHit, ActorInputMoveEvent } from "actor-input";
import { WindowFrameSurfaceComponent, type WindowFrameSurfaceHost } from "./window-frame-surface-component";
import type { WindowFrameTab } from "../model/window-frame-tab";

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
  rect: DOMRectReadOnly = createRect(0, 0, 0, 0);

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
    top: y,
    left: x,
    right: x + width,
    bottom: y + height,
    toJSON() {
      return this;
    }
  };
}

function createTab(viewActorId: string, title: string): WindowFrameTab {
  return {
    viewActorId,
    viewKey: viewActorId.replace("-view", ""),
    title
  };
}

function createSubject(options: { effectiveVisible?: boolean } = {}) {
  const actorSystem = new ActorSystem();
  const actor = actorSystem.createActor({ id: "frame" });
  const document = new FakeDocument();
  const tabbar = document.createElement("div");
  const content = document.createElement("div");
  const surface = new WindowFrameSurfaceComponent(actor, { id: "surface:test" });
  let effectiveVisible = options.effectiveVisible ?? true;
  const host: WindowFrameSurfaceHost = {
    id: "host",
    document: document as unknown as Document,
    primaryTabbar: tabbar as unknown as HTMLElement,
    primaryContent: content as unknown as HTMLElement,
    splitMinPaneSize: 80,
    classes: {
      pane: "pane",
      paneTabs: "pane-tabs",
      paneContent: "pane-content",
      split: "split",
      splitHorizontal: "split--horizontal",
      splitVertical: "split--vertical",
      splitter: "splitter",
      splitterHorizontal: "splitter--horizontal",
      splitterVertical: "splitter--vertical",
      tab: "tab",
      tabClose: "tab-close"
    },
    getEffectiveVisible: () => effectiveVisible,
    getInputStackPriority: () => 123,
    getDockTargetFallbackBounds: () => ({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 400,
      bottom: 300,
      width: 400,
      height: 300
    })
  };
  return {
    actor,
    actorSystem,
    content,
    document,
    host,
    setEffectiveVisible: (visible: boolean) => {
      effectiveVisible = visible;
      surface.refreshActiveContentState();
    },
    surface,
    tabbar
  };
}

function findChildrenByClass(element: FakeElement, className: string): FakeElement[] {
  const matches: FakeElement[] = [];
  for (const child of element.children) {
    if (child.className.split(" ").includes(className)) {
      matches.push(child);
    }
    matches.push(...findChildrenByClass(child, className));
  }
  return matches;
}

describe("WindowFrameSurfaceComponent", () => {
  it("owns tab chrome, content placement, and active content state", () => {
    const { content, document, host, setEffectiveVisible, surface, tabbar } = createSubject();

    surface.configure({ tabs: [createTab("debug-view", "Debug")] });
    surface.attachHost(host);
    const debugContent = document.createElement("section");
    const debugAttachment = surface.getContentHost("debug-view").mountContent(debugContent as unknown as HTMLElement);

    expect(tabbar.children).toHaveLength(1);
    expect(content.children).toEqual([debugContent]);
    expect(debugAttachment.interactable).toBe(true);
    expect(surface.isContentInteractable(debugContent as unknown as HTMLElement)).toBe(true);

    surface.addTab(createTab("hierarchy-view", "Hierarchy"), { active: true });
    const hierarchyContent = document.createElement("section");
    const hierarchyAttachment =
      surface.getContentHost("hierarchy-view").mountContent(hierarchyContent as unknown as HTMLElement);

    expect(debugContent.hidden).toBe(true);
    expect(debugAttachment.interactable).toBe(false);
    expect(hierarchyContent.hidden).toBe(false);
    expect(hierarchyAttachment.interactable).toBe(true);

    setEffectiveVisible(false);

    expect(hierarchyContent.hidden).toBe(true);
    expect(hierarchyAttachment.interactable).toBe(false);
  });

  it("routes tab action hits and split resize through the shared surface", () => {
    const { content, host, surface, tabbar } = createSubject();
    surface.configure({ tabs: [createTab("debug-view", "Debug")] });
    surface.attachHost(host);

    tabbar.rect = createRect(0, 0, 200, 24);
    const tab = findChildrenByClass(tabbar, "tab")[0];
    if (!tab) throw new Error("Expected a rendered tab.");
    const close = findChildrenByClass(tab, "tab-close")[0];
    if (!close) throw new Error("Expected a rendered tab close action.");
    tab.rect = createRect(0, 0, 120, 24);
    close.rect = createRect(96, 4, 16, 16);

    expect(surface.hitTest({ x: 100, y: 10 })?.part).toBe("tab-action");
    expect(surface.hitTest({ x: 20, y: 10 })?.part).toBe("tab");

    const targetTabsetId = surface.getRuntimeDockRoot().id;
    surface.splitTab(createTab("scene-view", "Scene"), {
      targetTabsetId,
      placement: "right",
      active: true
    });
    const split = findChildrenByClass(content, "split")[0];
    const splitter = findChildrenByClass(content, "splitter")[0];
    if (!split || !splitter) throw new Error("Expected split DOM.");
    split.rect = createRect(0, 24, 400, 240);
    splitter.rect = createRect(198, 24, 4, 240);

    const hit = surface.hitTest({ x: 200, y: 100 });
    expect(hit?.part).toBe("splitter");
    surface.beginSplitResize(hit?.data);
    surface.updateSplitRatioFromDrag(createActorInputMoveEvent(createActorInputHit("surface", {
      partId: "splitter"
    }), {
      totalDelta: { dx: 80, dy: 0 }
    }));

    const root = surface.getRuntimeDockRoot();
    expect(root.kind).toBe("split");
    if (root.kind === "split") {
      expect(root.ratio).toBeGreaterThan(0.5);
    }
  });

  it("activates tabs within their split pane without moving content to the frame root", () => {
    const { content, document, host, surface } = createSubject();
    surface.configure({ tabs: [createTab("debug-view", "Debug")] });
    surface.attachHost(host);
    const debugContent = document.createElement("section");
    surface.getContentHost("debug-view").mountContent(debugContent as unknown as HTMLElement);

    const initialRoot = surface.getRuntimeDockRoot();
    if (initialRoot.kind !== "tabset") throw new Error("Expected initial tabset.");
    surface.splitTab(createTab("scene-view", "Scene"), {
      targetTabsetId: initialRoot.id,
      placement: "right",
      active: true
    });
    const splitRoot = surface.getRuntimeDockRoot();
    if (splitRoot.kind !== "split" || splitRoot.second.kind !== "tabset") {
      throw new Error("Expected right split tabset.");
    }
    const rightTabsetId = splitRoot.second.id;
    const sceneContent = document.createElement("section");
    surface.getContentHost("scene-view").mountContent(sceneContent as unknown as HTMLElement);
    surface.addTab(createTab("hierarchy-view", "Hierarchy"), {
      targetTabsetId: rightTabsetId,
      active: false
    });
    const hierarchyContent = document.createElement("section");
    surface.getContentHost("hierarchy-view").mountContent(hierarchyContent as unknown as HTMLElement);

    const paneContents = findChildrenByClass(content, "pane-content");
    expect(paneContents).toHaveLength(2);
    expect(debugContent.parentElement).toBe(paneContents[0]);
    expect(sceneContent.parentElement).toBe(paneContents[1]);
    expect(hierarchyContent.parentElement).toBe(paneContents[1]);
    expect(debugContent.hidden).toBe(false);
    expect(sceneContent.hidden).toBe(false);
    expect(hierarchyContent.hidden).toBe(true);

    surface.activateTab("hierarchy-view");

    const nextPaneContents = findChildrenByClass(content, "pane-content");
    expect(nextPaneContents).toHaveLength(2);
    expect(debugContent.parentElement).toBe(nextPaneContents[0]);
    expect(sceneContent.parentElement).toBe(nextPaneContents[1]);
    expect(hierarchyContent.parentElement).toBe(nextPaneContents[1]);
    expect(debugContent.hidden).toBe(false);
    expect(sceneContent.hidden).toBe(true);
    expect(hierarchyContent.hidden).toBe(false);
  });

  it("does not mount known view content to primary content when its tabset target is missing", () => {
    const { content, document, host, surface } = createSubject();
    surface.configure({ tabs: [createTab("debug-view", "Debug")] });
    surface.attachHost(host);

    const orphanContent = document.createElement("section");
    surface.getContentHost("missing-view").mountContent(orphanContent as unknown as HTMLElement);

    expect(orphanContent.parentElement).toBeNull();
    expect(orphanContent.hidden).toBe(true);
    expect(content.children).not.toContain(orphanContent);
  });
});

function createActorInputHit(
  componentId: string,
  options: Partial<ActorInputHit> = {}
): ActorInputHit {
  const partId = options.partId ?? componentId;
  return {
    componentId,
    partId,
    kind: options.kind ?? "control",
    region: options.region ?? "content-control",
    localRoutePriority: options.localRoutePriority ?? 0,
    path: options.path ?? [{ componentId, role: "control", partId }],
    ...options
  };
}

function createActorInputMoveEvent(
  hit: ActorInputHit,
  options: {
    readonly totalDelta?: { dx: number; dy: number };
  } = {}
): ActorInputMoveEvent {
  const totalDelta = options.totalDelta ?? { dx: 0, dy: 0 };
  return {
    gizmo: {
      id: hit.componentId,
      priority: 0,
      hitTest: () => null
    } as ActorInputMoveEvent["gizmo"],
    hit,
    pointerId: 1,
    pointerType: "mouse",
    timeStamp: 20,
    point: { x: 20 + totalDelta.dx, y: 36 + totalDelta.dy },
    startPoint: { x: 20, y: 36 },
    buttons: 1,
    delta: totalDelta,
    totalDelta,
    isDragging: true
  };
}
