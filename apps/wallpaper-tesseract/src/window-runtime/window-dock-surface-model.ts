import type {
  WindowFrameRuntimeDockNode,
  WindowFrameTab
} from "./window-frame-port";
import type { WindowDockSplitPlacement } from "./window-dock-targets";
import {
  activateTabInWindowFrameDockTree,
  addTabToWindowFrameDockTree,
  cloneWindowFrameRuntimeDockRoot,
  createWindowFrameDockTreeTabset,
  findActiveViewActorIdInWindowFrameDockTree,
  findWindowFrameDockTreeSplitById,
  findWindowFrameDockTreeTabsetById,
  findWindowFrameDockTreeTabsetContaining,
  listWindowFrameDockTreeViewActorIds,
  mergeWindowFrameTabsByActorId,
  removeTabFromWindowFrameDockTree,
  restoreWindowFrameDockTreeFromRuntimeRoot,
  splitTabInWindowFrameDockTree,
  updateWindowFrameDockTreeSplitRatio,
  listActiveViewActorIdsInWindowFrameDockTree,
  type WindowFrameDockTreeNode,
  type WindowFrameDockTreeSplitNode,
  type WindowFrameDockTreeTabsetNode
} from "./window-frame-dock-tree";

export interface WindowDockSurfaceModelOptions {
  readonly tabs: readonly WindowFrameTab[];
  readonly activeViewActorId?: string | null;
}

export interface WindowDockSurfaceMutationResult {
  readonly activeViewActorChanged: boolean;
  readonly focusedViewActorChanged: boolean;
}

export class WindowDockSurfaceModel {
  #tabs: WindowFrameTab[];
  #focusedViewActorId: string | null;
  #root: WindowFrameDockTreeNode;

  constructor(options: WindowDockSurfaceModelOptions) {
    this.#tabs = options.tabs.map((tab) => ({ ...tab }));
    this.#focusedViewActorId = resolveActiveViewActorId(this.#tabs, options.activeViewActorId);
    this.#root = createWindowFrameDockTreeTabset(
      this.#tabs.map((tab) => tab.viewActorId),
      this.#focusedViewActorId
    );
  }

  get root(): WindowFrameDockTreeNode {
    return this.#root;
  }

  get focusedViewActorId(): string | null {
    return this.#focusedViewActorId;
  }

  listActiveViewActorIds(): readonly string[] {
    return listActiveViewActorIdsInWindowFrameDockTree(this.#root);
  }

  listTabs(): readonly WindowFrameTab[] {
    return this.#tabs.map((tab) => ({ ...tab }));
  }

  getRuntimeDockRoot(): WindowFrameRuntimeDockNode {
    return cloneWindowFrameRuntimeDockRoot(this.#root);
  }

  restoreRuntimeDockRoot(
    root: WindowFrameRuntimeDockNode,
    options: {
      readonly tabs?: readonly WindowFrameTab[];
      readonly activeViewActorId?: string | null;
    } = {}
  ): void {
    const restoredRoot = restoreWindowFrameDockTreeFromRuntimeRoot(root);
    const viewActorIds = listWindowFrameDockTreeViewActorIds(restoredRoot);
    const nextTabs = mergeWindowFrameTabsByActorId(this.#tabs, options.tabs ?? [], viewActorIds);
    if (nextTabs.length !== viewActorIds.length) {
      const missingViewActorIds = viewActorIds.filter((viewActorId) => (
        !nextTabs.some((tab) => tab.viewActorId === viewActorId)
      ));
      throw new Error(`Cannot restore dock root; missing tab descriptors: ${missingViewActorIds.join(", ")}`);
    }
    this.#tabs = nextTabs;
    this.#root = restoredRoot;
    const activeViewActorId = options.activeViewActorId ?? findActiveViewActorIdInWindowFrameDockTree(restoredRoot);
    this.#focusedViewActorId =
      activeViewActorId && viewActorIds.includes(activeViewActorId)
        ? activeViewActorId
        : viewActorIds[0] ?? null;
  }

  addTab(
    tab: WindowFrameTab,
    options: {
      readonly active?: boolean;
      readonly targetTabsetId?: string;
    } = {}
  ): WindowDockSurfaceMutationResult {
    const previousFocusedViewActorId = this.#focusedViewActorId;
    this.upsertTab(tab);
    this.#root = addTabToWindowFrameDockTree(this.#root, tab.viewActorId, {
      active: options.active,
      targetTabsetId: options.targetTabsetId
    });
    if (options.active || !this.#focusedViewActorId) {
      this.#focusedViewActorId = tab.viewActorId;
    }
    const focusedViewActorChanged = previousFocusedViewActorId !== this.#focusedViewActorId;
    return {
      activeViewActorChanged: focusedViewActorChanged,
      focusedViewActorChanged
    };
  }

  splitTab(
    tab: WindowFrameTab,
    options: {
      readonly targetTabsetId: string;
      readonly placement: WindowDockSplitPlacement;
      readonly active?: boolean;
    }
  ): WindowDockSurfaceMutationResult {
    const previousFocusedViewActorId = this.#focusedViewActorId;
    this.upsertTab(tab);
    const split = splitTabInWindowFrameDockTree(this.#root, tab.viewActorId, options);
    if (!split.split || !split.node) {
      throw new Error(`Target tabset not found: ${options.targetTabsetId}.`);
    }
    this.#root = split.node;
    if (options.active || !this.#focusedViewActorId) {
      this.#focusedViewActorId = tab.viewActorId;
    }
    const focusedViewActorChanged = previousFocusedViewActorId !== this.#focusedViewActorId;
    return {
      activeViewActorChanged: focusedViewActorChanged,
      focusedViewActorChanged
    };
  }

  removeTab(viewActorId: string): boolean {
    const nextTabs = this.#tabs.filter((tab) => tab.viewActorId !== viewActorId);
    if (nextTabs.length === this.#tabs.length) return false;
    this.#tabs = nextTabs;
    const removed = removeTabFromWindowFrameDockTree(this.#root, viewActorId);
    this.#root = removed.node ?? createWindowFrameDockTreeTabset(
      nextTabs.map((tab) => tab.viewActorId),
      nextTabs[0]?.viewActorId ?? null
    );
    if (this.#focusedViewActorId === viewActorId) {
      this.#focusedViewActorId = findActiveViewActorIdInWindowFrameDockTree(this.#root) ?? this.#tabs[0]?.viewActorId ?? null;
    }
    return true;
  }

  activateTab(viewActorId: string): WindowDockSurfaceMutationResult {
    if (!this.hasTab(viewActorId)) {
      return {
        activeViewActorChanged: false,
        focusedViewActorChanged: false
      };
    }
    const wasActiveInTabset = this.isViewActorIdActiveInItsTabset(viewActorId);
    const previousFocusedViewActorId = this.#focusedViewActorId;
    this.#focusedViewActorId = viewActorId;
    this.#root = activateTabInWindowFrameDockTree(this.#root, viewActorId);
    const focusedViewActorChanged = previousFocusedViewActorId !== this.#focusedViewActorId;
    return {
      activeViewActorChanged: focusedViewActorChanged || !wasActiveInTabset,
      focusedViewActorChanged
    };
  }

  hasTab(viewActorId: string): boolean {
    return this.#tabs.some((tab) => tab.viewActorId === viewActorId);
  }

  hasTabset(targetTabsetId: string): boolean {
    return Boolean(findWindowFrameDockTreeTabsetById(this.#root, targetTabsetId));
  }

  findTabsetContaining(viewActorId: string): WindowFrameDockTreeTabsetNode | null {
    return findWindowFrameDockTreeTabsetContaining(this.#root, viewActorId);
  }

  findSplitById(splitId: string): WindowFrameDockTreeSplitNode | null {
    return findWindowFrameDockTreeSplitById(this.#root, splitId);
  }

  isViewActorIdActiveInItsTabset(viewActorId: string): boolean {
    const tabset = this.findTabsetContaining(viewActorId);
    return Boolean(tabset && tabset.activeViewActorId === viewActorId);
  }

  updateSplitRatio(splitId: string, ratio: number): void {
    this.#root = updateWindowFrameDockTreeSplitRatio(this.#root, splitId, ratio);
  }

  private upsertTab(tab: WindowFrameTab): void {
    const existingIndex = this.#tabs.findIndex((candidate) => candidate.viewActorId === tab.viewActorId);
    if (existingIndex >= 0) {
      this.#tabs[existingIndex] = { ...tab };
    } else {
      this.#tabs = [...this.#tabs, { ...tab }];
    }
  }
}

function resolveActiveViewActorId(
  tabs: readonly WindowFrameTab[],
  preferredActiveViewActorId: string | null | undefined
): string | null {
  if (preferredActiveViewActorId && tabs.some((tab) => tab.viewActorId === preferredActiveViewActorId)) {
    return preferredActiveViewActorId;
  }
  return tabs[0]?.viewActorId ?? null;
}
