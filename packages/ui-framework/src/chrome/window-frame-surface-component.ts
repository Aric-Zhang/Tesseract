import { type Actor, type Component, type ComponentType } from "actor-core";
import type { ActorInputMoveEvent } from "actor-input";
import {
  createWindowContentAttachment,
  type WindowContentAttachment,
  type WindowContentAttachmentRequest,
  type WindowContentHost
} from "../ports/window-content-host";
import {
  readFloatingWindowSplitterHitData,
  type FloatingWindowSplitterHitData
} from "./window-frame-hit-data";
import type {
  WindowFrameDockTargetTabset,
  WindowFrameRuntimeDockNode,
  WindowFrameTab
} from "../model/window-frame-tab";
import {
  findWindowFrameDockTreeTabsetById,
  type WindowFrameDockTreeNode,
  type WindowFrameDockTreeSplitDirection,
  type WindowFrameDockTreeTabsetNode
} from "../model/window-frame-dock-tree";
import { WindowDockSurfaceModel, type WindowDockSurfaceMutationResult } from "../model/window-dock-surface-model";
import {
  findWindowFrameTabActionAtPoint,
  findWindowFrameTabAtPoint,
  renderWindowFrameTabsetTabs
} from "./window-frame-tab-chrome";
import { rectFromDomRect, type WindowDockRect, type WindowDockSplitPlacement } from "../model/window-dock-targets";
import type { UiPoint } from "../ports/ui-geometry";

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

interface WindowFrameSurfaceTabsetTarget {
  readonly tabbar: HTMLElement;
  readonly content: HTMLElement;
}

export class WindowFrameSurfaceComponent implements Component {
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
  #dockSurface = new WindowDockSurfaceModel({ tabs: [] });
  #host: WindowFrameSurfaceHost | null = null;
  #splitResizeStart: WindowFrameSurfaceSplitResizeStart | null = null;

  constructor(actor: Actor, options: WindowFrameSurfaceComponentOptions = {}) {
    this.actor = actor;
    this.id = options.id ?? `${actor.id}:window-frame-surface`;
  }

  configure(options: {
    readonly tabs: readonly WindowFrameTab[];
    readonly activeViewActorId?: string | null;
  }): void {
    this.#dockSurface = new WindowDockSurfaceModel(options);
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
    return this.#dockSurface.listTabs();
  }

  getRuntimeDockRoot(): WindowFrameRuntimeDockNode {
    return this.#dockSurface.getRuntimeDockRoot();
  }

  restoreRuntimeDockRoot(root: WindowFrameRuntimeDockNode, options: {
    readonly tabs?: readonly WindowFrameTab[];
    readonly activeViewActorId?: string | null;
  } = {}): void {
    this.#dockSurface.restoreRuntimeDockRoot(root, options);
    this.render();
    this.applyActiveContentState();
  }

  listDockTargetTabsets(): readonly WindowFrameDockTargetTabset[] {
    const fallback = this.#host?.getDockTargetFallbackBounds?.() ?? null;
    const root = this.#dockSurface.getRuntimeDockRoot();
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

  getFocusedViewActorId(): string | null {
    return this.#dockSurface.focusedViewActorId;
  }

  getActiveViewActorIds(): readonly string[] {
    return this.#dockSurface.listActiveViewActorIds();
  }

  isViewActiveInFrame(viewActorId: string): boolean {
    return this.#dockSurface.isViewActorIdActiveInItsTabset(viewActorId);
  }

  isViewVisibleInFrame(viewActorId: string): boolean {
    return this.isEffectiveVisible() && this.isViewActiveInFrame(viewActorId);
  }

  addTab(tab: WindowFrameTab, options: {
    readonly active?: boolean;
    readonly targetTabsetId?: string;
  } = {}): WindowDockSurfaceMutationResult {
    const result = this.#dockSurface.addTab(tab, options);
    this.render();
    this.applyActiveContentState();
    return result;
  }

  splitTab(tab: WindowFrameTab, options: {
    readonly targetTabsetId: string;
    readonly placement: WindowDockSplitPlacement;
    readonly active?: boolean;
  }): WindowDockSurfaceMutationResult {
    const result = this.#dockSurface.splitTab(tab, options);
    this.render();
    this.applyActiveContentState();
    return result;
  }

  removeTab(viewActorId: string): boolean {
    const removed = this.#dockSurface.removeTab(viewActorId);
    if (!removed) return false;
    this.#contentAttachmentsByViewActorId.get(viewActorId)?.setInteractable(false);
    this.render();
    this.applyActiveContentState();
    return true;
  }

  activateTab(viewActorId: string): WindowDockSurfaceMutationResult {
    const result = this.#dockSurface.activateTab(viewActorId);
    if (!result.activeViewActorChanged) return result;
    this.render();
    this.applyActiveContentState();
    return result;
  }

  hasTab(viewActorId: string): boolean {
    return this.#dockSurface.hasTab(viewActorId);
  }

  hasTabset(targetTabsetId: string): boolean {
    return this.#dockSurface.hasTabset(targetTabsetId);
  }

  getContentHost(viewActorId: string): WindowContentHost {
    const existing = this.#contentHostsByViewActorId.get(viewActorId);
    if (existing) return existing;
    const surface = this;
    const host: WindowContentHost = {
      id: `${this.#host?.id ?? this.id}:${viewActorId}`,
      get inputStackPriority() {
        return surface.#host?.getInputStackPriority();
      },
      mountContent: (request) => this.mountContent(withWindowContentViewActorId(request, viewActorId)),
      isContentInteractable: (element) => (
        this.#dockSurface.isViewActorIdActiveInItsTabset(viewActorId) &&
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
      if (viewActorId && !this.#dockSurface.isViewActorIdActiveInItsTabset(viewActorId)) return false;
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
          tabsetId: this.#dockSurface.findTabsetContaining(tab.viewActorId)?.id
        }
      };
    }
    const splitter = this.findSplitterAtPoint(point);
    if (splitter) return { part: "splitter", hitPriority: 90, data: splitter };
    if (this.hasInteractableContent()) return { part: "content", hitPriority: 1 };
    return null;
  }

  beginSplitResize(hitData: unknown): void {
    const splitter = readSurfaceSplitterHitData(hitData);
    const split = splitter ? this.#dockSurface.findSplitById(splitter.splitId) : null;
    const splitElement = splitter ? this.#splitElementsById.get(splitter.splitId) : null;
    if (!splitter || !split || !splitElement) {
      this.#splitResizeStart = null;
      return;
    }
    this.#splitResizeStart = {
      splitId: splitter.splitId,
      direction: splitter.direction,
      ratio: split.ratio,
      splitRect: splitElement.getBoundingClientRect()
    };
  }

  updateSplitRatioFromDrag(event: ActorInputMoveEvent): void {
    const start = this.#splitResizeStart;
    const host = this.#host;
    if (!start || !host) return;
    const size = start.direction === "horizontal"
      ? start.splitRect.width
      : start.splitRect.height;
    if (size <= 0) return;
    const delta = start.direction === "horizontal"
      ? event.totalDelta.dx
      : event.totalDelta.dy;
    const ratio = clampSplitRatio(
      start.ratio + delta / size,
      size,
      host.splitMinPaneSize
    );
    this.#dockSurface.updateSplitRatio(start.splitId, ratio);
    this.render();
    this.applyActiveContentState();
  }

  endSplitResize(): void {
    this.#splitResizeStart = null;
  }

  getActiveOrFirstTabBounds(fallback: HTMLElement): DOMRectReadOnly {
    const focusedViewActorId = this.#dockSurface.focusedViewActorId;
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
    const root = this.#dockSurface.root;
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
      tabs: this.#dockSurface.listTabs(),
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
    for (const [viewActorId, attachment] of this.#contentAttachmentsByViewActorId) {
      const active = this.isEffectiveVisible() && this.#dockSurface.isViewActorIdActiveInItsTabset(viewActorId);
      attachment.setInteractable(active);
      attachment.element.hidden = !active;
    }
  }

  private appendContentElement(viewActorId: string | null, element: HTMLElement): void {
    const host = this.#host;
    if (!host) return;
    if (!viewActorId) {
      host.primaryContent.append(element);
      return;
    }
    const tabset = this.#dockSurface.findTabsetContaining(viewActorId);
    const target = tabset ? this.#tabsetTargetsById.get(tabset.id) : null;
    if (!target) {
      element.hidden = true;
      element.remove();
      return;
    }
    target.content.append(element);
    element.hidden = !this.isEffectiveVisible() || !this.#dockSurface.isViewActorIdActiveInItsTabset(viewActorId);
  }

  private placeContentAttachments(): void {
    for (const attachment of this.#contentAttachments) {
      const viewActorId = this.#contentViewActorIdsByAttachment.get(attachment) ?? null;
      this.appendContentElement(viewActorId, attachment.element);
    }
  }

  private findTabAtPoint(point: UiPoint): WindowFrameTab | null {
    return findWindowFrameTabAtPoint(
      this.#dockSurface.listTabs(),
      this.#tabElementsByViewActorId,
      point
    );
  }

  private findTabActionAtPoint(point: UiPoint): ReturnType<typeof findWindowFrameTabActionAtPoint> {
    return findWindowFrameTabActionAtPoint(
      this.#dockSurface.listTabs(),
      this.#tabActionElementsByViewActorId,
      point
    );
  }

  private findSplitterAtPoint(point: UiPoint): FloatingWindowSplitterHitData | null {
    for (const [splitId, element] of this.#splitterElementsBySplitId) {
      if (!isPointInsideRect(point, element.getBoundingClientRect())) continue;
      const split = this.#dockSurface.findSplitById(splitId);
      if (!split) continue;
      return {
        splitId,
        direction: split.direction
      };
    }
    return null;
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
}

function withWindowContentViewActorId(
  requestOrElement: HTMLElement | WindowContentAttachmentRequest,
  viewActorId: string
): WindowContentAttachmentRequest {
  if (isWindowContentAttachmentRequest(requestOrElement)) {
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
  return readFloatingWindowSplitterHitData({
    data: hitData
  } as Parameters<typeof readFloatingWindowSplitterHitData>[0]);
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
