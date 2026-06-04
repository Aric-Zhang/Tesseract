import type {
  GizmoController,
  GizmoCancelEvent,
  GizmoEndEvent,
  GizmoHit,
  GizmoMoveEvent,
  GizmoStartEvent,
  ScreenPoint
} from "gizmo-core";
import {
  cloneVec2,
  sceneParameterPaths,
  vec2,
  type RuntimeObject,
  type SceneCommandSink,
  type SceneFrame,
  type SceneStateChangedEvent,
  type SceneStateObserver,
  type Vec2
} from "../../scene-runtime";
import type { GizmoDebugLogEntry } from "gizmo-core";
import {
  DEBUG_WINDOW_MIN_HEIGHT,
  DEBUG_WINDOW_MIN_WIDTH,
  type DebugWindowState
} from "../debug-window-parameters";

type DebugWindowPartId =
  | "titlebar"
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

export interface DebugLogWindowOptions {
  parent: HTMLElement;
  commandSink: SceneCommandSink;
  initialState: DebugWindowState;
  maxLines?: number;
  title?: string;
}

export class DebugLogWindow implements RuntimeObject, GizmoController, SceneStateObserver {
  readonly id = "debug-log-window";
  readonly priority = 1000;
  enabled = true;
  readonly element: HTMLDivElement;
  readonly content: HTMLPreElement;
  private readonly commandSink: SceneCommandSink;
  private readonly titlebar: HTMLDivElement;
  private readonly closeButton: HTMLButtonElement;
  private readonly resizeLeft: HTMLDivElement;
  private readonly resizeRight: HTMLDivElement;
  private readonly resizeTop: HTMLDivElement;
  private readonly resizeBottom: HTMLDivElement;
  private readonly resizeTopLeft: HTMLDivElement;
  private readonly resizeTopRight: HTMLDivElement;
  private readonly resizeBottomLeft: HTMLDivElement;
  private readonly resizeBottomRight: HTMLDivElement;
  private readonly lines: string[] = [];
  private readonly maxLines: number;
  private readonly state: DebugWindowState;
  private dragStartState: DebugWindowState | null = null;
  private logDirty = true;

  constructor(options: DebugLogWindowOptions) {
    this.commandSink = options.commandSink;
    this.maxLines = options.maxLines ?? 200;
    this.state = {
      position: cloneVec2(options.initialState.position),
      size: cloneVec2(options.initialState.size),
      visible: options.initialState.visible
    };

    this.element = document.createElement("div");
    this.element.className = "floating-gizmo-window debug-log-window";

    this.titlebar = document.createElement("div");
    this.titlebar.className = "floating-gizmo-window__titlebar";
    const title = document.createElement("div");
    title.className = "floating-gizmo-window__title";
    title.textContent = options.title ?? "Debug Log";

    this.closeButton = document.createElement("button");
    this.closeButton.className = "floating-gizmo-window__close";
    this.closeButton.type = "button";
    this.closeButton.tabIndex = -1;
    this.closeButton.ariaLabel = "Close Debug Log";
    this.closeButton.textContent = "x";
    this.titlebar.append(title, this.closeButton);

    this.content = document.createElement("pre");
    this.content.className = "debug-log-window__content";
    this.content.textContent = "Gizmo debug log enabled";

    this.resizeLeft = createResizeHandle("left");
    this.resizeRight = createResizeHandle("right");
    this.resizeTop = createResizeHandle("top");
    this.resizeBottom = createResizeHandle("bottom");
    this.resizeTopLeft = createResizeHandle("top-left");
    this.resizeTopRight = createResizeHandle("top-right");
    this.resizeBottomLeft = createResizeHandle("bottom-left");
    this.resizeBottomRight = createResizeHandle("bottom-right");

    this.element.append(
      this.titlebar,
      this.content,
      this.resizeLeft,
      this.resizeRight,
      this.resizeTop,
      this.resizeBottom,
      this.resizeTopLeft,
      this.resizeTopRight,
      this.resizeBottomLeft,
      this.resizeBottomRight
    );
    options.parent.append(this.element);
    this.applyState();
  }

  append(entry: GizmoDebugLogEntry): void {
    const time = entry.timeStamp === undefined ? "----" : entry.timeStamp.toFixed(0).padStart(5, " ");
    this.lines.push(`${time} ${entry.message}`);
    while (this.lines.length > this.maxLines) {
      this.lines.shift();
    }
    this.logDirty = true;
  }

  updateFrame(_frame: SceneFrame): void {
    if (!this.logDirty) return;
    this.logDirty = false;
    this.content.textContent = this.lines.length === 0 ? "Gizmo debug log enabled" : this.lines.join("\n");
  }

  onSceneStateChanged(event: SceneStateChangedEvent): void {
    let changed = false;
    for (const change of event.changes) {
      if (change.path === sceneParameterPaths.debugWindow.position) {
        this.state.position = cloneVec2(change.nextValue as Vec2);
        changed = true;
      } else if (change.path === sceneParameterPaths.debugWindow.size) {
        this.state.size = cloneVec2(change.nextValue as Vec2);
        changed = true;
      } else if (change.path === sceneParameterPaths.debugWindow.visible) {
        this.state.visible = change.nextValue as boolean;
        changed = true;
      }
    }
    if (changed) {
      this.applyState();
    }
  }

  hitTest(point: ScreenPoint): GizmoHit | null {
    if (!this.state.visible) return null;
    const rect = this.element.getBoundingClientRect();
    if (!isPointInsideRect(point, rect)) return null;
    if (isPointInsideRect(point, this.closeButton.getBoundingClientRect())) {
      return this.createHit("close", 50);
    }
    if (isPointInsideRect(point, this.resizeTopLeft.getBoundingClientRect())) {
      return this.createHit("resize-top-left", 40);
    }
    if (isPointInsideRect(point, this.resizeTopRight.getBoundingClientRect())) {
      return this.createHit("resize-top-right", 40);
    }
    if (isPointInsideRect(point, this.resizeBottomLeft.getBoundingClientRect())) {
      return this.createHit("resize-bottom-left", 40);
    }
    if (isPointInsideRect(point, this.resizeBottomRight.getBoundingClientRect())) {
      return this.createHit("resize-bottom-right", 40);
    }
    if (isPointInsideRect(point, this.resizeLeft.getBoundingClientRect())) {
      return this.createHit("resize-left", 30);
    }
    if (isPointInsideRect(point, this.resizeRight.getBoundingClientRect())) {
      return this.createHit("resize-right", 30);
    }
    if (isPointInsideRect(point, this.resizeTop.getBoundingClientRect())) {
      return this.createHit("resize-top", 30);
    }
    if (isPointInsideRect(point, this.resizeBottom.getBoundingClientRect())) {
      return this.createHit("resize-bottom", 30);
    }
    if (isPointInsideRect(point, this.titlebar.getBoundingClientRect())) {
      return this.createHit("titlebar", 20);
    }
    return null;
  }

  onGizmoStart(_event: GizmoStartEvent): void {
    this.dragStartState = {
      position: cloneVec2(this.state.position),
      size: cloneVec2(this.state.size),
      visible: this.state.visible
    };
  }

  onGizmoMove(event: GizmoMoveEvent): void {
    if (!event.isDragging) return;
    const dragStartState = this.dragStartState ?? this.state;
    const partId = event.hit.partId as DebugWindowPartId;
    if (partId === "titlebar") {
      this.submitPositionSet(event, vec2(
        dragStartState.position.x + event.totalDelta.dx,
        dragStartState.position.y + event.totalDelta.dy
      ));
    } else if (isResizePart(partId)) {
      const next = getResizeState(partId, dragStartState, event.totalDelta.dx, event.totalDelta.dy);
      if (next.position) {
        this.submitPositionSet(event, next.position);
      }
      this.submitSizeSet(event, next.size);
    }
  }

  onGizmoEnd(event: GizmoEndEvent): void {
    this.dragStartState = null;
    if (event.hit.partId !== "close" || !event.wasClick) return;
    this.commandSink.submit({
      source: { id: this.id, kind: "gizmo" },
      target: sceneParameterPaths.debugWindow.visible,
      operation: "set",
      value: false,
      timeStamp: event.timeStamp
    });
  }

  onGizmoCancel(_event: GizmoCancelEvent): void {
    this.dragStartState = null;
  }

  dispose(): void {
    this.enabled = false;
    this.element.remove();
  }

  private submitPositionSet(event: GizmoMoveEvent, position: Vec2): void {
    this.commandSink.submit({
      source: { id: this.id, kind: "gizmo" },
      target: sceneParameterPaths.debugWindow.position,
      operation: "set",
      value: position,
      timeStamp: event.timeStamp
    });
  }

  private submitSizeSet(event: GizmoMoveEvent, size: Vec2): void {
    this.commandSink.submit({
      source: { id: this.id, kind: "gizmo" },
      target: sceneParameterPaths.debugWindow.size,
      operation: "set",
      value: size,
      timeStamp: event.timeStamp
    });
  }

  private applyState(): void {
    this.element.hidden = !this.state.visible;
    this.element.style.left = `${this.state.position.x}px`;
    this.element.style.top = `${this.state.position.y}px`;
    this.element.style.width = `${this.state.size.x}px`;
    this.element.style.height = `${this.state.size.y}px`;
  }

  private createHit(partId: DebugWindowPartId, priority: number): GizmoHit {
    return {
      gizmoId: this.id,
      partId,
      kind: "custom",
      priority
    };
  }
}

function isPointInsideRect(point: ScreenPoint, rect: DOMRect): boolean {
  return point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom;
}

function createResizeHandle(classSuffix: ResizeHandleClass): HTMLDivElement {
  const handle = document.createElement("div");
  handle.className = `floating-gizmo-window__resize floating-gizmo-window__resize--${classSuffix}`;
  return handle;
}

function isResizePart(partId: DebugWindowPartId): partId is Exclude<DebugWindowPartId, "titlebar" | "close"> {
  return partId.startsWith("resize-");
}

function getResizeState(
  partId: Exclude<DebugWindowPartId, "titlebar" | "close">,
  start: DebugWindowState,
  dx: number,
  dy: number
): { position?: Vec2; size: Vec2 } {
  let x = start.position.x;
  let y = start.position.y;
  let width = start.size.x;
  let height = start.size.y;
  let updatesPosition = false;

  if (partId.includes("left")) {
    width = Math.max(DEBUG_WINDOW_MIN_WIDTH, start.size.x - dx);
    x = start.position.x + (start.size.x - width);
    updatesPosition = true;
  } else if (partId.includes("right")) {
    width = Math.max(DEBUG_WINDOW_MIN_WIDTH, start.size.x + dx);
  }

  if (partId.includes("top")) {
    height = Math.max(DEBUG_WINDOW_MIN_HEIGHT, start.size.y - dy);
    y = start.position.y + (start.size.y - height);
    updatesPosition = true;
  } else if (partId.includes("bottom")) {
    height = Math.max(DEBUG_WINDOW_MIN_HEIGHT, start.size.y + dy);
  }

  return {
    position: updatesPosition ? vec2(x, y) : undefined,
    size: vec2(width, height)
  };
}
