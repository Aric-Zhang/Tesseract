import { describe, expect, it } from "vitest";
import { ActorSystem } from "actor-system/core";
import type { ActorInputHit, ActorInputMoveEvent } from "actor-system/input";
import { WindowFrameSurfaceComponent, type WindowFrameSurfaceHost } from "./window-frame-surface-component";
import {
  createSingletonWindowViewIdentity
} from "../model/window-view-identity";
import {
  windowWorkspaceContentId,
  windowWorkspaceFrameId,
  windowWorkspaceSplitId,
  windowWorkspaceTabsetId,
  type WindowWorkspaceContentId
} from "../model/window-workspace-graph";
import {
  WindowContentRegistry,
  type WindowContentLayoutCommit,
  type WindowRegisteredContent
} from "../ports/window-content-registry";
import type { WindowFrameSurfaceSnapshot } from "../services/window-workspace-graph-reconciler";

describe("WindowFrameSurfaceComponent", () => {
  it("renders graph snapshots and places registered content in graph tabsets", () => {
    const { content, document, host, surface } = createSubject();
    const debugContentId = windowWorkspaceContentId("content:debug");
    const sceneContentId = windowWorkspaceContentId("content:scene");
    const debugTabsetId = windowWorkspaceTabsetId("tabset:debug");
    const sceneTabsetId = windowWorkspaceTabsetId("tabset:scene");
    const debugContent = createRegisteredContent(debugContentId, document.createElement("section"));
    const sceneContent = createRegisteredContent(sceneContentId, document.createElement("section"));
    const snapshot = createSplitSnapshot({
      debugContentId,
      sceneContentId,
      debugTabsetId,
      sceneTabsetId
    });

    surface.attachHost(host);
    surface.renderFrameSurface(snapshot);
    surface.placeContent({
      content: debugContent,
      placement: {
        contentId: debugContentId,
        identity: createSingletonWindowViewIdentity("debug"),
        frameId: snapshot.frameId,
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
        frameId: snapshot.frameId,
        tabsetId: sceneTabsetId,
        active: true,
        interactable: true
      }
    });

    const paneContents = findChildrenByClass(content, "pane-content");
    const viewports = findChildrenByClass(content, "ui-window-content-scroll-viewport");
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
    expect(viewports).toHaveLength(2);
    expect(viewports[0]!.parentElement).toBe(paneContents[0]);
    expect(viewports[0]!.dataset.uiWindowContentScrollViewport).toBe("true");
    expect(viewports[0]!.style.overflowY).toBe("auto");
    expect(viewports[0]!.style.overflowX).toBe("auto");
    expect(debugContent.element.parentElement).toBe(viewports[0]);
    expect(sceneContent.element.parentElement).toBe(viewports[1]);
    expect(debugContent.interactable).toBe(true);
    expect(sceneContent.interactable).toBe(true);
  });

  it("uses explicit content cleanup and active state from the graph reconciler", () => {
    const { document, host, setEffectiveVisible, surface } = createSubject();
    const debugContentId = windowWorkspaceContentId("content:debug");
    const sceneContentId = windowWorkspaceContentId("content:scene");
    const debugTabsetId = windowWorkspaceTabsetId("tabset:debug");
    const sceneTabsetId = windowWorkspaceTabsetId("tabset:scene");
    const debugContent = createRegisteredContent(debugContentId, document.createElement("section"));
    const sceneContent = createRegisteredContent(sceneContentId, document.createElement("section"));
    const snapshot = createSplitSnapshot({
      debugContentId,
      sceneContentId,
      debugTabsetId,
      sceneTabsetId
    });

    surface.attachHost(host);
    surface.renderFrameSurface(snapshot);
    surface.placeContent({
      content: debugContent,
      placement: {
        contentId: debugContentId,
        identity: createSingletonWindowViewIdentity("debug"),
        frameId: snapshot.frameId,
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
        frameId: snapshot.frameId,
        tabsetId: sceneTabsetId,
        active: true,
        interactable: true
      }
    });

    surface.setContentActive({ contentId: sceneContentId, active: false, interactable: false });
    const sceneViewport = findChildrenByClass(host.primaryContent as unknown as FakeElement, "ui-window-content-scroll-viewport")
      .find((element) => element.dataset.uiWindowContentId === sceneContentId);

    expect(sceneContent.interactable).toBe(false);
    expect(sceneViewport?.hidden).toBe(true);
    expect(sceneContent.element.hidden).toBe(false);

    setEffectiveVisible(false);
    const debugViewport = findChildrenByClass(host.primaryContent as unknown as FakeElement, "ui-window-content-scroll-viewport")
      .find((element) => element.dataset.uiWindowContentId === debugContentId);

    expect(debugContent.interactable).toBe(false);
    expect(debugViewport?.hidden).toBe(true);
    expect(debugContent.element.hidden).toBe(false);

    setEffectiveVisible(true);
    surface.removeContent(sceneContentId);

    expect(sceneContent.interactable).toBe(false);
    expect(sceneContent.element.parentElement).toBeNull();
    expect(debugContent.interactable).toBe(true);
  });

  it("routes tab action hits and split resize through rendered snapshot chrome", () => {
    const { content, host, surface } = createSubject();
    const debugContentId = windowWorkspaceContentId("content:debug");
    const sceneContentId = windowWorkspaceContentId("content:scene");
    const debugTabsetId = windowWorkspaceTabsetId("tabset:debug");
    const sceneTabsetId = windowWorkspaceTabsetId("tabset:scene");
    const snapshot = createSplitSnapshot({
      debugContentId,
      sceneContentId,
      debugTabsetId,
      sceneTabsetId
    });

    surface.attachHost(host);
    surface.renderFrameSurface(snapshot);

    const tab = findChildrenByClass(content, "tab")[0];
    const close = findChildrenByClass(content, "tab-close")[0];
    const split = findChildrenByClass(content, "split")[0];
    const splitter = findChildrenByClass(content, "splitter")[0];
    if (!tab || !close || !split || !splitter) throw new Error("Expected rendered snapshot chrome.");
    tab.rect = createRect(0, 0, 120, 24);
    close.rect = createRect(96, 4, 16, 16);
    split.rect = createRect(0, 24, 400, 240);
    splitter.rect = createRect(198, 24, 4, 240);

    expect(surface.hitTest({ x: 100, y: 10 })?.part).toBe("tab-action");
    expect(surface.hitTest({ x: 20, y: 10 })?.part).toBe("tab");

    const hit = surface.hitTest({ x: 200, y: 100 });
    expect(hit?.part).toBe("splitter");
    expect(hit?.data).toMatchObject({ direction: "vertical" });
    surface.beginSplitResize(hit?.data);
    const resize = surface.updateSplitRatioFromDrag(createActorInputMoveEvent(createActorInputHit("surface", {
      partId: "splitter"
    }), {
      totalDelta: { dx: 0, dy: 80 }
    }));

    expect(resize?.splitId).toBe((hit?.data as { splitId?: string }).splitId);
    expect(resize?.ratio).toBeGreaterThan(0.5);
  });

  it("routes native content scrollbar gutters as content-control surface hits", () => {
    const { content, document, host, surface } = createSubject();
    const debugContentId = windowWorkspaceContentId("content:debug");
    const sceneContentId = windowWorkspaceContentId("content:scene");
    const debugTabsetId = windowWorkspaceTabsetId("tabset:debug");
    const sceneTabsetId = windowWorkspaceTabsetId("tabset:scene");
    const debugContent = createRegisteredContent(debugContentId, document.createElement("section"));
    const snapshot = createSplitSnapshot({
      debugContentId,
      sceneContentId,
      debugTabsetId,
      sceneTabsetId
    });

    surface.attachHost(host);
    surface.renderFrameSurface(snapshot);
    surface.placeContent({
      content: debugContent,
      placement: {
        contentId: debugContentId,
        identity: createSingletonWindowViewIdentity("debug"),
        frameId: snapshot.frameId,
        tabsetId: debugTabsetId,
        active: true,
        interactable: true
      }
    });

    const viewport = findChildrenByClass(content, "ui-window-content-scroll-viewport")[0];
    if (!viewport) throw new Error("Expected content scroll viewport.");
    viewport.rect = createRect(10, 20, 100, 120);
    viewport.offsetWidth = 100;
    viewport.clientWidth = 88;
    viewport.offsetHeight = 120;
    viewport.clientHeight = 108;
    viewport.scrollWidth = 88;
    viewport.scrollHeight = 240;

    expect(surface.hitTest({ x: 104, y: 40 })?.part).toBe("content-scrollbar");
    expect(surface.hitTest({ x: 40, y: 40 })?.part).toBe("content");

    viewport.scrollHeight = 108;
    expect(surface.hitTest({ x: 104, y: 40 })?.part).toBe("content");

    viewport.scrollHeight = 240;
    viewport.offsetWidth = 88;
    expect(surface.hitTest({ x: 104, y: 40 })?.part).toBe("content");

    viewport.offsetWidth = 100;
    viewport.scrollWidth = 200;
    expect(surface.hitTest({ x: 40, y: 134 })?.part).toBe("content-scrollbar");
  });

  it("publishes generic layout commits from graph-owned content state", () => {
    const { content, document, host, surface } = createSubject();
    const debugContentId = windowWorkspaceContentId("content:debug");
    const sceneContentId = windowWorkspaceContentId("content:scene");
    const debugTabsetId = windowWorkspaceTabsetId("tabset:debug");
    const sceneTabsetId = windowWorkspaceTabsetId("tabset:scene");
    const debugContent = createRegisteredContent(debugContentId, document.createElement("section"));
    const sceneContent = createRegisteredContent(sceneContentId, document.createElement("section"));
    const snapshot = createSplitSnapshot({
      debugContentId,
      sceneContentId,
      debugTabsetId,
      sceneTabsetId
    });

    surface.attachHost(host);
    surface.renderFrameSurface(snapshot);
    const paneContents = findChildrenByClass(content, "pane-content");
    const splitter = findChildrenByClass(content, "splitter")[0];
    paneContents[0]!.rect = createRect(0, 24, 400, 116);
    paneContents[1]!.rect = createRect(0, 146, 400, 118);
    splitter!.rect = createRect(0, 140, 400, 6);

    surface.placeContent({
      content: debugContent,
      placement: {
        contentId: debugContentId,
        identity: createSingletonWindowViewIdentity("debug"),
        frameId: snapshot.frameId,
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
        frameId: snapshot.frameId,
        tabsetId: sceneTabsetId,
        active: true,
        interactable: true
      }
    });
    const sceneViewport = findChildrenByClass(content, "ui-window-content-scroll-viewport")
      .find((element) => element.dataset.uiWindowContentId === sceneContentId);
    if (!sceneViewport) throw new Error("Expected scene viewport.");
    sceneViewport.rect = createRect(0, 146, 400, 118);
    surface.refreshActiveContentState();

    expect(sceneContent.commits.at(-1)).toMatchObject({
      surfaceId: "surface:test",
      contentId: sceneContentId,
      tabsetId: sceneTabsetId,
      active: true,
      interactable: true,
      contentRect: { x: 0, y: 146, width: 400, height: 118 }
    });
    expect(sceneContent.commits.at(-1)?.splits).toEqual([{
      splitId: windowWorkspaceSplitId("split:main"),
      direction: "vertical",
      rect: { x: 0, y: 140, width: 400, height: 6 }
    }]);
  });
});

function createSplitSnapshot(options: {
  readonly debugContentId: WindowWorkspaceContentId;
  readonly sceneContentId: WindowWorkspaceContentId;
  readonly debugTabsetId: ReturnType<typeof windowWorkspaceTabsetId>;
  readonly sceneTabsetId: ReturnType<typeof windowWorkspaceTabsetId>;
}): WindowFrameSurfaceSnapshot {
  return {
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
        id: options.debugTabsetId,
        activeContentId: options.debugContentId,
        tabs: [{
          contentId: options.debugContentId,
          viewActorId: "debug-view",
          identity: createSingletonWindowViewIdentity("debug"),
          title: "Debug",
          active: true
        }]
      },
      second: {
        kind: "tabset",
        id: options.sceneTabsetId,
        activeContentId: options.sceneContentId,
        tabs: [{
          contentId: options.sceneContentId,
          viewActorId: "scene-view",
          identity: createSingletonWindowViewIdentity("scene"),
          title: "Scene",
          active: true
        }]
      }
    }
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

function createRegisteredContent(
  contentId: WindowWorkspaceContentId,
  element: FakeElement
): WindowRegisteredContent & {
  readonly commits: WindowContentLayoutCommit[];
  readonly element: FakeElement;
} {
  const registry = new WindowContentRegistry();
  const commits: WindowContentLayoutCommit[] = [];
  const registered = registry.registerContent({
    contentId,
    element: element as unknown as HTMLElement,
    interactable: true
  });
  registered.subscribeLayoutCommit((commit) => commits.push(commit));
  return Object.assign(registered, { commits }) as unknown as WindowRegisteredContent & {
    readonly commits: WindowContentLayoutCommit[];
    readonly element: FakeElement;
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
  readonly attributes = new Map<string, string>();
  readonly dataset: Record<string, string> = {};
  parentElement: FakeElement | null = null;
  rect: DOMRectReadOnly = createRect(0, 0, 0, 0);
  clientWidth = 0;
  clientHeight = 0;
  offsetWidth = 0;
  offsetHeight = 0;
  scrollWidth = 0;
  scrollHeight = 0;

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
    if (index >= 0) this.parentElement.children.splice(index, 1);
    this.parentElement = null;
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }

  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
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
