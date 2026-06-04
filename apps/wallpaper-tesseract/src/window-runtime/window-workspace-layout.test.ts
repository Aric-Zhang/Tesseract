import { describe, expect, it } from "vitest";
import {
  createWindowWorkspaceLayout,
  dockWindowAsTab,
  findDockTabsetContaining,
  normalizeWindowWorkspaceLayout,
  removeWindowFromDock,
  removeWindowFromLayout,
  setActiveDockTab,
  splitDockTab,
  undockWindow,
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
