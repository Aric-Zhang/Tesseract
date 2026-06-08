import { describe, expect, it } from "vitest";
import { ActorSystem } from "../actor-runtime";
import { createActorInputEndEvent, createActorInputMoveEvent, createActorInputStartEvent } from "../test-support";
import type { WindowDockCommitIntent, WindowFrameIntentSink } from "./window-frame-lifecycle";
import type { WindowFramePort, WindowFrameRuntimeDockNode, WindowFrameTab } from "./window-frame-port";
import { WindowFramePortRegistry } from "./window-frame-port-registry";
import type { WindowTabDragSink } from "./window-dock-preview-component";
import type { WindowTabDragSource } from "./window-tab-drag-session";
import { WindowFrameSurfaceComponent } from "./window-frame-surface-component";
import {
  WORKSPACE_ROOT_FRAME_ID,
  WorkspaceRootDockFrameComponent
} from "./workspace-root-dock-frame-component";

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

  get firstChild(): FakeElement | null {
    return this.children[0] ?? null;
  }

  append(...children: FakeElement[]): void {
    for (const child of children) {
      child.remove();
      child.parentElement = this;
      this.children.push(child);
    }
  }

  removeChild(child: FakeElement): FakeElement {
    const index = this.children.indexOf(child);
    if (index < 0) throw new Error("Child not found.");
    this.children.splice(index, 1);
    child.parentElement = null;
    return child;
  }

  remove(): void {
    if (!this.parentElement) return;
    this.parentElement.removeChild(this);
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

function createSubject(options: {
  frameIntentSink?: WindowFrameIntentSink;
  priority?: number;
  tabDragSink?: WindowTabDragSink;
} = {}) {
  const actorSystem = new ActorSystem();
  const actor = actorSystem.createActor({ id: WORKSPACE_ROOT_FRAME_ID });
  const document = new FakeDocument();
  const parent = document.createElement("div");
  const registry = new WindowFramePortRegistry();
  const surface = new WindowFrameSurfaceComponent(actor, { id: "window-frame-surface:test" });
  const component = new WorkspaceRootDockFrameComponent(actor, {
    id: "workspace-root:test",
    parent: parent as unknown as HTMLElement,
    document: document as unknown as Document,
    framePortRegistry: registry,
    frameIntentSink: options.frameIntentSink,
    priority: options.priority,
    tabDragSink: options.tabDragSink
  }, { surface });
  const root = parent.children[0];
  if (!root) throw new Error("Expected workspace root element.");
  setWorkspaceRootRects(root);
  return { actor, actorSystem, component, document, parent, registry, root, surface };
}

function setWorkspaceRootRects(root: FakeElement): void {
  root.rect = createRect(0, 24, 1200, 776);
  findChildByClass(root, "workspace-root-dock-frame__tabs").rect = createRect(0, 24, 1200, 30);
  findChildByClass(root, "workspace-root-dock-frame__content").rect = createRect(0, 54, 1200, 746);
}

function setTabRects(root: FakeElement): void {
  const tabs = findChildrenByClass(root, "workspace-root-dock-frame__tab");
  tabs.forEach((tab, index) => {
    tab.rect = createRect(index * 120, 24, 120, 30);
    const close = findChildByClass(tab, "workspace-root-dock-frame__tab-close");
    close.rect = createRect(index * 120 + 96, 28, 18, 18);
  });
}

function setSplitRects(root: FakeElement): void {
  const split = findChildByClass(findChildByClass(root, "workspace-root-dock-frame__content"), "workspace-root-dock-frame__split");
  split.rect = createRect(0, 54, 1200, 746);
  const panes = findChildrenByClass(root, "workspace-root-dock-frame__pane");
  panes[0]!.rect = createRect(0, 54, 598, 746);
  panes[1]!.rect = createRect(603, 54, 597, 746);
  const paneTabs = findChildrenByClass(root, "workspace-root-dock-frame__pane-tabs");
  paneTabs[0]!.rect = createRect(0, 54, 598, 24);
  paneTabs[1]!.rect = createRect(603, 54, 597, 24);
  const paneContents = findChildrenByClass(root, "workspace-root-dock-frame__pane-content");
  paneContents[0]!.rect = createRect(0, 78, 598, 722);
  paneContents[1]!.rect = createRect(603, 78, 597, 722);
  findChildrenByClass(root, "workspace-root-dock-frame__splitter")[0]!.rect = createRect(598, 54, 5, 746);
}

function findChildByClass(element: FakeElement, className: string): FakeElement {
  const child = element.children.find((candidate) => candidate.className.split(" ").includes(className));
  if (!child) throw new Error(`Missing child with class: ${className}`);
  return child;
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

function listRuntimeTabsetIds(node: WindowFrameRuntimeDockNode): string[] {
  if (node.kind === "tabset") return [node.id];
  return [...listRuntimeTabsetIds(node.first), ...listRuntimeTabsetIds(node.second)];
}

describe("WorkspaceRootDockFrameComponent", () => {
  it("uses the configured root priority for content host input", () => {
    const { component } = createSubject({ priority: 321 });

    expect(component.inputStackPriority).toBe(321);
    expect(component.getContentHost("debug-view").inputStackPriority).toBe(321);
  });

  it("treats persisted floating window state as compatibility data only", () => {
    const { component } = createSubject();
    const framePort: WindowFramePort = component;

    framePort.restoreFloatingState({
      position: { x: 400, y: 320 },
      size: { x: 240, y: 120 },
      visible: false
    });
    framePort.setPresentation("fullscreen");
    framePort.requestVisible(false);

    expect(framePort.visible).toBe(true);
    expect(framePort.presentation).toBe("windowed");
    expect(framePort.getFloatingBounds()).toMatchObject({
      left: 0,
      top: 24,
      width: 1200,
      height: 776
    });
  });

  it("suppresses the root dock frame without changing persistent visibility", () => {
    const { component, document, root } = createSubject();
    component.addTab(createTab("scene-view", "Scene"), { active: true });
    const content = document.createElement("section");
    const attachment = component.getContentHost("scene-view").mountContent(content as unknown as HTMLElement);

    component.setPresentationSuppressed("workspace-run", true);

    expect(component.visible).toBe(true);
    expect(component.presentationSuppressed).toBe(true);
    expect(component.effectiveVisible).toBe(false);
    expect(root.hidden).toBe(true);
    expect(attachment.interactable).toBe(false);
    expect(component.isContentInteractable(content as unknown as HTMLElement)).toBe(false);
    expect(component.hitTestInput({ x: 20, y: 60 })).toBeNull();

    component.setPresentationSuppressed("workspace-run", false);

    expect(component.effectiveVisible).toBe(true);
    expect(root.hidden).toBe(false);
    expect(attachment.interactable).toBe(true);
  });

  it("registers as a dock target and hosts active tab content", () => {
    const { component, document, parent, registry, root } = createSubject();

    expect(registry.get(WORKSPACE_ROOT_FRAME_ID)?.framePort).toBe(component);
    const dockTargets = component.listDockTargetTabsets();
    const runtimeRoot = component.getRuntimeDockRoot();
    expect(dockTargets).toHaveLength(1);
    expect(dockTargets[0]?.targetTabsetId).toBe(runtimeRoot.kind === "tabset" ? runtimeRoot.id : undefined);
    expect(dockTargets[0]?.tabBounds).toMatchObject({ left: 0, top: 24, width: 1200, height: 30 });
    expect(dockTargets[0]?.contentBounds).toMatchObject({ left: 0, top: 54, width: 1200, height: 746 });

    component.addTab(createTab("debug-view", "Debug"), { active: true });
    const debugContent = document.createElement("section");
    const attachment = component.getContentHost("debug-view").mountContent(debugContent as unknown as HTMLElement);
    expect(findChildByClass(root, "workspace-root-dock-frame__content").children).toEqual([debugContent]);
    expect(attachment.interactable).toBe(true);
    expect(debugContent.hidden).toBe(false);

    component.addTab(createTab("hierarchy-view", "Hierarchy"), { active: true });
    expect(attachment.interactable).toBe(false);
    expect(debugContent.hidden).toBe(true);

    component.activateTab("debug-view");
    expect(attachment.interactable).toBe(true);
    expect(debugContent.hidden).toBe(false);

    component.dispose();
    expect(registry.get(WORKSPACE_ROOT_FRAME_ID)).toBeNull();
    expect(parent.children).toEqual([]);
  });

  it("routes tab close and drag commit through frame intents", () => {
    const closeRequests: Array<{ viewActorId: string; ownerFrameId: string | undefined }> = [];
    const commitRequests: WindowDockCommitIntent[] = [];
    const dragSource: WindowTabDragSource = {
      frameId: WORKSPACE_ROOT_FRAME_ID,
      viewActorId: "debug-view",
      viewKey: "debug"
    };
    const frameIntentSink: WindowFrameIntentSink = {
      requestOpenView() {},
      requestCloseFrame() {},
      requestCloseView(viewActorId, _reason, options) {
        closeRequests.push({ viewActorId, ownerFrameId: options?.ownerFrameId });
      },
      requestCommitDock(intent) {
        commitRequests.push(intent);
      }
    };
    const tabDragSink: WindowTabDragSink = {
      beginTabDrag() {},
      moveTabDrag() {},
      endTabDrag: () => ({
        source: dragSource,
        preview: {
          kind: "merge-tabs",
          targetFrameId: "target-frame",
          targetTabsetId: "target-frame:root",
          rect: createRect(300, 40, 200, 30)
        }
      }),
      cancelTabDrag() {}
    };
    const { component, root } = createSubject({ frameIntentSink, tabDragSink });
    component.addTab(createTab("debug-view", "Debug"), { active: true });
    setTabRects(root);

    const closeHit = component.hitTestInput({ x: 100, y: 34 });
    expect(closeHit?.partId).toBe("window-tab-action");
    if (!closeHit) throw new Error("Expected close hit.");
    component.onInputEnd(createActorInputEndEvent(closeHit, { wasClick: true, point: { x: 100, y: 34 } }));
    expect(closeRequests).toEqual([{ viewActorId: "debug-view", ownerFrameId: WORKSPACE_ROOT_FRAME_ID }]);

    const tabHit = component.hitTestInput({ x: 20, y: 34 });
    expect(tabHit?.partId).toBe("window-tab");
    if (!tabHit) throw new Error("Expected tab hit.");
    component.onInputStart(createActorInputStartEvent(tabHit, { point: { x: 20, y: 34 } }));
    component.onInputEnd(createActorInputEndEvent(tabHit, { wasClick: false, point: { x: 340, y: 44 } }));
    expect(commitRequests).toEqual([{
      kind: "merge-tabs",
      source: dragSource,
      targetFrameId: "target-frame",
      targetTabsetId: "target-frame:root",
      reason: "dock-drop"
    }]);
  });

  it("activates an inactive root tab on click without committing a dock drag", () => {
    const activations: Array<{ frameId: string; viewActorId: string; reason: string }> = [];
    const commitRequests: WindowDockCommitIntent[] = [];
    const dragSource: WindowTabDragSource = {
      frameId: WORKSPACE_ROOT_FRAME_ID,
      viewActorId: "scene-view",
      viewKey: "scene"
    };
    const frameIntentSink: WindowFrameIntentSink = {
      requestOpenView() {},
      requestCloseFrame() {},
      requestActivateFrameTab(frameId, viewActorId, reason) {
        activations.push({ frameId, viewActorId, reason });
      },
      requestCommitDock(intent) {
        commitRequests.push(intent);
      }
    };
    let dragEnded = 0;
    const tabDragSink: WindowTabDragSink = {
      beginTabDrag() {},
      moveTabDrag() {},
      endTabDrag: () => {
        dragEnded += 1;
        return {
          source: dragSource,
          preview: {
            kind: "merge-tabs",
            targetFrameId: "target-frame",
            targetTabsetId: "target-frame:root",
            rect: createRect(300, 40, 200, 30)
          }
        };
      },
      cancelTabDrag() {}
    };
    const { component, root } = createSubject({ frameIntentSink, tabDragSink });
    component.addTab(createTab("debug-view", "Debug"), { active: true });
    component.addTab(createTab("scene-view", "Scene"), { active: false });
    setTabRects(root);

    const sceneTabHit = component.hitTestInput({ x: 145, y: 34 });
    expect(sceneTabHit?.partId).toBe("window-tab");
    if (!sceneTabHit) throw new Error("Expected Scene tab hit.");

    component.onInputStart(createActorInputStartEvent(sceneTabHit, { point: { x: 145, y: 34 } }));
    component.onInputEnd(createActorInputEndEvent(sceneTabHit, { wasClick: true, point: { x: 145, y: 34 } }));

    expect(activations).toEqual([{
      frameId: WORKSPACE_ROOT_FRAME_ID,
      viewActorId: "scene-view",
      reason: "tab-click"
    }]);
    expect(dragEnded).toBe(1);
    expect(commitRequests).toEqual([]);
  });

  it("keeps root tab close hit targets inside narrow tab bounds", () => {
    const closeRequests: Array<{ viewActorId: string; ownerFrameId: string | undefined }> = [];
    const frameIntentSink: WindowFrameIntentSink = {
      requestOpenView() {},
      requestCloseFrame() {},
      requestCloseView(viewActorId, _reason, options) {
        closeRequests.push({ viewActorId, ownerFrameId: options?.ownerFrameId });
      },
      requestCommitDock() {}
    };
    const { component, root } = createSubject({ frameIntentSink });
    component.addTab(createTab("very-long-debug-view", "Very Long Debug Window Title"), { active: true });

    const tab = findChildrenByClass(root, "workspace-root-dock-frame__tab")[0];
    if (!tab) throw new Error("Expected root tab.");
    const close = findChildByClass(tab, "workspace-root-dock-frame__tab-close");
    tab.rect = createRect(0, 24, 56, 24);
    close.rect = createRect(35, 28, 16, 16);

    expect(close.rect.right).toBeLessThanOrEqual(tab.rect.right);
    const closeHit = component.hitTestInput({ x: 43, y: 36 });
    expect(closeHit?.partId).toBe("window-tab-action");
    if (!closeHit) throw new Error("Expected close hit.");
    component.onInputEnd(createActorInputEndEvent(closeHit, { wasClick: true, point: { x: 43, y: 36 } }));
    expect(closeRequests).toEqual([{
      viewActorId: "very-long-debug-view",
      ownerFrameId: WORKSPACE_ROOT_FRAME_ID
    }]);
  });

  it("renders split panes as dock target tabsets and resizes splitters through actor input", () => {
    const { component, document, root } = createSubject();
    component.addTab(createTab("debug-view", "Debug"), { active: true });
    const initialRoot = component.getRuntimeDockRoot();
    if (initialRoot.kind !== "tabset") throw new Error("Expected initial tabset root.");

    const debugContent = document.createElement("section");
    component.getContentHost("debug-view").mountContent(debugContent as unknown as HTMLElement);
    component.splitTab(createTab("hierarchy-view", "Hierarchy"), {
      targetTabsetId: initialRoot.id,
      placement: "right",
      active: true
    });
    const hierarchyContent = document.createElement("section");
    component.getContentHost("hierarchy-view").mountContent(hierarchyContent as unknown as HTMLElement);
    setSplitRects(root);

    const splitRoot = component.getRuntimeDockRoot();
    expect(splitRoot.kind).toBe("split");
    expect(component.listDockTargetTabsets().map((target) => target.targetTabsetId).sort())
      .toEqual(listRuntimeTabsetIds(splitRoot).sort());
    expect(debugContent.hidden).toBe(false);
    expect(hierarchyContent.hidden).toBe(false);

    const hit = component.hitTestInput({ x: 600, y: 100 });
    expect(hit?.partId).toBe("root-splitter");
    if (!hit) throw new Error("Expected splitter hit.");
    component.onInputStart(createActorInputStartEvent(hit, { point: { x: 600, y: 100 } }));
    component.onInputMove(createActorInputMoveEvent(hit, {
      point: { x: 720, y: 100 },
      totalDelta: { dx: 120, dy: 0 }
    }));

    const resizedRoot = component.getRuntimeDockRoot();
    expect(resizedRoot.kind).toBe("split");
    if (resizedRoot.kind === "split") {
      expect(resizedRoot.ratio).toBeGreaterThan(0.5);
    }
  });
});
