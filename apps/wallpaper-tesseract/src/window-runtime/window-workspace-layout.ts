export type WindowWorkspaceSplitDirection = "horizontal" | "vertical";
export type WindowWorkspaceSplitPlacement = "before" | "after";

export interface WindowWorkspaceWindowDescriptor {
  readonly actorId: string;
  readonly title?: string;
  readonly canDock?: boolean;
}

export interface WindowWorkspaceFloatingWindow {
  readonly actorId: string;
}

export interface WindowWorkspaceTabsetNode {
  readonly kind: "tabset";
  /**
   * Derived from current node content for deterministic tests and debugging.
   * Treat it as volatile: UI and persistence must not cache it as a stable identity.
   */
  readonly id: string;
  readonly tabs: readonly string[];
  readonly activeTabId: string | null;
}

export interface WindowWorkspaceSplitNode {
  readonly kind: "split";
  /**
   * Derived from current node content for deterministic tests and debugging.
   * Treat it as volatile: UI and persistence must not cache it as a stable identity.
   */
  readonly id: string;
  readonly direction: WindowWorkspaceSplitDirection;
  readonly ratio: number;
  readonly first: WindowWorkspaceDockNode;
  readonly second: WindowWorkspaceDockNode;
}

export type WindowWorkspaceDockNode = WindowWorkspaceTabsetNode | WindowWorkspaceSplitNode;

export interface WindowWorkspaceLayout {
  readonly windows: Readonly<Record<string, WindowWorkspaceWindowDescriptor>>;
  readonly floating: readonly WindowWorkspaceFloatingWindow[];
  readonly dockRoot: WindowWorkspaceDockNode | null;
}

export interface CreateWindowWorkspaceLayoutOptions {
  readonly windows?: readonly WindowWorkspaceWindowDescriptor[];
  readonly floating?: readonly string[];
  readonly dockRoot?: WindowWorkspaceDockNode | null;
}

export interface SplitDockTabOptions {
  readonly direction: WindowWorkspaceSplitDirection;
  readonly placement?: WindowWorkspaceSplitPlacement;
  readonly ratio?: number;
}

interface RemoveFromDockResult {
  readonly node: WindowWorkspaceDockNode | null;
  readonly removed: boolean;
}

export function createWindowWorkspaceLayout(
  options: CreateWindowWorkspaceLayoutOptions = {}
): WindowWorkspaceLayout {
  const windows = Object.fromEntries(
    (options.windows ?? []).map((window) => [window.actorId, { ...window }])
  );
  return normalizeWindowWorkspaceLayout({
    windows,
    floating: (options.floating ?? Object.keys(windows)).map((actorId) => ({ actorId })),
    dockRoot: options.dockRoot ? cloneDockNode(options.dockRoot) : null
  });
}

export function normalizeWindowWorkspaceLayout(layout: WindowWorkspaceLayout): WindowWorkspaceLayout {
  const windows = cloneWindowDescriptors(layout.windows);
  const dockedActorIds = new Set<string>();
  const dockRoot = normalizeDockNode(layout.dockRoot, windows, dockedActorIds);
  return {
    windows,
    floating: normalizeFloatingWindows(layout.floating, windows, dockedActorIds),
    dockRoot
  };
}

export function dockWindowAsTab(
  layout: WindowWorkspaceLayout,
  actorId: string,
  targetTabsetId?: string
): WindowWorkspaceLayout {
  assertKnownDockableWindow(layout, actorId);
  const detached = removeWindowFromDockRoot(layout.dockRoot, actorId);
  const floating = removeFloatingWindow(layout.floating, actorId);
  const dockRoot = addTabToDockRoot(detached.node, actorId, targetTabsetId);
  return {
    ...layout,
    floating,
    dockRoot
  };
}

export function setActiveDockTab(
  layout: WindowWorkspaceLayout,
  tabsetId: string,
  actorId: string
): WindowWorkspaceLayout {
  if (!findTabsetById(layout.dockRoot, tabsetId)) {
    throw new Error(`Dock tabset not found: ${tabsetId}.`);
  }
  const dockRoot = updateTabset(layout.dockRoot, tabsetId, (tabset) => {
    if (!tabset.tabs.includes(actorId)) {
      throw new Error(`Window ${actorId} is not in dock tabset ${tabsetId}.`);
    }
    return {
      ...tabset,
      activeTabId: actorId
    };
  });
  if (!dockRoot) {
    throw new Error(`Dock tabset not found: ${tabsetId}.`);
  }
  return {
    ...layout,
    dockRoot
  };
}

export function removeWindowFromLayout(
  layout: WindowWorkspaceLayout,
  actorId: string
): WindowWorkspaceLayout {
  const { [actorId]: _removedWindow, ...windows } = layout.windows;
  const floating = removeFloatingWindow(layout.floating, actorId);
  const dock = removeWindowFromDockRoot(layout.dockRoot, actorId);
  return {
    windows,
    floating,
    dockRoot: dock.node
  };
}

export function removeWindowFromDock(
  layout: WindowWorkspaceLayout,
  actorId: string
): WindowWorkspaceLayout {
  assertKnownWindow(layout, actorId);
  const dock = removeWindowFromDockRoot(layout.dockRoot, actorId);
  if (!dock.removed) return layout;
  return normalizeWindowWorkspaceLayout({
    ...layout,
    dockRoot: dock.node
  });
}

export function undockWindow(layout: WindowWorkspaceLayout, actorId: string): WindowWorkspaceLayout {
  assertKnownWindow(layout, actorId);
  const dock = removeWindowFromDockRoot(layout.dockRoot, actorId);
  if (!dock.removed) return layout;
  return {
    ...layout,
    floating: addFloatingWindow(layout.floating, actorId),
    dockRoot: dock.node
  };
}

export function splitDockTab(
  layout: WindowWorkspaceLayout,
  actorId: string,
  options: SplitDockTabOptions
): WindowWorkspaceLayout {
  assertKnownDockableWindow(layout, actorId);
  if (!layout.dockRoot) {
    throw new Error(`Cannot split ${actorId}; no dock root exists.`);
  }
  const dockRoot = splitTabInNode(layout.dockRoot, actorId, options);
  if (!dockRoot.changed) {
    throw new Error(`Cannot split ${actorId}; dock tab was not found.`);
  }
  return {
    ...layout,
    dockRoot: dockRoot.node
  };
}

export function findDockTabsetContaining(
  layout: WindowWorkspaceLayout,
  actorId: string
): WindowWorkspaceTabsetNode | null {
  return findTabsetContaining(layout.dockRoot, actorId);
}

function assertKnownWindow(layout: WindowWorkspaceLayout, actorId: string): void {
  if (!layout.windows[actorId]) {
    throw new Error(`Unknown workspace window: ${actorId}.`);
  }
}

function assertKnownDockableWindow(layout: WindowWorkspaceLayout, actorId: string): void {
  assertKnownWindow(layout, actorId);
  if (layout.windows[actorId]?.canDock === false) {
    throw new Error(`Window ${actorId} cannot be docked.`);
  }
}

function cloneWindowDescriptors(
  windows: Readonly<Record<string, WindowWorkspaceWindowDescriptor>>
): Record<string, WindowWorkspaceWindowDescriptor> {
  return Object.fromEntries(
    Object.entries(windows).map(([actorId, descriptor]) => [actorId, { ...descriptor }])
  );
}

function normalizeDockNode(
  node: WindowWorkspaceDockNode | null,
  windows: Readonly<Record<string, WindowWorkspaceWindowDescriptor>>,
  dockedActorIds: Set<string>
): WindowWorkspaceDockNode | null {
  if (!node) return null;
  if (node.kind === "tabset") {
    const tabs: string[] = [];
    for (const actorId of node.tabs) {
      if (!isKnownDockableWindow(windows, actorId)) continue;
      if (dockedActorIds.has(actorId)) continue;
      dockedActorIds.add(actorId);
      tabs.push(actorId);
    }
    if (tabs.length === 0) return null;
    const activeTabId = node.activeTabId && tabs.includes(node.activeTabId)
      ? node.activeTabId
      : tabs[0] ?? null;
    return createTabset(tabs, activeTabId);
  }

  const first = normalizeDockNode(node.first, windows, dockedActorIds);
  const second = normalizeDockNode(node.second, windows, dockedActorIds);
  if (!first && !second) return null;
  if (!first) return second;
  if (!second) return first;
  return createSplitNode(node.direction, first, second, node.ratio);
}

function normalizeFloatingWindows(
  floating: readonly WindowWorkspaceFloatingWindow[],
  windows: Readonly<Record<string, WindowWorkspaceWindowDescriptor>>,
  dockedActorIds: ReadonlySet<string>
): readonly WindowWorkspaceFloatingWindow[] {
  const seen = new Set<string>();
  const normalized: WindowWorkspaceFloatingWindow[] = [];
  for (const window of floating) {
    const actorId = window.actorId;
    if (!windows[actorId]) continue;
    if (dockedActorIds.has(actorId)) continue;
    if (seen.has(actorId)) continue;
    seen.add(actorId);
    normalized.push({ actorId });
  }
  return normalized;
}

function isKnownDockableWindow(
  windows: Readonly<Record<string, WindowWorkspaceWindowDescriptor>>,
  actorId: string
): boolean {
  return Boolean(windows[actorId] && windows[actorId]?.canDock !== false);
}

function addTabToDockRoot(
  node: WindowWorkspaceDockNode | null,
  actorId: string,
  targetTabsetId?: string
): WindowWorkspaceDockNode {
  if (!node) {
    return createTabset([actorId], actorId);
  }
  if (!targetTabsetId && node.kind === "tabset") {
    return addTabToTabset(node, actorId);
  }
  if (!targetTabsetId) {
    const firstTabset = findFirstTabset(node);
    if (!firstTabset) return createTabset([actorId], actorId);
    return replaceTabset(node, firstTabset.id, (tabset) => addTabToTabset(tabset, actorId));
  }
  const updated = replaceTabset(node, targetTabsetId, (tabset) => addTabToTabset(tabset, actorId));
  if (updated === node) {
    throw new Error(`Dock tabset not found: ${targetTabsetId}.`);
  }
  return updated;
}

function addTabToTabset(tabset: WindowWorkspaceTabsetNode, actorId: string): WindowWorkspaceTabsetNode {
  const tabs = tabset.tabs.includes(actorId) ? tabset.tabs : [...tabset.tabs, actorId];
  return {
    ...tabset,
    id: createTabsetId(tabs),
    tabs,
    activeTabId: actorId
  };
}

function removeWindowFromDockRoot(
  node: WindowWorkspaceDockNode | null,
  actorId: string
): RemoveFromDockResult {
  if (!node) return { node: null, removed: false };
  return removeWindowFromDockNode(node, actorId);
}

function removeWindowFromDockNode(
  node: WindowWorkspaceDockNode,
  actorId: string
): RemoveFromDockResult {
  if (node.kind === "tabset") {
    if (!node.tabs.includes(actorId)) {
      return { node, removed: false };
    }
    const removedIndex = node.tabs.indexOf(actorId);
    const tabs = node.tabs.filter((tab) => tab !== actorId);
    if (tabs.length === 0) {
      return { node: null, removed: true };
    }
    const activeTabId = node.activeTabId === actorId
      ? tabs[Math.min(removedIndex, tabs.length - 1)] ?? null
      : node.activeTabId;
    return {
      node: {
        ...node,
        id: createTabsetId(tabs),
        tabs,
        activeTabId
      },
      removed: true
    };
  }

  const first = removeWindowFromDockNode(node.first, actorId);
  const second = removeWindowFromDockNode(node.second, actorId);
  if (!first.removed && !second.removed) {
    return { node, removed: false };
  }
  if (!first.node) return { node: second.node, removed: true };
  if (!second.node) return { node: first.node, removed: true };
  return {
    node: {
      ...node,
      first: first.node,
      second: second.node,
      id: createSplitId(node.direction, first.node, second.node)
    },
    removed: true
  };
}

function splitTabInNode(
  node: WindowWorkspaceDockNode,
  actorId: string,
  options: SplitDockTabOptions
): { readonly node: WindowWorkspaceDockNode; readonly changed: boolean } {
  if (node.kind === "tabset") {
    if (!node.tabs.includes(actorId)) {
      return { node, changed: false };
    }
    if (node.tabs.length < 2) {
      throw new Error(`Cannot split ${actorId}; a tabset needs at least two tabs.`);
    }
    const removed = removeWindowFromDockNode(node, actorId);
    if (!removed.node) {
      throw new Error(`Cannot split ${actorId}; source tabset would be empty.`);
    }
    const tabNode = createTabset([actorId], actorId);
    const placement = options.placement ?? "after";
    const first = placement === "before" ? tabNode : removed.node;
    const second = placement === "before" ? removed.node : tabNode;
    return {
      changed: true,
      node: createSplitNode(options.direction, first, second, options.ratio)
    };
  }

  const first = splitTabInNode(node.first, actorId, options);
  if (first.changed) {
    return {
      changed: true,
      node: createSplitNode(node.direction, first.node, node.second, node.ratio)
    };
  }
  const second = splitTabInNode(node.second, actorId, options);
  if (second.changed) {
    return {
      changed: true,
      node: createSplitNode(node.direction, node.first, second.node, node.ratio)
    };
  }
  return { node, changed: false };
}

function updateTabset(
  node: WindowWorkspaceDockNode | null,
  tabsetId: string,
  update: (tabset: WindowWorkspaceTabsetNode) => WindowWorkspaceTabsetNode
): WindowWorkspaceDockNode | null {
  if (!node) return null;
  if (node.kind === "tabset") {
    return node.id === tabsetId ? update(node) : node;
  }
  const first = updateTabset(node.first, tabsetId, update);
  const second = updateTabset(node.second, tabsetId, update);
  if (first === node.first && second === node.second) return node;
  return {
    ...node,
    first: first ?? node.first,
    second: second ?? node.second
  };
}

function replaceTabset(
  node: WindowWorkspaceDockNode,
  tabsetId: string,
  replace: (tabset: WindowWorkspaceTabsetNode) => WindowWorkspaceTabsetNode
): WindowWorkspaceDockNode {
  if (node.kind === "tabset") {
    return node.id === tabsetId ? replace(node) : node;
  }
  const first = replaceTabset(node.first, tabsetId, replace);
  const second = replaceTabset(node.second, tabsetId, replace);
  if (first === node.first && second === node.second) return node;
  return createSplitNode(node.direction, first, second, node.ratio);
}

function findFirstTabset(node: WindowWorkspaceDockNode | null): WindowWorkspaceTabsetNode | null {
  if (!node) return null;
  if (node.kind === "tabset") return node;
  return findFirstTabset(node.first) ?? findFirstTabset(node.second);
}

function findTabsetById(
  node: WindowWorkspaceDockNode | null,
  tabsetId: string
): WindowWorkspaceTabsetNode | null {
  if (!node) return null;
  if (node.kind === "tabset") {
    return node.id === tabsetId ? node : null;
  }
  return findTabsetById(node.first, tabsetId) ?? findTabsetById(node.second, tabsetId);
}

function findTabsetContaining(
  node: WindowWorkspaceDockNode | null,
  actorId: string
): WindowWorkspaceTabsetNode | null {
  if (!node) return null;
  if (node.kind === "tabset") {
    return node.tabs.includes(actorId) ? node : null;
  }
  return findTabsetContaining(node.first, actorId) ?? findTabsetContaining(node.second, actorId);
}

function createTabset(tabs: readonly string[], activeTabId: string | null): WindowWorkspaceTabsetNode {
  return {
    kind: "tabset",
    id: createTabsetId(tabs),
    tabs: [...tabs],
    activeTabId
  };
}

function createSplitNode(
  direction: WindowWorkspaceSplitDirection,
  first: WindowWorkspaceDockNode,
  second: WindowWorkspaceDockNode,
  ratio = 0.5
): WindowWorkspaceSplitNode {
  const clampedRatio = Math.min(0.9, Math.max(0.1, ratio));
  return {
    kind: "split",
    id: createSplitId(direction, first, second),
    direction,
    ratio: clampedRatio,
    first,
    second
  };
}

function cloneDockNode(node: WindowWorkspaceDockNode): WindowWorkspaceDockNode {
  if (node.kind === "tabset") {
    return {
      ...node,
      tabs: [...node.tabs]
    };
  }
  return {
    ...node,
    first: cloneDockNode(node.first),
    second: cloneDockNode(node.second)
  };
}

function addFloatingWindow(
  floating: readonly WindowWorkspaceFloatingWindow[],
  actorId: string
): readonly WindowWorkspaceFloatingWindow[] {
  if (floating.some((window) => window.actorId === actorId)) return floating;
  return [...floating, { actorId }];
}

function removeFloatingWindow(
  floating: readonly WindowWorkspaceFloatingWindow[],
  actorId: string
): readonly WindowWorkspaceFloatingWindow[] {
  return floating.filter((window) => window.actorId !== actorId);
}

function createTabsetId(tabs: readonly string[]): string {
  return `tabset:${tabs.join("+")}`;
}

function createSplitId(
  direction: WindowWorkspaceSplitDirection,
  first: WindowWorkspaceDockNode,
  second: WindowWorkspaceDockNode
): string {
  return `split:${direction}:${first.id}|${second.id}`;
}
