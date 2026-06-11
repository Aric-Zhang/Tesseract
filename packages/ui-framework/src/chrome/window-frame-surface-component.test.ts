import { describe, expect, it } from "vitest";
import { ActorSystem } from "actor-core";
import type { ActorInputHit, ActorInputMoveEvent } from "actor-input";
import { WindowFrameSurfaceComponent, type WindowFrameSurfaceHost } from "./window-frame-surface-component";
import type { WindowFrameTab } from "../model/window-frame-tab";
import { createSingletonWindowViewIdentity } from "../model/window-view-identity";
import {
  windowWorkspaceContentId,
  windowWorkspaceFrameId,
  windowWorkspaceSplitId,
  windowWorkspaceTabsetId
} from "../model/window-workspace-graph";
import type { WindowContentLayoutCommit, WindowRegisteredContent } from "../ports/window-content-host";
import type { WindowFrameSurfaceSnapshot } from "../services/window-workspace-graph-reconciler";

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

function createRegisteredContent(contentId: string, element: FakeElement): WindowRegisteredContent & {
  readonly element: FakeElement;
} {
  let interactable = true;
  const subscribers: Array<(commit: WindowContentLayoutCommit) => void> = [];
  return {
    contentId,
    element,
    get interactable() {
      return interactable;
    },
    setInteractable(nextInteractable: boolean) {
      interactable = nextInteractable;
    },
    subscribeLayoutCommit(callback) {
      subscribers.push(callback);
      return {
        dispose() {
          const index = subscribers.indexOf(callback);
          if (index >= 0) {
            subscribers.splice(index, 1);
          }
        }
      };
    },
    dispose() {
      subscribers.length = 0;
    }
  } as WindowRegisteredContent & { readonly element: FakeElement };
}

describe("WindowFrameSurfaceComponent", () => {
  it("renders graph snapshots and places registered content in graph tabsets", () => {
    const { content, document, host, surface } = createSubject();
    const debugContentId = windowWorkspaceContentId("content:debug");
    const sceneContentId = windowWorkspaceContentId("content:scene");
    const debugTabsetId = windowWorkspaceTabsetId("tabset:debug");
    const sceneTabsetId = windowWorkspaceTabsetId("tabset:scene");
    const debugContent = createRegisteredContent(debugContentId, document.createElement("section"));
    const sceneContent = createRegisteredContent(sceneContentId, document.createElement("section"));
    const snapshot: WindowFrameSurfaceSnapshot = {
      frameId: windowWorkspaceFrameId("frame"),
      kind: "persistent",
      presentation: "windowed",
      revision: 1,
      visible: true,
      stackPriority: 1,
      root: {
        kind: "split",
        id: windowWorkspaceSplitId("split:main"),
        direction: "vertical",
        ratio: 0.5,
        first: {
          kind: "tabset",
          id: debugTabsetId,
          activeContentId: debugContentId,
          tabs: [{
            contentId: debugContentId,
            viewActorId: "debug-view",
            identity: createSingletonWindowViewIdentity("debug"),
            title: "Debug",
            active: true
          }]
        },
        second: {
          kind: "tabset",
          id: sceneTabsetId,
          activeContentId: sceneContentId,
          tabs: [{
            contentId: sceneContentId,
            viewActorId: "scene-view",
            identity: createSingletonWindowViewIdentity("scene"),
            title: "Scene",
            active: true
          }]
        }
      }
    };

    surface.attachHost(host);
    surface.renderFrameSurface(snapshot);
    surface.placeContent({
      content: debugContent,
      placement: {
        contentId: debugContentId,
        identity: createSingletonWindowViewIdentity("debug"),
        frameId: windowWorkspaceFrameId("frame"),
        tabsetId: debugTabsetId,
        active: true,
        interactable: true
      }
    });
    surface.placeContent({
      content: sceneContent,
      placement: {
        contentId: sceneContentId,
        identity: createSingletonWindowViewIdentity("scene"),
        frameId: windowWorkspaceFrameId("frame"),
        tabsetId: sceneTabsetId,
        active: true,
        interactable: true
      }
    });

    const paneContents = findChildrenByClass(content, "pane-content");
    const paneTabs = findChildrenByClass(content, "pane-tabs");
    const splitters = findChildrenByClass(content, "splitter");
    paneTabs[0]!.rect = createRect(10, 20, 120, 24);
    paneContents[0]!.rect = createRect(10, 44, 120, 180);
    paneTabs[1]!.rect = createRect(140, 20, 140, 24);
    paneContents[1]!.rect = createRect(140, 44, 140, 180);
    splitters[0]!.rect = createRect(130, 20, 10, 204);

    expect(surface.measureFrameSurfaceGeometry(snapshot)).toEqual({
      frameId: windowWorkspaceFrameId("frame"),
      revision: 1,
      tabsets: [{
        tabsetId: debugTabsetId,
        contentIds: [debugContentId],
        tabBounds: { left: 10, top: 20, right: 130, bottom: 44, width: 120, height: 24 },
        contentBounds: { left: 10, top: 44, right: 130, bottom: 224, width: 120, height: 180 }
      }, {
        tabsetId: sceneTabsetId,
        contentIds: [sceneContentId],
        tabBounds: { left: 140, top: 20, right: 280, bottom: 44, width: 140, height: 24 },
        contentBounds: { left: 140, top: 44, right: 280, bottom: 224, width: 140, height: 180 }
      }],
      splitters: [{
        splitId: windowWorkspaceSplitId("split:main"),
        direction: "vertical",
        rect: { left: 130, top: 20, right: 140, bottom: 224, width: 10, height: 204 }
      }],
      issues: []
    });
    expect(paneContents).toHaveLength(2);
    expect(debugContent.element.parentElement).toBe(paneContents[0]);
    expect(sceneContent.element.parentElement).toBe(paneContents[1]);
    expect(debugContent.interactable).toBe(true);
    expect(sceneContent.interactable).toBe(true);
  });

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

  it("uses the content declared view actor instead of letting a host rewrite placement", () => {
    const { content, document, host, surface } = createSubject();

    surface.configure({ tabs: [
      createTab("debug-view", "Debug"),
      createTab("scene-view", "Scene")
    ] });
    surface.attachHost(host);
    const sceneContent = document.createElement("section");

    const attachment = surface.getContentHost("debug-view").mountContent({
      element: sceneContent as unknown as HTMLElement,
      viewActorId: "scene-view"
    });

    expect(content.children).toEqual([sceneContent]);
    expect(attachment.interactable).toBe(false);
    surface.activateTab("scene-view");
    expect(attachment.interactable).toBe(true);
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
    expect(surface.hitTest({ x: 195, y: 100 })?.part).toBe("splitter");
    expect(hit?.data).toMatchObject({ direction: "horizontal" });
    surface.beginSplitResize(hit?.data);
    const resize = surface.updateSplitRatioFromDrag(createActorInputMoveEvent(createActorInputHit("surface", {
      partId: "splitter"
    }), {
      totalDelta: { dx: 80, dy: 0 }
    }));

    expect(resize?.splitId).toBe((hit?.data as { splitId?: string }).splitId);
    expect(resize?.ratio).toBeGreaterThan(0.5);
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

  it("publishes generic layout commits after split layout and active content changes", () => {
    const { content, document, host, surface } = createSubject();
    surface.configure({ tabs: [createTab("debug-view", "Debug")] });
    surface.attachHost(host);
    const debugContent = document.createElement("section");
    const debugCommits: WindowContentLayoutCommit[] = [];
    const debugAttachment = surface.getContentHost("debug-view").mountContent(debugContent as unknown as HTMLElement);
    debugAttachment.subscribeLayoutCommit((commit) => debugCommits.push(commit));

    const initialRoot = surface.getRuntimeDockRoot();
    if (initialRoot.kind !== "tabset") throw new Error("Expected initial tabset.");
    surface.splitTab(createTab("scene-view", "Scene"), {
      targetTabsetId: initialRoot.id,
      placement: "bottom",
      active: true
    });
    const split = findChildrenByClass(content, "split")[0];
    const splitter = findChildrenByClass(content, "splitter")[0];
    const paneContents = findChildrenByClass(content, "pane-content");
    if (!split || !splitter || paneContents.length !== 2) throw new Error("Expected split DOM.");
    split.rect = createRect(0, 24, 400, 240);
    splitter.rect = createRect(0, 140, 400, 6);
    paneContents[0]!.rect = createRect(0, 24, 400, 116);
    paneContents[1]!.rect = createRect(0, 146, 400, 118);

    const sceneContent = document.createElement("section");
    const sceneCommits: typeof debugCommits = [];
    const sceneAttachment = surface.getContentHost("scene-view").mountContent(sceneContent as unknown as HTMLElement);
    sceneAttachment.subscribeLayoutCommit((commit) => sceneCommits.push(commit));

    expect(sceneCommits.at(-1)).toMatchObject({
      surfaceId: "surface:test",
      contentId: "scene-view",
      active: true,
      interactable: true,
      contentRect: { x: 0, y: 146, width: 400, height: 118 }
    });

    surface.refreshActiveContentState();

    expect(debugCommits.at(-1)).toMatchObject({
      surfaceId: "surface:test",
      contentId: "debug-view",
      active: true,
      interactable: true
    });
    expect(sceneCommits.at(-1)).toMatchObject({
      surfaceId: "surface:test",
      contentId: "scene-view",
      active: true,
      interactable: true,
      contentRect: { x: 0, y: 146, width: 400, height: 118 }
    });
    expect(sceneCommits.at(-1)?.splits).toHaveLength(1);
    expect(sceneCommits.at(-1)?.splits[0]?.splitId).toEqual(expect.any(String));
    expect(sceneCommits.at(-1)?.splits[0]).toMatchObject({
      direction: "vertical",
      rect: { x: 0, y: 140, width: 400, height: 6 }
    });

    surface.addTab(createTab("hierarchy-view", "Hierarchy"), {
      targetTabsetId: sceneCommits.at(-1)?.tabsetId ?? "",
      active: false
    });
    const hierarchyContent = document.createElement("section");
    const hierarchyCommits: typeof debugCommits = [];
    const hierarchyAttachment = surface.getContentHost("hierarchy-view").mountContent(hierarchyContent as unknown as HTMLElement);
    hierarchyAttachment.subscribeLayoutCommit((commit) => hierarchyCommits.push(commit));

    surface.activateTab("hierarchy-view");

    expect(debugCommits.at(-1)?.active).toBe(true);
    expect(sceneCommits.at(-1)?.active).toBe(false);
    expect(hierarchyCommits.at(-1)?.active).toBe(true);
    expect(debugCommits.at(-1)?.surfaceRevision).toBeGreaterThan(sceneCommits[0]?.surfaceRevision ?? 0);
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
