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
import type { WindowFramePort, WindowFrameTab } from "./window-frame-port";
import type { WindowViewKey } from "./window-view-key";
import { windowViewKey } from "./window-view-key";
import { rectFromDomRect } from "./window-dock-targets";

export const floatingWindowComponentType =
  "floating-window-component" as ComponentType<FloatingWindowComponent>;

export type FloatingWindowCloseMode = "hide";
export type FloatingWindowPresentation = "windowed" | "fullscreen";
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

export interface FloatingWindowComponentOptions {
  id: string;
  parent: HTMLElement;
  title: string;
  paths: FloatingWindowParameterPaths;
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

export class FloatingWindowComponent
  implements Component, FloatingWindowHost, WindowFramePort, ActorInputParticipant, StateObserverResponder {
  readonly type = floatingWindowComponentType;
  readonly actor: Actor;
  readonly state: FloatingWindowState;
  enabled = true;

  readonly #paths: FloatingWindowParameterPaths;
  readonly #menuDescriptor: FloatingWindowMenuDescriptor;
  readonly #commandSink?: SceneCommandSink;
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
  #dragStartState: FloatingWindowState | null = null;
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
    this.#paths = options.paths;
    this.#commandSink = services.commandSink;
    this.#basePriority = options.priority ?? DEFAULT_FLOATING_WINDOW_PRIORITY;
    this.#effectivePriority = this.#basePriority;
    this.#menuDescriptor = createMenuDescriptor(options, this.#basePriority);
    this.#minSize = cloneVec2(options.minSize ?? DEFAULT_FLOATING_WINDOW_MIN_SIZE);
    this.#parentElement = options.parent;
    this.#rootClassName = joinClassNames("floating-gizmo-window", options.className);
    this.#presentation = options.presentation ?? "windowed";
    this.state = cloneFloatingWindowState(options.initialState);
    this.#tabs = createInitialTabs(options);
    this.#activeViewActorId = resolveInitialActiveViewActorId(this.#tabs, options.activeViewActorId);

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
    this.renderTabs();

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

  get parameterPaths(): FloatingWindowParameterPaths {
    return this.#paths;
  }

  get visiblePath(): ParameterPath<boolean> {
    return this.#paths.visible;
  }

  get menuDescriptor(): FloatingWindowMenuDescriptor {
    return this.#menuDescriptor;
  }

  get presentation(): FloatingWindowPresentation {
    return this.#presentation;
  }

  get frameId(): string {
    return this.#frameId;
  }

  listTabs(): readonly WindowFrameTab[] {
    return this.#tabs.map((tab) => ({ ...tab }));
  }

  getActiveViewActorId(): string | null {
    return this.#activeViewActorId;
  }

  addTab(tab: WindowFrameTab, options: { readonly active?: boolean } = {}): void {
    const previousActiveViewActorId = this.#activeViewActorId;
    const existingIndex = this.#tabs.findIndex((candidate) => candidate.viewActorId === tab.viewActorId);
    if (existingIndex >= 0) {
      this.#tabs[existingIndex] = tab;
    } else {
      this.#tabs = [...this.#tabs, tab];
    }
    if (options.active || !this.#activeViewActorId) {
      this.#activeViewActorId = tab.viewActorId;
    }
    if (
      this.#presentation === "fullscreen" &&
      previousActiveViewActorId !== this.#activeViewActorId
    ) {
      this.setPresentation("windowed");
    }
    this.renderTabs();
    this.applyActiveContentState();
  }

  removeTab(viewActorId: string): void {
    const nextTabs = this.#tabs.filter((tab) => tab.viewActorId !== viewActorId);
    if (nextTabs.length === this.#tabs.length) return;
    this.#tabs = nextTabs;
    this.#tabElementsByViewActorId.get(viewActorId)?.remove();
    this.#tabElementsByViewActorId.delete(viewActorId);
    this.#contentAttachmentsByViewActorId.get(viewActorId)?.setInteractable(false);
    if (this.#activeViewActorId === viewActorId) {
      this.#activeViewActorId = this.#tabs[0]?.viewActorId ?? null;
    }
    this.renderTabs();
    this.applyActiveContentState();
  }

  activateTab(viewActorId: string): void {
    if (!this.hasTab(viewActorId) || this.#activeViewActorId === viewActorId) return;
    this.#activeViewActorId = viewActorId;
    if (this.#presentation === "fullscreen") {
      this.setPresentation("windowed");
    }
    this.renderTabs();
    this.applyActiveContentState();
  }

  hasTab(viewActorId: string): boolean {
    return this.#tabs.some((tab) => tab.viewActorId === viewActorId);
  }

  getContentHost(viewActorId: string): WindowContentHost {
    const existing = this.#contentHostsByViewActorId.get(viewActorId);
    if (existing) return existing;
    const host: WindowContentHost = {
      id: this.id,
      mountContent: (request) => this.mountContent(withWindowContentViewActorId(request, viewActorId)),
      isContentInteractable: (element) => (
        this.#activeViewActorId === viewActorId &&
        this.isContentInteractable(element)
      )
    };
    this.#contentHostsByViewActorId.set(viewActorId, host);
    return host;
  }

  getFloatingBounds() {
    return rectFromDomRect(this.getBounds());
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
    this.renderTabs();
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
      (element) => this.#contentSlot.append(element),
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
      if (viewActorId && viewActorId !== this.#activeViewActorId) return false;
      return attachment.interactable;
    }
    return false;
  }

  requestVisible(visible: boolean, timeStamp?: number): void {
    this.#commandSink?.submit({
      source: { id: this.id, kind: "gizmo" },
      target: this.#paths.visible,
      operation: "set",
      value: visible,
      timeStamp
    });
  }

  onSceneStateChanged(event: SceneStateChangedEvent): void {
    let changed = false;
    for (const change of event.changes) {
      if (change.path === this.#paths.position) {
        this.state.position = cloneVec2(change.nextValue as Vec2);
        changed = true;
      } else if (change.path === this.#paths.size) {
        this.state.size = cloneVec2(change.nextValue as Vec2);
        changed = true;
      } else if (change.path === this.#paths.visible) {
        this.state.visible = change.nextValue as boolean;
        changed = true;
      }
    }
    if (changed) {
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
    if (_event.hit.partId === "window-tab") {
      const source = readWindowTabDragSource(this.#frameId, _event.hit);
      if (source) {
        this.#tabDragSink?.beginTabDrag(source, _event.point);
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
    this.#commandSink?.submit({
      source: { id: this.id, kind: "gizmo" },
      target: this.#paths.position,
      operation: "set",
      value: position,
      timeStamp: event.timeStamp
    });
  }

  private submitSizeSet(event: ActorInputMoveEvent, size: Vec2): void {
    this.#commandSink?.submit({
      source: { id: this.id, kind: "gizmo" },
      target: this.#paths.size,
      operation: "set",
      value: size,
      timeStamp: event.timeStamp
    });
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

  private renderTabs(): void {
    for (const element of this.#tabElementsByViewActorId.values()) {
      element.remove();
    }
    this.#tabElementsByViewActorId.clear();
    this.#closeButton.remove();
    for (const tab of this.#tabs) {
      const element = this.#documentRef.createElement("div");
      element.className = joinClassNames(
        "floating-gizmo-window__title",
        "floating-gizmo-window__tab",
        tab.viewActorId === this.#activeViewActorId ? "is-active" : undefined
      );
      element.textContent = tab.title;
      this.#tabElementsByViewActorId.set(tab.viewActorId, element);
      this.#titlebar.append(element);
    }
    this.#titlebar.append(this.#closeButton);
  }

  private applyActiveContentState(): void {
    for (const [viewActorId, attachment] of this.#contentAttachmentsByViewActorId) {
      const active = viewActorId === this.#activeViewActorId;
      attachment.setInteractable(active);
      attachment.element.hidden = !active;
    }
  }
}

function resolveDocument(options: FloatingWindowComponentOptions): Pick<Document, "createElement"> {
  if (options.document) return options.document;
  if (options.parent.ownerDocument) return options.parent.ownerDocument;
  if (typeof document !== "undefined") return document;
  throw new Error("FloatingWindowComponent requires a document.");
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
  "window-tab" | "titlebar-empty" | "close" | "window-content"
> {
  return partId.startsWith("resize-");
}

function getResizeState(
  partId: Exclude<FloatingWindowPartId, "window-tab" | "titlebar-empty" | "close" | "window-content">,
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
