import type { WindowDockSplitPlacement } from "./window-dock-targets";
import type {
  WindowFrameRuntimeDockNode,
  WindowFrameRuntimeSplitNode,
  WindowFrameRuntimeTabsetNode,
  WindowFrameTab
} from "./window-frame-port";

export type WindowFrameDockTreeSplitDirection = "horizontal" | "vertical";

export interface WindowFrameDockTreeTabsetNode {
  readonly kind: "tabset";
  readonly id: string;
  readonly tabs: readonly string[];
  readonly activeViewActorId: string | null;
}

export interface WindowFrameDockTreeSplitNode {
  readonly kind: "split";
  readonly id: string;
  readonly direction: WindowFrameDockTreeSplitDirection;
  readonly ratio: number;
  readonly first: WindowFrameDockTreeNode;
  readonly second: WindowFrameDockTreeNode;
}

export type WindowFrameDockTreeNode =
  | WindowFrameDockTreeTabsetNode
  | WindowFrameDockTreeSplitNode;

interface RemoveWindowFrameDockTreeTabResult {
  readonly node: WindowFrameDockTreeNode | null;
  readonly removed: boolean;
}

interface SplitWindowFrameDockTreeTabResult {
  readonly node: WindowFrameDockTreeNode | null;
  readonly split: boolean;
}

let nextWindowFrameDockTreeNodeId = 1;

export function createWindowFrameDockTreeTabset(
  tabs: readonly string[],
  activeViewActorId: string | null,
  id = createWindowFrameDockTreeTabsetId()
): WindowFrameDockTreeTabsetNode {
  return {
    kind: "tabset",
    id,
    tabs: [...tabs],
    activeViewActorId: activeViewActorId && tabs.includes(activeViewActorId)
      ? activeViewActorId
      : tabs[0] ?? null
  };
}

export function createWindowFrameDockTreeSplit(
  direction: WindowFrameDockTreeSplitDirection,
  first: WindowFrameDockTreeNode,
  second: WindowFrameDockTreeNode,
  ratio = 0.5,
  id = createWindowFrameDockTreeSplitId()
): WindowFrameDockTreeSplitNode {
  const clampedRatio = Math.min(0.9, Math.max(0.1, ratio));
  return {
    kind: "split",
    id,
    direction,
    ratio: clampedRatio,
    first,
    second
  };
}

export function cloneWindowFrameRuntimeDockRoot(
  node: WindowFrameDockTreeNode
): WindowFrameRuntimeDockNode {
  if (node.kind === "tabset") {
    return {
      kind: "tabset",
      id: node.id,
      tabs: [...node.tabs],
      activeViewActorId: node.activeViewActorId
    };
  }
  return {
    kind: "split",
    id: node.id,
    direction: node.direction,
    ratio: node.ratio,
    first: cloneWindowFrameRuntimeDockRoot(node.first),
    second: cloneWindowFrameRuntimeDockRoot(node.second)
  };
}

export function restoreWindowFrameDockTreeFromRuntimeRoot(
  node: WindowFrameRuntimeDockNode
): WindowFrameDockTreeNode {
  if (node.kind === "tabset") {
    return restoreWindowFrameDockTreeTabset(node);
  }
  return restoreWindowFrameDockTreeSplit(node);
}

export function listWindowFrameDockTreeViewActorIds(
  node: WindowFrameDockTreeNode
): readonly string[] {
  if (node.kind === "tabset") return [...node.tabs];
  const viewActorIds: string[] = [];
  const seen = new Set<string>();
  for (const viewActorId of [
    ...listWindowFrameDockTreeViewActorIds(node.first),
    ...listWindowFrameDockTreeViewActorIds(node.second)
  ]) {
    if (seen.has(viewActorId)) continue;
    seen.add(viewActorId);
    viewActorIds.push(viewActorId);
  }
  return viewActorIds;
}

export function mergeWindowFrameTabsByActorId(
  currentTabs: readonly WindowFrameTab[],
  restoredTabs: readonly WindowFrameTab[],
  viewActorIds: readonly string[]
): WindowFrameTab[] {
  const tabsByViewActorId = new Map<string, WindowFrameTab>();
  for (const tab of currentTabs) {
    tabsByViewActorId.set(tab.viewActorId, { ...tab });
  }
  for (const tab of restoredTabs) {
    tabsByViewActorId.set(tab.viewActorId, { ...tab });
  }
  return viewActorIds
    .map((viewActorId) => tabsByViewActorId.get(viewActorId))
    .filter((tab): tab is WindowFrameTab => Boolean(tab));
}

export function findActiveViewActorIdInWindowFrameDockTree(
  node: WindowFrameDockTreeNode
): string | null {
  if (node.kind === "tabset") return node.activeViewActorId;
  return findActiveViewActorIdInWindowFrameDockTree(node.first) ??
    findActiveViewActorIdInWindowFrameDockTree(node.second);
}

export function listActiveViewActorIdsInWindowFrameDockTree(
  node: WindowFrameDockTreeNode
): readonly string[] {
  if (node.kind === "tabset") {
    return node.activeViewActorId ? [node.activeViewActorId] : [];
  }
  return [
    ...listActiveViewActorIdsInWindowFrameDockTree(node.first),
    ...listActiveViewActorIdsInWindowFrameDockTree(node.second)
  ];
}

export function addTabToWindowFrameDockTree(
  node: WindowFrameDockTreeNode,
  viewActorId: string,
  options: {
    readonly active?: boolean;
    readonly targetTabsetId?: string;
  }
): WindowFrameDockTreeNode {
  const targetTabsetId = options.targetTabsetId ?? findFirstWindowFrameDockTreeTabset(node)?.id;
  if (!targetTabsetId) {
    return createWindowFrameDockTreeTabset([viewActorId], viewActorId);
  }
  return updateWindowFrameDockTreeTabset(node, targetTabsetId, (tabset) => {
    const tabs = tabset.tabs.includes(viewActorId) ? tabset.tabs : [...tabset.tabs, viewActorId];
    return createWindowFrameDockTreeTabset(
      tabs,
      options.active ? viewActorId : tabset.activeViewActorId,
      tabset.id
    );
  });
}

export function splitTabInWindowFrameDockTree(
  node: WindowFrameDockTreeNode,
  viewActorId: string,
  options: {
    readonly targetTabsetId: string;
    readonly placement: WindowDockSplitPlacement;
    readonly active?: boolean;
  }
): SplitWindowFrameDockTreeTabResult {
  const removed = removeTabFromWindowFrameDockTree(node, viewActorId);
  const rootWithoutSource = removed.node ?? node;
  const split = splitWindowFrameDockTreeTargetTabset(rootWithoutSource, viewActorId, options);
  return {
    node: split.node,
    split: split.split
  };
}

export function removeTabFromWindowFrameDockTree(
  node: WindowFrameDockTreeNode,
  viewActorId: string
): RemoveWindowFrameDockTreeTabResult {
  if (node.kind === "tabset") {
    if (!node.tabs.includes(viewActorId)) {
      return { node, removed: false };
    }
    const removedIndex = node.tabs.indexOf(viewActorId);
    const tabs = node.tabs.filter((tab) => tab !== viewActorId);
    if (tabs.length === 0) {
      return { node: null, removed: true };
    }
    const activeViewActorId = node.activeViewActorId === viewActorId
      ? tabs[Math.min(removedIndex, tabs.length - 1)] ?? tabs[0]
      : node.activeViewActorId;
    return {
      node: createWindowFrameDockTreeTabset(tabs, activeViewActorId, node.id),
      removed: true
    };
  }

  const first = removeTabFromWindowFrameDockTree(node.first, viewActorId);
  const second = removeTabFromWindowFrameDockTree(node.second, viewActorId);
  if (!first.removed && !second.removed) {
    return { node, removed: false };
  }
  if (!first.node) return { node: second.node, removed: true };
  if (!second.node) return { node: first.node, removed: true };
  return {
    node: createWindowFrameDockTreeSplit(node.direction, first.node, second.node, node.ratio, node.id),
    removed: true
  };
}

export function activateTabInWindowFrameDockTree(
  node: WindowFrameDockTreeNode,
  viewActorId: string
): WindowFrameDockTreeNode {
  if (node.kind === "tabset") {
    return node.tabs.includes(viewActorId)
      ? createWindowFrameDockTreeTabset(node.tabs, viewActorId, node.id)
      : node;
  }
  return createWindowFrameDockTreeSplit(
    node.direction,
    activateTabInWindowFrameDockTree(node.first, viewActorId),
    activateTabInWindowFrameDockTree(node.second, viewActorId),
    node.ratio,
    node.id
  );
}

export function updateWindowFrameDockTreeSplitRatio(
  node: WindowFrameDockTreeNode,
  splitId: string,
  ratio: number
): WindowFrameDockTreeNode {
  if (node.kind === "tabset") return node;
  if (node.id === splitId) {
    return createWindowFrameDockTreeSplit(node.direction, node.first, node.second, ratio, node.id);
  }
  return createWindowFrameDockTreeSplit(
    node.direction,
    updateWindowFrameDockTreeSplitRatio(node.first, splitId, ratio),
    updateWindowFrameDockTreeSplitRatio(node.second, splitId, ratio),
    node.ratio,
    node.id
  );
}

export function findWindowFrameDockTreeSplitById(
  node: WindowFrameDockTreeNode,
  splitId: string
): WindowFrameDockTreeSplitNode | null {
  if (node.kind === "tabset") return null;
  if (node.id === splitId) return node;
  return findWindowFrameDockTreeSplitById(node.first, splitId) ??
    findWindowFrameDockTreeSplitById(node.second, splitId);
}

export function findWindowFrameDockTreeTabsetById(
  node: WindowFrameDockTreeNode,
  tabsetId: string
): WindowFrameDockTreeTabsetNode | null {
  if (node.kind === "tabset") {
    return node.id === tabsetId ? node : null;
  }
  return findWindowFrameDockTreeTabsetById(node.first, tabsetId) ??
    findWindowFrameDockTreeTabsetById(node.second, tabsetId);
}

export function findWindowFrameDockTreeTabsetContaining(
  node: WindowFrameDockTreeNode,
  viewActorId: string
): WindowFrameDockTreeTabsetNode | null {
  if (node.kind === "tabset") {
    return node.tabs.includes(viewActorId) ? node : null;
  }
  return findWindowFrameDockTreeTabsetContaining(node.first, viewActorId) ??
    findWindowFrameDockTreeTabsetContaining(node.second, viewActorId);
}

function restoreWindowFrameDockTreeTabset(
  node: WindowFrameRuntimeTabsetNode
): WindowFrameDockTreeTabsetNode {
  return {
    kind: "tabset",
    id: node.id,
    tabs: [...node.tabs],
    activeViewActorId: node.activeViewActorId && node.tabs.includes(node.activeViewActorId)
      ? node.activeViewActorId
      : node.tabs[0] ?? null
  };
}

function restoreWindowFrameDockTreeSplit(
  node: WindowFrameRuntimeSplitNode
): WindowFrameDockTreeSplitNode {
  return {
    kind: "split",
    id: node.id,
    direction: node.direction,
    ratio: Math.min(0.9, Math.max(0.1, node.ratio)),
    first: restoreWindowFrameDockTreeFromRuntimeRoot(node.first),
    second: restoreWindowFrameDockTreeFromRuntimeRoot(node.second)
  };
}

function splitWindowFrameDockTreeTargetTabset(
  node: WindowFrameDockTreeNode,
  viewActorId: string,
  options: {
    readonly targetTabsetId: string;
    readonly placement: WindowDockSplitPlacement;
    readonly active?: boolean;
  }
): SplitWindowFrameDockTreeTabResult {
  if (node.kind === "tabset") {
    if (node.id !== options.targetTabsetId) {
      return { node, split: false };
    }
    if (node.tabs.length === 0) {
      return { node: null, split: false };
    }
    const sourceTabset = createWindowFrameDockTreeTabset([viewActorId], viewActorId);
    const targetTabset = createWindowFrameDockTreeTabset(node.tabs, node.activeViewActorId, node.id);
    return {
      split: true,
      node: createWindowFrameDockTreeSplitForPlacement(sourceTabset, targetTabset, options.placement)
    };
  }

  const first = splitWindowFrameDockTreeTargetTabset(node.first, viewActorId, options);
  if (first.split) {
    return {
      split: true,
      node: first.node
        ? createWindowFrameDockTreeSplit(node.direction, first.node, node.second, node.ratio, node.id)
        : node.second
    };
  }
  const second = splitWindowFrameDockTreeTargetTabset(node.second, viewActorId, options);
  if (second.split) {
    return {
      split: true,
      node: second.node
        ? createWindowFrameDockTreeSplit(node.direction, node.first, second.node, node.ratio, node.id)
        : node.first
    };
  }
  return { node, split: false };
}

function createWindowFrameDockTreeSplitForPlacement(
  source: WindowFrameDockTreeTabsetNode,
  target: WindowFrameDockTreeTabsetNode,
  placement: WindowDockSplitPlacement
): WindowFrameDockTreeSplitNode {
  const direction: WindowFrameDockTreeSplitDirection =
    placement === "left" || placement === "right" ? "horizontal" : "vertical";
  const sourceBeforeTarget = placement === "left" || placement === "top";
  return createWindowFrameDockTreeSplit(
    direction,
    sourceBeforeTarget ? source : target,
    sourceBeforeTarget ? target : source,
    sourceBeforeTarget ? 0.34 : 0.66
  );
}

function updateWindowFrameDockTreeTabset(
  node: WindowFrameDockTreeNode,
  tabsetId: string,
  update: (tabset: WindowFrameDockTreeTabsetNode) => WindowFrameDockTreeTabsetNode
): WindowFrameDockTreeNode {
  if (node.kind === "tabset") {
    return node.id === tabsetId ? update(node) : node;
  }
  return createWindowFrameDockTreeSplit(
    node.direction,
    updateWindowFrameDockTreeTabset(node.first, tabsetId, update),
    updateWindowFrameDockTreeTabset(node.second, tabsetId, update),
    node.ratio,
    node.id
  );
}

function findFirstWindowFrameDockTreeTabset(
  node: WindowFrameDockTreeNode
): WindowFrameDockTreeTabsetNode | null {
  if (node.kind === "tabset") return node;
  return findFirstWindowFrameDockTreeTabset(node.first) ?? findFirstWindowFrameDockTreeTabset(node.second);
}

function createWindowFrameDockTreeTabsetId(): string {
  return `frame-tabset:${nextWindowFrameDockTreeNodeId++}`;
}

function createWindowFrameDockTreeSplitId(): string {
  return `frame-split:${nextWindowFrameDockTreeNodeId++}`;
}
