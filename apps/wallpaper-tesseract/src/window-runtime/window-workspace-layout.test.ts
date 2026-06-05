import { describe, expect, it } from "vitest";
import {
  closeFrameInWorkspaceFrameLayout,
  createSingleTabWindowFrame,
  createWindowWorkspaceFrameLayout,
  createWindowWorkspaceLayout,
  dockWindowAsTab,
  findDockTabsetContaining,
  findFrameContainingView,
  normalizeWindowWorkspaceFrameLayout,
  normalizeWindowWorkspaceLayout,
  removeWindowFromDock,
  removeWindowFromLayout,
  restoreViewAsSingleTabFrame,
  setActiveDockTab,
  splitDockViewInFrameLayout,
  splitDockTab,
  undockWindow,
  type WindowFrameSplitNode,
  type WindowFrameTabsetNode,
  type WindowWorkspaceFrameLayout,
  type WindowWorkspaceLayout,
  type WindowWorkspaceSplitNode,
  type WindowWorkspaceTabsetNode
} from "./window-workspace-layout";

function createSubject(): WindowWorkspaceLayout {
  return createWindowWorkspaceLayout({
    windows: [
      { actorId: "scene-window", title: "Scene", canDock: false },
      { actorId: "debug-log-window", title: "Debug Log" },
      { actorId: "hierarchy-panel", title: "Hierarchy" }
    ]
  });
}

function expectTabset(node: unknown): WindowWorkspaceTabsetNode {
  expect(node).toMatchObject({ kind: "tabset" });
  return node as WindowWorkspaceTabsetNode;
}

function expectSplit(node: unknown): WindowWorkspaceSplitNode {
  expect(node).toMatchObject({ kind: "split" });
  return node as WindowWorkspaceSplitNode;
}

function expectFrameTabset(node: unknown): WindowFrameTabsetNode {
  expect(node).toMatchObject({ kind: "tabset" });
  return node as WindowFrameTabsetNode;
}

function expectFrameSplit(node: unknown): WindowFrameSplitNode {
  expect(node).toMatchObject({ kind: "split" });
  return node as WindowFrameSplitNode;
}

function expectValidLayout(layout: WindowWorkspaceLayout): void {
  const knownActorIds = new Set(Object.keys(layout.windows));
  const floatingActorIds = layout.floating.map((window) => window.actorId);
  const dockedActorIds = new Set<string>();

  expect(new Set(floatingActorIds).size).toBe(floatingActorIds.length);
  for (const actorId of floatingActorIds) {
    expect(knownActorIds.has(actorId)).toBe(true);
  }

  const visitDockNode = (node: WindowWorkspaceLayout["dockRoot"]): void => {
    if (!node) return;
    if (node.kind === "tabset") {
      expect(node.tabs.length).toBeGreaterThan(0);
      expect(node.activeTabId).not.toBeNull();
      expect(node.activeTabId ? node.tabs.includes(node.activeTabId) : false).toBe(true);
      expect(new Set(node.tabs).size).toBe(node.tabs.length);
      for (const actorId of node.tabs) {
        expect(knownActorIds.has(actorId)).toBe(true);
        expect(layout.windows[actorId]?.canDock).not.toBe(false);
        expect(dockedActorIds.has(actorId)).toBe(false);
        dockedActorIds.add(actorId);
      }
      return;
    }
    expect(node.ratio).toBeGreaterThanOrEqual(0.1);
    expect(node.ratio).toBeLessThanOrEqual(0.9);
    visitDockNode(node.first);
    visitDockNode(node.second);
  };

  visitDockNode(layout.dockRoot);
  for (const actorId of floatingActorIds) {
    expect(dockedActorIds.has(actorId)).toBe(false);
  }
}

function createFrameSubject(): WindowWorkspaceFrameLayout {
  return createWindowWorkspaceFrameLayout({
    views: [
      { viewKey: "scene", actorId: "scene-view-actor", title: "Scene" },
      { viewKey: "debug", actorId: "debug-view-actor", title: "Debug Log" },
      { viewKey: "hierarchy", actorId: "hierarchy-view-actor", title: "Hierarchy" }
    ],
    defaultBounds: {
      position: { x: 10, y: 20 },
      size: { x: 320, y: 200 },
      visible: true
    }
  });
}

function expectValidFrameLayout(layout: WindowWorkspaceFrameLayout): void {
  const visibleViewKeys = new Set<string>();
  const visitDockNode = (node: WindowWorkspaceFrameLayout["frames"][number]["root"]): void => {
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
    visitDockNode(node.first);
    visitDockNode(node.second);
  };

  for (const frame of layout.frames) {
    visitDockNode(frame.root);
  }
  expect(Object.keys(layout.views).sort()).toEqual([...visibleViewKeys].sort());
  for (const hiddenViewKey of layout.hiddenViewKeys) {
    expect(visibleViewKeys.has(hiddenViewKey)).toBe(false);
  }
}

describe("WindowWorkspaceLayout", () => {
  it("starts with registered windows floating", () => {
    const layout = createSubject();

    expectValidLayout(layout);
    expect(Object.keys(layout.windows)).toEqual([
      "scene-window",
      "debug-log-window",
      "hierarchy-panel"
    ]);
    expect(layout.floating.map((window) => window.actorId)).toEqual([
      "scene-window",
      "debug-log-window",
      "hierarchy-panel"
    ]);
    expect(layout.dockRoot).toBeNull();
  });

  it("docks two windows into a tabset and activates the latest tab", () => {
    const withDebug = dockWindowAsTab(createSubject(), "debug-log-window");
    const withHierarchy = dockWindowAsTab(withDebug, "hierarchy-panel");
    const root = expectTabset(withHierarchy.dockRoot);

    expectValidLayout(withDebug);
    expectValidLayout(withHierarchy);
    expect(root.tabs).toEqual(["debug-log-window", "hierarchy-panel"]);
    expect(root.activeTabId).toBe("hierarchy-panel");
    expect(withHierarchy.floating.map((window) => window.actorId)).toEqual(["scene-window"]);
    expect(findDockTabsetContaining(withHierarchy, "debug-log-window")?.id).toBe(root.id);
  });

  it("switches active tabs without mutating the previous layout", () => {
    const docked = dockWindowAsTab(dockWindowAsTab(createSubject(), "debug-log-window"), "hierarchy-panel");
    const root = expectTabset(docked.dockRoot);

    const activated = setActiveDockTab(docked, root.id, "debug-log-window");

    expectValidLayout(activated);
    expect(expectTabset(activated.dockRoot).activeTabId).toBe("debug-log-window");
    expect(expectTabset(docked.dockRoot).activeTabId).toBe("hierarchy-panel");
  });

  it("removes the active tab and selects the adjacent tab", () => {
    const docked = dockWindowAsTab(dockWindowAsTab(createSubject(), "debug-log-window"), "hierarchy-panel");

    const removed = removeWindowFromLayout(docked, "hierarchy-panel");
    const root = expectTabset(removed.dockRoot);

    expectValidLayout(removed);
    expect(root.tabs).toEqual(["debug-log-window"]);
    expect(root.activeTabId).toBe("debug-log-window");
    expect(removed.windows["hierarchy-panel"]).toBeUndefined();
  });

  it("removes a docked tab without deleting the window descriptor", () => {
    const docked = dockWindowAsTab(dockWindowAsTab(createSubject(), "debug-log-window"), "hierarchy-panel");

    const hidden = removeWindowFromDock(docked, "hierarchy-panel");
    const root = expectTabset(hidden.dockRoot);

    expectValidLayout(hidden);
    expect(root.tabs).toEqual(["debug-log-window"]);
    expect(root.activeTabId).toBe("debug-log-window");
    expect(hidden.windows["hierarchy-panel"]).toEqual({
      actorId: "hierarchy-panel",
      title: "Hierarchy"
    });
    expect(hidden.floating.some((window) => window.actorId === "hierarchy-panel")).toBe(false);
  });

  it("leaves floating windows untouched when removing from dock", () => {
    const layout = createSubject();

    const unchanged = removeWindowFromDock(layout, "debug-log-window");

    expect(unchanged).toBe(layout);
    expectValidLayout(unchanged);
  });

  it("removes empty dock groups when the last tab is removed", () => {
    const docked = dockWindowAsTab(createSubject(), "debug-log-window");

    const removed = removeWindowFromLayout(docked, "debug-log-window");

    expectValidLayout(removed);
    expect(removed.dockRoot).toBeNull();
    expect(removed.floating.map((window) => window.actorId)).toEqual([
      "scene-window",
      "hierarchy-panel"
    ]);
  });

  it("splits one tab out of a tabset into a pure split tree", () => {
    const docked = dockWindowAsTab(dockWindowAsTab(createSubject(), "debug-log-window"), "hierarchy-panel");

    const splitLayout = splitDockTab(docked, "hierarchy-panel", {
      direction: "horizontal",
      placement: "after",
      ratio: 0.62
    });
    const split = expectSplit(splitLayout.dockRoot);

    expectValidLayout(splitLayout);
    expect(split.direction).toBe("horizontal");
    expect(split.ratio).toBe(0.62);
    expect(expectTabset(split.first).tabs).toEqual(["debug-log-window"]);
    expect(expectTabset(split.second).tabs).toEqual(["hierarchy-panel"]);
    expect(docked.dockRoot).toMatchObject({
      kind: "tabset",
      tabs: ["debug-log-window", "hierarchy-panel"]
    });
  });

  it("undocks a tab back into the floating list and normalizes the dock tree", () => {
    const docked = dockWindowAsTab(dockWindowAsTab(createSubject(), "debug-log-window"), "hierarchy-panel");

    const undocked = undockWindow(docked, "debug-log-window");

    expectValidLayout(undocked);
    expect(undocked.floating.map((window) => window.actorId)).toEqual([
      "scene-window",
      "debug-log-window"
    ]);
    expect(expectTabset(undocked.dockRoot).tabs).toEqual(["hierarchy-panel"]);
  });

  it("rejects non-dockable Scene windows", () => {
    const layout = createSubject();

    expect(() => dockWindowAsTab(layout, "scene-window")).toThrow(/cannot be docked/);
    expect(layout.dockRoot).toBeNull();
  });

  it("clamps split ratios and keeps split invariants", () => {
    const docked = dockWindowAsTab(dockWindowAsTab(createSubject(), "debug-log-window"), "hierarchy-panel");

    const splitLayout = splitDockTab(docked, "hierarchy-panel", {
      direction: "vertical",
      ratio: 99
    });
    const split = expectSplit(splitLayout.dockRoot);

    expectValidLayout(splitLayout);
    expect(split.ratio).toBe(0.9);
    expect(split.first).toMatchObject({ kind: "tabset" });
    expect(split.second).toMatchObject({ kind: "tabset" });
  });

  it("normalizes hydrated layouts from persisted or external state", () => {
    const raw: WindowWorkspaceLayout = {
      windows: {
        "scene-window": { actorId: "scene-window", title: "Scene", canDock: false },
        "debug-log-window": { actorId: "debug-log-window", title: "Debug Log" },
        "hierarchy-panel": { actorId: "hierarchy-panel", title: "Hierarchy" }
      },
      floating: [
        { actorId: "scene-window" },
        { actorId: "debug-log-window" },
        { actorId: "debug-log-window" },
        { actorId: "missing-window" }
      ],
      dockRoot: {
        kind: "split",
        id: "persisted-split-id",
        direction: "horizontal",
        ratio: 99,
        first: {
          kind: "tabset",
          id: "persisted-tabset-a",
          tabs: [
            "debug-log-window",
            "debug-log-window",
            "scene-window",
            "missing-window",
            "hierarchy-panel"
          ],
          activeTabId: "missing-window"
        },
        second: {
          kind: "tabset",
          id: "persisted-tabset-b",
          tabs: ["hierarchy-panel"],
          activeTabId: "hierarchy-panel"
        }
      }
    };

    const normalized = normalizeWindowWorkspaceLayout(raw);
    const root = expectTabset(normalized.dockRoot);

    expectValidLayout(normalized);
    expect(root.tabs).toEqual(["debug-log-window", "hierarchy-panel"]);
    expect(root.activeTabId).toBe("debug-log-window");
    expect(root.id).toBe("tabset:debug-log-window+hierarchy-panel");
    expect(normalized.floating.map((window) => window.actorId)).toEqual(["scene-window"]);
  });

  it("creates layouts through the same normalization path", () => {
    const layout = createWindowWorkspaceLayout({
      windows: [
        { actorId: "scene-window", title: "Scene", canDock: false },
        { actorId: "debug-log-window", title: "Debug Log" }
      ],
      floating: ["debug-log-window", "debug-log-window", "missing-window"],
      dockRoot: {
        kind: "tabset",
        id: "persisted-tabset",
        tabs: ["debug-log-window", "scene-window", "missing-window"],
        activeTabId: "scene-window"
      }
    });

    const root = expectTabset(layout.dockRoot);

    expectValidLayout(layout);
    expect(root.tabs).toEqual(["debug-log-window"]);
    expect(root.activeTabId).toBe("debug-log-window");
    expect(layout.floating).toEqual([]);
  });

  it("throws for unknown windows and invalid active tabs", () => {
    const layout = createSubject();
    const docked = dockWindowAsTab(layout, "debug-log-window");
    const root = expectTabset(docked.dockRoot);

    expect(() => dockWindowAsTab(layout, "missing")).toThrow(/Unknown workspace window/);
    expect(() => setActiveDockTab(docked, root.id, "hierarchy-panel")).toThrow(/not in dock tabset/);
    expect(() => setActiveDockTab(docked, "missing-tabset", "debug-log-window")).toThrow(/not found/);
  });
});

describe("WindowWorkspaceFrameLayout", () => {
  it("creates one single-tab frame per live view key", () => {
    const layout = createFrameSubject();

    expectValidFrameLayout(layout);
    expect(Object.keys(layout.views)).toEqual(["scene", "debug", "hierarchy"]);
    expect(layout.frames.map((frame) => frame.frameId)).toEqual([
      "frame:scene",
      "frame:debug",
      "frame:hierarchy"
    ]);
    expect(layout.frames.map((frame) => expectFrameTabset(frame.root).tabs)).toEqual([
      ["scene"],
      ["debug"],
      ["hierarchy"]
    ]);
    expect(layout.frames[0]?.bounds).toEqual({
      position: { x: 10, y: 20 },
      size: { x: 320, y: 200 },
      visible: true
    });
  });

  it("closes a frame by removing its live view descriptors", () => {
    const layout = createFrameSubject();

    const closed = closeFrameInWorkspaceFrameLayout(layout, "frame:debug");

    expectValidFrameLayout(closed);
    expect(closed.views["debug"]).toBeUndefined();
    expect(closed.frames.map((frame) => frame.frameId)).toEqual(["frame:scene", "frame:hierarchy"]);
    expect(closed.hiddenViewKeys).toEqual(["debug"]);
    expect(findFrameContainingView(closed, "debug")).toBeNull();
    expect(layout.views["debug"]).toBeDefined();
  });

  it("restores a view as a fresh single-tab frame by stable view key", () => {
    const closed = closeFrameInWorkspaceFrameLayout(createFrameSubject(), "frame:debug");

    const restored = restoreViewAsSingleTabFrame(closed, {
      view: { viewKey: "debug", actorId: "debug-view-actor-2", title: "Debug Log" },
      frameId: "frame:debug:2",
      bounds: {
        position: { x: 40, y: 50 },
        size: { x: 360, y: 240 },
        visible: true
      }
    });

    expectValidFrameLayout(restored);
    expect(restored.views["debug"]?.actorId).toBe("debug-view-actor-2");
    expect(restored.hiddenViewKeys).toEqual([]);
    expect(findFrameContainingView(restored, "debug")?.frameId).toBe("frame:debug:2");
    expect(expectFrameTabset(restored.frames.at(-1)?.root).tabs).toEqual(["debug"]);
    expect(() => restoreViewAsSingleTabFrame(restored, {
      view: { viewKey: "debug", actorId: "debug-view-actor-3" }
    })).toThrow(/already live/);
  });

  it("normalizes duplicate, unknown, and inactive tabs in hydrated frame layouts", () => {
    const raw: WindowWorkspaceFrameLayout = {
      views: {
        scene: { viewKey: "scene", actorId: "scene-view-actor", title: "Scene" },
        debug: { viewKey: "debug", actorId: "debug-view-actor", title: "Debug Log" },
        hierarchy: { viewKey: "hierarchy", actorId: "hierarchy-view-actor", title: "Hierarchy" }
      },
      frames: [
        {
          frameId: "frame:a",
          bounds: { position: { x: 0, y: 0 }, size: { x: 100, y: 100 }, visible: true },
          presentation: "windowed",
          root: {
            kind: "tabset",
            id: "persisted-a",
            tabs: ["debug", "debug", "missing", "hierarchy"],
            activeTabId: "missing"
          }
        },
        {
          frameId: "frame:b",
          bounds: { position: { x: 100, y: 0 }, size: { x: 100, y: 100 }, visible: true },
          presentation: "windowed",
          root: {
            kind: "tabset",
            id: "persisted-b",
            tabs: ["hierarchy", "scene"],
            activeTabId: "scene"
          }
        }
      ],
      hiddenViewKeys: ["debug"]
    };

    const normalized = normalizeWindowWorkspaceFrameLayout(raw);

    expectValidFrameLayout(normalized);
    expect(expectFrameTabset(normalized.frames[0]?.root).id).toBe("persisted-a");
    expect(expectFrameTabset(normalized.frames[0]?.root).tabs).toEqual(["debug", "hierarchy"]);
    expect(expectFrameTabset(normalized.frames[0]?.root).activeTabId).toBe("debug");
    expect(expectFrameTabset(normalized.frames[1]?.root).id).toBe("persisted-b");
    expect(expectFrameTabset(normalized.frames[1]?.root).tabs).toEqual(["scene"]);
    expect(normalized.hiddenViewKeys).toEqual([]);
  });

  it("collapses empty split branches and clamps split ratios", () => {
    const raw = createWindowWorkspaceFrameLayout({
      views: [
        { viewKey: "debug", actorId: "debug-view-actor" },
        { viewKey: "hierarchy", actorId: "hierarchy-view-actor" }
      ],
      frames: [{
        frameId: "frame:tools",
        bounds: { position: { x: 0, y: 0 }, size: { x: 100, y: 100 }, visible: true },
        presentation: "windowed",
        root: {
          kind: "split",
          id: "persisted-split",
          direction: "horizontal",
          ratio: 99,
          first: createSingleTabWindowFrame({ viewKey: "debug" }).root,
          second: {
            kind: "tabset",
            id: "unknown-tabset",
            tabs: ["missing"],
            activeTabId: "missing"
          }
        }
      }]
    });

    expectValidFrameLayout(raw);
    expect(expectFrameTabset(raw.frames[0]?.root).tabs).toEqual(["debug"]);

    const splitLayout = normalizeWindowWorkspaceFrameLayout({
      views: {
        debug: { viewKey: "debug", actorId: "debug-view-actor" },
        hierarchy: { viewKey: "hierarchy", actorId: "hierarchy-view-actor" }
      },
      frames: [{
        frameId: "frame:split",
        bounds: { position: { x: 0, y: 0 }, size: { x: 100, y: 100 }, visible: true },
        presentation: "windowed",
        root: {
          kind: "split",
          id: "persisted-split",
          direction: "vertical",
          ratio: 99,
          first: createSingleTabWindowFrame({ viewKey: "debug" }).root,
          second: createSingleTabWindowFrame({ viewKey: "hierarchy" }).root
        }
      }],
      hiddenViewKeys: []
    });
    const split = expectFrameSplit(splitLayout.frames[0]?.root);

    expectValidFrameLayout(splitLayout);
    expect(split.id).toBe("persisted-split");
    expect(split.ratio).toBe(0.9);
    expect(expectFrameTabset(split.first).tabs).toEqual(["debug"]);
    expect(expectFrameTabset(split.second).tabs).toEqual(["hierarchy"]);
  });

  it("generates opaque frame node ids only when hydrated ids are missing", () => {
    const normalized = normalizeWindowWorkspaceFrameLayout({
      views: {
        debug: { viewKey: "debug", actorId: "debug-view-actor" },
        hierarchy: { viewKey: "hierarchy", actorId: "hierarchy-view-actor" }
      },
      frames: [{
        frameId: "frame:missing-ids",
        bounds: { position: { x: 0, y: 0 }, size: { x: 100, y: 100 }, visible: true },
        presentation: "windowed",
        root: {
          kind: "split",
          id: "",
          direction: "horizontal",
          ratio: 0.5,
          first: {
            kind: "tabset",
            id: "",
            tabs: ["debug"],
            activeTabId: "debug"
          },
          second: {
            kind: "tabset",
            id: "persisted-hierarchy",
            tabs: ["hierarchy"],
            activeTabId: "hierarchy"
          }
        }
      }],
      hiddenViewKeys: []
    });
    const split = expectFrameSplit(normalized.frames[0]?.root);

    expectValidFrameLayout(normalized);
    expect(split.id).toMatch(/^frame-split:/);
    expect(expectFrameTabset(split.first).id).toMatch(/^frame-tabset:/);
    expect(expectFrameTabset(split.second).id).toBe("persisted-hierarchy");
  });

  it("rejects duplicate view keys before creating frames", () => {
    expect(() => createWindowWorkspaceFrameLayout({
      views: [
        { viewKey: "debug", actorId: "debug-view-actor" },
        { viewKey: "debug", actorId: "debug-view-actor-2" }
      ]
    })).toThrow(/Duplicate window view key/);
  });

  it("splits a source view into the left or right side of a target frame", () => {
    const layout = createFrameSubject();
    const targetTabsetId = expectFrameTabset(layout.frames[2]?.root).id;

    const left = splitDockViewInFrameLayout(layout, {
      sourceViewActorId: "debug-view-actor",
      targetFrameId: "frame:hierarchy",
      targetTabsetId,
      placement: "left"
    });
    const right = splitDockViewInFrameLayout(layout, {
      sourceViewActorId: "debug-view-actor",
      targetFrameId: "frame:hierarchy",
      targetTabsetId,
      placement: "right"
    });

    expect(left.committed).toBe(true);
    expect(right.committed).toBe(true);
    if (!left.committed || !right.committed) return;

    const leftTarget = left.layout.frames.find((frame) => frame.frameId === "frame:hierarchy");
    const leftSplit = expectFrameSplit(leftTarget?.root);
    expectValidFrameLayout(left.layout);
    expect(left.emptySourceFrameId).toBe("frame:debug");
    expect(leftSplit.direction).toBe("horizontal");
    expect(leftSplit.ratio).toBe(0.34);
    expect(expectFrameTabset(leftSplit.first).tabs).toEqual(["debug"]);
    expect(expectFrameTabset(leftSplit.second).tabs).toEqual(["hierarchy"]);

    const rightTarget = right.layout.frames.find((frame) => frame.frameId === "frame:hierarchy");
    const rightSplit = expectFrameSplit(rightTarget?.root);
    expectValidFrameLayout(right.layout);
    expect(right.emptySourceFrameId).toBe("frame:debug");
    expect(rightSplit.direction).toBe("horizontal");
    expect(rightSplit.ratio).toBeCloseTo(0.66);
    expect(expectFrameTabset(rightSplit.first).tabs).toEqual(["hierarchy"]);
    expect(expectFrameTabset(rightSplit.second).tabs).toEqual(["debug"]);
  });

  it("splits a source view into the top or bottom side of a target frame", () => {
    const layout = createFrameSubject();
    const targetTabsetId = expectFrameTabset(layout.frames[2]?.root).id;

    const top = splitDockViewInFrameLayout(layout, {
      sourceViewActorId: "debug-view-actor",
      targetFrameId: "frame:hierarchy",
      targetTabsetId,
      placement: "top"
    });
    const bottom = splitDockViewInFrameLayout(layout, {
      sourceViewActorId: "debug-view-actor",
      targetFrameId: "frame:hierarchy",
      targetTabsetId,
      placement: "bottom"
    });

    expect(top.committed).toBe(true);
    expect(bottom.committed).toBe(true);
    if (!top.committed || !bottom.committed) return;

    const topSplit = expectFrameSplit(top.layout.frames.find((frame) => frame.frameId === "frame:hierarchy")?.root);
    expectValidFrameLayout(top.layout);
    expect(topSplit.direction).toBe("vertical");
    expect(topSplit.ratio).toBe(0.34);
    expect(expectFrameTabset(topSplit.first).tabs).toEqual(["debug"]);
    expect(expectFrameTabset(topSplit.second).tabs).toEqual(["hierarchy"]);

    const bottomSplit = expectFrameSplit(bottom.layout.frames.find((frame) => frame.frameId === "frame:hierarchy")?.root);
    expectValidFrameLayout(bottom.layout);
    expect(bottomSplit.direction).toBe("vertical");
    expect(bottomSplit.ratio).toBeCloseTo(0.66);
    expect(expectFrameTabset(bottomSplit.first).tabs).toEqual(["hierarchy"]);
    expect(expectFrameTabset(bottomSplit.second).tabs).toEqual(["debug"]);
  });

  it("splits one tab out of an existing frame tabset without actor mutation", () => {
    const raw = createWindowWorkspaceFrameLayout({
      views: [
        { viewKey: "debug", actorId: "debug-view-actor" },
        { viewKey: "hierarchy", actorId: "hierarchy-view-actor" }
      ],
      frames: [{
        frameId: "frame:tools",
        bounds: { position: { x: 0, y: 0 }, size: { x: 100, y: 100 }, visible: true },
        presentation: "windowed",
        root: {
          kind: "tabset",
          id: "persisted-tools",
          tabs: ["debug", "hierarchy"],
          activeTabId: "hierarchy"
        }
      }]
    });
    const tabsetId = expectFrameTabset(raw.frames[0]?.root).id;

    const result = splitDockViewInFrameLayout(raw, {
      sourceViewActorId: "debug-view-actor",
      targetFrameId: "frame:tools",
      targetTabsetId: tabsetId,
      placement: "left"
    });

    expect(result.committed).toBe(true);
    if (!result.committed) return;
    const split = expectFrameSplit(result.layout.frames[0]?.root);
    expectValidFrameLayout(result.layout);
    expect(result.emptySourceFrameId).toBeNull();
    expect(expectFrameTabset(split.second).id).toBe("persisted-tools");
    expect(expectFrameTabset(split.first).id).not.toBe("persisted-tools");
    expect(expectFrameTabset(split.first).tabs).toEqual(["debug"]);
    expect(expectFrameTabset(split.second).tabs).toEqual(["hierarchy"]);
    expect(expectFrameTabset(split.second).activeTabId).toBe("hierarchy");
  });

  it("returns unchanged layout for invalid split commits", () => {
    const layout = createFrameSubject();
    const targetTabsetId = expectFrameTabset(layout.frames[2]?.root).id;

    const unknownSource = splitDockViewInFrameLayout(layout, {
      sourceViewActorId: "missing-view-actor",
      targetFrameId: "frame:hierarchy",
      targetTabsetId,
      placement: "left"
    });
    const missingTarget = splitDockViewInFrameLayout(layout, {
      sourceViewActorId: "debug-view-actor",
      targetFrameId: "missing-frame",
      targetTabsetId,
      placement: "left"
    });
    const missingTabset = splitDockViewInFrameLayout(layout, {
      sourceViewActorId: "debug-view-actor",
      targetFrameId: "frame:hierarchy",
      targetTabsetId: "missing-tabset",
      placement: "left"
    });

    expect(unknownSource).toEqual({
      committed: false,
      layout,
      reason: "source view is not live"
    });
    expect(missingTarget).toEqual({
      committed: false,
      layout,
      reason: "target frame is missing"
    });
    expect(missingTabset).toEqual({
      committed: false,
      layout,
      reason: "target tabset is missing"
    });
  });

  it("rejects non-dockable views in split commits", () => {
    const layout = createWindowWorkspaceFrameLayout({
      views: [
        { viewKey: "scene", actorId: "scene-view-actor", canDock: false },
        { viewKey: "debug", actorId: "debug-view-actor" }
      ]
    });
    const targetTabsetId = expectFrameTabset(layout.frames[1]?.root).id;

    const result = splitDockViewInFrameLayout(layout, {
      sourceViewActorId: "scene-view-actor",
      targetFrameId: "frame:debug",
      targetTabsetId,
      placement: "left"
    });

    expect(result).toEqual({
      committed: false,
      layout,
      reason: "source view cannot be docked"
    });
  });
});
