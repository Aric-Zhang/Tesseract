import { type Actor, type Component, type ComponentType } from "actor-system/core";
import type { ActorInputMoveEvent } from "actor-system/input";
import {
  commitWindowRegisteredContentLayout,
  type WindowContentLayoutCommit,
  type WindowContentLayoutCommitRect,
  type WindowContentLayoutCommitSplit,
  type WindowRegisteredContent
} from "../ports/window-content-registry";
import type {
  FloatingWindowSplitterHitData,
  WindowFrameSurfaceSplitDirection
} from "./window-frame-hit-data";
import type { WindowFrameTab } from "../model/window-frame-tab";
import {
  findWindowFrameTabActionAtPoint,
  findWindowFrameTabAtPoint,
  renderWindowFrameTabsetTabs
} from "./window-frame-tab-chrome";
import { rectFromDomRect, type WindowDockRect } from "../model/window-dock-targets";
import type { UiPoint } from "../ports/ui-geometry";
import type { WindowWorkspaceContentId, WindowWorkspaceTabsetId } from "../model/window-workspace-graph";
import type {
  WindowFrameSurfaceSnapshot,
  WindowFrameSurfaceSnapshotNode,
  WindowFrameSurfaceSnapshotTab,
  WindowFrameSurfaceSnapshotTabsetNode,
  WindowWorkspaceGraphContentActiveState,
  WindowWorkspaceGraphContentPlacement,
  WindowWorkspaceGraphReconcilerSurface,
  WindowWorkspaceSurfaceGeometryIssue,
  WindowWorkspaceSurfaceGeometryProjection,
  WindowWorkspaceSurfaceGeometrySplitter,
  WindowWorkspaceSurfaceGeometryTabset
} from "../services/window-workspace-graph-reconciler";

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
  readonly direction: WindowFrameSurfaceSplitDirection;
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

interface WindowFrameSurfaceContentState {
  readonly contentId: WindowWorkspaceContentId;
  readonly tabsetId: WindowWorkspaceTabsetId | null;
  readonly active: boolean;
  readonly interactable: boolean;
}

export class WindowFrameSurfaceComponent implements Component, WindowWorkspaceGraphReconcilerSurface<WindowRegisteredContent> {
  readonly type = windowFrameSurfaceComponentType;
  readonly actor: Actor;
  readonly id: string;
  enabled = true;

  readonly #contentByContentId = new Map<WindowWorkspaceContentId, WindowRegisteredContent>();
  readonly #contentStateByContentId = new Map<WindowWorkspaceContentId, WindowFrameSurfaceContentState>();
  readonly #viewActorIdByContentId = new Map<WindowWorkspaceContentId, string>();
  readonly #contentIdByViewActorId = new Map<string, WindowWorkspaceContentId>();
  readonly #tabsByViewActorId = new Map<string, WindowFrameTab>();
  readonly #tabElementsByViewActorId = new Map<string, HTMLElement>();
  readonly #tabActionElementsByViewActorId = new Map<string, HTMLElement>();
  readonly #tabsetTargetsById = new Map<string, WindowFrameSurfaceTabsetTarget>();
  readonly #splitElementsById = new Map<string, HTMLElement>();
  readonly #splitterElementsBySplitId = new Map<string, HTMLElement>();
  #lastSnapshot: WindowFrameSurfaceSnapshot | null = null;
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

  attachHost(host: WindowFrameSurfaceHost): void {
    this.#host = host;
    this.render();
    this.applyAllContentState();
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

  renderFrameSurface(snapshot: WindowFrameSurfaceSnapshot): void {
    this.#lastSnapshot = snapshot;
    this.rebuildSnapshotIndexes(snapshot);
    this.render();
    this.applyAllContentState();
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
    this.#contentByContentId.set(placement.placement.contentId, placement.content);
    this.#contentStateByContentId.set(placement.placement.contentId, {
      contentId: placement.placement.contentId,
      tabsetId: placement.placement.tabsetId,
      active: placement.placement.active,
      interactable: placement.placement.interactable
    });
    this.appendContentElement(placement.placement.contentId, placement.content.element);
    this.applyContentState(placement.placement.contentId);
  }

  removeContent(contentId: WindowWorkspaceContentId): void {
    const content = this.#contentByContentId.get(contentId);
    content?.setInteractable(false);
    content?.element.remove();
    this.#contentByContentId.delete(contentId);
    this.#contentStateByContentId.delete(contentId);
  }

  setContentActive(state: WindowWorkspaceGraphContentActiveState): void {
    const previous = this.#contentStateByContentId.get(state.contentId);
    this.#contentStateByContentId.set(state.contentId, {
      contentId: state.contentId,
      tabsetId: previous?.tabsetId ?? this.findTabsetContainingContentId(state.contentId)?.id ?? null,
      active: state.active,
      interactable: state.interactable
    });
    this.applyContentState(state.contentId);
  }

  refreshActiveContentState(): void {
    this.applyAllContentState();
  }

  hasInteractableContent(): boolean {
    if (!this.isEffectiveVisible()) return false;
    if (this.#contentByContentId.size === 0) return true;
    for (const contentId of this.#contentByContentId.keys()) {
      if (this.isContentInteractable(contentId)) return true;
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
          tabsetId: this.findTabsetContainingViewActorId(tab.viewActorId)?.id
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

  getActiveOrFirstTabBounds(fallback: HTMLElement): DOMRectReadOnly {
    const activeTab = this.getActiveTabs()
      .map((tab) => this.#tabElementsByViewActorId.get(tab.viewActorId))
      .find((element): element is HTMLElement => Boolean(element));
    const firstTab = activeTab ?? this.#tabElementsByViewActorId.values().next().value as HTMLElement | undefined;
    return (firstTab ?? fallback).getBoundingClientRect();
  }

  dispose(): void {
    this.enabled = false;
    for (const contentId of [...this.#contentByContentId.keys()]) {
      this.removeContent(contentId);
    }
    this.detachCurrentHost();
  }

  private detachCurrentHost(): void {
    const host = this.#host;
    if (host) this.detachHost(host);
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
    const snapshot = this.#lastSnapshot;
    if (!snapshot) {
      host.afterRender?.();
      return;
    }
    const root = snapshot.root;
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
    this.placeContentElements();
  }

  private renderSplitNode(node: WindowFrameSurfaceSnapshotNode): HTMLElement {
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

  private renderTabsetTabs(node: WindowFrameSurfaceSnapshotTabsetNode, target: HTMLElement): void {
    const host = this.requireHost();
    renderWindowFrameTabsetTabs({
      document: host.document,
      tabs: this.createTabsFromSnapshot(),
      tabset: {
        viewActorIds: node.tabs.map((tab) => tab.viewActorId),
        activeViewActorId: node.tabs.find((tab) => tab.contentId === node.activeContentId)?.viewActorId ?? null
      },
      target,
      maps: {
        tabsByViewActorId: this.#tabElementsByViewActorId as Map<string, HTMLDivElement>,
        actionsByViewActorId: this.#tabActionElementsByViewActorId as Map<string, HTMLButtonElement>
      },
      tabClassName: host.classes.tab,
      closeClassName: host.classes.tabClose
    });
  }

  private applyAllContentState(): void {
    this.#surfaceRevision += 1;
    for (const contentId of this.#contentByContentId.keys()) {
      this.applyContentState(contentId);
    }
  }

  private applyContentState(contentId: WindowWorkspaceContentId): void {
    const content = this.#contentByContentId.get(contentId);
    if (!content) return;
    const snapshotState = this.findSnapshotStateForContent(contentId);
    const explicitState = this.#contentStateByContentId.get(contentId);
    const state = {
      contentId,
      tabsetId: explicitState?.tabsetId ?? snapshotState.tabsetId,
      active: explicitState?.active ?? snapshotState.active,
      interactable: explicitState?.interactable ?? snapshotState.interactable
    };
    const effectiveInteractable = this.isEffectiveVisible() && state.interactable;
    content.setInteractable(effectiveInteractable);
    content.element.hidden = !effectiveInteractable;
    commitWindowRegisteredContentLayout(content, this.createLayoutCommit(state, content, effectiveInteractable));
  }

  private appendContentElement(contentId: WindowWorkspaceContentId, element: HTMLElement): void {
    const tabset = this.findTabsetContainingContentId(contentId);
    const target = tabset ? this.#tabsetTargetsById.get(tabset.id) : null;
    if (!target) {
      element.hidden = true;
      element.remove();
      return;
    }
    target.content.append(element);
  }

  private placeContentElements(): void {
    for (const [contentId, content] of this.#contentByContentId) {
      this.appendContentElement(contentId, content.element);
    }
  }

  private isContentInteractable(contentId: WindowWorkspaceContentId): boolean {
    const content = this.#contentByContentId.get(contentId);
    return Boolean(content?.interactable && this.isEffectiveVisible());
  }

  private findTabAtPoint(point: UiPoint): WindowFrameTab | null {
    return findWindowFrameTabAtPoint(
      this.createTabsFromSnapshot(),
      this.#tabElementsByViewActorId,
      point
    );
  }

  private findTabActionAtPoint(point: UiPoint): ReturnType<typeof findWindowFrameTabActionAtPoint> {
    return findWindowFrameTabActionAtPoint(
      this.createTabsFromSnapshot(),
      this.#tabActionElementsByViewActorId,
      point
    );
  }

  private findSplitterAtPoint(point: UiPoint): FloatingWindowSplitterHitData | null {
    const hitSlop = this.#host?.splitterHitSlop ?? 4;
    for (const [splitId, element] of this.#splitterElementsBySplitId) {
      if (!isPointInsideRect(point, expandDomRect(element.getBoundingClientRect(), hitSlop))) continue;
      const split = this.findSplitById(splitId);
      if (!split) continue;
      return {
        splitId,
        direction: split.direction
      };
    }
    return null;
  }

  private findTabsetContainingContentId(contentId: WindowWorkspaceContentId): WindowFrameSurfaceSnapshotTabsetNode | null {
    const snapshot = this.#lastSnapshot;
    return snapshot ? findSnapshotTabsetContainingContentId(snapshot.root, contentId) : null;
  }

  private findTabsetContainingViewActorId(viewActorId: string): WindowFrameSurfaceSnapshotTabsetNode | null {
    const contentId = this.#contentIdByViewActorId.get(viewActorId);
    return contentId ? this.findTabsetContainingContentId(contentId) : null;
  }

  private findSplitById(splitId: string): Extract<WindowFrameSurfaceSnapshotNode, { readonly kind: "split" }> | null {
    const snapshot = this.#lastSnapshot;
    return snapshot ? findSnapshotSplitById(snapshot.root, splitId) : null;
  }

  private createTabsFromSnapshot(): readonly WindowFrameTab[] {
    return [...this.#tabsByViewActorId.values()];
  }

  private getActiveTabs(): readonly WindowFrameSurfaceSnapshotTab[] {
    const snapshot = this.#lastSnapshot;
    return snapshot ? listSnapshotTabs(snapshot.root).filter((tab) => tab.active) : [];
  }

  private rebuildSnapshotIndexes(snapshot: WindowFrameSurfaceSnapshot): void {
    this.#viewActorIdByContentId.clear();
    this.#contentIdByViewActorId.clear();
    this.#tabsByViewActorId.clear();
    for (const tab of listSnapshotTabs(snapshot.root)) {
      this.#viewActorIdByContentId.set(tab.contentId, tab.viewActorId);
      this.#contentIdByViewActorId.set(tab.viewActorId, tab.contentId);
      this.#tabsByViewActorId.set(tab.viewActorId, {
        viewActorId: tab.viewActorId,
        identity: tab.identity,
        viewKey: tab.identity.viewKey,
        title: tab.title ?? tab.identity.viewKey
      });
    }
  }

  private createSplitResizeStart(hitData: unknown): WindowFrameSurfaceSplitResizeStart | null {
    const splitter = readSurfaceSplitterHitData(hitData);
    const split = splitter ? this.findSplitById(splitter.splitId) : null;
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

  private requireHost(): WindowFrameSurfaceHost {
    if (!this.#host) {
      throw new Error("WindowFrameSurfaceComponent requires an attached host.");
    }
    return this.#host;
  }

  private isEffectiveVisible(): boolean {
    return this.enabled && Boolean(this.#host?.getEffectiveVisible());
  }

  private findSnapshotStateForContent(contentId: WindowWorkspaceContentId): WindowFrameSurfaceContentState {
    const tabset = this.findTabsetContainingContentId(contentId);
    const active = Boolean(tabset && tabset.activeContentId === contentId);
    return {
      contentId,
      tabsetId: tabset?.id ?? null,
      active,
      interactable: active
    };
  }

  private createLayoutCommit(
    state: WindowFrameSurfaceContentState,
    content: WindowRegisteredContent,
    interactable: boolean
  ): WindowContentLayoutCommit {
    const target = state.tabsetId ? this.#tabsetTargetsById.get(state.tabsetId) : null;
    const contentRect = target
      ? toLayoutCommitRect(target.content.getBoundingClientRect())
      : toLayoutCommitRect(content.element.getBoundingClientRect());
    return {
      surfaceId: this.id,
      contentId: state.contentId,
      tabsetId: state.tabsetId,
      active: state.active,
      interactable,
      contentRect,
      surfaceRevision: this.#surfaceRevision,
      splits: this.listLayoutCommitSplits()
    };
  }

  private listLayoutCommitSplits(): readonly WindowContentLayoutCommitSplit[] {
    const splits: WindowContentLayoutCommitSplit[] = [];
    for (const [splitId, element] of this.#splitterElementsBySplitId) {
      const split = this.findSplitById(splitId);
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

function findSnapshotTabsetContainingContentId(
  node: WindowFrameSurfaceSnapshotNode,
  contentId: WindowWorkspaceContentId
): WindowFrameSurfaceSnapshotTabsetNode | null {
  if (node.kind === "tabset") {
    return node.tabs.some((tab) => tab.contentId === contentId) ? node : null;
  }
  return findSnapshotTabsetContainingContentId(node.first, contentId) ??
    findSnapshotTabsetContainingContentId(node.second, contentId);
}

function findSnapshotSplitById(
  node: WindowFrameSurfaceSnapshotNode,
  splitId: string
): Extract<WindowFrameSurfaceSnapshotNode, { readonly kind: "split" }> | null {
  if (node.kind === "tabset") return null;
  if (node.id === splitId) return node;
  return findSnapshotSplitById(node.first, splitId) ?? findSnapshotSplitById(node.second, splitId);
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
