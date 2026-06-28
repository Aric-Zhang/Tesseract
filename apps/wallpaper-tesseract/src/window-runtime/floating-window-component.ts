import type {
  ScreenPoint
} from "gizmo-core";
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
import type { StateObserverResponder } from "editor";
import type { WindowTabDragSink } from "./window-dock-preview-component";
import type { WindowFrameIntentSink } from "./window-frame-lifecycle";
import {
  readWindowTabDragSource
} from "ui-framework";
import type {
  RegisteredWindowFramePort,
  WindowFramePortRegistry
} from "./window-frame-port-registry";
import {
  cloneFloatingWindowState,
  DEFAULT_FLOATING_WINDOW_MIN_SIZE,
  type FloatingWindowParameterPaths,
  type FloatingWindowState
} from "ui-framework";
import { cloneUiVec2, uiVec2, type UiVec2 } from "ui-framework";
import type { UiLayoutCommandSink, UiLayoutPath, UiLayoutStateChangedEvent } from "ui-framework";
import type {
  WindowFramePort,
  WindowFramePresentation,
  WindowFrameSuppressionReason
} from "./window-frame-port";
import type { WindowViewKey } from "ui-framework";
import {
  WINDOW_FRAME_TAB_ACTION_PART_ID,
  WINDOW_FRAME_TAB_PART_ID
} from "ui-framework";
import { handleWindowFrameTabInputEnd } from "./window-frame-tab-input";
import { rectFromDomRect } from "ui-framework";
import type {
  WindowFrameSurfaceComponent,
  WindowFrameSurfaceHost,
  WindowFrameSurfaceSnapshot,
  WindowWorkspaceGraphContentActiveState,
  WindowWorkspaceGraphContentPlacement,
  WindowWorkspaceSurfaceGeometryProjection,
  WindowRegisteredContent
} from "ui-framework";

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
  frameIntentSink?: WindowFrameIntentSink;
  tabDragSink?: WindowTabDragSink;
  windowMenu?: FloatingWindowMenuOptions;
  framePortRegistry?: WindowFramePortRegistry;
  document?: Pick<Document, "createElement">;
}

export interface FloatingWindowComponentServices {
  commandSink?: UiLayoutCommandSink;
  surface: WindowFrameSurfaceComponent;
}

export const DEFAULT_FLOATING_WINDOW_PRIORITY = 1000;

type FloatingWindowPartId =
  | typeof WINDOW_FRAME_TAB_PART_ID
  | typeof WINDOW_FRAME_TAB_ACTION_PART_ID
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

interface FloatingWindowStateBinding {
  readonly kind: "persistent" | "runtime";
  readonly paths: FloatingWindowParameterPaths | null;
  readonly visiblePath: UiLayoutPath<boolean> | null;
  requestPosition(state: FloatingWindowState, position: UiVec2, timeStamp?: number): boolean;
  requestSize(state: FloatingWindowState, size: UiVec2, timeStamp?: number): boolean;
  requestVisible(state: FloatingWindowState, visible: boolean, timeStamp?: number): boolean;
  applyStateChanged(state: FloatingWindowState, event: UiLayoutStateChangedEvent): boolean;
}

const FLOATING_WINDOW_SPLIT_MIN_PANE_SIZE = 80;

export class FloatingWindowComponent
  implements Component, WindowFramePort, ActorInputParticipant, StateObserverResponder {
  readonly type = floatingWindowComponentType;
  readonly actor: Actor;
  readonly state: FloatingWindowState;
  enabled = true;

  readonly #stateBinding: FloatingWindowStateBinding;
  readonly #menuDescriptor: FloatingWindowMenuDescriptor;
  readonly #basePriority: number;
  readonly #minSize: UiVec2;
  readonly #rootClassName: string;
  readonly #rootElement: HTMLDivElement;
  readonly #titlebar: HTMLDivElement;
  readonly #closeButton: HTMLButtonElement;
  readonly #resizeHandles: Record<ResizeHandleClass, HTMLDivElement>;
  readonly #contentSlot: HTMLDivElement;
  readonly #frameId: string;
  readonly #frameIntentSink?: WindowFrameIntentSink;
  readonly #tabDragSink?: WindowTabDragSink;
  readonly #framePortRegistration?: RegisteredWindowFramePort;
  readonly #surface: WindowFrameSurfaceComponent;
  readonly #surfaceHost: WindowFrameSurfaceHost;
  #dragStartState: FloatingWindowState | null = null;
  #draggingTab = false;
  #presentation: FloatingWindowPresentation;
  readonly #presentationSuppressionReasons = new Set<WindowFrameSuppressionReason>();
  #effectivePriority: number;

  constructor(
    actor: Actor,
    options: FloatingWindowComponentOptions,
    services: FloatingWindowComponentServices
  ) {
    this.actor = actor;
    this.id = options.id;
    this.#frameId = options.frameId ?? actor.id;
    this.#frameIntentSink = options.frameIntentSink;
    this.#tabDragSink = options.tabDragSink;
    this.#surface = services.surface;
    this.#basePriority = options.priority ?? DEFAULT_FLOATING_WINDOW_PRIORITY;
    this.#effectivePriority = this.#basePriority;
    this.#menuDescriptor = createMenuDescriptor(options, this.#basePriority);
    this.#minSize = cloneUiVec2(options.minSize ?? DEFAULT_FLOATING_WINDOW_MIN_SIZE);
    this.#rootClassName = joinClassNames("floating-gizmo-window", options.className);
    this.#presentation = options.presentation ?? "windowed";
    this.state = cloneFloatingWindowState(options.initialState);
    this.#stateBinding = createFloatingWindowStateBinding(options, services, this.id);
    const documentRef = resolveDocument(options);
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
    this.#surfaceHost = {
      id: this.id,
      document: documentRef,
      primaryTabbar: this.#titlebar,
      primaryContent: this.#contentSlot,
      splitMinPaneSize: FLOATING_WINDOW_SPLIT_MIN_PANE_SIZE,
      classes: {
        pane: "floating-gizmo-window__pane",
        paneTabs: "floating-gizmo-window__pane-tabs",
        paneContent: "floating-gizmo-window__pane-content",
        split: "floating-gizmo-window__split",
        splitHorizontal: "floating-gizmo-window__split--horizontal",
        splitVertical: "floating-gizmo-window__split--vertical",
        splitter: "floating-gizmo-window__splitter",
        splitterHorizontal: "floating-gizmo-window__splitter--horizontal",
        splitterVertical: "floating-gizmo-window__splitter--vertical",
        tab: "floating-gizmo-window__title floating-gizmo-window__tab",
        tabClose: "floating-gizmo-window__tab-close"
      },
      getEffectiveVisible: () => this.effectiveVisible,
      getInputStackPriority: () => this.inputStackPriority,
      afterRender: () => {
        this.#titlebar.append(this.#closeButton);
      }
    };
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

    this.#surface.attachHost(this.#surfaceHost);
    this.applyLayout();
    options.parent.append(this.#rootElement);
    this.#framePortRegistration = options.framePortRegistry?.register({
      frameActor: actor,
      framePort: this,
      getBaseStackPriority: () => this.basePriority,
      getStackPriority: () => this.inputStackPriority,
      setStackPriority: (priority) => this.setEffectivePriority(priority),
      canTarget: () => this.effectiveVisible && this.enabled
    });
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

  get visiblePath(): UiLayoutPath<boolean> | null {
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

  get presentationSuppressed(): boolean {
    return this.#presentationSuppressionReasons.size > 0;
  }

  get effectiveVisible(): boolean {
    return this.state.visible && !this.presentationSuppressed;
  }

  get persistable(): boolean {
    return this.#menuDescriptor.include;
  }

  get frameId(): string {
    return this.#frameId;
  }

  renderFrameSurface(snapshot: WindowFrameSurfaceSnapshot): void {
    this.#surface.renderFrameSurface(snapshot);
  }

  measureFrameSurfaceGeometry(snapshot: WindowFrameSurfaceSnapshot): WindowWorkspaceSurfaceGeometryProjection {
    return this.#surface.measureFrameSurfaceGeometry(snapshot);
  }

  placeContent(placement: WindowWorkspaceGraphContentPlacement<WindowRegisteredContent>): void {
    this.#surface.placeContent(placement);
  }

  removeContent(contentId: Parameters<WindowFrameSurfaceComponent["removeContent"]>[0]): void {
    this.#surface.removeContent(contentId);
  }

  setContentActive(state: WindowWorkspaceGraphContentActiveState): void {
    this.#surface.setContentActive(state);
  }

  getFloatingBounds() {
    return rectFromDomRect(this.getBounds());
  }

  restoreFloatingState(state: FloatingWindowState): void {
    this.state.position = cloneUiVec2(state.position);
    this.state.size = cloneUiVec2(state.size);
    this.state.visible = state.visible;
    this.applyLayout();
  }

  setPresentation(presentation: FloatingWindowPresentation): void {
    if (this.#presentation === presentation) return;
    this.#presentation = presentation;
    this.#dragStartState = null;
    this.#draggingTab = false;
    this.applyLayout();
  }

  setPresentationSuppressed(reason: WindowFrameSuppressionReason, suppressed: boolean): void {
    const hadReason = this.#presentationSuppressionReasons.has(reason);
    if (suppressed === hadReason) return;
    if (suppressed) {
      this.#presentationSuppressionReasons.add(reason);
    } else {
      this.#presentationSuppressionReasons.delete(reason);
    }
    this.#dragStartState = null;
    this.#draggingTab = false;
    this.applyLayout();
    this.#surface.refreshActiveContentState();
  }

  getBounds(): DOMRectReadOnly {
    return this.#rootElement.getBoundingClientRect();
  }

  getTabBounds(): DOMRectReadOnly {
    return this.#surface.getActiveOrFirstTabBounds(this.#titlebar);
  }

  getContentBounds(): DOMRectReadOnly {
    return this.#contentSlot.getBoundingClientRect();
  }

  requestVisible(visible: boolean, timeStamp?: number): void {
    if (this.#stateBinding.requestVisible(this.state, visible, timeStamp)) {
      this.applyLayout();
    }
  }

  onStateChanged(event: UiLayoutStateChangedEvent): void {
    if (this.#stateBinding.applyStateChanged(this.state, event)) {
      this.applyLayout();
    }
  }

  hitTestInput(point: ScreenPoint): ActorInputHit | null {
    if (!this.effectiveVisible) return null;
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
    const surfaceHit = this.#surface.hitTest(point);
    if (surfaceHit?.part === "tab-action") {
      return this.createHit(WINDOW_FRAME_TAB_ACTION_PART_ID, 25, surfaceHit.data);
    }
    if (surfaceHit?.part === "tab") {
      return this.createHit(WINDOW_FRAME_TAB_PART_ID, 20, surfaceHit.data);
    }
    if (isPointInsideRect(point, this.#titlebar.getBoundingClientRect())) {
      return this.createHit("titlebar-empty", 20);
    }
    if (surfaceHit?.part === "splitter") {
      return this.createHit("splitter", 15, surfaceHit.data);
    }
    if (
      isPointInsideRect(point, this.#contentSlot.getBoundingClientRect()) &&
      surfaceHit?.part === "content"
    ) {
      return this.createContentHit();
    }
    return null;
  }

  onInputStart(_event: ActorInputStartEvent): void {
    this.#dragStartState = cloneFloatingWindowState(this.state);
    this.#draggingTab = false;
    this.#surface.endSplitResize();
    if (_event.hit.partId === WINDOW_FRAME_TAB_PART_ID) {
      const source = readWindowTabDragSource(this.#frameId, _event.hit);
      if (source) {
        this.#draggingTab = true;
        this.#tabDragSink?.beginTabDrag(source, _event.point);
      }
    } else if (_event.hit.partId === "splitter") {
      this.#surface.beginSplitResize(_event.hit.data);
    }
  }

  onInputMove(event: ActorInputMoveEvent): void {
    if (!event.isDragging) return;
    if (this.#draggingTab) {
      this.#tabDragSink?.moveTabDrag(event.point);
      return;
    }
    const dragStartState = this.#dragStartState ?? this.state;
    const partId = event.hit.partId as FloatingWindowPartId;
    if (partId === "titlebar-empty") {
      this.submitPositionSet(event, uiVec2(
        dragStartState.position.x + event.totalDelta.dx,
        dragStartState.position.y + event.totalDelta.dy
      ));
    } else if (partId === WINDOW_FRAME_TAB_PART_ID) {
      this.#tabDragSink?.moveTabDrag(event.point);
    } else if (partId === "splitter") {
      const resize = this.#surface.updateSplitRatioFromDrag(event);
      if (resize) {
        this.#frameIntentSink?.requestResizeFrameSplit?.(
          this.#frameId,
          resize.splitId,
          resize.ratio,
          "dock-drop"
        );
      }
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
    this.#surface.endSplitResize();
    if (event.hit.partId === WINDOW_FRAME_TAB_ACTION_PART_ID) {
      const tabResult = handleWindowFrameTabInputEnd({
        event,
        frameId: this.#frameId,
        frameIntentSink: this.#frameIntentSink,
        tabDragSink: this.#tabDragSink,
        draggingTab: this.#draggingTab
      });
      this.#draggingTab = tabResult.draggingTab;
      return;
    }
    const tabResult = handleWindowFrameTabInputEnd({
      event,
      frameId: this.#frameId,
      frameIntentSink: this.#frameIntentSink,
      tabDragSink: this.#tabDragSink,
      draggingTab: this.#draggingTab
    });
    this.#draggingTab = tabResult.draggingTab;
    if (tabResult.handled) return;
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
    this.#surface.endSplitResize();
    if (this.#draggingTab) {
      this.#tabDragSink?.cancelTabDrag();
    }
    this.#draggingTab = false;
  }

  dispose(): void {
    this.enabled = false;
    this.#framePortRegistration?.dispose();
    this.#surface.detachHost(this.#surfaceHost);
    this.#rootElement.remove();
  }

  private applyLayout(): void {
    this.#rootElement.hidden = !this.effectiveVisible;
    this.#rootElement.className = joinClassNames(
      this.#rootClassName,
      this.#presentation === "fullscreen" ? "floating-gizmo-window--fullscreen" : undefined
    );
    if (this.#presentation === "fullscreen") {
      this.#rootElement.style.left = "";
      this.#rootElement.style.top = "";
      this.#rootElement.style.right = "";
      this.#rootElement.style.bottom = "";
      this.#rootElement.style.width = "";
      this.#rootElement.style.height = "";
    } else {
      this.#rootElement.style.right = "";
      this.#rootElement.style.bottom = "";
      this.#rootElement.style.left = `${this.state.position.x}px`;
      this.#rootElement.style.top = `${this.state.position.y}px`;
      this.#rootElement.style.width = `${this.state.size.x}px`;
      this.#rootElement.style.height = `${this.state.size.y}px`;
    }
    this.applyEffectivePriority();
  }

  private submitPositionSet(event: ActorInputMoveEvent, position: UiVec2): void {
    if (this.#stateBinding.requestPosition(this.state, position, event.timeStamp)) {
      this.applyLayout();
    }
  }

  private submitSizeSet(event: ActorInputMoveEvent, size: UiVec2): void {
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
  commandSink: UiLayoutCommandSink | undefined,
  componentId: string
): FloatingWindowStateBinding {
  return {
    kind: "persistent",
    paths,
    visiblePath: paths.visible,
    requestPosition(_state, position, timeStamp) {
      commandSink?.submit({
        source: { id: componentId, kind: "pointer" },
        target: paths.position,
        operation: "set",
        value: position,
        timeStamp
      });
      return false;
    },
    requestSize(_state, size, timeStamp) {
      commandSink?.submit({
        source: { id: componentId, kind: "pointer" },
        target: paths.size,
        operation: "set",
        value: size,
        timeStamp
      });
      return false;
    },
    requestVisible(_state, visible, timeStamp) {
      commandSink?.submit({
        source: { id: componentId, kind: "pointer" },
        target: paths.visible,
        operation: "set",
        value: visible,
        timeStamp
      });
      return false;
    },
    applyStateChanged(state, event) {
      let changed = false;
      for (const change of event.changes) {
        if (change.path === paths.position) {
          state.position = cloneUiVec2(change.nextValue as UiVec2);
          changed = true;
        } else if (change.path === paths.size) {
          state.size = cloneUiVec2(change.nextValue as UiVec2);
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
      state.position = cloneUiVec2(position);
      return true;
    },
    requestSize(state, size) {
      state.size = cloneUiVec2(size);
      return true;
    },
    requestVisible(state, visible) {
      state.visible = visible;
      return true;
    },
    applyStateChanged() {
      return false;
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

function isPointInsideRect(point: ScreenPoint, rect: DOMRectReadOnly): boolean {
  return point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom;
}

function isResizePart(partId: FloatingWindowPartId): partId is Exclude<
  FloatingWindowPartId,
  typeof WINDOW_FRAME_TAB_PART_ID |
  typeof WINDOW_FRAME_TAB_ACTION_PART_ID |
  "splitter" |
  "titlebar-empty" |
  "close" |
  "window-content"
> {
  return partId.startsWith("resize-");
}

function getResizeState(
  partId: Exclude<
    FloatingWindowPartId,
    typeof WINDOW_FRAME_TAB_PART_ID |
    typeof WINDOW_FRAME_TAB_ACTION_PART_ID |
    "splitter" |
    "titlebar-empty" |
    "close" |
    "window-content"
  >,
  start: FloatingWindowState,
  dx: number,
  dy: number,
  minSize: UiVec2
): { position?: UiVec2; size: UiVec2 } {
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
    position: updatesPosition ? uiVec2(x, y) : undefined,
    size: uiVec2(width, height)
  };
}


