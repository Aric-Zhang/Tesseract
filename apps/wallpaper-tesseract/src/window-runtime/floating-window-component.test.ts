import { describe, expect, it, vi } from "vitest";
import { ActorSystem } from "../actor-runtime";
import { createActorInputEndEvent, createActorInputHit, createActorInputMoveEvent, createActorInputStartEvent } from "../test-support";
import {
  WINDOW_FRAME_TAB_PART_ID,
  uiVec2,
  type WindowFrameSurfaceComponent
} from "ui-framework";
import type { WindowDockCommitIntent, WindowFrameIntentSink } from "./window-frame-lifecycle";
import type { WindowTabDragSink } from "./window-dock-preview-component";
import { FloatingWindowComponent } from "./floating-window-component";

describe("FloatingWindowComponent", () => {
  it("uses CSS-owned fullscreen sizing instead of freezing parent rect pixels", () => {
    const actorSystem = new ActorSystem();
    const actor = actorSystem.createActor({ id: "scene-frame" });
    const document = new FakeDocument();
    const parent = document.createElement("div");
    const component = new FloatingWindowComponent(actor, {
      id: "floating-window:scene",
      frameId: "scene-frame",
      parent: parent as unknown as HTMLElement,
      document: document as unknown as Document,
      title: "Scene",
      stateBinding: { kind: "runtime" },
      initialState: {
        position: uiVec2(12, 24),
        size: uiVec2(320, 180),
        visible: true
      }
    }, {
      surface: createSurface()
    });
    const root = parent.children[0];

    expect(root.style).toMatchObject({
      left: "12px",
      top: "24px",
      width: "320px",
      height: "180px"
    });

    component.setPresentation("fullscreen");

    expect(root.className).toContain("floating-gizmo-window--fullscreen");
    expect(root.style).toMatchObject({
      left: "",
      top: "",
      right: "",
      bottom: "",
      width: "",
      height: ""
    });

    component.setPresentation("windowed");

    expect(root.className).not.toContain("floating-gizmo-window--fullscreen");
    expect(root.style).toMatchObject({
      left: "12px",
      top: "24px",
      right: "",
      bottom: "",
      width: "320px",
      height: "180px"
    });
  });

  it("keeps a tab drag session active after the pointer leaves the tab hit", () => {
    const actorSystem = new ActorSystem();
    const actor = actorSystem.createActor({ id: "debug-frame" });
    const document = new FakeDocument();
    const parent = document.createElement("div");
    const moves: Array<{ x: number; y: number }> = [];
    const commits: WindowDockCommitIntent[] = [];
    const frameIntentSink: WindowFrameIntentSink = {
      requestOpenView: () => undefined,
      requestCloseFrame: () => undefined,
      requestCommitDock(intent) {
        commits.push(intent);
        return { committed: true, sourceFrameDestroyed: false };
      }
    };
    const tabDragSink: WindowTabDragSink = {
      beginTabDrag: vi.fn(),
      moveTabDrag(point) {
        moves.push(point);
        return { state: "dragging", preview: null, source: null };
      },
      cancelTabDrag: vi.fn(),
      endTabDrag: vi.fn(() => ({
        source: {
          frameId: "debug-frame",
          sourceTabsetId: "debug-tabset",
          viewActorId: "debug-view",
          viewKey: "debug"
        },
        preview: {
          kind: "split",
          operation: "cross-frame-split",
          targetFrameId: "workspace-root-frame",
          targetTabsetId: "scene-tabset",
          placement: "right",
          rect: { left: 600, top: 80, right: 900, bottom: 640, width: 300, height: 560 }
        }
      } as const))
    };
    const component = new FloatingWindowComponent(actor, {
      id: "floating-window:debug",
      frameId: "debug-frame",
      parent: parent as unknown as HTMLElement,
      document: document as unknown as Document,
      title: "Debug",
      stateBinding: { kind: "runtime" },
      initialState: {
        position: uiVec2(12, 24),
        size: uiVec2(320, 180),
        visible: true
      },
      frameIntentSink,
      tabDragSink
    }, {
      surface: createSurface()
    });
    const tabHit = createActorInputHit("floating-window:debug", {
      partId: WINDOW_FRAME_TAB_PART_ID,
      data: {
        tabsetId: "debug-tabset",
        tab: {
          viewActorId: "debug-view",
          viewKey: "debug"
        }
      }
    });
    const titlebarHit = createActorInputHit("floating-window:debug", {
      partId: "titlebar-empty"
    });

    component.onInputStart(createActorInputStartEvent(tabHit, {
      point: { x: 20, y: 36 }
    }));
    component.onInputMove(createActorInputMoveEvent(titlebarHit, {
      point: { x: 760, y: 360 },
      totalDelta: { dx: 740, dy: 324 }
    }));
    component.onInputEnd(createActorInputEndEvent(titlebarHit, {
      point: { x: 760, y: 360 },
      totalDelta: { dx: 740, dy: 324 },
      wasClick: false
    }));

    expect(tabDragSink.beginTabDrag).toHaveBeenCalledWith({
      frameId: "debug-frame",
      sourceTabsetId: "debug-tabset",
      viewActorId: "debug-view",
      viewKey: "debug"
    }, { x: 20, y: 36 });
    expect(moves).toEqual([{ x: 760, y: 360 }]);
    expect(tabDragSink.endTabDrag).toHaveBeenCalledTimes(1);
    expect(commits).toEqual([{
      kind: "split-tab",
      operation: "cross-frame-split",
      source: {
        frameId: "debug-frame",
        sourceTabsetId: "debug-tabset",
        viewActorId: "debug-view",
        viewKey: "debug"
      },
      targetFrameId: "workspace-root-frame",
      targetTabsetId: "scene-tabset",
      placement: "right",
      reason: "dock-drop"
    }]);
    expect(component.state.position).toEqual({ x: 12, y: 24 });
  });
});

function createSurface(): WindowFrameSurfaceComponent {
  return {
    attachHost: vi.fn(),
    detachHost: vi.fn(),
    endSplitResize: vi.fn(),
    beginSplitResize: vi.fn(),
    updateSplitRatioFromDrag: vi.fn(() => null),
    refreshActiveContentState: vi.fn(),
    getActiveOrFirstTabBounds: vi.fn(() => createRect(0, 0, 120, 24)),
    renderFrameSurface: vi.fn(),
    measureFrameSurfaceGeometry: vi.fn(),
    placeContent: vi.fn(),
    removeContent: vi.fn(),
    setContentActive: vi.fn(),
    hitTest: vi.fn(() => null)
  } as unknown as WindowFrameSurfaceComponent;
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
  parentElement: FakeElement | null = null;

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

  getBoundingClientRect(): DOMRectReadOnly {
    return createRect(0, 0, 320, 180);
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
