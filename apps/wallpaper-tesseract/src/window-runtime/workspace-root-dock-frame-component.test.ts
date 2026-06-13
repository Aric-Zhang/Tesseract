import { describe, expect, it, vi } from "vitest";
import { ActorSystem } from "../actor-runtime";
import {
  createActorInputEndEvent,
  createActorInputHit,
  createActorInputMoveEvent,
  createActorInputStartEvent
} from "../test-support/actor-input-events";
import type { ActorInputCancelEvent, ActorInputHit } from "../gizmo-runtime";
import {
  WINDOW_FRAME_TAB_PART_ID,
  type WindowFrameSurfaceComponent
} from "ui-framework";
import type { WindowDockCommitIntent, WindowFrameIntentSink } from "./window-frame-lifecycle";
import type { WindowTabDragSink } from "./window-dock-preview-component";
import { WorkspaceRootDockFrameComponent } from "./workspace-root-dock-frame-component";

describe("WorkspaceRootDockFrameComponent", () => {
  it("keeps a root tab drag session active after the pointer leaves the tab hit", () => {
    const actorSystem = new ActorSystem();
    const actor = actorSystem.createActor({ id: "workspace-root" });
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
        return {
          state: "dragging",
          source: {
            frameId: "workspace-root-frame",
            sourceTabsetId: "scene-tabset",
            viewActorId: "scene-view",
            viewKey: "scene"
          },
          preview: {
            kind: "split",
            operation: "same-frame-split",
            targetFrameId: "workspace-root-frame",
            targetTabsetId: "debug-tabset",
            placement: "left",
            rect: { left: 640, top: 84, right: 960, bottom: 640, width: 320, height: 556 }
          }
        };
      },
      cancelTabDrag: vi.fn(),
      endTabDrag: vi.fn(() => ({
        source: {
          frameId: "workspace-root-frame",
          sourceTabsetId: "scene-tabset",
          viewActorId: "scene-view",
          viewKey: "scene"
        },
        preview: {
          kind: "split",
          operation: "same-frame-split",
          targetFrameId: "workspace-root-frame",
          targetTabsetId: "debug-tabset",
          placement: "left",
          rect: { left: 640, top: 84, right: 960, bottom: 640, width: 320, height: 556 }
        }
      } as const))
    };
    const component = new WorkspaceRootDockFrameComponent(actor, {
      id: "workspace-root-frame",
      parent: parent as unknown as HTMLElement,
      document: document as unknown as Document,
      frameIntentSink,
      tabDragSink
    }, {
      surface: createSurface()
    });
    const tabHit = createActorInputHit("workspace-root-frame", {
      partId: WINDOW_FRAME_TAB_PART_ID,
      data: {
        tabsetId: "scene-tabset",
        tab: {
          viewActorId: "scene-view",
          viewKey: "scene"
        }
      }
    });
    const contentHit = createActorInputHit("workspace-root-frame", {
      partId: "root-content"
    });

    component.onInputStart(createActorInputStartEvent(tabHit, {
      point: { x: 81, y: 70 }
    }));
    component.onInputMove(createActorInputMoveEvent(contentHit, {
      point: { x: 670, y: 410 },
      totalDelta: { dx: 589, dy: 340 }
    }));
    component.onInputEnd(createActorInputEndEvent(contentHit, {
      point: { x: 670, y: 410 },
      totalDelta: { dx: 589, dy: 340 },
      wasClick: false
    }));

    expect(tabDragSink.beginTabDrag).toHaveBeenCalledWith({
      frameId: "workspace-root-frame",
      sourceTabsetId: "scene-tabset",
      viewActorId: "scene-view",
      viewKey: "scene"
    }, { x: 81, y: 70 });
    expect(moves).toEqual([{ x: 670, y: 410 }]);
    expect(tabDragSink.endTabDrag).toHaveBeenCalledTimes(1);
    expect(commits).toEqual([{
      kind: "split-tab",
      operation: "same-frame-split",
      source: {
        frameId: "workspace-root-frame",
        sourceTabsetId: "scene-tabset",
        viewActorId: "scene-view",
        viewKey: "scene"
      },
      targetFrameId: "workspace-root-frame",
      targetTabsetId: "debug-tabset",
      placement: "left",
      reason: "dock-drop"
    }]);
  });

  it("cancels a root tab drag session even when cancel hits non-tab content", () => {
    const actorSystem = new ActorSystem();
    const actor = actorSystem.createActor({ id: "workspace-root" });
    const document = new FakeDocument();
    const parent = document.createElement("div");
    const tabDragSink: WindowTabDragSink = {
      beginTabDrag: vi.fn(),
      moveTabDrag: vi.fn(() => ({ state: "dragging", preview: null, source: null })),
      cancelTabDrag: vi.fn(),
      endTabDrag: vi.fn(() => null)
    };
    const component = new WorkspaceRootDockFrameComponent(actor, {
      id: "workspace-root-frame",
      parent: parent as unknown as HTMLElement,
      document: document as unknown as Document,
      tabDragSink
    }, {
      surface: createSurface()
    });
    const tabHit = createActorInputHit("workspace-root-frame", {
      partId: WINDOW_FRAME_TAB_PART_ID,
      data: {
        tabsetId: "scene-tabset",
        tab: {
          viewActorId: "scene-view",
          viewKey: "scene"
        }
      }
    });
    const contentHit = createActorInputHit("workspace-root-frame", {
      partId: "root-content"
    });

    component.onInputStart(createActorInputStartEvent(tabHit));
    component.onInputCancel(createActorInputCancelEvent(contentHit));

    expect(tabDragSink.cancelTabDrag).toHaveBeenCalledTimes(1);
  });
});

function createActorInputCancelEvent(hit: ActorInputHit): ActorInputCancelEvent {
  return {
    gizmo: {
      id: hit.componentId,
      priority: 0,
      hitTest() {
        return {
          gizmoId: hit.componentId,
          partId: hit.partId,
          kind: "custom"
        };
      }
    },
    hit,
    pointerId: 1,
    pointerType: "mouse",
    timeStamp: 30,
    point: { x: 670, y: 410 },
    startPoint: { x: 81, y: 70 },
    buttons: 0,
    reason: "pointercancel"
  };
}

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
  readonly style: Record<string, string> = {};
  readonly children: FakeElement[] = [];
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
    const siblings = this.parentElement.children;
    const index = siblings.indexOf(this);
    if (index >= 0) siblings.splice(index, 1);
    this.parentElement = null;
  }

  getBoundingClientRect(): DOMRectReadOnly {
    return createRect(0, 0, 1280, 720);
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
    toJSON: () => ({})
  };
}
