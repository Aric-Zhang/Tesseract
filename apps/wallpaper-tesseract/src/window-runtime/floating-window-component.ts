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
  type WindowContentAttachmentRequest
} from "./floating-window-host";
import type { WindowFrameIntentSink } from "./window-frame-lifecycle";
import {
  cloneFloatingWindowState,
  DEFAULT_FLOATING_WINDOW_MIN_SIZE,
  type FloatingWindowParameterPaths,
  type FloatingWindowState
} from "./floating-window-state";
import type { WindowViewKey } from "./window-view-key";

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
  implements Component, FloatingWindowHost, ActorInputParticipant, StateObserverResponder {
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
  readonly #rootClassName: string;
  readonly #rootElement: HTMLDivElement;
  readonly #titlebar: HTMLDivElement;
  readonly #closeButton: HTMLButtonElement;
  readonly #resizeHandles: Record<ResizeHandleClass, HTMLDivElement>;
  readonly #tabElement: HTMLDivElement;
  readonly #contentSlot: HTMLDivElement;
  readonly #frameId: string;
  readonly #tabDragSource: WindowTabDragSource | null;
  readonly #frameIntentSink?: WindowFrameIntentSink;
  readonly #tabDragSink?: WindowTabDragSink;
  #contentAttachment: FloatingWindowContentAttachment | null = null;
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
    this.#tabDragSource = createTabDragSource(this.#frameId, options);
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

    const documentRef = resolveDocument(options);
    this.#rootElement = documentRef.createElement("div");
    this.#rootElement.className = this.#rootClassName;

    this.#titlebar = documentRef.createElement("div");
    this.#titlebar.className = "floating-gizmo-window__titlebar";

    this.#tabElement = documentRef.createElement("div");
    this.#tabElement.className = "floating-gizmo-window__title floating-gizmo-window__tab";
    this.#tabElement.textContent = options.title;

    this.#closeButton = documentRef.createElement("button");
    this.#closeButton.className = "floating-gizmo-window__close";
    this.#closeButton.type = "button";
    this.#closeButton.tabIndex = -1;
    this.#closeButton.ariaLabel = `Close ${options.title}`;
    this.#closeButton.textContent = "x";
    this.#titlebar.append(this.#tabElement, this.#closeButton);

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

  setPresentation(presentation: FloatingWindowPresentation): void {
    if (this.#presentation === presentation) return;
    this.#presentation = presentation;
    this.#dragStartState = null;
    this.applyLayout();
  }

  setTitle(title: string): void {
    this.#tabElement.textContent = title;
  }

  getBounds(): DOMRectReadOnly {
    return this.#rootElement.getBoundingClientRect();
  }

  getTabBounds(): DOMRectReadOnly {
    return this.#tabElement.getBoundingClientRect();
  }

  getContentBounds(): DOMRectReadOnly {
    return this.#contentSlot.getBoundingClientRect();
  }

  mountContent(requestOrElement: HTMLElement | WindowContentAttachmentRequest): FloatingWindowContentAttachment {
    if (this.#contentAttachment) {
      throw new Error(`FloatingWindowComponent already has mounted content: ${this.id}`);
    }
    const attachment = createWindowContentAttachment(
      this,
      requestOrElement,
      (element) => this.#contentSlot.append(element),
      (disposedAttachment) => {
        disposedAttachment.element.remove();
        if (this.#contentAttachment === disposedAttachment) {
          this.#contentAttachment = null;
        }
      }
    );
    this.#contentAttachment = attachment;
    return attachment;
  }

  isContentInteractable(element: HTMLElement): boolean {
    return (
      this.#contentAttachment?.element === element &&
      this.#contentAttachment.interactable &&
      this.state.visible
    );
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
    if (isPointInsideRect(point, this.#tabElement.getBoundingClientRect())) {
      return this.createHit("window-tab", 20);
    }
    if (isPointInsideRect(point, this.#titlebar.getBoundingClientRect())) {
      return this.createHit("titlebar-empty", 20);
    }
    if (
      isPointInsideRect(point, this.#contentSlot.getBoundingClientRect()) &&
      (!this.#contentAttachment || this.#contentAttachment.interactable)
    ) {
      return this.createContentHit();
    }
    return null;
  }

  onInputStart(_event: ActorInputStartEvent): void {
    this.#dragStartState = cloneFloatingWindowState(this.state);
    if (_event.hit.partId === "window-tab") {
      if (this.#tabDragSource) {
        this.#tabDragSink?.beginTabDrag(this.#tabDragSource, _event.point);
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
      this.#tabDragSink?.endTabDrag();
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
    this.#contentAttachment?.dispose();
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

  private createHit(partId: FloatingWindowPartId, priority: number): ActorInputHit {
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
      }]
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
}

function resolveDocument(options: FloatingWindowComponentOptions): Pick<Document, "createElement"> {
  if (options.document) return options.document;
  if (options.parent.ownerDocument) return options.parent.ownerDocument;
  if (typeof document !== "undefined") return document;
  throw new Error("FloatingWindowComponent requires a document.");
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

function createTabDragSource(
  frameId: string,
  options: FloatingWindowComponentOptions
): WindowTabDragSource | null {
  const viewKey = options.activeViewKey ?? options.windowMenu?.viewKey ?? null;
  if (!viewKey || !options.activeViewActorId) return null;
  return {
    frameId,
    viewActorId: options.activeViewActorId,
    viewKey
  };
}

function joinClassNames(...classNames: Array<string | undefined>): string {
  return classNames.filter(Boolean).join(" ");
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
