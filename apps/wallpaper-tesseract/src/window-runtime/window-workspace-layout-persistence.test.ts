import { describe, expect, it } from "vitest";
import {
  createWindowWorkspaceFrameLayout,
  type WindowFrameDockNode,
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

  it("hydrates mixed known and unknown views while collapsing now-empty split branches", () => {
    const persisted = parsePersistedWindowWorkspaceFrameLayout({
      version: 1,
      views: [
        { viewKey: "missing", title: "Missing" },
        { viewKey: "scene", title: "Scene" },
        { viewKey: "debug", title: "Debug Log" }
      ],
      frames: [{
        frameId: "mixed-frame",
        bounds: {
          position: { x: 10, y: 20 },
          size: { x: 500, y: 320 },
          visible: true
        },
        presentation: "windowed",
        root: {
          kind: "split",
          id: "persisted-split",
          direction: "horizontal",
          ratio: 0.35,
          first: {
            kind: "tabset",
            id: "unknown-branch",
            tabs: ["missing"],
            activeTabId: "missing"
          },
          second: {
            kind: "tabset",
            id: "known-branch",
            tabs: ["scene", "debug"],
            activeTabId: "debug"
          }
        }
      }],
      hiddenViewKeys: ["missing", "hierarchy"]
    });
    expect(persisted).not.toBeNull();

    const hydrated = hydrateWindowWorkspaceFrameLayout(persisted!, [
      { viewKey: "scene", actorId: "scene-view-actor-2", title: "Scene Runtime 2" },
      { viewKey: "debug", actorId: "debug-view-actor-2", title: "Debug Runtime 2" }
    ]);

    expectValidFrameLayout(hydrated);
    expect(Object.keys(hydrated.views)).toEqual(["scene", "debug"]);
    expect(expectTabset(hydrated.frames[0]?.root).tabs).toEqual(["scene", "debug"]);
    expect(expectTabset(hydrated.frames[0]?.root).activeTabId).toBe("debug");
    expect(hydrated.hiddenViewKeys).toEqual([]);
  });

  it("normalizes duplicate persisted views and duplicate tabs deterministically", () => {
    const persisted = parsePersistedWindowWorkspaceFrameLayout({
      version: 1,
      views: [
        { viewKey: "scene", title: "Old Scene" },
        { viewKey: "debug", title: "Debug Log" },
        { viewKey: "scene", title: "New Scene" }
      ],
      frames: [{
        frameId: "duplicate-frame",
        bounds: {
          position: { x: 10, y: 20 },
          size: { x: 500, y: 320 },
          visible: true
        },
        presentation: "windowed",
        root: {
          kind: "tabset",
          id: "duplicate-tabset",
          tabs: ["scene", "scene", "debug"],
          activeTabId: "scene"
        }
      }],
      hiddenViewKeys: ["debug", "debug"]
    });
    expect(persisted).not.toBeNull();

    const hydrated = hydrateWindowWorkspaceFrameLayout(persisted!, [
      { viewKey: "scene", actorId: "scene-view-actor-2", title: "Runtime Scene" },
      { viewKey: "debug", actorId: "debug-view-actor-2", title: "Runtime Debug" }
    ]);

    expectValidFrameLayout(hydrated);
    expect(hydrated.views["scene"]?.title).toBe("New Scene");
    expect(expectTabset(hydrated.frames[0]?.root).tabs).toEqual(["scene", "debug"]);
    expect(hydrated.hiddenViewKeys).toEqual([]);
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

  it("parses top-level-valid payloads by pruning malformed entries", () => {
    const parsed = parsePersistedWindowWorkspaceFrameLayout({
      version: 1,
      views: [
        { viewKey: "scene", title: "Scene" },
        { viewKey: "" },
        42
      ],
      frames: [
        {
          frameId: "valid-frame",
          bounds: {
            position: { x: 10, y: 20 },
            size: { x: 500, y: 320 },
            visible: true
          },
          presentation: "windowed",
          root: {
            kind: "tabset",
            id: "valid-tabset",
            tabs: ["scene"],
            activeTabId: "scene"
          }
        },
        {
          frameId: "",
          bounds: {
            position: { x: 0, y: 0 },
            size: { x: 100, y: 100 },
            visible: true
          },
          presentation: "windowed",
          root: {
            kind: "tabset",
            id: "missing-frame-id",
            tabs: ["scene"],
            activeTabId: "scene"
          }
        },
        {
          frameId: "empty-tabset-frame",
          bounds: {
            position: { x: 0, y: 0 },
            size: { x: 100, y: 100 },
            visible: true
          },
          presentation: "windowed",
          root: {
            kind: "tabset",
            id: "empty",
            tabs: [],
            activeTabId: "scene"
          }
        }
      ],
      hiddenViewKeys: ["debug", "", 7]
    });

    expect(parsed?.views.map((view) => view.viewKey)).toEqual(["scene"]);
    expect(parsed?.frames.map((frame) => frame.frameId)).toEqual(["valid-frame"]);
    expect(parsed?.hiddenViewKeys).toEqual(["debug"]);
  });

  it("rejects malformed top-level storage shapes instead of partially guessing", () => {
    const persisted = serializeWindowWorkspaceFrameLayout(createSubjectLayout());

    expect(parsePersistedWindowWorkspaceFrameLayout({ ...persisted, frames: "bad" })).toBeNull();
    expect(parsePersistedWindowWorkspaceFrameLayout({ ...persisted, views: "bad" })).toBeNull();
    expect(parsePersistedWindowWorkspaceFrameLayout({ ...persisted, hiddenViewKeys: "bad" })).toBeNull();
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

function expectValidFrameLayout(layout: WindowWorkspaceFrameLayout): void {
  const visibleViewKeys = new Set<string>();

  for (const frame of layout.frames) {
    visitDockNode(frame.root, layout, visibleViewKeys);
  }

  expect(Object.keys(layout.views).sort()).toEqual([...visibleViewKeys].sort());
  for (const hiddenViewKey of layout.hiddenViewKeys) {
    expect(visibleViewKeys.has(hiddenViewKey)).toBe(false);
  }
}

function visitDockNode(
  node: WindowFrameDockNode,
  layout: WindowWorkspaceFrameLayout,
  visibleViewKeys: Set<string>
): void {
  if (node.kind === "tabset") {
    expect(node.tabs.length).toBeGreaterThan(0);
    expect(node.tabs.includes(node.activeTabId)).toBe(true);
    expect(new Set(node.tabs).size).toBe(node.tabs.length);
    for (const viewKey of node.tabs) {
      expect(layout.views[viewKey]).toBeDefined();
      expect(visibleViewKeys.has(viewKey)).toBe(false);
      visibleViewKeys.add(viewKey);
    }
    return;
  }
  expect(node.ratio).toBeGreaterThanOrEqual(0.1);
  expect(node.ratio).toBeLessThanOrEqual(0.9);
  visitDockNode(node.first, layout, visibleViewKeys);
  visitDockNode(node.second, layout, visibleViewKeys);
}
