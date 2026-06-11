import { type Actor, type Component, type ComponentType } from "actor-core";
import type { ActorInputMoveEvent } from "actor-input";
import {
  commitWindowContentLayout,
  createWindowContentAttachment,
  type WindowContentAttachment,
  type WindowContentLayoutCommit,
  type WindowContentLayoutCommitSplit,
  type WindowContentLayoutCommitRect,
  type WindowContentAttachmentRequest,
  type WindowContentHost,
  type WindowRegisteredContent
} from "../ports/window-content-host";
import {
  type FloatingWindowSplitterHitData
} from "./window-frame-hit-data";
import type {
  WindowFrameDockTargetTabset,
  WindowFrameRuntimeDockNode,
  WindowFrameTab
} from "../model/window-frame-tab";
import {
  activateTabInWindowFrameDockTree,
  addTabToWindowFrameDockTree,
  cloneWindowFrameRuntimeDockRoot,
  createWindowFrameDockTreeTabset,
  findActiveViewActorIdInWindowFrameDockTree,
  findWindowFrameDockTreeSplitById,
  findWindowFrameDockTreeTabsetById,
  findWindowFrameDockTreeTabsetContaining,
  listActiveViewActorIdsInWindowFrameDockTree,
  listWindowFrameDockTreeViewActorIds,
  mergeWindowFrameTabsByActorId,
  removeTabFromWindowFrameDockTree,
  restoreWindowFrameDockTreeFromRuntimeRoot,
  splitTabInWindowFrameDockTree,
  type WindowFrameDockTreeNode,
  type WindowFrameDockTreeSplitDirection,
  type WindowFrameDockTreeTabsetNode
} from "../model/window-frame-dock-tree";
import {
  findWindowFrameTabActionAtPoint,
  findWindowFrameTabAtPoint,
  renderWindowFrameTabsetTabs
} from "./window-frame-tab-chrome";
import { rectFromDomRect, type WindowDockRect, type WindowDockSplitPlacement } from "../model/window-dock-targets";
import type { UiPoint } from "../ports/ui-geometry";
import type {
  WindowFrameSurfaceSnapshot,
  WindowFrameSurfaceSnapshotNode,
  WindowFrameSurfaceSnapshotTab,
  WindowWorkspaceGraphContentPlacement,
  WindowWorkspaceGraphReconcilerSurface,
  WindowWorkspaceSurfaceGeometryProjection,
  WindowWorkspaceSurfaceGeometryIssue,
  WindowWorkspaceSurfaceGeometrySplitter,
  WindowWorkspaceSurfaceGeometryTabset
} from "../services/window-workspace-graph-reconciler";
import type { WindowWorkspaceContentId } from "../model/window-workspace-graph";

export const windowFrameSurfaceComponentType =
  "window-frame-surface-component" as ComponentType<WindowFrameSurfaceComponent>;

export interface WindowFrameSurfaceComponentOptions {
  readonly id?: string;
}

export interface WindowFrameSurfaceClasses {
  readonly pane: string;
  readonly paneTabs: string;
  readonly paneContent: string;
  readonly split: string;
  readonly splitHorizontal: string;
  readonly splitVertical: string;
  readonly splitter: string;
  readonly splitterHorizontal: string;
  readonly splitterVertical: string;
  readonly tab?: string;
  readonly tabClose?: string;
}

export interface WindowFrameSurfaceHost {
  readonly id: string;
  readonly document: Pick<Document, "createElement">;
  readonly primaryTabbar: HTMLElement;
  readonly primaryContent: HTMLElement;
  readonly classes: WindowFrameSurfaceClasses;
  readonly splitMinPaneSize: number;
  readonly splitterHitSlop?: number;
  readonly hidePrimaryTabbarWhenSplit?: boolean;
  getEffectiveVisible(): boolean;
  getInputStackPriority(): number | undefined;
  getDockTargetFallbackBounds?(): WindowDockRect;
  afterRender?(): void;
}

export type WindowFrameSurfaceHitPart =
  | "tab"
  | "tab-action"
  | "splitter"
  | "content";

export interface WindowFrameSurfaceHit {
  readonly part: WindowFrameSurfaceHitPart;
  readonly hitPriority: number;
  readonly data?: unknown;
}

interface WindowFrameSurfaceSplitResizeStart {
  readonly splitId: string;
  readonly direction: WindowFrameDockTreeSplitDirection;
  readonly ratio: number;
  readonly splitRect: DOMRectReadOnly;
}

export interface WindowFrameSurfaceSplitResizeChange {
  readonly splitId: string;
  readonly ratio: number;
}

interface WindowFrameSurfaceTabsetTarget {
  readonly tabbar: HTMLElement;
  readonly content: HTMLElement;
}

interface WindowDockSurfaceMutationResult {
  readonly activeViewActorChanged: boolean;
  readonly focusedViewActorChanged: boolean;
}

export class WindowFrameSurfaceComponent implements Component, WindowWorkspaceGraphReconcilerSurface<WindowRegisteredContent> {
  readonly type = windowFrameSurfaceComponentType;
  readonly actor: Actor;
  readonly id: string;
  enabled = true;

  readonly #contentAttachments = new Set<WindowContentAttachment>();
  readonly #contentAttachmentsByViewActorId = new Map<string, WindowContentAttachment>();
  readonly #contentViewActorIdsByAttachment = new WeakMap<WindowContentAttachment, string>();
  readonly #contentHostsByViewActorId = new Map<string, WindowContentHost>();
  readonly #tabElementsByViewActorId = new Map<string, HTMLElement>();
  readonly #tabActionElementsByViewActorId = new Map<string, HTMLElement>();
  readonly #tabsetTargetsById = new Map<string, WindowFrameSurfaceTabsetTarget>();
  readonly #splitElementsById = new Map<string, HTMLElement>();
  readonly #splitterElementsBySplitId = new Map<string, HTMLElement>();
  readonly #viewActorIdByContentId = new Map<string, string>();
  #tabs: WindowFrameTab[] = [];
  #focusedViewActorId: string | null = null;
  #root: WindowFrameDockTreeNode = createWindowFrameDockTreeTabset([], null);
  #host: WindowFrameSurfaceHost | null = null;
  #splitResizeStart: WindowFrameSurfaceSplitResizeStart | null = null;
  #surfaceRevision = 0;

  constructor(actor: Actor, options: WindowFrameSurfaceComponentOptions = {}) {
    this.actor = actor;
    this.id = options.id ?? `${actor.id}:window-frame-surface`;
  }

  get frameId(): string {
    return this.actor.id;
  }

  configure(options: {
    readonly tabs: readonly WindowFrameTab[];
    readonly activeViewActorId?: string | null;
  }): void {
    this.#tabs = options.tabs.map((tab) => ({ ...tab }));
    this.#focusedViewActorId = resolveActiveViewActorId(this.#tabs, options.activeViewActorId);
    this.#root = createWindowFrameDockTreeTabset(
      this.#tabs.map((tab) => tab.viewActorId),
      this.#focusedViewActorId
    );
    this.render();
    this.applyActiveContentState();
  }

  attachHost(host: WindowFrameSurfaceHost): void {
    this.#host = host;
    this.render();
    this.applyActiveContentState();
  }

  detachHost(host: WindowFrameSurfaceHost): void {
    if (this.#host !== host) return;
    this.#host = null;
    this.#tabElementsByViewActorId.clear();
    this.#tabActionElementsByViewActorId.clear();
    this.#tabsetTargetsById.clear();
    this.#splitElementsById.clear();
    this.#splitterElementsBySplitId.clear();
    this.#splitResizeStart = null;
  }

  listTabs(): readonly WindowFrameTab[] {
    return this.#tabs.map((tab) => ({ ...tab }));
  }

  getRuntimeDockRoot(): WindowFrameRuntimeDockNode {
    return cloneWindowFrameRuntimeDockRoot(this.#root);
  }

  restoreRuntimeDockRoot(root: WindowFrameRuntimeDockNode, options: {
    readonly tabs?: readonly WindowFrameTab[];
    readonly activeViewActorId?: string | null;
  } = {}): void {
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
    this.render();
    this.applyActiveContentState();
  }

  listDockTargetTabsets(): readonly WindowFrameDockTargetTabset[] {
    const fallback = this.#host?.getDockTargetFallbackBounds?.() ?? null;
    const root = this.getRuntimeDockRoot();
    return [...this.#tabsetTargetsById.entries()].map(([targetTabsetId, target]) => {
      const tabBounds = rectFromDomRect(target.tabbar.getBoundingClientRect());
      const contentBounds = rectFromDomRect(target.content.getBoundingClientRect());
      const tabset = findWindowFrameDockTreeTabsetById(root, targetTabsetId);
      return {
        targetTabsetId,
        tabs: tabset?.tabs ?? [],
        tabBounds: isNonZeroRect(tabBounds) ? tabBounds : fallback ?? tabBounds,
        contentBounds: isNonZeroRect(contentBounds) ? contentBounds : fallback ?? contentBounds
      };
    });
  }

  renderFrameSurface(snapshot: WindowFrameSurfaceSnapshot): void {
    const tabs = listSnapshotTabs(snapshot.root);
    this.#tabs = tabs.map((tab) => ({
      viewActorId: tab.viewActorId,
      identity: tab.identity,
      viewKey: tab.identity.viewKey,
      title: tab.title ?? tab.identity.viewKey
    }));
    this.#viewActorIdByContentId.clear();
    for (const tab of tabs) {
      this.#viewActorIdByContentId.set(tab.contentId, tab.viewActorId);
    }
    this.#root = snapshotNodeToDockTree(snapshot.root);
    this.#focusedViewActorId = findActiveViewActorIdInWindowFrameDockTree(this.#root);
    this.render();
    this.applyActiveContentState();
  }

  measureFrameSurfaceGeometry(snapshot: WindowFrameSurfaceSnapshot): WindowWorkspaceSurfaceGeometryProjection {
    if (!this.#host || !this.isEffectiveVisible()) {
      return {
        frameId: snapshot.frameId,
        revision: snapshot.revision,
        tabsets: [],
        splitters: [],
        issues: []
      };
    }

    const tabsets: WindowWorkspaceSurfaceGeometryTabset[] = [];
    const splitters: WindowWorkspaceSurfaceGeometrySplitter[] = [];
    const issues: WindowWorkspaceSurfaceGeometryIssue[] = [];
    const seenContentIds = new Set<WindowWorkspaceContentId>();
    collectSnapshotSurfaceGeometry({
      node: snapshot.root,
      tabsetTargetsById: this.#tabsetTargetsById,
      splitterElementsBySplitId: this.#splitterElementsBySplitId,
      tabsets,
      splitters,
      issues,
      seenContentIds
    });
    return {
      frameId: snapshot.frameId,
      revision: snapshot.revision,
      tabsets,
      splitters,
      issues
    };
  }

  placeContent(placement: WindowWorkspaceGraphContentPlacement<WindowRegisteredContent>): void {
    const viewActorId = this.#viewActorIdByContentId.get(placement.placement.contentId) ?? null;
    this.appendContentElement(viewActorId, placement.content.element);
    const interactable = this.isEffectiveVisible() && placement.placement.interactable;
    placement.content.setInteractable(interactable);
    placement.content.element.hidden = !interactable;
  }

  getFocusedViewActorId(): string | null {
    return this.#focusedViewActorId;
  }

  getActiveViewActorIds(): readonly string[] {
    return listActiveViewActorIdsInWindowFrameDockTree(this.#root);
  }

  isViewActiveInFrame(viewActorId: string): boolean {
    return this.isViewActorIdActiveInItsTabset(viewActorId);
  }

  isViewVisibleInFrame(viewActorId: string): boolean {
    return this.isEffectiveVisible() && this.isViewActiveInFrame(viewActorId);
  }

  addTab(tab: WindowFrameTab, options: {
    readonly active?: boolean;
    readonly targetTabsetId?: string;
  } = {}): WindowDockSurfaceMutationResult {
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
    this.render();
    this.applyActiveContentState();
    return {
      activeViewActorChanged: focusedViewActorChanged,
      focusedViewActorChanged
    };
  }

  splitTab(tab: WindowFrameTab, options: {
    readonly targetTabsetId: string;
    readonly placement: WindowDockSplitPlacement;
    readonly active?: boolean;
  }): WindowDockSurfaceMutationResult {
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
    this.render();
    this.applyActiveContentState();
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
      this.#focusedViewActorId =
        findActiveViewActorIdInWindowFrameDockTree(this.#root) ?? this.#tabs[0]?.viewActorId ?? null;
    }
    this.#contentAttachmentsByViewActorId.get(viewActorId)?.setInteractable(false);
    this.render();
    this.applyActiveContentState();
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
    const result = {
      activeViewActorChanged: focusedViewActorChanged || !wasActiveInTabset,
      focusedViewActorChanged
    };
    if (!result.activeViewActorChanged) return result;
    this.render();
    this.applyActiveContentState();
    return result;
  }

  hasTab(viewActorId: string): boolean {
    return this.#tabs.some((tab) => tab.viewActorId === viewActorId);
  }

  hasTabset(targetTabsetId: string): boolean {
    return Boolean(findWindowFrameDockTreeTabsetById(this.#root, targetTabsetId));
  }

  getContentHost(viewActorId: string): WindowContentHost {
    const existing = this.#contentHostsByViewActorId.get(viewActorId);
    if (existing) return existing;
    const surface = this;
    const host: WindowContentHost = {
      id: `${this.#host?.id ?? this.id}:${viewActorId}`,
      viewActorId,
      get inputStackPriority() {
        return surface.#host?.getInputStackPriority();
      },
      mountContent: (request) => this.mountContent(withWindowContentViewActorId(request, viewActorId)),
      isContentInteractable: (element) => (
        this.isViewActorIdActiveInItsTabset(viewActorId) &&
        this.isContentInteractable(element)
      )
    };
    this.#contentHostsByViewActorId.set(viewActorId, host);
    return host;
  }

  mountContent(
    requestOrElement: HTMLElement | WindowContentAttachmentRequest,
    hostOverride?: WindowContentHost
  ): WindowContentAttachment {
    const viewActorId = readWindowContentViewActorId(requestOrElement);
    if (viewActorId) {
      this.#contentAttachmentsByViewActorId.get(viewActorId)?.dispose();
    }
    const attachment = createWindowContentAttachment(
      hostOverride ?? this.getAttachmentHost(),
      requestOrElement,
      (element) => this.appendContentElement(viewActorId, element),
      (disposedAttachment) => {
        disposedAttachment.element.remove();
        this.#contentAttachments.delete(disposedAttachment);
        if (viewActorId && this.#contentAttachmentsByViewActorId.get(viewActorId) === disposedAttachment) {
          this.#contentAttachmentsByViewActorId.delete(viewActorId);
        }
      }
    );
    this.#contentAttachments.add(attachment);
    if (viewActorId) {
      this.#contentAttachmentsByViewActorId.set(viewActorId, attachment);
      this.#contentViewActorIdsByAttachment.set(attachment, viewActorId);
      this.applyActiveContentState();
    }
    return attachment;
  }

  isContentInteractable(element: HTMLElement): boolean {
    if (!this.isEffectiveVisible()) return false;
    for (const attachment of this.#contentAttachments) {
      if (attachment.element !== element) continue;
      const viewActorId = this.#contentViewActorIdsByAttachment.get(attachment);
      if (viewActorId && !this.isViewActorIdActiveInItsTabset(viewActorId)) return false;
      return attachment.interactable;
    }
    return false;
  }

  refreshActiveContentState(): void {
    this.applyActiveContentState();
  }

  hasInteractableContent(): boolean {
    if (!this.isEffectiveVisible()) return false;
    if (this.#contentAttachments.size === 0) return true;
    for (const attachment of this.#contentAttachments) {
      if (this.isContentInteractable(attachment.element)) return true;
    }
    return false;
  }

  hitTest(point: UiPoint): WindowFrameSurfaceHit | null {
    const tabAction = this.findTabActionAtPoint(point);
    if (tabAction) return { part: "tab-action", hitPriority: 100, data: tabAction };
    const tab = this.findTabAtPoint(point);
    if (tab) {
      return {
        part: "tab",
        hitPriority: 50,
        data: {
          tab,
          tabsetId: this.findTabsetContaining(tab.viewActorId)?.id
        }
      };
    }
    const splitter = this.findSplitterAtPoint(point);
    if (splitter) return { part: "splitter", hitPriority: 90, data: splitter };
    if (this.hasInteractableContent()) return { part: "content", hitPriority: 1 };
    return null;
  }

  beginSplitResize(hitData: unknown): void {
    this.#splitResizeStart = this.createSplitResizeStart(hitData);
  }

  updateSplitRatioFromDrag(event: ActorInputMoveEvent): WindowFrameSurfaceSplitResizeChange | null {
    const start = this.#splitResizeStart ?? this.createSplitResizeStart(event.hit.data);
    const host = this.#host;
    if (!start || !host) return null;
    const size = start.direction === "horizontal"
      ? start.splitRect.width
      : start.splitRect.height;
    if (size <= 0) return null;
    const delta = start.direction === "horizontal"
      ? event.totalDelta.dx
      : event.totalDelta.dy;
    const ratio = clampSplitRatio(
      start.ratio + delta / size,
      size,
      host.splitMinPaneSize
    );
    return {
      splitId: start.splitId,
      ratio
    };
  }

  endSplitResize(): void {
    this.#splitResizeStart = null;
  }

  private createSplitResizeStart(hitData: unknown): WindowFrameSurfaceSplitResizeStart | null {
    const splitter = readSurfaceSplitterHitData(hitData);
    const split = splitter ? findWindowFrameDockTreeSplitById(this.#root, splitter.splitId) : null;
    const splitterElement = splitter ? this.#splitterElementsBySplitId.get(splitter.splitId) : null;
    const splitElement = splitter
      ? this.#splitElementsById.get(splitter.splitId) ?? splitterElement?.parentElement ?? null
      : null;
    if (!splitter) return null;
    const splitRect = splitElement?.getBoundingClientRect() ?? this.#host?.primaryContent.getBoundingClientRect();
    if (!splitRect) return null;
    const hostContentRect = this.#host?.primaryContent.getBoundingClientRect() ?? splitRect;
    const measuredSize = splitter.direction === "horizontal" ? splitRect.width : splitRect.height;
    const fallbackSize = splitter.direction === "horizontal" ? hostContentRect.width : hostContentRect.height;
    return {
      splitId: splitter.splitId,
      direction: splitter.direction,
      ratio: split?.ratio ?? 0.5,
      splitRect: measuredSize > 0 || fallbackSize <= 0 ? splitRect : hostContentRect
    };
  }

  getActiveOrFirstTabBounds(fallback: HTMLElement): DOMRectReadOnly {
    const focusedViewActorId = this.#focusedViewActorId;
    const focusedTab = focusedViewActorId
      ? this.#tabElementsByViewActorId.get(focusedViewActorId)
      : null;
    const firstTab = focusedTab ?? this.#tabElementsByViewActorId.values().next().value as HTMLElement | undefined;
    return (firstTab ?? fallback).getBoundingClientRect();
  }

  dispose(): void {
    this.enabled = false;
    for (const attachment of [...this.#contentAttachments]) {
      attachment.dispose();
    }
    this.detachCurrentHost();
  }

  private detachCurrentHost(): void {
    const host = this.#host;
    if (host) this.detachHost(host);
  }

  private getAttachmentHost(): WindowContentHost {
    const surface = this;
    return {
      id: this.#host?.id ?? this.id,
      get inputStackPriority() {
        return surface.#host?.getInputStackPriority();
      },
      mountContent: (request) => this.mountContent(request),
      isContentInteractable: (element) => this.isContentInteractable(element)
    };
  }

  private render(): void {
    const host = this.#host;
    if (!host) return;
    this.#tabElementsByViewActorId.clear();
    this.#tabActionElementsByViewActorId.clear();
    this.#tabsetTargetsById.clear();
    this.#splitElementsById.clear();
    this.#splitterElementsBySplitId.clear();
    removeElementChildren(host.primaryTabbar);
    removeElementChildren(host.primaryContent);
    const root = this.#root;
    host.primaryTabbar.hidden = Boolean(host.hidePrimaryTabbarWhenSplit && root.kind !== "tabset");
    if (root.kind === "tabset") {
      this.renderTabsetTabs(root, host.primaryTabbar);
      this.#tabsetTargetsById.set(root.id, {
        tabbar: host.primaryTabbar,
        content: host.primaryContent
      });
    } else {
      host.primaryContent.append(this.renderSplitNode(root));
    }
    host.afterRender?.();
    this.placeContentAttachments();
  }

  private renderSplitNode(node: WindowFrameDockTreeNode): HTMLElement {
    const host = this.requireHost();
    if (node.kind === "tabset") {
      const pane = host.document.createElement("div");
      pane.className = host.classes.pane;
      const tabbar = host.document.createElement("div");
      tabbar.className = host.classes.paneTabs;
      const content = host.document.createElement("div");
      content.className = host.classes.paneContent;
      this.renderTabsetTabs(node, tabbar);
      pane.append(tabbar, content);
      this.#tabsetTargetsById.set(node.id, { tabbar, content });
      return pane;
    }

    const split = host.document.createElement("div");
    split.className = joinClassNames(
      host.classes.split,
      node.direction === "horizontal" ? host.classes.splitHorizontal : host.classes.splitVertical
    );
    this.#splitElementsById.set(node.id, split);
    const first = this.renderSplitNode(node.first);
    const second = this.renderSplitNode(node.second);
    const splitter = host.document.createElement("div");
    splitter.className = joinClassNames(
      host.classes.splitter,
      node.direction === "horizontal" ? host.classes.splitterHorizontal : host.classes.splitterVertical
    );
    first.style.flex = `${node.ratio} 1 0`;
    second.style.flex = `${1 - node.ratio} 1 0`;
    this.#splitterElementsBySplitId.set(node.id, splitter);
    split.append(first, splitter, second);
    return split;
  }

  private renderTabsetTabs(node: WindowFrameDockTreeTabsetNode, target: HTMLElement): void {
    const host = this.requireHost();
    renderWindowFrameTabsetTabs({
      document: host.document,
      tabs: this.listTabs(),
      tabset: node,
      target,
      maps: {
        tabsByViewActorId: this.#tabElementsByViewActorId as Map<string, HTMLDivElement>,
        actionsByViewActorId: this.#tabActionElementsByViewActorId as Map<string, HTMLButtonElement>
      },
      tabClassName: host.classes.tab,
      closeClassName: host.classes.tabClose
    });
  }

  private applyActiveContentState(): void {
    this.#surfaceRevision += 1;
    for (const [viewActorId, attachment] of this.#contentAttachmentsByViewActorId) {
      const active = this.isEffectiveVisible() && this.isViewActorIdActiveInItsTabset(viewActorId);
      attachment.setInteractable(active);
      attachment.element.hidden = !active;
      commitWindowContentLayout(attachment, this.createLayoutCommit(viewActorId, attachment, active));
    }
    for (const attachment of this.#contentAttachments) {
      if (this.#contentViewActorIdsByAttachment.get(attachment)) continue;
      const active = this.isEffectiveVisible();
      commitWindowContentLayout(attachment, this.createLayoutCommit(null, attachment, active));
    }
  }

  private appendContentElement(viewActorId: string | null, element: HTMLElement): void {
    const host = this.#host;
    if (!host) return;
    if (!viewActorId) {
      host.primaryContent.append(element);
      return;
    }
    const tabset = this.findTabsetContaining(viewActorId);
    const target = tabset ? this.#tabsetTargetsById.get(tabset.id) : null;
    if (!target) {
      element.hidden = true;
      element.remove();
      return;
    }
    target.content.append(element);
    element.hidden = !this.isEffectiveVisible() || !this.isViewActorIdActiveInItsTabset(viewActorId);
  }

  private placeContentAttachments(): void {
    for (const attachment of this.#contentAttachments) {
      const viewActorId = this.#contentViewActorIdsByAttachment.get(attachment) ?? null;
      this.appendContentElement(viewActorId, attachment.element);
    }
  }

  private findTabAtPoint(point: UiPoint): WindowFrameTab | null {
    return findWindowFrameTabAtPoint(
      this.listTabs(),
      this.#tabElementsByViewActorId,
      point
    );
  }

  private findTabActionAtPoint(point: UiPoint): ReturnType<typeof findWindowFrameTabActionAtPoint> {
    return findWindowFrameTabActionAtPoint(
      this.listTabs(),
      this.#tabActionElementsByViewActorId,
      point
    );
  }

  private findSplitterAtPoint(point: UiPoint): FloatingWindowSplitterHitData | null {
    const hitSlop = this.#host?.splitterHitSlop ?? 4;
    for (const [splitId, element] of this.#splitterElementsBySplitId) {
      if (!isPointInsideRect(point, expandDomRect(element.getBoundingClientRect(), hitSlop))) continue;
      const split = findWindowFrameDockTreeSplitById(this.#root, splitId);
      if (!split) continue;
      return {
        splitId,
        direction: split.direction
      };
    }
    return null;
  }

  private findTabsetContaining(viewActorId: string): WindowFrameDockTreeTabsetNode | null {
    return findWindowFrameDockTreeTabsetContaining(this.#root, viewActorId);
  }

  private isViewActorIdActiveInItsTabset(viewActorId: string): boolean {
    const tabset = this.findTabsetContaining(viewActorId);
    return Boolean(tabset && tabset.activeViewActorId === viewActorId);
  }

  private upsertTab(tab: WindowFrameTab): void {
    const existingIndex = this.#tabs.findIndex((candidate) => candidate.viewActorId === tab.viewActorId);
    if (existingIndex >= 0) {
      this.#tabs[existingIndex] = { ...tab };
    } else {
      this.#tabs = [...this.#tabs, { ...tab }];
    }
  }

  private requireHost(): WindowFrameSurfaceHost {
    if (!this.#host) {
      throw new Error("WindowFrameSurfaceComponent requires an attached host.");
    }
    return this.#host;
  }

  private isEffectiveVisible(): boolean {
    return this.enabled && Boolean(this.#host?.getEffectiveVisible());
  }

  private createLayoutCommit(
    contentId: string | null,
    attachment: WindowContentAttachment,
    active: boolean
  ): WindowContentLayoutCommit {
    const tabset = contentId ? this.findTabsetContaining(contentId) : null;
    const target = tabset ? this.#tabsetTargetsById.get(tabset.id) : null;
    const contentRect = target
      ? toLayoutCommitRect(target.content.getBoundingClientRect())
      : toLayoutCommitRect(attachment.element.getBoundingClientRect());
    return {
      surfaceId: this.id,
      contentId,
      tabsetId: tabset?.id ?? null,
      active,
      interactable: attachment.interactable,
      contentRect,
      surfaceRevision: this.#surfaceRevision,
      splits: this.listLayoutCommitSplits()
    };
  }

  private listLayoutCommitSplits(): readonly WindowContentLayoutCommitSplit[] {
    const splits: WindowContentLayoutCommitSplit[] = [];
    for (const [splitId, element] of this.#splitterElementsBySplitId) {
      const split = findWindowFrameDockTreeSplitById(this.#root, splitId);
      if (!split) continue;
      splits.push({
        splitId,
        direction: split.direction,
        rect: toLayoutCommitRect(element.getBoundingClientRect())
      });
    }
    return splits;
  }
}

function toLayoutCommitRect(rect: DOMRectReadOnly): WindowContentLayoutCommitRect {
  return {
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height
  };
}

function listSnapshotTabs(node: WindowFrameSurfaceSnapshotNode): readonly WindowFrameSurfaceSnapshotTab[] {
  if (node.kind === "tabset") return node.tabs;
  return [
    ...listSnapshotTabs(node.first),
    ...listSnapshotTabs(node.second)
  ];
}

function snapshotNodeToDockTree(node: WindowFrameSurfaceSnapshotNode): WindowFrameDockTreeNode {
  if (node.kind === "tabset") {
    return createWindowFrameDockTreeTabset(
      node.tabs.map((tab) => tab.viewActorId),
      node.tabs.find((tab) => tab.contentId === node.activeContentId)?.viewActorId ?? node.tabs[0]?.viewActorId ?? null,
      node.id
    );
  }
  return {
    kind: "split",
    id: node.id,
    direction: node.direction,
    ratio: node.ratio,
    first: snapshotNodeToDockTree(node.first),
    second: snapshotNodeToDockTree(node.second)
  };
}

function collectSnapshotSurfaceGeometry(options: {
  readonly node: WindowFrameSurfaceSnapshotNode;
  readonly tabsetTargetsById: ReadonlyMap<string, WindowFrameSurfaceTabsetTarget>;
  readonly splitterElementsBySplitId: ReadonlyMap<string, HTMLElement>;
  readonly tabsets: WindowWorkspaceSurfaceGeometryTabset[];
  readonly splitters: WindowWorkspaceSurfaceGeometrySplitter[];
  readonly issues: WindowWorkspaceSurfaceGeometryIssue[];
  readonly seenContentIds: Set<WindowWorkspaceContentId>;
}): void {
  const { node } = options;
  if (node.kind === "tabset") {
    const duplicateContentIds = node.tabs
      .map((tab) => tab.contentId)
      .filter((contentId) => {
        if (options.seenContentIds.has(contentId)) return true;
        options.seenContentIds.add(contentId);
        return false;
      });
    for (const contentId of duplicateContentIds) {
      options.issues.push({
        code: "duplicate-content",
        message: `content ${contentId} appears in more than one rendered graph tabset`
      });
    }
    const target = options.tabsetTargetsById.get(node.id);
    if (!target) {
      options.issues.push({
        code: "missing-tabset-target",
        message: `graph tabset ${node.id} has no rendered tabset target`
      });
      return;
    }
    options.tabsets.push({
      tabsetId: node.id,
      contentIds: node.tabs.map((tab) => tab.contentId),
      tabBounds: rectFromDomRect(target.tabbar.getBoundingClientRect()),
      contentBounds: rectFromDomRect(target.content.getBoundingClientRect())
    });
    return;
  }

  const splitter = options.splitterElementsBySplitId.get(node.id);
  if (splitter) {
    options.splitters.push({
      splitId: node.id,
      direction: node.direction,
      rect: rectFromDomRect(splitter.getBoundingClientRect())
    });
  } else {
    options.issues.push({
      code: "missing-splitter",
      message: `graph split ${node.id} has no rendered splitter`
    });
  }
  collectSnapshotSurfaceGeometry({ ...options, node: node.first });
  collectSnapshotSurfaceGeometry({ ...options, node: node.second });
}

function expandDomRect(rect: DOMRectReadOnly, amount: number): DOMRectReadOnly {
  if (amount <= 0) return rect;
  return {
    x: rect.x - amount,
    y: rect.y - amount,
    width: rect.width + amount * 2,
    height: rect.height + amount * 2,
    top: rect.top - amount,
    left: rect.left - amount,
    right: rect.right + amount,
    bottom: rect.bottom + amount,
    toJSON() {
      return this;
    }
  };
}

function withWindowContentViewActorId(
  requestOrElement: HTMLElement | WindowContentAttachmentRequest,
  viewActorId: string
): WindowContentAttachmentRequest {
  if (isWindowContentAttachmentRequest(requestOrElement)) {
    if (requestOrElement.viewActorId) {
      return requestOrElement;
    }
    return { ...requestOrElement, viewActorId };
  }
  return { element: requestOrElement, viewActorId };
}

function readWindowContentViewActorId(
  requestOrElement: HTMLElement | WindowContentAttachmentRequest
): string | null {
  return isWindowContentAttachmentRequest(requestOrElement) ? requestOrElement.viewActorId ?? null : null;
}

function isWindowContentAttachmentRequest(
  requestOrElement: HTMLElement | WindowContentAttachmentRequest
): requestOrElement is WindowContentAttachmentRequest {
  return typeof requestOrElement === "object" && requestOrElement !== null && "element" in requestOrElement;
}

function readSurfaceSplitterHitData(hitData: unknown): FloatingWindowSplitterHitData | null {
  if (
    typeof hitData !== "object" ||
    hitData === null ||
    !("splitId" in hitData) ||
    !("direction" in hitData)
  ) {
    return null;
  }
  const splitId = (hitData as { splitId?: unknown }).splitId;
  const direction = (hitData as { direction?: unknown }).direction;
  if (
    typeof splitId !== "string" ||
    (direction !== "horizontal" && direction !== "vertical")
  ) {
    return null;
  }
  return { splitId, direction };
}

function isPointInsideRect(point: UiPoint, rect: DOMRectReadOnly): boolean {
  return point.x >= rect.left &&
    point.x <= rect.right &&
    point.y >= rect.top &&
    point.y <= rect.bottom;
}

function isNonZeroRect(rect: WindowDockRect): boolean {
  return rect.width > 0 && rect.height > 0;
}

function removeElementChildren(element: HTMLElement): void {
  const childList = element.children;
  while (childList.length > 0) {
    childList[0]?.remove();
  }
}

function joinClassNames(...classNames: Array<string | undefined>): string {
  return classNames.filter(Boolean).join(" ");
}

function clampSplitRatio(ratio: number, size: number, minPaneSize: number): number {
  if (size <= minPaneSize * 2) return 0.5;
  const min = minPaneSize / size;
  const max = 1 - min;
  return Math.min(max, Math.max(min, ratio));
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
