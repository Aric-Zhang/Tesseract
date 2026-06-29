import type { ScreenPoint } from "actor-system/gizmo";
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
import type { WindowFrameIntentSink } from "./window-frame-lifecycle";
import type {
  WindowFramePort,
  WindowFramePresentation,
  WindowFrameSuppressionReason,
} from "./window-frame-port";
import type { RegisteredWindowFramePort, WindowFramePortRegistry } from "./window-frame-port-registry";
import type { WindowTabDragSink } from "./window-dock-preview-component";
import { readWindowTabDragSource } from "ui-framework/window";
import { handleWindowFrameTabInputEnd } from "./window-frame-tab-input";
import { WINDOW_FRAME_TAB_ACTION_PART_ID, WINDOW_FRAME_TAB_PART_ID } from "ui-framework/window";
import { rectFromDomRect } from "ui-framework/window";
import { type WindowDockRect } from "ui-framework/window";
import { type WindowFrameSurfaceComponent, type WindowFrameSurfaceHost, type WindowFrameSurfaceSnapshot, type WindowRegisteredContent, type WindowWorkspaceGraphContentActiveState, type WindowWorkspaceGraphContentPlacement, type WindowWorkspaceSurfaceGeometryProjection } from "ui-framework/window";

export const workspaceRootDockFrameComponentType =
  "workspace-root-dock-frame-component" as ComponentType<WorkspaceRootDockFrameComponent>;

export const WORKSPACE_ROOT_FRAME_ID = "workspace-root-frame";
export const WORKSPACE_ROOT_FRAME_PRIORITY = 100;

export interface WorkspaceRootDockFrameComponentOptions {
  readonly id: string;
  readonly parent: HTMLElement;
  readonly frameId?: string;
  readonly priority?: number;
  readonly frameIntentSink?: WindowFrameIntentSink;
  readonly tabDragSink?: WindowTabDragSink;
  readonly framePortRegistry?: WindowFramePortRegistry;
  readonly document?: Pick<Document, "createElement">;
}

export interface WorkspaceRootDockFrameComponentServices {
  readonly surface: WindowFrameSurfaceComponent;
}

type WorkspaceRootPartId =
  | typeof WINDOW_FRAME_TAB_PART_ID
  | typeof WINDOW_FRAME_TAB_ACTION_PART_ID
  | "root-splitter"
  | "root-content";

const WORKSPACE_ROOT_SPLIT_MIN_PANE_SIZE = 80;

export class WorkspaceRootDockFrameComponent
  implements Component, WindowFramePort, ActorInputParticipant {
  readonly type = workspaceRootDockFrameComponentType;
  readonly actor: Actor;
  readonly id: string;
  enabled = true;

  readonly #root: HTMLDivElement;
  readonly #tabbar: HTMLDivElement;
  readonly #content: HTMLDivElement;
  readonly #surface: WindowFrameSurfaceComponent;
  readonly #surfaceHost: WindowFrameSurfaceHost;
  readonly #frameId: string;
  readonly #priority: number;
  readonly #frameIntentSink?: WindowFrameIntentSink;
  readonly #tabDragSink?: WindowTabDragSink;
  readonly #registration?: RegisteredWindowFramePort;
  readonly #presentationSuppressionReasons = new Set<WindowFrameSuppressionReason>();
  #draggingTab = false;

  constructor(
    actor: Actor,
    options: WorkspaceRootDockFrameComponentOptions,
    services: WorkspaceRootDockFrameComponentServices
  ) {
    this.actor = actor;
    this.id = options.id;
    this.#frameId = options.frameId ?? WORKSPACE_ROOT_FRAME_ID;
    this.#priority = options.priority ?? WORKSPACE_ROOT_FRAME_PRIORITY;
    this.#frameIntentSink = options.frameIntentSink;
    this.#tabDragSink = options.tabDragSink;
    this.#surface = services.surface;
    const documentRef = options.document ?? options.parent.ownerDocument ?? document;
    this.#root = documentRef.createElement("div");
    this.#root.className = "workspace-root-dock-frame";
    this.#tabbar = documentRef.createElement("div");
    this.#tabbar.className = "workspace-root-dock-frame__tabs";
    this.#content = documentRef.createElement("div");
    this.#content.className = "workspace-root-dock-frame__content";
    this.#root.append(this.#tabbar, this.#content);
    this.#surfaceHost = {
      id: this.id,
      document: documentRef,
      primaryTabbar: this.#tabbar,
      primaryContent: this.#content,
      splitMinPaneSize: WORKSPACE_ROOT_SPLIT_MIN_PANE_SIZE,
      hidePrimaryTabbarWhenSplit: true,
      classes: {
        pane: "workspace-root-dock-frame__pane",
        paneTabs: "workspace-root-dock-frame__pane-tabs",
        paneContent: "workspace-root-dock-frame__pane-content",
        split: "workspace-root-dock-frame__split",
        splitHorizontal: "workspace-root-dock-frame__split--horizontal",
        splitVertical: "workspace-root-dock-frame__split--vertical",
        splitter: "workspace-root-dock-frame__splitter",
        splitterHorizontal: "workspace-root-dock-frame__splitter--horizontal",
        splitterVertical: "workspace-root-dock-frame__splitter--vertical",
        tab: "workspace-root-dock-frame__tab",
        tabClose: "workspace-root-dock-frame__tab-close"
      },
      getEffectiveVisible: () => this.effectiveVisible,
      getInputStackPriority: () => this.inputStackPriority,
      getDockTargetFallbackBounds: () => rectFromDomRect(this.#root.getBoundingClientRect())
    };
    this.#surface.attachHost(this.#surfaceHost);
    options.parent.append(this.#root);

    this.#registration = options.framePortRegistry?.register({
      frameActor: actor,
      framePort: this,
      getBaseStackPriority: () => this.inputStackPriority,
      getStackPriority: () => this.inputStackPriority,
      canTarget: () => this.enabled && this.effectiveVisible,
      destroyWhenEmpty: false
    });
  }

  get frameId(): string {
    return this.#frameId;
  }

  get visiblePath(): null {
    return null;
  }

  get visible(): boolean {
    return true;
  }

  get presentationSuppressed(): boolean {
    return this.#presentationSuppressionReasons.size > 0;
  }

  get effectiveVisible(): boolean {
    return !this.presentationSuppressed;
  }

  get persistable(): boolean {
    return true;
  }

  get presentation(): WindowFramePresentation {
    return "windowed";
  }

  get inputStackPriority(): number {
    return this.#priority;
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

  getFloatingBounds(): WindowDockRect {
    return rectFromDomRect(this.#root.getBoundingClientRect());
  }

  restoreFloatingState(): void {}

  setPresentation(): void {}

  setPresentationSuppressed(reason: WindowFrameSuppressionReason, suppressed: boolean): void {
    const hadReason = this.#presentationSuppressionReasons.has(reason);
    if (suppressed === hadReason) return;
    if (suppressed) {
      this.#presentationSuppressionReasons.add(reason);
    } else {
      this.#presentationSuppressionReasons.delete(reason);
    }
    this.#root.hidden = !this.effectiveVisible;
    this.#surface.refreshActiveContentState();
  }

  requestVisible(): void {}

  hitTestInput(point: ScreenPoint): ActorInputHit | null {
    if (!this.enabled || !this.effectiveVisible || !isPointInsideRect(point, this.#root.getBoundingClientRect())) return null;
    const surfaceHit = this.#surface.hitTest(point);
    if (surfaceHit?.part === "tab-action") {
      return this.createHit(WINDOW_FRAME_TAB_ACTION_PART_ID, 100, surfaceHit.data);
    }
    if (surfaceHit?.part === "tab") {
      return this.createHit(WINDOW_FRAME_TAB_PART_ID, 50, surfaceHit.data);
    }
    if (surfaceHit?.part === "splitter") {
      return this.createHit("root-splitter", 90, surfaceHit.data);
    }
    if (surfaceHit?.part === "content") return this.createHit("root-content", 1);
    return null;
  }

  onInputStart(event: ActorInputStartEvent): void {
    this.#draggingTab = false;
    this.#surface.endSplitResize();
    if (event.hit.partId === "root-splitter") {
      this.#surface.beginSplitResize(event.hit.data);
      return;
    }
    if (event.hit.partId !== WINDOW_FRAME_TAB_PART_ID) return;
    const source = readWindowTabDragSource(this.#frameId, event.hit);
    if (source) {
      this.#draggingTab = true;
      this.#tabDragSink?.beginTabDrag(source, event.point);
    }
  }

  onInputMove(event: ActorInputMoveEvent): void {
    if (this.#draggingTab) {
      this.#tabDragSink?.moveTabDrag(event.point);
      return;
    }
    if (event.hit.partId === "root-splitter") {
      const resize = this.#surface.updateSplitRatioFromDrag(event);
      if (resize) {
        this.#frameIntentSink?.requestResizeFrameSplit?.(
          this.#frameId,
          resize.splitId,
          resize.ratio,
          "dock-drop"
        );
      }
      return;
    }
  }

  onInputEnd(event: ActorInputEndEvent): void {
    this.#surface.endSplitResize();
    const tabResult = handleWindowFrameTabInputEnd({
      event,
      frameId: this.#frameId,
      frameIntentSink: this.#frameIntentSink,
      tabDragSink: this.#tabDragSink,
      draggingTab: this.#draggingTab
    });
    this.#draggingTab = tabResult.draggingTab;
    if (tabResult.handled) return;
  }

  onInputCancel(_event: ActorInputCancelEvent): void {
    this.#surface.endSplitResize();
    if (this.#draggingTab) {
      this.#tabDragSink?.cancelTabDrag();
    }
    this.#draggingTab = false;
  }

  dispose(): void {
    this.enabled = false;
    this.#registration?.dispose();
    this.#surface.detachHost(this.#surfaceHost);
    this.#root.remove();
  }

  private createHit(partId: WorkspaceRootPartId, hitPriority: number, data?: unknown): ActorInputHit {
    const isContent = partId === "root-content";
    return {
      componentId: this.id,
      partId,
      kind: isContent ? "content" : "chrome",
      region: isContent ? "window-content" : "window-frame",
      scopeRoutePriority: isContent
        ? actorInputScopeRoutePriority.windowContent
        : actorInputScopeRoutePriority.windowChrome,
      localRoutePriority: 100,
      hitPriority,
      path: [{
        componentId: this.id,
        role: "surface",
        partId
      }],
      data
    };
  }
}

function isPointInsideRect(point: ScreenPoint, rect: DOMRectReadOnly): boolean {
  return point.x >= rect.left &&
    point.x <= rect.right &&
    point.y >= rect.top &&
    point.y <= rect.bottom;
}
