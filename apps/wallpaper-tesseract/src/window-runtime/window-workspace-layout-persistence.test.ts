import { describe, expect, it } from "vitest";
import {
  createWindowWorkspaceFrameLayout,
  type WindowFrameSplitNode,
  type WindowFrameTabsetNode,
  type WindowWorkspaceFrameLayout
} from "./window-workspace-layout";
import {
  hydrateWindowWorkspaceFrameLayout,
  parsePersistedWindowWorkspaceFrameLayout,
  serializeWindowWorkspaceFrameLayout
} from "./window-workspace-layout-persistence";

describe("window workspace frame layout persistence", () => {
  it("serializes logical view keys without storing runtime actor ids in frame roots", () => {
    const layout = createSubjectLayout();

    const persisted = serializeWindowWorkspaceFrameLayout(layout);

    expect(persisted.version).toBe(1);
    expect(persisted.views).toEqual([
      { viewKey: "scene", title: "Scene", canDock: undefined },
      { viewKey: "debug", title: "Debug Log", canDock: undefined },
      { viewKey: "hierarchy", title: "Hierarchy", canDock: undefined }
    ]);
    expect(JSON.stringify(persisted)).not.toContain("scene-view-actor");
    expect(JSON.stringify(persisted)).not.toContain("debug-view-actor");
    expect(expectTabset(expectSplit(persisted.frames[0]?.root).first).tabs).toEqual(["scene"]);
    expect(expectTabset(expectSplit(persisted.frames[0]?.root).second).tabs).toEqual(["debug", "hierarchy"]);
  });

  it("hydrates persisted logical layout with fresh runtime actor ids", () => {
    const persisted = serializeWindowWorkspaceFrameLayout(createSubjectLayout());

    const hydrated = hydrateWindowWorkspaceFrameLayout(persisted, [
      { viewKey: "scene", actorId: "scene-view-actor-2", title: "Scene Runtime 2" },
      { viewKey: "debug", actorId: "debug-view-actor-2", title: "Debug Runtime 2" },
      { viewKey: "hierarchy", actorId: "hierarchy-view-actor-2", title: "Hierarchy Runtime 2" }
    ]);

    expect(hydrated.views["scene"]?.actorId).toBe("scene-view-actor-2");
    expect(hydrated.views["debug"]?.actorId).toBe("debug-view-actor-2");
    expect(hydrated.views["hierarchy"]?.actorId).toBe("hierarchy-view-actor-2");
    expect(expectTabset(expectSplit(hydrated.frames[0]?.root).first).tabs).toEqual(["scene"]);
    expect(expectTabset(expectSplit(hydrated.frames[0]?.root).second).tabs).toEqual(["debug", "hierarchy"]);
  });

  it("normalizes unknown views during hydration", () => {
    const persisted = serializeWindowWorkspaceFrameLayout(createSubjectLayout());

    const hydrated = hydrateWindowWorkspaceFrameLayout(persisted, [
      { viewKey: "scene", actorId: "scene-view-actor-2", title: "Scene Runtime 2" }
    ]);

    expect(Object.keys(hydrated.views)).toEqual(["scene"]);
    expect(hydrated.frames).toHaveLength(1);
    expect(expectTabset(hydrated.frames[0]?.root).tabs).toEqual(["scene"]);
  });

  it("parses valid persisted JSON and rejects invalid versions", () => {
    const persisted = serializeWindowWorkspaceFrameLayout(createSubjectLayout());

    const parsed = parsePersistedWindowWorkspaceFrameLayout(JSON.parse(JSON.stringify(persisted)));

    expect(parsed?.version).toBe(1);
    expect(parsed?.views.map((view) => view.viewKey)).toEqual(["scene", "debug", "hierarchy"]);
    expect(parsed?.frames.map((frame) => frame.frameId)).toEqual(["frame:scene-tools"]);
    expect(parsePersistedWindowWorkspaceFrameLayout({ ...persisted, version: 999 })).toBeNull();
    expect(parsePersistedWindowWorkspaceFrameLayout("not layout")).toBeNull();
  });
});

function createSubjectLayout(): WindowWorkspaceFrameLayout {
  return createWindowWorkspaceFrameLayout({
    views: [
      { viewKey: "scene", actorId: "scene-view-actor", title: "Scene" },
      { viewKey: "debug", actorId: "debug-view-actor", title: "Debug Log" },
      { viewKey: "hierarchy", actorId: "hierarchy-view-actor", title: "Hierarchy" }
    ],
    frames: [{
      frameId: "frame:scene-tools",
      bounds: {
        position: { x: 10, y: 20 },
        size: { x: 500, y: 320 },
        visible: true
      },
      presentation: "windowed",
      root: {
        kind: "split",
        id: "persisted-root",
        direction: "horizontal",
        ratio: 0.4,
        first: {
          kind: "tabset",
          id: "persisted-scene",
          tabs: ["scene"],
          activeTabId: "scene"
        },
        second: {
          kind: "tabset",
          id: "persisted-tools",
          tabs: ["debug", "hierarchy"],
          activeTabId: "hierarchy"
        }
      }
    }]
  });
}

function expectSplit(node: unknown): WindowFrameSplitNode {
  expect(node).toMatchObject({ kind: "split" });
  return node as WindowFrameSplitNode;
}

function expectTabset(node: unknown): WindowFrameTabsetNode {
  expect(node).toMatchObject({ kind: "tabset" });
  return node as WindowFrameTabsetNode;
}
