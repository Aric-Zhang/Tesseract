import { describe, expect, it } from "vitest";
import {
  activateTabInWindowFrameDockTree,
  addTabToWindowFrameDockTree,
  cloneWindowFrameRuntimeDockRoot,
  createWindowFrameDockTreeTabset,
  findWindowFrameDockTreeTabsetContaining,
  listWindowFrameDockTreeViewActorIds,
  removeTabFromWindowFrameDockTree,
  restoreWindowFrameDockTreeFromRuntimeRoot,
  splitTabInWindowFrameDockTree,
  updateWindowFrameDockTreeSplitRatio,
  type WindowFrameDockTreeNode
} from "./window-frame-dock-tree";
import type { WindowFrameRuntimeDockNode, WindowFrameTab } from "./window-frame-tab";

function tab(viewActorId: string): WindowFrameTab {
  return {
    viewActorId,
    viewKey: "debug",
    title: viewActorId
  };
}

function expectValidDockTree(
  root: WindowFrameDockTreeNode,
  tabs: readonly WindowFrameTab[]
): void {
  const knownViews = new Set(tabs.map((candidate) => candidate.viewActorId));
  const seenViews = new Set<string>();
  const seenNodeIds = new Set<string>();

  function visit(node: WindowFrameDockTreeNode): void {
    expect(seenNodeIds.has(node.id)).toBe(false);
    seenNodeIds.add(node.id);
    if (node.kind === "tabset") {
      expect(node.tabs.length).toBeGreaterThan(0);
      if (node.activeViewActorId !== null) {
        expect(node.tabs).toContain(node.activeViewActorId);
      }
      for (const viewActorId of node.tabs) {
        expect(knownViews.has(viewActorId)).toBe(true);
        expect(seenViews.has(viewActorId)).toBe(false);
        seenViews.add(viewActorId);
      }
      return;
    }

    expect(node.ratio).toBeGreaterThanOrEqual(0.1);
    expect(node.ratio).toBeLessThanOrEqual(0.9);
    visit(node.first);
    visit(node.second);
  }

  visit(root);
}

function findSplitId(node: WindowFrameDockTreeNode): string | null {
  if (node.kind === "split") return node.id;
  return null;
}

describe("window frame dock tree", () => {
  it("adds and activates tabs while preserving tabset ids", () => {
    const root = createWindowFrameDockTreeTabset(["scene-view"], "scene-view", "tabset:scene");
    const withDebug = addTabToWindowFrameDockTree(root, "debug-view", { active: true });
    const withHierarchy = addTabToWindowFrameDockTree(withDebug, "hierarchy-view", { active: false });
    const activatedScene = activateTabInWindowFrameDockTree(withHierarchy, "scene-view");

    expect(activatedScene).toEqual({
      kind: "tabset",
      id: "tabset:scene",
      tabs: ["scene-view", "debug-view", "hierarchy-view"],
      activeViewActorId: "scene-view"
    });
    expectValidDockTree(activatedScene, [
      tab("scene-view"),
      tab("debug-view"),
      tab("hierarchy-view")
    ]);
  });

  it("splits tabs with stable target ids and collapses empty branches on remove", () => {
    const root = addTabToWindowFrameDockTree(
      createWindowFrameDockTreeTabset(["scene-view"], "scene-view", "tabset:scene"),
      "debug-view",
      { active: true }
    );
    const split = splitTabInWindowFrameDockTree(root, "debug-view", {
      targetTabsetId: "tabset:scene",
      placement: "right",
      active: true
    });

    expect(split.split).toBe(true);
    expect(split.node?.kind).toBe("split");
    expect(split.node?.id).toMatch(/^frame-split:/);
    expect(findWindowFrameDockTreeTabsetContaining(split.node!, "scene-view")?.id).toBe("tabset:scene");
    expect(findWindowFrameDockTreeTabsetContaining(split.node!, "debug-view")?.id).toMatch(/^frame-tabset:/);
    expectValidDockTree(split.node!, [tab("scene-view"), tab("debug-view")]);

    const removed = removeTabFromWindowFrameDockTree(split.node!, "debug-view");
    expect(removed.removed).toBe(true);
    expect(removed.node).toEqual({
      kind: "tabset",
      id: "tabset:scene",
      tabs: ["scene-view"],
      activeViewActorId: "scene-view"
    });
  });

  it("does not split a tab into itself when removing the source empties the target tabset", () => {
    const root = createWindowFrameDockTreeTabset(["scene-view"], "scene-view", "tabset:scene");
    const split = splitTabInWindowFrameDockTree(root, "scene-view", {
      targetTabsetId: "tabset:scene",
      placement: "left",
      active: true
    });

    expect(split).toEqual({
      node: root,
      split: false
    });
    expectValidDockTree(root, [tab("scene-view")]);
  });

  it("updates split ratios without changing node ids", () => {
    const split = splitTabInWindowFrameDockTree(
      addTabToWindowFrameDockTree(
        createWindowFrameDockTreeTabset(["scene-view"], "scene-view", "tabset:scene"),
        "debug-view",
        { active: true }
      ),
      "debug-view",
      {
        targetTabsetId: "tabset:scene",
        placement: "left",
        active: true
      }
    );
    const root = split.node!;
    const splitId = findSplitId(root);
    expect(splitId).not.toBeNull();

    const updated = updateWindowFrameDockTreeSplitRatio(root, splitId!, 0.98);
    if (updated.kind !== "split") {
      throw new Error("Expected updated root to remain split.");
    }
    expect(updated.id).toBe(splitId);
    expect(updated.ratio).toBe(0.9);
  });

  it("round-trips runtime roots and keeps view order unique", () => {
    const persisted: WindowFrameRuntimeDockNode = {
      kind: "split",
      id: "split:root",
      direction: "horizontal",
      ratio: 0.25,
      first: {
        kind: "tabset",
        id: "tabset:left",
        tabs: ["scene-view", "scene-view"],
        activeViewActorId: "missing-view"
      },
      second: {
        kind: "tabset",
        id: "tabset:right",
        tabs: ["debug-view"],
        activeViewActorId: "debug-view"
      }
    };
    const restored = restoreWindowFrameDockTreeFromRuntimeRoot(persisted);

    expect(restored.kind).toBe("split");
    expect(listWindowFrameDockTreeViewActorIds(restored)).toEqual(["scene-view", "debug-view"]);
    expect(cloneWindowFrameRuntimeDockRoot(restored)).toEqual({
      kind: "split",
      id: "split:root",
      direction: "horizontal",
      ratio: 0.25,
      first: {
        kind: "tabset",
        id: "tabset:left",
        tabs: ["scene-view", "scene-view"],
        activeViewActorId: "scene-view"
      },
      second: {
        kind: "tabset",
        id: "tabset:right",
        tabs: ["debug-view"],
        activeViewActorId: "debug-view"
      }
    });
  });
});
