import type {
  ScreenPoint
} from "gizmo-core";
import {
  cloneVec2,
  vec2,
  type ParameterPath,
  type SceneCommandSink,
  type SceneStateChangedEvent,
  type Vec2
} from "../scene-runtime";
import { type Actor, type Component, type ComponentType } from "../actor-runtime";
import { actorInputScopeRoutePriority } from "../gizmo-runtime";
import type {
  ActorInputCancelEvent,
  ActorInputEndEvent,
  ActorInputHit,
  ActorInputMoveEvent,
  ActorInputParticipant,
  ActorInputStartEvent
} from "../gizmo-runtime";
import type { StateObserverResponder } from "../state-runtime";
import type { WindowTabDragSink } from "./window-dock-preview-component";
import type { WindowTabDragSource } from "./window-tab-drag-session";
import {
  createWindowContentAttachment,
  type FloatingWindowContentAttachment,
  type FloatingWindowHost,
  type WindowContentAttachmentRequest,
  type WindowContentHost
} from "./floating-window-host";
import type { WindowFrameIntentSink } from "./window-frame-lifecycle";
import {
  cloneFloatingWindowState,
  DEFAULT_FLOATING_WINDOW_MIN_SIZE,
  type FloatingWindowParameterPaths,
  type FloatingWindowState
} from "./floating-window-state";
import type {
  WindowFrameDockTargetTabset,
  WindowFramePort,
  WindowFramePresentation,
  WindowFrameRuntimeDockNode,
  WindowFrameTab
} from "./window-frame-port";
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
  type WindowFrameDockTreeNode,
  type WindowFrameDockTreeSplitDirection,
  type WindowFrameDockTreeTabsetNode
} from "./window-frame-dock-tree";
import type { WindowViewKey } from "./window-view-key";
import { windowViewKey } from "./window-view-key";
import { rectFromDomRect, type WindowDockSplitPlacement } from "./window-dock-targets";

export const floatingWindowComponentType =
  "floating-window-component" as ComponentType<FloatingWindowComponent>;

export type FloatingWindowCloseMode = "hide";
export type FloatingWindowPresentation = WindowFramePresentation;
export type FloatingWindowActivationMode = "visible" | "none";

export interface FloatingWindowMenuOptions {
  readonly include?: boolean;
  readonly viewKey?: WindowViewKey;
  readonly label?: string;
  readonly order?: number;
  readonly group?: string;
  readonly activationMode?: FloatingWindowActivationMode;
}

export interface FloatingWindowMenuDescriptor {
  readonly include: boolean;
  readonly viewKey: WindowViewKey | null;
  readonly label: string;
  readonly order: number;
  readonly group: string | null;
  readonly activationMode: FloatingWindowActivationMode;
}

export type FloatingWindowStateBindingOptions =
  | {
      readonly kind: "persistent";
      readonly paths: FloatingWindowParameterPaths;
    }
  | {
      readonly kind: "runtime";
    };

export interface FloatingWindowComponentOptions {
  id: string;
  parent: HTMLElement;
  title: string;
  paths?: FloatingWindowParameterPaths;
  stateBinding?: FloatingWindowStateBindingOptions;
  initialState: FloatingWindowState;
  minSize?: { x: number; y: number };
  className?: string;
  contentClassName?: string;
  priority?: number;
  presentation?: FloatingWindowPresentation;
  closeMode?: FloatingWindowCloseMode;
  frameId?: string;
  tabs?: readonly WindowFrameTab[];
  activeViewActorId?: string;
  activeViewKey?: WindowViewKey;
  frameIntentSink?: WindowFrameIntentSink;
  tabDragSink?: WindowTabDragSink;
  windowMenu?: FloatingWindowMenuOptions;
  document?: Pick<Document, "createElement">;
}

export interface FloatingWindowComponentServices {
  commandSink?: SceneCommandSink;
}

export const DEFAULT_FLOATING_WINDOW_PRIORITY = 1000;

type FloatingWindowPartId =
  | "window-tab"
  | "splitter"
  | "titlebar-empty"
  | "window-content"
  | "close"
  | "resize-left"
  | "resize-right"
  | "resize-top"
  | "resize-bottom"
  | "resize-top-left"
  | "resize-top-right"
  | "resize-bottom-left"
  | "resize-bottom-right";

type ResizeHandleClass =
  | "left"
  | "right"
  | "top"
  | "bottom"
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right";

interface FloatingWindowTabsetRenderTarget {
  readonly tabbar: HTMLDivElement;
  readonly content: HTMLDivElement;
}

interface FloatingWindowSplitResizeStart {
  readonly splitId: string;
  readonly direction: WindowFrameDockTreeSplitDirection;
  readonly ratio: number;
  readonly splitRect: DOMRectReadOnly;
}

interface FloatingWindowSplitterHitData {
  readonly splitId: string;
  readonly direction: WindowFrameDockTreeSplitDirection;
}

interface FloatingWindowStateBinding {
  readonly kind: "persistent" | "runtime";
  readonly paths: FloatingWindowParameterPaths | null;
  readonly visiblePath: ParameterPath<boolean> | null;
  requestPosition(state: FloatingWindowState, position: Vec2, timeStamp?: number): boolean;
  requestSize(state: FloatingWindowState, size: Vec2, timeStamp?: number): boolean;
  requestVisible(state: FloatingWindowState, visible: boolean, timeStamp?: number): boolean;
  applySceneStateChanged(state: FloatingWindowState, event: SceneStateChangedEvent): boolean;
}

const FLOATING_WINDOW_SPLIT_MIN_PANE_SIZE = 80;

export class FloatingWindowComponent
  implements Component, FloatingWindowHost, WindowFramePort, ActorInputParticipant, StateObserverResponder {
  readonly type = floatingWindowComponentType;
  readonly actor: Actor;
  readonly state: FloatingWindowState;
  enabled = true;

  readonly #stateBinding: FloatingWindowStateBinding;
  readonly #menuDescriptor: FloatingWindowMenuDescriptor;
  readonly #basePriority: number;
  readonly #minSize: Vec2;
  readonly #parentElement: HTMLElement;
  readonly #documentRef: Pick<Document, "createElement">;
  readonly #rootClassName: string;
  readonly #rootElement: HTMLDivElement;
  readonly #titlebar: HTMLDivElement;
  readonly #closeButton: HTMLButtonElement;
  readonly #resizeHandles: Record<ResizeHandleClass, HTMLDivElement>;
  readonly #tabElementsByViewActorId = new Map<string, HTMLDivElement>();
  readonly #tabsetTargetsById = new Map<string, FloatingWindowTabsetRenderTarget>();
  readonly #splitElementsById = new Map<string, HTMLDivElement>();
  readonly #splitterElementsBySplitId = new Map<string, HTMLDivElement>();
  readonly #contentSlot: HTMLDivElement;
  readonly #frameId: string;
  readonly #frameIntentSink?: WindowFrameIntentSink;
  readonly #tabDragSink?: WindowTabDragSink;
  readonly #contentAttachments = new Set<FloatingWindowContentAttachment>();
  readonly #contentAttachmentsByViewActorId = new Map<string, FloatingWindowContentAttachment>();
  readonly #contentViewActorIdsByAttachment = new WeakMap<FloatingWindowContentAttachment, string>();
  readonly #contentHostsByViewActorId = new Map<string, WindowContentHost>();
  #tabs: WindowFrameTab[];
  #activeViewActorId: string | null;
  #frameRoot: WindowFrameDockTreeNode;
  #dragStartState: FloatingWindowState | null = null;
  #splitResizeStart: FloatingWindowSplitResizeStart | null = null;
  #presentation: FloatingWindowPresentation;
  #effectivePriority: number;

  constructor(
    actor: Actor,
    options: FloatingWindowComponentOptions,
    services: FloatingWindowComponentServices = {}
  ) {
    this.actor = actor;
    this.id = options.id;
    this.#frameId = options.frameId ?? actor.id;
    this.#frameIntentSink = options.frameIntentSink;
    this.#tabDragSink = options.tabDragSink;
    this.#basePriority = options.priority ?? DEFAULT_FLOATING_WINDOW_PRIORITY;
    this.#effectivePriority = this.#basePriority;
    this.#menuDescriptor = createMenuDescriptor(options, this.#basePriority);
    this.#minSize = cloneVec2(options.minSize ?? DEFAULT_FLOATING_WINDOW_MIN_SIZE);
    this.#parentElement = options.parent;
    this.#rootClassName = joinClassNames("floating-gizmo-window", options.className);
    this.#presentation = options.presentation ?? "windowed";
    this.state = cloneFloatingWindowState(options.initialState);
    this.#stateBinding = createFloatingWindowStateBinding(options, services, this.id);
    this.#tabs = createInitialTabs(options);
    this.#activeViewActorId = resolveInitialActiveViewActorId(this.#tabs, options.activeViewActorId);
    this.#frameRoot = createWindowFrameDockTreeTabset(
      this.#tabs.map((tab) => tab.viewActorId),
      this.#activeViewActorId
    );

    const documentRef = resolveDocument(options);
    this.#documentRef = documentRef;
    this.#rootElement = documentRef.createElement("div");
    this.#rootElement.className = this.#rootClassName;

    this.#titlebar = documentRef.createElement("div");
    this.#titlebar.className = "floating-gizmo-window__titlebar";

    this.#closeButton = documentRef.createElement("button");
    this.#closeButton.className = "floating-gizmo-window__close";
    this.#closeButton.type = "button";
    this.#closeButton.tabIndex = -1;
    this.#closeButton.ariaLabel = `Close ${options.title}`;
    this.#closeButton.textContent = "x";

    this.#contentSlot = documentRef.createElement("div");
    this.#contentSlot.className = joinClassNames("floating-gizmo-window__content", options.contentClassName);
    this.#resizeHandles = {
      left: createResizeHandle(documentRef, "left"),
      right: createResizeHandle(documentRef, "right"),
      top: createResizeHandle(documentRef, "top"),
      bottom: createResizeHandle(documentRef, "bottom"),
      "top-left": createResizeHandle(documentRef, "top-left"),
      "top-right": createResizeHandle(documentRef, "top-right"),
      "bottom-left": createResizeHandle(documentRef, "bottom-left"),
      "bottom-right": createResizeHandle(documentRef, "bottom-right")
    };

    this.#rootElement.append(
      this.#titlebar,
      this.#contentSlot,
      this.#resizeHandles.left,
      this.#resizeHandles.right,
      this.#resizeHandles.top,
      this.#resizeHandles.bottom,
      this.#resizeHandles["top-left"],
      this.#resizeHandles["top-right"],
      this.#resizeHandles["bottom-left"],
      this.#resizeHandles["bottom-right"]
    );

    this.renderFrame();
    this.applyLayout();
    options.parent.append(this.#rootElement);
  }

  readonly id: string;

  get basePriority(): number {
    return this.#basePriority;
  }

  get inputStackPriority(): number {
    return this.#effectivePriority;
  }

  setEffectivePriority(priority: number): void {
    this.#effectivePriority = priority;
    this.applyEffectivePriority();
  }

  get parameterPaths(): FloatingWindowParameterPaths | null {
    return this.#stateBinding.paths;
  }

  get visiblePath(): ParameterPath<boolean> | null {
    return this.#stateBinding.visiblePath;
  }

  get menuDescriptor(): FloatingWindowMenuDescriptor {
    return this.#menuDescriptor;
  }

  get presentation(): FloatingWindowPresentation {
    return this.#presentation;
  }

  get visible(): boolean {
    return this.state.visible;
  }

  get frameId(): string {
    return this.#frameId;
  }

  listTabs(): readonly WindowFrameTab[] {
    return this.#tabs.map((tab) => ({ ...tab }));
  }

  getRuntimeDockRoot(): WindowFrameRuntimeDockNode {
    return cloneWindowFrameRuntimeDockRoot(this.#frameRoot);
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
    this.#frameRoot = restoredRoot;
    const activeViewActorId = options.activeViewActorId ?? findActiveViewActorIdInWindowFrameDockTree(restoredRoot);
    this.#activeViewActorId =
      activeViewActorId && viewActorIds.includes(activeViewActorId)
        ? activeViewActorId
        : viewActorIds[0] ?? null;
    this.renderFrame();
    this.applyActiveContentState();
  }

  listDockTargetTabsets(): readonly WindowFrameDockTargetTabset[] {
    return [...this.#tabsetTargetsById.entries()].map(([targetTabsetId, target]) => ({
      targetTabsetId,
      tabBounds: rectFromDomRect(target.tabbar.getBoundingClientRect()),
      contentBounds: rectFromDomRect(target.content.getBoundingClientRect())
    }));
  }

  getActiveViewActorId(): string | null {
    return this.#activeViewActorId;
  }

  isViewActiveInFrame(viewActorId: string): boolean {
    return this.isViewActorIdActiveInItsTabset(viewActorId);
  }

  isViewVisibleInFrame(viewActorId: string): boolean {
    return this.state.visible && this.isViewActorIdActiveInItsTabset(viewActorId);
  }

  addTab(
    tab: WindowFrameTab,
    options: {
      readonly active?: boolean;
      readonly targetTabsetId?: string;
    } = {}
  ): void {
    const previousActiveViewActorId = this.#activeViewActorId;
    const existingIndex = this.#tabs.findIndex((candidate) => candidate.viewActorId === tab.viewActorId);
    if (existingIndex >= 0) {
      this.#tabs[existingIndex] = tab;
    } else {
      this.#tabs = [...this.#tabs, tab];
    }
    this.#frameRoot = addTabToWindowFrameDockTree(this.#frameRoot, tab.viewActorId, {
      active: options.active,
      targetTabsetId: options.targetTabsetId
    });
    if (options.active || !this.#activeViewActorId) {
      this.#activeViewActorId = tab.viewActorId;
    }
    if (
      this.#presentation === "fullscreen" &&
      previousActiveViewActorId !== this.#activeViewActorId
    ) {
      this.setPresentation("windowed");
    }
    this.renderFrame();
    this.applyActiveContentState();
  }

  splitTab(
    tab: WindowFrameTab,
    options: {
      readonly targetTabsetId: string;
      readonly placement: WindowDockSplitPlacement;
      readonly active?: boolean;
    }
  ): void {
    const previousActiveViewActorId = this.#activeViewActorId;
    const existingIndex = this.#tabs.findIndex((candidate) => candidate.viewActorId === tab.viewActorId);
    if (existingIndex >= 0) {
      this.#tabs[existingIndex] = tab;
    } else {
      this.#tabs = [...this.#tabs, tab];
    }
    const split = splitTabInWindowFrameDockTree(this.#frameRoot, tab.viewActorId, options);
    if (!split.split || !split.node) {
      throw new Error(`Target tabset not found: ${options.targetTabsetId}.`);
    }
    this.#frameRoot = split.node;
    if (options.active || !this.#activeViewActorId) {
      this.#activeViewActorId = tab.viewActorId;
    }
    if (
      this.#presentation === "fullscreen" &&
      previousActiveViewActorId !== this.#activeViewActorId
    ) {
      this.setPresentation("windowed");
    }
    this.renderFrame();
    this.applyActiveContentState();
  }

  removeTab(viewActorId: string): void {
    const nextTabs = this.#tabs.filter((tab) => tab.viewActorId !== viewActorId);
    if (nextTabs.length === this.#tabs.length) return;
    this.#tabs = nextTabs;
    const removed = removeTabFromWindowFrameDockTree(this.#frameRoot, viewActorId);
    if (removed.node) {
      this.#frameRoot = removed.node;
    } else {
      this.#frameRoot = createWindowFrameDockTreeTabset(
        nextTabs.map((tab) => tab.viewActorId),
        nextTabs[0]?.viewActorId ?? null
      );
    }
    this.#tabElementsByViewActorId.get(viewActorId)?.remove();
    this.#tabElementsByViewActorId.delete(viewActorId);
    this.#contentAttachmentsByViewActorId.get(viewActorId)?.setInteractable(false);
    if (this.#activeViewActorId === viewActorId) {
      this.#activeViewActorId = this.#tabs[0]?.viewActorId ?? null;
    }
    this.renderFrame();
    this.applyActiveContentState();
  }

  activateTab(viewActorId: string): void {
    if (!this.hasTab(viewActorId) || this.#activeViewActorId === viewActorId) return;
    this.#activeViewActorId = viewActorId;
    this.#frameRoot = activateTabInWindowFrameDockTree(this.#frameRoot, viewActorId);
    if (this.#presentation === "fullscreen") {
      this.setPresentation("windowed");
    }
    this.renderFrame();
    this.applyActiveContentState();
  }

  hasTab(viewActorId: string): boolean {
    return this.#tabs.some((tab) => tab.viewActorId === viewActorId);
  }

  hasTabset(targetTabsetId: string): boolean {
    return Boolean(findWindowFrameDockTreeTabsetById(this.#frameRoot, targetTabsetId));
  }

  getContentHost(viewActorId: string): WindowContentHost {
    const existing = this.#contentHostsByViewActorId.get(viewActorId);
    if (existing) return existing;
    const thisWindow = this;
    const host: WindowContentHost = {
      id: `${this.id}:${viewActorId}`,
      get inputStackPriority() {
        return thisWindow.inputStackPriority;
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

  getFloatingBounds() {
    return rectFromDomRect(this.getBounds());
  }

  restoreFloatingState(state: FloatingWindowState): void {
    this.state.position = cloneVec2(state.position);
    this.state.size = cloneVec2(state.size);
    this.state.visible = state.visible;
    this.applyLayout();
  }

  setPresentation(presentation: FloatingWindowPresentation): void {
    if (this.#presentation === presentation) return;
    this.#presentation = presentation;
    this.#dragStartState = null;
    this.applyLayout();
  }

  setTitle(title: string): void {
    const targetViewActorId = this.#activeViewActorId ?? this.#tabs[0]?.viewActorId;
    if (!targetViewActorId) return;
    this.#tabs = this.#tabs.map((tab) => (
      tab.viewActorId === targetViewActorId ? { ...tab, title } : tab
    ));
    this.renderFrame();
  }

  getBounds(): DOMRectReadOnly {
    return this.#rootElement.getBoundingClientRect();
  }

  getTabBounds(): DOMRectReadOnly {
    const activeTab = this.#activeViewActorId
      ? this.#tabElementsByViewActorId.get(this.#activeViewActorId)
      : null;
    const firstTab = activeTab ?? this.#tabElementsByViewActorId.values().next().value as HTMLDivElement | undefined;
    return (firstTab ?? this.#titlebar).getBoundingClientRect();
  }

  getContentBounds(): DOMRectReadOnly {
    return this.#contentSlot.getBoundingClientRect();
  }

  mountContent(requestOrElement: HTMLElement | WindowContentAttachmentRequest): FloatingWindowContentAttachment {
    const viewActorId = readWindowContentViewActorId(requestOrElement);
    if (viewActorId) {
      this.#contentAttachmentsByViewActorId.get(viewActorId)?.dispose();
    }
    const attachment = createWindowContentAttachment(
      this,
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
    if (!this.state.visible) return false;
    for (const attachment of this.#contentAttachments) {
      if (attachment.element !== element) continue;
      const viewActorId = this.#contentViewActorIdsByAttachment.get(attachment);
      if (viewActorId && !this.isViewActorIdActiveInItsTabset(viewActorId)) return false;
      return attachment.interactable;
    }
    return false;
  }

  requestVisible(visible: boolean, timeStamp?: number): void {
    if (this.#stateBinding.requestVisible(this.state, visible, timeStamp)) {
      this.applyLayout();
    }
  }

  onSceneStateChanged(event: SceneStateChangedEvent): void {
    if (this.#stateBinding.applySceneStateChanged(this.state, event)) {
      this.applyLayout();
    }
  }

  hitTestInput(point: ScreenPoint): ActorInputHit | null {
    if (!this.state.visible) return null;
    if (this.#presentation === "fullscreen") return null;
    if (!isPointInsideRect(point, this.#rootElement.getBoundingClientRect())) return null;
    if (isPointInsideRect(point, this.#closeButton.getBoundingClientRect())) {
      return this.createHit("close", 50);
    }
    if (isPointInsideRect(point, this.#resizeHandles["top-left"].getBoundingClientRect())) {
      return this.createHit("resize-top-left", 40);
    }
    if (isPointInsideRect(point, this.#resizeHandles["top-right"].getBoundingClientRect())) {
      return this.createHit("resize-top-right", 40);
    }
    if (isPointInsideRect(point, this.#resizeHandles["bottom-left"].getBoundingClientRect())) {
      return this.createHit("resize-bottom-left", 40);
    }
    if (isPointInsideRect(point, this.#resizeHandles["bottom-right"].getBoundingClientRect())) {
      return this.createHit("resize-bottom-right", 40);
    }
    if (isPointInsideRect(point, this.#resizeHandles.left.getBoundingClientRect())) {
      return this.createHit("resize-left", 30);
    }
    if (isPointInsideRect(point, this.#resizeHandles.right.getBoundingClientRect())) {
      return this.createHit("resize-right", 30);
    }
    if (isPointInsideRect(point, this.#resizeHandles.top.getBoundingClientRect())) {
      return this.createHit("resize-top", 30);
    }
    if (isPointInsideRect(point, this.#resizeHandles.bottom.getBoundingClientRect())) {
      return this.createHit("resize-bottom", 30);
    }
    const hitTab = this.findTabAtPoint(point);
    if (hitTab) {
      return this.createHit("window-tab", 20, { tab: hitTab });
    }
    if (isPointInsideRect(point, this.#titlebar.getBoundingClientRect())) {
      return this.createHit("titlebar-empty", 20);
    }
    const hitSplitter = this.findSplitterAtPoint(point);
    if (hitSplitter) {
      return this.createHit("splitter", 15, hitSplitter);
    }
    if (
      isPointInsideRect(point, this.#contentSlot.getBoundingClientRect()) &&
      this.hasInteractableContent()
    ) {
      return this.createContentHit();
    }
    return null;
  }

  onInputStart(_event: ActorInputStartEvent): void {
    this.#dragStartState = cloneFloatingWindowState(this.state);
    this.#splitResizeStart = null;
    if (_event.hit.partId === "window-tab") {
      const source = readWindowTabDragSource(this.#frameId, _event.hit);
      if (source) {
        this.#tabDragSink?.beginTabDrag(source, _event.point);
      }
    } else if (_event.hit.partId === "splitter") {
      const splitter = readFloatingWindowSplitterHitData(_event.hit);
      const split = splitter ? findWindowFrameDockTreeSplitById(this.#frameRoot, splitter.splitId) : null;
      const splitElement = splitter ? this.#splitElementsById.get(splitter.splitId) : null;
      if (splitter && split && splitElement) {
        this.#splitResizeStart = {
          splitId: splitter.splitId,
          direction: splitter.direction,
          ratio: split.ratio,
          splitRect: splitElement.getBoundingClientRect()
        };
      }
    }
  }

  onInputMove(event: ActorInputMoveEvent): void {
    if (!event.isDragging) return;
    const dragStartState = this.#dragStartState ?? this.state;
    const partId = event.hit.partId as FloatingWindowPartId;
    if (partId === "titlebar-empty") {
      this.submitPositionSet(event, vec2(
        dragStartState.position.x + event.totalDelta.dx,
        dragStartState.position.y + event.totalDelta.dy
      ));
    } else if (partId === "window-tab") {
      this.#tabDragSink?.moveTabDrag(event.point);
    } else if (partId === "splitter") {
      this.updateSplitRatioFromDrag(event);
    } else if (isResizePart(partId)) {
      const next = getResizeState(partId, dragStartState, event.totalDelta.dx, event.totalDelta.dy, this.#minSize);
      if (next.position) {
        this.submitPositionSet(event, next.position);
      }
      this.submitSizeSet(event, next.size);
    }
  }

  onInputEnd(event: ActorInputEndEvent): void {
    this.#dragStartState = null;
    this.#splitResizeStart = null;
    if (event.hit.partId === "window-tab") {
      if (event.wasClick) {
        const source = readWindowTabDragSource(this.#frameId, event.hit);
        if (source) {
          if (this.#frameIntentSink?.requestActivateFrameTab) {
            this.#frameIntentSink.requestActivateFrameTab(this.#frameId, source.viewActorId, "tab-click");
          } else {
            this.activateTab(source.viewActorId);
          }
        }
      }
      const dragResult = this.#tabDragSink?.endTabDrag() ?? null;
      if (!event.wasClick && dragResult?.preview.kind === "merge-tabs") {
        this.#frameIntentSink?.requestCommitDock?.({
          kind: "merge-tabs",
          source: dragResult.source,
          targetFrameId: dragResult.preview.targetFrameId,
          targetTabsetId: dragResult.preview.targetTabsetId,
          reason: "dock-drop"
        });
      } else if (!event.wasClick && dragResult?.preview.kind === "split") {
        this.#frameIntentSink?.requestCommitDock?.({
          kind: "split-tab",
          source: dragResult.source,
          targetFrameId: dragResult.preview.targetFrameId,
          targetTabsetId: dragResult.preview.targetTabsetId,
          placement: dragResult.preview.placement,
          reason: "dock-drop"
        });
      } else if (!event.wasClick && dragResult?.preview.kind === "floating") {
        this.#frameIntentSink?.requestCommitDock?.({
          kind: "float-tab",
          source: dragResult.source,
          bounds: dragResult.preview.rect,
          reason: "dock-drop"
        });
      }
      return;
    }
    if (event.hit.partId === "close" && event.wasClick) {
      if (this.#frameIntentSink) {
        this.#frameIntentSink.requestCloseFrame(this.#frameId, "close-button");
      } else {
        this.requestVisible(false, event.timeStamp);
      }
    }
  }

  onInputCancel(_event: ActorInputCancelEvent): void {
    this.#dragStartState = null;
    this.#splitResizeStart = null;
    if (_event.hit.partId === "window-tab") {
      this.#tabDragSink?.cancelTabDrag();
    }
  }

  dispose(): void {
    this.enabled = false;
    for (const attachment of [...this.#contentAttachments]) {
      attachment.dispose();
    }
    this.#rootElement.remove();
  }

  private applyLayout(): void {
    this.#rootElement.hidden = !this.state.visible;
    this.#rootElement.className = joinClassNames(
      this.#rootClassName,
      this.#presentation === "fullscreen" ? "floating-gizmo-window--fullscreen" : undefined
    );
    if (this.#presentation === "fullscreen") {
      const parentRect = resolveParentRect(this.#parentElement, this.state);
      this.#rootElement.style.left = `${parentRect.left}px`;
      this.#rootElement.style.top = `${parentRect.top}px`;
      this.#rootElement.style.width = `${parentRect.width}px`;
      this.#rootElement.style.height = `${parentRect.height}px`;
    } else {
      this.#rootElement.style.left = `${this.state.position.x}px`;
      this.#rootElement.style.top = `${this.state.position.y}px`;
      this.#rootElement.style.width = `${this.state.size.x}px`;
      this.#rootElement.style.height = `${this.state.size.y}px`;
    }
    this.applyEffectivePriority();
  }

  private submitPositionSet(event: ActorInputMoveEvent, position: Vec2): void {
    if (this.#stateBinding.requestPosition(this.state, position, event.timeStamp)) {
      this.applyLayout();
    }
  }

  private submitSizeSet(event: ActorInputMoveEvent, size: Vec2): void {
    if (this.#stateBinding.requestSize(this.state, size, event.timeStamp)) {
      this.applyLayout();
    }
  }

  private createHit(partId: FloatingWindowPartId, priority: number, data?: unknown): ActorInputHit {
    return {
      componentId: this.id,
      partId,
      kind: "chrome",
      region: "window-frame",
      scopeRoutePriority: actorInputScopeRoutePriority.windowChrome,
      localRoutePriority: 3000,
      hitPriority: priority,
      path: [{
        componentId: this.id,
        role: "surface",
        partId
      }],
      data
    };
  }

  private createContentHit(): ActorInputHit {
    return {
      componentId: this.id,
      partId: "window-content",
      kind: "content",
      region: "window-content",
      scopeRoutePriority: actorInputScopeRoutePriority.windowContent,
      localRoutePriority: 100,
      hitPriority: 1,
      path: [{
        componentId: this.id,
        role: "surface",
        partId: "window-content"
      }]
    };
  }

  private applyEffectivePriority(): void {
    this.#rootElement.style.zIndex = String(this.#effectivePriority);
  }

  private findTabAtPoint(point: ScreenPoint): WindowFrameTab | null {
    for (const tab of this.#tabs) {
      const element = this.#tabElementsByViewActorId.get(tab.viewActorId);
      if (element && isPointInsideRect(point, element.getBoundingClientRect())) {
        return tab;
      }
    }
    return null;
  }

  private hasInteractableContent(): boolean {
    if (this.#contentAttachments.size === 0) return true;
    for (const attachment of this.#contentAttachments) {
      if (this.isContentInteractable(attachment.element)) return true;
    }
    return false;
  }

  private renderFrame(): void {
    for (const element of this.#tabElementsByViewActorId.values()) {
      element.remove();
    }
    this.#tabElementsByViewActorId.clear();
    this.#tabsetTargetsById.clear();
    this.#splitElementsById.clear();
    this.#splitterElementsBySplitId.clear();
    removeElementChildren(this.#titlebar);
    removeElementChildren(this.#contentSlot);
    if (this.#frameRoot.kind === "tabset") {
      this.renderTabsetTabs(this.#frameRoot, this.#titlebar);
      this.#titlebar.append(this.#closeButton);
      this.#tabsetTargetsById.set(this.#frameRoot.id, {
        tabbar: this.#titlebar,
        content: this.#contentSlot
      });
    } else {
      this.#titlebar.append(this.#closeButton);
      this.#contentSlot.append(this.renderSplitNode(this.#frameRoot));
    }
    this.placeContentAttachments();
  }

  private renderSplitNode(node: WindowFrameDockTreeNode): HTMLDivElement {
    if (node.kind === "tabset") {
      const pane = this.#documentRef.createElement("div");
      pane.className = "floating-gizmo-window__pane";
      const tabbar = this.#documentRef.createElement("div");
      tabbar.className = "floating-gizmo-window__pane-tabs";
      const content = this.#documentRef.createElement("div");
      content.className = "floating-gizmo-window__pane-content";
      this.renderTabsetTabs(node, tabbar);
      pane.append(tabbar, content);
      this.#tabsetTargetsById.set(node.id, { tabbar, content });
      return pane;
    }

    const split = this.#documentRef.createElement("div");
    split.className = joinClassNames(
      "floating-gizmo-window__split",
      `floating-gizmo-window__split--${node.direction}`
    );
    this.#splitElementsById.set(node.id, split);
    const first = this.renderSplitNode(node.first);
    const second = this.renderSplitNode(node.second);
    const splitter = this.#documentRef.createElement("div");
    splitter.className = joinClassNames(
      "floating-gizmo-window__splitter",
      `floating-gizmo-window__splitter--${node.direction}`
    );
    first.style.flex = `${node.ratio} 1 0`;
    second.style.flex = `${1 - node.ratio} 1 0`;
    this.#splitterElementsBySplitId.set(node.id, splitter);
    split.append(first, splitter, second);
    return split;
  }

  private renderTabsetTabs(node: WindowFrameDockTreeTabsetNode, target: HTMLDivElement): void {
    for (const tab of this.#tabs) {
      if (!node.tabs.includes(tab.viewActorId)) continue;
      const element = this.#documentRef.createElement("div");
      element.className = joinClassNames(
        "floating-gizmo-window__title",
        "floating-gizmo-window__tab",
        tab.viewActorId === node.activeViewActorId ? "is-active" : undefined
      );
      element.textContent = tab.title;
      this.#tabElementsByViewActorId.set(tab.viewActorId, element);
      target.append(element);
    }
  }

  private applyActiveContentState(): void {
    for (const [viewActorId, attachment] of this.#contentAttachmentsByViewActorId) {
      const active = this.isViewActorIdActiveInItsTabset(viewActorId);
      attachment.setInteractable(active);
      attachment.element.hidden = !active;
    }
  }

  private appendContentElement(viewActorId: string | null, element: HTMLElement): void {
    if (!viewActorId) {
      this.#contentSlot.append(element);
      return;
    }
    const tabset = findWindowFrameDockTreeTabsetContaining(this.#frameRoot, viewActorId);
    const target = tabset ? this.#tabsetTargetsById.get(tabset.id) : null;
    (target?.content ?? this.#contentSlot).append(element);
  }

  private placeContentAttachments(): void {
    for (const attachment of this.#contentAttachments) {
      const viewActorId = this.#contentViewActorIdsByAttachment.get(attachment) ?? null;
      this.appendContentElement(viewActorId, attachment.element);
    }
  }

  private isViewActorIdActiveInItsTabset(viewActorId: string): boolean {
    const tabset = findWindowFrameDockTreeTabsetContaining(this.#frameRoot, viewActorId);
    return tabset ? tabset.activeViewActorId === viewActorId : this.#activeViewActorId === viewActorId;
  }

  private findSplitterAtPoint(point: ScreenPoint): FloatingWindowSplitterHitData | null {
    for (const [splitId, element] of this.#splitterElementsBySplitId) {
      if (!isPointInsideRect(point, element.getBoundingClientRect())) continue;
      const split = findWindowFrameDockTreeSplitById(this.#frameRoot, splitId);
      if (!split) continue;
      return {
        splitId,
        direction: split.direction
      };
    }
    return null;
  }

  private updateSplitRatioFromDrag(event: ActorInputMoveEvent): void {
    const start = this.#splitResizeStart;
    if (!start) return;
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
      FLOATING_WINDOW_SPLIT_MIN_PANE_SIZE
    );
    this.#frameRoot = updateWindowFrameDockTreeSplitRatio(this.#frameRoot, start.splitId, ratio);
    this.renderFrame();
    this.applyActiveContentState();
  }
}

function resolveDocument(options: FloatingWindowComponentOptions): Pick<Document, "createElement"> {
  if (options.document) return options.document;
  if (options.parent.ownerDocument) return options.parent.ownerDocument;
  if (typeof document !== "undefined") return document;
  throw new Error("FloatingWindowComponent requires a document.");
}

function createFloatingWindowStateBinding(
  options: FloatingWindowComponentOptions,
  services: FloatingWindowComponentServices,
  componentId: string
): FloatingWindowStateBinding {
  const stateBinding = options.stateBinding ?? (
    options.paths
      ? { kind: "persistent" as const, paths: options.paths }
      : null
  );
  if (!stateBinding) {
    throw new Error("FloatingWindowComponent requires persistent paths or a runtime state binding.");
  }
  if (stateBinding.kind === "runtime") {
    return createRuntimeFloatingWindowStateBinding();
  }
  return createPersistentFloatingWindowStateBinding(stateBinding.paths, services.commandSink, componentId);
}

function createPersistentFloatingWindowStateBinding(
  paths: FloatingWindowParameterPaths,
  commandSink: SceneCommandSink | undefined,
  componentId: string
): FloatingWindowStateBinding {
  return {
    kind: "persistent",
    paths,
    visiblePath: paths.visible,
    requestPosition(_state, position, timeStamp) {
      commandSink?.submit({
        source: { id: componentId, kind: "gizmo" },
        target: paths.position,
        operation: "set",
        value: position,
        timeStamp
      });
      return false;
    },
    requestSize(_state, size, timeStamp) {
      commandSink?.submit({
        source: { id: componentId, kind: "gizmo" },
        target: paths.size,
        operation: "set",
        value: size,
        timeStamp
      });
      return false;
    },
    requestVisible(_state, visible, timeStamp) {
      commandSink?.submit({
        source: { id: componentId, kind: "gizmo" },
        target: paths.visible,
        operation: "set",
        value: visible,
        timeStamp
      });
      return false;
    },
    applySceneStateChanged(state, event) {
      let changed = false;
      for (const change of event.changes) {
        if (change.path === paths.position) {
          state.position = cloneVec2(change.nextValue as Vec2);
          changed = true;
        } else if (change.path === paths.size) {
          state.size = cloneVec2(change.nextValue as Vec2);
          changed = true;
        } else if (change.path === paths.visible) {
          state.visible = change.nextValue as boolean;
          changed = true;
        }
      }
      return changed;
    }
  };
}

function createRuntimeFloatingWindowStateBinding(): FloatingWindowStateBinding {
  return {
    kind: "runtime",
    paths: null,
    visiblePath: null,
    requestPosition(state, position) {
      state.position = cloneVec2(position);
      return true;
    },
    requestSize(state, size) {
      state.size = cloneVec2(size);
      return true;
    },
    requestVisible(state, visible) {
      state.visible = visible;
      return true;
    },
    applySceneStateChanged() {
      return false;
    }
  };
}

function removeElementChildren(element: HTMLElement): void {
  const childList = element.children;
  while (childList.length > 0) {
    childList[0]?.remove();
  }
}

function readWindowContentViewActorId(
  requestOrElement: HTMLElement | WindowContentAttachmentRequest
): string | null {
  if (
    typeof requestOrElement === "object" &&
    requestOrElement !== null &&
    "element" in requestOrElement &&
    typeof requestOrElement.viewActorId === "string"
  ) {
    return requestOrElement.viewActorId;
  }
  return null;
}

function resolveParentRect(parent: HTMLElement, fallbackState: FloatingWindowState): DOMRectReadOnly {
  const rect = parent.getBoundingClientRect();
  if (rect.width > 0 && rect.height > 0) return rect;
  const viewportWidth = typeof window !== "undefined" ? window.innerWidth : fallbackState.size.x;
  const viewportHeight = typeof window !== "undefined" ? window.innerHeight : fallbackState.size.y;
  return {
    x: 0,
    y: 0,
    left: 0,
    top: 0,
    right: viewportWidth,
    bottom: viewportHeight,
    width: viewportWidth,
    height: viewportHeight,
    toJSON() {
      return this;
    }
  };
}

function createResizeHandle(
  documentRef: Pick<Document, "createElement">,
  classSuffix: ResizeHandleClass
): HTMLDivElement {
  const handle = documentRef.createElement("div");
  handle.className = `floating-gizmo-window__resize floating-gizmo-window__resize--${classSuffix}`;
  return handle;
}

function createMenuDescriptor(
  options: FloatingWindowComponentOptions,
  priority: number
): FloatingWindowMenuDescriptor {
  const menuOptions = options.windowMenu;
  return {
    include: menuOptions?.include ?? true,
    viewKey: menuOptions?.viewKey ?? null,
    label: menuOptions?.label ?? options.title,
    order: menuOptions?.order ?? priority,
    group: menuOptions?.group ?? null,
    activationMode: menuOptions?.activationMode ?? "visible"
  };
}

function joinClassNames(...classNames: Array<string | undefined>): string {
  return classNames.filter(Boolean).join(" ");
}

function createInitialTabs(options: FloatingWindowComponentOptions): WindowFrameTab[] {
  if (options.tabs && options.tabs.length > 0) {
    return options.tabs.map((tab) => ({ ...tab }));
  }
  return [{
    viewActorId: options.activeViewActorId ?? `${options.id}:view`,
    viewKey: options.activeViewKey ?? options.windowMenu?.viewKey ?? windowViewKey(options.id),
    title: options.title
  }];
}

function resolveInitialActiveViewActorId(
  tabs: readonly WindowFrameTab[],
  preferredViewActorId: string | undefined
): string | null {
  if (preferredViewActorId && tabs.some((tab) => tab.viewActorId === preferredViewActorId)) {
    return preferredViewActorId;
  }
  return tabs[0]?.viewActorId ?? null;
}

function readWindowTabDragSource(frameId: string, hit: ActorInputHit): WindowTabDragSource | null {
  const data = hit.data;
  if (typeof data !== "object" || data === null || !("tab" in data)) return null;
  const tab = (data as { tab?: Partial<WindowFrameTab> }).tab;
  if (
    !tab ||
    typeof tab.viewActorId !== "string" ||
    typeof tab.viewKey !== "string"
  ) {
    return null;
  }
  return {
    frameId,
    viewActorId: tab.viewActorId,
    viewKey: tab.viewKey
  };
}

function readFloatingWindowSplitterHitData(hit: ActorInputHit): FloatingWindowSplitterHitData | null {
  const data = hit.data;
  if (
    typeof data !== "object" ||
    data === null ||
    !("splitId" in data) ||
    !("direction" in data)
  ) {
    return null;
  }
  const splitId = (data as { splitId?: unknown }).splitId;
  const direction = (data as { direction?: unknown }).direction;
  if (
    typeof splitId !== "string" ||
    (direction !== "horizontal" && direction !== "vertical")
  ) {
    return null;
  }
  return { splitId, direction };
}

function withWindowContentViewActorId(
  requestOrElement: HTMLElement | WindowContentAttachmentRequest,
  viewActorId: string
): WindowContentAttachmentRequest {
  if (
    typeof requestOrElement === "object" &&
    requestOrElement !== null &&
    "element" in requestOrElement
  ) {
    return { ...requestOrElement, viewActorId };
  }
  return { element: requestOrElement, viewActorId };
}

function isPointInsideRect(point: ScreenPoint, rect: DOMRectReadOnly): boolean {
  return point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom;
}

function isResizePart(partId: FloatingWindowPartId): partId is Exclude<
  FloatingWindowPartId,
  "window-tab" | "splitter" | "titlebar-empty" | "close" | "window-content"
> {
  return partId.startsWith("resize-");
}

function clampSplitRatio(ratio: number, size: number, minPaneSize: number): number {
  if (size <= minPaneSize * 2) return 0.5;
  const minRatio = minPaneSize / size;
  const maxRatio = 1 - minRatio;
  return Math.min(maxRatio, Math.max(minRatio, ratio));
}

function getResizeState(
  partId: Exclude<FloatingWindowPartId, "window-tab" | "splitter" | "titlebar-empty" | "close" | "window-content">,
  start: FloatingWindowState,
  dx: number,
  dy: number,
  minSize: Vec2
): { position?: Vec2; size: Vec2 } {
  let x = start.position.x;
  let y = start.position.y;
  let width = start.size.x;
  let height = start.size.y;
  let updatesPosition = false;

  if (partId.includes("left")) {
    width = Math.max(minSize.x, start.size.x - dx);
    x = start.position.x + (start.size.x - width);
    updatesPosition = true;
  } else if (partId.includes("right")) {
    width = Math.max(minSize.x, start.size.x + dx);
  }

  if (partId.includes("top")) {
    height = Math.max(minSize.y, start.size.y - dy);
    y = start.position.y + (start.size.y - height);
    updatesPosition = true;
  } else if (partId.includes("bottom")) {
    height = Math.max(minSize.y, start.size.y + dy);
  }

  return {
    position: updatesPosition ? vec2(x, y) : undefined,
    size: vec2(width, height)
  };
}


